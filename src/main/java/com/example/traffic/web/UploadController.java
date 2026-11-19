package com.example.traffic.web;

import com.example.traffic.domain.ImageInfo;
import com.example.traffic.service.UploadService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    private final UploadService uploads;

    public UploadController(UploadService uploads) {
        this.uploads = uploads;
    }

    public record UploadResponse(String uploadId, String rgbUrl, String irUrl, int width, int height) {
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UploadResponse upload(@RequestParam(value = "rgb", required = false) MultipartFile rgb,
                                 @RequestParam(value = "ir", required = false) MultipartFile ir) throws IOException {
        UploadService.Stored stored = uploads.store(rgb, ir);
        ImageInfo image = stored.image();
        return new UploadResponse(stored.uploadId(), image.rgbUrl(), image.irUrl(), image.width(), image.height());
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> image(@PathVariable String id,
                                        @RequestParam(defaultValue = "rgb") String modality) throws IOException {
        Path file = uploads.file(id, modality)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "UPLOAD_NOT_FOUND", "上传图像不存在", id));
        byte[] bytes = Files.readAllBytes(file);
        String name = file.getFileName().toString().toLowerCase();
        MediaType type = name.endsWith(".jpg") || name.endsWith(".jpeg")
                ? MediaType.IMAGE_JPEG : MediaType.IMAGE_PNG;
        return ResponseEntity.ok().contentType(type).body(bytes);
    }
}
