/**
 * requirement-creator.test.js - 骨架清单覆盖、路径安全与时间线埋点
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';
import { Processor } from '../../scripts/requirement-manager/core/processor.js';
import { reset as resetIdGenerator } from '../../scripts/requirement-manager/utils/id-generator.js';
import { init, cleanup } from '../../scripts/requirement-manager/utils/storage.js';
import { resetConfigCache } from '../../scripts/requirement-manager/core/config.js';
import { readTimeline } from '../../scripts/requirement-manager/project-sync/timeline.js';

async function makeBaseDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'crs-creator-'));
}

async function writeConfig(baseDir, config) {
  const dir = path.join(baseDir, '.requirements', '_system');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'config.yaml'), yaml.dump(config), 'utf-8');
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch (_e) {
    return false;
  }
}

describe('requirement-creator - 骨架与埋点', () => {
  let baseDir;
  let processor;

  beforeEach(async () => {
    baseDir = await makeBaseDir();
    await init(baseDir);
    await resetIdGenerator();
    resetConfigCache();
    processor = new Processor(baseDir);
  });

  afterEach(async () => {
    resetConfigCache();
    await cleanup(baseDir);
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it('默认骨架：根文件与三个子目录齐全', async () => {
    const created = await processor.create({ type: 'feature', mode: 'semi_auto', description: 'x' });

    for (const f of ['spec.md', 'plan.md', 'test-cases.md']) {
      expect(await exists(path.join(created.path, f)), f).to.equal(true);
    }
    for (const dir of ['spec', 'plan', 'test-cases']) {
      expect(await exists(path.join(created.path, dir)), dir).to.equal(true);
    }
    expect(await exists(path.join(created.path, 'spec', 'background.md'))).to.equal(true);
  });

  it('config.yaml 自定义骨架清单生效', async () => {
    await writeConfig(baseDir, {
      skeleton: {
        root: ['spec.md'],
        subdirs: { spec: ['design.md'] },
      },
    });

    const created = await processor.create({ type: 'feature', mode: 'semi_auto', description: 'x' });

    expect(await exists(path.join(created.path, 'spec.md'))).to.equal(true);
    expect(await exists(path.join(created.path, 'spec', 'design.md'))).to.equal(true);
    // 被裁剪的条目不应存在
    expect(await exists(path.join(created.path, 'plan.md'))).to.equal(false);
    expect(await exists(path.join(created.path, 'spec', 'background.md'))).to.equal(false);
  });

  it('自定义条目无对应模板时写入最小骨架', async () => {
    await writeConfig(baseDir, {
      skeleton: { root: ['custom-note.md'], subdirs: {} },
    });

    const created = await processor.create({ type: 'feature', mode: 'semi_auto', description: 'x' });
    const content = await fs.readFile(path.join(created.path, 'custom-note.md'), 'utf-8');
    expect(content).to.include('TODO');
  });

  it('项目模板目录优先于内置模板', async () => {
    // 项目侧为 spec.md 提供自定义模板
    const tplDir = path.join(baseDir, '.requirements', '_system', 'templates');
    await fs.mkdir(tplDir, { recursive: true });
    await fs.writeFile(path.join(tplDir, 'spec.md.tpl'), '# 项目自定义 spec（${ID}）\n', 'utf-8');

    const created = await processor.create({ type: 'feature', mode: 'semi_auto', description: 'x' });
    const content = await fs.readFile(path.join(created.path, 'spec.md'), 'utf-8');
    expect(content).to.include('项目自定义 spec');
  });

  it('骨架条目含路径穿越片段时拒绝创建', async () => {
    await writeConfig(baseDir, {
      skeleton: { root: ['../evil.md'], subdirs: {} },
    });

    let err;
    try {
      await processor.create({ type: 'feature', mode: 'semi_auto', description: 'x' });
    } catch (e) {
      err = e;
    }
    expect(err).to.be.an('Error');
    expect(err.message).to.match(/illegal skeleton entry|escapes requirement directory/);
    // 穿越文件不得落盘
    expect(await exists(path.join(baseDir, 'evil.md'))).to.equal(false);
  });

  it('创建需求后时间线记录 requirement_created 事件', async () => {
    const created = await processor.create({ type: 'bug', mode: 'semi_auto', description: '埋点验证' });

    const { events } = await readTimeline(baseDir, { reqId: created.id });
    const createdEvent = events.find((e) => e.type === 'requirement_created');
    expect(createdEvent, 'requirement_created 事件应存在').to.exist;
    expect(createdEvent.reqId).to.equal(created.id);
  });

  it('更新状态后时间线记录 status_changed 事件（埋点归位 status-machine）', async () => {
    const created = await processor.create({ type: 'bug', mode: 'semi_auto', description: '状态埋点验证' });

    await processor.update(created.id, { status: 'done' });

    const { events } = await readTimeline(baseDir, { reqId: created.id });
    const changed = events.find((e) => e.type === 'status_changed');
    expect(changed, 'status_changed 事件应存在').to.exist;
    expect(changed.summary).to.include('done');
  });
});
