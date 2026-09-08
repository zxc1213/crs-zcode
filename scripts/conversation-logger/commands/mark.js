import { ConversationStorage } from '../utils/storage.js';

/**
 * 标记对话（添加标签、状态、摘要）
 */
export async function markConversation(conversationId, options = {}) {
  const { tags, status, summary, rating } = options;

  try {
    const storage = new ConversationStorage();
    const conversation = await storage.loadConversation(conversationId);

    if (!conversation) {
      return {
        success: false,
        message: `对话 ${conversationId} 不存在`,
      };
    }

    // 更新元数据
    const metadata = conversation.metadata || {};

    if (tags) {
      const newTags = tags.split(',').map((t) => t.trim().replace(/^#/, ''));
      metadata.tags = [...new Set([...(metadata.tags || []), ...newTags])];
    }

    if (status) {
      if (!['active', 'archived', 'important'].includes(status)) {
        return {
          success: false,
          message: `无效的状态值: ${status}。允许的值: active, archived, important`,
        };
      }
      metadata.status = status;
    }

    if (summary) {
      metadata.summary = summary;
    }

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return {
          success: false,
          message: `评分必须在 1-5 之间`,
        };
      }
      metadata.rating = rating;
    }

    // 保存更新
    conversation.metadata = metadata;
    await storage.saveConversation(conversation);

    return {
      success: true,
      message: `对话 ${conversationId} 已更新`,
      conversation,
    };
  } catch (error) {
    return {
      success: false,
      message: `标记对话失败: ${error.message}`,
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

  const options = {
    tags: argv.tags || argv.t,
    status: argv.status || argv.s,
    summary: argv.summary || argv.m,
    rating: argv.rating ? parseInt(argv.rating) : undefined,
  };

  // 检查至少有一个操作
  if (!options.tags && !options.status && !options.summary && options.rating === undefined) {
    console.error('错误: 请指定至少一个标记操作（--tags, --status, --summary, --rating）');
    process.exit(1);
  }

  const result = await markConversation(conversationId, options);

  if (result.success) {
    console.log(result.message);
    console.log(`\n当前元数据:`);
    console.log(`  状态: ${result.conversation.metadata.status || '未设置'}`);
    console.log(`  标签: ${(result.conversation.metadata.tags || []).join(', ') || '无'}`);
    console.log(`  摘要: ${result.conversation.metadata.summary || '无'}`);
    console.log(`  评分: ${result.conversation.metadata.rating || '未评分'}`);
  } else {
    console.error(result.message);
    process.exit(1);
  }
}
