/**
 * Research 技能适配器
 * 信息收集和研究分析
 */

import { BaseSkillAdapter } from './base.js';

export class ResearchAdapter extends BaseSkillAdapter {
  getSkillName() {
    return 'research';
  }

  getDisplayName() {
    return 'Research';
  }

  validateParams(params) {
    if (!params || typeof params !== 'object') {
      return false;
    }
    return !!(params.topic || params.query || params.subject);
  }

  preprocessParams(params) {
    const processed = { ...params };
    if (params.subject) {
      processed.topic = params.subject;
    }
    if (params.query) {
      processed.topic = params.query;
    }
    processed.options = {
      depth: params.depth || 'medium',
      sources: params.sources || ['docs', 'code', 'web'],
      maxResults: params.maxResults || 10,
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
        phases: ['研究主题定义', '信息源识别', '信息收集', '信息整理', '分析总结'],
        templates: this.getTemplates(),
      },
    };
  }

  getTemplates() {
    return {
      questions: ['需要研究什么主题？', '已知信息有哪些？', '需要查找哪些信息？', '从哪些信息源查找？', '如何整理和分析收集到的信息？'],
      output: {
        topic: '研究主题',
        knownInfo: '已知信息',
        researchQuestions: '研究问题',
        findings: '研究发现',
        sources: '信息来源',
        summary: '研究总结',
      },
    };
  }

  postprocessResult(result) {
    return {
      ...result,
      type: 'research',
      timestamp: new Date().toISOString(),
    };
  }
}

export default ResearchAdapter;
