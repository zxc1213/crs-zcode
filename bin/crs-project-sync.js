#!/usr/bin/env node

/**
 * crs-project-sync - 手动触发 project 文档同步
 *
 * 用法：
 *   crs-project-sync [--full] [--req-id <ID>] [--help]
 *
 * 选项：
 *   --full            全量重生成（覆盖现有 4 份文档，保留 changelog）
 *   --req-id <ID>     仅同步指定需求（增量）
 *   --help            显示帮助
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(__dirname);

function showHelp() {
  console.log(`
crs-project-sync - 同步项目文档

用法:
  crs-project-sync [options]

选项:
  --full            全量重生成（覆盖现有 4 份文档，保留 changelog）
  --req-id <ID>     仅同步指定需求（增量；自动识别 feature/bug）
  --help            显示此帮助信息

示例:
  crs-project-sync --full                     # 全量重生成
  crs-project-sync --req-id FEAT-20260613-001 # 同步指定需求
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const full = args.includes('--full');
  let reqId = null;
  const reqIdIdx = args.indexOf('--req-id');
  if (reqIdIdx >= 0 && args[reqIdIdx + 1]) {
    reqId = args[reqIdIdx + 1];
    // 需求 ID 格式白名单：PREFIX-YYYYMMDD-NNN[-hash]，防止路径拼接逃逸
    if (!/^[A-Z]+-\d{8}-\d{3}(-[a-z0-9]+)?$/.test(reqId)) {
      console.error(`❌ 非法需求 ID: ${reqId}`);
      console.error(`   期望格式: FEAT-20260908-001 或 FEAT-20260908-001-abc123`);
      process.exit(1);
    }
  }

  const baseDir = process.cwd();

  const { exists } = await import('../scripts/requirement-manager/utils/storage.js');
  const reqsExists = await exists(path.join(baseDir, '.requirements'));
  if (!reqsExists) {
    console.error(`❌ .requirements/ 目录不存在于 ${baseDir}`);
    process.exit(1);
  }

  console.log(`🔄 同步项目文档...`);
  console.log(`   baseDir: ${baseDir}`);
  console.log(`   模式: ${full ? '全量重生成' : reqId ? `单需求(${reqId})` : '默认（无操作）'}`);
  console.log('');

  try {
    const projectSync = await import('../scripts/requirement-manager/project-sync/index.js');
    let result;

    if (full) {
      result = await projectSync.fullResync(baseDir);
    } else if (reqId) {
      // 自动识别类型
      const prefix = reqId.split('-')[0];
      if (prefix === 'BUG') {
        result = await projectSync.syncOnBugFixed(baseDir, reqId);
      } else {
        result = await projectSync.syncOnRequirementDone(baseDir, reqId);
      }
    } else {
      console.error(`❌ 请指定 --full 或 --req-id <ID>`);
      console.error(`   运行 crs-project-sync --help 查看帮助`);
      process.exit(1);
    }

    // 输出 JSON 统计
    console.log(
      JSON.stringify(
        {
          success: result.success,
          created: result.created,
          updated: result.updated,
          errors: result.errors,
          skipped: result.skipped,
          durationMs: result.stats.durationMs,
        },
        null,
        2
      )
    );

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error(`❌ 执行异常: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
