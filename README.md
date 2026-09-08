# CRS for ZCode - 智能需求管理系统

CRS（ClaudeReqSys）的 **ZCode 插件版**，为 ZCode 提供从需求捕获到测试完成的全流程管理能力。一个入口命令 `/crs:req` 完成需求创建、深度分析、优先级评估、测试策略、实施计划的全流程，阶段守卫 Hook 保证先文档后代码。

## 安装

本仓库同时是插件市场（单仓库模式）：

```bash
# 1. 添加 Marketplace
/plugin marketplace add zxc1213/crs-zcode

# 2. 安装插件
/plugin install crs@crs-zcode
```

## 快速上手

```bash
# 创建需求（自动走完 5 阶段文档流程）
/crs:req 添加用户登录功能

# 常用变体
/crs:req --bug 登录页面崩溃          # Bug 修复
/crs:req --quick 修复登录样式        # 快速模式（只建骨架，跳过深度分析）

# 查询
/crs:req --list                      # 所有需求
/crs:req --active                    # 当前活跃需求
/crs:req --dashboard                 # 仪表板
```

创建完成后直接说"开始实现"，按 plan.md 执行即可；实现完成跑 `/crs:req-quality <需求ID> --verify implementation` 做验收。

## 命令（5 个）

| 命令 | 用途 |
|---|---|
| `/crs:req` | **主入口**：创建需求、查询、仪表板，自动路由 5 阶段流程 |
| `/crs:req-quality` | 质量门禁（`--gate 1-4`）+ 人工验收清单（`--verify`） |
| `/crs:req-priority` | 优先级评估与全量排序（`--list`） |
| `/crs:req-change` | 执行中的需求变更管理 |
| `/crs:metrics` | 需求度量分析 |

> 深度分析、测试策略、文档格式等能力作为 skills 自动协作，无需手动调用。

## 核心机制

- **5 阶段文档流程**：需求解析 → 深度分析（spec/）→ 优先级+质量 → 测试策略（test-cases/）→ 实施计划（plan/），每阶段落盘
- **阶段守卫 Hook**：需求还在 planning/analyzed 时编辑项目代码，自动注入违规警告
- **会话上下文**：SessionStart 自动报告活跃需求；Stop 自动同步文档状态并输出执行摘要
- **知识图谱**：创建前自动检测相似需求，避免重复
- **HTML 报告**：`node "$ZCODE_PLUGIN_ROOT/bin/crs-export.js" -o report.html` 一键导出

## 文档

- [用户指南](docs/USER_GUIDE.md) — 5 阶段流程详解、需求类型、数据目录、常见场景
- [架构说明](docs/ARCHITECTURE.md) — 模块分层、数据流、与原版（crs-plugin）的差异

## 开发

```bash
npm install
npm test          # mocha 全量测试
npm run lint      # eslint
npm run sync-version  # 版本号同步到插件清单
```

要求 Node.js >= 18。

## 许可证

MIT License - 详见 [LICENSE](LICENSE)
