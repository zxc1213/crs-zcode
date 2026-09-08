/**
 * Schema - 需求元数据唯一口径源
 *
 * 所有对 meta.yaml 的写入与读取都应以本模块为准：
 * - 状态词表（STATUSES / STATUS_LABELS / STATUS_COLORS）
 * - 日期字段（created / updatedAt / completed）
 * - 类型 → 前缀/目录映射（含 refactors 唯一拼写）
 * - 时间线事件类型（EVENT_TYPES）
 *
 * 历史遗留口径（open/in_progress/completed、createdAt/created_at、refactorings）
 * 仅通过 normalizeStatus()/normalizeMeta()/requirementDate() 在读取侧兼容，
 * 任何新写入一律使用本模块定义的规范口径。
 */

/** 规范状态生命周期（按顺序） */
export const STATUSES = ['planning', 'analyzed', 'implementing', 'review', 'done'];

/** 非终态（活跃）状态集合 */
export const ACTIVE_STATUSES = ['planning', 'analyzed', 'implementing', 'review'];

/** 状态中文标签 */
export const STATUS_LABELS = {
  planning: '规划中',
  analyzed: '已分析',
  implementing: '实现中',
  review: '评审中',
  done: '已完成',
};

/** 状态颜色（chalk 颜色名） */
export const STATUS_COLORS = {
  planning: 'yellow',
  analyzed: 'cyan',
  implementing: 'blue',
  review: 'magenta',
  done: 'green',
};

/** 类型 → ID 前缀 */
export const TYPE_PREFIXES = {
  feature: 'FEAT',
  bug: 'BUG',
  question: 'QUES',
  adjustment: 'ADJU',
  refactor: 'REF',
};

/** 类型 → .requirements/ 子目录（唯一拼写：refactors） */
export const TYPE_DIRS = {
  feature: 'features',
  bug: 'bugs',
  question: 'questions',
  adjustment: 'adjustments',
  refactor: 'refactors',
};

/** 旧目录拼写 → 规范目录拼写（读取侧兼容） */
export const LEGACY_TYPE_DIRS = {
  refactorings: 'refactors',
};

/** 规范日期字段名 */
export const DATE_FIELDS = {
  created: 'created',
  updated: 'updatedAt',
  completed: 'completed',
};

/** 时间线事件类型（project/timeline.yaml 的 type 取值） */
export const EVENT_TYPES = [
  'requirement_created',
  'status_changed',
  'requirement_changed',
  'bug_fixed',
  'design_change',
  'project_synced',
  'full_resync',
  'retro_completed',
  'lesson_saved',
  'docs_registered',
  'docs_drift_detected',
];

/** 变更级别（req-change 三级分类） */
export const CHANGE_LEVELS = ['small', 'medium', 'large'];

/** 时间线事件中文标签（终端与 HTML 报告共用） */
export const EVENT_LABELS = {
  requirement_created: '需求创建',
  status_changed: '状态流转',
  requirement_changed: '需求变更',
  bug_fixed: 'Bug 修复',
  design_change: '设计变更',
  project_synced: '文档同步',
  full_resync: '全量重建',
  retro_completed: '复盘完成',
  lesson_saved: '经验沉淀',
  docs_registered: '文档登记',
  docs_drift_detected: '文档过期',
};

/**
 * 旧状态词表 → 规范状态（读取侧兼容）
 * @param {string} status - meta.yaml 中的 status 值
 * @returns {string|null} 规范状态；无法识别返回 null
 */
export function normalizeStatus(status) {
  if (!status || typeof status !== 'string') return null;
  if (STATUSES.includes(status)) return status;
  const legacy = {
    open: 'planning',
    pending: 'planning',
    in_progress: 'implementing',
    testing: 'review',
    completed: 'done',
    closed: 'done',
    blocked: 'implementing',
  };
  return legacy[status] || null;
}

/**
 * 判断状态是否为活跃（非终态）
 * @param {string} status - 任意口径的状态值
 * @returns {boolean}
 */
export function isActiveStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized !== null && normalized !== 'done';
}

/**
 * 从 meta 中取规范状态（带旧口径兼容）
 * @param {object} meta - meta.yaml 解析结果
 * @returns {string} 规范状态，无法识别时回退 'planning'
 */
export function metaStatus(meta) {
  const normalized = normalizeStatus(meta?.status);
  return normalized || 'planning';
}

/**
 * 从 meta 中取需求时间（created/createdAt/created_at 兼容）
 * @param {object} meta - meta.yaml 解析结果
 * @param {string} kind - 'created' | 'updated' | 'completed'
 * @returns {string|null} ISO 时间字符串；缺失返回 null
 */
export function requirementDate(meta, kind = 'created') {
  if (!meta) return null;
  const candidates = {
    created: ['created', 'createdAt', 'created_at'],
    updated: ['updatedAt', 'updated_at', 'updatedAt'],
    completed: ['completed', 'completedAt', 'completed_at'],
  }[kind];
  for (const key of candidates) {
    if (meta[key]) return meta[key];
  }
  return null;
}

/**
 * 规范化整份 meta（读取侧）：状态与日期字段统一到规范口径，不改写原对象
 * @param {object} meta - meta.yaml 解析结果
 * @returns {object} 规范化后的浅拷贝
 */
export function normalizeMeta(meta) {
  if (!meta) return meta;
  return {
    ...meta,
    status: metaStatus(meta),
  };
}

export default {
  STATUSES,
  ACTIVE_STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  TYPE_PREFIXES,
  TYPE_DIRS,
  LEGACY_TYPE_DIRS,
  DATE_FIELDS,
  EVENT_TYPES,
  EVENT_LABELS,
  CHANGE_LEVELS,
  normalizeStatus,
  isActiveStatus,
  metaStatus,
  requirementDate,
  normalizeMeta,
};
