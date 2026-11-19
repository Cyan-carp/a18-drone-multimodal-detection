# 归档资产（只读）

这里保存原演示系统里"有价值但不再使用"的实现，便于对照交互、参数与历史行为。**归档区不参与构建，不接受修改。**

| 目录 | 来源 | 为什么归档 |
| --- | --- | --- |
| `frontend-vue/` | `04_.../TrafficObjectDetection/frontend`（src、index.html、package.json、package-lock.json、vite.config.js） | 旧 Vue 3 + Element Plus 单页实现；新版前端改用 React 重写，但画框与上传交互仍可参考 |
| `python/` | `04_.../TrafficObjectDetection/python` | 真实 WBF 集成脚本，含分支权重、评估与融合调用方式；需要 torch 与权重，本机不可运行 |
| `models/` | `04_.../TrafficObjectDetection/models` | 权重在百度网盘的说明，是"权重缺失"这一事实的书面证据 |

## 已知缺口

- 未包含 `frontend/node_modules`（10,906 个文件）与 `frontend/dist`（3 个旧构建产物），理由见 [基线复制清单](../docs/09-历史与证据/02-基线复制清单.md) §3。
- `python/` 下的脚本依赖 `ultralytics`、`torch`、`.pt` 权重，均未随包提供；直接运行会失败，这是预期行为。

## 使用建议

- 查"旧版怎么在 canvas 上画框、怎么缩放"：看 `frontend-vue/src/App.vue` 的 `drawBoundingBoxes`。
- 查"真实 WBF 参数从哪来、怎么调"：看 `python/wbf_integration.py` 的参数解析段，配合 `config/reference/wbf_best_current.json`。
- 不要从这里复制旧路径常量（`C:\Users\<他人用户名>\...`、`d:\code\A18`），它们是原系统失效的直接原因，见 [盘点 §3](../docs/09-历史与证据/01-原交付包盘点与归属登记.md)。
