import { describe, it } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import {
  init,
  exists,
  readMeta,
  writeMeta,
  cleanup,
} from '../../scripts/requirement-manager/utils/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE_DIR = path.join(__dirname, '../temp-test-storage');

describe('Storage Utility', () => {
  beforeEach(async () => {
    await cleanup(TEST_BASE_DIR);
  });

  afterEach(async () => {
    await cleanup(TEST_BASE_DIR);
  });

  describe('init(baseDir)', () => {
    it('should create directory structure', async () => {
      await init(TEST_BASE_DIR);
      const dirExists = await exists(TEST_BASE_DIR);
      expect(dirExists).to.equal(true);
      // schema 口径的类型目录与 project/logs 目录齐全，项目根不再有多余目录
      expect(await exists(path.join(TEST_BASE_DIR, '.requirements', 'features'))).to.equal(true);
      expect(await exists(path.join(TEST_BASE_DIR, '.requirements', 'tech-debt'))).to.equal(true);
      expect(await exists(path.join(TEST_BASE_DIR, '.requirements', 'project'))).to.equal(true);
      expect(await exists(path.join(TEST_BASE_DIR, 'templates'))).to.equal(false);
      expect(await exists(path.join(TEST_BASE_DIR, 'logs'))).to.equal(false);
    });
  });

  describe('readMeta(baseDir, reqPath)', () => {
    it('should read existing metadata', async () => {
      await init(TEST_BASE_DIR);
      const reqPath = path.join(TEST_BASE_DIR, '.requirements', 'features', 'FEAT-002');
      await fs.mkdir(reqPath, { recursive: true });
      await writeMeta(TEST_BASE_DIR, reqPath, { id: 'FEAT-002', type: 'feature' });
      const meta = await readMeta(TEST_BASE_DIR, reqPath);
      expect(meta).to.be.ok;
      expect(meta.id).to.equal('FEAT-002');
      expect(meta.type).to.equal('feature');
    });
  });

  describe('cleanup(testDir)', () => {
    it('should remove test directory', async () => {
      await init(TEST_BASE_DIR);
      const existsBefore = await exists(TEST_BASE_DIR);
      expect(existsBefore).to.equal(true);
      await cleanup(TEST_BASE_DIR);
      const existsAfter = await exists(TEST_BASE_DIR);
      expect(existsAfter).to.equal(false);
    });
  });
});
