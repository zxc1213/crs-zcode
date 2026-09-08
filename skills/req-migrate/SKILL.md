---
name: req-migrate
description: 文档迁移工具 - 将旧格式需求文档迁移到新的统一格式（spec.md + test-cases.md）
---

# 文档迁移工具

将旧格式的需求文档（design.md + test-plan.md + plan.md + analysis-report.md + CHANGELOG.md）迁移到新的统一格式（spec.md + test-cases.md）。

## 旧格式 vs 新格式

### 旧格式（5个文件）

```
REQ-XXX/
├── meta.yaml              # 元数据
├── design.md              # 设计文档
├── test-plan.md           # 测试计划
├── plan.md                # 实现计划
├── analysis-report.md     # 分析报告
└── CHANGELOG.md           # 变更日志
```

### 新格式（2个文件）

```
REQ-XXX/
├── meta.yaml           # 元数据（保持不变）
├── spec.md             # 主文档（包含所有内容）
└── test-cases.md       # 详细测试用例（可选）
```

## 使用方式

### 单个需求迁移

```bash
# 迁移特定需求
/migrate-docs REQ-20260513-001

# 预览迁移结果（不实际修改）
/migrate-docs REQ-20260513-001 --dry-run

# 强制迁移（覆盖已存在的 spec.md）
/migrate-docs REQ-20260513-001 --force
```

### 批量迁移

```bash
# 迁移所有需求
/migrate-docs --all

# 迁移特定类型的需求
/migrate-docs --all --type features

# 迁移活跃中的需求
/migrate-docs --all --status in_progress

# 交互式迁移（逐个确认）
/migrate-docs --all --interactive
```

### 迁移报告

```bash
# 查看迁移状态
/migrate-docs --status

# 生成迁移报告
/migrate-docs --report
```

## 迁移流程

### 步骤 1: 检查和备份

```javascript
// 1. 检查需求目录是否存在
if (!fs.existsSync(reqPath)) {
  console.error(`需求目录不存在: ${reqPath}`);
  return;
}

// 2. 检查是否已经是新格式
if (fs.existsSync(path.join(reqPath, 'spec.md'))) {
  console.log('该需求已经是新格式，无需迁移');
  return;
}

// 3. 创建备份
const backupDir = path.join(reqPath, '.backup');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `before-migration-${timestamp}`);

fs.mkdirSync(backupPath, { recursive: true });

// 备份所有旧文件
const oldFiles = ['design.md', 'test-plan.md', 'plan.md', 'analysis-report.md', 'CHANGELOG.md'];
for (const file of oldFiles) {
  const src = path.join(reqPath, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(backupPath, file));
  }
}

console.log(`✓ 备份已创建: ${backupPath}`);
```

### 步骤 2: 读取现有文档

```javascript
const docs = {
  meta: readYaml(path.join(reqPath, 'meta.yaml')),
  design: readMarkdown(path.join(reqPath, 'design.md')),
  testPlan: readMarkdown(path.join(reqPath, 'test-plan.md')),
  plan: readMarkdown(path.join(reqPath, 'plan.md')),
  analysisReport: readMarkdown(path.join(reqPath, 'analysis-report.md')),
  changelog: readMarkdown(path.join(reqPath, 'CHANGELOG.md')),
};

// 记录哪些文件实际存在
const existingFiles = Object.keys(docs).filter((key) => docs[key] !== null);
console.log(`找到 ${existingFiles.length} 个文件: ${existingFiles.join(', ')}`);
```

### 步骤 3: 提取和整合内容

```javascript
// 构建统一的 spec.md 内容
const spec = {
  // 从 meta.yaml 提取元数据
  meta: docs.meta,

  // 从 analysis-report.md 或 design.md 提取需求分析
  analysis: extractAnalysis(docs.analysisReport, docs.design),

  // 从 design.md 提取设计方案
  design: extractDesign(docs.design),

  // 从 test-plan.md 提取测试策略（高层）
  testStrategy: extractTestStrategy(docs.testPlan),

  // 从 plan.md 提取实施计划
  implementation: extractImplementation(docs.plan),

  // 从 CHANGELOG.md 提取变更历史
  changelog: extractChangelog(docs.changelog),
};

// 提取详细测试用例（如果有）
const testCases = extractTestCases(docs.testPlan);
```

### 步骤 4: 生成新格式文档

```javascript
// 生成 spec.md
const specContent = generateSpecMarkdown(spec);
fs.writeFileSync(path.join(reqPath, 'spec.md'), specContent);

// 生成 test-cases.md（如果有详细测试用例）
if (testCases && testCases.length > 0) {
  const testCasesContent = generateTestCasesMarkdown(testCases);
  fs.writeFileSync(path.join(reqPath, 'test-cases.md'), testCasesContent);
}

console.log('✓ 新格式文档已生成');
```

