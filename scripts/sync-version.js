#!/usr/bin/env node
/**
 * Version sync script.
 *
 * Reads `version` from package.json and writes it to the plugin manifest
 * so the version number stays consistent and avoids drift.
 *
 * Targets:
 *   - .zcode-plugin/plugin.json  (ZCode plugin manifest)
 *   - marketplace.json           (marketplace listing, plugins[0].version)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
const version = packageJson.version;

const manifests = [
  { path: '.zcode-plugin/plugin.json', key: 'version' },
  { path: 'marketplace.json', key: 'plugins.0.version', arrayIndex: true },
];

let updated = 0;
let skipped = 0;
let missing = 0;

manifests.forEach(({ path, key }) => {
  const filePath = join(rootDir, path);

  if (!existsSync(filePath)) {
    console.warn(`! Missing: ${path}`);
    missing++;
    return;
  }

  const manifest = JSON.parse(readFileSync(filePath, 'utf-8'));

  // resolve dotted key, e.g. plugins.0.version
  const segs = String(key).split('.');
  const holder = segs.slice(0, -1).reduce((obj, seg) => obj[seg], manifest);
  const leaf = segs[segs.length - 1];

  if (holder[leaf] !== version) {
    const oldVersion = holder[leaf];
    holder[leaf] = version;
    writeFileSync(filePath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`Updated ${path}: ${oldVersion} -> ${version}`);
    updated++;
  } else {
    console.log(`- ${path} already at ${version}`);
    skipped++;
  }
});

console.log(`\nVersion ${version} synced: ${updated} updated, ${skipped} skipped, ${missing} missing.`);

if (missing > 0) {
  console.warn('Warning: Some manifest files are missing.');
}
