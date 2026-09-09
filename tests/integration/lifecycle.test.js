/**
 * lifecycle.test.js - 端到端生命周期冒烟（FEAT-20260909-001-4ae874 任务 9）
 *
 * 走一遍用户真实路径：创建需求 → SessionStart 注入 → 规划期守卫 → 规则清单
 * → 时间线事件 → 仪表板。全部通过真实 CLI/hook 子进程执行。
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(ROOT, 'scripts', 'requirement-manager', 'index.js');
const HOOK = (name) => path.join(ROOT, 'hooks', name);

let tmpDir = ''; // 由 beforeEach 指向当前用例的临时项目；CLI 按 process.cwd() 定位 .requirements

function run(file, args, payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { cwd: tmpDir });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ out, code }));
    child.on('error', reject);
    if (payload !== undefined) {
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    }
  });
}

describe('端到端生命周期冒烟', function () {
  this.timeout(60000);
  let tmp;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'crs-lifecycle-'));
    tmpDir = tmp;
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('创建 → 注入 → 守卫 → 规则 → 事件 → 仪表板 全链路', async () => {
    // 1. 创建需求（bug 类型，--quick 模式旗标不污染描述）
    const created = await run(CLI, ['--bug', '--quick', '修复登录超时问题'], undefined);
    expect(created.out).to.include('✓ 需求已创建');
    expect(created.out).to.include('描述: 修复登录超时问题');
    const bugsDir = path.join(tmp, '.requirements', 'bugs');
    const reqId = (await fs.readdir(bugsDir))[0];

    // 2. SessionStart 注入活跃需求
    const session = await run(HOOK('session-start.mjs'), [], { hook_event_name: 'SessionStart', cwd: tmp });
    expect(session.out).to.include(`Active requirement: ${reqId}`);

    // 3. 规划期编辑外部文件 → 阶段守卫命中（内置默认规则）
    const guard = await run(HOOK('post-tool-use.mjs'), [], {
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: path.join(tmp, 'src', 'login.js') },
      cwd: tmp,
    });
    expect(JSON.parse(guard.out).hookSpecificOutput.additionalContext).to.include('Phase violation');

    // 4. rules 清单（含内置规则与来源标注）
    const rules = await run(CLI, ['rules'], undefined);
    expect(rules.out).to.include('phase-guard');
    expect(rules.out).to.include('内置');

    // 5. 时间线事件入账
    const event = await run(CLI, ['event', '--type', 'lesson_saved', '--id', reqId, '--title', '冒烟', '--summary', '端到端'], undefined);
    expect(event.out).to.include('✓ 事件已记录');
    expect((await fs.readFile(path.join(tmp, '.requirements', 'project', 'timeline.yaml'), 'utf-8'))).to.include(reqId);

    // 6. 仪表板与状态查询可用
    const dashboard = await run(CLI, ['--dashboard'], undefined);
    expect(dashboard.out + dashboard.code).to.satisfy((s) => s.includes('需求') || s === '0');
    const status = await run(CLI, ['--status', reqId], undefined);
    expect(status.out).to.include(reqId);
  });
});
