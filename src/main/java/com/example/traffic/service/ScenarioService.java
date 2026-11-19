package com.example.traffic.service;

import com.example.traffic.config.AppProperties;
import com.example.traffic.domain.Scenario;
import com.example.traffic.domain.ScenarioSummary;
import com.example.traffic.domain.SceneMeta;
import com.example.traffic.engine.ScenarioGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * 场景目录管理：首次启动生成，之后只读。图像与真值同目录，便于整体重建。
 */
@Service
public class ScenarioService {

    private static final Logger log = LoggerFactory.getLogger(ScenarioService.class);

    private final AppProperties props;
    private final ScenarioGenerator generator;
    private final ObjectMapper mapper;
    private final Path root;
    private final Path scenariosDir;

    public ScenarioService(AppProperties props, ScenarioGenerator generator, ObjectMapper mapper) {
        this.props = props;
        this.generator = generator;
        this.mapper = mapper;
        this.root = Paths.get(props.dataDir()).toAbsolutePath().normalize();
        this.scenariosDir = root.resolve("scenarios");
    }

    @PostConstruct
    public void ensureGenerated() {
        try {
            Files.createDirectories(scenariosDir);
            List<SceneMeta> existing = readAll();
            int expected = props.mock().scenarioCount();
            if (existing.size() >= expected) {
                log.info("场景已就绪: {} 组", existing.size());
                return;
            }
            log.info("首次启动，生成 {} 组样例场景到 {}", expected, scenariosDir);
            long start = System.currentTimeMillis();
            generator.generateAll(scenariosDir, expected);
            log.info("场景生成完成，耗时 {} ms", System.currentTimeMillis() - start);
        } catch (IOException e) {
            throw new UncheckedIOException("场景生成失败: " + e.getMessage(), e);
        }
    }

    public List<ScenarioSummary> list() {
        return readAll().stream().map(meta -> decorate(meta).summary()).toList();
    }

    public Optional<Scenario> find(String id) {
        return readAll().stream().filter(meta -> meta.id().equals(id)).findFirst().map(this::decorate);
    }

    public int count() {
        return readAll().size();
    }

    public byte[] image(String id, String modality) throws IOException {
        String suffix = "ir".equalsIgnoreCase(modality) ? "_ir.png" : "_rgb.png";
        Path file = scenariosDir.resolve(id + suffix);
        if (!Files.exists(file)) {
            throw new IOException("场景图像不存在: " + file.getFileName());
        }
        return Files.readAllBytes(file);
    }

    public synchronized int regenerate() throws IOException {
        try (Stream<Path> stream = Files.list(scenariosDir)) {
            for (Path path : stream.toList()) {
                Files.deleteIfExists(path);
            }
        }
        List<SceneMeta> metas = generator.generateAll(scenariosDir, props.mock().scenarioCount());
        return metas.size();
    }

    private Scenario decorate(SceneMeta meta) {
        return Scenario.of(meta, "/api/scenarios/" + meta.id() + "/image?modality=rgb",
                "/api/scenarios/" + meta.id() + "/image?modality=ir");
    }

    private List<SceneMeta> readAll() {
        if (!Files.isDirectory(scenariosDir)) {
            return List.of();
        }
        List<SceneMeta> metas = new ArrayList<>();
        try (Stream<Path> stream = Files.list(scenariosDir)) {
            List<Path> files = stream
                    .filter(path -> path.getFileName().toString().endsWith(".json"))
                    .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                    .toList();
            for (Path file : files) {
                metas.add(mapper.readValue(file.toFile(), SceneMeta.class));
            }
        } catch (IOException e) {
            throw new UncheckedIOException("读取场景目录失败: " + e.getMessage(), e);
        }
        return metas;
    }
}
