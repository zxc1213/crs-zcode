/**
 * 日志工具类 - 记录需求操作日志
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * 格式化时间戳
 * @returns {string}
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString();
}

/**
 * 记录日志
 * @param {string} reqId - 需求ID
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {string} logPath - 日志文件路径
 */
export async function log(reqId, level, message, logPath) {
  const timestamp = getTimestamp();
  const levelUpper = level.toUpperCase();
  const logEntry = `[${timestamp}] [${levelUpper}] [${reqId}] ${message}\n`;

  try {
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, logEntry, 'utf-8');
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

/**
 * 记录信息日志
 * @param {string} reqId - 需求ID
 * @param {string} message - 日志消息
 * @param {string} logPath - 日志文件路径
 */
export async function info(reqId, message, logPath) {
  await log(reqId, 'info', message, logPath);
}

/**
 * 记录警告日志
 * @param {string} reqId - 需求ID
 * @param {string} message - 日志消息
 * @param {string} logPath - 日志文件路径
 */
export async function warn(reqId, message, logPath) {
  await log(reqId, 'warn', message, logPath);
}

/**
 * 记录错误日志
 * @param {string} reqId - 需求ID
 * @param {string} message - 日志消息
 * @param {string} logPath - 日志文件路径
 */
export async function error(reqId, message, logPath) {
  await log(reqId, 'error', message, logPath);
}

/**
 * 记录成功日志
 * @param {string} reqId - 需求ID
 * @param {string} message - 日志消息
 * @param {string} logPath - 日志文件路径
 */
export async function success(reqId, message, logPath) {
  await log(reqId, 'success', message, logPath);
}

export default {
  log,
  info,
  warn,
  error,
  success,
};
