# A18 · 无人机视角多模态小目标检测演示平台

面向交付演示的可运行系统：后端为 Spring Boot 3.2 + **Java 内置确定性模拟推理引擎**（不需要 Python、不需要 `.pt` 权重），前端为 React 18 + TypeScript + Tailwind 的深色指挥中心控制台，提供检测工作台、任务中心、系统日志三条主线。

本仓库是交付包 `04_演示系统代码包/TrafficObjectDetection` 的独立开发副本，原 `01_`～`04_` 目录保持只读。

## 模拟模式声明

| 项 | 真实情况 |
| --- | --- |
| 权重 | 未使用。原权重在百度网盘，未随包提供（`legacy/models/说明.md`） |
| 推理 | `engine/MockInferenceEngine` 由场景真值派生检测框（召回、类别混淆、定位抖动、误检） |
| 融合 | **真实算法**：`engine/WbfFuser` 按 IoU 0.58 聚簇后加权融合，可手算复核 |
| 参数 | 分支权重与阈值取自真实实验快照 `config/reference/wbf_best_current.json`（mAP50 0.836） |
| 场景 | `engine/ScenarioGenerator` 用 `java.awt` 程序化生成，RGB 与红外同源配准，真值随图输出 |

因此界面上的 mAP/AP 数字属于**原模型的历史结果**，不是本系统实测；所有页面均标注 `模拟模式 MOCK`。

替换真实模型只需改一处：把 `MockInferenceEngine` 换成调用 Python 推理服务的 HTTP 客户端，输出同样的 `detections[{cls, conf, box}]` 结构，`WbfFuser`、`MetricsEvaluator` 与前端都不用动。

## 快速开始

前置：JDK 17（本机已装 17.0.12）。Maven 与前端依赖由脚本自动准备。

```powershell
# 1) 启动后端（首次会自动下载 Maven 3.9.9 到 .tools\ 并配置阿里云镜像）
.\start-backend.cmd
# 或：powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1

# 2) 启动前端（首次会自动 npm install）
.\start-frontend.cmd
```

- 后端：<http://localhost:8080>，接口前缀 `/api`
- 前端：<http://localhost:5173>，`/api` 由 Vite 代理到 8080
- 首次启动自动在 `data/scenarios/` 生成 10 组场景（20 张 PNG + 10 份真值 JSON）

调试用参数：

```powershell
scripts\start-backend.ps1 -Rebuild      # 重新构建后再启动
scripts\start-backend.ps1 -Background   # 后台启动，日志写 .tools\backend.log
scripts\start-frontend.ps1 -Background  # 后台启动 Vite，日志写 .tools\frontend.log
```

## 自动化走查

```powershell
scripts\e2e-install.cmd    # 首次：下载 Playwright Chromium
cd tools\e2e; node check.mjs
```

13 条点击级断言覆盖：场景检测出框、画布实际绘制像素、分支切换、上传检测、任务抽屉回放、CSV 下载、日志过滤与暂停计数。结果与截图见 `tools/e2e/.shots/`。

## 三种演示路径

| 场景 | 操作 |
| --- | --- |
| 单次检测 | 工作台选场景 → 调参数 → 开始检测 → 看六阶段进度、双画布出框、明细表与真值对比 |
| 分支对比 | 画布工具栏切换 WBF 融合 / RGB / IR / 双流，纯前端渲染，不重新推理 |
| 批量与回溯 | 任务中心勾选多个场景提交批次 → 查看队列进度 → 点行打开抽屉回放、导出 JSON/CSV |
| 过程可观测 | 系统日志页 SSE 实时流，按级别/关键字过滤，可暂停与导出 |
| 主题 | 顶栏右侧按钮切换浅色 / 深色，偏好保存在本地，刷新后保持 |

界面语言采用 PersonalGate 设计基线（白色主区、浅灰窄侧栏、蓝色强调、细边框圆角卡片），详见 [docs/02-方案与契约/03-界面设计规范.md](docs/02-方案与契约/03-界面设计规范.md)。

## 目录

```
05_演示平台开发仓库/
├── AGENTS.md / README.md      协作约定与本文
├── pom.xml                    后端构建（web + Jackson，已移除 thymeleaf/org.json）
├── start-backend.cmd          双击启动后端
├── start-frontend.cmd         双击启动前端
├── scripts/
│   ├── start-backend.ps1      Maven 引导 + 构建 + 启动
│   ├── start-frontend.ps1     依赖检查 + Vite 启动
│   ├── dev-frontend.cmd       Vite 前台运行（供后台调用）
│   ├── npm-install.cmd        依赖安装（--ignore-scripts）
│   └── smoke-test.ps1         接口冒烟
├── src/main/java/com/example/traffic/
│   ├── config/                属性绑定、CORS、线程池
│   ├── domain/                record 模型（Scenario/RunRecord/Detection…）
│   ├── engine/                场景生成、模拟推理、WBF、指标
│   ├── service/               场景、任务、批次、日志、导出、存储
│   └── web/                   6 组 Controller + 全局异常
├── frontend/                  React 控制台（详见 frontend/README.md）
├── data/                      运行时：scenarios/ uploads/ records/（不入库）
├── tools/                     文档检查器 + E2E 走查脚本
├── docs/                      正式文档（现状、方案、契约、计划、证据）
└── legacy/                    旧 Vue 前端、Python 脚本、权重说明（只读）
```

## 接口

完整契约见 [docs/02-方案与契约/02-前后端接口契约.md](docs/02-方案与契约/02-前后端接口契约.md)。常用：

```text
GET  /api/system/info
GET  /api/scenarios                     场景列表（含缩略图地址）
POST /api/runs                          创建检测任务，立即返回 runId
GET  /api/runs/{id}/stream              SSE：progress / log / result / error
GET  /api/runs?page=1&size=10           任务列表（status/keyword 过滤）
POST /api/batches                       批量创建
GET  /api/logs/stream                   日志 SSE
GET  /api/runs/{id}/export?format=csv   导出（UTF-8 BOM）
```

## 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 前端白屏、顶栏亮红 | 后端未启动，先跑 `start-backend.cmd` |
| 首次构建很慢 | 需要联网下载 Maven 与依赖；`.tools\maven`、`%USERPROFILE%\.m2` 会缓存 |
| Node 报 `0xC0000005` | 本机系统 Node 22 加载模块即崩；脚本已自动改用 `.tools\node20`，并清空注入的 `NODE_OPTIONS` |
| `esbuild` 安装失败 | `npm install` 已加 `--ignore-scripts`，平台二进制由 `@esbuild/win32-x64` 提供 |
| CSV 中文乱码 | 用 Excel 直接打开（带 BOM）；或按 UTF-8 导入 |

## 文档与验收

- 现状：[docs/00-当前系统状态.md](docs/00-当前系统状态.md)
- 方案与算法：[docs/02-方案与契约/01-演示平台重建方案.md](docs/02-方案与契约/01-演示平台重建方案.md)
- 验收清单：[docs/03-开发计划与验收/03-验收清单.md](docs/03-开发计划与验收/03-验收清单.md)
- 环境适配证据：[docs/09-历史与证据/03-运行环境适配记录.md](docs/09-历史与证据/03-运行环境适配记录.md)

文档自检：

```powershell
python tools/check_docs.py --root . --config tools/governance-config.json
```
