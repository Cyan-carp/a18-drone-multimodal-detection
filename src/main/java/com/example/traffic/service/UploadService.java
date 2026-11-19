package com.example.traffic.service;

import com.example.traffic.config.AppProperties;
import com.example.traffic.domain.ImageInfo;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

/**
 * 上传图像存储。文件名由 uploadId 决定，服务重启后仍可按 id 回读，无需额外元数据。
 */
@Service
public class UploadService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final Path uploadsDir;
    private final AtomicInteger seq = new AtomicInteger(0);
    private volatile String currentDay = LocalDate.now().format(DAY);

    public record Stored(String uploadId, ImageInfo image) {
    }

    public UploadService(AppProperties props) {
        this.uploadsDir = Paths.get(props.dataDir()).toAbsolutePath().normalize().resolve("uploads");
    }

    @PostConstruct
    public void init() throws IOException {
        Files.createDirectories(uploadsDir);
    }

    public Stored store(MultipartFile rgb, MultipartFile ir) throws IOException {
        if ((rgb == null || rgb.isEmpty()) && (ir == null || ir.isEmpty())) {
            throw new IllegalArgumentException("请至少上传一张图像");
        }
        String uploadId = nextId();
        int width = 0;
        int height = 0;
        if (rgb != null && !rgb.isEmpty()) {
            int[] size = save(uploadId, "rgb", rgb);
            width = size[0];
            height = size[1];
        }
        if (ir != null && !ir.isEmpty()) {
            int[] size = save(uploadId, "ir", ir);
            if (width == 0) {
                width = size[0];
                height = size[1];
            }
        }
        String rgbUrl = (rgb != null && !rgb.isEmpty()) ? url(uploadId, "rgb") : null;
        String irUrl = (ir != null && !ir.isEmpty()) ? url(uploadId, "ir") : null;
        return new Stored(uploadId, new ImageInfo(width, height, rgbUrl, irUrl));
    }

    public Optional<Path> file(String uploadId, String modality) {
        String prefix = uploadId + "_" + modality;
        try (Stream<Path> stream = Files.list(uploadsDir)) {
            return stream.filter(path -> path.getFileName().toString().startsWith(prefix)).findFirst();
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    public boolean exists(String uploadId) {
        return file(uploadId, "rgb").isPresent() || file(uploadId, "ir").isPresent();
    }

    public String url(String uploadId, String modality) {
        return "/api/uploads/" + uploadId + "/image?modality=" + modality;
    }

    private int[] save(String uploadId, String modality, MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();
        BufferedImage image;
        try (InputStream in = new java.io.ByteArrayInputStream(bytes)) {
            image = ImageIO.read(in);
        }
        if (image == null) {
            throw new IllegalArgumentException("无法解析图像内容，请上传 PNG 或 JPEG");
        }
        String ext = extensionOf(file.getOriginalFilename());
        Path target = uploadsDir.resolve(uploadId + "_" + modality + "." + ext);
        Files.copy(new java.io.ByteArrayInputStream(bytes), target, StandardCopyOption.REPLACE_EXISTING);
        return new int[]{image.getWidth(), image.getHeight()};
    }

    private String extensionOf(String name) {
        if (name == null) {
            return "png";
        }
        int idx = name.lastIndexOf('.');
        if (idx < 0) {
            return "png";
        }
        String ext = name.substring(idx + 1).toLowerCase(Locale.ROOT);
        return ext.equals("jpeg") ? "jpg" : ext;
    }

    private String nextId() {
        String day = LocalDate.now().format(DAY);
        synchronized (this) {
            if (!day.equals(currentDay)) {
                currentDay = day;
                seq.set(0);
            }
            return "U-" + day + "-" + String.format("%04d", seq.incrementAndGet());
        }
    }
}
