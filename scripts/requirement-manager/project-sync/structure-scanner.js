/**
 * 项目结构扫描器 - 扫描项目实际目录结构
 *
 * 职责：
 * - 递归扫描项目目录（深度限制 3 层）
 * - 跳过 node_modules / .git / dist 等忽略目录
 * - 读取 package.json 提取项目元信息
 * - 生成树形结构和模块表格
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * 默认忽略的目录/文件名
 */
const DEFAULT_IGNORE = new Set(['node_modules', '.git', '.requirements', '.cache', 'dist', 'build', 'coverage', '.next', '.nuxt', '.output', '.nyc_output', '.idea', '.vscode', '__pycache__', '.DS_Store', 'vendor']);

/**
 * 默认扫描深度
 */
const DEFAULT_DEPTH = 3;

/**
 * 安全读取 JSON 文件（解析失败返回 null）
 * @param {string} filePath
 * @returns {Promise<object|null>}
 */
async function safeReadJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (_error) {
    return null;
  }
}

/**
 * 读取 package.json 关键字段
 * @param {string} baseDir
 * @returns {Promise<object>}
 */
async function readPackageInfo(baseDir) {
  const pkgPath = path.join(baseDir, 'package.json');
  const pkg = await safeReadJson(pkgPath);
  if (!pkg) {
    return {
      name: path.basename(baseDir),
      description: '(无 package.json 或解析失败)',
      version: 'unknown',
      main: '-',
      dependencies: {},
      devDependencies: {},
      bin: null,
    };
  }
  return {
    name: pkg.name || path.basename(baseDir),
    description: pkg.description || '(无描述)',
    version: pkg.version || 'unknown',
    main: pkg.main || pkg.module || 'index.js',
    dependencies: pkg.dependencies || {},
    devDependencies: pkg.devDependencies || {},
    bin: pkg.bin || null,
  };
}

/**
 * 递归扫描目录，返回结构化条目
 * @param {string} dirPath - 当前目录路径
 * @param {number} depth - 剩余深度
 * @param {string} prefix - 用于树形显示的前缀
 * @param {Set<string>} ignore - 忽略集合
 * @returns {Promise<{entries: Array, tree: string, modules: Array}>}
 */
async function scanDirectory(dirPath, depth, prefix, ignore) {
  const entries = [];
  const modules = [];
  const treeLines = [];

  let items;
  try {
    items = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (_error) {
    return { entries, tree: '', modules };
  }

  // 排序：目录在前，文件在后，字母顺序
  items.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  // 过滤忽略项
  const visibleItems = items.filter((item) => !ignore.has(item.name));

  const total = visibleItems.length;
  for (let i = 0; i < total; i++) {
    const item = visibleItems[i];
    const isLast = i === total - 1;
    const branch = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const itemPath = path.join(dirPath, item.name);
    const suffix = item.isDirectory() ? '/' : '';
    treeLines.push(`${prefix}${branch}${item.name}${suffix}`);

    if (item.isDirectory()) {
      entries.push({
        type: 'dir',
        name: item.name,
        path: path.relative(path.dirname(dirPath), itemPath).split(path.sep).join('/'),
      });

      if (depth > 0) {
        const subEntries = await scanDirectory(itemPath, depth - 1, childPrefix, ignore);
        entries.push(...subEntries.entries.map((e) => ({ ...e, nested: true })));
        modules.push(...subEntries.modules);
        const subTree = subEntries.tree;
        if (subTree) treeLines.push(subTree);
      }
    } else {
      entries.push({
        type: 'file',
        name: item.name,
        path: path.relative(path.dirname(dirPath), itemPath).split(path.sep).join('/'),
      });

      // 顶层 index.js / main 文件视为模块入口
      if (depth === DEFAULT_DEPTH && /^(index\.|main\.|app\.)/.test(item.name)) {
        modules.push({
          name: path.basename(path.dirname(itemPath)),
          entry: item.name,
          path: path.relative(dirPath, itemPath).split(path.sep).join('/'),
        });
      }
    }
  }

  return {
    entries,
    tree: treeLines.join('\n'),
    modules,
  };
}

/**
 * 生成模块表格 markdown
 * @param {Array} modules
 * @returns {string}
 */
function formatModulesTable(modules) {
  if (!modules.length) {
    return '_未识别到核心模块_';
  }
  const rows = modules.map((m) => `| \`${m.path}\` | ${m.name} | ${m.entry || '-'} | - |`);
  return `| 路径 | 名称 | 入口 | 描述 |\n| ---- | ---- | ---- | ---- |\n${rows.join('\n')}`;
}

/**
 * 生成依赖列表 markdown
 * @param {object} pkgInfo
 * @returns {string}
 */
function formatDependencies(pkgInfo) {
  const deps = Object.keys(pkgInfo.dependencies || {});
  const devDeps = Object.keys(pkgInfo.devDependencies || {});
  if (deps.length === 0 && devDeps.length === 0) {
    return '_无 dependencies_';
  }
  const lines = [];
  if (deps.length) {
    lines.push(`**dependencies** (${deps.length}):`);
    lines.push(deps.map((d) => `- \`${d}\``).join('\n'));
  }
  if (devDeps.length) {
    lines.push(`**devDependencies** (${devDeps.length}):`);
    lines.push(
      devDeps
        .slice(0, 20)
        .map((d) => `- \`${d}\``)
        .join('\n')
    );
    if (devDeps.length > 20) {
      lines.push(`- _... 及其余 ${devDeps.length - 20} 个_`);
    }
  }
  return lines.join('\n');
}

/**
 * 扫描项目结构主入口
 * @param {string} baseDir - 项目根目录
 * @param {object} options
 * @param {number} options.depth - 最大深度（默认 3）
 * @param {Set<string>} options.ignore - 额外忽略项
 * @returns {Promise<object>} { tree, modules, description, packageInfo }
 */
export async function scanProjectStructure(baseDir, options = {}) {
  const depth = typeof options.depth === 'number' ? options.depth : DEFAULT_DEPTH;
  const ignore = new Set([...DEFAULT_IGNORE, ...(options.ignore || [])]);

  const pkgInfo = await readPackageInfo(baseDir);

  const result = await scanDirectory(baseDir, depth, '', ignore);

  // 顶层目录的 entries 和 modules 需要清洗（去掉 nested 标记）
  const topEntries = result.entries.filter((e) => !e.nested);
  const allModules = [...result.modules];

  // 补充顶层目录作为模块候选
  for (const entry of topEntries) {
    if (entry.type === 'dir' && !allModules.find((m) => m.name === entry.name)) {
      allModules.push({
        name: entry.name,
        entry: '-',
        path: entry.name,
      });
    }
  }

  return {
    tree: result.tree || '_(空目录)_',
    modules: allModules,
    modulesTable: formatModulesTable(allModules),
    dependenciesList: formatDependencies(pkgInfo),
    description: pkgInfo.description,
    packageInfo: pkgInfo,
  };
}

export default {
  scanProjectStructure,
};
