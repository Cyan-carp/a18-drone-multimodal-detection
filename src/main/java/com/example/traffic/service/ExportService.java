package com.example.traffic.service;

import com.example.traffic.domain.FusedDetection;
import com.example.traffic.domain.RunRecord;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 导出服务。CSV 带 UTF-8 BOM 与 CRLF，保证 Excel 直接双击不乱码。
 */
@Service
public class ExportService {

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final String CSV_HEADER = "任务ID,场景,来源类型,类别,置信度,来源分支,x1,y1,x2,y2\r\n";

    private final ObjectMapper mapper;

    public ExportService(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public record Artifact(String filename, byte[] content, String contentType) {
    }

    public Artifact runJson(RunRecord record) {
        return new Artifact("run_" + record.runId() + ".json", toJson(record), "application/json");
    }

    public Artifact listJson(List<RunRecord> records) {
        return new Artifact("runs_" + LocalDateTime.now().format(STAMP) + ".json",
                toJson(records), "application/json");
    }

    public Artifact runCsv(RunRecord record) {
        return new Artifact("run_" + record.runId() + ".csv",
                toCsv(List.of(record)), "text/csv;charset=UTF-8");
    }

    public Artifact listCsv(List<RunRecord> records) {
        return new Artifact("runs_" + LocalDateTime.now().format(STAMP) + ".csv",
                toCsv(records), "text/csv;charset=UTF-8");
    }

    private byte[] toJson(Object payload) {
        try {
            return mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("导出 JSON 失败: " + e.getMessage(), e);
        }
    }

    private byte[] toCsv(List<RunRecord> records) {
        StringBuilder sb = new StringBuilder();
        sb.append('\uFEFF').append(CSV_HEADER);
        for (RunRecord record : records) {
            if (record.fused() == null || record.fused().isEmpty()) {
                sb.append(row(record, null));
                continue;
            }
            for (FusedDetection detection : record.fused()) {
                sb.append(row(record, detection));
            }
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private String row(RunRecord record, FusedDetection detection) {
        String scene = escape(record.source() == null ? "" : record.source().name());
        if (detection == null) {
            return String.join(",", record.runId(), scene, record.source().type(),
                    "", "", "", "", "", "", "") + "\r\n";
        }
        int[] box = detection.box();
        return String.join(",",
                record.runId(),
                scene,
                record.source().type(),
                detection.cls(),
                String.format("%.4f", detection.conf()),
                String.join("|", detection.sources()),
                String.valueOf(box[0]), String.valueOf(box[1]),
                String.valueOf(box[2]), String.valueOf(box[3])) + "\r\n";
    }

    private String escape(String value) {
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
