package com.example.traffic.service;

import com.example.traffic.config.AppProperties;
import com.example.traffic.domain.BatchJob;
import com.example.traffic.domain.RunRecord;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * 文件持久化：先写临时文件再原子替换，避免进程中断留下半截 JSON。
 */
@Service
public class RunStore {

    private static final Logger log = LoggerFactory.getLogger(RunStore.class);

    private final ObjectMapper mapper;
    private final Path dir;
    private final Path runsFile;
    private final Path batchesFile;
    private final int historyLimit;
    private final Object writeLock = new Object();

    public RunStore(AppProperties props, ObjectMapper mapper) {
        this.mapper = mapper;
        this.dir = Paths.get(props.dataDir()).toAbsolutePath().normalize().resolve("records");
        this.runsFile = dir.resolve("runs.json");
        this.batchesFile = dir.resolve("batches.json");
        this.historyLimit = props.historyLimit();
    }

    @PostConstruct
    public void init() throws IOException {
        Files.createDirectories(dir);
        log.info("任务存储目录 {}", dir);
    }

    public int historyLimit() {
        return historyLimit;
    }

    public List<RunRecord> loadRuns() {
        return read(runsFile, new TypeReference<List<RunRecord>>() {
        });
    }

    public List<BatchJob> loadBatches() {
        return read(batchesFile, new TypeReference<List<BatchJob>>() {
        });
    }

    public void saveRuns(Collection<RunRecord> runs) {
        List<RunRecord> list = new ArrayList<>(runs);
        if (list.size() > historyLimit) {
            list = new ArrayList<>(list.subList(0, historyLimit));
        }
        write(runsFile, list);
    }

    public void saveBatches(Collection<BatchJob> batches) {
        write(batchesFile, new ArrayList<>(batches));
    }

    private <T> List<T> read(Path file, TypeReference<List<T>> type) {
        if (!Files.exists(file)) {
            return List.of();
        }
        try {
            return mapper.readValue(file.toFile(), type);
        } catch (IOException e) {
            log.warn("读取 {} 失败，按空历史处理: {}", file.getFileName(), e.getMessage());
            return List.of();
        }
    }

    private void write(Path file, Object payload) {
        synchronized (writeLock) {
            try {
                Path tmp = dir.resolve(file.getFileName() + ".tmp");
                mapper.writerWithDefaultPrettyPrinter().writeValue(tmp.toFile(), payload);
                try {
                    Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
                } catch (IOException atomicUnsupported) {
                    Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
                }
            } catch (IOException e) {
                log.warn("写入 {} 失败: {}", file.getFileName(), e.getMessage());
            }
        }
    }
}