### 步骤 5: 验证和清理

```javascript
// 验证生成的文档
const validation = validateSpec(reqPath);
if (!validation.valid) {
  console.error('❌ 生成的文档验证失败:');
  validation.errors.forEach((err) => console.error(`  - ${err}`));

  // 询问是否回滚
  const shouldRollback = await prompt('是否回滚迁移？(y/n)');
  if (shouldRollback) {
    rollbackMigration(reqPath, backupPath);
    return;
  }
}

// 确认后删除旧文件
const confirmed = await prompt('是否删除旧文件？(y/n)');
if (confirmed) {
  for (const file of oldFiles) {
    const filePath = path.join(reqPath, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  console.log('✓ 旧文件已删除');
} else {
  console.log('旧文件保留，迁移完成');
}
```

## 提取函数

### extractAnalysis()

```javascript
function extractAnalysis(analysisReport, design) {
  const sections = [];

  // 优先从 analysis-report.md 提取
  if (analysisReport) {
    if (analysisReport.background)
      sections.push({ title: '背景与目标', content: analysisReport.background });
    if (analysisReport.userStory)
      sections.push({ title: '用户故事', content: analysisReport.userStory });
    if (analysisReport.acceptanceCriteria)
      sections.push({ title: '验收标准', content: analysisReport.acceptanceCriteria });
  }

  // 从 design.md 补充
  if (design) {
    if (!sections.find((s) => s.title === '背景与目标') && design.background) {
      sections.push({ title: '背景与目标', content: design.background });
    }
    if (!sections.find((s) => s.title === '用户故事') && design.userStory) {
      sections.push({ title: '用户故事', content: design.userStory });
    }
  }

  return sections;
}
```

### extractDesign()

```javascript
function extractDesign(design) {
  if (!design) return null;

  return {
    architecture: design.architecture || '',
    components: design.components || [],
    dataFlow: design.dataFlow || '',
    interfaces: design.interfaces || {},
    techStack: design.techStack || {},
    decisions: design.decisions || [],
    errorHandling: design.errorHandling || '',
    security: design.security || '',
  };
}
```

### extractTestStrategy()

```javascript
function extractTestStrategy(testPlan) {
  if (!testPlan) return null;

  return {
    scope: testPlan.scope || '',
    types: testPlan.types || [],
    acceptanceCriteria: testPlan.acceptanceCriteria || '',
    performanceMetrics: testPlan.performanceMetrics || {},
  };
}
```

### extractTestCases()

```javascript
function extractTestCases(testPlan) {
  if (!testPlan || !testPlan.cases) return [];

  // 只返回需要详细描述的测试用例
  return testPlan.cases.filter((tc) => tc.steps && tc.steps.length > 0);
}
```

### extractImplementation()

```javascript
function extractImplementation(plan) {
  if (!plan) return null;

  return {
    tasks: plan.tasks || [],
    dependencies: plan.dependencies || {},
    risks: plan.risks || [],
  };
}
```

### extractChangelog()

```javascript
function extractChangelog(changelog) {
  if (!changelog) return [];

  // 解析 CHANGELOG.md 格式
  const entries = [];
  const lines = changelog.split('\n');
  let currentDate = null;
  let currentContent = [];

  for (const line of lines) {
    const dateMatch = line.match(/^##\s+(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      if (currentDate) {
        entries.push({ date: currentDate, content: currentContent.join('\n') });
      }
      currentDate = dateMatch[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentDate) {
    entries.push({ date: currentDate, content: currentContent.join('\n') });
  }

  return entries;
}
```

## 生成函数

### generateSpecMarkdown()

