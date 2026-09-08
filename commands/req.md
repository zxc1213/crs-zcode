---
description: 智能需求管理系统 - 从需求到测试的全流程自动化，集成深度需求分析
---

# 需求管理系统命令

智能需求管理系统，为 ZCode 提供从需求捕获到测试完成的全流程管理能力。

## ⛔ 强制工作流（MUST READ）

**在执行任何代码修改之前，你必须完成全部 5 个文档阶段。跳过文档阶段直接修改代码是严重违规。**

阶段门禁规则：

- [1/5] 创建需求 → 生成骨架文件
- [2/5] 深度分析 → 写入 `spec/` 全部 5 个子文件
- [3/5] 优先级评估 → 更新 `spec.md` 元数据 + `meta.yaml`
- [4/5] 测试策略 → 写入 `test-cases/` 全部 3 个子文件
- [5/5] 实施计划 → 写入 `plan/` 全部 2 个子文件
- 全部完成后 → 才能开始代码实现

**阶段完成标准**: `spec.md` / `test-cases.md` / `plan.md` 索引表中所有文件状态均为「已填充」

**PostToolUse hook 会在你编辑 `.requirements/` 之外的文件时检查活跃需求状态。如果状态仍为 `planning` 或 `analyzed`，会输出警告。**

## 核心特性

- **文档格式集中管理**：所有文档结构定义在 `req-doc-format` skill 中，各阶段按需引用
- 集成 `req-brainstorm` 深度分析模式，确保每个需求都经过完整的探索和审查
- `req-manager` 统一入口，智能路由到最优流程
- `req-priority` 科学评估优先级，优化资源分配
- `req-quality` 质量门禁系统，确保交付质量
- 创建需求时**自动生成骨架文件**（spec.md、plan.md、test-cases.md），确保文档不遗漏

## 用法

```bash
/crs:req [选项] <描述>
```

## 选项

### 类型选项

- `--feature`, `-f` : 新功能（默认）
- `--bug`, `-b` : Bug 修复
- `--question`, `-q` : 技术问题
- `--adjust`, `-a` : 需求调整
- `--refactor`, `-r` : 重构

### 分析选项

- `--quick` : 快速模式，跳过深度分析
- `--deep`, `-d` : 深度分析模式（默认，使用 req-brainstorm）

### 执行选项

- `--auto` : 全自动模式
- `--conservative` : 保守模式

### 查询选项

- `--list` : 列出所有需求
- `--active` : 当前活跃需求
- `--status <id>` : 需求状态
- `--dashboard` : 显示仪表板

## 命令行为

### 前置检查：项目初始化

**在执行任何操作之前，必须先检查项目是否已初始化**：

1. 检查当前项目根目录是否存在 `.requirements/` 目录
2. 如果**不存在**：
   - **查询命令**（`--list`、`--active`、`--status`、`--dashboard`、`--help`）：直接执行，不需要初始化
   - **创建/修改命令**（提供需求描述或修改指令）：自动执行初始化，创建目录结构后再继续
3. 如果**已存在**：正常执行

> 无需用户手动运行 `/crs:req-init`，系统会在首次创建需求时自动完成初始化。

### 查询命令

**当用户使用查询选项时**：

1. 运行对应的查询脚本
2. 格式化并显示结果
3. 不创建任何需求文件

**`--dashboard`**：显示需求统计、活跃需求、最近需求列表

**`--list`**：列出所有需求及其状态

**`--active`**：显示当前活跃（in_progress）的需求

### 创建需求

**核心流程**：当用户提供描述时，按 5 个阶段执行，每阶段必须将结果写入磁盘文件。文档格式规范见 `req-doc-format` skill。

```
[1/5] 需求解析 + 初始化
  → 自动创建目录 + meta.yaml + spec.md/plan.md/test-cases.md 骨架
  ↓
[2/5] 深度分析
  → req-brainstorm 分析完成后，立即写入 spec.md
  ↓
[3/5] 优先级 + 质量检查
  → 评估完成后，更新 spec.md 元数据区和 meta.yaml
  ↓
[4/5] 测试策略
  → 生成测试用例，写入 test-cases.md
  ↓
[5/5] 实施计划
  → 生成任务分解，写入 plan.md
```

**需求目录结构**（创建后立即存在）：

