/**
 * Systematic Debugging 技能适配器
 * 系统化调试和问题诊断
 */

import { BaseSkillAdapter } from './base.js';

export class DebuggingAdapter extends BaseSkillAdapter {
  getSkillName() {
    return 'systematic-debugging';
  }

  getDisplayName() {
    return 'Systematic Debugging';
  }

  validateParams(params) {
    if (!params || typeof params !== 'object') {
      return false;
    }
    return !!(params.problem || params.error || params.bug);
  }

  preprocessParams(params) {
    const processed = { ...params };
    if (params.bug) {
      processed.problem = params.bug;
    }
    if (params.error) {
      processed.problem = params.error;
    }
    processed.options = {
      approach: params.approach || 'systematic',
      includeLogs: params.includeLogs !== false,
      depth: params.depth || 'deep',
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
        phases: ['问题定义', '信息收集', '假设生成', '假设验证', '根因分析', '解决方案'],
        templates: this.getTemplates(),
      },
    };
  }

  getTemplates() {
    return {
      steps: ['1. 清晰定义问题', '2. 收集相关日志和数据', '3. 列出可能的根本原因', '4. 设计验证实验', '5. 执行验证并分析结果', '6. 确定根本原因', '7. 制定解决方案', '8. 实施并验证修复'],
      output: {
        problemDefinition: '问题定义',
        gatheredInfo: '收集的信息',
        hypotheses: '假设列表',
        tests: '验证测试',
        rootCause: '根本原因',
        solution: '解决方案',
        verification: '验证结果',
      },
    };
  }

  postprocessResult(result) {
    return {
      ...result,
      type: 'debugging',
      timestamp: new Date().toISOString(),
    };
  }
}

export default DebuggingAdapter;
