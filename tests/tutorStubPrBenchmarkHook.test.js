import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  classifyTutorPrBenchmarkHookReport,
  installTutorPrBenchmarkPrePushHook,
  isCachedTutorPrBenchmarkPass,
  isTutorPrBenchmarkHookRelevantPath,
  loadCachedTutorPrBenchmarkReport,
  parseTutorPrBenchmarkPrePushInput,
  TUTOR_PR_BENCHMARK_HOOK_MARKER,
  TUTOR_PR_BENCHMARK_HOOK_SIDECAR,
  uninstallTutorPrBenchmarkPrePushHook,
  validateTutorPrBenchmarkHookConfig,
} from '../services/tutorStubPrBenchmarkHook.js';
import { loadTutorPrBenchmarkConfig, TUTOR_PR_BENCHMARK_REPORT_SCHEMA } from '../services/tutorStubPrBenchmark.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'tutor-pr-benchmark.yaml');

test('hook config selects the strong preset and scopes tutor-affecting paths', () => {
  const loaded = loadTutorPrBenchmarkConfig(CONFIG_PATH);
  const hook = validateTutorPrBenchmarkHookConfig(loaded.config);
  assert.equal(hook.preset, 'strong');
  assert.equal(hook.enforcement, 'report_only');
  assert.equal(hook.baseRef, 'origin/main');
  assert.equal(hook.reportRoot, '.tutor-stub-auto-eval/pr-benchmark-hook');
  assert.equal(isTutorPrBenchmarkHookRelevantPath('services/tutorStubFirstDraftContract.js', hook), true);
  assert.equal(isTutorPrBenchmarkHookRelevantPath('config/drama-derivation/world-nocturne.yaml', hook), true);
  assert.equal(isTutorPrBenchmarkHookRelevantPath('docs/tutor-pr-benchmark.md', hook), false);
  assert.equal(isTutorPrBenchmarkHookRelevantPath('workplan/items/example.md', hook), false);
});

test('pre-push input parser retains branch creation, update, and deletion records', () => {
  const source = [
    'refs/heads/topic abc123 refs/heads/topic 000000',
    'refs/heads/main def456 refs/heads/main abc123',
    'delete 000000 refs/heads/old def456',
  ].join('\n');
  assert.deepEqual(parseTutorPrBenchmarkPrePushInput(source), [
    { localRef: 'refs/heads/topic', localOid: 'abc123', remoteRef: 'refs/heads/topic', remoteOid: '000000' },
    { localRef: 'refs/heads/main', localOid: 'def456', remoteRef: 'refs/heads/main', remoteOid: 'abc123' },
    { localRef: 'delete', localOid: '000000', remoteRef: 'refs/heads/old', remoteOid: 'def456' },
  ]);
  assert.throws(() => parseTutorPrBenchmarkPrePushInput('not enough fields'), /invalid pre-push update/u);
});

