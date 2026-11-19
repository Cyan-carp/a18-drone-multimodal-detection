package com.example.traffic.domain;

import java.util.List;

/**
 * 批量任务。status 取值 RUNNING / SUCCESS / PARTIAL / FAILED。
 */
public record BatchJob(
        String batchId,
        String status,
        String createdAt,
        int total,
        int completed,
        int failed,
        List<String> runIds,
        DetectParams params) {

    public BatchJob progressed(int done, int failedCount) {
        String next;
        if (done < total) {
            next = "RUNNING";
        } else if (failedCount == 0) {
            next = "SUCCESS";
        } else if (failedCount < total) {
            next = "PARTIAL";
        } else {
            next = "FAILED";
        }
        return new BatchJob(batchId, next, createdAt, total, done, failedCount, runIds, params);
    }
}
