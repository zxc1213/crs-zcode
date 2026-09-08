import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import {
  sessionStart,
  getConversationLogger,
} from '../../../scripts/conversation-logger/hooks/session-start.js';
import { stop } from '../../../scripts/conversation-logger/hooks/stop.js';
import fs from 'fs-extra';

describe('stop Hook', () => {
  const testDir = '.test-conversations';

  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('应该结束会话并保存记录', async () => {
    const context = {
      workingDirectory: '/test/dir',
      gitBranch: 'master',
      user: 'test-user',
    };

    // 启动会话
    await sessionStart(context);

    // 添加一些事件
    const logger = getConversationLogger();
    await logger.captureEvent('user_message', { content: '测试消息' });
    await logger.captureEvent('tool_use', { tool: 'Read', success: true });

    // 结束会话
    const result = await stop(context);

    expect(result.continue).to.be.true;
    expect(result.summary).to.exist;
    expect(result.summary.filepath).to.exist;
    expect(result.summary.messageCount).to.equal(1);
    expect(result.summary.toolCallCount).to.equal(1);
  });

  it('应该创建会话文件和元数据文件', async () => {
    const context = {
      workingDirectory: '/test/dir',
      gitBranch: 'master',
      user: 'test-user',
    };

    await sessionStart(context);
    const logger = getConversationLogger();
    await logger.captureEvent('user_message', { content: '测试' });

    const result = await stop(context);

    // 验证文件存在
    expect(await fs.pathExists(result.summary.filepath)).to.be.true;
    expect(await fs.pathExists(result.summary.metaPath)).to.be.true;

    // 验证内容
    const content = await fs.readFile(result.summary.filepath, 'utf8');
    expect(content).to.include('测试');

    const metadata = await fs.readJSON(result.summary.metaPath);
    expect(metadata.id).to.match(/^sess-\d{8}-\d{6}-\d{3}$/);
    expect(metadata.workingDir).to.equal('/test/dir');
    expect(metadata.eventCount).to.equal(1);
  });

  it('应该在没有活跃会话时静默失败', async () => {
    const context = {
      workingDirectory: '/test/dir',
      gitBranch: 'master',
      user: 'test-user',
    };

    // 不启动会话，直接调用
    const result = await stop(context);

    expect(result.continue).to.be.true;
    expect(result.summary).to.not.exist;
  });

  it('应该在会话结束后将状态设为 idle', async () => {
    const context = {
      workingDirectory: '/test/dir',
      gitBranch: 'master',
      user: 'test-user',
    };

    await sessionStart(context);
    await stop(context);

    const logger = getConversationLogger();
    expect(logger.getStatus()).to.equal('idle');
  });

  it('应该在保存失败时静默失败', async () => {
    const context = {
      workingDirectory: '/test/dir',
      gitBranch: 'master',
      user: 'test-user',
    };

    await sessionStart(context);

    // 模拟保存失败
    const logger = getConversationLogger();
    const originalEnd = logger.endSession.bind(logger);
    logger.endSession = async () => {
      throw new Error('Save failed');
    };

    // 应该捕获错误并返回 continue: true
    const result = await stop(context);

    expect(result.continue).to.be.true;

    // 恢复原方法
    logger.endSession = originalEnd;
  });

  it('应该正确计算消息数和工具调用数', async () => {
    const context = {
      workingDirectory: '/test/dir',
      gitBranch: 'master',
      user: 'test-user',
    };

    await sessionStart(context);
    const logger = getConversationLogger();

    // 添加不同类型的事件
    await logger.captureEvent('user_message', { content: '消息1' });
    await logger.captureEvent('ai_response', { content: '响应1' });
    await logger.captureEvent('tool_use', { tool: 'Read' });
    await logger.captureEvent('tool_use', { tool: 'Write' });
    await logger.captureEvent('user_message', { content: '消息2' });

    const result = await stop(context);

    expect(result.summary.messageCount).to.equal(3); // 2 user + 1 ai
    expect(result.summary.toolCallCount).to.equal(2);
  });
});
