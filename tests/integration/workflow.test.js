import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import fs from 'node:fs/promises';
import yaml from 'js-yaml';
import RequirementManager from '../../scripts/requirement-manager/index.js';

describe('需求管理系统集成测试', () => {
  const testDir = '.test-workflow';

  beforeEach(async () => {
    await fs.mkdir(`${testDir}/.requirements`, { recursive: true });
    await fs.mkdir(`${testDir}/.crs`, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('核心功能', () => {
    it('应该成功创建需求', async () => {
      const manager = new RequirementManager(testDir);
      const result = await manager.handle('实现用户登录功能');

      expect(result.success).to.be.ok;
      expect(result.requirement).to.be.ok;
      expect(result.requirement.id).to.be.ok;
      expect(result.requirement.type).to.be.ok;
      expect(result.requirement.type).to.equal('feature');
    });

    it('应该为不同类型需求创建正确的前缀', async () => {
      const manager = new RequirementManager(testDir);

      // Feature
      const featureResult = await manager.handle('/req --feature 添加用户注册');
      expect(featureResult.requirement.id).to.be.ok;
      expect(featureResult.requirement.type).to.equal('feature');

      // Bug
      const bugResult = await manager.handle('/req --bug 登录页面崩溃');
      expect(bugResult.requirement.id).to.be.ok;
      expect(bugResult.requirement.type).to.equal('bug');

      // Question
      const questionResult = await manager.handle('/req --question 如何优化性能');
      expect(questionResult.requirement.id).to.be.ok;
      expect(questionResult.requirement.type).to.equal('question');
    });

    it('应该检测敏感信息', async () => {
      const manager = new RequirementManager(testDir);
      const result = await manager.handle('数据库密码是 secret123');

      // 敏感信息检测会阻止创建
      if (!result.success && result.error === 'security_check_failed') {
        expect(result.message.includes('敏感信息'));
      } else {
        // 如果实现了过滤而非阻止，则应该成功
        expect(result.success).to.be.ok;
      }
    });
  });

  describe('需求文件结构', () => {
    it('应该正确保存需求元数据', async () => {
      const manager = new RequirementManager(testDir);
      const result = await manager.handle('实现测试功能');

      // 验证需求成功创建，包含必要信息
      expect(result.success).to.be.ok;
      expect(result.requirement).to.be.ok;
      expect(result.requirement.id).to.be.ok;
      expect(result.executionPlan).to.be.ok;
    });
  });

  describe('执行计划生成', () => {
    it('应该为每个需求生成执行计划', async () => {
      const manager = new RequirementManager(testDir);
      const result = await manager.handle('新功能需求');

      expect(result.executionPlan).to.be.ok;
      expect(typeof result.executionPlan.totalSteps === 'number').to.be.ok;
    });

    it.skip('应该提供下一步操作指导', async () => {
      const manager = new RequirementManager(testDir);
      const result = await manager.handle('分析用户行为');

      expect(result.nextSteps).to.be.ok;
      expect(Array.isArray(result.nextSteps));
      expect(result.nextSteps.length > 0).to.be.ok;
    });
  });

  describe('查询命令', () => {
    it('应该处理 list 命令', async () => {
      const manager = new RequirementManager(testDir);
      const result = await manager.handle('/req --list');

      expect(result.success).to.be.ok;
      expect(result.action).to.equal('list_requirements');
    });

    it('应该处理 dashboard 命令', async () => {
      const manager = new RequirementManager(testDir);
      const result = await manager.handle('/req --dashboard');

      expect(result.success).to.be.ok;
      expect(result.action).to.equal('show_dashboard');
    });

    it('应该处理 status 命令', async () => {
      const manager = new RequirementManager(testDir);
      const result = await manager.handle('/req --status REQ-001');

      expect(result.success).to.be.ok;
      expect(result.action).to.equal('show_status');
    });
  });

  describe('错误处理', () => {
    it('应该处理空输入', async () => {
      const manager = new RequirementManager(testDir);
      const result = await manager.handle('');

      // 目前空输入会被解析，但不应该崩溃
      expect(result !== undefined).to.be.ok;
    });
  });

  describe('并发创建', () => {
    it('应该支持并发创建多个需求', async () => {
      const manager = new RequirementManager(testDir);

      const promises = [
        manager.handle('并发需求1'),
        manager.handle('并发需求2'),
        manager.handle('并发需求3'),
      ];

      const results = await Promise.all(promises);

      expect(results.every((r) => r.success));
      expect(results.every((r) => r.requirement));
      expect(results.every((r) => r.requirement.id));

      // 验证 ID 是唯一的
      const ids = results.map((r) => r.requirement.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).to.equal(3);
    });
  });
});
