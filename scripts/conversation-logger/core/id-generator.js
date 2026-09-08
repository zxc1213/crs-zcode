// 计数器，确保同一时间内的唯一性
let counter = 0;

/**
 * 生成会话 ID
 * 格式：sess-YYYYMMDD-HHMMSS-ccc（ccc 为递增计数器）
 * @returns {string} 会话 ID
 */
export function generateSessionId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const time = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS

  // 递增计数器确保唯一性
  counter++;
  if (counter > 999) {
    counter = 1;
  }
  const count = String(counter).padStart(3, '0');

  return `sess-${date}-${time}-${count}`;
}

/**
 * 解析会话 ID
 * @param {string} sessionId - 会话 ID
 * @returns {object} 解析结果 {date, time}
 */
export function parseSessionId(sessionId) {
  const match = sessionId.match(/^sess-(\d{8})-(\d{6}-\d{3})$/);
  if (!match) {
    throw new Error(`Invalid session ID format: ${sessionId}`);
  }
  return {
    date: match[1],
    time: match[2],
  };
}

/**
 * ID 生成器类
 */
export class IDGenerator {
  static generate(prefix = 'CONV') {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');

    // 简单的计数器，基于时间戳
    const count = String(now.getMilliseconds()).padStart(3, '0');

    return `${prefix}-${date}-${count}`;
  }

  static generateSessionId() {
    return generateSessionId();
  }
}
