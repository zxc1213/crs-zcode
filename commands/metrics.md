---
description: 需求度量系统 - 收集、分析和展示项目指标，支持数据驱动的持续改进
---

# 需求度量命令

系统化收集、分析、展示项目关键指标，为持续优化提供数据支持。

## 用法与选项

```bash
/crs:metrics [选项]
```

| 选项组 | 选项 | 说明 |
| --- | --- | --- |
| 查看 | `--efficiency` `--quality` `--changes` `--value` `--all`（默认） | 四维度指标 |
| 分析 | `--trend <指标>` `--compare <period>` `--report <week\|month>` `--export <json\|csv\|markdown>` | 趋势/对比/报告/导出 |
| 管理 | `--collect` `--reset` `--init` | 手动收集 / 重置 / 初始化 |

四维度核心指标：效率（交付周期、平均创建/实现时间）、质量（返工率、门禁通过率）、变更（频率、重大变更占比）、价值（完成率、优先级准确率）。各指标含当前值、趋势箭头、目标线。

数据来源：`meta.yaml`（创建时间/状态）、`req-quality`（门禁与验收结果）、`req-change`（变更记录）。创建、门禁检查、完成三个时机自动收集。

## 初始化与配置

`/crs:metrics --init` 创建 `.requirements/metrics/`（`data.yaml` + `reports/` + `config.json`）。

`config.json` 可配置采集开关、目标值（`targets`）、告警阈值（`alerts.thresholds`，warning/critical 两级）。指标超阈值时在报告中输出告警：当前值/阈值/超出幅度/建议。

## 重要说明

**DO:**
- ✅ 定期查看指标，关注趋势而非单点
- ✅ 基于数据做决策；定期审查目标值
- ✅ 分享度量报告，促进流程改进

**DON'T:**
- ❌ 只看单一指标 / 过度追求短期指标
- ❌ 篡改数据美化报表
- ❌ 忽视告警；用数据指责人（度量是为了改进流程）

## 参考

- 完整输出示例（四维度报告 / 趋势图 / 周报 / 告警格式）与 config.json 结构：见 `docs/examples/metrics.md`（按需 Read，不常驻上下文）
- 相关命令：`/crs:req`（创建时自动采集）、`/crs:req-quality`（门禁数据）
