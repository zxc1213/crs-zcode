#!/usr/bin/env node

/**
 * 需求度量数据收集脚本
 * 自动从需求文件中收集度量数据
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { TYPE_DIRS, normalizeStatus } from '../requirement-manager/core/schema.js';

const BASE_DIR = process.cwd();
const REQUIREMENTS_DIR = path.join(BASE_DIR, '.requirements');
const METRICS_DIR = path.join(REQUIREMENTS_DIR, 'metrics');
const DATA_FILE = path.join(METRICS_DIR, 'data.yaml');

/**
 * 加载现有度量数据
 */
function loadMetricsData() {
  if (fs.existsSync(DATA_FILE)) {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    try {
      const parsed = yaml.load(content);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (error) {
      console.error(`⚠️ metrics data.yaml 解析失败，已回退空数据: ${error.message}`);
    }
  }
  return {
    metrics: {
      cycle_time: [],
      rework_rate: [],
      change_frequency: [],
      completion_rate: [],
    },
  };
}

/**
 * 保存度量数据
 */
function saveMetricsData(data) {
  // 确保目录存在
  if (!fs.existsSync(METRICS_DIR)) {
    fs.mkdirSync(METRICS_DIR, { recursive: true });
  }

  const yamlContent = yaml.dump(data);
  fs.writeFileSync(DATA_FILE, yamlContent, 'utf8');
}

/**
 * 扫描所有需求目录（目录名与状态口径统一走 core/schema.js）
 */
function scanRequirements() {
  const requirements = [];

  for (const type of Object.values(TYPE_DIRS)) {
    const typeDir = path.join(REQUIREMENTS_DIR, type);
    if (!fs.existsSync(typeDir)) continue;

    const reqDirs = fs
      .readdirSync(typeDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const reqId of reqDirs) {
      const reqPath = path.join(typeDir, reqId);
      const metaFile = path.join(reqPath, 'meta.yaml');

      if (fs.existsSync(metaFile)) {
        try {
          const metaContent = fs.readFileSync(metaFile, 'utf8');
          const meta = yaml.load(metaContent);
          meta.status = normalizeStatus(meta.status) || 'planning';

          requirements.push({
            id: reqId,
            type: type,
            path: reqPath,
            meta: meta,
          });
        } catch (error) {
          console.warn(`无法解析 ${metaFile}: ${error.message}`);
        }
      }
    }
  }

  return requirements;
}

/**
 * 收集效率指标
 */
function collectEfficiencyMetrics(requirements) {
  const now = new Date().toISOString().split('T')[0];
  const metrics = [];

  // 需求交付周期：created → completed（缺 completed 时回退 updatedAt）
  const completedReqs = requirements.filter((r) => r.meta.status === 'done');

  if (completedReqs.length > 0) {
    const cycleTimes = completedReqs
      .map((r) => {
        const created = new Date(r.meta.created || r.meta.createdAt || 0);
        const end = new Date(r.meta.completed || r.meta.updatedAt || 0);
        return (end - created) / (1000 * 60 * 60 * 24); // 天数
      })
      .filter((t) => Number.isFinite(t) && t >= 0 && t < 365); // 过滤异常值

    if (cycleTimes.length > 0) {
      const avgCycleTime = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;
      metrics.push({
        date: now,
        metric: 'cycle_time',
        value: Number(avgCycleTime.toFixed(2)),
        sample_size: cycleTimes.length,
        details: `平均 ${cycleTimes.length} 个已完成需求`,
      });
    }
  }

  return metrics;
}

/**
 * 收集质量指标
 */
function collectQualityMetrics(requirements) {
  const now = new Date().toISOString().split('T')[0];
  const metrics = [];

  // 返工率：执行中发生过变更（需求目录存在含变更条目的 CHANGELOG.md）的需求占比
  const allReqs = requirements;
  if (allReqs.length > 0) {
    const reworkedCount = allReqs.filter((r) => {
      const changelogFile = path.join(r.path, 'CHANGELOG.md');
      if (!fs.existsSync(changelogFile)) return false;
      const content = fs.readFileSync(changelogFile, 'utf8');
      return /^##\s/m.test(content);
    }).length;

    const reworkRate = reworkedCount / allReqs.length;
    metrics.push({
      date: now,
      metric: 'rework_rate',
      value: Number(reworkRate.toFixed(3)),
      total: allReqs.length,
      reworked: reworkedCount,
      details: `${reworkedCount}/${allReqs.length} 需求有变更记录`,
    });
  }

  // 质量门禁通过率：引擎不落门禁执行记录，无法真实统计，宁缺毋假（v1.2 移除模拟值）

  return metrics;
}

/**
 * 收集变更指标
 */
function collectChangeMetrics(requirements) {
  const now = new Date().toISOString().split('T')[0];
  const metrics = [];

  // 变更频率：统计有变更记录的需求（不限于活跃需求，历史变更同样计入）
  const reqsWithChanges = requirements.filter((r) => {
    const changelogFile = path.join(r.path, 'CHANGELOG.md');
    return fs.existsSync(changelogFile);
  });

  if (reqsWithChanges.length > 0) {
    let totalChanges = 0;
    let majorChanges = 0;

    for (const req of reqsWithChanges) {
      const changelogFile = path.join(req.path, 'CHANGELOG.md');
      const content = fs.readFileSync(changelogFile, 'utf8');
      // 每个变更条目是一个 `## ` 小节（v1.2 统一变更口径后的格式）
      const entries = (content.match(/^##\s/gm) || []).length;
      totalChanges += entries;

      // 大变更条目：标题带 [大] / [large] 标记，或描述含"架构/重构"关键词
      const majorEntries = (content.match(/^##\s.*(\[大\]|\[large\]|架构|重构)/gim) || []).length;
      majorChanges += majorEntries;
    }

    if (totalChanges > 0) {
      const changeFreq = totalChanges / reqsWithChanges.length;
      const majorChangeRate = majorChanges / totalChanges;

      metrics.push({
        date: now,
        metric: 'change_frequency',
        value: Number(changeFreq.toFixed(2)),
        total_changes: totalChanges,
        requirements_with_changes: reqsWithChanges.length,
        details: `平均每个有变更的需求 ${changeFreq.toFixed(1)} 次变更`,
      });

      metrics.push({
        date: now,
        metric: 'major_change_rate',
        value: Number((majorChangeRate * 100).toFixed(1)) + '%',
        major_changes: majorChanges,
        total_changes: totalChanges,
        details: `${majorChanges}/${totalChanges} 为重大变更`,
      });
    }
  }

  return metrics;
}

/**
 * 收集价值指标
 */
function collectValueMetrics(requirements) {
  const now = new Date().toISOString().split('T')[0];
  const metrics = [];

  // 需求完成率
  const allReqs = requirements;
  const completedReqs = requirements.filter((r) => r.meta.status === 'done');

  if (allReqs.length > 0) {
    const completionRate = completedReqs.length / allReqs.length;
    metrics.push({
      date: now,
      metric: 'completion_rate',
      value: Number((completionRate * 100).toFixed(1)) + '%',
      completed: completedReqs.length,
      total: allReqs.length,
      details: `${completedReqs.length}/${allReqs.length} 需求已完成`,
    });
  }

  // 优先级覆盖度：完成阶段三（优先级评估）的需求占比
  const evaluated = requirements.filter((r) => r.meta.priority_detail && r.meta.priority_detail.level);
  if (allReqs.length > 0) {
    metrics.push({
      date: now,
      metric: 'priority_coverage',
      value: Number(((evaluated.length / allReqs.length) * 100).toFixed(1)) + '%',
      evaluated: evaluated.length,
      total: allReqs.length,
      details: `${evaluated.length}/${allReqs.length} 需求已评估优先级`,
    });
  }

  return metrics;
}

/**
 * 主函数：收集所有度量数据
 */
function collectAllMetrics() {
  console.log('📊 开始收集度量数据...\n');

  // 加载现有度量数据（配置仅在有告警/目标值逻辑时才需要，当前收集流程不读）
  const data = loadMetricsData();

  // 扫描需求
  console.log('🔍 扫描需求文件...');
  const requirements = scanRequirements();
  console.log(`   找到 ${requirements.length} 个需求\n`);

  // 收集各维度指标
  console.log('📈 收集指标数据...');

  const efficiencyMetrics = collectEfficiencyMetrics(requirements);
  const qualityMetrics = collectQualityMetrics(requirements);
  const changeMetrics = collectChangeMetrics(requirements);
  const valueMetrics = collectValueMetrics(requirements);

  const allMetrics = [...efficiencyMetrics, ...qualityMetrics, ...changeMetrics, ...valueMetrics];

  // 更新数据文件
  for (const metric of allMetrics) {
    const metricType = metric.metric; // 保持原格式

    if (!data.metrics[metricType]) {
      data.metrics[metricType] = [];
    }

    // 检查是否已存在今天的记录
    const today = metric.date;
    const existingIndex = data.metrics[metricType].findIndex((m) => m.date === today);

    if (existingIndex >= 0) {
      // 更新现有记录
      data.metrics[metricType][existingIndex] = metric;
    } else {
      // 添加新记录
      data.metrics[metricType].push(metric);
    }
  }

  // 保存数据
  console.log('💾 保存度量数据...');
  saveMetricsData(data);

  // 显示摘要
  console.log('\n✅ 度量数据收集完成！');
  console.log(`   收集了 ${allMetrics.length} 个指标数据点`);
  console.log(`   数据文件: ${DATA_FILE}`);

  // 显示当前指标
  console.log('\n📊 当前指标摘要:');
  displayMetricsSummary(allMetrics);
}

/**
 * 显示度量摘要
 */
function displayMetricsSummary(metrics) {
  const summary = {};

  for (const metric of metrics) {
    if (!summary[metric.metric]) {
      summary[metric.metric] = metric.value;
    }
  }

  const displayNames = {
    cycle_time: '需求交付周期',
    rework_rate: '返工率',
    change_frequency: '变更频率',
    major_change_rate: '重大变更占比',
    completion_rate: '需求完成率',
    priority_coverage: '优先级覆盖度',
  };

  for (const [key, value] of Object.entries(summary)) {
    const name = displayNames[key] || key;
    console.log(`   ${name}: ${value}`);
  }
}

/**
 * 初始化度量系统
 */
function initMetricsSystem() {
  console.log('🚀 初始化度量系统...\n');

  // 创建目录
  const dirs = [METRICS_DIR, path.join(METRICS_DIR, 'reports'), path.join(METRICS_DIR, 'exports'), path.join(METRICS_DIR, 'trends')];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`   ✓ 创建目录: ${path.relative(BASE_DIR, dir)}`);
    }
  }

  // 创建数据文件
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      metrics: {
        cycle_time: [],
        rework_rate: [],
        change_frequency: [],
        completion_rate: [],
      },
      last_updated: new Date().toISOString(),
    };

    const yamlContent = yaml.dump(initialData);
    fs.writeFileSync(DATA_FILE, yamlContent);
    console.log(`   ✓ 创建数据文件: ${path.relative(BASE_DIR, DATA_FILE)}`);
  }

  console.log('\n✅ 度量系统初始化完成！');
  console.log('   下一步: 运行 "node scripts/metrics/collect.js collect" 收集数据');
}

