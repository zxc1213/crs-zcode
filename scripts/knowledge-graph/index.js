/**
 * 向量知识图谱模块
 *
 * 功能：
 * - 需求向量化（使用 Fuse.js 实现语义搜索）
 * - 相似需求发现
 * - 跨需求知识关联
 * - 上下文感知推荐
 *
 * 参考：Ruflo AgentDB + HNSW 的简化实现
 */

import Fuse from 'fuse.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * 知识图谱类
 */
export class KnowledgeGraph {
  /** @type {Array<Object>} */
  requirements = [];
  /** @type {Fuse} */
  fuse;
  /** @type {string} */
  requirementsPath;

  /**
   * @param {string} requirementsPath
   */
  constructor(requirementsPath) {
    this.requirementsPath = requirementsPath;
  }

  /**
   * 初始化知识图谱
   * @returns {Promise<void>}
   */
  async initialize() {
    // 扫描所有需求目录
    const types = ['features', 'bugs', 'questions', 'adjustments', 'refactorings'];

    for (const type of types) {
      const typePath = join(this.requirementsPath, type);
      try {
        const reqDirs = readdirSync(typePath);

        for (const reqDir of reqDirs) {
          const metaPath = join(typePath, reqDir, 'meta.yaml');
          const specPath = join(typePath, reqDir, 'spec.md');

          try {
            const req = await this.loadRequirement(metaPath, specPath);
            this.requirements.push(req);
          } catch (_error) {
            // 跳过无法加载的需求
          }
        }
      } catch (_error) {
        // 目录不存在，跳过
        continue;
      }
    }

    // 初始化 Fuse.js 搜索引擎
    this.initializeFuse();
  }

  /**
   * 加载单个需求
   * @private
   * @param {string} metaPath
   * @param {string} specPath
   * @returns {Promise<Object>}
   */
  async loadRequirement(metaPath, specPath) {
    // 读取 meta.yaml（简化实现，实际应使用 YAML 解析器）
    const metaContent = readFileSync(metaPath, 'utf-8');
    const meta = this.parseMetaYaml(metaContent);

    // 读取 spec.md
    const specContent = readFileSync(specPath, 'utf-8');

    // 提取关键词
    const keywords = this.extractKeywords(specContent);

    return {
      id: meta.id,
      type: meta.type,
      title: meta.title,
      description: meta.description,
      priority: {
        ...meta.priority,
        score: parseFloat(meta.priority.score),
      },
      status: meta.status,
      tags: this.extractTags(specContent),
      keywords,
      createdAt: meta.created_at,
      updatedAt: meta.updated_at,
    };
  }

