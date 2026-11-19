package com.example.traffic.domain;

/**
 * 任务来源：scenario（内置场景）或 upload（用户上传）。
 */
public record Source(String type, String id, String name) {
}
