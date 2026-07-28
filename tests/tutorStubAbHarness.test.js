import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubAbPlan,
  loadTutorStubAbConfig,
  prepareTutorStubAbJob,
  publicTutorStubAbPlan,
  renderTutorStubAbMarkdown,
  runTutorStubAb,
  summarizeTutorStubAb,
} from '../services/tutorStubAbHarness.js';
import {
  parseTutorStubAdvisoryBlocks,
  projectTutorStubAbRequest,
  resolveTutorStubAbArm,
  resolveTutorStubAbGuardSet,
  TUTOR_STUB_AB_FEATURES,
  TUTOR_STUB_AB_FEATURE_IDS,
} from '../services/tutorStubAbArms.js';
import { renderTutorStubAbTranscriptHtml } from '../services/tutorStubAbTranscriptHtml.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'tutor-stub-ab.yaml');

function plan(preset = 'smoke', overrides = {}) {
  const loaded = loadTutorStubAbConfig(CONFIG_PATH);
  return buildTutorStubAbPlan({
    config: loaded.config,
    root: ROOT,
    preset,
    configSha256: loaded.configSha256,
    ...overrides,
  });
}

function passingAudit() {
  return { ok: true, safetyFailure: false, failureClusters: [], hardFailureClusters: [] };
}

test('every advisory block header maps to exactly one feature', () => {
  const seen = new Map();
  for (const feature of TUTOR_STUB_AB_FEATURES) {
    assert.ok(feature.blocks.length >= 1, `${feature.id} declares no block header`);
    for (const block of feature.blocks) {
      assert.equal(seen.get(block), undefined, `block "${block}" is claimed by two features`);
      seen.set(block, feature.id);
    }
  }
  // The contract slot is rendered under either header; splitting them would let
  // an arm claim it dropped the contract while the contract was still present.
  const contract = TUTOR_STUB_AB_FEATURES.find((feature) => feature.id === 'first_draft_contract');
  assert.deepEqual([...contract.blocks], ['Tutor-only host plan', 'Tutor-only first-draft performance contract']);
});

test('advisory block parsing fails closed on an unregistered header', () => {
  const parsed = parseTutorStubAdvisoryBlocks(
    '[Tutor-only secret channel]\nprivate\n[End Tutor-only secret channel]\n\nLearner says:\nhello',
  );
  assert.deepEqual(parsed.unknownBlocks, ['Tutor-only secret channel']);
  assert.equal(parsed.blocks[0].featureId, null);

  assert.throws(
    () => parseTutorStubAdvisoryBlocks('[Tutor-only host plan]\nbody\n[End Tutor context continuity]'),
    /closed by/u,
  );
});

test('smoke and ablation presets pin finite call budgets over the same frozen scenario', () => {
  const smoke = publicTutorStubAbPlan(plan('smoke'));
  assert.equal(smoke.status, 'ready');
  assert.equal(smoke.plannedCalls, 6);
  assert.deepEqual(
    smoke.arms.map((arm) => arm.id),
    ['baseline', 'instrumented'],
  );
  assert.deepEqual(smoke.arms.find((arm) => arm.baseline).features, [], 'baseline must carry zero instrumentation');
  assert.deepEqual(smoke.arms.find((arm) => !arm.baseline).features, [...TUTOR_STUB_AB_FEATURE_IDS]);
  assert.equal(smoke.rubric.audit, 'tutor_stub_frozen_candidate');
  assert.equal(smoke.rubric.pin_guards_to_reference, true);
  assert.ok(Object.values(smoke.invariants).every((value) => value === false));

  const ablation = publicTutorStubAbPlan(plan('ablation'));
  assert.equal(ablation.plannedCalls, 12);
  assert.deepEqual(
    ablation.arms.map((arm) => arm.id),
    ['baseline', 'no_dag', 'no_scaffold', 'instrumented'],
  );
  assert.ok(!ablation.arms.find((arm) => arm.id === 'no_dag').features.includes('learner_dag'));
  assert.ok(!ablation.arms.find((arm) => arm.id === 'no_scaffold').features.includes('human_scaffold'));
});

test('a feature override that collapses two arms into one is rejected', () => {
  assert.throws(
    () => plan('ablation', { featureOverride: 'all', dropOverride: ['learner_dag'] }),
    /duplicate feature sets/u,
  );
  // The baseline is exempt from the override, so a two-arm preset still resolves.
  const overridden = publicTutorStubAbPlan(plan('smoke', { featureOverride: ['evidence_window'] }));
  assert.deepEqual(overridden.arms.find((arm) => arm.baseline).features, []);
  assert.deepEqual(overridden.arms.find((arm) => !arm.baseline).features, ['evidence_window']);
});

