---
name: req-priority
description: 需求优先级科学评估 - 基于业务价值、紧急程度、依赖关系和ROI进行多维度评分
---

# 需求优先级评估

对需求进行科学的多维度评估，帮助团队合理排定优先级，优化资源分配，最大化业务价值。

## 评估维度

### 1. 业务价值 (Business Value) - 权重 40%

评估需求对业务的贡献程度。

**评分标准**：
| 分数 | 标准 | 示例 |
|------|------|------|
| 10 | 核心业务功能，直接影响收入 | 支付系统、购物车 |
| 8 | 重要功能，显著提升用户体验 | 用户搜索、消息通知 |
| 6 | 有价值功能，提升部分体验 | 个人资料编辑 |
| 4 | 改进性功能，优化现有流程 | 性能优化、UI改进 |
| 2 | 可选功能，锦上添花 | 主题切换、动画效果 |

### 2. 紧急程度 (Urgency) - 权重 30%

评估需求的时间敏感性。

**评分标准**：
| 分数 | 标准 | 示例 |
|------|------|------|
| 10 | 阻塞性问题，系统无法使用 | 崩溃、登录失败 |
| 8 | 紧急修复，影响核心功能 | 数据丢失、安全漏洞 |
| 6 | 重要但非阻塞，影响用户体验 | 加载缓慢、样式错乱 |
| 4 | 一般问题，可以延后 | 文案错误、小bug |
| 2 | 低优先级，长期优化 | 代码重构、技术债 |

### 3. 依赖关系 (Dependencies) - 权重 15%

评估需求的前置依赖和对其他需求的影响。

**评分标准**：
| 分数 | 标准 |
|------|------|
| 10 | 多个高优先级需求依赖此需求 |
| 8 | 是1-2个重要需求的前置条件 |
| 6 | 有一些依赖关系，但不关键 |
| 4 | 依赖关系较少 |
| 2 | 无依赖或被依赖 |

### 4. 实现成本 (Effort) - 权重 10%

评估需求的工作量和技术难度。

**评分标准**：
| 分数 | 标准 | 预估时间 |
|------|------|----------|
| 10 | 非常简单，快速实现 | <1天 |
| 8 | 简单，工作量小 | 1-2天 |
| 6 | 中等难度，需要规划 | 3-5天 |
| 4 | 复杂，需要多团队协作 | 1-2周 |
| 2 | 非常复杂，高风险 | >2周 |

### 5. 风险评估 (Risk) - 权重 5%

评估需求的技术风险和不确定性。

**评分标准**：
| 分数 | 标准 |
|------|------|
| 10 | 低风险，技术成熟 |
| 8 | 较低风险，有类似经验 |
| 6 | 中等风险，需要验证 |
| 4 | 较高风险，不确定性大 |
| 2 | 极高风险，技术探索 |

## 优先级计算公式

```javascript
PriorityScore =
  BusinessValue * 0.4 + Urgency * 0.3 + Dependencies * 0.15 + Effort * 0.1 + Risk * 0.05;

PriorityLevel =
  Score >= 8
    ? 'P0' // 立即处理
    : Score >= 6
      ? 'P1' // 高优先级
      : Score >= 4
        ? 'P2' // 中优先级
        : Score >= 2
          ? 'P3' // 低优先级
          : 'P4'; // 可选
```

## 使用方式

### 自动评估

```bash
# 创建需求时自动评估
/crs:req 添加用户登录功能
  ↓
brainstorm-grill 分析
  ↓
priority-estimator 自动评估
  ↓
在 meta.yaml 中添加优先级信息
```

### 手动评估

```bash
# 评估单个需求
/priority REQ-20260513-001

# 评估所有需求并排序
/priority --list

# 比较两个需求
/priority --compare REQ-001 REQ-002
```

## 评估输出

### meta.yaml 添加优先级信息

```yaml
id: REQ-20260513-001
type: feature
title: 用户登录功能
priority:
  level: P0
  score: 8.6
  breakdown:
    business_value: 9
    urgency: 8
    dependencies: 8
    effort: 8
    risk: 9
  rationale: '核心业务功能，多模块依赖，技术成熟'
  estimated_effort: '2-3天'
  roi: '高' # 基于 business_value / effort
```

### 优先级排序报告

```markdown
# 需求优先级排序报告

## P0 - 立即处理 (Score >= 8)

1. **REQ-20260513-001** (Score: 8.6) - 用户登录功能
   - 业务价值: 9 | 紧急程度: 8 | 依赖: 8 | 成本: 8 | 风险: 9
   - 理由: 核心业务功能，多模块依赖

2. **REQ-20260513-003** (Score: 8.2) - 支付系统
   - 业务价值: 10 | 紧急程度: 8 | 依赖: 6 | 成本: 6 | 风险: 7
   - 理由: 直接影响收入

## P1 - 高优先级 (6 <= Score < 8)

1. **REQ-20260513-002** (Score: 7.4) - 用户搜索功能
   - 业务价值: 8 | 紧急程度: 6 | 依赖: 7 | 成本: 7 | 风险: 8
   - 理由: 显著提升用户体验
```

