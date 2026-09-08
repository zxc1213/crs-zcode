/**
 * Plan 同步模块 - 同步 meta.yaml 状态到 plan.md 和其他索引文件
 *
 * 功能：
 * - syncPlanStatus() - 同步整体状态到进度区块
 * - syncIndexTables() - 同步子文件填充状态到索引表
 * - syncAcceptanceCriteria() - 同步验收标准复选框
 */

import { readMeta } from './storage.js';
import { scanSubDirectoryStatus, isDocumentFilled } from './document-tracker.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * 进度区块模板
 */
const PROGRESS_BLOCK_TEMPLATE = `## 实时进度

> **状态**: \`{{STATUS}}\` | **完成度**: {{COMPLETION_PERCENT}}% | **更新**: {{UPDATED_AT}}

---

`;

/**
 * 索引表配置：子目录 → 根索引文件 + 行定义
 */
const INDEX_TABLE_CONFIG = {
  spec: {
    indexFile: 'spec.md',
    rows: [
      { label: '背景与目标', file: 'background.md' },
      { label: '用户故事', file: 'user-stories.md' },
      { label: '设计方案', file: 'design.md' },
      { label: '接口定义', file: 'api.md' },
      { label: '决策记录', file: 'decisions.md' },
    ],
  },
  'test-cases': {
    indexFile: 'test-cases.md',
    rows: [
      { label: '正向用例', file: 'positive.md' },
      { label: '异常用例', file: 'negative.md' },
      { label: '边界用例', file: 'boundary.md' },
    ],
  },
  plan: {
    indexFile: 'plan.md',
    rows: [
      { label: '任务分解', file: 'tasks.md' },
      { label: '里程碑', file: 'milestones.md' },
    ],
  },
};

/**
 * 正则特殊字符转义
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 同步 meta.yaml 状态到 plan.md
 * @param {string} baseDir - 基础目录
 * @param {string} reqPath - 需求路径
 * @returns {Promise<boolean>} 是否成功同步
 */
