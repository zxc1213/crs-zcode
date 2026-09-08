/**
 * 技能适配器索引
 * 导出所有适配器并提供工厂方法
 */

import { BaseSkillAdapter } from './base.js';
import { BrainstormingAdapter } from './brainstorming.js';
import { DebuggingAdapter } from './debugging.js';
import { ResearchAdapter } from './research.js';
import { CodeExplorerAdapter } from './code-explorer.js';
import { PlanningAdapter } from './planning.js';

/**
 * 适配器映射表
 * 技能名称到适配器类的映射
 */
const ADAPTER_MAP = {
  brainstorming: BrainstormingAdapter,
  'systematic-debugging': DebuggingAdapter,
  research: ResearchAdapter,
  'code-explorer': CodeExplorerAdapter,
  'writing-plans': PlanningAdapter,
};

/**
 * 适配器工厂类
 */
export class AdapterFactory {
  /**
   * 创建适配器实例
   * @param {string} skillName - 技能名称
   * @param {string} baseDir - 基础目录
   * @param {object} config - 配置选项
   * @returns {BaseSkillAdapter} 适配器实例
   */
  static createAdapter(skillName, baseDir, config = {}) {
    const AdapterClass = ADAPTER_MAP[skillName];
    if (!AdapterClass) {
      throw new Error(`No adapter found for skill: ${skillName}`);
    }
    return new AdapterClass(baseDir, config);
  }

  /**
   * 获取所有支持的技能名称
   * @returns {string[]} 技能名称列表
   */
  static getSupportedSkills() {
    return Object.keys(ADAPTER_MAP);
  }

  /**
   * 检查技能是否支持
   * @param {string} skillName - 技能名称
   * @returns {boolean} 是否支持
   */
  static isSupported(skillName) {
    return skillName in ADAPTER_MAP;
  }

  /**
   * 批量创建适配器
   * @param {string[]} skillNames - 技能名称列表
   * @param {string} baseDir - 基础目录
   * @param {object} config - 配置选项
   * @returns {Map<string, BaseSkillAdapter>} 适配器实例映射
   */
  static createAdapters(skillNames, baseDir, config = {}) {
    const adapters = new Map();
    for (const skillName of skillNames) {
      try {
        const adapter = this.createAdapter(skillName, baseDir, config);
        adapters.set(skillName, adapter);
      } catch (_error) {
        // 跳过不支持的技能
      }
    }
    return adapters;
  }

  /**
   * 创建所有适配器
   * @param {string} baseDir - 基础目录
   * @param {object} config - 配置选项
   * @returns {Map<string, BaseSkillAdapter>} 所有适配器实例
   */
  static createAllAdapters(baseDir, config = {}) {
    return this.createAdapters(this.getSupportedSkills(), baseDir, config);
  }
}

// 导出所有适配器
export { BaseSkillAdapter, BrainstormingAdapter, DebuggingAdapter, ResearchAdapter, CodeExplorerAdapter, PlanningAdapter };

export default {
  BaseSkillAdapter,
  BrainstormingAdapter,
  DebuggingAdapter,
  ResearchAdapter,
  CodeExplorerAdapter,
  PlanningAdapter,
  AdapterFactory,
  ADAPTER_MAP,
};
