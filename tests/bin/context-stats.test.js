/**
 * context-stats.test.js - 注入面体积统计与 token 收敛断言（FEAT-20260909-001-4ae874）
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { collect, SUM_TARGET, COMMAND_LIMIT } from '../../bin/crs-context-stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATS = path.resolve(__dirname, '../../bin/crs-context-stats.js');

function runStats(args, stdin = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [STATS, ...args], { cwd: path.resolve(__dirname, '../..') });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => resolve({ out, err, code }));
    child.on('error', reject);
    child.stdin.write(stdin);
    child.stdin.end();
  });
}

describe('crs-context-stats（FEAT-20260909-001-4ae874）', function () {
  this.timeout(20000);

  it('collect(): 覆盖全部 commands/skills，合计与逐文件一致', () => {
    const data = collect();
    expect(Object.keys(data.commands)).to.have.lengthOf(5);
    expect(Object.keys(data.skills)).to.have.lengthOf(8);
    const sum = [...Object.values(data.commands), ...Object.values(data.skills)].reduce((a, b) => a + b, 0);
    expect(data.totals.sum).to.equal(sum);
    expect(data.hooks.templates.session_active).to.be.a('number').above(0);
    expect(data.hooks.guardRules['phase-guard']).to.be.a('number').above(0);
    expect(data.hooks.injectBudget).to.equal(600);
  });

  it('CLI --json 输出与 collect() 同构', async () => {
    const { out, code } = await runStats(['--json']);
    expect(code).to.equal(0);
    const parsed = JSON.parse(out);
    expect(parsed.totals.sum).to.equal(collect().totals.sum);
  });

  it('CLI --compare-json 对比基线增减', async () => {
    const baseline = collect();
    baseline.totals.sum -= 1000;
    const { out, code } = await runStats(['--compare-json'], JSON.stringify(baseline));
    expect(code).to.equal(0);
    expect(out).to.include('与基线对比');
    expect(out).to.include('+1000');
  });

  it('CLI --compare-json 非法输入报错退出', async () => {
    const { code } = await runStats(['--compare-json'], 'not-json');
    expect(code).to.equal(1);
  });

  it('TC-POS-08: token 收敛目标——总量 ≤ v1.4 基线的 75%，单命令 ≤ 5KB', () => {
    const { totals } = collect();
    expect(totals.sum).to.be.at.most(SUM_TARGET);
    expect(totals.withinCommandLimit).to.equal(true);
    expect(totals.maxCommandBytes).to.be.at.most(COMMAND_LIMIT);
  });
});
