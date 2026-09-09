/**
 * project-sync 编排器 - 协调 4 个生成器，处理触发事件
 *
 * 核心 API：
 * - initializeProjectDocs(baseDir, options) - 初始化或修复 project 目录
 * - syncOnRequirementDone(baseDir, reqId) - 单需求完成同步
 * - syncOnBugFixed(baseDir, bugId) - Bug 修复同步（含设计变更判定）
 * - syncOnRequirementChange(baseDir, reqId, changeInfo) - 需求变更同步（区块替换语义）
 * - fullResync(baseDir) - 全量重生成
 *
 * 设计原则：
 * - 被动触发：不主动轮询
 * - 区块可更新：项目文档中的需求区块用 crs:block 标记包裹，done 聚合与变更同步均走 upsertBlock，
 *   需求后续变更会替换旧区块而不是被幂等跳过（历史进 changelog 与 timeline）
 * - 事件入账：所有同步动作追加 timeline.yaml 事件（项目历史唯一事实源）
 * - 静默降级：失败记录日志，不影响主流程
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

import { scanProjectStructure } from './structure-scanner.js';
import { aggregateRequirements, aggregateSingleRequirement, formatFeatureTableRows, formatFeatureDetails, formatBusinessTable } from './requirements-aggregator.js';
import { summarizeDesign, summarizeSingleDesign, detectDesignChange } from './design-summarizer.js';
import { appendEvent } from './timeline.js';
import { CHANGE_LEVELS, TYPE_PREFIXES, TYPE_DIRS } from '../core/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '../../../templates/project');

/**
 * 同步结果统一结构
 */
function newResult() {
  return {
    success: true,
    created: [],
    updated: [],
    errors: [],
    skipped: [],
    stats: { durationMs: 0 },
  };
}

/**
 * 加载模板并替换变量
 * @param {string} templateName - 模板文件名（含 .tpl 后缀）
 * @param {object} vars - 变量键值对
 * @returns {Promise<string>}
 */
async function loadTemplate(templateName, vars) {
  // 模板名只取 basename 并校验不越出模板目录
  const root = path.resolve(TEMPLATES_DIR);
  const tplPath = path.resolve(root, path.basename(String(templateName)));
  if (!tplPath.startsWith(root + path.sep)) {
    return `<!-- 模板路径非法: ${templateName} -->\n# 占位文档\n\n_模板加载失败_`;
  }
  try {
    const tpl = await fs.readFile(tplPath, 'utf-8');
    let result = tpl;
    for (const [key, val] of Object.entries(vars)) {
      result = result.split(`\${${key}}`).join(String(val ?? ''));
    }
    return result;
  } catch (_error) {
    return `<!-- 模板缺失: ${templateName} -->\n# 占位文档\n\n_模板加载失败_`;
  }
}

/**
 * 安全写入文件（确保目录存在）
 */
