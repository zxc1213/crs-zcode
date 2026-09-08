/**
 * 技能适配器基类
 * 为所有 Superpowers 技能适配器提供通用接口和功能
 */

import { SkillInterface } from '../core/skill-interface.js';

/**
 * 适配器状态枚举
 */
export const AdapterStatus = {
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  FALLBACK: 'fallback',
  ERROR: 'error',
};

/**
 * 技能适配器基类
 */
export class BaseSkillAdapter {
  /**
   * 构造函数
   * @param {string} baseDir - 基础目录
   * @param {object} config - 配置选项
   */
  constructor(baseDir, config = {}) {
    this.baseDir = baseDir;
    this.config = config;
    this.skillInterface = new SkillInterface(baseDir, config);
    this.skillName = this.getSkillName();
    this.fallbackMode = false;
  }

  /**
   * 获取技能名称 (子类必须实现)
   * @returns {string} 技能名称
   */
  getSkillName() {
    throw new Error('Subclass must implement getSkillName()');
  }

  /**
   * 获取技能显示名称 (子类必须实现)
   * @returns {string} 技能显示名称
   */
  getDisplayName() {
    throw new Error('Subclass must implement getDisplayName()');
  }

  /**
   * 执行技能 (子类必须实现)
   * @param {object} params - 技能参数
   * @returns {Promise<object>} 执行结果
   */
  async execute(params) {
    throw new Error('Subclass must implement execute()');
  }

  /**
   * 检查技能是否可执行
   * @returns {Promise<boolean>} 是否可执行
   */
  async canExecute() {
    try {
      const health = await this.skillInterface.checkSkillHealth(this.skillName);
      return health.available;
    } catch (_error) {
      return false;
    }
  }

  /**
   * 获取适配器状态
   * @returns {Promise<string>} 适配器状态
   */
  async getStatus() {
    const canExec = await this.canExecute();
    if (this.fallbackMode) {
      return AdapterStatus.FALLBACK;
    }
    return canExec ? AdapterStatus.AVAILABLE : AdapterStatus.UNAVAILABLE;
  }

  /**
   * 获取降级结果
   * @param {object} params - 技能参数
   * @returns {Promise<object>} 降级结果
   */
  async getFallbackResult(params) {
    const result = await this.skillInterface.handleFallback(this.skillName, params, {
      available: false,
    });
    this.fallbackMode = true;
    return result;
  }

  /**
   * 重置降级模式
   */
  resetFallback() {
    this.fallbackMode = false;
  }

  /**
   * 获取技能模板
   * @returns {object} 技能模板
   */
  getTemplate() {
    const result = this.skillInterface.getTemplateResult(this.skillName);
    return result.result;
  }

  /**
   * 验证参数
   * @param {object} params - 技能参数
   * @returns {boolean} 参数是否有效
   */
  validateParams(params) {
    return params && typeof params === 'object';
  }

  /**
   * 预处理参数
   * @param {object} params - 原始参数
   * @returns {object} 处理后的参数
   */
  preprocessParams(params) {
    if (!params) {
      return {};
    }
    // 子类可以重写此方法进行特定的参数预处理
    return { ...params };
  }

  /**
   * 后处理结果
   * @param {object} result - 原始结果
   * @returns {object} 处理后的结果
   */
  postprocessResult(result) {
    // 子类可以重写此方法进行特定的结果后处理
    return result;
  }

  /**
   * 安全执行技能
   * @param {object} params - 技能参数
   * @returns {Promise<object>} 执行结果
   */
  async safeExecute(params) {
    try {
      // 验证参数
      if (!this.validateParams(params)) {
        throw new Error('Invalid parameters');
      }

      // 预处理参数
      const processedParams = this.preprocessParams(params);

      // 检查是否可执行
      if (!(await this.canExecute())) {
        return await this.getFallbackResult(processedParams);
      }

      // 执行技能
      const result = await this.execute(processedParams);

      // 后处理结果
      const finalResult = this.postprocessResult(result);

      return {
        success: true,
        skill: this.skillName,
        adapter: this.constructor.name,
        result: finalResult,
        fallback: false,
      };
    } catch (error) {
      // 执行失败，尝试降级
      if (this.config.enableFallback !== false) {
        return await this.getFallbackResult(params);
      }

      return {
        success: false,
        skill: this.skillName,
        adapter: this.constructor.name,
        error: error.message,
        fallback: false,
      };
    }
  }

  /**
   * 获取适配器信息
   * @returns {object} 适配器信息
   */
  getInfo() {
    return {
      name: this.skillName,
      displayName: this.getDisplayName(),
      adapter: this.constructor.name,
      fallbackMode: this.fallbackMode,
    };
  }
}

export default BaseSkillAdapter;