## 评估算法

### 依赖关系分析

```javascript
async function analyzeDependencies(reqId, allReqs) {
  const req = await loadRequirement(reqId);
  const dependencies = [];

  // 检查此需求是否是其他需求的前置条件
  for (const other of allReqs) {
    if (other.dependencies.includes(reqId)) {
      dependencies.push({
        id: other.id,
        priority: other.priority.level,
      });
    }
  }

  // 计算依赖分数
  const highPriorityDeps = dependencies.filter((d) => ['P0', 'P1'].includes(d.priority)).length;

  return Math.min(10, highPriorityDeps * 2 + 2);
}
```

### ROI 估算

```javascript
function calculateROI(businessValue, effort) {
  // 简化 ROI 计算
  const valueMap = { 10: 100, 8: 50, 6: 20, 4: 10, 2: 5 };
  const effortMap = { 10: 0.5, 8: 1, 6: 3, 4: 7, 2: 14 };

  const value = valueMap[businessValue] || 0;
  const days = effortMap[effort] || 1;

  const roi = value / days;

  if (roi > 50) return '极高';
  if (roi > 20) return '高';
  if (roi > 10) return '中';
  if (roi > 5) return '低';
  return '极低';
}
```

## 快速评估模式

对于简单需求，可以使用简化评估：

```bash
/crs:req --quick 修复登录按钮样式

# 自动快速评估
priority-estimator --quick
  - 业务价值: 4 (改进性功能)
  - 紧急程度: 4 (一般问题)
  - 依赖关系: 2 (无依赖)
  - 实现成本: 10 (非常简单)
  - 风险评估: 10 (低风险)
  - 综合评分: 5.2 → P3 (低优先级)
```

## 集成到工作流

### 与 req-manager 集成

```javascript
// req-manager skill 中添加优先级评估
async function createRequirement(description) {
  // 1. brainstorm-grill 分析
  const design = await brainstormGrill(description);

  // 2. 优先级评估
  const priority = await estimatePriority(design);

  // 3. 创建需求文件
  await createReqFiles({
    ...design,
    priority,
  });
}
```

### 与执行计划集成

```javascript
// writing-plans skill 中考虑优先级
async function generatePlan(reqId) {
  const req = await loadRequirement(reqId);

  // 根据优先级调整计划细节
  if (req.priority.level === 'P0') {
    // P0 需求：详细计划，充分测试
    return generateDetailedPlan(req);
  } else if (req.priority.level === 'P3') {
    // P3 需求：简化计划，快速交付
    return generateSimplePlan(req);
  }
}
```

## 配置选项

```json
{
  "priority-estimator": {
    "weights": {
      "business_value": 0.4,
      "urgency": 0.3,
      "dependencies": 0.15,
      "effort": 0.1,
      "risk": 0.05
    },
    "thresholds": {
      "P0": 8,
      "P1": 6,
      "P2": 4,
      "P3": 2
    },
    "autoEvaluate": true,
    "quickMode": {
      "enabled": true,
      "simplifiedDimensions": ["business_value", "urgency", "effort"]
    }
  }
}
```

## 使用建议

### DO ✅

- 在创建需求时自动评估优先级
- 定期（每周）重新评估活跃需求的优先级
- 使用优先级指导开发顺序和资源分配
- 考虑团队技能和资源可用性
- 记录优先级调整的原因

### DON'T ❌

- 不要仅凭感觉排定优先级
- 不要忽视依赖关系的影响
- 不要将所有需求都设为高优先级
- 不要一成不变，定期重新评估
- 不要用优先级作为拖延的借口

## 优势

| 维度           | 改进                         |
| -------------- | ---------------------------- |
| **决策科学性** | 多维度量化评估，避免主观偏差 |
| **资源优化**   | 高价值需求优先，最大化 ROI   |
| **团队共识**   | 统一的评估标准，减少争议     |
| **透明度**     | 清晰的评分依据，便于解释     |
| **灵活性**     | 可配置权重，适应不同团队     |

---

## 集成说明

**触发时机**：

- brainstorm-grill 完成后（自动评估）
- 用户手动调用 `/priority` 时
- 定期重新评估（cron 任务）

**相关 skills**：

- `brainstorm-grill`: 提供需求分析内容作为评估依据
- `req-manager`: 创建需求时自动评估优先级
- `writing-plans`: 根据优先级调整计划详细程度

**输出**：

- meta.yaml 中的 priority 字段
- 优先级排序报告
- ROI 评估结果