export async function syncPlanStatus(baseDir, reqPath) {
  try {
    const meta = await readMeta(baseDir, reqPath);
    const planPath = path.join(reqPath, 'plan.md');

    try {
      await fs.access(planPath);
    } catch {
      return false;
    }

    const planContent = await fs.readFile(planPath, 'utf-8');
    const progressBlock = generateProgressBlock(meta);

    const hasProgressBlock = planContent.includes('## 实时进度');

    let updatedPlan;

    if (hasProgressBlock) {
      updatedPlan = planContent.replace(/## 实时进度[\s\S]*?(?=\n## |\n---|$)/, progressBlock.trim() + '\n\n');
    } else {
      const titleMatch = planContent.match(/^#.*$/m);
      if (titleMatch) {
        const insertPosition = titleMatch.index + titleMatch[0].length;
        updatedPlan = planContent.slice(0, insertPosition) + '\n\n' + progressBlock + planContent.slice(insertPosition);
      } else {
        updatedPlan = progressBlock + planContent;
      }
    }

    updatedPlan = syncAcceptanceCriteria(updatedPlan, meta.status);

    await fs.writeFile(planPath, updatedPlan, 'utf-8');

    // 同步索引表
    await syncIndexTables(reqPath);

    return true;
  } catch (error) {
    console.debug(`Plan sync skipped: ${error.message}`);
    return false;
  }
}

/**
 * 同步所有根索引文件的状态列（待填充 → 已填充）
 * @param {string} reqPath - 需求目录路径
 * @returns {Promise<object>} { updated: string[], skipped: string[], errors: object[] }
 */
export async function syncIndexTables(reqPath) {
  const results = { updated: [], skipped: [], errors: [] };
  const subStatus = await scanSubDirectoryStatus(reqPath);

  for (const [subDir, config] of Object.entries(INDEX_TABLE_CONFIG)) {
    // indexFile 来自内部常量表，仍做一次边界收敛，确保不越出需求目录
    const root = path.resolve(reqPath);
    const indexPath = path.resolve(root, path.basename(String(config.indexFile)));
    if (!indexPath.startsWith(root + path.sep)) {
      results.errors.push({ file: config.indexFile, error: new Error('index path escapes requirement directory') });
      continue;
    }
    let indexContent;
    try {
      indexContent = await fs.readFile(indexPath, 'utf-8');
    } catch {
      results.skipped.push(config.indexFile);
      continue;
    }

    let modified = false;
    const fileStatuses = subStatus[subDir] || {};

    for (const row of config.rows) {
      const isFilled = fileStatuses[row.file] || false;
      const rowPattern = new RegExp(`\\|\\s*${escapeRegex(row.label)}\\s*\\|.*?${escapeRegex(row.file)}.*?\\|\\s*(待填充|已填充)\\s*\\|`);
      const match = indexContent.match(rowPattern);
      if (match) {
        const currentStatus = match[1];
        const newStatus = isFilled ? '已填充' : '待填充';
        if (currentStatus !== newStatus) {
          indexContent = indexContent.replace(rowPattern, match[0].replace(currentStatus, newStatus));
          modified = true;
        }
      }
    }

    // 处理 plan/step-N-xxx.md 动态文件
    if (subDir === 'plan') {
      const stepFiles = Object.keys(fileStatuses).filter((f) => f.startsWith('step-'));
      const anyStepFilled = stepFiles.some((f) => fileStatuses[f]);
      const stepRowPattern = /\| 步骤详情 \| plan\/step.*?\| (待填充|已填充) \|/;
      const stepMatch = indexContent.match(stepRowPattern);
      if (stepMatch) {
        const currentStatus = stepMatch[1];
        const newStatus = anyStepFilled ? '已填充' : '待填充';
        if (currentStatus !== newStatus) {
          indexContent = indexContent.replace(stepRowPattern, stepMatch[0].replace(currentStatus, newStatus));
          modified = true;
        }
      }
    }

    if (modified) {
      try {
        await fs.writeFile(indexPath, indexContent, 'utf-8');
        results.updated.push(config.indexFile);
      } catch (err) {
        results.errors.push({ file: config.indexFile, error: err.message });
      }
    } else {
      results.skipped.push(config.indexFile);
    }
  }

  return results;
}

/**
 * 批量扫描所有需求并同步索引表
 * @param {string} requirementsDir - .requirements 目录
 * @returns {Promise<object>} 聚合结果
 */
export async function syncAllIndexTables(requirementsDir) {
  const typeDirs = ['features', 'bugs', 'questions', 'adjustments', 'refactors'];
  const totalResults = { updated: 0, skipped: 0, errors: 0, reqCount: 0 };

  for (const typeDir of typeDirs) {
    const typePath = path.join(requirementsDir, typeDir);
    try {
      const entries = await fs.readdir(typePath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const reqPath = path.join(typePath, entry.name);
          const result = await syncIndexTables(reqPath);
          totalResults.updated += result.updated.length;
          totalResults.skipped += result.skipped.length;
          totalResults.errors += result.errors.length;
          totalResults.reqCount++;
        }
      }
    } catch {
      // 目录不存在，跳过
    }
  }

  return totalResults;
}

/**
 * 生成进度区块内容
 */
function generateProgressBlock(meta) {
  const completionPercent = calculateCompletion(meta);
  const updatedAt = meta.updatedAt || new Date().toISOString();

  return PROGRESS_BLOCK_TEMPLATE.replace('{{STATUS}}', meta.status).replace('{{UPDATED_AT}}', formatDateTime(updatedAt)).replace('{{COMPLETION_PERCENT}}', completionPercent);
}

/**
 * 基于 status 计算完成度
 */
function calculateCompletion(meta) {
  switch (meta.status) {
    case 'planning':
      return 10;
    case 'analyzed':
      return 30;
    case 'implementing':
    case 'in_progress':
      return 60;
    case 'blocked':
      return 25;
    case 'review':
      return 85;
    case 'done':
    case 'completed':
      return 100;
    case 'closed':
      return 100;
    default:
      return 0;
  }
}

/**
 * 格式化日期时间
 */
function formatDateTime(isoString) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 批量同步多个需求的 plan.md
 * @param {string} baseDir - 基础目录
 * @param {string[]} reqPaths - 需求路径数组
 * @returns {Promise<object>} 同步结果统计
 */
export async function syncAllPlans(baseDir, reqPaths) {
  const results = {
    total: reqPaths.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  for (const reqPath of reqPaths) {
    const result = await syncPlanStatus(baseDir, reqPath);
    if (result) {
      results.succeeded++;
    } else {
      results.skipped++;
    }
  }

  return results;
}

/**
 * 同步验收标准章节的复选框状态
 */
function syncAcceptanceCriteria(planContent, status) {
  const acceptanceRegex = /## 验收标准[\s\S]*?(?=\n## |\n---|$)/;

  const match = planContent.match(acceptanceRegex);
  if (!match) {
    return planContent;
  }

  const acceptanceSection = match[0];
  let updatedSection = acceptanceSection;

  if (status === 'completed' || status === 'done') {
    updatedSection = acceptanceSection.replace(/^- \[ \]/gm, '- [x]');
  } else if (status === 'open' || status === 'planning') {
    updatedSection = acceptanceSection.replace(/^- \[x\]/gm, '- [ ]');
  }

  return planContent.replace(acceptanceRegex, updatedSection);
}
