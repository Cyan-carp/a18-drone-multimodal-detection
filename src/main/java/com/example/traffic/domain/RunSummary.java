package com.example.traffic.domain;

/**
 * 任务列表项，供任务中心表格使用。
 */
public record RunSummary(
        String runId,
        RunStatus status,
        String createdAt,
        Source source,
        int fusedCount,
        long elapsedMs,
        Double recall,
        String batchId) {
}
