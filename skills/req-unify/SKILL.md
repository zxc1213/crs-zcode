---
name: req-unify
description: 文档结构统一 - 将文档内容整理到标准子目录结构，根文件作为摘要索引
---

# 文档结构统一

将需求相关的5个独立文件（design.md、test-plan.md、plan.md、analysis-report.md、CHANGELOG.md）整理到 spec/、plan/、test-cases/ 子目录结构，根文件作为摘要索引，消除冗余。

## 问题分析

### 当前文档结构（冗余）

```
REQ-XXX/
├── meta.yaml              # 元数据
├── design.md              # 设计文档
├── test-plan.md           # 测试计划
├── plan.md                # 实现计划
├── analysis-report.md     # 分析报告
└── CHANGELOG.md           # 变更日志
```

**冗余问题**：

- `design.md` 包含测试策略和实施计划
- `test-plan.md` 重复 design.md 的背景信息
- `plan.md` 又重复 design.md 的设计决策
- `analysis-report.md` 与 design.md 内容重叠
- `CHANGELOG.md` 可以整合到主文档
- **维护成本**：修改一个决策需要更新3-4个文件

## 优化后的文档结构

### 新结构（精简）

```
REQ-XXX/
├── meta.yaml           # 元数据（保持不变）
├── spec.md             # 主文档（包含所有内容）
└── test-cases.md       # 详细测试用例（可选）
```

### spec.md 结构

```markdown
# [需求标题]

## 元数据

- **ID**: REQ-20260513-001
- **类型**: feature/bug/refactor/question/adjustment
- **状态**: planning/designing/implementing/testing/completed
- **创建时间**: 2026-05-13
- **更新时间**: 2026-05-13

## 需求分析

### 背景与目标

### 用户故事

### 验收标准

### 开放问题

## 设计方案

### 系统架构

### 核心组件

### 数据流设计

### 接口定义

### 技术选型

### 决策记录

| 决策            | 理由         | 替代方案  |
| --------------- | ------------ | --------- |
| 使用 WebSocket  | 支持实时通信 | 轮询、SSE |
| 采用 PostgreSQL | ACID 保证    | MongoDB   |

### 错误处理

### 安全考虑

## 测试策略

### 测试范围

### 测试类型

- 功能测试：关键场景
- API 测试：接口验证
- 性能测试：响应时间 <200ms
- 安全测试：输入验证、权限控制

### 验收标准

### 性能指标

## 实施计划

### 任务分解

| 任务          | 优先级 | 预估时间 | 依赖 |
| ------------- | ------ | -------- | ---- |
| 1. 数据库设计 | P0     | 2h       | -    |
| 2. API 开发   | P0     | 4h       | 1    |
| 3. 前端实现   | P1     | 3h       | 2    |

### 依赖关系

### 风险与应对

## 变更历史

| 日期       | 变更内容   | 影响分析       |
| ---------- | ---------- | -------------- |
| 2026-05-13 | 初始创建   | -              |
| 2026-05-14 | 添加缓存层 | 影响数据一致性 |
```

### test-cases.md 结构（可选）

```markdown
# 测试用例详情

## 功能测试

### TC-001: 用户登录

- **前置条件**: 用户已注册
- **测试步骤**: ...
- **预期结果**: 登录成功，跳转首页
- **测试数据**: ...

### TC-002: 登录失败

...

## API 测试

### TC-API-001: POST /api/auth/login

...

## 性能测试

### TC-PERF-001: 并发登录测试

...

## 安全测试

### TC-SEC-001: SQL 注入测试

...
```

## 使用方式

### 自动触发

当创建新需求或完成设计分析时：

```bash
# brainstorm-grill 完成后自动调用
/crs:req 添加用户登录功能
  ↓
brainstorm-grill 分析
  ↓
doc-unifier 生成 spec.md
```

### 手动调用

```bash
# 统一现有需求的文档结构
/doc-unifier REQ-20260513-001

# 批量统一所有需求
/doc-unifier --all
```

## 转换规则

### 从旧结构到新结构

**设计文档 (design.md)** → `spec.md` 中的「设计方案」部分

**测试计划 (test-plan.md)** → 拆分为：

- `spec.md` 中的「测试策略」（高层）
- `test-cases.md` 中的详细用例（按需生成）

**实现计划 (plan.md)** → `spec.md` 中的「实施计划」部分

**分析报告 (analysis-report.md)** → `spec.md` 中的「需求分析」部分

**变更日志 (CHANGELOG.md)** → `spec.md` 中的「变更历史」部分

## 实现逻辑

```javascript
async function unifyDocuments(reqId) {
  // 1. 读取现有文档
  const docs = await readAllDocuments(reqId);

  // 2. 提取并去重内容
  const spec = {
    meta: docs.meta,
    analysis: extractAnalysis(docs.analysisReport, docs.design),
    design: extractDesign(docs.design),
    testStrategy: extractTestStrategy(docs.testPlan),
    implementation: extractImplementation(docs.plan),
    changelog: docs.changelog,
  };

  // 3. 生成统一的 spec.md
  await writeSpec(reqId, spec);

  // 4. 可选：生成详细测试用例
  if (needsDetailedTests(docs.testPlan)) {
    await writeTestCases(reqId, docs.testPlan.cases);
  }

  // 5. 删除旧文件（备份后）
  await backupAndRemoveOldFiles(reqId);
}
```

## 迁移策略

### 阶段1: 新需求采用新结构

- 所有新创建的需求使用 `spec.md` 格式
- 旧需求保持不变，逐步迁移

### 阶段2: 活跃需求迁移

- 迁移活跃中的需求（in_progress）
- 保留备份以便回滚

### 阶段3: 历史需求归档

- 完成的需求可选择迁移或保持原样
- 建议归档时统一格式

## 优势

| 维度           | 改进                    |
| -------------- | ----------------------- |
| **维护成本**   | 结构化子目录拆分 |
| **信息一致性** | 消除冗余，单一信息源    |
| **查找效率**   | 集中式文档，减少跳转    |
| **版本控制**   | 单文件变更历史更清晰    |
| **新人上手**   | 阅读摘要索引即可定位详细文档       |

## 配置选项

```json
{
  "doc-unifier": {
    "autoMigrate": true,
    "keepBackup": true,
    "generateTestCases": "on-demand",
    "migrationStrategy": "active-first"
  }
}
```

## NEVER 清单

- **绝不**在没有备份的情况下删除旧文档
- **绝不**在迁移过程中丢失信息
- **绝不**强制迁移活跃需求（可选）
- **绝不**删除 meta.yaml（元数据必须保留）

---

## 集成说明

**触发时机**：

- brainstorm-grill 完成后（自动生成 spec.md）
- test-plan-generator 完成后（将策略整合到 spec.md）
- 用户手动调用 `/doc-unifier` 时

**相关 skills**：

- `brainstorm-grill`: 生成设计内容，写入 spec.md
- `test-plan-generator`: 生成测试策略，写入 spec.md
- `writing-plans`: 生成实施计划，写入 spec.md

**输出**：

- `spec.md`: 统一的主文档
- `test-cases.md`: 可选的详细测试用例
