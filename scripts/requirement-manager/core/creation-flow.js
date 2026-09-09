/**
 * 创建流 - handle() 创建分支的完整编排
 *
 * 落盘（processor.create）→ 执行计划（scheduler）→ 日志 → 结果格式化。
 * index.js 门面只负责路由到这里。
 */

import { schedule, generateSkillPrompt } from './scheduler.js';
import { info, success } from '../utils/logger.js';

/**
 * 执行创建分支：创建需求 + 生成执行计划 + 记录日志
 * @param {object} processor - Processor 实例
 * @param {object} parsed - 解析后的输入 { type, mode, description }
 * @param {string} logPath - 日志路径
 * @returns {Promise<object>} 格式化的结果对象
 */
export async function runCreationFlow(processor, parsed, logPath) {
  const { type, mode, description } = parsed;

  // 创建需求
  const created = await processor.create(parsed);
  const requirement = { id: created.id, path: created.path, type, mode, description };

  // 生成执行计划（失败降级为基础计划，不阻塞创建）
  let executionPlan;
  try {
    executionPlan = schedule(requirement);
  } catch (err) {
    executionPlan = {
      requirementId: requirement.id,
      type: requirement.type,
      mode: requirement.mode,
      modeDescription: '半自动执行',
      steps: [],
      checkpoints: [],
      metadata: {
        primarySkill: 'brainstorming',
        optionalSkills: [],
        totalSteps: 0,
        totalCheckpoints: 0,
      },
      error: err.message,
    };
  }

  await logCreation(requirement, executionPlan, logPath);

  return formatResult(requirement, executionPlan);
}

/**
 * 记录创建日志
 */
async function logCreation(requirement, executionPlan, logPath) {
  await success(requirement.id, `需求已创建: ${requirement.type} - ${requirement.description.substring(0, 50)}`, logPath);

  const totalSteps = executionPlan.metadata?.totalSteps || 0;
  await info(requirement.id, `执行模式: ${executionPlan.modeDescription}, 步骤数: ${totalSteps}`, logPath);
}

/**
 * 格式化创建结果
 */
function formatResult(requirement, executionPlan) {
  const firstStep = executionPlan.steps && executionPlan.steps.length > 0 ? executionPlan.steps[0] : null;

  return {
    success: true,
    requirement: {
      id: requirement.id,
      type: requirement.type,
      mode: requirement.mode,
      description: requirement.description,
    },
    executionPlan: {
      mode: executionPlan.mode,
      modeDescription: executionPlan.modeDescription,
      totalSteps: executionPlan.metadata?.totalSteps || 0,
      checkpoints: executionPlan.checkpoints?.length || 0,
    },
    nextSteps: generateNextSteps(requirement, executionPlan, firstStep),
  };
}

/**
 * 生成下一步操作
 */
function generateNextSteps(requirement, executionPlan, firstStep) {
  const steps = [];

  // 第一步：调用 skill
  if (firstStep) {
    steps.push({
      action: 'call_skill',
      skill: firstStep.skill,
      description: `使用 ${firstStep.skill} skill 分析需求`,
      prompt: generateSkillPrompt(firstStep.skill, {
        id: requirement.id,
        type: requirement.type,
        description: requirement.description,
      }),
    });
  }

  // 后续步骤提示
  if (executionPlan.steps.length > 1) {
    steps.push({
      action: 'continue_workflow',
      description: `完成后继续执行剩余 ${executionPlan.steps.length - 1} 个步骤`,
    });
  }

  return steps;
}
