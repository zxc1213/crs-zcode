import { ConversationLogger } from '../core/logger.js';

// 全局记录器实例
let globalLogger = null;

/**
 * 获取全局记录器实例
 * @returns {ConversationLogger}
 */
export function getConversationLogger() {
  return globalLogger;
}

/**
 * SessionStart Hook
 * 在会话开始时初始化记录器
 * @param {object} context - Hook 上下文
 * @returns {object} Hook 结果
 */
export async function sessionStart(context) {
  const logger = new ConversationLogger();
  const sessionId = await logger.startSession(null, {
    workingDir: context.workingDirectory,
    branch: context.gitBranch,
    user: context.user,
    type: 'session',
  });

  globalLogger = logger;

  return {
    continue: true,
    sessionId,
  };
}
