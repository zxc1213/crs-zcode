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

describe('Manifest Validation (ZCode manifest 格式校验)', () => {
  describe('ZCode manifest (.zcode-plugin/plugin.json)', () => {
    it('文件存在且为合法 JSON', () => {
      const m = readJson('.zcode-plugin/plugin.json');
      expect(m, '.zcode-plugin/plugin.json must exist').to.not.equal(null);
    });

    it('包含 name/version/description 字段', () => {
      const m = readJson('.zcode-plugin/plugin.json');
      expect(m.name).to.be.a('string').and.to.not.be.empty;
      expect(m.version).to.match(/^\d+\.\d+\.\d+/);
      expect(m.description).to.be.a('string').and.to.not.be.empty;
    });

    it('包含 keywords 数组', () => {
      const m = readJson('.zcode-plugin/plugin.json');
      expect(m.keywords).to.be.an('array');
      expect(m.keywords.length).to.be.greaterThan(0);
    });

    it('不包含 skills/commands/hooks 字段（依赖约定目录发现）', () => {
      const m = readJson('.zcode-plugin/plugin.json');
      expect(m).to.not.have.property('skills');
      expect(m).to.not.have.property('commands');
      expect(m).to.not.have.property('hooks');
    });

    it('userConfig 声明合法', () => {
      const m = readJson('.zcode-plugin/plugin.json');
      if (m.userConfig) {
        expect(m.userConfig).to.be.an('object');
        Object.values(m.userConfig).forEach((cfg) => {
          expect(cfg).to.have.property('type');
          expect(cfg).to.have.property('description');
        });
      }
    }
    );
  });

  describe('约定目录结构', () => {
    it('commands/ 目录存在且含主命令', () => {
      expect(existsSync(join(rootDir, 'commands', 'req.md')), 'commands/req.md must exist').to.equal(true);
    });

    it('skills/ 目录存在且主入口 skill 完整', () => {
      const skill = join(rootDir, 'skills', 'req', 'SKILL.md');
      expect(existsSync(skill), 'skills/req/SKILL.md must exist').to.equal(true);
    });

    it('hooks/hooks.json 存在且为合法 JSON', () => {
      const m = readJson('hooks/hooks.json');
      expect(m, 'hooks/hooks.json must exist').to.not.equal(null);
      expect(m.hooks).to.be.an('object');
    });

    it('hooks 引用使用 ${ZCODE_PLUGIN_ROOT}', () => {
      const content = readFileSync(join(rootDir, 'hooks', 'hooks.json'), 'utf-8');
      expect(content).to.include('${ZCODE_PLUGIN_ROOT}');
      expect(content).to.not.include('node -e');
    });
  });
});
