/**
 * Writing Plans 技能适配器
 * 实施计划和任务分解
 */

import { BaseSkillAdapter } from './base.js';

export class PlanningAdapter extends BaseSkillAdapter {
  getSkillName() {
    return 'writing-plans';
  }

  getDisplayName() {
    return 'Writing Plans';
  }

  validateParams(params) {
    if (!params || typeof params !== 'object') {
      return false;
    }
    return !!(params.goal || params.objective || params.task || params.feature);
  }

  preprocessParams(params) {
    const processed = { ...params };
    if (params.feature) {
      processed.goal = params.feature;
    }
    if (params.task) {
      processed.goal = params.task;
    }
    if (params.objective) {
      processed.goal = params.objective;
    }
    processed.options = {
      detailLevel: params.detailLevel || 'medium',
      includeTimeEstimates: params.includeTimeEstimates !== false,
      includeDependencies: params.includeDependencies !== false,
      includeRisks: params.includeRisks !== false,
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
        phases: ['目标定义', '任务分解', '依赖分析', '时间估算', '风险评估', '计划整合'],
        templates: this.getTemplates(),
      },
    };
  }

  getTemplates() {
    return {
      sections: ['目标和背景', '任务列表', '任务优先级', '依赖关系', '时间估算', '里程碑', '风险和应对', '资源需求', '验收标准'],
      output: {
        goal: '目标陈述',
        tasks: '任务列表',
        priorities: '优先级排序',
        dependencies: '依赖关系图',
        timeline: '时间线',
        milestones: '里程碑',
        risks: '风险分析',
        resources: '资源需求',
        acceptance: '验收标准',
      },
    };
  }

  postprocessResult(result) {
    return {
      ...result,
      type: 'planning',
      timestamp: new Date().toISOString(),
    };
  }
}

export default PlanningAdapter;
