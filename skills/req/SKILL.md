---
name: req
description: 需求管理命令系统 - 5阶段工作流强制执行，从需求捕获到实施计划的全流程管理
---

# 需求管理命令系统

5 阶段工作流的需求管理：**先文档后代码**，每阶段落盘可追溯。命令入口 `/crs:req`（本 skill 是其方法论说明）。

## 核心原则

**⛔ 阶段守卫**：代码修改只能在 5 阶段文档全部完成后进行。活跃需求处于 `planning/analyzed` 时编辑 `.requirements/` 外的文件，PostToolUse hook 注入违规警告（守卫文案与条件数据化，见 `.requirements/_system/rules.yaml`，指南 `docs/rules.md`）。

## 5 个阶段

| 阶段 | 做什么 | 产出 |
| --- | --- | --- |
| 1 解析+初始化 | 安全检查 → 相似需求检测（`bin/kg-cli.js search "<描述>"`）→ lessons 检索 → 引擎 CLI 创建骨架 | `.requirements/<type>/<ID>/` 全套骨架 |
| 2 深度分析 | req-brainstorm（探索→审查→展示→终审） | `spec/` 5 文件 + spec.md 索引 |
| 3 优先级+质量 | req-priority 五维评估 + req-quality Gate 1 | spec.md 元数据 + meta.yaml `priority_detail` |
| 4 测试策略 | req-test-plan 生成正/反/边界用例 | `test-cases/` 3 文件 + 索引 |
| 5 实施计划 | writing-plans 任务分解与里程碑 | `plan/` + 索引 |

完成标准：三个索引文件（spec.md / test-cases.md / plan.md）所有行状态「已填充」。之后说"开始实现"进入编码。

## CLI 旗标（引擎 `scripts/requirement-manager/index.js`）

- 类型：`-f/--feature`（默认）、`-b/--bug`、`-q/--question`、`-a/--adjust`、`-r/--refactor`；ID 前缀 FEAT/BUG/QUES/ADJU/REF（唯一口径 `core/schema.js`）
- 模式：`--quick`（跳过阶段 2，meta.mode=quick）、`--deep`（默认）、`--auto`、`--conservative`——旗标会被引擎剥离，不污染描述
- 查询：`--list` / `--active` / `--dashboard` / `--status <ID>` / `--history <N>`；子命令：`change` / `event` / `rules`

类型推断（未显式给旗标时）：登录/注册/添加… → feature；错误/崩溃/修复… → bug；如何/为什么… → question；重构/优化… → refactor。推断结果须向用户一句话确认。

## 质量与安全内建

- **安全检查**：创建前扫描描述中的凭证/PII（形如 `password=xxx` 的真实凭证会阻断；自然技术叙述不误报）
- **相似度检测**：知识图谱查相似需求，高相似时让用户选择继续或复用
- **每阶段立即 Write 落盘**——只输出不落盘是最严重违规

## 协作链

```
/crs:req（路由）
  → [2] req-brainstorm → [3] req-priority + req-quality
  → [4] req-test-plan → [5] writing-plans → 开始实现 → 复盘沉淀 lessons
```

文档格式规范见 `req-doc-format`；变更走 `req-change`；度量见 `req-metrics`。项目级定制：`_system/config.yaml`（引擎参数）与 `_system/rules.yaml`（行为规则）。
