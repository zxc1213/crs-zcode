import { describe, it } from 'mocha';
import { expect } from 'chai';
import { SessionManager } from '../../../scripts/conversation-logger/core/session-manager.js';

describe('SessionManager', () => {
  it('应该创建新会话', () => {
    const manager = new SessionManager();
    const sessionId = 'sess-20260522-143000';

    manager.createSession(sessionId, { type: 'feature' });

    expect(manager.hasSession(sessionId)).to.be.true;
    expect(manager.getSession(sessionId)).to.deep.include({
      id: sessionId,
      status: 'active',
      events: [],
    });
  });

  it('应该添加事件', () => {
    const manager = new SessionManager();
    const sessionId = 'sess-20260522-143000';

    manager.createSession(sessionId, {});
    manager.addEvent(sessionId, {
      type: 'user_message',
      content: '测试',
      timestamp: '2026-05-22T14:30:00Z',
    });

    const session = manager.getSession(sessionId);
    expect(session.events).to.have.length(1);
    expect(session.events[0].content).to.equal('测试');
  });

  it('应该标记重要', () => {
    const manager = new SessionManager();
    const sessionId = 'sess-20260522-143000';

    manager.createSession(sessionId, {});
    manager.markImportant(sessionId, '关键决策');

    const session = manager.getSession(sessionId);
    expect(session.metadata.important).to.be.true;
    expect(session.metadata.reason).to.equal('关键决策');
  });

  it('应该结束会话', () => {
    const manager = new SessionManager();
    const sessionId = 'sess-20260522-143000';

    manager.createSession(sessionId, {});
    manager.addEvent(sessionId, { type: 'user_message', content: 'test' });
    const summary = manager.endSessionById(sessionId);

    expect(summary.messageCount).to.equal(1);
    expect(summary.status).to.equal('completed');
  });
});
