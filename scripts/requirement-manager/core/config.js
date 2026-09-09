/**
 * 项目级配置 - 默认值 + .requirements/_system/config.yaml 覆盖
 *
 * 可覆盖项：优先级权重 / 质量门禁阈值 / 需求骨架清单 / docs-map 扫描深度。
 * 配置文件缺失 → 全部走默认；文件存在但解析或校验失败 → 降级默认并告警，
 * 引擎主流程不因项目配置损坏而中断。
 */

import path from 'path';
import fs from 'fs/promises';
import yaml from 'js-yaml';

/**
 * 配置文件相对 .requirements/ 的位置（只读口径）
 */
export const CONFIG_REL_PATH = '_system/config.yaml';

/**
 * 默认骨架清单
 */
export const DEFAULT_SKELETON = {
  root: ['spec.md', 'plan.md', 'test-cases.md'],
  subdirs: {
    spec: ['background.md', 'user-stories.md', 'design.md', 'api.md', 'decisions.md'],
    plan: ['tasks.md', 'milestones.md'],
    'test-cases': ['positive.md', 'negative.md', 'boundary.md'],
  },
};

/**
 * 默认配置（只读口径源）
 */
export const DEFAULT_CONFIG = Object.freeze({
  priority: Object.freeze({
    weights: Object.freeze({ business_value: 40, urgency: 30, dependencies: 15, effort: 10, risk: 5 }),
  }),
  quality: Object.freeze({
    gate_threshold: 80,
  }),
  skeleton: DEFAULT_SKELETON,
  docs_map: Object.freeze({
    max_depth: 3,
  }),
});

/**
 * 项目配置文件的绝对路径（root 边界显式校验）
 */
export function configFilePath(baseDir) {
  const root = path.resolve(baseDir);
  const configPath = path.resolve(root, '.requirements', '_system', 'config.yaml');
  if (configPath !== root && !configPath.startsWith(root + path.sep)) {
    throw new Error(`config path escapes project root: ${configPath}`);
  }
  return configPath;
}

/**
 * 深合并（plain object 递归，数组与标量整体替换）
 */
function deepMerge(base, override) {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const out = { ...base };
  for (const [key, val] of Object.entries(override)) {
    out[key] = deepMerge(base[key], val);
  }
  return out;
}

function isPlainObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

/**
 * 校验配置形状；非法即抛错（由 loadConfig 统一降级）
 */
function validate(config) {
  const { priority, quality, skeleton, docs_map } = config;
  if (!isPlainObject(priority) || !isPlainObject(priority.weights)) {
    throw new Error('priority.weights 必须是对象');
  }
  for (const [key, weight] of Object.entries(priority.weights)) {
    if (typeof weight !== 'number' || weight < 0 || weight > 100) {
      throw new Error(`priority.weights.${key} 必须是 0-100 的数字`);
    }
  }
  if (!isPlainObject(quality) || typeof quality.gate_threshold !== 'number' || quality.gate_threshold < 0 || quality.gate_threshold > 100) {
    throw new Error('quality.gate_threshold 必须是 0-100 的数字');
  }
  if (!isPlainObject(skeleton) || !Array.isArray(skeleton.root) || !isPlainObject(skeleton.subdirs)) {
    throw new Error('skeleton.root / skeleton.subdirs 形状不合法');
  }
  for (const entry of skeleton.root) {
    if (typeof entry !== 'string') throw new Error('skeleton.root 条目必须是字符串');
  }
  for (const [dir, files] of Object.entries(skeleton.subdirs)) {
    if (typeof dir !== 'string' || !Array.isArray(files) || files.some((f) => typeof f !== 'string')) {
      throw new Error(`skeleton.subdirs.${dir} 必须是字符串数组`);
    }
  }
  if (!isPlainObject(docs_map) || typeof docs_map.max_depth !== 'number' || docs_map.max_depth < 1 || docs_map.max_depth > 20 || !Number.isInteger(docs_map.max_depth)) {
    throw new Error('docs_map.max_depth 必须是 1-20 的整数');
  }
  return config;
}

// 按 baseDir 缓存（进程内一次读取）
const cache = new Map();

/**
 * 加载项目级配置（默认值 ← config.yaml 深合并）
 * @param {string} baseDir - 项目根目录
 * @returns {Promise<object>} 合并后的配置
 */
export async function loadConfig(baseDir) {
  if (cache.has(baseDir)) {
    return cache.get(baseDir);
  }

  let merged = deepMerge(DEFAULT_CONFIG, undefined);
  const configPath = configFilePath(baseDir);

  let raw;
  try {
    raw = await fs.readFile(configPath, 'utf-8');
  } catch (_error) {
    // 文件不存在 → 纯默认
    cache.set(baseDir, merged);
    return merged;
  }

  try {
    const userConfig = yaml.load(raw);
    if (userConfig !== null && !isPlainObject(userConfig)) {
      throw new Error('config.yaml 顶层必须是键值映射');
    }
    merged = validate(deepMerge(DEFAULT_CONFIG, userConfig || {}));
  } catch (error) {
    // 解析/校验失败 → 降级默认并告警，不中断主流程
    console.warn(`[crs] 项目配置不可用（${CONFIG_REL_PATH}），已回退默认值: ${error.message}`);
    merged = deepMerge(DEFAULT_CONFIG, undefined);
  }

  cache.set(baseDir, merged);
  return merged;
}

/**
 * 清空配置缓存（测试或配置热更新用）
 */
export function resetConfigCache() {
  cache.clear();
}
