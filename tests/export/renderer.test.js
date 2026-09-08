/**
 * Export 模块 - Renderer 测试
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';

import { render } from '../../scripts/export/renderer.js';

function makeData(overrides = {}) {
  return {
    meta: {
      projectName: 'test-project',
      version: '1.0.0',
      generatedAt: '2026-06-13T12:00:00.000Z',
      totalReqs: 1,
      generatorVersion: '1.0.0',
    },
    project: null,
    requirements: [],
    changelog: [],
    stats: { byType: {}, byStatus: {}, byPriority: {} },
    ...overrides,
  };
}

describe('Export Renderer - 基础渲染', () => {
  it('应生成合法 HTML5 文档', () => {
    const html = render(makeData());
    expect(html.startsWith('<!DOCTYPE html>')).to.be.true;
    expect(html).to.include('<html');
    expect(html).to.include('</html>');
    expect(html).to.include('<head>');
    expect(html).to.include('<body>');
  });

  it('应包含 UTF-8 编码声明', () => {
    const html = render(makeData());
    expect(html).to.include('<meta charset="UTF-8"');
  });

  it('应包含标题', () => {
    const html = render(makeData(), { title: '自定义标题' });
    expect(html).to.include('<title>自定义标题</title>');
  });

  it('应包含内联 CSS', () => {
    const html = render(makeData());
    expect(html).to.include('<style>');
    expect(html).to.include('font-family');
  });
});

describe('Export Renderer - Mermaid 模式', () => {
  it('默认模式加载 CDN', () => {
    const html = render(makeData());
    expect(html).to.include('cdn.jsdelivr.net/npm/mermaid');
  });

  it('offline 模式不加载 CDN', () => {
    const html = render(makeData(), { offline: true });
    expect(html).to.not.include('cdn.jsdelivr.net');
  });

  it('no-mermaid 模式跳过依赖图 section', () => {
    const html = render(makeData(), { noMermaid: true });
    expect(html).to.not.include('id="dep-graph"');
    expect(html).to.not.include('cdn.jsdelivr.net');
  });
});

describe('Export Renderer - Header', () => {
  it('显示项目名称和版本', () => {
    const html = render(makeData());
    expect(html).to.include('test-project');
    expect(html).to.include('1.0.0');
  });

  it('显示需求数 badge', () => {
    const html = render(makeData({ meta: { ...makeData().meta, totalReqs: 42 } }));
    expect(html).to.include('需求 42');
  });
});

describe('Export Renderer - 概览卡片', () => {
  it('空需求时显示 0', () => {
    const html = render(makeData());
    expect(html).to.include('需求总数');
    expect(html).to.include('<div class="card-value">0</div>');
  });

  it('显示类型分布 badges', () => {
    const html = render(makeData({ stats: { byType: { feature: 3, bug: 2 }, byStatus: {}, byPriority: {} } }));
    expect(html).to.include('功能：3');
    expect(html).to.include('缺陷：2');
  });
});

describe('Export Renderer - 需求列表', () => {
  it('空需求时显示"暂无需求"', () => {
    const html = render(makeData());
    expect(html).to.include('暂无需求');
  });

  it('渲染需求表格行', () => {
    const data = makeData({
      requirements: [
        {
          id: 'FEAT-001',
          type: 'feature',
          title: '测试功能',
          status: 'done',
          priority: { level: 'P1', score: 7.5 },
          tags: [],
          createdAt: '',
          updatedAt: '',
          spec: {},
          dependencies: [],
        },
      ],
      stats: { byType: { feature: 1 }, byStatus: { done: 1 }, byPriority: { P1: 1 } },
    });
    const html = render(data);
    expect(html).to.include('FEAT-001');
    expect(html).to.include('测试功能');
    expect(html).to.include('filter-btn');
  });

  it('需求标题中的 HTML 被转义', () => {
    const data = makeData({
      requirements: [
        {
          id: 'FEAT-001',
          type: 'feature',
          title: '<script>alert(1)</script>',
          status: 'done',
          priority: null,
          tags: [],
          createdAt: '',
          updatedAt: '',
          spec: {},
          dependencies: [],
        },
      ],
      stats: { byType: { feature: 1 }, byStatus: { done: 1 }, byPriority: {} },
    });
    const html = render(data);
    expect(html).to.not.include('<script>alert(1)</script>');
    expect(html).to.include('&lt;script&gt;');
  });
});

describe('Export Renderer - 状态分布图', () => {
  it('空 stats 不渲染 SVG 饼图', () => {
    const html = render(makeData());
    expect(html).to.not.include('<svg');
    expect(html).to.not.include('class="pie-chart"');
  });

  it('有 stats 时渲染 SVG 饼图', () => {
    const html = render(makeData({ stats: { byType: {}, byStatus: { done: 3, open: 1 }, byPriority: {} } }));
    expect(html).to.include('<svg');
    expect(html).to.include('pie-chart');
    expect(html).to.include('legend');
  });
});

describe('Export Renderer - 详情面板', () => {
  it('空需求不渲染详情面板', () => {
    const html = render(makeData());
    expect(html).to.not.include('class="req-detail"');
    expect(html).to.not.include('detail-FEAT-');
  });

  it('渲染需求详情折叠面板', () => {
    const data = makeData({
      requirements: [
        {
          id: 'FEAT-001',
          type: 'feature',
          title: '测试',
          status: 'done',
          priority: null,
          tags: ['export'],
          createdAt: '2026-06-01T00:00:00Z',
          updatedAt: '2026-06-02T00:00:00Z',
          spec: {
            background: '# 背景\n这是背景',
            design: '# 设计\n架构',
          },
          dependencies: ['FEAT-000'],
        },
      ],
    });
    const html = render(data);
    expect(html).to.include('id="detail-FEAT-001"');
    expect(html).to.include('<details');
    expect(html).to.include('背景与目标');
    expect(html).to.include('设计方案');
    expect(html).to.include('#export'); // 标签
    expect(html).to.include('FEAT-000'); // 依赖
  });
});

describe('Export Renderer - 项目级文档', () => {
  it('project 为 null 时显示提示', () => {
    const html = render(makeData());
    expect(html).to.include('项目级文档未初始化');
  });

  it('渲染项目结构文档', () => {
    const data = makeData({
      project: {
        meta: null,
        structure: '# 项目结构\nsrc/',
        businessReq: '',
        functionalReq: '',
        functionalDesign: '',
      },
    });
    const html = render(data);
    expect(html).to.include('项目结构');
    expect(html).to.include('src/');
  });
});

describe('Export Renderer - 时间线', () => {
  it('空时间线显示提示', () => {
    const html = render(makeData());
    expect(html).to.include('暂无历史记录');
  });

  it('渲染时间线事件（含类型徽章与需求 ID）', () => {
    const data = makeData({
      timeline: {
        source: 'timeline',
        events: [
          { timestamp: '2026-06-13T10:00:00Z', type: 'requirement_changed', reqId: 'FEAT-001', title: '报表导出', summary: '[medium] 客户要求 CSV' },
          { timestamp: '2026-06-13T11:00:00Z', type: 'lesson_saved', reqId: 'FEAT-001', title: '导出模式', summary: '大文件用流式导出' },
        ],
      },
    });
    const html = render(data);
    expect(html).to.include('timeline-item');
    expect(html).to.include('FEAT-001');
    expect(html).to.include('event-badge');
    expect(html).to.include('需求变更');
    expect(html).to.include('经验沉淀');
    expect(html).to.include('2 条事件');
  });

  it('changelog 回退源渲染提示', () => {
    const data = makeData({
      timeline: {
        source: 'changelog',
        events: [{ timestamp: '2026-06-13T10:00:00Z', type: 'project_synced', reqId: 'FEAT-001', title: 'requirement-done', summary: '' }],
      },
    });
    const html = render(data);
    expect(html).to.include('来自 changelog 解析');
  });
});

describe('Export Renderer - 成长档案', () => {
  it('lessons 渲染经验库', () => {
    const data = makeData({
      lessons: [{ topic: 'jwt-login', tags: ['登录', 'jwt'], source: 'FEAT-20260908-001', date: '2026-09-08', lesson: 'token 过期要静默刷新' }],
    });
    const html = render(data);
    expect(html).to.include('成长档案');
    expect(html).to.include('经验库（1 条）');
    expect(html).to.include('token 过期要静默刷新');
  });

  it('retroInsights 渲染踩坑沉淀', () => {
    const data = makeData({
      retroInsights: [{ reqId: 'FEAT-20260908-001', title: '报表导出', pitfalls: ['Windows 路径分隔符导致导出失败'], hasRetro: true }],
    });
    const html = render(data);
    expect(html).to.include('踩坑沉淀');
    expect(html).to.include('Windows 路径分隔符导致导出失败');
  });

  it('无 lessons 且无踩坑时不渲染成长档案', () => {
    const html = render(makeData());
    expect(html).to.not.include('成长档案');
  });
});

describe('Export Renderer - 文档地图', () => {
  it('渲染宿主文档纳管状态', () => {
    const data = makeData({
      docsMap: {
        docs: [
          { path: 'README.md', role: 'readme', sync_on: 'done' },
          { path: 'docs/architecture.md', role: 'architecture', sync_on: 'change' },
        ],
        stale: ['docs/architecture.md'],
        unconfirmed: [],
      },
    });
    const html = render(data);
    expect(html).to.include('文档地图');
    expect(html).to.include('README.md');
    expect(html).to.include('可能过期');
  });

  it('无 docsMap 时不渲染文档地图', () => {
    const html = render(makeData());
    expect(html).to.not.include('id="docs-map"');
  });
});

describe('Export Renderer - 客户端 JS', () => {
  it('包含过滤器 JS', () => {
    const html = render(makeData());
    expect(html).to.include('addEventListener');
    expect(html).to.include('filter-btn');
  });

  it('包含 Mermaid 初始化逻辑', () => {
    const html = render(makeData());
    expect(html).to.include('mermaid');
  });
});
