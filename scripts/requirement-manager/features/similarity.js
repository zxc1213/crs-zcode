/**
 * Similarity Detector - 相似度检测器
 * 使用 Fuse.js 进行模糊搜索，查找相似需求
 */

import Fuse from 'fuse.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

class SimilarityDetector {
  constructor() {
    // Fuse.js 配置
    this.fuseOptions = {
      includeScore: true,
      threshold: 0.7, // 默认阈值
      keys: [
        {
          name: 'title',
          weight: 0.4, // title 权重 40%
        },
        {
          name: 'description',
          weight: 0.6, // description 权重 60%
        },
      ],
    };

    // 需求存储路径
    this.requirementsPath = join(process.cwd(), 'requirements');
  }

  /**
   * 加载所有需求
   * @returns {Array} - 需求数组 [{ id, title, description, type, ... }]
   */
  loadAllRequirements() {
    const requirements = [];
    const types = ['features', 'bugs'];

    for (const type of types) {
      const typePath = join(this.requirementsPath, type);

      if (!existsSync(typePath)) {
        continue;
      }

      const entries = readdirSync(typePath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const reqPath = join(typePath, entry.name);
        const metaPath = join(reqPath, 'meta.yaml');

        if (!existsSync(metaPath)) {
          continue;
        }

        try {
          const content = readFileSync(metaPath, 'utf-8');
          const meta = this.parseMeta(content);

          requirements.push({
            id: meta.id,
            type: meta.type,
            title: meta.title || '',
            description: meta.description || '',
            status: meta.status,
            priority: meta.priority,
            created: meta.created,
            tags: meta.tags || [],
          });
        } catch (error) {
          console.warn(`Failed to load requirement from ${metaPath}:`, error.message);
        }
      }
    }

    return requirements;
  }

