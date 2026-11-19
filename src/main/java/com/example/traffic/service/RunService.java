package com.example.traffic.service;

import com.example.traffic.domain.BranchResult;
import com.example.traffic.domain.DetectParams;
import com.example.traffic.domain.Detection;
import com.example.traffic.domain.FusedDetection;
import com.example.traffic.domain.ImageInfo;
import com.example.traffic.domain.Metrics;
import com.example.traffic.domain.PageResult;
import com.example.traffic.domain.RunRecord;
import com.example.traffic.domain.RunStatus;
import com.example.traffic.domain.RunSummary;
import com.example.traffic.domain.Scenario;
import com.example.traffic.domain.SceneObject;
import com.example.traffic.domain.Source;
import com.example.traffic.engine.MetricsEvaluator;
import com.example.traffic.engine.MockInferenceEngine;
import com.example.traffic.web.ApiException;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 任务编排：状态流转、SSE 推送、模拟耗时与结果落库。
 */
@Service
public class RunService {

    private static final Logger log = LoggerFactory.getLogger(RunService.class);
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final Map<String, RunRecord> runs = new ConcurrentHashMap<>();
    private final Map<String, CopyOnWriteArrayList<SseEmitter>> streams = new ConcurrentHashMap<>();
    private final AtomicInteger seq = new AtomicInteger(0);
    private volatile String currentDay = LocalDateTime.now().format(DAY);

    private final ExecutorService executor;
    private final ScenarioService scenarios;
    private final UploadService uploads;
    private final MockInferenceEngine engine;
    private final MetricsEvaluator evaluator;
    private final LogService logs;
    private final RunStore store;

    public RunService(ExecutorService detectionExecutor, ScenarioService scenarios, UploadService uploads,
                      MockInferenceEngine engine, MetricsEvaluator evaluator, LogService logs, RunStore store) {
        this.executor = detectionExecutor;
        this.scenarios = scenarios;
        this.uploads = uploads;
        this.engine = engine;
        this.evaluator = evaluator;
        this.logs = logs;
        this.store = store;
    }

    @PostConstruct
    public void restore() {
        for (RunRecord record : store.loadRuns()) {
            RunRecord restored = record.status().isTerminal()
                    ? record
                    : record.failed(record.createdAt(), "服务重启，任务中断", record.elapsedMs());
            runs.put(restored.runId(), restored);
            bumpSeq(restored.runId());
        }
        log.info("恢复历史任务 {} 条", runs.size());
    }

    // ------------------------------------------------------------ 对外接口

    public RunRecord create(String sourceType, String sourceId, DetectParams params, String batchId) {
        DetectParams normalized = (params == null ? DetectParams.defaults() : params).normalized();
        normalized.validate();

        Source source;
        ImageInfo image;
        if ("scenario".equalsIgnoreCase(sourceType)) {
            Scenario scenario = scenarios.find(sourceId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SCENARIO_NOT_FOUND", "场景不存在", sourceId));
            source = new Source("scenario", scenario.id(), scenario.name());
            image = new ImageInfo(scenario.width(), scenario.height(), scenario.rgbUrl(), scenario.irUrl());
        } else if ("upload".equalsIgnoreCase(sourceType)) {
            if (!uploads.exists(sourceId)) {
                throw new ApiException(HttpStatus.NOT_FOUND, "UPLOAD_NOT_FOUND", "上传记录不存在", sourceId);
            }
            source = new Source("upload", sourceId, "本地上传 " + sourceId);
            image = resolveUploadSize(sourceId,
                    new ImageInfo(0, 0, uploads.url(sourceId, "rgb"), uploads.url(sourceId, "ir")));
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PARAM_INVALID", "sourceType 仅支持 scenario 或 upload", sourceType);
        }

        String runId = nextId();
        RunRecord record = RunRecord.queued(runId, LocalDateTime.now().format(TS), source, image, normalized, batchId);
        runs.put(runId, record);
        persist();
        logs.info("api", "创建任务 " + runId + "（" + source.name() + "）", runId);
        return record;
    }

    /** 异步执行，供单个任务使用。 */
    public void submit(String runId) {
        executor.submit(() -> runNow(runId));
    }

    public RunRecord get(String runId) {
        RunRecord record = runs.get(runId);
        if (record == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "RUN_NOT_FOUND", "检测任务不存在", runId);
        }
        return record;
    }

    public PageResult<RunSummary> list(int page, int size, String status, String keyword, String sourceType) {
        List<RunSummary> all = filtered(status, keyword, sourceType).stream().map(RunRecord::summary).toList();
        return PageResult.of(all, page, size);
    }

