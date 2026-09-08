/**
 * Renderer - HTML 渲染器
 *
 * 基于 ReportData 渲染最终 HTML 字符串。
 * 模板策略：手写函数式模板，避免引入模板引擎依赖。
 * 安全：所有动态内容必须通过 escapeHtml 处理。
 */

import { escapeHtml, escapeAttr, truncate, formatDate } from './utils.js';
import { renderMarkdown } from './markdown.js';
import { REQ_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS } from './types.js';

/**
 * 渲染入口
 * @param {object} reportData
 * @param {object} options
 * @param {string} options.title
 * @param {boolean} options.offline
 * @param {boolean} options.noMermaid
 * @returns {string}
 */
export function render(reportData, options = {}) {
  const title = options.title || `CRS 报告 - ${reportData.meta.projectName}`;
  const head = renderHead(reportData, title, options);
  const body = renderBody(reportData, options);
  return `<!DOCTYPE html>
<html lang="zh-CN">
${head}
<body>
${body}
</body>
</html>
`;
}

/**
 * 渲染 <head>
 */
function renderHead(data, title, options) {
  const mermaidScript = options.noMermaid ? '' : options.offline ? '<script>/* 离线模式：Mermaid 库请通过构建工具预内联 */</script>' : '<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>';

  return `<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="generator" content="CRS v${data.meta.generatorVersion}"/>
  <title>${escapeHtml(title)}</title>
  <style>${CSS}</style>
  ${mermaidScript}
</head>`;
}

/**
 * 渲染 <body>
 */
function renderBody(data, options) {
  return [renderHeader(data, options), renderOverview(data), renderStatusChart(data), !options.noMermaid ? renderDepGraph(data) : '', renderReqList(data), renderChangelogTimeline(data), renderReqDetails(data), renderProject(data), renderFooter(data, options)].filter(Boolean).join('\n');
}

/**
 * 顶部标题区
 */
function renderHeader(data, options) {
  const title = options.title || `CRS 报告 - ${data.meta.projectName}`;
  return `
  <header class="header">
    <div class="header-inner">
      <h1>${escapeHtml(title)}</h1>
      <div class="meta-row">
        <span class="badge badge-info">${escapeHtml(data.meta.projectName)} @ v${escapeHtml(data.meta.version)}</span>
        <span class="badge badge-muted">需求 ${data.meta.totalReqs}</span>
        <span class="badge badge-muted">生成于 ${formatDate(data.meta.generatedAt)}</span>
      </div>
    </div>
  </header>`;
}

/**
 * 概览卡片（stats 总览）
 */
function renderOverview(data) {
  const { stats, requirements } = data;
  const total = requirements.length;
  const done = stats.byStatus.done || 0;
  const inProgress = (stats.byStatus.in_progress || 0) + (stats.byStatus.implementing || 0) + (stats.byStatus.open || 0);
  const planning = stats.byStatus.planning || 0;
  const analyzed = stats.byStatus.analyzed || 0;

  const typeBadges = Object.entries(stats.byType)
    .map(([type, count]) => `<span class="badge badge-type" data-type="${escapeAttr(type)}">${REQ_TYPE_LABELS[type] || type}：${count}</span>`)
    .join('');

  return `
  <section class="overview">
    <div class="card-grid">
      <div class="card card-primary">
        <div class="card-value">${total}</div>
        <div class="card-label">需求总数</div>
      </div>
      <div class="card card-success">
        <div class="card-value">${done}</div>
        <div class="card-label">已完成</div>
      </div>
      <div class="card card-warning">
        <div class="card-value">${inProgress}</div>
        <div class="card-label">进行中</div>
      </div>
      <div class="card card-muted">
        <div class="card-value">${planning + analyzed}</div>
        <div class="card-label">规划/分析</div>
      </div>
    </div>
    <div class="type-badges">${typeBadges}</div>
  </section>`;
}

/**
 * 状态分布饼图（纯 SVG）
 */
