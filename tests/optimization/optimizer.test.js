import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import fs from 'node:fs/promises';
import yaml from 'js-yaml';
import { Optimizer } from '../../scripts/requirement-manager/optimization/optimizer.js';

describe('Optimizer', () => {
  const testDir = '.test-optimizer';

  beforeEach(async () => {
    await fs.mkdir(`${testDir}/.requirements/_system`, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('#generateDecision', () => {
    it('应该基于评价报告生成优化决策', async () => {
      const optimizer = new Optimizer(testDir);
      const evaluationReport = {
        bottlenecks: [
          { type: 'low_completion', severity: 'medium', types: [{ type: 'bug', rate: 0.6 }] },
        ],
        cost_efficiency: { cache_efficiency: 'poor', cache_hit_rate: 0.4 },
        skill_evaluation: { worst_skill: 'research' },
      };

      const decision = await optimizer.generateDecision(evaluationReport);

      expect(decision.id).to.be.ok;
      expect(decision.timestamp).to.be.ok;
      expect(decision.actions).to.be.ok;
      expect(decision.actions.length > 0).to.be.ok;
    });

    it('应该为瓶颈类型生成针对性决策', async () => {
      const optimizer = new Optimizer(testDir);
      const evaluationReport = {
        bottlenecks: [{ type: 'high_cost', severity: 'critical', over_budget: 10000 }],
      };

      const decision = await optimizer.generateDecision(evaluationReport);

      const costAction = decision.actions.find((a) => a.category === 'cost');
      expect(costAction).to.be.ok;
      expect(costAction.priority).to.equal('critical');
    });

    it('应该为无瓶颈系统生成维护建议', async () => {
      const optimizer = new Optimizer(testDir);
      const evaluationReport = {
        bottlenecks: [],
        system_health: 'excellent',
      };

      const decision = await optimizer.generateDecision(evaluationReport);

      expect(decision.actions).to.be.ok;
      expect(decision.actions.every((a) => a.category === 'maintenance')).to.be.ok;
    });
  });

  describe('#prioritizeActions', () => {
    it('应该按优先级排序决策动作', async () => {
      const optimizer = new Optimizer(testDir);
      const actions = [
        { category: 'test', priority: 'low' },
        { category: 'cost', priority: 'critical' },
        { category: 'completion', priority: 'medium' },
      ];

      const prioritized = await optimizer.prioritizeActions(actions);

      expect(prioritized[0].priority).to.equal('critical');
      expect(prioritized[prioritized.length - 1].priority).to.equal('low');
    });

    it('应该为相同优先级按类别排序', async () => {
      const optimizer = new Optimizer(testDir);
      const actions = [
        { category: 'test', priority: 'high', order: 3 },
        { category: 'cost', priority: 'high', order: 1 },
        { category: 'completion', priority: 'high', order: 2 },
      ];

      const prioritized = await optimizer.prioritizeActions(actions);

      expect(prioritized[0].category).to.equal('cost');
      expect(prioritized[1].category).to.equal('completion');
      expect(prioritized[2].category).to.equal('test');
    });
  });

  describe('#applyDecision', () => {
    it('应该应用优化决策', async () => {
      const optimizer = new Optimizer(testDir);
      const decision = {
        id: 'OPT-001',
        actions: [
          {
            id: 'act-1',
            type: 'config_change',
            category: 'cost',
            config: { cache_ttl: 3600 },
          },
        ],
      };

      const result = await optimizer.applyDecision(decision);

      expect(result.success).to.be.ok;
      expect(result.applied_actions.length).to.equal(1);
    });

    it('应该记录应用历史', async () => {
      const optimizer = new Optimizer(testDir);
      const decision = {
        id: 'OPT-001',
        actions: [
          {
            id: 'act-1',
            type: 'config_change',
            category: 'cost',
            config: { cache_ttl: 3600 },
          },
        ],
      };

      await optimizer.applyDecision(decision);

      const history = await optimizer.getHistory();
      expect(history.length > 0).to.be.ok;
      expect(history[0].decision_id).to.equal('OPT-001');
    });
  });

  describe('#rollback', () => {
    it('应该回滚优化决策', async () => {
      const optimizer = new Optimizer(testDir);
      const decision = {
        id: 'OPT-001',
        actions: [
          {
            id: 'act-1',
            type: 'config_change',
            category: 'cost',
            config: { cache_ttl: 3600 },
          },
        ],
      };

      await optimizer.applyDecision(decision);
      const rollbackResult = await optimizer.rollback('OPT-001');

      expect(rollbackResult.success).to.be.ok;
      expect(rollbackResult.rolled_back_actions.length).to.equal(1);
    });

    it('应该记录回滚历史', async () => {
      const optimizer = new Optimizer(testDir);
      const decision = {
        id: 'OPT-001',
        actions: [
          {
            id: 'act-1',
            type: 'config_change',
            category: 'cost',
            config: { cache_ttl: 3600 },
          },
        ],
      };

      await optimizer.applyDecision(decision);
      await optimizer.rollback('OPT-001');

      const history = await optimizer.getHistory();
      const rollbackEntry = history.find((h) => h.type === 'rollback');
      expect(rollbackEntry).to.be.ok;
    });
  });

  describe('#validateDecision', () => {
    it('应该验证决策安全性', async () => {
      const optimizer = new Optimizer(testDir);
      const safeDecision = {
        id: 'OPT-001',
        actions: [{ id: 'act-1', type: 'config_change', category: 'cost' }],
      };

      const validation = await optimizer.validateDecision(safeDecision);

      expect(validation.valid).to.be.ok;
    });

    it('应该拒绝危险决策', async () => {
      const optimizer = new Optimizer(testDir);
      const dangerousDecision = {
        id: 'OPT-001',
        actions: [{ id: 'act-1', type: 'delete_data', category: 'dangerous' }],
      };

      const validation = await optimizer.validateDecision(dangerousDecision);

      expect(!validation.valid).to.be.ok;
      expect(validation.errors.length > 0).to.be.ok;
    });

    it('应该检查决策频率限制', async () => {
      const optimizer = new Optimizer(testDir);

      // 快速应用多个决策
      for (let i = 0; i < 5; i++) {
        const decision = {
          id: `OPT-${i}`,
          actions: [{ id: `act-${i}`, type: 'config_change', category: 'cost' }],
        };
        await optimizer.applyDecision(decision);
      }

      const frequentDecision = {
        id: 'OPT-FREQ',
        actions: [{ id: 'act-freq', type: 'config_change', category: 'cost' }],
      };

      const validation = await optimizer.validateDecision(frequentDecision);

      expect(!validation.valid).to.be.ok;
      expect(validation.errors.some((e) => e.includes('frequency'))).to.be.ok;
    });
  });

  describe('#getHistory', () => {
    it('应该返回优化历史', async () => {
      const optimizer = new Optimizer(testDir);
      const decision = {
        id: 'OPT-001',
        actions: [{ id: 'act-1', type: 'config_change', category: 'cost' }],
      };

      await optimizer.applyDecision(decision);

      const history = await optimizer.getHistory();

      expect(Array.isArray(history)).to.be.ok;
      expect(history.length > 0).to.be.ok;
    });

    it('应该按时间倒序返回历史', async () => {
      const optimizer = new Optimizer(testDir);

      for (let i = 0; i < 3; i++) {
        const decision = {
          id: `OPT-${i}`,
          actions: [{ id: `act-${i}`, type: 'config_change', category: 'cost' }],
        };
        await optimizer.applyDecision(decision);
      }

      const history = await optimizer.getHistory();

      expect(history[0].decision_id).to.equal('OPT-2');
      expect(history[2].decision_id).to.equal('OPT-0');
    });
  });

  describe('#generateDecisionId', () => {
    it('应该生成唯一决策 ID', async () => {
      const optimizer = new Optimizer(testDir);

      // 生成第一个 ID 并应用决策
      const id1 = await optimizer.generateDecisionId();
      const decision1 = {
        id: id1,
        actions: [{ id: 'act-1', type: 'config_change', category: 'cost' }],
      };
      await optimizer.applyDecision(decision1);

      // 生成第二个 ID
      const id2 = await optimizer.generateDecisionId();

      expect(id1).to.be.ok;
      expect(id2).to.be.ok;
      expect(id1).not.to.equal(id2);
    });

    it('应该生成符合格式的 ID', async () => {
      const optimizer = new Optimizer(testDir);
      const id = await optimizer.generateDecisionId();

      expect(/^OPT-\d{8}-\d{3}$/.test(id)).to.be.ok;
    });
  });
});
