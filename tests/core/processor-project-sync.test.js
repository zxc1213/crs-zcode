/**
 * processor-project-sync.test.js
 *
 * Validates BUG-20260615-001-e7e5ed: Processor.create() auto-initializes the
 * .requirements/project/ directory when missing (upgrade-path guardrail).
 *
 * Covers: POS-1, POS-3, POS-5, NEG-1, NEG-2, BND-3, BND-4
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { Processor } from '../../scripts/requirement-manager/core/processor.js';
import { reset as resetIdGenerator } from '../../scripts/requirement-manager/utils/id-generator.js';
import { init, cleanup } from '../../scripts/requirement-manager/utils/storage.js';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const PROJECT_DOCS = ['project-structure.md', 'business-requirements.md', 'functional-requirements.md', 'functional-design.md', 'changelog.md'];

async function makeBaseDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'crs-proj-sync-'));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_e) {
    return false;
  }
}

describe('Processor.create() project-sync guardrail (BUG-20260615-001)', () => {
  let baseDir;
  let processor;
  let originalProjectSyncEnv;

  beforeEach(async () => {
    baseDir = await makeBaseDir();
    await init(baseDir);
    await resetIdGenerator();
    processor = new Processor(baseDir);
    originalProjectSyncEnv = process.env.CRS_PROJECT_SYNC;
    delete process.env.CRS_PROJECT_SYNC;
  });

  afterEach(async () => {
    if (originalProjectSyncEnv === undefined) {
      delete process.env.CRS_PROJECT_SYNC;
    } else {
      process.env.CRS_PROJECT_SYNC = originalProjectSyncEnv;
    }
    await cleanup(baseDir);
  });

  it('POS-1: auto-initializes .requirements/project/ on first create()', async () => {
    // Simulate legacy project: .requirements/ exists but project/meta.yaml does not.
    const projectMeta = path.join(baseDir, '.requirements', 'project', 'meta.yaml');
    expect(await pathExists(projectMeta)).to.equal(false);

    const result = await processor.create({
      type: 'feature',
      mode: 'semi_auto',
      description: 'first feature after upgrade',
    });

    // Requirement itself is created normally.
    expect(result.id).to.match(/^FEAT-\d{8}-\d{3}-[0-9a-f]{6}$/);

    // project meta.yaml now exists.
    expect(await pathExists(projectMeta)).to.equal(true);

    // All 5 project docs exist and are non-empty.
    const projectDir = path.join(baseDir, '.requirements', 'project');
    for (const doc of PROJECT_DOCS) {
      const docPath = path.join(projectDir, doc);
      expect(await pathExists(docPath), `${doc} should exist`).to.equal(true);
      const stat = await fs.stat(docPath);
      expect(stat.size, `${doc} should be non-empty`).to.be.greaterThan(0);
    }
  });

  it('POS-3: skips re-initialization when project/meta.yaml already exists (idempotent)', async () => {
    // First create initializes project docs.
    await processor.create({ type: 'feature', mode: 'semi_auto', description: 'a' });

    const changelogPath = path.join(baseDir, '.requirements', 'project', 'changelog.md');
    const snapshot = await fs.readFile(changelogPath, 'utf-8');

    // Subsequent creates must not rewrite project docs.
    await processor.create({ type: 'feature', mode: 'semi_auto', description: 'b' });
    await processor.create({ type: 'bug', mode: 'semi_auto', description: 'c' });

    const after = await fs.readFile(changelogPath, 'utf-8');
    expect(after).to.equal(snapshot);
  });

  it('POS-5: multiple creates only initialize project once', async () => {
    await processor.create({ type: 'feature', mode: 'semi_auto', description: 'a' });
    await processor.create({ type: 'feature', mode: 'semi_auto', description: 'b' });
    await processor.create({ type: 'feature', mode: 'semi_auto', description: 'c' });

    const changelogPath = path.join(baseDir, '.requirements', 'project', 'changelog.md');
    const changelog = await fs.readFile(changelogPath, 'utf-8');
    // initializeProjectDocs writes exactly one "project-initialized" header on
    // first init; subsequent creates are no-ops because isProjectInitialized=true.
    const initCount = (changelog.match(/project-initialized/g) || []).length;
    expect(initCount).to.equal(1);
  });

  it('NEG-1: create() succeeds even if initializeProjectDocs() fails internally', async () => {
    // initializeProjectDocs swallows internal errors via try/catch and reports
    // them through logProjectSyncError. Block its work by replacing the project/
    // directory with a regular file so its internal safeWrite fails with ENOTDIR.
    const projectSlot = path.join(baseDir, '.requirements', 'project');
    await fs.rm(projectSlot, { recursive: true, force: true });
    await fs.writeFile(projectSlot, 'blocker', 'utf-8');

    const result = await processor.create({ type: 'feature', mode: 'semi_auto', description: 'x' });

    // create() did not propagate the failure.
    expect(result.id).to.match(/^FEAT-\d{8}-\d{3}-[0-9a-f]{6}$/);

    // initializeProjectDocs wrote the failure into project-sync.error.log.
    const logPath = path.join(baseDir, '.requirements', 'logs', 'project-sync.error.log');
    expect(await pathExists(logPath), 'project-sync.error.log should be created').to.equal(true);
  });

  it('NEG-2: CRS_PROJECT_SYNC=off skips auto-init entirely', async () => {
    process.env.CRS_PROJECT_SYNC = 'off';

    const result = await processor.create({ type: 'feature', mode: 'semi_auto', description: 'x' });

    // Requirement created normally.
    expect(result.id).to.match(/^FEAT-\d{8}-\d{3}-[0-9a-f]{6}$/);

    // project/ directory remains without meta.yaml.
    const projectMeta = path.join(baseDir, '.requirements', 'project', 'meta.yaml');
    expect(await pathExists(projectMeta)).to.equal(false);
  });

  it('BND-3: partial project/ files (no meta.yaml) trigger re-init', async () => {
    // Simulate a half-migrated state: changelog.md exists but meta.yaml does not.
    const projectDir = path.join(baseDir, '.requirements', 'project');
    await fs.mkdir(projectDir, { recursive: true });
    const staleChangelogPath = path.join(projectDir, 'changelog.md');
    await fs.writeFile(staleChangelogPath, '# stale manual changelog\n', 'utf-8');

    await processor.create({ type: 'feature', mode: 'semi_auto', description: 'x' });

    const projectMeta = path.join(projectDir, 'meta.yaml');
    expect(await pathExists(projectMeta)).to.equal(true);
  });

  it('BND-4: brand-new project (no .requirements/) gains both req dir and project docs', async () => {
    // Wipe the .requirements/ dir that init() created to simulate empty cwd.
    await fs.rm(path.join(baseDir, '.requirements'), { recursive: true, force: true });

    const result = await processor.create({ type: 'feature', mode: 'semi_auto', description: 'x' });

    expect(result.id).to.match(/^FEAT-\d{8}-\d{3}-[0-9a-f]{6}$/);

    const projectMeta = path.join(baseDir, '.requirements', 'project', 'meta.yaml');
    expect(await pathExists(projectMeta)).to.equal(true);
  });
});
