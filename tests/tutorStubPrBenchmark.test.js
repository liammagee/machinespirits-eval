import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  auditTutorPrBenchmarkCandidate,
  buildTutorPrBenchmarkPlan,
  loadTutorPrBenchmarkConfig,
  prepareTutorPrBenchmarkJob,
  publicTutorPrBenchmarkPlan,
  runTutorPrBenchmark,
} from '../services/tutorStubPrBenchmark.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'tutor-pr-benchmark.yaml');

function plan(preset = 'strong', overrides = {}) {
  const loaded = loadTutorPrBenchmarkConfig(CONFIG_PATH);
  return buildTutorPrBenchmarkPlan({
    config: loaded.config,
    root: ROOT,
    preset,
    configSha256: crypto.createHash('sha256').update(loaded.source).digest('hex'),
    ...overrides,
  });
}

function passingAudit() {
  return {
    ok: true,
    safetyFailure: false,
    failureClusters: [],
    hardFailureClusters: [],
    audits: { actorialRealizationAudit: { ok: true, active: true, issues: [] } },
  };
}

test('strong and smoke plans pin the dual-CLI medium-effort call budgets', () => {
  const strong = publicTutorPrBenchmarkPlan(plan('strong'));
  assert.equal(strong.status, 'ready');
  assert.equal(strong.plannedCalls, 6);
  assert.equal(strong.maxCalls, 6);
  assert.deepEqual(
    strong.models.map((model) => model.provider),
    ['codex', 'claude-code'],
  );
  assert.ok(strong.models.every((model) => model.effort === 'medium'));
  assert.deepEqual(
    strong.models.map((model) => model.model),
    ['gpt-5.6-terra', 'claude-sonnet-5'],
  );
  assert.deepEqual(
    strong.cases.map((benchmarkCase) => benchmarkCase.id),
    ['nocturne_counterpressure_write', 'nocturne_period_source', 'nocturne_boundary_handoff'],
  );
  assert.ok(strong.cases.every((benchmarkCase) => /^[a-f0-9]{64}$/u.test(benchmarkCase.fixtureSha256)));
  assert.equal(strong.rubric.version, '1.0');
  assert.equal(strong.rubric.status, 'calibration');
  assert.match(strong.rubric.sha256, /^[a-f0-9]{64}$/u);

  const smoke = publicTutorPrBenchmarkPlan(plan('smoke'));
  assert.equal(smoke.plannedCalls, 2);
  assert.deepEqual(
    smoke.cases.map((benchmarkCase) => benchmarkCase.id),
    ['nocturne_period_source'],
  );
});

test('performance-tactic advisory remains measured without overriding the canonical delivery decision', async () => {
  const benchmarkPlan = plan('smoke');
  const report = await runTutorPrBenchmark({
    plan: benchmarkPlan,
    root: ROOT,
    generateCandidate: async ({ job }) => ({
      text: `candidate ${job.modelId}`,
      provider: job.model.provider,
      model: job.model.model,
    }),
    auditCandidate: () => ({
      ...passingAudit(),
      audits: {
        actorialRealizationAudit: {
          ok: false,
          active: true,
          issues: [{ type: 'missing_selected_performance_tactic' }],
        },
      },
    }),
  });
  assert.equal(report.status, 'pass');
  assert.ok(report.jobs.every((job) => job.gate.actorialRealization));
  assert.equal(report.plan.gate.require_actorial_realization, false);
  assert.equal(report.plan.rubric.version, '1.0');
});

test('preparing a job refreshes only the current contract and preserves the public prefix', () => {
  const benchmarkPlan = plan('smoke');
  const job = benchmarkPlan.jobs[0];
  const before = structuredClone(job.benchmarkCase.bundle);
  const prepared = prepareTutorPrBenchmarkJob(job, { root: ROOT });
  assert.deepEqual(prepared.bundle.priorTurns, before.priorTurns);
  assert.deepEqual(prepared.bundle.priorTutorTexts, before.priorTutorTexts);
  assert.equal(prepared.bundle.learnerText, before.learnerText);
  assert.equal(prepared.latest.role, 'user');
  assert.match(prepared.latest.content, /\[Tutor-only host plan\]/u);
});

