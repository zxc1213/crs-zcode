/**
 * Export 模块 - Collector 测试
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

import { collect } from '../../scripts/export/collector.js';
import { safeJoin } from '../helpers/path-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE = path.join(__dirname, '../temp-test-export-collector');

async function setupRequirement(type, id, meta, spec = {}) {
  const dir = safeJoin(TEST_BASE, '.requirements', `${type}s`, id);
  await fs.mkdir(safeJoin(dir, 'spec'), { recursive: true });

  const metaContent = typeof meta === 'string' ? meta : yamlDump(meta);
  await fs.writeFile(safeJoin(dir, 'meta.yaml'), metaContent, 'utf-8');

  for (const [name, content] of Object.entries(spec)) {
    await fs.writeFile(safeJoin(dir, 'spec', `${name}.md`), content, 'utf-8');
  }
  return dir;
}

function yamlDump(obj) {
  // 简单 yaml 序列化（避免依赖 js-yaml 在测试中）
  const lines = [];
  const flatten = (prefix, value) => {
    if (value === null || value === undefined) {
      lines.push(`${prefix}: `);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value)) {
        flatten(prefix ? `${prefix}.${k}` : k, v);
      }
    } else if (Array.isArray(value)) {
      lines.push(`${prefix}:`);
      for (const item of value) {
        lines.push(`  - ${typeof item === 'string' ? item : JSON.stringify(item)}`);
      }
    } else if (typeof value === 'string' && value.includes(':')) {
      lines.push(`${prefix}: "${value}"`);
    } else {
      lines.push(`${prefix}: ${value}`);
    }
  };
  // 简化版：只处理一层嵌套
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const [k2, v2] of Object.entries(v)) {
        if (v2 && typeof v2 === 'object' && !Array.isArray(v2)) {
          lines.push(`  ${k2}:`);
          for (const [k3, v3] of Object.entries(v2)) {
            lines.push(`    ${k3}: ${v3}`);
          }
        } else if (Array.isArray(v2)) {
          lines.push(`  ${k2}:`);
          for (const item of v2) lines.push(`    - ${item}`);
        } else {
          lines.push(`  ${k2}: ${v2}`);
        }
      }
    } else if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${item}`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  return lines.join('\n');
}

describe('Export Collector', () => {
  beforeEach(async () => {
    try {
      await fs.rm(TEST_BASE, { recursive: true, force: true });
    } catch (_e) {
      // ignore
    }
    await fs.mkdir(TEST_BASE, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_BASE, { recursive: true, force: true });
    } catch (_e) {
      // ignore
    }
  });

  it('应收集单个需求', async () => {
    await setupRequirement('feature', 'FEAT-20260613-001-abc123', {
      id: 'FEAT-20260613-001-abc123',
      type: 'feature',
      title: '测试功能',
      status: 'done',
      priority: { level: 'P1', score: 7.5 },
      tags: ['test', 'export'],
      created: '2026-06-13T10:00:00.000Z',
      updated: '2026-06-13T11:00:00.000Z',
    });

    const result = await collect(path.join(TEST_BASE, '.requirements'));
    expect(result.requirements).to.have.lengthOf(1);
    expect(result.requirements[0].id).to.equal('FEAT-20260613-001-abc123');
    expect(result.requirements[0].title).to.equal('测试功能');
    expect(result.requirements[0].type).to.equal('feature');
    expect(result.requirements[0].status).to.equal('done');
  });

  it('应统计状态分布', async () => {
    await setupRequirement('feature', 'FEAT-001', { id: 'FEAT-001', type: 'feature', title: 'A', status: 'done' });
    await setupRequirement('feature', 'FEAT-002', { id: 'FEAT-002', type: 'feature', title: 'B', status: 'done' });
    await setupRequirement('bug', 'BUG-001', { id: 'BUG-001', type: 'bug', title: 'C', status: 'open' });

    const result = await collect(path.join(TEST_BASE, '.requirements'));
    expect(result.stats.byStatus.done).to.equal(2);
    expect(result.stats.byStatus.open).to.equal(1);
    // req.type 来自 meta.yaml（单数）
    expect(result.stats.byType.feature).to.equal(2);
    expect(result.stats.byType.bug).to.equal(1);
  });

  it('应跳过无效 meta.yaml 并记录警告', async () => {
    const warnings = [];
    // 创建一个有效的需求
    await setupRequirement('feature', 'FEAT-001', { id: 'FEAT-001', type: 'feature', title: 'A', status: 'done' });

    // 创建一个无效的需求目录（无 meta.yaml）
    await fs.mkdir(path.join(TEST_BASE, '.requirements', 'features', 'FEAT-002'), { recursive: true });

    const result = await collect(path.join(TEST_BASE, '.requirements'), {
      hooks: { onWarning: (msg) => warnings.push(msg) },
    });
    expect(result.requirements).to.have.lengthOf(1);
    expect(result.requirements[0].id).to.equal('FEAT-001');
    expect(warnings.length).to.be.greaterThan(0);
  });

  it('应读取 spec 子目录文件', async () => {
    await setupRequirement(
      'feature',
      'FEAT-001',
      { id: 'FEAT-001', type: 'feature', title: 'A', status: 'done' },
      {
        background: '# 背景\n测试背景说明',
        design: '# 设计\n架构设计',
      }
    );

    const result = await collect(path.join(TEST_BASE, '.requirements'));
    expect(result.requirements[0].spec.background).to.include('测试背景说明');
    expect(result.requirements[0].spec.design).to.include('架构设计');
  });

  it('空目录返回空需求列表', async () => {
    const result = await collect(path.join(TEST_BASE, '.requirements'));
    expect(result.requirements).to.have.lengthOf(0);
    expect(result.meta.totalReqs).to.equal(0);
  });

  it('项目级文档缺失时 project 为 null', async () => {
    const result = await collect(path.join(TEST_BASE, '.requirements'));
    expect(result.project).to.equal(null);
  });

  it('应收集项目级文档', async () => {
    const projectDir = path.join(TEST_BASE, '.requirements', 'project');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'meta.yaml'), 'version: 1\nproject_name: test-proj\n', 'utf-8');
    await fs.writeFile(path.join(projectDir, 'project-structure.md'), '# 项目结构\n...', 'utf-8');

    const result = await collect(path.join(TEST_BASE, '.requirements'));
    expect(result.project).to.not.be.null;
    expect(result.project.meta.project_name).to.equal('test-proj');
    expect(result.project.structure).to.include('项目结构');
  });

  it('应提取依赖关系', async () => {
    await setupRequirement(
      'feature',
      'FEAT-002',
      { id: 'FEAT-002', type: 'feature', title: 'B', status: 'done' },
      {
        background: '依赖 FEAT-001 实现',
        design: '基于 BUG-001 的修复',
      }
    );

    const result = await collect(path.join(TEST_BASE, '.requirements'));
    expect(result.requirements[0].dependencies).to.include('FEAT-001');
    expect(result.requirements[0].dependencies).to.include('BUG-001');
    // 不应包含自己
    expect(result.requirements[0].dependencies).to.not.include('FEAT-002');
  });

  it('应正确返回 meta 信息', async () => {
    await setupRequirement('feature', 'FEAT-001', { id: 'FEAT-001', type: 'feature', title: 'A', status: 'done' });
    const result = await collect(path.join(TEST_BASE, '.requirements'), {
      projectName: 'my-project',
      version: 'v1.0.0',
    });
    expect(result.meta.projectName).to.equal('my-project');
    expect(result.meta.version).to.equal('v1.0.0');
    expect(result.meta.totalReqs).to.equal(1);
    expect(result.meta.generatedAt).to.match(/^\d{4}-\d{2}-\d{2}T/);
  });
});