async function safeWrite(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * 检查 project 目录是否已初始化
 * @param {string} baseDir
 * @returns {Promise<boolean>}
 */
export async function isProjectInitialized(baseDir) {
  const projectDir = path.join(baseDir, '.requirements', 'project');
  try {
    await fs.access(path.join(projectDir, 'meta.yaml'));
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * 读取 project meta.yaml
 * @param {string} baseDir
 * @returns {Promise<object|null>}
 */
async function readProjectMeta(baseDir) {
  const metaPath = path.join(baseDir, '.requirements', 'project', 'meta.yaml');
  try {
    const content = await fs.readFile(metaPath, 'utf-8');
    return yaml.load(content);
  } catch (_error) {
    return null;
  }
}

/**
 * 写入 project meta.yaml
 */
async function writeProjectMeta(baseDir, meta) {
  const metaPath = path.join(baseDir, '.requirements', 'project', 'meta.yaml');
  const content = yaml.dump(meta, { indent: 2, lineWidth: -1, noRefs: true });
  await safeWrite(metaPath, content);
}

/**
 * 追加 changelog 条目
 * @param {string} baseDir
 * @param {object} entry - { timestamp, type, title, action, affectedDocs, source }
 */
async function appendChangelog(baseDir, entry) {
  const changelogPath = path.join(baseDir, '.requirements', 'project', 'changelog.md');
  let existing = '';
  try {
    existing = await fs.readFile(changelogPath, 'utf-8');
  } catch (_error) {
    existing = '# 项目变更历史\n\n> 由 CRS 自动维护，最新条目置顶。此文件只追加不删除。\n\n---\n';
  }

  // 切分头部和正文
  const headerEnd = existing.indexOf('\n---\n');
  const header = headerEnd >= 0 ? existing.slice(0, headerEnd + 5) : existing;
  const body = headerEnd >= 0 ? existing.slice(headerEnd + 5) : '';

  const lines = [`\n## [${entry.timestamp}] ${entry.id || entry.action}`, '', `- **类型**: ${entry.type}`, `- **标题**: ${entry.title}`, `- **动作**: ${entry.action}`];
  if (entry.affectedDocs?.length) {
    lines.push(`- **影响文档**: ${entry.affectedDocs.join(', ')}`);
  }
  if (entry.source) {
    lines.push(`- **来源**: ${entry.source}`);
  }
  if (entry.summary) {
    lines.push(`- **说明**: ${entry.summary}`);
  }
  if (entry.designChange !== undefined) {
    lines.push(`- **设计变更**: ${entry.designChange ? '是' : '否'}`);
  }

  const newSection = lines.join('\n') + '\n';
  const updated = `${header}\n${newSection}\n${body ? body.trimStart() : ''}`;
  await safeWrite(changelogPath, updated);
}

/**
 * 同步错误日志
 * @param {string} baseDir
 * @param {string} reqId
 * @param {Error} error
 */
export async function logProjectSyncError(baseDir, reqId, error) {
  const logsDir = path.join(baseDir, '.requirements', 'logs');
  const logPath = path.join(logsDir, 'project-sync.error.log');
  const ts = new Date().toISOString();
  const entry = `[${ts}] reqId=${reqId || '-'} error=${error.message}\n${error.stack || ''}\n\n`;
  try {
    await safeWrite(logPath, entry);
  } catch (_error) {
    // 日志写入失败彻底静默
  }
}

/**
 * 获取当前 ISO8601 UTC 时间戳
 */
function now() {
  return new Date().toISOString();
}

/**
 * 更新 meta.yaml 的 sync_log 和 stats
 */
async function updateProjectMetaStats(baseDir, action, reqId = null) {
  const meta = (await readProjectMeta(baseDir)) || {
    version: 1,
    project_name: path.basename(baseDir),
    created: now(),
    updated: now(),
    stats: { total_requirements: 0, done_requirements: 0, last_synced_req: null },
    sync_log: [],
  };

  meta.updated = now();
  if (reqId) meta.stats.last_synced_req = reqId;
  meta.sync_log = meta.sync_log || [];
  meta.sync_log.unshift({
    timestamp: meta.updated,
    action,
    actor: 'system',
    reqId,
  });
  // 仅保留最近 10 条
  meta.sync_log = meta.sync_log.slice(0, 10);

  await writeProjectMeta(baseDir, meta);
}

/**
 * 初始化 project 文档（生成 4 份核心文档）
 * @param {string} baseDir
 * @param {object} options
 * @param {boolean} options.force - 强制重建
 * @param {string} options.actor - 触发者（默认 system）
 * @returns {Promise<object>} SyncResult
 */
export async function initializeProjectDocs(baseDir, options = {}) {
  const result = newResult();
  const start = Date.now();
  const actor = options.actor || 'system';
  const ts = now();

  try {
    const projectDir = path.join(baseDir, '.requirements', 'project');
    const alreadyInit = await isProjectInitialized(baseDir);

    if (alreadyInit && !options.force) {
      result.skipped.push('project (already initialized)');
      result.stats.durationMs = Date.now() - start;
      return result;
    }

    // 备份（force 模式下）
    if (alreadyInit && options.force) {
      const backupDir = `${projectDir}.bak`;
      try {
        await fs.rm(backupDir, { recursive: true, force: true });
        await fs.rename(projectDir, backupDir);
      } catch (_error) {
        // 备份失败继续
      }
    }

    await fs.mkdir(projectDir, { recursive: true });

    // 1. 扫描项目结构
    const structure = await scanProjectStructure(baseDir);

    // 2. 聚合需求
    const aggregated = await aggregateRequirements(baseDir, { onlyDone: true });

    // 3. 提炼设计
    const designSummary = await summarizeDesign(
      baseDir,
      aggregated.all.map((r) => ({ id: r.id, type: r.type }))
    );

    // 4. 渲染模板
    const commonVars = {
      UPDATED_AT: ts,
      CREATED_AT: ts,
      PROJECT_NAME: structure.packageInfo.name,
      PROJECT_DESCRIPTION: structure.description,
      PROJECT_ENTRY: structure.packageInfo.main,
      PROJECT_VERSION: structure.packageInfo.version,
      ACTOR: actor,
    };

    const structureDoc = await loadTemplate('project-structure.md.tpl', {
      ...commonVars,
      DIRECTORY_TREE: structure.tree,
      MODULES_TABLE: structure.modulesTable,
      DEPENDENCIES_LIST: structure.dependenciesList,
    });
    await safeWrite(path.join(projectDir, 'project-structure.md'), structureDoc);
    result.created.push('project-structure.md');

    const businessDoc = await loadTemplate('business-requirements.md.tpl', {
      ...commonVars,
      BUSINESS_GOALS: deriveBusinessGoals(structure, aggregated),
      USER_ROLES: deriveUserRoles(),
      BUSINESS_FLOWS: '_待补充（基于已完成需求汇总）_',
      BUSINESS_REQUIREMENTS_TABLE: formatBusinessTable(aggregated.all),
    });
    await safeWrite(path.join(projectDir, 'business-requirements.md'), businessDoc);
    result.created.push('business-requirements.md');

    const functionalDoc = await loadTemplate('functional-requirements.md.tpl', {
      ...commonVars,
      TOTAL_FEATURES: aggregated.features.length,
      FEATURE_TABLE_ROWS: formatFeatureTableRows(aggregated.features),
      FEATURE_DETAILS: formatFeatureDetails(aggregated.features),
    });
    await safeWrite(path.join(projectDir, 'functional-requirements.md'), functionalDoc);
    result.created.push('functional-requirements.md');

    const designDoc = await loadTemplate('functional-design.md.tpl', {
      ...commonVars,
      ARCHITECTURE_SUMMARY: designSummary.architectureSummary,
      COMPONENTS_SUMMARY: designSummary.componentsSummary,
      DATAFLOW_SUMMARY: designSummary.dataflowSummary,
      DECISIONS_SUMMARY: designSummary.decisionsSummary,
    });
    await safeWrite(path.join(projectDir, 'functional-design.md'), designDoc);
    result.created.push('functional-design.md');

    // 5. changelog（仅初始化时）
    if (!alreadyInit) {
      const changelogDoc = await loadTemplate('changelog.md.tpl', commonVars);
      await safeWrite(path.join(projectDir, 'changelog.md'), changelogDoc);
      result.created.push('changelog.md');
    }

    // 6. meta.yaml
    const metaContent = await loadTemplate('meta.yaml.tpl', commonVars);
    await safeWrite(path.join(projectDir, 'meta.yaml'), metaContent);
    if (!alreadyInit) result.created.push('meta.yaml');
    else result.updated.push('meta.yaml');

    // 6.5 文档地图：自动登记宿主项目外部文档（README/docs 等）
    try {
      const { autoRegisterScanned } = await import('./docs-map.js');
      const { registered } = await autoRegisterScanned(baseDir);
      if (registered > 0) {
        result.created.push(`docs-map.yaml (${registered} docs)`);
        await recordEvent(baseDir, {
          type: 'docs_registered',
          title: '文档地图初始化',
          summary: `自动登记 ${registered} 份宿主项目文档`,
        });
      }
    } catch (_docsMapError) {
      // 文档地图失败不影响初始化
    }

    // 7. 更新统计
    await updateProjectMetaStats(baseDir, 'initialize', null);
  } catch (error) {
    result.success = false;
    result.errors.push(error.message);
    await logProjectSyncError(baseDir, null, error);
  }

  result.stats.durationMs = Date.now() - start;
  return result;
}

/**
 * 推导业务目标（基于 package.json description 和需求聚合）
 */
function deriveBusinessGoals(structure, aggregated) {
  const goals = [];
  if (structure.description && !structure.description.startsWith('(')) {
    goals.push(`- ${structure.description}`);
  }
  if (aggregated.total > 0) {
    goals.push(`- 已交付 ${aggregated.total} 个需求（功能 ${aggregated.features.length}、缺陷 ${aggregated.bugs.length}、重构 ${aggregated.refactors.length}）`);
  }
  if (!goals.length) goals.push('- _待补充_');
  return goals.join('\n');
}

/**
 * 推导用户角色（默认）
 */
function deriveUserRoles() {
  return `- **开发者**: 通过 CRS 管理需求和实现
- **AI 助手（Claude Code）**: 跨会话恢复项目上下文
- **项目维护者**: 通过 project 文档了解项目全貌`;
}

/**
 * 单需求完成后同步
 * @param {string} baseDir
 * @param {string} reqId
 * @returns {Promise<object>} SyncResult
 */
export async function syncOnRequirementDone(baseDir, reqId) {
  const result = newResult();
  const start = Date.now();
  const ts = now();

  try {
    // project 未初始化则先初始化
    if (!(await isProjectInitialized(baseDir))) {
      await initializeProjectDocs(baseDir);
    }

    const single = await aggregateSingleRequirement(baseDir, reqId);
    if (!single) {
      result.success = false;
      result.errors.push(`E_PROJ_REQ_NOT_FOUND: ${reqId}`);
      result.stats.durationMs = Date.now() - start;
      return result;
    }

    const affectedDocs = [];

    // 根据类型路由（upsertBlock：已有区块则替换，保证需求后续变更能同步进来）
    if (single.type === 'feature' || single.type === 'adjustment') {
      // 更新 functional-requirements.md
      await upsertBlock(baseDir, 'functional-requirements.md', '## 功能详情', reqId, formatFeatureDetails([single]));
      affectedDocs.push('functional-requirements.md');

      // feature 类型也更新 business
      if (single.type === 'feature') {
        await upsertBlock(baseDir, 'business-requirements.md', '## 业务需求清单', reqId, `### ${single.title}\n\n- **ID**: \`${single.id}\`\n- **摘要**: ${single.summary || '(无摘要)'}\n`);
        affectedDocs.push('business-requirements.md');
      }
    }

    if (single.type === 'refactor' || single.type === 'feature') {
      // 提取设计要点
      const singleDesign = await summarizeSingleDesign(baseDir, reqId);
      if (singleDesign && singleDesign.sections.length) {
        const designText = singleDesign.sections.map((s) => `### 来自 \`${reqId}\` — ${s.title}\n\n${s.body.slice(0, 500)}${s.body.length > 500 ? '...' : ''}\n`).join('\n---\n\n');
        await upsertBlock(baseDir, 'functional-design.md', '## 关键设计决策', reqId, designText);
        affectedDocs.push('functional-design.md');
      }
    }

    // 追加 changelog
    await appendChangelog(baseDir, {
      timestamp: ts,
      id: reqId,
      type: single.type,
      title: single.title,
      action: 'requirement-done',
      affectedDocs,
      source: reqId,
    });

    // 更新 meta
    await updateProjectMetaStats(baseDir, 'requirement-done', reqId);

    // 时间线事件
    await recordEvent(baseDir, {
      type: 'project_synced',
      reqId,
      title: single.title,
      summary: `需求完成同步，更新 ${affectedDocs.length} 份项目文档`,
    });

    result.updated.push(...affectedDocs);
  } catch (error) {
    result.success = false;
    result.errors.push(error.message);
    await logProjectSyncError(baseDir, reqId, error);
  }

  result.stats.durationMs = Date.now() - start;
  return result;
}

/**
 * Bug 修复后同步
 * @param {string} baseDir
 * @param {string} bugId
 * @returns {Promise<object>} SyncResult
 */
export async function syncOnBugFixed(baseDir, bugId) {
  const result = newResult();
  const start = Date.now();
  const ts = now();

  try {
    if (!(await isProjectInitialized(baseDir))) {
      await initializeProjectDocs(baseDir);
    }

    const single = await aggregateSingleRequirement(baseDir, bugId);
    if (!single) {
      result.success = false;
      result.errors.push(`E_PROJ_REQ_NOT_FOUND: ${bugId}`);
      result.stats.durationMs = Date.now() - start;
      return result;
    }

    // 检测设计变更（前缀 → 目录口径来自 schema；非 bug/DEBT 前缀回退 bugs 目录兼容旧调用）
    const prefix = bugId.split('-')[0];
    const type = Object.entries(TYPE_PREFIXES).find(([, p]) => p === prefix)?.[0] || 'bug';
    const bugDir = path.join(baseDir, '.requirements', TYPE_DIRS[type], bugId);

    const { hasDesignChange, reason } = await detectDesignChange(bugDir);
    const affectedDocs = [];

    if (hasDesignChange) {
      // 同步到 functional-design.md
      const designSummary = await summarizeSingleDesign(baseDir, bugId);
      if (designSummary && designSummary.sections.length) {
        const designText = designSummary.sections.map((s) => `### 来自 \`${bugId}\` (Bug 设计变更) — ${s.title}\n\n${s.body.slice(0, 500)}${s.body.length > 500 ? '...' : ''}\n`).join('\n---\n\n');
        await upsertBlock(baseDir, 'functional-design.md', '## 关键设计决策', bugId, designText);
        affectedDocs.push('functional-design.md');
      } else {
        // 即使没提取到 section，也追加一条占位
        await upsertBlock(baseDir, 'functional-design.md', '## 关键设计决策', bugId, `### 来自 \`${bugId}\` (Bug 设计变更)\n\n_详见 [原始 Bug 文档](../bugs/${bugId}/spec/decisions.md)_\n`);
        affectedDocs.push('functional-design.md');
      }
    } else {
      result.skipped.push('design-doc (no design_change)');
    }

    // 追加 changelog（必加）
    await appendChangelog(baseDir, {
      timestamp: ts,
      id: bugId,
      type: single.type,
      title: single.title,
      action: 'bug-fixed',
      affectedDocs,
      source: bugId,
      designChange: hasDesignChange,
    });

    await updateProjectMetaStats(baseDir, 'bug-fixed', bugId);

    // 时间线事件
    await recordEvent(baseDir, {
      type: 'bug_fixed',
      reqId: bugId,
      title: single.title,
      summary: hasDesignChange ? `Bug 修复并产生设计变更：${reason}` : 'Bug 修复，无设计变更',
    });
    if (hasDesignChange) {
      await recordEvent(baseDir, {
        type: 'design_change',
        reqId: bugId,
        title: single.title,
        summary: `Bug 修复触发设计变更：${reason}`,
      });
    }

    result.updated.push(...affectedDocs);
  } catch (error) {
    result.success = false;
    result.errors.push(error.message);
    await logProjectSyncError(baseDir, bugId, error);
  }

  result.stats.durationMs = Date.now() - start;
  return result;
}

/**
 * 需求变更后同步（req-change 流程的引擎侧落点）
 *
 * 与 done 同步的区别：
 * - 无论需求是否 done 都会记录变更（changelog + 时间线）
 * - 已聚合进项目文档的需求（曾 done 过）会重聚合并以区块替换语义更新旧条目，
 *   解决"需求 done 后再变更，项目文档永远是旧内容"的问题
 *
 * @param {string} baseDir
 * @param {string} reqId
 * @param {object} changeInfo - { level: small|medium|large, reason, summary? }
 * @returns {Promise<object>} SyncResult
 */
export async function syncOnRequirementChange(baseDir, reqId, changeInfo = {}) {
  const result = newResult();
  const start = Date.now();
  const ts = now();
  const level = CHANGE_LEVELS.includes(changeInfo.level) ? changeInfo.level : 'medium';
  const reason = String(changeInfo.reason || '').slice(0, 500);

  try {
    if (!(await isProjectInitialized(baseDir))) {
      await initializeProjectDocs(baseDir);
    }

    const single = await aggregateSingleRequirement(baseDir, reqId);
    if (!single) {
      result.success = false;
      result.errors.push(`E_PROJ_REQ_NOT_FOUND: ${reqId}`);
      result.stats.durationMs = Date.now() - start;
      return result;
    }

    const affectedDocs = [];

    // 仅当该需求已聚合过（done 过）才回写项目文档，未聚合的活跃需求只记录
    const functionalDocPath = path.join(baseDir, '.requirements', 'project', 'functional-requirements.md');
    const businessDocPath = path.join(baseDir, '.requirements', 'project', 'business-requirements.md');
    const designDocPath = path.join(baseDir, '.requirements', 'project', 'functional-design.md');
    const aggregatedSomewhere = await Promise.all([functionalDocPath, businessDocPath, designDocPath].map((p) => fs.readFile(p, 'utf-8').catch(() => '')));

    if (aggregatedSomewhere.some((c) => c.includes(`\`${reqId}\``))) {
      if (single.type === 'feature' || single.type === 'adjustment') {
        await upsertBlock(baseDir, 'functional-requirements.md', '## 功能详情', reqId, formatFeatureDetails([single]));
        affectedDocs.push('functional-requirements.md');
        if (single.type === 'feature') {
          await upsertBlock(baseDir, 'business-requirements.md', '## 业务需求清单', reqId, `### ${single.title}\n\n- **ID**: \`${single.id}\`\n- **摘要**: ${single.summary || '(无摘要)'}\n`);
          affectedDocs.push('business-requirements.md');
        }
      }
      if (single.type === 'refactor' || single.type === 'feature' || single.type === 'bug') {
        const singleDesign = await summarizeSingleDesign(baseDir, reqId);
        if (singleDesign && singleDesign.sections.length) {
          const designText = singleDesign.sections.map((s) => `### 来自 \`${reqId}\` (变更后更新) — ${s.title}\n\n${s.body.slice(0, 500)}${s.body.length > 500 ? '...' : ''}\n`).join('\n---\n\n');
          await upsertBlock(baseDir, 'functional-design.md', '## 关键设计决策', reqId, designText);
          affectedDocs.push('functional-design.md');
        }
      }
      result.updated.push(...affectedDocs);
    } else {
      result.skipped.push('project-docs (requirement not aggregated yet)');
    }

    // changelog：变更必有记录
    await appendChangelog(baseDir, {
      timestamp: ts,
      id: reqId,
      type: single.type,
      title: single.title,
      action: `requirement-changed-${level}`,
      affectedDocs,
      source: reqId,
      summary: reason,
    });

    await updateProjectMetaStats(baseDir, `requirement-changed-${level}`, reqId);

    // 时间线事件
    await recordEvent(baseDir, {
      type: 'requirement_changed',
      reqId,
      title: single.title,
      summary: `[${level}] ${reason || '(未填原因)'}`,
      details: affectedDocs.length ? `已更新项目文档: ${affectedDocs.join(', ')}` : undefined,
    });

    if (affectedDocs.length) {
      await recordEvent(baseDir, {
        type: 'project_synced',
        reqId,
        title: single.title,
        summary: `变更后重同步，更新 ${affectedDocs.length} 份项目文档`,
      });
    }
  } catch (error) {
    result.success = false;
    result.errors.push(error.message);
    await logProjectSyncError(baseDir, reqId, error);
  }

  result.stats.durationMs = Date.now() - start;
  return result;
}

/**
 * 全量重生成（保留 changelog）
 * @param {string} baseDir
 * @returns {Promise<object>} SyncResult
 */
export async function fullResync(baseDir) {
  const result = newResult();
  const start = Date.now();

  try {
    // 全量重生成 = force 初始化（会备份 + 重建）
    // 注意：changelog、timeline.yaml（事件账本）、docs-map.yaml（手工精化的登记）都随备份保留
    const projectDir = path.join(baseDir, '.requirements', 'project');
    const preserveFiles = ['changelog.md', 'timeline.yaml', 'docs-map.yaml'];
    const backups = {};
    for (const name of preserveFiles) {
      try {
        backups[name] = await fs.readFile(path.join(projectDir, name), 'utf-8');
      } catch (_error) {
        // 该文件不存在也继续
      }
    }

    const initResult = await initializeProjectDocs(baseDir, { force: true });
    result.errors.push(...initResult.errors);
    result.created.push(...initResult.created);
    result.updated.push(...initResult.updated);

    // 恢复保留文件
    for (const name of preserveFiles) {
      if (backups[name] !== undefined) {
        await fs.writeFile(path.join(projectDir, name), backups[name], 'utf-8');
        result.updated.push(`${name} (restored)`);
      }
    }

    // 追加本次 resync 记录
    await appendChangelog(baseDir, {
      timestamp: now(),
      action: 'full-resync',
      type: 'system',
      title: '全量重生成',
      affectedDocs: ['project-structure.md', 'business-requirements.md', 'functional-requirements.md', 'functional-design.md'],
    });

    await updateProjectMetaStats(baseDir, 'full-resync', null);

    // 时间线事件
    await recordEvent(baseDir, {
      type: 'full_resync',
      title: '项目文档全量重生成',
      summary: 'project/ 4 份文档按当前需求状态全量重建（changelog 保留）',
    });
  } catch (error) {
    result.success = false;
    result.errors.push(error.message);
    await logProjectSyncError(baseDir, null, error);
  }

  result.stats.durationMs = Date.now() - start;
  return result;
}

/**
 * 在指定 H2 章节内写入需求区块（幂等 + 可更新）
 *
 * 区块用 HTML 注释标记包裹：
 *   <!-- crs:block:REQ-ID:start --> ... <!-- crs:block:REQ-ID:end -->
 *
 * 语义：
 * 1. 标记存在 → 整块替换（需求变更后内容同步更新的关键）
 * 2. 标记不存在但旧聚合内容已含该 ID（v1.2 之前的无标记格式）→ 按 `### ` 标题块定位并原位替换为带标记的新块
 * 3. 都不存在 → 追加到章节内
 *
 * @param {string} baseDir
 * @param {string} docFile - 文档文件名
 * @param {string} sectionHeader - H2 章节（如 "## 功能详情"）
 * @param {string} reqId - 需求 ID（用于标记定位）
 * @param {string} blockContent - 区块正文（不含标记）
 */
async function upsertBlock(baseDir, docFile, sectionHeader, reqId, blockContent) {
  const docPath = path.join(baseDir, '.requirements', 'project', docFile);
  let content = '';
  try {
    content = await fs.readFile(docPath, 'utf-8');
  } catch (_error) {
    content = `# ${docFile.replace('.md', '')}\n\n${sectionHeader}\n\n`;
  }

  const startMarker = `<!-- crs:block:${reqId}:start -->`;
  const endMarker = `<!-- crs:block:${reqId}:end -->`;
  const marked = `${startMarker}\n${blockContent.trim()}\n${endMarker}`;

  // 1. 标记存在 → 替换
  const startIdx = content.indexOf(startMarker);
  if (startIdx >= 0) {
    const endIdx = content.indexOf(endMarker, startIdx);
    if (endIdx >= 0) {
      content = content.slice(0, startIdx) + marked + content.slice(endIdx + endMarker.length);
      await fs.writeFile(docPath, content, 'utf-8');
      return;
    }
  }

  // 2. 旧格式：按标题块定位含该 ID 的 ### 块，原位替换（迁移为带标记格式）
  const legacy = replaceLegacyBlock(content, reqId, marked);
  if (legacy !== null) {
    await fs.writeFile(docPath, legacy, 'utf-8');
    return;
  }

  // 3. 追加到章节
  const sectionStart = content.indexOf(sectionHeader);
  if (sectionStart < 0) {
    content = `${content.trimEnd()}\n\n${sectionHeader}\n\n${marked}\n`;
  } else {
    const insertPos = sectionStart + sectionHeader.length;
    content = content.slice(0, insertPos) + `\n${marked}\n` + content.slice(insertPos);
  }
  await fs.writeFile(docPath, content, 'utf-8');
}

/**
 * 定位旧格式（无标记）中包含指定需求 ID 的 `### ` 标题块并替换
 * 块边界：从 `### ` 标题行到下一个 `### `/`## ` 标题或 `---` 分隔线
 * @param {string} content - 文档全文
 * @param {string} reqId
 * @param {string} replacement - 替换后的内容
 * @returns {string|null} 替换后的全文；未找到返回 null
 */
function replaceLegacyBlock(content, reqId, replacement) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('### ')) continue;

    // 找块结束边界
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith('### ') && !lines[j].startsWith('## ') && lines[j].trim() !== '---') {
      j++;
    }

    const block = lines.slice(i, j).join('\n');
    if (block.includes(`\`${reqId}\``)) {
      return `${lines.slice(0, i).join('\n')}\n${replacement}\n${lines.slice(j).join('\n')}`;
    }
    i = j - 1; // 跳过整个块
  }
  return null;
}

/**
 * 记录时间线事件（静默降级，不影响同步主流程）
 */
async function recordEvent(baseDir, event) {
  try {
    await appendEvent(baseDir, event);
  } catch (_error) {
    // 账本写入失败不阻断同步
  }
}

export default {
  initializeProjectDocs,
  syncOnRequirementDone,
  syncOnBugFixed,
  syncOnRequirementChange,
  fullResync,
  isProjectInitialized,
  logProjectSyncError,
};
