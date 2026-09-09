/**
 * docs-map - 宿主项目文档地图（双层纳管的外层）
 *
 * `.requirements/project/docs-map.yaml` 登记宿主项目自身的文档（README、docs/ 等
 * .requirements/ 之外的 Markdown），用于：
 * - 里程碑（done/变更）时提示哪些外部文档可能需要同步更新
 * - 漂移检测：文件在 last_reviewed 之后又被改过 → 提示复核
 * - HTML 报告/仪表板展示"文档地图"
 *
 * 设计约束：
 * - 只登记、不代写：外部文档的内容更新由 LLM/用户完成，本模块负责"发现与提醒"
 * - 路径安全：登记路径必须是项目内相对路径，拒绝绝对路径与 .. 穿越
 * - 自动发现 + 手工精化：scanExternalDocs 猜测角色，LLM 可在命令流程中修正
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { loadConfig } from '../core/config.js';

/** 允许的角色 */
export const DOC_ROLES = ['readme', 'architecture', 'api', 'user-guide', 'changelog', 'requirements', 'other'];

/** 角色默认的同步提示时机 */
const ROLE_SYNC_ON = {
  readme: 'done',
  architecture: 'change',
  api: 'change',
  'user-guide': 'done',
  changelog: 'manual',
  requirements: 'change',
  other: 'manual',
};

/** 扫描时跳过的目录（.requirements 由内层纳管，不重复登记） */
const SCAN_IGNORE_DIRS = new Set(['.requirements', '.crs', '.git', 'node_modules', 'dist', 'build', 'coverage', '.test-requirements', 'vendor', '__pycache__']);

/** 文件名 → 角色猜测规则（顺序敏感） */
const ROLE_GUESS_RULES = [
  { pattern: /^readme/i, role: 'readme' },
  { pattern: /arch|design|架构|设计/i, role: 'architecture' },
  { pattern: /api|interface|接口/i, role: 'api' },
  { pattern: /changelog|history|变更/i, role: 'changelog' },
  { pattern: /guide|tutorial|manual|faq|指南|手册/i, role: 'user-guide' },
  { pattern: /requirement|prd|spec|需求/i, role: 'requirements' },
];

/**
 * docs-map 文件路径
 */
export function docsMapPath(baseDir) {
  return path.join(baseDir, '.requirements', 'project', 'docs-map.yaml');
}

/**
 * 读取文档地图
 * @returns {Promise<{docs: Array, exists: boolean}>}
 */
export async function readDocsMap(baseDir) {
  try {
    const content = await fs.readFile(docsMapPath(baseDir), 'utf-8');
    const parsed = yaml.load(content);
    return { docs: Array.isArray(parsed?.docs) ? parsed.docs : [], exists: true };
  } catch (_error) {
    return { docs: [], exists: false };
  }
}

/**
 * 写入文档地图
 */
async function writeDocsMap(baseDir, docs) {
  const filePath = docsMapPath(baseDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, yaml.dump({ docs }, { indent: 2, lineWidth: -1, noRefs: true }), 'utf-8');
}

/**
 * 校验登记路径：必须是项目内相对路径，拒绝绝对路径与 .. 穿越
 * @returns {string|null} 规范化后的相对路径；非法返回 null
 */
export function validateDocPath(baseDir, docPath) {
  if (!docPath || typeof docPath !== 'string' || path.isAbsolute(docPath)) return null;
  const root = path.resolve(baseDir);
  const target = path.resolve(root, docPath);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return path.relative(root, target).replace(/\\/g, '/');
}

/**
 * 根据文件名猜测角色
 */
function guessRole(fileName) {
  for (const rule of ROLE_GUESS_RULES) {
    if (rule.pattern.test(fileName)) return rule.role;
  }
  return 'other';
}

/**
 * 扫描宿主项目的外部文档（README、docs 目录下的 Markdown、根级 Markdown）
 * @param {string} baseDir
 * @param {object} options - { maxDepth: docs/ 下最大深度，默认取项目 config.yaml 的 docs_map.max_depth（缺省 3） }
 * @returns {Promise<Array<{path, title, role, sync_on}>>} 登记建议（未登记的）
 */
export async function scanExternalDocs(baseDir, options = {}) {
  let maxDepth = options.maxDepth;
  if (maxDepth === undefined || maxDepth === null) {
    maxDepth = (await loadConfig(baseDir)).docs_map.max_depth;
  }
  const root = path.resolve(baseDir);
  const candidates = [];

  // 根级 *.md / README*
  let rootEntries = [];
  try {
    rootEntries = await fs.readdir(root, { withFileTypes: true });
  } catch (_error) {
    return [];
  }
  for (const entry of rootEntries) {
    if (entry.isFile() && /\.md$/i.test(entry.name) && !entry.name.startsWith('.')) {
      candidates.push(entry.name);
    }
  }

  // docs/ 目录递归（含 doc/ documentation/）
  for (const docsDirName of ['docs', 'doc', 'documentation']) {
    const docsDir = path.join(root, docsDirName);
    await walkMarkdown(docsDir, docsDirName, maxDepth, candidates);
  }

  const { docs: registered } = await readDocsMap(baseDir);
  const registeredPaths = new Set(registered.map((d) => d.path));

  const suggestions = [];
  for (const relPath of candidates) {
    if (registeredPaths.has(relPath)) continue;
    const fileName = path.basename(relPath);
    const role = guessRole(fileName);
    suggestions.push({
      path: relPath,
      title: fileName.replace(/\.md$/i, ''),
      role,
      sync_on: ROLE_SYNC_ON[role] || 'manual',
    });
  }
  return suggestions;
}

