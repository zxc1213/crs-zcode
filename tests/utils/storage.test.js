import { describe, it } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import {
  init,
  exists,
  createRequirementDir,
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
    });
  });

  describe('createRequirementDir(baseDir, type, id)', () => {
    it('should create feature requirement directory', async () => {
      await init(TEST_BASE_DIR);
      const reqPath = await createRequirementDir(TEST_BASE_DIR, 'feature', 'FEAT-001');
      expect(reqPath).to.include('FEAT-001');
      const metaFile = path.join(reqPath, 'meta.yaml');
      const metaExists = await exists(metaFile);
      expect(metaExists).to.equal(true);
    });
  });

  describe('readMeta(baseDir, reqPath)', () => {
    it('should read existing metadata', async () => {
      await init(TEST_BASE_DIR);
      const reqPath = await createRequirementDir(TEST_BASE_DIR, 'feature', 'FEAT-002');
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
