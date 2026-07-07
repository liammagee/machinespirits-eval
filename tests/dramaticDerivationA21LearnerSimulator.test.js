import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyTutorActionToLearnerState,
  defaultHethelActionSet,
  executeA21Action,
  getA21Action,
  initialHethelLearnerState,
} from '../services/dramaticDerivation/index.js';

const actionSet = defaultHethelActionSet();

function runAction(state, actionId, extra = {}) {
  const action = getA21Action(actionSet, actionId);
  const execution = executeA21Action(action, { assignmentProbability: 0.25, turn: extra.turn ?? 10 });
  return applyTutorActionToLearnerState(
    state,
    action,
    extra.tutorText ?? execution.tutorText,
    extra.releaseInfo ?? execution.releaseInfo,
  );
}

test('A21 simulator does not let diagnostics spontaneously repair the target misconception', () => {
  const state = initialHethelLearnerState();
  const result = runAction(state, 'A_DIAG_CONFLICT');
  const after = result.learnerStateAfter;

  assert.equal(after.misconception, 'mirror_dead_predicate');
  assert.equal(after.dependencyOwned.p_point, false);
  assert.equal(after.evidenceSeen.p_point, false);
  assert.equal(after.proofProgress.D, state.proofProgress.D);
  assert.equal(after.diagnosticHistory.count, 1);
});

test('A21 repeated diagnostics without new evidence become costly and can trigger aporia', () => {
  let state = initialHethelLearnerState();
  for (const turn of [10, 11, 12]) {
    state = runAction(state, 'A_DIAG_CONFLICT', { turn }).learnerStateAfter;
  }

  assert.equal(state.diagnosticHistory.count, 3);
  assert.equal(state.diagnosticHistory.repeatedWithoutNewEvidence, 2);
  assert.equal(state.frustration, 'high');
  assert.equal(state.engagement, 'aporia');
});

test('A21 release marks evidence seen without granting dependency ownership', () => {
  const state = initialHethelLearnerState();
  const result = runAction(state, 'B_RELEASE_P_POINT');
  const after = result.learnerStateAfter;

  assert.equal(after.evidenceSeen.p_point, true);
  assert.equal(after.dependencyOwned.p_point, false);
  assert.equal(after.transitionFlags.learnerCanUsePPoint, true);
  assert.equal(after.proofProgress.D, state.proofProgress.D - 1);
  assert.deepEqual(after.proofProgress.releasesOnSchedule, ['p_point']);
});

test('A21 dependency repair only owns p_point after evidence or permitted restatement', () => {
  const state = initialHethelLearnerState({
    publicLearnerState: {
      evidenceSeen: { p_point: false },
      dependencyOwned: { p_point: false },
    },
  });

  const noRestatement = runAction(state, 'C_RESTAGE_P_POINT', { tutorText: 'Let us pause again.' }).learnerStateAfter;
  assert.equal(noRestatement.dependencyOwned.p_point, false);
  assert.equal(noRestatement.proofProgress.D, state.proofProgress.D);

  const repaired = runAction(state, 'C_RESTAGE_P_POINT', {
    tutorText: 'Restage the already public point and put it in your own words.',
  }).learnerStateAfter;
  assert.equal(repaired.dependencyOwned.p_point, true);
  assert.equal(repaired.dependencyEchoedOnly.p_point, false);
  assert.equal(repaired.transitionFlags.targetDependencyRepaired, true);
  assert.equal(repaired.proofProgress.D, state.proofProgress.D - 1);
});

test('A21 consolidation improves ownership only when released evidence is already seen', () => {
  const unreleased = initialHethelLearnerState({
    publicLearnerState: {
      evidenceSeen: { p_point: false },
      dependencyOwned: { p_surface: true, p_point: false },
    },
  });
  const unreleasedAfter = runAction(unreleased, 'D_CONSOLIDATE_THEN_RELEASE').learnerStateAfter;
  assert.equal(unreleasedAfter.dependencyOwned.p_point, false);

  const released = initialHethelLearnerState({
    publicLearnerState: {
      evidenceSeen: { p_point: true },
      dependencyOwned: { p_surface: true, p_point: false },
      dependencyEchoedOnly: { p_point: true },
    },
  });
  const releasedAfter = runAction(released, 'D_CONSOLIDATE_THEN_RELEASE').learnerStateAfter;
  assert.equal(releasedAfter.dependencyOwned.p_point, true);
  assert.equal(releasedAfter.dependencyEchoedOnly.p_point, false);
});
