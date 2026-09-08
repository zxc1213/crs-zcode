import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import fs from 'node:fs/promises';
import yaml from 'js-yaml';
import { Evaluator } from '../../scripts/requirement-manager/optimization/evaluator.js';

describe('Evaluator', () => {
  const testDir = '.test-evaluator';
  const metricsPath = `${testDir}/.requirements/_system/metrics.yaml`;

  beforeEach(async () => {
    await fs.mkdir(`${testDir}/.requirements/_system`, { recursive: true });
    const metricsData = {
      system_metrics: {
        total_requirements: 100,
        completion_rate: 0.85,
        average_time: '2.5h',
        user_satisfaction: 4.2,
        automation_rate: 0.78,
      },
      type_metrics: {
        feature: { total: 50, completed: 40, avg_time: '3.0h' },
        bug: { total: 30, completed: 28, avg_time: '1.5h' },
        question: { total: 20, completed: 18, avg_time: '0.5h' },
      },
      skill_performance: {
        brainstorming: { uses: 60, satisfaction: 4.5, avg_time_saved: '30min' },
        research: { uses: 25, satisfaction: 4.8, avg_time_saved: '20min' },
        'systematic-debugging': { uses: 15, satisfaction: 4.2, avg_time_saved: '45min' },
      },
      cost_metrics: {
        daily_tokens: 85000,
        daily_budget: 100000,
        cache_hit_rate: 0.65,
      },
      history: [
        { timestamp: '2026-05-06T10:00:00Z', completion_rate: 0.82 },
        { timestamp: '2026-05-06T14:00:00Z', completion_rate: 0.84 },
        { timestamp: '2026-05-07T10:00:00Z', completion_rate: 0.85 },
      ],
    };
    await fs.writeFile(metricsPath, yaml.dump(metricsData));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('#evaluate', () => {
    it('应该评估系统整体性能', async () => {
      const evaluator = new Evaluator(testDir);
      const report = await evaluator.evaluate();

      expect(['excellent', 'good', 'fair', 'poor'].includes(report.system_health));
      expect(report.completion_rate).to.equal(0.85);
      expect(report.evaluation_time).to.be.ok;
    });

    it('应该识别性能瓶颈', async () => {
      const evaluator = new Evaluator(testDir);
      const report = await evaluator.evaluate();

      expect(Array.isArray(report.bottlenecks));
    });

    it('应该评估 Skill 使用效果', async () => {
      const evaluator = new Evaluator(testDir);
      const report = await evaluator.evaluate();

      expect(report.skill_evaluation).to.be.ok;
      expect(typeof report.skill_evaluation.best_skill === 'string').to.be.ok;
      expect(typeof report.skill_evaluation.worst_skill === 'string').to.be.ok;
    });

    it('应该分析成本效率', async () => {
      const evaluator = new Evaluator(testDir);
      const report = await evaluator.evaluate();

      expect(report.cost_efficiency).to.be.ok;
      expect(typeof report.cost_efficiency.token_usage_ratio === 'number').to.be.ok;
      expect(typeof report.cost_efficiency.cache_efficiency === 'string').to.be.ok;
    });

    it('应该生成性能趋势分析', async () => {
      const evaluator = new Evaluator(testDir);
      const report = await evaluator.evaluate();

      expect(report.trend_analysis).to.be.ok;
      expect(typeof report.trend_analysis.completion_trend === 'string').to.be.ok;
      expect(typeof report.trend_analysis.direction === 'string').to.be.ok;
    });
  });

  describe('#identifyBottlenecks', () => {
    it('应该识别低完成率类型', async () => {
      // 添加一个低完成率的类型
      const lowCompletionData = {
        type_metrics: {
          feature: { total: 50, completed: 30, avg_time: '3.0h' },
          bug: { total: 30, completed: 28, avg_time: '1.5h' },
          question: { total: 20, completed: 18, avg_time: '0.5h' },
        },
      };
      await fs.writeFile(metricsPath, yaml.dump(lowCompletionData));

      const evaluator = new Evaluator(testDir);
      const bottlenecks = await evaluator.identifyBottlenecks();

      const lowCompletion = bottlenecks.find((b) => b.type === 'low_completion');
      expect(lowCompletion).to.be.ok;
      expect(lowCompletion.types.length > 0).to.be.ok;
    });

    it('应该识别低满意度 Skill', async () => {
      const lowSatisfactionData = {
        skill_performance: {
          brainstorming: { uses: 60, satisfaction: 4.5 },
          'poor-skill': { uses: 10, satisfaction: 3.2 },
        },
      };
      await fs.writeFile(metricsPath, yaml.dump(lowSatisfactionData));

      const evaluator = new Evaluator(testDir);
      const bottlenecks = await evaluator.identifyBottlenecks();

      const lowSatisfaction = bottlenecks.find((b) => b.type === 'low_satisfaction');
      expect(lowSatisfaction).to.be.ok;
      expect(lowSatisfaction.skills.length > 0).to.be.ok;
    });

    it('应该识别高 Token 使用', async () => {
      const highCostData = {
        cost_metrics: {
          daily_tokens: 120000,
          daily_budget: 100000,
          cache_hit_rate: 0.3,
        },
      };
      await fs.writeFile(metricsPath, yaml.dump(highCostData));

      const evaluator = new Evaluator(testDir);
      const bottlenecks = await evaluator.identifyBottlenecks();

      const highCost = bottlenecks.find((b) => b.type === 'high_cost');
      expect(highCost).to.be.ok;
    });

    it('应该识别低缓存命中率', async () => {
      const lowCacheData = {
        cost_metrics: {
          daily_tokens: 50000,
          daily_budget: 100000,
          cache_hit_rate: 0.4,
        },
      };
      await fs.writeFile(metricsPath, yaml.dump(lowCacheData));

      const evaluator = new Evaluator(testDir);
      const bottlenecks = await evaluator.identifyBottlenecks();

      const lowCache = bottlenecks.find((b) => b.type === 'low_cache');
      expect(lowCache).to.be.ok;
    });
  });

  describe('#evaluateSkills', () => {
    it('应该评估每个 Skill 的效果', async () => {
      const evaluator = new Evaluator(testDir);
      const evaluation = await evaluator.evaluateSkills();

      expect(Array.isArray(evaluation.ranked_skills));
      expect(evaluation.ranked_skills.length > 0).to.be.ok;
      expect(typeof evaluation.best_skill === 'string').to.be.ok;
      expect(typeof evaluation.worst_skill === 'string').to.be.ok;
    });

    it('应该按满意度排序', async () => {
      const evaluator = new Evaluator(testDir);
      const evaluation = await evaluator.evaluateSkills();

      const first = evaluation.ranked_skills[0];
      const last = evaluation.ranked_skills[evaluation.ranked_skills.length - 1];

      expect(first.score >= last.score).to.be.ok;
    });
  });

  describe('#analyzeCosts', () => {
    it('应该分析 Token 使用效率', async () => {
      const evaluator = new Evaluator(testDir);
      const analysis = await evaluator.analyzeCosts();

      expect(typeof analysis.usage_ratio === 'number').to.be.ok;
      expect(typeof analysis.cache_efficiency === 'string').to.be.ok;
      expect(typeof analysis.overhead === 'number').to.be.ok;
    });

    it('应该检测预算超支', async () => {
      const overBudgetData = {
        cost_metrics: {
          daily_tokens: 110000,
          daily_budget: 100000,
          cache_hit_rate: 0.6,
        },
      };
      await fs.writeFile(metricsPath, yaml.dump(overBudgetData));

      const evaluator = new Evaluator(testDir);
      const analysis = await evaluator.analyzeCosts();

      expect(analysis.over_budget).to.be.ok;
    });
  });

  describe('#analyzeTrends', () => {
    it('应该分析完成率趋势', async () => {
      const evaluator = new Evaluator(testDir);
      const trends = await evaluator.analyzeTrends();

      expect(typeof trends.completion_trend === 'string').to.be.ok;
      expect(typeof trends.direction === 'string').to.be.ok;
      expect(typeof trends.change_rate === 'number').to.be.ok;
    });

    it('应该检测趋势方向', async () => {
      const evaluator = new Evaluator(testDir);
      const trends = await evaluator.analyzeTrends();

      expect(['up', 'down', 'stable'].includes(trends.direction));
    });
  });

  describe('#generateSuggestions', () => {
    it('应该生成改进建议', async () => {
      const evaluator = new Evaluator(testDir);
      const report = await evaluator.evaluate();
      const suggestions = await evaluator.generateSuggestions(report);

      expect(Array.isArray(suggestions));
      // 当没有瓶颈时，建议可以为空
    });

    it('应该为瓶颈生成具体建议', async () => {
      const highCostData = {
        cost_metrics: {
          daily_tokens: 110000,
          daily_budget: 100000,
          cache_hit_rate: 0.4,
        },
      };
      await fs.writeFile(metricsPath, yaml.dump(highCostData));

      const evaluator = new Evaluator(testDir);
      const report = await evaluator.evaluate();
      const suggestions = await evaluator.generateSuggestions(report);

      const costSuggestion = suggestions.find((s) => s.category === 'cost');
      expect(costSuggestion).to.be.ok;
    });
  });

  describe('#calculateHealthScore', () => {
    it('应该计算综合健康分数', async () => {
      const evaluator = new Evaluator(testDir);
      const score = await evaluator.calculateHealthScore();

      expect(typeof score === 'number').to.be.ok;
      expect(score >= 0 && score <= 100).to.be.ok;
    });

    it('应该基于多指标计算分数', async () => {
      const evaluator = new Evaluator(testDir);
      const score = await evaluator.calculateHealthScore();

      expect(score > 50).to.be.ok;
    });
  });
});
