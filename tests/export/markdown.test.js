/**
 * Export 模块 - Markdown 渲染器测试
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';

import { renderMarkdown } from '../../scripts/export/markdown.js';

describe('Export Markdown - 基础渲染', () => {
  it('空输入返回空字符串', () => {
    expect(renderMarkdown('')).to.equal('');
    expect(renderMarkdown(null)).to.equal('');
  });

  it('渲染 H1-H6 标题', () => {
    expect(renderMarkdown('# 标题一')).to.include('<h1>标题一</h1>');
    expect(renderMarkdown('## 标题二')).to.include('<h2>标题二</h2>');
    expect(renderMarkdown('### 标题三')).to.include('<h3>标题三</h3>');
    expect(renderMarkdown('###### 标题六')).to.include('<h6>标题六</h6>');
  });

  it('渲染段落', () => {
    const result = renderMarkdown('这是一段普通文本。');
    expect(result).to.include('<p>这是一段普通文本。</p>');
  });

  it('渲染水平线', () => {
    expect(renderMarkdown('---')).to.include('<hr/>');
  });
});

describe('Export Markdown - 列表', () => {
  it('渲染无序列表', () => {
    const md = '- 项目一\n- 项目二\n- 项目三';
    const result = renderMarkdown(md);
    expect(result).to.include('<ul>');
    expect(result).to.include('<li>项目一</li>');
    expect(result).to.include('<li>项目二</li>');
    expect(result).to.include('<li>项目三</li>');
  });

  it('渲染有序列表', () => {
    const md = '1. 第一步\n2. 第二步\n3. 第三步';
    const result = renderMarkdown(md);
    expect(result).to.include('<ol>');
    expect(result).to.include('<li>第一步</li>');
    expect(result).to.include('<li>第二步</li>');
  });
});

describe('Export Markdown - 代码块', () => {
  it('渲染行内代码', () => {
    const result = renderMarkdown('使用 `crs-export` 命令');
    expect(result).to.include('<code>crs-export</code>');
  });

  it('渲染代码块（多行）', () => {
    const md = '```\nconsole.log("hello");\nconst x = 1;\n```';
    const result = renderMarkdown(md);
    expect(result).to.include('<pre><code>');
    expect(result).to.include('console.log');
    expect(result).to.include('&quot;hello&quot;'); // 引号被转义
  });

  it('代码块内 <script> 被转义', () => {
    const md = '```\n<script>alert(1)</script>\n```';
    const result = renderMarkdown(md);
    expect(result).to.not.include('<script>alert');
    expect(result).to.include('&lt;script&gt;');
  });
});

describe('Export Markdown - 行内样式', () => {
  it('渲染加粗', () => {
    expect(renderMarkdown('**重要**')).to.include('<strong>重要</strong>');
    expect(renderMarkdown('__重要__')).to.include('<strong>重要</strong>');
  });

  it('渲染斜体', () => {
    expect(renderMarkdown('*斜体*')).to.include('<em>斜体</em>');
  });

  it('渲染链接', () => {
    const result = renderMarkdown('[CRS](https://github.com/x/crs)');
    expect(result).to.include('<a href="https://github.com/x/crs">CRS</a>');
  });

  it('渲染引用', () => {
    expect(renderMarkdown('> 引用文字')).to.include('<blockquote>引用文字</blockquote>');
  });
});

describe('Export Markdown - 表格', () => {
  it('渲染基本表格', () => {
    const md = '| 列1 | 列2 |\n| --- | --- |\n| A | B |';
    const result = renderMarkdown(md);
    expect(result).to.include('<table>');
    expect(result).to.include('<th>列1</th>');
    expect(result).to.include('<td>A</td>');
  });
});

describe('Export Markdown - XSS 防护', () => {
  it('标题中的 HTML 被转义', () => {
    const result = renderMarkdown('# <script>alert(1)</script>');
    expect(result).to.not.include('<script>');
    expect(result).to.include('&lt;script&gt;');
  });

  it('列表项中的 HTML 被转义', () => {
    const result = renderMarkdown('- <img src=x onerror=alert(1)>');
    expect(result).to.not.include('<img');
    expect(result).to.include('&lt;img');
  });
});
