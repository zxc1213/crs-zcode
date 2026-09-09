#!/usr/bin/env node
/**
 * CRS SessionStart hook (ZCode).
 *
 * If the current project has an active requirement, inject its ID/status so
 * the agent immediately knows which requirement is in flight and which
 * workflow rules apply. Additionally, when a docs-map exists and has drifted
 * entries, append a one-line reminder. Silent when there is no .requirements
 * directory or no docs-map.yaml.
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
      driftHint = ` Docs-map: ${driftedCount} registered doc(s) drifted/unconfirmed — run crs-project-sync --scan-docs to review, or /crs:req --dashboard for details.`;
    }
  } catch (_err) {
    // drift check must never break the session start
  }
}

if (!active || !active.target) {
  if (driftHint) {
    emitAdditionalContext(eventName, `[crs]${driftHint}`);
  } else {
    emitNothing();
  }
  process.exit(0);
}

const phaseHint =
  active.status === 'planning' || active.status === 'analyzed'
    ? 'Current phase forbids editing files outside .requirements/ until all 5 document stages are filled.'
    : `Requirement status: ${active.status}.`;

emitAdditionalContext(
  eventName,
  `[crs] Active requirement: ${active.target} (status: ${active.status}). ${phaseHint} ` +
    'Use /crs:req --active or /crs:req --dashboard to inspect it.' +
    driftHint,
);
