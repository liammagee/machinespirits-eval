import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOntologyGuidance,
  reasonOverObservations,
  checkAboxConsistency,
} from '../services/ontology/reasoningOntology.js';

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

const ABOX_PREFIXES = [
  '@prefix ms: <https://machinespirits.dev/ontology/reasoning#> .',
  '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
].join('\n');

test('consistency check flags an individual holding two disjoint recognition states', async () => {
  // A learner snapshot cannot both fully own a conclusion AND hold it weakly.
  const abox = `${ABOX_PREFIXES}\nms:learner_turn3 rdf:type ms:ConclusionOwned ; rdf:type ms:ClaimOwnershipWeak .`;
  const result = await checkAboxConsistency(abox);

  assert.equal(result.consistent, false);
  assert.ok(result.violations.learner_turn3);
  assert.ok(result.violations.learner_turn3.includes('ConclusionOwned'));
  assert.ok(result.violations.learner_turn3.includes('ClaimOwnershipWeak'));
});

test('consistency check passes a coherent theory-of-mind snapshot', async () => {
  const abox = `${ABOX_PREFIXES}\nms:learner_turn1 rdf:type ms:AuthorityToDeferTo .`;
  const result = await checkAboxConsistency(abox);

  assert.equal(result.consistent, true);
  assert.deepEqual(result.violations, {});
});

test('the drama (poetics) vocabulary is co-loaded and reasoned over', async () => {
  // A turn that targets catharsis but includes a pseudo-catharsis move is a form
  // conflict — derivable only if poetics-core + poetics-rules are co-loaded.
  const abox = `${ABOX_PREFIXES}\nms:turn4 ms:targetsForm ms:Catharsis ; ms:includesMove ms:PseudoCatharsis .`;
  const { closureText } = await checkAboxConsistency(abox, { includeClosure: true });

  assert.match(closureText, /hasFormConflict/);
});
