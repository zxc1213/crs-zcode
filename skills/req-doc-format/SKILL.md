---
name: req-doc-format
description: CRS 文档格式规范 - 所有需求文档的目录结构、命名规则和内容定义
---

# CRS 文档格式规范

本文档是 CRS 需求管理系统中所有文档格式的**唯一定义源**。创建、更新、审查需求文档时，必须遵循此处定义的结构。

## 1. 目录与命名规则

### 目录结构

```
.requirements/<type>/<ID>/
├── meta.yaml              # 需求元数据
├── raw.md                 # 原始需求描述
├── spec.md                # 摘要 + 索引（链接到 spec/ 子文件）
├── spec/                  # 详细设计文档
│   ├── background.md      # 背景与目标
│   ├── user-stories.md    # 用户故事 + 验收标准
│   ├── design.md          # 系统架构 + 核心组件 + 数据流
│   ├── api.md             # 接口定义 + 技术选型 + 错误处理
│   └── decisions.md       # 开放问题 + 技术决策
├── plan.md                # 摘要 + 索引（链接到 plan/ 子文件）
├── plan/                  # 详细实施计划
│   ├── tasks.md           # 任务分解表
│   ├── milestones.md      # 里程碑
│   └── step-N-xxx.md      # 各步骤详细文档（按需拆分）
├── test-cases.md          # 摘要 + 索引（链接到 test-cases/ 子文件）
├── test-cases/            # 详细测试用例
│   ├── positive.md        # 正向用例
│   ├── negative.md        # 异常用例
│   └── boundary.md        # 边界用例
└── .agent-context.md      # Agent 上下文指引（系统生成）
```

### 拆分规则

- 根文件（spec.md、plan.md、test-cases.md）是**摘要索引**，包含元数据和子文件链接表
- 阶段 2-5 生成的详细内容**始终写入子目录**，不写入根文件
- 子文件命名使用英文小写 + 短横线（kebab-case）
- plan/ 下的步骤文档格式：`step-N-<简述>.md`（N 从 1 开始）

### type → 目录映射

| type | 目录名 |
|------|--------|
| feature | features |
| bug | bugs |
| question | questions |
| adjustment | adjustments |
| refactor | refactors |

### ID 格式

`{前缀}-{YYYYMMDD}-{三位序号}`

| type | 前缀 | 示例 |
|------|------|------|
| feature | FEAT | FEAT-20260525-001-a3b2c1 |
| bug | BUG | BUG-20260525-001 |
| question | QUES | QUES-20260525-001 |
| adjustment | ADJ | ADJ-20260525-001 |
| refactor | REF | REF-20260525-001 |

## 2. meta.yaml 格式

```yaml
id: FEAT-20260525-001-a3b2c1
type: feature
title: 需求标题（首行描述，限100字符）
description: 完整需求描述
created: "2026-05-25T10:00:00.000Z"
status: planning        # planning | in_progress | review | done | closed
priority: medium        # low | medium | high | critical
mode: semi_auto        # quick | semi_auto | full_auto | conservative
tags: []
# 以下字段在阶段 3（优先级评估）后填充
# priority_detail:
#   level: P1
#   score: 7.2
#   breakdown:
#     business_value: 8
#     urgency: 6
#     dependencies: 4
#     effort: 8
#     risk: 8
#   rationale: "评估理由"
#   estimated_effort: "2-3天"
#   roi: "高"
```

### 写入时机

- **阶段 1**：创建基础字段（id, type, title, description, created, status, priority, mode, tags）
- **阶段 3**：追加 priority_detail 字段

## 3. spec.md 格式（摘要索引）

spec.md 是需求设计文档的**摘要索引**，详细内容在 spec/ 子目录中。

```markdown
# {title}

## 元数据

- **ID**: {id}
- **类型**: {type}
- **状态**: {status}
- **优先级**: {priority_level} ({score}分)
- **创建时间**: {YYYY-MM-DD}

## 详细文档

| 章节 | 文件 | 状态 |
| ---- | ---- | ---- |
| 背景与目标 | [spec/background.md](spec/background.md) | 待填充 |
| 用户故事 | [spec/user-stories.md](spec/user-stories.md) | 待填充 |
| 设计方案 | [spec/design.md](spec/design.md) | 待填充 |
| 接口定义 | [spec/api.md](spec/api.md) | 待填充 |
| 决策记录 | [spec/decisions.md](spec/decisions.md) | 待填充 |

## 变更历史

| 日期 | 变更内容 | 影响分析 |
| ---- | -------- | -------- |
| {YYYY-MM-DD} | 创建需求 | - |
```

