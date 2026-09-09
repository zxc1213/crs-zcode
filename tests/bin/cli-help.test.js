/**
 * cli-help.test.js - CLI --help/-h 旗标短路回归（BUG-20260909-001-69b294）
 *
 * 修复前：--help 被当作需求描述，误建垃圾需求。
 * 契约：--help/-h 打印用法即返回，零副作用（不创建 .requirements / .crs）。
 */

import { describe, it, beforeEach } from 'mocha';
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

describe('cli --help 短路（BUG-20260909-001-69b294）', function () {
  this.timeout(20000);
  let tmp;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'crs-cli-help-'));
  });

  it('--help 打印用法且零副作用', async () => {
    const { stdout } = await runCli(['--help'], tmp);
    expect(stdout).to.include('用法');
    expect(await fs.readdir(tmp)).to.deep.equal([]);
  });

  it('-h 同样生效', async () => {
    const { stdout } = await runCli(['-h'], tmp);
    expect(stdout).to.include('用法');
    expect(await fs.readdir(tmp)).to.deep.equal([]);
  });

  it('--help 与描述混用仍按帮助处理', async () => {
    const { stdout } = await runCli(['--help', '修复登录超时'], tmp);
    expect(stdout).to.include('用法');
    expect(await fs.readdir(tmp)).to.deep.equal([]);
  });

  it('描述中包含 -h 子串不误伤（仅独立参数才是旗标）', async () => {
    await runCli(['修复 push -h 强推误报'], tmp);
    const reqTypes = (await fs.readdir(path.join(tmp, '.requirements'))).filter((t) => t !== 'project');
    expect(reqTypes).to.have.lengthOf(1);
    const reqs = await fs.readdir(path.join(tmp, '.requirements', reqTypes[0]));
    expect(reqs).to.have.lengthOf(1);
  });

  it('普通创建流程行为不变（回归）', async () => {
    await runCli(['添加用户登录功能'], tmp);
    const reqTypes = (await fs.readdir(path.join(tmp, '.requirements'))).filter((t) => t !== 'project');
    expect(reqTypes).to.have.lengthOf(1);
  });

  it('--quick 剥离出描述并写入 meta.mode（旗标顺序无关）', async () => {
    const { stdout } = await runCli(['--bug', '--quick', '修复登录样式'], tmp);
    expect(stdout).to.include('描述: 修复登录样式');
    expect(stdout).to.not.include('--quick');
    const bugDir = path.join(tmp, '.requirements', 'bugs');
    const reqs = await fs.readdir(bugDir);
    const meta = await fs.readFile(path.join(bugDir, reqs[0], 'meta.yaml'), 'utf-8');
    expect(meta).to.include('mode: quick');
  });

  it('--deep 显式深度模式（meta.mode=semi）', async () => {
    await runCli(['--deep', '添加登录功能'], tmp);
    const featDir = path.join(tmp, '.requirements', 'features');
    const reqs = await fs.readdir(featDir);
    const meta = await fs.readFile(path.join(featDir, reqs[0], 'meta.yaml'), 'utf-8');
    expect(meta).to.include('mode: semi');
  });
});
