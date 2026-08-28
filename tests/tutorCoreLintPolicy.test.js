// GUARD: every committed JavaScript file under tutor-core/ is covered by a
// committed lint and format policy.
//
// The module used to be excluded from both the eval repo's ESLint config and
// Prettier, behind a comment about upstream rules that no longer existed. That
// exclusion is what let 30 errors and formatting drift accumulate unseen, two
// of them faults that threw at runtime. The policy now lives inside the module
// so it survives re-extraction; this test is what stops a broad exclusion from
// quietly coming back.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORE_ROOT = path.join(REPO_ROOT, 'tutor-core');

function trackedCoreJsFiles() {
  const output = execFileSync('git', ['ls-files', '-z', 'tutor-core'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return output
    .split('\0')
    .filter(Boolean)
    .filter((file) => file.endsWith('.js') || file.endsWith('.mjs'))
    .filter((file) => !file.includes('/node_modules/'));
}

test('tutor-core carries its own committed lint and format policy', () => {
  for (const file of ['eslint.config.js', '.prettierrc.json', '.prettierignore']) {
    assert.ok(fs.existsSync(path.join(CORE_ROOT, file)), `tutor-core/${file} must be committed`);
  }

  // The module has to be able to run its own policy once it is pulled back out
  // of this tree, so the tools are its own devDependencies.
  const manifest = JSON.parse(fs.readFileSync(path.join(CORE_ROOT, 'package.json'), 'utf8'));
  for (const tool of ['eslint', '@eslint/js', 'eslint-config-prettier', 'globals', 'prettier']) {
    assert.ok(manifest.devDependencies?.[tool], `tutor-core must declare ${tool} so its policy travels with it`);
  }
  assert.ok(manifest.scripts?.lint, 'tutor-core must expose its own lint script');
  assert.ok(manifest.scripts?.['format:check'], 'tutor-core must expose its own format:check script');
});

test('the root lint lane runs the tutor-core policy', () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')).scripts;
  // The root ESLint config ignores tutor-core/ so nothing is linted under two
  // rule sets. That is only safe while the lane invokes the module's own config.
  assert.match(scripts['lint:all'], /lint:tutor-core/u);
  assert.match(scripts['lint:all'], /format:check:tutor-core/u);
  assert.match(scripts['lint:tutor-core'], /cd tutor-core/u);
  assert.match(scripts['format:check:tutor-core'], /cd tutor-core/u);

  // CI runs the steps one by one rather than through lint:all, so it needs the
  // module's steps named there too.
  const workflow = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/test.yml'), 'utf8');
  assert.match(workflow, /^ {6}- run: npm run lint:tutor-core$/mu);
  assert.match(workflow, /^ {6}- run: npm run format:check:tutor-core$/mu);
});

test('no committed tutor-core JavaScript file escapes the policy', () => {
  const tracked = trackedCoreJsFiles();
  assert.ok(tracked.length > 20, `expected a real tutor-core tree, found ${tracked.length} tracked js files`);

  // Ask the tools themselves which files they would check, rather than
  // re-implementing their ignore logic here.
  const eslintList = execFileSync(
    process.execPath,
    [path.join(REPO_ROOT, 'node_modules/eslint/bin/eslint.js'), '.', '-f', 'json'],
    { cwd: CORE_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  const linted = new Set(
    JSON.parse(eslintList).map((entry) => path.relative(REPO_ROOT, entry.filePath).split(path.sep).join('/')),
  );

  const missing = tracked.filter((file) => !linted.has(file) && file !== 'tutor-core/eslint.config.js');
  assert.deepEqual(missing, [], 'these committed tutor-core files are not linted by the module policy');

  // eslint reports its own config file only when it is inside the linted set;
  // either way it must not be the one file the policy skips.
  assert.ok(
    linted.has('tutor-core/eslint.config.js') || fs.existsSync(path.join(CORE_ROOT, 'eslint.config.js')),
    'tutor-core/eslint.config.js must exist',
  );
});
