/**
 * Skill 调度器 - 生成执行计划和 skill 调用提示词
 */

import { getRoute, getSkillChain, getPhases } from './router.js';
import { SkillInterface } from './skill-interface.js';
import { AdapterFactory } from '../skill-adapters/index.js';

/**
 * 提示词模板配置
 */
const PROMPT_TEMPLATES = {
  brainstorming: (context) => `请使用 brainstorming skill 分析以下需求：

需求：${context.description}
类型：${context.type}
需求ID：${context.id || 'N/A'}

请按照 brainstorming 流程进行需求分析和设计。`,

  'systematic-debugging': (context) => `请使用 systematic-debugging skill 调查以下问题：

问题：${context.description}
需求ID：${context.id || 'N/A'}
相关错误信息：${context.errorDetails || '无'}

请按照 systematic-debugging 流程进行问题诊断。`,

  'writing-plans': (context) => `请使用 writing-plans skill 为以下需求创建实施计划：

需求ID：${context.id}
需求类型：${context.type}
需求描述：${context.description}
${context.analysisResult ? `需求分析结果：\n${context.analysisResult}` : '需求分析已完成，请创建详细的实施计划。'}

请创建详细的实施计划，包括步骤分解、依赖关系和验收标准。`,

  research: (context) => `请研究以下技术问题：

问题：${context.description}
需求ID：${context.id || 'N/A'}
${context.researchScope ? `研究范围：${context.researchScope}` : ''}

请提供详细的分析和建议，包括相关技术选项和最佳实践。`,

  'code-explorer': (context) => `请使用 code-explorer skill 探索以下代码：

目标：${context.description}
需求ID：${context.id || 'N/A'}
${context.targetPath ? `目标路径：${context.targetPath}` : ''}

请分析代码结构、依赖关系和可能的改进点。`,
};

/**
 * 执行模式配置
 */
const EXECUTION_MODES = {
  fully: {
    description: '全自动执行',
    requiresCheckpoints: false,
    autoContinue: true,
  },
  semi: {
    description: '半自动执行',
    requiresCheckpoints: true,
    autoContinue: false,
  },
  manual: {
    description: '手动执行',
    requiresCheckpoints: true,
    autoContinue: false,
  },
};

/**
 * Scheduler 类
 */
