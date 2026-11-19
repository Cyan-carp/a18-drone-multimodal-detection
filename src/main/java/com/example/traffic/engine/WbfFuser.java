package com.example.traffic.engine;

import com.example.traffic.domain.Detection;
import com.example.traffic.domain.FusedDetection;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 加权框融合（Weighted Boxes Fusion）。
 *
 * <ul>
 *   <li>同类别按 IoU 阈值贪心聚簇，簇锚点为置信度最高的框；</li>
 *   <li>坐标按 conf × weight 加权平均；</li>
 *   <li>置信度为加权均值，再乘 min(模型数, 簇内框数) / 模型数 惩罚；</li>
 *   <li>先过滤 skipBoxThr 再过滤 finalConf，与真实 WBF 实现顺序一致。</li>
 * </ul>
 */
@Component
public class WbfFuser {

    public record WeightedSource(String name, double weight, List<Detection> detections) {
    }

    private record Entry(String source, double weight, Detection detection) {
    }

    public List<FusedDetection> fuse(List<WeightedSource> sources, double iouThr, double confThr) {
        if (sources == null || sources.isEmpty()) {
            return List.of();
        }
        int modelCount = sources.size();
        Map<String, List<Entry>> byClass = new LinkedHashMap<>();
        for (WeightedSource source : sources) {
            if (source.detections() == null) {
                continue;
            }
            for (Detection d : source.detections()) {
                byClass.computeIfAbsent(d.cls(), key -> new ArrayList<>())
                        .add(new Entry(source.name(), source.weight(), d));
            }
        }

        List<FusedDetection> fused = new ArrayList<>();
        for (Map.Entry<String, List<Entry>> group : byClass.entrySet()) {
            List<Entry> entries = new ArrayList<>(group.getValue());
            entries.sort(Comparator.comparingDouble((Entry e) -> e.detection().conf()).reversed());

            List<List<Entry>> clusters = new ArrayList<>();
            for (Entry entry : entries) {
                if (entry.detection().conf() < 0.01) {
                    continue;
                }
                List<Entry> target = null;
                for (List<Entry> cluster : clusters) {
                    if (iou(cluster.get(0).detection().box(), entry.detection().box()) >= iouThr) {
                        target = cluster;
                        break;
                    }
                }
                if (target == null) {
                    clusters.add(new ArrayList<>(List.of(entry)));
                } else {
                    target.add(entry);
                }
            }

            for (List<Entry> cluster : clusters) {
                double sumWeight = 0d;
                double sumConfWeight = 0d;
                double[] coords = new double[4];
                Set<String> sourcesInCluster = new LinkedHashSet<>();
                for (Entry entry : cluster) {
                    double w = entry.weight();
                    double c = entry.detection().conf();
                    sumWeight += w;
                    sumConfWeight += c * w;
                    int[] box = entry.detection().box();
                    for (int i = 0; i < 4; i++) {
                        coords[i] += box[i] * c * w;
                    }
                    sourcesInCluster.add(entry.source());
                }
                if (sumWeight <= 0 || sumConfWeight <= 0) {
                    continue;
                }
                double conf = sumConfWeight / sumWeight;
                double scale = Math.min(modelCount, cluster.size()) / (double) modelCount;
                conf = conf * scale;
                if (conf < confThr) {
                    continue;
                }
                int[] box = new int[4];
                for (int i = 0; i < 4; i++) {
                    box[i] = (int) Math.round(coords[i] / sumConfWeight);
                }
                fused.add(new FusedDetection(group.getKey(), round(conf), box, new ArrayList<>(sourcesInCluster)));
            }
        }

        fused.sort(Comparator.comparingDouble(FusedDetection::conf).reversed());
        return fused;
    }

    public static double iou(int[] a, int[] b) {
        int x1 = Math.max(a[0], b[0]);
        int y1 = Math.max(a[1], b[1]);
        int x2 = Math.min(a[2], b[2]);
        int y2 = Math.min(a[3], b[3]);
        int inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
        if (inter == 0) {
            return 0d;
        }
        double areaA = (double) Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1]);
        double areaB = (double) Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
        return inter / (areaA + areaB - inter);
    }

    private double round(double value) {
        return Math.round(value * 10000d) / 10000d;
    }
}
