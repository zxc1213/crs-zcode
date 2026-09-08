---
name: req-quality
description: 质量门禁系统 - 在关键阶段自动检查质量标准，确保交付质量
---

# 质量门禁系统

在需求管理的每个关键阶段设置质量检查点，自动验证质量标准，防止低质量输出流入下一阶段。

## 门禁检查点

### Gate 1: 设计完成

**触发时机**：`brainstorm-grill` 完成后

**自动检查项**：

````javascript
// 自动质量检查
const designQualityChecks = {
  // 完整性检查
  hasNoPlaceholders: {
    check: (content) => !content.includes('TBD') && !content.includes('TODO'),
    error: '设计文档包含未完成项（TBD/TODO）',
  },

  // 矛盾检测
  noContradictions: {
    check: (content) => detectContradictions(content),
    error: '设计文档存在矛盾的内容',
  },

  // 决策完整性
  allDecisionsHaveRationale: {
    check: (content) => checkDecisionRationale(content),
    error: '部分决策缺少明确的理由',
  },

  // 架构完整性
  hasArchitectureDiagram: {
    check: (content) => content.includes('```') || content.includes('架构'),
    error: '缺少架构图或系统设计说明',
  },

  // 错误处理覆盖
  hasErrorHandling: {
    check: (content) => content.includes('错误') || content.includes('异常'),
    error: '缺少错误处理说明',
  },
};
````

**手动确认项**：

- [ ] 所有决策都有明确理由
- [ ] 架构图清晰完整
- [ ] 错误处理覆盖主要场景
- [ ] 接口定义明确
- [ ] 数据流完整

**通过条件**：

- 所有自动检查通过
- 至少 80% 手动确认项完成

---

### Gate 2: 测试策略完成

**触发时机**：`test-plan-generator` 完成后

**自动检查项**：

```javascript
const testQualityChecks = {
  // 测试类型覆盖
  hasMultipleTestTypes: {
    check: (testPlan) => countTestTypes(testPlan) >= 3,
    error: '测试类型覆盖不足（至少需要3种）',
  },

  // 关键路径覆盖
  hasCriticalPathTests: {
    check: (testPlan) => hasCriticalPathCoverage(testPlan),
    error: '缺少关键业务流程的测试用例',
  },

  // 性能指标定义
  hasPerformanceMetrics: {
    check: (testPlan) => testPlan.includes('性能') || testPlan.includes('响应时间'),
    error: '缺少性能指标定义',
  },

  // 安全风险识别
  hasSecurityTests: {
    check: (testPlan) => testPlan.includes('安全') || testPlan.includes('权限'),
    error: '缺少安全测试用例',
  },
};
```

**手动确认项**：

- [ ] 正常场景测试用例
- [ ] 边界条件测试用例
- [ ] 异常场景测试用例
- [ ] 性能基准已定义
- [ ] 安全风险已识别

**通过条件**：

- 所有自动检查通过
- P0 优先级测试用例完整

---

### Gate 3: 实现计划完成

**触发时机**：`writing-plans` 完成后

**自动检查项**：

```javascript
const planQualityChecks = {
  // 任务独立性
  tasksAreExecutable: {
    check: (plan) => checkTaskIndependence(plan),
    error: '部分任务无法独立执行（依赖不明确）',
  },

  // 依赖关系清晰
  hasClearDependencies: {
    check: (plan) => checkDependencyGraph(plan),
    error: '任务依赖关系不清晰或存在循环依赖',
  },

  // 时间估算合理
  hasReasonableEstimates: {
    check: (plan) => checkTimeEstimates(plan),
    error: '部分任务时间估算不合理',
  },

  // 风险应对
  hasRiskMitigation: {
    check: (plan) => plan.includes('风险') || plan.includes('应对'),
    error: '缺少风险应对方案',
  },
};
```

**手动确认项**：

- [ ] 每个任务有明确的验收标准
- [ ] 任务排序合理
- [ ] 依赖任务已识别
- [ ] 时间缓冲已考虑
- [ ] 资源需求已评估

**通过条件**：

- 所有自动检查通过
- 无循环依赖
- 关键路径有风险预案

---

### Gate 4: 变更完成

**触发时机**：`handle-req-change` 完成后

**自动检查项**：

```javascript
const changeQualityChecks = {
  // 影响评估完整
  hasImpactAssessment: {
    check: (change) => change.includes('影响') || change.includes('Impact'),
    error: '缺少变更影响评估',
  },

  // 文档已更新
  documentsUpdated: {
    check: async (change) => await checkDocumentsSync(change),
    error: '相关文档未同步更新',
  },

  // 测试用例调整
  testsUpdated: {
    check: async (change) => await checkTestsSync(change),
    error: '测试用例未相应调整',
  },

  // 干系人通知
  stakeholdersNotified: {
    check: (change) => change.includes('通知') || change.includes('Notify'),
    error: '未记录干系人通知',
  },
};
```

**手动确认项**：

- [ ] 影响范围已评估
- [ ] 设计文档已更新
- [ ] 测试计划已调整
- [ ] 实现计划已更新
- [ ] 相关干系人已通知

**通过条件**：

- 所有自动检查通过
- 影响的核心文档已更新

