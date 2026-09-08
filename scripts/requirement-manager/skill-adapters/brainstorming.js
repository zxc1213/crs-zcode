/**
 * Brainstorming 技能适配器
 * 深度问题探索和方案生成
 */

import { BaseSkillAdapter } from './base.js';

export class BrainstormingAdapter extends BaseSkillAdapter {
  getSkillName() {
    return 'brainstorming';
  }

  getDisplayName() {
    return 'Brainstorming';
  }

  validateParams(params) {
    if (!params || typeof params !== 'object') {
      return false;
    }
    return !!(params.problem || params.description || params.query);
  }

  preprocessParams(params) {
    const processed = { ...params };
    if (params.problem) {
      processed.query = params.problem;
    }
    if (params.description) {
      processed.query = params.description;
    }
    processed.options = {
      depth: params.depth || 'medium',
      exploreCount: params.exploreCount || 3,
      ...params.options,
    };
    return processed;
  }

  async execute(params) {
    return {
      skill: this.skillName,
      params,
      executable: true,
      guidance: {
        phases: ['问题探索', '方案生成', '方案评估', '推荐选择'],
        templates: this.getTemplates(),
      },
    };
  }

  getTemplates() {
    return {
      questions: ['核心问题是什么？', '有哪些可能的解决方案？', '各方案的优缺点是什么？', '有什么潜在风险？', '推荐哪个方案？为什么？'],
      output: {
        problemStatement: '问题陈述',
        alternatives: '备选方案列表',
        evaluation: '方案评估',
        recommendation: '推荐方案',
        rationale: '推荐理由',
      },
    };
  }

  postprocessResult(result) {
    return {
      ...result,
      type: 'brainstorming',
      timestamp: new Date().toISOString(),
    };
  }
}

export default BrainstormingAdapter;
