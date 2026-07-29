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
  TUTOR_STUB_AB_CHARACTER_SHIFT_PARTS,
  TUTOR_STUB_AB_DUE_LINE_INTRO,
  TUTOR_STUB_AB_FEATURES,
  TUTOR_STUB_AB_FEATURE_IDS,
  TUTOR_STUB_AB_GENERIC_PLAN,
} from '../services/tutorStubAbArms.js';
import {
  splitTutorStubAbClusters,
  tutorStubAbRuleKeying,
  tutorStubAbRuleKeyingReason,
} from '../services/tutorStubAbRuleKeying.js';
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
  const byTurn = (armId, turn) => forJob(abPlan.jobs.find((entry) => entry.armId === armId && entry.turn === turn));

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

test('the character shift casts a seeded part on shifted turns and nothing on the rest', () => {
  const abPlan = plan('character_shift_control', { scenarios: ['nocturne_full'] });
  const forJob = (job) => prepareTutorStubAbJob(job, { root: ROOT });
  const byTurn = (armId, turn) =>
    forJob(abPlan.jobs.find((entry) => entry.armId === armId && entry.turn === turn));

  // Turn 3's hash lands on shift; turn 2's lands on quiet. Both are fixed by
  // the turn id, so a rerun replays the same seeded draws.
  const shifted = byTurn('character_shift_only', 3);
  const bareShifted = byTurn('baseline', 3);
  assert.equal(shifted.projection.systemPrompt, bareShifted.projection.systemPrompt);
  assert.deepEqual(shifted.projection.retainedFeatures, []);
  assert.equal(shifted.projection.advisoryChars, 0);
  assert.equal(shifted.projection.characterShift, true);
  assert.equal(shifted.projection.characterShiftChars > 0, true);
  assert.ok(shifted.latest.content.startsWith('For this turn, play the '));
  assert.ok(shifted.latest.content.endsWith(`\n\n${bareShifted.latest.content}`));
  const injected = shifted.latest.content.slice(0, -bareShifted.latest.content.length);
  // A cast from the system prompt's own palette, not a smuggled contract: no
  // advisory block, no slot vocabulary, and the part is one the prompt names.
  assert.equal(parseTutorStubAdvisoryBlocks(shifted.latest.content).blocks.length, 0);
  const named = TUTOR_STUB_AB_CHARACTER_SHIFT_PARTS.filter((part) => injected.includes(`play the ${part}`));
  assert.equal(named.length, 1);
  for (const word of ['UPTAKE', 'PART —', 'SOURCE', 'TACTIC', 'HANDOFF', 'RECORD', 'public exhibit', 'must']) {
    assert.ok(!injected.includes(word), word);
  }

  // A quiet turn adds nothing: byte-identical to the bare tutor's prompt.
  const quiet = byTurn('character_shift_only', 2);
  const bareQuiet = byTurn('baseline', 2);
  assert.equal(quiet.projection.characterShift, false);
  assert.equal(quiet.projection.characterShiftChars, 0);
  assert.equal(quiet.latest.content, bareQuiet.latest.content);
});

