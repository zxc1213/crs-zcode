import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import yaml from 'js-yaml';

import { initializeProjectDocs, syncOnRequirementDone, syncOnBugFixed, isProjectInitialized, fullResync } from '../../scripts/requirement-manager/project-sync/index.js';
import { safeJoin } from '../helpers/path-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE = path.join(__dirname, '../temp-test-project-sync');

async function setupBase() {
  await fs.mkdir(TEST_BASE, { recursive: true });
  await fs.mkdir(path.join(TEST_BASE, '.requirements'), { recursive: true });
  await fs.writeFile(
    path.join(TEST_BASE, 'package.json'),
    JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      description: 'Test project for sync',
      main: 'index.js',
    }),
    'utf-8'
  );
}

async function writeReq(type, id, metaOverride = {}, specFiles = {}) {
  const dir = safeJoin(TEST_BASE, '.requirements', `${type}s`, id);
  await fs.mkdir(safeJoin(dir, 'spec'), { recursive: true });
  const meta = {
    id,
    type,
    title: `${id} Title`,
    status: 'done',
    created: '2026-06-13T10:00:00.000Z',
    updated: '2026-06-13T12:00:00.000Z',
    ...metaOverride,
  };
  await fs.writeFile(safeJoin(dir, 'meta.yaml'), yaml.dump(meta), 'utf-8');
  for (const [name, content] of Object.entries(specFiles)) {
    await fs.writeFile(safeJoin(dir, 'spec', name), content, 'utf-8');
  }
}

async function readDoc(fileName) {
  try {
    return await fs.readFile(path.join(TEST_BASE, '.requirements', 'project', fileName), 'utf-8');
  } catch (_e) {
    return null;
  }
}

async function cleanup() {
  try {
    await fs.rm(TEST_BASE, { recursive: true, force: true });
  } catch (_e) {}
}

