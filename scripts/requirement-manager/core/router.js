/**
 * 类型路由器 - 管理不同需求类型的路由配置
 */

/**
 * 降级模式枚举
 */
const FALLBACK_MODES = {
  TEMPLATE: 'template',
  MANUAL: 'manual',
  SIMULATION: 'simulation',
  ERROR: 'error',
};

/**
 * 路由配置
 * 每种需求类型都有对应的 primarySkill、optionalSkills、phases 和 fallback 配置
 */
const ROUTES = {
  feature: {
    primarySkill: 'brainstorming',
    optionalSkills: ['writing-plans'],
    phases: ['analysis', 'planning', 'implementation', 'testing'],
    fallback: {
      enabled: true,
      defaultMode: 'template',
      allowOverride: true,
      skills: {
        brainstorming: 'template',
        'writing-plans': 'template',
      },
    },
  },
  bug: {
    primarySkill: 'systematic-debugging',
    optionalSkills: ['writing-plans'],
    phases: ['investigation', 'diagnosis', 'fix', 'verification'],
    fallback: {
      enabled: true,
      defaultMode: 'template',
      allowOverride: true,
      skills: {
        'systematic-debugging': 'template',
        'writing-plans': 'template',
      },
    },
  },
  question: {
    primarySkill: 'research',
    optionalSkills: [],
    phases: ['research', 'analysis', 'answer'],
    fallback: {
      enabled: true,
      defaultMode: 'template',
      allowOverride: true,
      skills: {
        research: 'template',
      },
    },
  },
  adjustment: {
    primarySkill: 'brainstorming',
    optionalSkills: ['writing-plans'],
    phases: ['review', 'analysis', 'planning', 'implementation'],
    fallback: {
      enabled: true,
      defaultMode: 'template',
      allowOverride: true,
      skills: {
        brainstorming: 'template',
        'writing-plans': 'template',
      },
    },
  },
  refactor: {
    primarySkill: 'code-explorer',
    optionalSkills: ['writing-plans'],
    phases: ['exploration', 'planning', 'refactoring', 'testing'],
    fallback: {
      enabled: true,
      defaultMode: 'template',
      allowOverride: true,
      skills: {
        'code-explorer': 'template',
        'writing-plans': 'template',
      },
    },
  },
};

/**
 * TypeRouter 类
 */
class TypeRouter {
  /**
   * 构造函数
   */
  constructor() {
    this.routes = new Map();
    this.setupRoutes();
  }

  /**
   * 初始化路由配置
   */
  setupRoutes() {
    for (const [type, config] of Object.entries(ROUTES)) {
      this.routes.set(type, { ...config });
    }
  }

  /**
   * 获取指定类型的路由配置
   * @param {string} type - 需求类型 (feature/bug/question/adjustment/refactor)
   * @returns {object|null} 路由配置对象，如果类型不存在则返回 null
   */
  getRoute(type) {
    const route = this.routes.get(type);
    if (!route) {
      return null;
    }
    // 返回副本以防止外部修改
    return { ...route };
  }

  /**
   * 获取指定类型的 skill 调用链
   * @param {string} type - 需求类型
   * @returns {string[]} skill 调用链数组，primarySkill 在前，optionalSkills 在后
   */
  getSkillChain(type) {
    const route = this.getRoute(type);
    if (!route) {
      return [];
    }

    const chain = [];
    if (route.primarySkill) {
      chain.push(route.primarySkill);
    }
    if (route.optionalSkills && route.optionalSkills.length > 0) {
      chain.push(...route.optionalSkills);
    }

    return chain;
  }

  /**
   * 获取下一阶段
   * @param {string} type - 需求类型
   * @param {string} currentPhase - 当前阶段
   * @returns {string|null} 下一阶段名称，如果当前阶段是最后一个则返回 null
   */
  getNextPhase(type, currentPhase) {
    const route = this.getRoute(type);
    if (!route || !route.phases) {
      return null;
    }

    const currentIndex = route.phases.indexOf(currentPhase);
    if (currentIndex === -1) {
      // 当前阶段不在 phases 列表中，返回第一个阶段
      return route.phases[0];
    }

    if (currentIndex >= route.phases.length - 1) {
      // 已经是最后一个阶段
      return null;
    }

    return route.phases[currentIndex + 1];
  }

  /**
   * 获取所有支持的需求类型
   * @returns {string[]} 需求类型数组
   */
  getSupportedTypes() {
    return Array.from(this.routes.keys());
  }

  /**
   * 检查类型是否支持
   * @param {string} type - 需求类型
   * @returns {boolean} 是否支持该类型
   */
  isTypeSupported(type) {
    return this.routes.has(type);
  }

  /**
   * 获取指定类型的所有阶段
   * @param {string} type - 需求类型
   * @returns {string[]} 阶段数组
   */
  getPhases(type) {
    const route = this.getRoute(type);
    if (!route || !route.phases) {
      return [];
    }
    return [...route.phases];
  }

  /**
   * 获取指定类型的主要 skill
   * @param {string} type - 需求类型
   * @returns {string|null} 主要 skill 名称
   */
  getPrimarySkill(type) {
    const route = this.getRoute(type);
    if (!route) {
      return null;
    }
    return route.primarySkill || null;
  }

  /**
   * 获取指定类型的可选 skills
   * @param {string} type - 需求类型
   * @returns {string[]} 可选 skill 名称数组
   */
  getOptionalSkills(type) {
    const route = this.getRoute(type);
    if (!route || !route.optionalSkills) {
      return [];
    }
    return [...route.optionalSkills];
  }

