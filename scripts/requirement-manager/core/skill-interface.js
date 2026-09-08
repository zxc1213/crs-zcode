/**
 * 技能接口抽象层
 * 统一 Superpowers 技能调用接口，提供版本管理、健康检查和降级策略
 */

import { SkillsHealthChecker } from '../utils/skills-health.js';

const DEFAULT_CONFIG = {
  timeout: 30000,
  enableFallback: true,
  fallbackMode: 'template',
  cacheStatus: true,
  cacheTime: 60000,
};

export class SkillInterface {
  constructor(baseDir, config = {}) {
    this.baseDir = baseDir;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.healthChecker = new SkillsHealthChecker(baseDir);
    this.statusCache = new Map();
    this.cacheTimestamp = null;
  }

  async callSkill(skillName, params = {}, _options = {}) {
    const startTime = Date.now();
    try {
      const health = await this.checkSkillHealth(skillName);
      if (!health.available) {
        return await this.handleFallback(skillName, params, health);
      }
      const result = await this.executeSkill(skillName, params);
      return {
        success: true,
        skill: skillName,
        result,
        fallback: false,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      if (this.config.enableFallback) {
        return await this.handleFallback(skillName, params, null, error);
      }
      throw error;
    }
  }

  async executeSkill(skillName, params) {
    return { skill: skillName, params, executable: true };
  }

  async checkSkillHealth(skillName) {
    if (this.config.cacheStatus && this.isCacheValid()) {
      const cached = this.statusCache.get(skillName);
      if (cached) return cached;
    }
    const skills = await this.healthChecker.checkAllSkills();
    const health = skills.get(skillName);
    if (this.config.cacheStatus) {
      this.statusCache.set(skillName, health);
      this.cacheTimestamp = Date.now();
    }
    return health || { available: false, error: 'Skill not found' };
  }

  isCacheValid() {
    if (!this.cacheTimestamp) return false;
    return Date.now() - this.cacheTimestamp < this.config.cacheTime;
  }

  async handleFallback(skillName, params, health = null, error = null) {
    const mode = this.config.fallbackMode;
    switch (mode) {
      case 'template':
        return this.getTemplateResult(skillName, params);
      case 'manual':
        return this.getManualGuidance(skillName, params, health);
      case 'simulation':
        return this.getSimulationResult(skillName, params);
      case 'error':
      default: {
        const errorMsg = health?.error || error?.message || 'Unknown error';
        throw new Error(`Skill '${skillName}' is not available: ${errorMsg}`);
      }
    }
  }

  getTemplateResult(skillName) {
    const templates = {
      brainstorming: {
        type: 'brainstorming-template',
        message: '使用基础头脑风暴模板',
        questions: ['问题是什么？', '有哪些可能的解决方案？', '各方案的优缺点是什么？'],
      },
      'systematic-debugging': {
        type: 'debugging-template',
        message: '使用系统化调试模板',
        steps: ['1. 描述问题', '2. 收集信息', '3. 分析可能原因', '4. 验证假设', '5. 实施解决方案'],
      },
      research: {
        type: 'research-template',
        message: '使用基础研究模板',
        questions: ['需要研究什么主题？', '已知信息有哪些？', '需要查找哪些信息？'],
      },
      'code-explorer': {
        type: 'exploration-template',
        message: '使用代码探索模板',
        questions: ['需要探索哪个文件或模块？', '想了解什么信息？'],
      },
      'writing-plans': {
        type: 'planning-template',
        message: '使用基础计划模板',
        sections: ['目标', '任务列表', '时间估算', '依赖关系', '风险'],
      },
    };
    const template = templates[skillName] || { type: 'generic-template', message: '使用通用模板' };
    return {
      success: true,
      skill: skillName,
      fallback: true,
      fallbackMode: 'template',
      result: template,
    };
  }

  getManualGuidance(skillName, _params, health) {
    return {
      success: false,
      skill: skillName,
      fallback: true,
      fallbackMode: 'manual',
      result: {
        message: `技能 '${skillName}' 不可用`,
        error: health?.error || 'Unknown error',
        guidance: ['1. 运行 claude-req-skill-health 检查技能状态', '2. 安装缺失的 Superpowers 技能', '3. 或使用 --fallback=template 启用降级模式'],
      },
    };
  }

  getSimulationResult(skillName) {
    return {
      success: true,
      skill: skillName,
      fallback: true,
      fallbackMode: 'simulation',
      result: {
        message: `使用技能 '${skillName}' 的模拟模式`,
        note: '这是模拟结果，不是实际技能执行',
        simulatedOutput: { timestamp: new Date().toISOString() },
      },
    };
  }

  async getAllSkillsHealth() {
    return await this.healthChecker.checkAllSkills();
  }

  clearCache() {
    this.statusCache.clear();
    this.cacheTimestamp = null;
  }

  setFallbackMode(mode) {
    const validModes = ['template', 'manual', 'simulation', 'error'];
    if (!validModes.includes(mode)) {
      throw new Error(`Invalid fallback mode: ${mode}`);
    }
    this.config.fallbackMode = mode;
  }

  setFallbackEnabled(enabled) {
    this.config.enableFallback = enabled;
  }
}

export function createSkillInterface(baseDir, config) {
  return new SkillInterface(baseDir, config);
}

export default { SkillInterface, createSkillInterface, DEFAULT_CONFIG };
