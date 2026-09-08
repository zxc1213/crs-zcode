import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import chalk from 'chalk';

/**
 * 自我评价器
 * 评估系统性能并生成改进建议
 */
export class Evaluator {
  constructor(baseDir = '.') {
    this.baseDir = baseDir;
    this.metricsPath = path.join(baseDir, '.requirements/_system/metrics.yaml');
  }

  /**
   * 执行全面系统评价
   */
  async evaluate() {
    const metrics = await this._loadMetrics();
    const healthScore = await this._calculateHealthScoreInternal(metrics);

    return {
      evaluation_time: new Date().toISOString(),
      system_health: this._scoreToHealthLevel(healthScore),
      completion_rate: metrics.system_metrics?.completion_rate || 0,
      bottlenecks: await this.identifyBottlenecks(metrics),
      skill_evaluation: await this.evaluateSkills(metrics),
      cost_efficiency: await this.analyzeCosts(metrics),
      trend_analysis: await this.analyzeTrends(metrics),
      suggestions: [],
    };
  }

  /**
   * 将数值分数转换为健康等级
   */
  _scoreToHealthLevel(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  /**
   * 内部计算健康分数
   */
  async _calculateHealthScoreInternal(metrics = null) {
    if (!metrics) metrics = await this._loadMetrics();

    let score = 0;
    // let factors = 0; // unused

    // 完成率 (0-30 分)
    if (metrics.system_metrics?.completion_rate !== undefined) {
      score += metrics.system_metrics.completion_rate * 30;
      // factors++; // unused
    }

    // 用户满意度 (0-20 分)
    if (metrics.system_metrics?.user_satisfaction !== undefined) {
      score += (metrics.system_metrics.user_satisfaction / 5) * 20;
      // factors++; // unused
    }

    // 自动化率 (0-15 分)
    if (metrics.system_metrics?.automation_rate !== undefined) {
      score += metrics.system_metrics.automation_rate * 15;
      // factors++; // unused
    }

    // Skill 满意度 (0-20 分)
    if (metrics.skill_performance) {
      const avgSatisfaction = Object.values(metrics.skill_performance).reduce((sum, s) => sum + s.satisfaction, 0) / Object.keys(metrics.skill_performance).length;
      score += (avgSatisfaction / 5) * 20;
      // factors++; // unused
    }

    // 缓存效率 (0-15 分)
    if (metrics.cost_metrics?.cache_hit_rate !== undefined) {
      score += metrics.cost_metrics.cache_hit_rate * 15;
      // factors++; // unused
    }

    return score;
  }

  /**
   * 识别性能瓶颈
   */
  async identifyBottlenecks(metrics = null) {
    if (!metrics) metrics = await this._loadMetrics();

    const bottlenecks = [];

    // 检查低完成率类型
    if (metrics.type_metrics) {
      const lowCompletion = [];
      for (const [type, data] of Object.entries(metrics.type_metrics)) {
        const rate = data.completed / data.total;
        if (rate < 0.8) {
          lowCompletion.push({
            type,
            rate,
            count: `${data.completed}/${data.total}`,
          });
        }
      }
      if (lowCompletion.length > 0) {
        bottlenecks.push({
          type: 'low_completion',
          severity: 'medium',
          types: lowCompletion,
        });
      }
    }

    // 检查低满意度 Skill
    if (metrics.skill_performance) {
      const lowSatisfaction = [];
      for (const [skill, data] of Object.entries(metrics.skill_performance)) {
        if (data.satisfaction < 4.0) {
          lowSatisfaction.push({
            skill,
            satisfaction: data.satisfaction,
            uses: data.uses,
          });
        }
      }
      if (lowSatisfaction.length > 0) {
        bottlenecks.push({
          type: 'low_satisfaction',
          severity: 'high',
          skills: lowSatisfaction,
        });
      }
    }

    // 检查高成本
    if (metrics.cost_metrics) {
      const { daily_tokens, daily_budget } = metrics.cost_metrics;
      const ratio = daily_tokens / daily_budget;

      if (ratio > 1.0) {
        bottlenecks.push({
          type: 'high_cost',
          severity: 'critical',
          usage_ratio: ratio,
          over_budget: daily_tokens - daily_budget,
        });
      } else if (ratio > 0.9) {
        bottlenecks.push({
          type: 'high_cost',
          severity: 'warning',
          usage_ratio: ratio,
        });
      }
    }

    // 检查低缓存命中率
    if (metrics.cost_metrics?.cache_hit_rate < 0.5) {
      bottlenecks.push({
        type: 'low_cache',
        severity: 'medium',
        cache_hit_rate: metrics.cost_metrics.cache_hit_rate,
      });
    }

    return bottlenecks;
  }

  /**
   * 评估 Skill 使用效果
   */
  async evaluateSkills(metrics = null) {
    if (!metrics) metrics = await this._loadMetrics();

    if (!metrics.skill_performance) {
      return { ranked_skills: [], best_skill: null, worst_skill: null };
    }

    const skills = Object.entries(metrics.skill_performance).map(([name, data]) => ({
      name,
      uses: data.uses,
      satisfaction: data.satisfaction,
      time_saved: data.avg_time_saved,
      score: this._calculateSkillScore(data),
    }));

    skills.sort((a, b) => b.score - a.score);

    return {
      ranked_skills: skills,
      best_skill: skills[0]?.name || null,
      worst_skill: skills[skills.length - 1]?.name || null,
    };
  }

  /**
   * 分析成本效率
   */
  async analyzeCosts(metrics = null) {
    if (!metrics) metrics = await this._loadMetrics();

    if (!metrics.cost_metrics) {
      return { usage_ratio: 0, cache_efficiency: 'unknown', overhead: 0, token_usage_ratio: 0 };
    }

    const { daily_tokens, daily_budget, cache_hit_rate } = metrics.cost_metrics;
    const usage_ratio = daily_tokens / daily_budget;
    const overhead = 1 - cache_hit_rate;

    let cache_efficiency = 'good';
    if (cache_hit_rate < 0.5) cache_efficiency = 'poor';
    else if (cache_hit_rate < 0.7) cache_efficiency = 'fair';

    return {
      usage_ratio,
      token_usage_ratio: usage_ratio,
      cache_efficiency,
      overhead,
      over_budget: usage_ratio > 1.0,
    };
  }

  /**
   * 分析性能趋势
   */
  async analyzeTrends(metrics = null) {
    if (!metrics) metrics = await this._loadMetrics();

    if (!metrics.history || metrics.history.length < 2) {
      return { completion_trend: 'unknown', direction: 'stable', change_rate: 0 };
    }

    const history = metrics.history;
    const recent = history.slice(-5);
    const avgCompletion = recent.reduce((sum, h) => sum + (h.completion_rate || 0), 0) / recent.length;
    const current = history[history.length - 1].completion_rate || 0;
    const previous = history[history.length - 2].completion_rate || 0;
    const change_rate = ((current - previous) / previous) * 100;

    let direction = 'stable';
    if (change_rate > 5) direction = 'up';
    else if (change_rate < -5) direction = 'down';

    const completion_trend = avgCompletion > 0.8 ? 'excellent' : avgCompletion > 0.7 ? 'good' : avgCompletion > 0.6 ? 'fair' : 'poor';

    return {
      completion_trend,
      direction,
      change_rate,
      avg_completion: avgCompletion,
    };
  }

  /**
   * 生成改进建议
   */
  async generateSuggestions(evaluationReport = null) {
    if (!evaluationReport) {
      evaluationReport = await this.evaluate();
    }

    const suggestions = [];

    // 基于瓶颈生成建议
    for (const bottleneck of evaluationReport.bottlenecks) {
      switch (bottleneck.type) {
        case 'low_completion':
          suggestions.push({
            category: 'completion',
            priority: 'medium',
            title: '提高低完成率类型的完成率',
            description: `类型 ${bottleneck.types.map((t) => t.type).join(', ')} 完成率较低`,
            actions: ['分析该类型需求的阻塞原因', '考虑增加自动化支持', '提供更多指导模板'],
          });
          break;

        case 'low_satisfaction':
          suggestions.push({
            category: 'skill',
            priority: 'high',
            title: '改进低满意度 Skill',
            description: `Skill ${bottleneck.skills.map((s) => s.skill).join(', ')} 满意度低于 4.0`,
            actions: ['收集用户反馈', '优化 Skill 提示词', '调整 Skill 执行流程'],
          });
          break;

        case 'high_cost':
          suggestions.push({
            category: 'cost',
            priority: bottleneck.severity === 'critical' ? 'critical' : 'high',
            title: '控制 Token 使用',
            description: bottleneck.over_budget ? `超出预算 ${bottleneck.over_budget} tokens` : 'Token 使用接近预算上限',
            actions: ['增加缓存命中率', '优化提示词长度', '启用智能跳过机制'],
          });
          break;

        case 'low_cache':
          suggestions.push({
            category: 'cost',
            priority: 'medium',
            title: '提高缓存命中率',
            description: `当前缓存命中率仅为 ${(bottleneck.cache_hit_rate * 100).toFixed(1)}%`,
            actions: ['增加可缓存内容', '调整缓存策略', '启用预测性缓存'],
          });
          break;
      }
    }

    // 基于趋势生成建议
    if (evaluationReport.trend_analysis.direction === 'down') {
      suggestions.push({
        category: 'trend',
        priority: 'high',
        title: '阻止完成率下降',
        description: `完成率下降了 ${Math.abs(evaluationReport.trend_analysis.change_rate).toFixed(1)}%`,
        actions: ['识别最近变更的问题', '回退可能有问题的修改', '加强质量检查'],
      });
    }

    return suggestions;
  }

  /**
   * 计算系统健康分数 (0-100)
   */
  async calculateHealthScore(metrics = null) {
    if (!metrics) metrics = await this._loadMetrics();

    let score = 0;
    // let factors = 0; // unused

    // 完成率 (0-30 分)
    if (metrics.system_metrics?.completion_rate !== undefined) {
      score += metrics.system_metrics.completion_rate * 30;
      // factors++; // unused
    }

    // 用户满意度 (0-20 分)
    if (metrics.system_metrics?.user_satisfaction !== undefined) {
      score += (metrics.system_metrics.user_satisfaction / 5) * 20;
      // factors++; // unused
    }

    // 自动化率 (0-15 分)
    if (metrics.system_metrics?.automation_rate !== undefined) {
      score += metrics.system_metrics.automation_rate * 15;
      // factors++; // unused
    }

    // Skill 满意度 (0-20 分)
    if (metrics.skill_performance) {
      const avgSatisfaction = Object.values(metrics.skill_performance).reduce((sum, s) => sum + s.satisfaction, 0) / Object.keys(metrics.skill_performance).length;
      score += (avgSatisfaction / 5) * 20;
      // factors++; // unused
    }

    // 缓存效率 (0-15 分)
    if (metrics.cost_metrics?.cache_hit_rate !== undefined) {
      score += metrics.cost_metrics.cache_hit_rate * 15;
      // factors++;
    }

    return Math.round(score);
  }

  /**
   * 计算 Skill 综合分数
   */
  _calculateSkillScore(data) {
    let score = 0;

    // 使用次数权重 (最高 30 分)
    score += Math.min(data.uses / 100, 1) * 30;

    // 满意度权重 (最高 50 分)
    score += (data.satisfaction / 5) * 50;

    // 时间节省权重 (最高 20 分)
    if (data.avg_time_saved) {
      const minutes = parseInt(data.avg_time_saved) || 0;
      score += Math.min(minutes / 60, 1) * 20;
    }

    return score;
  }

  /**
   * 加载指标数据
   */
  async _loadMetrics() {
    try {
      const content = await fs.readFile(this.metricsPath, 'utf8');
      return yaml.load(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  /**
   * 打印评价报告
   */
  async printReport(report) {
    console.log(chalk.bold('\n📊 系统评价报告\n'));

    // 系统健康
    const healthColors = {
      excellent: chalk.green,
      good: chalk.blue,
      fair: chalk.yellow,
      poor: chalk.red,
    };
    const healthColor = healthColors[report.system_health] || chalk.gray;
    console.log(healthColor.bold(`系统健康: ${report.system_health.toUpperCase()}`));
    console.log(`完成率: ${(report.completion_rate * 100).toFixed(1)}%`);
    console.log(`评价时间: ${new Date(report.evaluation_time).toLocaleString('zh-CN')}\n`);

    // 瓶颈
    if (report.bottlenecks.length > 0) {
      console.log(chalk.yellow.bold('⚠️  发现的瓶颈:'));
      for (const bottleneck of report.bottlenecks) {
        const severityColors = {
          critical: chalk.red.bold,
          high: chalk.red,
          medium: chalk.yellow,
          warning: chalk.blue,
        };
        const color = severityColors[bottleneck.severity] || chalk.gray;
        console.log(color(`  [${bottleneck.severity.toUpperCase()}] ${bottleneck.type}`));
      }
      console.log();
    }

    // Skill 评价
    if (report.skill_evaluation.best_skill) {
      console.log(chalk.green.bold('✅ 最佳 Skill:'), report.skill_evaluation.best_skill);
      console.log(chalk.red.bold('❌ 需改进:'), report.skill_evaluation.worst_skill);
      console.log();
    }

    // 成本效率
    if (report.cost_efficiency) {
      const usagePercent = (report.cost_efficiency.usage_ratio * 100).toFixed(1);
      const usageColor = report.cost_efficiency.over_budget ? chalk.red : chalk.green;
      console.log(usageColor(`💰 Token 使用: ${usagePercent}%`));
      console.log(`缓存效率: ${report.cost_efficiency.cache_efficiency}\n`);
    }

    // 趋势
    if (report.trend_analysis.direction !== 'stable') {
      const trendColor = report.trend_analysis.direction === 'up' ? chalk.green : chalk.red;
      const arrow = report.trend_analysis.direction === 'up' ? '↑' : '↓';
      console.log(trendColor(`📈 趋势: ${arrow} ${report.trend_analysis.completion_trend}`));
    }
  }
}