  /**
   * 获取指定类型的降级配置
   * @param {string} type - 需求类型
   * @returns {object|null} 降级配置对象
   */
  getFallbackConfig(type) {
    const route = this.getRoute(type);
    if (!route || !route.fallback) {
      return null;
    }
    return { ...route.fallback };
  }

  /**
   * 获取指定技能的降级模式
   * @param {string} type - 需求类型
   * @param {string} skillName - 技能名称
   * @returns {string|null} 降级模式
   */
  getSkillFallbackMode(type, skillName) {
    const fallback = this.getFallbackConfig(type);
    if (!fallback || !fallback.enabled) {
      return null;
    }

    // 首先检查技能特定的降级模式
    if (fallback.skills && fallback.skills[skillName]) {
      return fallback.skills[skillName];
    }

    // 返回默认降级模式
    return fallback.defaultMode || null;
  }

  /**
   * 检查降级是否启用
   * @param {string} type - 需求类型
   * @returns {boolean} 是否启用降级
   */
  isFallbackEnabled(type) {
    const fallback = this.getFallbackConfig(type);
    return fallback ? fallback.enabled : false;
  }

  /**
   * 检查是否允许覆盖降级模式
   * @param {string} type - 需求类型
   * @returns {boolean} 是否允许覆盖
   */
  isFallbackOverrideAllowed(type) {
    const fallback = this.getFallbackConfig(type);
    return fallback ? fallback.allowOverride : false;
  }

  /**
   * 设置指定类型的降级模式
   * @param {string} type - 需求类型
   * @param {string} mode - 降级模式
   * @returns {boolean} 是否设置成功
   */
  setFallbackMode(type, mode) {
    const validModes = Object.values(FALLBACK_MODES);
    if (!validModes.includes(mode)) {
      return false;
    }

    const route = this.routes.get(type);
    if (!route || !route.fallback) {
      return false;
    }

    route.fallback.defaultMode = mode;
    return true;
  }

  /**
   * 为特定技能设置降级模式
   * @param {string} type - 需求类型
   * @param {string} skillName - 技能名称
   * @param {string} mode - 降级模式
   * @returns {boolean} 是否设置成功
   */
  setSkillFallbackMode(type, skillName, mode) {
    const validModes = Object.values(FALLBACK_MODES);
    if (!validModes.includes(mode)) {
      return false;
    }

    const route = this.routes.get(type);
    if (!route || !route.fallback || !route.fallback.skills) {
      return false;
    }

    route.fallback.skills[skillName] = mode;
    return true;
  }

  /**
   * 启用或禁用降级
   * @param {string} type - 需求类型
   * @param {boolean} enabled - 是否启用
   * @returns {boolean} 是否设置成功
   */
  setFallbackEnabled(type, enabled) {
    const route = this.routes.get(type);
    if (!route || !route.fallback) {
      return false;
    }

    route.fallback.enabled = enabled;
    return true;
  }

  /**
   * 获取所有有效的降级模式
   * @returns {string[]} 降级模式数组
   */
  getValidFallbackModes() {
    return Object.values(FALLBACK_MODES);
  }
}

// 创建单例实例
const routerInstance = new TypeRouter();

/**
 * 导出便捷函数
 */

/**
 * 获取指定类型的路由配置
 * @param {string} type - 需求类型
 * @returns {object|null}
 */
export function getRoute(type) {
  return routerInstance.getRoute(type);
}

/**
 * 获取 skill 调用链
 * @param {string} type - 需求类型
 * @returns {string[]}
 */
export function getSkillChain(type) {
  return routerInstance.getSkillChain(type);
}

/**
 * 获取下一阶段
 * @param {string} type - 需求类型
 * @param {string} currentPhase - 当前阶段
 * @returns {string|null}
 */
export function getNextPhase(type, currentPhase) {
  return routerInstance.getNextPhase(type, currentPhase);
}

/**
 * 获取所有支持的需求类型
 * @returns {string[]}
 */
export function getSupportedTypes() {
  return routerInstance.getSupportedTypes();
}

/**
 * 检查类型是否支持
 * @param {string} type - 需求类型
 * @returns {boolean}
 */
export function isTypeSupported(type) {
  return routerInstance.isTypeSupported(type);
}

/**
 * 获取指定类型的所有阶段
 * @param {string} type - 需求类型
 * @returns {string[]}
 */
export function getPhases(type) {
  return routerInstance.getPhases(type);
}

/**
 * 获取指定类型的主要 skill
 * @param {string} type - 需求类型
 * @returns {string|null}
 */
export function getPrimarySkill(type) {
  return routerInstance.getPrimarySkill(type);
}

/**
 * 获取指定类型的可选 skills
 * @param {string} type - 需求类型
 * @returns {string[]}
 */
export function getOptionalSkills(type) {
  return routerInstance.getOptionalSkills(type);
}

/**
 * 获取降级配置
 * @param {string} type - 需求类型
 * @returns {object|null}
 */
export function getFallbackConfig(type) {
  return routerInstance.getFallbackConfig(type);
}

/**
 * 获取技能的降级模式
 * @param {string} type - 需求类型
 * @param {string} skillName - 技能名称
 * @returns {string|null}
 */
export function getSkillFallbackMode(type, skillName) {
  return routerInstance.getSkillFallbackMode(type, skillName);
}

/**
 * 检查降级是否启用
 * @param {string} type - 需求类型
 * @returns {boolean}
 */
export function isFallbackEnabled(type) {
  return routerInstance.isFallbackEnabled(type);
}

// 导出类和默认实例
export { TypeRouter, FALLBACK_MODES };
export default routerInstance;
