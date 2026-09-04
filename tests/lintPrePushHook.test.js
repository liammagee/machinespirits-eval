import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  LINT_HOOK_MARKER,
  LINT_HOOK_SIDECAR,
  installLintPrePushHook,
  lintPrePushInputCarriesCommits,
  parseLintPrePushInput,
  renderLintPrePushWrapper,
  uninstallLintPrePushHook,
} from '../services/lintPrePushHook.js';
import { renderWorkplanTrailerPrePushWrapper } from '../services/workplanTrailerPrePushHook.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZERO = '0'.repeat(40);
const COMMIT = 'a'.repeat(40);

function temporaryDir(t, label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), label));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/**
 * A hermetic copy of the hook: the script resolves its repo root from its own
 * location, so exercising the "pushing checkout" behavior needs the script and
 * its service inside a throwaway checkout, not the real one.
 */
function stageHookCheckout(dir, packageJson) {
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'services'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'scripts', 'lint-hook.js'), path.join(dir, 'scripts', 'lint-hook.js'));
  fs.copyFileSync(path.join(ROOT, 'services', 'lintPrePushHook.js'), path.join(dir, 'services', 'lintPrePushHook.js'));
  fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  return path.join(dir, 'scripts', 'lint-hook.js');
}

function installNpmStub(binDir, { exitCode, logPath }) {
  const executable = path.join(binDir, 'npm');
  fs.writeFileSync(
    executable,
    `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(process.argv.slice(2)) + '\\n');
process.exit(${exitCode});
`,
    { mode: 0o755 },
  );
  fs.chmodSync(executable, 0o755);
}

