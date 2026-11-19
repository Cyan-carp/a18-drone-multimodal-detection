package com.example.traffic.engine;

import com.example.traffic.domain.BranchResult;
import com.example.traffic.domain.DetectParams;
import com.example.traffic.domain.Detection;
import com.example.traffic.domain.FusedDetection;
import com.example.traffic.domain.ModelBranch;
import com.example.traffic.domain.SceneObject;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * 模拟推理引擎：由真值派生三条分支的检测结果。
 *
 * <p>扰动包含漏检（按分支召回率）、误分类（van↔car、truck↔freight_car）、定位抖动、
 * 低置信误检；置信度以真实 per-class AP 为中心采样。种子取自「来源 + 分支」，
 * 因此同一场景重复检测结果逐字段一致。</p>
 *
 * <p>替换真实模型时，只需把本类改成调用 Python 推理服务的 HTTP 客户端，
 * 返回相同的 {@link BranchResult} 结构即可，上层与前端无需改动。</p>
 */
@Component
public class MockInferenceEngine {

    public static final String BRANCH_RGB = "rgb";
    public static final String BRANCH_IR = "ir";
    public static final String BRANCH_DUAL = "dual";

    private static final String[] CLASSES = {"car", "truck", "bus", "van", "freight_car"};
    private static final double[] CLASS_P = {0.55, 0.16, 0.08, 0.14, 0.07};
    private static final Map<String, Double> CLASS_AP = Map.of(
            "car", 0.974,
            "truck", 0.808,
            "bus", 0.963,
            "van", 0.705,
            "freight_car", 0.731);

    private record SubModel(String name, double weight, double recall) {
    }

    private static final List<SubModel> DUAL_MODELS = List.of(
            new SubModel("dual_l", 1.20, 0.925),
            new SubModel("dual_6_0", 0.95, 0.895),
            new SubModel("dual_l_50", 1.00, 0.910));

    private final WbfFuser fuser;

    public MockInferenceEngine(WbfFuser fuser) {
        this.fuser = fuser;
    }

    /** 上传图像没有真值，按其尺寸生成一份"看起来像道路车流"的虚拟目标布局。 */
    public List<SceneObject> syntheticTargets(String key, int width, int height) {
        Random rnd = new Random(key.hashCode() * 31L + 17L);
        int count = 8 + rnd.nextInt(7);
        List<SceneObject> targets = new ArrayList<>();
        int rows = 3;
        for (int i = 0; i < count; i++) {
            String cls = pickClass(rnd);
            int row = i % rows;
            double cy = height * (0.34 + row * 0.14) + (rnd.nextDouble() - 0.5) * 40;
            double cx = width * (0.12 + 0.76 * (i / (double) count)) + (rnd.nextDouble() - 0.5) * 60;
            int len = switch (cls) {
                case "truck", "freight_car" -> 62;
                case "bus" -> 70;
                case "van" -> 46;
                default -> 42;
            };
            int wid = switch (cls) {
                case "truck", "freight_car" -> 27;
                case "bus" -> 29;
                case "van" -> 23;
                default -> 21;
            };
            int x1 = clamp((int) cx - len / 2, 4, width - 8);
            int y1 = clamp((int) cy - wid / 2, 4, height - 8);
            int x2 = clamp(x1 + len, x1 + 8, width - 4);
            int y2 = clamp(y1 + wid, y1 + 6, height - 4);
            targets.add(new SceneObject(i + 1, cls, new int[]{x1, y1, x2, y2}));
        }
        return targets;
    }

