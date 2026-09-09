/**
 * rules.test.js - 规则引擎：加载/合并/校验/缓存（FEAT-20260909-001-4ae874）
 *
 * 语义基准：无 rules.yaml = 纯内置默认（= v1.4 hook 行为的数据化）；
 * 项目规则是增量层（同 id 字段级覆盖内置，新 id 追加）；损坏降级默认。
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  DEFAULT_RULES,
  RULES_REL_PATH,
  loadRules,
  validateRules,
  resetRulesCache,
  applyPlaceholders,
} from '../../scripts/requirement-manager/core/rules.js';

async function makeBaseDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'crs-rules-'));
}

async function writeRules(baseDir, content) {
  const dir = path.join(baseDir, '.requirements', '_system');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'rules.yaml'), content, 'utf-8');
}

describe('rules 引擎（FEAT-20260909-001-4ae874）', () => {
  let baseDir;
  let warnCalls;
  let origWarn;

  beforeEach(async () => {
    baseDir = await makeBaseDir();
    warnCalls = [];
    origWarn = console.warn;
    console.warn = (...args) => {
      warnCalls.push(args.join(' '));
    };
  });

  afterEach(async () => {
    console.warn = origWarn;
    resetRulesCache();
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it('TC-POS-01: 无 rules.yaml 时返回纯内置默认，phase-guard 与 v1.4 行为一致', async () => {
    const rules = await loadRules(baseDir);
    expect(rules.inject_budget_chars).to.equal(600);
    expect(rules.templates.session_active).to.include('Active requirement');
    const guard = rules.rules.find((r) => r.id === 'phase-guard');
    expect(guard).to.exist;
    expect(guard.when.tools).to.deep.equal(['Edit', 'Write']);
    expect(guard.when.statuses).to.deep.equal(['planning', 'analyzed']);
    expect(guard.when.outside).to.equal('.requirements');
    expect(guard.message).to.include('5 document stages');
    expect(warnCalls).to.have.lengthOf(0);
  });

  it('TC-POS-02: 同 id 字段级覆盖 + 新 id 追加', async () => {
    await writeRules(
      baseDir,
      [
        'version: 1',
        'rules:',
        '  - id: phase-guard',
        '    type: guard',
        '    message: 自定义违规提示',
        '  - id: zh-commit',
        '    type: inject',
        '    priority: 10',
        '    message: 提交信息使用中文',
      ].join('\n')
    );
    const rules = await loadRules(baseDir);
    const guard = rules.rules.find((r) => r.id === 'phase-guard');
    expect(guard.message).to.equal('自定义违规提示');
    expect(guard.when.tools).to.deep.equal(['Edit', 'Write']); // 未覆盖字段保留内置
    const inject = rules.rules.find((r) => r.id === 'zh-commit');
    expect(inject).to.exist;
    expect(rules.rules).to.have.lengthOf(2);
  });

  it('TC-NEG-01: YAML 损坏降级默认并告警一次', async () => {
    await writeRules(baseDir, 'rules: [ { id: "x", broken');
    const rules = await loadRules(baseDir);
    expect(rules.rules.map((r) => r.id)).to.deep.equal(['phase-guard']);
    expect(warnCalls.filter((w) => w.includes('rules.yaml'))).to.have.lengthOf(1);
  });

  it('TC-NEG-02: 缺 id / 缺 message 的单条被剔除，其余生效', async () => {
    await writeRules(
      baseDir,
      [
        'rules:',
        '  - type: guard',
        '    when: { tools: [Bash] }',
        '    message: 没有 id',
        '  - id: no-message',
        '    type: guard',
        '    when: { tools: [Bash] }',
        '  - id: ok-rule',
        '    type: inject',
        '    message: 正常规则',
      ].join('\n')
    );
    const rules = await loadRules(baseDir);
    const ids = rules.rules.filter((r) => r.id !== 'phase-guard').map((r) => r.id);
    expect(ids).to.deep.equal(['ok-rule']);
    expect(warnCalls.length).to.be.greaterThan(0);
  });

  it('TC-NEG-03: type 非法 / enabled 非布尔剔除', async () => {
    await writeRules(
      baseDir,
      [
        'rules:',
        '  - id: bad-type',
        '    type: block',
        '    message: x',
        '  - id: bad-enabled',
        '    type: inject',
        '    enabled: yes-please',
        '    message: y',
        '  - id: good',
        '    type: inject',
        '    message: z',
      ].join('\n')
    );
    const rules = await loadRules(baseDir);
    const ids = rules.rules.filter((r) => r.id !== 'phase-guard').map((r) => r.id);
    expect(ids).to.deep.equal(['good']);
  });

  it('TC-BND-01: message 长度上限 inject 120 / guard 200（等于合法，超 1 剔除）', () => {
    const injectOk = validateRules({ rules: [{ id: 'a', type: 'inject', message: 'x'.repeat(120) }] });
    expect(injectOk.cleaned.rules).to.have.lengthOf(1);
    const injectBad = validateRules({ rules: [{ id: 'a', type: 'inject', message: 'x'.repeat(121) }] });
    expect(injectBad.cleaned.rules).to.have.lengthOf(0);
    const guardOk = validateRules({ rules: [{ id: 'g', type: 'guard', when: { tools: ['Bash'] }, message: 'y'.repeat(200) }] });
    expect(guardOk.cleaned.rules).to.have.lengthOf(1);
    const guardBad = validateRules({ rules: [{ id: 'g', type: 'guard', when: { tools: ['Bash'] }, message: 'y'.repeat(201) }] });
    expect(guardBad.cleaned.rules).to.have.lengthOf(0);
  });

  it('TC-BND-02: inject_budget_chars 0 合法 / 负数与非数字回退 600 / 2001 收敛 2000', async () => {
    await writeRules(baseDir, 'inject_budget_chars: 0\nrules: []');
    expect((await loadRules(baseDir)).inject_budget_chars).to.equal(0);

    resetRulesCache();
    await writeRules(baseDir, 'inject_budget_chars: -5\nrules: []');
    expect((await loadRules(baseDir)).inject_budget_chars).to.equal(600);

    resetRulesCache();
    await writeRules(baseDir, 'inject_budget_chars: "many"\nrules: []');
    expect((await loadRules(baseDir)).inject_budget_chars).to.equal(600);

    resetRulesCache();
    await writeRules(baseDir, 'inject_budget_chars: 2001\nrules: []');
    expect((await loadRules(baseDir)).inject_budget_chars).to.equal(2000);
  });

  it('TC-BND-05: 只写 version / rules 为空数组 → 内置规则保留', async () => {
    await writeRules(baseDir, 'version: 1');
    expect((await loadRules(baseDir)).rules.some((r) => r.id === 'phase-guard')).to.equal(true);

    resetRulesCache();
    await writeRules(baseDir, 'rules: []');
    expect((await loadRules(baseDir)).rules.some((r) => r.id === 'phase-guard')).to.equal(true);
  });

  it('TC-BND-07: 同 id 只覆盖 message 时 when 深保留（非整条替换）', async () => {
    await writeRules(
      baseDir,
      ['rules:', '  - id: phase-guard', '    type: guard', '    message: 覆盖文案'].join('\n')
    );
    const guard = (await loadRules(baseDir)).rules.find((r) => r.id === 'phase-guard');
    expect(guard.when.statuses).to.deep.equal(['planning', 'analyzed']);
    expect(guard.enabled).to.equal(true);
    expect(guard.priority).to.equal(100);
  });

  it('TC-BND-09: 同进程缓存（二次调用同引用），resetRulesCache 后重读', async () => {
    const first = await loadRules(baseDir);
    const second = await loadRules(baseDir);
    expect(second).to.equal(first);
    resetRulesCache();
    const third = await loadRules(baseDir);
    expect(third).to.not.equal(first);
  });

  it('TC-BND-04 前置: priority 缺省为 0，同 id 重复时后者覆盖', async () => {
    const r = validateRules({
      rules: [
        { id: 'dup', type: 'inject', message: 'first' },
        { id: 'dup', type: 'inject', message: 'second' },
      ],
    });
    expect(r.cleaned.rules).to.have.lengthOf(1);
    expect(r.cleaned.rules[0].message).to.equal('second');
    expect(r.warnings.length).to.be.greaterThan(0);
  });

  it('guard 缺 when 剔除；非法 tools/statuses 值剔除', () => {
    const r = validateRules({
      rules: [
        { id: 'no-when', type: 'guard', message: 'x' },
        { id: 'bad-tool', type: 'guard', when: { tools: ['Delete'] }, message: 'x' },
        { id: 'bad-status', type: 'guard', when: { statuses: ['finished'] }, message: 'x' },
        { id: 'ok', type: 'guard', when: { tools: ['Bash'], statuses: ['implementing'] }, message: 'x' },
      ],
    });
    expect(r.cleaned.rules.map((x) => x.id)).to.deep.equal(['ok']);
  });

  it('applyPlaceholders 替换 {id}/{status}/{path}/{n}', () => {
    expect(
      applyPlaceholders('active {id} is "{status}" at {path}, {n} ops', {
        id: 'FEAT-1',
        status: 'planning',
        path: '/x.js',
        n: 3,
      })
    ).to.equal('active FEAT-1 is "planning" at /x.js, 3 ops');
    expect(applyPlaceholders('无占位符', {})).to.equal('无占位符');
    expect(applyPlaceholders('缺失变量 {missing} 保留', {})).to.equal('缺失变量 {missing} 保留');
  });

  it('TC-NEG-06: rules.yaml 是目录（不可读）时降级默认并告警一次', async () => {
    await fs.mkdir(path.join(baseDir, '.requirements', '_system', 'rules.yaml'), { recursive: true });
    const rules = await loadRules(baseDir);
    expect(rules.rules.map((r) => r.id)).to.deep.equal(['phase-guard']);
    expect(warnCalls.filter((w) => w.includes('rules.yaml'))).to.have.lengthOf(1);
  });

  it('CRLF 行尾的 rules.yaml 正常解析（Windows 常态）', async () => {
    await writeRules(baseDir, 'rules:\r\n  - id: zh\r\n    type: inject\r\n    message: 提交信息使用中文\r\n');
    const rules = await loadRules(baseDir);
    const zh = rules.rules.find((r) => r.id === 'zh');
    expect(zh).to.exist;
    expect(zh.message).to.equal('提交信息使用中文');
  });

  it('templates 支持项目覆盖单条', async () => {
    await writeRules(baseDir, 'templates:\n  stop_summary: "自定义总结 {n}"');
    const t = (await loadRules(baseDir)).templates;
    expect(t.stop_summary).to.equal('自定义总结 {n}');
    expect(t.session_active).to.include('Active requirement'); // 未覆盖的保留
  });
});
