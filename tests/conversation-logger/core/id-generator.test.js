import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  generateSessionId,
  parseSessionId,
} from '../../../scripts/conversation-logger/core/id-generator.js';

describe('IDGenerator', () => {
  it('应该生成唯一会话 ID', async () => {
    const id1 = generateSessionId();
    // 等待1秒确保时间戳不同
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const id2 = generateSessionId();

    expect(id1).to.be.a('string');
    expect(id2).to.be.a('string');
    expect(id1).to.not.equal(id2);
  });

  it('应该生成符合格式的 ID', () => {
    const id = generateSessionId();
    const pattern = /^sess-\d{8}-\d{6}-\d{3}$/;

    expect(id).to.match(pattern);
  });

  it('应该解析会话 ID', () => {
    const id = 'sess-20260522-143000-001';
    const parsed = parseSessionId(id);

    expect(parsed).to.deep.equal({
      date: '20260522',
      time: '143000-001',
    });
  });
});
