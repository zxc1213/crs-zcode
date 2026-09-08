import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import Dashboard from '../../scripts/requirement-manager/ui/dashboard.js';
import { safeJoin } from '../helpers/path-guard.js';

describe('ui/dashboard - 规范口径统计', () => {
  const testDir = path.join(process.cwd(), '.test-dashboard');

  async function writeMeta(typeDir, id, meta) {
    const reqPath = safeJoin(testDir, '.requirements', typeDir, id);
    await fs.mkdir(reqPath, { recursive: true });
    await fs.writeFile(safeJoin(reqPath, 'meta.yaml'), yaml.dump(meta), 'utf-8');
  }

  beforeEach(async () => {
    await fs.mkdir(safeJoin(testDir, '.requirements'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('按规范状态统计，旧口径自动归一', async () => {
    const now = new Date().toISOString();
    await writeMeta('features', 'FEAT-20260908-001', { id: 'FEAT-20260908-001', type: 'feature', title: '登录', status: 'planning', created: now });
    await writeMeta('features', 'FEAT-20260908-002', { id: 'FEAT-20260908-002', type: 'feature', title: '导出', status: 'done', created: now, completed: now });
    // 旧口径：in_progress 应归入 implementing
    await writeMeta('bugs', 'BUG-20260908-001', { id: 'BUG-20260908-001', type: 'bug', title: '崩溃', status: 'in_progress', createdAt: now });
    // refactors 目录能被扫描（规范拼写，不再是 refactorings）
    await writeMeta('refactors', 'REF-20260908-001', { id: 'REF-20260908-001', type: 'refactor', title: '拆分', status: 'review', created: now });

    const dashboard = new Dashboard(testDir);
    const stats = await dashboard.getStatistics();

    expect(stats.total).to.equal(4);
    expect(stats.active).to.equal(3);
    expect(stats.byStatus.planning).to.equal(1);
    expect(stats.byStatus.implementing).to.equal(1);
    expect(stats.byStatus.review).to.equal(1);
    expect(stats.byStatus.done).to.equal(1);
    expect(stats.byType.refactor).to.equal(1);
  });

  it('活跃需求 = 非 done 中创建时间最新者', async () => {
    await writeMeta('features', 'FEAT-20260908-001', { id: 'FEAT-20260908-001', type: 'feature', title: '旧需求', status: 'analyzed', created: '2026-09-01T00:00:00Z' });
    await writeMeta('features', 'FEAT-20260908-002', { id: 'FEAT-20260908-002', type: 'feature', title: '新需求', status: 'planning', created: '2026-09-08T00:00:00Z' });
    await writeMeta('bugs', 'BUG-20260908-001', { id: 'BUG-20260908-001', type: 'bug', title: '已完成的旧 bug', status: 'done', created: '2026-09-09T00:00:00Z' });

    const dashboard = new Dashboard(testDir);
    const active = await dashboard.getActiveRequirement();

    expect(active).to.be.ok;
    expect(active.id).to.equal('FEAT-20260908-002');
  });

  it('最近需求按创建时间倒序（兼容 createdAt 旧字段）', async () => {
    await writeMeta('features', 'FEAT-20260908-001', { id: 'FEAT-20260908-001', type: 'feature', title: 'a', status: 'planning', createdAt: '2026-09-01T00:00:00Z' });
    await writeMeta('features', 'FEAT-20260908-002', { id: 'FEAT-20260908-002', type: 'feature', title: 'b', status: 'planning', created: '2026-09-05T00:00:00Z' });

    const dashboard = new Dashboard(testDir);
    const recent = await dashboard.getRecentRequirements(10);

    expect(recent.map((r) => r.id)).to.deep.equal(['FEAT-20260908-002', 'FEAT-20260908-001']);
  });

  it('空项目返回空统计', async () => {
    const dashboard = new Dashboard(testDir);
    const stats = await dashboard.getStatistics();
    const active = await dashboard.getActiveRequirement();

    expect(stats.total).to.equal(0);
    expect(active).to.be.null;
  });
});