test('selected arms must include the baseline', () => {
  assert.throws(() => plan('smoke', { arms: ['instrumented'] }), /must include the baseline/u);
});

test('preparing a job refreshes the contract without moving the frozen public prefix', () => {
  const abPlan = plan('smoke');
  const job = abPlan.jobs.find((entry) => entry.armId === 'instrumented');
  const before = structuredClone(job.bundle);
  const prepared = prepareTutorStubAbJob(job, { root: ROOT });
  assert.deepEqual(prepared.bundle.priorTurns, before.priorTurns);
  assert.equal(prepared.bundle.learnerText, before.learnerText);
  assert.equal(prepared.latest.role, 'user');
  assert.match(prepared.latest.content, /\[Tutor-only host plan\]/u);
});

test('arms differ only in advisory blocks; system prompt, prefix, and learner text are invariant', () => {
  const abPlan = plan('smoke');
  const caseId = abPlan.jobs[0].caseId;
  const forArm = (armId) => {
    const job = abPlan.jobs.find((entry) => entry.armId === armId && entry.caseId === caseId);
    return prepareTutorStubAbJob(job, { root: ROOT });
  };
  const bare = forArm('baseline');
  const full = forArm('instrumented');

  assert.equal(bare.projection.systemPrompt, full.projection.systemPrompt);
  assert.deepEqual(bare.history, full.history);
  assert.deepEqual(bare.projection.retainedFeatures, []);
  assert.ok(full.projection.retainedFeatures.length >= 4);
  assert.deepEqual(bare.projection.strippedFeatures, full.projection.presentFeatures);

  // Stripping every block must leave exactly the learner's utterance.
  assert.equal(bare.latest.content, String(bare.bundle.learnerText).trim());
  assert.equal(bare.projection.advisoryChars, 0);
  assert.ok(full.projection.advisoryChars > 1000);
  assert.ok(full.projection.requestChars > bare.projection.requestChars);
});

test('dropping one feature removes only that block from the request', () => {
  const abPlan = plan('ablation');
  const caseId = abPlan.jobs[0].caseId;
  const contentFor = (armId) => {
    const job = abPlan.jobs.find((entry) => entry.armId === armId && entry.caseId === caseId);
    return prepareTutorStubAbJob(job, { root: ROOT });
  };
  const full = contentFor('instrumented');
  const noDag = contentFor('no_dag');
  // Asserted rather than skipped: a fixture that stopped carrying the block
  // would otherwise make this test pass vacuously.
  assert.deepEqual(full.projection.presentFeatures, [...TUTOR_STUB_AB_FEATURE_IDS]);

  assert.ok(full.latest.content.includes('[Tutor-only redacted learner-DAG model]'));
  assert.ok(!noDag.latest.content.includes('[Tutor-only redacted learner-DAG model]'));
  assert.deepEqual(noDag.projection.strippedFeatures, ['learner_dag']);
  assert.ok(noDag.projection.requestChars < full.projection.requestChars);
});

test('pinning the guard set to the reference bundle is an identity on the recorded guards', () => {
  const abPlan = plan('strong');
  for (const job of abPlan.jobs) {
    const prepared = prepareTutorStubAbJob(job, { root: ROOT });
    const pinned = resolveTutorStubAbGuardSet(prepared.bundle.guards);
    for (const [key, value] of Object.entries(pinned)) {
      if (key === 'enabled') continue;
      assert.equal(value, prepared.bundle.guards?.[key] === true, `guard ${key} drifted on ${job.id}`);
    }
  }
});

test('resolving an arm honours all/none/explicit selections and derives the learner framing', () => {
  assert.deepEqual(resolveTutorStubAbArm('a', { features: 'none' }).features, []);
  assert.equal(resolveTutorStubAbArm('a', { features: 'none' }).learnerFraming, false);
  assert.deepEqual(resolveTutorStubAbArm('b', { features: 'all' }).features, [...TUTOR_STUB_AB_FEATURE_IDS]);
  assert.equal(resolveTutorStubAbArm('b', { features: 'all' }).learnerFraming, true);
  const dropped = resolveTutorStubAbArm('c', { features: 'all', drop: ['learner_dag'] });
  assert.ok(!dropped.features.includes('learner_dag'));
  assert.ok(dropped.omitted.includes('learner_dag'));
  assert.throws(() => resolveTutorStubAbArm('d', { features: ['no_such_feature'] }), /unknown tutor A\/B feature/u);
});

