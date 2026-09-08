/**
 * actor-source.test.js
 *
 * Validates BUG-20260615-001-e7e5ed BND-7: the actor field passed to
 * initializeProjectDocs({actor}) is persisted to changelog.md ("触发者")
 * so that auto-init events can be traced back to their trigger source.
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { initializeProjectDocs } from '../../scripts/requirement-manager/project-sync/index.js';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

async function makeBaseDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'crs-actor-src-'));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_e) {
    return false;
  }
}

describe('actor source traceability (BUG-20260615-001 BND-7)', () => {
  let baseDir;

  beforeEach(async () => {
    baseDir = await makeBaseDir();
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  async function readActorFromChangelog() {
    const changelogPath = path.join(baseDir, '.requirements', 'project', 'changelog.md');
    if (!(await pathExists(changelogPath))) return null;
    const content = await fs.readFile(changelogPath, 'utf-8');
    // Template renders: "- **触发者**: ${ACTOR}". Strip markdown bold/colons.
    const match = content.match(/触发者[^:：]*[:：]\s*(\S+)/);
    return match ? match[1] : null;
  }

  it('persists actor=auto-create when invoked from Processor.create() path', async () => {
    await initializeProjectDocs(baseDir, { actor: 'auto-create' });
    const actor = await readActorFromChangelog();
    expect(actor).to.equal('auto-create');
  });

  it('persists actor=project-init when invoked from project init upgrade path', async () => {
    await initializeProjectDocs(baseDir, { actor: 'project-init' });
    const actor = await readActorFromChangelog();
    expect(actor).to.equal('project-init');
  });

  it('persists actor=cli when invoked manually via crs-project-init', async () => {
    await initializeProjectDocs(baseDir, { actor: 'cli' });
    const actor = await readActorFromChangelog();
    expect(actor).to.equal('cli');
  });

  it('falls back to system when actor is not provided', async () => {
    await initializeProjectDocs(baseDir, {});
    const actor = await readActorFromChangelog();
    expect(actor).to.equal('system');
  });
});