    public BranchResult run(String branch, String sourceKey, List<SceneObject> truths,
                            int width, int height, DetectParams params, String weather) {
        DetectParams p = params.normalized();
        return switch (branch) {
            case BRANCH_RGB -> new BranchResult(1.70, elapsed(seed(sourceKey, "rgb"), 190, p.imgsz()),
                    detect(sourceKey, "rgb", 1.70, recall("rgb", weather), truths, width, height, p, weather), null);
            case BRANCH_IR -> new BranchResult(1.95, elapsed(seed(sourceKey, "ir"), 170, p.imgsz()),
                    detect(sourceKey, "ir", 1.95, recall("ir", weather), truths, width, height, p, weather), null);
            case BRANCH_DUAL -> dual(sourceKey, truths, width, height, p, weather);
            default -> throw new IllegalArgumentException("未知分支: " + branch);
        };
    }

    private BranchResult dual(String sourceKey, List<SceneObject> truths, int width, int height,
                              DetectParams p, String weather) {
        List<ModelBranch> models = new ArrayList<>();
        List<Detection> merged = new ArrayList<>();
        double totalWeight = 0;
        long totalElapsed = 0;
        for (SubModel model : DUAL_MODELS) {
            List<Detection> detections = detect(sourceKey, model.name(), model.weight(),
                    model.recall() + weatherShift(weather, true, 0.0), truths, width, height, p, weather);
            long cost = elapsed(seed(sourceKey, model.name()), 130, p.imgsz());
            models.add(new ModelBranch(model.name(), model.weight(), cost, detections));
            merged.addAll(detections);
            totalWeight += model.weight();
            totalElapsed += cost;
        }
        merged.sort(Comparator.comparingDouble(Detection::conf).reversed());
        return new BranchResult(round(totalWeight), totalElapsed, merged, models);
    }

    public List<FusedDetection> fuse(Map<String, BranchResult> branches, DetectParams params) {
        if (branches == null || branches.isEmpty()) {
            return List.of();
        }
        List<WbfFuser.WeightedSource> sources = new ArrayList<>();
        branches.forEach((name, branch) -> {
            if (branch.models() != null) {
                branch.models().forEach(m ->
                        sources.add(new WbfFuser.WeightedSource(m.name(), m.weight(), m.detections())));
            } else {
                sources.add(new WbfFuser.WeightedSource(name, branch.weight(), branch.detections()));
            }
        });
        DetectParams p = params.normalized();
        return fuser.fuse(sources, p.iou(), p.conf());
    }

    // ---------------------------------------------------------------- 内部实现

    private List<Detection> detect(String sourceKey, String branchKey, double weight, double recall,
                                   List<SceneObject> truths, int width, int height,
                                   DetectParams params, String weather) {
        Random rnd = new Random(seed(sourceKey, branchKey));
        List<Detection> detections = new ArrayList<>();
        for (SceneObject truth : truths) {
            // 少数极难样本（遮挡、极小目标）所有分支都检不到，用来解释召回率不足 100%
            double miss = new Random((sourceKey + "#miss#" + truth.id()).hashCode()).nextDouble();
            if (miss < 0.05) {
                continue;
            }
            if (rnd.nextDouble() > recall) {
                continue;
            }
            String cls = confuse(truth.cls(), rnd);
            // 同一目标在各分支共享同一套定位误差，模拟"同一检测器族"的系统性偏差，
            // 保证 WBF 能按 IoU 聚簇；分支间差异只体现在召回、分类与置信度上。
            Random boxRnd = new Random((sourceKey + "#bbox#" + truth.id()).hashCode());
            int[] box = jitter(truth.box(), boxRnd, width, height);
            double conf = confidence(cls, weather, branchKey.startsWith("dual"), rnd);
            if (conf < params.conf()) {
                continue;
            }
            detections.add(new Detection(cls, round(conf), box));
        }

        int fpCount = falsePositives(truths.size(), weather, branchKey, rnd);
        for (int i = 0; i < fpCount; i++) {
            String cls = pickClass(rnd);
            int[] box = randomRoadBox(rnd, width, height);
            double conf = 0.10 + rnd.nextDouble() * 0.25;
            if (conf < params.conf()) {
                continue;
            }
            detections.add(new Detection(cls, round(conf), box));
        }

        detections.sort(Comparator.comparingDouble(Detection::conf).reversed());
        return detections.size() > 80 ? detections.subList(0, 80) : detections;
    }

