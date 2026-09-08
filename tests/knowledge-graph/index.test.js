/**
 * 知识图谱模块测试
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { KnowledgeGraph } from '../../scripts/knowledge-graph/index.js';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

describe('KnowledgeGraph', () => {
  const testDir = '.test-requirements';
  let graph;

  beforeEach(async () => {
    // 创建测试目录结构
    const types = ['features', 'bugs'];

    for (const type of types) {
      const typePath = join(testDir, type);
      mkdirSync(typePath, { recursive: true });

      // 创建测试需求
      createTestRequirement(typePath, 'REQ-001', {
        id: 'REQ-001',
        type: type,
        title: '用户登录功能',
        description: '实现用户登录和身份验证',
        priority: { level: 'P0', score: 9.0 },
        status: 'planning',
        created_at: '2026-05-13T10:00:00Z',
        updated_at: '2026-05-13T10:00:00Z',
      });

      createTestRequirement(typePath, 'REQ-002', {
        id: 'REQ-002',
        type: type,
        title: '数据库连接优化',
        description: '优化数据库连接池配置',
        priority: { level: 'P1', score: 7.5 },
        status: 'in_progress',
        created_at: '2026-05-13T11:00:00Z',
        updated_at: '2026-05-13T11:00:00Z',
      });
    }

    // 初始化知识图谱
    graph = new KnowledgeGraph(testDir);
    await graph.initialize();
  });

  afterEach(() => {
    // 清理测试目录
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (_error) {
      // 忽略错误
    }
  });

  describe('#initialize', () => {
    it('应该成功初始化知识图谱', async () => {
      const reqs = graph.getAllRequirements();
      expect(reqs.length).to.be.above(0);
    });

    it('应该正确加载所有类型的需求', async () => {
      const features = graph.getRequirementsByType('features');
      const bugs = graph.getRequirementsByType('bugs');

      expect(features.length).to.be.above(0);
      expect(bugs.length).to.be.above(0);
    });
  });

  describe('#findSimilarRequirements', () => {
    it('应该找到相似的需求', () => {
      const results = graph.findSimilarRequirements('用户');

      expect(results.length).to.be.above(0);
      expect(results[0].item.title).to.include('用户');
    });

    it('应该按相似度排序', () => {
      const results = graph.findSimilarRequirements('数据库');

      // 第一个结果的相似度应该最高
      if (results.length > 1) {
        expect(results[0].score).to.be.at.most(results[1].score);
      }
    });

    it('应该限制返回数量', () => {
      const results = graph.findSimilarRequirements('功能', 2);

      expect(results.length).to.be.at.most(2);
    });
  });

  describe('#getStats', () => {
    it('应该返回正确的统计信息', () => {
      const stats = graph.getStats();

      expect(stats.total).to.be.above(0);
      expect(stats.byType).to.not.be.undefined;
      expect(stats.byStatus).to.not.be.undefined;
      expect(stats.byPriority).to.not.be.undefined;
    });

    it('应该按类型分组统计', () => {
      const stats = graph.getStats();

      expect(stats.byType.features).to.not.be.undefined;
      expect(stats.byType.bugs).to.not.be.undefined;
    });
  });

  describe('#getRequirementsByType', () => {
    it('应该按类型筛选需求', () => {
      const features = graph.getRequirementsByType('features');

      expect(features.length).to.be.above(0);
      features.forEach((req) => {
        expect(req.type).to.equal('features');
      });
    });
  });

  describe('#getRequirementsByStatus', () => {
    it('应该按状态筛选需求', () => {
      const planningReqs = graph.getRequirementsByStatus('planning');

      planningReqs.forEach((req) => {
        expect(req.status).to.equal('planning');
      });
    });
  });

  describe('#getRequirementsByPriority', () => {
    it('应该按优先级筛选需求', () => {
      const p0Reqs = graph.getRequirementsByPriority('P0');

      p0Reqs.forEach((req) => {
        expect(req.priority.level).to.equal('P0');
      });
    });
  });

  describe('#recommendRelated', () => {
    it('应该基于上下文推荐相关需求', () => {
      const recommendations = graph.recommendRelated({
        currentType: 'features',
        currentTags: [],
        currentPriority: 'P0',
      });

      expect(recommendations.length).to.be.above(0);
      recommendations.forEach((req) => {
        expect(req.type).to.equal('features');
      });
    });

    it('应该按优先级排序推荐结果', () => {
      const recommendations = graph.recommendRelated({
        currentType: 'features',
        currentTags: [],
        currentPriority: 'P0',
      });

      if (recommendations.length > 1) {
        expect(recommendations[0].priority.score).to.be.at.least(
          recommendations[1].priority.score
        );
      }
    });

    it('应该限制推荐数量', () => {
      const recommendations = graph.recommendRelated({
        currentType: 'features',
        currentTags: [],
        currentPriority: 'P0',
      });

      expect(recommendations.length).to.be.at.most(5);
    });
  });

  describe('#addRequirement', () => {
    it('应该成功添加新需求', async () => {
      const newReq = {
        id: 'REQ-003',
        type: 'features',
        title: '新功能测试',
        description: '测试添加功能',
        priority: { level: 'P2', score: 6.0 },
        status: 'planning',
        tags: ['test'],
        keywords: ['测试', '功能'],
        createdAt: '2026-05-14T10:00:00Z',
        updatedAt: '2026-05-14T10:00:00Z',
      };

      await graph.addRequirement(newReq);

      const allReqs = graph.getAllRequirements();
      expect(allReqs.some((r) => r.id === 'REQ-003')).to.equal(true);
    });
  });

  describe('#updateRequirement', () => {
    it('应该成功更新需求', async () => {
      const success = await graph.updateRequirement('REQ-001', {
        status: 'completed',
      });

      expect(success).to.equal(true);

      const updatedReq = graph.getAllRequirements().find((r) => r.id === 'REQ-001');
      expect(updatedReq.status).to.equal('completed');
    });

    it('应该返回 false 当需求不存在时', async () => {
      const success = await graph.updateRequirement('NON-EXISTENT', {
        status: 'completed',
      });

      expect(success).to.equal(false);
    });
  });

  describe('#deleteRequirement', () => {
    it('应该成功删除需求', async () => {
      // 创建独立的 graph 实例进行测试
      const testGraph = new KnowledgeGraph(testDir);
      await testGraph.initialize();

      const initialCount = testGraph.getAllRequirements().length;
      const initialReq001Count = testGraph
        .getAllRequirements()
        .filter((r) => r.id === 'REQ-001').length;

      const success = await testGraph.deleteRequirement('REQ-001');

      expect(success).to.equal(true);

      const allReqs = testGraph.getAllRequirements();
      expect(allReqs.length).to.equal(initialCount - 1);

      // 验证至少有一个 REQ-001 被删除了
      const finalReq001Count = testGraph
        .getAllRequirements()
        .filter((r) => r.id === 'REQ-001').length;
      expect(finalReq001Count).to.equal(initialReq001Count - 1);
    });

    it('应该返回 false 当需求不存在时', async () => {
      const success = await graph.deleteRequirement('NON-EXISTENT');

      expect(success).to.equal(false);
    });
  });

  describe('#rebuild', () => {
    it('应该成功重建索引', async () => {
      await graph.rebuild();

      const reqs = graph.getAllRequirements();
      expect(reqs.length).to.be.above(0);
    });
  });
});

/**
 * 创建测试需求文件
 */
function createTestRequirement(dirPath, reqId, meta) {
  const reqDir = join(dirPath, reqId);
  mkdirSync(reqDir, { recursive: true });

  // 创建 meta.yaml
  const metaContent = `id: ${meta.id}
type: ${meta.type}
title: ${meta.title}
description: ${meta.description}
priority:
  level: ${meta.priority.level}
  score: ${meta.priority.score}
status: ${meta.status}
created_at: ${meta.created_at}
updated_at: ${meta.updated_at}
`;

  writeFileSync(join(reqDir, 'meta.yaml'), metaContent);

  // 创建 spec.md
  const specContent = `# ${meta.title}

## 描述

${meta.description}

## 标签

#feature #priority-high
`;

  writeFileSync(join(reqDir, 'spec.md'), specContent);
}
