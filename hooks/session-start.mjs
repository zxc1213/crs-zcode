#!/usr/bin/env node
/**
 * CRS SessionStart hook (ZCode).
 *
 * If the current project has an active requirement, inject its ID/status so
 * the agent immediately knows which requirement is in flight and which
 * workflow rules apply. Silent when there is no .requirements directory.
 *
 * Manual smoke test:
 *   printf '%s\n' '{"hook_event_name":"SessionStart","session_id":"t","source":"startup","cwd":"<project>"}' \
 *     | node hooks/session-start.mjs
 */

import { readActiveRequirement, readStdinJson, emitAdditionalContext, emitNothing } from './lib.mjs';

const input = await readStdinJson();
const eventName = input.hook_event_name || input.hookEventName || 'SessionStart';
const cwd = input.cwd || process.cwd();

const active = readActiveRequirement(cwd);
if (!active || !active.target) {
  emitNothing();
  process.exit(0);
}

const phaseHint =
  active.status === 'planning' || active.status === 'analyzed'
    ? 'Current phase forbids editing files outside .requirements/ until all 5 document stages are filled.'
    : `Requirement status: ${active.status}.`;

emitAdditionalContext(
  eventName,
  `[crs] Active requirement: ${active.target} (status: ${active.status}). ${phaseHint} ` +
    'Use /crs:req --active or /crs:req --dashboard to inspect it.',
);
