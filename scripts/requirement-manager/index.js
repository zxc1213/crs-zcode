/**
 * RequirementManager - 智能需求管理系统门面
 *
 * 只保留：handle() 入口（安全检查 → 解析 → 查询路由/创建委托）与 CLI。
 * 创建流 → core/creation-flow.js；变更/事件 → core/change-events.js；
 * 引擎动作 → core/processor.js（门面）及其下游模块。
 */

import { Processor } from './core/processor.js';
import { runCreationFlow } from './core/creation-flow.js';
import { handleChange, handleEvent } from './core/change-events.js';
import { STATUS_LABELS, STATUS_COLORS } from './core/schema.js';
import securityFilter from './features/security.js';
import { error } from './utils/logger.js';
import Dashboard from './ui/dashboard.js';
import path from 'path';
import chalk from 'chalk';

/**
 * RequirementManager 类
 */
class RequirementManager {
  /**
   * 构造函数
   * @param {string} baseDir - 基础目录路径
   */
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.processor = new Processor(baseDir);
    this.logPath = path.join(baseDir, '.crs', 'logs', 'requirement.log');
  }

  /**
   * 主处理方法
   * @param {string} input - 用户输入
   * @param {object} options - 选项对象
   * @returns {Promise<object>} 处理结果
   */
  async handle(input, options = {}) {
    try {
      // 1. 安全检查
      const securityCheck = this.performSecurityCheck(input);
      if (!securityCheck.safe) {
        return this.formatSecurityWarning(securityCheck);
      }

      // 2. 解析输入
      const parsed = this.parseInput(input, options);

      // 3. 处理查询命令
      if (this.isQueryCommand(parsed)) {
        return await this.handleQueryCommand(parsed);
      }

      // 4. 创建流（创建 + 执行计划 + 日志 + 格式化）
      return await runCreationFlow(this.processor, parsed, this.logPath);
    } catch (err) {
      await error('SYSTEM', `处理失败: ${err.message}`, this.logPath);
      return this.formatError(err);
    }
  }

  /**
   * 执行安全检查
   * @param {string} input - 用户输入
   * @returns {object} 安全检查结果
   */
  performSecurityCheck(input) {
    const filterResult = securityFilter.filterRequirement(input);

    return {
      safe: filterResult.safe,
      warnings: filterResult.report.warnings,
      severity: filterResult.report.severity,
      filtered: filterResult.filtered,
    };
  }

  /**
   * 格式化安全警告
   * @param {object} securityCheck - 安全检查结果
   * @returns {object} 格式化的警告
   */
  formatSecurityWarning(securityCheck) {
    const warnings = securityCheck.warnings.map((w) => w.message).join('\n  ');

    return {
      success: false,
      error: 'security_check_failed',
      message: `检测到敏感信息，无法继续：\n  ${warnings}`,
      severity: securityCheck.severity,
      suggestions: ['请移除敏感信息后重试', '不要包含密码、密钥、个人身份信息等', '使用占位符代替真实数据'],
    };
  }

  /**
   * 解析用户输入
   * @param {string} input - 用户输入
   * @param {object} options - 选项对象
   * @returns {object} 解析后的需求对象
   */
  parseInput(input, options) {
    // 使用 Processor 的静态方法解析类型
    const parsed = Processor.parseType(input);

    // 转换模式名称以匹配 scheduler 的期望
    const modeMapping = {
      full_auto: 'fully',
      semi_auto: 'semi',
      manual: 'manual',
    };

    // 合并选项
    return {
      ...parsed,
      mode: modeMapping[parsed.mode] || 'semi',
      ...options,
    };
  }

  /**
   * 检查是否是查询命令
   * @param {object} parsed - 解析后的对象
   * @returns {boolean}
   */
  isQueryCommand(parsed) {
    const queryCommands = ['--list', '--active', '--status', '--dashboard', '--history'];
    return queryCommands.some((cmd) => parsed.description.includes(cmd));
  }

  /**
   * 处理查询命令
   * @param {object} parsed - 解析后的对象
   * @returns {Promise<object>} 查询结果
   */
  async handleQueryCommand(parsed) {
    const description = parsed.description;
    const dashboard = new Dashboard(this.baseDir);

    if (description.includes('--list')) {
      await dashboard.show();
      return {
        success: true,
        action: 'list_requirements',
        message: '已显示所有需求',
      };
    }

    if (description.includes('--active')) {
      const active = await dashboard.getActiveRequirement();
      dashboard.showActive(active);
      return {
        success: true,
        action: 'list_active',
        message: '已显示活跃需求',
      };
    }

    if (description.includes('--dashboard')) {
      await dashboard.show();
      return {
        success: true,
        action: 'show_dashboard',
        message: '已显示需求仪表板',
      };
    }

    if (description.includes('--status')) {
      const id = description.replace('--status', '').trim();
      return await this.handleStatusQuery(id);
    }

    if (description.includes('--history')) {
      const limit = parseInt(description.replace('--history', '').trim(), 10);
      await dashboard.showHistory(Number.isInteger(limit) && limit > 0 ? limit : 20);
      return {
        success: true,
        action: 'show_history',
        message: '已显示历史时间线',
      };
    }

    return {
      success: false,
      error: 'unknown_query_command',
      message: '未知的查询命令',
    };
  }

  /**
   * 处理单个需求状态查询
   * @param {string} id - 需求 ID
   * @returns {Promise<object>} 查询结果
   */
  async handleStatusQuery(id) {
    if (!id) {
      return {
        success: false,
        error: 'missing_requirement_id',
        message: '用法: --status <需求ID>，例如 --status FEAT-20260908-001',
      };
    }

    let meta;
    try {
      meta = await this.processor.get(id);
    } catch (err) {
      return {
        success: false,
        error: 'requirement_not_found',
        message: `未找到需求 ${id}：${err.message}`,
        suggestions: ['用 --list 查看所有需求 ID', '检查 ID 前缀（FEAT/BUG/QUES/ADJU/REF）'],
      };
    }

    const labels = STATUS_LABELS;
    const colors = STATUS_COLORS;
    const status = labels[meta.status] ? meta.status : 'planning';
    const reqPath = this.processor.getRequirementPath(id);

    console.log(chalk.cyan(`📌 需求 ${meta.id}`));
    console.log(`${chalk.gray('  标题:')} ${meta.title || meta.description?.substring(0, 60) || '无标题'}`);
    console.log(`${chalk.gray('  类型:')} ${meta.type}`);
    console.log(`${chalk.gray('  状态:')} ${chalk[colors[status]](labels[status] || meta.status)}`);
    console.log(`${chalk.gray('  优先级:')} ${meta.priority_detail?.level || meta.priority || '未评估'}`);
    console.log(`${chalk.gray('  创建:')} ${meta.created || '未知'}`);
    if (meta.updatedAt) {
      console.log(`${chalk.gray('  更新:')} ${meta.updatedAt}`);
    }
    if (meta.completed) {
      console.log(`${chalk.gray('  完成:')} ${meta.completed}`);
    }
    if (meta.tags && meta.tags.length > 0) {
      console.log(`${chalk.gray('  标签:')} ${meta.tags.join(', ')}`);
    }
    if (reqPath) {
      console.log(`${chalk.gray('  路径:')} ${reqPath}`);
    }
    console.log('');

    return {
      success: true,
      action: 'show_status',
      requirementId: meta.id,
      status: meta.status,
      message: `已显示需求 ${meta.id} 的状态`,
    };
  }

  /**
   * 需求变更（req-change 流程的引擎落点，逻辑在 core/change-events.js）
   * @param {object} params - { id, level, reason }
   * @returns {Promise<object>} 处理结果
   */
  async handleChange(params = {}) {
    return handleChange(this.processor, params);
  }

  /**
   * 记录时间线事件（逻辑在 core/change-events.js）
   * @param {object} params - { type, id, title, summary }
   * @returns {Promise<object>} 处理结果
   */
  async handleEvent(params = {}) {
    return handleEvent(this.baseDir, params);
  }

  /**
   * 格式化错误
   * @param {Error} err - 错误对象
   * @returns {object} 格式化的错误
   */
  formatError(err) {
    return {
      success: false,
      error: err.code || 'processing_error',
      message: err.message,
      suggestions: ['检查输入格式是否正确', '查看日志获取详细信息', '确保有足够的文件系统权限'],
    };
  }

  /**
   * CLI 入口点
   * @param {string[]} args - 命令行参数
   */
  static async cli(args) {
    // 获取基础目录
    const baseDir = process.cwd();

    // 创建管理器实例
    const manager = new RequirementManager(baseDir);

    // 子命令：change / event（req-change 流程与时间线事件的引擎入口）
    if (args[0] === 'change' || args[0] === 'event') {
      const params = {};
      for (let i = 1; i < args.length; i++) {
        const flag = args[i];
        const next = args[i + 1];
        if (flag.startsWith('--') && next !== undefined && !next.startsWith('--')) {
          const key = flag.replace(/^--/, '');
          if (['id', 'level', 'reason', 'type', 'title', 'summary'].includes(key)) {
            params[key] = next;
            i++;
          }
        }
      }
      const result = args[0] === 'change' ? await manager.handleChange(params) : await manager.handleEvent(params);
      formatOutput(result);
      return;
    }

    // 处理命令行选项
    const options = {};
    let input = '';

    // 解析命令行参数
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // 处理选项
      if (arg === '--feature' || arg === '-f') {
        options.type = 'feature';
      } else if (arg === '--bug' || arg === '-b') {
        options.type = 'bug';
      } else if (arg === '--question' || arg === '-q') {
        options.type = 'question';
      } else if (arg === '--adjust' || arg === '-a') {
        options.type = 'adjustment';
      } else if (arg === '--refactor' || arg === '-r') {
        options.type = 'refactor';
      } else if (arg === '--auto') {
        options.mode = 'full_auto';
      } else if (arg === '--conservative') {
        options.mode = 'manual';
      } else if (arg.startsWith('--status=')) {
        input = `--status ${arg.replace('--status=', '')}`;
      } else if (arg.startsWith('--history=')) {
        input = `--history ${arg.replace('--history=', '')}`;
      } else if (arg === '--dashboard' || arg === '--list' || arg === '--active' || arg === '--status' || arg === '--history') {
        // 查询命令，添加到输入前面
        input = input ? `${input} ${arg}` : arg;
      } else if (!arg.startsWith('--')) {
        // 不是选项的参数作为描述
        input = input ? `${input} ${arg}` : arg;
      } else {
        // 其他选项添加到输入中
        input = input ? `${input} ${arg}` : arg;
      }
    }

    // 如果没有输入，使用默认描述
    if (!input) {
      input = '创建新需求';
    }

    // 处理输入
    const result = await manager.handle(input, options);

    // 对于查询命令，不需要格式化输出（Dashboard 已经输出）
    if (result.action && ['show_dashboard', 'list_requirements', 'list_active', 'show_history'].includes(result.action)) {
      return;
    }

    // 输出结果
    formatOutput(result);
  }
}

