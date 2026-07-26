import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function lockPackages() {
  return JSON.parse(fs.readFileSync(path.join(REPO, 'desktop/package-lock.json'), 'utf8')).packages;
}

function packageEntry(packages, packageName) {
  return packages[`node_modules/${packageName}`];
}

function packageVersions(packages, packageName) {
  const suffix = `/node_modules/${packageName}`;
  return [
    ...new Set(
      Object.entries(packages)
        .filter(([key]) => key === `node_modules/${packageName}` || key.endsWith(suffix))
        .map(([, value]) => value.version),
    ),
  ].sort();
}

test('desktop packaging lock uses the reviewed modern toolchain', () => {
  const packages = lockPackages();
  assert.equal(packages[''].engines.node, '>=22.12.0');
  assert.equal(packageEntry(packages, 'electron-builder').version, '26.15.7');
  assert.equal(packageEntry(packages, 'app-builder-lib').version, '26.15.7');
  assert.deepEqual(packageVersions(packages, '@electron/asar'), ['4.2.1']);
  assert.deepEqual(packageVersions(packages, '@electron/universal'), ['3.0.6']);
  assert.deepEqual(packageVersions(packages, 'ejs'), ['6.0.1']);
  assert.deepEqual(packageVersions(packages, 'electron-winstaller'), ['5.4.4']);
  assert.deepEqual(packageVersions(packages, 'brace-expansion'), ['5.0.8']);
  assert.equal(packageEntry(packages, 'temp').resolved, '../vendor/temp-safe');
});

test('desktop commands resolve the isolated toolchain while packaging stays rooted at the application', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  const builderConfig = fs.readFileSync(path.join(REPO, 'electron-builder.yml'), 'utf8');
  assert.equal(manifest.scripts['desktop:install'], 'npm ci --prefix desktop');
  for (const script of ['desktop:dev', 'desktop:smoke', 'desktop:test', 'desktop:rebuild', 'desktop:pack']) {
    assert.match(manifest.scripts[script], /desktop\/node_modules\/\.bin\//u);
  }
  assert.match(builderConfig, /^electronVersion: 43\.2\.0$/mu);
  assert.match(builderConfig, /^extraMetadata:\n {2}main: desktop\/main\.js$/mu);
});

test('temp-safe preserves the tracked directory and file cleanup contract', async () => {
  const temp = require('../vendor/temp-safe');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-temp-safe-'));
  temp.track();
  try {
    const dir = await promisify(temp.mkdir)({ dir: root, prefix: 'dir-', suffix: '-x' });
    const file = await temp.open({ dir: root, prefix: 'file-', suffix: '.txt' });
    fs.closeSync(file.fd);
    assert.ok(fs.statSync(dir).isDirectory());
    assert.ok(fs.statSync(file.path).isFile());
    assert.deepEqual(await temp.cleanup(), { files: 1, dirs: 1 });
    assert.equal(fs.existsSync(dir), false);
    assert.equal(fs.existsSync(file.path), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
