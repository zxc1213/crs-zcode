/**
 * cli-rules.test.js - rules 子命令契约（FEAT-20260909-001-4ae874 任务 8）
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(__dirname, '../../scripts/requirement-manager/index.js');

function runCli(args, cwd) {
  return execFileAsync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
}

describe('cli rules 子命令（FEAT-20260909-001-4ae874）', function () {
  this.timeout(20000);
  let tmp;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'crs-cli-rules-'));
    await fs.mkdir(path.join(tmp, '.requirements', '_system'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('无 rules.yaml：列出内置默认（来源=内置）', async () => {
    const { stdout } = await runCli(['rules'], tmp);
    expect(stdout).to.include('phase-guard');
    expect(stdout).to.include('内置');
    expect(stdout).to.include('inject 预算: 600');
  });

  it('有 rules.yaml：项目新增规则带来源标注', async () => {
    await fs.writeFile(
      path.join(tmp, '.requirements', '_system', 'rules.yaml'),
      ['rules:', '  - id: zh-commit', '    type: inject', '    message: 提交信息使用中文'].join('\n'),
      'utf-8'
    );
    const { stdout } = await runCli(['rules'], tmp);
    expect(stdout).to.include('zh-commit');
    expect(stdout).to.include('项目新增');
    expect(stdout).to.include('phase-guard');
  });

  it('rules --validate 合法文件通过，非法文件报错并置退出码', async () => {
    await fs.writeFile(
      path.join(tmp, '.requirements', '_system', 'rules.yaml'),
      'rules:\n  - id: ok\n    type: inject\n    message: fine',
      'utf-8'
    );
    const ok = await runCli(['rules', '--validate'], tmp);
    expect(ok.stdout).to.include('校验通过');

    await fs.writeFile(
      path.join(tmp, '.requirements', '_system', 'rules.yaml'),
      'rules:\n  - type: inject\n    message: 缺 id',
      'utf-8'
    );
    const bad = await runCli(['rules', '--validate'], tmp).catch((e) => e);
    expect(bad.stdout).to.include('缺少合法 id');
    expect(bad.code).to.equal(1);
  });

  it('rules --validate YAML 损坏报语法错误', async () => {
    await fs.writeFile(
      path.join(tmp, '.requirements', '_system', 'rules.yaml'),
      'rules: [ { broken',
      'utf-8'
    );
    const bad = await runCli(['rules', '--validate'], tmp).catch((e) => e);
    expect(bad.stdout).to.include('语法错误');
    expect(bad.code).to.equal(1);
  });
});
