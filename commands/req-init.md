---
description: 初始化 CRS 项目 - 创建目录结构和配置文件
---

# 需求管理系统初始化命令

初始化 CRS 项目，创建必要的目录结构和配置文件。

## 用法

```bash
/crs:req-init
```

## 命令行为

当用户执行此命令时，系统将自动：

### 1. 项目目录初始化

在当前项目创建以下目录结构：

```
.requirements/
├── features/              # 新功能需求
├── bugs/                  # Bug 修复
├── questions/             # 技术问题
├── adjustments/           # 需求调整
├── refactorings/          # 重构需求
├── metrics/               # 度量系统
│   ├── reports/           # 报告目录
│   ├── exports/           # 导出数据
│   └── trends/            # 趋势图
└── _system/               # 系统文件
    └── versions/          # 版本管理
```

### 2. 度量系统初始化

创建度量配置文件（如果不存在）：

**`.requirements/metrics/config.json`**

**`.requirements/metrics/data.json`**

## 输出示例

```markdown
🎯 CRS 项目初始化

📁 创建项目目录...
✓ .requirements/features
✓ .requirements/bugs
✓ .requirements/questions
✓ .requirements/adjustments
✓ .requirements/refactorings
✓ .requirements/metrics/reports
✓ .requirements/metrics/exports
✓ .requirements/metrics/trends
✓ .requirements/\_system/versions

📊 初始化度量系统...
✓ metrics/config.json
✓ metrics/data.json

✅ 项目初始化完成!

📊 CRS 已就绪

开始使用:
/crs:req 添加你的第一个需求
/crs:req --dashboard 查看仪表板
```

## 重要说明

**DO:**

- ✅ 在每个新项目首次使用时运行此命令
- ✅ 确保有足够的权限创建目录和文件
- ✅ 检查输出确认所有目录创建成功

**DON'T:**

- ❌ 在已初始化的项目中重复运行（已有目录会被跳过）
- ❌ 在非项目目录中运行

## 技术实现

此命令由 Agent 直接执行（创建目录与配置文件为纯文件操作）：

- 目录结构定义与 `/crs:req` 的阶段 1 一致，参考 `req-init` skill
- 度量配置模板见 `templates/` 目录

## 版本历史

v1.0.0 - ZCode 版初始版本

- ✅ 项目目录初始化
- ✅ 度量系统配置
- ✅ 移除全局安装步骤（ZCode 插件机制自动管理）
