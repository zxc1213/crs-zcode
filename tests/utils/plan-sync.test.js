import { describe, it, beforeEach, afterEach } from 'mocha';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { expect } from 'chai';
import { syncPlanStatus, syncAllPlans } from '../../scripts/requirement-manager/utils/plan-sync.js';
import { writeMeta } from '../../scripts/requirement-manager/utils/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE_DIR = path.join(__dirname, '../temp-test-plan-sync');

describe('plan-sync Utility', () => {
  beforeEach(async () => {
    // 创建测试目录
    await fs.mkdir(TEST_BASE_DIR, { recursive: true });
  });

  afterEach(async () => {
    // 清理测试目录
    await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
  });

  describe('syncPlanStatus(baseDir, reqPath)', () => {
    it('should add progress block to plan.md without existing block', async () => {
      // 创建测试需求目录
      const reqPath = path.join(TEST_BASE_DIR, 'BUG-20260523-001');
      await fs.mkdir(reqPath, { recursive: true });

      // 创建 meta.yaml
      const meta = {
        id: 'BUG-20260523-001',
        type: 'bug',
        title: '测试需求',
        description: '测试描述',
        status: 'in_progress',
        created: '2026-05-23T00:00:00.000Z',
        updatedAt: '2026-05-23T01:00:00.000Z',
      };
      await writeMeta(TEST_BASE_DIR, reqPath, meta);

      // 创建 plan.md
      const planPath = path.join(reqPath, 'plan.md');
      const planContent = `# 测试计划

## 任务
- 任务1
- 任务2
`;
      await fs.writeFile(planPath, planContent, 'utf-8');

      // 同步状态
      const result = await syncPlanStatus(TEST_BASE_DIR, reqPath);

      // 验证
      expect(result).to.be.true;
      const updatedPlan = await fs.readFile(planPath, 'utf-8');
      expect(updatedPlan).to.include('## 实时进度');
      expect(updatedPlan).to.include('`in_progress`');
      expect(updatedPlan).to.include('60%'); // in_progress 对应 60%
    });

    it('should update existing progress block in plan.md', async () => {
      // 创建测试需求目录
      const reqPath = path.join(TEST_BASE_DIR, 'FEAT-001');
      await fs.mkdir(reqPath, { recursive: true });

      // 创建 meta.yaml
      const meta = {
        id: 'FEAT-001',
        type: 'feature',
        title: '测试功能',
        description: '测试描述',
        status: 'completed',
        created: '2026-05-23T00:00:00.000Z',
        updatedAt: '2026-05-23T02:00:00.000Z',
      };
      await writeMeta(TEST_BASE_DIR, reqPath, meta);

      // 创建带有进度区块的 plan.md
      const planPath = path.join(reqPath, 'plan.md');
      const planContent = `# 测试计划

## 实时进度

> **当前状态**: \`in_progress\` (更新于: 2026-05-23 01:00)
> **完成度**: 50%

---

## 任务
- 任务1
- 任务2
`;
      await fs.writeFile(planPath, planContent, 'utf-8');

      // 同步状态
      const result = await syncPlanStatus(TEST_BASE_DIR, reqPath);

      // 验证
      expect(result).to.be.true;
      const updatedPlan = await fs.readFile(planPath, 'utf-8');
      expect(updatedPlan).to.include('`completed`');
      expect(updatedPlan).to.include('100%'); // completed 对应 100%
      // 应该只有一个进度区块
      const matchCount = (updatedPlan.match(/## 实时进度/g) || []).length;
      expect(matchCount).to.equal(1);
    });

    it('should return false when plan.md does not exist', async () => {
      // 创建测试需求目录（没有 plan.md）
      const reqPath = path.join(TEST_BASE_DIR, 'QUES-001');
      await fs.mkdir(reqPath, { recursive: true });

      // 创建 meta.yaml
      const meta = {
        id: 'QUES-001',
        type: 'question',
        title: '测试问题',
        description: '测试描述',
        status: 'open',
        created: '2026-05-23T00:00:00.000Z',
        updatedAt: '2026-05-23T00:00:00.000Z',
      };
      await writeMeta(TEST_BASE_DIR, reqPath, meta);

      // 同步状态
      const result = await syncPlanStatus(TEST_BASE_DIR, reqPath);

      // 验证
      expect(result).to.be.false;
    });

    it('should handle all status values correctly', async () => {
      const statusTests = [
        { status: 'open', expectedPercent: '0%' },
        { status: 'in_progress', expectedPercent: '60%' },
        { status: 'completed', expectedPercent: '100%' },
        { status: 'blocked', expectedPercent: '25%' },
      ];

      for (const { status, expectedPercent } of statusTests) {
        // 创建测试需求目录
        const reqPath = path.join(TEST_BASE_DIR, `TEST-${status}`);
        await fs.mkdir(reqPath, { recursive: true });

        // 创建 meta.yaml
        const meta = {
          id: `TEST-${status}`,
          type: 'feature',
          title: `测试${status}`,
          description: '测试',
          status,
          created: '2026-05-23T00:00:00.000Z',
          updatedAt: '2026-05-23T00:00:00.000Z',
        };
        await writeMeta(TEST_BASE_DIR, reqPath, meta);

        // 创建 plan.md
        const planPath = path.join(reqPath, 'plan.md');
        await fs.writeFile(planPath, `# 计划\n`, 'utf-8');

        // 同步状态
        await syncPlanStatus(TEST_BASE_DIR, reqPath);

        // 验证
        const updatedPlan = await fs.readFile(planPath, 'utf-8');
        expect(updatedPlan).to.include(`\`${status}\``);
        expect(updatedPlan).to.include(expectedPercent);
      }
    });
  });

  describe('syncAllPlans(baseDir, reqPaths)', () => {
    it('should sync multiple plans and return statistics', async () => {
      const reqPaths = [];

      // 创建3个测试需求
      for (let i = 1; i <= 3; i++) {
        const reqPath = path.join(TEST_BASE_DIR, `FEAT-00${i}`);
        await fs.mkdir(reqPath, { recursive: true });

        const meta = {
          id: `FEAT-00${i}`,
          type: 'feature',
          title: `测试${i}`,
          description: '测试',
          status: 'in_progress',
          created: '2026-05-23T00:00:00.000Z',
          updatedAt: '2026-05-23T00:00:00.000Z',
        };
        await writeMeta(TEST_BASE_DIR, reqPath, meta);

        // 创建 plan.md
        const planPath = path.join(reqPath, 'plan.md');
        await fs.writeFile(planPath, `# 计划${i}\n`, 'utf-8');

        reqPaths.push(reqPath);
      }

      // 添加一个没有 plan.md 的需求
      const noPlanPath = path.join(TEST_BASE_DIR, 'FEAT-004');
      await fs.mkdir(noPlanPath, { recursive: true });
      const meta = {
        id: 'FEAT-004',
        type: 'feature',
        title: '无计划',
        description: '测试',
        status: 'open',
        created: '2026-05-23T00:00:00.000Z',
        updatedAt: '2026-05-23T00:00:00.000Z',
      };
      await writeMeta(TEST_BASE_DIR, noPlanPath, meta);
      reqPaths.push(noPlanPath);

      // 同步所有
      const results = await syncAllPlans(TEST_BASE_DIR, reqPaths);

      // 验证
      expect(results.total).to.equal(4);
      expect(results.succeeded).to.equal(3);
      expect(results.skipped).to.equal(1);
      expect(results.failed).to.equal(0);
    });
  });

  describe('syncAcceptanceCriteria() - 验收标准同步', () => {
    it('should check all criteria when status is completed', async () => {
      const reqPath = path.join(TEST_BASE_DIR, 'FEAT-AC-001');
      await fs.mkdir(reqPath, { recursive: true });

      const meta = {
        id: 'FEAT-AC-001',
        type: 'feature',
        title: '验收标准测试',
        description: '测试',
        status: 'completed',
        created: '2026-05-23T00:00:00.000Z',
        updatedAt: '2026-05-23T00:00:00.000Z',
      };
      await writeMeta(TEST_BASE_DIR, reqPath, meta);

      const planPath = path.join(reqPath, 'plan.md');
      const planContent = `# 计划

## 验收标准
- [x] 已完成任务1
- [ ] 未完成任务2
- [ ] 未完成任务3
`;
      await fs.writeFile(planPath, planContent, 'utf-8');

      await syncPlanStatus(TEST_BASE_DIR, reqPath);

      const updated = await fs.readFile(planPath, 'utf-8');
      const checkedCount = (updated.match(/- \[x\]/g) || []).length;
      const uncheckedCount = (updated.match(/- \[ \]/g) || []).length;

      expect(checkedCount).to.equal(3); // 全部勾选
      expect(uncheckedCount).to.equal(0);
    });

    it('should uncheck all criteria when status is open', async () => {
      const reqPath = path.join(TEST_BASE_DIR, 'FEAT-AC-002');
      await fs.mkdir(reqPath, { recursive: true });

      const meta = {
        id: 'FEAT-AC-002',
        type: 'feature',
        title: '验收标准测试2',
        description: '测试',
        status: 'open',
        created: '2026-05-23T00:00:00.000Z',
        updatedAt: '2026-05-23T00:00:00.000Z',
      };
      await writeMeta(TEST_BASE_DIR, reqPath, meta);

      const planPath = path.join(reqPath, 'plan.md');
      const planContent = `# 计划

## 验收标准
- [x] 任务1
- [x] 任务2
`;
      await fs.writeFile(planPath, planContent, 'utf-8');

      await syncPlanStatus(TEST_BASE_DIR, reqPath);

      const updated = await fs.readFile(planPath, 'utf-8');
      const checkedCount = (updated.match(/- \[x\]/g) || []).length;
      const uncheckedCount = (updated.match(/- \[ \]/g) || []).length;

      expect(checkedCount).to.equal(0); // 全部不勾选
      expect(uncheckedCount).to.equal(2);
    });

    it('should preserve criteria when status is in_progress', async () => {
      const reqPath = path.join(TEST_BASE_DIR, 'FEAT-AC-003');
      await fs.mkdir(reqPath, { recursive: true });

      const meta = {
        id: 'FEAT-AC-003',
        type: 'feature',
        title: '验收标准测试3',
        description: '测试',
        status: 'in_progress',
        created: '2026-05-23T00:00:00.000Z',
        updatedAt: '2026-05-23T00:00:00.000Z',
      };
      await writeMeta(TEST_BASE_DIR, reqPath, meta);

      const planPath = path.join(reqPath, 'plan.md');
      const originalContent = `# 计划

## 验收标准
- [x] 已完成
- [ ] 未完成
`;
      await fs.writeFile(planPath, originalContent, 'utf-8');

      await syncPlanStatus(TEST_BASE_DIR, reqPath);

      const updated = await fs.readFile(planPath, 'utf-8');
      const acceptanceSection = updated.match(/## 验收标准[\s\S]*?(?=\n## |\n---|$)/)[0];

      // in_progress 应该保持原样
      expect(acceptanceSection).to.include('- [x] 已完成');
      expect(acceptanceSection).to.include('- [ ] 未完成');
    });

    it('should handle plan without acceptance criteria gracefully', async () => {
      const reqPath = path.join(TEST_BASE_DIR, 'FEAT-AC-004');
      await fs.mkdir(reqPath, { recursive: true });

      const meta = {
        id: 'FEAT-AC-004',
        type: 'feature',
        title: '无验收标准',
        description: '测试',
        status: 'completed',
        created: '2026-05-23T00:00:00.000Z',
        updatedAt: '2026-05-23T00:00:00.000Z',
      };
      await writeMeta(TEST_BASE_DIR, reqPath, meta);

      const planPath = path.join(reqPath, 'plan.md');
      const planContent = `# 计划

## 任务
- 任务1
- 任务2
`;
      await fs.writeFile(planPath, planContent, 'utf-8');

      // 不应该抛出错误
      const result = await syncPlanStatus(TEST_BASE_DIR, reqPath);
      expect(result).to.be.true;
    });
  });
});
