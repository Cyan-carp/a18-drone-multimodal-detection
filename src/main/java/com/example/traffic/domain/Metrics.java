package com.example.traffic.domain;

/**
 * 与真值比对得到的评估指标。上传图像无真值时不产生该对象。
 */
public record Metrics(int tp, int fp, int fn, double precision, double recall) {

    public static Metrics of(int tp, int fp, int fn) {
        double p = (tp + fp) == 0 ? 0d : (double) tp / (tp + fp);
        double r = (tp + fn) == 0 ? 0d : (double) tp / (tp + fn);
        return new Metrics(tp, fp, fn, round(p), round(r));
    }

    private static double round(double value) {
        return Math.round(value * 10000d) / 10000d;
    }
}
