/**
 * 导出模块 - 类型定义（JSDoc）
 *
 * @typedef {Object} ReportMeta
 * @property {string} projectName
 * @property {string} version
 * @property {string} generatedAt - ISO 8601
 * @property {number} totalReqs
 * @property {string} generatorVersion
 *
 * @typedef {Object} ReportProject
 * @property {string} structure
 * @property {string} businessReq
 * @property {string} functionalReq
 * @property {string} functionalDesign
 *
 * @typedef {Object} RequirementSpec
 * @property {string} background
 * @property {string} userStories
 * @property {string} design
 * @property {string} api
 * @property {string} decisions
 *
 * @typedef {Object} Requirement
 * @property {string} id
 * @property {'feature'|'bug'|'question'|'adjustment'|'refactor'} type
 * @property {string} title
 * @property {string} status
 * @property {{level:string, score:number}|null} priority
 * @property {string[]} tags
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {RequirementSpec|null} spec
 * @property {string[]} dependencies
 * @property {string} rawPath
 *
 * @typedef {Object} ChangelogEntry
 * @property {string} timestamp
 * @property {string} action
 * @property {string|null} reqId
 * @property {string} actor
 *
 * @typedef {Object} ReportStats
 * @property {Record<string, number>} byType
 * @property {Record<string, number>} byStatus
 * @property {Record<string, number>} byPriority
 *
 * @typedef {Object} ReportData
 * @property {ReportMeta} meta
 * @property {ReportProject|null} project
 * @property {Requirement[]} requirements
 * @property {ChangelogEntry[]} changelog
 * @property {ReportStats} stats
 *
 * @typedef {Object} ExportOptions
 * @property {string} requirementsDir - 需求目录路径
 * @property {string} title - 报告标题
 * @property {boolean} offline - 离线模式（不加载 CDN，同时跳过依赖图）
 * @property {boolean} noMermaid - 跳过依赖图
 */

import { STATUS_LABELS as SCHEMA_STATUS_LABELS, STATUS_COLORS as SCHEMA_STATUS_COLORS } from '../requirement-manager/core/schema.js';

export const EXPORT_VERSION = '1.0.0';
export const REQ_TYPES = ['features', 'bugs', 'questions', 'adjustments', 'refactors'];
export const REQ_TYPE_LABELS = {
  feature: '功能',
  bug: '缺陷',
  question: '问题',
  adjustment: '调整',
  refactor: '重构',
  'tech-debt': '技术债',
  // 兼容复数形式（如果 stats 直接来自目录名）
  features: '功能',
  bugs: '缺陷',
  questions: '问题',
  adjustments: '调整',
  refactors: '重构',
};

/** 状态中文标签（schema 唯一口径派生） */
export const STATUS_LABELS = { ...SCHEMA_STATUS_LABELS };

/** chalk 颜色名 → HTML 报告用十六进制色值（schema 唯一口径派生） */
const HEX_BY_CHALK = {
  yellow: '#f59e0b',
  cyan: '#06b6d4',
  blue: '#3b82f6',
  magenta: '#a855f7',
  green: '#10b981',
};
export const STATUS_COLORS = Object.fromEntries(
  Object.entries(SCHEMA_STATUS_COLORS).map(([status, color]) => [status, HEX_BY_CHALK[color] || '#9ca3af'])
);

export const PRIORITY_COLORS = {
  P0: '#dc2626',
  P1: '#ea580c',
  P2: '#ca8a04',
  P3: '#16a34a',
  P4: '#6b7280',
};