function runHook(hookScript, { input, env = {} }) {
  return spawnSync(process.execPath, [hookScript, 'pre-push'], {
    cwd: path.dirname(path.dirname(hookScript)),
    input,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('pre-push input parses into updates and detects commit-carrying pushes', () => {
  const updates = parseLintPrePushInput(
    [`refs/heads/x ${COMMIT} refs/heads/x ${ZERO}`, `refs/heads/y ${ZERO} refs/heads/y ${COMMIT}`, ''].join('\n'),
  );
  assert.equal(updates.length, 2);
  assert.equal(lintPrePushInputCarriesCommits(updates), true);
  assert.equal(lintPrePushInputCarriesCommits([updates[1]]), false);
  assert.throws(() => parseLintPrePushInput('not enough fields'), /invalid pre-push update/u);
});

test('the wrapper pins its marker, its sidecar chain, and the gate script', () => {
  const wrapper = renderLintPrePushWrapper();
  assert.ok(wrapper.includes(LINT_HOOK_MARKER));
  assert.ok(wrapper.includes(LINT_HOOK_SIDECAR));
  assert.ok(wrapper.includes('scripts/lint-hook.js'));
});

test('install preserves an existing hook as the sidecar and uninstall restores it', (t) => {
  const dir = temporaryDir(t, 'lint-hook-install-');
  const target = path.join(dir, 'pre-push');
  const previous = '#!/bin/sh\nexit 0\n';
  fs.writeFileSync(target, previous, { mode: 0o755 });
  const installed = installLintPrePushHook(target);
  assert.equal(installed.status, 'installed');
  assert.equal(installed.preserved, true);
  assert.equal(fs.readFileSync(target, 'utf8'), renderLintPrePushWrapper());
  assert.equal(fs.readFileSync(path.join(dir, LINT_HOOK_SIDECAR), 'utf8'), previous);
  assert.equal(installLintPrePushHook(target).status, 'already_installed');
  const removed = uninstallLintPrePushHook(target);
  assert.equal(removed.status, 'uninstalled');
  assert.equal(removed.restored, true);
  assert.equal(fs.readFileSync(target, 'utf8'), previous);
});

test('the lint wrapper chains on top of the workplan-trailer wrapper', (t) => {
  const dir = temporaryDir(t, 'lint-hook-chain-');
  const target = path.join(dir, 'pre-push');
  fs.writeFileSync(target, renderWorkplanTrailerPrePushWrapper(), { mode: 0o755 });
  const installed = installLintPrePushHook(target);
  assert.equal(installed.status, 'installed');
  assert.equal(fs.readFileSync(path.join(dir, LINT_HOOK_SIDECAR), 'utf8'), renderWorkplanTrailerPrePushWrapper());
  const removed = uninstallLintPrePushHook(target);
  assert.equal(removed.restored, true);
  assert.equal(fs.readFileSync(target, 'utf8'), renderWorkplanTrailerPrePushWrapper());
});

test('pre-push runs the combined lint script and blocks the push on failure', (t) => {
  const dir = temporaryDir(t, 'lint-hook-block-');
  const binDir = path.join(dir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const logPath = path.join(dir, 'npm-calls.jsonl');
  installNpmStub(binDir, { exitCode: 3, logPath });
  const hookScript = stageHookCheckout(path.join(dir, 'checkout'), { scripts: { 'lint:all': 'true' } });
  const result = runHook(hookScript, {
    input: `refs/heads/topic ${COMMIT} refs/heads/topic ${ZERO}\n`,
    env: { PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}` },
  });
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(logPath, 'utf8').trim()), ['run', 'lint:all']);
  assert.match(result.stderr, /push blocked/u);
  assert.match(result.stderr, /npm run lint:fix/u);
});

test('pre-push passes when the combined lint script passes', (t) => {
  const dir = temporaryDir(t, 'lint-hook-pass-');
  const binDir = path.join(dir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const logPath = path.join(dir, 'npm-calls.jsonl');
  installNpmStub(binDir, { exitCode: 0, logPath });
  const hookScript = stageHookCheckout(path.join(dir, 'checkout'), { scripts: { 'lint:all': 'true' } });
  const result = runHook(hookScript, {
    input: `refs/heads/topic ${COMMIT} refs/heads/topic ${ZERO}\n`,
    env: { PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}` },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(logPath, 'utf8').trim()), ['run', 'lint:all']);
});

test('pre-push runs the line-cap ratchets after lint when the checkout has the script', (t) => {
  const dir = temporaryDir(t, 'lint-hook-ratchets-');
  const binDir = path.join(dir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const logPath = path.join(dir, 'npm-calls.jsonl');
  installNpmStub(binDir, { exitCode: 0, logPath });
  const hookScript = stageHookCheckout(path.join(dir, 'checkout'), {
    scripts: { 'lint:all': 'true', 'test:ratchets': 'true' },
  });
  const result = runHook(hookScript, {
    input: `refs/heads/topic ${COMMIT} refs/heads/topic ${ZERO}\n`,
    env: { PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}` },
  });
  assert.equal(result.status, 0, result.stderr);
  const calls = fs
    .readFileSync(logPath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(calls, [
    ['run', 'lint:all'],
    ['run', 'test:ratchets'],
  ]);
  assert.match(result.stderr, /test:ratchets/u);
});

test('pre-push skips deletion-only pushes and checkouts without the script', (t) => {
  const dir = temporaryDir(t, 'lint-hook-skip-');
  const binDir = path.join(dir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const logPath = path.join(dir, 'npm-calls.jsonl');
  installNpmStub(binDir, { exitCode: 3, logPath });
  const hookScript = stageHookCheckout(path.join(dir, 'checkout'), { scripts: { 'lint:all': 'true' } });
  const env = { PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}` };
  const deletion = runHook(hookScript, { input: `refs/heads/topic ${ZERO} refs/heads/topic ${COMMIT}\n`, env });
  assert.equal(deletion.status, 0, deletion.stderr);
  assert.match(deletion.stderr, /only deletions pushed/u);
  const bare = stageHookCheckout(path.join(dir, 'bare-checkout'), { scripts: {} });
  const missing = runHook(bare, { input: `refs/heads/topic ${COMMIT} refs/heads/topic ${ZERO}\n`, env });
  assert.equal(missing.status, 0, missing.stderr);
  assert.match(missing.stderr, /no "lint:all" script/u);
  assert.equal(fs.existsSync(logPath), false);
});
