# CRS 演进路线图

> 原则：每个版本一个主题；每项改动有测试保护；体验优先于功能数量。
> 本文件由维护者更新，完成的条目移入 CHANGELOG。

## v1.1 引导与成长

**主题**：让新用户不用读文档就能用，让系统越用越懂项目。

- [x] `/crs:req` 引导模式：无参数时显示状态概览 + 推荐动作
- [x] 创建需求对话式类型确认（不再要求记 `--bug` 等选项）
- [x] 复盘机制：done 前引导生成 `retro.md`（估时/踩坑/可复用）
- [x] 经验沉淀：`.requirements/_system/lessons/` + 创建需求时自动检索
- [x] 死代码清理：删除 optimization/（~1300 行）、conversation-logger/、demo.js（零引用）

**验收**：新项目从 `/plugin install` 到第一个需求 done 全程无需查文档。

## v1.2 文档体系与变更历史

**主题**：项目文档不再散乱——体系化生成、变更即同步、历史可总览。

- [x] 地基：`core/schema.js` 统一元数据口径（状态词表/日期字段/refactors 拼写），修复 dashboard、metrics、knowledge-graph 读取错字段的问题；移除 metrics 写死的 0.94 假数据；实现 `--status <id>` 遗留 TODO
- [x] 统一事件账本：`project/timeline.yaml`（append-only），需求创建/状态流转/变更/Bug 修复/设计变更/文档同步/复盘/经验沉淀全部入账；`/crs:req --history` 终端查看
- [x] 变更同步：项目文档聚合从"ID 存在即跳过"升级为区块替换语义（`crs:block` 标记），需求变更后旧条目被新内容替换；引擎 `change`/`event` 子命令 + `crs-project-sync --change`
- [x] 变更口径统一：需求内 CHANGELOG.md（详细）+ 引擎时间线（项目级）+ spec.md 变更历史表（仅文档自身修订），消除三处口径冲突
- [x] 双层纳管：`project/docs-map.yaml` 登记宿主项目文档（README/docs/），自动扫描注册 + 漂移检测（过期/未确认告警），done/变更流程提示同步
- [x] HTML 报告升级：历史时间线全量渲染（事件徽章）、成长档案（经验库 + 踩坑沉淀）、文档地图板块

**验收**：任一需求变更后，项目文档当日同步；`--history` 能回答"这个项目经历过什么"。

## v1.3 引擎重构（当前）

**主题**：让维护者 10 分钟看懂核心链路。

- [x] `processor.js`（600+ 行）拆分为 `template-renderer` / `requirement-creator` / `status-machine` 三模块，职责单一
- [x] `scheduler.js` + `skill-adapters/` 简化：移除 Claude 时代 adapter 遗产（brainstorming/debugging/research/code-explorer 五个 adapter 的调用方式是"生成提示词再由 LLM 执行"，改为 skills 直接编排，调度器只管阶段顺序）
- [x] 项目级配置：`.requirements/_system/config.yaml` 覆盖默认行为（优先级权重、门禁阈值、骨架清单、docs-map 扫描深度）
- [x] `index.js` 门面瘦身：只保留 handle() 与查询，其余下沉
- [x] 测试与重构同步移动，保持 330+ 全绿

**验收**：核心链路（create → 5 阶段 → done）任一环节，新维护者 10 分钟内定位到代码。

## v1.4 生态与反馈

**主题**：从"能用"到"好用"，建立用户反馈回路。

- [ ] `/crs:metrics` 增加"迭代视图"：按时间聚合吞吐量、返工率、估时准确度
- [ ] 复盘数据驱动：估时偏差自动回写优先级权重建议
- [ ] 跨项目 lessons 库（`~/.crs/lessons/`），可选共享
- [ ] HTML 报告健康度趋势（基于 metrics 数据）
- [ ] marketplace 用户反馈 issue 模板

**验收**：连续使用 2 个迭代后，仪表板能回答"这个项目哪里可以改进"。

## 长期方向（不承诺时间）

- 多项目聚合视图（组织级需求看板）
- 需求模板市场（常见场景的 spec/plan 预设）
- LLM 辅助估时（基于历史 retro 数据）

## 反模式（明确不做）

- ❌ 重新支持多平台 —— 单平台是本次移植的核心收益
- ❌ 命令数量超过 5 个 —— 新能力通过引导模式与 skills 协作提供
- ❌ 引入运行时配置 UI / 数据库 —— Markdown + YAML 是数据格式底线
- ❌ 引擎代写宿主项目文档内容 —— docs-map 只发现与提醒，内容更新由 LLM/用户完成
