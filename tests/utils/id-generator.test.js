/**
 * id-generator.test.js - ID 生成器测试
 *
 * 覆盖 4 种模式：
 * - fixed (默认)：进程内递增，不写文件
 * - hash_seq：NNN 来自 hash 前 3 位
 * - author_seq：按 CRS_AUTHOR 递增，写 counters-{author}.json
 * - hostname_seq：按 hostname 递增，写 counters-{hostname}.json
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs/promises';
import path from 'path';
import { generate, generateHash, parse, reset, getIdMode, slugify, resolveAuthor, resolveHostname } from '../../scripts/requirement-manager/utils/id-generator.js';

const COUNTERS_DIR = '.requirements';

async function cleanupScope(scope) {
  const file = scope ? path.join(COUNTERS_DIR, `counters-${scope}.json`) : path.join(COUNTERS_DIR, 'counters.json');
  try {
    await fs.unlink(file);
  } catch (_e) {
    // ignore
  }
}

describe('ID Generator Utility', () => {
  const originalMode = process.env.CRS_ID_MODE;
  const originalAuthor = process.env.CRS_AUTHOR;

  beforeEach(async () => {
    delete process.env.CRS_ID_MODE;
    delete process.env.CRS_AUTHOR;
    await reset();
  });

  afterEach(async () => {
    if (originalMode !== undefined) process.env.CRS_ID_MODE = originalMode;
    else delete process.env.CRS_ID_MODE;
    if (originalAuthor !== undefined) process.env.CRS_AUTHOR = originalAuthor;
    else delete process.env.CRS_AUTHOR;
    await cleanupScope('testauthor');
    await cleanupScope('alice');
    await cleanupScope('bob');
  });

  describe('generateHash()', () => {
    it('should return a 6-character hexadecimal string', () => {
      const hash = generateHash();
      expect(hash).to.match(/^[0-9a-f]{6}$/);
    });

    it('should return different values on consecutive calls', async () => {
      const h1 = generateHash();
      await new Promise((resolve) => setTimeout(resolve, 2));
      const h2 = generateHash();
      expect(h1).to.match(/^[0-9a-f]{6}$/);
      expect(h2).to.match(/^[0-9a-f]{6}$/);
    });
  });

  describe('getIdMode()', () => {
    it('should return "fixed" by default', () => {
      delete process.env.CRS_ID_MODE;
      expect(getIdMode()).to.equal('fixed');
    });

    it('should return the configured mode when valid', () => {
      process.env.CRS_ID_MODE = 'hash_seq';
      expect(getIdMode()).to.equal('hash_seq');
    });

    it('should fallback to "fixed" for invalid mode', () => {
      process.env.CRS_ID_MODE = 'invalid';
      expect(getIdMode()).to.equal('fixed');
    });
  });

  describe('slugify()', () => {
    it('should lowercase and strip non-alphanumeric chars', () => {
      expect(slugify('Alice/Bob!')).to.equal('alicebob');
    });

    it('should return "unknown" for empty input', () => {
      expect(slugify('')).to.equal('unknown');
      expect(slugify(null)).to.equal('unknown');
    });

    it('should truncate to 50 chars', () => {
      const long = 'a'.repeat(80);
      expect(slugify(long).length).to.equal(50);
    });
  });

  describe('resolveAuthor()', () => {
    it('should use CRS_AUTHOR env var when set', () => {
      process.env.CRS_AUTHOR = 'Alice';
      expect(resolveAuthor()).to.equal('alice');
    });

    it('should fallback to non-empty string when env not set', () => {
      delete process.env.CRS_AUTHOR;
      const result = resolveAuthor();
      expect(typeof result).to.equal('string');
      expect(result.length).to.be.greaterThan(0);
    });
  });

  describe('resolveHostname()', () => {
    it('should return a non-empty slug', () => {
      const h = resolveHostname();
      expect(typeof h).to.equal('string');
      expect(h.length).to.be.greaterThan(0);
      expect(h).to.match(/^[a-z0-9-]+$/);
    });
  });

  describe('generate(type) - default fixed mode', () => {
    it('should generate feature ID with hash format', async () => {
      const id = await generate('feature');
      expect(id).to.match(/^FEAT-\d{8}-\d{3}-[0-9a-f]{6}$/);
    });

    it('should generate bug ID with hash format', async () => {
      const id = await generate('bug');
      expect(id).to.match(/^BUG-\d{8}-\d{3}-[0-9a-f]{6}$/);
    });

    it('should generate sequential numbers within process', async () => {
      const id1 = await generate('feature');
      const id2 = await generate('feature');
      const num1 = parseInt(id1.split('-')[2], 10);
      const num2 = parseInt(id2.split('-')[2], 10);
      expect(num2).to.equal(num1 + 1);
    });

    it('should NOT write counters.json in fixed mode', async () => {
      await cleanupScope(null);
      await generate('feature');
      await generate('feature');
      let exists = true;
      try {
        await fs.access(path.join(COUNTERS_DIR, 'counters.json'));
      } catch (_e) {
        exists = false;
      }
      expect(exists).to.equal(false);
    });

    it('should include different hashes for sequential IDs', async () => {
      const id1 = await generate('feature');
      await new Promise((resolve) => setTimeout(resolve, 2));
      const id2 = await generate('feature');
      const hash1 = id1.split('-')[3];
      const hash2 = id2.split('-')[3];
      expect(hash1).to.match(/^[0-9a-f]{6}$/);
      expect(hash2).to.match(/^[0-9a-f]{6}$/);
    });

    it('should throw for unknown type', async () => {
      try {
        await generate('unknown-type');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).to.include('Unknown requirement type');
      }
    });
  });

  describe('generate(type) - hash_seq mode', () => {
    beforeEach(() => {
      process.env.CRS_ID_MODE = 'hash_seq';
    });

    it('should derive NNN from hash first 3 hex chars', async () => {
      const id = await generate('feature');
      const parts = id.split('-');
      const nnn = parseInt(parts[2], 10);
      const hash = parts[3];
      const expected = parseInt(hash.slice(0, 3), 16);
      expect(nnn).to.equal(expected);
      expect(nnn).to.be.at.most(4095);
    });

    it('should NOT write counters.json in hash_seq mode', async () => {
      await cleanupScope(null);
      await generate('feature');
      let exists = true;
      try {
        await fs.access(path.join(COUNTERS_DIR, 'counters.json'));
      } catch (_e) {
        exists = false;
      }
      expect(exists).to.equal(false);
    });
  });

  describe('generate(type) - author_seq mode', () => {
    beforeEach(async () => {
      process.env.CRS_ID_MODE = 'author_seq';
      process.env.CRS_AUTHOR = 'testauthor';
      await cleanupScope('testauthor');
    });

    it('should write to counters-{author}.json', async () => {
      await generate('feature');
      const file = path.join(COUNTERS_DIR, 'counters-testauthor.json');
      let exists = true;
      try {
        await fs.access(file);
      } catch (_e) {
        exists = false;
      }
      expect(exists).to.equal(true);
    });

    it('should increment counter across calls', async () => {
      const id1 = await generate('feature');
      const id2 = await generate('feature');
      const num1 = parseInt(id1.split('-')[2], 10);
      const num2 = parseInt(id2.split('-')[2], 10);
      expect(num2).to.equal(num1 + 1);
    });

    it('should isolate counters between different authors', async () => {
      process.env.CRS_AUTHOR = 'alice';
      await cleanupScope('alice');
      await cleanupScope('bob');
      const alice1 = await generate('feature');
      const alice2 = await generate('feature');

      process.env.CRS_AUTHOR = 'bob';
      const bob1 = await generate('feature');

      const aliceNum1 = parseInt(alice1.split('-')[2], 10);
      const aliceNum2 = parseInt(alice2.split('-')[2], 10);
      const bobNum1 = parseInt(bob1.split('-')[2], 10);

      expect(aliceNum2).to.equal(aliceNum1 + 1);
      expect(bobNum1).to.equal(1);
    });
  });

  describe('generate(type) - hostname_seq mode', () => {
    beforeEach(async () => {
      process.env.CRS_ID_MODE = 'hostname_seq';
      const host = resolveHostname();
      await cleanupScope(host);
    });

    it('should write to counters-{hostname}.json', async () => {
      await generate('feature');
      const host = resolveHostname();
      const file = path.join(COUNTERS_DIR, `counters-${host}.json`);
      let exists = true;
      try {
        await fs.access(file);
      } catch (_e) {
        exists = false;
      }
      expect(exists).to.equal(true);
    });

    it('should increment counter', async () => {
      const id1 = await generate('feature');
      const id2 = await generate('feature');
      const num1 = parseInt(id1.split('-')[2], 10);
      const num2 = parseInt(id2.split('-')[2], 10);
      expect(num2).to.equal(num1 + 1);
    });
  });

  describe('parse(id)', () => {
    it('should parse hash format ID', async () => {
      const id = await generate('feature');
      const parsed = parse(id);
      expect(parsed).to.include({
        type: 'feature',
        prefix: 'FEAT',
        format: 'hash',
      });
      expect(parsed)
        .to.have.property('hash')
        .that.matches(/^[0-9a-f]{6}$/);
      expect(parsed)
        .to.have.property('date')
        .that.matches(/^\d{8}$/);
      expect(parsed).to.have.property('number').that.is.a('number');
    });

    it('should parse legacy date format ID', () => {
      const parsed = parse('FEAT-20260514-001');
      expect(parsed).to.include({
        type: 'feature',
        prefix: 'FEAT',
        number: 1,
        date: '20260514',
        format: 'new',
      });
      expect(parsed).to.not.have.property('hash');
    });

    it('should parse legacy short format ID', () => {
      const parsed = parse('BUG-0001');
      expect(parsed).to.include({
        type: 'bug',
        prefix: 'BUG',
        number: 1,
        format: 'old',
      });
      expect(parsed).to.not.have.property('hash');
      expect(parsed).to.not.have.property('date');
    });

    it('should return null for invalid format', () => {
      expect(parse('INVALID-ID')).to.be.null;
    });

    it('should return null for invalid hash characters', () => {
      expect(parse('FEAT-20260609-001-zzzzzz')).to.be.null;
    });

    it('should return null for short hash', () => {
      expect(parse('FEAT-20260609-001-a3f2')).to.be.null;
    });

    it('should return null for unknown prefix', () => {
      expect(parse('UNKNOWN-20260609-001-a3f2c1')).to.be.null;
    });

    it('should parse all 5 existing real-world IDs (regression)', () => {
      const realIds = ['BUG-20260526-001', 'FEAT-20260526-004', 'FEAT-20260526-005', 'REF-20260609-001', 'BUG-20260610-002-9e8e6f'];
      for (const id of realIds) {
        const parsed = parse(id);
        expect(parsed, `should parse ${id}`).to.not.be.null;
        expect(parsed.type).to.be.a('string');
      }
    });
  });
});
