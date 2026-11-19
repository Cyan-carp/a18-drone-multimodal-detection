package com.example.traffic.engine;

import com.example.traffic.domain.SceneMeta;
import com.example.traffic.domain.SceneObject;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.awt.image.DataBufferInt;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * 程序化生成俯视无人机场景：RGB 与红外严格同几何，真值与图像同步产出。
 * 场景编号决定随机种子，因此同一编号每次生成结果一致。
 */
@Component
public class ScenarioGenerator {

    private static final Logger log = LoggerFactory.getLogger(ScenarioGenerator.class);
    private static final int SIZE = 1024;
    private static final String[] CLASSES = {"car", "truck", "bus", "van", "freight_car"};
    private static final double[] CLASS_P = {0.55, 0.16, 0.08, 0.14, 0.07};

    private final ObjectMapper mapper;

    public ScenarioGenerator(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    private record Preset(String name, String weather, String terrain, String density,
                          String description, double angleDeg, boolean junction) {
    }

    private static final List<Preset> PRESETS = List.of(
            new Preset("城郊公路 · 晴天", "晴天", "城郊", "稀疏", "双车道城郊公路，车辆稀疏，适合演示基础检测", 4, false),
            new Preset("城郊路口 · 阴天", "阴天", "城郊", "中", "丁字路口，多方向车流，小目标相互遮挡", -12, true),
            new Preset("露天停车场 · 晴天", "晴天", "城区", "密集", "密集停放车辆，演示小目标聚集场景", 0, false),
            new Preset("田埂土路 · 阴天", "阴天", "乡村", "稀疏", "非铺装路面，背景纹理杂乱，考验误检抑制", 18, false),
            new Preset("夜间巡逻 · 夜间", "夜间", "城郊", "中", "低照度路段，可见光退化，红外分支占优", -6, false),
            new Preset("国道汇流 · 晴天", "晴天", "国道", "密集", "多车道汇流，大型车辆比例高", 2, true),
            new Preset("工业厂区 · 阴天", "阴天", "工业区", "中", "厂房与货车混停，目标尺度差异大", 8, false),
            new Preset("夜间检查站 · 夜间", "夜间", "国道", "稀疏", "夜间设卡，车辆低速排队通过", 0, true),
            new Preset("高速匝道 · 晴天", "晴天", "高速", "中", "弯曲匝道，车辆朝向多变", 24, false),
            new Preset("乡村道口 · 阴天", "阴天", "乡村", "密集", "田埂与村道交汇，目标小而密集", -20, true)
    );

    private record Vehicle(int id, String cls, double cx, double cy, double length, double width, double angle) {
    }

    private record Building(double x, double y, double w, double h) {
    }

    private record Tree(double x, double y, double r) {
    }

    private record Layout(List<Vehicle> vehicles, List<Building> buildings, List<Tree> trees) {
    }

    /** 生成 count 个场景，返回元信息列表。已存在同名文件时覆盖重写。 */
    public List<SceneMeta> generateAll(Path dir, int count) throws IOException {
        Files.createDirectories(dir);
        List<SceneMeta> metas = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            metas.add(generate(dir, i));
        }
        return metas;
    }

    public SceneMeta generate(Path dir, int index) throws IOException {
        Preset preset = PRESETS.get((index - 1) % PRESETS.size());
        String id = String.format("SC-%03d", index);
        Random rnd = new Random(1000L + index * 7919L);

        Layout layout = plan(preset, rnd);
        List<SceneObject> objects = new ArrayList<>();
        for (Vehicle v : layout.vehicles()) {
            objects.add(new SceneObject(v.id(), v.cls(), bounds(v)));
        }

        BufferedImage rgb = render(preset, layout, false);
        BufferedImage ir = render(preset, layout, true);

        ImageIO.write(rgb, "png", dir.resolve(id + "_rgb.png").toFile());
        ImageIO.write(ir, "png", dir.resolve(id + "_ir.png").toFile());

        SceneMeta meta = new SceneMeta(id, preset.name(), preset.weather(), preset.terrain(),
                preset.density(), preset.description(), SIZE, SIZE, objects);
        mapper.writerWithDefaultPrettyPrinter().writeValue(dir.resolve(id + ".json").toFile(), meta);
        log.info("生成场景 {} {} 目标数 {}", id, preset.name(), objects.size());
        return meta;
    }