class Scheduler {
  /**
   * 构造函数
   * @param {string} baseDir - 基础目录路径
   */
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.promptTemplates = new Map();
    this.executionModes = new Map();
    this.setupTemplates();
    this.setupModes();
    this.initializeSkillInterface();
  }

  /**
   * 初始化技能接口和适配器
   */
  initializeSkillInterface() {
    this.skillInterface = new SkillInterface(this.baseDir, {
      enableFallback: true,
      fallbackMode: 'template',
      cacheStatus: true,
    });
    this.adapters = AdapterFactory.createAllAdapters(this.baseDir);
  }

  /**
   * 初始化提示词模板
   */
  setupTemplates() {
    for (const [skill, template] of Object.entries(PROMPT_TEMPLATES)) {
      this.promptTemplates.set(skill, template);
    }
  }

  /**
   * 初始化执行模式
   */
  setupModes() {
    for (const [mode, config] of Object.entries(EXECUTION_MODES)) {
      this.executionModes.set(mode, { ...config });
    }
  }

  /**
   * 生成执行计划
   * @param {object} requirement - 需求对象
   * @param {string} requirement.type - 需求类型
   * @param {string} requirement.id - 需求ID
   * @param {string} requirement.mode - 执行模式 (fully/semi/manual)
   * @param {string} requirement.description - 需求描述
   * @returns {object} 执行计划对象
   */
  schedule(requirement) {
    const { type, id, mode = 'semi', description } = requirement;

    // 验证需求类型
    const route = getRoute(type);
    if (!route) {
      throw new Error(`不支持的需求类型: ${type}`);
    }

    // 验证执行模式
    const modeConfig = this.executionModes.get(mode);
    if (!modeConfig) {
      throw new Error(`不支持的执行模式: ${mode}`);
    }

    // 获取 skill 调用链
    const skillChain = getSkillChain(type);

    // 获取阶段列表
    const phases = getPhases(type);

    // 生成执行步骤
    const steps = this.generateSteps(type, id, phases, skillChain, description);

    // 生成检查点（如果需要）
    const checkpoints = modeConfig.requiresCheckpoints ? this.generateCheckpoints(steps) : [];

    return {
      requirementId: id,
      type,
      mode,
      modeDescription: modeConfig.description,
      autoContinue: modeConfig.autoContinue,
      steps,
      checkpoints,
      metadata: {
        primarySkill: route.primarySkill,
        optionalSkills: route.optionalSkills || [],
        totalSteps: steps.length,
        totalCheckpoints: checkpoints.length,
      },
    };
  }

  /**
   * 生成执行步骤
   * @param {string} type - 需求类型
   * @param {string} id - 需求ID
   * @param {string[]} phases - 阶段列表
   * @param {string[]} skillChain - skill 调用链
   * @param {string} description - 需求描述
   * @returns {Array} 步骤数组
   */
  generateSteps(type, id, phases, skillChain, description) {
    const steps = [];
    let stepIndex = 1;

    // 为每个 skill 生成步骤
    for (let i = 0; i < skillChain.length; i++) {
      const skill = skillChain[i];
      const isPrimary = i === 0;

      // 确定步骤对应的阶段
      const phaseIndex = Math.min(i, phases.length - 1);
      const phase = phases[phaseIndex];

      // 确定是否必需
      const required = isPrimary;

      steps.push({
        step: stepIndex++,
        phase,
        skill,
        action: this.getSkillAction(skill),
        required,
        description: this.getStepDescription(skill, phase, description),
      });
    }

    return steps;
  }

  /**
   * 生成检查点
   * @param {Array} steps - 步骤数组
   * @returns {Array} 检查点数组
   */
  generateCheckpoints(steps) {
    const checkpoints = [];

    // 在每个必需步骤后添加检查点
    for (const step of steps) {
      if (step.required) {
        checkpoints.push({
          afterStep: step.step,
          description: `完成 ${step.skill} (${step.phase} 阶段) 后确认`,
          requiresConfirmation: true,
        });
      }
    }

    return checkpoints;
  }

  /**
   * 获取 skill 的操作类型
   * @param {string} skill - skill 名称
   * @returns {string} 操作类型
   */
  getSkillAction(skill) {
    const actionMap = {
      brainstorming: 'analyze',
      'systematic-debugging': 'investigate',
      'writing-plans': 'plan',
      research: 'research',
      'code-explorer': 'explore',
    };
    return actionMap[skill] || 'execute';
  }

  /**
   * 获取步骤描述
   * @param {string} skill - skill 名称
   * @param {string} phase - 阶段名称
   * @param {string} description - 需求描述
   * @returns {string} 步骤描述
   */
  getStepDescription(skill, phase, description) {
    const action = this.getSkillAction(skill);
    const skillActionMap = {
      analyze: '分析',
      investigate: '调查',
      plan: '规划',
      research: '研究',
      explore: '探索',
    };
    const actionText = skillActionMap[action] || '执行';

    return `${actionText}${phase === 'analysis' ? '' : ' ' + phase}阶段：${description}`;
  }

  /**
   * 生成 skill 调用提示词
   * @param {string} skill - skill 名称
   * @param {object} context - 上下文对象
   * @returns {string} 提示词
   */
  generateSkillPrompt(skill, context) {
    const template = this.promptTemplates.get(skill);
    if (!template) {
      // 如果没有特定模板，返回通用提示词
      return this.generateGenericPrompt(skill, context);
    }
    return template(context);
  }

  /**
   * 生成通用提示词
   * @param {string} skill - skill 名称
   * @param {object} context - 上下文对象
   * @returns {string} 提示词
   */
  generateGenericPrompt(skill, context) {
    const { description, type, id } = context;
    return `请使用 ${skill} skill 处理以下需求：

需求ID：${id || 'N/A'}
需求类型：${type}
需求描述：${description}

请按照 ${skill} 的标准流程执行。`;
  }

  /**
   * 通过适配器执行技能
   * @param {string} skillName - 技能名称
   * @param {object} params - 参数对象
   * @returns {Promise<object>} 执行结果
   */
  async executeSkill(skillName, params = {}) {
    try {
      // 获取对应的适配器
      const adapter = this.adapters.get(skillName);

      if (!adapter) {
        // 如果没有适配器，使用 SkillInterface
        return await this.skillInterface.callSkill(skillName, params);
      }

      // 使用适配器执行
      const result = await adapter.execute(params);

      return {
        success: true,
        skill: skillName,
        result,
        adapter: true,
      };
    } catch (error) {
      // 降级到 SkillInterface
      return await this.skillInterface.callSkill(skillName, params, {}, error);
    }
  }

  /**
   * 获取技能健康摘要
   * @returns {Promise<object>} 健康摘要
   */
  async getHealthSummary() {
    const health = await this.skillInterface.getAllSkillsHealth();

    const summary = {
      total: health.size,
      available: 0,
      missing: 0,
      details: {},
    };

    for (const [name, status] of health.entries()) {
      summary.details[name] = {
        available: status.available,
        version: status.version,
        error: status.error,
      };

      if (status.available) {
        summary.available++;
      } else {
        summary.missing++;
      }
    }

    return summary;
  }

  /**
   * 检查技能链健康状态
   * @param {string[]} skillChain - 技能链
   * @returns {Promise<object>} 健康检查结果
   */
  async checkSkillsHealth(skillChain) {
    const results = {
      allAvailable: true,
      skills: {},
      summary: {
        total: skillChain.length,
        available: 0,
        missing: 0,
      },
    };

    for (const skillName of skillChain) {
      const health = await this.skillInterface.checkSkillHealth(skillName);

      results.skills[skillName] = health;

      if (health.available) {
        results.summary.available++;
      } else {
        results.summary.missing++;
        results.allAvailable = false;
      }
    }

    return results;
  }

  /**
   * 获取支持的 skill 列表
   * @returns {string[]} skill 名称数组
   */
  getSupportedSkills() {
    return Array.from(this.promptTemplates.keys());
  }

  /**
   * 获取支持的执行模式
   * @returns {string[]} 执行模式数组
   */
  getSupportedModes() {
    return Array.from(this.executionModes.keys());
  }

  /**
   * 添加自定义提示词模板
   * @param {string} skill - skill 名称
   * @param {function} template - 模板函数
   */
  addPromptTemplate(skill, template) {
    if (typeof template !== 'function') {
      throw new Error('模板必须是一个函数');
    }
    this.promptTemplates.set(skill, template);
  }

  /**
   * 获取执行模式配置
   * @param {string} mode - 执行模式
   * @returns {object|null} 模式配置
   */
  getModeConfig(mode) {
    const config = this.executionModes.get(mode);
    return config ? { ...config } : null;
  }

  /**
   * 设置降级模式
   * @param {string} mode - 降级模式 (template/manual/simulation/error)
   */
  setFallbackMode(mode) {
    this.skillInterface.setFallbackMode(mode);
  }

  /**
   * 启用/禁用降级
   * @param {boolean} enabled - 是否启用
   */
  setFallbackEnabled(enabled) {
    this.skillInterface.setFallbackEnabled(enabled);
  }

  /**
   * 清除技能状态缓存
   */
  clearSkillCache() {
    this.skillInterface.clearCache();
  }
}

