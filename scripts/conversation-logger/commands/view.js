import { ConversationStorage } from '../utils/storage.js';
import { ConversationFormatter } from '../core/formatter.js';

/**
 * 查看对话详情
 */
export async function viewConversation(conversationId, options = {}) {
  const { format = 'pretty' } = options;

  try {
    const storage = new ConversationStorage();
    const conversation = await storage.loadConversation(conversationId);

    if (!conversation) {
      return {
        success: false,
        message: `对话 ${conversationId} 不存在`,
      };
    }

    const formatter = new ConversationFormatter();
    let output = '';

    if (format === 'pretty') {
      output = formatter.formatPretty(conversation);
    } else if (format === 'json') {
      output = JSON.stringify(conversation, null, 2);
    } else if (format === 'markdown') {
      output = formatter.formatMarkdown(conversation);
    } else if (format === 'compact') {
      output = formatter.formatCompact(conversation);
    }

    return {
      success: true,
      conversation,
      output,
    };
  } catch (error) {
    return {
      success: false,
      message: `查看对话失败: ${error.message}`,
      error: error.toString(),
    };
  }
}

/**
 * CLI 入口
 */
export async function main(argv) {
  const conversationId = argv._[0];
  if (!conversationId) {
    console.error('错误: 请提供对话 ID');
    process.exit(1);
  }

  const format = argv.format || argv.f || 'pretty';

  const result = await viewConversation(conversationId, { format });

  if (result.success) {
    console.log(result.output);
  } else {
    console.error(result.message);
    process.exit(1);
  }
}
