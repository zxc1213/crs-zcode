---
description: 需求度量系统 - 收集、分析和展示项目指标，支持数据驱动的持续改进
---

# 需求度量命令

系统化地收集、分析和展示项目关键指标，为持续优化提供数据支持。

## 用法

```bash
/crs:metrics [选项]
```

## 选项

### 查看选项

- `--efficiency` : 显示效率指标
- `--quality` : 显示质量指标
- `--changes` : 显示变更指标
- `--value` : 显示价值指标
- `--all` : 显示所有指标（默认）

### 分析选项

- `--trend <指标>` : 显示指标趋势图
- `--compare <period>` : 对比不同时期的数据
- `--report <period>` : 生成报告（week/month）
- `--export <format>` : 导出数据（json/csv/markdown）

### 管理选项

- `--collect` : 手动触发数据收集
- `--reset` : 重置度量数据
- `--init` : 初始化度量系统

## 命令行为

### 查看所有指标

**显示所有维度的当前指标**：

```bash
/crs:metrics
```

**输出示例**：

```markdown
# 项目度量指标

## 效率指标 📊

- 需求交付周期: 2.3天 ⬇️ 30% (目标: 2.0天)
- 平均创建时间: 8.5分钟 ⬇️ 40%
- 平均实现时间: 1.8天 ⬇️ 25%
- 流程效率: 88% ⬆️ 15%

## 质量指标 ✅

- 返工率: 8% ⬇️ 60% (目标: <15%)
- 质量门禁通过率: 94% ⬆️ 8% (目标: >90%)
- Bug密度: 0.25/功能点 ⬇️ 50%
- 验证通过率: 97% ⬆️ 5%

## 变更指标 🔄

- 变更频率: 0.6次/需求 ⬇️ 45%
- 重大变更占比: 12% ⬇️ 50% (目标: <20%)
- 变更响应时间: 1.2小时 ⬇️ 55%
- 变更影响评估准确率: 90% ⬆️ 12%

## 价值指标 💎

- 需求完成率: 94% (目标: >90%)
- 优先级准确率: 85% ⬆️ 5% (目标: >80%)
- ROI达成率: 108% ⬆️ 10% (目标: >100%)
- 用户满意度: 4.3/5.0 ⬆️ 8% (目标: >4.0)

## 总体评估

✅ **优秀** - 所有指标均达到或超过目标
📈 **持续改善** - 相比上月平均提升 25%
```

### 查看特定维度

```bash
/crs:metrics --efficiency
/crs:metrics --quality
/crs:metrics --changes
/crs:metrics --value
```

### 趋势分析

```bash
# 查看特定指标的趋势
/crs:metrics --trend cycle_time
/crs:metrics --trend rework_rate
/crs:metrics --trend quality_gate_pass_rate
```

**输出示例**：

```markdown
# 需求交付周期趋势

## 最近8周数据
```

Week 1: ████████████████████ 3.3天
Week 2: ██████████████████ 2.8天
Week 3: ██████████████████ 2.6天
Week 4: █████████████████ 2.3天
Week 5: ████████████████ 2.1天
Week 6: ████████████████ 2.0天 ✓
Week 7: ███████████████ 1.9天 ✓
Week 8: ██████████████ 1.7天 ✓
目标: ████████ 2.0天

```

## 趋势分析
- **趋势**: ⬇️ 持续下降
- **改善幅度**: 48%
- **状态**: ✅ 已达标并保持
- **预测**: 按当前趋势，下周预计 1.6天
```

### 生成报告

```bash
# 生成周报
/crs:metrics --report week

# 生成月报
/crs:metrics --report month

# 生成自定义周期报告
/crs:metrics --report --from 2026-05-01 --to 2026-05-13
```

**周报示例**：

```markdown
# 需求度量周报 - Week 20 (2026-05-07 ~ 2026-05-13)

## 📊 核心指标

| 指标       | 当前值 | 上周  | 变化   | 目标  | 状态    |
| ---------- | ------ | ----- | ------ | ----- | ------- |
| 交付周期   | 2.3天  | 2.8天 | ⬇️ 18% | 2.0天 | ⚠️ 接近 |
| 返工率     | 8%     | 12%   | ⬇️ 33% | 15%   | ✅ 达标 |
| 质量通过率 | 94%    | 92%   | ⬆️ 2%  | 90%   | ✅ 达标 |
| 完成率     | 94%    | 90%   | ⬆️ 4%  | 90%   | ✅ 达标 |

## 🎯 本周亮点

- 交付周期持续改善，已接近目标
- 返工率降至个位数，质量显著提升
- 完成5个需求，无返工记录

## ⚠️ 改进建议

- 交付周期仍略高于目标，需进一步优化
- 建议关注 P2/P3 需求的资源分配

## 📈 下周目标

- 交付周期降至 2.0天以下
- 保持返工率在 10% 以下
- 完成率维持在 90% 以上
```

### 导出数据

```bash
# 导出为 JSON
/crs:metrics --export json
/crs:metrics --export metrics.json

# 导出为 CSV
/crs:metrics --export csv
/crs:metrics --export metrics.csv

# 导出为 Markdown
/crs:metrics --export markdown
/crs:metrics --export report.md
```

## 数据收集

### 自动收集

系统在以下时机自动收集数据：

