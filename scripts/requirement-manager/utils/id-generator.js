/**
 * ID 生成器 - 为需求生成唯一ID
 * 格式: PREFIX-YYYYMMDD-XXX-HHHHHH (HHHHHH 为时间戳十六进制后 6 位)
 *
 * 模式（通过 CRS_ID_MODE 环境变量切换）：
 * - fixed (默认):      NNN 固定为 '001'，唯一性靠 hash 后缀，不写 counters.json
 *                       → 多人 Git 协作零合并冲突
 * - hash_seq:          NNN 来自 hash 前 3 位（0-4095），不写 counters.json
 * - author_seq:        NNN 按 {CRS_AUTHOR}.date 递增，写 counters-{author}.json
 * - hostname_seq:      NNN 按 {hostname}.date 递增，写 counters-{hostname}.json
 *
 * 向后兼容：
 * - parse() 仍识别三种 ID 格式（hash / 旧日期 / 旧 4 位）
 * - 现有 .requirements/counters.json 不主动修改（保留以兼容旧版读取）
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

// 计数器内存缓存（仅 author_seq/hostname_seq 模式使用，会持久化到文件）
const counters = {};

// fixed 模式专用的进程内计数器（不持久化，重启从 001 开始）
// 目的：保持进程内 NNN 递增（与 v0.9.x 行为一致），但不写文件消除多人合并冲突
const inProcessCounters = initEmptyCounters();

// 计数器文件目录
const COUNTERS_DIR = '.requirements';

// 当前已加载的 scope（null = 默认共享 counters.json）
let cachedScope = undefined;

// 合法的 ID 模式
const VALID_MODES = ['fixed', 'hash_seq', 'author_seq', 'hostname_seq'];

// 类型到前缀的映射
const PREFIX_MAP = {
  feature: 'FEAT',
  bug: 'BUG',
  question: 'QUES',
  adjustment: 'ADJU',
  refactor: 'REF',
  'tech-debt': 'DEBT',
};

/**
 * 获取 ID 模式（带非法值 fallback）
 */
export function getIdMode() {
  const mode = process.env.CRS_ID_MODE || 'fixed';
  if (!VALID_MODES.includes(mode)) {
    console.warn(`[CRS] Invalid CRS_ID_MODE "${mode}", falling back to "fixed"`);
    return 'fixed';
  }
  return mode;
}

/**
 * 清洗字符串为安全文件名片段
 */
export function slugify(str) {
  const cleaned = String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 50);
  return cleaned || 'unknown';
}

/**
 * 解析作者名（仅 author_seq 模式使用）
 * 优先级：CRS_AUTHOR 环境变量 > git user.name > 'unknown'
 */
