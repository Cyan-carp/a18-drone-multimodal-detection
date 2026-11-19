package com.example.traffic.web;

import com.example.traffic.domain.DetectParams;
import com.example.traffic.domain.PageResult;
import com.example.traffic.domain.RunRecord;
import com.example.traffic.domain.RunSummary;
import com.example.traffic.service.ExportService;
import com.example.traffic.service.RunService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/runs")
public class RunController {

    private final RunService runs;
    private final ExportService exports;

    public RunController(RunService runs, ExportService exports) {
        this.runs = runs;
        this.exports = exports;
    }

    public record CreateRunRequest(String sourceType, String sourceId, DetectParams params) {
    }

    public record BatchDeleteRequest(List<String> ids) {
    }

    @PostMapping
    public RunRecord create(@RequestBody CreateRunRequest request) {
        if (request == null || request.sourceId() == null || request.sourceId().isBlank()) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST,
                    "PARAM_INVALID", "sourceId 不可为空", null);
        }
        RunRecord record = runs.create(request.sourceType(), request.sourceId(), request.params(), null);
        runs.submit(record.runId());
        return record;
    }

    @GetMapping("/{id}")
    public RunRecord detail(@PathVariable String id) {
        return runs.get(id);
    }

    @GetMapping(value = "/{id}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable String id) {
        return runs.stream(id);
    }

    @GetMapping
    public PageResult<RunSummary> list(@RequestParam(defaultValue = "1") int page,
                                       @RequestParam(defaultValue = "10") int size,
                                       @RequestParam(required = false) String status,
                                       @RequestParam(required = false) String keyword,
                                       @RequestParam(required = false) String sourceType) {
        return runs.list(page, size, status, keyword, sourceType);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        runs.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/batch-delete")
    public ResponseEntity<java.util.Map<String, Object>> batchDelete(@RequestBody BatchDeleteRequest request) {
        int deleted = runs.deleteAll(request == null || request.ids() == null ? List.of() : request.ids());
        return ResponseEntity.ok(java.util.Map.of("deleted", deleted));
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> exportOne(@PathVariable String id,
                                            @RequestParam(defaultValue = "json") String format) {
        RunRecord record = runs.get(id);
        ExportService.Artifact artifact = "csv".equalsIgnoreCase(format)
                ? exports.runCsv(record) : exports.runJson(record);
        return download(artifact);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportAll(@RequestParam(defaultValue = "csv") String format,
                                            @RequestParam(required = false) String status,
                                            @RequestParam(required = false) String keyword,
                                            @RequestParam(required = false) String sourceType) {
        List<RunRecord> records = runs.filtered(status, keyword, sourceType);
        ExportService.Artifact artifact = "json".equalsIgnoreCase(format)
                ? exports.listJson(records) : exports.listCsv(records);
        return download(artifact);
    }

    private ResponseEntity<byte[]> download(ExportService.Artifact artifact) {
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(artifact.filename(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentType(MediaType.parseMediaType(artifact.contentType()))
                .body(artifact.content());
    }
}
