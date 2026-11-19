package com.example.traffic.web;

import com.example.traffic.domain.BatchJob;
import com.example.traffic.domain.DetectParams;
import com.example.traffic.domain.PageResult;
import com.example.traffic.service.BatchService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/batches")
public class BatchController {

    private final BatchService batches;

    public BatchController(BatchService batches) {
        this.batches = batches;
    }

    public record CreateBatchRequest(List<String> scenarioIds, DetectParams params) {
    }

    @PostMapping
    public BatchJob create(@RequestBody CreateBatchRequest request) {
        if (request == null) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST,
                    "PARAM_INVALID", "请求体不可为空", null);
        }
        return batches.create(request.scenarioIds(), request.params());
    }

    @GetMapping
    public PageResult<BatchJob> list(@RequestParam(defaultValue = "1") int page,
                                     @RequestParam(defaultValue = "10") int size) {
        return batches.list(page, size);
    }

    @GetMapping("/{id}")
    public BatchJob detail(@PathVariable String id) {
        return batches.get(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        batches.delete(id);
        return ResponseEntity.noContent().build();
    }
}
