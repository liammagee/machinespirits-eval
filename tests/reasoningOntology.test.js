import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOntologyGuidance, reasonOverObservations } from '../services/ontology/reasoningOntology.js';

test('ontology infers policy guards for affirming the consequent', async () => {
  const observations = [
    {
      id: 'obs_1',
      quote: 'If the model overfit, the validation score would fall. The score fell, so it overfit.',
      tags: ['affirming_consequent', 'claim_ownership_weak'],
    },
  ];

  const guidance = await buildOntologyGuidance({ observations, role: 'tutor_ego' });

  assert.ok(guidance.supportedPolicies.includes('request_elaboration'));
  assert.ok(guidance.supportedPolicies.includes('pose_counterexample'));
  assert.ok(guidance.contraindicatedPolicies.includes('give_worked_example'));
  assert.ok(guidance.contraindicatedPolicies.includes('summarize_and_check'));
  assert.ok(guidance.missingKnowledgeComponents.includes('DistinguishNecessarySufficient'));
  assert.ok(guidance.recognitionMoves.includes('ContestableRepresentation'));
  assert.ok(!guidance.recommendedPolicies.includes('give_worked_example'));
});

test('reasoner preserves superclass inferences for invalid conditional inference', async () => {
  const observations = [{ id: 'obs_2', quote: 'If A then B; not A, so not B.', tags: ['denying_antecedent'] }];
  const result = await reasonOverObservations(observations);

  assert.ok(result.facts.obs_2.types.includes('DenyingAntecedent'));
  assert.ok(result.facts.obs_2.types.includes('InvalidConditionalInference'));
  assert.ok(result.facts.obs_2.types.includes('InvalidDeductiveInference'));
});
