/**
 * 会话管理器
 * 管理活跃会话的状态和事件
 */
export class SessionManager {
  constructor(baseDir = null) {
    this.sessions = new Map();
    this.baseDir = baseDir || process.env.CONV_STORAGE_DIR || '.conversations';
  }

  /**
   * 创建新会话
   * @param {string} sessionId - 会话 ID
   * @param {object} metadata - 元数据
   */
  createSession(sessionId, metadata = {}) {
    this.sessions.set(sessionId, {
      id: sessionId,
      status: 'active',
      startTime: new Date().toISOString(),
      metadata,
      events: [],
    });
  }

  /**
   * 检查会话是否存在
   * @param {string} sessionId - 会话 ID
   * @returns {boolean}
   */
  hasSession(sessionId) {
    return this.sessions.has(sessionId);
  }

  /**
   * 获取会话
   * @param {string} sessionId - 会话 ID
   * @returns {object} 会话对象
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * 添加事件
   * @param {string} sessionId - 会话 ID
   * @param {object} event - 事件对象
   */
  addEvent(sessionId, event) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.events.push({
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    });
  }

  /**
   * 标记为重要
   * @param {string} sessionId - 会话 ID
   * @param {string} reason - 原因
   */
  markImportant(sessionId, reason) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.metadata.important = true;
    session.metadata.reason = reason;
  }

  /**
   * 结束会话（旧方法，保留兼容性）
   * @param {string} sessionId - 会话 ID
   * @returns {object} 会话摘要
   */
  endSessionById(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'completed';
    session.endTime = new Date().toISOString();

    return {
      sessionId,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      messageCount: session.events.filter((e) => e.type === 'user_message' || e.type === 'ai_response').length,
      toolCallCount: session.events.filter((e) => e.type === 'tool_use').length,
    };
  }

  /**
   * 开始新会话
   * @returns {Promise<string>} 会话 ID
   */
  async startSession(metadata = {}) {
    const sessionId = `SESSION-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`;
    this.createSession(sessionId, metadata);
    return sessionId;
  }

  /**
   * 结束当前会话
   * @returns {Promise<void>}
   */
  async endSession() {
    const activeSessions = Array.from(this.sessions.entries()).filter(([_, session]) => session.status === 'active');

    for (const [id, session] of activeSessions) {
      session.status = 'ended';
      session.endTime = new Date().toISOString();
    }
  }

  /**
   * 检查是否有活跃会话
   * @returns {Promise<boolean>}
   */
  async isSessionActive() {
    return Array.from(this.sessions.values()).some((session) => session.status === 'active');
  }

  /**
   * 获取当前会话 ID
   * @returns {Promise<string|null>}
   */
  async getCurrentSessionId() {
    const activeSession = Array.from(this.sessions.entries()).find(([_, session]) => session.status === 'active');

    return activeSession ? activeSession[0] : null;
  }
}
