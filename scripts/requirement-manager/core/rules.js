/**
 * 项目级规则 - 内置默认 + .requirements/_system/rules.yaml 覆盖/扩充
 *
 * 两类规则（FEAT-20260909-001-4ae874）：
 * - guard:  PostToolUse 守卫（条件 when + 提示 message），命中即注入
 * - inject: SessionStart 注入的简短提醒（受 inject_budget_chars 预算约束）
 *
 * 合并语义：项目规则是增量层——同 id 字段级覆盖内置（when 深合并），新 id 追加；
 * rules: [] / 文件缺失 → 纯内置默认。单条非法剔除并告警，整体损坏降级默认。
 * 内置默认 rules[0]（phase-guard）= v1.4 post-tool-use 阶段守卫行为的数据化。
 */

import path from 'path';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import { STATUSES } from './schema.js';

/**
 * 规则文件相对 .requirements/ 的位置
 */
export const RULES_REL_PATH = '_system/rules.yaml';

/**
 * 占位符上限与预算约束（api.md 错误处理口径）
 */
export const MESSAGE_LIMITS = Object.freeze({ inject: 120, guard: 200 });
export const BUDGET_DEFAULT = 600;
export const BUDGET_MAX = 2000;

const GUARD_TOOLS = ['Edit', 'Write', 'Bash'];

/**
 * 内置模板与默认规则（只读口径源）。
 * 占位符：{id}/{status}/{path}/{n}/{count}/{phase_hint}，经 applyPlaceholders 替换。
 */
export const DEFAULT_RULES = Object.freeze({
  version: 1,
  inject_budget_chars: BUDGET_DEFAULT,
  templates: Object.freeze({
    session_active:
      '[crs] Active requirement: {id} (status: {status}). {phase_hint} ' +
      'Use /crs:req --active or /crs:req --dashboard to inspect it.',
    session_phase_locked:
      'Current phase forbids editing files outside .requirements/ until all 5 document stages are filled.',
    session_phase_status: 'Requirement status: {status}.',
    session_drift:
      ' Docs-map: {count} registered doc(s) drifted/unconfirmed — run crs-project-sync --scan-docs to review, or /crs:req --dashboard for details.',
    stop_summary:
      '[crs] Session summary — active requirement {id}: {n} logged operations, ' +
      'requirement documents synced (index tables + plan progress).',
  }),
  rules: [
    Object.freeze({
      id: 'phase-guard',
      type: 'guard',
      enabled: true,
      priority: 100,
      when: Object.freeze({ tools: ['Edit', 'Write'], statuses: ['planning', 'analyzed'], outside: '.requirements' }),
      message:
        '[crs] Phase violation: active requirement {id} is "{status}". ' +
        'Editing {path} is not allowed yet. ' +
        'Finish the 5 document stages (spec -> analyzed -> implementing -> test-cases -> plan) before touching code.',
    }),
  ],
});

/**
 * 规则文件的绝对路径（root 边界显式校验，与 config.js 同口径）
 */
export function rulesFilePath(baseDir) {
  const root = path.resolve(baseDir);
  const rulesPath = path.resolve(root, '.requirements', '_system', 'rules.yaml');
  if (rulesPath !== root && !rulesPath.startsWith(root + path.sep)) {
    throw new Error(`rules path escapes project root: ${rulesPath}`);
  }
  return rulesPath;
}

/**
 * 占位符替换：{key} → vars[key]；无对应值的占位符原样保留
 */
