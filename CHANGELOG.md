# Changelog

本文件记录 CRS ZCode 插件每个版本的变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循语义化。

## [1.3.0] - 2026-09-09

**主题：引擎重构——让维护者 10 分钟看懂核心链路。**

### 新增

- **项目级配置** `.requirements/_system/config.yaml`（`core/config.js` 加载，缺失/损坏自动回退默认）：覆盖优先级权重（`priority.weights`）、质量门禁阈值（`quality.gate_threshold`）、需求骨架清单（`skeleton`）、docs-map 扫描深度（`docs_map.max_depth`）；`req-priority`/`req-quality` skill 文档注明配置覆盖口径
- 自定义骨架条目支持项目模板目录（`.requirements/_system/templates/`），无模板时写入最小骨架
- 新增测试：配置加载/合并/降级/缓存（8 例）、骨架自定义与路径穿越拒绝、时间线埋点归位验证（7 例），合计 345 用例全绿

### 变更

- `core/processor.js`（578 行）拆分：`template-renderer`（模板加载与渲染）/ `requirement-creator`（创建落盘与副作用）/ `status-machine`（状态流转与埋点）三模块；processor 保留门面（解析/路径/查询/删除/索引）
- `core/scheduler.js`（554 行）瘦身至 298 行：删除"生成提示词再由 LLM 执行"的旧模式（5 套硬编码提示词模板、executeSkill、健康检查、降级机制），调度器只管执行模式与阶段顺序；skill 由宿主 skills 体系直接编排
- `core/router.js` 移除 fallback 死配置；`index.js` 门面瘦身（671 → 444 行）：创建流下沉 `core/creation-flow.js`，变更/事件下沉 `core/change-events.js`
- 骨架渲染路径安全强化：条目白名单 + 根目录边界双校验（清单可能来自项目配置）

### 移除

- `skill-adapters/`（6 文件）与 `core/skill-interface.js`（合计约 1100 行）：生产代码零引用的死代码，仅自持测试引用

## [1.2.0] - 2026-09-09

**主题：文档体系与变更历史——项目文档不再散乱。**

### 新增

- **统一事件账本** `project/timeline.yaml`：需求创建/状态流转/变更/Bug 修复/设计变更/文档同步/复盘/经验沉淀全部入账（append-only，读取容错）；`/crs:req --history [N]` 终端查看项目历史
- **需求变更同步**：引擎 `change` 子命令与 `crs-project-sync --change <level> --reason`，需求变更后已聚合进项目文档的旧条目被替换更新（`crs:block` 区块标记），旧格式自动原位迁移
- **宿主项目文档纳管**（双层纳管外层）：`project/docs-map.yaml` 自动扫描登记 README/docs/（`--scan-docs`），角色猜测 + 漂移检测（过期/未确认告警，`--doc-reviewed` 标记复核），仪表板与 HTML 报告展示
- **HTML 报告**：历史时间线全量渲染（彩色事件徽章）、成长档案板块（经验库 + 踩坑沉淀）、文档地图板块
- `--status <id>` 单需求状态查询（原为遗留 TODO）
- `core/schema.js` 唯一口径源：状态词表、日期字段、类型目录、事件类型、事件标签

### 修复

- dashboard/metrics/knowledge-graph 读取字段与实际写入不一致（状态 3 套词表、日期 3 套字段、refactors/refactorings 拼写分叉），现统一从 schema 读取并兼容旧口径
- metrics 移除写死的 0.94 质量门禁假数据与永远 100% 的优先级准确率；返工率改基于 CHANGELOG 真实变更记录，新增优先级覆盖度
- `processor.update()` 状态置 done 时引擎自动补写 `completed` 日期（原先依赖 LLM 自觉）
- 变更记录口径冲突（skill 写 CHANGELOG.md vs 命令文档写 spec.md 变更表）：统一为三层口径（文档自身修订 / 需求 CHANGELOG.md / 引擎时间线）
- `req-priority` 示例键名与 `req-doc-format` 不一致（`priority` 对象 vs `priority_detail`）；`req-test-plan` 遗留的 `test-plan.md` 输出路径改为 `test-cases.md` + `test-cases/`

### 变更

- ROADMAP 重排：原 v1.2 引擎重构顺延为 v1.3，原 v1.3 生态与反馈顺延为 v1.4（其中 HTML 报告增强已吸收进 v1.2）

## [1.0.1] - 2026-09-09

**主题：ZCode 移植版首发 + 引导与成长。**

- 从 Claude Code 版（crs-plugin）单平台化移植：`.zcode-plugin/plugin.json` 清单 + 3 hooks + `/crs:req-*` 命名空间 + 引擎原样复用；LLM 生成内容流经的文件操作全部加路径边界校验
- 修复原版隐藏 bug：`.requirements/ACTIVE` 符号链接从未创建（阶段守卫死功能，改为扫描 meta.yaml）；PostToolUse 与 Stop 的 execution.log 路径不一致
- `/crs:req` 引导模式（无参数 → 状态概览 + 推荐动作）；done 前复盘引导（retro.md）与经验沉淀（`_system/lessons/`，创建需求时自动检索）
- 死代码清理：optimization/（~1300 行）、conversation-logger/、demo.js
- 单仓库双角色 marketplace 模式（marketplace.json `source: "."`）