/**
 * 递归收集 Markdown 文件（相对路径）
 */
async function walkMarkdown(dirPath, relPrefix, maxDepth, out) {
  if (maxDepth <= 0) return;
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (_error) {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || SCAN_IGNORE_DIRS.has(entry.name)) continue;
    const rel = `${relPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await walkMarkdown(path.join(dirPath, entry.name), rel, maxDepth - 1, out);
    } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
      out.push(rel);
    }
  }
}

/**
 * 登记一份外部文档（按 path 去重，角色非法回退 other）
 * @param {string} baseDir
 * @param {object} doc - { path, title?, role?, sync_on? }
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function registerDoc(baseDir, doc) {
  const relPath = validateDocPath(baseDir, doc?.path);
  if (!relPath) {
    return { success: false, message: `非法文档路径: ${doc?.path}（须为项目内相对路径，不允许 .. 与绝对路径）` };
  }

  // 文件必须真实存在
  try {
    await fs.access(path.join(baseDir, relPath));
  } catch (_error) {
    return { success: false, message: `文档不存在: ${relPath}` };
  }

  const role = DOC_ROLES.includes(doc.role) ? doc.role : guessRole(path.basename(relPath));
  const syncOn = ['done', 'change', 'manual'].includes(doc.sync_on) ? doc.sync_on : ROLE_SYNC_ON[role] || 'manual';

  const { docs } = await readDocsMap(baseDir);
  const existing = docs.find((d) => d.path === relPath);
  if (existing) {
    existing.title = doc.title || existing.title || path.basename(relPath, '.md');
    existing.role = role;
    existing.sync_on = syncOn;
    await writeDocsMap(baseDir, docs);
    return { success: true, message: `已更新登记: ${relPath} (${role}/${syncOn})` };
  }

  docs.push({
    path: relPath,
    title: doc.title || path.basename(relPath, '.md'),
    role,
    sync_on: syncOn,
    last_reviewed: null,
    source: doc.source || 'manual',
  });
  await writeDocsMap(baseDir, docs);
  return { success: true, message: `已登记: ${relPath} (${role}/${syncOn})` };
}

/**
 * 扫描并自动登记全部建议（初始化/定时体检用）
 * @returns {Promise<{registered: number, docs: Array}>}
 */
export async function autoRegisterScanned(baseDir) {
  const suggestions = await scanExternalDocs(baseDir);
  let registered = 0;
  for (const suggestion of suggestions) {
    const result = await registerDoc(baseDir, { ...suggestion, source: 'auto-scan' });
    if (result.success) registered++;
  }
  const { docs } = await readDocsMap(baseDir);
  return { registered, docs };
}

/**
 * 标记文档已复核（更新 last_reviewed）
 */
export async function markReviewed(baseDir, docPath) {
  const relPath = validateDocPath(baseDir, docPath);
  if (!relPath) return { success: false, message: `非法文档路径: ${docPath}` };

  const { docs } = await readDocsMap(baseDir);
  const doc = docs.find((d) => d.path === relPath);
  if (!doc) return { success: false, message: `未登记的文档: ${relPath}` };

  doc.last_reviewed = new Date().toISOString();
  await writeDocsMap(baseDir, docs);
  return { success: true, message: `已标记复核: ${relPath}` };
}

/**
 * 漂移检测
 *
 * 判定规则（诚实而克制——只提醒，不代改）：
 * - unconfirmed：已登记但从未确认过（last_reviewed 为空）
 * - stale：文件修改时间晚于 last_reviewed（登记后又改过，未确认内容是否仍准确）
 * - unregistered：扫描发现存在但未登记的文档
 *
 * @returns {Promise<{stale: Array, unconfirmed: Array, unregistered: Array, total: number}>}
 */
export async function checkDrift(baseDir) {
  const { docs } = await readDocsMap(baseDir);
  const stale = [];
  const unconfirmed = [];

  for (const doc of docs) {
    const absPath = path.join(baseDir, doc.path);
    let mtime;
    try {
      const stat = await fs.stat(absPath);
      mtime = stat.mtime.toISOString();
    } catch (_error) {
      stale.push({ ...doc, reason: '文件已不存在（可能被移动或删除）' });
      continue;
    }

    if (!doc.last_reviewed) {
      unconfirmed.push({ ...doc, mtime });
    } else if (mtime > doc.last_reviewed) {
      stale.push({ ...doc, mtime, last_reviewed: doc.last_reviewed });
    }
  }

  const unregistered = await scanExternalDocs(baseDir);

  return { stale, unconfirmed, unregistered, total: docs.length };
}

export default {
  DOC_ROLES,
  docsMapPath,
  readDocsMap,
  scanExternalDocs,
  registerDoc,
  autoRegisterScanned,
  markReviewed,
  checkDrift,
  validateDocPath,
};
