import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { ConversationLogger } from '../../../scripts/conversation-logger/core/logger.js';
import fs from 'fs-extra';

describe('ConversationLogger', () => {
  const testDir = '.test-conversations';

  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('应该启动新会话', async () => {
    const logger = new ConversationLogger(testDir);
    await logger.startSession('sess-test', { type: 'test' });

    expect(logger.getSessionId()).to.equal('sess-test');
    expect(logger.getStatus()).to.equal('active');
  });

  it('应该捕获事件', async () => {
    const logger = new ConversationLogger(testDir);
    await logger.startSession('sess-test', {});
    await logger.captureEvent('user_message', { content: '测试' });

    const events = await logger.getEvents();
    expect(events).to.have.length(1);
    expect(events[0].content).to.equal('测试');
  });

  it('应该保存会话到文件', async () => {
    const logger = new ConversationLogger(testDir);
    await logger.startSession('sess-test', {});
    await logger.captureEvent('user_message', { content: '测试' });
    const summary = await logger.endSession({});

    const filepath = `${testDir}/sess-test.md`;
    expect(await fs.pathExists(filepath)).to.be.true;

    const content = await fs.readFile(filepath, 'utf8');
    expect(content).to.include('测试');
  });
});
