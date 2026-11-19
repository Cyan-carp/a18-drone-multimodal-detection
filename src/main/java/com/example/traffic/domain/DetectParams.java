package com.example.traffic.domain;

/**
 * 检测参数。前端可能只传部分字段，统一经 {@link #normalized()} 补齐再使用。
 */
public record DetectParams(Double conf, Double iou, Integer imgsz, BranchFlags branches) {

    public static final double DEFAULT_CONF = 0.10;
    public static final double DEFAULT_IOU = 0.58;
    public static final int DEFAULT_IMGSZ = 1024;

    public DetectParams {
        branches = branches == null ? new BranchFlags(null, null, null) : branches;
    }

    public static DetectParams defaults() {
        return new DetectParams(DEFAULT_CONF, DEFAULT_IOU, DEFAULT_IMGSZ, new BranchFlags(true, true, true));
    }

    public DetectParams normalized() {
        double c = conf == null ? DEFAULT_CONF : conf;
        double i = iou == null ? DEFAULT_IOU : iou;
        int s = imgsz == null ? DEFAULT_IMGSZ : imgsz;
        return new DetectParams(c, i, s, branches.normalized());
    }

    /** 参数越界直接拒绝，不静默修正，避免"看起来跑了其实没按参数跑"。 */
    public void validate() {
        if (conf < 0.01 || conf > 0.95) {
            throw new IllegalArgumentException("conf 需在 [0.01, 0.95] 之间");
        }
        if (iou < 0.05 || iou > 0.95) {
            throw new IllegalArgumentException("iou 需在 [0.05, 0.95] 之间");
        }
        if (imgsz != 640 && imgsz != 1024) {
            throw new IllegalArgumentException("imgsz 仅支持 640 或 1024");
        }
        if (!branches.rgb() && !branches.ir() && !branches.dual()) {
            throw new IllegalArgumentException("至少需要开启一个分支");
        }
    }

    public record BranchFlags(Boolean rgb, Boolean ir, Boolean dual) {

        public BranchFlags normalized() {
            return new BranchFlags(rgb == null || rgb, ir == null || ir, dual == null || dual);
        }
    }
}
