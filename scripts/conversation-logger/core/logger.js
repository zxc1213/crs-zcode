import fs from 'fs';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import path from 'path';
import { SessionManager } from './session-manager.js';
import { ContentFormatter } from './formatter.js';
import { generateSessionId } from './id-generator.js';

/**
 * 对话记录器
 * 核心记录逻辑，协调会话管理和格式化
 */
export class ConversationLogger {
  /**
   * @param {string} baseDir - 基础目录
   */
  constructor(baseDir = '.conversations') {
    this.baseDir = baseDir;
    this.sessionManager = new SessionManager();
    this.formatter = new ContentFormatter();
    this.currentSessionId = null;
  }

  /**
   * 启动新会话
   * @param {string} sessionId - 会话 ID（可选，自动生成）
   * @param {object} metadata - 元数据
   */
  async startSession(sessionId = null, metadata = {}) {
    this.currentSessionId = sessionId || generateSessionId();

    // 创建日期目录
    const parsed = this.currentSessionId.match(/sess-(\d{8})-(\d{6})-\d{3}/);
    if (parsed) {
      const date = parsed[1];
      const year = date.slice(0, 4);
      const month = date.slice(4, 6);
      const day = date.slice(6, 8);

      const sessionDir = path.join(this.baseDir, year, month, day);
      mkdirSync(sessionDir, { recursive: true });
    }

    this.sessionManager.createSession(this.currentSessionId, metadata);
    return this.currentSessionId;
  }

  /**
   * 获取当前会话 ID
   * @returns {string|null}
   */
  getSessionId() {
    return this.currentSessionId;
  }

  /**
   * 获取当前状态
   * @returns {string}
   */
  getStatus() {
    if (!this.currentSessionId) {
      return 'idle';
    }

    const session = this.sessionManager.getSession(this.currentSessionId);
    return session ? session.status : 'unknown';
  }

  /**
   * 捕获事件
   * @param {string} eventType - 事件类型
   * @param {object} data - 事件数据
   */
  async captureEvent(eventType, data = {}) {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }

    this.sessionManager.addEvent(this.currentSessionId, {
      type: eventType,
      ...data,
    });
  }

  /**
   * 标记为重要
   * @param {string} reason - 原因
   */
  async markImportant(reason) {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }

    this.sessionManager.markImportant(this.currentSessionId, reason);
  }

  /**
   * 获取事件列表
   * @returns {Array}
   */
  async getEvents() {
    if (!this.currentSessionId) {
      return [];
    }

    const session = this.sessionManager.getSession(this.currentSessionId);
    return session ? session.events : [];
  }

  /**
   * 获取元数据
   * @returns {object}
   */
  async getMetadata() {
    if (!this.currentSessionId) {
      return {};
    }

    const session = this.sessionManager.getSession(this.currentSessionId);
    return session ? session.metadata : {};
  }

  /**
   * 结束会话并保存
   * @param {object} summary - 额外摘要信息
   * @returns {object} 保存结果
   */
  async endSession(summary = {}) {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }

    const sessionSummary = this.sessionManager.endSessionById(this.currentSessionId);
    const session = this.sessionManager.getSession(this.currentSessionId);

    // 生成文件路径
    const filepath = this._getFilePath(this.currentSessionId);

    // 格式化并保存
    const doc = this.formatter.formatDocument(session);
    writeFileSync(filepath, doc, 'utf8');

    // 保存元数据
    const metaPath = filepath.replace('.md', '.meta.json');
    writeFileSync(
      metaPath,
      JSON.stringify(
        {
          id: this.currentSessionId,
          ...session.metadata,
          startTime: session.startTime,
          endTime: session.endTime,
          eventCount: session.events.length,
        },
        null,
        2
      )
    );

    const result = {
      filepath,
      metaPath,
      ...sessionSummary,
      ...summary,
    };

    this.currentSessionId = null;
    return result;
  }

  /**
   * 获取文件路径
   * @private
   */
  _getFilePath(sessionId) {
    const parsed = sessionId.match(/sess-(\d{8})-(\d{6})-\d{3}/);
    if (!parsed) {
      return path.join(this.baseDir, `${sessionId}.md`);
    }

    const date = parsed[1];
    const year = date.slice(0, 4);
    const month = date.slice(4, 6);
    const day = date.slice(6, 8);

    return path.join(this.baseDir, year, month, day, `${sessionId}.md`);
  }
}
