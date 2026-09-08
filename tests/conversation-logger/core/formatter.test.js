import { ContentFormatter } from '../../../scripts/conversation-logger/core/formatter.js';
import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('ContentFormatter', () => {
  it('应该格式化单个事件为 Markdown', () => {
    const formatter = new ContentFormatter();
    const event = {
      type: 'user_message',
      timestamp: '2026-05-22T14:30:15Z',
      content: '新增功能',
    };

    const markdown = formatter.formatEvent(event);

    expect(markdown).include('[14:30:15]');
    expect(markdown).include('新增功能');
  });

  it('应该格式化工具调用', () => {
    const formatter = new ContentFormatter();
    const event = {
      type: 'tool_use',
      timestamp: '2026-05-22T14:30:25Z',
      tool: 'Read',
      args: { filepath: 'package.json' },
    };

    const markdown = formatter.formatEvent(event);

    expect(markdown).include('`Read: {"filepath":"package.json"}`');
  });

  it('应该生成完整文档', () => {
    const formatter = new ContentFormatter();
    const session = {
      sessionId: 'sess-20260522-143000',
      metadata: { type: 'feature' },
      events: [
        { type: 'user_message', content: '测试' },
        { type: 'ai_response', content: '好的' },
      ],
    };

    const doc = formatter.formatDocument(session);

    expect(doc).include('# 对话记录');
    expect(doc).include('sess-20260522-143000');
    expect(doc).include('测试');
    expect(doc).include('好的');
  });
});
