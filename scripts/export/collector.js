/**
 * Collector - 数据聚合器
 *
 * 扫描 .requirements/ 收集所有数据，组装为统一的 ReportData 对象。
 * 单个需求解析失败时记录警告并跳过，不阻塞整体导出。
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { exists } from '../requirement-manager/utils/storage.js';
import { REQ_TYPES, EXPORT_VERSION } from './types.js';

/**
 * 读取文件内容（失败时返回空字符串）
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function readFileSafe(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (_error) {
    return '';
  }
}

/**
 * 解析 meta.yaml
 * @param {string} filePath
 * @returns {Promise<object|null>}
 */
async function readMetaYaml(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return yaml.load(content);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * 从 markdown 中提取 frontmatter 中的 dependencies
 * @param {string} content
 * @returns {string[]}
 */
function extractDependencies(content) {
  if (!content) return [];
  const deps = [];
  // 匹配 markdown 链接中的需求 ID
  const pattern = /(?:FEAT|BUG|QUES|ADJU|REF|DEBT)-[\w-]+/g;
  const matches = content.match(pattern);
  if (matches) {
    for (const m of matches) {
      if (!deps.includes(m)) deps.push(m);
    }
  }
  return deps;
}

/**
 * 扫描单个需求目录
 * @param {string} reqDir - 需求目录绝对路径
 * @param {string} type - 需求类型单数（feature/bug/...）
 * @returns {Promise<object|null>}
 */
async function collectRequirement(reqDir, type) {
  const metaPath = path.join(reqDir, 'meta.yaml');
  const meta = await readMetaYaml(metaPath);
  if (!meta || !meta.id) return null;

  // 读取 spec 子目录
  const specDir = path.join(reqDir, 'spec');
  const spec = {
    background: await readFileSafe(path.join(specDir, 'background.md')),
    userStories: await readFileSafe(path.join(specDir, 'user-stories.md')),
    design: await readFileSafe(path.join(specDir, 'design.md')),
    api: await readFileSafe(path.join(specDir, 'api.md')),
    decisions: await readFileSafe(path.join(specDir, 'decisions.md')),
  };

  // 兼容根 spec.md
  if (!spec.background && !spec.design) {
    const rootSpec = await readFileSafe(path.join(reqDir, 'spec.md'));
    if (rootSpec) {
      spec.background = rootSpec;
    }
  }

  // 提取依赖
  const allContent = `${spec.design || ''} ${spec.background || ''}`;
  const dependencies = extractDependencies(allContent).filter((id) => id !== meta.id);

  return {
    id: meta.id,
    // 优先用 meta.type（标准单数形式），fallback 到目录推断
    type: meta.type || type,
    title: meta.title || meta.description || '(无标题)',
    description: meta.description || '',
    status: meta.status || 'unknown',
    priority: meta.priority
      ? {
          level: meta.priority.level || 'P?',
          score: Number(meta.priority.score) || 0,
        }
      : null,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    createdAt: meta.created || meta.createdAt || '',
    updatedAt: meta.updated || meta.updatedAt || '',
    spec,
    dependencies,
    rawPath: reqDir,
  };
}

/**
 * 目录名 → 需求类型单数 映射
 * 目录用复数（features/bugs），类型语义用单数（feature/bug）
 */
const DIR_TO_TYPE = {
  features: 'feature',
  bugs: 'bug',
  questions: 'question',
  adjustments: 'adjustment',
  refactors: 'refactor',
};

/**
 * 扫描所有需求
 * @param {string} requirementsDir
 * @param {object} hooks - { onWarning(message) }
 * @returns {Promise<{requirements: object[], warnings: string[]}>}
 */
async function collectAllRequirements(requirementsDir, hooks = {}) {
  const warnings = [];
  const requirements = [];

  for (const dirName of REQ_TYPES) {
    const typeDir = path.join(requirementsDir, dirName);
    if (!(await exists(typeDir))) continue;

    const type = DIR_TO_TYPE[dirName] || dirName.replace(/s$/, '');

    let entries = [];
    try {
      entries = await fs.readdir(typeDir, { withFileTypes: true });
    } catch (error) {
      warnings.push(`无法读取目录 ${dirName}: ${error.message}`);
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const reqDir = path.join(typeDir, entry.name);
      try {
        const req = await collectRequirement(reqDir, type);
        if (req) {
          requirements.push(req);
        } else {
          warnings.push(`跳过 ${dirName}/${entry.name}: meta.yaml 无效`);
        }
      } catch (error) {
        warnings.push(`跳过 ${dirName}/${entry.name}: ${error.message}`);
      }
    }
  }

  if (warnings.length && hooks.onWarning) {
    for (const w of warnings) hooks.onWarning(w);
  }

  return { requirements, warnings };
}

/**
 * 收集项目级文档
 * @param {string} requirementsDir
 * @returns {Promise<object|null>}
 */
async function collectProject(requirementsDir) {
  const projectDir = path.join(requirementsDir, 'project');
  if (!(await exists(projectDir))) return null;

  const meta = await readMetaYaml(path.join(projectDir, 'meta.yaml'));

  return {
    meta,
    structure: await readFileSafe(path.join(projectDir, 'project-structure.md')),
    businessReq: await readFileSafe(path.join(projectDir, 'business-requirements.md')),
    functionalReq: await readFileSafe(path.join(projectDir, 'functional-requirements.md')),
    functionalDesign: await readFileSafe(path.join(projectDir, 'functional-design.md')),
  };
}

/**
 * 解析 changelog.md 中的时间线条目
 * @param {string} requirementsDir
 * @returns {Promise<object[]>}
 */
async function collectChangelog(requirementsDir) {
  const content = await readFileSafe(path.join(requirementsDir, 'project', 'changelog.md'));
  if (!content) return [];

  const entries = [];
  // 兼容两种格式：1) "## [ISO]" 章节  2) project/meta.yaml sync_log
  const sectionPattern = /^## \[([^\]]+)\]\s*(.*)$/gm;
  let match;
  while ((match = sectionPattern.exec(content)) !== null) {
    const timestamp = match[1];
    const title = match[2] || '';
    // 从后续行提取 reqId
    const sectionStart = match.index + match[0].length;
    const nextSection = content.indexOf('\n## ', sectionStart);
    const sectionBody = content.slice(sectionStart, nextSection < 0 ? undefined : nextSection);
    const reqIdMatch = sectionBody.match(/[-*]\s*\*\*来源\*\*:\s*`?([^\s`]+)/);
    entries.push({
      timestamp,
      title,
      reqId: reqIdMatch ? reqIdMatch[1] : null,
      action: title,
      actor: 'system',
    });
  }

  // 备用：解析 project/meta.yaml sync_log
  if (entries.length === 0) {
    const project = await collectProject(requirementsDir);
    if (project?.meta?.sync_log) {
      for (const log of project.meta.sync_log) {
        entries.push({
          timestamp: log.timestamp,
          title: log.action,
          reqId: log.reqId,
          action: log.action,
          actor: log.actor || 'system',
        });
      }
    }
  }

  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * 计算 stats 聚合
 * @param {object[]} requirements
 * @returns {object}
 */
