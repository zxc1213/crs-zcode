/**
 * 技能适配器集成测试
 * 测试 SkillInterface、适配器和调度器的集成功能
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { SkillInterface } from '../../scripts/requirement-manager/core/skill-interface.js';
import { AdapterFactory } from '../../scripts/requirement-manager/skill-adapters/index.js';
import { getScheduler } from '../../scripts/requirement-manager/core/scheduler.js';
import { getFallbackConfig } from '../../scripts/requirement-manager/core/router.js';
import { SkillsHealthChecker } from '../../scripts/requirement-manager/utils/skills-health.js';

describe('技能适配器集成测试', () => {
  let baseDir;
  let skillInterface;
  let adapters;

  beforeEach(async () => {
    baseDir = process.cwd();
    skillInterface = new SkillInterface(baseDir, {
      enableFallback: true,
      fallbackMode: 'template',
      cacheStatus: true,
    });
    adapters = AdapterFactory.createAllAdapters(baseDir);
  });

  afterEach(() => {
    if (skillInterface) {
      skillInterface.clearCache();
    }
  });

  describe('AdapterFactory 集成测试', () => {
    it('应该创建所有适配器', () => {
      const expectedAdapters = [
        'brainstorming',
        'systematic-debugging',
        'research',
        'code-explorer',
        'writing-plans',
      ];

      for (const name of expectedAdapters) {
        assert.ok(adapters.has(name), `应该创建 ${name} 适配器`);
      }
    });

    it('所有适配器应该有正确的类型', () => {
      for (const [name, adapter] of adapters.entries()) {
        assert.equal(typeof adapter.validateParams, 'function');
        assert.equal(typeof adapter.execute, 'function');
        assert.equal(typeof adapter.getTemplates, 'function');
      }
    });
  });

  describe('参数验证集成测试', () => {
    it('BrainstormingAdapter 应该验证问题参数', async () => {
      const adapter = adapters.get('brainstorming');

      const validParams = { problem: '如何实现用户认证？' };
      assert.equal(await adapter.validateParams(validParams), true);

      const invalidParams = {};
      assert.equal(await adapter.validateParams(invalidParams), false);
    });

    it('DebuggingAdapter 应该验证调试参数', async () => {
      const adapter = adapters.get('systematic-debugging');

      const validParams = { problem: '登录失败', error: 'TypeError: Cannot read property' };
      assert.equal(await adapter.validateParams(validParams), true);

      const invalidParams = {};
      assert.equal(await adapter.validateParams(invalidParams), false);
    });

    it('ResearchAdapter 应该验证研究参数', async () => {
      const adapter = adapters.get('research');

      const validParams = { topic: 'React 性能优化' };
      assert.equal(await adapter.validateParams(validParams), true);

      const invalidParams = {};
      assert.equal(await adapter.validateParams(invalidParams), false);
    });

    it('CodeExplorerAdapter 应该验证探索参数', async () => {
      const adapter = adapters.get('code-explorer');

      const validParams = { target: 'src/components/Auth.js' };
      assert.equal(await adapter.validateParams(validParams), true);

      const invalidParams = {};
      assert.equal(await adapter.validateParams(invalidParams), false);
    });

    it('PlanningAdapter 应该验证规划参数', async () => {
      const adapter = adapters.get('writing-plans');

      const validParams = { goal: '实现用户管理功能' };
      assert.equal(await adapter.validateParams(validParams), true);

      const invalidParams = {};
      assert.equal(await adapter.validateParams(invalidParams), false);
    });
  });

  describe('模板功能集成测试', () => {
    it('BrainstormingAdapter 应该返回头脑风暴模板', async () => {
      const adapter = adapters.get('brainstorming');
      const templates = adapter.getTemplates();

      assert.ok(templates);
      assert.ok(Array.isArray(templates.questions));
      assert.ok(templates.questions.length >= 5);
      assert.equal(templates.questions[0], '核心问题是什么？');
      assert.ok(templates.output);
    });

    it('DebuggingAdapter 应该返回调试流程模板', async () => {
      const adapter = adapters.get('systematic-debugging');
      const templates = adapter.getTemplates();

      assert.ok(templates);
      assert.ok(Array.isArray(templates.steps));
      assert.ok(templates.steps.length >= 8);
      assert.equal(templates.steps[0], '1. 清晰定义问题');
    });

    it('PlanningAdapter 应该返回计划章节模板', async () => {
      const adapter = adapters.get('writing-plans');
      const templates = adapter.getTemplates();

      assert.ok(templates);
      assert.ok(Array.isArray(templates.sections));
      assert.ok(templates.sections.length >= 9);
      assert.equal(templates.sections[0], '目标和背景');
    });
  });

  describe('SkillInterface 集成测试', () => {
    it('应该处理技能调用和降级', async () => {
      const result = await skillInterface.callSkill('brainstorming', {
        problem: '如何实现用户认证？',
      });

      assert.ok(result);
      assert.equal(result.skill, 'brainstorming');
      assert.equal(typeof result.success, 'boolean');
    });

    it('应该检查技能健康状态', async () => {
      const health = await skillInterface.checkSkillHealth('brainstorming');

      assert.ok(health);
      assert.equal(typeof health.available, 'boolean');
      // version 可能是 null 或 string
      assert.ok(health.version === null || typeof health.version === 'string');
    });

    it('应该获取所有技能健康状态', async () => {
      const allHealth = await skillInterface.getAllSkillsHealth();

      assert.ok(allHealth instanceof Map);
      assert.ok(allHealth.size > 0);
    });

    it('应该支持降级模式切换', () => {
      const modes = ['template', 'manual', 'simulation', 'error'];

      for (const mode of modes) {
        skillInterface.setFallbackMode(mode);
      }
    });

    it('应该支持启用/禁用降级', () => {
      skillInterface.setFallbackEnabled(true);
      skillInterface.setFallbackEnabled(false);
    });
  });

  describe('Router 降级配置集成测试', () => {
    it('应该获取 feature 类型的降级配置', () => {
      const config = getFallbackConfig('feature');

      assert.ok(config);
      assert.equal(config.enabled, true);
      assert.equal(config.defaultMode, 'template');
      assert.ok(config.skills);
    });

    it('应该获取 bug 类型的降级配置', () => {
      const config = getFallbackConfig('bug');

      assert.ok(config);
      assert.equal(config.enabled, true);
      assert.ok(config.skills['systematic-debugging']);
    });

    it('应该获取所有需求类型的降级配置', () => {
      const types = ['feature', 'bug', 'question', 'adjustment', 'refactor'];

      for (const type of types) {
        const config = getFallbackConfig(type);
        assert.ok(config, `${type} 应该有降级配置`);
        assert.equal(config.enabled, true);
      }
    });
  });

  describe('Scheduler 集成测试', () => {
    let scheduler;

    beforeEach(() => {
      scheduler = getScheduler(baseDir);
    });

    it('应该生成包含健康摘要的执行计划', async () => {
      const plan = scheduler.schedule({
        type: 'feature',
        id: 'TEST-001',
        description: '测试功能',
        mode: 'semi',
      });

      assert.ok(plan);
      assert.equal(plan.requirementId, 'TEST-001');
      // healthSummary 需要异步获取
      const healthSummary = await scheduler.getHealthSummary();
      assert.ok(healthSummary);
      assert.equal(typeof healthSummary.total, 'number');
    });

    it('应该检查技能链健康状态', async () => {
      const health = await scheduler.checkSkillsHealth(['brainstorming', 'writing-plans']);

      assert.ok(health);
      assert.equal(typeof health.allAvailable, 'boolean');
      assert.ok(health.skills);
      assert.ok(health.summary);
    });

    it('应该通过适配器执行技能', async () => {
      const result = await scheduler.executeSkill('brainstorming', {
        problem: '测试问题',
      });

      assert.ok(result);
      assert.equal(result.skill, 'brainstorming');
      assert.equal(typeof result.success, 'boolean');
    });

    it('应该支持设置降级模式', () => {
      scheduler.setFallbackMode('manual');
      scheduler.setFallbackEnabled(true);
      scheduler.setFallbackEnabled(false);
    });

    it('应该清除技能状态缓存', () => {
      scheduler.clearSkillCache();
    });
  });

  describe('端到端工作流测试', () => {
    it('完整的需求处理流程', async () => {
      const scheduler = getScheduler(baseDir);

      const plan = scheduler.schedule({
        type: 'feature',
        id: 'E2E-001',
        description: '端到端测试功能',
        mode: 'semi',
      });

      assert.ok(plan);
      assert.ok(plan.steps.length > 0);

      const health = await scheduler.checkSkillsHealth(plan.steps.map((s) => s.skill));

      assert.ok(health);

      if (plan.steps.length > 0) {
        const firstStep = plan.steps[0];
        const result = await scheduler.executeSkill(firstStep.skill, {
          problem: plan.description,
        });

        assert.ok(result);
      }
    });

    it('带降级的完整流程', async () => {
      const scheduler = getScheduler(baseDir);

      scheduler.setFallbackMode('template');
      scheduler.setFallbackEnabled(true);

      const plan = scheduler.schedule({
        type: 'bug',
        id: 'E2E-002',
        description: '测试 Bug 修复流程',
        mode: 'semi',
      });

      assert.ok(plan);

      const result = await scheduler.executeSkill('systematic-debugging', {
        problem: '测试问题',
      });

      assert.ok(result);
      assert.equal(result.skill, 'systematic-debugging');
    });
  });

  describe('健康检查器集成测试', () => {
    it('应该检查所有技能', async () => {
      const checker = new SkillsHealthChecker(baseDir);
      const results = await checker.checkAllSkills();

      assert.ok(results instanceof Map);
      assert.ok(results.size > 0);

      for (const [name, result] of results.entries()) {
        assert.ok(result.name);
        assert.ok(result.displayName);
        assert.equal(typeof result.available, 'boolean');
      }
    });

    it('应该生成健康检查报告', async () => {
      const checker = new SkillsHealthChecker(baseDir);
      const results = await checker.checkAllSkills();
      const report = checker.displayReport(results);

      assert.equal(typeof report, 'string');
      assert.ok(report.length > 0);
    });

    it('应该生成 JSON 报告', async () => {
      const checker = new SkillsHealthChecker(baseDir);
      const results = await checker.checkAllSkills();
      const jsonReport = checker.generateJsonReport(results);

      assert.ok(jsonReport);
      assert.ok(jsonReport.summary);
      assert.ok(jsonReport.skills);
      assert.equal(typeof jsonReport.timestamp, 'string');
    });

    it('应该获取简要摘要', async () => {
      const checker = new SkillsHealthChecker(baseDir);
      const summary = await checker.getSummary();

      assert.equal(typeof summary, 'string');
      assert.ok(summary.length > 0);
    });
  });

  describe('错误处理集成测试', () => {
    it('应该处理无效的技能调用', async () => {
      const result = await skillInterface.callSkill('non-existent-skill', {});

      assert.ok(result);
    });

    it('应该处理无效的参数', async () => {
      const adapter = adapters.get('brainstorming');
      const valid = await adapter.validateParams({});

      assert.equal(valid, false);
    });

    it('应该处理无效的需求类型', () => {
      const scheduler = getScheduler(baseDir);

      assert.throws(() => {
        scheduler.schedule({
          type: 'invalid-type',
          id: 'TEST-001',
          description: '测试',
        });
      }, /不支持的需求类型/);
    });

    it('应该处理无效的执行模式', () => {
      const scheduler = getScheduler(baseDir);

      assert.throws(() => {
        scheduler.schedule({
          type: 'feature',
          id: 'TEST-001',
          description: '测试',
          mode: 'invalid-mode',
        });
      }, /不支持的执行模式/);
    });
  });

  describe('性能测试', () => {
    it('应该快速创建适配器', () => {
      const start = Date.now();
      const adapters = AdapterFactory.createAllAdapters(baseDir);
      const duration = Date.now() - start;

      assert.ok(adapters.size > 0);
      assert.ok(duration < 100, `创建适配器应该在 100ms 内完成，实际 ${duration}ms`);
    });

    it('应该快速生成执行计划', () => {
      const scheduler = getScheduler(baseDir);
      const start = Date.now();
      const plan = scheduler.schedule({
        type: 'feature',
        id: 'PERF-001',
        description: '性能测试',
        mode: 'semi',
      });
      const duration = Date.now() - start;

      assert.ok(plan);
      assert.ok(duration < 50, `生成计划应该在 50ms 内完成，实际 ${duration}ms`);
    });

    it('应该有效缓存技能状态', async () => {
      const start = Date.now();
      await skillInterface.checkSkillHealth('brainstorming');
      const firstCall = Date.now() - start;

      const start2 = Date.now();
      await skillInterface.checkSkillHealth('brainstorming');
      const secondCall = Date.now() - start2;

      assert.ok(secondCall < firstCall, '缓存后的调用应该更快');
    });
  });
});
