import fs from 'fs/promises';
import path from 'path';

/**
 * 对话记录存储工具类
 */
export class ConversationStorage {
  constructor(baseDir = null) {
    this.baseDir = baseDir || process.env.CONV_STORAGE_DIR || '.conversations';
    this.conversationsDir = path.join(this.baseDir, 'conversations');
  }

  /**
   * 初始化目录结构
   */
  async init() {
    await fs.mkdir(this.conversationsDir, { recursive: true });
  }

  /**
   * 保存对话记录
   */
  async saveConversation(conversation) {
    await this.init();
    const filePath = this.getConversationPath(conversation.id);
    await fs.writeFile(filePath, JSON.stringify(conversation, null, 2), 'utf-8');
  }

  /**
   * 加载对话记录
   */
  async loadConversation(conversationId) {
    const filePath = this.getConversationPath(conversationId);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 删除对话记录
   */
  async deleteConversation(conversationId) {
    const filePath = this.getConversationPath(conversationId);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * 列出所有对话记录
   */
  async listConversations(limit = 20) {
    await this.init();
    const files = await fs.readdir(this.conversationsDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const conversations = [];
    for (const file of jsonFiles.slice(0, limit)) {
      const content = await fs.readFile(path.join(this.conversationsDir, file), 'utf-8');
      conversations.push(JSON.parse(content));
    }

    return conversations.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  }

  /**
   * 加载所有对话记录
   */
  async loadAllConversations() {
    await this.init();
    const files = await fs.readdir(this.conversationsDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const conversations = [];
    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(this.conversationsDir, file), 'utf-8');
      conversations.push(JSON.parse(content));
    }

    return conversations;
  }

  /**
   * 获取对话文件路径
   */
  getConversationPath(conversationId) {
    return path.join(this.conversationsDir, `${conversationId}.json`);
  }
}

/**
 * 格式化辅助函数
 */
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toISOString().substring(0, 16).replace('T', ' ');
}
