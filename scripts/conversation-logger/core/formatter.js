/**
 * 内容格式化器
 * 将事件转换为 Markdown 格式
 */
export class ContentFormatter {
  /**
   * 格式化时间戳
   * @param {string} isoString - ISO 时间字符串
   * @returns {string} HH:MM:SS 格式
   */
  formatTimestamp(isoString) {
    const date = new Date(isoString);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * 格式化单个事件
   * @param {object} event - 事件对象
   * @returns {string} Markdown 格式的事件
   */
  formatEvent(event) {
    const time = this.formatTimestamp(event.timestamp);

    switch (event.type) {
      case 'user_message':
        return `### 用户消息\n\n[${time}] ${event.content}\n`;

      case 'ai_response':
        return `### AI 响应\n\n[${time}] ${event.content}\n`;

      case 'tool_use': {
        const args = event.args ? `: ${JSON.stringify(event.args)}` : '';
        return `- [${time}] \`${event.tool}${args}\`\n`;
      }

      default:
        return `- [${time}] ${event.type}\n`;
    }
  }

  /**
   * 格式化完整文档
   * @param {object} session - 会话对象
   * @returns {string} 完整 Markdown 文档
   */
  formatDocument(session) {
    const { sessionId, metadata, events } = session;
    const date = new Date().toISOString().slice(0, 10);

    let doc = `# 对话记录 - ${date}\n\n`;
    doc += `## 元数据\n\n`;
    doc += `- **会话ID**: ${sessionId}\n`;

    if (metadata.type) {
      doc += `- **类型**: ${metadata.type}\n`;
    }

    if (metadata.important) {
      doc += `- **重要**: ⭐ ${metadata.reason || ''}\n`;
    }

    doc += `\n## 对话内容\n\n`;

    // 按类型分组
    const userMessages = events.filter((e) => e.type === 'user_message');
    const aiResponses = events.filter((e) => e.type === 'ai_response');
    const toolCalls = events.filter((e) => e.type === 'tool_use');

    // 用户消息
    if (userMessages.length > 0) {
      doc += `### 用户消息\n\n`;
      userMessages.forEach((event) => {
        doc += this.formatEvent(event);
      });
      doc += `\n`;
    }

    // AI 响应
    if (aiResponses.length > 0) {
      doc += `### AI 响应\n\n`;
      aiResponses.forEach((event) => {
        doc += this.formatEvent(event);
      });
      doc += `\n`;
    }

    // 工具调用
    if (toolCalls.length > 0) {
      doc += `### 工具调用\n\n`;
      toolCalls.forEach((event) => {
        doc += this.formatEvent(event);
      });
    }

    return doc;
  }
}

/**
 * 对话记录格式化器
 */
export class ConversationFormatter {
  /**
   * 格式化为美化格式
   */
  formatPretty(conversation) {
    const lines = [];
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(`  对话 ID: ${conversation.id}`);
    lines.push(`  开始时间: ${this.formatDateTime(conversation.startTime)}`);
    lines.push(`  状态: ${conversation.metadata?.status || 'active'}`);
    lines.push(`  标签: ${(conversation.metadata?.tags || []).join(' ') || '无'}`);
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');

    for (const msg of conversation.messages || []) {
      const time = this.formatTimestamp(msg.timestamp);
      const role = this.formatRole(msg.role);
      lines.push(`[${time}] ${role} ${msg.content}`);
    }

    return lines.join('\n');
  }

  /**
   * 格式化为 Markdown
   */
  formatMarkdown(conversation) {
    const lines = [];
    lines.push(`# 对话记录: ${conversation.id}\n`);
    lines.push(`**开始时间**: ${this.formatDateTime(conversation.startTime)}  \n`);
    lines.push(`**状态**: ${conversation.metadata?.status || 'active'}  \n`);
    lines.push(`**标签**: ${(conversation.metadata?.tags || []).join(', ') || '无'}\n`);
    lines.push('## 对话内容\n');

    for (const msg of conversation.messages || []) {
      const time = this.formatTimestamp(msg.timestamp);
      const role = this.formatRole(msg.role);
      lines.push(`### [${time}] ${role}`);
      lines.push(`${msg.content}\n`);
    }

    return lines.join('\n');
  }

  /**
   * 格式化为紧凑格式
   */
  formatCompact(conversation) {
    const msgCount = conversation.messages?.length || 0;
    const status = conversation.metadata?.status || 'active';
    const startTime = this.formatDateTime(conversation.startTime);

    return `${conversation.id} | ${startTime} | ${status} | ${msgCount} 消息`;
  }

  /**
   * 格式化日期时间
   */
  formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toISOString().substring(0, 19).replace('T', ' ');
  }

  /**
   * 格式化时间戳
   */
  formatTimestamp(isoString) {
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * 格式化角色
   */
  formatRole(role) {
    const roles = {
      user: '👤 用户:',
      assistant: '🤖 助手:',
      tool: '🔧 工具:',
    };
    return roles[role] || role;
  }
}