    // ---------------------------------------------------------------- 布局

    private Layout plan(Preset preset, Random rnd) {
        int count;
        switch (preset.density()) {
            case "稀疏" -> count = 6 + rnd.nextInt(4);
            case "密集" -> count = 18 + rnd.nextInt(8);
            default -> count = 10 + rnd.nextInt(7);
        }
        double angle = Math.toRadians(preset.angleDeg());
        List<Vehicle> vehicles = new ArrayList<>();
        double[] laneOffsets = {-92, -34, 34, 92};
        int id = 1;
        int guard = 0;
        while (vehicles.size() < count && guard++ < 400) {
            String cls = pickClass(rnd);
            int lane = rnd.nextInt(laneOffsets.length);
            double along = -700 + rnd.nextInt(30) * 48 + rnd.nextDouble() * 20;
            double offset = laneOffsets[lane] + (rnd.nextDouble() - 0.5) * 10;
            double[] pt = rotate(along, offset, angle);
            double cx = SIZE / 2.0 + pt[0];
            double cy = SIZE / 2.0 + pt[1];
            double[] dims = dimensions(cls);
            double scale = 0.85 + rnd.nextDouble() * 0.35;
            double length = dims[0] * scale;
            double width = dims[1] * scale;
            double vehicleAngle = angle + (rnd.nextDouble() - 0.5) * 0.12;
            if (lane < 2) {
                vehicleAngle += Math.PI;
            }
            if (cx < 60 || cy < 60 || cx > SIZE - 60 || cy > SIZE - 60) {
                continue;
            }
            if (overlaps(vehicles, cx, cy, length, width)) {
                continue;
            }
            vehicles.add(new Vehicle(id++, cls, cx, cy, length, width, vehicleAngle));
        }

        List<Building> buildings = new ArrayList<>();
        int buildingCount = 5 + rnd.nextInt(6);
        for (int i = 0; i < buildingCount; i++) {
            double w = 90 + rnd.nextDouble() * 150;
            double h = 70 + rnd.nextDouble() * 130;
            double x = 40 + rnd.nextDouble() * (SIZE - 80 - w);
            double y = rnd.nextBoolean() ? 40 + rnd.nextDouble() * 150 : SIZE - 190 - rnd.nextDouble() * 100;
            buildings.add(new Building(x, y, w, h));
        }

        List<Tree> trees = new ArrayList<>();
        int treeCount = 40 + rnd.nextInt(50);
        for (int i = 0; i < treeCount; i++) {
            double x = 20 + rnd.nextDouble() * (SIZE - 40);
            double y = 20 + rnd.nextDouble() * (SIZE - 40);
            if (onRoad(x, y, angle, preset.junction())) {
                continue;
            }
            trees.add(new Tree(x, y, 7 + rnd.nextDouble() * 9));
        }
        return new Layout(vehicles, buildings, trees);
    }

    private boolean overlaps(List<Vehicle> placed, double cx, double cy, double length, double width) {
        double r = Math.max(length, width) * 0.62;
        for (Vehicle v : placed) {
            double dx = v.cx() - cx;
            double dy = v.cy() - cy;
            if (Math.hypot(dx, dy) < r + Math.max(v.length(), v.width()) * 0.62) {
                return true;
            }
        }
        return false;
    }

    private boolean onRoad(double x, double y, double angle, boolean junction) {
        double[] local = rotate(x - SIZE / 2.0, y - SIZE / 2.0, -angle);
        if (Math.abs(local[1]) < 150) {
            return true;
        }
        if (junction && Math.abs(local[0]) < 150) {
            return true;
        }
        return false;
    }

    private String pickClass(Random rnd) {
        double r = rnd.nextDouble();
        double acc = 0;
        for (int i = 0; i < CLASSES.length; i++) {
            acc += CLASS_P[i];
            if (r <= acc) {
                return CLASSES[i];
            }
        }
        return CLASSES[0];
    }

    private double[] dimensions(String cls) {
        return switch (cls) {
            case "truck" -> new double[]{64, 27};
            case "bus" -> new double[]{72, 29};
            case "van" -> new double[]{46, 23};
            case "freight_car" -> new double[]{68, 27};
            default -> new double[]{42, 21};
        };
    }

