package com.example.traffic.domain;

/**
 * 场景列表项：不含真值，减少首屏载荷。
 */
public record ScenarioSummary(
        String id,
        String name,
        String weather,
        String terrain,
        String density,
        String description,
        int width,
        int height,
        int objectCount,
        String rgbUrl,
        String irUrl) {
}