// 创建单例实例（延迟初始化）
let schedulerInstance = null;

/**
 * 获取或创建 Scheduler 实例
 * @param {string} baseDir - 基础目录路径
 * @returns {Scheduler} Scheduler 实例
 */
function getScheduler(baseDir) {
  if (!schedulerInstance || schedulerInstance.baseDir !== baseDir) {
    schedulerInstance = new Scheduler(baseDir);
  }
  return schedulerInstance;
}

/**
 * 导出便捷函数
 */

/**
 * 生成执行计划
 * @param {object} requirement - 需求对象
 * @param {string} baseDir - 基础目录路径
 * @returns {object} 执行计划
 */
export function schedule(requirement, baseDir) {
  const scheduler = getScheduler(baseDir);
  return scheduler.schedule(requirement);
}

/**
 * 生成 skill 调用提示词
 * @param {string} skill - skill 名称
 * @param {object} context - 上下文对象
 * @param {string} baseDir - 基础目录路径
 * @returns {string} 提示词
 */
export function generateSkillPrompt(skill, context, baseDir) {
  const scheduler = getScheduler(baseDir);
  return scheduler.generateSkillPrompt(skill, context);
}

/**
 * 执行技能
 * @param {string} skillName - 技能名称
 * @param {object} params - 参数对象
 * @param {string} baseDir - 基础目录路径
 * @returns {Promise<object>} 执行结果
 */
export async function executeSkill(skillName, params, baseDir) {
  const scheduler = getScheduler(baseDir);
  return await scheduler.executeSkill(skillName, params);
}

/**
 * 获取支持的 skill 列表
 * @returns {string[]}
 */
export function getSupportedSkills() {
  return Object.keys(PROMPT_TEMPLATES);
}

/**
 * 获取支持的执行模式
 * @returns {string[]}
 */
export function getSupportedModes() {
  return Object.keys(EXECUTION_MODES);
}

/**
 * 添加自定义提示词模板
 * @param {string} skill - skill 名称
 * @param {function} template - 模板函数
 * @param {string} baseDir - 基础目录路径
 */
export function addPromptTemplate(skill, template, baseDir) {
  const scheduler = getScheduler(baseDir);
  scheduler.addPromptTemplate(skill, template);
}

/**
 * 获取执行模式配置
 * @param {string} mode - 执行模式
 * @returns {object|null}
 */
export function getModeConfig(mode) {
  const modes = EXECUTION_MODES;
  return modes[mode] ? { ...modes[mode] } : null;
}

// 导出类和默认实例工厂
export { Scheduler, getScheduler };
export default getScheduler;
