import assert from 'node:assert/strict';
import test from 'node:test';
import {
  A21_LEARNER_STATE_SCHEMA,
  createDurableLearnerState,
  initialHethelLearnerState,
  statePublicSummary,
  validateDurableLearnerState,
} from '../services/dramaticDerivation/index.js';

test('A21 initial Hethel learner state separates seen evidence from owned dependency', () => {
  const state = initialHethelLearnerState({
    fixtureId: 'hethel-trigger-fixture',
    publicProofSummary: { D: 3 },
  });

  assert.equal(state.schema, A21_LEARNER_STATE_SCHEMA);
  assert.equal(state.stateId, 'hethel-trigger-fixture:learner');
  assert.equal(state.evidenceSeen.p_surface, true);
  assert.equal(state.evidenceSeen.p_point, false);
  assert.equal(state.dependencyOwned.p_surface, true);
  assert.equal(state.dependencyOwned.p_point, false);
  assert.equal(state.proofProgress.D, 3);
});

test('A21 learner state validation rejects hidden implementation fields', () => {
  const state = createDurableLearnerState();
  state.proofProgress.secret = 'do not expose';

  assert.throws(() => validateDurableLearnerState(state), /forbidden hidden fields/u);
});

test('A21 statePublicSummary preserves deterministic fields without proof-path leakage', () => {
  const state = createDurableLearnerState({
    diagnosticHistory: { count: 2, repeatedWithoutNewEvidence: 1 },
    proofProgress: { D: 2, lastDDelta: -1 },
  });
  const summary = statePublicSummary(state);

  assert.equal(summary.schema, A21_LEARNER_STATE_SCHEMA);
  assert.equal(summary.diagnosticHistory.count, 2);
  assert.equal(summary.proofProgress.D, 2);
  assert.doesNotMatch(JSON.stringify(summary), /proofPath|rawBoard|secret/u);
});
