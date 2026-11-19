package com.example.traffic.engine;

import com.example.traffic.domain.Detection;
import com.example.traffic.domain.Metrics;
import com.example.traffic.domain.SceneObject;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * IoU 0.5 贪心匹配评估。目标数不超过 60，O(n²) 足够。
 */
@Component
public class MetricsEvaluator {

    private static final double IOU_THRESHOLD = 0.5;

    public Metrics evaluate(List<Detection> predictions, List<SceneObject> truth) {
        if (predictions == null || truth == null) {
            return null;
        }
        boolean[] used = new boolean[predictions.size()];
        int matched = 0;
        for (SceneObject gt : truth) {
            int bestIndex = -1;
            double bestIou = IOU_THRESHOLD;
            for (int i = 0; i < predictions.size(); i++) {
                if (used[i]) {
                    continue;
                }
                Detection p = predictions.get(i);
                if (!p.cls().equals(gt.cls())) {
                    continue;
                }
                double iou = WbfFuser.iou(p.box(), gt.box());
                if (iou >= bestIou) {
                    bestIou = iou;
                    bestIndex = i;
                }
            }
            if (bestIndex >= 0) {
                used[bestIndex] = true;
                matched++;
            }
        }
        int fp = predictions.size() - matched;
        int fn = truth.size() - matched;
        return Metrics.of(matched, fp, fn);
    }
}
