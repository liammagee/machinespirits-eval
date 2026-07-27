import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  classifyTutorPrBenchmarkAttribution,
  classifyTutorPrBenchmarkHookReport,
  collectTutorPrBenchmarkCoveredWorldFiles,
  collectTutorPrBenchmarkReachablePaths,
  describeTutorPrBenchmarkAttribution,
  installTutorPrBenchmarkPrePushHook,
  isCachedTutorPrBenchmarkPass,
  isTutorPrBenchmarkHookRelevantPath,
  isTutorPrBenchmarkWorldScopedPath,
  listCachedTutorPrBenchmarkHookReports,
  loadCachedTutorPrBenchmarkReport,
  parseTutorPrBenchmarkPrePushInput,
  resolveTutorPrBenchmarkReportRoot,
  selectNearestTutorPrBenchmarkBaseline,
  summarizeTutorPrBenchmarkWorldCoverage,
  TUTOR_PR_BENCHMARK_HOOK_MARKER,
  TUTOR_PR_BENCHMARK_HOOK_SIDECAR,
  uninstallTutorPrBenchmarkPrePushHook,
  validateTutorPrBenchmarkHookConfig,
} from '../services/tutorStubPrBenchmarkHook.js';
import {
  buildTutorPrBenchmarkPlan,
  loadTutorPrBenchmarkConfig,
  TUTOR_PR_BENCHMARK_REPORT_SCHEMA,
} from '../services/tutorStubPrBenchmark.js';
import { TUTOR_PR_BENCHMARK_REAUDIT_SCHEMA } from '../services/tutorStubPrBenchmarkComparison.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'tutor-pr-benchmark.yaml');

test('hook config selects the strong preset and scopes tutor-affecting paths', () => {
  const loaded = loadTutorPrBenchmarkConfig(CONFIG_PATH);
  const hook = validateTutorPrBenchmarkHookConfig(loaded.config);
  assert.equal(hook.preset, 'strong');
  assert.equal(hook.enforcement, 'report_only');
  assert.equal(hook.baseRef, 'origin/main');
  assert.equal(hook.reportScope, 'git_common');
  assert.equal(hook.reportRoot, 'machinespirits-reports/tutor-pr-benchmark');
  hook.reachablePaths = collectTutorPrBenchmarkReachablePaths({ root: ROOT, entryPaths: hook.importRoots });
  for (const relevantPath of [
    'services/tutorStubFirstDraftContract.js',
    'services/tutorStubConversationalCompletion.js',
    'services/tutorStubResponseComposition.js',
    'services/tutorStubTurnProgressionContract.js',
    'services/tutorStubGuardDisposition.js',
  ]) {
    assert.equal(isTutorPrBenchmarkHookRelevantPath(relevantPath, hook), true, relevantPath);
  }
  assert.equal(isTutorPrBenchmarkHookRelevantPath('services/tutorStubInterimPresentation.js', hook), false);
  assert.equal(isTutorPrBenchmarkHookRelevantPath('config/drama-derivation/world-001-nocturne.yaml', hook), true);
  assert.equal(isTutorPrBenchmarkHookRelevantPath('config/tutor-pr-benchmark-rubric.yaml', hook), true);
  assert.equal(isTutorPrBenchmarkHookRelevantPath('services/tutorPrBenchmarkRubric.js', hook), true);
  assert.equal(isTutorPrBenchmarkHookRelevantPath('docs/tutor-pr-benchmark.md', hook), false);
  assert.equal(isTutorPrBenchmarkHookRelevantPath('workplan/items/example.md', hook), false);
});

