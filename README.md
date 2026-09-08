# CRS for ZCode - 智能需求管理系统

CRS（ClaudeReqSys）的 **ZCode 插件版**，从 [zxc1213/crs-plugin](https://github.com/zxc1213/crs-plugin) 重构移植而来，为 ZCode 提供从需求捕获到测试完成的全流程管理能力。

## 核心特性

- **5 阶段强制文档流程**：需求解析 → 深度分析 → 优先级/质量 → 测试策略 → 实施计划，每阶段落盘检查
- **阶段守卫 Hook**：需求仍在 planning/analyzed 时编辑项目代码，自动注入违规警告
- **会话上下文注入**：SessionStart 时自动报告当前活跃需求及状态
- **会话总结**：Stop 时同步需求文档状态（索引表 + plan 进度），输出执行摘要
- **向量知识图谱**：基于 Fuse.js 的相似需求检测与智能推荐
- **HTML 报告导出**：`.requirements/` 一键聚合为单文件 HTML（状态分布、依赖图、时间线）
- **质量门禁**：4 个关键阶段自动检查，确保交付质量
- **安全过滤**：敏感信息（密钥/密码/IP）自动检测与脱敏建议

## 安装

### Marketplace 安装（推荐）

本仓库同时是插件市场（单仓库模式，仓库根 `marketplace.json` 的 `source: "."` 指向自身）：

```bash
# 1. 添加 Marketplace
/plugin marketplace add zxc1213/crs-zcode

# 2. 安装插件
/plugin install crs@crs-zcode
```

### 本地开发安装

```bash
git clone https://github.com/zxc1213/crs-zcode.git
cd crs-zcode
npm install
```

然后在 ZCode 中以本地路径安装该插件目录。

## 使用

### 主命令

```bash
/crs:req 添加用户登录功能          # 创建新功能（默认深度分析）
/crs:req --bug 登录页面异常        # Bug 报告
/crs:req --quick 修复登录样式      # 快速模式（跳过深度分析）
/crs:req --list                   # 列出所有需求
/crs:req --active                 # 当前活跃需求
/crs:req --dashboard              # 需求仪表板
```

### 全部命令

| 命令 | 说明 |
|---|---|
| `/crs:req` | 主入口：创建/查询需求，智能路由 |
| `/crs:req-init` | 项目初始化（首次使用，通常自动触发） |
| `/crs:req-priority` | 优先级科学评估 |
| `/crs:req-quality` | 质量门禁检查 |
| `/crs:req-test-plan` | 测试策略生成 |
| `/crs:req-verify` | 需求验证 |
| `/crs:req-brainstorm` | 深度需求分析 |
| `/crs:req-change` | 变更管理 |
| `/crs:req-migrate` | 需求迁移 |
| `/crs:req-unify` | 文档结构统一 |
| `/crs:req-metrics` | 度量分析 |
| `/crs:req-update` | 插件更新 |
| `/crs:metrics` | 度量命令 |

### CLI 工具（Bash 中执行）

```bash
node "$ZCODE_PLUGIN_ROOT/bin/kg-cli.js" search "用户登录" 10   # 相似需求搜索
node "$ZCODE_PLUGIN_ROOT/bin/kg-cli.js" stats                  # 知识图谱统计
node "$ZCODE_PLUGIN_ROOT/bin/crs-export.js" -o report.html     # HTML 报告导出
```

## Hooks

插件自动挂载 3 个 ZCode hooks（`hooks/hooks.json`）：

| 事件 | 脚本 | 行为 |
|---|---|---|
| SessionStart | `hooks/session-start.mjs` | 注入活跃需求 ID/状态提醒 |
| PostToolUse (Edit/Write/Bash) | `hooks/post-tool-use.mjs` | 记录 execution.log + 阶段守卫警告 |
| Stop | `hooks/stop.mjs` | 同步需求文档状态 + 会话执行总结 |

活跃需求判定：扫描 `.requirements/**/meta.yaml` 中状态为 `planning/analyzed/implementing/review` 的最新需求（兼容旧版 ACTIVE 符号链接），无需符号链接，Windows/macOS/Linux 均可用。

## 项目数据

需求数据存储在项目本地 `.requirements/` 目录：

```
your-project/
└── .requirements/
    ├── features/FEAT-YYYYMMDD-XXX-xxx/
    │   ├── meta.yaml          # 元数据（状态/优先级）
    │   ├── raw.md             # 原始描述
    │   ├── spec.md + spec/    # 设计文档（5 个子文件）
    │   ├── test-cases.md + test-cases/   # 测试用例（3 个子文件）
    │   ├── plan.md + plan/    # 实施计划（2 个子文件）
    │   └── execution.log      # 执行日志（hook 自动记录）
    ├── bugs/
    ├── questions/
    ├── adjustments/
    └── refactorings/
```

## 相对原版（crs-plugin）的调整

1. **单平台化**：移除 Claude Code/Codex/Cursor/Gemini/OpenCode 五平台兼容层（5 套 manifest、5 套 README/INSTALL），只保留 ZCode
2. **Hooks 重写**：用 `${ZCODE_PLUGIN_ROOT}` 替代原 92 行 bootstrap 探测脚本；hook 输出改用 `hookSpecificOutput.additionalContext` 协议
3. **修复活跃需求死链**：原版阶段守卫依赖从未被创建的 `ACTIVE` 符号链接（功能实际未生效）；新版扫描 meta.yaml，真正可用
4. **修复执行日志路径分裂**：原版 PostToolUse 写 `.requirements/execution.log` 而 Stop 读需求目录内日志，两者不一致导致总结永远为空；新版统一写入活跃需求目录
5. **依赖修复**：补声明 `chalk`、`js-yaml`（原版使用但未声明）；移除未使用的运行时依赖
6. **精简 bin**：移除 npm 全局安装时代的 14 个包装脚本，保留 4 个跨平台工具（kg-cli、crs-export、crs-project-init、crs-project-sync）
7. **路径中立**：`.claude-context.md` → `.agent-context.md`，日志 `.claude/logs/` → `.crs/logs/`
8. **移除 conversation-logger 默认挂载**：会话记录功能与 ZCode 记忆类插件职责重叠，代码保留在 `scripts/conversation-logger/`，需要时可手动挂载

## 开发

```bash
npm install
npm test          # mocha 全量测试
npm run lint      # eslint
npm run format    # prettier
npm run sync-version  # package.json → .zcode-plugin/plugin.json 版本同步
```

要求 Node.js >= 18。

## 许可证

MIT License - 详见 [LICENSE](LICENSE)