    private int[] bounds(Vehicle v) {
        double halfL = v.length() / 2.0;
        double halfW = v.width() / 2.0;
        double[][] corners = {
                {-halfL, -halfW}, {halfL, -halfW}, {halfL, halfW}, {-halfL, halfW}
        };
        double minX = Double.MAX_VALUE, minY = Double.MAX_VALUE;
        double maxX = -Double.MAX_VALUE, maxY = -Double.MAX_VALUE;
        double cos = Math.cos(v.angle());
        double sin = Math.sin(v.angle());
        for (double[] c : corners) {
            double px = v.cx() + c[0] * cos - c[1] * sin;
            double py = v.cy() + c[0] * sin + c[1] * cos;
            minX = Math.min(minX, px);
            minY = Math.min(minY, py);
            maxX = Math.max(maxX, px);
            maxY = Math.max(maxY, py);
        }
        return new int[]{
                clamp((int) Math.round(minX)), clamp((int) Math.round(minY)),
                clamp((int) Math.round(maxX)), clamp((int) Math.round(maxY))
        };
    }

    private int clamp(int value) {
        return Math.max(0, Math.min(SIZE - 1, value));
    }

    private double[] rotate(double x, double y, double angle) {
        double cos = Math.cos(angle);
        double sin = Math.sin(angle);
        return new double[]{x * cos - y * sin, x * sin + y * cos};
    }

    // ---------------------------------------------------------------- 渲染

