/**
 * Export 模块 - 工具函数与 XSS 防护测试
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';

import { escapeHtml, escapeAttr, truncate, formatDate, formatSize, defaultFileName } from '../../scripts/export/utils.js';

describe('Export Utils - XSS 转义', () => {
  it('应转义 HTML 特殊字符', () => {
    expect(escapeHtml('<script>alert(1)</script>')).to.equal('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml('a & b')).to.equal('a &amp; b');
    expect(escapeHtml('"quoted"')).to.equal('&quot;quoted&quot;');
    expect(escapeHtml("it's")).to.equal('it&#39;s');
  });

  it('应处理 null/undefined', () => {
    expect(escapeHtml(null)).to.equal('');
    expect(escapeHtml(undefined)).to.equal('');
  });

  it('应处理非字符串（强制转换）', () => {
    expect(escapeHtml(42)).to.equal('42');
    expect(escapeHtml(true)).to.equal('true');
  });

  it('escapeAttr 应等价于 escapeHtml', () => {
    expect(escapeAttr('<img src=x>')).to.equal('&lt;img src=x&gt;');
  });

  it('应阻断 OWASP 常见 XSS payload（无未转义尖括号）', () => {
    const payloads = ['<script>alert("XSS")</script>', '<img src=x onerror=alert(1)>', '"><script>alert(1)</script>', '<svg/onload=alert(1)>'];
    for (const p of payloads) {
      const escaped = escapeHtml(p);
      // 转义后不应含未转义的 <（即所有 < 必须以 &lt; 形式出现）
      expect(escaped).to.not.include('<script');
      expect(escaped).to.not.include('<img');
      expect(escaped).to.not.include('<svg');
      expect(escaped).to.not.include('<onload');
      expect(escaped).to.include('&lt;');
    }
  });
});

describe('Export Utils - 字符串截断', () => {
  it('短字符串不截断', () => {
    expect(truncate('hello', 10)).to.equal('hello');
  });

  it('长字符串截断并加省略号', () => {
    const result = truncate('a'.repeat(200), 100);
    expect(result.length).to.equal(103);
    expect(result.endsWith('...')).to.be.true;
  });

  it('空字符串安全处理', () => {
    expect(truncate('', 10)).to.equal('');
    expect(truncate(null)).to.equal('');
  });

  it('支持自定义 maxLen', () => {
    expect(truncate('abcdefg', 3)).to.equal('abc...');
  });
});

describe('Export Utils - 日期格式化', () => {
  it('格式化 ISO 时间戳', () => {
    const result = formatDate('2026-06-13T12:00:00.000Z');
    expect(result).to.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('空值返回 "-"', () => {
    expect(formatDate('')).to.equal('-');
    expect(formatDate(null)).to.equal('-');
  });

  it('无效日期回退到原值', () => {
    expect(formatDate('not-a-date')).to.equal('not-a-date');
  });
});

describe('Export Utils - 文件大小格式化', () => {
  it('字节单位', () => {
    expect(formatSize(500)).to.equal('500 B');
  });

  it('KB 单位', () => {
    expect(formatSize(1024)).to.equal('1.0 KB');
    expect(formatSize(10240)).to.equal('10.0 KB');
  });

  it('MB 单位', () => {
    expect(formatSize(1024 * 1024)).to.equal('1.00 MB');
  });
});

describe('Export Utils - 默认文件名', () => {
  it('包含时间戳格式', () => {
    const fixedDate = new Date(2026, 5, 13, 14, 30);
    const name = defaultFileName(fixedDate);
    expect(name).to.equal('crs-report-20260613-1430.html');
  });

  it('文件名包含 .html 后缀', () => {
    expect(defaultFileName()).to.match(/^crs-report-\d{8}-\d{4}\.html$/);
  });
});
