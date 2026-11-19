package com.example.traffic.domain;

import java.util.List;

/**
 * 落盘于 data/scenarios/{id}.json 的场景元信息，刻意不含访问地址，避免文件内容随端口变化。
 */
public record SceneMeta(
        String id,
        String name,
        String weather,
        String terrain,
        String density,
        String description,
        int width,
        int height,
        List<SceneObject> objects) {
}
