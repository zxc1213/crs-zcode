/**
 * 需求聚合器 - 遍历 .requirements/ 目录，分类聚合需求
 *
 * 职责：
 * - 遍历 features / bugs / refactors / adjustments 目录
 * - 仅返回 status === 'done' 的需求
 * - 提取每条需求的 title、background 摘要、tags
 * - 按业务模块（tags）归类
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

/**
 * 支持的需求类型 → 目录映射
 */
const TYPE_DIRS = {
  feature: 'features',
  bug: 'bugs',
  question: 'questions',
  adjustment: 'adjustments',
  refactor: 'refactors',
};

/**
 * 安全读取文件内容（失败返回 null）
 */
async function safeReadFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (_error) {
    return null;
  }
}

/**
 * 安全读取并解析 YAML meta.yaml
 * @param {string} metaPath
 * @returns {Promise<object|null>}
 */
async function readMeta(metaPath) {
  const content = await safeReadFile(metaPath);
  if (!content) return null;
  try {
    return yaml.load(content);
  } catch (_error) {
    return null;
  }
}

/**
 * 从 spec/background.md 提取摘要（第一段非空文本）
 * @param {string} specDirPath
 * @returns {Promise<string>}
 */
async function extractBackgroundSummary(specDirPath) {
  const bgPath = path.join(specDirPath, 'background.md');
  const content = await safeReadFile(bgPath);
  if (!content) return '';

  // 移除 frontmatter
  const stripped = content.replace(/^---\n[\s\S]*?\n---\n/, '');
  // 提取第一段（按空行分隔）
  const paragraphs = stripped
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('#') && !p.startsWith('|') && !p.startsWith('<!--'));
  return paragraphs[0] || '';
}

/**
 * 加载单条需求的详细信息
 * @param {string} reqDir - 需求目录路径
 * @returns {Promise<object|null>}
 */
async function loadRequirement(reqDir) {
  const meta = await readMeta(path.join(reqDir, 'meta.yaml'));
  if (!meta) return null;

  const summary = await extractBackgroundSummary(path.join(reqDir, 'spec'));

  // 实现/完成日期：优先 updated，回退 created
  const completedAt = meta.updated || meta.created || '';

  return {
    id: meta.id,
    type: meta.type,
    title: meta.title || meta.description?.split('\n')[0] || '(未命名)',
    description: meta.description || '',
    status: meta.status,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    priority: meta.priority || null,
    summary,
    completedAt,
    createdAt: meta.created || '',
    dir: reqDir,
  };
}

/**
 * 遍历指定类型目录，加载所有需求
 * @param {string} baseDir
 * @param {string} typeName
 * @returns {Promise<Array>}
 */
async function loadTypeRequirements(baseDir, typeName) {
  const dirName = TYPE_DIRS[typeName];
  if (!dirName) return [];
  const typeDir = path.join(baseDir, '.requirements', dirName);

  let entries;
  try {
    entries = await fs.readdir(typeDir, { withFileTypes: true });
  } catch (_error) {
    return [];
  }

  const results = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const reqDir = path.join(typeDir, entry.name);
    const req = await loadRequirement(reqDir);
    if (req) results.push(req);
  }
  return results;
}

/**
 * 聚合所有需求（按类型分组）
 * @param {string} baseDir
 * @param {object} options
 * @param {boolean} options.onlyDone - 仅返回 status=done（默认 true）
 * @returns {Promise<object>} { features, bugs, refactors, adjustments, questions, total, doneTotal }
 */
export async function aggregateRequirements(baseDir, options = {}) {
  const onlyDone = options.onlyDone !== false;

  const grouped = {
    features: [],
    bugs: [],
    refactors: [],
    adjustments: [],
    questions: [],
  };

  for (const typeName of Object.keys(TYPE_DIRS)) {
    const list = await loadTypeRequirements(baseDir, typeName);
    grouped[`${typeName}s`] = onlyDone ? list.filter((r) => r.status === 'done') : list;
  }

  const all = [...grouped.features, ...grouped.bugs, ...grouped.refactors, ...grouped.adjustments, ...grouped.questions];

  return {
    ...grouped,
    all,
    total: all.length,
  };
}

/**
 * 获取单条需求的聚合信息
 * @param {string} baseDir
 * @param {string} reqId
 * @returns {Promise<object|null>}
 */
export async function aggregateSingleRequirement(baseDir, reqId) {
  // 从 ID 前缀推断类型目录
  const prefix = reqId.split('-')[0];
  const prefixToType = {
    FEAT: 'feature',
    BUG: 'bug',
    QUES: 'question',
    ADJU: 'adjustment',
    REF: 'refactor',
    DEBT: 'tech-debt',
  };
  const type = prefixToType[prefix];
  if (!type) return null;

  const typeDir = TYPE_DIRS[type] || `${type}s`;
  const reqDir = path.join(baseDir, '.requirements', typeDir, reqId);

  try {
    await fs.access(reqDir);
  } catch (_error) {
    return null;
  }

  return loadRequirement(reqDir);
}

/**
 * 生成功能矩阵表格行（用于 functional-requirements.md）
 * @param {Array} features
 * @returns {string}
 */
export function formatFeatureTableRows(features) {
  if (!features.length) return '| _暂无已交付功能_ | - | - | - | - | - |';
  return features
    .map((f) => {
      const module = f.tags[0] || 'general';
      const date = (f.completedAt || '').slice(0, 10);
      return `| ${module} | ${f.title} | feature | ${f.status} | [${f.id}](../features/${f.id}/spec.md) | ${date} |`;
    })
    .join('\n');
}

/**
 * 生成功能详情段落
 * @param {Array} features
 * @returns {string}
 */
export function formatFeatureDetails(features) {
  if (!features.length) return '_暂无已交付功能_';
  return features
    .map((f) => {
      return `### ${f.title}\n\n- **ID**: \`${f.id}\`\n- **类型**: ${f.type}\n- **状态**: ${f.status}\n- **模块**: ${f.tags[0] || 'general'}\n- **摘要**: ${f.summary || '(无摘要)'}\n- **链接**: [查看详情](../features/${f.id}/spec.md)\n`;
    })
    .join('\n---\n\n');
}

/**
 * 生成业务需求表格
 * @param {Array} allReqs
 * @returns {string}
 */
export function formatBusinessTable(allReqs) {
  if (!allReqs.length) return '| _暂无业务需求_ | - | - |';
  return allReqs
    .map((r) => {
      return `| ${r.title} | ${r.type} | [${r.id}](../${TYPE_DIRS[r.type] || r.type + 's'}/${r.id}/spec.md) |`;
    })
    .join('\n');
}

export default {
  aggregateRequirements,
  aggregateSingleRequirement,
  formatFeatureTableRows,
  formatFeatureDetails,
  formatBusinessTable,
};
