package com.example.traffic.service;

import com.example.traffic.domain.BatchJob;
import com.example.traffic.domain.DetectParams;
import com.example.traffic.domain.PageResult;
import com.example.traffic.domain.RunRecord;
import com.example.traffic.web.ApiException;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 批量任务：串行执行子任务，避免与单次检测抢线程。
 */
@Service
public class BatchService {

    private static final Logger log = LoggerFactory.getLogger(BatchService.class);
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final Map<String, BatchJob> batches = new ConcurrentHashMap<>();
    private final AtomicInteger seq = new AtomicInteger(0);
    private volatile String currentDay = LocalDateTime.now().format(DAY);
    private final ExecutorService batchExecutor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "batch-worker");
        thread.setDaemon(true);
        return thread;
    });

    private final RunService runs;
    private final RunStore store;
    private final LogService logs;

    public BatchService(RunService runs, RunStore store, LogService logs) {
        this.runs = runs;
        this.store = store;
        this.logs = logs;
    }

    @PostConstruct
    public void restore() {
        for (BatchJob job : store.loadBatches()) {
            batches.put(job.batchId(), job);
            bumpSeq(job.batchId());
        }
    }

    @PreDestroy
    public void shutdown() {
        batchExecutor.shutdownNow();
    }

    public BatchJob create(List<String> scenarioIds, DetectParams params) {
        if (scenarioIds == null || scenarioIds.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PARAM_INVALID", "请至少选择一个场景", null);
        }
        if (scenarioIds.size() > 20) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PARAM_INVALID", "单批最多 20 个场景", String.valueOf(scenarioIds.size()));
        }
        String batchId = nextId();
        List<String> runIds = new ArrayList<>();
        DetectParams normalized = (params == null ? DetectParams.defaults() : params).normalized();
        normalized.validate();
        for (String scenarioId : scenarioIds) {
            RunRecord record = runs.create("scenario", scenarioId, normalized, batchId);
            runIds.add(record.runId());
        }
        BatchJob job = new BatchJob(batchId, "RUNNING", LocalDateTime.now().format(TS),
                runIds.size(), 0, 0, runIds, normalized);
        batches.put(batchId, job);
        store.saveBatches(ordered());
        logs.info("batch", "创建批次 " + batchId + "，共 " + runIds.size() + " 个任务", null);

        batchExecutor.submit(() -> execute(job));
        return job;
    }

    public BatchJob get(String batchId) {
        BatchJob job = batches.get(batchId);
        if (job == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "BATCH_NOT_FOUND", "批次不存在", batchId);
        }
        return job;
    }

    public PageResult<BatchJob> list(int page, int size) {
        return PageResult.of(ordered(), page, size);
    }

    public void delete(String batchId) {
        BatchJob job = get(batchId);
        if ("RUNNING".equals(job.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "BATCH_NOT_DELETABLE", "运行中的批次不可删除", batchId);
        }
        batches.remove(batchId);
        store.saveBatches(ordered());
        logs.warn("batch", "删除批次 " + batchId, null);
    }

    private void execute(BatchJob job) {
        int done = 0;
        int failed = 0;
        for (String runId : job.runIds()) {
            try {
                runs.runNow(runId);
                boolean isFailed = runs.find(runId)
                        .map(record -> record.status() == com.example.traffic.domain.RunStatus.FAILED)
                        .orElse(true);
                if (isFailed) {
                    failed++;
                }
            } catch (RuntimeException e) {
                failed++;
                log.warn("批量子任务 {} 执行异常: {}", runId, e.getMessage());
            }
            done++;
            BatchJob updated = job.progressed(done, failed);
            job = updated;
            batches.put(job.batchId(), updated);
            store.saveBatches(ordered());
        }
        logs.info("batch", "批次 " + job.batchId() + " 结束：" + job.status(), null);
    }

    private List<BatchJob> ordered() {
        return batches.values().stream()
                .sorted(Comparator.comparing(BatchJob::batchId).reversed())
                .toList();
    }

    private String nextId() {
        String day = LocalDateTime.now().format(DAY);
        synchronized (this) {
            if (!day.equals(currentDay)) {
                currentDay = day;
                seq.set(0);
            }
            return "B-" + day + "-" + String.format("%04d", seq.incrementAndGet());
        }
    }

    private void bumpSeq(String batchId) {
        String[] parts = batchId.split("-");
        if (parts.length == 3) {
            try {
                int value = Integer.parseInt(parts[2]);
                seq.updateAndGet(current -> Math.max(current, value));
            } catch (NumberFormatException ignored) {
                // 编号异常时保持原值
            }
        }
    }
}
