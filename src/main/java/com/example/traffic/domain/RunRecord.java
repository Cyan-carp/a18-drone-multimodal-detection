package com.example.traffic.domain;

import java.util.List;
import java.util.Map;

/**
 * 一次检测任务的完整记录。不可变，状态推进时由服务层整体替换。
 */
public record RunRecord(
        String runId,
        RunStatus status,
        String createdAt,
        String finishedAt,
        Source source,
        ImageInfo image,
        DetectParams params,
        Map<String, BranchResult> branches,
        List<FusedDetection> fused,
        Metrics metrics,
        long elapsedMs,
        String batchId,
        String error) {

    public static RunRecord queued(String runId, String createdAt, Source source, ImageInfo image,
                                   DetectParams params, String batchId) {
        return new RunRecord(runId, RunStatus.QUEUED, createdAt, null, source, image, params,
                null, null, null, 0L, batchId, null);
    }

    public RunRecord withStatus(RunStatus next) {
        return new RunRecord(runId, next, createdAt, finishedAt, source, image, params,
                branches, fused, metrics, elapsedMs, batchId, error);
    }

    public RunRecord succeeded(String finishedAt, Map<String, BranchResult> branches,
                               List<FusedDetection> fused, Metrics metrics, long elapsedMs) {
        return new RunRecord(runId, RunStatus.SUCCESS, createdAt, finishedAt, source, image, params,
                branches, fused, metrics, elapsedMs, batchId, null);
    }

    public RunRecord failed(String finishedAt, String message, long elapsedMs) {
        return new RunRecord(runId, RunStatus.FAILED, createdAt, finishedAt, source, image, params,
                null, null, null, elapsedMs, batchId, message);
    }

    public RunSummary summary() {
        Double recall = metrics == null ? null : metrics.recall();
        int fusedCount = fused == null ? 0 : fused.size();
        return new RunSummary(runId, status, createdAt, source, fusedCount, elapsedMs, recall, batchId);
    }
}
