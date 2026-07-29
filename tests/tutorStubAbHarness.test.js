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
  TUTOR_STUB_AB_DUE_LINE_INTRO,
  TUTOR_STUB_AB_FEATURES,
  TUTOR_STUB_AB_FEATURE_IDS,
  TUTOR_STUB_AB_GENERIC_PLAN,
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

test('the length control is the bare request plus one sentence and no advisory content', () => {
  const abPlan = plan('length_control', { scenarios: ['tallow_short'] });
  const caseId = abPlan.jobs[0].caseId;
  const forArm = (armId) =>
    prepareTutorStubAbJob(
      abPlan.jobs.find((entry) => entry.armId === armId && entry.caseId === caseId),
      { root: ROOT },
    );
  const bare = forArm('baseline');
  const matched = forArm('length_matched');

  // Same system prompt, same public prefix, no blocks: the only thing the
  // control adds over the bare tutor is a character count.
  assert.equal(matched.projection.systemPrompt, bare.projection.systemPrompt);
  assert.deepEqual(matched.history, bare.history);
  assert.deepEqual(matched.projection.retainedFeatures, []);
  assert.equal(matched.projection.advisoryChars, 0);
  assert.equal(matched.latest.content, `Write a reply of about 450 characters.\n\n${bare.latest.content}`);
  assert.equal(matched.projection.lengthTargetChars, 450);
  assert.equal(bare.projection.lengthTargetChars, null);
  assert.equal(bare.projection.lengthDirectiveChars, 0);

  // Unbracketed on purpose: a `[header]` note would be indistinguishable from
  // instrumentation to the parser, which fails closed on unregistered headers.
  assert.equal(parseTutorStubAdvisoryBlocks(matched.latest.content).blocks.length, 0);
});

test('a length target is rejected on the baseline and separates otherwise identical arms', () => {
  assert.throws(
    () => resolveTutorStubAbArm('bare', { baseline: true, features: 'none', length_target_chars: 450 }),
    /must not carry a length target/u,
  );
  assert.throws(
    () => resolveTutorStubAbArm('bad', { features: 'none', length_target_chars: 0 }),
    /must be a positive integer/u,
  );
  // Stripping the features off both non-baseline arms would collapse them into
  // one lane on features alone; the length target is what keeps them distinct.
  const collapsed = plan('length_control', { scenarios: ['tallow_short'], featureOverride: 'none' });
  const targets = collapsed.arms.filter((arm) => !arm.baseline).map((arm) => arm.lengthTargetChars);
  assert.deepEqual(targets, [450, null]);
});

test('the plan control carries a fixed plan and none of the turn’s own content', () => {
  const abPlan = plan('plan_control', { scenarios: ['nocturne_full'] });
  const forJob = (job) => prepareTutorStubAbJob(job, { root: ROOT });
  const jobs = abPlan.jobs.filter((entry) => entry.armId === 'generic_plan_only');
  const first = forJob(jobs[0]);
  const bare = forJob(abPlan.jobs.find((entry) => entry.armId === 'baseline' && entry.caseId === jobs[0].caseId));

  assert.equal(first.projection.systemPrompt, bare.projection.systemPrompt);
  assert.deepEqual(first.history, bare.history);
  assert.deepEqual(first.projection.retainedFeatures, []);
  assert.equal(first.projection.advisoryChars, 0);
  assert.equal(first.projection.genericPlan, true);
  assert.equal(bare.projection.genericPlan, false);
  assert.equal(first.latest.content, `${TUTOR_STUB_AB_GENERIC_PLAN}\n\n${bare.latest.content}`);

  // Unbracketed for the same reason as the length note: the parser fails closed
  // on a header it does not know, so a bracketed control would read as
  // instrumentation to anything re-reading the projected request.
  assert.equal(parseTutorStubAdvisoryBlocks(first.latest.content).blocks.length, 0);

  // The point of the control is that it cannot say anything about the turn it
  // is attached to. Identical text on every turn is what makes that true.
  const planTexts = new Set(jobs.map((job) => forJob(job).latest.content.slice(0, TUTOR_STUB_AB_GENERIC_PLAN.length)));
  assert.equal(planTexts.size, 1);
  assert.ok(jobs.length > 1);

  // And it must not smuggle the contract's own vocabulary back in.
  for (const word of ['UPTAKE', 'PART —', 'SOURCE', 'TACTIC', 'HANDOFF', 'RECORD', 'public exhibit']) {
    assert.ok(!TUTOR_STUB_AB_GENERIC_PLAN.includes(word), word);
  }
});

