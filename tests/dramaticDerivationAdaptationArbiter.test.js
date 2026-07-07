import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADAPTATION_ARBITER_SCHEMA,
  arbitrateAdaptation,
  deriveDidacticModeState,
  deriveDiscursiveAdaptationState,
  deriveOpportunityCostBudget,
} from '../services/dramaticDerivation/index.js';

test('arbiter preserves binding proof action and blocks proof-starving conduct', () => {
  const didactic = deriveDidacticModeState({
    learnerText: 'As you said, the crowsfoot mark is the phrase.',
    uptake: { quality: 'echo_only' },
  });
  const result = arbitrateAdaptation({
    turn: 4,
    proofControl: { action: 'release_next_evidence', target: 'p_mark', proofCritical: true },
    didactic,
    opportunityCostBudget: deriveOpportunityCostBudget({ proofCriticalReleasePending: true }),
  });

  assert.equal(result.schema, ADAPTATION_ARBITER_SCHEMA);
  assert.equal(result.proofAction, 'release_next_evidence');
  assert.equal(result.proofTarget, 'p_mark');
  assert.equal(result.conduct, 'return_to_proof_control');
  assert.deepEqual(result.blockedActions, ['teach_back']);
  assert.equal(result.trace.opportunityCostAudit.ok, false);
});

test('arbiter allows minimal presence while proof control remains unchanged', () => {
  const discursive = deriveDiscursiveAdaptationState({
    learnerText: 'I would say this proves source, so cause is the next line.',
  });
  const result = arbitrateAdaptation({
    turn: 5,
    proofControl: { action: 'release_next_evidence', target: 'p_source', proofCritical: true },
    discursive,
    opportunityCostBudget: deriveOpportunityCostBudget({ proofCriticalReleasePending: true }),
  });

  assert.equal(result.proofAction, 'release_next_evidence');
  assert.equal(result.proofTarget, 'p_source');
  assert.equal(result.conduct, 'minimal_presence');
  assert.deepEqual(result.blockedActions, []);
});

test('scene and act overlays remain advisory when current turn has proof authority', () => {
  const result = arbitrateAdaptation({
    proofControl: { action: 'repair_dependency', target: 'p_bridge' },
    selfRegulation: {
      schema: 'dramatic-derivation.self-regulation.v0',
      publicOnly: true,
      scope: 'act',
      recommendedCoachMove: 'planning_prompt',
    },
    opportunityCostBudget: deriveOpportunityCostBudget({ repairPending: true }),
  });

  assert.equal(result.proofAction, 'repair_dependency');
  assert.equal(result.proofTarget, 'p_bridge');
  assert.equal(result.conduct, 'planning_prompt');
  assert.equal(result.overlays[0].advisory, true);
});
