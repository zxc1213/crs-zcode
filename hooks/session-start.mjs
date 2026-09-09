#!/usr/bin/env node
/**
 * CRS SessionStart hook (ZCode).
 *
 * If the current project has an active requirement, inject its ID/status so
 * the agent immediately knows which requirement is in flight and which
 * workflow rules apply. Message text comes from the rules engine templates
 * (scripts/requirement-manager/core/rules.js; project overrides in
 * .requirements/_system/rules.yaml). Additionally:
 * - when a docs-map exists with drifted entries, append the drift reminder
 * - inject-type rules are appended within the inject budget (priority order)
 * Silent when there is no .requirements directory.
 *
 * Manual smoke test:
 *   printf '%s\n' '{"hook_event_name":"SessionStart","session_id":"t","source":"startup","cwd":"<project>"}' \
 *     | node hooks/session-start.mjs
 */

import fs from 'fs';
import path from 'path';
import { readActiveRequirement, readStdinJson, emitAdditionalContext, emitNothing } from './lib.mjs';

const input = await readStdinJson();
const eventName = input.hook_event_name || input.hookEventName || 'SessionStart';
const cwd = input.cwd || process.cwd();

const requirementsDir = path.join(cwd, '.requirements');
if (!fs.existsSync(requirementsDir)) {
  emitNothing();
  process.exit(0);
}

// 规则引擎不可用时静默降级（与 drift check 口径一致）
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

const active = readActiveRequirement(cwd);

// docs-map 漂移轻提示（仅在已建立文档地图时；unregistered 属于 --scan-docs 的职责，不在这里打扰）
let driftHint = '';
const docsMapFile = path.join(requirementsDir, 'project', 'docs-map.yaml');
if (fs.existsSync(docsMapFile)) {
  try {
    const { checkDrift } = await import('../scripts/requirement-manager/project-sync/docs-map.js');
    const drift = await checkDrift(cwd);
    const driftedCount = drift.stale.length + drift.unconfirmed.length;
    if (driftedCount > 0) {
      driftHint = applyPlaceholders(rules.templates.session_drift, { count: driftedCount });
    }
  } catch (_err) {
    // drift check must never break the session start
  }
}

const budget = rules.inject_budget_chars;

if (!active || !active.target) {
  if (driftHint) {
    const text = `[crs]${driftHint}`;
    emitAdditionalContext(eventName, text.length <= budget ? text : text.slice(0, budget));
  } else {
    emitNothing();
  }
  process.exit(0);
}

const phaseHint =
  active.status === 'planning' || active.status === 'analyzed'
    ? rules.templates.session_phase_locked
    : applyPlaceholders(rules.templates.session_phase_status, { status: active.status });

// 主消息（活跃需求）优先保留，inject 规则在剩余预算内按 priority 追加
let message = applyPlaceholders(rules.templates.session_active, {
  id: active.target,
  status: active.status,
  phase_hint: phaseHint,
});
message += driftHint;

const injectRules = rules.rules
  .filter((rule) => rule.type === 'inject' && rule.enabled !== false)
  .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

for (const rule of injectRules) {
  const candidate = `${message} ${rule.message}`;
  if (candidate.length > budget) continue; // 整条丢弃，尝试下一条更短的
  message = candidate;
}

emitAdditionalContext(eventName, message);
