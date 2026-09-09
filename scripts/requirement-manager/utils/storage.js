/**
 * 存储工具类 - 处理文件系统操作
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { TYPE_DIRS } from '../core/schema.js';

/**
 * 初始化目录结构（目录清单来自 schema 唯一口径；日志写在 .requirements/logs）
 * @param {string} baseDir - 基础目录路径
 */
export async function init(baseDir) {
  const dirs = [baseDir, path.join(baseDir, '.requirements'), path.join(baseDir, '.requirements', 'project'), path.join(baseDir, '.requirements', 'logs')];

  for (const dirName of Object.values(TYPE_DIRS)) {
    dirs.push(path.join(baseDir, '.requirements', dirName));
  }

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // 忽略已存在的目录错误
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

/**
 * 检查文件或目录是否存在
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>}
 */
export async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取元数据
 * @param {string} baseDir - 基础目录
 * @param {string} reqPath - 需求路径
 * @returns {Promise<object|null>}
 */
export async function readMeta(baseDir, reqPath) {
  const metaPath = path.join(reqPath, 'meta.yaml');

  try {
    const content = await fs.readFile(metaPath, 'utf-8');
    return yaml.load(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * 写入元数据
 * @param {string} baseDir - 基础目录
 * @param {string} reqPath - 需求路径
 * @param {object} meta - 元数据对象
 */
export async function writeMeta(baseDir, reqPath, meta) {
  const metaPath = path.join(reqPath, 'meta.yaml');
  const content = yaml.dump(meta, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
  });
  await fs.writeFile(metaPath, content, 'utf-8');
}

/**
 * 清理测试目录
 * @param {string} testDir - 测试目录路径
 */
export async function cleanup(testDir) {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    // 忽略不存在的目录
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

export default {
  init,
  exists,
  readMeta,
  writeMeta,
  cleanup,
};
