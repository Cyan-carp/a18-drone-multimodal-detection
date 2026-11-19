package com.example.traffic.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 应用级配置。所有字段在紧凑构造器里给出默认值，避免 yml 缺项导致 NPE。
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(String dataDir, Integer historyLimit, MockSettings mock) {

    public AppProperties {
        dataDir = (dataDir == null || dataDir.isBlank()) ? "data" : dataDir;
        historyLimit = (historyLimit == null || historyLimit <= 0) ? 500 : historyLimit;
        mock = (mock == null) ? new MockSettings(null, null, null, null) : mock;
    }

    public record MockSettings(Double conf, Double iou, Integer imgsz, Integer scenarioCount) {

        public MockSettings {
            conf = (conf == null) ? 0.10 : conf;
            iou = (iou == null) ? 0.58 : iou;
            imgsz = (imgsz == null) ? 1024 : imgsz;
            scenarioCount = (scenarioCount == null || scenarioCount <= 0) ? 10 : scenarioCount;
        }
    }
}