describe('Project Sync Orchestrator', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  describe('initializeProjectDocs', () => {
    it('should create 4 core documents + meta + changelog', async () => {
      await setupBase();
      const result = await initializeProjectDocs(TEST_BASE);
      expect(result.success).to.equal(true);
      expect(result.created).to.include('project-structure.md');
      expect(result.created).to.include('business-requirements.md');
      expect(result.created).to.include('functional-requirements.md');
      expect(result.created).to.include('functional-design.md');
      expect(result.created).to.include('meta.yaml');

      const init = await isProjectInitialized(TEST_BASE);
      expect(init).to.equal(true);
    });

    it('should be idempotent (skip when already initialized)', async () => {
      await setupBase();
      await initializeProjectDocs(TEST_BASE);
      const result2 = await initializeProjectDocs(TEST_BASE);
      expect(result2.skipped.length).to.be.greaterThan(0);
    });

    it('should force rebuild with --force option', async () => {
      await setupBase();
      await initializeProjectDocs(TEST_BASE);
      const result2 = await initializeProjectDocs(TEST_BASE, { force: true });
      expect(result2.success).to.equal(true);
    });
  });

  describe('syncOnRequirementDone', () => {
    it('should auto-initialize if project not initialized', async () => {
      await setupBase();
      await writeReq('feature', 'FEAT-SYNC-001', { title: 'Auto Init Test' });
      const result = await syncOnRequirementDone(TEST_BASE, 'FEAT-SYNC-001');
      expect(result.success).to.equal(true);
      const init = await isProjectInitialized(TEST_BASE);
      expect(init).to.equal(true);
    });

    it('should append feature to functional-requirements', async () => {
      await setupBase();
      await initializeProjectDocs(TEST_BASE);
      await writeReq('feature', 'FEAT-SYNC-002', {
        title: 'Feature Two',
        tags: ['module-x'],
      });
      const result = await syncOnRequirementDone(TEST_BASE, 'FEAT-SYNC-002');
      expect(result.success).to.equal(true);
      expect(result.updated).to.include('functional-requirements.md');

      const doc = await readDoc('functional-requirements.md');
      expect(doc).to.contain('FEAT-SYNC-002');
    });

    it('should append changelog entry', async () => {
      await setupBase();
      await initializeProjectDocs(TEST_BASE);
      await writeReq('feature', 'FEAT-SYNC-003', { title: 'Changelog Test' });
      await syncOnRequirementDone(TEST_BASE, 'FEAT-SYNC-003');
      const cl = await readDoc('changelog.md');
      expect(cl).to.contain('FEAT-SYNC-003');
      expect(cl).to.contain('requirement-done');
    });

    it('should be idempotent (no duplicate entries)', async () => {
      await setupBase();
      await initializeProjectDocs(TEST_BASE);
      await writeReq('feature', 'FEAT-SYNC-004', { title: 'Idempotent Test' });
      await syncOnRequirementDone(TEST_BASE, 'FEAT-SYNC-004');
      const docAfterFirst = await readDoc('functional-requirements.md');
      const matchesAfterFirst = (docAfterFirst.match(/FEAT-SYNC-004/g) || []).length;
      // 第 2、3 次同步不应增加 ID 引用次数
      await syncOnRequirementDone(TEST_BASE, 'FEAT-SYNC-004');
      await syncOnRequirementDone(TEST_BASE, 'FEAT-SYNC-004');
      const docFinal = await readDoc('functional-requirements.md');
      const matchesFinal = (docFinal.match(/FEAT-SYNC-004/g) || []).length;
      expect(matchesFinal).to.equal(matchesAfterFirst);
    });

    it('should return error for non-existent requirement', async () => {
      await setupBase();
      await initializeProjectDocs(TEST_BASE);
      const result = await syncOnRequirementDone(TEST_BASE, 'FEAT-NONEXIST');
      expect(result.success).to.equal(false);
      expect(result.errors[0]).to.contain('E_PROJ_REQ_NOT_FOUND');
    });

    it('should handle refactor type (only update design)', async () => {
      await setupBase();
      await initializeProjectDocs(TEST_BASE);
      await writeReq(
        'refactor',
        'REF-001',
        { title: 'Big Refactor' },
        {
          'design.md': `# Design\n\n## 系统架构\n\nNew architecture details here.`,
        }
      );
      const result = await syncOnRequirementDone(TEST_BASE, 'REF-001');
      expect(result.success).to.equal(true);
      expect(result.updated).to.include('functional-design.md');
    });
  });

  describe('syncOnBugFixed', () => {
    it('should detect design_change=true and update design doc', async () => {
      await setupBase();
      await initializeProjectDocs(TEST_BASE);
      await writeReq(
        'bug',
        'BUG-DESIGN-001',
        { title: 'Design Bug' },
        {
          'decisions.md': `---
design_change: true
---

# 决策
Need to redesign X.`,
          'design.md': '# Design\n\n## 系统架构\n\nUpdated arch.',
        }
      );
      const result = await syncOnBugFixed(TEST_BASE, 'BUG-DESIGN-001');
      expect(result.success).to.equal(true);
      expect(result.updated).to.include('functional-design.md');
      const design = await readDoc('functional-design.md');
      expect(design).to.contain('BUG-DESIGN-001');
    });

    it('should skip design doc when design_change=false', async () => {
      await setupBase();
      await initializeProjectDocs(TEST_BASE);
      await writeReq(
        'bug',
        'BUG-NODESIGN-001',
        { title: 'Simple Bug' },
        {
          'decisions.md': `---
design_change: false
---

# 决策
Just a typo fix.`,
        }
      );
      const result = await syncOnBugFixed(TEST_BASE, 'BUG-NODESIGN-001');
      expect(result.success).to.equal(true);
      expect(result.skipped).to.include('design-doc (no design_change)');
    });

    it('should still write changelog even without design change', async () => {
      await setupBase();
      await initializeProjectDocs(TEST_BASE);
      await writeReq('bug', 'BUG-CL-001', { title: 'Bug with CL' });
      await syncOnBugFixed(TEST_BASE, 'BUG-CL-001');
      const cl = await readDoc('changelog.md');
      expect(cl).to.contain('BUG-CL-001');
      expect(cl).to.contain('bug-fixed');
    });
  });

  describe('fullResync', () => {
    it('should rebuild docs and preserve changelog', async () => {
      await setupBase();
      await initializeProjectDocs(TEST_BASE);
      await writeReq('feature', 'FEAT-FULL-001', { title: 'Pre-resync Feature' });
      await syncOnRequirementDone(TEST_BASE, 'FEAT-FULL-001');

      const clBefore = await readDoc('changelog.md');
      expect(clBefore).to.contain('FEAT-FULL-001');

      const result = await fullResync(TEST_BASE);
      expect(result.success).to.equal(true);

      const clAfter = await readDoc('changelog.md');
      // 历史 changelog 保留
      expect(clAfter).to.contain('FEAT-FULL-001');
      // 新增的 full-resync 条目
      expect(clAfter).to.contain('full-resync');
    });
  });
});