### 写入时机

- **阶段 1**：创建骨架（含元数据、详细文档索引表、变更历史首行）
- **阶段 3**：更新「元数据」区（优先级、评分、状态）
- **阶段 2/4/5**：每次填充子文件后，更新索引表中对应行的「状态」为「已填充」

## 4. spec/ 子目录文件格式

### spec/background.md

```markdown
# 背景与目标

## 背景

{描述业务背景和要解决的问题}

## 目标

{要达成的具体目标}

## 范围

### 包含

- {在范围内的内容}

### 不包含

- {明确排除的内容}

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| {YYYY-MM-DD} | 创建 |
```

### spec/user-stories.md

```markdown
# 用户故事

## 用户故事

- 作为{角色}，我想要{功能}，以便{价值}

## 验收标准

1. {具体可验证的验收条件}

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| {YYYY-MM-DD} | 创建 |
```

### spec/design.md

```markdown
# 设计方案

## 系统架构

{整体架构设计，可用文字或 ASCII/Mermaid 图}

## 核心组件

- **组件名**：{职责描述}

## 数据流设计

{数据如何在组件间流动}

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| {YYYY-MM-DD} | 创建 |
```

### spec/api.md

```markdown
# 接口定义与技术选型

## 接口定义

{API 接口或模块接口签名}

## 技术选型

| 选型 | 理由 |
| ---- | ---- |
| {技术} | {选择理由} |

## 错误处理

| 场景 | 处理策略 |
| ---- | -------- |
| {异常情况} | {处理方式} |

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| {YYYY-MM-DD} | 创建 |
```

### spec/decisions.md

```markdown
# 决策记录

## 开放问题

- {待确认的问题}

## 技术决策

| 决策 | 选择 | 理由 |
| ---- | ---- | ---- |
| {决策点} | {选择方案} | {决策理由} |

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| {YYYY-MM-DD} | 创建 |
```

### 写入时机

- **阶段 2**：填充 spec/ 下全部 5 个文件

## 5. plan.md 格式（摘要索引）

plan.md 是实施计划的**摘要索引**，详细内容在 plan/ 子目录中。

```markdown
# {title} — 实施计划

> 需求 ID: {id} | 创建: {YYYY-MM-DD}

## 详细文档

| 章节 | 文件 | 状态 |
| ---- | ---- | ---- |
| 任务分解 | [plan/tasks.md](plan/tasks.md) | 待填充 |
| 里程碑 | [plan/milestones.md](plan/milestones.md) | 待填充 |
| 步骤详情 | [plan/step-1-xxx.md](plan/step-1-xxx.md) 等 | 待填充 |

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| {YYYY-MM-DD} | 创建 |
```

### 写入时机

- **阶段 1**：创建骨架
- **阶段 5**：填充 plan/ 子目录，更新索引表状态

## 6. plan/ 子目录文件格式

### plan/tasks.md

```markdown
# 任务分解

## 任务列表

| # | 任务 | 状态 | 预估 | 依赖 |
| - | ---- | ---- | ---- | ---- |
| 1 | {具体任务} | pending | {工时} | {依赖的#} |
| 2 | {具体任务} | pending | {工时} | {依赖的#} |

任务状态：pending | in_progress | done | blocked

## 依赖清单

| 依赖项 | 类型 | 说明 |
| ------ | ---- | ---- |
| {依赖名} | {外部/内部/模块} | {依赖说明} |

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| {YYYY-MM-DD} | 创建 |
```

### plan/milestones.md

```markdown
# 里程碑

## 里程碑列表

- [ ] 阶段1：{里程碑描述}
- [ ] 阶段2：{里程碑描述}
- [ ] 阶段3：{里程碑描述}

## 风险清单

| 风险 | 影响 | 概率 | 应对 |
| ---- | ---- | ---- | ---- |
| {风险描述} | {高/中/低} | {高/中/低} | {应对方案} |

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| {YYYY-MM-DD} | 创建 |
```

### plan/step-N-xxx.md（按需创建）

