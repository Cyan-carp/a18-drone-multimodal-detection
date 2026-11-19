package com.example.traffic.domain;

/**
 * 参与检测的双模态图像信息，缺失的一路为 null。
 */
public record ImageInfo(int width, int height, String rgbUrl, String irUrl) {
}
