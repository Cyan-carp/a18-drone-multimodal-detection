package com.example.traffic.service;

import com.example.traffic.domain.LogEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 运行日志：环形缓冲 + SSE 广播。日志只保留最近 500 条，避免长时间运行吃内存。
 */
@Service
public class LogService {

    private static final Logger log = LoggerFactory.getLogger(LogService.class);
    private static final int CAPACITY = 500;
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private final Deque<LogEntry> buffer = new ConcurrentLinkedDeque<>();
    private final AtomicLong seq = new AtomicLong();
    private final Map<Long, SseEmitter> clients = new ConcurrentHashMap<>();
    private final AtomicLong clientSeq = new AtomicLong();

    public LogEntry debug(String scope, String message, String runId) {
        return publish("DEBUG", scope, message, runId);
    }

    public LogEntry info(String scope, String message, String runId) {
        return publish("INFO", scope, message, runId);
    }

    public LogEntry warn(String scope, String message, String runId) {
        return publish("WARN", scope, message, runId);
    }

    public LogEntry error(String scope, String message, String runId) {
        return publish("ERROR", scope, message, runId);
    }

    public LogEntry publish(String level, String scope, String message, String runId) {
        LogEntry entry = new LogEntry(seq.incrementAndGet(), LocalDateTime.now().format(TS),
                level, scope, message, runId);
        buffer.addLast(entry);
        while (buffer.size() > CAPACITY) {
            buffer.pollFirst();
        }
        broadcast(entry);
        log.debug("[{}] {} {}", level, scope, message);
        return entry;
    }

    public List<LogEntry> recent(int limit, String level, String keyword) {
        int size = Math.max(1, Math.min(limit, CAPACITY));
        String levelFilter = level == null || level.isBlank() ? null : level.toUpperCase(Locale.ROOT);
        String keywordFilter = keyword == null || keyword.isBlank() ? null : keyword.trim();
        List<LogEntry> snapshot = new ArrayList<>(buffer);
        List<LogEntry> result = new ArrayList<>();
        for (int i = snapshot.size() - 1; i >= 0 && result.size() < size; i--) {
            LogEntry entry = snapshot.get(i);
            if (levelFilter != null && !entry.level().equals(levelFilter)) {
                continue;
            }
            if (keywordFilter != null && !entry.message().contains(keywordFilter)) {
                continue;
            }
            result.add(0, entry);
        }
        return result;
    }

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L);
        long id = clientSeq.incrementAndGet();
        clients.put(id, emitter);
        emitter.onCompletion(() -> clients.remove(id));
        emitter.onTimeout(() -> clients.remove(id));
        emitter.onError(error -> clients.remove(id));
        try {
            emitter.send(SseEmitter.event().comment("connected"));
        } catch (Exception e) {
            clients.remove(id);
        }
        return emitter;
    }

    private void broadcast(LogEntry entry) {
        if (clients.isEmpty()) {
            return;
        }
        clients.forEach((id, emitter) -> {
            try {
                emitter.send(SseEmitter.event().name("log").data(entry));
            } catch (Exception e) {
                clients.remove(id);
            }
        });
    }
}
