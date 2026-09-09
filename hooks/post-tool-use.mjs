#!/usr/bin/env node
/**
 * CRS PostToolUse hook (ZCode): execution log + rule-driven phase guard.
 *
 * For Edit/Write/Bash on a project with .requirements/:
 * - append a timestamped entry to .requirements/execution.log
 * - evaluate guard rules from .requirements/_system/rules.yaml (defaults in
 *   scripts/requirement-manager/core/rules.js, incl. the v1.4 phase-gate) and
 *   inject each matching rule's message via additionalContext.
 *
 * Manual smoke test:
 *   printf '%s\n' '{"hook_event_name":"PostToolUse","tool_name":"Write","tool_input":{"file_path":"/tmp/x.js"},"cwd":"<project>"}' \
 *     | node hooks/post-tool-use.mjs
 */

import fs from 'fs';
import path from 'path';
import { readActiveRequirement, readStdinJson, emitAdditionalContext, emitNothing } from './lib.mjs';

// 单次守卫注入总量上限（字符）；多条命中按 priority 拼接，超出截断
const GUARD_INJECTION_LIMIT = 600;

const input = await readStdinJson();
const eventName = input.hook_event_name || input.hookEventName || 'PostToolUse';
const toolName = input.tool_name || input.toolName || '';
const toolInput = input.tool_input || input.toolInput || {};
const cwd = input.cwd || process.cwd();

const targetTools = ['Edit', 'Write', 'Bash'];
if (!targetTools.includes(toolName)) {
  emitNothing();
  process.exit(0);
}

const requirementsDir = path.join(cwd, '.requirements');
if (!fs.existsSync(requirementsDir)) {
  emitNothing();
  process.exit(0);
}

// 活跃需求一次扫描，日志与阶段守卫两处复用（该 hook 每次工具调用都会执行）
const active = readActiveRequirement(cwd);

// 1. execution log (per active requirement, same path the Stop hook reads)
try {
  if (active) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(path.join(active.reqPath, 'execution.log'), `[${timestamp}] Tool: ${toolName}\n`, 'utf8');
  }
} catch (_err) {
  // logging must never break the tool call
}

// 2. guard rules（规则引擎不可用时静默跳过，与 drift check 的降级口径一致）
let rules = null;
let applyPlaceholders = (text) => text;
try {
  const engine = await import('../scripts/requirement-manager/core/rules.js');
  rules = await engine.loadRules(cwd);
  applyPlaceholders = engine.applyPlaceholders;
} catch (_err) {
  emitNothing();
  process.exit(0);
}

// 工具匹配白名单之外的规则条件不适用于当前事件
const matchesWhen = (when) => {
  if (when.tools && !when.tools.includes(toolName)) return false;
  if (when.statuses && (!active || !when.statuses.includes(active.status))) return false;
  if (when.outside !== undefined) {
    const filePath = toolInput.file_path;
    if (!filePath) return false;
    const baseDir = path.resolve(cwd, when.outside);
    const abs = path.resolve(cwd, filePath);
    // 路径段感知：.requirements-evil 不得误判为 .requirements 内
    const inside = abs === baseDir || abs.startsWith(baseDir + path.sep) || abs.startsWith(baseDir + '/');
    if (inside) return false;
  }
  if (when.command_contains !== undefined) {
    if (toolName !== 'Bash') return false;
    const normalize = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
    if (!normalize(toolInput.command || '').includes(normalize(when.command_contains))) return false;
  }
  return true;
};

const hits = rules.rules
  .filter((rule) => rule.type === 'guard' && rule.enabled !== false && matchesWhen(rule.when || {}))
  .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

let message = '';
for (const rule of hits) {
  const text = applyPlaceholders(rule.message, {
    id: active ? active.target : '',
    status: active ? active.status : '',
    path: toolInput.file_path ? path.resolve(cwd, toolInput.file_path) : '',
  });
  if (message && message.length + 1 + text.length > GUARD_INJECTION_LIMIT) break;
  message = message ? `${message}\n${text}` : text;
}

if (message) {
  emitAdditionalContext(eventName, message);
  process.exit(0);
}

emitNothing();
