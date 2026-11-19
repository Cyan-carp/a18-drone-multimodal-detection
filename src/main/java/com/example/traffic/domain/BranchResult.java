package com.example.traffic.domain;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * 单条分支（rgb / ir / dual）的推理结果。models 仅在 dual 分支出现。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record BranchResult(
        double weight,
        long elapsedMs,
        List<Detection> detections,
        List<ModelBranch> models) {
}
