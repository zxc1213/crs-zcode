/**
 * 轻量 Markdown 渲染器
 *
 * 手写极简版本，支持：标题、段落、列表、代码块、引用、链接、表格、加粗、斜体。
 * 避免引入 marked 依赖，输出已转义 HTML，安全。
 */

import { escapeHtml } from './utils.js';

/**
 * 渲染 markdown 为 HTML
 * @param {string} md
 * @returns {string}
 */
export function renderMarkdown(md) {
  if (!md) return '';

  const lines = md.split('\n');
  const result = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let listBuffer = [];
  let listType = null; // 'ul' | 'ol'
  let paragraphBuffer = [];
  let inTable = false;
  let tableRows = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length) {
      const text = paragraphBuffer.join(' ').trim();
      if (text) {
        result.push(`<p>${renderInline(text)}</p>`);
      }
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer.length) {
      const items = listBuffer.map((item) => `    <li>${renderInline(item)}</li>`).join('\n');
      result.push(listType === 'ol' ? `<ol>\n${items}\n  </ol>` : `<ul>\n${items}\n  </ul>`);
      listBuffer = [];
      listType = null;
    }
  };

  const flushTable = () => {
    if (tableRows.length >= 2) {
      const [header, , ...body] = tableRows;
      const headerCells = parseTableRow(header)
        .map((c) => `        <th>${renderInline(c)}</th>`)
        .join('\n');
      const bodyRows = body
        .map((row) => {
          const cells = parseTableRow(row)
            .map((c) => `        <td>${renderInline(c)}</td>`)
            .join('\n');
          return `      <tr>\n${cells}\n      </tr>`;
        })
        .join('\n');
      result.push(`      <table>\n        <thead>\n          <tr>\n${headerCells}\n          </tr>\n        </thead>\n        <tbody>\n${bodyRows}\n        </tbody>\n      </table>`);
    }
    tableRows = [];
    inTable = false;
  };

  for (const rawLine of lines) {
    const line = rawLine;

    // 代码块
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        const code = escapeHtml(codeBuffer.join('\n'));
        result.push(`<pre><code>${code}</code></pre>`);
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        flushTable();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // 表格
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushParagraph();
      flushList();
      inTable = true;
      tableRows.push(line.trim());
      continue;
    } else if (inTable) {
      flushTable();
    }

    // 空行
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    // 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const text = renderInline(headingMatch[2]);
      result.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    // 引用
    if (line.trim().startsWith('>')) {
      flushParagraph();
      flushList();
      const text = renderInline(line.trim().replace(/^>\s?/, ''));
      result.push(`<blockquote>${text}</blockquote>`);
      continue;
    }

    // 水平线
    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line)) {
      flushParagraph();
      flushList();
      result.push('<hr/>');
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph();
      const item = line.replace(/^\s*[-*+]\s+/, '');
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listBuffer.push(item);
      continue;
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph();
      const item = line.replace(/^\s*\d+\.\s+/, '');
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listBuffer.push(item);
      continue;
    }

    // 普通段落
    if (listBuffer.length) flushList();
    paragraphBuffer.push(line.trim());
  }

  // 冲刷剩余缓冲
  if (inCodeBlock && codeBuffer.length) {
    result.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
  }
  flushParagraph();
  flushList();
  flushTable();

  return result.join('\n');
}

/**
 * 解析表格行
 * @param {string} line
 * @returns {string[]}
 */
function parseTableRow(line) {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/**
 * 渲染行内元素（粗体、斜体、代码、链接）
 *
 * 顺序很重要：
 * 1. 先转义所有原始 < > & 避免任何原始 HTML 注入
 * 2. 再用占位符保护行内代码（避免被后续规则破坏）
 * 3. 处理粗体/斜体/链接
 * 4. 还原代码占位符
 *
 * @param {string} text
 * @returns {string}
 */
function renderInline(text) {
  if (!text) return '';

  // 步骤 1：转义所有 < > &（防止原始 HTML）
  let result = escapeHtml(text);

  // 步骤 2：行内代码（保护到占位符避免被后续规则破坏）
  const codePlaceholders = [];
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    const idx = codePlaceholders.length;
    codePlaceholders.push(`<code>${code}</code>`);
    return `[[CODE${idx}]]`;
  });

  // 步骤 3：链接 [text](url) — 因为已转义，所以这里看到的是已转义版本
  result = result.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) => {
    const safeUrl = /^(https?:|mailto:|#|\.\/|\/)/.test(url) ? url : '#';
    return `<a href="${safeUrl}">${txt}</a>`;
  });

  // 步骤 4：粗体（** 或 __）
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // 步骤 5：斜体（* 或 _）
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // 步骤 6：还原代码占位符
  result = result.replace(/\[\[CODE(\d+)\]\]/g, (_, idx) => codePlaceholders[Number(idx)] || '');

  return result;
}

export default { renderMarkdown };
