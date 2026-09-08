---
name: req-metrics
description: 需求度量体系 - 收集和分析项目指标，持续优化流程效率
---

# 需求度量体系

建立系统的度量体系，收集和分析项目关键指标，为持续优化提供数据支持。

## 度量维度

### 1. 效率指标

| 指标         | 说明                  | 计算方式                     | 目标    |
| ------------ | --------------------- | ---------------------------- | ------- |
| 需求交付周期 | 从创建到完成的时间    | completed_at - created_at    | ↓ 50%   |
| 平均创建时间 | 创建需求的耗时        | 调用 brainstorm-grill 的时间 | <10分钟 |
| 平均实现时间 | 从计划到完成的时间    | 实际开发时间                 | ↓ 30%   |
| 流程效率     | 实际工作时间 / 总时间 | 有效时间 / 总时间            | >80%    |

### 2. 质量指标

| 指标           | 说明              | 计算方式              | 目标 |
| -------------- | ----------------- | --------------------- | ---- |
| 返工率         | 返工的需求占比    | 返工需求数 / 总需求数 | <15% |
| 质量门禁通过率 | 首次通过率        | 首次通过数 / 总检查数 | >90% |
| Bug密度        | 单位功能点的Bug数 | Bug数 / 功能点数      | <0.5 |
| 验证通过率     | 验证检查通过率    | 通过项 / 总检查项     | >95% |

### 3. 变更指标

| 指标               | 说明             | 计算方式              | 目标   |
| ------------------ | ---------------- | --------------------- | ------ |
| 变更频率           | 需求变更次数     | 变更次数 / 需求数     | ↓ 40%  |
| 重大变更占比       | 重大变更的比例   | 重大变更数 / 总变更数 | <20%   |
| 变更响应时间       | 处理变更的耗时   | 变更处理时间          | <2小时 |
| 变更影响评估准确率 | 影响评估的准确性 | 准确评估数 / 总评估数 | >85%   |

### 4. 价值指标

| 指标         | 说明                   | 计算方式              | 目标     |
| ------------ | ---------------------- | --------------------- | -------- |
| 需求完成率   | 按时完成的比例         | 按时完成数 / 总需求数 | >90%     |
| 优先级准确率 | 优先级评估的准确度     | 准确评估数 / 总评估数 | >80%     |
| ROI达成率    | 实际ROI与预期的对比    | 实际ROI / 预期ROI     | >100%    |
| 用户满意度   | 用户对交付结果的满意度 | 满意度评分            | >4.0/5.0 |

## 数据收集

### 自动收集

```javascript
// 自动收集点
const collectionPoints = {
  // 需求创建
  onRequirementCreated: (req) => ({
    timestamp: Date.now(),
    eventType: 'created',
    reqId: req.id,
    type: req.type,
    mode: req.mode,
    duration: req.creationTime,
  }),

  // 质量门禁检查
  onQualityGate: (result) => ({
    timestamp: Date.now(),
    eventType: 'quality_gate',
    reqId: result.reqId,
    gate: result.gate,
    passed: result.passed,
    score: result.score,
    duration: result.duration,
  }),

  // 需求完成
  onRequirementCompleted: (req) => ({
    timestamp: Date.now(),
    eventType: 'completed',
    reqId: req.id,
    cycleTime: Date.now() - req.createdAt,
    reworkCount: req.reworkCount,
    changeCount: req.changeCount,
  }),
};
```

### 手动记录

```markdown
## 项目里程碑记录

### 2026-05-13

- 完成3个需求（REQ-001, REQ-002, REQ-003）
- 平均交付周期：2.5天
- 质量门禁通过率：93%
- 用户满意度：4.2/5.0

### 2026-05-14

- 处理2个变更（1个中等，1个重大）
- 变更响应时间：平均1.5小时
- 返工率：0%（本周无返工）
```

## 指标分析

### 趋势分析

```javascript
// 分析指标趋势
function analyzeTrend(metric, data) {
  const trend = calculateTrend(data); // 计算趋势线
  const forecast = forecastNext(data); // 预测下一个值
  const anomaly = detectAnomaly(data); // 检测异常

  return {
    current: data[data.length - 1],
    trend: trend, // 'up', 'down', 'stable'
    forecast: forecast,
    anomaly: anomaly,
    recommendation: getRecommendation(trend, anomaly),
  };
}
```

### 对比分析

```javascript
// 与历史数据对比
function compareToHistory(current, history) {
  return {
    better: current < history.average * 0.9, // 比历史好10%
    same: Math.abs(current - history.average) < history.std,
    worse: current > history.average * 1.1, // 比历史差10%
  };
}

// 与目标对比
function compareToTarget(current, target) {
  const ratio = current / target;
  return {
    achieved: ratio <= 1,
    gap: current - target,
    percentage: (ratio * 100).toFixed(1) + '%',
  };
}
```

## 度量报告

### 周报

