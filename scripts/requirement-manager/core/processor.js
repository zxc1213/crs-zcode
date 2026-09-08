/**
 * 需求处理器 - 处理需求的核心逻辑
 */

import { generate } from '../utils/id-generator.js';
import { readMeta, writeMeta, exists } from '../utils/storage.js';
import { trackDocuments } from '../utils/document-tracker.js';
import { syncPlanStatus, syncIndexTables } from '../utils/plan-sync.js';
import { TYPE_PREFIXES, TYPE_DIRS, STATUSES, normalizeStatus } from './schema.js';
import path from 'path';
import fs from 'fs/promises';
import { getKnowledgeGraph } from '../../knowledge-graph/index.js';
import { fileURLToPath } from 'url';

/**
 * Templates directory path (resolved relative to this module)
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '../../../templates');

/**
 * 命令标志到类型的映射
 */
const FLAG_MAPPING = {
  '--bug': 'bug',
  '-b': 'bug',
  '--question': 'question',
  '-q': 'question',
  '--adjust': 'adjustment',
  '-a': 'adjustment',
  '--adj': 'adjustment',
  '--refactor': 'refactor',
  '-r': 'refactor',
  '--ref': 'refactor',
  '--auto': 'auto',
  '--feature': 'feature',
  '-f': 'feature',
};

/**
 * Load template file and substitute ${KEY} placeholders
 * 模板名可含子目录（如 spec/background.md.tpl），resolve 后校验不越出模板目录
 */
async function loadTemplate(templateName, vars) {
  const root = path.resolve(TEMPLATES_DIR);
  const tplPath = path.resolve(root, String(templateName));
  if (tplPath !== root && !tplPath.startsWith(root + path.sep)) {
    throw new Error(`template path escapes templates directory: ${templateName}`);
  }
  const tpl = await fs.readFile(tplPath, 'utf-8');
  let result = tpl;
  for (const [key, val] of Object.entries(vars)) {
    result = result.split(`\${${key}}`).join(String(val));
  }
  return result;
}

/**
 * Copy sub-file templates into a sub-directory under reqPath
 */
async function copySubTemplates(reqPath, subdir, tplFiles, vars) {
  const subDirPath = path.join(reqPath, subdir);
  await fs.mkdir(subDirPath, { recursive: true });
  for (const tplFile of tplFiles) {
    const content = await loadTemplate(path.join(subdir, tplFile), vars);
    await fs.writeFile(path.join(subDirPath, tplFile.replace('.tpl', '')), content, 'utf-8');
  }
}

/**
 * 需求处理器类
 */
