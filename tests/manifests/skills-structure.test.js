import { describe, it } from 'mocha';
import { expect } from 'chai';
import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..');
const skillsDir = join(rootDir, 'skills');

/**
 * v0.13.0+ 标准：skills 目录采用平铺结构（无分类子目录）
 * skills/<skill-name>/SKILL.md（13 个 skills 全部平铺）
 */
describe('Skills Structure (技能目录结构 v0.13.0+)', () => {
  const expectedSkills = [
    'req',
    'req-manager',
    'req-brainstorm',
    'req-init',
    'req-doc-format',
    'req-quality',
    'req-test-plan',
    'req-verify',
    'req-priority',
    'req-metrics',
    'req-change',
    'req-migrate',
    'req-unify',
  ];

  it('skills/ 目录存在', () => {
    expect(existsSync(skillsDir), 'skills/ directory must exist').to.equal(true);
  });

  it('不再包含分类子目录（core/quality/analysis/change/utils）', () => {
    const legacyCategories = ['core', 'quality', 'analysis', 'change', 'utils'];
    const entries = readdirSync(skillsDir);
    const found = entries.filter((e) => legacyCategories.includes(e));
    expect(
      found,
      `Found legacy category directories: ${found.join(', ')}`
    ).to.have.lengthOf(0);
  });

  it('包含全部 13 个 skill 子目录', () => {
    const entries = readdirSync(skillsDir).filter((e) =>
      statSync(join(skillsDir, e)).isDirectory()
    );
    expectedSkills.forEach((skill) => {
      expect(entries, `Missing skill directory: ${skill}`).to.include(skill);
    });
  });

  it('每个 skill 目录都包含 SKILL.md 文件', () => {
    expectedSkills.forEach((skill) => {
      const skillMd = join(skillsDir, skill, 'SKILL.md');
      expect(existsSync(skillMd), `${skill}/SKILL.md must exist`).to.equal(true);
    });
  });

  it('SKILL.md 文件包含 frontmatter（--- ... ---）', () => {
    expectedSkills.forEach((skill) => {
      const skillMd = join(skillsDir, skill, 'SKILL.md');
      const content = readFileSync(skillMd, 'utf-8');
      expect(content.startsWith('---'), `${skill}/SKILL.md must start with frontmatter`).to.equal(
        true
      );
    });
  });

  it('SKILL.md 包含 name 和 description 字段', () => {
    expectedSkills.forEach((skill) => {
      const skillMd = join(skillsDir, skill, 'SKILL.md');
      const content = readFileSync(skillMd, 'utf-8');
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      expect(fmMatch, `${skill}/SKILL.md frontmatter not found`).to.not.equal(null);
      const fm = fmMatch[1];
      expect(fm, `${skill}/SKILL.md missing name field`).to.match(/^name:/m);
      expect(fm, `${skill}/SKILL.md missing description field`).to.match(/^description:/m);
    });
  });
});

/**
 * 验证 commands 目录结构（13 个命令）
 */
describe('Commands Structure', () => {
  const commandsDir = join(rootDir, 'commands');

  it('commands/ 目录存在', () => {
    expect(existsSync(commandsDir), 'commands/ directory must exist').to.equal(true);
  });

  it('包含主命令文件 req.md', () => {
    const reqMd = join(commandsDir, 'req.md');
    expect(existsSync(reqMd), 'commands/req.md must exist').to.equal(true);
  });

  it('commands 是平铺结构（每个 .md 直接位于 commands/ 下）', () => {
    const entries = readdirSync(commandsDir);
    const mdFiles = entries.filter((e) => e.endsWith('.md'));
    expect(mdFiles.length, 'Should have multiple command .md files').to.be.greaterThan(5);
  });
});

/**
 * 验证不再有旧平台/旧路径引用残留
 */
describe('Legacy Path Cleanup', () => {
  it('commands 与 skills 不再引用 .claude 路径或旧 /req: 命名空间', () => {
    const legacyPatterns = ['.claude/', '.claude-context.md', '/req:', 'CLAUDE_PLUGIN_ROOT'];
    const offenders = [];

    const scan = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.name.endsWith('.md')) {
          const content = readFileSync(full, 'utf-8');
          const found = legacyPatterns.filter((p) => content.includes(p));
          if (found.length > 0) {
            offenders.push(`${full}: ${found.join(', ')}`);
          }
        }
      }
    };

    scan(join(rootDir, 'commands'));
    scan(join(rootDir, 'skills'));

    expect(offenders, `Legacy references found:\n${offenders.join('\n')}`).to.have.lengthOf(0);
  });

  it('README.md 不再引用嵌套 skills 路径', () => {
    const readmeMd = join(rootDir, 'README.md');
    const content = readFileSync(readmeMd, 'utf-8');
    const legacyPatterns = ['skills/core/', 'skills/quality/', 'skills/analysis/', 'skills/change/', 'skills/utils/'];
    const found = legacyPatterns.filter((p) => content.includes(p));
    expect(found, `README.md still references legacy paths: ${found.join(', ')}`).to.have.lengthOf(
      0
    );
  });
});
