import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getEngagementRegisterDefinitions,
  getEngagementStanceDefinitions,
  loadEngagementRegisterRegistry,
} from '../engagementRegisterRegistry.js';
import {
  auditTutorStubResponseConfiguration,
  buildTutorStubResponseConfiguration,
  selectTutorStubActionFamily,
  summarizeTutorStubResponseConfigurationAudits,
  tutorStubResponseConfigurationPrompt,
} from '../tutorStubResponseConfiguration.js';

function learnerDag({ bottleneck = 'release_or_pacing_gap', coverage = 0.3 } = {}) {
  return {
    model: {
      assessment: {
        bottleneck,
        bestPathCoverage: coverage,
        finalSecretEntailed: false,
        assertedSecret: false,
      },
    },
  };
}

function classification({
  requestType = 'stepwise_support_request',
  conceptual = 3,
  readiness = 3,
  summary = 'The learner asks for the next public test.',
} = {}) {
  return {
    turn: {
      request_type: requestType,
      summary,
      scores: {
        conceptual_engagement: { score: conceptual },
        epistemic_readiness: { score: readiness },
      },
    },
  };
}

function testWorld() {
  return {
    title: 'The Light Shillings',
    setting: 'At Marrick mint, silver coins lie beside the crucible.',
    question: 'Who cast the blanks?',
    premiseById: new Map([
      ['p1', { surface: 'The cupel residue matches silver from the crucible.', fact: ['matches', 'cupel', 'silver'] }],
    ]),
  };
}

test('engagement stances are the primary registry while register reads remain compatible', () => {
  const registry = loadEngagementRegisterRegistry({ forceReload: true });
  assert.ok(registry.engagement_stances);
  assert.equal(registry.registers, undefined);
  assert.deepEqual(getEngagementStanceDefinitions(), getEngagementRegisterDefinitions());
});

test('action family is selected independently from engagement stance and temperature', () => {
  const common = {
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    comprehension: { pressure: 0, unresolvedTerms: [] },
    learnerText: 'What should I test next?',
    world: testWorld(),
    stanceDistribution: [
      { register: 'warm', probability: 0.6 },
      { register: 'precise', probability: 0.4 },
    ],
  };
  const warm = buildTutorStubResponseConfiguration({
    ...common,
    engagementStance: 'warm',
    temperature: 0.4,
  });
  const precise = buildTutorStubResponseConfiguration({
    ...common,
    engagementStance: 'precise',
    temperature: 1.4,
  });

  assert.equal(warm.action_family, 'stage_next_step');
  assert.equal(precise.action_family, 'stage_next_step');
  assert.equal(warm.audience_register, precise.audience_register);
  assert.equal(warm.lexical_accessibility, precise.lexical_accessibility);
  assert.equal(warm.scene_immersion, precise.scene_immersion);
  assert.equal(warm.temperature_scope, 'engagement_stance_only');
  assert.equal(precise.temperature_scope, 'engagement_stance_only');
});

test('unresolved terms select a gloss action, novice audience, plain lexicon, and grounded scene', () => {
  const comprehension = { pressure: 0.85, unresolvedTerms: ['cupel'], recentRequest: true };
  const selected = selectTutorStubActionFamily({
    classification: classification({ requestType: 'plain_language_request' }),
    tutorLearnerDag: learnerDag(),
    comprehension,
  });
  const configuration = buildTutorStubResponseConfiguration({
    engagementStance: 'plain',
    classification: classification({ requestType: 'plain_language_request', conceptual: 2 }),
    tutorLearnerDag: learnerDag(),
    comprehension,
    learnerText: 'What does cupel mean?',
    world: testWorld(),
    temperature: 1,
  });

  assert.equal(selected.actionFamily, 'clarify_term');
  assert.equal(configuration.action_family, 'clarify_term');
  assert.equal(configuration.audience_register, 'adult_novice');
  assert.equal(configuration.lexical_accessibility, 'glossed_plain');
  assert.equal(configuration.scene_immersion, 'grounded');
  assert.deepEqual(configuration.unresolved_terms, ['cupel']);
  assert.match(tutorStubResponseConfigurationPrompt(configuration), /These are independent axes/u);
  assert.match(tutorStubResponseConfigurationPrompt(configuration), /Unresolved terms: cupel/u);
});

test('active accumulated-fact dropout independently selects a public-evidence re-anchor', () => {
  const dag = learnerDag({ bottleneck: 'learner_integration_gap', coverage: 0.2 });
  dag.model.memoryReliability = {
    activeDroppedCount: 1,
    droppedThisTurn: 1,
    visibility: 'conduct',
  };
  const configuration = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    classification: classification({ requestType: 'stepwise_support_request' }),
    tutorLearnerDag: dag,
    comprehension: { pressure: 0, unresolvedTerms: [] },
    learnerText: 'What follows from that?',
    world: testWorld(),
  });

  assert.equal(configuration.action_family, 'reanchor_public_evidence');
  assert.match(configuration.selection_reasons.action_family, /restage one clue/u);
  assert.match(tutorStubResponseConfigurationPrompt(configuration), /without testing or shaming memory/u);
});

