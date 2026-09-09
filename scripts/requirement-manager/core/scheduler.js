/**
 * 阶段调度器 - 只管执行模式与阶段顺序
 *
 * 职责：把 router 的类型路由（skill 链 + 阶段列表）展开为带检查点的执行计划。
 * skill 本身由宿主（ZCode skills 体系）直接编排，本模块不再生成或执行提示词。
 */

import { getRoute, getSkillChain, getPhases } from './router.js';

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
 * skill → 动作词表（用于步骤描述）
 */
const SKILL_ACTIONS = {
  brainstorming: '分析',
  'systematic-debugging': '调查',
  'writing-plans': '规划',
  research: '研究',
  'code-explorer': '探索',
};

/**
 * Scheduler 类
 */
class Scheduler {
  /**
   * 构造函数
   * @param {string} baseDir - 基础目录路径（保留以兼容既有调用约定）
   */
  constructor(baseDir) {
    this.baseDir = baseDir;
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
    const modeConfig = EXECUTION_MODES[mode];
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
   * 获取步骤描述
   * @param {string} skill - skill 名称
   * @param {string} phase - 阶段名称
   * @param {string} description - 需求描述
   * @returns {string} 步骤描述
   */
  getStepDescription(skill, phase, description) {
    const actionText = SKILL_ACTIONS[skill] || '执行';
    return `${actionText}${phase === 'analysis' ? '' : ' ' + phase}阶段：${description}`;
  }

  /**
   * 生成 skill 调用提示词（通用一句话模板；skill 由宿主编排，这里只给上下文）
   * @param {string} skill - skill 名称
   * @param {object} context - 上下文对象
   * @returns {string} 提示词
   */
  generateSkillPrompt(skill, context) {
    const { description, type, id } = context;
    return `请使用 ${skill} skill 处理以下需求：

需求ID：${id || 'N/A'}
需求类型：${type}
需求描述：${description}

请按照 ${skill} 的标准流程执行。`;
  }

  /**
   * 获取支持的 skill 列表
   * @returns {string[]} skill 名称数组
   */
  getSupportedSkills() {
    const skills = new Set();
    for (const type of ['feature', 'bug', 'question', 'adjustment', 'refactor']) {
      const route = getRoute(type);
      if (route) {
        skills.add(route.primarySkill);
        for (const optional of route.optionalSkills || []) {
          skills.add(optional);
        }
      }
    }
    return Array.from(skills);
  }

  /**
   * 获取支持的执行模式
   * @returns {string[]} 执行模式数组
   */
  getSupportedModes() {
    return Object.keys(EXECUTION_MODES);
  }

  /**
   * 获取执行模式配置
   * @param {string} mode - 执行模式
   * @returns {object|null} 模式配置
   */
  getModeConfig(mode) {
    const config = EXECUTION_MODES[mode];
    return config ? { ...config } : null;
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
 * 获取支持的 skill 列表
 * @returns {string[]}
 */
export function getSupportedSkills() {
  return getScheduler().getSupportedSkills();
}

/**
 * 获取支持的执行模式
 * @returns {string[]}
 */
export function getSupportedModes() {
  return Object.keys(EXECUTION_MODES);
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
export { Scheduler, getScheduler, EXECUTION_MODES };
export default getScheduler;
