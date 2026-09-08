/**
 * Export 模块 - 端到端集成测试
 *
 * 完整验证 collect → render → write 流程，覆盖关键边界场景。
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { safeJoin } from '../helpers/path-guard.js';

import { exportReport } from '../../scripts/export/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE = path.join(__dirname, '../temp-test-export-e2e');

async function setupFixture(opts = {}) {
  await fs.mkdir(TEST_BASE, { recursive: true });
  const reqsDir = path.join(TEST_BASE, '.requirements');
  await fs.mkdir(reqsDir, { recursive: true }); // 始终创建 .requirements 目录

  // 创建需求
  if (opts.reqCount > 0) {
    for (let i = 0; i < opts.reqCount; i++) {
      const isFeature = i % 2 === 0;
      const typeDirName = isFeature ? 'features' : 'bugs';
      const typeSingular = isFeature ? 'feature' : 'bug';
      const prefix = isFeature ? 'FEAT' : 'BUG';
      const id = `${prefix}-20260613-${String(i + 1).padStart(3, '0')}-abc${i}`;
      const dir = path.join(reqsDir, typeDirName, id, 'spec');
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(path.join(reqsDir, typeDirName, id, 'meta.yaml'), [`id: ${id}`, `type: ${typeSingular}`, `title: 测试需求 ${i + 1}`, `status: ${i % 2 === 0 ? 'done' : 'open'}`, `priority:`, `  level: P${(i % 4) + 1}`, `  score: ${6 + (i % 3)}`, `tags:`, `  - test`, `  - export`, `created: '2026-06-13T10:00:00.000Z'`, `updated: '2026-06-13T11:00:00.000Z'`].join('\n'), 'utf-8');

      await fs.writeFile(path.join(dir, 'background.md'), `# 背景\n\n这是测试需求 ${i + 1} 的背景说明。\n\n包含代码：\n\n\`\`\`\nconst x = ${i};\n\`\`\`\n`, 'utf-8');
    }
  }

  // 创建 project 目录
  if (opts.withProject) {
    const projectDir = path.join(reqsDir, 'project');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'meta.yaml'), 'version: 1\nproject_name: test-e2e\nupdated: 2026-06-13T00:00:00.000Z\n', 'utf-8');
    await fs.writeFile(path.join(projectDir, 'project-structure.md'), '# 项目结构\n\nsrc/\n  └── index.js', 'utf-8');
    await fs.writeFile(path.join(projectDir, 'changelog.md'), '# 项目变更历史\n\n---\n\n## [2026-06-13T10:00:00.000Z] requirement-done\n\n- **类型**: feature\n- **标题**: 测试\n- **来源**: FEAT-001\n', 'utf-8');
  }

  return reqsDir;
}

async function cleanup() {
  try {
    await fs.rm(TEST_BASE, { recursive: true, force: true });
  } catch (_e) {
    // ignore
  }
}

describe('Export 端到端集成', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('完整流程：聚合 3 个需求 + 项目级文档 + 渲染 HTML', async () => {
    const reqsDir = await setupFixture({ reqCount: 3, withProject: true });
    const output = path.join(TEST_BASE, 'report.html');

    const result = await exportReport({
      requirementsDir: reqsDir,
      output,
      options: { title: '集成测试报告' },
    });

    expect(result.success).to.be.true;
    expect(result.output.path).to.equal(path.resolve(output));
    expect(result.output.size).to.be.greaterThan(1024);
    expect(result.meta.totalReqs).to.equal(3);

    const html = await fs.readFile(output, 'utf-8');
    expect(html.startsWith('<!DOCTYPE html>')).to.be.true;
    expect(html).to.include('集成测试报告');
    expect(html).to.include('测试需求 1');
    expect(html).to.include('测试需求 2');
    expect(html).to.include('项目结构');
  });

  it('空 .requirements 目录也能生成报告', async () => {
    const reqsDir = await setupFixture({ reqCount: 0 });
    const output = path.join(TEST_BASE, 'empty.html');

    const result = await exportReport({ requirementsDir: reqsDir, output });
    expect(result.success).to.be.true;
    expect(result.meta.totalReqs).to.equal(0);

    const html = await fs.readFile(output, 'utf-8');
    expect(html).to.include('暂无需求');
  });

  it('需求目录不存在时返回明确错误', async () => {
    const result = await exportReport({
      requirementsDir: path.join(TEST_BASE, 'nonexistent'),
      output: path.join(TEST_BASE, 'x.html'),
    });

    expect(result.success).to.be.false;
    expect(result.error).to.include('ENO_REQ_DIR');
  });

  it('标题含特殊字符时正确转义', async () => {
    const reqsDir = await setupFixture({ reqCount: 1 });

    // 覆盖 meta.yaml 加上特殊字符标题
    const dir = safeJoin(reqsDir, 'features');
    const entries = await fs.readdir(dir);
    const reqDir = safeJoin(dir, entries[0]);
    await fs.writeFile(safeJoin(reqDir, 'meta.yaml'), 'id: FEAT-X\n' + 'type: feature\n' + 'title: "包含 <script> 和 \\"引号\\" 的标题"\n' + 'status: done\n' + 'priority:\n' + '  level: P1\n' + '  score: 7\n', 'utf-8');

    const output = path.join(TEST_BASE, 'xss.html');
    const result = await exportReport({ requirementsDir: reqsDir, output });
    expect(result.success).to.be.true;

    const html = await fs.readFile(output, 'utf-8');
    // 必须不含未转义的 <script>
    expect(html).to.not.include('包含 <script>');
    expect(html).to.include('&lt;script&gt;');
  });

  it('--no-mermaid 模式不渲染依赖图', async () => {
    const reqsDir = await setupFixture({ reqCount: 2 });
    const output = path.join(TEST_BASE, 'no-mermaid.html');

    const result = await exportReport({
      requirementsDir: reqsDir,
      output,
      options: { noMermaid: true },
    });

    expect(result.success).to.be.true;
    const html = await fs.readFile(output, 'utf-8');
    expect(html).to.not.include('id="dep-graph"');
    expect(html).to.not.include('cdn.jsdelivr.net');
  });

  it('--offline 模式不加载 CDN', async () => {
    const reqsDir = await setupFixture({ reqCount: 1 });
    const output = path.join(TEST_BASE, 'offline.html');

    const result = await exportReport({
      requirementsDir: reqsDir,
      output,
      options: { offline: true },
    });

    expect(result.success).to.be.true;
    const html = await fs.readFile(output, 'utf-8');
    expect(html).to.not.include('cdn.jsdelivr.net');
  });

  it('自动创建嵌套输出目录', async () => {
    const reqsDir = await setupFixture({ reqCount: 1 });
    const output = path.join(TEST_BASE, 'deep/nested/dir/report.html');

    const result = await exportReport({ requirementsDir: reqsDir, output });
    expect(result.success).to.be.true;
    expect(await fs.stat(output)).to.exist;
  });

  it('性能：3 个需求 1 秒内完成', async function () {
    this.timeout(5000);
    const reqsDir = await setupFixture({ reqCount: 3 });
    const output = path.join(TEST_BASE, 'perf.html');

    const start = Date.now();
    const result = await exportReport({ requirementsDir: reqsDir, output });
    const duration = Date.now() - start;

    expect(result.success).to.be.true;
    expect(duration).to.be.lessThan(1000);
  });
});
