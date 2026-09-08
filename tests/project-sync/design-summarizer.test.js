import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

import { detectDesignChange, summarizeSingleDesign, summarizeDesign } from '../../scripts/requirement-manager/project-sync/design-summarizer.js';
import { safeJoin } from '../helpers/path-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE = path.join(__dirname, '../temp-test-summarizer');

async function writeBug(id, decisionsContent, designContent = '') {
  const dir = safeJoin(TEST_BASE, '.requirements', 'bugs', id);
  await fs.mkdir(safeJoin(dir, 'spec'), { recursive: true });
  if (decisionsContent) {
    await fs.writeFile(safeJoin(dir, 'spec', 'decisions.md'), decisionsContent, 'utf-8');
  }
  if (designContent) {
    await fs.writeFile(safeJoin(dir, 'spec', 'design.md'), designContent, 'utf-8');
  }
}

async function writeFeature(id, designContent) {
  const dir = safeJoin(TEST_BASE, '.requirements', 'features', id);
  await fs.mkdir(safeJoin(dir, 'spec'), { recursive: true });
  await fs.writeFile(safeJoin(dir, 'spec', 'design.md'), designContent, 'utf-8');
}

async function cleanup() {
  try {
    await fs.rm(TEST_BASE, { recursive: true, force: true });
  } catch (_e) {}
}

describe('Design Summarizer', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  describe('detectDesignChange', () => {
    it('should return true when frontmatter has design_change: true', async () => {
      await writeBug(
        'BUG-001',
        `---
design_change: true
---

# 决策
some content`
      );
      const result = await detectDesignChange(path.join(TEST_BASE, '.requirements', 'bugs', 'BUG-001'));
      expect(result.hasDesignChange).to.equal(true);
      expect(result.reason).to.equal('frontmatter-explicit');
    });

    it('should return false when frontmatter has design_change: false', async () => {
      await writeBug(
        'BUG-002',
        `---
design_change: false
---

# 决策
no design change`
      );
      const result = await detectDesignChange(path.join(TEST_BASE, '.requirements', 'bugs', 'BUG-002'));
      expect(result.hasDesignChange).to.equal(false);
    });

    it('should fallback to keyword detection when no frontmatter', async () => {
      await writeBug('BUG-003', '# 决策\n\n这是重构方案，涉及架构变更。');
      const result = await detectDesignChange(path.join(TEST_BASE, '.requirements', 'bugs', 'BUG-003'));
      expect(result.hasDesignChange).to.equal(true);
      expect(result.reason).to.equal('keyword-detected');
    });

    it('should return false when no markers', async () => {
      await writeBug('BUG-004', '# 决策\n\n修复了一个 typo');
      const result = await detectDesignChange(path.join(TEST_BASE, '.requirements', 'bugs', 'BUG-004'));
      expect(result.hasDesignChange).to.equal(false);
    });

    it('should return no-decisions-md when file missing', async () => {
      await fs.mkdir(path.join(TEST_BASE, '.requirements', 'bugs', 'BUG-005', 'spec'), { recursive: true });
      const result = await detectDesignChange(path.join(TEST_BASE, '.requirements', 'bugs', 'BUG-005'));
      expect(result.hasDesignChange).to.equal(false);
      expect(result.reason).to.equal('no-decisions-md');
    });
  });

  describe('summarizeSingleDesign', () => {
    it('should extract H2 sections from design.md', async () => {
      await writeFeature(
        'FEAT-001',
        `# Design

## 系统架构

We use layered architecture.

## 核心组件

Scanner + Aggregator.`
      );
      const result = await summarizeSingleDesign(TEST_BASE, 'FEAT-001');
      expect(result).to.be.ok;
      expect(result.sections.length).to.equal(2);
      expect(result.sections[0].title).to.equal('系统架构');
    });

    it('should return null for non-existent requirement', async () => {
      const result = await summarizeSingleDesign(TEST_BASE, 'FEAT-NONEXIST');
      expect(result).to.equal(null);
    });

    it('should handle missing design.md gracefully', async () => {
      const dir = path.join(TEST_BASE, '.requirements', 'features', 'FEAT-002');
      await fs.mkdir(dir, { recursive: true });
      const result = await summarizeSingleDesign(TEST_BASE, 'FEAT-002');
      expect(result).to.be.ok;
      expect(result.sections.length).to.equal(0);
    });
  });

  describe('summarizeDesign', () => {
    it('should aggregate sections by theme across requirements', async () => {
      await writeFeature(
        'FEAT-010',
        `# Design

## 系统架构

Layer A.

## 数据流

Stream X.`
      );
      await writeFeature(
        'FEAT-011',
        `# Design

## 架构补充

Layer B.

## 组件清单

C1, C2.`
      );
      const result = await summarizeDesign(TEST_BASE, [
        { id: 'FEAT-010', type: 'feature' },
        { id: 'FEAT-011', type: 'feature' },
      ]);
      expect(result.architectureSummary).to.contain('FEAT-010');
      expect(result.architectureSummary).to.contain('FEAT-011');
      expect(result.dataflowSummary).to.contain('Stream X');
      expect(result.componentsSummary).to.contain('C1');
    });
  });
});