/**
 * 格式化输出到终端
 * @param {object} result - 处理结果
 */
function formatOutput(result) {
  console.log(chalk.cyan('📋 需求管理系统\n'));

  if (!result.success) {
    console.log(chalk.red(`✗ 错误: ${result.message}`));
    if (result.suggestions) {
      console.log(chalk.yellow('\n建议:'));
      result.suggestions.forEach((s) => console.log(`  • ${s}`));
    }
    return;
  }

  // 变更/事件子命令结果
  if (result.action === 'requirement_changed' || result.action === 'timeline_event') {
    console.log(chalk.green(`✓ ${result.message}`));
    if (result.updatedDocs?.length) {
      console.log(chalk.gray(`  已更新文档: ${result.updatedDocs.join(', ')}`));
    }
    return;
  }

  // 需求信息
  if (result.requirement) {
    console.log(`${chalk.gray('类型:')} ${result.requirement.type}`);
    console.log(`${chalk.gray('模式:')} ${result.executionPlan.modeDescription}`);
    console.log(`${chalk.gray('描述:')} ${result.requirement.description}\n`);
    console.log(chalk.green(`✓ 需求已创建: ${result.requirement.id}\n`));
  }

  // 执行计划
  if (result.executionPlan) {
    console.log(chalk.cyan('执行计划:'));
    console.log(`  总步骤数: ${result.executionPlan.totalSteps}`);
    console.log(`  检查点数: ${result.executionPlan.checkpoints}\n`);
  }

  // 下一步
  if (result.nextSteps && result.nextSteps.length > 0) {
    console.log(chalk.cyan('下一步:'));
    result.nextSteps.forEach((step, index) => {
      if (step.action === 'call_skill') {
        console.log(`  ${index + 1}. 调用 skill: ${chalk.yellow(step.skill)}`);
        console.log(`     ${step.description}`);
        if (step.prompt) {
          console.log(chalk.gray(`     提示: ${step.prompt.substring(0, 100)}...`));
        }
      } else {
        console.log(`  ${index + 1}. ${step.description}`);
      }
    });
  }

  // 查询命令结果
  if (result.action) {
    console.log(chalk.cyan(`操作: ${result.action}`));
    console.log(chalk.gray(result.message));
    if (result.implementation) {
      console.log(chalk.yellow(`\n待实现: ${result.implementation}`));
    }
  }
}

// 导出
export default RequirementManager;
export { formatOutput };

// CLI 入口（如果直接运行此文件）
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  RequirementManager.cli(process.argv.slice(2)).catch((err) => {
    console.error('CLI 错误:', err);
    process.exit(1);
  });
}
