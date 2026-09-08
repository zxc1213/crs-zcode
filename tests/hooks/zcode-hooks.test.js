import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { readActiveRequirement } from '../../hooks/lib.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testRoot = join(__dirname, '..', '.tmp-hook-lib-test');

function join(...parts) {
  return path.join(...parts);
}

const REQ_ID = 'FEAT-20260908-001-aaa';

function makeProject(dir) {
  return fs.mkdir(join(dir, '.requirements', 'features', REQ_ID), { recursive: true });
}

async function writeMeta(dir, status, created = '2026-09-08') {
  const metaPath = join(dir, '.requirements', 'features', REQ_ID, 'meta.yaml');
  await fs.writeFile(
    metaPath,
    `id: ${REQ_ID}\ntype: feature\nstatus: ${status}\ncreated: ${created}\n`,
    'utf-8',
  );
}

describe('hooks/lib.mjs readActiveRequirement', () => {
  const projectDir = path.join(testRoot, 'proj');

  beforeEach(async () => {
    await makeProject(projectDir);
  });

  afterEach(async () => {
    await fs.rm(testRoot, { recursive: true, force: true });
  });

  it('returns null when .requirements does not exist', () => {
    expect(readActiveRequirement(path.join(testRoot, 'missing'))).to.equal(null);
  });

  it('returns null when every requirement is done', async () => {
    await writeMeta(projectDir, 'done');
    expect(readActiveRequirement(projectDir)).to.equal(null);
  });

  it('finds a planning requirement by scanning meta.yaml', async () => {
    await writeMeta(projectDir, 'planning');
    const active = readActiveRequirement(projectDir);

    expect(active).to.not.equal(null);
    expect(active.target).to.equal(REQ_ID);
    expect(active.status).to.equal('planning');
    expect(active.reqPath).to.include(REQ_ID);
  });

  it('finds implementing/review requirements as active too', async () => {
    await writeMeta(projectDir, 'implementing');
    expect(readActiveRequirement(projectDir).status).to.equal('implementing');

    await writeMeta(projectDir, 'review');
    expect(readActiveRequirement(projectDir).status).to.equal('review');
  });

  it('prefers the newest requirement when several are active', async () => {
    await writeMeta(projectDir, 'planning', '2026-09-01');

    const otherId = 'BUG-20260908-002-bbb';
    const bugDir = join(projectDir, '.requirements', 'bugs', otherId);
    await fs.mkdir(bugDir, { recursive: true });
    await fs.writeFile(
      join(bugDir, 'meta.yaml'),
      `id: ${otherId}\ntype: bug\nstatus: analyzed\ncreated: 2026-09-08\n`,
      'utf-8',
    );

    const active = readActiveRequirement(projectDir);
    expect(active.target).to.equal(otherId);
    expect(active.status).to.equal('analyzed');
  });

  it('supports the legacy ACTIVE symlink when present', async () => {
    await writeMeta(projectDir, 'planning');

    // create a plain-text ACTIVE marker + fake link is not possible on all
    // platforms; only assert symlink behaviour where the platform allows it
    try {
      await fs.symlink(join('features', REQ_ID), join(projectDir, '.requirements', 'ACTIVE'), 'junction');
    } catch (_err) {
      // platform without symlink support: scanning path already covered above
      return;
    }

    const active = readActiveRequirement(projectDir);
    expect(active).to.not.equal(null);
    expect(active.status).to.equal('planning');
  });

  it('ignores _system and hidden directories', async () => {
    await writeMeta(projectDir, 'planning');

    const sysDir = join(projectDir, '.requirements', '_system', 'FEAT-x');
    await fs.mkdir(sysDir, { recursive: true });
    await fs.writeFile(join(sysDir, 'meta.yaml'), 'status: planning\n', 'utf-8');

    const active = readActiveRequirement(projectDir);
    expect(active.target).to.equal(REQ_ID);
  });
});
