# 前端工程

React 18 + TypeScript 5 + Vite 5 + Tailwind CSS 3.4.17，界面语言遵循 PersonalGate 设计基线（浅色默认 + 深色，蓝色强调，细边框圆角卡片）。规范见 [界面设计规范](../docs/02-方案与契约/03-界面设计规范.md)。

## 命令

```powershell
npm install --ignore-scripts   # 必须带 --ignore-scripts，见下方说明
npm run dev                    # http://localhost:5173，/api 代理到 8080
npm run build                  # tsc --noEmit && vite build
```

本机需使用项目内便携 Node 20（`.tools/node20`），系统 Node 22 加载模块即崩。根目录的 `start-frontend.cmd` 已处理 Node 选择、`NODE_OPTIONS` 清空与依赖安装。

## 结构

```
src/
├── main.tsx / App.tsx          入口、主题 Provider、路由（三页懒加载）
├── index.css                   色彩角色变量（浅/深）、字阶、表格与面板基础样式
├── lib/
│   ├── theme.tsx               主题上下文：localStorage 持久化，首屏无闪烁
│   ├── api.ts                  REST 封装 + 导出下载 + SSE（含轮询兜底）
│   ├── types.ts                与后端契约同构的类型
│   ├── colors.ts               类别/分支数据色板与中文标签
│   └── format.ts               时间、百分比、耗时、阶段名
├── hooks/useSystemInfo.ts      系统信息与连通性轮询（15s）
├── components/
│   ├── layout/                 SideNav（92px）、TopBar（含主题开关）、AppShell、PageHeader
│   ├── ui/                     Button、Card、Badge、Switch、Slider、Progress、Tabs、Drawer、Skeleton/Empty
│   └── detection/              ScenePicker、UploadPanel、DualCanvas、BranchToolbar、ParamPanel、RunProgress、DetectionTable、StatCards、ClassBars、MetricCompare
└── pages/                      WorkbenchPage、TasksPage、LogsPage
```

## 令牌机制

`index.css` 用 `--pg-*` 三元组定义两套主题；`tailwind.config.js` 把 `ink / signal / text` 前缀映射到这些角色，所以组件里只写语义类名（`bg-ink-850`、`border-ink-700`、`text-text-secondary`），切换主题不需要改组件。

新增颜色时：先在 `index.css` 的两个主题块里补同名变量，再在 `tailwind.config.js` 挂一个语义键。不要在组件里写死十六进制值（画布绘制除外）。

## 实现要点

- **画布**：`DualCanvas` 按容器像素 × DPR 绘制，坐标乘显示比例，`ResizeObserver` 触发重绘；标签白字压在类别色块上。
- **分支切换**：WBF 融合 / RGB / IR / 双流只是渲染开关，读取同一份 `RunRecord`，不触发重新推理。
- **SSE**：`streamRun` 首选 `EventSource`，出错自动降级为 500ms 轮询。
- **分段控件**：使用 `role="tab"` + `aria-selected`，键盘可达；E2E 以 `getByRole('tab')` 定位。
- **空状态**：未运行、无真值、加载中、连接断开各有独立文案；未知值显示 `—`。

## 固定依赖

Vite 5、TypeScript 5、Tailwind 3.4.17、`tailwind-merge ^2.5.5`、`tailwindcss-animate`、`postcss 8.5`、`autoprefixer`、`lucide-react`、`sonner`、`react-router-dom`。不引入图表库与 Radix 运行时依赖，UI 原语为本地实现。