    /** 导出口径与列表一致，避免"看到的"和"导出的"不一致。 */
    public List<RunRecord> filtered(String status, String keyword, String sourceType) {
        String kw = keyword == null ? null : keyword.trim().toLowerCase();
        List<RunRecord> result = new ArrayList<>();
        for (RunRecord record : ordered()) {
            if (status != null && !status.isBlank() && !record.status().name().equalsIgnoreCase(status)) {
                continue;
            }
            if (sourceType != null && !sourceType.isBlank()
                    && !record.source().type().equalsIgnoreCase(sourceType)) {
                continue;
            }
            if (kw != null && !kw.isBlank()
                    && !record.runId().toLowerCase().contains(kw)
                    && !record.source().name().toLowerCase().contains(kw)) {
                continue;
            }
            result.add(record);
        }
        return result;
    }

    public void delete(String runId) {
        RunRecord record = get(runId);
        if (!record.status().isTerminal()) {
            throw new ApiException(HttpStatus.CONFLICT, "RUN_NOT_DELETABLE", "运行中的任务不可删除", runId);
        }
        runs.remove(runId);
        persist();
        logs.warn("api", "删除任务 " + runId, null);
    }

    public int deleteAll(List<String> ids) {
        int deleted = 0;
        for (String id : ids) {
            RunRecord record = runs.get(id);
            if (record != null && record.status().isTerminal()) {
                runs.remove(id);
                deleted++;
            }
        }
        if (deleted > 0) {
            persist();
            logs.warn("api", "批量删除任务 " + deleted + " 条", null);
        }
        return deleted;
    }

    public SseEmitter stream(String runId) {
        RunRecord record = get(runId);
        SseEmitter emitter = new SseEmitter(0L);
        streams.computeIfAbsent(runId, key -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> detach(runId, emitter));
        emitter.onTimeout(() -> detach(runId, emitter));
        emitter.onError(error -> detach(runId, emitter));
        send(emitter, "progress", progressPayload(record));
        if (record.status().isTerminal()) {
            send(emitter, "result", record);
            emitter.complete();
            detach(runId, emitter);
        }
        return emitter;
    }

    public Optional<RunRecord> find(String runId) {
        return Optional.ofNullable(runs.get(runId));
    }

    public int count() {
        return runs.size();
    }

    // ------------------------------------------------------------ 执行

    /** 同步执行一次任务，批量子任务复用同一入口。 */
    public void runNow(String runId) {
        RunRecord record = runs.get(runId);
        if (record == null) {
            return;
        }
        long start = System.currentTimeMillis();
        update(record.withStatus(RunStatus.RUNNING));
        try {
            String weather = "晴天";
            int width = record.image().width() > 0 ? record.image().width() : 1024;
            int height = record.image().height() > 0 ? record.image().height() : 1024;
            List<SceneObject> truths;

            if ("scenario".equals(record.source().type())) {
                Scenario scenario = scenarios.find(record.source().id())
                        .orElseThrow(() -> new IllegalStateException("场景丢失: " + record.source().id()));
                weather = scenario.weather();
                width = scenario.width();
                height = scenario.height();
                truths = scenario.objects();
            } else {
                truths = engine.syntheticTargets(record.source().id(), width, height);
            }

            stage(runId, "LOAD", 6, "载入双模态图像 " + width + "×" + height, 130);
            DetectParams params = record.params();
            Map<String, BranchResult> branches = new LinkedHashMap<>();

            if (params.branches().rgb()) {
                stage(runId, "RGB", 18, "RGB 分支推理（YOLO26 + 可见光）", 0);
                BranchResult rgb = engine.run(MockInferenceEngine.BRANCH_RGB, seedKey(record), truths,
                        width, height, params, weather);
                branches.put("rgb", rgb);
                log(runId, "RGB 分支输出 " + rgb.detections().size() + " 个候选框，耗时 " + rgb.elapsedMs() + " ms");
                pause(220);
            }

            if (params.branches().ir()) {
                stage(runId, "IR", 42, "红外分支推理（YOLO26 + 红外）", 0);
                BranchResult ir = engine.run(MockInferenceEngine.BRANCH_IR, seedKey(record), truths,
                        width, height, params, weather);
                branches.put("ir", ir);
                log(runId, "红外分支输出 " + ir.detections().size() + " 个候选框，耗时 " + ir.elapsedMs() + " ms");
                pause(200);
            }

            if (params.branches().dual()) {
                stage(runId, "DUAL", 64, "双流分支推理（dual_l / dual_6_0 / dual_l_50）", 0);
                BranchResult dual = engine.run(MockInferenceEngine.BRANCH_DUAL, seedKey(record), truths,
                        width, height, params, weather);
                branches.put("dual", dual);
                log(runId, "双流分支 3 个子模型共输出 " + dual.detections().size() + " 个候选框");
                pause(380);
            }

            stage(runId, "FUSE", 86, "WBF 加权框融合（IoU " + params.iou() + "）", 80);
            List<FusedDetection> fused = engine.fuse(branches, params);
            log(runId, "WBF 融合完成，保留 " + fused.size() + " 个目标");

            stage(runId, "POST", 94, "后处理与真值比对", 60);
            Metrics metrics = null;
            if ("scenario".equals(record.source().type())) {
                List<Detection> predictions = fused.stream().map(FusedDetection::toDetection).toList();
                metrics = evaluator.evaluate(predictions, truths);
            }

            long elapsed = System.currentTimeMillis() - start;
            RunRecord done = record.succeeded(LocalDateTime.now().format(TS), branches, fused, metrics, elapsed);
            update(done);
            stage(runId, "DONE", 100, "完成，共 " + fused.size() + " 个目标，耗时 " + elapsed + " ms", 0);
            log(runId, "任务完成，耗时 " + elapsed + " ms" + (metrics == null ? "" :
                    "，P=" + metrics.precision() + " R=" + metrics.recall()));
            finish(runId, done);
        } catch (RuntimeException e) {
            long elapsed = System.currentTimeMillis() - start;
            RunRecord failed = record.failed(LocalDateTime.now().format(TS), e.getMessage(), elapsed);
            update(failed);
            logs.error("engine", "任务失败: " + e.getMessage(), runId);
            fail(runId, "RUN_FAILED", e.getMessage());
            finish(runId, failed);
        }
    }

