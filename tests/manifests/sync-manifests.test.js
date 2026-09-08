import { describe, it } from 'mocha';
import { expect } from 'chai';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..');

function readJson(rel) {
  const abs = join(rootDir, rel);
  if (!existsSync(abs)) return null;
  return JSON.parse(readFileSync(abs, 'utf-8'));
}

/**
 * 验证 sync-version.js 同步逻辑的结果（不直接执行脚本）
 * 通过检查 manifest 的 version 字段一致性来验证同步机制有效性
 */
describe('Version Sync (manifest 版本同步验证)', () => {
  const packageJson = readJson('package.json');
  const expectedVersion = packageJson.version;

  it('package.json 包含 version 字段', () => {
    expect(expectedVersion).to.match(/^\d+\.\d+\.\d+/);
  });

  const manifests = [
    { path: '.zcode-plugin/plugin.json', platform: 'ZCode' },
    { path: 'marketplace.json', platform: 'Marketplace listing', versionKey: 'plugins[0].version' },
  ];

  manifests.forEach(({ path, platform, versionKey }) => {
    it(`${platform} ${path} 版本与 package.json 一致 (${expectedVersion})`, () => {
      const m = readJson(path);
      expect(m, `${path} must exist`).to.not.equal(null);
      const v = versionKey
        ? m.plugins[0].version
        : m.version;
      expect(v, `${platform} version mismatch`).to.equal(expectedVersion);
    });
  });

  it('版本号符合 semver 格式', () => {
    expect(expectedVersion).to.match(/^\d+\.\d+\.\d+(?:-[\w.]+)?$/);
  });
});

/**
 * 验证 sync-version.js 脚本的清单列表与实际配置匹配
 * （防止脚本硬编码与实际 manifest 文件不同步）
 */
describe('sync-version.js 脚本完整性', () => {
  it('脚本文件存在', () => {
    const scriptPath = join(rootDir, 'scripts', 'sync-version.js');
    expect(existsSync(scriptPath), 'scripts/sync-version.js must exist').to.equal(true);
  });

  it('脚本中包含全部 manifest 目标', () => {
    const scriptPath = join(rootDir, 'scripts', 'sync-version.js');
    const content = readFileSync(scriptPath, 'utf-8');

    expect(content, 'sync-version.js must reference .zcode-plugin/plugin.json').to.include(
      '.zcode-plugin/plugin.json',
    );
    expect(content, 'sync-version.js must reference marketplace.json').to.include(
      'marketplace.json',
    );
  });

  it('package.json scripts 中注册了 sync-version 命令', () => {
    const pkg = readJson('package.json');
    expect(pkg.scripts).to.have.property('sync-version');
    expect(pkg.scripts['sync-version']).to.include('sync-version.js');
  });
});
