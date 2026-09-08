import { getConversationLogger } from './session-start.js';

/**
 * Stop Hook
 * 在会话结束时保存记录
 * @param {object} context - Hook 上下文
 * @returns {object} Hook 结果
 */
export async function stop(context) {
  try {
    const logger = getConversationLogger();

    if (logger && logger.getStatus() === 'active') {
      const summary = await logger.endSession({
        endTime: new Date().toISOString(),
      });

      console.log(`📝 对话已保存: ${summary.filepath}`);
      console.log(`   消息数: ${summary.messageCount}`);
      console.log(`   工具调用: ${summary.toolCallCount}`);

      return {
        continue: true,
        summary,
      };
    }
  } catch (error) {
    // 静默失败，不影响主流程
    console.error('Conversation logger error:', error.message);
  }

  return { continue: true };
}
