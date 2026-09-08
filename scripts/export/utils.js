/**
 * HTML 转义工具 - 防 XSS
 *
 * 所有动态内容必须经过 escapeHtml 处理才能写入 HTML。
 * marked 已对 markdown 内部 HTML 做转义，无需重复调用。
 */

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * 转义 HTML 特殊字符
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

/**
 * 转义 HTML 属性值（用于 data-* 等属性）
 * @param {string} str
 * @returns {string}
 */
export function escapeAttr(str) {
  return escapeHtml(str);
}

/**
 * 截断字符串并添加省略号
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
export function truncate(str, maxLen = 100) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

/**
 * 格式化日期为可读字符串
 * @param {string} iso - ISO 8601 时间戳
 * @returns {string}
 */
export function formatDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch (_e) {
    return iso;
  }
}

/**
 * 格式化文件大小
 * @param {number} bytes
 * @returns {string}
 */
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * 生成默认输出文件名（含时间戳）
 * @param {Date} now
 * @returns {string}
 */
export function defaultFileName(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `crs-report-${yyyy}${mm}${dd}-${hh}${mi}.html`;
}

export default {
  escapeHtml,
  escapeAttr,
  truncate,
  formatDate,
  formatSize,
  defaultFileName,
};
