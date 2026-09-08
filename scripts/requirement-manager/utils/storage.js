/**
 * 存储工具类 - 处理文件系统操作
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

/**
 * 初始化目录结构
 * @param {string} baseDir - 基础目录路径
 */
export async function init(baseDir) {
  const dirs = [
    baseDir,
    path.join(baseDir, '.requirements'),
    path.join(baseDir, '.requirements', 'features'),
    path.join(baseDir, '.requirements', 'bugs'),
    path.join(baseDir, '.requirements', 'questions'),
    path.join(baseDir, '.requirements', 'adjustments'),
    path.join(baseDir, '.requirements', 'refactors'),
    path.join(baseDir, '.requirements', 'tech-debt'),
    path.join(baseDir, '.requirements', 'project'),
    path.join(baseDir, '.requirements', 'logs'),
    path.join(baseDir, 'templates'),
    path.join(baseDir, 'logs'),
  ];

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
 * 创建需求目录
 * @param {string} baseDir - 基础目录
 * @param {string} type - 需求类型 (feature/bug/tech-debt)
 * @param {string} id - 需求ID
 * @returns {Promise<string>} 创建的目录路径
 */
export async function createRequirementDir(baseDir, type, id) {
  const typeDir = type === 'tech-debt' ? 'tech-debt' : `${type}s`;
  const reqPath = path.join(baseDir, '.requirements', typeDir, id);

  await fs.mkdir(reqPath, { recursive: true });

  // 创建初始元数据
  const meta = {
    id,
    type,
    title: '',
    description: '',
    status: 'open',
    priority: 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeMeta(baseDir, reqPath, meta);

  return reqPath;
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
  createRequirementDir,
  readMeta,
  writeMeta,
  cleanup,
};