function computeStats(requirements) {
  const byType = {};
  const byStatus = {};
  const byPriority = {};

  for (const req of requirements) {
    byType[req.type] = (byType[req.type] || 0) + 1;
    byStatus[req.status] = (byStatus[req.status] || 0) + 1;
    const level = req.priority?.level || 'P?';
    byPriority[level] = (byPriority[level] || 0) + 1;
  }

  return { byType, byStatus, byPriority };
}

/**
 * 主入口：收集所有数据
 * @param {string} requirementsDir
 * @param {object} options
 * @param {string} options.projectName
 * @param {string} options.version
 * @param {object} [options.hooks]
 * @returns {Promise<object>}
 */
export async function collect(requirementsDir, options = {}) {
  const { requirements, warnings } = await collectAllRequirements(requirementsDir, options.hooks || {});
  const project = await collectProject(requirementsDir);
  const changelog = await collectChangelog(requirementsDir);
  const stats = computeStats(requirements);

  const meta = {
    projectName: options.projectName || project?.meta?.project_name || path.basename(path.dirname(requirementsDir)),
    version: options.version || project?.meta?.version || 'unknown',
    generatedAt: new Date().toISOString(),
    totalReqs: requirements.length,
    generatorVersion: EXPORT_VERSION,
  };

  return {
    meta,
    project,
    requirements,
    changelog,
    stats,
    warnings,
  };
}

export default { collect };
