#!/usr/bin/env node

/**
 * crs-project-init - 初始化或修复 .requirements/project/ 目录
 *
 * 用法：
 *   crs-project-init [--force] [--help]
 *
 * 选项：
 *   --force    强制重建（覆盖现有 project 文档，保留 changelog）
 *   --help     显示帮助
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(__dirname);

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
crs-project-init - 初始化项目文档目录

用法:
  crs-project-init [options]

选项:
  --force    强制重建（覆盖现有 project 文档，保留 changelog）
  --help     显示此帮助信息

环境变量:
  CRS_PROJECT_SYNC=off  全局禁用 project 同步（仅对 processor 有效，本命令仍执行）
`);
    process.exit(0);
  }

  const force = args.includes('--force');

  // 以当前工作目录为 baseDir
  const baseDir = process.cwd();

  // 检查 .requirements 是否存在
  const { exists } = await import('../scripts/requirement-manager/utils/storage.js');
  const reqsExists = await exists(path.join(baseDir, '.requirements'));
  if (!reqsExists) {
    console.error(`❌ .requirements/ 目录不存在于 ${baseDir}`);
    console.error(`   请先执行 /req-init 或运行 crs-init 完成项目初始化`);
    process.exit(1);
  }

  console.log(`🚀 初始化项目文档...`);
  console.log(`   baseDir: ${baseDir}`);
  console.log(`   force: ${force ? '是' : '否'}`);
  console.log('');

  try {
    const { initializeProjectDocs } = await import('../scripts/requirement-manager/project-sync/index.js');
    const result = await initializeProjectDocs(baseDir, { force, actor: 'cli' });

    if (result.success) {
      console.log(`✅ 初始化成功（耗时 ${result.stats.durationMs}ms）`);
      if (result.created.length) {
        console.log(`   新建文件:`);
        for (const f of result.created) console.log(`     + ${f}`);
      }
      if (result.updated.length) {
        console.log(`   更新文件:`);
        for (const f of result.updated) console.log(`     * ${f}`);
      }
      if (result.skipped.length) {
        console.log(`   跳过:`);
        for (const s of result.skipped) console.log(`     ? ${s}`);
      }
      process.exit(0);
    } else {
      console.error(`❌ 初始化失败:`);
      for (const e of result.errors) console.error(`     ${e}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ 执行异常: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