    // ------------------------------------------------------------ 内部工具

    private void stage(String runId, String stage, int percent, String message, long sleepMs) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("stage", stage);
        payload.put("percent", percent);
        payload.put("message", message);
        payload.put("ts", LocalDateTime.now().format(TS));
        broadcast(runId, "progress", payload);
        logs.info("pipeline", "[" + stage + "] " + message, runId);
        if (sleepMs > 0) {
            pause(sleepMs);
        }
    }

    private void log(String runId, String message) {
        var entry = logs.info("engine", message, runId);
        broadcast(runId, "log", entry);
    }

    private void pause(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private String seedKey(RunRecord record) {
        return record.source().type() + ":" + record.source().id();
    }

    private ImageInfo resolveUploadSize(String uploadId, ImageInfo fallback) {
        var file = uploads.file(uploadId, "rgb");
        if (file.isEmpty()) {
            return fallback;
        }
        try {
            var image = javax.imageio.ImageIO.read(file.get().toFile());
            if (image != null) {
                return new ImageInfo(image.getWidth(), image.getHeight(), fallback.rgbUrl(), fallback.irUrl());
            }
        } catch (Exception e) {
            log.warn("读取上传图像尺寸失败: {}", e.getMessage());
        }
        return fallback;
    }

    private void update(RunRecord record) {
        runs.put(record.runId(), record);
        persist();
    }

    private void persist() {
        store.saveRuns(ordered());
    }

    private List<RunRecord> ordered() {
        return runs.values().stream()
                .sorted(Comparator.comparing(RunRecord::runId).reversed())
                .toList();
    }

    private Map<String, Object> progressPayload(RunRecord record) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("stage", record.status() == RunStatus.QUEUED ? "QUEUED" : record.status().name());
        payload.put("percent", record.status() == RunStatus.SUCCESS ? 100 : record.status() == RunStatus.QUEUED ? 0 : 50);
        payload.put("message", "当前状态 " + record.status());
        payload.put("ts", LocalDateTime.now().format(TS));
        return payload;
    }

    private void finish(String runId, RunRecord record) {
        broadcast(runId, "result", record);
        CopyOnWriteArrayList<SseEmitter> list = streams.remove(runId);
        if (list != null) {
            for (SseEmitter emitter : list) {
                try {
                    emitter.complete();
                } catch (Exception ignored) {
                    // 客户端已断开，无需处理
                }
            }
        }
    }

    private void fail(String runId, String code, String message) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("code", code);
        payload.put("message", message == null ? "未知错误" : message);
        broadcast(runId, "error", payload);
    }

    private void broadcast(String runId, String event, Object payload) {
        CopyOnWriteArrayList<SseEmitter> list = streams.get(runId);
        if (list == null || list.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : list) {
            if (!send(emitter, event, payload)) {
                detach(runId, emitter);
            }
        }
    }

    private boolean send(SseEmitter emitter, String event, Object payload) {
        try {
            emitter.send(SseEmitter.event().name(event).data(payload));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void detach(String runId, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> list = streams.get(runId);
        if (list != null) {
            list.remove(emitter);
            if (list.isEmpty()) {
                streams.remove(runId);
            }
        }
    }

    private String nextId() {
        String day = LocalDateTime.now().format(DAY);
        synchronized (this) {
            if (!day.equals(currentDay)) {
                currentDay = day;
                seq.set(0);
            }
            return "R-" + day + "-" + String.format("%04d", seq.incrementAndGet());
        }
    }

    private void bumpSeq(String runId) {
        String[] parts = runId.split("-");
        if (parts.length == 3) {
            try {
                int value = Integer.parseInt(parts[2]);
                seq.updateAndGet(current -> Math.max(current, value));
            } catch (NumberFormatException ignored) {
                // 忽略异常编号
            }
        }
    }
}
