import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorPrBenchmarkPlan,
  loadTutorPrBenchmarkConfig,
  publicTutorPrBenchmarkPlan,
  runTutorPrBenchmark,
} from '../services/tutorStubPrBenchmark.js';
import {
  assertEquivalentTutorPrBenchmarkPlans,
  buildTutorPrBenchmarkBaseHeadPlan,
  reauditTutorPrBenchmarkReport,
  summarizeTutorPrBenchmarkBaseHead,
  TUTOR_PR_BENCHMARK_BASE_HEAD_SCHEMA,
  TUTOR_PR_BENCHMARK_REAUDIT_SCHEMA,
} from '../services/tutorStubPrBenchmarkComparison.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'tutor-pr-benchmark.yaml');

function plan() {
  const loaded = loadTutorPrBenchmarkConfig(CONFIG_PATH);
  return buildTutorPrBenchmarkPlan({
    config: loaded.config,
    root: ROOT,
    preset: 'smoke',
    configSha256: crypto.createHash('sha256').update(loaded.source).digest('hex'),
  });
}

function audit(ok, cluster = null, safetyFailure = false) {
  const clusters = cluster ? [cluster] : [];
  return {
    ok,
    safetyFailure,
    failureClusters: clusters,
    hardFailureClusters: clusters,
    audits: { actorialRealizationAudit: { ok: true, active: true, issues: [] } },
  };
}

test('same-response re-audit makes zero model calls and reports flips plus cluster deltas', async () => {
  const benchmarkPlan = plan();
  const sourceReport = await runTutorPrBenchmark({
    plan: benchmarkPlan,
    root: ROOT,
    generateCandidate: async ({ job }) => ({
      text: `saved candidate for ${job.id}`,
      provider: job.model.provider,
      model: job.model.model,
    }),
    auditCandidate: ({ job }) =>
      job.modelId === 'codex_medium' ? audit(false, 'progression:missing_uptake') : audit(true),
    metadata: { gitSha: 'source123' },
  });
  let currentAudits = 0;
  const report = await reauditTutorPrBenchmarkReport({
    sourceReport,
    plan: benchmarkPlan,
    root: ROOT,
    auditCandidate: ({ job }) => {
      currentAudits += 1;
      return job.modelId === 'codex_medium' ? audit(true) : audit(false, 'handoff:lost_focus');
    },
  });
  assert.equal(report.schema, TUTOR_PR_BENCHMARK_REAUDIT_SCHEMA);
  assert.equal(report.metadata.modelCalls, 0);
  assert.equal(currentAudits, 2);
  assert.equal(report.summary.improved, 1);
  assert.equal(report.summary.regressed, 1);
  assert.equal(report.status, 'fail');
  assert.deepEqual(report.hardFailureClusterDeltas, [
    { cluster: 'handoff:lost_focus', before: 0, after: 1, delta: 1 },
    { cluster: 'progression:missing_uptake', before: 1, after: 0, delta: -1 },
  ]);
  assert.ok(report.rows.every((row) => /^[a-f0-9]{64}$/u.test(row.candidateSha256)));
  await assert.rejects(
    () =>
      reauditTutorPrBenchmarkReport({
        sourceReport,
        plan: { ...benchmarkPlan, status: 'budget_exhausted' },
        root: ROOT,
      }),
    /requires a ready benchmark plan/u,
  );
});

test('base/head plan fails closed on non-equivalent inputs and alternates order within a finite budget', () => {
  const publicPlan = publicTutorPrBenchmarkPlan(plan());
  const equivalent = structuredClone(publicPlan);
  assert.match(assertEquivalentTutorPrBenchmarkPlans(publicPlan, equivalent).fingerprint, /^[a-f0-9]{64}$/u);
  equivalent.cases[0].fixtureSha256 = 'changed';
  assert.throws(
    () => assertEquivalentTutorPrBenchmarkPlans(publicPlan, equivalent),
    /comparison requires identical config, rubric, models, cases, and fixtures/u,
  );

  const comparison = buildTutorPrBenchmarkBaseHeadPlan({ benchmarkPlan: publicPlan, draws: 2 });
  assert.equal(comparison.status, 'ready');
  assert.equal(comparison.plannedCalls, 8);
  assert.deepEqual(
    comparison.pairs.map((pair) => pair.order),
    [
      ['base', 'head'],
      ['head', 'base'],
      ['head', 'base'],
      ['base', 'head'],
    ],
  );
  assert.equal(
    buildTutorPrBenchmarkBaseHeadPlan({ benchmarkPlan: publicPlan, draws: 2, maxCalls: 7 }).status,
    'budget_exhausted',
  );
});

test('base/head summary stays diagnostic while making safety and directional regressions terminal', () => {
  const benchmarkPlan = publicTutorPrBenchmarkPlan(plan());
  const comparisonPlan = buildTutorPrBenchmarkBaseHeadPlan({ benchmarkPlan, draws: 1 });
  const [first, second] = comparisonPlan.pairs;
  const report = summarizeTutorPrBenchmarkBaseHead({
    baseRef: 'main',
    headRef: 'HEAD',
    baseSha: 'base123',
    headSha: 'head123',
    benchmarkPlan,
    comparisonPlan,
    planFingerprint: 'fingerprint',
    pairs: [
      {
        ...first,
        base: { status: 'fail', called: true, audit: audit(false, 'old:failure') },
        head: { status: 'pass', called: true, audit: audit(true) },
      },
      {
        ...second,
        base: { status: 'pass', called: true, audit: audit(true) },
        head: { status: 'fail', called: true, audit: audit(false, 'new:safety', true) },
      },
    ],
    startedAt: '2026-07-26T00:00:00.000Z',
    completedAt: '2026-07-26T00:01:00.000Z',
  });
  assert.equal(report.schema, TUTOR_PR_BENCHMARK_BASE_HEAD_SCHEMA);
  assert.equal(report.status, 'fail');
  assert.equal(report.outcome, 'regressed');
  assert.equal(report.summary.headWins, 1);
  assert.equal(report.summary.baseWins, 1);
  assert.equal(report.summary.basePasses, 1);
  assert.equal(report.summary.headPasses, 1);
  assert.equal(report.summary.bothPass, 0);
  assert.equal(report.summary.bothFail, 0);
  assert.equal(report.summary.safetyIntroduced, 1);
  assert.equal(report.metadata.diagnosticOnly, true);
  assert.equal(report.metadata.unseededGeneration, true);
  assert.equal(report.summary.calls, 4);
});