export function resolveAuthor() {
  if (process.env.CRS_AUTHOR) return slugify(process.env.CRS_AUTHOR);
  try {
    const name = execSync('git config user.name', {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return slugify(name) || 'unknown';
  } catch (_e) {
    return 'unknown';
  }
}

/**
 * 解析机器名（仅 hostname_seq 模式使用）
 */
export function resolveHostname() {
  try {
    return slugify(os.hostname()) || 'unknown';
  } catch (_e) {
    return 'unknown';
  }
}

/**
 * 获取 counters 文件路径（按 scope 隔离）
 * @param {string|null|undefined} scope - 作者/机器名；null/undefined 表示默认共享文件
 * scope 进入文件名前做边界校验，防止路径拼接逃逸
 */
function getCountersFile(scope) {
  if (!scope) return path.join(COUNTERS_DIR, 'counters.json');
  const root = path.resolve(COUNTERS_DIR);
  const file = path.resolve(root, `counters-${String(scope)}.json`);
  if (!file.startsWith(root + path.sep)) {
    throw new Error(`illegal counters scope: ${scope}`);
  }
  return file;
}

/**
 * 初始化空的计数器结构
 */
function initEmptyCounters() {
  return {
    feature: {},
    bug: {},
    question: {},
    adjustment: {},
    refactor: {},
    'tech-debt': {},
  };
}

/**
 * 加载计数器到内存缓存
 */
async function loadCounters(scope) {
  // 清空当前缓存
  for (const k of Object.keys(counters)) delete counters[k];
  try {
    const content = await fs.readFile(getCountersFile(scope), 'utf-8');
    Object.assign(counters, JSON.parse(content));
  } catch (_error) {
    Object.assign(counters, initEmptyCounters());
  }
  cachedScope = scope;
}

/**
 * 保存计数器到文件
 */
async function saveCounters(scope) {
  const file = getCountersFile(scope);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(counters, null, 2));
}

/**
 * 获取今日日期字符串 YYYYMMDD
 */
function getTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 生成基于时间戳的 hash 后缀（十六进制后 6 位）
 * @returns {string} 6 位十六进制字符串
 */
export function generateHash() {
  return Date.now().toString(16).slice(-6).padStart(6, '0');
}

/**
 * 在 seq 模式下递增 scope counter，返回格式化的 NNN
 */
async function incrementScopedCounter(type, scope) {
  if (cachedScope !== scope) {
    await loadCounters(scope);
  }
  if (!Object.prototype.hasOwnProperty.call(counters, type)) {
    counters[type] = {};
  }
  const today = getTodayString();
  if (!counters[type][today]) counters[type][today] = 0;
  counters[type][today]++;
  await saveCounters(scope);
  return String(counters[type][today]).padStart(3, '0');
}

/**
 * 生成需求ID
 * @param {string} type - 需求类型 (feature/bug/question/adjustment/refactor/tech-debt)
 * @returns {Promise<string>} 形如 PREFIX-YYYYMMDD-NNN-HHHHHH
 */
export async function generate(type) {
  if (!Object.prototype.hasOwnProperty.call(PREFIX_MAP, type)) {
    throw new Error(`Unknown requirement type: ${type}`);
  }
  const prefix = PREFIX_MAP[type];
  const today = getTodayString();
  const hash = generateHash();
  const mode = getIdMode();

  let formattedNumber;
  switch (mode) {
    case 'fixed':
      // 进程内递增（不持久化）：保持进程内 NNN 连续可读，但不写文件消除多人合并冲突
      // 注意：跨进程 NNN 可能重复，由 hash 后缀保证全局唯一性
      if (!inProcessCounters[type][today]) inProcessCounters[type][today] = 0;
      inProcessCounters[type][today]++;
      formattedNumber = String(inProcessCounters[type][today]).padStart(3, '0');
      break;
    case 'hash_seq':
      formattedNumber = String(parseInt(hash.slice(0, 3), 16)).padStart(3, '0');
      break;
    case 'author_seq':
      formattedNumber = await incrementScopedCounter(type, resolveAuthor());
      break;
    case 'hostname_seq':
      formattedNumber = await incrementScopedCounter(type, resolveHostname());
      break;
    default:
      formattedNumber = '001';
  }

  return `${prefix}-${today}-${formattedNumber}-${hash}`;
}

/**
 * 解析需求ID
 * @param {string} id - 需求ID
 * @returns {object|null}
 */
export function parse(id) {
  // 支持三种格式
  // hash 格式: PREFIX-YYYYMMDD-XXX-HHHHHH
  // 旧日期格式: PREFIX-YYYYMMDD-XXX
  // 旧格式: PREFIX-NNNN

  const prefixToType = {
    FEAT: 'feature',
    BUG: 'bug',
    QUES: 'question',
    ADJU: 'adjustment',
    REF: 'refactor',
    DEBT: 'tech-debt',
  };

  // 优先匹配 hash 格式
  let match = id.match(/^([A-Z]+)-(\d{8})-(\d{3})-([0-9a-f]{6})$/);
  if (match) {
    const [, prefix, dateStr, numberStr, hash] = match;
    const type = prefixToType[prefix];
    if (!type) return null;
    return {
      type,
      number: parseInt(numberStr, 10),
      prefix,
      date: dateStr,
      hash,
      format: 'hash',
    };
  }

  // 旧日期格式: PREFIX-YYYYMMDD-XXX
  match = id.match(/^([A-Z]+)-(\d{8})-(\d{3})$/);
  if (match) {
    const [, prefix, dateStr, numberStr] = match;
    const type = prefixToType[prefix];
    if (!type) return null;
    return {
      type,
      number: parseInt(numberStr, 10),
      prefix,
      date: dateStr,
      format: 'new',
    };
  }

  // 旧格式: PREFIX-NNNN
  match = id.match(/^([A-Z]+)-(\d{4})$/);
  if (match) {
    const [, prefix, numberStr] = match;
    const type = prefixToType[prefix];
    if (!type) return null;
    return {
      type,
      number: parseInt(numberStr, 10),
      prefix,
      format: 'old',
    };
  }

  return null;
}

/**
 * 重置计数器 (主要用于测试)
 *
 * 行为：
 * - author_seq/hostname_seq 模式：重置对应 scope 文件
 * - fixed/hash_seq 模式：重置默认 counters.json（仅当文件存在）
 *
 * @param {string} [type] - 需求类型；不传则重置全部
 * @param {string} [date] - 可选，重置特定日期的计数器
 */
export async function reset(type, date) {
  const mode = getIdMode();

  // 始终重置 fixed 模式的进程内计数器
  if (type) {
    if (Object.prototype.hasOwnProperty.call(inProcessCounters, type)) {
      if (date) inProcessCounters[type][date] = 0;
      else inProcessCounters[type] = {};
    }
  } else {
    for (const k of Object.keys(inProcessCounters)) delete inProcessCounters[k];
    Object.assign(inProcessCounters, initEmptyCounters());
  }

  if (mode === 'author_seq' || mode === 'hostname_seq') {
    const scope = mode === 'author_seq' ? resolveAuthor() : resolveHostname();
    await loadCounters(scope);
    if (type) {
      if (Object.prototype.hasOwnProperty.call(counters, type)) {
        if (date) counters[type][date] = 0;
        else counters[type] = {};
      }
    } else {
      for (const k of Object.keys(counters)) delete counters[k];
      Object.assign(counters, initEmptyCounters());
    }
    await saveCounters(scope);
    return;
  }

  // fixed / hash_seq 模式：仅当默认 counters.json 已存在时清理（避免污染）
  cachedScope = null;
  try {
    await fs.access(getCountersFile(null));
    await loadCounters(null);
    if (type) {
      if (Object.prototype.hasOwnProperty.call(counters, type)) {
        if (date) counters[type][date] = 0;
        else counters[type] = {};
      }
    } else {
      for (const k of Object.keys(counters)) delete counters[k];
      Object.assign(counters, initEmptyCounters());
    }
    await saveCounters(null);
  } catch (_e) {
    // 文件不存在，仅清空内存缓存
    for (const k of Object.keys(counters)) delete counters[k];
    Object.assign(counters, initEmptyCounters());
  }
}

export default {
  generate,
  generateHash,
  parse,
  reset,
  getIdMode,
  slugify,
  resolveAuthor,
  resolveHostname,
};
