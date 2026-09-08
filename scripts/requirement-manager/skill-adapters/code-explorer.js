/**
 * Code Explorer 技能适配器
 * 代码库探索和理解
 */

import { BaseSkillAdapter } from './base.js';

export class CodeExplorerAdapter extends BaseSkillAdapter {
  getSkillName() {
    return 'code-explorer';
  }

  getDisplayName() {
    return 'Code Explorer';
  }

  validateParams(params) {
    if (!params || typeof params !== 'object') {
      return false;
    }
    return !!(params.target || params.file || params.module || params.query);
  }

  preprocessParams(params) {
    const processed = { ...params };
    if (params.file) {
      processed.target = params.file;
    }
    if (params.module) {
      processed.target = params.module;
    }
    processed.options = {
      depth: params.depth || 'medium',
      includeTests: params.includeTests !== false,
      includeDocs: params.includeDocs !== false,
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
        phases: ['目标识别', '代码定位', '结构分析', '依赖关系', '功能理解'],
        templates: this.getTemplates(),
      },
    };
  }

  getTemplates() {
    return {
      questions: ['需要探索哪个文件或模块？', '想了解什么信息？', '该文件/模块的主要功能是什么？', '它与其他哪些模块有交互？', '有哪些关键函数或类？'],
      output: {
        target: '探索目标',
        location: '代码位置',
        structure: '代码结构',
        dependencies: '依赖关系',
        keyComponents: '关键组件',
        functionality: '功能描述',
      },
    };
  }

  postprocessResult(result) {
    return {
      ...result,
      type: 'code-exploration',
      timestamp: new Date().toISOString(),
    };
  }
}

export default CodeExplorerAdapter;
