---
description: 智能需求管理统一入口 - 引导式创建需求、查询状态、复盘沉淀（5 阶段文档流程）
---

# 需求管理系统命令

CRS 统一入口：创建、查询、复盘，系统自动路由。

## ⛔ 强制工作流（MUST READ）

**执行任何代码修改之前，必须完成全部 5 个文档阶段。跳过文档阶段直接改代码是严重违规。**

1. 需求解析 → 生成骨架文件
2. 深度分析 → 写入 `spec/` 全部 5 个子文件
3. 优先级评估 → 更新 `spec.md` 元数据 + `meta.yaml`
4. 测试策略 → 写入 `test-cases/` 全部 3 个子文件
5. 实施计划 → 写入 `plan/` 全部 2 个子文件

**阶段完成标准**：`spec.md` / `test-cases.md` / `plan.md` 索引表所有文件状态为「已填充」。PostToolUse hook 会在活跃需求处于 `planning/analyzed` 时对编辑外部文件注入违规警告。文档结构规范见 `req-doc-format` skill。

## 三种入口场景

### 场景 A：不带参数 → 引导模式

1. `.requirements/` 不存在 → 简短介绍 CRS（需求文档存 `.requirements/`，代码零侵入），引导输入第一个需求
2. 展示状态概览：活跃需求分布 + 最近 3 条
3. 按状态给推荐动作：`planning/analyzed` → 继续/实现；`implementing` → 完成后跑 `--verify implementation`；`review` → 复盘后关闭；无活跃 → 直接输入描述
4. 不创建任何文件

### 场景 B：带需求描述 → 创建流程

**类型确认（对话式）**：从描述自动推断类型并一句话向用户确认；用户给显式选项（`--bug` 等）时跳过确认。

**执行 5 阶段**（每阶段结果必须用 Write 写入文件，绝对不允许只输出不落盘）：

- **阶段 1 解析+初始化**：① 检索 `_system/lessons/`（tags 相关的读入参考）；② 安全检查（敏感信息警告等确认）；③ 相似检测 `kg-cli.js search "<描述>"`，高相似让用户选择继续/转已有；④ 初始化目录；⑤ 创建需求目录 + 全套骨架（meta.yaml、raw.md、三个索引文件 + spec/5、test-cases/3、plan/2、.agent-context.md）
- **阶段 2 深度分析**：启动 `req-brainstorm`（问题探索→方案审查→设计展示→最终审查），立即写入 `spec/` 并更新索引。`--quick` 跳过
- **阶段 3 优先级**：按 `req-priority` 评估（价值40%/紧急30%/依赖15%/成本10%/风险5%），立即更新 `spec.md` 元数据与 `meta.yaml`
- **阶段 4 测试策略**：按 `req-test-plan` 生成正向/异常/边界用例，立即写入并更新索引
- **阶段 5 实施计划**：结合 writing-plans 生成任务分解与里程碑，立即写入并更新索引。完成后输出："文档就绪，直接说'开始实现'即可按 plan.md 执行。"

### 场景 C：查询与运维

| 输入 | 行为 |
|---|---|
| `--list` / `--active` | 全部需求 / 活跃（非 done）需求 |
| `--status <id>` / `--dashboard` | 单个状态 / 仪表板 |
| `复盘 <id>` / `--retro <id>` | 完成复盘（见下） |

项目未初始化时查询直接返回空结果，不触发初始化。

## 完成复盘（成长机制）

验收通过后（status 置 done 前）**必须引导复盘**：

1. **生成 `retro.md`**（模板 `templates/retro.md.tpl`）：估时 vs 实际、踩坑与解决、可复用结论
2. **提炼 lessons**：值得跨需求记住的结论，各写一条 `_system/lessons/<topic>.md`——frontmatter 含 `tags`/`source`/`date`，正文是一句话教训 + 适用条件
3. **更新 `meta.yaml`**：status → done（引擎自动补写 completed 时间）
4. **历史入账**（引擎维护，不手改 timeline.yaml），复盘与每条 lesson 各记一条事件：
   ```bash
   node "$ZCODE_PLUGIN_ROOT/scripts/requirement-manager/index.js" event --type retro_completed|lesson_saved --id <ID> --title "<标题>" --summary "<一句话>"
   ```
5. lessons 此后创建相关需求时自动检索——经验的复利
6. **外部文档检查**：`docs-map.yaml` 中 `sync_on: done` 的相关文档同步更新后标记复核：`crs-project-sync.js --doc-reviewed README.md`（新文档用 `--scan-docs` 登记）

用户明确说"跳过复盘"时在 retro.md 记一行占位后直接关闭，不强求。

## 选项速查

- 类型：`-f` feature（默认）、`-b` bug、`-q` question、`-a` adjust、`-r` refactor
- 模式：`--quick` 只建骨架、`--auto` 文档后自动实现、`--conservative` 每阶段确认、`--deep` 深度分析（默认）

## DO / DON'T

- ✅ 每阶段立即写文件；增量更新骨架；创建前查相似需求与 lessons；done 前走复盘
- ❌ 5 阶段完成前编辑 `.requirements/` 之外代码；只输出不落盘（最严重违规）；创建重复需求

集成：引擎 `scripts/requirement-manager/index.js`（目录/骨架/状态机）；阶段 2-4 方法论 req-brainstorm / req-priority / req-quality / req-test-plan；阶段 5 writing-plans；Hooks 三件套（SessionStart 注入活跃需求、PostToolUse 阶段守卫——规则可配见 `_system/rules.yaml`、Stop 文档同步）。
