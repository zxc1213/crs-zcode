/**
 * config.test.js - 项目级配置加载与覆盖语义
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { loadConfig, resetConfigCache, configFilePath, DEFAULT_CONFIG } from '../../scripts/requirement-manager/core/config.js';

async function makeBaseDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'crs-config-'));
}

async function writeConfig(baseDir, content) {
  const dir = path.join(baseDir, '.requirements', '_system');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'config.yaml'), content, 'utf-8');
}

describe('core/config - loadConfig', () => {
  let baseDir;

  beforeEach(async () => {
    baseDir = await makeBaseDir();
    resetConfigCache();
  });

  afterEach(async () => {
    resetConfigCache();
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it('无配置文件时返回完整默认配置', async () => {
    const cfg = await loadConfig(baseDir);
    expect(cfg).to.deep.equal(DEFAULT_CONFIG);
    expect(cfg.priority.weights.business_value).to.equal(40);
    expect(cfg.quality.gate_threshold).to.equal(80);
    expect(cfg.docs_map.max_depth).to.equal(3);
    expect(cfg.skeleton.root).to.deep.equal(['spec.md', 'plan.md', 'test-cases.md']);
  });

  it('部分覆盖：只写 priority.weights 时其余保持默认', async () => {
    await writeConfig(baseDir, 'priority:\n  weights:\n    business_value: 50\n    urgency: 25\n    dependencies: 15\n    effort: 5\n    risk: 5\n');

    const cfg = await loadConfig(baseDir);
    expect(cfg.priority.weights.business_value).to.equal(50);
    expect(cfg.quality.gate_threshold).to.equal(80); // 未覆盖
    expect(cfg.docs_map.max_depth).to.equal(3); // 未覆盖
  });

  it('覆盖 docs_map.max_depth 与 quality.gate_threshold', async () => {
    await writeConfig(baseDir, 'quality:\n  gate_threshold: 90\ndocs_map:\n  max_depth: 5\n');

    const cfg = await loadConfig(baseDir);
    expect(cfg.quality.gate_threshold).to.equal(90);
    expect(cfg.docs_map.max_depth).to.equal(5);
  });

  it('覆盖 skeleton 骨架清单', async () => {
    await writeConfig(baseDir, 'skeleton:\n  root:\n    - spec.md\n    - notes.md\n  subdirs:\n    spec:\n      - design.md\n');

    const cfg = await loadConfig(baseDir);
    expect(cfg.skeleton.root).to.deep.equal(['spec.md', 'notes.md']);
    expect(cfg.skeleton.subdirs.spec).to.deep.equal(['design.md']);
  });

  it('非法 YAML 结构时降级默认并继续可用', async () => {
    await writeConfig(baseDir, 'priority:\n  weights:\n    business_value: not_a_number\n');

    const cfg = await loadConfig(baseDir);
    expect(cfg).to.deep.equal(DEFAULT_CONFIG);
  });

  it('顶层不是映射时降级默认', async () => {
    await writeConfig(baseDir, '- just\n- a\n- list\n');

    const cfg = await loadConfig(baseDir);
    expect(cfg).to.deep.equal(DEFAULT_CONFIG);
  });

  it('结果按 baseDir 缓存，reset 后重新读取', async () => {
    expect(await loadConfig(baseDir)).to.deep.equal(DEFAULT_CONFIG);

    await writeConfig(baseDir, 'docs_map:\n  max_depth: 7\n');
    // 缓存生效：仍为默认
    expect((await loadConfig(baseDir)).docs_map.max_depth).to.equal(3);

    resetConfigCache();
    expect((await loadConfig(baseDir)).docs_map.max_depth).to.equal(7);
  });

  it('configFilePath 限制在项目根内', () => {
    const p = configFilePath(baseDir);
    expect(p.startsWith(path.resolve(baseDir))).to.equal(true);
    expect(p).to.include(path.join('.requirements', '_system', 'config.yaml'));
  });
});