test('installer composes with an existing hook and replays pre-push stdin to both hooks', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-pr-hook-'));
  try {
    const initialized = spawnSync('git', ['init', '--quiet', tempRoot], { encoding: 'utf8' });
    assert.equal(initialized.status, 0, initialized.stderr);
    const hookDir = path.join(tempRoot, '.git', 'hooks');
    const hookPath = path.join(hookDir, 'pre-push');
    const original = '#!/bin/sh\ncat > original-input.txt\n';
    fs.writeFileSync(hookPath, original, { mode: 0o755 });
    const installed = installTutorPrBenchmarkPrePushHook(hookPath);
    assert.equal(installed.status, 'installed');
    assert.equal(installed.preserved, true);
    assert.match(fs.readFileSync(hookPath, 'utf8'), new RegExp(TUTOR_PR_BENCHMARK_HOOK_MARKER, 'u'));
    assert.equal(fs.readFileSync(path.join(hookDir, TUTOR_PR_BENCHMARK_HOOK_SIDECAR), 'utf8'), original);

    const scriptDir = path.join(tempRoot, 'scripts');
    fs.mkdirSync(scriptDir);
    fs.writeFileSync(
      path.join(scriptDir, 'tutor-pr-benchmark-hook.js'),
      "import fs from 'node:fs';\nfs.writeFileSync('benchmark-input.txt', fs.readFileSync(0, 'utf8'));\n",
    );
    const input = 'refs/heads/topic abc123 refs/heads/topic 000000\n';
    const executed = spawnSync(hookPath, ['origin', 'example.invalid'], { cwd: tempRoot, input, encoding: 'utf8' });
    assert.equal(executed.status, 0, executed.stderr);
    assert.equal(fs.readFileSync(path.join(tempRoot, 'original-input.txt'), 'utf8'), input);
    assert.equal(fs.readFileSync(path.join(tempRoot, 'benchmark-input.txt'), 'utf8'), input);

    const repeated = installTutorPrBenchmarkPrePushHook(hookPath);
    assert.equal(repeated.status, 'already_installed');
    const removed = uninstallTutorPrBenchmarkPrePushHook(hookPath);
    assert.equal(removed.status, 'uninstalled');
    assert.equal(removed.restored, true);
    assert.equal(fs.readFileSync(hookPath, 'utf8'), original);
    assert.equal(fs.statSync(hookPath).mode & 0o777, 0o755);
    assert.equal(fs.existsSync(path.join(hookDir, TUTOR_PR_BENCHMARK_HOOK_SIDECAR)), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('terminal reports cache by exact commit while only pass satisfies the pass predicate', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-pr-hook-cache-'));
  try {
    const reportPath = path.join(tempRoot, 'report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ schema: TUTOR_PR_BENCHMARK_REPORT_SCHEMA, status: 'pass', metadata: { gitSha: 'abc123' } }),
    );
    assert.equal(isCachedTutorPrBenchmarkPass(reportPath, 'abc123'), true);
    assert.equal(loadCachedTutorPrBenchmarkReport(reportPath, 'abc123').status, 'pass');
    assert.equal(isCachedTutorPrBenchmarkPass(reportPath, 'def456'), false);
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ schema: TUTOR_PR_BENCHMARK_REPORT_SCHEMA, status: 'fail', metadata: { gitSha: 'abc123' } }),
    );
    assert.equal(isCachedTutorPrBenchmarkPass(reportPath, 'abc123'), false);
    assert.equal(loadCachedTutorPrBenchmarkReport(reportPath, 'abc123').status, 'fail');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('report-only enforcement warns on quality failure but blocks incomplete verdicts', () => {
  assert.equal(classifyTutorPrBenchmarkHookReport({ status: 'pass' }, 'report_only'), 'allow');
  assert.equal(classifyTutorPrBenchmarkHookReport({ status: 'fail' }, 'report_only'), 'warn');
  assert.equal(classifyTutorPrBenchmarkHookReport({ status: 'fail' }, 'blocking'), 'block');
  assert.equal(classifyTutorPrBenchmarkHookReport({ status: 'blocked' }, 'report_only'), 'block');
  assert.equal(classifyTutorPrBenchmarkHookReport({ status: 'budget_exhausted' }, 'report_only'), 'block');
  assert.equal(classifyTutorPrBenchmarkHookReport(null, 'report_only'), 'block');
});

test('pre-push command skips cleanly when Git supplies no branch updates', () => {
  const result = spawnSync(process.execPath, ['scripts/tutor-pr-benchmark-hook.js', 'pre-push'], {
    cwd: ROOT,
    input: '',
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /skipped \(no benchmark-relevant pushed paths\)/u);
});

test('bypass is accepted only with an explicit reason', () => {
  const withoutReason = spawnSync(process.execPath, ['scripts/tutor-pr-benchmark-hook.js', 'pre-push'], {
    cwd: ROOT,
    input: '',
    encoding: 'utf8',
    env: { ...process.env, TUTOR_PR_BENCHMARK_HOOK_BYPASS: '1' },
  });
  assert.equal(withoutReason.status, 2);
  assert.match(withoutReason.stderr, /BYPASS_REASON is required/u);

  const withReason = spawnSync(process.execPath, ['scripts/tutor-pr-benchmark-hook.js', 'pre-push'], {
    cwd: ROOT,
    input: '',
    encoding: 'utf8',
    env: {
      ...process.env,
      TUTOR_PR_BENCHMARK_HOOK_BYPASS: '1',
      TUTOR_PR_BENCHMARK_HOOK_BYPASS_REASON: 'test-only push',
    },
  });
  assert.equal(withReason.status, 0, withReason.stderr);
  assert.match(withReason.stderr, /BYPASSED — test-only push/u);
});
