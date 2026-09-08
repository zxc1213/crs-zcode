import { ConversationStorage } from '../utils/storage.js';

/**
 * 生成对话统计信息
 */
export async function generateStats(options = {}) {
  try {
    const storage = new ConversationStorage();
    const conversations = await storage.loadAllConversations();

    if (conversations.length === 0) {
      return {
        success: true,
        message: '暂无对话记录',
        stats: null,
      };
    }

    const stats = {
      total: conversations.length,
      byStatus: {},
      byTag: {},
      byRating: {},
      totalMessages: 0,
      totalTools: 0,
      averageMessages: 0,
      averageRating: 0,
      recentActivity: [],
    };

    // 统计各项指标
    let ratingSum = 0;
    let ratingCount = 0;

    for (const conv of conversations) {
      const metadata = conv.metadata || {};

      // 按状态统计
      const status = metadata.status || 'active';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // 按标签统计
      const tags = metadata.tags || [];
      for (const tag of tags) {
        stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
      }

      // 按评分统计
      if (metadata.rating) {
        stats.byRating[metadata.rating] = (stats.byRating[metadata.rating] || 0) + 1;
        ratingSum += metadata.rating;
        ratingCount++;
      }

      // 消息统计
      const messageCount = metadata.messageCount || 0;
      stats.totalMessages += messageCount;

      // 工具调用统计
      const toolCalls = metadata.toolCalls || 0;
      stats.totalTools += toolCalls;

      // 最近活动
      stats.recentActivity.push({
        id: conv.id,
        startTime: conv.startTime,
        messageCount,
        status,
      });
    }

    // 计算平均值
    stats.averageMessages = stats.total > 0 ? Math.round(stats.totalMessages / stats.total) : 0;

    stats.averageRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;

    // 排序最近活动
    stats.recentActivity.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    stats.recentActivity = stats.recentActivity.slice(0, 10);

    return {
      success: true,
      stats,
    };
  } catch (error) {
    return {
      success: false,
      message: `生成统计失败: ${error.message}`,
      error: error.toString(),
    };
  }
}

/**
 * 格式化统计信息
 */
export function formatStats(statsResult, format = 'table') {
  if (!statsResult.stats) {
    return statsResult.message;
  }

  const stats = statsResult.stats;

  if (format === 'table') {
    return formatAsTable(stats);
  } else if (format === 'json') {
    return JSON.stringify(stats, null, 2);
  } else if (format === 'markdown') {
    return formatAsMarkdown(stats);
  }
}

/**
 * 格式化为表格
 */
function formatAsTable(stats) {
  const lines = [];
  lines.add('╔═══════════════════════════════════════════════════════════════╗');
  lines.add('║                    对话记录统计信息                            ║');
  lines.add('╚═══════════════════════════════════════════════════════════════╝');
  lines.add('');
  lines.add(`总对话数: ${stats.total}`);
  lines.add(`总消息数: ${stats.totalMessages}`);
  lines.add(`总工具调用: ${stats.totalTools}`);
  lines.add(`平均消息数: ${stats.averageMessages}`);
  lines.add(`平均评分: ${stats.averageRating}/5`);
  lines.add('');
  lines.add('┌─────────────────────────────────────┬──────────┐');
  lines.add('│ 状态                                │ 数量     │');
  lines.add('├─────────────────────────────────────┼──────────┤');

  for (const [status, count] of Object.entries(stats.byStatus)) {
    lines.add(`│ ${status.padEnd(35)} │ ${String(count).padStart(8)} │`);
  }

  lines.add('└─────────────────────────────────────┴──────────┘');
  lines.add('');
  lines.add('┌─────────────────────────────────────┬──────────┐');
  lines.add('│ 标签                                │ 使用次数 │');
  lines.add('├─────────────────────────────────────┼──────────┤');

  const sortedTags = Object.entries(stats.byTag)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [tag, count] of sortedTags) {
    lines.add(`│ ${tag.padEnd(35)} │ ${String(count).padStart(8)} │`);
  }

  lines.add('└─────────────────────────────────────┴──────────┘');

  if (stats.recentActivity.length > 0) {
    lines.add('');
    lines.add('最近活动:');
    lines.add('┌─────────────────────────────────────┬──────────────────┬────────────┐');
    lines.add('│ ID                                  │ 开始时间         │ 消息数     │');
    lines.add('├─────────────────────────────────────┼──────────────────┼────────────┤');

    for (const activity of stats.recentActivity.slice(0, 5)) {
      const id = activity.id.substring(0, 35);
      const startTime = formatDate(activity.startTime);
      lines.add(`│ ${id.padEnd(35)} │ ${startTime.padEnd(16)} │ ${String(activity.messageCount).padStart(8)} │`);
    }

    lines.add('└─────────────────────────────────────┴──────────────────┴────────────┘');
  }

  return lines.join('\n');
}

/**
 * 格式化为 Markdown
 */
function formatAsMarkdown(stats) {
  const lines = [];
  lines.add(`# 对话记录统计\n`);
  lines.add(`- **总对话数**: ${stats.total}`);
  lines.add(`- **总消息数**: ${stats.totalMessages}`);
  lines.add(`- **总工具调用**: ${stats.totalTools}`);
  lines.add(`- **平均消息数**: ${stats.averageMessages}`);
  lines.add(`- **平均评分**: ${stats.averageRating}/5\n`);
  lines.add(`## 状态分布\n`);
  lines.add(`| 状态 | 数量 |`);
  lines.add(`|------|------|`);

  for (const [status, count] of Object.entries(stats.byStatus)) {
    lines.add(`| ${status} | ${count} |`);
  }

  lines.add(`\n## 标签使用排行\n`);
  lines.add(`| 标签 | 使用次数 |`);
  lines.add(`|------|----------|`);

  const sortedTags = Object.entries(stats.byTag)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [tag, count] of sortedTags) {
    lines.add(`| ${tag} | ${count} |`);
  }

  return lines.join('\n');
}

/**
 * 格式化日期
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toISOString().substring(0, 16).replace('T', ' ');
}

/**
 * CLI 入口
 */
export async function main(argv) {
  const format = argv.format || argv.f || 'table';

  const result = await generateStats();

  if (result.success) {
    console.log(formatStats(result, format));
  } else {
    console.error(result.message);
    process.exit(1);
  }
}
