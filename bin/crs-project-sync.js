#!/usr/bin/env node

/**
 * crs-project-sync - 手动触发 project 文档同步
 *
 * 用法：
 *   crs-project-sync [--full] [--req-id <ID>] [--change <level> --reason <text>] [--help]
 *
 * 选项：
 *   --full            全量重生成（覆盖现有 4 份文档，保留 changelog）
 *   --req-id <ID>     仅同步指定需求（增量）
 *   --change <level>  需求变更同步（small|medium|large，需配合 --req-id 与 --reason）
 *   --reason <text>   变更原因（--change 模式必填）
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
  --change <level>  需求变更同步（small|medium|large；需配合 --req-id 与 --reason，
                    已聚合的项目文档区块将被替换更新，并记录时间线事件）
  --reason <text>   变更原因（--change 模式必填）
  --help            显示此帮助信息

示例:
  crs-project-sync --full                     # 全量重生成
  crs-project-sync --req-id FEAT-20260613-001 # 同步指定需求
  crs-project-sync --req-id FEAT-20260613-001 --change medium --reason "导出格式改为 CSV"
`);
}

function readFlagValue(args, flag) {
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] !== undefined && !args[idx + 1].startsWith('--')) {
    return args[idx + 1];
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const full = args.includes('--full');
  let reqId = readFlagValue(args, '--req-id');
  if (reqId) {
    // 需求 ID 格式白名单：PREFIX-YYYYMMDD-NNN[-hash]，防止路径拼接逃逸
    if (!/^[A-Z]+-\d{8}-\d{3}(-[a-z0-9]+)?$/.test(reqId)) {
      console.error(`❌ 非法需求 ID: ${reqId}`);
      console.error(`   期望格式: FEAT-20260908-001 或 FEAT-20260908-001-abc123`);
      process.exit(1);
    }
  }

  const changeLevel = readFlagValue(args, '--change');
  const reason = readFlagValue(args, '--reason');

  const baseDir = process.cwd();

  const { exists } = await import('../scripts/requirement-manager/utils/storage.js');
  const reqsExists = await exists(path.join(baseDir, '.requirements'));
  if (!reqsExists) {
    console.error(`❌ .requirements/ 目录不存在于 ${baseDir}`);
    process.exit(1);
  }

  const mode = full ? '全量重生成' : changeLevel ? `变更同步(${reqId || '?'}, ${changeLevel})` : reqId ? `单需求(${reqId})` : '默认（无操作）';

  console.log(`🔄 同步项目文档...`);
  console.log(`   baseDir: ${baseDir}`);
  console.log(`   模式: ${mode}`);
  console.log('');

  try {
    const projectSync = await import('../scripts/requirement-manager/project-sync/index.js');
    let result;

    if (changeLevel) {
      if (!reqId) {
        console.error(`❌ --change 需要 --req-id <ID>`);
        process.exit(1);
      }
      if (!['small', 'medium', 'large'].includes(changeLevel)) {
        console.error(`❌ 非法变更级别: ${changeLevel}（允许 small|medium|large）`);
        process.exit(1);
      }
      if (!reason) {
        console.error(`❌ --change 需要 --reason <变更原因>`);
        process.exit(1);
      }
      result = await projectSync.syncOnRequirementChange(baseDir, reqId, { level: changeLevel, reason });
    } else if (full) {
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