test('the configured preset replays exactly one authored world, so only that world file is measurable', () => {
  const loaded = loadTutorPrBenchmarkConfig(CONFIG_PATH);
  const hook = validateTutorPrBenchmarkHookConfig(loaded.config);
  const plan = buildTutorPrBenchmarkPlan({ config: loaded.config, root: ROOT, preset: hook.preset });
  const worldIds = new Set(plan.jobs.map((job) => job.benchmarkCase.worldId));
  const covered = collectTutorPrBenchmarkCoveredWorldFiles({ root: ROOT, worldIds });
  const authored = fs
    .readdirSync(path.join(ROOT, 'config', 'drama-derivation'))
    .filter((name) => /^world-.*\.yaml$/u.test(name));
  assert.equal(covered.size, worldIds.size);
  assert.ok(authored.length > covered.size, 'the repository authors more worlds than the preset replays');
  hook.reachablePaths = collectTutorPrBenchmarkReachablePaths({ root: ROOT, entryPaths: hook.importRoots });
  hook.coveredWorldIds = worldIds;
  hook.coveredWorldFiles = covered;
  for (const worldPath of covered) assert.equal(isTutorPrBenchmarkHookRelevantPath(worldPath, hook), true, worldPath);
  const unmeasurable = authored
    .map((name) => `config/drama-derivation/${name}`)
    .filter((worldPath) => !covered.has(worldPath));
  for (const worldPath of unmeasurable) {
    assert.equal(isTutorPrBenchmarkHookRelevantPath(worldPath, hook), false, worldPath);
  }
  assert.equal(isTutorPrBenchmarkHookRelevantPath('config/drama-derivation/derivation-policy.yaml', hook), true);
  assert.deepEqual(
    summarizeTutorPrBenchmarkWorldCoverage({ paths: [...covered, ...unmeasurable], hookConfig: hook })
      .uncoveredWorldPaths,
    [...unmeasurable].sort(),
  );
});

