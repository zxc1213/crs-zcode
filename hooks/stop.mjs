#!/usr/bin/env node
/**
 * CRS Stop hook (ZCode): sync requirement documents + emit execution summary.
 *
 * On session end, when a project has an active requirement:
 * - sync index tables (pending -> filled) and meta.yaml status into plan.md
 * - count execution.log entries and report a summary via additionalContext
 *   (text from the rules engine template `stop_summary`)
 *
 * Manual smoke test:
 *   printf '%s\n' '{"hook_event_name":"Stop","session_id":"t","cwd":"<project>"}' \
 *     | node hooks/stop.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { readActiveRequirement, readStdinJson, emitAdditionalContext, emitNothing } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const input = await readStdinJson();
const eventName = input.hook_event_name || input.hookEventName || 'Stop';
const cwd = input.cwd || process.cwd();

const active = readActiveRequirement(cwd);
if (!active || !active.target) {
  emitNothing();
  process.exit(0);
}

// sync document status (failure is non-fatal)
try {
  const planSyncPath = path.resolve(__dirname, '../scripts/requirement-manager/utils/plan-sync.js');
  const { syncPlanStatus, syncIndexTables } = await import(planSyncPath);
  await syncIndexTables(active.reqPath);
  await syncPlanStatus(cwd, active.reqPath);
} catch (_err) {
  // keep going, summary is best-effort
}

let lines = 0;
try {
  const logs = await fs.readFile(path.join(active.reqPath, 'execution.log'), 'utf-8');
  lines = logs.split('\n').filter((l) => l.trim()).length;
} catch (_err) {
  // no log yet
}

if (lines <= 0) {
  emitNothing();
  process.exit(0);
}

// 总结文案来自规则引擎模板（不可用时静默，不阻塞会话结束）
try {
  const { loadRules, applyPlaceholders } = await import('../scripts/requirement-manager/core/rules.js');
  const rules = await loadRules(cwd);
  const summary = applyPlaceholders(rules.templates.stop_summary, { id: active.target, n: lines });
  emitAdditionalContext(eventName, summary);
} catch (_err) {
  emitNothing();
}
