package com.example.traffic.web;

import com.example.traffic.config.AppProperties;
import com.example.traffic.service.LogService;
import com.example.traffic.service.RunService;
import com.example.traffic.service.ScenarioService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/system")
public class SystemController {

    private final ScenarioService scenarios;
    private final RunService runs;
    private final LogService logs;
    private final AppProperties props;
    private final String port;

    public SystemController(ScenarioService scenarios, RunService runs, LogService logs,
                            AppProperties props, @Value("${server.port:8080}") String port) {
        this.scenarios = scenarios;
        this.runs = runs;
        this.logs = logs;
        this.props = props;
        this.port = port;
    }

    @GetMapping("/info")
    public Map<String, Object> info() {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("mode", "MOCK");
        info.put("engine", "Java 内置模拟推理引擎（无真实权重）");
        info.put("version", "1.0.0");
        info.put("jdk", System.getProperty("java.version"));
        info.put("port", port);
        info.put("dataDir", Paths.get(props.dataDir()).toAbsolutePath().normalize().toString());
        info.put("scenarioCount", scenarios.count());
        info.put("runCount", runs.count());
        info.put("historyLimit", props.historyLimit());

        Map<String, Object> branchWeights = new LinkedHashMap<>();
        branchWeights.put("rgb", 1.70);
        branchWeights.put("ir", 1.95);
        branchWeights.put("dual", Map.of("dual_l", 1.20, "dual_6_0", 0.95, "dual_l_50", 1.00));
        info.put("branchWeights", branchWeights);

        info.put("models", List.of(
                model("yolo26l_rgb", "rgb", "yolo26l.pt", 1.70),
                model("yolo26l_ir", "ir", "yolo26l.pt", 1.95),
                model("dual_l", "dual", "yolo26l.pt", 1.20),
                model("dual_6_0", "dual", "yolo26m.pt", 0.95),
                model("dual_l_50", "dual", "yolo26l.pt", 1.00)));
        info.put("classes", List.of("car", "truck", "bus", "van", "freight_car"));
        info.put("mock", Map.of(
                "conf", props.mock().conf(),
                "iou", props.mock().iou(),
                "imgsz", props.mock().imgsz()));
        return info;
    }

    @PostMapping("/regenerate-scenarios")
    public Map<String, Object> regenerate() throws IOException {
        long start = System.currentTimeMillis();
        int generated = scenarios.regenerate();
        long elapsed = System.currentTimeMillis() - start;
        logs.warn("system", "重建样例场景 " + generated + " 组，耗时 " + elapsed + " ms", null);
        return Map.of("generated", generated, "elapsedMs", elapsed);
    }

    private Map<String, Object> model(String name, String branch, String backbone, double weight) {
        Map<String, Object> model = new LinkedHashMap<>();
        model.put("name", name);
        model.put("branch", branch);
        model.put("backbone", backbone);
        model.put("weight", weight);
        model.put("simulated", true);
        return model;
    }
}
