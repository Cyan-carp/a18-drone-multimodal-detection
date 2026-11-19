package com.example.traffic.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 单个检测框。字段名 cls 对应 JSON 的 "cls"，不要改成 class（Java 关键字）。
 */
public record Detection(
        @JsonProperty("cls") String cls,
        double conf,
        int[] box) {

    public double area() {
        return (double) Math.max(0, box[2] - box[0]) * Math.max(0, box[3] - box[1]);
    }
}
