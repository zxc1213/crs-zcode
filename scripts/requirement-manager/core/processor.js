/**
 * 需求处理器 - 门面类
 *
 * 自身只保留：输入解析、路径解析、查询、删除、索引维护。
 * 创建逻辑 → core/requirement-creator.js；状态流转 → core/status-machine.js；
 * 模板渲染 → core/template-renderer.js。
 */

import { readMeta } from '../utils/storage.js';
import { trackDocuments } from '../utils/document-tracker.js';
import { syncIndexTables } from '../utils/plan-sync.js';
import { TYPE_PREFIXES, TYPE_DIRS } from './schema.js';
import { createRequirement } from './requirement-creator.js';
import { applyUpdate } from './status-machine.js';
import path from 'path';
import fs from 'fs/promises';
import { getKnowledgeGraph } from '../../knowledge-graph/index.js';

/**
 * 命令标志到类型的映射
 */
const FLAG_MAPPING = {
  '--bug': 'bug',
  '-b': 'bug',
  '--question': 'question',
  '-q': 'question',
  '--adjust': 'adjustment',
  '-a': 'adjustment',
  '--adj': 'adjustment',
  '--refactor': 'refactor',
  '-r': 'refactor',
  '--ref': 'refactor',
  '--auto': 'auto',
  '--feature': 'feature',
  '-f': 'feature',
};

/**
 * 需求处理器类
 */
export class Processor {
  /**
   * 构造函数
   * @param {string} baseDir - 基础目录路径
   */
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.requirementsDir = path.join(baseDir, '.requirements');
    this.index = new Map(); // ID 到路径的缓存索引
  }

  /**
   * 解析命令输入，提取类型、模式和描述
   * @param {string} input - 命令输入，例如 "/req --bug something is broken"
   * @returns {object} 包含 type, mode, description 的对象
   */
  static parseType(input) {
    // 移除 /req 前缀（如果存在）
    let cleanedInput = input.replace(/^\/req\s*/, '').trim();

    // 初始化默认值
    let type = 'feature';
    let mode = 'semi_auto';
    let description;

    // 检查是否是 --auto 模式
    if (cleanedInput.startsWith('--auto')) {
      mode = 'full_auto';
      cleanedInput = cleanedInput.replace(/^--auto\s*/, '').trim();
    }

    // 检查其他标志
    for (const [flag, flagType] of Object.entries(FLAG_MAPPING)) {
      if (flag === '--auto') continue; // 已经处理过

      if (cleanedInput.startsWith(flag)) {
        if (flagType !== 'auto') {
          type = flagType;
        }
        cleanedInput = cleanedInput.replace(new RegExp(`^${flag}\\s*`), '').trim();
        break;
      }
    }

    // 模式旗标（可出现在类型旗标前后，不污染描述）：--quick / --deep
    let modeFlagMatched = true;
    while (modeFlagMatched) {
      modeFlagMatched = false;
      if (cleanedInput.startsWith('--quick')) {
        mode = 'quick';
        cleanedInput = cleanedInput.replace(/^--quick\s*/, '').trim();
        modeFlagMatched = true;
      } else if (cleanedInput.startsWith('--deep')) {
        mode = 'semi_auto';
        cleanedInput = cleanedInput.replace(/^--deep\s*/, '').trim();
        modeFlagMatched = true;
      }
    }

    // 剩余部分作为描述
    description = cleanedInput;

    return {
      type,
      mode,
      description,
    };
  }

  /**
   * 创建新需求
   * @param {object} parsed - 解析后的需求对象 { type, mode, description }
   * @returns {Promise<object>} 包含 id 和 path 的对象
   */
  async create(parsed) {
    return createRequirement(this, parsed);
  }

  /**
   * 更新需求（状态流转等字段合并）
   * @param {string} id - 需求 ID
   * @param {object} updates - 要更新的字段
   * @returns {Promise<void>}
   */
  async update(id, updates) {
    await applyUpdate(this, id, updates);
  }

  /**
   * 跟踪需求文档变化并更新元数据
   * @param {string} id - 需求 ID
   * @returns {Promise<object>} 更新后的元数据
   */
  async trackDocuments(id) {
    const reqPath = this.getRequirementPath(id);

    if (!reqPath) {
      throw new Error(`Requirement not found: ${id}`);
    }

    // 使用 document-tracker 更新元数据
    const updatedMeta = await trackDocuments(this.baseDir, reqPath);

    // 同步索引表（待填充 → 已填充）
    await syncIndexTables(reqPath);

    // 同步到知识图谱
    try {
      const graph = await getKnowledgeGraph(this.baseDir);
      await graph.updateRequirement(id, {
        status: updatedMeta.status,
        title: updatedMeta.title,
        description: updatedMeta.description,
      });
    } catch (_error) {
      // 知识图谱同步失败不影响主流程
    }

    return updatedMeta;
  }

  /**
   * 获取需求详情
   * @param {string} id - 需求 ID
   * @returns {Promise<object>} 需求详情对象
   */
  async get(id) {
    const reqPath = this.getRequirementPath(id);

    if (!reqPath) {
      throw new Error(`Requirement not found: ${id}`);
    }

    const meta = await readMeta(this.baseDir, reqPath);

    if (!meta) {
      throw new Error(`Metadata not found for requirement: ${id}`);
    }

    return meta;
  }

  /**
   * 获取需求路径
   * @param {string} id - 需求 ID
   * @returns {string|null} 需求路径，如果不存在则返回 null
   */
  getRequirementPath(id) {
    // 如果索引中有，直接返回
    if (this.index.has(id)) {
      return this.index.get(id);
    }

    // ID 只允许 字母/数字/短横线，拒绝路径片段（防路径穿越）
    if (typeof id !== 'string' || !/^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/.test(id)) {
      return null;
    }

    // 否则，搜索文件系统
    // 从 ID 解析类型
    const prefix = id.split('-')[0];
    const type = Object.entries(TYPE_PREFIXES).find(([, p]) => p === prefix)?.[0];

    if (!type) {
      return null;
    }

    const typeDir = TYPE_DIRS[type] || `${type}s`;
    const reqPath = path.join(this.requirementsDir, typeDir, id);

    // 验证路径是否存在
    return reqPath;
  }

  /**
   * 删除需求
   * @param {string} id - 需求 ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const reqPath = this.getRequirementPath(id);

    if (!reqPath) {
      return false;
    }

    try {
      // 删除目录
      await fs.rm(reqPath, { recursive: true, force: true });

      // 从索引中移除
      this.index.delete(id);

      // 从知识图谱中移除
      try {
        const graph = await getKnowledgeGraph(this.baseDir);
        await graph.deleteRequirement(id);
      } catch (_error) {
        // 知识图谱同步失败不影响主流程
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to delete requirement: ${error.message}`, { cause: error });
    }
  }

  /**
   * 重建索引（扫描文件系统）
   * @returns {Promise<void>}
   */
  async rebuildIndex() {
    this.index.clear();

    for (const [, dir] of Object.entries(TYPE_DIRS)) {
      const typePath = path.join(this.requirementsDir, dir);

      try {
        const entries = await fs.readdir(typePath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            this.index.set(entry.name, path.join(typePath, entry.name));
          }
        }
      } catch (error) {
        // 忽略不存在的目录
        if (error.code !== 'ENOENT') {
          console.error(`Error scanning directory ${typePath}:`, error);
        }
      }
    }
  }
}

export default Processor;
