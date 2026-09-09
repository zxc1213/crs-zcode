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

**不知道从哪开始？直接运行 `/crs:req`（不带参数）**——显示项目状态和推荐动作，跟着走即可。

```bash
# 创建需求（系统自动识别类型并与你确认，无需记选项）
/crs:req 添加用户登录功能

# 常用变体
/crs:req --bug 登录页面崩溃          # 显式指定类型
/crs:req --quick 修复登录样式        # 快速模式（只建骨架，跳过深度分析）

# 查询
/crs:req --list                      # 所有需求
/crs:req --dashboard                 # 仪表板（含文档地图告警）
/crs:req --status FEAT-20260908-001  # 单需求详情
/crs:req --history 20                # 项目历史时间线（最近 20 条事件）
```

创建完成后直接说"开始实现"；实现完成说"复盘 <需求ID>"沉淀经验并关闭。

## 成长机制

每次需求复盘（`retro.md`）中提炼的经验会沉淀到 `.requirements/_system/lessons/`；之后创建相关需求时自动检索注入——项目越用越懂自己。详见[用户指南](docs/USER_GUIDE.md)。

## 文档体系与历史（v1.2）

- **体系化项目文档**：`.requirements/project/` 聚合业务/功能/设计/结构 4 份文档 + 变更日志，需求 done 与变更时自动同步（变更走区块替换，旧内容不会滞留）
- **统一事件账本**：`project/timeline.yaml` 记录全部历史（创建/流转/变更/修复/复盘/经验），`/crs:req --history` 或 HTML 报告查看完整时间线
- **双层纳管**：`project/docs-map.yaml` 登记宿主项目自己的 README/docs/ 文档，漂移检测提醒过期；`crs-project-sync --scan-docs` 自动登记

## 项目级配置（v1.3）

创建 `.requirements/_system/config.yaml` 可覆盖默认行为（缺失或损坏时回退默认，不影响使用）：

```yaml
priority:
  weights: { business_value: 40, urgency: 30, dependencies: 15, effort: 10, risk: 5 }  # 优先级评估权重
quality:
  gate_threshold: 80        # 质量门禁阈值（%）
skeleton:                    # 需求骨架清单（条目优先用 _system/templates/ 下的项目模板）
  root: [spec.md, plan.md, test-cases.md]
  subdirs:
    spec: [background.md, user-stories.md, design.md, api.md, decisions.md]
    plan: [tasks.md, milestones.md]
    test-cases: [positive.md, negative.md, boundary.md]
docs_map:
  max_depth: 3              # 宿主 docs/ 目录扫描深度
```

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
- **HTML 报告**：`node "$ZCODE_PLUGIN_ROOT/bin/crs-export.js" -o report.html` 一键导出（含历史时间线、成长档案、文档地图）

## 文档

- **[📖 图形化帮助手册](docs/manual.html)** — 单文件 HTML，浏览器直接打开：导航/搜索/深色模式，新手推荐从这里开始
- [用户指南](docs/USER_GUIDE.md) — 5 阶段流程详解、需求类型、数据目录、常见场景、复盘沉淀
- [架构说明](docs/ARCHITECTURE.md) — 模块分层、数据流、成长机制、与原版（crs-plugin）的差异
- [演进路线图](docs/ROADMAP.md) — v1.1 引导与成长 → v1.2 文档体系与变更历史 → v1.3 引擎重构 → v1.4 生态与反馈

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
