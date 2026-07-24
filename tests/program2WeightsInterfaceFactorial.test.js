import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWeightsInterfaceFactorialPlan,
  buildWeightsInterfaceFactorialSmokePlan,
  validateWeightsInterfaceFactorialPlan,
  WEIGHTS_INTERFACE_FACTORIAL_SPEC,
} from '../scripts/run-program2-live-pilot.js';
import {
  extractCommitteeSpanV1,
  extractCuePreservingCommitteeSpanV2,
  resolveCueBlindCommitteeDelivery,
  runCueBlindCommitteeBattery,
} from '../services/program2CommitteeEngine.js';
import { licensedWeightsInterfaceReading } from '../scripts/analyze-program2-weights-interface-factorial.mjs';

function flagValue(command, flag) {
  const index = command.indexOf(flag);
  return index >= 0 ? command[index + 1] : null;
}

test('v1 retains every valid question sentence in source order', () => {
  assert.deepEqual(extractCommitteeSpanV1('Settle in. What follows? Why does it follow?'), {
    status: 'ok',
    span: 'What follows? Why does it follow?',
    questionCount: 2,
    carriedStatement: false,
  });
  assert.equal(extractCommitteeSpanV1('No question here.').status, 'no_span');
});

test('v2 deterministically prefers an authored cue-bearing question', () => {
  assert.deepEqual(
    extractCuePreservingCommitteeSpanV2('What follows? Which record licenses that step? Why now?'),
    {
      status: 'ok',
      span: 'Which record licenses that step?',
      questionCount: 2,
      carriedStatement: false,
    },
  );
});

test('v2 carries the first authored cue statement before the first question', () => {
  assert.deepEqual(extractCuePreservingCommitteeSpanV2('The test is already public. What does that support?'), {
    status: 'ok',
    span: 'The test is already public. What does that support?',
    questionCount: 1,
    carriedStatement: true,
  });
});

test('v2 uses the first question without inventing text and reports no_span without one', () => {
  assert.equal(extractCuePreservingCommitteeSpanV2('What follows? Why?').span, 'What follows?');
  assert.deepEqual(extractCuePreservingCommitteeSpanV2('The learner pauses.'), {
    status: 'no_span',
    span: null,
    questionCount: 0,
    carriedStatement: false,
  });
});

test('successor enforcement is cue-blind and falls back to the original greedy mini', () => {
  const forbiddenDependencies = /PROGRAM2_WARRANT_CUE_RE|committeeFallbackBatteryPass|trimCommitteeFallback/u;
  assert.doesNotMatch(runCueBlindCommitteeBattery.toString(), forbiddenDependencies);
  assert.doesNotMatch(resolveCueBlindCommitteeDelivery.toString(), forbiddenDependencies);

  const miniText = 'Two possible questions? And another?';
  const noSpan = resolveCueBlindCommitteeDelivery({
    miniText,
    spanResult: { status: 'no_span', span: null },
  });
  assert.equal(noSpan.deliveredText, miniText);
  assert.equal(noSpan.fallbackSource, 'original_greedy_mini');
  assert.equal(noSpan.miniResamples, 0);
  assert.equal(noSpan.composerCalls, 0);

  const rejected = resolveCueBlindCommitteeDelivery({
    miniText,
    spanResult: { status: 'ok', span: 'What follows?' },
    composedText: 'A new clue appears. What follows?',
    battery: runCueBlindCommitteeBattery({
      composedText: 'A new clue appears. What follows?',
      span: 'What follows?',
      publicEvidenceSafe: false,
      noNewPremise: false,
    }),
  });
  assert.equal(rejected.deliveredText, miniText);
  assert.equal(rejected.failureReason, 'public_evidence_safe');
  assert.equal(rejected.composerCalls, 1);

  const accepted = resolveCueBlindCommitteeDelivery({
    miniText,
    spanResult: { status: 'ok', span: 'What follows?' },
    composedText: 'Stay with the public record. What follows?',
    battery: runCueBlindCommitteeBattery({
      composedText: 'Stay with the public record. What follows?',
      span: 'What follows?',
    }),
  });
  assert.equal(accepted.deliveredText, 'Stay with the public record. What follows?');
  assert.equal(accepted.fallbackUsed, false);
  assert.equal(accepted.composerCalls, 1);
});

test('factorial plan freezes a balanced 48-dialogue four-cell blocked design', () => {
  const plan = buildWeightsInterfaceFactorialPlan({ outputRoot: '/tmp/program2-weights-interface-plan' });
  const validation = validateWeightsInterfaceFactorialPlan(plan);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(plan.jobs.length, 48);
  assert.equal(validation.completeBlockCount, 12);
  assert.equal(plan.runSeed, 20260725);
  assert.equal(plan.bootstrapSeed, 20260726);
  for (const condition of WEIGHTS_INTERFACE_FACTORIAL_SPEC.conditions) {
    assert.equal(plan.jobs.filter((job) => job.condition === condition).length, 12);
  }
  for (const job of plan.jobs) {
    assert.equal(flagValue(job.command, '--committee-fallback-policy'), 'cue_blind');
    assert.equal(flagValue(job.command, '--committee-span-interface'), job.spanInterface);
    assert.equal(flagValue(job.command, '--eval-job-id'), job.blockKey);
  }
  assert.deepEqual(plan, buildWeightsInterfaceFactorialPlan({ outputRoot: '/tmp/program2-weights-interface-plan' }));
});

test('paid smoke plan is exactly one excluded complete four-cell block', () => {
  const plan = buildWeightsInterfaceFactorialSmokePlan({ outputRoot: '/tmp/program2-weights-interface-smoke' });
  const validation = validateWeightsInterfaceFactorialPlan(plan, { smoke: true });
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(plan.smokeExcluded, true);
  assert.equal(plan.jobs.length, 4);
  assert.equal(new Set(plan.jobs.map((job) => job.blockKey)).size, 1);
  assert.deepEqual(new Set(plan.jobs.map((job) => job.condition)), new Set(WEIGHTS_INTERFACE_FACTORIAL_SPEC.conditions));
});

test('factorial analyzer freezes the preregistered reading grammar', () => {
  assert.equal(
    licensedWeightsInterfaceReading({ completionReady: false, semanticReady: true, estimate: 0.3, ci95: [0.2, 0.4] }),
    'incomplete_or_under_informative',
  );
  assert.equal(
    licensedWeightsInterfaceReading({ completionReady: true, semanticReady: false, estimate: null, ci95: null }),
    'pending_semantic_adjudication',
  );
  assert.equal(
    licensedWeightsInterfaceReading({ completionReady: true, semanticReady: true, estimate: 0.2, ci95: [0.01, 0.35] }),
    'trained_weights_improve_first_pass_semantic_skill',
  );
  assert.equal(
    licensedWeightsInterfaceReading({ completionReady: true, semanticReady: true, estimate: 0.01, ci95: [-0.08, 0.09] }),
    'first_pass_semantic_skill_practically_equivalent',
  );
  assert.equal(
    licensedWeightsInterfaceReading({ completionReady: true, semanticReady: true, estimate: 0.04, ci95: [-0.12, 0.18] }),
    'first_pass_semantic_skill_indeterminate',
  );
});