    private BufferedImage render(Preset preset, Layout layout, boolean thermal) {
        boolean night = "夜间".equals(preset.weather());
        BufferedImage img = new BufferedImage(SIZE, SIZE, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        paintBase(img, preset, thermal);
        drawRoad(g, preset, thermal);
        drawBuildings(g, layout, thermal);
        drawTrees(g, layout, thermal);
        for (Vehicle v : layout.vehicles()) {
            drawVehicle(g, v, thermal);
        }
        g.dispose();

        if (night) {
            shade(img, thermal ? 0.82 : 0.52);
        } else if ("阴天".equals(preset.weather())) {
            shade(img, thermal ? 0.95 : 0.84);
        }
        if (thermal) {
            img = shift(img, 1, -1);
        }
        return img;
    }

    private void paintBase(BufferedImage img, Preset preset, boolean thermal) {
        int[] px = ((DataBufferInt) img.getRaster().getDataBuffer()).getData();
        Random noise = new Random(preset.name().hashCode() * 31L + (thermal ? 7 : 3));
        int baseR, baseG, baseB;
        switch (preset.terrain()) {
            case "城区" -> {
                baseR = 118;
                baseG = 118;
                baseB = 112;
            }
            case "乡村" -> {
                baseR = 92;
                baseG = 112;
                baseB = 74;
            }
            case "工业区" -> {
                baseR = 104;
                baseG = 102;
                baseB = 96;
            }
            default -> {
                baseR = 96;
                baseG = 112;
                baseB = 78;
            }
        }
        for (int i = 0; i < px.length; i++) {
            int n = noise.nextInt(26) - 13;
            if (thermal) {
                int v = 34 + n / 2;
                px[i] = (clamp255(v) << 16) | (clamp255(v + 2) << 8) | clamp255(v + 5);
            } else {
                px[i] = (clamp255(baseR + n) << 16) | (clamp255(baseG + n) << 8) | clamp255(baseB + n);
            }
        }
    }

    private void drawRoad(Graphics2D g, Preset preset, boolean thermal) {
        AffineTransform old = g.getTransform();
        g.rotate(Math.toRadians(preset.angleDeg()), SIZE / 2.0, SIZE / 2.0);
        g.setColor(thermal ? new Color(66, 68, 72) : new Color(58, 60, 64));
        g.fillRect(-420, SIZE / 2 - 150, SIZE + 840, 300);
        g.setColor(thermal ? new Color(120, 122, 126) : new Color(206, 208, 200));
        g.setStroke(new BasicStroke(3f));
        g.drawLine(-420, SIZE / 2 - 146, SIZE + 420, SIZE / 2 - 146);
        g.drawLine(-420, SIZE / 2 + 146, SIZE + 420, SIZE / 2 + 146);
        g.setColor(thermal ? new Color(150, 150, 152) : new Color(228, 226, 208));
        for (int x = -420; x < SIZE + 420; x += 90) {
            g.fillRect(x, SIZE / 2 - 2, 46, 5);
        }
        g.setTransform(old);
        if (preset.junction()) {
            AffineTransform old2 = g.getTransform();
            g.rotate(Math.toRadians(preset.angleDeg() + 90), SIZE / 2.0, SIZE / 2.0);
            g.setColor(thermal ? new Color(64, 66, 70) : new Color(56, 58, 62));
            g.fillRect(SIZE / 2 - 120, -200, 240, 900);
            g.setTransform(old2);
        }
    }

    private void drawBuildings(Graphics2D g, Layout layout, boolean thermal) {
        for (Building b : layout.buildings()) {
            int x = (int) b.x(), y = (int) b.y(), w = (int) b.w(), h = (int) b.h();
            g.setColor(thermal ? new Color(24, 26, 30) : new Color(150, 148, 142));
            g.fillRect(x, y, w, h);
            g.setColor(thermal ? new Color(16, 18, 22) : new Color(126, 124, 118));
            g.setStroke(new BasicStroke(3f));
            g.drawRect(x, y, w, h);
            int vents = 2 + (w + h) % 3;
            for (int i = 0; i < vents; i++) {
                int vx = x + 12 + (i * 37) % Math.max(1, w - 30);
                int vy = y + 14 + (i * 29) % Math.max(1, h - 28);
                g.fillRect(vx, vy, 18, 12);
            }
        }
    }

    private void drawTrees(Graphics2D g, Layout layout, boolean thermal) {
        for (Tree t : layout.trees()) {
            int r = (int) t.r();
            int x = (int) t.x() - r;
            int y = (int) t.y() - r;
            g.setColor(thermal ? new Color(44, 48, 46) : new Color(46, 84, 48));
            g.fillOval(x, y, r * 2, r * 2);
            g.setColor(thermal ? new Color(56, 60, 58) : new Color(64, 108, 62));
            g.fillOval(x + r / 3, y + r / 4, r, r);
        }
    }

    private void drawVehicle(Graphics2D g, Vehicle v, boolean thermal) {
        AffineTransform old = g.getTransform();
        g.translate(v.cx(), v.cy());
        g.rotate(v.angle());
        int len = (int) v.length();
        int wid = (int) v.width();

        g.setColor(new Color(0, 0, 0, 70));
        g.fillRoundRect(-len / 2 + 3, -wid / 2 + 3, len, wid, 5, 5);

        if (thermal) {
            for (int i = 3; i >= 1; i--) {
                int grow = i * 3;
                g.setColor(new Color(255, 244, 214, 26 + i * 14));
                g.fillRoundRect(-len / 2 - grow, -wid / 2 - grow, len + grow * 2, wid + grow * 2, 8, 8);
            }
            g.setColor(new Color(252, 250, 240));
            g.fillRoundRect(-len / 2, -wid / 2, len, wid, 5, 5);
        } else {
            g.setColor(bodyColor(v.cls()));
            g.fillRoundRect(-len / 2, -wid / 2, len, wid, 5, 5);
            g.setColor(new Color(255, 255, 255, 46));
            g.fillRoundRect(-len / 2 + 2, -wid / 2 + 2, len - 4, wid / 3, 4, 4);
            g.setColor(new Color(20, 24, 30, 150));
            g.fillRect(-len / 2 + 4, -wid / 2 + 3, 5, wid - 6);
        }
        g.setTransform(old);
    }

    private Color bodyColor(String cls) {
        return switch (cls) {
            case "truck" -> new Color(72, 104, 138);
            case "bus" -> new Color(190, 156, 52);
            case "van" -> new Color(140, 158, 164);
            case "freight_car" -> new Color(120, 104, 82);
            default -> new Color(176, 186, 198);
        };
    }

    private void shade(BufferedImage img, double factor) {
        int[] px = ((DataBufferInt) img.getRaster().getDataBuffer()).getData();
        for (int i = 0; i < px.length; i++) {
            int c = px[i];
            int r = (int) (((c >> 16) & 0xFF) * factor);
            int gch = (int) (((c >> 8) & 0xFF) * factor);
            int b = (int) ((c & 0xFF) * factor);
            px[i] = (clamp255(r) << 16) | (clamp255(gch) << 8) | clamp255(b);
        }
    }

    private BufferedImage shift(BufferedImage src, int dx, int dy) {
        BufferedImage out = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.drawImage(src, dx, dy, null);
        g.dispose();
        return out;
    }

    private int clamp255(int v) {
        return Math.max(0, Math.min(255, v));
    }
}