```javascript
// 1. 需求创建时
onRequirementCreated(req) {
  record({
    timestamp: Date.now(),
    eventType: 'created',
    reqId: req.id,
    type: req.type,
    duration: req.creationTime
  });
}

// 2. 质量门禁检查时
onQualityGate(result) {
  record({
    timestamp: Date.now(),
    eventType: 'quality_gate',
    reqId: result.reqId,
    gate: result.gate,
    passed: result.passed,
    score: result.score
  });
}

// 3. 需求完成时
onRequirementCompleted(req) {
  record({
    timestamp: Date.now(),
    eventType: 'completed',
    reqId: req.id,
    cycleTime: Date.now() - req.createdAt,
    reworkCount: req.reworkCount,
    changeCount: req.changeCount
  });
}
```

### 手动收集

```bash
# 手动触发数据收集
/crs:metrics --collect

# 收集特定类型的数据
/crs:metrics --collect --type efficiency
/crs:metrics --collect --type quality
```

## 初始化度量系统

```bash
# 首次使用时初始化
/crs:metrics --init
```

**初始化内容**：

- 创建 `.requirements/crs:metrics/` 目录
- 创建 `data.yaml` 数据文件
- 创建 `reports/` 报告目录
- 创建 `config.json` 配置文件
- 设置默认目标和告警阈值

## 配置选项

### config.json 结构

```json
{
  "metrics": {
    "collection": {
      "enabled": true,
      "interval": "daily",
      "retentionDays": 90
    },
    "targets": {
      "cycle_time": 2.0,
      "rework_rate": 0.15,
      "quality_gate_pass_rate": 0.9,
      "user_satisfaction": 4.0,
      "completion_rate": 0.9
    },
    "alerts": {
      "enabled": true,
      "thresholds": {
        "cycle_time": { "warning": 2.5, "critical": 3.0 },
        "rework_rate": { "warning": 0.15, "critical": 0.2 }
      }
    },
    "reporting": {
      "frequency": "weekly",
      "autoGenerate": true,
      "includeCharts": true
    }
  }
}
```

## 告警功能

### 自动告警

当指标超过阈值时自动显示告警：

```markdown
# ⚠️ 告警通知

## 🚨 严重告警

**需求交付周期异常**

- 当前值: 3.5天
- 阈值: 3.0天
- 超出: 17%
- 建议: 立即分析原因，优化流程

## ⚠️ 警告

**返工率上升**

- 当前值: 18%
- 阈值: 15%
- 超出: 3%
- 建议: 检查质量门禁执行情况
```

### 告警配置

```bash
# 启用告警
/crs:metrics --alerts enable

# 禁用告警
/crs:metrics --alerts disable

# 设置告警阈值
/crs:metrics --alerts set cycle_time:3.0
```

## 集成说明

**数据来源**：

- `meta.yaml`: 需求元数据（创建时间、状态等）
- `req-quality`: 质量检查结果
- `req-verify`: 验证检查结果
- `req-change`: 变更记录

**相关命令**：

- `/req`: 创建需求时自动收集数据
- `/priority`: 查看优先级排序
- `/quality-gate`: 质量检查时记录数据

**输出**：

- 终端显示：格式化的指标数据
- 文件输出：JSON/CSV/Markdown 格式
- 图表：ASCII 趋势图

## 使用示例

### 场景1: 每日检查

```bash
# 每天早上检查指标
/crs:metrics

# 查看昨天的数据
/crs:metrics --yesterday

# 查看本周趋势
/crs:metrics --trend cycle_time
```

### 场景2: 周例会

```bash
# 生成周报
/crs:metrics --report week

# 导出为PPT
/crs:metrics --export markdown > weekly-report.md
```

### 场景3: 月度回顾

```bash
# 生成月报
/crs:metrics --report month

# 对比上月
/crs:metrics --compare last-month

# 生成图表
/crs:metrics --chart --all
```

### 场景4: 问题分析

```bash
# 发现返工率上升
/crs:metrics --trend rework_rate

# 分析原因
/crs:metrics --analyze --detail rework_rate

# 导出详细数据
/crs:metrics --export csv > detailed-metrics.csv
```

## 重要说明

**DO:**

- ✅ 定期查看指标，了解项目状态
- ✅ 关注趋势变化，及时发现问题
- ✅ 基于数据做决策，而不是凭感觉
- ✅ 分享度量报告，促进团队改进
- ✅ 定期审查和调整目标值

**DON'T:**

- ❌ 只关注单个指标，忽略整体
- ❌ 过度追求短期指标，牺牲长期质量
- ❌ 篡改数据，美化报表
- ❌ 忽视告警，直到问题严重
- ❌ 用数据指责团队，而是用来改进流程

---

## 文件结构

```
.requirements/
└── metrics/
    ├── config.json           # 配置文件
    ├── data.yaml             # 度量数据
    └── reports/              # 报告目录
        ├── week-20.md        # 周报
        ├── 2026-05.md        # 月报
        └── trends/           # 趋势图
            ├── cycle_time.png
            └── rework_rate.png
```

## 版本历史

v0.3.0 - 初始版本

- ✅ 基础度量功能
- ✅ 4维度16指标
- ✅ 趋势分析和报告生成
- ✅ 告警机制
- ✅ 数据导出
