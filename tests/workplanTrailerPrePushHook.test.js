import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  WORKPLAN_TRAILER_HOOK_MARKER,
  WORKPLAN_TRAILER_HOOK_SIDECAR,
  classifyWorkplanTrailerHookOutcome,
  installWorkplanTrailerPrePushHook,
  parseWorkplanTrailerPrePushInput,
  resolveWorkplanTrailerHookEnforcement,
  selectWorkplanTrailerPushRanges,
  uninstallWorkplanTrailerPrePushHook,
} from '../services/workplanTrailerPrePushHook.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK_SCRIPT = path.join(ROOT, 'scripts', 'workplan-trailer-hook.js');
const ZERO = '0'.repeat(40);

function runHook(input, env = {}) {
  return spawnSync(process.execPath, [HOOK_SCRIPT, 'pre-push'], {
    cwd: ROOT,
    input,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('pre-push input parses into ref updates and rejects malformed lines', () => {
  const source = [
    'refs/heads/topic abc123 refs/heads/topic 000000',
    'refs/heads/main def456 refs/heads/main abc123',
    '',
  ].join('\n');
  assert.deepEqual(parseWorkplanTrailerPrePushInput(source), [
    { localRef: 'refs/heads/topic', localOid: 'abc123', remoteRef: 'refs/heads/topic', remoteOid: '000000' },
    { localRef: 'refs/heads/main', localOid: 'def456', remoteRef: 'refs/heads/main', remoteOid: 'abc123' },
  ]);
  assert.throws(() => parseWorkplanTrailerPrePushInput('not enough fields'), /invalid pre-push update/u);
});

test('only updates that carry commits onto a protected ref become ranges', () => {
  const updates = parseWorkplanTrailerPrePushInput(
    [
      `refs/heads/main aaaa1111 refs/heads/main bbbb2222`,
      `refs/heads/topic cccc3333 refs/heads/topic dddd4444`,
      `(delete) ${ZERO} refs/heads/main eeee5555`,
      `refs/heads/main ffff6666 refs/heads/main ${ZERO}`,
    ].join('\n'),
  );
  const { checks, skipped } = selectWorkplanTrailerPushRanges({ updates });
  assert.deepEqual(
    checks.map((check) => check.range),
    ['bbbb2222..aaaa1111'],
  );
  assert.deepEqual(
    skipped.map((entry) => entry.reason),
    [
      'refs/heads/topic is not a protected ref',
      'branch deletion pushes no commits',
      'remote ref does not exist yet; no previous tip to diff against',
    ],
  );
});

test('a custom protected ref list replaces the default rather than extending it', () => {
  const updates = parseWorkplanTrailerPrePushInput(
    [
      'refs/heads/main aaaa1111 refs/heads/main bbbb2222',
      'refs/heads/release cccc3333 refs/heads/release dddd4444',
    ].join('\n'),
  );
  const { checks } = selectWorkplanTrailerPushRanges({ updates, protectedRefs: ['refs/heads/release'] });
  assert.deepEqual(
    checks.map((check) => check.remoteRef),
    ['refs/heads/release'],
  );
});

test('report_only is the default and downgrades a finding to a warning', () => {
  assert.equal(resolveWorkplanTrailerHookEnforcement({}), 'report_only');
  assert.equal(resolveWorkplanTrailerHookEnforcement({ WORKPLAN_TRAILER_HOOK_ENFORCEMENT: 'blocking' }), 'blocking');
  assert.throws(
    () => resolveWorkplanTrailerHookEnforcement({ WORKPLAN_TRAILER_HOOK_ENFORCEMENT: 'off' }),
    /must be one of report_only, blocking/u,
  );
  assert.equal(classifyWorkplanTrailerHookOutcome(0, 'report_only'), 'allow');
  assert.equal(classifyWorkplanTrailerHookOutcome(0, 'blocking'), 'allow');
  assert.equal(classifyWorkplanTrailerHookOutcome(2, 'report_only'), 'warn');
  assert.equal(classifyWorkplanTrailerHookOutcome(2, 'blocking'), 'block');
  assert.throws(() => classifyWorkplanTrailerHookOutcome(1, 'advisory'), /unknown enforcement mode/u);
});

test('installer composes with an existing hook and replays pre-push stdin to both hooks', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workplan-trailer-hook-'));
  try {
    const initialized = spawnSync('git', ['init', '--quiet', tempRoot], { encoding: 'utf8' });
    assert.equal(initialized.status, 0, initialized.stderr);
    const hookDir = path.join(tempRoot, '.git', 'hooks');
    const hookPath = path.join(hookDir, 'pre-push');
    const original = '#!/bin/sh\ncat > original-input.txt\n';
    fs.writeFileSync(hookPath, original, { mode: 0o755 });

    const installed = installWorkplanTrailerPrePushHook(hookPath);
    assert.equal(installed.status, 'installed');
    assert.equal(installed.preserved, true);
    assert.match(fs.readFileSync(hookPath, 'utf8'), new RegExp(WORKPLAN_TRAILER_HOOK_MARKER, 'u'));
    assert.equal(fs.readFileSync(path.join(hookDir, WORKPLAN_TRAILER_HOOK_SIDECAR), 'utf8'), original);

    const scriptDir = path.join(tempRoot, 'scripts');
    fs.mkdirSync(scriptDir);
    fs.writeFileSync(
      path.join(scriptDir, 'workplan-trailer-hook.js'),
      "import fs from 'node:fs';\nfs.writeFileSync('trailer-input.txt', fs.readFileSync(0, 'utf8'));\n",
    );
    const input = 'refs/heads/main abc123 refs/heads/main def456\n';
    const executed = spawnSync(hookPath, ['origin', 'example.invalid'], { cwd: tempRoot, input, encoding: 'utf8' });
    assert.equal(executed.status, 0, executed.stderr);
    assert.equal(fs.readFileSync(path.join(tempRoot, 'original-input.txt'), 'utf8'), input);
    assert.equal(fs.readFileSync(path.join(tempRoot, 'trailer-input.txt'), 'utf8'), input);

    const repeated = installWorkplanTrailerPrePushHook(hookPath);
    assert.equal(repeated.status, 'already_installed');
    const removed = uninstallWorkplanTrailerPrePushHook(hookPath);
    assert.equal(removed.status, 'uninstalled');
    assert.equal(removed.restored, true);
    assert.equal(fs.readFileSync(hookPath, 'utf8'), original);
    assert.equal(fs.statSync(hookPath).mode & 0o777, 0o755);
    assert.equal(fs.existsSync(path.join(hookDir, WORKPLAN_TRAILER_HOOK_SIDECAR)), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('a preserved hook that rejects the push short-circuits before this one runs', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workplan-trailer-chain-'));
  try {
    assert.equal(spawnSync('git', ['init', '--quiet', tempRoot], { encoding: 'utf8' }).status, 0);
    const hookPath = path.join(tempRoot, '.git', 'hooks', 'pre-push');
    fs.writeFileSync(hookPath, '#!/bin/sh\nexit 7\n', { mode: 0o755 });
    installWorkplanTrailerPrePushHook(hookPath);

    fs.mkdirSync(path.join(tempRoot, 'scripts'));
    fs.writeFileSync(
      path.join(tempRoot, 'scripts', 'workplan-trailer-hook.js'),
      "import fs from 'node:fs';\nfs.writeFileSync('ran.txt', 'yes');\n",
    );
    const executed = spawnSync(hookPath, ['origin', 'example.invalid'], { cwd: tempRoot, input: '', encoding: 'utf8' });
    assert.equal(executed.status, 7);
    assert.equal(fs.existsSync(path.join(tempRoot, 'ran.txt')), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('uninstall refuses to strand the wrapper when another hook has wrapped it', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workplan-trailer-nested-'));
  try {
    assert.equal(spawnSync('git', ['init', '--quiet', tempRoot], { encoding: 'utf8' }).status, 0);
    const hookDir = path.join(tempRoot, '.git', 'hooks');
    const hookPath = path.join(hookDir, 'pre-push');
    installWorkplanTrailerPrePushHook(hookPath);
    // Stand in for another installer following the same preserve-and-wrap pattern.
    fs.renameSync(hookPath, path.join(hookDir, 'pre-push.machinespirits-before-something-else'));
    fs.writeFileSync(hookPath, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    assert.throws(() => uninstallWorkplanTrailerPrePushHook(hookPath), /another pre-push hook wraps this one/u);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('uninstall reports not_installed when an unrelated hook is present', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workplan-trailer-foreign-'));
  try {
    assert.equal(spawnSync('git', ['init', '--quiet', tempRoot], { encoding: 'utf8' }).status, 0);
    const hookPath = path.join(tempRoot, '.git', 'hooks', 'pre-push');
    fs.writeFileSync(hookPath, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    assert.equal(uninstallWorkplanTrailerPrePushHook(hookPath).status, 'not_installed');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('a push that touches no protected ref runs no check at all', () => {
  const executed = runHook('refs/heads/topic aaaa1111 refs/heads/topic bbbb2222\n');
  assert.equal(executed.status, 0, executed.stderr);
  assert.doesNotMatch(executed.stderr, /workplan-commit-link/u);
  assert.match(executed.stderr, /not a protected ref/u);
});

test('an empty range onto main runs the real checker and passes', () => {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  const executed = runHook(`refs/heads/main ${head} refs/heads/main ${head}\n`);
  assert.equal(executed.status, 0, executed.stderr);
  assert.match(executed.stdout, /workplan-commit-link: 0 commit\(s\)/u);
});

test('a failing check reports without blocking, and blocks once enforcement is flipped', () => {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  // An unreachable previous tip makes the checker exit non-zero, which is the
  // same signal an unlinked commit produces.
  const input = `refs/heads/main ${head} refs/heads/main ${'d'.repeat(40)}\n`;

  const reported = runHook(input);
  assert.equal(reported.status, 0, reported.stderr);
  assert.match(reported.stderr, /reporting only — the push continues/u);

  const blocked = runHook(input, { WORKPLAN_TRAILER_HOOK_ENFORCEMENT: 'blocking' });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /1 pushed range\(s\) contain unlinked commits/u);
});
