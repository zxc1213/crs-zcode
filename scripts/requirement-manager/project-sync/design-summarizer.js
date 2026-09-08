/**
 * 设计提炼器 - 从各需求 spec/design.md 提炼项目级设计文档
 *
 * 职责：
 * - 提取所有需求的 spec/design.md H2 章节
 * - 合并同主题内容（架构 / 组件 / 数据流）
 * - 检测 frontmatter design_change 标记（Bug 用）
 * - 关键词兜底检测（无 frontmatter 时）
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

/**
 * design_change 关键词兜底匹配
 */
const DESIGN_CHANGE_KEYWORDS = ['重构', '架构变更', '架构调整', '接口调整', '接口变更', '数据结构变更', '数据结构迁移', '协议变更', 'refactor', 'architecture change', 'breaking change', 'redesign'];

/**
 * 安全读取文件
 */
async function safeReadFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (_error) {
    return null;
  }
}

/**
 * 解析 frontmatter（YAML 格式）
 * @param {string} content
 * @returns {{frontmatter: object|null, body: string}}
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: null, body: content };
  }
  try {
    return { frontmatter: yaml.load(match[1]) || {}, body: match[2] };
  } catch (_error) {
    return { frontmatter: null, body: content };
  }
}

/**
 * 从 design.md 提取章节（按 H2 切分）
 * @param {string} content
 * @returns {Array<{title: string, body: string}>}
 */
function extractSections(content) {
  const stripped = content.replace(/^---\n[\s\S]*?\n---\n/, '');
  const lines = stripped.split('\n');
  const sections = [];
  let currentTitle = null;
  let currentBody = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentTitle) {
        sections.push({ title: currentTitle, body: currentBody.join('\n').trim() });
      }
      currentTitle = line.replace(/^## /, '').trim();
      currentBody = [];
    } else if (currentTitle) {
      currentBody.push(line);
    }
  }
  if (currentTitle) {
    sections.push({ title: currentTitle, body: currentBody.join('\n').trim() });
  }
  return sections;
}

/**
 * 关键词兜底检测 design_change
 * @param {string} content
 * @returns {boolean}
 */
function detectDesignChangeByKeywords(content) {
  const lower = content.toLowerCase();
  return DESIGN_CHANGE_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * 判断单条需求是否涉及设计变更
 * @param {string} reqDir - 需求目录
 * @returns {Promise<{hasDesignChange: boolean, reason: string}>}
 */
export async function detectDesignChange(reqDir) {
  const decisionsPath = path.join(reqDir, 'spec', 'decisions.md');
  const content = await safeReadFile(decisionsPath);
  if (!content) {
    return { hasDesignChange: false, reason: 'no-decisions-md' };
  }

  const { frontmatter, body } = parseFrontmatter(content);

  // 优先用 frontmatter 显式标记
  if (frontmatter && typeof frontmatter.design_change === 'boolean') {
    return {
      hasDesignChange: frontmatter.design_change,
      reason: 'frontmatter-explicit',
    };
  }

  // 兜底：关键词检测
  if (detectDesignChangeByKeywords(body)) {
    return { hasDesignChange: true, reason: 'keyword-detected' };
  }

  return { hasDesignChange: false, reason: 'no-marker' };
}

/**
 * 提取单条需求的设计要点
 * @param {string} baseDir
 * @param {string} reqId
 * @returns {Promise<object|null>}
 */
export async function summarizeSingleDesign(baseDir, reqId) {
  const prefix = reqId.split('-')[0];
  const prefixToType = {
    FEAT: 'feature',
    BUG: 'bug',
    QUES: 'question',
    ADJU: 'adjustment',
    REF: 'refactor',
    DEBT: 'tech-debt',
  };
  const type = prefixToType[prefix];
  if (!type) return null;

  const typeDir = type === 'tech-debt' ? 'tech-debt' : `${type}s`;
  const reqDir = path.join(baseDir, '.requirements', typeDir, reqId);

  try {
    await fs.access(reqDir);
  } catch (_error) {
    return null;
  }

  const designPath = path.join(reqDir, 'spec', 'design.md');
  const content = await safeReadFile(designPath);

  let sections = [];
  if (content) {
    sections = extractSections(content);
  }

  const { hasDesignChange, reason } = await detectDesignChange(reqDir);

  // 提取设计亮点：第一个 H2 章节的前 200 字符
  const designHighlight = sections.length ? sections[0].body.slice(0, 200) + (sections[0].body.length > 200 ? '...' : '') : '';

  return {
    id: reqId,
    type,
    sections,
    designHighlight,
    hasDesignChange,
    designChangeReason: reason,
  };
}

/**
 * 汇总项目级设计文档内容
 * @param {string} baseDir
 * @param {Array<{id: string, type: string}>} requirements - 已完成需求列表
 * @returns {Promise<object>}
 */
export async function summarizeDesign(baseDir, requirements = []) {
  const collected = {
    architecture: [],
    components: [],
    dataflow: [],
    decisions: [],
  };

  for (const req of requirements) {
    if (!req.id) continue;
    const single = await summarizeSingleDesign(baseDir, req.id);
    if (!single) continue;

    for (const section of single.sections) {
      const lower = section.title.toLowerCase();
      const entry = {
        from: req.id,
        title: section.title,
        body: section.body,
      };
      if (lower.includes('架构') || lower.includes('architecture')) {
        collected.architecture.push(entry);
      } else if (lower.includes('组件') || lower.includes('component') || lower.includes('模块')) {
        collected.components.push(entry);
      } else if (lower.includes('数据流') || lower.includes('dataflow') || lower.includes('data flow')) {
        collected.dataflow.push(entry);
      } else if (lower.includes('决策') || lower.includes('decision')) {
        collected.decisions.push(entry);
      } else {
        // 默认归到 architecture
        collected.architecture.push(entry);
      }
    }
  }

  return {
    architectureSummary: formatSectionSummary(collected.architecture),
    componentsSummary: formatSectionSummary(collected.components),
    dataflowSummary: formatSectionSummary(collected.dataflow),
    decisionsSummary: formatSectionSummary(collected.decisions),
  };
}

/**
 * 格式化章节汇总
 * @param {Array} entries
 * @returns {string}
 */
function formatSectionSummary(entries) {
  if (!entries.length) return '_暂无相关内容_';
  return entries.map((e) => `### 来自 \`${e.from}\` — ${e.title}\n\n${e.body.slice(0, 500)}${e.body.length > 500 ? '...' : ''}\n`).join('\n---\n\n');
}

export default {
  summarizeDesign,
  summarizeSingleDesign,
  detectDesignChange,
};