test('the character shift is rejected on the baseline and beside the real contract', () => {
  assert.throws(
    () => resolveTutorStubAbArm('bare', { baseline: true, features: 'none', character_shift: true }),
    /must not carry the character shift/u,
  );
  assert.throws(
    () => resolveTutorStubAbArm('both', { features: ['first_draft_contract'], character_shift: true }),
    /cannot carry the character shift and the first-draft contract together/u,
  );
  assert.equal(resolveTutorStubAbArm('ok', { features: 'all', drop: ['first_draft_contract'] }).characterShift, false);
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

// --- rules an untold tutor could have satisfied ------------------------------

/**
 * The classes recorded for every rule the bench has actually raised across the
 * recorded corpus. Recorded runs live under `exports/`, which is gitignored, so
 * this checked-in list is the drift guard: reclassifying a rule by accident
 * moves the headline number, and this is what catches it.
 */
const RECORDED_RULE_KEYING = {
  'actorialRealizationAudit:missing_selected_actorial_part': 'told',
  'actorialRealizationAudit:missing_selected_performance_tactic': 'told',
  'dramaticReleaseAudit:duplicate_clue_delivery': 'open',
  'dramaticReleaseAudit:missing_exhibit_action': 'told',
  'dramaticReleaseAudit:missing_in_scene_enactment': 'told',
  'dramaticReleaseAudit:missing_return_to_inquiry': 'open',
  'dramaticReleaseAudit:opaque_clue_release': 'told',
  'leakAudit:private_final_conclusion': 'open',
  'leakAudit:unreleased_premise_content': 'open',
  'leakAudit:unsupported_evidence_correspondence': 'open',
  'liveSourceActionAlignmentAudit:due_source_exact_occurrence_count': 'told',
  'liveTurnProgressionAudit:handoff_loses_turn_focus': 'told',
  'liveTurnProgressionAudit:handoff_question_not_terminal': 'told',
  'liveTurnProgressionAudit:learner_uptake_not_realized': 'open',
  'liveTurnProgressionAudit:multiple_questions_violate_terminal_handoff': 'open',
  'liveTurnProgressionAudit:question_forbidden_by_handoff_contract': 'told',
  'liveTurnProgressionAudit:question_outside_terminal_handoff': 'told',
  'liveTurnProgressionAudit:required_handoff_question_missing': 'told',
  'questionSupportAudit:abstract_proof_language': 'open',
  'questionSupportAudit:missing_clarification_invitation': 'open',
  'questionSupportAudit:unanswerable_open_recall': 'open',
  'releaseDeliveryAudit:missing_due_evidence': 'told',
  'repetitionAudit:repeated_tutor_sentence': 'open',
  'responseCompositionAudit:generic_learner_uptake': 'open',
  'responseCompositionAudit:missing_learner_uptake': 'open',
  'responseCompositionAudit:missing_tutor_development': 'open',
  'responseCompositionAudit:unlicensed_requested_entry': 'told',
  'responseCompositionAudit:verbatim_learner_echo': 'open',
};

test('every rule the bench has raised keeps the class it was given', () => {
  for (const [cluster, expected] of Object.entries(RECORDED_RULE_KEYING)) {
    assert.equal(tutorStubAbRuleKeying(cluster), expected, `${cluster} changed class`);
    assert.ok(tutorStubAbRuleKeyingReason(cluster), `${cluster} has no stated reason`);
  }
});

test('the guard family that noticed a rule does not change its class', () => {
  // The live and V2 turn-progression audits raise the same issue types, and a
  // recovery pass re-raises names it did not author.
  assert.equal(
    tutorStubAbRuleKeying('liveTurnProgressionAudit:learner_uptake_not_realized'),
    tutorStubAbRuleKeying('turnProgressionAudit:learner_uptake_not_realized'),
  );
  assert.equal(tutorStubAbRuleKeying('learner_uptake_not_realized'), 'open');
});

test('an unclassified rule is quarantined rather than folded into either total', () => {
  const split = splitTutorStubAbClusters([
    'repetitionAudit:repeated_tutor_sentence',
    'actorialRealizationAudit:missing_selected_actorial_part',
    'someAudit:nobody_has_classified_this',
  ]);
  assert.equal(split.open, 1);
  assert.equal(split.told, 1);
  assert.equal(split.unclassified, 1);
  assert.deepEqual(split.unclassifiedRules, ['someAudit:nobody_has_classified_this']);
});

test('a rule broken on four turns counts four times, like the headline total', () => {
  const repeated = Array.from({ length: 4 }, () => 'repetitionAudit:repeated_tutor_sentence');
  assert.equal(splitTutorStubAbClusters(repeated).open, 4);
});

test('the summary splits the tally and the halves add back up to the total', async () => {
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
            // One rule the bare tutor could have satisfied, two it could not,
            // and one nobody has classified.
            failureClusters: [
              'repetitionAudit:repeated_tutor_sentence',
              'actorialRealizationAudit:missing_selected_actorial_part',
              'liveSourceActionAlignmentAudit:due_source_exact_occurrence_count',
              'someAudit:nobody_has_classified_this',
            ],
            hardFailureClusters: [],
          }
        : {
            ok: false,
            safetyFailure: false,
            failureClusters: ['repetitionAudit:repeated_tutor_sentence'],
            hardFailureClusters: [],
          },
  });
  const baseline = report.summary.arms.find((arm) => arm.baseline);
  const instrumented = report.summary.arms.find((arm) => !arm.baseline);

  // Three turns in the smoke preset.
  assert.equal(baseline.openClusters, 3);
  assert.equal(baseline.toldClusters, 6);
  assert.equal(baseline.unclassifiedClusters, 3);
  assert.equal(baseline.openClusters + baseline.toldClusters + baseline.unclassifiedClusters, baseline.totalClusters);
  assert.deepEqual(baseline.unclassifiedRules, ['someAudit:nobody_has_classified_this']);

  // The whole tally makes the instrumented arm look nine rules better; on the
  // rules the bare tutor could have satisfied it is level.
  assert.equal(instrumented.clusterDeltaTotal, -9);
  assert.equal(instrumented.openClusterDeltaTotal, 0);
  assert.equal(instrumented.toldClusterDeltaTotal, -6);

  const markdown = renderTutorStubAbMarkdown(report);
  assert.match(markdown, /Open 0, told -6\./u);
  assert.match(markdown, /nobody_has_classified_this/u);
  assert.match(markdown, /Read the \*\*open\*\* column, not the total/u);
});

test('re-scoring recorded runs on the open rules makes no model calls', () => {
  const result = spawnSync(process.execPath, ['scripts/rescore-tutor-stub-ab-open-rules.js', '--pooled'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, OPENROUTER_API_KEY: '', ANTHROPIC_API_KEY: '' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /reads recorded report\.json files only|no recorded A\/B runs found/u);
});
