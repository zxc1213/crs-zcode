import { ConversationStorage } from '../utils/storage.js';
import { formatDate } from '../utils/helpers.js';

/**
 * 列出所有对话记录
 */
export async function listConversations(options = {}) {
  const { limit = 20, format = 'table' } = options;

  try {
    const storage = new ConversationStorage();
    const conversations = await storage.listConversations(limit);

    if (conversations.length === 0) {
      return {
        success: true,
        message: '暂无对话记录',
        data: [],
      };
    }

    let output = '';

    if (format === 'table') {
      output = formatAsTable(conversations);
    } else if (format === 'json') {
      output = JSON.stringify(conversations, null, 2);
    } else if (format === 'markdown') {
      output = formatAsMarkdown(conversations);
    }

    return {
      success: true,
      message: `找到 ${conversations.length} 条对话记录`,
      data: conversations,
      output,
    };
  } catch (error) {
    return {
      success: false,
      message: `列出对话失败: ${error.message}`,
      error: error.toString(),
    };
  }
}

/**
 * 格式化为表格
 */
function formatAsTable(conversations) {
  const lines = [];
  lines.push('┌─────────────────────────────────────┬──────────────────┬────────────┬──────────┐');
  lines.push('│ ID                                  │ 开始时间         │ 消息数     │ 状态     │');
  lines.push('├─────────────────────────────────────┼──────────────────┼────────────┼──────────┤');

  for (const conv of conversations) {
    const id = conv.id.substring(0, 35);
    const startTime = formatDate(conv.startTime);
    const messageCount = conv.metadata.messageCount || 0;
    const status = conv.metadata.status || 'active';

    lines.push(`│ ${id.padEnd(35)} │ ${startTime.padEnd(16)} │ ${String(messageCount).padStart(8)} │ ${status.padEnd(8)} │`);
  }

  lines.push('└─────────────────────────────────────┴──────────────────┴────────────┴──────────┘');

  return lines.join('\n');
}

/**
 * 格式化为 Markdown
 */
function formatAsMarkdown(conversations) {
  const lines = [];
  lines.push(`# 对话记录列表 (${conversations.length} 条)\n`);
  lines.push('| ID | 开始时间 | 消息数 | 状态 |');
  lines.push('|---|---|---|---|');

  for (const conv of conversations) {
    const startTime = formatDate(conv.startTime);
    const messageCount = conv.metadata.messageCount || 0;
    const status = conv.metadata.status || 'active';

    lines.push(`| ${conv.id} | ${startTime} | ${messageCount} | ${status} |`);
  }

  return lines.join('\n');
}

/**
 * CLI 入口
 */
export async function main(argv) {
  const options = {
    limit: parseInt(argv.limit || argv.l || 20),
    format: argv.format || argv.f || 'table',
  };

  const result = await listConversations(options);

  if (result.success) {
    console.log(result.output || result.message);
  } else {
    console.error(result.message);
    process.exit(1);
  }
}