function renderStatusChart(data) {
  const entries = Object.entries(data.stats.byStatus).filter(([, c]) => c > 0);
  if (entries.length === 0) {
    return `
  <section class="section">
    <h2 id="status-chart">状态分布</h2>
    <p class="empty">暂无状态数据</p>
  </section>`;
  }
  const total = entries.reduce((sum, [, c]) => sum + c, 0);

  const cx = 100;
  const cy = 100;
  const r = 80;
  const innerR = 45;
  let startAngle = -Math.PI / 2;

  const slices = [];
  const legends = [];

  for (const [status, count] of entries) {
    const angle = (count / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const xi1 = cx + innerR * Math.cos(endAngle);
    const yi1 = cy + innerR * Math.sin(endAngle);
    const xi2 = cx + innerR * Math.cos(startAngle);
    const yi2 = cy + innerR * Math.sin(startAngle);

    const color = STATUS_COLORS[status] || '#9ca3af';
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${xi2} ${yi2} Z`;
    slices.push(`<path d="${d}" fill="${color}" stroke="#fff" stroke-width="2"><title>${escapeHtml(STATUS_LABELS[status] || status)}: ${count} (${((count / total) * 100).toFixed(1)}%)</title></path>`);

    legends.push(`<li><span class="legend-color" style="background:${color}"></span>${escapeHtml(STATUS_LABELS[status] || status)} (${count})</li>`);
    startAngle = endAngle;
  }

  return `
  <section class="section">
    <h2 id="status-chart">状态分布</h2>
    <div class="chart-container">
      <svg viewBox="0 0 200 200" class="pie-chart" aria-label="需求状态分布">
        ${slices.join('\n        ')}
        <text x="100" y="105" text-anchor="middle" class="pie-center">${total}</text>
      </svg>
      <ul class="legend">${legends.join('')}</ul>
    </div>
  </section>`;
}

/**
 * 依赖关系图（Mermaid）
 */
function renderDepGraph(data) {
  const { requirements } = data;
  if (requirements.length === 0) return '';

  const lines = ['flowchart LR'];
  const idMap = new Map();
  requirements.forEach((r, i) => idMap.set(r.id, `N${i}`));

  // 节点
  for (const req of requirements) {
    const nodeId = idMap.get(req.id);
    const label = truncate(req.title, 20).replace(/"/g, "'");
    const status = req.status;
    const shape = shapeForType(req.type);
    lines.push(`  ${nodeId}${shape.open}"${label}"${shape.close}`);
    // 节点样式
    const color = STATUS_COLORS[status] || '#9ca3af';
    lines.push(`  style ${nodeId} fill:${color},color:#fff,stroke:#fff`);
  }

  // 边
  const edgeSet = new Set();
  for (const req of requirements) {
    if (!req.dependencies?.length) continue;
    const fromId = idMap.get(req.id);
    for (const dep of req.dependencies) {
      const toId = idMap.get(dep);
      if (toId && !edgeSet.has(`${fromId}-${toId}`)) {
        edgeSet.add(`${fromId}-${toId}`);
        lines.push(`  ${fromId} --> ${toId}`);
      }
    }
  }

  const chartDef = lines.join('\n');

  return `
  <section class="section">
    <h2 id="dep-graph">依赖关系图</h2>
    <div class="mermaid" data-chart="${escapeAttr(chartDef)}">
      ${escapeHtml(chartDef)}
    </div>
    <p class="hint small">节点颜色按状态区分：绿=完成、蓝=进行中、灰=规划中</p>
  </section>`;
}

function shapeForType(type) {
  // 不同类型不同形状
  switch (type) {
    case 'features':
      return { open: '[', close: ']' };
    case 'bugs':
      return { open: '((', close: '))' };
    case 'refactors':
      return { open: '{{', close: '}}' };
    case 'questions':
      return { open: '>', close: ']' };
    default:
      return { open: '(', close: ')' };
  }
}

/**
 * 需求列表（含客户端过滤）
 */
function renderReqList(data) {
  const { requirements } = data;
  if (requirements.length === 0) {
    return `
    <section class="section">
      <h2 id="req-list">需求列表</h2>
      <p class="empty">暂无需求</p>
    </section>`;
  }

  const rows = requirements
    .slice()
    .sort((a, b) => {
      // 优先按优先级降序，然后按更新时间降序
      const pa = a.priority?.score || 0;
      const pb = b.priority?.score || 0;
      if (pb !== pa) return pb - pa;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    })
    .map(
      (req) => `
      <tr data-type="${escapeAttr(req.type)}" data-status="${escapeAttr(req.status)}" data-priority="${escapeAttr(req.priority?.level || '')}" data-id="${escapeAttr(req.id)}">
        <td class="col-id"><code>${escapeHtml(req.id)}</code></td>
        <td class="col-type"><span class="tag tag-${escapeAttr(req.type)}">${REQ_TYPE_LABELS[req.type] || req.type}</span></td>
        <td class="col-title">${escapeHtml(truncate(req.title, 80))}</td>
        <td class="col-status"><span class="status-pill" style="background:${STATUS_COLORS[req.status] || '#9ca3af'}">${escapeHtml(STATUS_LABELS[req.status] || req.status)}</span></td>
        <td class="col-priority">${req.priority ? `<span class="priority-pill" style="background:${PRIORITY_COLORS[req.priority.level] || '#6b7280'}">${escapeHtml(req.priority.level)}</span>` : '-'}</td>
        <td class="col-updated">${formatDate(req.updatedAt)}</td>
        <td class="col-actions"><a href="#detail-${escapeAttr(req.id)}" class="link-detail">查看</a></td>
      </tr>`
    )
    .join('\n');

  // 过滤器选项
  const typeFilters = Object.entries(data.stats.byType)
    .map(([t]) => `<button class="filter-btn" data-filter-type="${escapeAttr(t)}">${REQ_TYPE_LABELS[t] || t}</button>`)
    .join('');
  const statusFilters = Object.entries(data.stats.byStatus)
    .map(([s]) => `<button class="filter-btn" data-filter-status="${escapeAttr(s)}">${STATUS_LABELS[s] || s}</button>`)
    .join('');

  return `
  <section class="section">
    <h2 id="req-list">需求列表 <span class="count">(${requirements.length})</span></h2>
    <div class="filters">
      <div class="filter-group">
        <span class="filter-label">类型：</span>
        <button class="filter-btn filter-active" data-filter-type="all">全部</button>
        ${typeFilters}
      </div>
      <div class="filter-group">
        <span class="filter-label">状态：</span>
        <button class="filter-btn filter-active" data-filter-status="all">全部</button>
        ${statusFilters}
      </div>
      <div class="filter-group">
        <input type="search" id="search-input" placeholder="搜索需求 ID/标题..." class="search-input"/>
      </div>
    </div>
    <div class="table-wrap">
      <table class="req-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>类型</th>
            <th>标题</th>
            <th>状态</th>
            <th>优先级</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody id="req-tbody">
          ${rows}
        </tbody>
      </table>
    </div>
  </section>`;
}

/**
 * Changelog 时间线
 */
function renderChangelogTimeline(data) {
  const { changelog } = data;
  if (!changelog || changelog.length === 0) {
    return `
    <section class="section">
      <h2 id="changelog">变更时间线</h2>
      <p class="empty">暂无变更记录</p>
    </section>`;
  }

  const items = changelog
    .slice(0, 20)
    .map(
      (entry) => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-time">${formatDate(entry.timestamp)}</div>
          <div class="timeline-title">${escapeHtml(entry.title || entry.action)}</div>
          ${entry.reqId ? `<div class="timeline-meta">需求：<code>${escapeHtml(entry.reqId)}</code></div>` : ''}
        </div>
      </div>`
    )
    .join('');

  return `
  <section class="section">
    <h2 id="changelog">变更时间线 <span class="count">(${changelog.length})</span></h2>
    <div class="timeline">
      ${items}
    </div>
  </section>`;
}

/**
 * 需求详情面板（折叠）
 */
function renderReqDetails(data) {
  const { requirements } = data;
  if (!requirements || requirements.length === 0) {
    return `
  <section class="section">
    <h2 id="req-details">需求详情</h2>
    <p class="empty">暂无需求</p>
  </section>`;
  }

  const details = requirements
    .map((req) => {
      const spec = req.spec || {};
      const depsHtml = req.dependencies?.length ? req.dependencies.map((d) => `<code>${escapeHtml(d)}</code>`).join(' ') : '<span class="muted">无</span>';

      const sectionsHtml = [];
      if (spec.background) {
        sectionsHtml.push(`<div class="detail-section"><h4>背景与目标</h4>${renderMarkdown(spec.background)}</div>`);
      }
      if (spec.userStories) {
        sectionsHtml.push(`<div class="detail-section"><h4>用户故事</h4>${renderMarkdown(spec.userStories)}</div>`);
      }
      if (spec.design) {
        sectionsHtml.push(`<div class="detail-section"><h4>设计方案</h4>${renderMarkdown(spec.design)}</div>`);
      }
      if (spec.api) {
        sectionsHtml.push(`<div class="detail-section"><h4>接口定义</h4>${renderMarkdown(spec.api)}</div>`);
      }
      if (spec.decisions) {
        sectionsHtml.push(`<div class="detail-section"><h4>决策记录</h4>${renderMarkdown(spec.decisions)}</div>`);
      }

      return `
      <details class="req-detail" id="detail-${escapeAttr(req.id)}">
        <summary>
          <code>${escapeHtml(req.id)}</code> — ${escapeHtml(req.title)}
          <span class="status-pill" style="background:${STATUS_COLORS[req.status] || '#9ca3af'}; margin-left: 8px">${escapeHtml(STATUS_LABELS[req.status] || req.status)}</span>
        </summary>
        <div class="detail-body">
          <div class="detail-meta">
            <div><strong>类型：</strong>${REQ_TYPE_LABELS[req.type] || req.type}</div>
            <div><strong>优先级：</strong>${req.priority ? `${escapeHtml(req.priority.level)} (${req.priority.score}分)` : '-'}</div>
            <div><strong>创建时间：</strong>${formatDate(req.createdAt)}</div>
            <div><strong>更新时间：</strong>${formatDate(req.updatedAt)}</div>
            ${req.tags?.length ? `<div><strong>标签：</strong>${req.tags.map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join(' ')}</div>` : ''}
            <div><strong>依赖：</strong>${depsHtml}</div>
          </div>
          ${sectionsHtml.join('')}
        </div>
      </details>`;
    })
    .join('\n');

  return `
  <section class="section">
    <h2 id="req-details">需求详情</h2>
    <p class="hint">点击展开查看完整规格</p>
    ${details}
  </section>`;
}

/**
 * 项目级文档
 */
function renderProject(data) {
  const project = data.project;
  if (!project) {
    return `
    <section class="section">
      <h2 id="project">项目级文档</h2>
      <p class="empty">项目级文档未初始化，运行 <code>crs-project-init</code> 创建</p>
    </section>`;
  }

  const sections = [];
  if (project.structure) {
    sections.push(`<details class="project-doc"><summary>项目结构</summary><div class="detail-body">${renderMarkdown(project.structure)}</div></details>`);
  }
  if (project.businessReq) {
    sections.push(`<details class="project-doc"><summary>业务需求</summary><div class="detail-body">${renderMarkdown(project.businessReq)}</div></details>`);
  }
  if (project.functionalReq) {
    sections.push(`<details class="project-doc"><summary>功能需求</summary><div class="detail-body">${renderMarkdown(project.functionalReq)}</div></details>`);
  }
  if (project.functionalDesign) {
    sections.push(`<details class="project-doc"><summary>功能设计</summary><div class="detail-body">${renderMarkdown(project.functionalDesign)}</div></details>`);
  }

  if (sections.length === 0) return '';

  return `
  <section class="section">
    <h2 id="project">项目级文档</h2>
    ${sections.join('\n')}
  </section>`;
}

/**
 * 底部
 */
function renderFooter(data, options) {
  return `
  <footer class="footer">
    <p>由 <strong>CRS v${data.meta.generatorVersion}</strong> 生成 | ${formatDate(data.meta.generatedAt)} | ${options.offline ? '离线模式' : '在线模式'} | ${options.noMermaid ? '禁用依赖图' : '含依赖图'}</p>
  </footer>
  <script>${CLIENT_JS}</script>`;
}

/**
 * 客户端 JS（过滤器 + Mermaid 初始化）
 */
const CLIENT_JS = `
(function() {
  // 过滤器
  var tbody = document.getElementById('req-tbody');
  if (tbody) {
    var activeType = 'all';
    var activeStatus = 'all';
    var searchKey = '';

    function applyFilter() {
      var rows = tbody.querySelectorAll('tr');
      rows.forEach(function(row) {
        var matchType = activeType === 'all' || row.dataset.type === activeType;
        var matchStatus = activeStatus === 'all' || row.dataset.status === activeStatus;
        var matchSearch = !searchKey || (row.dataset.id + ' ' + row.querySelector('.col-title').textContent).toLowerCase().indexOf(searchKey) >= 0;
        row.style.display = (matchType && matchStatus && matchSearch) ? '' : 'none';
      });
      // 更新 URL hash
      var hash = [];
      if (activeType !== 'all') hash.push('type=' + activeType);
      if (activeStatus !== 'all') hash.push('status=' + activeStatus);
      if (searchKey) hash.push('q=' + encodeURIComponent(searchKey));
      window.location.hash = hash.join('&');
    }

    document.querySelectorAll('[data-filter-type]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('[data-filter-type]').forEach(function(b) { b.classList.remove('filter-active'); });
        btn.classList.add('filter-active');
        activeType = btn.dataset.filterType;
        applyFilter();
      });
    });
    document.querySelectorAll('[data-filter-status]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('[data-filter-status]').forEach(function(b) { b.classList.remove('filter-active'); });
        btn.classList.add('filter-active');
        activeStatus = btn.dataset.filterStatus;
        applyFilter();
      });
    });
    var searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        searchKey = searchInput.value.toLowerCase().trim();
        applyFilter();
      });
    }

    // 从 URL hash 恢复过滤状态
    var hash = window.location.hash.slice(1);
    if (hash) {
      hash.split('&').forEach(function(pair) {
        var kv = pair.split('=');
        if (kv[0] === 'type' && kv[1]) {
          activeType = decodeURIComponent(kv[1]);
          var btn = document.querySelector('[data-filter-type="' + activeType + '"]');
          if (btn) {
            document.querySelectorAll('[data-filter-type]').forEach(function(b) { b.classList.remove('filter-active'); });
            btn.classList.add('filter-active');
          }
        } else if (kv[0] === 'status' && kv[1]) {
          activeStatus = decodeURIComponent(kv[1]);
          var btn = document.querySelector('[data-filter-status="' + activeStatus + '"]');
          if (btn) {
            document.querySelectorAll('[data-filter-status]').forEach(function(b) { b.classList.remove('filter-active'); });
            btn.classList.add('filter-active');
          }
        } else if (kv[0] === 'q' && kv[1] && searchInput) {
          searchKey = decodeURIComponent(kv[1]);
          searchInput.value = searchKey;
        }
      });
      applyFilter();
    }
  }

  // Mermaid 初始化（如有）
  if (typeof mermaid !== 'undefined') {
    document.querySelectorAll('.mermaid').forEach(function(el) {
      var chart = el.dataset.chart || el.textContent;
      el.removeAttribute('data-chart');
      el.innerHTML = chart;
    });
    try {
      mermaid.initialize({ startOnLoad: true, theme: 'default', securityLevel: 'loose' });
    } catch (e) {
      console.warn('Mermaid init failed:', e);
    }
  } else {
    var mermaidEls = document.querySelectorAll('.mermaid');
    if (mermaidEls.length > 0) {
      mermaidEls.forEach(function(el) {
        el.innerHTML = '<div class="mermaid-fallback"><p>📊 依赖图加载失败（Mermaid CDN 不可达）</p><p class="small">使用 <code>--offline</code> 选项可内联 Mermaid 库</p></div>';
      });
    }
  }
})();
`;

/**
 * CSS 样式
 */
const CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; margin: 0; color: #1f2937; background: #f9fafb; line-height: 1.6; }
  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 32px 0; }
  .header-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
  .header h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 600; }
  .meta-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 13px; background: rgba(255,255,255,0.2); }
  .badge-info { background: rgba(255,255,255,0.3); }
  .badge-muted { background: rgba(255,255,255,0.15); }
  .badge-type { background: rgba(255,255,255,0.25); }
  main, section { max-width: 1200px; margin: 24px auto; padding: 0 24px; }
  .section { background: #fff; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .section h2 { margin: 0 0 16px 0; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb; color: #111827; font-size: 20px; }
  .count { color: #6b7280; font-size: 16px; font-weight: normal; }
  .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 16px; }
  .card { background: #fff; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 4px solid #e5e7eb; }
  .card-primary { border-left-color: #3b82f6; }
  .card-success { border-left-color: #10b981; }
  .card-warning { border-left-color: #f59e0b; }
  .card-muted { border-left-color: #9ca3af; }
  .card-value { font-size: 32px; font-weight: 600; color: #111827; }
  .card-label { color: #6b7280; font-size: 14px; margin-top: 4px; }
  .type-badges { display: flex; gap: 8px; flex-wrap: wrap; }
  .chart-container { display: flex; align-items: center; gap: 32px; flex-wrap: wrap; }
  .pie-chart { width: 200px; height: 200px; }
  .pie-center { font-size: 18px; font-weight: 600; fill: #111827; }
  .legend { list-style: none; padding: 0; }
  .legend li { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
  .legend-color { width: 16px; height: 16px; border-radius: 3px; display: inline-block; }
  .filters { background: #f3f4f6; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
  .filter-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .filter-label { color: #6b7280; font-size: 13px; }
  .filter-btn { background: #fff; border: 1px solid #d1d5db; color: #374151; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 13px; }
  .filter-btn:hover { background: #e5e7eb; }
  .filter-btn.filter-active { background: #3b82f6; color: #fff; border-color: #3b82f6; }
  .search-input { padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; min-width: 200px; }
  .table-wrap { overflow-x: auto; }
  table.req-table { width: 100%; border-collapse: collapse; }
  .req-table th, .req-table td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
  .req-table th { background: #f9fafb; color: #374151; font-weight: 600; }
  .req-table tr:hover { background: #f9fafb; }
  .col-id code, code { background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-family: 'Menlo', 'Consolas', monospace; font-size: 12px; color: #6366f1; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; background: #e0e7ff; color: #4338ca; }
  .tag-features { background: #dbeafe; color: #1d4ed8; }
  .tag-bugs { background: #fee2e2; color: #b91c1c; }
  .tag-questions { background: #fef3c7; color: #b45309; }
  .tag-adjustments { background: #f3e8ff; color: #7c3aed; }
  .tag-refactors { background: #d1fae5; color: #047857; }
  .status-pill, .priority-pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; color: #fff; font-weight: 500; }
  .link-detail { color: #3b82f6; text-decoration: none; }
  .link-detail:hover { text-decoration: underline; }
  .timeline { position: relative; padding-left: 24px; }
  .timeline-item { position: relative; padding: 8px 0 16px 16px; border-left: 2px solid #e5e7eb; }
  .timeline-item:last-child { border-left-color: transparent; }
  .timeline-dot { position: absolute; left: -7px; top: 12px; width: 12px; height: 12px; border-radius: 50%; background: #3b82f6; border: 2px solid #fff; }
  .timeline-content { padding: 8px 12px; background: #f9fafb; border-radius: 4px; }
  .timeline-time { color: #6b7280; font-size: 12px; }
  .timeline-title { font-weight: 500; }
  .timeline-meta { color: #6b7280; font-size: 13px; margin-top: 4px; }
  details.req-detail, details.project-doc { background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin-bottom: 8px; }
  details.req-detail summary, details.project-doc summary { cursor: pointer; font-weight: 500; color: #111827; padding: 4px 0; }
  details.req-detail summary code { margin-right: 8px; }
  .detail-body { margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e5e7eb; }
  .detail-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px 16px; margin-bottom: 16px; padding: 12px; background: #f9fafb; border-radius: 4px; font-size: 13px; }
  .detail-section { margin-bottom: 16px; }
  .detail-section h4 { margin: 0 0 8px 0; color: #1f2937; font-size: 14px; font-weight: 600; padding-bottom: 4px; border-bottom: 1px solid #f3f4f6; }
  .detail-section h1, .detail-section h2, .detail-section h3 { margin-top: 16px; }
  .detail-section table { border-collapse: collapse; margin: 8px 0; }
  .detail-section table th, .detail-section table td { border: 1px solid #e5e7eb; padding: 6px 10px; }
  .detail-section pre { background: #f3f4f6; padding: 12px; border-radius: 4px; overflow-x: auto; }
  .detail-section code { font-size: 12px; }
  .detail-section blockquote { border-left: 3px solid #d1d5db; padding-left: 12px; color: #6b7280; margin: 8px 0; }
  .hint { color: #6b7280; font-size: 13px; margin: 4px 0; }
  .small { font-size: 12px; }
  .muted { color: #9ca3af; }
  .empty { color: #9ca3af; font-style: italic; padding: 24px; text-align: center; }
  .mermaid { background: #fafafa; padding: 16px; border-radius: 4px; text-align: center; margin: 12px 0; }
  .mermaid-fallback { padding: 24px; color: #6b7280; }
  .footer { max-width: 1200px; margin: 24px auto; padding: 16px 24px; color: #6b7280; font-size: 13px; text-align: center; }
  pre { background: #f3f4f6; padding: 12px; border-radius: 4px; overflow-x: auto; }
  @media (max-width: 768px) {
    .section { padding: 16px; }
    .card-grid { grid-template-columns: repeat(2, 1fr); }
    .chart-container { flex-direction: column; align-items: flex-start; }
  }
`;

export default { render };
