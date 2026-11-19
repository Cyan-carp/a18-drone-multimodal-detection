package com.example.traffic.domain;

import java.util.List;

/**
 * 完整场景：元信息 + 真值 + 图像访问地址。
 */
public record Scenario(
        String id,
        String name,
        String weather,
        String terrain,
        String density,
        String description,
        int width,
        int height,
        int objectCount,
        List<SceneObject> objects,
        String rgbUrl,
        String irUrl) {

    public static Scenario of(SceneMeta meta, String rgbUrl, String irUrl) {
        List<SceneObject> objects = meta.objects() == null ? List.of() : meta.objects();
        return new Scenario(
                meta.id(), meta.name(), meta.weather(), meta.terrain(), meta.density(), meta.description(),
                meta.width(), meta.height(), objects.size(), objects, rgbUrl, irUrl);
    }

    public ScenarioSummary summary() {
        return new ScenarioSummary(id, name, weather, terrain, density, description,
                width, height, objectCount, rgbUrl, irUrl);
    }
}
