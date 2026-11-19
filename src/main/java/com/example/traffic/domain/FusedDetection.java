package com.example.traffic.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * WBF 融合后的检测结果，sources 记录参与聚簇的分支或子模型名。
 */
public record FusedDetection(
        @JsonProperty("cls") String cls,
        double conf,
        int[] box,
        List<String> sources) {

    public Detection toDetection() {
        return new Detection(cls, conf, box);
    }
}
