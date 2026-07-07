import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HUMAN_HANDOFF_SCHEMA,
  assertHumanHandoffRecommendation,
  deriveHumanHandoffState,
  evaluateHumanHandoffProbe,
  renderHumanHandoffProbeMarkdown,
} from '../services/dramaticDerivation/humanHandoff.js';

test('human handoff state is public-only advisory and cannot override proof control', () => {
  const state = deriveHumanHandoffState({
    ownershipScore: 0.72,
    transferScore: 0.48,
    selfRegulationScore: 0.5,
    uptakeStatus: 'accepted_scaffold',
    modelConfidence: 0.68,
  });

  assert.equal(state.schema, HUMAN_HANDOFF_SCHEMA);
  assert.equal(state.publicOnly, true);
  assert.equal(state.authority, 'advisory');
  assert.equal(state.mayOverrideProofControl, false);
  assert.equal(state.mayChangeProofControlBehavior, false);
  assert.equal(state.requiresProofControlLog, true);
  assert.equal(state.recommendation, 'continue_system_support');
});

test('human handoff recommends followup for learner request and repeated non-uptake', () => {
  const requested = deriveHumanHandoffState({
    ownershipScore: 0.62,
    transferScore: 0.4,
    selfRegulationScore: 0.48,
    learnerRequestedHuman: true,
  });
  const nonUptake = deriveHumanHandoffState({
    ownershipScore: 0.45,
    transferScore: 0.2,
    selfRegulationScore: 0.24,
    uptakeStatus: 'resisted',
    repeatedNonUptake: 2,
  });

  assert.equal(requested.recommendation, 'recommend_human_followup');
  assert.equal(requested.helperRecommendation, 'human_teacher');
  assert.equal(nonUptake.recommendation, 'recommend_human_followup');
  assert.ok(nonUptake.handoffSignals.some((signal) => signal.id === 'repeated_non_uptake'));
});

test('human handoff separates optional review from immediate high-affect review', () => {
  const optional = deriveHumanHandoffState({
    ownershipScore: 0.7,
    transferScore: 0.42,
    selfRegulationScore: 0.5,
    modelConfidence: 0.28,
  });
  const immediate = deriveHumanHandoffState({
    ownershipScore: 0.5,
    transferScore: 0.22,
    selfRegulationScore: 0.26,
    affectRisk: 'high',
  });

  assert.equal(optional.recommendation, 'offer_optional_human_review');
  assert.equal(optional.helperRecommendation, 'hybrid_teacher_review');
  assert.equal(immediate.recommendation, 'immediate_human_review');
  assert.equal(immediate.helperRecommendation, 'human_teacher_priority');
});

test('human handoff public-only audit rejects hidden proof fields', () => {
  const state = deriveHumanHandoffState({
    ownershipScore: 0.9,
    transferScore: 0.8,
    selfRegulationScore: 0.7,
    hiddenBoard: [['private']],
  });

  assert.equal(state.inputAudit.ok, false);
  assert.equal(state.recommendation, 'continue_system_support');
  assert.equal(state.confidence, 0);
  assert.equal(state.taskMasteryState, null);
});

test('human handoff probe passes deterministic conservative controls', () => {
  const report = evaluateHumanHandoffProbe();

  assert.equal(report.summary.fail, 0);
  assert.equal(report.summary.publicOnlyFail, 0);
  assert.equal(report.summary.nonAdvisoryRows, 0);
  assert.equal(report.summary.allPassed, true);
  assert.equal(report.summary.count, 8);
});

test('human handoff report states the deployment boundary', () => {
  const markdown = renderHumanHandoffProbeMarkdown(evaluateHumanHandoffProbe());

  assert.match(markdown, /local deployment-risk probe/u);
  assert.match(markdown, /does not route a learner/u);
  assert.match(markdown, /replace proof-control logs/u);
});

test('human handoff assertion guards unknown recommendations', () => {
  assert.equal(assertHumanHandoffRecommendation('offer_optional_human_review'), 'offer_optional_human_review');
  assert.throws(() => assertHumanHandoffRecommendation('page_the_moon'), /Unknown human handoff recommendation/u);
});
