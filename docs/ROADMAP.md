# CRS 演进路线图

> 原则：每个版本一个主题；每项改动有测试保护；体验优先于功能数量。
> 本文件由维护者更新，完成的条目移入 CHANGELOG。

## v1.1 引导与成长（当前）

**主题**：让新用户不用读文档就能用，让系统越用越懂项目。

- [x] `/crs:req` 引导模式：无参数时显示状态概览 + 推荐动作
- [x] 创建需求对话式类型确认（不再要求记 `--bug` 等选项）
- [x] 复盘机制：done 前引导生成 `retro.md`（估时/踩坑/可复用）
- [x] 经验沉淀：`.requirements/_system/lessons/` + 创建需求时自动检索
- [x] 死代码清理：删除 optimization/（~1300 行）、conversation-logger/、demo.js（零引用）

**验收**：新项目从 `/plugin install` 到第一个需求 done 全程无需查文档。

## v1.2 引擎重构

**主题**：让维护者 10 分钟看懂核心链路。

- [ ] `processor.js`（553 行）拆分为 `template-renderer` / `requirement-creator` / `status-machine` 三模块，职责单一
- [ ] `scheduler.js` + `skill-adapters/` 简化：移除 Claude 时代 adapter 遗产（brainstorming/debugging/research/code-explorer 五个 adapter 的调用方式是"生成提示词再由 LLM 执行"，改为 skills 直接编排，调度器只管阶段顺序）
- [ ] 项目级配置：`.requirements/_system/config.yaml` 覆盖默认行为（优先级权重、门禁阈值、骨架清单）
- [ ] `index.js`（469 行）门面瘦身：只保留 handle() 与查询，其余下沉
- [ ] 测试与重构同步移动，保持 350+ 全绿

**验收**：核心链路（create → 5 阶段 → done）任一环节，新维护者 10 分钟内定位到代码。

## v1.3 生态与反馈

**主题**：从"能用"到"好用"，建立用户反馈回路。

- [ ] `/crs:metrics` 增加"迭代视图"：按时间聚合吞吐量、返工率、估时准确度
- [ ] 复盘数据驱动：估时偏差自动回写优先级权重建议
- [ ] 跨项目 lessons 库（`~/.crs/lessons/`），可选共享
- [ ] HTML 报告增强：retro 洞察、lessons 列表、健康度趋势
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
