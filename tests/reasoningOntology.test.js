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

test('a learner modelled as both mastering and lacking a KC is inconsistent (decision 3A)', async () => {
  const abox = `${ABOX_PREFIXES}\nms:tom_learner_warrant_t5 rdf:type ms:KCMastered ; rdf:type ms:KCMissing .`;
  const result = await checkAboxConsistency(abox);

  assert.equal(result.consistent, false);
  assert.ok(result.violations.tom_learner_warrant_t5.includes('KCMastered'));
  assert.ok(result.violations.tom_learner_warrant_t5.includes('KCMissing'));
});

test('casting consistency is scoped out of the default ToM check (decision 2B)', async () => {
  // A role cast as both human and LLM is a setup error, not a ToM contradiction:
  // the default check ignores it; a spec validator opts the casting module in.
  const abox = `${ABOX_PREFIXES}\nms:role1 rdf:type ms:HumanCaster ; rdf:type ms:LLMCaster .`;

  const defaultCheck = await checkAboxConsistency(abox);
  assert.equal(defaultCheck.consistent, true);

  const specCheck = await checkAboxConsistency(abox, {
    modules: ['reasoning', 'poetics', 'consistency', 'casting'],
  });
  assert.equal(specCheck.consistent, false);
  assert.ok(specCheck.violations.role1);
});

test('audience is a first-order dramatic position but not an enacted role', async () => {
  const abox = `${ABOX_PREFIXES}\nms:witness1 rdf:type ms:Audience ; rdf:type ms:DramaticRole .`;

  const defaultCheck = await checkAboxConsistency(abox);
  assert.equal(defaultCheck.consistent, true, 'the default ToM check does not apply structural casting axioms');

  const specCheck = await checkAboxConsistency(abox, {
    modules: ['reasoning', 'poetics', 'consistency', 'casting'],
  });
  assert.equal(specCheck.consistent, false);
  assert.deepEqual(specCheck.violations.witness1, ['Audience', 'DramaticRole']);
});

test('register realization relates speaker, hearer, addressee profile, and optional audience', async () => {
  const abox = `${ABOX_PREFIXES}
ms:audience1 rdf:type ms:Audience .
ms:register1 rdf:type ms:RegisterRealization ;
  ms:hasSpeakerRole ms:TutorRole ;
  ms:hasHearerRole ms:LearnerRole ;
  ms:hasAudience ms:audience1 ;
  ms:realizesEngagementStance ms:SarcasticStance ;
  ms:usesAddresseeProfile ms:AdultNoviceProfile ;
  ms:hasAddressStructure ms:TriadicAddress ;
  ms:hasAudienceAlignment ms:SpeakerAlignedAudience ;
  ms:invitesAudienceAlignmentWith ms:TutorRole .`;
  const result = await checkAboxConsistency(abox, {
    modules: ['reasoning', 'poetics', 'rhetoric'],
    includeClosure: true,
  });

  assert.equal(result.consistent, true);
  assert.match(result.closureText, /RegisterRealization/);
  assert.match(result.closureText, /SarcasticStance/);
  assert.match(result.closureText, /SpeakerAlignedAudience/);
});

test('the Roman rhetoric vocabulary is an opt-in module that co-loads and parses', async () => {
  // rhetoric-core.ttl (course 1001 lectures 5–8) is registered but NOT in
  // DEFAULT_MODULES. Loading it with poetics must resolve the module name, parse
  // the TTL through EYE, and stay consistent — and ms:Elocutio's seeAlso link to
  // the poetics ms:Lexis must not introduce any contradiction.
  const abox = `${ABOX_PREFIXES}\nms:speech1 rdf:type ms:Inventio . ms:fig1 rdf:type ms:Elocutio .`;
  const result = await checkAboxConsistency(abox, {
    modules: ['reasoning', 'poetics', 'rhetoric'],
  });
  assert.equal(result.consistent, true);
});
