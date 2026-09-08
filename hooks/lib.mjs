#!/usr/bin/env node
/**
 * CRS shared helpers for hooks (ZCode protocol: JSON in via stdin, JSON out via stdout).
 */

import fs from 'fs';
import path from 'path';

const ACTIVE_STATUSES = ['planning', 'analyzed', 'implementing', 'review'];

/**
 * Parse a meta.yaml just enough to read `status` / `created` / `id`.
 * @param {string} content - raw meta.yaml text
 * @returns {{ status: string, created: string, id: string }}
 */
function parseMeta(content) {
  const pick = (key) => {
    const m = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  return { status: pick('status'), created: pick('created'), id: pick('id') };
}

/**
 * Scan .requirements/ for the most recent requirement whose status is active
 * (not done). Falls back to the legacy ACTIVE symlink when present.
 * @param {string} cwd - project working directory
 * @returns {{ target: string, reqPath: string, status: string } | null}
 */
export function readActiveRequirement(cwd) {
  const reqsDir = path.join(cwd, '.requirements');
  if (!fs.existsSync(reqsDir)) return null;

  // legacy path first: ACTIVE symlink (kept for back-compat)
  try {
    const target = fs.readlinkSync(path.join(reqsDir, 'ACTIVE'));
    const reqPath = path.join(reqsDir, target);
    const meta = parseMeta(fs.readFileSync(path.join(reqPath, 'meta.yaml'), 'utf-8'));
    if (meta.status) return { target, reqPath, status: meta.status };
  } catch (_err) {
    // fall through to scan
  }

  // scan */meta.yaml for non-done requirements, newest first
  const candidates = [];
  const scan = (dir, type) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_err) {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const reqPath = path.join(dir, entry.name);
      const metaPath = path.join(reqPath, 'meta.yaml');
      if (!fs.existsSync(metaPath)) {
        scan(reqPath, type);
        continue;
      }
      try {
        const meta = parseMeta(fs.readFileSync(metaPath, 'utf-8'));
        if (ACTIVE_STATUSES.includes(meta.status)) {
          candidates.push({ target: entry.name, reqPath, status: meta.status, created: meta.created });
        }
      } catch (_err) {
        // unreadable meta.yaml, skip
      }
    }
  };

  let types;
  try {
    types = fs.readdirSync(reqsDir, { withFileTypes: true });
  } catch (_err) {
    return null;
  }
  for (const t of types) {
    if (t.isDirectory() && !t.name.startsWith('_') && !t.name.startsWith('.')) {
      scan(path.join(reqsDir, t.name), t.name);
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')));
  const best = candidates[0];
  return { target: best.target, reqPath: best.reqPath, status: best.status };
}

/**
 * Read the whole hook event payload from stdin and parse it as JSON.
 * @returns {Promise<object>}
 */
export async function readStdinJson() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => {
      try {
        resolve(data.trim() ? JSON.parse(data) : {});
      } catch (_err) {
        resolve({});
      }
    });
    process.stdin.on('error', () => resolve({}));
  });
}

/**
 * Emit an additionalContext payload for the current hook event.
 * @param {string} eventName - hook_event_name from the input payload
 * @param {string} message - context text injected into the conversation
 */
export function emitAdditionalContext(eventName, message) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: eventName,
        additionalContext: message,
      },
    }),
  );
}

/**
 * Emit nothing (silently succeed).
 */
export function emitNothing() {
  process.stdout.write('');
}
