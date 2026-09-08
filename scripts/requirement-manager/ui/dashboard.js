/**
 * 仪表板模块 - 显示需求管理系统概览
 */

import Table from 'cli-table3';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

/**
 * 需求类型目录映射
 */
const TYPE_DIRS = {
  feature: 'features',
  bug: 'bugs',
  question: 'questions',
  adjustment: 'adjustments',
  refactor: 'refactors',
};

/**
 * 状态到中文的映射
 */
const STATUS_LABELS = {
  open: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  closed: '已关闭',
  blocked: '已阻塞',
};

/**
 * 状态颜色映射
 */
const STATUS_COLORS = {
  open: 'yellow',
  in_progress: 'blue',
  completed: 'green',
  closed: 'gray',
  blocked: 'red',
};

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

    const stats = await this.getStatistics();
    this.showStatistics(stats);

    const active = await this.getActiveRequirement();
    this.showActive(active);

    await this.showRecent();
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
   * @returns {Promise<object>} 统计数据对象
   */
  async getStatistics() {
    const stats = {
      total: 0,
      open: 0,
      in_progress: 0,
      completed: 0,
      byType: {
        feature: 0,
        bug: 0,
        question: 0,
        adjustment: 0,
        refactor: 0,
      },
    };

    // 遍历所有类型目录
    for (const [type, dir] of Object.entries(TYPE_DIRS)) {
      const typePath = path.join(this.requirementsDir, dir);

      try {
        const entries = await fs.readdir(typePath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const reqPath = path.join(typePath, entry.name);
            const meta = await this.readRequirementMeta(reqPath);

            if (meta) {
              stats.total++;
              stats.byType[type]++;

              // 统计状态
              if (meta.status === 'open') {
                stats.open++;
              } else if (meta.status === 'in_progress') {
                stats.in_progress++;
              } else if (meta.status === 'completed') {
                stats.completed++;
              }
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

    table.push(['总需求数', stats.total.toString()], ['待处理', stats.open.toString()], ['进行中', stats.in_progress.toString()], ['已完成', stats.completed.toString()]);

    console.log(table.toString());
    console.log('');
  }

  /**
   * 获取活跃需求
   * @returns {Promise<object|null>} 活跃需求对象
   */
  async getActiveRequirement() {
    // 遍历所有类型目录，查找状态为 in_progress 的需求
    for (const [type, dir] of Object.entries(TYPE_DIRS)) {
      const typePath = path.join(this.requirementsDir, dir);

      try {
        const entries = await fs.readdir(typePath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const reqPath = path.join(typePath, entry.name);
            const meta = await this.readRequirementMeta(reqPath);

            if (meta && meta.status === 'in_progress') {
              return meta;
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

    return null;
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
   */
  async showRecent() {
    console.log(chalk.cyan('📝 最近需求'));

    const recent = await this.getRecentRequirements(10);

    if (recent.length === 0) {
      console.log(chalk.gray('  暂无需求记录'));
      console.log('');
      return;
    }

    const table = new Table({
      head: [chalk.white('ID'), chalk.white('标题'), chalk.white('状态')],
      colWidths: [20, 30, 10],
      style: {
        head: [],
        border: ['gray'],
      },
    });

    for (const req of recent) {
      const title = req.title || req.description?.substring(0, 25) || '无标题';
      const statusLabel = STATUS_LABELS[req.status] || req.status;

      table.push([req.id, title.substring(0, 30), statusLabel]);
    }

    console.log(table.toString());
    console.log('');
  }

  /**
   * 获取最近需求
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>} 最近需求数组
   */
  async getRecentRequirements(limit = 10) {
    const allReqs = [];

    // 遍历所有类型目录
    for (const [type, dir] of Object.entries(TYPE_DIRS)) {
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

    // 按创建时间排序
    allReqs.sort((a, b) => {
      const dateA = new Date(a.created || a.createdAt || 0);
      const dateB = new Date(b.created || b.createdAt || 0);
      return dateB - dateA;
    });

    // 返回最新的 N 个
    return allReqs.slice(0, limit);
  }

  /**
   * 读取需求元数据
   * @param {string} reqPath - 需求路径
   * @returns {Promise<object|null>} 元数据对象
   */
  async readRequirementMeta(reqPath) {
    const metaPath = path.join(reqPath, 'meta.yaml');

    try {
      const content = await fs.readFile(metaPath, 'utf-8');
      return yaml.load(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}

export default Dashboard;