export class Processor {
  /**
   * 构造函数
   * @param {string} baseDir - 基础目录路径
   */
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.requirementsDir = path.join(baseDir, '.requirements');
    this.index = new Map(); // ID 到路径的缓存索引
  }

  /**
   * 解析命令输入，提取类型、模式和描述
   * @param {string} input - 命令输入，例如 "/req --bug something is broken"
   * @returns {object} 包含 type, mode, description 的对象
   */
  static parseType(input) {
    // 移除 /req 前缀（如果存在）
    let cleanedInput = input.replace(/^\/req\s*/, '').trim();

    // 初始化默认值
    let type = 'feature';
    let mode = 'semi_auto';
    let description;

    // 检查是否是 --auto 模式
    if (cleanedInput.startsWith('--auto')) {
      mode = 'full_auto';
      cleanedInput = cleanedInput.replace(/^--auto\s*/, '').trim();
    }

    // 检查其他标志
    for (const [flag, flagType] of Object.entries(FLAG_MAPPING)) {
      if (flag === '--auto') continue; // 已经处理过

      if (cleanedInput.startsWith(flag)) {
        if (flagType !== 'auto') {
          type = flagType;
        }
        cleanedInput = cleanedInput.replace(new RegExp(`^${flag}\\s*`), '').trim();
        break;
      }
    }

    // 剩余部分作为描述
    description = cleanedInput;

    return {
      type,
      mode,
      description,
    };
  }

  /**
   * 创建新需求
   * @param {object} parsed - 解析后的需求对象 { type, mode, description }
   * @returns {Promise<object>} 包含 id 和 path 的对象
   */
  async create(parsed) {
    const { type, mode, description } = parsed;

    // 生成 ID (现在生成ID是异步操作)
    const id = await generate(type);
    const prefix = TYPE_PREFIXES[type];

    // 确定类型目录
    const typeDir = TYPE_DIRS[type] || `${type}s`;

    // 创建目录结构
    const reqPath = path.join(this.requirementsDir, typeDir, id);

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

    await writeMeta(this.baseDir, reqPath, meta);

    // 创建原始需求文件
    const rawPath = path.join(reqPath, 'raw.md');
    const rawContent = `# ${description}\n\n${description}`;
    await fs.writeFile(rawPath, rawContent, 'utf-8');

    // 创建 Agent 上下文文件，告诉 skills 应该将文档保存到这里
    const contextPath = path.join(reqPath, '.agent-context.md');
    const contextContent = `# 需求上下文文件（Agent 指引）

## 当前需求

- **ID**: ${id}
- **类型**: ${type}
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
    await fs.writeFile(contextPath, contextContent, 'utf-8');

    // 预生成骨架文件，避免后续步骤遗漏
    const title = meta.title;
    const date = now.slice(0, 10);
    const tplVars = { ID: id, TYPE: type, TITLE: title, DATE: date };
    await fs.writeFile(path.join(reqPath, 'spec.md'), await loadTemplate('spec.md.tpl', tplVars), 'utf-8');
    await fs.writeFile(path.join(reqPath, 'plan.md'), await loadTemplate('plan.md.tpl', tplVars), 'utf-8');
    await fs.writeFile(path.join(reqPath, 'test-cases.md'), await loadTemplate('test-cases.md.tpl', tplVars), 'utf-8');

    // 创建子目录骨架
    await copySubTemplates(reqPath, 'spec', ['background.md.tpl', 'user-stories.md.tpl', 'design.md.tpl', 'api.md.tpl', 'decisions.md.tpl'], tplVars);
    await copySubTemplates(reqPath, 'plan', ['tasks.md.tpl', 'milestones.md.tpl'], tplVars);
    await copySubTemplates(reqPath, 'test-cases', ['positive.md.tpl', 'negative.md.tpl', 'boundary.md.tpl'], tplVars);

    // 更新索引
    this.index.set(id, reqPath);

    // 同步到知识图谱
    try {
      const graph = await getKnowledgeGraph(this.baseDir);
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
        if (!(await isProjectInitialized(this.baseDir))) {
          await initializeProjectDocs(this.baseDir, { actor: 'auto-create' });
        }
      } catch (_projectSyncError) {
        // Auto-init failure must never break requirement creation.
        try {
          const { logProjectSyncError } = await import('../project-sync/index.js');
          await logProjectSyncError(this.baseDir, id, _projectSyncError);
        } catch (_logError) {
          // Silently swallow log failures to keep create() resilient.
        }
      }
    }

    return {
      id,
      path: reqPath,
    };
  }

  /**
   * 更新需求状态
   * @param {string} id - 需求 ID
   * @param {object} updates - 要更新的字段
   * @returns {Promise<void>}
   */
  async update(id, updates) {
    const reqPath = this.getRequirementPath(id);

    if (!reqPath) {
      throw new Error(`Requirement not found: ${id}`);
    }

    // 读取现有元数据
    const meta = await readMeta(this.baseDir, reqPath);

    if (!meta) {
      throw new Error(`Metadata not found for requirement: ${id}`);
    }

    // 状态字段统一走规范口径：旧词表自动归一，未知状态直接拒绝
    if (updates.status !== undefined) {
      const normalized = normalizeStatus(updates.status);
      if (!normalized) {
        throw new Error(`Invalid status: ${updates.status} (allowed: ${STATUSES.join(', ')})`);
      }
      updates.status = normalized;
    }

    // 更新字段
    const updatedMeta = {
      ...meta,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // 状态进入 done 时由引擎补写完成时间，不再依赖调用方自觉
    if (updates.status === 'done' && meta.status !== 'done' && !updatedMeta.completed) {
      updatedMeta.completed = updatedMeta.updatedAt;
    }

    // 写回元数据
    await writeMeta(this.baseDir, reqPath, updatedMeta);

    // 同步状态到 plan.md
    await syncPlanStatus(this.baseDir, reqPath);

    // 同步索引表（待填充 → 已填充）
    await syncIndexTables(reqPath);

    // 同步到知识图谱
    try {
      const graph = await getKnowledgeGraph(this.baseDir);
      await graph.updateRequirement(id, {
        status: updatedMeta.status,
        title: updatedMeta.title,
        description: updatedMeta.description,
      });
    } catch (_error) {
      // 知识图谱同步失败不影响主流程
    }

    // 新增：状态变为 done 时触发 project 文档同步
    if (updates.status === 'done' && meta.status !== 'done' && process.env.CRS_PROJECT_SYNC !== 'off') {
      try {
        const { syncOnRequirementDone, syncOnBugFixed } = await import('../project-sync/index.js');
        if (updatedMeta.type === 'bug') {
          await syncOnBugFixed(this.baseDir, id);
        } else {
          await syncOnRequirementDone(this.baseDir, id);
        }
      } catch (_error) {
        // 同步失败不影响主流程，仅记录日志
        try {
          const { logProjectSyncError } = await import('../project-sync/index.js');
          await logProjectSyncError(this.baseDir, id, _error);
        } catch (_logError) {
          // 彻底静默
        }
      }
    }
  }

  /**
   * 跟踪需求文档变化并更新元数据
   * @param {string} id - 需求 ID
   * @returns {Promise<object>} 更新后的元数据
   */
  async trackDocuments(id) {
    const reqPath = this.getRequirementPath(id);

    if (!reqPath) {
      throw new Error(`Requirement not found: ${id}`);
    }

    // 使用 document-tracker 更新元数据
    const updatedMeta = await trackDocuments(this.baseDir, reqPath);

    // 同步索引表（待填充 → 已填充）
    await syncIndexTables(reqPath);

    // 同步到知识图谱
    try {
      const graph = await getKnowledgeGraph(this.baseDir);
      await graph.updateRequirement(id, {
        status: updatedMeta.status,
        title: updatedMeta.title,
        description: updatedMeta.description,
      });
    } catch (_error) {
      // 知识图谱同步失败不影响主流程
    }

    return updatedMeta;
  }

  /**
   * 获取需求详情
   * @param {string} id - 需求 ID
   * @returns {Promise<object>} 需求详情对象
   */
  async get(id) {
    const reqPath = this.getRequirementPath(id);

    if (!reqPath) {
      throw new Error(`Requirement not found: ${id}`);
    }

    const meta = await readMeta(this.baseDir, reqPath);

    if (!meta) {
      throw new Error(`Metadata not found for requirement: ${id}`);
    }

    return meta;
  }

  /**
   * 获取需求路径
   * @param {string} id - 需求 ID
   * @returns {string|null} 需求路径，如果不存在则返回 null
   */
  getRequirementPath(id) {
    // 如果索引中有，直接返回
    if (this.index.has(id)) {
      return this.index.get(id);
    }

    // ID 只允许 字母/数字/短横线，拒绝路径片段（防路径穿越）
    if (typeof id !== 'string' || !/^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/.test(id)) {
      return null;
    }

    // 否则，搜索文件系统
    // 从 ID 解析类型
    const prefix = id.split('-')[0];
    const type = Object.entries(TYPE_PREFIXES).find(([, p]) => p === prefix)?.[0];

    if (!type) {
      return null;
    }

    const typeDir = TYPE_DIRS[type] || `${type}s`;
    const reqPath = path.join(this.requirementsDir, typeDir, id);

    // 验证路径是否存在
    return reqPath;
  }

  /**
   * 删除需求
   * @param {string} id - 需求 ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const reqPath = this.getRequirementPath(id);

    if (!reqPath) {
      return false;
    }

    try {
      // 删除目录
      await fs.rm(reqPath, { recursive: true, force: true });

      // 从索引中移除
      this.index.delete(id);

      // 从知识图谱中移除
      try {
        const graph = await getKnowledgeGraph(this.baseDir);
        await graph.deleteRequirement(id);
      } catch (_error) {
        // 知识图谱同步失败不影响主流程
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to delete requirement: ${error.message}`, { cause: error });
    }
  }

  /**
   * 重建索引（扫描文件系统）
   * @returns {Promise<void>}
   */
  async rebuildIndex() {
    this.index.clear();

    for (const [type, dir] of Object.entries(TYPE_DIRS)) {
      const typePath = path.join(this.requirementsDir, dir);

      try {
        const entries = await fs.readdir(typePath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            this.index.set(entry.name, path.join(typePath, entry.name));
          }
        }
      } catch (error) {
        // 忽略不存在的目录
        if (error.code !== 'ENOENT') {
          console.error(`Error scanning directory ${typePath}:`, error);
        }
      }
    }
  }
}

export default Processor;
