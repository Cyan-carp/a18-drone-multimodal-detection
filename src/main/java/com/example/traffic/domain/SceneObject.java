package com.example.traffic.domain;

/**
 * 场景真值目标。box = [x1, y1, x2, y2]，图像原始像素坐标。
 */
public record SceneObject(int id, String cls, int[] box) {
}