```markdown
# 步骤 {N}: {步骤标题}

> 任务 #{task_id} | 预估: {工时}

## 目标

{本步骤要达成的目标}

## 详细设计

{具体实现方案，可包含代码片段、架构图等}

## 验收条件

- {具体的完成标准}

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| {YYYY-MM-DD} | 创建 |
```

### 写入时机

- **阶段 5**：填充 tasks.md 和 milestones.md；步骤详情按需拆分为 step-N-xxx.md

## 7. test-cases.md 格式（摘要索引）

test-cases.md 是测试用例的**摘要索引**，详细内容在 test-cases/ 子目录中。

```markdown
# {title} — 测试用例

> 需求 ID: {id} | 创建: {YYYY-MM-DD}

## 测试范围

| 模块 | 测试类型 | 优先级 |
| ---- | -------- | ------ |
| {模块名} | {单元/集成/E2E} | {高/中/低} |

## 详细用例

| 类型 | 文件 | 状态 |
| ---- | ---- | ---- |
| 正向用例 | [test-cases/positive.md](test-cases/positive.md) | 待填充 |
| 异常用例 | [test-cases/negative.md](test-cases/negative.md) | 待填充 |
| 边界用例 | [test-cases/boundary.md](test-cases/boundary.md) | 待填充 |

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| {YYYY-MM-DD} | 创建 |
```

### 写入时机

- **阶段 1**：创建骨架（含测试范围占位）
- **阶段 4**：填充测试范围 + test-cases/ 子目录，更新状态

## 8. test-cases/ 子目录文件格式

### test-cases/positive.md

```markdown
# 正向用例

| ID | 场景 | 前置条件 | 步骤 | 预期结果 | 优先级 |
| -- | ---- | -------- | ---- | -------- | ------ |
| TC-{ID}-01 | {场景描述} | {前置条件} | 1. {步骤}\n2. {步骤} | {预期结果} | {高/中/低} |

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| {YYYY-MM-DD} | 创建 |
```

### test-cases/negative.md

```markdown
# 异常用例

| ID | 场景 | 前置条件 | 步骤 | 预期结果 | 优先级 |
| -- | ---- | -------- | ---- | -------- | ------ |
| TC-{ID}-02 | {异常场景} | {前置条件} | 1. {步骤}\n2. {步骤} | {错误提示/降级处理} | {高/中/低} |

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| {YYYY-MM-DD} | 创建 |
```

### test-cases/boundary.md

```markdown
# 边界用例

| ID | 场景 | 前置条件 | 步骤 | 预期结果 | 优先级 |
| -- | ---- | -------- | ---- | -------- | ------ |
| TC-{ID}-03 | {边界场景} | {边界条件} | 1. {步骤} | {边界行为} | {高/中/低} |

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| {YYYY-MM-DD} | 创建 |
```

### 写入时机

- **阶段 4**：填充 test-cases/ 下全部 3 个文件（至少各 1 条用例）

## 9. 各阶段与文档的对应关系

| 阶段 | 操作 | 目标文件 | 目标章节 |
|------|------|----------|----------|
| 1/5 解析+初始化 | 创建骨架 | spec.md, plan.md, test-cases.md, meta.yaml + 创建 spec/, plan/, test-cases/ 子目录 + 子文件骨架 | 全部（骨架） |
| 2/5 深度分析 | 填充详细设计 | spec/background.md, spec/user-stories.md, spec/design.md, spec/api.md, spec/decisions.md + 更新 spec.md 索引 | spec/ 全部 + spec.md 索引表状态 |
| 3/5 优先级+质量 | 更新评估结果 | spec.md「元数据」, meta.yaml「priority_detail」 | spec.md「元数据」, meta.yaml |
| 4/5 测试策略 | 填充测试用例 | test-cases/positive.md, test-cases/negative.md, test-cases/boundary.md + 更新 test-cases.md 索引 | test-cases/ 全部 + test-cases.md 测试范围 + 索引表状态 |
| 5/5 实施计划 | 填充任务分解 | plan/tasks.md, plan/milestones.md, plan/step-N-xxx.md(按需) + 更新 plan.md 索引 | plan/ 全部 + plan.md 索引表状态 |

## 10. 占位符约定

骨架文件使用 `<!-- TODO: {说明} -->` 标记待填充区域。填充后**必须删除**对应的 TODO 注释。

## 11. 变更记录约定

所有文档末尾的变更记录表在每次更新时追加一行，不修改已有记录。
