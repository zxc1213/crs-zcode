/**
 * 变更与事件 - req-change 流程和时间线事件的引擎落点
 *
 * CLI 入口（index.js change / event 子命令）只做参数收集，
 * 校验、同步、账本写入全部收敛在这里。
 */

import { CHANGE_LEVELS, EVENT_TYPES } from './schema.js';

const REQ_ID_PATTERN = /^[A-Z]+(-[A-Za-z0-9]+)+$/;

/**
 * 需求变更（req-change 流程的引擎落点）
 * 记录时间线事件 + changelog，并重同步已聚合的项目文档区块
 * @param {object} processor - Processor 实例
 * @param {object} params - { id, level, reason }
 * @returns {Promise<object>} 处理结果
 */
export async function handleChange(processor, params = {}) {
  const { id, level = 'medium', reason = '' } = params;
  const baseDir = processor.baseDir;

  if (!id || !REQ_ID_PATTERN.test(id)) {
    return {
      success: false,
      error: 'invalid_requirement_id',
      message: `无效的需求 ID: ${id || '(空)'}，示例: FEAT-20260908-001`,
    };
  }
  if (!CHANGE_LEVELS.includes(level)) {
    return {
      success: false,
      error: 'invalid_change_level',
      message: `无效的变更级别: ${level} (允许: ${CHANGE_LEVELS.join(', ')})`,
    };
  }

  let meta;
  try {
    meta = await processor.get(id);
  } catch (err) {
    return {
      success: false,
      error: 'requirement_not_found',
      message: `未找到需求 ${id}：${err.message}`,
    };
  }

  if (process.env.CRS_PROJECT_SYNC === 'off') {
    return {
      success: true,
      action: 'requirement_changed',
      requirementId: id,
      level,
      message: 'CRS_PROJECT_SYNC=off，仅记录变更说明（未写项目文档）',
    };
  }

  const { syncOnRequirementChange } = await import('../project-sync/index.js');
  const syncResult = await syncOnRequirementChange(baseDir, id, { level, reason });

  const ok = syncResult.success !== false && !(syncResult.errors && syncResult.errors.length);
  return {
    success: ok,
    action: 'requirement_changed',
    requirementId: id,
    level,
    reason,
    title: meta.title,
    updatedDocs: syncResult.updated || [],
    skipped: syncResult.skipped || [],
    errors: syncResult.errors || [],
    message: ok
      ? `变更已记录（${level}）${(syncResult.updated || []).length ? `，已更新: ${(syncResult.updated || []).join(', ')}` : ''}`
      : `变更记录失败: ${(syncResult.errors || []).join('; ')}`,
  };
}

/**
 * 记录时间线事件（LLM 通过 CLI 触发 retro_completed / lesson_saved 等洞察类事件）
 * @param {object} baseDir - 项目根目录
 * @param {object} params - { type, id, title, summary }
 * @returns {Promise<object>} 处理结果
 */
export async function handleEvent(baseDir, params = {}) {
  const { type, id, title, summary } = params;

  if (!EVENT_TYPES.includes(type)) {
    return {
      success: false,
      error: 'invalid_event_type',
      message: `无效的事件类型: ${type} (允许: ${EVENT_TYPES.join(', ')})`,
    };
  }

  if (id && !REQ_ID_PATTERN.test(id)) {
    return {
      success: false,
      error: 'invalid_requirement_id',
      message: `无效的需求 ID: ${id}`,
    };
  }

  const { appendEvent } = await import('../project-sync/timeline.js');
  try {
    const entry = await appendEvent(baseDir, { type, reqId: id, title, summary });
    return {
      success: true,
      action: 'timeline_event',
      event: entry,
      message: `事件已记录: ${type}${id ? ` (${id})` : ''}`,
    };
  } catch (err) {
    return {
      success: false,
      error: 'timeline_write_failed',
      message: `事件写入失败: ${err.message}`,
    };
  }
}
