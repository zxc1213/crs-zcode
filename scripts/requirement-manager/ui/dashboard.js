/**
 * 仪表板模块 - 显示需求管理系统概览
 *
 * 状态与字段口径统一来自 core/schema.js（planning/analyzed/implementing/review/done，
 * created/updatedAt/completed），读取侧自动兼容旧口径（open/in_progress 等）。
 */

import Table from 'cli-table3';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import {
  TYPE_DIRS,
  STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  EVENT_LABELS,
  normalizeMeta,
  isActiveStatus,
  requirementDate,
} from '../core/schema.js';

/**
 * Dashboard 类
 */
export class Dashboard {
  /**
   * 构造函数
   * @param {string} baseDir - 基础目录路径
   */
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.requirementsDir = path.join(baseDir, '.requirements');
  }

  /**
   * 显示完整仪表板
   */
  async show() {
    this.showHeader();

    // 一次全量扫描，统计/活跃/最近三处复用（避免 3 遍全量 meta 读取）
    const all = await this.getAllRequirements();

    const stats = await this.getStatistics(all);
    this.showStatistics(stats);

    const active = await this.getActiveRequirement(all);
    this.showActive(active);

    await this.showRecent(all);

    await this.showDocsMap();
  }

  /**
   * 显示标题
   */
  showHeader() {
    console.log('');
    console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.white.bold('          需求管理系统仪表板                    ') + chalk.cyan('║'));
    console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
  }

  /**
   * 收集统计数据
   * @param {Array} [all] - 预取的全量需求列表（缺省时自行扫描）
   * @returns {Promise<object>} 统计数据对象 { total, active, byStatus, byType }
   */
  async getStatistics(all) {
    const stats = {
      total: 0,
      active: 0,
      byStatus: Object.fromEntries(STATUSES.map((s) => [s, 0])),
      byType: {
        feature: 0,
        bug: 0,
        question: 0,
        adjustment: 0,
        refactor: 0,
      },
    };

    for (const meta of all || (await this.getAllRequirements())) {
      stats.total++;
      stats.byStatus[meta.status]++;
      if (meta.status !== 'done') {
        stats.active++;
      }
      if (stats.byType[meta.type] !== undefined) {
        stats.byType[meta.type]++;
      }
    }

    return stats;
  }

  /**
   * 显示统计表格
   * @param {object} stats - 统计数据对象
   */
  showStatistics(stats) {
    console.log(chalk.cyan('📊 统计概览'));

    const table = new Table({
      colWidths: [20, 10],
      style: {
        head: [],
        border: ['gray'],
      },
    });

    table.push(['总需求数', stats.total.toString()], ['活跃需求', stats.active.toString()]);
    for (const status of STATUSES) {
      table.push([`  ${STATUS_LABELS[status]}`, stats.byStatus[status].toString()]);
    }

    console.log(table.toString());
    console.log('');
  }

  /**
   * 获取活跃需求（非 done 状态中创建时间最新者，与 hooks 口径一致）
   * @param {Array} [all] - 预取的全量需求列表（缺省时自行扫描）
   * @returns {Promise<object|null>} 活跃需求对象
   */
  async getActiveRequirement(all) {
    const requirements = all || (await this.getAllRequirements());
    const active = requirements.filter((meta) => isActiveStatus(meta.status));
    if (active.length === 0) {
      return null;
    }
    active.sort((a, b) => new Date(requirementDate(b, 'created') || 0) - new Date(requirementDate(a, 'created') || 0));
    return active[0];
  }

  /**
   * 显示活跃需求
   * @param {object|null} active - 活跃需求对象
   */
  showActive(active) {
    console.log(chalk.cyan('🎯 当前活跃需求'));

    if (!active) {
      console.log(chalk.gray('  暂无活跃需求'));
    } else {
      console.log(chalk.white(`  ${active.id}: ${active.title || active.description?.substring(0, 50) || '无标题'}`));
      const statusLabel = STATUS_LABELS[active.status] || active.status;
      const statusColor = STATUS_COLORS[active.status] || 'white';
      console.log(chalk[statusColor](`  状态: ${statusLabel}`));
    }

    console.log('');
  }

  /**
   * 显示最近需求
   * @param {Array} [all] - 预取的全量需求列表（缺省时自行扫描）
   */
  async showRecent(all) {
    console.log(chalk.cyan('📝 最近需求'));

    const recent = await this.getRecentRequirements(10, all);

    if (recent.length === 0) {
      console.log(chalk.gray('  暂无需求记录'));
      console.log('');
      return;
    }

    const table = new Table({
      head: [chalk.white('ID'), chalk.white('标题'), chalk.white('状态')],
      colWidths: [22, 34, 10],
      style: {
        head: [],
        border: ['gray'],
      },
    });

    for (const req of recent) {
      const title = req.title || req.description?.substring(0, 25) || '无标题';
      const statusLabel = STATUS_LABELS[req.status] || req.status;

      table.push([req.id, title.substring(0, 32), statusLabel]);
    }

    console.log(table.toString());
    console.log('');
  }

  /**
   * 获取最近需求
   * @param {number} limit - 限制数量
   * @param {Array} [all] - 预取的全量需求列表（缺省时自行扫描）
   * @returns {Promise<Array>} 最近需求数组
   */
  async getRecentRequirements(limit = 10, all) {
    const allReqs = all || (await this.getAllRequirements());

    // 按创建时间倒序（兼容旧日期字段口径）
    allReqs.sort((a, b) => {
      const dateA = new Date(requirementDate(a, 'created') || 0);
      const dateB = new Date(requirementDate(b, 'created') || 0);
      return dateB - dateA;
    });

    return allReqs.slice(0, limit);
  }

  /**
   * 显示历史时间线（来自 project/timeline.yaml 事件账本）
   * @param {number} limit - 显示最近 N 条（默认 20）
   */
  async showHistory(limit = 20) {
    console.log(chalk.cyan(`📜 历史时间线（最近 ${limit} 条事件）`));

    let events = [];
    try {
      const { readTimeline } = await import('../project-sync/timeline.js');
      const result = await readTimeline(this.baseDir, { limit });
      events = result.events;
    } catch (_error) {
      // 账本不可用
    }

    if (events.length === 0) {
      console.log(chalk.gray('  暂无历史事件（事件随需求创建/变更/同步自动积累）'));
      console.log('');
      return;
    }

    const table = new Table({
      head: [chalk.white('时间'), chalk.white('事件'), chalk.white('需求'), chalk.white('说明')],
      colWidths: [21, 12, 23, 42],
      style: { head: [], border: ['gray'] },
    });

    for (const e of events) {
      const ts = (e.ts || '').replace('T', ' ').slice(0, 19);
      table.push([ts, EVENT_LABELS[e.type] || e.type, e.reqId || '-', (e.summary || e.title || '').slice(0, 38)]);
    }

    console.log(table.toString());
    console.log('');
  }

  /**
   * 显示文档地图漂移告警（宿主项目外部文档纳管状态）
   */
  async showDocsMap() {
    console.log(chalk.cyan('🗺 文档地图'));
    try {
      const { checkDrift } = await import('../project-sync/docs-map.js');
      const drift = await checkDrift(this.baseDir);

      if (drift.total === 0) {
        console.log(chalk.gray('  未登记外部文档（运行 crs-project-sync --scan-docs 自动登记 README/docs）'));
      } else {
        if (drift.stale.length) {
          const paths = drift.stale.slice(0, 3).map((d) => d.path).join(', ');
          console.log(chalk.yellow(`  ⚠️  ${drift.stale.length} 份可能过期: ${paths}${drift.stale.length > 3 ? ' ...' : ''}`));
        }
        if (drift.unconfirmed.length) {
          console.log(chalk.gray(`  ❓ ${drift.unconfirmed.length} 份内容未确认过`));
        }
        if (!drift.stale.length && !drift.unconfirmed.length) {
          console.log(chalk.green(`  ✅ ${drift.total} 份文档无漂移`));
        }
      }
    } catch (_error) {
      console.log(chalk.gray('  文档地图不可用'));
    }
    console.log('');
  }

  /**
   * 扫描所有类型目录，读取并规范化全部需求元数据
   * @returns {Promise<Array<object>>} 规范化后的 meta 数组
   */
  async getAllRequirements() {
    const allReqs = [];

    for (const [, dir] of Object.entries(TYPE_DIRS)) {
      const typePath = path.join(this.requirementsDir, dir);

      try {
        const entries = await fs.readdir(typePath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const reqPath = path.join(typePath, entry.name);
            const meta = await this.readRequirementMeta(reqPath);

            if (meta) {
              allReqs.push(meta);
            }
          }
        }
      } catch (error) {
        // 忽略不存在的目录
        if (error.code !== 'ENOENT') {
          console.error(`Error scanning directory ${typePath}:`, error);
        }
      }
    }

    return allReqs;
  }

  /**
   * 读取需求元数据（读取侧规范化状态口径）
   * @param {string} reqPath - 需求路径
   * @returns {Promise<object|null>} 元数据对象
   */
  async readRequirementMeta(reqPath) {
    const metaPath = path.join(reqPath, 'meta.yaml');

    try {
      const content = await fs.readFile(metaPath, 'utf-8');
      return normalizeMeta(yaml.load(content));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}

export default Dashboard;
