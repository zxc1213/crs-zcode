import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { sessionStart } from '../../../scripts/conversation-logger/hooks/session-start.js';
import { postToolUse } from '../../../scripts/conversation-logger/hooks/post-tool-use.js';
import fs from 'fs-extra';

describe('postToolUse Hook', () => {
  const testDir = '.test-conversations';

  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('应该记录工具调用事件', async () => {
    // 先启动会话
    const context = {
      workingDirectory: '/test/dir',
      gitBranch: 'master',
      user: 'test-user',
    };
    await sessionStart(context);

    // 模拟工具调用
    const result = {
      tool: 'Read',
      input: { file_path: '/test/file.txt' },
      success: true,
      duration: 150,
    };

    const hookResult = await postToolUse(context, result);

    expect(hookResult.continue).to.be.true;

    // 验证事件已记录
    const logger = await import('../../../scripts/conversation-logger/hooks/session-start.js').then(
      (m) => m.getConversationLogger()
    );
    const events = await logger.getEvents();

    expect(events).to.have.length(1);
    expect(events[0].type).to.equal('tool_use');
    expect(events[0].tool).to.equal('Read');
    expect(events[0].args).to.deep.equal({ file_path: '/test/file.txt' });
    expect(events[0].success).to.be.true;
    expect(events[0].duration).to.equal(150);
  });

  it('应该在没有活跃会话时静默失败', async () => {
    const context = {
      workingDirectory: '/test/dir',
      gitBranch: 'master',
      user: 'test-user',
    };
    const result = {
      tool: 'Read',
      input: {},
      success: true,
    };

    // 不启动会话，直接调用
    const hookResult = await postToolUse(context, result);

    expect(hookResult.continue).to.be.true;
  });

  it('应该在记录器抛出错误时静默失败', async () => {
    const context = {
      workingDirectory: '/test/dir',
      gitBranch: 'master',
      user: 'test-user',
    };
    const result = {
      tool: 'Read',
      input: {},
      success: true,
    };

    // 启动会话
    await sessionStart(context);

    // 模拟捕获事件时的错误
    const logger = await import('../../../scripts/conversation-logger/hooks/session-start.js').then(
      (m) => m.getConversationLogger()
    );
    const originalCapture = logger.captureEvent.bind(logger);
    logger.captureEvent = async () => {
      throw new Error('Test error');
    };

    // 应该捕获错误并返回 continue: true
    const hookResult = await postToolUse(context, result);

    expect(hookResult.continue).to.be.true;

    // 恢复原方法
    logger.captureEvent = originalCapture;
  });

  it('应该记录多个工具调用', async () => {
    const context = {
      workingDirectory: '/test/dir',
      gitBranch: 'master',
      user: 'test-user',
    };
    await sessionStart(context);

    // 多次工具调用
    await postToolUse(context, { tool: 'Read', input: { path: 'a.txt' }, success: true });
    await postToolUse(context, { tool: 'Write', input: { path: 'b.txt' }, success: true });
    await postToolUse(context, { tool: 'Bash', input: { command: 'ls' }, success: false });

    const logger = await import('../../../scripts/conversation-logger/hooks/session-start.js').then(
      (m) => m.getConversationLogger()
    );
    const events = await logger.getEvents();

    expect(events).to.have.length(3);
    expect(events[0].tool).to.equal('Read');
    expect(events[1].tool).to.equal('Write');
    expect(events[2].tool).to.equal('Bash');
  });
});
