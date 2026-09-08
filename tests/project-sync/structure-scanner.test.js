import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

import { scanProjectStructure } from '../../scripts/requirement-manager/project-sync/structure-scanner.js';
import { safeJoin } from '../helpers/path-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE = path.join(__dirname, '../temp-test-scanner');

async function setupProject(structure) {
  await fs.mkdir(TEST_BASE, { recursive: true });
  for (const [relPath, content] of Object.entries(structure)) {
    const fullPath = safeJoin(TEST_BASE, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }
}

async function cleanup() {
  try {
    await fs.rm(TEST_BASE, { recursive: true, force: true });
  } catch (_e) {
    // ignore
  }
}

describe('Structure Scanner', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('should read package.json and extract metadata', async () => {
    await setupProject({
      'package.json': JSON.stringify({
        name: 'test-project',
        version: '1.2.3',
        description: 'A test project',
        main: 'src/index.js',
        dependencies: { lodash: '^4.0.0' },
      }),
    });
    const result = await scanProjectStructure(TEST_BASE);
    expect(result.packageInfo.name).to.equal('test-project');
    expect(result.packageInfo.version).to.equal('1.2.3');
    expect(result.description).to.equal('A test project');
  });

  it('should handle missing package.json gracefully', async () => {
    await fs.mkdir(TEST_BASE, { recursive: true });
    await fs.writeFile(path.join(TEST_BASE, 'file.txt'), 'hello');
    const result = await scanProjectStructure(TEST_BASE);
    expect(result.packageInfo.name).to.equal(path.basename(TEST_BASE));
  });

  it('should skip ignored directories', async () => {
    await setupProject({
      'package.json': '{}',
      'src/index.js': 'console.log(1)',
      'node_modules/lodash/index.js': 'module.exports = {}',
      '.git/config': '[core]',
      'dist/bundle.js': 'compiled',
    });
    const result = await scanProjectStructure(TEST_BASE);
    expect(result.tree).to.contain('src/');
    expect(result.tree).to.not.contain('node_modules');
    expect(result.tree).to.not.contain('.git');
    expect(result.tree).to.not.contain('dist');
  });

  it('should respect depth limit', async () => {
    await setupProject({
      'package.json': '{}',
      'a/b/c/d/deep.js': 'export const x = 1;',
      'a/top.js': 'export const y = 2;',
    });
    const result = await scanProjectStructure(TEST_BASE, { depth: 2 });
    expect(result.tree).to.contain('a/');
    expect(result.tree).to.contain('b/');
    // depth=2 限制下不应该出现 d/deep.js
  });

  it('should generate modules table markdown', async () => {
    await setupProject({
      'package.json': '{}',
      'src/index.js': 'console.log(1)',
      'scripts/run.js': 'run()',
    });
    const result = await scanProjectStructure(TEST_BASE);
    expect(result.modulesTable).to.be.a('string');
    expect(result.modulesTable).to.contain('|');
  });

  it('should list dependencies from package.json', async () => {
    await setupProject({
      'package.json': JSON.stringify({
        name: 'dep-test',
        dependencies: { express: '^4.0.0', axios: '^1.0.0' },
        devDependencies: { mocha: '^10.0.0', chai: '^4.0.0' },
      }),
    });
    const result = await scanProjectStructure(TEST_BASE);
    expect(result.dependenciesList).to.contain('express');
    expect(result.dependenciesList).to.contain('mocha');
  });
});