```
.requirements/<type>/<ID>/
├── meta.yaml              # 需求元数据（含优先级）
├── raw.md                 # 原始需求描述
├── spec.md                # 摘要索引（链接到 spec/ 子文件）
├── spec/                  # 详细设计（阶段 2 填充）
│   ├── background.md
│   ├── user-stories.md
│   ├── design.md
│   ├── api.md
│   └── decisions.md
├── plan.md                # 摘要索引（链接到 plan/ 子文件）
├── plan/                  # 实施计划（阶段 5 填充）
│   ├── tasks.md
│   └── milestones.md
├── test-cases.md          # 摘要索引（链接到 test-cases/ 子文件）
├── test-cases/            # 测试用例（阶段 4 填充）
│   ├── positive.md
│   ├── negative.md
│   └── boundary.md
└── .agent-context.md      # Agent 上下文指引
```

#### 阶段 1/5: 需求解析 + 初始化

1. 解析需求类型（从选项或描述推断）
2. **安全检查**：检测敏感信息，发现时警告并等待确认
3. **相似度检测**：查找相似需求，显示列表，询问是否继续
4. **自动初始化**（如需要）：创建 `.requirements/` 目录结构
5. **创建需求目录**：执行 processor.create()，**自动生成以下文件**：
   - `meta.yaml` — 需求元数据
   - `raw.md` — 原始描述
   - `spec.md` — 摘要索引（含 spec/ 子文件链接表）
   - `spec/` — 设计文档子目录（5 个骨架文件）
   - `plan.md` — 摘要索引（含 plan/ 子文件链接表）
   - `plan/` — 实施计划子目录（2 个骨架文件）
   - `test-cases.md` — 摘要索引（含 test-cases/ 子文件链接表）
   - `test-cases/` — 测试用例子目录（3 个骨架文件）
   - `.agent-context.md` — 上下文指引

> 根文件是摘要索引，详细内容写入子目录。后续阶段**必须写入子目录文件**，并更新根文件索引状态。

#### 阶段 2/5: 深度分析 → 写入 spec/ 子目录

**除非使用 `--quick` 选项，否则自动启动 req-brainstorm**。

分析流程：问题探索 → 方案审查 → 设计展示 → 最终审查。

**⚠️ 检查点（必须执行）**：分析完成后，**必须立即使用 Write 工具**将结果写入 `spec/` 子目录各文件：

> 文档结构参考 `req-doc-format` skill 的「4. spec/ 子目录文件格式」章节。
- 写入 `spec/background.md`：背景与目标、范围
- 写入 `spec/user-stories.md`：用户故事、验收标准
- 写入 `spec/design.md`：系统架构、核心组件、数据流
- 写入 `spec/api.md`：接口定义、技术选型、错误处理
- 写入 `spec/decisions.md`：开放问题、技术决策
- **更新 `spec.md` 索引表**：将各文件状态标记为「已填充」

> **绝对不允许**只输出分析结果而不写入文件。分析结果的价值在于持久化到 spec/ 子目录。

#### 阶段 3/5: 优先级评估 + 质量检查 → 更新 spec.md

**自动触发 req-priority 和 req-quality**。

评估维度：业务价值(40%)、紧急程度(30%)、依赖关系(15%)、实现成本(10%)、风险(5%)。

**⚠️ 检查点（必须执行）**：评估完成后，**必须立即**：
1. 使用 Write 工具更新 `spec.md` 的"元数据"区：更新优先级等级和评分，更新需求状态
2. 使用 Write 工具更新 `meta.yaml`：添加 priority 字段（level、score、breakdown、rationale），更新 status 字段

> 格式参考 `req-doc-format` skill 的「2. meta.yaml 格式」和「3. spec.md 格式 - 元数据区」章节。

#### 阶段 4/5: 测试策略 → 写入 test-cases/ 子目录

**自动生成测试策略**。

**⚠️ 检查点（必须执行）**：**必须立即使用 Write 工具**将结果写入 `test-cases/` 子目录各文件：
- 写入 `test-cases/positive.md`：正向用例（至少 1 个）
- 写入 `test-cases/negative.md`：异常用例（至少 1 个）
- 写入 `test-cases/boundary.md`：边界用例（至少 1 个）
- 更新 `test-cases.md` 索引表：填充测试范围表，标记各文件状态

> 格式参考 `req-doc-format` skill 的「8. test-cases/ 子目录文件格式」章节。

#### 阶段 5/5: 实施计划 → 写入 plan/ 子目录

**自动调用 writing-plans**，基于 spec.md 生成实施计划。

**⚠️ 检查点（必须执行）**：**必须立即使用 Write 工具**将结果写入 `plan/` 子目录：
- 写入 `plan/tasks.md`：任务分解表（具体任务、预估工时、依赖关系）
- 写入 `plan/milestones.md`：里程碑 + 风险清单
- 按需创建 `plan/step-N-xxx.md`：各步骤详细文档
- 更新 `plan.md` 索引表：标记各文件状态