test('the strong benchmark keeps its three accepted reference answers responsive under the refreshed contract', () => {
  const benchmarkPlan = plan('strong');
  const referenceJobs = benchmarkPlan.jobs.filter((job) => job.modelId === 'codex_medium');
  assert.equal(referenceJobs.length, 3);

  for (const job of referenceJobs) {
    const prepared = prepareTutorPrBenchmarkJob(job, { root: ROOT });
    const referenceText = job.benchmarkCase.bundle.recorded?.originalCandidate?.candidate?.text;
    assert.ok(referenceText, `${job.caseId} has no accepted reference candidate`);
    const audit = auditTutorPrBenchmarkCandidate({ prepared, text: referenceText });
    const progressionIssues = audit.audits.liveTurnProgressionAudit.issues.map((issue) => issue.type);
    assert.equal(
      progressionIssues.includes('learner_uptake_not_realized'),
      false,
      `${job.caseId}: ${JSON.stringify(progressionIssues)}`,
    );
    assert.equal(
      progressionIssues.includes('handoff_loses_turn_focus'),
      false,
      `${job.caseId}: ${JSON.stringify(progressionIssues)}`,
    );
    assert.equal(audit.safetyFailure, false, job.caseId);
  }
});

test('runner terminates pass and fail without retrying or continuing a dialogue', async () => {
  const benchmarkPlan = plan('smoke');
  let calls = 0;
  const report = await runTutorPrBenchmark({
    plan: benchmarkPlan,
    root: ROOT,
    generateCandidate: async ({ job }) => {
      calls += 1;
      return { text: `candidate ${job.modelId}`, provider: job.model.provider, model: job.model.model, latencyMs: 4 };
    },
    auditCandidate: ({ job }) =>
      job.modelId === 'codex_medium'
        ? passingAudit()
        : {
            ...passingAudit(),
            ok: false,
            failureClusters: ['responseCompositionAudit:missing_handoff'],
          },
  });
  assert.equal(calls, 2);
  assert.equal(report.status, 'fail');
  assert.deepEqual(report.summary, { pass: 1, fail: 1, blocked: 0, total: 2, completed: 2 });
  assert.ok(report.jobs.every((job) => job.called));
  assert.equal(report.plan.invariants.continue_dialogue, false);
  assert.equal(report.plan.invariants.run_repair, false);
});

test('one infrastructure error blocks that model once while the other model still runs', async () => {
  const benchmarkPlan = plan('strong');
  const calls = { codex_medium: 0, claude_medium: 0 };
  const report = await runTutorPrBenchmark({
    plan: benchmarkPlan,
    root: ROOT,
    generateCandidate: async ({ job }) => {
      calls[job.modelId] += 1;
      if (job.modelId === 'codex_medium') {
        const error = new Error('codex CLI is not authenticated');
        error.code = 'CLI_AUTH';
        throw error;
      }
      return { text: 'candidate', provider: job.model.provider, model: job.model.model };
    },
    auditCandidate: passingAudit,
  });
  assert.equal(report.status, 'blocked');
  assert.deepEqual(calls, { codex_medium: 1, claude_medium: 3 });
  assert.equal(report.summary.blocked, 3);
  assert.equal(report.summary.pass, 3);
  assert.equal(report.jobs.filter((job) => job.modelId === 'codex_medium' && job.called).length, 1);
});

test('plan exhausts its budget before making a model call', async () => {
  const benchmarkPlan = plan('strong', { maxCalls: 5 });
  let calls = 0;
  const report = await runTutorPrBenchmark({
    plan: benchmarkPlan,
    root: ROOT,
    generateCandidate: async () => {
      calls += 1;
      return { text: 'should not run' };
    },
  });
  assert.equal(report.status, 'budget_exhausted');
  assert.equal(calls, 0);
  assert.equal(report.plan.plannedCalls, 6);
});

test('CLI print-plan is hermetic and emits the strong plan without model calls', () => {
  const result = spawnSync(process.execPath, ['scripts/run-tutor-pr-benchmark.js', '--print-plan', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const printed = JSON.parse(result.stdout);
  assert.equal(printed.status, 'ready');
  assert.equal(printed.plannedCalls, 6);
  assert.equal(printed.jobs.length, 6);
});
