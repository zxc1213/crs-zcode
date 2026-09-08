/**
 * processor.test.js - 需求处理器测试
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Processor } from '../../scripts/requirement-manager/core/processor.js';
import { reset as resetIdGenerator } from '../../scripts/requirement-manager/utils/id-generator.js';
import { init, cleanup, readMeta, exists } from '../../scripts/requirement-manager/utils/storage.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 测试基础目录
const testBaseDir = path.join(__dirname, '..', '..', '..', '..', '.test-requirements');

describe('Processor - parseType', () => {
  it('should parse bug command with short flag', () => {
    const result = Processor.parseType('/req -b something is broken');
    expect(result).to.deep.equal({
      type: 'bug',
      mode: 'semi_auto',
      description: 'something is broken',
    });
  });

  it('should parse bug command with long flag', () => {
    const result = Processor.parseType('/req --bug login error');
    expect(result).to.deep.equal({
      type: 'bug',
      mode: 'semi_auto',
      description: 'login error',
    });
  });

  it('should parse question command with short flag', () => {
    const result = Processor.parseType('/req -q how to use router?');
    expect(result).to.deep.equal({
      type: 'question',
      mode: 'semi_auto',
      description: 'how to use router?',
    });
  });

  it('should parse question command with long flag', () => {
    const result = Processor.parseType('/req --question what is this?');
    expect(result).to.deep.equal({
      type: 'question',
      mode: 'semi_auto',
      description: 'what is this?',
    });
  });

  it('should parse adjustment command with -a flag', () => {
    const result = Processor.parseType('/req -a fix the layout');
    expect(result).to.deep.equal({
      type: 'adjustment',
      mode: 'semi_auto',
      description: 'fix the layout',
    });
  });

  it('should parse adjustment command with --adjust flag', () => {
    const result = Processor.parseType('/req --adjust change color');
    expect(result).to.deep.equal({
      type: 'adjustment',
      mode: 'semi_auto',
      description: 'change color',
    });
  });

  it('should parse adjustment command with --adj flag', () => {
    const result = Processor.parseType('/req --adj update text');
    expect(result).to.deep.equal({
      type: 'adjustment',
      mode: 'semi_auto',
      description: 'update text',
    });
  });

  it('should parse refactor command with short flag', () => {
    const result = Processor.parseType('/req -r cleanup code');
    expect(result).to.deep.equal({
      type: 'refactor',
      mode: 'semi_auto',
      description: 'cleanup code',
    });
  });

  it('should parse refactor command with --refactor flag', () => {
    const result = Processor.parseType('/req --refactor optimize');
    expect(result).to.deep.equal({
      type: 'refactor',
      mode: 'semi_auto',
      description: 'optimize',
    });
  });

  it('should parse refactor command with --ref flag', () => {
    const result = Processor.parseType('/req --ref simplify');
    expect(result).to.deep.equal({
      type: 'refactor',
      mode: 'semi_auto',
      description: 'simplify',
    });
  });

  it('should parse feature command with --auto flag (full_auto mode)', () => {
    const result = Processor.parseType('/req --auto create new feature');
    expect(result).to.deep.equal({
      type: 'feature',
      mode: 'full_auto',
      description: 'create new feature',
    });
  });

  it('should parse feature command with -f flag', () => {
    const result = Processor.parseType('/req -f add button');
    expect(result).to.deep.equal({
      type: 'feature',
      mode: 'semi_auto',
      description: 'add button',
    });
  });

  it('should parse feature command with --feature flag', () => {
    const result = Processor.parseType('/req --feature add component');
    expect(result).to.deep.equal({
      type: 'feature',
      mode: 'semi_auto',
      description: 'add component',
    });
  });

  it('should default to feature type when no flag provided', () => {
    const result = Processor.parseType('/req build something new');
    expect(result).to.deep.equal({
      type: 'feature',
      mode: 'semi_auto',
      description: 'build something new',
    });
  });

  it('should handle empty description', () => {
    const result = Processor.parseType('/req --bug');
    expect(result).to.deep.equal({
      type: 'bug',
      mode: 'semi_auto',
      description: '',
    });
  });

  it('should handle command without /req prefix', () => {
    const result = Processor.parseType('--bug broken');
    expect(result).to.deep.equal({
      type: 'bug',
      mode: 'semi_auto',
      description: 'broken',
    });
  });
});

describe('Processor - create', () => {
  let processor;

  beforeEach(async () => {
    await init(testBaseDir);
    await resetIdGenerator();
    processor = new Processor(testBaseDir);
  });

  afterEach(async () => {
    await cleanup(testBaseDir);
  });

  it('should create a bug requirement', async () => {
    const parsed = {
      type: 'bug',
      mode: 'semi_auto',
      description: 'login page crashes',
    };

    const result = await processor.create(parsed);

    expect(result.id).to.match(/^BUG-\d{8}-\d{3}-[0-9a-f]{6}$/);
    expect(result.path).to.match(/BUG-\d{8}-\d{3}-[0-9a-f]{6}/);

    // 验证元数据
    const metaPath = path.join(result.path, 'meta.yaml');
    const metaExists = await exists(metaPath);
    expect(metaExists).to.equal(true);

    const meta = await readMeta(testBaseDir, result.path);
    expect(meta.id).to.match(/^BUG-\d{8}-\d{3}-[0-9a-f]{6}$/);
    expect(meta.status).to.equal('planning');
    expect(meta.mode).to.equal('semi_auto');
  });

  it('should create a feature requirement', async () => {
    const parsed = {
      type: 'feature',
      mode: 'semi_auto',
      description: 'add user profile page',
    };

    const result = await processor.create(parsed);

    expect(result.id).to.match(/^FEAT-\d{8}-\d{3}-[0-9a-f]{6}$/);
    expect(result.path).to.match(/FEAT-\d{8}-\d{3}-[0-9a-f]{6}/);

    const meta = await readMeta(testBaseDir, result.path);
    expect(meta.type).to.equal('feature');
    expect(meta.description).to.equal('add user profile page');
  });

  it('should create multiple requirements with incrementing IDs', async () => {
    const bug1 = await processor.create({
      type: 'bug',
      mode: 'semi_auto',
      description: 'bug 1',
    });

    const bug2 = await processor.create({
      type: 'bug',
      mode: 'semi_auto',
      description: 'bug 2',
    });

    const feature1 = await processor.create({
      type: 'feature',
      mode: 'semi_auto',
      description: 'feature 1',
    });

    expect(bug1.id).to.match(/^BUG-\d{8}-\d{3}-[0-9a-f]{6}$/);
    expect(bug2.id).to.match(/^BUG-\d{8}-\d{3}-[0-9a-f]{6}$/);
    expect(feature1.id).to.match(/^FEAT-\d{8}-\d{3}-[0-9a-f]{6}$/);
  });

  it('should create raw requirement file', async () => {
    const parsed = {
      type: 'bug',
      mode: 'semi_auto',
      description: 'critical error',
    };

    const result = await processor.create(parsed);

    const rawPath = path.join(result.path, 'raw.md');
    const rawExists = await exists(rawPath);
    expect(rawExists).to.equal(true);
  });

  it('should create directory structure based on type', async () => {
    const bug = await processor.create({
      type: 'bug',
      mode: 'semi_auto',
      description: 'bug',
    });

    const feature = await processor.create({
      type: 'feature',
      mode: 'semi_auto',
      description: 'feature',
    });

    expect(bug.path).to.include(path.join('requirements', 'bugs'));
    expect(feature.path).to.include(path.join('requirements', 'features'));
  });

  it('should handle question type', async () => {
    const parsed = {
      type: 'question',
      mode: 'semi_auto',
      description: 'how does this work?',
    };

    const result = await processor.create(parsed);

    expect(result.id).to.match(/^QUES-\d{8}-\d{3}-[0-9a-f]{6}$/);
    expect(result.path).to.match(/QUES-\d{8}-\d{3}-[0-9a-f]{6}/);

    const meta = await readMeta(testBaseDir, result.path);
    expect(meta.type).to.equal('question');
  });

  it('should handle adjustment type', async () => {
    const parsed = {
      type: 'adjustment',
      mode: 'semi_auto',
      description: 'tweak the layout',
    };

    const result = await processor.create(parsed);

    expect(result.id).to.match(/^ADJU-\d{8}-\d{3}-[0-9a-f]{6}$/);

    const meta = await readMeta(testBaseDir, result.path);
    expect(meta.type).to.equal('adjustment');
  });

  it('should handle refactor type', async () => {
    const parsed = {
      type: 'refactor',
      mode: 'semi_auto',
      description: 'clean up code',
    };

    const result = await processor.create(parsed);

    expect(result.id).to.match(/^REF-\d{8}-\d{3}-[0-9a-f]{6}$/);

    const meta = await readMeta(testBaseDir, result.path);
    expect(meta.type).to.equal('refactor');
  });

  it('should set full_auto mode when --auto is used', async () => {
    const parsed = {
      type: 'feature',
      mode: 'full_auto',
      description: 'automated feature',
    };

    const result = await processor.create(parsed);

    const meta = await readMeta(testBaseDir, result.path);
    expect(meta.mode).to.equal('full_auto');
  });
});

describe('Processor - update', () => {
  let processor;

  beforeEach(async () => {
    await init(testBaseDir);
    await resetIdGenerator();
    processor = new Processor(testBaseDir);
  });

  afterEach(async () => {
    await cleanup(testBaseDir);
  });

  it('should update requirement status', async () => {
    const created = await processor.create({
      type: 'bug',
      mode: 'semi_auto',
      description: 'test bug',
    });

    await processor.update(created.id, { status: 'in_progress' });

    const meta = await readMeta(testBaseDir, created.path);
    expect(meta.status).to.equal('in_progress');
  });

  it('should update multiple fields', async () => {
    const created = await processor.create({
      type: 'feature',
      mode: 'semi_auto',
      description: 'test feature',
    });

    await processor.update(created.id, {
      status: 'completed',
      priority: 'high',
      title: 'Updated Title',
    });

    const meta = await readMeta(testBaseDir, created.path);
    expect(meta.status).to.equal('completed');
    expect(meta.priority).to.equal('high');
    expect(meta.title).to.equal('Updated Title');
  });

  it('should update tags', async () => {
    const created = await processor.create({
      type: 'bug',
      mode: 'semi_auto',
      description: 'test bug',
    });

    await processor.update(created.id, {
      tags: ['urgent', 'frontend'],
    });

    const meta = await readMeta(testBaseDir, created.path);
    expect(meta.tags).to.deep.equal(['urgent', 'frontend']);
  });

  it('should throw error for non-existent requirement', async () => {
    let err;
    try {
      await processor.update('NONEXISTENT-0001', { status: 'completed' });
    } catch (e) {
      err = e;
    }
    expect(err).to.be.an('Error');
  });
});

describe('Processor - get', () => {
  let processor;

  beforeEach(async () => {
    await init(testBaseDir);
    await resetIdGenerator();
    processor = new Processor(testBaseDir);
  });

  afterEach(async () => {
    await cleanup(testBaseDir);
  });

  it('should get requirement details', async () => {
    const created = await processor.create({
      type: 'bug',
      mode: 'semi_auto',
      description: 'test bug',
    });

    const result = await processor.get(created.id);

    expect(result).to.not.be.undefined;
    expect(result.id).to.equal(created.id);
    expect(result.type).to.equal('bug');
    expect(result.description).to.equal('test bug');
    expect(result.status).to.equal('planning');
  });

  it('should throw error for non-existent requirement', async () => {
    let err;
    try {
      await processor.get('NONEXISTENT-0001');
    } catch (e) {
      err = e;
    }
    expect(err).to.be.an('Error');
  });

  it('should return complete requirement with all metadata', async () => {
    const created = await processor.create({
      type: 'feature',
      mode: 'full_auto',
      description: 'test feature',
    });

    await processor.update(created.id, {
      title: 'Feature Title',
      tags: ['api', 'backend'],
    });

    const result = await processor.get(created.id);

    expect(result.title).to.equal('Feature Title');
    expect(result.tags).to.deep.equal(['api', 'backend']);
    expect(result.mode).to.equal('full_auto');
    expect(result.created).to.not.be.undefined;
    expect(result.priority).to.equal('medium');
  });
});