---

## 自动检查实现

### 矛盾检测算法

```javascript
function detectContradictions(content) {
  const contradictions = [
    // 检测相互矛盾的设计决策
    {
      pattern: /使用.*SQL.*数据库/g,
      antiPattern: /使用.*NoSQL.*数据库/g,
      message: '数据库选择矛盾',
    },
    {
      pattern: /实时同步/g,
      antiPattern: /异步处理/g,
      message: '同步模式矛盾',
    },
    {
      pattern: /高可用性.*单点/g,
      message: '高可用性与单点矛盾',
    },
  ];

  for (const { pattern, antiPattern, message } of contradictions) {
    if (pattern.test(content) && antiPattern.test(content)) {
      return { passed: false, message };
    }
  }
  return { passed: true };
}
```

### 决策理由检查

```javascript
function checkDecisionRationale(content) {
  // 查找决策标记
  const decisionPattern = /## 决策[.\s\S]*?##/g;
  const decisions = content.match(decisionPattern) || [];

  for (const decision of decisions) {
    // 检查是否有"理由"、"因为"、"原因"等关键词
    if (!/理由|因为|原因|基于|Due to/i.test(decision)) {
      return { passed: false, message: '决策缺少理由说明' };
    }
  }

  return { passed: true };
}
```

### 依赖循环检测

```javascript
function checkDependencyGraph(plan) {
  const tasks = parseTasks(plan);
  const graph = buildDependencyGraph(tasks);

  // 使用 DFS 检测循环
  const visited = new Set();
  const recursionStack = new Set();

  function hasCycle(node) {
    if (recursionStack.has(node)) {
      return true; // 发现循环
    }
    if (visited.has(node)) {
      return false;
    }

    visited.add(node);
    recursionStack.add(node);

    for (const dep of graph.get(node) || []) {
      if (hasCycle(dep)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  for (const node of graph.keys()) {
    if (hasCycle(node)) {
      return { passed: false, message: `任务依赖存在循环: ${node}` };
    }
  }

  return { passed: true };
}
```

---

## 使用方式

### 自动触发

质量门禁会在以下时机自动触发：

```javascript
// brainstorm-grill 完成后
await qualityGates.check('design', designDoc);

// test-plan-generator 完成后
await qualityGates.check('test', testPlan);

// writing-plans 完成后
await qualityGates.check('plan', implementationPlan);

// handle-req-change 完成后
await qualityGates.check('change', changeDoc);
```

### 手动触发

```bash
# 检查设计文档质量
/quality-gate check design REQ-20260513-001

# 检查所有门禁
/quality-gate check-all
```

---

## 质量报告

质量检查后生成报告：

```markdown
## 质量检查报告 - Gate 1: 设计完成

### 自动检查结果

✓ 无占位符（TBD/TODO）
✓ 无矛盾内容
✓ 决策理由完整
✓ 架构完整性
✓ 错误处理覆盖

### 手动确认项

✓ 所有决策都有明确理由
✓ 架构图清晰完整
✓ 错误处理覆盖主要场景
⚠️ 接口定义需要补充

### 总体评估

通过率: 90%
状态: ✅ 通过（有轻微问题可继续）

### 建议

- 补充接口定义部分
- 添加更多异常场景处理
```

---

## 配置选项

可通过项目约定或插件设置配置质量门禁：

```json
{
  "quality-gates": {
    "strictMode": false,
    "autoFix": true,
    "thresholds": {
      "design": 80,
      "test": 80,
      "plan": 85,
      "change": 90
    },
    "exceptions": {
      "allowPlaceholdersInDraft": true,
      "allowSkipWithReason": true
    }
  }
}
```

---

## 例外处理

### 严格模式 vs 宽松模式

**严格模式**（`--strict`）：

- 所有检查必须通过
- 任何手动确认项未完成则失败
- 需要明确理由才能例外

**宽松模式**（默认）：

- 自动检查必须通过
- 手动确认项允许 80% 完成
- 可以记录例外继续

### 例外申请

当质量检查未通过时，可以申请例外：

```markdown
## 例外申请

**门禁**: Gate 1 - 设计完成
**申请人**: 开发者A
**理由**: 接口定义需要等待 API 团队确认
**影响**: 无影响，可以在实现阶段补充
**批准人**: 技术负责人
```

---

## NEVER 清单

- **绝不**跳过自动检查（除非有明确例外批准）
- **绝不**在低质量输出上继续工作
- **绝不**忽略矛盾检测警告
- **绝不**让未完成的设计流入实现阶段
- **绝不**在有循环依赖的计划上开始工作

---

## 集成说明

**触发时机**：

- brainstorm-grill 完成后（自动）
- test-plan-generator 完成后（自动）
- writing-plans 完成后（自动）
- handle-req-change 完成后（自动）

**相关 skills**：

- `brainstorm-grill`: 生成设计文档，触发 Gate 1
- `test-plan-generator`: 生成测试计划，触发 Gate 2
- `writing-plans`: 生成实现计划，触发 Gate 3
- `handle-req-change`: 处理变更，触发 Gate 4

**输出**：

- 质量检查报告
- 通过/失败状态
- 改进建议
- 例外申请记录
