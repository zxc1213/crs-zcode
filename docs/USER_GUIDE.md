# CRS 用户指南

面向日常使用：怎么提需求、每个阶段发生什么、数据放在哪、常见场景怎么处理。

## 基本概念

CRS 把每个需求管理为一个**需求目录**（`.requirements/<类型>/<需求ID>/`），里面是一套结构化文档。整个系统的核心约束只有一条：

> **文档先行**：5 阶段文档全部完成之前，不修改任何项目代码。阶段守卫 Hook 会自动警告违规。

**不知道敲什么？直接运行 `/crs:req`（不带参数）**——系统会显示项目状态概览和推荐动作，跟着走即可。创建需求时也不需要记类型选项：描述需求后系统自动识别并和你确认。

## 需求类型

| 选项 | 类型 | 目录 | ID 前缀 |
|---|---|---|---|
| `--feature` / `-f` | 新功能（默认） | `.requirements/features/` | FEAT |
| `--bug` / `-b` | Bug 修复 | `.requirements/bugs/` | BUG |
| `--question` / `-q` | 技术问题 | `.requirements/questions/` | QST |
| `--adjust` / `-a` | 需求调整 | `.requirements/adjustments/` | ADJ |
| `--refactor` / `-r` | 重构 | `.requirements/refactorings/` | RFR |

## 5 阶段流程

执行 `/crs:req <描述>` 后自动依次完成，每阶段结果**必须写入文件**：

| 阶段 | 产出 | 说明 |
|---|---|---|
| [1/5] 需求解析 | `meta.yaml`、`raw.md`、三套骨架文件 | 自动初始化项目、敏感信息检查、相似需求检测 |
| [2/5] 深度分析 | `spec/` 5 个子文件 | 背景、用户故事、设计、接口、决策 |
| [3/5] 优先级+质量 | 更新 `meta.yaml` | 业务价值 40% / 紧急 30% / 依赖 15% / 成本 10% / 风险 5% |
| [4/5] 测试策略 | `test-cases/` 3 个子文件 | 正向、异常、边界用例 |
| [5/5] 实施计划 | `plan/` 2 个子文件 | 任务分解 + 里程碑 |

**执行模式**：

- 默认（半自动）：走完 5 阶段，返回下一步建议
- `--quick`：只建骨架（阶段 1），适合小改动，后续可手动补充
- `--auto`：文档一次生成后自动开始实现
- `--conservative`：每阶段确认后继续

## 需求目录结构

```
.requirements/features/FEAT-20260908-001-abc/
├── meta.yaml              # 元数据（状态、优先级）
├── raw.md                 # 原始描述
├── spec.md                # 索引 → spec/（背景/故事/设计/接口/决策）
├── test-cases.md          # 索引 → test-cases/（正向/异常/边界）
├── plan.md                # 索引 → plan/（任务/里程碑）
├── .agent-context.md      # Agent 指引（系统生成）
└── execution.log          # 执行日志（Hook 自动记录）
```

需求状态生命周期：`planning → analyzed → implementing → review → done`

## Hooks 自动行为

| 时机 | 行为 |
|---|---|
| 会话启动 | 项目有活跃需求时，自动注入需求 ID 和状态提醒 |
| 每次编辑/写文件 | 记录 execution.log；planning/analyzed 阶段改外部代码会收到阶段违规警告 |
| 会话结束 | 自动同步索引表与 plan 进度，输出执行摘要 |

无需任何配置，装上插件即生效。

## 常见场景

### 小改动不想走全流程

```bash
/crs:req --quick 修复按钮颜色
```

只生成骨架，直接实现。适合 10 分钟内完成的改动。

### 实现中途要改需求

```bash
/crs:req-change FEAT-20260908-001-abc 调整为支持手机号登录
```

自动评估影响、更新 spec 与 plan、触发 Gate 4 变更检查。

### 排优先级

```bash
/crs:req-priority --list               # 全部需求按优先级排序
/crs:req-priority FEAT-20260908-001    # 重新评估单个需求
```

### 实现完成后验收

```bash
/crs:req-quality FEAT-20260908-001 --verify implementation
```

人工清单逐项确认；确认完把 meta.yaml 状态改为 done。

### 完成需求（复盘沉淀）

验收通过后，对 CRS 说"复盘 FEAT-20260908-001"（或关闭需求时它会主动引导）：

1. 生成 `retro.md`：估时 vs 实际、踩坑与解决、可复用结论
2. 提炼通用教训到 `.requirements/_system/lessons/`（带 tags）
3. 状态置为 done

**这就是 CRS 的成长机制**：以后创建相关需求时（阶段 1），系统会自动检索 lessons 里 tagged 的历史教训供参考——踩过的坑不会踩第二次。

### 查看整体进度

```bash
/crs:req --dashboard
node "$ZCODE_PLUGIN_ROOT/bin/crs-export.js" -o report.html   # HTML 报告
```

## 质量门禁

4 个检查点（`/crs:req-quality <id> --gate <N>`）：设计完成、测试策略完成、实施计划完成、变更完成。每关包含自动检查（占位符/矛盾/完整性）+ 手动确认项，≥80% 通过。详见命令文档。

## FAQ

**Q：旧项目没有 .requirements/ 目录，直接用吗？**
A：直接 `/crs:req`，首次创建需求时自动初始化目录结构。

**Q：骨架文件里有些阶段我不想填？**
A：用 `--quick`；或保留「待填充」状态，但阶段守卫会持续阻止改代码。

**Q：lessons 是什么？**
A：`.requirements/_system/lessons/<topic>.md`，每条是一个带 tags 的经验教训（来自需求复盘）。创建新需求时自动检索相关条目，让历史经验参与决策。

**Q：和其他 AI 编程工具共用一个项目？**
A：可以。`.requirements/` 是纯 Markdown + YAML，任何工具可读。

**Q：会话日志/对话记录在哪？**
A：CRS 本身只记录 execution.log（需求目录内）。会话记忆交给 ZCode 的记忆类插件处理，职责不重叠。
