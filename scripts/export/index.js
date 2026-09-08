/**
 * 导出模块入口 - 编排 Collector + Renderer + Writer
 *
 * 主要 API：
 *   export({ requirementsDir, output, options }) - 导出 HTML 报告
 */

import path from 'path';
import { exists } from '../requirement-manager/utils/storage.js';
import { collect } from './collector.js';
import { render } from './renderer.js';
import { write } from './writer.js';
import { defaultFileName } from './utils.js';

/**
 * 导出 HTML 报告
 * @param {object} params
 * @param {string} params.requirementsDir - .requirements 目录路径
 * @param {string} [params.output] - 输出文件路径（默认 ./crs-report-{ts}.html）
 * @param {object} [params.options]
 * @param {string} [params.options.title] - 报告标题
 * @param {boolean} [params.options.offline] - 离线模式
 * @param {boolean} [params.options.noMermaid] - 禁用依赖图
 * @param {string} [params.options.projectName] - 项目名称
 * @param {string} [params.options.version] - 项目版本
 * @param {object} [params.options.hooks] - 钩子 { onWarning }
 * @returns {Promise<{success: boolean, output: {path,size,durationMs}|null, warnings: string[], error?: string}>}
 */
export async function exportReport(params) {
  const { requirementsDir, output, options = {} } = params;

  if (!(await exists(requirementsDir))) {
    return {
      success: false,
      output: null,
      warnings: [],
      error: `ENO_REQ_DIR: 需求目录不存在 ${requirementsDir}（请先运行 /req --init 初始化）`,
    };
  }

  // 1. 收集数据
  const data = await collect(requirementsDir, {
    projectName: options.projectName,
    version: options.version,
    hooks: options.hooks,
  });

  // 2. 渲染 HTML
  const html = render(data, {
    title: options.title,
    offline: options.offline,
    noMermaid: options.noMermaid,
  });

  // 3. 写入文件
  const outputPath = output || defaultFileName();
  const finalPath = path.isAbsolute(outputPath) ? outputPath : path.resolve(process.cwd(), outputPath);

  try {
    const result = await write(html, finalPath);
    return {
      success: true,
      output: result,
      warnings: data.warnings || [],
      meta: data.meta,
    };
  } catch (error) {
    return {
      success: false,
      output: null,
      warnings: data.warnings || [],
      error: error.message,
      code: error.code,
    };
  }
}

export { collect } from './collector.js';
export { render } from './renderer.js';
export { write } from './writer.js';
export { default as Collector } from './collector.js';
export { default as Renderer } from './renderer.js';
export { default as Writer } from './writer.js';

export default { exportReport };
