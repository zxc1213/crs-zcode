import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import yaml from 'js-yaml';

import { aggregateRequirements, aggregateSingleRequirement, formatFeatureTableRows, formatFeatureDetails } from '../../scripts/requirement-manager/project-sync/requirements-aggregator.js';
import { safeJoin } from '../helpers/path-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE = path.join(__dirname, '../temp-test-aggregator');

async function writeReq(type, id, meta, specBackground = '') {
  const dir = safeJoin(TEST_BASE, '.requirements', `${type}s`, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(safeJoin(dir, 'spec'), { recursive: true });
  await fs.writeFile(safeJoin(dir, 'meta.yaml'), yaml.dump(meta), 'utf-8');
  if (specBackground) {
    await fs.writeFile(safeJoin(dir, 'spec', 'background.md'), specBackground, 'utf-8');
  }
}

async function cleanup() {
  try {
    await fs.rm(TEST_BASE, { recursive: true, force: true });
  } catch (_e) {}
}

describe('Requirements Aggregator', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('should aggregate done requirements only by default', async () => {
    await writeReq('feature', 'FEAT-001', {
      id: 'FEAT-001',
      type: 'feature',
      title: 'Feature One',
      status: 'done',
      created: '2026-01-01T00:00:00.000Z',
    });
    await writeReq('feature', 'FEAT-002', {
      id: 'FEAT-002',
      type: 'feature',
      title: 'Feature Two',
      status: 'planning',
      created: '2026-01-02T00:00:00.000Z',
    });

    const result = await aggregateRequirements(TEST_BASE);
    expect(result.features.length).to.equal(1);
    expect(result.features[0].id).to.equal('FEAT-001');
  });

  it('should include non-done requirements when onlyDone=false', async () => {
    await writeReq('feature', 'FEAT-003', {
      id: 'FEAT-003',
      type: 'feature',
      title: 'Feature',
      status: 'planning',
      created: '2026-01-01T00:00:00.000Z',
    });
    const result = await aggregateRequirements(TEST_BASE, { onlyDone: false });
    expect(result.features.length).to.equal(1);
  });

  it('should aggregate single requirement by ID', async () => {
    await writeReq('feature', 'FEAT-004', {
      id: 'FEAT-004',
      type: 'feature',
      title: 'Single Feat',
      status: 'done',
    });
    const single = await aggregateSingleRequirement(TEST_BASE, 'FEAT-004');
    expect(single).to.be.ok;
    expect(single.id).to.equal('FEAT-004');
  });

  it('should return null for non-existent requirement', async () => {
    const single = await aggregateSingleRequirement(TEST_BASE, 'FEAT-NONEXIST');
    expect(single).to.equal(null);
  });

  it('should extract background summary', async () => {
    await writeReq(
      'feature',
      'FEAT-005',
      {
        id: 'FEAT-005',
        type: 'feature',
        title: 'With Background',
        status: 'done',
      },
      '# 背景与目标\n\n这是摘要第一段。\n\n## 子标题\n\n第二段内容。'
    );
    const single = await aggregateSingleRequirement(TEST_BASE, 'FEAT-005');
    expect(single.summary).to.contain('这是摘要第一段');
  });

  it('should format feature table rows as markdown', async () => {
    const features = [{ id: 'FEAT-A', title: 'A', type: 'feature', status: 'done', tags: ['auth'], completedAt: '2026-06-13T10:00:00.000Z' }];
    const rows = formatFeatureTableRows(features);
    expect(rows).to.contain('| auth |');
    expect(rows).to.contain('FEAT-A');
    expect(rows).to.contain('2026-06-13');
  });

  it('should format empty feature table gracefully', async () => {
    const rows = formatFeatureTableRows([]);
    expect(rows).to.contain('暂无');
  });

  it('should format feature details with proper structure', async () => {
    const features = [
      {
        id: 'FEAT-B',
        title: 'B Title',
        type: 'feature',
        status: 'done',
        tags: ['ui'],
        summary: 'A summary',
      },
    ];
    const details = formatFeatureDetails(features);
    expect(details).to.contain('### B Title');
    expect(details).to.contain('FEAT-B');
    expect(details).to.contain('A summary');
  });
});
