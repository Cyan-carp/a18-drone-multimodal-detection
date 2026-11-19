package com.example.traffic.domain;

/**
 * 一条运行日志。seq 全局递增，前端据此去重与排序。
 */
public record LogEntry(long seq, String ts, String level, String scope, String message, String runId) {
}
