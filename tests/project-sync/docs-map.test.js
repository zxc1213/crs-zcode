import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import yaml from 'js-yaml';

import {
  scanExternalDocs,
  registerDoc,
  markReviewed,
  checkDrift,
  readDocsMap,
  validateDocPath,
  docsMapPath,
} from '../../scripts/requirement-manager/project-sync/docs-map.js';
import { initializeProjectDocs } from '../../scripts/requirement-manager/project-sync/index.js';
import { safeJoin } from '../helpers/path-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE = path.join(__dirname, '../temp-test-docs-map');

async function setupBase(files = {}) {
  await fs.mkdir(TEST_BASE, { recursive: true });
  await fs.writeFile(path.join(TEST_BASE, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }), 'utf-8');
  for (const [rel, content] of Object.entries(files)) {
    const target = safeJoin(TEST_BASE, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf-8');
  }
}

async function cleanup() {
  try {
    await fs.rm(TEST_BASE, { recursive: true, force: true });
  } catch (_e) {}
}

describe('docs-map 宿主项目文档纳管', () => {
  beforeEach(async () => {
    await cleanup();
  });
  afterEach(cleanup);

  describe('validateDocPath 路径安全', () => {
    beforeEach(() => setupBase());

    it('接受项目内相对路径并规范分隔符', async () => {
      await setupBase({ 'docs/api.md': '# API' });
      expect(validateDocPath(TEST_BASE, 'docs/api.md')).to.equal('docs/api.md');
      expect(validateDocPath(TEST_BASE, 'docs\\api.md')).to.equal('docs/api.md');
    });

    it('拒绝绝对路径与 .. 穿越', () => {
      expect(validateDocPath(TEST_BASE, 'C:/Windows/system32/x.md')).to.be.null;
      expect(validateDocPath(TEST_BASE, '/etc/passwd.md')).to.be.null;
      expect(validateDocPath(TEST_BASE, '../outside.md')).to.be.null;
      expect(validateDocPath(TEST_BASE, 'docs/../../escape.md')).to.be.null;
    });
  });

  describe('scanExternalDocs 自动发现', () => {
    it('发现 README、根级 md 与 docs/ 下的 md，跳过 .requirements 与 node_modules', async () => {
      await setupBase({
        'README.md': '# readme',
        'CONTRIBUTING.md': 'x',
        'docs/architecture.md': '# arch',
        'docs/api/interface.md': '# api',
        '.requirements/project/meta.yaml': 'version: 1',
        'node_modules/pkg/readme.md': 'x',
        'docs/too/deep/much/level.md': '# deep', // 超过 docs/ 下 3 层深度不会被发现
      });

      const suggestions = await scanExternalDocs(TEST_BASE);
      const paths = suggestions.map((s) => s.path);
      expect(paths).to.include('README.md');
      expect(paths).to.include('CONTRIBUTING.md');
      expect(paths).to.include('docs/architecture.md');
      expect(paths).to.include('docs/api/interface.md');
      expect(paths).to.not.include('.requirements/project/meta.yaml');
      expect(paths).to.not.include('node_modules/pkg/readme.md');
      expect(paths).to.not.include('docs/too/deep/much/level.md');
    });

    it('按文件名猜测角色与同步时机', async () => {
      await setupBase({
        'README.md': 'x',
        'docs/architecture.md': 'x',
        'docs/api.md': 'x',
        'notes.md': 'x',
      });
      const suggestions = await scanExternalDocs(TEST_BASE);
      const byPath = Object.fromEntries(suggestions.map((s) => [s.path, s]));
      expect(byPath['README.md'].role).to.equal('readme');
      expect(byPath['README.md'].sync_on).to.equal('done');
      expect(byPath['docs/architecture.md'].role).to.equal('architecture');
      expect(byPath['docs/architecture.md'].sync_on).to.equal('change');
      expect(byPath['docs/api.md'].role).to.equal('api');
      expect(byPath['notes.md'].role).to.equal('other');
    });
  });

  describe('registerDoc / markReviewed', () => {
    beforeEach(() => setupBase({ 'README.md': '# r', 'docs/guide.md': '# g' }));

    it('登记文档并按 path 去重', async () => {
      const r1 = await registerDoc(TEST_BASE, { path: 'README.md', role: 'readme' });
      expect(r1.success).to.be.true;
      const r2 = await registerDoc(TEST_BASE, { path: 'README.md', role: 'readme' });
      expect(r2.success).to.be.true;

      const { docs } = await readDocsMap(TEST_BASE);
      expect(docs).to.have.lengthOf(1);
      expect(docs[0].last_reviewed).to.be.null;
    });

    it('拒绝不存在或非法路径', async () => {
      const r1 = await registerDoc(TEST_BASE, { path: 'nope.md' });
      expect(r1.success).to.be.false;
      const r2 = await registerDoc(TEST_BASE, { path: '../escape.md' });
      expect(r2.success).to.be.false;
    });

    it('标记复核后 last_reviewed 更新', async () => {
      await registerDoc(TEST_BASE, { path: 'docs/guide.md' });
      const r = await markReviewed(TEST_BASE, 'docs/guide.md');
      expect(r.success).to.be.true;
      const { docs } = await readDocsMap(TEST_BASE);
      expect(docs[0].last_reviewed).to.be.a('string');
    });
  });

  describe('checkDrift 漂移检测', () => {
    it('未复核的文档归入 unconfirmed，复核后又改过的归入 stale，消失的文件也提示', async () => {
      await setupBase({ 'README.md': '# r', 'docs/architecture.md': '# a' });
      await registerDoc(TEST_BASE, { path: 'README.md' });
      await registerDoc(TEST_BASE, { path: 'docs/architecture.md' });

      // 复核 architecture，然后再改它 → stale
      await markReviewed(TEST_BASE, 'docs/architecture.md');
      const later = new Date(Date.now() + 5000);
      await fs.utimes(path.join(TEST_BASE, 'docs', 'architecture.md'), later, later);

      // 再登记一个随后被删掉的文件 → stale (不存在)
      await fs.writeFile(path.join(TEST_BASE, 'temp.md'), 'x', 'utf-8');
      await registerDoc(TEST_BASE, { path: 'temp.md' });
      await fs.rm(path.join(TEST_BASE, 'temp.md'));

      const drift = await checkDrift(TEST_BASE);
      expect(drift.total).to.equal(3);
      expect(drift.unconfirmed.map((d) => d.path)).to.include('README.md');
      expect(drift.stale.map((d) => d.path)).to.include('docs/architecture.md');
      expect(drift.stale.map((d) => d.path)).to.include('temp.md');
    });
  });

  describe('初始化自动纳管', () => {
    it('initializeProjectDocs 自动登记外部文档并写入 docs_registered 事件', async () => {
      await setupBase({ 'README.md': '# r', 'docs/architecture.md': '# a' });
      await fs.mkdir(safeJoin(TEST_BASE, '.requirements'), { recursive: true });

      await initializeProjectDocs(TEST_BASE);

      const mapFile = docsMapPath(TEST_BASE);
      const map = yaml.load(await fs.readFile(mapFile, 'utf-8'));
      const paths = map.docs.map((d) => d.path);
      expect(paths).to.include('README.md');
      expect(paths).to.include('docs/architecture.md');

      // 时间线有 docs_registered 事件
      const { readTimeline } = await import('../../scripts/requirement-manager/project-sync/timeline.js');
      const timeline = await readTimeline(TEST_BASE, { type: 'docs_registered' });
      expect(timeline.events).to.have.lengthOf(1);
    });
  });
});
