import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import yaml from 'js-yaml';

import { appendEvent, readTimeline, timelinePath } from '../../scripts/requirement-manager/project-sync/timeline.js';
import { safeJoin } from '../helpers/path-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE = path.join(__dirname, '../temp-test-timeline');

async function setupBase() {
  await fs.mkdir(safeJoin(TEST_BASE, '.requirements'), { recursive: true });
}

async function cleanup() {
  try {
    await fs.rm(TEST_BASE, { recursive: true, force: true });
  } catch (_e) {}
}

describe('Timeline 事件账本', () => {
  beforeEach(async () => {
    await cleanup();
    await setupBase();
  });
  afterEach(cleanup);

  it('追加事件并递增 seq', async () => {
    const e1 = await appendEvent(TEST_BASE, { type: 'requirement_created', reqId: 'FEAT-20260908-001', title: '登录', summary: '创建' });
    const e2 = await appendEvent(TEST_BASE, { type: 'status_changed', reqId: 'FEAT-20260908-001', summary: 'planning → analyzed' });

    expect(e1.seq).to.equal(1);
    expect(e2.seq).to.equal(2);
    expect(e1.ts).to.be.a('string');
    expect(e1.type).to.equal('requirement_created');
  });

  it('拒绝非法事件类型', async () => {
    let err;
    try {
      await appendEvent(TEST_BASE, { type: 'not_an_event' });
    } catch (e) {
      err = e;
    }
    expect(err).to.be.ok;
    expect(err.message).to.match(/Invalid timeline event type/);
  });

  it('读取按时间倒序，支持 type/reqId/limit 过滤', async () => {
    await appendEvent(TEST_BASE, { type: 'requirement_created', reqId: 'FEAT-20260908-001' });
    await appendEvent(TEST_BASE, { type: 'status_changed', reqId: 'FEAT-20260908-001' });
    await appendEvent(TEST_BASE, { type: 'requirement_created', reqId: 'BUG-20260908-002' });
    await appendEvent(TEST_BASE, { type: 'retro_completed', reqId: 'FEAT-20260908-001' });

    const all = await readTimeline(TEST_BASE);
    expect(all.events).to.have.lengthOf(4);
    expect(all.events[0].type).to.equal('retro_completed'); // 最新在前

    const filtered = await readTimeline(TEST_BASE, { type: 'requirement_created' });
    expect(filtered.events).to.have.lengthOf(2);

    const byReq = await readTimeline(TEST_BASE, { reqId: 'FEAT-20260908-001' });
    expect(byReq.events).to.have.lengthOf(3);

    const limited = await readTimeline(TEST_BASE, { limit: 2 });
    expect(limited.events).to.have.lengthOf(2);
  });

  it('单条坏事件跳过并计数，appendEvent 写回时顺带清洗', async () => {
    const e1 = await appendEvent(TEST_BASE, { type: 'project_synced' });
    // 手动注入一条坏事件（无 type）
    const file = timelinePath(TEST_BASE);
    const data = yaml.load(await fs.readFile(file, 'utf-8'));
    data.events.push({ seq: 99, ts: '2026-09-09T00:00:00Z' }); // 缺 type
    await fs.writeFile(file, yaml.dump(data), 'utf-8');

    // 读取：坏条目跳过并计数
    const withBad = await readTimeline(TEST_BASE);
    expect(withBad.skipped).to.equal(1);
    expect(withBad.events).to.have.lengthOf(1);

    // 再追加：写回时只保留合法条目（顺带清洗），seq 接续合法最大值
    const e2 = await appendEvent(TEST_BASE, { type: 'full_resync' });
    expect(e1.seq).to.equal(1);
    expect(e2.seq).to.equal(2);

    const clean = await readTimeline(TEST_BASE);
    expect(clean.skipped).to.equal(0);
    expect(clean.events).to.have.lengthOf(2);
  });

  it('账本文件损坏时备份后重建，seq 重新开始', async () => {
    await appendEvent(TEST_BASE, { type: 'project_synced' });
    const file = timelinePath(TEST_BASE);
    await fs.writeFile(file, 'events: [ this is: not: valid: yaml: {{{', 'utf-8');

    const result = await readTimeline(TEST_BASE);
    expect(result.events).to.have.lengthOf(0);

    const e = await appendEvent(TEST_BASE, { type: 'full_resync' });
    expect(e.seq).to.equal(1);

    // 损坏文件留有备份
    const dir = path.dirname(file);
    const files = await fs.readdir(dir);
    expect(files.some((f) => f.startsWith('timeline.broken-'))).to.be.true;
  });

  it('长文本字段被截断（title 200 / summary 500）', async () => {
    const entry = await appendEvent(TEST_BASE, {
      type: 'lesson_saved',
      title: 'x'.repeat(300),
      summary: 'y'.repeat(800),
    });
    expect(entry.title).to.have.lengthOf(200);
    expect(entry.summary).to.have.lengthOf(500);
  });
});