test('projection refuses a request whose blocks are not all registered', () => {
  const bundle = {
    learnerText: 'hello',
    request: {
      systemPrompt: 'sys',
      messages: [
        { role: 'user', content: '[Tutor-only mystery]\nx\n[End Tutor-only mystery]\n\nLearner says:\nhello' },
      ],
    },
  };
  assert.throws(
    () => projectTutorStubAbRequest({ bundle, arm: resolveTutorStubAbArm('a', { features: 'all' }) }),
    /unregistered advisory blocks/u,
  );
});

test('runner reports cluster totals and per-cluster deltas against the baseline', async () => {
  const abPlan = plan('smoke');
  const report = await runTutorStubAb({
    plan: abPlan,
    root: ROOT,
    generateCandidate: async ({ job }) => ({ text: `candidate ${job.armId}`, provider: 'test', model: 'test' }),
    auditCandidate: ({ job }) =>
      job.armId === 'baseline'
        ? {
            ok: false,
            safetyFailure: false,
            failureClusters: ['leakAudit:committed_leak', 'dramaticReleaseAudit:opaque_clue_release'],
            hardFailureClusters: ['leakAudit:committed_leak'],
          }
        : passingAudit(),
  });
  assert.equal(report.status, 'complete');
  const baseline = report.summary.arms.find((arm) => arm.baseline);
  const instrumented = report.summary.arms.find((arm) => !arm.baseline);
  assert.equal(baseline.totalClusters, 6);
  assert.equal(baseline.totalHardClusters, 3);
  assert.equal(baseline.meanClusters, 2);
  assert.equal(baseline.clusterDeltaTotal, 0);
  assert.equal(instrumented.totalClusters, 0);
  assert.equal(instrumented.clusterDeltaTotal, -6);
  assert.equal(instrumented.hardClusterDeltaTotal, -3);
  assert.equal(instrumented.passRate, 1);
  assert.equal(instrumented.flipsVsBaseline.length, 3);
  assert.ok(instrumented.flipsVsBaseline.every((flip) => flip.from === 'fail' && flip.to === 'pass'));

  const markdown = renderTutorStubAbMarkdown(report);
  assert.match(markdown, /Broken rules \(hard\)/u);
  assert.match(markdown, /-6 \(-3\)/u);

  const html = renderTutorStubAbTranscriptHtml(report);
  assert.match(html, /Δ vs baseline/u);
  assert.match(html, /counterfactual/u);
});

test('one infrastructure error blocks that model for the rest of the run', async () => {
  const abPlan = plan('smoke');
  let calls = 0;
  const report = await runTutorStubAb({
    plan: abPlan,
    root: ROOT,
    generateCandidate: async () => {
      calls += 1;
      const error = new Error('codex CLI is not authenticated');
      error.code = 'CLI_AUTH';
      throw error;
    },
    auditCandidate: passingAudit,
  });
  assert.equal(calls, 1);
  assert.equal(report.status, 'blocked');
  assert.equal(report.summary.blocked, abPlan.plannedCalls);
  assert.equal(report.summary.completed, 0);
});

test('a plan over budget makes no model calls', async () => {
  const abPlan = plan('smoke', { maxCalls: 5 });
  let calls = 0;
  const report = await runTutorStubAb({
    plan: abPlan,
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

test('summary tolerates an empty result set', () => {
  const abPlan = plan('smoke');
  const summary = summarizeTutorStubAb({ plan: abPlan, results: [] });
  assert.equal(summary.completed, 0);
  assert.ok(summary.arms.every((arm) => arm.passRate === null && arm.totalClusters === 0));
});

test('CLI print-plan is hermetic and makes no model calls', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/run-tutor-stub-ab.js', '--preset', 'smoke', '--print-plan', '--json'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  const printed = JSON.parse(result.stdout);
  assert.equal(printed.status, 'ready');
  assert.equal(printed.plannedCalls, 6);
  assert.equal(printed.jobs.length, 6);
  assert.equal(printed.baselineArmId, 'baseline');
});

test('CLI lists the instrumentation feature registry', () => {
  const result = spawnSync(process.execPath, ['scripts/run-tutor-stub-ab.js', '--list-features'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  for (const id of TUTOR_STUB_AB_FEATURE_IDS) assert.match(result.stdout, new RegExp(id, 'u'));
});
