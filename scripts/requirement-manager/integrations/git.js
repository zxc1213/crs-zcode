/**
 * Git 集成模块 - 为需求管理系统提供 Git 操作支持
 *
 * 功能：
 * - 检查 Git 仓库状态
 * - 创建特性分支
 * - 生成规范的 commit message
 * - 提交需求变更
 * - 获取当前分支信息
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Git 集成类
 */
export class GitIntegration {
  /**
   * 构造函数
   * @param {string} baseDir - 项目基础目录
   */
  constructor(baseDir) {
    this.baseDir = baseDir;
  }

  /**
   * 检查当前目录是否是 Git 仓库
   * @returns {Promise<boolean>}
   */
  async isGitRepo() {
    try {
      const { stdout } = await execAsync('git rev-parse --git-dir', {
        cwd: this.baseDir,
      });
      return stdout.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取当前分支名称
   * @returns {Promise<string|null>} 分支名称，如果不是 Git 仓库则返回 null
   */
  async getCurrentBranch() {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.baseDir,
      });
      return stdout.trim();
    } catch (error) {
      return null;
    }
  }

  /**
   * 创建特性分支
   * 分支命名规则：{type}/{id}-{shortTitle}
   * @param {string} id - 需求 ID（如 FEAT-0001）
   * @param {string} title - 需求标题
   * @returns {Promise<{success: boolean, branch: string, error?: string}>}
   */
  async createBranch(id, title) {
    try {
      // 检查是否是 Git 仓库
      const isRepo = await this.isGitRepo();
      if (!isRepo) {
        return {
          success: false,
          branch: '',
          error: '当前目录不是 Git 仓库',
        };
      }

      // 生成短标题（移除特殊字符，限制长度）
      const shortTitle = this.generateShortTitle(title);

      // 确定分支类型
      const type = this.getBranchTypeFromId(id);

      // 构造分支名
      const branchName = `${type}/${id}-${shortTitle}`;

      // 检查分支是否已存在
      const { stdout: existingBranch } = await execAsync(`git branch --list "${branchName}"`, {
        cwd: this.baseDir,
      });

      if (existingBranch.trim()) {
        return {
          success: false,
          branch: branchName,
          error: `分支 ${branchName} 已存在`,
        };
      }

      // 创建并切换到新分支
      await execAsync(`git checkout -b ${branchName}`, {
        cwd: this.baseDir,
      });

      return {
        success: true,
        branch: branchName,
      };
    } catch (error) {
      return {
        success: false,
        branch: '',
        error: error.message,
      };
    }
  }

  /**
   * 生成 commit message
   * 格式：[{shortId}] {type}: {message}
   * @param {string} id - 需求 ID（如 FEAT-0001）
   * @param {string} type - 提交类型（如 feat, fix, docs, refactor 等）
   * @param {string} message - 提交消息
   * @returns {string} 格式化的 commit message
   */
  generateCommitMessage(id, type, message) {
    // shortId 就是完整的 id（如 FEAT-0001）
    const shortId = id;
    return `[${shortId}] ${type}: ${message}`;
  }

  /**
   * 提交需求变更
   * @param {string} id - 需求 ID
   * @param {string} type - 提交类型
   * @param {string} message - 提交消息
   * @returns {Promise<{success: boolean, commit?: string, error?: string}>}
   */
  async commit(id, type, message) {
    try {
      // 检查是否是 Git 仓库
      const isRepo = await this.isGitRepo();
      if (!isRepo) {
        return {
          success: false,
          error: '当前目录不是 Git 仓库',
        };
      }

      // 生成 commit message
      const commitMessage = this.generateCommitMessage(id, type, message);

      // 添加所有变更
      await execAsync('git add .', { cwd: this.baseDir });

      // 提交变更
      const { stdout } = await execAsync(`git commit -m "${commitMessage}"`, { cwd: this.baseDir });

      // 提取 commit hash
      const commitMatch = stdout.match(/\[([a-f0-9]+)\]/);
      const commitHash = commitMatch ? commitMatch[1] : 'unknown';

      return {
        success: true,
        commit: commitHash,
        message: commitMessage,
      };
    } catch (error) {
      // 检查是否是没有变更的情况
      if (error.message.includes('nothing to commit')) {
        return {
          success: false,
          error: '没有需要提交的变更',
        };
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 从需求 ID 生成短标题
   * @param {string} title - 原始标题
   * @returns {string} 处理后的短标题
   */
  generateShortTitle(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // 移除特殊字符
      .replace(/\s+/g, '-') // 空格替换为连字符
      .replace(/-+/g, '-') // 多个连字符合并为一个
      .substring(0, 50); // 限制长度
  }

  /**
   * 从需求 ID 提取分支类型
   * @param {string} id - 需求 ID（如 FEAT-0001）
   * @returns {string} 分支类型
   */
  getBranchTypeFromId(id) {
    const prefix = id.split('-')[0];

    const typeMapping = {
      FEAT: 'feature',
      BUG: 'bugfix',
      QUES: 'question',
      ADJU: 'adjustment',
      REF: 'refactor',
      DEBT: 'tech-debt',
    };

    return typeMapping[prefix] || 'feature';
  }

  /**
   * 获取 Git 状态
   * @returns {Promise<{success: boolean, status?: string, error?: string}>}
   */
  async getStatus() {
    try {
      const isRepo = await this.isGitRepo();
      if (!isRepo) {
        return {
          success: false,
          error: '当前目录不是 Git 仓库',
        };
      }

      const { stdout } = await execAsync('git status --short', {
        cwd: this.baseDir,
      });

      return {
        success: true,
        status: stdout.trim(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default GitIntegration;