```markdown
# 需求度量周报 - Week 20 (2026-05-07 ~ 2026-05-13)

## 效率指标

- 需求交付周期: 2.8天 ⬇️ 15% (上周: 3.3天)
- 平均创建时间: 8.5分钟 ⬇️ 30%
- 平均实现时间: 2.1天 ⬇️ 20%
- 流程效率: 85% ⬆️ 10%

## 质量指标

- 返工率: 12% ⬇️ 50% (目标: <15%)
- 质量门禁通过率: 93% ⬆️ 5% (目标: >90%)
- Bug密度: 0.3/功能点 ⬇️ 40%
- 验证通过率: 96% ⬆️ 3%

## 变更指标

- 变更频率: 0.8次/需求 ⬇️ 35%
- 重大变更占比: 15% (目标: <20%)
- 变更响应时间: 1.5小时 ⬇️ 40%
- 变更影响评估准确率: 88% ⬆️ 8%

## 价值指标

- 需求完成率: 92% (目标: >90%)
- 优先级准确率: 82% (目标: >80%)
- ROI达成率: 105% (目标: >100%)
- 用户满意度: 4.2/5.0 (目标: >4.0)

## 总结

✅ **整体表现优秀**：所有指标均达到或超过目标
🎯 **亮点**：流程效率提升10%，返工率降低50%
⚠️ **改进点**：优先级准确率略低，需要优化评估方法
```

### 月报

```markdown
# 需求度量月报 - 2026年5月

## 核心指标趋势

### 效率趋势
```

需求交付周期（天）
Week 1: ████████████████████ 3.3
Week 2: ██████████████████ 2.8
Week 3: ██████████████████ 2.6
Week 4: █████████████████ 2.3
目标: ████████ 2.0

趋势: ⬇️ 持续改善

```

### 质量趋势
```

返工率（%）
Week 1: ████████████████████████ 25%
Week 2: ████████████ 12%
Week 3: ████████ 8%
Week 4: ██████ 6%
目标: ████ 15%

趋势: ⬇️ 显著改善，已达标

```

## 关键发现

### 积极方面
1. **效率提升30%**：通过统一入口和智能路由
2. **质量稳定**：质量门禁通过率持续>90%
3. **变更可控**：重大变更占比从30%降至15%

### 改进空间
1. **优先级评估**：准确率82%，需优化评估模型
2. **需求完成率**：92%未达到95%的目标
3. **用户反馈响应**：用户反馈处理时间较长

### 行动建议
1. 优化 priority-estimator 评分模型
2. 加强需求评审，提高完成率
3. 建立用户反馈快速响应机制
```

## 使用方式

### 查看指标

```bash
# 查看所有指标
/metrics

# 查看特定指标
/metrics --efficiency
/metrics --quality
/metrics --changes
/metrics --value

# 查看趋势图
/metrics --trend cycle_time
/metrics --trend rework_rate

# 生成报告
/metrics --report week
/metrics --report month
```

### 导出数据

```bash
# 导出为CSV
/metrics --export metrics.csv

# 导出为JSON
/metrics --export metrics.json

# 导出为图表
/metrics --chart cycle_time
```

## 数据存储

### 指标数据结构

```yaml
# .requirements/metrics/data.yaml
metrics:
  cycle_time:
    - date: 2026-05-07
      value: 3.3
      req_id: REQ-001
    - date: 2026-05-08
      value: 2.8
      req_id: REQ-002

  rework_rate:
    - date: 2026-05-07
      value: 0.25
      total: 4
      reworked: 1

  quality_gate_pass_rate:
    - date: 2026-05-07
      gate: design
      passed: 3
      total: 4
      rate: 0.75
```

### 配置文件

```json
{
  "metrics": {
    "collection": {
      "enabled": true,
      "interval": "daily",
      "retention": "90days"
    },
    "targets": {
      "cycle_time": 2.0,
      "rework_rate": 0.15,
      "quality_gate_pass_rate": 0.9,
      "user_satisfaction": 4.0
    },
    "alerts": {
      "enabled": true,
      "thresholds": {
        "cycle_time": 3.0,
        "rework_rate": 0.2
      }
    }
  }
}
```

## 告警机制

### 自动告警

```javascript
// 当指标超过阈值时自动告警
const alerts = {
  // 效率告警
  cycleTime: {
    threshold: 3.0,
    operator: '>',
    message: '需求交付周期超过3天，需要关注',
  },

  // 质量告警
  reworkRate: {
    threshold: 0.2,
    operator: '>',
    message: '返工率超过20%，需要分析原因',
  },

  // 变更告警
  majorChangeRate: {
    threshold: 0.3,
    operator: '>',
    message: '重大变更占比超过30%，需要优化需求分析',
  },
};
```

## 持续改进

### PDCA循环

```markdown
## Plan（计划）

- 根据度量报告识别问题
- 设定改进目标
- 制定改进计划

## Do（执行）

- 实施改进措施
- 收集过程数据

## Check（检查）

- 分析改进效果
- 对比改进前后指标

## Act（处理）

- 标准化有效措施
- 继续优化无效措施
- 进入下一个PDCA循环
```

## 配置选项

```json
{
  "metrics": {
    "autoCollect": true,
    "retentionDays": 90,
    "reportFrequency": "weekly",
    "alerts": {
      "enabled": true,
      "channels": ["console", "file"]
    },
    "export": {
      "formats": ["json", "csv", "markdown"],
      "path": ".requirements/metrics/reports"
    }
  }
}
```

## 集成说明

**触发时机**：

- 需求创建时（记录创建时间）
- 质量门禁检查时（记录检查结果）
- 需求完成时（记录完成时间和指标）
- 定期生成报告（每周/每月）

**相关 skills**：

- `quality-gates`: 提供质量检查数据
- `priority-estimator`: 提供优先级评估数据
- `handle-req-change`: 记录变更数据

**输出**：

- 度量数据文件（JSON/YAML）
- 度量报告（Markdown）
- 趋势图表（可选）
- 告警通知（当指标异常时）
