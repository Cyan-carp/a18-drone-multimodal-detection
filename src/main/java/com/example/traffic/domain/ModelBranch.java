package com.example.traffic.domain;

import java.util.List;

/**
 * dual 分支下的单个子模型结果（dual_l / dual_6_0 / dual_l_50）。
 */
public record ModelBranch(String name, double weight, long elapsedMs, List<Detection> detections) {
}
