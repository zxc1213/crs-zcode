/**
 * Writer - 文件输出
 *
 * 确保目录存在 + 写入文件 + 返回统计信息
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * 写入 HTML 文件
 * @param {string} html - HTML 内容
 * @param {string} outputPath - 输出路径
 * @returns {Promise<{path: string, size: number, durationMs: number}>}
 */
export async function write(html, outputPath) {
  const start = Date.now();
  // 输出路径来自用户显式参数（crs-export -o）：
  // - 相对路径必须收敛在当前工作目录内
  // - 绝对路径放行，但拒绝文件系统根
  const raw = String(outputPath || '');
  const absPath = path.resolve(raw);
  if (path.isAbsolute(raw)) {
    if (absPath === path.parse(absPath).root) {
      const err = new Error(`非法输出路径: ${outputPath}`);
      err.code = 'EWRITE_FAIL';
      throw err;
    }
  } else {
    const base = process.cwd();
    if (absPath !== base && !absPath.startsWith(base + path.sep)) {
      const err = new Error(`输出路径越出工作目录: ${outputPath}`);
      err.code = 'EWRITE_FAIL';
      throw err;
    }
  }

  try {
    await fs.mkdir(path.dirname(absPath), { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      const err = new Error(`无法创建目录 ${path.dirname(absPath)}: ${error.message}`);
      err.code = 'EWRITE_FAIL';
      err.cause = error;
      throw err;
    }
  }

  try {
    await fs.writeFile(absPath, html, 'utf-8');
  } catch (error) {
    const err = new Error(`无法写入文件 ${absPath}: ${error.message}`);
    err.code = error.code === 'ENOSPC' ? 'ENOSPC' : 'EWRITE_FAIL';
    err.cause = error;
    throw err;
  }

  const stat = await fs.stat(absPath);
  return {
    path: absPath,
    size: stat.size,
    durationMs: Date.now() - start,
  };
}

export default { write };
