#!/usr/bin/env node

/**
 * crs-export - 将 .requirements/ 导出为单文件 HTML 报告
 *
 * 用法：
 *   crs-export [options]
 *
 * 选项：
 *   -o, --output <path>           输出文件路径（默认 ./crs-report-{ts}.html）
 *   -t, --title <text>            报告标题
 *   -r, --requirements-dir <path> 需求目录路径（默认 ./.requirements）
 *       --offline                 离线模式（不加载 CDN）
 *       --no-mermaid              禁用依赖图
 *   -q, --quiet                   静默模式（仅输出错误）
 *   -h, --help                    显示帮助
 *   -v, --version                 显示版本
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(__dirname);

function readPackageVersion() {
  try {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
    return pkg.version || 'unknown';
  } catch (_e) {
    return 'unknown';
  }
}

const VERSION = readPackageVersion();

function showHelp() {
  console.log(`
crs-export v${VERSION} - 导出 HTML 需求报告

用法:
  crs-export [options]

选项:
  -o, --output <path>           输出文件路径（默认 ./crs-report-{ts}.html）
  -t, --title <text>            报告标题
  -r, --requirements-dir <path> 需求目录路径（默认 ./.requirements）
      --offline                 离线模式（不加载 Mermaid CDN）
      --no-mermaid              禁用依赖图渲染
  -f, --filter <expr>           默认过滤器（如 status=done）
  -q, --quiet                   静默模式（仅输出错误）
  -h, --help                    显示此帮助信息
  -v, --version                 显示版本号

退出码:
  0  成功
  1  通用错误（目录不存在、写入失败等）
  2  参数错误

示例:
  crs-export                                        # 默认导出
  crs-export -o ./reports/v1.html -t "v1 发布快照"   # 自定义路径和标题
  crs-export --offline                              # 离线模式
  crs-export --no-mermaid                           # 禁用依赖图
`);
}

function parseArgs(argv) {
  const opts = {
    output: null,
    title: null,
    requirementsDir: null,
    offline: false,
    noMermaid: false,
    filter: null,
    quiet: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '-h':
      case '--help':
        opts.help = true;
        break;
      case '-v':
      case '--version':
        opts.version = true;
        break;
      case '-o':
      case '--output':
        if (!next) {
          console.error('❌ --output 需要参数');
          process.exit(2);
        }
        opts.output = next;
        i++;
        break;
      case '-t':
      case '--title':
        if (!next) {
          console.error('❌ --title 需要参数');
          process.exit(2);
        }
        opts.title = next;
        i++;
        break;
      case '-r':
      case '--requirements-dir':
        if (!next) {
          console.error('❌ --requirements-dir 需要参数');
          process.exit(2);
        }
        opts.requirementsDir = next;
        i++;
        break;
      case '-f':
      case '--filter':
        if (!next) {
          console.error('❌ --filter 需要参数');
          process.exit(2);
        }
        opts.filter = next;
        i++;
        break;
      case '--offline':
        opts.offline = true;
        break;
      case '--no-mermaid':
        opts.noMermaid = true;
        break;
      case '-q':
      case '--quiet':
        opts.quiet = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`❌ 未知参数：${arg}`);
          console.error('   使用 --help 查看可用选项');
          process.exit(2);
        }
        break;
    }
  }

  return opts;
}

async function main() {
  const args = process.argv.slice(2);
  const opts = parseArgs(args);

  if (opts.help) {
    showHelp();
    process.exit(0);
  }
  if (opts.version) {
    console.log(`crs-export v${VERSION}`);
    process.exit(0);
  }

  // 参数冲突检查
  if (opts.offline && opts.noMermaid) {
    if (!opts.quiet) {
      console.warn('⚠️  --offline 与 --no-mermaid 冲突，忽略 --offline');
    }
    opts.offline = false;
  }

  const requirementsDir = path.resolve(opts.requirementsDir || path.join(process.cwd(), '.requirements'));
  const output = opts.output;

  if (!opts.quiet) {
    console.log('🚀 开始导出 CRS 报告...');
    console.log(`   需求目录：${requirementsDir}`);
    if (output) console.log(`   输出路径：${output}`);
    if (opts.title) console.log(`   报告标题：${opts.title}`);
    if (opts.offline) console.log('   离线模式：是');
    if (opts.noMermaid) console.log('   依赖图：禁用');
    console.log('');
  }

  try {
    const { exportReport } = await import('../scripts/export/index.js');

    const result = await exportReport({
      requirementsDir,
      output,
      options: {
        title: opts.title,
        offline: opts.offline,
        noMermaid: opts.noMermaid,
        hooks: {
          onWarning: (msg) => {
            if (!opts.quiet) console.warn(`⚠️  ${msg}`);
          },
        },
      },
    });

    if (!result.success) {
      console.error(`❌ 导出失败：${result.error || '未知错误'}`);
      process.exit(1);
    }

    if (!opts.quiet) {
      console.log(`✅ 导出成功`);
      console.log(`   文件：${result.output.path}`);
      console.log(`   大小：${(result.output.size / 1024).toFixed(1)} KB`);
      console.log(`   需求数：${result.meta.totalReqs}`);
      console.log(`   耗时：${result.output.durationMs} ms`);
      if (result.warnings.length) {
        console.log(`   警告：${result.warnings.length} 条`);
      }
    } else {
      console.log(result.output.path);
    }
    process.exit(0);
  } catch (error) {
    console.error(`❌ 执行异常：${error.message}`);
    if (!opts.quiet && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