  /**
   * 解析 meta.yaml 内容
   * @param {string} content - YAML 内容
   * @returns {Object} - 解析后的对象
   */
  parseMeta(content) {
    const meta = {
      id: '',
      type: '',
      title: '',
      description: '',
      status: 'open',
      priority: 'medium',
      created: '',
      tags: [],
    };

    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        if (key === 'tags') {
          try {
            meta[key] = JSON.parse(value);
          } catch {
            meta[key] = [];
          }
        } else {
          meta[key] = value;
        }
      }
    }

    return meta;
  }

  /**
   * 查找相似需求
   * @param {string} description - 需求描述
   * @param {number} threshold - 相似度阈值 (0-1)，默认 0.7
   * @returns {Object} - { similar: Array, count: number, topMatch: Object|null }
   */
  findSimilar(description, threshold = 0.7) {
    if (!description || typeof description !== 'string') {
      return {
        similar: [],
        count: 0,
        topMatch: null,
      };
    }

    // 加载所有需求
    const requirements = this.loadAllRequirements();

    if (requirements.length === 0) {
      return {
        similar: [],
        count: 0,
        topMatch: null,
      };
    }

    // 更新阈值
    const options = { ...this.fuseOptions, threshold };

    // 创建 Fuse 实例
    const fuse = new Fuse(requirements, options);

    // 执行搜索
    const results = fuse.search(description);

    // 格式化结果
    const similar = results.map((result) => ({
      id: result.item.id,
      type: result.item.type,
      title: result.item.title,
      description: result.item.description,
      status: result.item.status,
      priority: result.item.priority,
      similarity: 1 - result.score, // 转换为相似度分数
      score: result.score,
    }));

    // 按相似度排序
    similar.sort((a, b) => b.similarity - a.similarity);

    return {
      similar,
      count: similar.length,
      topMatch: similar.length > 0 ? similar[0] : null,
    };
  }

  /**
   * 检查需求是否与现有需求重复
   * @param {string} description - 需求描述
   * @param {number} threshold - 重复阈值，默认 0.85
   * @returns {Object} - { isDuplicate: boolean, duplicates: Array, confidence: number }
   */
  checkDuplicate(description, threshold = 0.85) {
    const result = this.findSimilar(description, threshold);

    if (result.count === 0) {
      return {
        isDuplicate: false,
        duplicates: [],
        confidence: 0,
      };
    }

    // 计算最高相似度作为置信度
    const confidence = result.topMatch.similarity;

    return {
      isDuplicate: confidence >= threshold,
      duplicates: result.similar,
      confidence,
    };
  }

  /**
   * 获取相似度报告
   * @param {string} description - 需求描述
   * @param {number} threshold - 相似度阈值
   * @returns {Object} - 详细的相似度报告
   */
  getReport(description, threshold = 0.7) {
    const result = this.findSimilar(description, threshold);
    const requirements = this.loadAllRequirements();

    const report = {
      query: description,
      threshold,
      timestamp: new Date().toISOString(),
      summary: {
        totalRequirements: requirements.length,
        similarFound: result.count,
        highConfidence: result.similar.filter((r) => r.similarity >= 0.8).length,
        mediumConfidence: result.similar.filter((r) => r.similarity >= 0.6 && r.similarity < 0.8).length,
        lowConfidence: result.similar.filter((r) => r.similarity < 0.6).length,
      },
      matches: result.similar.map((match) => ({
        id: match.id,
        title: match.title,
        similarity: match.similarity,
        confidence: this.getConfidenceLevel(match.similarity),
        status: match.status,
        priority: match.priority,
      })),
      recommendation: this.getRecommendation(result),
    };

    return report;
  }

  /**
   * 获取相似度置信度级别
   * @param {number} similarity - 相似度分数 (0-1)
   * @returns {string} - 置信度级别
   */
  getConfidenceLevel(similarity) {
    if (similarity >= 0.9) return '非常高';
    if (similarity >= 0.8) return '高';
    if (similarity >= 0.7) return '中等';
    if (similarity >= 0.6) return '低';
    return '非常低';
  }

  /**
   * 获取推荐建议
   * @param {Object} result - 相似度检测结果
   * @returns {string} - 推荐建议
   */
  getRecommendation(result) {
    if (result.count === 0) {
      return '未发现相似需求，可以创建新需求。';
    }

    if (result.topMatch.similarity >= 0.9) {
      return `高度疑似重复！发现与 ${result.topMatch.id}（${result.topMatch.title}）高度相似，建议先检查现有需求。`;
    }

    if (result.topMatch.similarity >= 0.8) {
      return `可能存在重复。发现与 ${result.topMatch.id} 相似度较高，建议查看现有需求后再决定是否创建。`;
    }

    if (result.topMatch.similarity >= 0.7) {
      return `存在部分相似的需求。建议查看 ${result.topMatch.id}，确认是否为同一需求的不同描述。`;
    }

    return `发现 ${result.count} 个相似度较低的需求，仅供参考。`;
  }

  /**
   * 批量检查多个需求的相似度
   * @param {Array} descriptions - 需求描述数组
   * @param {number} threshold - 相似度阈值
   * @returns {Array} - 每个需求的相似度结果
   */
  batchCheck(descriptions, threshold = 0.7) {
    return descriptions.map((description) => ({
      description,
      ...this.findSimilar(description, threshold),
    }));
  }

  /**
   * 获取需求统计信息
   * @returns {Object} - 统计信息
   */
  getStatistics() {
    const requirements = this.loadAllRequirements();

    const stats = {
      total: requirements.length,
      byType: {},
      byStatus: {},
      byPriority: {},
    };

    for (const req of requirements) {
      // 按类型统计
      stats.byType[req.type] = (stats.byType[req.type] || 0) + 1;

      // 按状态统计
      stats.byStatus[req.status] = (stats.byStatus[req.status] || 0) + 1;

      // 按优先级统计
      stats.byPriority[req.priority] = (stats.byPriority[req.priority] || 0) + 1;
    }

    return stats;
  }
}

// 导出单例
const similarityDetector = new SimilarityDetector();

export default similarityDetector;