test('explicit clue pacing changes the action independently of stance', () => {
  const faster = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    releasePacing: {
      direction: 'accelerate',
      effectiveSpeed: 1.75,
      dueNow: ['p_next'],
    },
  });
  assert.equal(faster.action_family, 'stage_next_step');
  assert.equal(faster.engagement_stance, 'warm');
  assert.match(faster.selection_reasons.action_family, /next public clue is now due/u);

  const slower = buildTutorStubResponseConfiguration({
    engagementStance: 'brisk',
    releasePacing: {
      direction: 'decelerate',
      effectiveSpeed: 0.55,
      dueNow: [],
    },
  });
  assert.equal(slower.action_family, 'reanchor_public_evidence');
  assert.equal(slower.engagement_stance, 'brisk');
});

test('child audience register requires an explicit public age signal', () => {
  const child = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: "I'm 10 and I do not know where to start.",
    classification: classification({ conceptual: 2 }),
    tutorLearnerDag: learnerDag(),
    comprehension: { pressure: 0, unresolvedTerms: [] },
    world: testWorld(),
  });
  const adult = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'I do not know where to start.',
    classification: classification({ conceptual: 2 }),
    tutorLearnerDag: learnerDag(),
    comprehension: { pressure: 0, unresolvedTerms: [] },
    world: testWorld(),
  });
  const genealogicalChild = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: "Marin is Tessa's child, so the lineage continues through Tessa.",
    classification: classification({ conceptual: 4 }),
    tutorLearnerDag: learnerDag(),
    comprehension: { pressure: 0, unresolvedTerms: [] },
    world: testWorld(),
  });

  assert.equal(child.audience_register, 'child_accessible');
  assert.equal(adult.audience_register, 'adult_novice');
  assert.notEqual(genealogicalChild.audience_register, 'child_accessible');
});

test('accelerated multi-premise reasoning selects a peer-level, pace-matching response', () => {
  const dag = learnerDag({ bottleneck: 'release_or_pacing_gap', coverage: 0.5 });
  dag.advance = {
    accelerated: true,
    supportedMoveCount: 3,
    adoptedPremiseCount: 2,
    derivedFactCount: 1,
  };
  dag.model.learnerAdvance = dag.advance;
  const configuration = buildTutorStubResponseConfiguration({
    engagementStance: 'brisk',
    learnerText: 'These two facts establish the lineage, so Marin is the founder’s grandchild.',
    classification: classification({ conceptual: 4, readiness: 4 }),
    tutorLearnerDag: dag,
    comprehension: { pressure: 0, unresolvedTerms: [] },
    world: testWorld(),
  });

  assert.equal(configuration.action_family, 'clarify_distinction');
  assert.equal(configuration.audience_register, 'informed_peer');
  assert.equal(configuration.lexical_accessibility, 'technical');
  assert.equal(configuration.learner_advance.supportedMoveCount, 3);
  assert.match(configuration.selection_reasons.action_family, /credit the whole chain/u);
  assert.match(tutorStubResponseConfigurationPrompt(configuration), /do not ask for any of them again/u);
});

test('surface audit measures realization and differences between selected configurations', () => {
  const world = testWorld();
  const plain = buildTutorStubResponseConfiguration({
    engagementStance: 'plain',
    learnerText: 'What does cupel mean?',
    classification: classification({ requestType: 'plain_language_request', conceptual: 2 }),
    tutorLearnerDag: learnerDag(),
    comprehension: { pressure: 0.85, unresolvedTerms: ['cupel'] },
    world,
  });
  const warm = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'What should I test next?',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    comprehension: { pressure: 0, unresolvedTerms: [] },
    world,
  });
  const plainAudit = auditTutorStubResponseConfiguration({
    text: 'A cupel is a small vessel used to test silver. Which coin beside the crucible would you test?',
    configuration: plain,
    world,
  });
  const warmAudit = auditTutorStubResponseConfiguration({
    text: "Let's take the silver coin beside the crucible. Which mint mark should you test next?",
    configuration: warm,
    world,
  });
  const summary = summarizeTutorStubResponseConfigurationAudits([plainAudit, warmAudit]);

  assert.equal(plainAudit.axes.action_family.visible, true);
  assert.equal(plainAudit.axes.lexical_accessibility.visible, true);
  assert.equal(warmAudit.axes.engagement_stance.visible, true);
  assert.equal(summary.distinct_configuration_count, 2);
  assert.equal(summary.different_configuration_pairs, 1);
  assert.equal(summary.pairwise_visible_difference_rate, 1);
});

test('learner-responsive action families are audited on uptake rather than clue development', () => {
  const configuration = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: "That doesn't prove Dario took it.",
    classification: classification({ requestType: 'authority_refusal_or_status_challenge', conceptual: 4 }),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const audit = auditTutorStubResponseConfiguration({
    text: 'You’re right: the badge does not prove Dario took it because it establishes entry only.\n\nI open the next log and ask what its entry changes?',
    configuration,
    world: testWorld(),
    composition: {
      uptake: 'You’re right: the badge does not prove Dario took it because it establishes entry only.',
      development: 'I open the next log and ask what its entry changes?',
    },
  });

  assert.equal(configuration.action_family, 'answer_accountably');
  assert.equal(audit.axes.action_family.visible, true);
  assert.equal(audit.axes.action_family.evaluated_segment, 'uptake');
});