  /**
   * 解析 meta.yaml（简化实现）
   * @private
   * @param {string} content
   * @returns {Object}
   */
  parseMetaYaml(content) {
    const lines = content.split('\n');
    const result = {};
    const stack = [{ obj: result, indent: -1 }];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.search(/\S|$/);
      const match = trimmed.match(/^(\w+):\s*(.+)?$/);

      if (match) {
        const [, key, value] = match;

        // 找到正确的父级对象
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
          stack.pop();
        }

        const parent = stack[stack.length - 1].obj;

        if (value === undefined) {
          // 嵌套对象开始
          parent[key] = {};
          stack.push({ obj: parent[key], indent });
        } else {
          // 简单值
          parent[key] = value.trim();
        }
      }
    }

    return result;
  }

  /**
   * 提取关键词（TF-IDF 简化版）
   * @private
   * @param {string} content
   * @returns {Array<string>}
   */
  extractKeywords(content) {
    // 简化的关键词提取：移除停用词，统计词频
    const stopWords = new Set(['的', '是', '在', '和', '与', '或', '但', '如果', '然后', '因为', '所以', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'need']);

    const words = content
      .toLowerCase()
      .replace(/[^\w\s一-龥]/g, ' ') // 保留中英文
      .split(/\s+/)
      .filter((word) => word.length > 1 && !stopWords.has(word));

    // 统计词频
    const freq = new Map();
    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }

    // 返回前 20 个高频词
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  }

  /**
   * 提取标签
   * @private
   * @param {string} content
   * @returns {Array<string>}
   */
  extractTags(content) {
    const tags = [];
    const tagPattern = /#(\w+)/g;
    let match;

    while ((match = tagPattern.exec(content)) !== null) {
      tags.push(match[1]);
    }

    return tags;
  }

  /**
   * 初始化 Fuse.js
   * @private
   */
  initializeFuse() {
    this.fuse = new Fuse(this.requirements, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'description', weight: 1.5 },
        { name: 'keywords', weight: 2 },
        { name: 'tags', weight: 1.5 },
      ],
      threshold: 0.3,
      includeScore: true,
      minMatchCharLength: 2,
    });
  }

  /**
   * 搜索相似需求
   * @param {string} query
   * @param {number} limit
   * @returns {Array<Object>}
   */
  findSimilarRequirements(query, limit = 5) {
    const results = this.fuse.search(query, { limit });
    return results;
  }

  /**
   * 获取需求统计
   */
  getStats() {
    const byType = new Map();
    const byStatus = new Map();
    const byPriority = new Map();

    for (const req of this.requirements) {
      byType.set(req.type, (byType.get(req.type) || 0) + 1);
      byStatus.set(req.status, (byStatus.get(req.status) || 0) + 1);
      byPriority.set(req.priority.level, (byPriority.get(req.priority.level) || 0) + 1);
    }

    return {
      total: this.requirements.length,
      byType: Object.fromEntries(byType),
      byStatus: Object.fromEntries(byStatus),
      byPriority: Object.fromEntries(byPriority),
    };
  }

  /**
   * 获取知识关联
   * @param {string} reqId
   * @param {number} depth
   * @returns {Map}
   */
  getKnowledgeConnections(reqId, depth = 2) {
    const connections = new Map();
    const visited = new Set();
    const queue = [reqId];

    visited.add(reqId);

    for (let i = 0; i < depth && queue.length > 0; i++) {
      const currentId = queue.shift();
      if (!currentId) continue;
      const similar = this.findSimilarRequirements(currentId, 5);

      for (const { item } of similar) {
        if (!visited.has(item.id)) {
          visited.add(item.id);
          queue.push(item.id);

          const levelConnections = connections.get(`level_${i}`) || [];
          levelConnections.push(item);
          connections.set(`level_${i}`, levelConnections);
        }
      }
    }

    return connections;
  }

  /**
   * 重建索引（当需求变更时调用）
   * @returns {Promise<void>}
   */
  async rebuild() {
    this.requirements = [];
    await this.initialize();
  }

  /**
   * 添加新需求
   * @param {Object} req
   * @returns {Promise<void>}
   */
  async addRequirement(req) {
    this.requirements.push(req);
    this.initializeFuse();
  }

  /**
   * 更新需求
   * @param {string} reqId
   * @param {Object} updates
   * @returns {Promise<boolean>}
   */
  async updateRequirement(reqId, updates) {
    const index = this.requirements.findIndex((r) => r.id === reqId);

    if (index !== -1) {
      this.requirements[index] = { ...this.requirements[index], ...updates };
      this.initializeFuse();
      return true;
    }

    return false;
  }

  /**
   * 删除需求
   * @param {string} reqId
   * @returns {Promise<boolean>}
   */
  async deleteRequirement(reqId) {
    const index = this.requirements.findIndex((r) => r.id === reqId);

    if (index !== -1) {
      this.requirements.splice(index, 1);
      this.initializeFuse();
      return true;
    }

    return false;
  }

  /**
   * 获取所有需求
   * @returns {Array<Object>}
   */
  getAllRequirements() {
    return [...this.requirements];
  }

  /**
   * 根据类型筛选需求
   * @param {string} type
   * @returns {Array<Object>}
   */
  getRequirementsByType(type) {
    return this.requirements.filter((r) => r.type === type);
  }

  /**
   * 根据状态筛选需求
   * @param {string} status
   * @returns {Array<Object>}
   */
  getRequirementsByStatus(status) {
    return this.requirements.filter((r) => r.status === status);
  }

  /**
   * 根据优先级筛选需求
   * @param {string} level
   * @returns {Array<Object>}
   */
  getRequirementsByPriority(level) {
    return this.requirements.filter((r) => r.priority.level === level);
  }

  /**
   * 智能推荐：基于上下文推荐相关需求
   * @param {Object} context
   * @param {string} [context.currentType]
   * @param {Array<string>} [context.currentTags]
   * @param {string} [context.currentPriority]
   * @returns {Array<Object>}
   */
  recommendRelated(context) {
    let results = this.requirements;

    // 按类型筛选
    if (context.currentType) {
      results = results.filter((r) => r.type === context.currentType);
    }

    // 按标签关联
    if (context.currentTags && context.currentTags.length > 0) {
      results = results.filter((r) => r.tags.some((tag) => context.currentTags.includes(tag)));
    }

    // 按优先级排序
    results.sort((a, b) => b.priority.score - a.priority.score);

    return results.slice(0, 5);
  }
}

/**
 * 导出单例实例
 */
let graphInstance = null;

/**
 * @param {string} [requirementsPath='.requirements']
 * @returns {Promise<KnowledgeGraph>}
 */
export async function getKnowledgeGraph(requirementsPath = '.requirements') {
  if (!graphInstance) {
    graphInstance = new KnowledgeGraph(requirementsPath);
    await graphInstance.initialize();
  }
  return graphInstance;
}

/**
 * @returns {Promise<void>}
 */
export async function rebuildKnowledgeGraph() {
  if (graphInstance) {
    await graphInstance.rebuild();
  }
}
