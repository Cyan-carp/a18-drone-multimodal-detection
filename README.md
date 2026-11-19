<div align="center">

# A18 · 无人机视角多模态小目标检测演示平台

> **本地入口**：先看 [当前系统状态](docs/00-当前系统状态.md) 与 [界面设计规范](docs/02-方案与契约/03-界面设计规范.md)；启动只跑 `start-backend.cmd` 与 `start-frontend.cmd`，不要照搬交付包里的旧 Python 路径。

用 Java 内置模拟引擎跑通可见光 + 红外双模态检测全链路，不需要 PyTorch、不需要 `.pt` 权重
A multimodal small-object detection demo for drone views, running on a deterministic Java mock engine.

<p><i>场景由程序生成 · 推理可复现 · 结果不等于模型真实性能</i></p>

[English](#english) | 中文说明

![Platform](https://img.shields.io/badge/platform-Windows-495057?style=flat-square)
![Stack](https://img.shields.io/badge/stack-Spring%20Boot%203.2%20%C2%B7%20React%2018%20%C2%B7%20Java%2017-1c7ed6?style=flat-square)
![Mode](https://img.shields.io/badge/engine-MOCK%20%C2%B7%20no%20weights-e8590c?style=flat-square)
![Classes](https://img.shields.io/badge/classes-car%20%C2%B7%20truck%20%C2%B7%20bus%20%C2%B7%20van%20%C2%B7%20freight-2f9e44?style=flat-square)

</div>

## 系统概述

一个从零重建的无人机视角检测演示系统。原交付包里的 Java 服务调用外部 Python 脚本、指向不存在的 `data/` 目录、硬编码他人机器路径，还缺 `.pt` 权重，换机即失败；这里的做法是把"模型那一层"换成**可审阅的模拟引擎**，其余链路保持真实结构。

链路是完整的：**生成场景 → 三支路推理 → WBF 融合 → 与真值比对 → 落盘与导出**，前端通过 REST 与 SSE 实时看到每一步。检测框来自真值派生（召回、类别混淆、定位抖动、误检），融合与评估是**真算法**，可用两个框手算复核。

它不是"假页面"：接口、并发、持久化、SSE 心跳、断流降级、CSV BOM、空态与失败态都按可用标准实现；只有模型权重与数据集是虚接的。

> **当前状态**：能力、环境限制与验收结论统一见 [docs/00-当前系统状态.md](docs/00-当前系统状态.md)，本 README 不复述。

> **数据说明**：仓库内 10 组场景均由 `java.awt` 程序生成，目标位置是脚本写入的，不是真实航拍标注。界面中的 mAP / 类别 AP 来自项目历史实验快照（`config/reference/wbf_best_current.json`），**不是**本系统实测，任何场景都不构成真实模型性能结论。

## 主要功能

| 能力 | 说明 |
| --- | --- |
| 双模态工作台 | 选内置场景或上传 RGB / IR（拖拽、点击、Ctrl+V），双画布同坐标叠加检测框 |
| 分支对照 | 一条记录内含 RGB、IR、双流三支路结果，切换 WBF 融合 / 单分支只重渲染、不重推理 |
| 真值比对 | 内置场景自带标注，可叠加真值框，并给出 IoU 0.5 下的 TP / FP / FN 与精确率、召回率 |
| 参数控制 | 置信度阈值、融合 IoU、输入尺寸、三支路开关与 WBF 权重，默认值与真实实验配置对齐 |
| 阶段进度 | SSE 推送六阶段（载入 / RGB / IR / 双流 / 融合 / 后处理），失败与超时都有终态 |
| 批量任务 | 多选场景串行执行，批次进度可查；单任务可回放、可删除（运行中拒删） |
| 报告导出 | 单任务或全量导出 JSON / CSV；CSV 带 UTF-8 BOM，Excel 直接打开不乱码 |
| 实时日志 | 推理与接口日志按级别推送，支持过滤、暂停续读、导出文本 |
| 深浅主题 | 浅色默认 + 深色，顶栏切换，偏好本地保存，首屏不闪 |
| 开箱即用 | 首次启动自动生成 10 组 1024×1024 场景与真值，无需下载数据 |

## 技术架构

```
java.awt 场景生成器 ──► PNG(RGB/IR) + 真值 JSON
        │
        ▼
   MockInferenceEngine ──┬──► RGB  分支  (权重 1.70)
   （真值派生的三支路）   ├──► IR   分支  (权重 1.95)
                        └──► 双流 分支  (dual_l 1.20 / 6_0 0.95 / l_50 1.00)
        │
        ▼
   WbfFuser（IoU 0.58 聚簇 → 加权平均 → 置信度缩放）
        │
        ├──► MetricsEvaluator（IoU 0.5 贪心匹配 → P/R）
        └──► data/records/*.json（原子写，上限 500 条）
        │
        ▼
   REST + SSE ──► React 控制台（工作台 / 任务中心 / 系统日志）
```

| 层 | 选型 |
| --- | --- |
| 后端 | Spring Boot 3.2.0 · Java 17 · Jackson · SseEmitter |
| 前端 | React 18 · TypeScript 5 · Vite 5 · Tailwind 3.4.17 · lucide-react |
| 引擎 | 自研模拟推理：场景生成、三支路、WBF、评估（无 torch / 无 ultralytics） |
| 存储 | 文件系统 `data/` + JSON，无数据库 |
| 工具 | Maven 3.9.9（脚本引导）· Playwright（点击级走查）· 自研文档检查器 |

## 快速开始

### 前置条件

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| JDK | 17 | 项目内已备便携版 `.tools/jdk17`，脚本优先使用 |
| Maven | 3.9.9 | 系统未安装时由脚本下载到 `.tools/maven` |
| Node.js | 20 | 项目内已备便携版 `.tools/node20`；系统 Node 22 在本机加载模块即崩 |
| 端口 | 8080 / 5173 | 后端 API 与前端开发服务器 |

### 启动

```powershell
# 1) 后端：首次会自动下载 Maven 与依赖，随后构建并启动
.\start-backend.cmd

# 2) 前端：首次会自动安装依赖
.\start-frontend.cmd
```

- 后端 <http://localhost:8080>，接口前缀 `/api`
- 前端 <http://localhost:5173>，`/api` 由 Vite 代理
- 首次启动生成 `data/scenarios/` 下 20 张 PNG 与 10 份真值 JSON

后台启动与重建：

```powershell
scripts\start-backend.ps1 -Rebuild -Background    # 重新构建，日志写 .tools\backend.log
scripts\start-frontend.ps1 -Background            # 日志写 .tools\frontend.log
```

### 常用命令

以下命令均在仓库根目录执行。

| 目的 | 命令 |
| --- | --- |
| 文档治理校验 | `python tools\check_docs.py --root . --config tools\governance-config.json` |
| 前端类型检查 + 构建 | `cd frontend; node ..\.tools\node20\node.exe node_modules\typescript\bin\tsc --noEmit; node ..\.tools\node20\node.exe node_modules\vite\bin\vite.js build` |
| 点击级走查 | `cd tools\e2e; node check.mjs`（首次先跑 `scripts\e2e-install.cmd`） |
| 重建样例场景 | `POST /api/system/regenerate-scenarios` |
| 查看接口契约 | [docs/02-方案与契约/02-前后端接口契约.md](docs/02-方案与契约/02-前后端接口契约.md) |

## 演示动线

| 想演示什么 | 怎么点 |
| --- | --- |
| 完整检测 | 工作台选场景 → 开始检测 → 看六阶段进度 → 双画出框 → 明细表与真值对比 |
| 多模态价值 | 画布工具栏切 RGB / IR / 双流：同一目标在不同分支的检出与置信度差异一目了然 |
| 参数影响 | 拉高置信度阈值重跑，观察 FP 减少、FN 增加，右侧 P/R 同步变化 |
| 批量与回溯 | 任务中心勾选多个场景提交批次 → 等待队列 → 点行回放、导出 CSV |
| 过程可观测 | 系统日志页看 SSE 实时流，按 WARN 过滤，暂停后计数继续累加 |

## 疑难解答

| 现象 | 处理 |
| --- | --- |
| 前端白屏、顶栏亮红"未连接" | 后端未起，先跑 `start-backend.cmd`；确认 8080 未被占用 |
| 首次构建卡很久 | 需要联网下载 Maven 与依赖，`.tools\maven`、`%USERPROFILE%\.m2` 会缓存；重跑即快 |
| Node 报 `0xC0000005` | 系统 Node 22 在本机加载 `node_modules` 即崩；脚本已切到 `.tools\node20` 并清空注入的 `NODE_OPTIONS` |
| `npm install` 在 esbuild 处失败 | postinstall 会崩；安装命令固定 `--ignore-scripts`，平台二进制由 `@esbuild/win32-x64` 提供 |
| 检测完成但没有框 | 确认画布工具栏不是"真值 0"的空视图；分支开关全关也会导致融合为空 |
| 上传图检测后没有精确率 | 属设计行为：上传图无真值，`metrics` 为 `null`，面板改提示"上传图像没有真值标注" |
| CSV 打开中文乱码 | 用 Excel 直接双击（文件带 BOM）；若用其他工具导入请选 UTF-8 |
| 删除任务报 409 | 运行中的任务不可删，等状态变为成功或失败再删 |
| 日志页一直"重连中" | 代理可能缓冲 SSE；前端已降级为 500ms 轮询，不影响结果 |
| 中文路径下命令失败 | 路径含 `[A18]`，PowerShell 需用 `-LiteralPath`，否则方括号被当通配符 |

## 开发文档

| 想做什么 | 从哪里进 |
| --- | --- |
| 先弄清现在做到哪 | [当前系统状态](docs/00-当前系统状态.md) |
| 改代码前了解边界 | [AGENTS.md](AGENTS.md) · [文档与目录治理规范](docs/01-工程治理/01-文档与目录治理规范.md) |
| 先看设计与算法 | [重建方案](docs/02-方案与契约/01-演示平台重建方案.md) · [界面设计规范](docs/02-方案与契约/03-界面设计规范.md) |
| 对接接口或改字段 | [前后端接口契约](docs/02-方案与契约/02-前后端接口契约.md) |
| 按阶段推进 | [后端计划](docs/03-开发计划与验收/01-后端实施计划.md) · [前端计划](docs/03-开发计划与验收/02-前端实施计划.md) · [验收清单](docs/03-开发计划与验收/03-验收清单.md) |
| 查原包为什么跑不起来 | [原交付包盘点](docs/09-历史与证据/01-原交付包盘点与归属登记.md) · [运行环境适配记录](docs/09-历史与证据/03-运行环境适配记录.md) |
| 换机器复现 | [基线复制清单](docs/09-历史与证据/02-基线复制清单.md) |
| 前端目录与令牌 | [frontend/README.md](frontend/README.md) |
| 旧实现参考 | [legacy/README.md](legacy/README.md) |

## 数据与使用边界

- **模型是虚接的**：`MockInferenceEngine` 由真值派生候选框；换成真实服务只需替换该类，输出同样的 `detections[{cls, conf, box}]` 结构。
- **数字要看清来源**：界面展示的类别 AP 与 mAP50 0.836 来自项目历史实验，不是本系统实测；演示页统一标注"模拟模式"。
- **场景是合成的**：10 组场景由脚本绘制，车辆位置即真值，用于讲清链路，不代表任何真实路段。
- **不随仓库提供**：`.pt` 权重（在网盘，见 `legacy/models/说明.md`）、VEDAI 原始数据、`data/` 运行时产物、`.tools/` 便携运行时。
- **版本库**：私有仓库，提交身份统一为 noreply 账号，不含个人邮箱、本机路径与他人用户名。

## 目录

- [系统概述](#系统概述)
- [主要功能](#主要功能)
- [技术架构](#技术架构)
- [快速开始](#快速开始)
- [演示动线](#演示动线)
- [疑难解答](#疑难解答)
- [开发文档](#开发文档)
- [数据与使用边界](#数据与使用边界)
- [English](#english)

```
05_演示平台开发仓库/
├── start-backend.cmd / start-frontend.cmd   双击启动入口
├── pom.xml                                  Spring Boot 构建
├── src/main/java/com/example/traffic/
│   ├── engine/    场景生成 · 模拟推理 · WBF · 评估
│   ├── service/   场景 · 任务 · 批次 · 日志 · 导出 · 存储
│   ├── web/       6 组 Controller + 全局异常
│   ├── domain/    record 数据模型
│   └── config/    属性绑定 · CORS · 线程池
├── frontend/      React 控制台（src + 构建配置）
├── docs/          现状 · 治理 · 方案与契约 · 计划验收 · 历史证据
├── tools/         文档检查器 · Playwright 走查
├── scripts/       启动 · 安装 · 冒烟
├── config/        模拟引擎参数来源（历史实验快照）
├── shared-memory/ 跨会话过程记录（不作验收依据）
├── legacy/        旧 Vue 前端 · Python 推理脚本 · 权重说明（只读）
└── data/          运行时场景、上传与记录（不入库）
```

## English

**A18 Multimodal Small-Object Detection Demo** rebuilds a drone-view detection system so it runs anywhere, without PyTorch or model weights. A deterministic Java engine generates paired RGB/IR scenes, derives three branch outputs from ground truth, fuses them with a real weighted-box-fusion implementation, and evaluates precision/recall against known labels. A React console drives the whole flow over REST and SSE.

**Highlights**

- End-to-end chain: generate → infer (RGB / IR / dual) → WBF fuse → evaluate → export
- WBF and P/R are genuine algorithms; only weights and dataset are mocked, and every screen says so
- Ten procedurally generated 1024×1024 scenes with paired IR and matching annotations, regenerated on first start
- Batch runs, replayable history, JSON/CSV export with UTF-8 BOM, live log stream, light and dark themes
- 16 Playwright click-through assertions cover detection, upload, export, log filtering and theme persistence

**Quick start**

Requires JDK 17; Maven, Node and a portable JDK are bootstrapped into `.tools/` by the scripts. Run `start-backend.cmd` (port 8080) and `start-frontend.cmd` (port 5173). The first launch generates the sample scenes.

**Scope**

All scenes and detections are synthetic; the reported mAP figures come from a historical experiment snapshot, not from this system. Runtime state is maintained only in the [current status page](docs/00-当前系统状态.md). Weights, datasets and runtime artifacts are not distributed with the repository.
