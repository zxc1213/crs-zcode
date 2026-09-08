import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import yaml from 'js-yaml';

import { initializeProjectDocs, syncOnRequirementDone, syncOnRequirementChange } from '../../scripts/requirement-manager/project-sync/index.js';
import { readTimeline } from '../../scripts/requirement-manager/project-sync/timeline.js';
import { safeJoin } from '../helpers/path-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE = path.join(__dirname, '../temp-test-change-sync');

const REQ_ID = 'FEAT-20260908-001';

async function setupBase() {
  await fs.mkdir(safeJoin(TEST_BASE, '.requirements'), { recursive: true });
  await fs.writeFile(
    path.join(TEST_BASE, 'package.json'),
    JSON.stringify({ name: 'test-project', version: '1.0.0', description: 'Test project', main: 'index.js' }),
    'utf-8'
  );
}

async function writeFeatureReq(metaOverride = {}, backgroundSummary = '原始功能摘要：支持导出报表。') {
  const dir = safeJoin(TEST_BASE, '.requirements', 'features', REQ_ID);
  await fs.mkdir(safeJoin(dir, 'spec'), { recursive: true });
  const meta = {
    id: REQ_ID,
    type: 'feature',
    title: '报表导出',
    status: 'done',
    created: '2026-09-08T10:00:00.000Z',
    updated: '2026-09-08T12:00:00.000Z',
    ...metaOverride,
  };
  await fs.writeFile(safeJoin(dir, 'meta.yaml'), yaml.dump(meta), 'utf-8');
  await fs.writeFile(safeJoin(dir, 'spec', 'background.md'), `---\nreqId: ${REQ_ID}\n---\n\n${backgroundSummary}\n`, 'utf-8');
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

describe('需求变更同步（区块替换语义）', () => {
  beforeEach(async () => {
    await cleanup();
    await setupBase();
  });
  afterEach(cleanup);

  it('done 后变更：项目文档旧区块被替换为新内容，而不是被跳过', async () => {
    await writeFeatureReq();
    await initializeProjectDocs(TEST_BASE);
    await syncOnRequirementDone(TEST_BASE, REQ_ID);

    const before = await readDoc('functional-requirements.md');
    expect(before).to.include(REQ_ID);
    expect(before).to.include('原始功能摘要');

    // 需求变更：标题与摘要都变了
    await writeFeatureReq({ title: '报表导出（CSV）' }, '变更后摘要：导出格式改为 CSV，支持自定义列。');
    const result = await syncOnRequirementChange(TEST_BASE, REQ_ID, { level: 'medium', reason: '客户要求导出 CSV 格式' });

    expect(result.success).to.equal(true);
    expect(result.updated).to.include('functional-requirements.md');
    expect(result.updated).to.include('business-requirements.md');

    const after = await readDoc('functional-requirements.md');
    // 新内容进入
    expect(after).to.include('报表导出（CSV）');
    expect(after).to.include('变更后摘要');
    // 旧内容被替换掉，区块不重复
    expect(after).to.not.include('原始功能摘要');
    expect(after.match(/### 报表导出/g)).to.have.lengthOf(1);

    // changelog 记录变更
    const changelog = await readDoc('changelog.md');
    expect(changelog).to.include('requirement-changed-medium');
    expect(changelog).to.include('客户要求导出 CSV 格式');

    // 时间线记录变更事件
    const timeline = await readTimeline(TEST_BASE, { type: 'requirement_changed' });
    expect(timeline.events).to.have.lengthOf(1);
    expect(timeline.events[0].reqId).to.equal(REQ_ID);
    expect(timeline.events[0].summary).to.include('[medium]');
  });

  it('未聚合过的活跃需求变更：只记录，不动项目文档', async () => {
    await writeFeatureReq({ status: 'implementing' });
    await initializeProjectDocs(TEST_BASE);

    const result = await syncOnRequirementChange(TEST_BASE, REQ_ID, { level: 'small', reason: '微调文案' });

    expect(result.success).to.equal(true);
    expect(result.updated).to.have.lengthOf(0);
    expect(result.skipped).to.include('project-docs (requirement not aggregated yet)');

    const timeline = await readTimeline(TEST_BASE, { type: 'requirement_changed' });
    expect(timeline.events).to.have.lengthOf(1);

    const functional = await readDoc('functional-requirements.md');
    expect(functional).to.not.include('报表导出');
  });

  it('旧格式（无 crs:block 标记）的聚合内容也能原位替换并迁移为标记格式', async () => {
    await writeFeatureReq();
    await initializeProjectDocs(TEST_BASE);
    await syncOnRequirementDone(TEST_BASE, REQ_ID);

    // 模拟 v1.2 之前的旧格式：去掉标记
    const docPath = path.join(TEST_BASE, '.requirements', 'project', 'functional-requirements.md');
    let content = await fs.readFile(docPath, 'utf-8');
    content = content.replace(/<!-- crs:block:[^>]+:start -->\n?/g, '').replace(/<!-- crs:block:[^>]+:end -->\n?/g, '');
    await fs.writeFile(docPath, content, 'utf-8');

    await writeFeatureReq({ title: '报表导出（v2）' }, '旧格式迁移后的新摘要。');
    const result = await syncOnRequirementChange(TEST_BASE, REQ_ID, { level: 'large', reason: '架构调整' });

    expect(result.success).to.equal(true);
    const after = await readDoc('functional-requirements.md');
    expect(after).to.include('报表导出（v2）');
    expect(after).to.not.include('原始功能摘要');
    // 已迁移为带标记格式（下次替换走标记路径）
    expect(after).to.include(`<!-- crs:block:${REQ_ID}:start -->`);
    expect(after).to.include(`<!-- crs:block:${REQ_ID}:end -->`);
  });

  it('二次变更继续走标记替换路径，内容不累积', async () => {
    await writeFeatureReq();
    await initializeProjectDocs(TEST_BASE);
    await syncOnRequirementDone(TEST_BASE, REQ_ID);

    await writeFeatureReq({ title: '第一次变更' }, '第一次变更摘要。');
    await syncOnRequirementChange(TEST_BASE, REQ_ID, { level: 'small', reason: '一变' });

    await writeFeatureReq({ title: '第二次变更' }, '第二次变更摘要。');
    await syncOnRequirementChange(TEST_BASE, REQ_ID, { level: 'small', reason: '二变' });

    const after = await readDoc('functional-requirements.md');
    expect(after).to.include('第二次变更');
    expect(after).to.not.include('第一次变更');
    expect(after).to.not.include('原始功能摘要');

    // 时间线累积两条变更事件
    const timeline = await readTimeline(TEST_BASE, { type: 'requirement_changed' });
    expect(timeline.events).to.have.lengthOf(2);
  });

  it('done 同步本身也使用标记格式（为后续变更可替换做准备）', async () => {
    await writeFeatureReq();
    await initializeProjectDocs(TEST_BASE);
    await syncOnRequirementDone(TEST_BASE, REQ_ID);

    const after = await readDoc('functional-requirements.md');
    expect(after).to.include(`<!-- crs:block:${REQ_ID}:start -->`);
    expect(after).to.include(`<!-- crs:block:${REQ_ID}:end -->`);

    // 时间线有 project_synced 事件
    const timeline = await readTimeline(TEST_BASE, { type: 'project_synced' });
    expect(timeline.events.length).to.be.at.least(1);
  });
});