/**
 * 导出数据
 */
function exportData(format = 'json') {
  console.log(`📤 导出度量数据 (${format})...\n`);

  const data = loadMetricsData();
  const timestamp = new Date().toISOString().split('T')[0];

  let content, filename;

  switch (format) {
    case 'json':
      content = JSON.stringify(data, null, 2);
      filename = `metrics-${timestamp}.json`;
      break;

    case 'csv':
      content = convertToCSV(data);
      filename = `metrics-${timestamp}.csv`;
      break;

    case 'markdown':
      content = convertToMarkdown(data);
      filename = `metrics-${timestamp}.md`;
      break;

    default:
      console.error(`❌ 不支持的导出格式: ${format}`);
      return;
  }

  const exportDir = path.join(METRICS_DIR, 'exports');
  // 导出文件名收敛为 basename，确保始终写入 exports 目录内
  const filePath = path.join(exportDir, path.basename(String(filename)));

  fs.writeFileSync(filePath, content);

  console.log(`✅ 导出完成: ${filePath}`);
}

/**
 * 转换为 CSV 格式
 */
function convertToCSV(data) {
  // 含逗号/引号/换行的字段按 RFC 4180 包裹转义
  const escapeCsv = (val) => {
    const s = String(val ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = ['date,metric,value,sample_size,details'];

  for (const [, records] of Object.entries(data.metrics)) {
    for (const record of records) {
      lines.push(
        [record.date, record.metric, record.value, record.sample_size || record.total || 'N/A', record.details || '']
          .map(escapeCsv)
          .join(',')
      );
    }
  }

  return lines.join('\n');
}

/**
 * 转换为 Markdown 格式
 */
function convertToMarkdown(data) {
  let markdown = '# 度量数据导出\n\n';
  markdown += `导出时间: ${new Date().toISOString()}\n\n`;

  for (const [metricType, records] of Object.entries(data.metrics)) {
    markdown += `## ${metricType}\n\n`;
    markdown += '| 日期 | 值 | 样本数 | 详情 |\n';
    markdown += '|------|-----|--------|------|\n';

    for (const record of records) {
      markdown += `| ${record.date} | ${record.value} | `;
      markdown += `${record.sample_size || record.total || 'N/A'} | `;
      markdown += `${record.details || ''} |\n`;
    }

    markdown += '\n';
  }

  return markdown;
}

// CLI 接口
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'collect':
    collectAllMetrics();
    break;

  case 'init':
    initMetricsSystem();
    break;

  case 'export':
    exportData(args[1] || 'json');
    break;

  default:
    console.log('需求度量数据收集脚本');
    console.log('');
    console.log('用法:');
    console.log('  node collect.js init      # 初始化度量系统');
    console.log('  node collect.js collect   # 收集度量数据');
    console.log('  node collect.js export    # 导出数据');
    console.log('');
    console.log('示例:');
    console.log('  node scripts/metrics/collect.js init');
    console.log('  node scripts/metrics/collect.js collect');
    console.log('  node scripts/metrics/collect.js export json');
}
