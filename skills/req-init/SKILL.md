---
name: req-init
description: CRS 初始化配置 - 一次性设置，配置问题追踪系统、标签体系和文档存储位置
---

# CRS 初始化配置

欢迎使用 CRS 智能需求管理系统！

本技能将引导你完成一次性初始化配置，确保系统与你的工作流程完美集成。

## 配置步骤

### 1. 问题追踪系统选择

请选择你使用的问题追踪系统：

**选项 A：GitHub Issues**

- 适合：开源项目、团队协作项目
- 需要：GitHub 仓库、Personal Access Token

**选项 B：本地文件系统**

- 适合：个人项目、快速原型、本地开发
- 优点：无需外部依赖，完全本地化

**选项 C：Linear**

- 适合：使用 Linear 的专业团队
- 需要：Linear API Key

> 请告诉我你的选择，我会相应配置系统。

### 2. 需求标签体系

配置需求分类标签，用于 `/triage` 和优先级排序：

**推荐标签**：

- `feature` - 新功能
- `bug` - 缺陷修复
- `enhancement` - 功能增强
- `refactor` - 代码重构
- `docs` - 文档更新
- `test` - 测试相关
- `performance` - 性能优化

**优先级标签**（可选）：

- `priority:critical` - 紧急重要
- `priority:high` - 重要不紧急
- `priority:medium` - 一般
- `priority:low` - 可选

> 你可以使用推荐标签，或自定义你的标签体系。

### 3. 文档存储位置

配置项目文档的存储路径：

**默认配置**：

- 需求规格：`.requirements/features/`
- 缺陷跟踪：`.requirements/bugs/`
- 问题记录：`.requirements/questions/`
- 需求变更：`.requirements/adjustments/`
- 分析报告：`.requirements/analysis/`
- 用户指南：`.requirements/guides/`

> 你可以接受默认配置，或指定自定义路径。

### 4. 自动化 Hooks（可选）

配置自动化功能，需要在每次会话结束后自动：

- **需求记录更新**：跟踪需求变更历史
- **执行总结生成**：生成工作总结报告
- **度量数据收集**：更新项目指标

> 这些功能由本插件的 hooks 自动提供（SessionStart / PostToolUse / Stop），无需额外配置。

### 5. 项目级文档自动初始化（v0.11.0+）

完成基础目录创建后，系统会自动生成 `.requirements/project/` 目录，包含 4 份核心文档：

| 文档 | 用途 |
|---|---|
| `project-structure.md` | 项目结构、模块划分、依赖关系（基于实际代码扫描） |
| `business-requirements.md` | 业务目标、用户角色、业务需求清单 |
| `functional-requirements.md` | 功能矩阵（按模块归类，含已完成功能详情） |
| `functional-design.md` | 系统架构、组件、数据流（聚合各需求 spec/design.md） |
| `changelog.md` | 变更历史（只追加不删除，自动维护） |
| `meta.yaml` | 项目元数据 + 同步日志 |

**触发时机**：
- 首次执行 `/req-init` 时自动初始化
- 每次需求状态变为 `done` 时自动同步
- Bug 修复涉及设计变更（`spec/decisions.md` frontmatter `design_change: true`）时自动同步

**手动操作**：
```bash
crs-project-init          # 初始化或修复 project 目录
crs-project-init --force  # 强制重建（保留 changelog）
crs-project-sync --full   # 全量重生成
crs-project-sync --req-id FEAT-20260613-001-xxx  # 同步指定需求
```

> 关闭同步：设置环境变量 `CRS_PROJECT_SYNC=off`

## 配置完成

完成配置后，系统将：

1. ✅ 创建必要的目录结构
2. ✅ 生成配置文件（如需要）
3. ✅ 注册插件 skills（随 ZCode 插件安装自动完成）
4. ✅ 初始化度量系统
5. ✅ 生成 `.requirements/project/` 项目级文档

## 开始使用

配置完成后，你可以：

- `/req` - 添加你的第一个需求
- `/priority --list` - 查看优先级排序
- `/metrics` - 查看项目指标
- `/crs:req --dashboard` - 查看仪表板

## 需要帮助？

- 用户指南：`.requirements/guides/user-guide.md`
- 系统架构：`.requirements/analysis/optimization-report.md`
