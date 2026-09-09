/**
 * v14-regressions.test.js - v1.4「正确性与收敛」回归测试
 *
 * 覆盖本轮修复的三个数据正确性问题：
 * - H2: getKnowledgeGraph 现收项目根（内部解析 .requirements），引擎侧集成可真实扫描
 * - M2: 聚合器的完成日期优先 meta.completed（原来引用不存在的 meta.updated，恒回退 created）
 * - M3: fullResync 不再丢失 timeline.yaml / docs-map.yaml（原只保留 changelog）
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import yaml from 'js-yaml';

import { getKnowledgeGraph } from '../../scripts/knowledge-graph/index.js';
import { aggregateSingleRequirement } from '../../scripts/requirement-manager/project-sync/requirements-aggregator.js';
import { fullResync, initializeProjectDocs } from '../../scripts/requirement-manager/project-sync/index.js';
import { init } from '../../scripts/requirement-manager/utils/storage.js';
import { reset as resetIdGenerator } from '../../scripts/requirement-manager/utils/id-generator.js';
import { Processor } from '../../scripts/requirement-manager/core/processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function makeBaseDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'crs-v14-'));
}

describe('v1.4 回归：知识图谱路径语义（H2）', () => {
  it('getKnowledgeGraph(项目根) 能扫描到 .requirements 下的需求', async () => {
    const baseDir = await makeBaseDir();
    try {
      const reqDir = path.join(baseDir, '.requirements', 'features', 'FEAT-20260909-001-aaa111');
      await fs.mkdir(reqDir, { recursive: true });
      await fs.writeFile(
        path.join(reqDir, 'meta.yaml'),
        yaml.dump({ id: 'FEAT-20260909-001-aaa111', type: 'feature', title: '登录功能', status: 'done', priority: { level: 'P1', score: 7 } }),
        'utf-8'
      );

      // 引擎调用口径：传项目根
      const graph = await getKnowledgeGraph(baseDir);
      const all = graph.getAllRequirements();
      expect(all.some((r) => r.id === 'FEAT-20260909-001-aaa111')).to.equal(true);
    } finally {
      await fs.rm(baseDir, { recursive: true, force: true });
    }
  });
});

describe('v1.4 回归：聚合完成日期（M2）', () => {
  it('completedAt 优先 completed，不再恒等于 created', async () => {
    const baseDir = await makeBaseDir();
    try {
      const reqDir = path.join(baseDir, '.requirements', 'features', 'FEAT-001');
      await fs.mkdir(reqDir, { recursive: true });
      await fs.writeFile(
        path.join(reqDir, 'meta.yaml'),
        yaml.dump({
          id: 'FEAT-001',
          type: 'feature',
          title: 'X',
          status: 'done',
          created: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-05T00:00:00.000Z',
          completed: '2026-09-08T12:00:00.000Z',
        }),
        'utf-8'
      );

      const req = await aggregateSingleRequirement(baseDir, 'FEAT-001');
      expect(req).to.exist;
      expect(req.completedAt).to.equal('2026-09-08T12:00:00.000Z');
    } finally {
      await fs.rm(baseDir, { recursive: true, force: true });
    }
  });
});

describe('v1.4 回归：fullResync 保留账本与文档地图（M3）', () => {
  let baseDir;

  beforeEach(async () => {
    baseDir = await makeBaseDir();
    await init(baseDir);
    await resetIdGenerator();
    delete process.env.CRS_PROJECT_SYNC;
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it('fullResync 后 timeline.yaml 与 docs-map.yaml 内容保留', async () => {
    // 先初始化项目文档
    await initializeProjectDocs(baseDir, {});

    // 手工写入时间线事件与文档地图条目（模拟项目历史）
    const projectDir = path.join(baseDir, '.requirements', 'project');
    const timelinePath = path.join(projectDir, 'timeline.yaml');
    const docsMapPath = path.join(projectDir, 'docs-map.yaml');
    await fs.writeFile(timelinePath, yaml.dump({ events: [{ seq: 1, ts: '2026-09-01T00:00:00.000Z', type: 'requirement_created', reqId: 'FEAT-X', title: '历史事件' }] }), 'utf-8');
    await fs.writeFile(docsMapPath, yaml.dump({ docs: [{ path: 'README.md', title: 'README', role: 'readme', last_reviewed: '2026-09-01T00:00:00.000Z' }] }), 'utf-8');

    const result = await fullResync(baseDir);

    expect(result.success).to.equal(true);
    // 账本与地图未丢失（原 bug：被整体挪进 project.bak，新目录只剩一条 full_resync 事件）
    const timeline = yaml.load(await fs.readFile(timelinePath, 'utf-8'));
    expect(timeline.events.some((e) => e.type === 'requirement_created' && e.reqId === 'FEAT-X')).to.equal(true);
    const docsMap = yaml.load(await fs.readFile(docsMapPath, 'utf-8'));
    expect(docsMap.docs.some((d) => d.path === 'README.md')).to.equal(true);
  });

  it('需求 done 后时间线包含完整事件链（创建→流转），resync 不破坏', async () => {
    const processor = new Processor(baseDir);
    const created = await processor.create({ type: 'feature', mode: 'semi_auto', description: '账本回归' });
    await processor.update(created.id, { status: 'done' });

    const result = await fullResync(baseDir);
    expect(result.success).to.equal(true);

    const timeline = yaml.load(await fs.readFile(path.join(baseDir, '.requirements', 'project', 'timeline.yaml'), 'utf-8'));
    const types = timeline.events.map((e) => e.type);
    expect(types).to.include('requirement_created');
    expect(types).to.include('status_changed');
  });
});
