import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TASK_MASTERY_SCHEMA,
  assertTaskRecommendation,
  deriveTaskMasteryState,
  evaluateTaskLoopBenchmark,
} from '../services/dramaticDerivation/taskMastery.js';

test('task mastery state is advisory and recommends harder work only after durable evidence', () => {
  const state = deriveTaskMasteryState({
    learnerId: 'learner-a',
    skillId: 'source-before-cause',
    objectId: 'crowsfoot-source',
    ownershipScore: 0.92,
    transferScore: 0.8,
    selfRegulationScore: 0.72,
    uptakeStatus: 'accepted_scaffold',
  });

  assert.equal(state.schema, TASK_MASTERY_SCHEMA);
  assert.equal(state.publicOnly, true);
  assert.equal(state.authority, 'advisory');
  assert.equal(state.mayOverrideProofControl, false);
  assert.equal(state.nextTaskRecommendation, 'increase_difficulty');
  assert.equal(state.fixedProgressionRecommendation, 'near_transfer');
  assert.ok(state.masteryEstimate >= 0.78);
});

test('task mastery routes public prerequisite and near-miss failures to different next tasks', () => {
  const prerequisite = deriveTaskMasteryState({
    ownershipScore: 0.55,
    transferScore: 0.22,
    selfRegulationScore: 0.4,
    uptakeStatus: 'accepted_scaffold',
    errorCategories: ['source_gap'],
  });
  const contrast = deriveTaskMasteryState({
    ownershipScore: 0.66,
    transferScore: 0.34,
    selfRegulationScore: 0.5,
    uptakeStatus: 'accepted_scaffold',
    errorCategories: ['near_miss'],
  });

  assert.equal(prerequisite.nextTaskRecommendation, 'review_prerequisite');
  assert.equal(contrast.nextTaskRecommendation, 'contrast_case');
});

test('task mastery conservatively recommends human followup after repeated non-uptake', () => {
  const state = deriveTaskMasteryState({
    ownershipScore: 0.45,
    transferScore: 0.2,
    selfRegulationScore: 0.24,
    uptakeStatus: 'resisted',
    repeatedNonUptake: 2,
  });

  assert.equal(state.nextTaskRecommendation, 'human_followup');
  assert.ok(state.rationale.some((line) => line.includes('nonUptake=2')));
});

test('task-loop benchmark passes and beats fixed progression controls', () => {
  const report = evaluateTaskLoopBenchmark();
  assert.equal(report.summary.adaptiveFail, 0);
  assert.equal(report.summary.allPassed, true);
  assert.ok(report.summary.adaptiveAccuracy > report.summary.fixedAccuracy);
  assert.ok(report.summary.count >= 12);
});

test('task mastery public-only audit rejects hidden proof fields', () => {
  const state = deriveTaskMasteryState({
    ownershipScore: 0.9,
    transferScore: 0.9,
    selfRegulationScore: 0.9,
    hiddenBoard: [['x']],
  });

  assert.equal(state.inputAudit.ok, false);
  assert.equal(state.masteryEstimate, 0);
  assert.equal(state.nextTaskRecommendation, 'review_prerequisite');
});

test('task recommendation assertion guards unknown actions', () => {
  assert.equal(assertTaskRecommendation('near_transfer'), 'near_transfer');
  assert.throws(() => assertTaskRecommendation('invented_action'), /Unknown next task action/u);
});