test('world coverage keys on the authored id and keeps unparseable worlds inside the gate', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-pr-worlds-'));
  try {
    const worldDir = path.join(tempRoot, 'config', 'drama-derivation');
    fs.mkdirSync(worldDir, { recursive: true });
    const source = path.join(ROOT, 'config', 'drama-derivation');
    const authored = fs.readdirSync(source).filter((name) => /^world-.*\.yaml$/u.test(name));
    const replayed = authored.find((name) => name.includes('nocturne'));
    const other = authored.find((name) => name !== replayed);
    fs.copyFileSync(path.join(source, replayed), path.join(worldDir, 'world-renamed-under-a-new-name.yaml'));
    fs.copyFileSync(path.join(source, other), path.join(worldDir, other));
    fs.writeFileSync(path.join(worldDir, 'world-999-broken.yaml'), 'id: [unterminated\n');
    fs.writeFileSync(path.join(worldDir, 'derivation-policy.yaml'), 'unrelated: true\n');
    assert.deepEqual(
      [...collectTutorPrBenchmarkCoveredWorldFiles({ root: tempRoot, worldIds: ['world_001_nocturne'] })].sort(),
      ['config/drama-derivation/world-999-broken.yaml', 'config/drama-derivation/world-renamed-under-a-new-name.yaml'],
    );
    assert.throws(
      () => collectTutorPrBenchmarkCoveredWorldFiles({ root: tempRoot, worldIds: [] }),
      /at least one world id/u,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  assert.equal(isTutorPrBenchmarkWorldScopedPath('config/drama-derivation/world-001-nocturne.yaml'), true);
  assert.equal(isTutorPrBenchmarkWorldScopedPath('config/drama-derivation/derivation-policy.yaml'), false);
  assert.equal(isTutorPrBenchmarkWorldScopedPath('config/other/world-001-nocturne.yaml'), false);
});

test('Git-common report roots survive the lifecycle of any one linked worktree', () => {
  const root = path.join(path.sep, 'repo', 'linked-worktree');
  assert.equal(
    resolveTutorPrBenchmarkReportRoot({
      root,
      reportRoot: 'machinespirits-reports/tutor-pr-benchmark',
      reportScope: 'git_common',
      gitCommonDir: '/repo/main/.git',
    }),
    path.join(path.sep, 'repo', 'main', '.git', 'machinespirits-reports', 'tutor-pr-benchmark'),
  );
  assert.equal(
    resolveTutorPrBenchmarkReportRoot({
      root,
      reportRoot: '.tutor-stub-auto-eval/pr-benchmark',
      reportScope: 'worktree',
    }),
    path.join(root, '.tutor-stub-auto-eval', 'pr-benchmark'),
  );
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

test('baseline selection reads the cached hook reports and prefers the nearest ancestor', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-pr-hook-baseline-'));
  try {
    const write = (sha, report) => {
      fs.mkdirSync(path.join(tempRoot, sha), { recursive: true });
      fs.writeFileSync(path.join(tempRoot, sha, 'report.json'), JSON.stringify(report));
    };
    write('aaa', { schema: TUTOR_PR_BENCHMARK_REPORT_SCHEMA, status: 'fail', metadata: { gitSha: 'aaa' } });
    write('bbb', { schema: TUTOR_PR_BENCHMARK_REPORT_SCHEMA, status: 'pass', metadata: { gitSha: 'bbb' } });
    write('ccc', { schema: TUTOR_PR_BENCHMARK_REPORT_SCHEMA, status: 'blocked', metadata: { gitSha: 'ccc' } });
    write('ddd', { schema: TUTOR_PR_BENCHMARK_REPORT_SCHEMA, status: 'fail', metadata: { gitSha: 'mismatched' } });
    write('head', { schema: TUTOR_PR_BENCHMARK_REPORT_SCHEMA, status: 'fail', metadata: { gitSha: 'head' } });
    const candidates = listCachedTutorPrBenchmarkHookReports({ hookReportRoot: tempRoot, excludeSha: 'head' });
    assert.deepEqual(
      candidates.map((candidate) => `${candidate.sha}:${candidate.status}`),
      ['aaa:fail', 'bbb:pass'],
      'blocked verdicts and sha-mismatched reports carry no comparable candidates',
    );
    assert.equal(
      selectNearestTutorPrBenchmarkBaseline({
        candidates,
        distances: new Map([
          ['aaa', 9],
          ['bbb', 2],
        ]),
      }).sha,
      'bbb',
    );
    assert.equal(selectNearestTutorPrBenchmarkBaseline({ candidates, distances: new Map([['aaa', 9]]) }).sha, 'aaa');
    assert.equal(selectNearestTutorPrBenchmarkBaseline({ candidates, distances: new Map() }), null);
    assert.deepEqual(listCachedTutorPrBenchmarkHookReports({ hookReportRoot: path.join(tempRoot, 'absent') }), []);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('a zero-call re-audit separates a standing failure from one this change introduced', () => {
  const baseline = { sha: '77838c3f7a9e0000', status: 'fail', distance: 32 };
  const reaudit = (summary) => ({
    schema: TUTOR_PR_BENCHMARK_REAUDIT_SCHEMA,
    summary: { candidates: 6, improved: 0, regressed: 0, ...summary },
  });
  const outcome = (input) => classifyTutorPrBenchmarkAttribution(input).outcome;
  assert.equal(outcome({ baseline, reaudit: reaudit({}) }), 'standing');
  assert.equal(outcome({ baseline: { ...baseline, status: 'pass' }, reaudit: reaudit({}) }), 'new_since_baseline');
  assert.equal(outcome({ baseline, reaudit: reaudit({ regressed: 2 }) }), 'audit_regressed');
  assert.equal(outcome({ baseline, reaudit: reaudit({ improved: 3 }) }), 'audit_improved');
  assert.equal(outcome({ baseline, reaudit: reaudit({ improved: 3, regressed: 1 }) }), 'audit_regressed');
  assert.equal(outcome({ baseline, reaudit: { summary: {} } }), 'baseline_incomparable');
  assert.equal(
    outcome({ baseline, error: new Error('source report job x has no completed candidate') }),
    'baseline_incomparable',
  );
  assert.equal(outcome({ baseline: null }), 'no_baseline');

  const standing = classifyTutorPrBenchmarkAttribution({ baseline, reaudit: reaudit({}) });
  assert.equal(standing.baselineSha, baseline.sha);
  assert.match(describeTutorPrBenchmarkAttribution(standing), /STANDING — baseline 77838c3f7a9e/u);
  assert.match(describeTutorPrBenchmarkAttribution(standing), /zero model calls/u);
  assert.match(
    describeTutorPrBenchmarkAttribution(
      classifyTutorPrBenchmarkAttribution({ baseline, reaudit: reaudit({ regressed: 2 }) }),
    ),
    /^ATTRIBUTABLE —/u,
  );
  assert.match(
    describeTutorPrBenchmarkAttribution(classifyTutorPrBenchmarkAttribution({ baseline: null })),
    /^UNATTRIBUTED/u,
  );
  assert.match(
    describeTutorPrBenchmarkAttribution(
      classifyTutorPrBenchmarkAttribution({ baseline, error: new Error('plan drifted') }),
    ),
    /not comparable under the current plan \(plan drifted\)/u,
  );
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
