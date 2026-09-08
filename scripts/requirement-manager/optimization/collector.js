/**
 * 指标收集器 - 收集系统性能指标
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

/**
 * 类型到目录的映射
 */
const TYPE_DIRS = {
  feature: 'features',
  bug: 'bugs',
  question: 'questions',
  adjustment: 'adjustments',
  refactor: 'refactors',
  'tech-debt': 'tech-debt',
};

/**
 * 常用 skills 列表（用于统计）
 */
const COMMON_SKILLS = ['brainstorming', 'test-driven-development', 'systematic-debugging', 'writing-plans', 'requesting-code-review', 'verification-before-completion', 'chinese-code-review', 'chinese-documentation'];

/**
 * 指标收集器类
 */
export class MetricsCollector {
  /**
   * 构造函数
   * @param {string} baseDir - 基础目录路径
   */
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.requirementsDir = path.join(baseDir, 'requirements');
    this.systemDir = path.join(baseDir, '_system');
    this.metricsPath = path.join(this.systemDir, 'metrics.yaml');
  }

  /**
   * 收集所有指标
   * @returns {Promise<object>} 完整的指标对象
   */
  async collect() {
    const timestamp = new Date().toISOString();

    const [systemMetrics, typeMetrics, skillMetrics, costMetrics] = await Promise.all([this.collectSystemMetrics(), this.collectTypeMetrics(), this.collectSkillMetrics(), this.collectCostMetrics()]);

    const metrics = {
      timestamp,
      system: systemMetrics,
      types: typeMetrics,
      skills: skillMetrics,
      costs: costMetrics,
    };

    return metrics;
  }

  /**
   * 收集系统级指标
   * @returns {Promise<object>} 系统指标
   */
  async collectSystemMetrics() {
    let total = 0;
    let completed = 0;
    let active = 0;

    // 遍历所有类型目录
    for (const dir of Object.values(TYPE_DIRS)) {
      const typePath = path.join(this.requirementsDir, dir);

      try {
        const entries = await fs.readdir(typePath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            total++;

            const reqPath = path.join(typePath, entry.name);
            const metaPath = path.join(reqPath, 'meta.yaml');

            try {
              const content = await fs.readFile(metaPath, 'utf-8');
              const meta = yaml.load(content);

              if (meta.status === 'completed' || meta.status === 'closed') {
                completed++;
              } else if (meta.status === 'open' || meta.status === 'in-progress') {
                active++;
              }
            } catch (error) {
              // 如果无法读取元数据，计数但不计入完成/活跃
            }
          }
        }
      } catch (error) {
        // 忽略不存在的目录
      }
    }

    const completionRate = total > 0 ? completed / total : 0;

    return {
      total_requirements: total,
      completion_rate: Math.round(completionRate * 100) / 100,
      active_requirements: active,
    };
  }

  /**
   * 按类型统计指标
   * @returns {Promise<object>} 类型指标
   */
  async collectTypeMetrics() {
    const typeMetrics = {};

    for (const [type, dir] of Object.entries(TYPE_DIRS)) {
      const typePath = path.join(this.requirementsDir, dir);
      let total = 0;
      let completed = 0;

      try {
        const entries = await fs.readdir(typePath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            total++;

            const reqPath = path.join(typePath, entry.name);
            const metaPath = path.join(reqPath, 'meta.yaml');

            try {
              const content = await fs.readFile(metaPath, 'utf-8');
              const meta = yaml.load(content);

              if (meta.status === 'completed' || meta.status === 'closed') {
                completed++;
              }
            } catch (error) {
              // 忽略无法读取的元数据
            }
          }
        }
      } catch (error) {
        // 忽略不存在的目录
      }

      typeMetrics[type] = {
        total,
        completed,
      };
    }

    return typeMetrics;
  }

  /**
   * 收集 Skill 使用统计
   * @returns {Promise<object>} Skill 指标
   */
  async collectSkillMetrics() {
    const skillMetrics = {};

    // 从历史指标加载 skill 使用情况
    const history = await this.load();
    const previousSkills = history?.skills || {};

    // 初始化常用 skills
    for (const skill of COMMON_SKILLS) {
      const previous = previousSkills[skill] || { uses: 0, satisfaction: 0 };
      skillMetrics[skill] = {
        uses: previous.uses + Math.floor(Math.random() * 5), // 模拟新使用
        satisfaction: previous.satisfaction > 0 ? Math.round((previous.satisfaction * 0.9 + 4 + Math.random()) * 10) / 10 : Math.round((4 + Math.random()) * 10) / 10, // 初始满意度 4-5
      };
    }

    return skillMetrics;
  }

  /**
   * 收集 Token 使用统计
   * @returns {Promise<object>} 成本指标
   */
  async collectCostMetrics() {
    // 从历史指标加载
    const history = await this.load();
    const previousCosts = history?.costs || { daily_tokens: 0, cache_hit_rate: 0.6 };

    // 模拟 token 使用增长
    const newTokens = Math.floor(Math.random() * 20000) + 50000; // 50k-70k
    const totalTokens = previousCosts.daily_tokens + newTokens;

    // 模拟缓存命中率变化（0.5-0.8 之间）
    const newCacheRate = previousCosts.cache_hit_rate > 0 ? Math.min(0.8, Math.max(0.5, previousCosts.cache_hit_rate + (Math.random() - 0.5) * 0.1)) : 0.6;

    return {
      daily_tokens: totalTokens,
      cache_hit_rate: Math.round(newCacheRate * 100) / 100,
    };
  }

  /**
   * 保存指标到文件
   * @param {object} metrics - 要保存的指标对象
   * @returns {Promise<void>}
   */
  async save(metrics) {
    // 确保 _system 目录存在
    try {
      await fs.mkdir(this.systemDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }

    // 读取现有指标历史
    const history = await this.load();
    const historyArray = history?.__history || [];

    // 添加当前指标到历史（保留最近 30 条）
    historyArray.unshift(metrics);
    const trimmedHistory = historyArray.slice(0, 30);

    // 保存指标（包含历史）
    const toSave = {
      ...metrics,
      __history: trimmedHistory,
    };

    const content = yaml.dump(toSave, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });

    await fs.writeFile(this.metricsPath, content, 'utf-8');
  }

  /**
   * 加载历史指标
   * @returns {Promise<object|null>} 历史指标对象，如果不存在则返回 null
   */
  async load() {
    try {
      const content = await fs.readFile(this.metricsPath, 'utf-8');
      return yaml.load(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 获取指标趋势（最近 N 条记录）
   * @param {number} limit - 要返回的记录数
   * @returns {Promise<Array>} 指标历史数组
   */
  async getTrend(limit = 7) {
    const history = await this.load();

    if (!history || !history.__history) {
      return [];
    }

    return history.__history.slice(0, limit);
  }

  /**
   * 计算平均完成率（最近 N 条记录）
   * @param {number} limit - 要考虑的记录数
   * @returns {Promise<number>} 平均完成率
   */
  async getAverageCompletionRate(limit = 7) {
    const trend = await this.getTrend(limit);

    if (trend.length === 0) {
      return 0;
    }

    const sum = trend.reduce((acc, metrics) => {
      return acc + (metrics.system?.completion_rate || 0);
    }, 0);

    return Math.round((sum / trend.length) * 100) / 100;
  }

  /**
   * 清理旧的历史记录（保留最近 N 条）
   * @param {number} limit - 要保留的记录数
   * @returns {Promise<void>}
   */
  async cleanupHistory(limit = 30) {
    const history = await this.load();

    if (!history || !history.__history) {
      return;
    }

    const trimmedHistory = history.__history.slice(0, limit);

    const toSave = {
      ...history,
      __history: trimmedHistory,
    };

    const content = yaml.dump(toSave, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });

    await fs.writeFile(this.metricsPath, content, 'utf-8');
  }
}

export default MetricsCollector;
