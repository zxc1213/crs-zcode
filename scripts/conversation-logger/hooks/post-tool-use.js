import { getConversationLogger } from './session-start.js';

/**
 * PostToolUse Hook
 * 在每次工具调用后记录事件
 * @param {object} context - Hook 上下文
 * @param {object} result - 工具调用结果
 * @returns {object} Hook 结果
 */
export async function postToolUse(context, result) {
  try {
    const logger = getConversationLogger();

    if (logger && logger.getStatus() === 'active') {
      await logger.captureEvent('tool_use', {
        tool: result.tool,
        args: result.input,
        success: result.success,
        duration: result.duration,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    // 静默失败，不影响主流程
    console.error('Conversation logger error:', error.message);
  }

  return { continue: true };
}