export function applyPlaceholders(text, vars = {}) {
  return String(text).replace(/\{([a-z_]+)\}/g, (raw, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : raw
  );
}

function isPlainObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function asStringArray(val) {
  return Array.isArray(val) && val.every((v) => typeof v === 'string') ? val : null;
}

/**
 * 归一化并校验单条规则；非法返回 { error }，合法返回 { rule }。
 * allowMissingWhen：同 id 覆盖内置 guard 时允许省略 when（合并时继承内置条件）。
 */
function normalizeRule(entry, allowMissingWhen = false) {
  if (!isPlainObject(entry)) return { error: '规则必须是键值映射' };
  const { id, type, enabled, priority, when, message } = entry;

  if (typeof id !== 'string' || !id.trim()) return { error: '缺少合法 id' };
  if (type !== 'guard' && type !== 'inject') return { error: `type 必须是 guard|inject（id: ${id}）` };
  if (enabled !== undefined && typeof enabled !== 'boolean') return { error: `enabled 必须是布尔（id: ${id}）` };
  if (typeof message !== 'string' || !message.trim()) return { error: `缺少合法 message（id: ${id}）` };
  const limit = type === 'inject' ? MESSAGE_LIMITS.inject : MESSAGE_LIMITS.guard;
  if (message.length > limit) {
    return { error: `message 超长（${message.length}/${limit}，id: ${id}）` };
  }

  // 仅保留显式声明的可选字段，未声明项留待合并终态补默认（避免覆盖内置值，见 TC-BND-07）
  const rule = { id, type, message };
  if (enabled !== undefined) rule.enabled = enabled;
  if (typeof priority === 'number') rule.priority = priority;

  if (type === 'guard') {
    if (!isPlainObject(when)) {
      if (allowMissingWhen) return { rule }; // 仅覆盖文案等场景，when 从内置继承
      return { error: `guard 规则必须带 when（id: ${id}）` };
    }
    const cond = {};
    if (when.tools !== undefined) {
      const tools = asStringArray(when.tools);
      if (!tools || tools.some((t) => !GUARD_TOOLS.includes(t))) {
        return { error: `when.tools 含非法工具（id: ${id}，允许 ${GUARD_TOOLS.join('/')}）` };
      }
      cond.tools = tools;
    }
    if (when.statuses !== undefined) {
      const statuses = asStringArray(when.statuses);
      if (!statuses || statuses.some((s) => !STATUSES.includes(s))) {
        return { error: `when.statuses 含非法状态（id: ${id}，允许 ${STATUSES.join('/')}）` };
      }
      cond.statuses = statuses;
    }
    if (when.outside !== undefined) {
      if (typeof when.outside !== 'string' || !when.outside.trim()) {
        return { error: `when.outside 必须是非空字符串（id: ${id}）` };
      }
      cond.outside = when.outside;
    }
    if (when.command_contains !== undefined) {
      if (typeof when.command_contains !== 'string' || !when.command_contains.trim()) {
        return { error: `when.command_contains 必须是非空字符串（id: ${id}）` };
      }
      cond.command_contains = when.command_contains;
    }
    rule.when = cond;
  } else if (when !== undefined) {
    // inject 规则不支持 when（v1 无条件注入）
    return { warning: `inject 规则忽略 when（id: ${id}）` };
  }

  return { rule };
}

/**
 * 校验原始规则文档：非法单条剔除进 errors，语义问题进 warnings
 * @returns {{ valid: boolean, errors: string[], warnings: string[], cleaned: object }}
 */
export function validateRules(raw) {
  const errors = [];
  const warnings = [];
  const base = {
    version: 1,
    inject_budget_chars: BUDGET_DEFAULT,
    templates: {},
    rules: [],
  };

  if (raw === null || raw === undefined) return { valid: true, errors, warnings, cleaned: base };
  if (!isPlainObject(raw)) return { valid: false, errors: ['rules.yaml 顶层必须是键值映射'], warnings, cleaned: base };

  const cleaned = { ...base };

  if (raw.inject_budget_chars !== undefined) {
    const budget = raw.inject_budget_chars;
    if (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0) {
      warnings.push(`inject_budget_chars 非法（${JSON.stringify(budget)}），回退 ${BUDGET_DEFAULT}`);
    } else if (budget > BUDGET_MAX) {
      cleaned.inject_budget_chars = BUDGET_MAX;
      warnings.push(`inject_budget_chars ${budget} 超上限，收敛为 ${BUDGET_MAX}`);
    } else {
      cleaned.inject_budget_chars = budget;
    }
  }

  if (raw.templates !== undefined) {
    if (!isPlainObject(raw.templates)) {
      errors.push('templates 必须是键值映射');
    } else {
      for (const [key, val] of Object.entries(raw.templates)) {
        if (typeof val !== 'string') errors.push(`templates.${key} 必须是字符串`);
        else cleaned.templates[key] = val;
      }
    }
  }

  if (raw.rules !== undefined) {
    if (!Array.isArray(raw.rules)) {
      errors.push('rules 必须是数组');
    } else {
      const byId = new Map();
      const defaultIds = new Set(DEFAULT_RULES.rules.map((r) => r.id));
      raw.rules.forEach((entry, _index) => {
        const inheritable = isPlainObject(entry) && typeof entry.id === 'string' && defaultIds.has(entry.id);
        const result = normalizeRule(entry, inheritable);
        if (result.error) {
          errors.push(result.error);
          return;
        }
        if (result.warning) warnings.push(result.warning);
        if (byId.has(result.rule.id)) {
          warnings.push(`规则 id 重复（${result.rule.id}），后者覆盖前者`);
        }
        byId.set(result.rule.id, result.rule);
      });
      cleaned.rules = [...byId.values()];
    }
  }

  return { valid: errors.length === 0, errors, warnings, cleaned };
}

/**
 * 项目规则并入内置默认：同 id 字段级覆盖（when 深合并），新 id 追加
 */
function mergeIntoDefaults(defaults, project) {
  const merged = {
    version: project.version ?? defaults.version,
    inject_budget_chars: project.inject_budget_chars ?? defaults.inject_budget_chars,
    templates: { ...defaults.templates, ...project.templates },
    rules: [...defaults.rules.map((r) => ({ ...r, when: r.when ? { ...r.when } : undefined }))],
  };

  for (const userRule of project.rules) {
    const index = merged.rules.findIndex((r) => r.id === userRule.id);
    if (index === -1) {
      merged.rules.push({ enabled: true, priority: 0, ...userRule });
      continue;
    }
    const existing = merged.rules[index];
    const combined = {
      ...existing,
      ...userRule,
      when:
        existing.when && userRule.when
          ? { ...existing.when, ...userRule.when }
          : (userRule.when ?? existing.when),
    };
    // 合并终态补默认：仅对两侧都未声明的字段生效
    combined.enabled = combined.enabled ?? true;
    combined.priority = combined.priority ?? 0;
    merged.rules[index] = combined;
  }

  return merged;
}

// 按 baseDir 缓存（进程内一次读取，语义与 config.js 一致）
const cache = new Map();

/**
 * 加载项目级规则（内置默认 ← rules.yaml 合并）
 * @param {string} baseDir - 项目根目录
 * @returns {Promise<object>} 合并后的规则文档 { version, inject_budget_chars, templates, rules }
 */
export async function loadRules(baseDir) {
  if (cache.has(baseDir)) return cache.get(baseDir);

  const rulesPath = rulesFilePath(baseDir);
  let raw;
  try {
    raw = await fs.readFile(rulesPath, 'utf-8');
  } catch (error) {
    // ENOENT = 项目没有规则文件（常态），纯默认零警告；其他读错误（EACCES/EISDIR 等）告警降级
    if (error.code !== 'ENOENT') {
      console.warn(`[crs] 规则文件不可读（${RULES_REL_PATH}: ${error.code ?? error.message}），已回退内置默认`);
    }
    const defaults = JSON.parse(JSON.stringify(DEFAULT_RULES));
    cache.set(baseDir, defaults);
    return defaults;
  }

  let merged;
  try {
    const doc = yaml.load(raw);
    const result = validateRules(doc);
    for (const message of [...result.errors, ...result.warnings]) {
      console.warn(`[crs] 规则问题（${RULES_REL_PATH}）: ${message}`);
    }
    merged = mergeIntoDefaults(DEFAULT_RULES, result.cleaned);
  } catch (error) {
    // 解析失败 → 降级默认并告警，不阻塞 hook
    console.warn(`[crs] 规则文件不可用（${RULES_REL_PATH}），已回退内置默认: ${error.message}`);
    merged = JSON.parse(JSON.stringify(DEFAULT_RULES));
  }

  cache.set(baseDir, merged);
  return merged;
}

/**
 * 清空规则缓存（测试或规则热更新用）
 */
export function resetRulesCache() {
  cache.clear();
}
