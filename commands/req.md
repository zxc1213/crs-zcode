---
description: 智能需求管理统一入口 - 引导式创建需求、查询状态、复盘沉淀（5 阶段文档流程）
---

# 需求管理系统命令

为 ZCode 提供从需求捕获到测试完成的全流程管理。本命令是**唯一入口**：创建、查询、复盘都在这里，系统自动路由。

## ⛔ 强制工作流（MUST READ）

**在执行任何代码修改之前，必须完成全部 5 个文档阶段。跳过文档阶段直接修改代码是严重违规。**

- [1/5] 需求解析 → 生成骨架文件
- [2/5] 深度分析 → 写入 `spec/` 全部 5 个子文件
- [3/5] 优先级评估 → 更新 `spec.md` 元数据 + `meta.yaml`
- [4/5] 测试策略 → 写入 `test-cases/` 全部 3 个子文件
- [5/5] 实施计划 → 写入 `plan/` 全部 2 个子文件
- 全部完成 → 才能开始代码实现

**阶段完成标准**：`spec.md` / `test-cases.md` / `plan.md` 索引表中所有文件状态均为「已填充」。PostToolUse hook 会在活跃需求处于 `planning/analyzed` 时对编辑外部文件注入违规警告。

## 三种入口场景

### 场景 A：不带参数（`/crs:req`）→ 引导模式

执行以下引导流程：

1. **检查项目初始化**：`.requirements/` 不存在时，说明这是首次使用，展示一段简短介绍（CRS 是什么、数据存哪里），然后引导用户输入第一个需求描述。
2. **展示状态概览**：
   - 活跃需求数量与各状态分布（读 `meta.yaml`）
   - 最近 3 条需求
3. **给出推荐动作**（按状态推断）：
   - 有 `planning/analyzed` 需求 → "需求 X 还在文档阶段，说'继续 <ID>'接着完成，或'实现 <ID>'查看计划"
   - 有 `implementing` 需求 → "需求 X 实现中，完成后可运行 /crs:req-quality <ID> --verify implementation 验收"
   - 有 `review` 需求 → "需求 X 待复盘，说'复盘 <ID>'沉淀经验后关闭"
   - 无活跃需求 → "直接输入需求描述即可创建，例如：添加用户登录功能"
4. 不创建任何文件。

### 场景 B：带需求描述（`/crs:req <描述>`）→ 创建流程

**第一步：类型确认（对话式，不让用户记选项）**

从描述自动推断类型（无法推断时询问用户），然后用一句话确认：

```
📋 识别为「Bug 修复」（将存入 bugs/，ID 前缀 BUG）
   ▶ 直接回车确认开始
   a. 改为调整类（现有行为微调）
   r. 改为重构类
   q. 快速模式（跳过深度分析，只建骨架）
```

用户确认后进入 5 阶段。**用户提供了显式选项（--bug 等）时跳过确认直接开始。**

**第二步：执行 5 阶段**（每阶段结果必须用 Write 写入文件，绝对不允许只输出不落盘）

#### 阶段 1/5: 需求解析 + 初始化

1. **经验检索**（成长机制）：`.requirements/_system/lessons/` 存在时，扫描各 lesson 的标题与 tags，与当前需求相关的读入上下文，在分析中参考
2. **安全检查**：检测敏感信息（密钥/密码/IP），发现时警告并等待确认
3. **相似度检测**：用 `node "$ZCODE_PLUGIN_ROOT/bin/kg-cli.js" search "<描述>"` 查相似需求，相似度高时列出让用户选择：继续创建 / 转到已有需求
4. **自动初始化**（如需）：创建 `.requirements/` 目录结构
5. **创建需求目录**并生成骨架：`meta.yaml`、`raw.md`、`spec.md` + `spec/`（5 骨架）、`test-cases.md` + `test-cases/`（3 骨架）、`plan.md` + `plan/`（2 骨架）、`.agent-context.md`

文档结构规范见 `req-doc-format` skill。

#### 阶段 2/5: 深度分析 → 写入 spec/

自动启动 `req-brainstorm`（问题探索 → 方案审查 → 设计展示 → 最终审查）。完成后**立即写入** `spec/` 各文件并更新 `spec.md` 索引状态。`--quick` 模式跳过本阶段。

