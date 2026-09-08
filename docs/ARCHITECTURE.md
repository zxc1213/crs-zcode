# CRS 架构说明

面向维护者：模块分层、数据流、设计决策，以及与原版 crs-plugin 的差异。

## 分层模型

```
用户入口层      commands/（5 个命令，用户显式调用）
                 │
智能协作层      skills/（8 个 skill，LLM 按需读取的流程指令）
                 │
核心引擎层      scripts/（纯 Node ESM，平台无关）
                 │
自动守护层      hooks/（ZCode 生命周期钩子）
```

**关键解耦**：核心引擎不依赖任何 req-* skill，skills 只是给 LLM 的指令文档；引擎调度的 brainstorming / systematic-debugging / writing-plans 是 ZCode 通用 skills。因此调整 skills/commands 不影响引擎。

## 命令 → Skill 映射

| 命令 | 主 Skill | 职责 |
|---|---|---|
| `/crs:req` | `req` | 统一入口：意图路由、5 阶段编排 |
| （阶段 2 自动） | `req-brainstorm` | 深度分析方法论 |
| （阶段 3 自动） | `req-priority` | 优先级评估方法论 |
| `/crs:req-quality` | `req-quality` | 质量门禁 + 验收清单 |
| （阶段 4 自动） | `req-test-plan` | 测试策略方法论 |
| `/crs:req-change` | `req-change` | 变更管理流程 |
| `/crs:metrics` | `req-metrics` | 度量分析 |
| （各阶段引用） | `req-doc-format` | 文档结构规范（单一事实来源） |

## 核心引擎（scripts/）

| 模块 | 职责 |
|---|---|
| `requirement-manager/core/processor.js` | 需求创建/状态机/骨架文件生成/模板渲染 |
| `requirement-manager/core/scheduler.js` | 执行计划与 skill 调用链生成 |
| `requirement-manager/core/router.js` | 意图识别与路由 |
| `requirement-manager/features/` | 安全过滤（敏感信息）、相似度检测 |
| `requirement-manager/project-sync/` | 项目文档（changelog/结构）自动同步 |
| `requirement-manager/utils/plan-sync.js` | plan.md 进度与 meta.yaml 状态同步 |
| `knowledge-graph/` | Fuse.js 相似需求搜索 |
| `export/` | `.requirements/` → 单文件 HTML 报告 |
| `metrics/` | 度量收集与导出 |
| `sync-version.js` | package.json → 插件清单版本同步 |

依赖（运行时）：`chalk`、`cli-table3`、`fuse.js`、`js-yaml`。引擎不依赖任何平台 API，Node >= 18 可跑。

## Hooks（hooks/）

协议：stdin 读 JSON 事件 → stdout 写 `{hookSpecificOutput: {hookEventName, additionalContext}}`。脚本路径通过 `${ZCODE_PLUGIN_ROOT}` 解析（无需原版的 bootstrap 探测）。

| Hook | 脚本 | 行为 |
|---|---|---|
| SessionStart | `session-start.mjs` | 活跃需求存在时注入 ID/状态提醒 |
| PostToolUse (Edit/Write/Bash) | `post-tool-use.mjs` | 追加 execution.log + 阶段守卫警告 |
| Stop | `stop.mjs` | 调用 plan-sync 同步文档 + 输出执行摘要 |

**活跃需求判定**（`hooks/lib.mjs`）：扫描 `.requirements/*/*/meta.yaml`，取状态 ∈ {planning, analyzed, implementing, review} 中 created 最新的需求；兼容旧版 `ACTIVE` 符号链接。不依赖符号链接，Windows 原生可用。

## 数据流（创建需求）

```
/crs:req 添加登录功能
  → Processor.create()
      → init .requirements/（如需）
      → 相似度检测（knowledge-graph）→ 有相似则提示
      → 安全过滤（security）→ 敏感信息警告
      → 生成需求目录 + 骨架（templates/*.tpl）
  → 阶段 2-5 由 LLM 按 skill 指令执行，每阶段 Write 落盘
  → Hook 全程记录 execution.log、守卫阶段
  → Stop 时 plan-sync 收尾同步
```

## 与原版 crs-plugin 的差异

| 项 | 原版 | 本版 |
|---|---|---|
| 平台 | Claude/Codex/Cursor/Gemini/OpenCode 5 平台兼容层 | 仅 ZCode |
| hooks 引导 | 92 行 bootstrap 探测 + node -e 内联 | `${ZCODE_PLUGIN_ROOT}` |
| 活跃需求 | ACTIVE 符号链接（无代码创建，从未生效） | 扫描 meta.yaml |
| 执行日志 | PostToolUse 与 Stop 路径不一致（总结永远为空） | 统一写入需求目录 |
| 命令/skill | 13 命令 + 13 skill | **5 命令 + 8 skill**（req-verify 并入 req-quality；删除一次性迁移工具 req-migrate/req-unify；删除被自动机制接管的 req-init/req-update/req-manager/req-brainstorm/req-test-plan 命令入口） |
| 依赖 | chalk/js-yaml 未声明 | 补齐；fs-extra 移入 devDeps |
| 敏感路径 | .claude-context.md、.claude/logs | .agent-context.md、.crs/logs |
| 会话记录 | conversation-logger 默认挂载 | 保留代码，默认不挂载（与 ZCode 记忆类插件职责重叠） |
| 安全 | — | LLM 生成内容流经的文件操作全部有路径边界校验（basename/resolve+startsWith） |

## 测试

- `tests/core/` processor 状态机与骨架生成
- `tests/hooks/zcode-hooks.test.js` 活跃需求扫描/边界/兼容
- `tests/manifests/` 清单格式、版本同步、skills 结构（8 个）、legacy 引用清零
- `tests/project-sync/`、`tests/export/`、`tests/utils/` 引擎各模块

运行：`npm test`（350+ 用例）。
