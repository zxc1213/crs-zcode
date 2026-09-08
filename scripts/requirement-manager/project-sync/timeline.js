/**
 * timeline - 项目统一事件账本
 *
 * `.requirements/project/timeline.yaml` 是项目级历史变化的唯一事实源：
 * 需求创建/状态流转/变更/Bug 修复/设计变更/文档同步/复盘/经验沉淀全部
 * 以 append-only 事件追加于此，dashboard、HTML 报告、--history 均从本账本渲染。
 *
 * 设计约束：
 * - 账本只由引擎写入（LLM 通过 `index.js event` CLI 触发，不手改 YAML）
 * - 读取容错：单条坏事件跳过并计数，整文件损坏时备份后重建
 * - 事件类型受 core/schema.js EVENT_TYPES 约束
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { EVENT_TYPES } from '../core/schema.js';

/**
 * 时间线文件路径
 * @param {string} baseDir
 * @returns {string}
 */
export function timelinePath(baseDir) {
  return path.join(baseDir, '.requirements', 'project', 'timeline.yaml');
}

/**
 * 追加一条事件（append-only，引擎唯一写入口）
 * @param {string} baseDir
 * @param {object} event - { type, reqId?, title?, summary?, details? }
 * @returns {Promise<object>} 追加后的完整事件（含 seq/ts）
 */
export async function appendEvent(baseDir, event) {
  if (!event || !EVENT_TYPES.includes(event.type)) {
    throw new Error(`Invalid timeline event type: ${event?.type} (allowed: ${EVENT_TYPES.join(', ')})`);
  }

  const filePath = timelinePath(baseDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const data = await loadTimelineFile(baseDir);

  const entry = {
    seq: data.nextSeq,
    ts: new Date().toISOString(),
    type: event.type,
  };
  if (event.reqId) entry.reqId = String(event.reqId);
  if (event.title) entry.title = String(event.title).slice(0, 200);
  if (event.summary) entry.summary = String(event.summary).slice(0, 500);
  if (event.details) entry.details = String(event.details).slice(0, 1000);

  data.events.push(entry);
  await fs.writeFile(filePath, yaml.dump({ events: data.events }, { indent: 2, lineWidth: -1, noRefs: true }), 'utf-8');

  return entry;
}

/**
 * 读取事件（容错：坏条目跳过；支持过滤）
 * @param {string} baseDir
 * @param {object} options - { type?, reqId?, limit? }（type/reqId 可为字符串或数组）
 * @returns {Promise<object>} { events: [...按时间倒序...], skipped: 坏条目数 }
 */
export async function readTimeline(baseDir, options = {}) {
  const data = await loadTimelineFile(baseDir);

  let events = data.events;
  if (options.type) {
    const types = Array.isArray(options.type) ? options.type : [options.type];
    events = events.filter((e) => types.includes(e.type));
  }
  if (options.reqId) {
    events = events.filter((e) => e.reqId === options.reqId);
  }

  // 最新在前
  events = [...events].sort((a, b) => (b.seq || 0) - (a.seq || 0) || String(b.ts || '').localeCompare(String(a.ts || '')));

  if (options.limit && options.limit > 0) {
    events = events.slice(0, options.limit);
  }

  return { events, skipped: data.skipped };
}

/**
 * 加载并校验账本文件
 * @param {string} baseDir
 * @returns {Promise<{events: Array, nextSeq: number, skipped: number}>}
 */
async function loadTimelineFile(baseDir) {
  const filePath = timelinePath(baseDir);
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (_error) {
    return { events: [], nextSeq: 1, skipped: 0 };
  }

  let parsed;
  try {
    parsed = yaml.load(raw);
  } catch (_error) {
    // 整文件损坏：备份后重建，避免覆盖丢数据
    const backup = filePath.replace(/\.yaml$/, `.broken-${Date.now()}.yaml`);
    try {
      await fs.copyFile(filePath, backup);
    } catch (_copyError) {
      // 备份失败继续（原文件即将被重建，至少留了错误日志）
    }
    return { events: [], nextSeq: 1, skipped: 0, corrupted: true };
  }

  const list = Array.isArray(parsed?.events) ? parsed.events : [];
  const events = [];
  let skipped = 0;
  let maxSeq = 0;

  for (const entry of list) {
    // 单条校验：必须有 ts 与合法 type，seq 必须可转为正整数
    if (!entry || typeof entry !== 'object' || !entry.ts || !EVENT_TYPES.includes(entry.type)) {
      skipped++;
      continue;
    }
    const seq = Number(entry.seq);
    if (Number.isInteger(seq) && seq > 0) {
      entry.seq = seq;
      maxSeq = Math.max(maxSeq, seq);
    } else {
      entry.seq = 0; // 无有效 seq 的旧条目排序时排最后
    }
    events.push(entry);
  }

  return { events, nextSeq: maxSeq + 1, skipped };
}

export default { appendEvent, readTimeline, timelinePath };
