import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import {
  sessionStart,
  getConversationLogger,
} from '../../../scripts/conversation-logger/hooks/session-start.js';
import fs from 'fs-extra';

describe('sessionStart Hook', () => {
  const testDir = '.test-conversations';

  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('应该初始化记录器并返回 sessionId', async () => {
    const context = {
      workingDirectory: '/test/dir',
      gitBranch: 'feature/test',
      user: 'test-user',
    };

    const result = await sessionStart(context);

    expect(result.continue).to.be.true;
    expect(result.sessionId).to.match(/^sess-\d{8}-\d{6}-\d{3}$/);

    const logger = getConversationLogger();
    expect(logger).to.not.be.null;
    expect(logger.getSessionId()).to.equal(result.sessionId);
    expect(logger.getStatus()).to.equal('active');
  });

  it('应该保存会话元数据', async () => {
    const context = {
      workingDirectory: '/test/dir',
      gitBranch: 'feature/test',
      user: 'test-user',
    };

    const result = await sessionStart(context);

    const logger = getConversationLogger();
    const metadata = await logger.getMetadata();

    expect(metadata.workingDir).to.equal('/test/dir');
    expect(metadata.branch).to.equal('feature/test');
    expect(metadata.user).to.equal('test-user');
    expect(metadata.type).to.equal('session');
  });

  it('多次调用应该创建新会话', async () => {
    const context = {
      workingDirectory: '/test/dir',
      gitBranch: 'master',
      user: 'test-user',
    };

    const result1 = await sessionStart(context);
    // 等待至少1秒确保时间戳不同
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const result2 = await sessionStart(context);

    expect(result1.sessionId).to.not.equal(result2.sessionId);

    const logger = getConversationLogger();
    expect(logger.getSessionId()).to.equal(result2.sessionId);
  });
});
