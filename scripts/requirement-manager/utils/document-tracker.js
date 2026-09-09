/**
 * 文档跟踪器 - 跟踪需求目录中的文档变化
 * 自动更新 meta.yaml 当新文档被添加时
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

/**
 * 扫描需求目录中的文档（仅根目录）
 * @param {string} reqPath - 需求目录路径
 * @returns {Promise<string[]>} 文档文件列表
 */
export async function scanDocuments(reqPath) {
  try {
    const files = await fs.readdir(reqPath);
    return files.filter((file) => file.endsWith('.md') && file !== 'raw.md' && file !== '.agent-context.md' && !file.startsWith('.'));
  } catch (_error) {
    return [];
  }
}

/**
 * 扫描子目录中的 .md 文件
 * @param {string} dirPath - 子目录路径
 * @returns {Promise<string[]>} .md 文件名列表
 */
export async function scanSubDocuments(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    return files.filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
}

/**
 * 检测文件是否有实质内容（非骨架）
 * 判断条件：文件 >500 bytes + 无 <!-- TODO: 残留 + 至少 3 行非格式化正文
 * @param {string} filePath - 文件绝对路径
 * @returns {Promise<boolean>} true 表示已填充
 */
export async function isDocumentFilled(filePath) {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size < 500) return false;

    const content = await fs.readFile(filePath, 'utf-8');
    if (/<!--\s*TODO:/.test(content)) return false;

    const contentLines = content.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('|') && !l.trim().startsWith('>') && !l.trim().startsWith('- [ ]') && !l.trim().startsWith('- [x]') && !l.trim().startsWith('---'));
    return contentLines.length >= 3;
  } catch {
    return false;
  }
}

/**
 * 扫描所有子目录，返回每个文件的填充状态
 * @param {string} reqPath - 需求目录
 * @returns {Promise<object>} { subDir: { fileName: boolean } }
 */
export async function scanSubDirectoryStatus(reqPath) {
  const subDirs = ['spec', 'plan', 'test-cases'];
  const result = {};
  for (const dir of subDirs) {
    const dirPath = path.join(reqPath, dir);
    const files = await scanSubDocuments(dirPath);
    const fileStatus = {};
    for (const file of files) {
      fileStatus[file] = await isDocumentFilled(path.join(dirPath, file));
    }
    result[dir] = fileStatus;
  }
  return result;
}

/**
 * 更新需求元数据以反映文档变化
 * @param {string} baseDir - 基础目录
 * @param {string} reqPath - 需求目录路径
 * @returns {Promise<object>} 更新后的元数据
 */
export async function trackDocuments(baseDir, reqPath) {
  const metaPath = path.join(reqPath, 'meta.yaml');

  try {
    const content = await fs.readFile(metaPath, 'utf-8');
    const meta = yaml.load(content);

    const documents = await scanDocuments(reqPath);

    const updatedMeta = {
      ...meta,
      documents,
      documentCount: documents.length,
      updatedAt: new Date().toISOString(),
    };

    const yamlContent = yaml.dump(updatedMeta, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });
    await fs.writeFile(metaPath, yamlContent, 'utf-8');

    return updatedMeta;
  } catch (error) {
    throw new Error(`Failed to track documents: ${error.message}`);
  }
}

/**
 * 添加文档并自动更新元数据
 * @param {string} baseDir - 基础目录
 * @param {string} reqPath - 需求目录路径
 * @param {string} docName - 文档名称
 * @param {string} content - 文档内容
 * @returns {Promise<void>}
 */
export async function addDocument(baseDir, reqPath, docName, content) {
  // 文档名只取基础名，且目标必须落在需求目录内，防止越界写入
  const safeName = path.basename(String(docName));
  const root = path.resolve(reqPath);
  const docPath = path.resolve(root, safeName);
  if (docPath !== root && !docPath.startsWith(root + path.sep)) {
    throw new Error(`document path escapes requirement directory: ${docName}`);
  }
  await fs.writeFile(docPath, content, 'utf-8');
  await trackDocuments(baseDir, reqPath);
}

/**
 * 获取文档变化摘要
 * @param {string} reqPath - 需求目录路径
 * @returns {Promise<string>} 变化摘要
 */
export async function getDocumentSummary(reqPath) {
  const documents = await scanDocuments(reqPath);

  if (documents.length === 0) {
    return '暂无文档';
  }

  const summary = documents.map((doc) => `  - ${doc}`).join('\n');
  return `文档列表 (${documents.length}):\n${summary}`;
}

export default {
  scanDocuments,
  scanSubDocuments,
  isDocumentFilled,
  scanSubDirectoryStatus,
  trackDocuments,
  addDocument,
  getDocumentSummary,
};
