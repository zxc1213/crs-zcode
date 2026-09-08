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
 * @property {boolean} offline - 离线模式（内联 Mermaid）
 * @property {boolean} noMermaid - 跳过依赖图
 * @property {string} defaultFilter - 默认过滤器
 */

export const EXPORT_VERSION = '1.0.0';
export const REQ_TYPES = ['features', 'bugs', 'questions', 'adjustments', 'refactors'];
export const REQ_TYPE_LABELS = {
  feature: '功能',
  bug: '缺陷',
  question: '问题',
  adjustment: '调整',
  refactor: '重构',
  // 兼容复数形式（如果 stats 直接来自目录名）
  features: '功能',
  bugs: '缺陷',
  questions: '问题',
  adjustments: '调整',
  refactors: '重构',
};
export const STATUS_LABELS = {
  planning: '规划中',
  analyzed: '已分析',
  in_progress: '实施中',
  implementing: '实施中',
  done: '已完成',
  closed: '已关闭',
  open: '进行中',
  fixed: '已修复',
  implemented: '已实现',
};
export const STATUS_COLORS = {
  done: '#10b981',
  closed: '#10b981',
  fixed: '#10b981',
  implemented: '#10b981',
  in_progress: '#3b82f6',
  implementing: '#3b82f6',
  analyzed: '#f59e0b',
  planning: '#9ca3af',
  open: '#3b82f6',
};
export const PRIORITY_COLORS = {
  P0: '#dc2626',
  P1: '#ea580c',
  P2: '#ca8a04',
  P3: '#16a34a',
  P4: '#6b7280',
};

export const TYPES = {};