> 格式参考 `req-doc-format` skill 的「6. plan/ 子目录文件格式」章节。

#### 快速模式（`--quick`）

跳过阶段 2-5 的分析流程，只执行阶段 1（创建骨架文件）。后续可手动补充。

## 执行模式

### 默认模式（半自动 + 深度分析）

- 执行全部 5 个阶段
- 每阶段写入对应文件
- 返回下一步操作建议

### 快速模式（`--quick`）

- 仅创建骨架文件（阶段 1）
- 跳过深度分析
- 后续可手动补充各文档

### 全自动模式（`--auto`）

- 深度分析 + 自动实现
- 所有文档一次性生成

### 保守模式（`--conservative`）

- 深度分析 + 每步确认
- 需要用户确认后继续

## 安全检查

系统会自动检测并警告：

- 敏感信息（密钥、密码、个人信息）
- API 密钥泄露
- IP 地址暴露

检测到敏感信息时会：

1. 显示警告
2. 提供脱敏建议
3. 等待用户确认后继续

## 示例

### 创建新功能（默认深度分析）

```bash
/crs:req 添加用户登录功能
/crs:req -f 实现文件上传功能
```

### 快速创建（跳过深度分析）

```bash
/crs:req --quick 修复登录页面样式
```

### Bug 报告

```bash
/crs:req --bug 登录页面崩溃
/crs:req -b 支付超时问题
```

### 查看仪表板

```bash
/crs:req --dashboard
```

### 查看活跃需求

```bash
/crs:req --active
```

## 重要说明

**DO:**

- ✅ 使用 `/req` 简化命令（自动触发 req-manager）
- ✅ 让系统自动推断需求类型和模式
- ✅ 默认使用 req-brainstorm 进行深度分析
- ✅ **每个阶段结束后立即使用 Write 工具写入文件** — 这是硬性要求
- ✅ 增量更新已有的骨架文件（spec.md/plan.md/test-cases.md），不要另建新文件
- ✅ 检查相似需求，避免重复
- ✅ 关注 req-priority 的优先级评估结果

**DON'T:**

- ❌ 在完成 5 阶段文档之前编辑任何源代码文件（`.requirements/` 内的文件除外）
- ❌ 在索引表全部标记为「已填充」之前进入实施阶段
- ❌ 只输出分析结果而不写入文件 — 这是最严重的违规
- ❌ 跳过任何阶段的文件写入检查点
- ❌ 创建新的 spec.md 而不更新已存在的骨架
- ❌ 除非使用 `--quick`，否则跳过深度分析
- ❌ 忽略安全检查警告
- ❌ 创建重复的需求

## 工作流示例

```bash
# 用户输入
/crs:req 添加用户头像上传功能

# 系统响应
[1/5] 需求解析 + 初始化... ✓
      → ID: FEAT-20260525-001-a3b2c1
      → 创建: meta.yaml, spec.md(骨架), plan.md(骨架), test-cases.md(骨架)

[2/5] 深度分析... (req-brainstorm)
      ⚠️ 检查点: 写入 spec.md 需求分析 + 设计方案章节... ✓

[3/5] 优先级评估 + 质量检查...
      → P1 (7.2分)
      ⚠️ 检查点: 更新 spec.md 元数据 + meta.yaml... ✓

[4/5] 测试策略...
      ⚠️ 检查点: 写入 test-cases.md... ✓

[5/5] 实施计划...
      ⚠️ 检查点: 写入 plan.md... ✓

✓ 需求创建完成！
  spec.md        — 需求分析 + 设计方案（已填充）
  test-cases.md — 测试用例（已填充）
  plan.md        — 实施计划（已填充）
  meta.yaml      — 元数据（含优先级）
```

## 集成说明

此命令集成了以下功能模块：

**核心模块**：

- **Processor**: 需求创建和状态管理（自动生成骨架文件）
- **SecurityFilter**: 敏感信息检测和脱敏
- **SimilarityDetector**: 相似需求检测
- **Scheduler**: 执行计划生成和 Skill 调用
- **Dashboard**: 需求可视化和统计

**Skills 集成**：

- **req-manager**: 统一入口，智能路由（自动触发）
- **req-brainstorm**: 深度需求分析（默认启用）
- **req-priority**: 优先级科学评估（自动触发）
- **req-quality**: 质量门禁系统（自动触发）
- **req-test-plan**: 测试策略生成（自动触发）
- **writing-plans**: 实现计划生成

**需要 Node.js 环境支持**（用于查询命令）。
