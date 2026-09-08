import Fuse from 'fuse.js';
import { ConversationStorage } from '../utils/storage.js';

/**
 * Fuse.js 搜索引擎
 */
export class FuseSearchEngine {
  constructor(options = {}) {
    this.fuseOptions = {
      keys: [
        { name: 'messages.content', weight: 0.5 },
        { name: 'metadata.tags', weight: 0.3 },
        { name: 'metadata.summary', weight: 0.2 },
      ],
      threshold: options.threshold || 0.3,
      includeScore: true,
      includeMatches: true,
    };
  }

  async search(query, options = {}) {
    const { limit = 10, filters = {} } = options;

    try {
      const storage = new ConversationStorage();
      const conversations = await storage.loadAllConversations();
      const filtered = this.applyFilters(conversations, filters);
      const fuse = new Fuse(filtered, this.fuseOptions);
      const results = fuse.search(query);
      const limited = results.slice(0, limit);

      return {
        success: true,
        query,
        total: results.length,
        results: limited.map((r) => ({
          conversation: r.item,
          score: r.score,
          matches: r.matches,
        })),
      };
    } catch (error) {
      return {
        success: false,
        query,
        error: error.message,
        results: [],
      };
    }
  }

  applyFilters(conversations, filters) {
    let filtered = [...conversations];

    if (filters.dateFrom) {
      filtered = filtered.filter((c) => new Date(c.startTime) >= new Date(filters.dateFrom));
    }

    if (filters.dateTo) {
      filtered = filtered.filter((c) => new Date(c.startTime) <= new Date(filters.dateTo));
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter((c) => c.metadata.tags && filters.tags.some((t) => c.metadata.tags.includes(t)));
    }

    if (filters.status) {
      filtered = filtered.filter((c) => c.metadata.status === filters.status);
    }

    return filtered;
  }

  formatResults(searchResult, format = 'table') {
    if (searchResult.results.length === 0) {
      return `未找到匹配 "${searchResult.query}" 的对话记录`;
    }

    if (format === 'table') {
      return this.formatAsTable(searchResult);
    } else if (format === 'json') {
      return JSON.stringify(searchResult, null, 2);
    } else if (format === 'markdown') {
      return this.formatAsMarkdown(searchResult);
    }
  }

  formatAsTable(searchResult) {
    const lines = [];
    lines.push(`找到 ${searchResult.total} 条匹配 "${searchResult.query}" 的记录:\n`);
    lines.push('┌─────────────────────────────────────┬──────────────────┬────────────┬──────────┐');
    lines.push('│ ID                                  │ 开始时间         │ 相关性     │ 状态     │');
    lines.push('├─────────────────────────────────────┼──────────────────┼────────────┼──────────┤');

    for (const result of searchResult.results) {
      const conv = result.conversation;
      const id = conv.id.substring(0, 35);
      const startTime = this.formatDate(conv.startTime);
      const relevance = this.formatScore(result.score);
      const status = conv.metadata.status || 'active';

      lines.push(`│ ${id.padEnd(35)} │ ${startTime.padEnd(16)} │ ${relevance.padStart(8)} │ ${status.padEnd(8)} │`);
    }

    lines.push('└─────────────────────────────────────┴──────────────────┴────────────┴──────────┘');
    return lines.join('\n');
  }

  formatAsMarkdown(searchResult) {
    const lines = [];
    lines.push(`# 搜索结果: "${searchResult.query}" (${searchResult.total} 条)\n`);
    lines.push('| ID | 开始时间 | 相关性 | 状态 |');
    lines.push('|---|---|---|---|');

    for (const result of searchResult.results) {
      const conv = result.conversation;
      const startTime = this.formatDate(conv.startTime);
      const relevance = this.formatScore(result.score);
      const status = conv.metadata.status || 'active';

      lines.push(`| ${conv.id} | ${startTime} | ${relevance} | ${status} |`);
    }

    return lines.join('\n');
  }

  formatScore(score) {
    const percentage = Math.round((1 - score) * 100);
    return `${percentage}%`;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toISOString().substring(0, 16).replace('T', ' ');
  }
}

export async function main(argv) {
  const query = argv._[0];
  if (!query) {
    console.error('错误: 请提供搜索关键词');
    process.exit(1);
  }

  const options = {
    limit: parseInt(argv.limit || argv.l || 10),
    threshold: parseFloat(argv.threshold || argv.t || 0.3),
    filters: {
      dateFrom: argv['date-from'],
      dateTo: argv['date-to'],
      tags: argv.tags ? argv.tags.split(',') : [],
      status: argv.status,
    },
  };

  const format = argv.format || argv.f || 'table';

  const engine = new FuseSearchEngine({ threshold: options.threshold });
  const result = await engine.search(query, options);

  if (result.success) {
    console.log(engine.formatResults(result, format));
  } else {
    console.error(`搜索失败: ${result.error}`);
    process.exit(1);
  }
}