#### 阶段 3/5: 优先级评估 + 质量检查 → 更新元数据

按 `req-priority` 维度评估（业务价值 40% / 紧急 30% / 依赖 15% / 成本 10% / 风险 5%），完成后**立即**更新 `spec.md` 元数据区和 `meta.yaml` 的 priority 字段与 status。

#### 阶段 4/5: 测试策略 → 写入 test-cases/

按 `req-test-plan` 生成正向/异常/边界用例，**立即写入** `test-cases/` 并更新索引。

#### 阶段 5/5: 实施计划 → 写入 plan/

基于 spec 生成任务分解与里程碑（结合 writing-plans），**立即写入** `plan/` 并更新索引。完成后输出下一步指引：*"文档就绪，直接说'开始实现'即可按 plan.md 执行。"*

### 场景 C：查询与运维选项

| 输入 | 行为 |
|---|---|
| `--list` | 列出所有需求及状态 |
| `--active` | 当前活跃（非 done）需求 |
| `--status <id>` | 单个需求状态 |
| `--dashboard` | 仪表板：统计、活跃、最近需求 |
| `复盘 <id>` / `--retro <id>` | 完成复盘（见下） |

查询选项在项目未初始化时直接返回空结果，不触发初始化。

## 完成复盘（成长机制）

需求实现完成、验收通过后（status 即将置为 `done`），**必须引导复盘**：

1. **生成 `retro.md`**（模板：`templates/retro.md.tpl`）：
   - 估时 vs 实际
   - 踩坑与解决（哪些坑值得记住）
   - 可复用结论（代码模式、工具、流程改进）
2. **提炼 lessons**：retro 中值得跨需求记住的结论，各写成一条 `.requirements/_system/lessons/<topic>.md`：
   ```markdown
   ---
   tags: [登录, jwt, 安全]
   source: FEAT-20260908-001
   date: 2026-09-08
   ---
   <一句话教训/规则/模式>
   <适用条件>
   ```
3. **更新 `meta.yaml`**：status → done（引擎自动补写 completed 时间）
4. **历史入账**：复盘与经验写完后各记一条时间线事件（引擎维护项目历史，不手改 timeline.yaml）：
   ```bash
   node "$ZCODE_PLUGIN_ROOT/scripts/requirement-manager/index.js" event --type retro_completed --id <需求ID> --title "复盘完成" --summary "<一句话: 最大收获/踩坑>"
   node "$ZCODE_PLUGIN_ROOT/scripts/requirement-manager/index.js" event --type lesson_saved --id <需求ID> --title "<lesson主题>" --summary "<一句话教训>"
   ```
5. lessons 会在此后每次创建相关需求时被自动检索（阶段 1）——这就是经验的复利

用户明确说"跳过复盘"时记录到 retro.md（一行占位）后直接关闭，不强求。

## 选项速查（供熟练用户）

- 类型：`--feature/-f`（默认）、`--bug/-b`、`--question/-q`、`--adjust/-a`、`--refactor/-r`
- 模式：`--quick`（只建骨架）、`--auto`（文档后自动实现）、`--conservative`（每阶段确认）
- 深度：`--deep/-d`（默认深度分析）、`--quick` 等价跳过

## 重要说明

**DO:**

- ✅ 每阶段结束立即用 Write 写文件 — 硬性要求
- ✅ 增量更新已有骨架文件，不要另建新文件
- ✅ 创建前检查相似需求与历史 lessons
- ✅ done 前走复盘

**DON'T:**

- ❌ 5 阶段完成前编辑 `.requirements/` 之外的代码
- ❌ 只输出分析结果不写文件 — 最严重违规
- ❌ 跳过写入检查点
- ❌ 创建重复需求

## 集成说明

- **Processor**（引擎）：目录/骨架/状态机，`node "$ZCODE_PLUGIN_ROOT/scripts/requirement-manager/index.js"`
- **req-brainstorm / req-priority / req-quality / req-test-plan**：阶段 2-4 的方法论 skill，自动协作
- **writing-plans**（ZCode 内置）：阶段 5 计划生成
- **Hooks**：SessionStart 注入活跃需求、PostToolUse 阶段守卫、Stop 文档同步