test('the generic plan is rejected on the baseline and beside the real contract', () => {
  assert.throws(
    () => resolveTutorStubAbArm('bare', { baseline: true, features: 'none', generic_plan: true }),
    /must not carry a generic plan/u,
  );
  assert.throws(
    () => resolveTutorStubAbArm('both', { features: ['first_draft_contract'], generic_plan: true }),
    /cannot carry the generic plan and the first-draft contract together/u,
  );
  // Two plans naming different slots for the same paragraph is not a control.
  assert.equal(resolveTutorStubAbArm('ok', { features: 'all', drop: ['first_draft_contract'] }).genericPlan, false);
});

test('the due line carries the released finding on a due turn and nothing on a quiet one', () => {
  const abPlan = plan('due_line_control', { scenarios: ['nocturne_full'] });
  const forJob = (job) => prepareTutorStubAbJob(job, { root: ROOT });
  const byTurn = (armId, turn) =>
    forJob(abPlan.jobs.find((entry) => entry.armId === armId && entry.turn === turn));

  // Turn 2 releases a finding in the recorded world; turn 3 releases nothing.
  const due = byTurn('due_line_only', 2);
  const bareDue = byTurn('baseline', 2);
  assert.equal(due.projection.systemPrompt, bareDue.projection.systemPrompt);
  assert.deepEqual(due.history, bareDue.history);
  assert.deepEqual(due.projection.retainedFeatures, []);
  assert.equal(due.projection.advisoryChars, 0);
  assert.equal(due.projection.dueLine, true);
  assert.equal(due.projection.dueLineChars > 0, true);
  assert.ok(due.latest.content.startsWith(TUTOR_STUB_AB_DUE_LINE_INTRO));
  assert.ok(due.latest.content.endsWith(`\n\n${bareDue.latest.content}`));
  const injected = due.latest.content.slice(0, -bareDue.latest.content.length);
  // The line is the fact, not a second contract: no advisory block, none of the
  // contract's slot vocabulary, and no release instruction.
  assert.equal(parseTutorStubAdvisoryBlocks(due.latest.content).blocks.length, 0);
  for (const word of ['UPTAKE', 'PART —', 'SOURCE', 'TACTIC', 'HANDOFF', 'RECORD', 'public exhibit', 'must']) {
    assert.ok(!injected.includes(word), word);
  }

  // A quiet turn adds nothing: byte-identical to the bare tutor's prompt.
  const quiet = byTurn('due_line_only', 3);
  const bareQuiet = byTurn('baseline', 3);
  assert.equal(quiet.projection.dueLine, false);
  assert.equal(quiet.projection.dueLineChars, 0);
  assert.equal(quiet.latest.content, bareQuiet.latest.content);
});

test('the due line is rejected on the baseline and beside the real contract', () => {
  assert.throws(
    () => resolveTutorStubAbArm('bare', { baseline: true, features: 'none', due_line: true }),
    /must not carry the due line/u,
  );
  assert.throws(
    () => resolveTutorStubAbArm('both', { features: ['first_draft_contract'], due_line: true }),
    /cannot carry the due line and the first-draft contract together/u,
  );
  assert.equal(resolveTutorStubAbArm('ok', { features: 'all', drop: ['first_draft_contract'] }).dueLine, false);
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
  assert.match(markdown, /Clusters \(hard\)/u);
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
