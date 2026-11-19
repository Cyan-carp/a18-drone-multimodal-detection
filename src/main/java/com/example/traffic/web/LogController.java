package com.example.traffic.web;

import com.example.traffic.domain.LogEntry;
import com.example.traffic.service.LogService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/logs")
public class LogController {

    private final LogService logs;

    public LogController(LogService logs) {
        this.logs = logs;
    }

    @GetMapping
    public List<LogEntry> recent(@RequestParam(defaultValue = "200") int limit,
                                 @RequestParam(required = false) String level,
                                 @RequestParam(required = false) String keyword) {
        return logs.recent(limit, level, keyword);
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return logs.subscribe();
    }
}