    private String confuse(String cls, Random rnd) {
        double r = rnd.nextDouble();
        return switch (cls) {
            case "van" -> r < 0.18 ? "car" : cls;
            case "car" -> r < 0.05 ? "van" : cls;
            case "truck" -> r < 0.12 ? "freight_car" : cls;
            case "freight_car" -> r < 0.10 ? "truck" : cls;
            case "bus" -> r < 0.06 ? "truck" : cls;
            default -> cls;
        };
    }

    private int[] jitter(int[] box, Random rnd, int width, int height) {
        double dx = (rnd.nextDouble() - 0.5) * 4.0;
        double dy = (rnd.nextDouble() - 0.5) * 4.0;
        int x1 = clamp((int) Math.round(box[0] + dx), 2, width - 10);
        int y1 = clamp((int) Math.round(box[1] + dy), 2, height - 10);
        int x2 = clamp((int) Math.round(box[2] + dx), x1 + 6, width - 2);
        int y2 = clamp((int) Math.round(box[3] + dy), y1 + 5, height - 2);
        return new int[]{x1, y1, x2, y2};
    }

    private double confidence(String cls, String weather, boolean dual, Random rnd) {
        double mean = CLASS_AP.getOrDefault(cls, 0.80);
        boolean night = "夜间".equals(weather);
        boolean cloudy = "阴天".equals(weather);
        if (night) {
            mean += dual ? 0.0 : 0.02;
        } else if (cloudy) {
            mean -= 0.015;
        }
        double value = mean + rnd.nextGaussian() * 0.055;
        return Math.max(0.30, Math.min(0.995, value));
    }

    private double recall(String branch, String weather) {
        boolean night = "夜间".equals(weather);
        boolean cloudy = "阴天".equals(weather);
        if (BRANCH_RGB.equals(branch)) {
            return night ? 0.62 : cloudy ? 0.83 : 0.86;
        }
        return night ? 0.91 : cloudy ? 0.86 : 0.80;
    }

    private double weatherShift(String weather, boolean dual, double base) {
        if ("夜间".equals(weather)) {
            return dual ? 0.005 : 0.02;
        }
        if ("阴天".equals(weather)) {
            return -0.005;
        }
        return base;
    }

    private int falsePositives(int truthCount, String weather, String branchKey, Random rnd) {
        double factor = 1.0;
        if ("夜间".equals(weather) && branchKey.contains("ir")) {
            factor = 0.5;
        }
        int base = (int) Math.round(truthCount * 0.05 * factor);
        return base + (rnd.nextDouble() < 0.25 ? 1 : 0);
    }

    private int[] randomRoadBox(Random rnd, int width, int height) {
        int len = 20 + rnd.nextInt(52);
        int wid = 14 + rnd.nextInt(16);
        int x1 = 20 + rnd.nextInt(Math.max(1, width - len - 40));
        int y1 = (int) (height * 0.30) + rnd.nextInt(Math.max(1, (int) (height * 0.40)));
        return new int[]{x1, y1, clamp(x1 + len, 0, width - 1), clamp(y1 + wid, 0, height - 1)};
    }

    private long elapsed(int seed, int base, int imgsz) {
        Random rnd = new Random(seed * 31L + 7L);
        double factor = imgsz / 1024.0;
        return Math.round((base + rnd.nextInt(70)) * factor);
    }

    private int seed(String sourceKey, String branch) {
        return (sourceKey + "|" + branch).hashCode();
    }

    private String pickClass(Random rnd) {
        double r = rnd.nextDouble();
        double acc = 0;
        for (int i = 0; i < CLASSES.length; i++) {
            acc += CLASS_P[i];
            if (r <= acc) {
                return CLASSES[i];
            }
        }
        return CLASSES[0];
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private double round(double value) {
        return Math.round(value * 10000d) / 10000d;
    }
}
