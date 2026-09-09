/**
 * 需求创建器 - 创建需求的全部落盘动作与副作用
 *
 * 职责：目录与元数据 → raw/agent-context → 骨架文件 → 索引缓存
 *      → 时间线埋点（requirement_created）→ 知识图谱同步 → project 自动初始化
 */

import path from 'path';
import fs from 'fs/promises';
import { generate } from '../utils/id-generator.js';
import { writeMeta } from '../utils/storage.js';
import { TYPE_DIRS } from './schema.js';
import { loadTemplate } from './template-renderer.js';
import { loadConfig, DEFAULT_SKELETON } from './config.js';
import { getKnowledgeGraph } from '../../knowledge-graph/index.js';

/**
 * 骨架条目安全解析：文件名白名单 + 根目录边界双校验
 * skeleton 清单可能来自项目级 config.yaml（项目可控输入），必须防路径穿越
 */
function safeJoin(root, relName) {
  if (typeof relName !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(relName) || relName.includes('..')) {
    throw new Error(`illegal skeleton entry: ${relName}`);
  }
  const rootAbs = path.resolve(root);
  const target = path.resolve(root, relName);
  if (target !== rootAbs && !target.startsWith(rootAbs + path.sep)) {
    throw new Error(`skeleton entry escapes requirement directory: ${relName}`);
  }
  return target;
}

/**
 * Agent 上下文文件内容（告诉 skills 文档保存约定与状态生命周期）
 */
function agentContextContent(meta, description) {
  return `# 需求上下文文件（Agent 指引）

## 当前需求

- **ID**: ${meta.id}
- **类型**: ${meta.type}
- **状态**: ${meta.status}
- **创建时间**: ${meta.created}

## 需求描述

${description}

## 文档保存指引

**重要**: 所有文档保存在需求目录下。根文件（spec.md、plan.md、test-cases.md）是摘要索引，详细内容写入子目录。

### 阶段 2（深度分析）→ 写入 spec/ 子目录

- \`spec/background.md\` — 背景与目标
- \`spec/user-stories.md\` — 用户故事 + 验收标准
- \`spec/design.md\` — 系统架构 + 核心组件 + 数据流
- \`spec/api.md\` — 接口定义 + 技术选型 + 错误处理
- \`spec/decisions.md\` — 开放问题 + 技术决策

### 阶段 4（测试策略）→ 写入 test-cases/ 子目录

- \`test-cases/positive.md\` — 正向用例
- \`test-cases/negative.md\` — 异常用例
- \`test-cases/boundary.md\` — 边界用例

### 阶段 5（实施计划）→ 写入 plan/ 子目录

- \`plan/tasks.md\` — 任务分解表
- \`plan/milestones.md\` — 里程碑 + 风险清单
- \`plan/step-N-xxx.md\` — 各步骤详细文档（按需拆分，N 从 1 开始）

### 规则

- 详细内容**始终写入子目录文件**，不写入根文件
- 子文件命名使用英文小写 + 短横线（kebab-case）
- 额外文档（会议记录等）可追加到根目录

## 执行阶段指引

### 状态生命周期

\`\`\`
planning → analyzed → implementing → review → done
\`\`\`

### 阶段 2 完成后 — 必须立即执行

1. 确认 spec/ 下 5 个文件已写入内容（无 \`<!-- TODO:\` 残留）
2. **更新 spec.md 索引表**：将每行的 \`待填充\` 改为 \`已填充\`
3. **更新 meta.yaml**：\`status: planning\` → \`status: analyzed\`

### 阶段 4 完成后 — 必须立即执行

1. 确认 test-cases/ 下 3 个文件已写入内容
2. **更新 test-cases.md 索引表**：将每行的 \`待填充\` 改为 \`已填充\`

### 阶段 5 完成后 — 必须立即执行

1. 确认 plan/ 下文件已写入内容
2. **更新 plan.md 索引表**：将每行的 \`待填充\` 改为 \`已填充\`
3. **更新 meta.yaml**：\`status: analyzed\` → \`status: implementing\`

### 任务执行过程中

- 完成一个任务时：更新 \`plan/tasks.md\` 对应任务行的 \`状态\` 列（pending → done）
- 完成所有任务时：\`meta.yaml\` \`status\` → \`done\`

### 更新索引表的方法

在根文件（spec.md/plan.md/test-cases.md）的索引表中，找到对应行，将 \`待填充\` 替换为 \`已填充\`：
\`\`
| 背景与目标 | [spec/background.md](spec/background.md) | 已填充 |
\`\`\`

---
*此文件由 req 系统自动生成，请勿删除*
`;
}

/**
 * 解析单个模板内容：项目模板目录优先，其次内置模板目录，都没有则最小骨架
 * @param {string} relName - 相对文件名（如 spec.md 或 spec/background.md）
 * @param {object} tplVars - 模板变量
 * @param {string|null} projectTplDir - 项目模板目录（.requirements/_system/templates）
 */
async function resolveTemplateContent(relName, tplVars, projectTplDir) {
  const header = `# ${tplVars.TITLE}\n\n> ID: ${tplVars.ID} · 类型: ${tplVars.TYPE} · 日期: ${tplVars.DATE}\n\n<!-- TODO: 待填充 -->\n`;

  if (projectTplDir) {
    const root = path.resolve(projectTplDir);
    const candidate = path.resolve(root, `${relName}.tpl`);
    if (candidate === root || candidate.startsWith(root + path.sep)) {
      try {
        return await fs.readFile(candidate, 'utf-8');
      } catch (_error) {
        // 项目模板未提供 → 回退内置
      }
    }
  }

  try {
    return await loadTemplate(`${relName}.tpl`, tplVars);
  } catch (_error) {
    // 内置模板也没有（自定义清单条目）→ 最小骨架
    return header;
  }
}

