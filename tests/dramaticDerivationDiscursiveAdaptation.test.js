import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DISCURSIVE_ADAPTATION_SCHEMA,
  deriveDiscursiveAdaptationState,
  derivePublicLearnerEvidence,
} from '../services/dramaticDerivation/index.js';

test('discursive adaptation selects minimal presence for productive learner reasoning', () => {
  const publicEvidence = derivePublicLearnerEvidence({
    learnerText: 'I would say the mark proves source, so the next step is causation.',
  });
  const state = deriveDiscursiveAdaptationState({ scope: 'dialogue_block', publicEvidence });

  assert.equal(state.schema, DISCURSIVE_ADAPTATION_SCHEMA);
  assert.equal(state.publicOnly, true);
  assert.equal(state.scope, 'dialogue_block');
  assert.equal(state.mode, 'minimal_presence');
  assert.equal(state.shouldAvoidIntervention, true);
  assert.equal(state.shouldAskQuestion, false);
  assert.equal(state.pressure, 'lower');
});

test('discursive adaptation recognizes purpose questions and resistance without proof authority', () => {
  const purpose = deriveDiscursiveAdaptationState({
    learnerText: 'Why does this evidence matter?',
    proofCriticalReleasePending: true,
  });
  assert.equal(purpose.mode, 'purpose_acknowledgement');
  assert.equal(purpose.acknowledgementNeed, 'explicit');
  assert.equal(purpose.opportunityCostBudget.maxProofNeutralTutorTurns, 0);

  const resistant = deriveDiscursiveAdaptationState({ learnerText: "But that doesn't follow." });
  assert.equal(resistant.mode, 'recognition_repair');
  assert.equal(resistant.shouldAskQuestion, true);
});
