import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

test('package and lockfile versions stay aligned', async () => {
  const [packageJson, packageLock] = await Promise.all([
    readJson(new URL('../package.json', import.meta.url)),
    readJson(new URL('../package-lock.json', import.meta.url)),
  ]);

  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[''].version, packageJson.version);
});

test('published package includes the in-housed tutor core', async () => {
  const packageJson = await readJson(new URL('../package.json', import.meta.url));

  assert.ok(packageJson.files.includes('tutor-core/'));
  assert.ok(packageJson.files.includes('!tutor-core/data/'));
  assert.equal(packageJson.peerDependencies?.['@machinespirits/tutor-core'], undefined);
});

test('README does not instruct consumers to install the former peer package', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  assert.doesNotMatch(readme, /npm install @machinespirits\/tutor-core/);
  assert.doesNotMatch(readme, /@machinespirits\/tutor-core.*peer dependency/i);
});
