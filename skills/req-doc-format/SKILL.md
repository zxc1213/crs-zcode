---
name: req-doc-format
description: CRS 文档格式规范 - 目录结构、命名规则、索引文件格式与变更记录口径
---

# CRS 文档格式规范

创建、更新、审查需求文档时遵循本规范。**子文件的章节结构以引擎渲染的骨架文件为唯一定义源**（`templates/*.tpl` → 每个需求目录里的骨架实例即格式样例）；本文件定义骨架表达不了的约定与口径。

## 1. 目录与命名

```
.requirements/<type>/<ID>/
├── meta.yaml / raw.md / .agent-context.md（系统生成）
├── spec.md + spec/（background / user-stories / design / api / decisions）
├── plan.md + plan/（tasks / milestones / step-N-<简述>.md 按需）
└── test-cases.md + test-cases/（positive / negative / boundary）
```

- 根文件（spec.md / plan.md / test-cases.md）是**摘要索引**：元数据 + 子文件链接表 + 状态列
- 阶段 2-5 的详细内容**始终写入子目录**，不写根文件；子文件名 kebab-case
- type → 目录：feature→features、bug→bugs、question→questions、adjustment→adjustments、refactor→refactors、tech-debt→tech-debt
- ID：`{前缀}-{YYYYMMDD}-{序号}-{hash后缀}`，前缀 FEAT/BUG/QUES/ADJU/REF/DEBT（与 type 对应，以 core/schema.js TYPE_PREFIXES 为唯一口径）；序号与唯一性由引擎管理，**不要手工编 ID**

## 2. meta.yaml

字段：`id / type / title(≤100字符) / description / created / status / priority / mode / tags`。

- `status`: planning → analyzed → implementing → review → done
- `priority`: low | medium | high | critical；`mode`: quick | semi_auto | full_auto | conservative

写入时机：阶段 1 建基础字段；阶段 3 追加 `priority_detail`（level/score/breakdown 五维/rationale/estimated_effort/roi）。

## 3. 三个索引文件（LLM 直接编写，格式如下）

**spec.md**：`# {title}` + 元数据列表（ID/类型/状态/优先级/创建时间）+ 「详细文档」索引表（章节 | 文件链接 | 状态：待填充/已填充）+ 变更历史表。

**plan.md**：`# {title} — 实施计划` + 需求 ID 行 + 「详细文档」索引表（任务分解/里程碑/步骤详情）+ 变更记录表。

**test-cases.md**：`# {title} — 测试用例` + 需求 ID 行 + 「测试范围」表（模块 | 测试类型 | 优先级）+ 「详细用例」索引表（类型 | 文件 | 状态）+ 变更记录表。

**写入时机**：阶段 1 建骨架；阶段 2/4/5 每填充一个子文件，对应索引行状态改「已填充」；阶段 3 更新 spec.md 元数据区。

## 4. 子文件内容要求（结构见骨架）

- **spec/**（阶段 2 填齐 5 个）：background 含背景/目标/范围（包含+不包含）；user-stories 含故事与可验证验收标准；design 含架构/核心组件/数据流；api 含接口/选型理由/错误处理表；decisions 含开放问题与「决策 | 选择 | 理由」表
- **plan/**（阶段 5）：tasks.md 任务表（# | 任务 | 状态 pending/in_progress/done/blocked | 预估 | 依赖）+ 依赖清单；milestones.md 里程碑复选框 + 风险表（风险|影响|概率|应对）；复杂步骤拆 `step-N-<简述>.md`（目标/详细设计/验收条件）
- **test-cases/**（阶段 4 至少各 1 条）：positive/negative/boundary 统一表格式：`| ID | 场景 | 前置条件 | 步骤 | 预期结果 | 优先级 |`，ID 用 `TC-<类型缩写>-NN`

## 5. 阶段 ↔ 文档对应

| 阶段 | 写什么 |
|------|--------|
| 1 解析+初始化 | 全套骨架 + meta.yaml 基础字段 |
| 2 深度分析 | spec/ 全部 5 文件 + spec.md 索引状态 |
| 3 优先级 | spec.md 元数据区 + meta.yaml priority_detail |
| 4 测试策略 | test-cases/ 3 文件 + test-cases.md 测试范围与索引状态 |
| 5 实施计划 | plan/ 全部 + plan.md 索引状态 |

## 6. 占位符与变更记录口径

- 骨架中 `<!-- TODO: {说明} -->` 为待填充标记，填充后**必须删除**
- **文档自身修订**：各文档末尾变更记录表只记内容修订（格式/章节/勘误），追加不修改；不记需求执行变更
- **需求执行变更**：写需求目录 `CHANGELOG.md`，每变更一节 `## [YYYY-MM-DD HH:mm] [小|中|大] 标题`（级别供 metrics 统计）
- **项目级历史**：引擎自动维护（project/timeline.yaml + changelog.md），LLM 只通过 `index.js change --id <ID> --level <small|medium|large> --reason "<原因>"` 入账，**不手工编辑**

## 7. 项目聚合文档区块标记

`project/` 聚合文档中每个需求的区块由 `<!-- crs:block:<需求ID>:start -->` / `end` 标记包裹，引擎据此替换更新。手工编辑不要破坏标记；内容变更走引擎 change 命令，不手改区块。
