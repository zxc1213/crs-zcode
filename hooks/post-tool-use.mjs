#!/usr/bin/env node
/**
 * CRS PostToolUse hook (ZCode): execution log + phase gate guard.
 *
 * For Edit/Write/Bash on a project with .requirements/:
 * - append a timestamped entry to .requirements/execution.log
 * - when the active requirement is still planning/analyzed and an external
 *   file is edited, emit a phase-gate warning via additionalContext.
 *
 * Manual smoke test:
 *   printf '%s\n' '{"hook_event_name":"PostToolUse","tool_name":"Write","tool_input":{"file_path":"/tmp/x.js"},"cwd":"<project>"}' \
 *     | node hooks/post-tool-use.mjs
 */

import fs from 'fs';
import path from 'path';
import { readActiveRequirement, readStdinJson, emitAdditionalContext, emitNothing } from './lib.mjs';

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

// 1. execution log (per active requirement, same path the Stop hook reads)
try {
  const active = readActiveRequirement(cwd);
  if (active) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(path.join(active.reqPath, 'execution.log'), `[${timestamp}] Tool: ${toolName}\n`, 'utf8');
  }
} catch (_err) {
  // logging must never break the tool call
}

// 2. phase gate: block-editing hint while requirement is planning/analyzed
if (toolName === 'Edit' || toolName === 'Write') {
  const filePath = toolInput.file_path;
  if (filePath) {
    const active = readActiveRequirement(cwd);
    if (active && (active.status === 'planning' || active.status === 'analyzed')) {
      const absReqsDir = path.resolve(requirementsDir);
      const absFilePath = path.resolve(filePath);
      const insideReqs =
        absFilePath.startsWith(absReqsDir + path.sep) || absFilePath.startsWith(absReqsDir + '/');
      if (!insideReqs) {
        emitAdditionalContext(
          eventName,
          `[crs] Phase violation: active requirement ${active.target} is "${active.status}". ` +
            `Editing ${absFilePath} is not allowed yet. ` +
            'Finish the 5 document stages (spec -> test-cases -> plan) before touching code.',
        );
        process.exit(0);
      }
    }
  }
}

emitNothing();
