/**
 * 技能健康检查模块
 * 检查 Superpowers 技能的可用性和版本
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * 依赖的技能列表
 */
const DEPENDENT_SKILLS = [
  {
    name: 'brainstorming',
    displayName: 'Brainstorming',
    description: '深度问题探索和方案生成',
    category: 'analysis',
  },
  {
    name: 'systematic-debugging',
    displayName: 'Systematic Debugging',
    description: '系统化调试和问题诊断',
    category: 'debugging',
  },
  {
    name: 'research',
    displayName: 'Research',
    description: '信息收集和研究分析',
    category: 'research',
  },
  {
    name: 'code-explorer',
    displayName: 'Code Explorer',
    description: '代码库探索和理解',
    category: 'exploration',
  },
  {
    name: 'writing-plans',
    displayName: 'Writing Plans',
    description: '实施计划和任务分解',
    category: 'planning',
  },
];

/**
 * 技能健康检查器类
 */
export class SkillsHealthChecker {
  /**
   * 构造函数
   * @param {string} baseDir - 基础目录
   */
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.skillsDir = path.join(baseDir, '.zcode', 'skills');
    this.results = new Map();
  }

  /**
   * 检查所有技能
   * @returns {Promise<Map>} 技能检查结果
   */
  async checkAllSkills() {
    const results = new Map();

    for (const skill of DEPENDENT_SKILLS) {
      const result = await this.checkSkill(skill);
      results.set(skill.name, result);
    }

    this.results = results;
    return results;
  }

  /**
   * 检查单个技能
   * @param {object} skill - 技能信息
   * @returns {Promise<object>} 检查结果
   */
  async checkSkill(skill) {
    const result = {
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      category: skill.category,
      available: false,
      version: null,
      location: null,
      error: null,
    };

    try {
      // 检查技能目录
      const skillPath = path.join(this.skillsDir, skill.name);
      const stat = await fs.stat(skillPath).catch(() => null);

      if (stat && stat.isDirectory()) {
        result.available = true;
        result.location = skillPath;

        // 尝试读取版本信息
        const packagePath = path.join(skillPath, 'package.json');
        const packageData = await fs.readFile(packagePath, 'utf-8').catch(() => null);

        if (packageData) {
          try {
            const pkg = JSON.parse(packageData);
            result.version = pkg.version || 'unknown';
          } catch (_error) {
            result.version = 'unknown';
          }
        }

        // 检查技能文件
        const skillFile = path.join(skillPath, 'skill.md');
        const skillExists = await fs
          .access(skillFile)
          .then(() => true)
          .catch(() => false);
        result.hasSkillFile = skillExists;
      } else {
        result.error = 'Skill directory not found';
      }
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * 获取技能版本
   * @param {string} skillName - 技能名称
   * @returns {Promise<string|null>} 版本号
   */
  async getSkillVersion(skillName) {
    const skill = DEPENDENT_SKILLS.find((s) => s.name === skillName);
    if (!skill) {
      return null;
    }

    const result = await this.checkSkill(skill);
    return result.version;
  }

  /**
   * 显示健康检查报告
   * @param {Map} results - 检查结果
   * @returns {string} 格式化的报告
   */
  displayReport(results) {
    const lines = [];

    lines.push('🔍 技能健康检查报告');
    lines.push('='.repeat(50));
    lines.push('');

    // 统计信息
    const total = results.size;
    const available = Array.from(results.values()).filter((r) => r.available).length;
    const missing = total - available;

    lines.push(`总计: ${total} 个技能`);
    lines.push(`✅ 可用: ${available} 个`);
    lines.push(`❌ 缺失: ${missing} 个`);
    lines.push('');

    // 按类别分组
    const byCategory = this.groupByCategory(results);

    for (const [category, skills] of Object.entries(byCategory)) {
      lines.push(`${this.getCategoryIcon(category)} ${category.toUpperCase()}`);
      lines.push('-'.repeat(40));

      for (const skill of skills) {
        const status = skill.available ? '✅' : '❌';
        const version = skill.version ? ` (v${skill.version})` : '';
        lines.push(`  ${status} ${skill.displayName}${version}`);

        if (!skill.available && skill.error) {
          lines.push(`      ⚠️  ${skill.error}`);
        }

        if (skill.available && !skill.hasSkillFile) {
          lines.push(`      ⚠️  缺少 skill.md 文件`);
        }
      }

      lines.push('');
    }

    // 总结和建议
    if (missing > 0) {
      lines.push('📋 建议操作:');
      lines.push('');

      for (const [, result] of results.entries()) {
        if (!result.available) {
          const hint = this.getInstallHint(result);
          lines.push(`  ${result.displayName}:`);
          lines.push(`    ${hint}`);
          lines.push('');
        }
      }

      lines.push('💡 提示: 技能缺失时，系统会自动使用降级模式');
    } else {
      lines.push('🎉 所有技能都已正确安装！');
    }

    return lines.join('\n');
  }

  /**
   * 按类别分组技能
   * @param {Map} results - 检查结果
   * @returns {object} 分组结果
   */
  groupByCategory(results) {
    const grouped = {};

    for (const result of results.values()) {
      const category = result.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(result);
    }

    return grouped;
  }

  /**
   * 获取类别图标
   * @param {string} category - 类别名称
   * @returns {string} 图标
   */
  getCategoryIcon(category) {
    const icons = {
      analysis: '🧠',
      debugging: '🐛',
      research: '📚',
      exploration: '🔍',
      planning: '📋',
      other: '📦',
    };
    return icons[category] || icons.other;
  }

  /**
   * 获取安装提示
   * @param {object} result - 检查结果
   * @returns {string} 安装提示
   */
  getInstallHint(result) {
    return `从 Superpowers 仓库安装 ${result.name} 技能`;
  }

  /**
   * 获取简要摘要
   * @returns {Promise<string>} 简要摘要
   */
  async getSummary() {
    const results = await this.checkAllSkills();
    const available = Array.from(results.values()).filter((r) => r.available).length;
    const total = results.size;

    if (available === total) {
      return '✅ 所有技能可用';
    } else if (available === 0) {
      return '❌ 所有技能缺失';
    } else {
      return `⚠️  ${available}/${total} 个技能可用`;
    }
  }

  /**
   * 生成 JSON 报告
   * @param {Map} results - 检查结果
   * @returns {object} JSON 报告
   */
  generateJsonReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.size,
        available: 0,
        missing: 0,
      },
      skills: {},
    };

    for (const [name, result] of results.entries()) {
      report.skills[name] = {
        displayName: result.displayName,
        description: result.description,
        available: result.available,
        version: result.version,
        category: result.category,
      };

      if (result.available) {
        report.summary.available++;
      } else {
        report.summary.missing++;
      }
    }

    return report;
  }
}

/**
 * 快速检查所有技能
 * @param {string} baseDir - 基础目录
 * @returns {Promise<string>} 简要摘要
 */
export async function quickCheck(baseDir) {
  const checker = new SkillsHealthChecker(baseDir);
  return await checker.getSummary();
}

/**
 * 完整健康检查
 * @param {string} baseDir - 基础目录
 * @returns {Promise<string>} 完整报告
 */
export async function fullCheck(baseDir) {
  const checker = new SkillsHealthChecker(baseDir);
  const results = await checker.checkAllSkills();
  return checker.displayReport(results);
}

export default {
  SkillsHealthChecker,
  DEPENDENT_SKILLS,
  quickCheck,
  fullCheck,
};
