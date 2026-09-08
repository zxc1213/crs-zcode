---
description: 更新 CRS 插件到最新版本
---

# 插件更新命令

更新 CRS 插件到最新版本。

## 用法

```bash
/crs:req-update
```

## 命令行为

CRS 作为 ZCode 插件安装，更新由 ZCode 插件机制统一管理：

1. 提示用户执行插件更新命令：

```bash
zcode plugin update crs
```

2. 更新完成后，运行版本一致性检查：

```bash
node "$ZCODE_PLUGIN_ROOT/scripts/sync-version.js"
```

3. 显示当前版本：

```bash
node "$ZCODE_PLUGIN_ROOT/bin/crs-project-init.js" --version
```

## 项目数据兼容性

插件更新不影响项目本地数据：

- `.requirements/` 目录完全由项目持有，更新插件不会触碰
- 新版本对旧数据目录向后兼容；如涉及结构变更，会在需求创建/查询时自动迁移

## 相关命令

- `/crs:req-init` — 重新初始化项目目录结构（幂等）
- `/crs:req --dashboard` — 查看需求仪表板
