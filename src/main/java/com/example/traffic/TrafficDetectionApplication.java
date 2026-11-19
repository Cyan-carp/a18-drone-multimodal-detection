package com.example.traffic;

import com.example.traffic.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.event.EventListener;

import java.nio.file.Path;
import java.nio.file.Paths;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class TrafficDetectionApplication {

    private static final Logger log = LoggerFactory.getLogger(TrafficDetectionApplication.class);

    private final AppProperties props;

    public TrafficDetectionApplication(AppProperties props) {
        this.props = props;
    }

    public static void main(String[] args) {
        SpringApplication.run(TrafficDetectionApplication.class, args);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void announce() {
        Path dataDir = Paths.get(props.dataDir()).toAbsolutePath().normalize();
        log.info("演示平台已就绪: http://localhost:8080/api/system/info");
        log.info("模拟模式 MOCK 已启用，数据目录 {}", dataDir);
        log.info("真实推理替换点: com.example.traffic.engine.MockInferenceEngine");
    }
}
