package com.example.traffic.web;

import com.example.traffic.domain.Scenario;
import com.example.traffic.domain.ScenarioSummary;
import com.example.traffic.service.ScenarioService;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/scenarios")
public class ScenarioController {

    private final ScenarioService scenarios;

    public ScenarioController(ScenarioService scenarios) {
        this.scenarios = scenarios;
    }

    @GetMapping
    public List<ScenarioSummary> list() {
        return scenarios.list();
    }

    @GetMapping("/{id}")
    public Scenario detail(@PathVariable String id) {
        return scenarios.find(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SCENARIO_NOT_FOUND", "场景不存在", id));
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> image(@PathVariable String id,
                                        @RequestParam(defaultValue = "rgb") String modality) throws IOException {
        byte[] bytes = scenarios.image(id, modality);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
                .body(bytes);
    }
}
