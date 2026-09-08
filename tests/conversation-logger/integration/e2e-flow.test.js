import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { ConversationStorage } from '../../../scripts/conversation-logger/utils/storage.js';
import { SessionManager } from '../../../scripts/conversation-logger/core/session-manager.js';
import { ConversationLogger } from '../../../scripts/conversation-logger/core/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('对话记录器集成测试', function () {
  this.timeout(10000);

  const testDir = path.join(__dirname, '.test-conversations');
  let storage;
  let logger;
  let sessionManager;

  before(async () => {
    await fs.mkdir(testDir, { recursive: true });
    storage = new ConversationStorage(testDir);
    logger = new ConversationLogger(testDir);
    sessionManager = new SessionManager(testDir);
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('基础功能', () => {
    it('应该正确保存和加载对话', async () => {
      const conversation = {
        id: 'CONV-TEST-001',
        startTime: new Date().toISOString(),
        messages: [
          {
            id: 'MSG-001',
            role: 'user',
            content: '测试消息',
            timestamp: new Date().toISOString(),
          },
        ],
        metadata: {
          messageCount: 1,
          status: 'active',
        },
      };

      await storage.saveConversation(conversation);
      const loaded = await storage.loadConversation('CONV-TEST-001');

      expect(loaded).to.be.an('object');
      expect(loaded.id).to.equal('CONV-TEST-001');
      expect(loaded.messages.length).to.equal(1);
      expect(loaded.messages[0].content).to.equal('测试消息');
    });

    it('应该处理不存在的对话', async () => {
      const loaded = await storage.loadConversation('NON-EXISTENT');
      expect(loaded).to.be.null;
    });
  });

  describe('会话管理', () => {
    it('应该正确开始和结束会话', async () => {
      const sessionId = await sessionManager.startSession();
      expect(sessionId).to.be.a('string');

      const isActive = await sessionManager.isSessionActive();
      expect(isActive).to.be.true;

      await sessionManager.endSession();

      const isStillActive = await sessionManager.isSessionActive();
      expect(isStillActive).to.be.false;
    });
  });
});
