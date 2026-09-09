#!/usr/bin/env node
/**
 * CRS 注入面体积统计（FEAT-20260909-001-4ae874 任务 5）
 *
 * 度量插件注入 LLM 上下文的全部文本面：
 * - commands 下 5 个命令 .md 与 skills 下各 SKILL.md 的字节数（调用时整篇进入上下文）
 * - hook 注入文案（规则引擎 templates + guard 规则 message）的字符数与预算
 *
 * 用法：
 *   node bin/crs-context-stats.js                       # 人类可读报告
 *   node bin/crs-context-stats.js --json                # 机器可读 JSON（重定向保存基线）
 *   node bin/crs-context-stats.js --compare-json < b.json  # 与 stdin 传入的基线对比
 *
 * 基线的保存/读取交给 shell 重定向，本脚本不处理任何用户路径参数。
 * 除 stdout 外零写盘。插件根目录取脚本自身位置，与 cwd 无关。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_RULES } from '../scripts/requirement-manager/core/rules.js';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// token 收敛目标（spec 验收 1）：v1.4.0 基线 105,796B 的 75%；单命令 ≤5KB
const V14_BASELINE_SUM = 105796;
const SUM_TARGET = Math.floor(V14_BASELINE_SUM * 0.75);
const COMMAND_LIMIT = 5120;

function listFiles(relDir, filter) {
  const abs = path.join(PLUGIN_ROOT, relDir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isFile() && filter(e.name))
    .map((e) => e.name)
    .sort();
}

const byteSize = (p) => fs.statSync(p).size;

function collect() {
  const commands = {};
  for (const name of listFiles('commands', (n) => n.endsWith('.md'))) {
    commands[name] = byteSize(path.join(PLUGIN_ROOT, 'commands', name));
  }

  const skills = {};
  const skillsDir = path.join(PLUGIN_ROOT, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
      if (fs.existsSync(skillFile)) skills[`${entry.name}/SKILL.md`] = byteSize(skillFile);
    }
  }

  const templates = {};
  for (const [key, text] of Object.entries(DEFAULT_RULES.templates)) {
    templates[key] = text.length;
  }
  const guardRules = {};
  for (const rule of DEFAULT_RULES.rules) {
    guardRules[rule.id] = rule.message.length;
  }

  const commandsBytes = Object.values(commands).reduce((a, b) => a + b, 0);
  const skillsBytes = Object.values(skills).reduce((a, b) => a + b, 0);

  return {
    generatedAt: new Date().toISOString(),
    pluginRoot: PLUGIN_ROOT,
    commands,
    skills,
    totals: {
      commandsBytes,
      skillsBytes,
      sum: commandsBytes + skillsBytes,
      sumTarget: SUM_TARGET,
      withinSumTarget: commandsBytes + skillsBytes <= SUM_TARGET,
      maxCommandBytes: Math.max(0, ...Object.values(commands)),
      commandLimit: COMMAND_LIMIT,
      withinCommandLimit: Object.values(commands).every((n) => n <= COMMAND_LIMIT),
    },
    hooks: {
      templates,
      guardRules,
      injectBudget: DEFAULT_RULES.inject_budget_chars,
      worstCaseMainMessage:
        DEFAULT_RULES.templates.session_active.length +
        1 +
        Math.max(
          DEFAULT_RULES.templates.session_phase_locked.length,
          DEFAULT_RULES.templates.session_phase_status.length
        ),
    },
  };
}

function formatReport(data) {
  const lines = [];
  lines.push('📊 CRS 注入面体积统计\n');
  lines.push('commands/（调用时整篇进入上下文）:');
  for (const [name, size] of Object.entries(data.commands)) {
    lines.push(`  ${name.padEnd(20)} ${String(size).padStart(6)} B`);
  }
  lines.push('skills/（SKILL.md，按需加载）:');
  for (const [name, size] of Object.entries(data.skills)) {
    lines.push(`  ${name.padEnd(20)} ${String(size).padStart(6)} B`);
  }
  const t = data.totals;
  lines.push(
    `\n合计: commands ${t.commandsBytes} B + skills ${t.skillsBytes} B = ${t.sum} B` +
      `（目标 ≤${t.sumTarget} B：${t.withinSumTarget ? '✅ 达标' : '❌ 超标'}）`
  );
  lines.push(
    `单命令上限 ${t.commandLimit} B：${t.withinCommandLimit ? '✅ 达标' : `❌ 超标（最大 ${t.maxCommandBytes} B）`}`
  );
  lines.push('\nhook 注入文案（内置默认，字符数）:');
  for (const [key, len] of Object.entries(data.hooks.templates)) {
    lines.push(`  template ${key.padEnd(22)} ${String(len).padStart(4)} chars`);
  }
  for (const [key, len] of Object.entries(data.hooks.guardRules)) {
    lines.push(`  guard    ${key.padEnd(22)} ${String(len).padStart(4)} chars`);
  }
  lines.push(
    `  inject 预算 ${data.hooks.injectBudget} chars｜主消息最坏 ≈${data.hooks.worstCaseMainMessage} chars`
  );
  return lines.join('\n');
}

function compare(current, baseline) {
  const lines = ['── 与基线对比 ──'];
  const rows = [
    ['totals.sum', current.totals.sum, baseline.totals?.sum],
    ['totals.commandsBytes', current.totals.commandsBytes, baseline.totals?.commandsBytes],
    ['totals.skillsBytes', current.totals.skillsBytes, baseline.totals?.skillsBytes],
    ['totals.maxCommandBytes', current.totals.maxCommandBytes, baseline.totals?.maxCommandBytes],
  ];
  for (const [key, now, before] of rows) {
    if (typeof before !== 'number') {
      lines.push(`  ${key}: 基线缺失`);
      continue;
    }
    const delta = now - before;
    const mark = delta === 0 ? '＝' : delta < 0 ? '✅' : '⚠️ ';
    lines.push(`  ${mark} ${key}: ${now}（${delta >= 0 ? '+' : ''}${delta}）`);
  }
  return lines.join('\n');
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const data = collect();

  if (args.includes('--json')) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log(formatReport(data));

  if (args.includes('--compare-json')) {
    const raw = await readStdin();
    try {
      const baseline = JSON.parse(raw);
      console.log(compare(data, baseline));
    } catch (_err) {
      console.error('[crs] 基线不可用: stdin 不是合法的统计 JSON');
      process.exitCode = 1;
    }
  }
}

export { collect, formatReport, compare, V14_BASELINE_SUM, SUM_TARGET, COMMAND_LIMIT, PLUGIN_ROOT };

// 直接执行时运行 main（被 import 时不执行）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