/**
 * 渲染骨架文件（清单条目白名单 + 根目录边界校验后按解析链取模板）
 * @param {string} reqPath - 需求目录
 * @param {object} tplVars - { ID, TYPE, TITLE, DATE }
 * @param {object} skeleton - 骨架清单 { root, subdirs }
 * @param {string|null} projectTplDir - 项目模板目录
 */
async function renderSkeleton(reqPath, tplVars, skeleton, projectTplDir) {
  for (const rootFile of skeleton.root) {
    const target = safeJoin(reqPath, rootFile);
    const content = await resolveTemplateContent(rootFile, tplVars, projectTplDir);
    await fs.writeFile(target, content, 'utf-8');
  }
  for (const [subdir, files] of Object.entries(skeleton.subdirs)) {
    const subDir = safeJoin(reqPath, subdir);
    await fs.mkdir(subDir, { recursive: true });
    for (const file of files) {
      const target = safeJoin(subDir, file);
      const content = await resolveTemplateContent(path.posix.join(subdir, file), tplVars, projectTplDir);
      await fs.writeFile(target, content, 'utf-8');
    }
  }
}

/**
 * 创建新需求
 * @param {object} processor - Processor 实例（提供 baseDir/requirementsDir/index）
 * @param {object} parsed - 解析后的需求 { type, mode, description }
 * @param {object} [options] - { skeleton } 覆盖骨架清单
 * @returns {Promise<object>} { id, path }
 */
export async function createRequirement(processor, parsed, options = {}) {
  const { type, mode, description } = parsed;
  const baseDir = processor.baseDir;

  // 骨架清单：显式 options > 项目级 config.yaml > 默认清单
  const cfg = await loadConfig(baseDir);
  const skeleton = options.skeleton || cfg.skeleton || DEFAULT_SKELETON;
  const projectTplDir = path.join(baseDir, '.requirements', '_system', 'templates');

  // 生成 ID (现在生成ID是异步操作)
  const id = await generate(type);

  // 确定类型目录
  const typeDir = TYPE_DIRS[type] || `${type}s`;

  // 创建目录结构
  const reqPath = path.join(processor.requirementsDir, typeDir, id);

  try {
    await fs.mkdir(reqPath, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create requirement directory: ${error.message}`, { cause: error });
  }

  // 创建元数据
  const now = new Date().toISOString();
  const meta = {
    id,
    type,
    title: description.split('\n')[0].substring(0, 100), // 第一行作为标题，限制长度
    description,
    created: now,
    status: 'planning',
    priority: 'medium',
    mode,
    tags: [],
  };

  await writeMeta(baseDir, reqPath, meta);

  // 创建原始需求文件
  const rawPath = path.join(reqPath, 'raw.md');
  const rawContent = `# ${description}\n\n${description}`;
  await fs.writeFile(rawPath, rawContent, 'utf-8');

  // 创建 Agent 上下文文件，告诉 skills 应该将文档保存到这里
  await fs.writeFile(path.join(reqPath, '.agent-context.md'), agentContextContent(meta, description), 'utf-8');

  // 预生成骨架文件，避免后续步骤遗漏
  const tplVars = { ID: id, TYPE: type, TITLE: meta.title, DATE: now.slice(0, 10) };
  await renderSkeleton(reqPath, tplVars, skeleton, projectTplDir);

  // 更新索引
  processor.index.set(id, reqPath);

  // 时间线事件：需求创建
  try {
    const { appendEvent } = await import('../project-sync/timeline.js');
    await appendEvent(baseDir, {
      type: 'requirement_created',
      reqId: id,
      title: meta.title,
      summary: `${type} 需求创建，进入 ${meta.status}`,
    });
  } catch (_timelineError) {
    // 账本写入失败不影响主流程
  }

  // 同步到知识图谱
  try {
    const graph = await getKnowledgeGraph(baseDir);
    await graph.addRequirement({
      id,
      type,
      title: meta.title,
      description: meta.description,
      priority: { level: meta.priority, score: 7.0 },
      status: meta.status,
      tags: meta.tags || [],
      keywords: [],
      createdAt: meta.created,
      updatedAt: meta.created,
    });
  } catch (_error) {
    // 知识图谱同步失败不影响主流程
  }

  // Upgrade-path guardrail: ensure .requirements/project/ is initialized so that
  // projects created on CRS < v0.11.0 gain project docs on their next /req run
  // instead of having to wait for the first requirement to reach status=done.
  // Spec: BUG-20260615-001-e7e5ed AC-1 / AC-3 / AC-4 / AC-6.
  if (process.env.CRS_PROJECT_SYNC !== 'off') {
    try {
      const { isProjectInitialized, initializeProjectDocs } = await import('../project-sync/index.js');
      if (!(await isProjectInitialized(baseDir))) {
        await initializeProjectDocs(baseDir, { actor: 'auto-create' });
      }
    } catch (_projectSyncError) {
      // Auto-init failure must never break requirement creation.
      try {
        const { logProjectSyncError } = await import('../project-sync/index.js');
        await logProjectSyncError(baseDir, id, _projectSyncError);
      } catch (_logError) {
        // Silently swallow log failures to keep creation resilient.
      }
    }
  }

  return { id, path: reqPath };
}
