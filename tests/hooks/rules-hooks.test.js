/**
 * rules-hooks.test.js - 三 hook 消费规则数据的端到端契约（FEAT-20260909-001-4ae874）
 *
 * 关键契约：
 * - 无 rules.yaml 时注入文案与 v1.4 硬编码逐字等价（行为不变重构）
 * - guard/inject 规则来自 rules.yaml，hook 源码零内嵌文案
 * - inject 预算：主消息优先，priority 降序，整条保留/丢弃
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = path.resolve(__dirname, '../../hooks');
const REPO_ROOT = path.resolve(__dirname, '../..');
const REQ_ID = 'FEAT-20260909-900-egg';

function runHook(hookName, payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(HOOKS_DIR, hookName)], { cwd: REPO_ROOT });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', () => resolve({ out, err }));
    child.on('error', reject);
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function parseContext(out) {
  if (!out.trim()) return '';
  return JSON.parse(out).hookSpecificOutput.additionalContext;
}

async function makeProject(dir, { status = 'planning', rulesYaml = null, logLines = 0 } = {}) {
  const reqDir = path.join(dir, '.requirements', 'features', REQ_ID);
  await fs.mkdir(reqDir, { recursive: true });
  await fs.writeFile(
    path.join(reqDir, 'meta.yaml'),
    `id: ${REQ_ID}\ntype: feature\nstatus: ${status}\ncreated: 2026-09-09\n`,
    'utf-8'
  );
  if (rulesYaml !== null) {
    const sysDir = path.join(dir, '.requirements', '_system');
    await fs.mkdir(sysDir, { recursive: true });
    await fs.writeFile(path.join(sysDir, 'rules.yaml'), rulesYaml, 'utf-8');
  }
  if (logLines > 0) {
    await fs.writeFile(
      path.join(reqDir, 'execution.log'),
      Array.from({ length: logLines }, (_, i) => `[2026-09-09T00:00:0${i}] Tool: Edit`).join('\n'),
      'utf-8'
    );
  }
  return reqDir;
}

describe('hooks 消费规则数据（FEAT-20260909-001-4ae874）', function () {
  this.timeout(30000);
  let tmp;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'crs-hook-rules-'));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('TC-POS-03: PostToolUse planning 阶段改外部文件 → 注入与 v1.4 逐字等价', async () => {
    await makeProject(tmp, { status: 'planning' });
    const target = path.join(tmp, 'src', 'app.js');
    const { out } = await runHook('post-tool-use.mjs', {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: target },
      cwd: tmp,
    });
    const context = parseContext(out);
    expect(context).to.equal(
      `[crs] Phase violation: active requirement ${REQ_ID} is "planning". ` +
        `Editing ${target} is not allowed yet. ` +
        'Finish the 5 document stages (spec -> analyzed -> implementing -> test-cases -> plan) before touching code.'
    );
  });

  it('TC-BND-06: .requirements-evil 前缀混淆不误判（视为外部，守卫命中）', async () => {
    await makeProject(tmp, { status: 'planning' });
    const evil = path.join(tmp, '.requirements-evil', 'x.js');
    const { out } = await runHook('post-tool-use.mjs', {
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: evil },
      cwd: tmp,
    });
    expect(parseContext(out)).to.include('Phase violation');
  });

  it('编辑 .requirements 内文件与 implementing 状态均零注入（v1.4 行为）', async () => {
    await makeProject(tmp, { status: 'planning' });
    const inside = path.join(tmp, '.requirements', 'features', REQ_ID, 'spec.md');
    const { out } = await runHook('post-tool-use.mjs', {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: inside },
      cwd: tmp,
    });
    expect(parseContext(out)).to.equal('');

    await makeProject(tmp, { status: 'implementing' });
    const { out: out2 } = await runHook('post-tool-use.mjs', {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: path.join(tmp, 'src', 'x.js') },
      cwd: tmp,
    });
    expect(parseContext(out2)).to.equal('');
  });

  it('TC-POS-05 + TC-BND-08: Bash guard 按子串命中，大小写与空白归一', async () => {
    await makeProject(tmp, {
      status: 'implementing',
      rulesYaml: [
        'rules:',
        '  - id: no-force-push',
        '    type: guard',
        '    when:',
        '      tools: [Bash]',
        '      command_contains: "git push --force"',
        '    message: 禁止强推，先确认',
      ].join('\n'),
    });

    const run = (command) =>
      runHook('post-tool-use.mjs', {
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command },
        cwd: tmp,
      }).then(({ out }) => parseContext(out));

    expect(await run('cd /repo && GIT PUSH --force origin main')).to.include('禁止强推');
    expect(await run('git  push   --force origin main')).to.include('禁止强推');
    expect(await run('git push origin main')).to.equal('');
  });

  it('TC-POS-04: SessionStart 注入活跃需求消息 + inject 规则', async () => {
    await makeProject(tmp, {
      status: 'implementing',
      rulesYaml: ['rules:', '  - id: zh-commit', '    type: inject', '    message: 提交信息使用中文'].join('\n'),
    });
    const { out } = await runHook('session-start.mjs', {
      hook_event_name: 'SessionStart',
      cwd: tmp,
    });
    const context = parseContext(out);
    expect(context).to.include(`Active requirement: ${REQ_ID} (status: implementing)`);
    expect(context).to.include('提交信息使用中文');
  });

  it('TC-NEG-07: 无 rules.yaml 时 SessionStart 行为 = v1.4', async () => {
    await makeProject(tmp, { status: 'analyzed' });
    const { out } = await runHook('session-start.mjs', { hook_event_name: 'SessionStart', cwd: tmp });
    const context = parseContext(out);
    expect(context).to.include(
      `[crs] Active requirement: ${REQ_ID} (status: analyzed). ` +
        'Current phase forbids editing files outside .requirements/ until all 5 document stages are filled. ' +
        'Use /crs:req --active or /crs:req --dashboard to inspect it.'
    );
  });

  it('TC-NEG-05: inject 超预算按 priority 截断（整条保留/丢弃）', async () => {
    const ruleLine = (id, priority, tag) =>
      [`  - id: ${id}`, '    type: inject', `    priority: ${priority}`, `    message: ${tag}${'x'.repeat(120 - tag.length)}`].join('\n');
    await makeProject(tmp, {
      status: 'implementing',
      rulesYaml: [`inject_budget_chars: 500`, 'rules:', ruleLine('low', 10, 'LOW'), ruleLine('high', 30, 'HIGH'), ruleLine('mid', 20, 'MID')].join('\n'),
    });
    const { out } = await runHook('session-start.mjs', { hook_event_name: 'SessionStart', cwd: tmp });
    const context = parseContext(out);
    expect(context).to.include('HIGH'); // priority 高者先入预算
    expect(context).to.include('MID');
    expect(context).to.not.include('LOW'); // 预算耗尽被整条丢弃
  });

  it('TC-BND-03: 主消息 + inject 恰好等于预算保留，超 1 字符丢弃', async () => {
    await makeProject(tmp, { status: 'implementing' });
    const base = parseContext(
      (await runHook('session-start.mjs', { hook_event_name: 'SessionStart', cwd: tmp })).out
    );
    const budget = base.length + 1 + 110; // 110 字符规则恰好填满

    const write = (len) =>
      makeProject(tmp, {
        status: 'implementing',
        rulesYaml: [`inject_budget_chars: ${budget}`, 'rules:', '  - id: probe', '    type: inject', `    message: ${'y'.repeat(len)}`].join('\n'),
      });

    await write(110);
    expect(parseContext((await runHook('session-start.mjs', { hook_event_name: 'SessionStart', cwd: tmp })).out).length).to.equal(budget);

    await write(111); // +1 超预算 → 整条丢弃
    expect(parseContext((await runHook('session-start.mjs', { hook_event_name: 'SessionStart', cwd: tmp })).out)).to.equal(base);
  });

  it('TC-BND-04: inject 同 priority 按声明顺序稳定输出', async () => {
    await makeProject(tmp, {
      status: 'implementing',
      rulesYaml: [
        'rules:',
        '  - id: a1',
        '    type: inject',
        '    priority: 5',
        '    message: AAA',
        '  - id: b2',
        '    type: inject',
        '    priority: 5',
        '    message: BBB',
      ].join('\n'),
    });
    const { out } = await runHook('session-start.mjs', { hook_event_name: 'SessionStart', cwd: tmp });
    expect(parseContext(out)).to.include('AAA BBB');
  });

  it('guard 多条命中按 priority 降序拼接，总量受 600 字符上限', async () => {
    const guardLine = (id, priority, tag) =>
      [
        `  - id: ${id}`,
        '    type: guard',
        `    priority: ${priority}`,
        '    when: { tools: [Edit], statuses: [planning], outside: .requirements }',
        `    message: ${tag}${'m'.repeat(132 - tag.length)}`, // phase-guard(204) + 两条 132 → 468；第三条 603>600 被截断
      ].join('\n');
    await makeProject(tmp, {
      status: 'planning',
      rulesYaml: ['rules:', guardLine('g-low', 10, 'LOWW'), guardLine('g-high', 30, 'HIGH'), guardLine('g-mid', 20, 'MIDD')].join('\n'),
    });
    const { out } = await runHook('post-tool-use.mjs', {
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: path.join(tmp, 'src', 'x.js') },
      cwd: tmp,
    });
    const context = parseContext(out);
    expect(context).to.include('HIGH');
    expect(context).to.include('MIDD');
    expect(context).to.not.include('LOWW'); // 第三条放不进 600 字符预算被截断
    expect(context.indexOf('HIGH')).to.be.lessThan(context.indexOf('MIDD'));
  });

  it('Stop 汇总来自模板（含操作数与需求 ID）', async () => {
    await makeProject(tmp, { status: 'implementing', logLines: 3 });
    const { out } = await runHook('stop.mjs', { hook_event_name: 'Stop', cwd: tmp });
    const context = parseContext(out);
    expect(context).to.include(`active requirement ${REQ_ID}: 3 logged operations`);
  });

  it('TC-POS-09: hook 源码零内嵌面向用户文案', async () => {
    const forbidden = ['Phase violation', 'document stages', 'Docs-map:', 'drifted/unconfirmed', 'Active requirement:', 'Session summary', 'logged operations'];
    for (const name of ['post-tool-use.mjs', 'session-start.mjs', 'stop.mjs']) {
      const source = await fs.readFile(path.join(HOOKS_DIR, name), 'utf-8');
      for (const phrase of forbidden) {
        expect(source, `${name} 不应内嵌文案: ${phrase}`).to.not.include(phrase);
      }
    }
  });
});