```javascript
function generateSpecMarkdown(spec) {
  let md = '';

  // 标题
  md += `# ${spec.meta.title || '需求文档'}\n\n`;

  // 元数据
  md += '## 元数据\n';
  md += `- **ID**: ${spec.meta.id}\n`;
  md += `- **类型**: ${spec.meta.type}\n`;
  md += `- **状态**: ${spec.meta.status}\n`;
  md += `- **创建时间**: ${spec.meta.created_at}\n`;
  md += `- **更新时间**: ${spec.meta.updated_at}\n`;
  md += `- **优先级**: ${spec.meta.priority?.level || '未设置'} (${spec.meta.priority?.score || 'N/A'})\n\n`;

  // 需求分析
  if (spec.analysis && spec.analysis.length > 0) {
    md += '## 需求分析\n\n';
    for (const section of spec.analysis) {
      md += `### ${section.title}\n\n${section.content}\n\n`;
    }
  }

  // 设计方案
  if (spec.design) {
    md += '## 设计方案\n\n';

    if (spec.design.architecture) {
      md += `### 系统架构\n\n${spec.design.architecture}\n\n`;
    }

    if (spec.design.components && spec.design.components.length > 0) {
      md += '### 核心组件\n\n';
      for (const comp of spec.design.components) {
        md += `- **${comp.name}**: ${comp.description}\n`;
      }
      md += '\n';
    }

    if (spec.design.dataFlow) {
      md += `### 数据流设计\n\n${spec.design.dataFlow}\n\n`;
    }

    if (spec.design.interfaces && Object.keys(spec.design.interfaces).length > 0) {
      md += '### 接口定义\n\n';
      for (const [name, iface] of Object.entries(spec.design.interfaces)) {
        md += `#### ${name}\n\n`;
        md += `**方法**: ${iface.method}\n`;
        md += `**路径**: ${iface.path}\n`;
        md += `**参数**: ${JSON.stringify(iface.params)}\n`;
        md += `**返回**: ${JSON.stringify(iface.response)}\n\n`;
      }
    }

    if (spec.design.techStack && Object.keys(spec.design.techStack).length > 0) {
      md += '### 技术选型\n\n';
      for (const [layer, tech] of Object.entries(spec.design.techStack)) {
        md += `- **${layer}**: ${tech}\n`;
      }
      md += '\n';
    }

    if (spec.design.decisions && spec.design.decisions.length > 0) {
      md += '### 决策记录\n\n';
      md += '| 决策 | 理由 | 替代方案 |\n';
      md += '|------|------|----------|\n';
      for (const decision of spec.design.decisions) {
        md += `| ${decision.what} | ${decision.why} | ${decision.alternatives} |\n`;
      }
      md += '\n';
    }

    if (spec.design.errorHandling) {
      md += `### 错误处理\n\n${spec.design.errorHandling}\n\n`;
    }

    if (spec.design.security) {
      md += `### 安全考虑\n\n${spec.design.security}\n\n`;
    }
  }

  // 测试策略
  if (spec.testStrategy) {
    md += '## 测试策略\n\n';

    if (spec.testStrategy.scope) {
      md += `### 测试范围\n\n${spec.testStrategy.scope}\n\n`;
    }

    if (spec.testStrategy.types && spec.testStrategy.types.length > 0) {
      md += '### 测试类型\n\n';
      for (const type of spec.testStrategy.types) {
        md += `- **${type.name}**: ${type.description}\n`;
        if (type.scenarios) {
          for (const scenario of type.scenarios) {
            md += `  - ${scenario}\n`;
          }
        }
      }
      md += '\n';
    }

    if (spec.testStrategy.acceptanceCriteria) {
      md += `### 验收标准\n\n${spec.testStrategy.acceptanceCriteria}\n\n`;
    }

    if (spec.testStrategy.performanceMetrics) {
      md += '### 性能指标\n\n';
      for (const [metric, value] of Object.entries(spec.testStrategy.performanceMetrics)) {
        md += `- **${metric}**: ${value}\n`;
      }
      md += '\n';
    }
  }

  // 实施计划
  if (spec.implementation) {
    md += '## 实施计划\n\n';

    if (spec.implementation.tasks && spec.implementation.tasks.length > 0) {
      md += '### 任务分解\n\n';
      md += '| 任务 | 优先级 | 预估时间 | 依赖 |\n';
      md += '|------|--------|----------|------|\n';
      for (const task of spec.implementation.tasks) {
        md += `| ${task.name} | ${task.priority} | ${task.estimate} | ${task.dependencies || '-'} |\n`;
      }
      md += '\n';
    }

    if (
      spec.implementation.dependencies &&
      Object.keys(spec.implementation.dependencies).length > 0
    ) {
      md += '### 依赖关系\n\n';
      for (const [task, deps] of Object.entries(spec.implementation.dependencies)) {
        md += `- **${task}**: 依赖 ${deps.join(', ')}\n`;
      }
      md += '\n';
    }

    if (spec.implementation.risks && spec.implementation.risks.length > 0) {
      md += '### 风险与应对\n\n';
      for (const risk of spec.implementation.risks) {
        md += `- **${risk.risk}**: ${risk.mitigation}\n`;
      }
      md += '\n';
    }
  }

  // 变更历史
  if (spec.changelog && spec.changelog.length > 0) {
    md += '## 变更历史\n\n';
    md += '| 日期 | 变更内容 | 影响分析 |\n';
    md += '|------|----------|----------|\n';
    for (const entry of spec.changelog) {
      const summary = entry.content.split('\n')[0].substring(0, 50);
      md += `| ${entry.date} | ${summary} | ${entry.impact || '-'} |\n`;
    }
    md += '\n';
  }

  return md;
}
```

### generateTestCasesMarkdown()

```javascript
function generateTestCasesMarkdown(testCases) {
  let md = '# 测试用例详情\n\n';

  for (const tc of testCases) {
    md += `### ${tc.id}: ${tc.name}\n\n`;
    md += `- **前置条件**: ${tc.preconditions || '-'}\n`;
    md += `- **测试步骤**:\n`;
    for (const step of tc.steps) {
      md += `  ${step.order}. ${step.action}\n`;
      md += `  预期: ${step.expected}\n`;
    }
    md += `- **预期结果**: ${tc.expectedResult}\n`;
    if (tc.testData) {
      md += `- **测试数据**: \`${JSON.stringify(tc.testData)}\`\n`;
    }
    md += '\n';
  }

  return md;
}
```

## 验证函数

```javascript
function validateSpec(reqPath) {
  const specPath = path.join(reqPath, 'spec.md');
  const content = fs.readFileSync(specPath, 'utf8');

  const errors = [];

  // 检查必需章节
  const requiredSections = ['元数据', '设计方案', '测试策略', '实施计划'];
  for (const section of requiredSections) {
    if (!content.includes(`## ${section}`)) {
      errors.push(`缺少必需章节: ${section}`);
    }
  }

  // 检查元数据完整性
  const requiredMeta = ['ID', '类型', '状态'];
  for (const meta of requiredMeta) {
    if (!content.includes(`- **${meta}**:`)) {
      errors.push(`元数据缺少必需字段: ${meta}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
  };
}
```

## 回滚函数

```javascript
function rollbackMigration(reqPath, backupPath) {
  console.log('正在回滚迁移...');

  // 删除新文件
  const specPath = path.join(reqPath, 'spec.md');
  const testCasesPath = path.join(reqPath, 'test-cases.md');

  if (fs.existsSync(specPath)) {
    fs.unlinkSync(specPath);
  }

  if (fs.existsSync(testCasesPath)) {
    fs.unlinkSync(testCasesPath);
  }

  // 恢复旧文件
  const oldFiles = ['design.md', 'test-plan.md', 'plan.md', 'analysis-report.md', 'CHANGELOG.md'];
  for (const file of oldFiles) {
    const backupFile = path.join(backupPath, file);
    if (fs.existsSync(backupFile)) {
      fs.copyFileSync(backupFile, path.join(reqPath, file));
    }
  }

  console.log('✓ 回滚完成');
}
```

## 迁移报告

```markdown
# 文档迁移报告

## 总体统计

- 总需求数: 15
- 已迁移: 10 (67%)
- 待迁移: 5 (33%)
- 迁移失败: 0

## 已迁移需求

| ID               | 标题         | 迁移时间         | 状态    |
| ---------------- | ------------ | ---------------- | ------- |
| REQ-20260513-001 | 用户登录功能 | 2026-05-13 10:30 | ✅ 成功 |
| REQ-20260513-002 | 数据导出功能 | 2026-05-13 10:35 | ✅ 成功 |

## 待迁移需求

| ID               | 标题     | 类型     | 状态        |
| ---------------- | -------- | -------- | ----------- |
| REQ-20260513-011 | 性能优化 | refactor | completed   |
| REQ-20260513-012 | Bug修复  | bug      | in_progress |

## 问题记录

- REQ-20260513-005: 缺少 design.md，只生成了部分内容
- REQ-20260513-008: plan.md 格式异常，需要手动调整
```

## 配置选项

```json
{
  "migrate-docs": {
    "autoBackup": true,
    "backupRetention": "30days",
    "dryRunByDefault": false,
    "interactiveMode": false,
    "validationLevel": "strict",
    "keepOldFiles": false,
    "generateTestCases": "on-demand"
  }
}
```

## NEVER 清单

- **绝不**在没有备份的情况下删除旧文档
- **绝不**跳过验证步骤
- **绝不**强制覆盖已存在的 spec.md（除非使用 --force）
- **绝不**迁移活跃中的需求而没有用户确认
- **绝不**删除 meta.yaml 文件

---

## 集成说明

**触发时机**：

- 用户手动调用 `/migrate-docs` 时
- 批量迁移时 `/migrate-docs --all`

**相关 skills**：

- `doc-unifier`: 定义新格式规范
- `brainstorm-grill`: 新需求直接生成新格式
- `test-plan-generator`: 测试策略整合到 spec.md

**输出**：

- spec.md: 统一的主文档
- test-cases.md: 可选的详细测试用例
- .backup/: 备份目录
- 迁移报告
