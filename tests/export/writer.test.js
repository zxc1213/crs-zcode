/**
 * Export 模块 - Writer 测试
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

import { write } from '../../scripts/export/writer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.join(__dirname, '../temp-test-export-writer');

describe('Export Writer', () => {
  beforeEach(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (_e) {
      // ignore
    }
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (_e) {
      // ignore
    }
  });

  it('应写入 HTML 文件', async () => {
    const out = path.join(TEST_DIR, 'report.html');
    const result = await write('<!DOCTYPE html><html></html>', out);
    expect(result.path).to.equal(path.resolve(out));
    expect(result.size).to.be.greaterThan(0);
    expect(result.durationMs).to.be.greaterThanOrEqual(0);

    const content = await fs.readFile(out, 'utf-8');
    expect(content).to.include('<!DOCTYPE html>');
  });

  it('应自动创建不存在的目录', async () => {
    const out = path.join(TEST_DIR, 'nested/deep/dir/report.html');
    const result = await write('<html></html>', out);
    expect(result.path).to.equal(path.resolve(out));

    const stat = await fs.stat(out);
    expect(stat.isFile()).to.be.true;
  });

  it('应支持中文路径', async () => {
    const out = path.join(TEST_DIR, '报告 目录', 'v0.11.html');
    const result = await write('<html></html>', out);
    expect(result.path).to.equal(path.resolve(out));

    const stat = await fs.stat(out);
    expect(stat.isFile()).to.be.true;
  });

  it('返回正确的统计信息', async () => {
    const html = '<html><body>hello</body></html>';
    const out = path.join(TEST_DIR, 'x.html');
    const result = await write(html, out);
    expect(result.size).to.equal(Buffer.byteLength(html, 'utf-8'));
  });
});
