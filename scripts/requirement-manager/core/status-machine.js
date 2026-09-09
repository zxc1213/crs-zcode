/**
 * 状态机 - 需求状态流转的唯一入口
 *
 * 职责：状态词表归一 → completed 补写 → 元数据写回
 *      → 时间线埋点（status_changed）→ plan/索引表同步 → 知识图谱 → done 触发 project 文档同步
 */

import { readMeta, writeMeta } from '../utils/storage.js';
import { syncPlanStatus, syncIndexTables } from '../utils/plan-sync.js';
import { STATUSES, normalizeStatus } from './schema.js';
import { getKnowledgeGraph } from '../../knowledge-graph/index.js';

/**
 * 更新需求（当前仅状态流转语义；其他字段透传合并）
 * @param {object} processor - Processor 实例（提供 baseDir/requirementsDir）
 * @param {string} id - 需求 ID
 * @param {object} updates - 要更新的字段
 * @returns {Promise<void>}
 */
export async function applyUpdate(processor, id, updates) {
  const baseDir = processor.baseDir;
  const reqPath = processor.getRequirementPath(id);

  if (!reqPath) {
    throw new Error(`Requirement not found: ${id}`);
  }

  // 读取现有元数据
  const meta = await readMeta(baseDir, reqPath);

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
  await writeMeta(baseDir, reqPath, updatedMeta);

  // 时间线事件：状态流转
  if (updates.status !== undefined && meta.status !== updatedMeta.status) {
    try {
      const { appendEvent } = await import('../project-sync/timeline.js');
      await appendEvent(baseDir, {
        type: 'status_changed',
        reqId: id,
        title: updatedMeta.title,
        summary: `${meta.status} → ${updatedMeta.status}`,
      });
    } catch (_timelineError) {
      // 账本写入失败不影响主流程
    }
  }

  // 同步状态到 plan.md
  await syncPlanStatus(baseDir, reqPath);

  // 同步索引表（待填充 → 已填充）
  await syncIndexTables(reqPath);

  // 同步到知识图谱
  try {
    const graph = await getKnowledgeGraph(baseDir);
    await graph.updateRequirement(id, {
      status: updatedMeta.status,
      title: updatedMeta.title,
      description: updatedMeta.description,
    });
  } catch (_error) {
    // 知识图谱同步失败不影响主流程
  }

  // 状态变为 done 时触发 project 文档同步
  if (updates.status === 'done' && meta.status !== 'done' && process.env.CRS_PROJECT_SYNC !== 'off') {
    try {
      const { syncOnRequirementDone, syncOnBugFixed } = await import('../project-sync/index.js');
      if (updatedMeta.type === 'bug') {
        await syncOnBugFixed(baseDir, id);
      } else {
        await syncOnRequirementDone(baseDir, id);
      }
    } catch (_error) {
      // 同步失败不影响主流程，仅记录日志
      try {
        const { logProjectSyncError } = await import('../project-sync/index.js');
        await logProjectSyncError(baseDir, id, _error);
      } catch (_logError) {
        // 彻底静默
      }
    }
  }
}
