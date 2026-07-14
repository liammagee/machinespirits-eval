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
  selectTutorStubActorialPart,
  selectTutorStubActorialPerformance,
  selectTutorStubActionFamily,
  summarizeTutorStubResponseConfigurationAudits,
  tutorStubResponseConfigurationPrompt,
} from '../tutorStubResponseConfiguration.js';
import {
  buildTutorStubDramaticReleaseFrame,
  deterministicTutorStubDramaticReleaseFallback,
} from '../tutorStubDramaticRelease.js';

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
  assert.equal(warm.temperature_scope, 'engagement_stance_and_actorial_part');
  assert.equal(precise.temperature_scope, 'engagement_stance_and_actorial_part');
  assert.equal(warm.actorial_part_selection.temperature, 0.4);
  assert.equal(precise.actorial_part_selection.temperature, 1.4);
});

test('actorial part turns the same public policy signals into distinct dramatic work', () => {
  const dueRelease = selectTutorStubActorialPart({
    engagementStance: 'brisk',
    actionFamily: 'stage_next_step',
    temperature: 0.15,
    dueEvidence: [
      {
        surface: 'Visitor code WF-11 was issued to an outside crew.',
        presentation: { mode: 'enacted_role', role: 'front-desk clerk reading the visitor badge log' },
      },
    ],
  });
  const overreach = selectTutorStubActorialPart({
    engagementStance: 'precise',
    actionFamily: 'answer_accountably',
    temperature: 0.15,
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag({ bottleneck: 'premature_assertion' }),
  });
  const memoryRepairDag = learnerDag({ bottleneck: 'learner_integration_gap' });
  memoryRepairDag.model.memoryReliability = { activeDroppedCount: 1 };
  const memoryRepair = selectTutorStubActorialPart({
    engagementStance: 'plain',
    actionFamily: 'reanchor_public_evidence',
    temperature: 0.15,
    tutorLearnerDag: memoryRepairDag,
    world: { presentation: { ledger_term: 'trial-book' } },
  });

  assert.equal(dueRelease.id, 'authored_source');
  assert.equal(dueRelease.label, 'front-desk clerk reading the visitor badge log');
  assert.equal(dueRelease.locked, true);
  assert.equal(dueRelease.selection_method, 'structural_lock');
  assert.equal(overreach.id, 'skeptic');
  assert.equal(memoryRepair.id, 'record_keeper');
  assert.equal(memoryRepair.label, 'keeper of the trial-book');
});

test('the selected stance becomes a concrete performance tactic inside a structurally locked character', () => {
  const common = {
    learnerText: 'Move this along.',
    classification: classification({ requestType: 'resistance_or_low_agency', conceptual: 2 }),
    tutorLearnerDag: learnerDag(),
    dueEvidence: [
      {
        surface: 'Visitor code WF-11 was issued to an outside crew.',
        presentation: { mode: 'enacted_role', role: 'front-desk clerk reading the visitor badge log' },
      },
    ],
    world: testWorld(),
  };
  const brisk = buildTutorStubResponseConfiguration({ ...common, engagementStance: 'brisk' });
  const witnessing = buildTutorStubResponseConfiguration({ ...common, engagementStance: 'witnessing' });

  assert.equal(brisk.actorial_part, 'authored_source');
  assert.equal(witnessing.actorial_part, 'authored_source');
  assert.equal(brisk.actorial_performance.id, 'rapid_handoff');
  assert.equal(witnessing.actorial_performance.id, 'measured_testimony');
  assert.notEqual(brisk.actorial_performance.contract, witnessing.actorial_performance.contract);
  assert.equal(
    selectTutorStubActorialPerformance({ engagementStance: 'charismatic', actorialPart: 'authored_source' }).id,
    'dramatic_counterpressure',
  );
  assert.match(tutorStubResponseConfigurationPrompt(brisk), /Performance tactic: rapid evidence handoff/u);
  assert.match(tutorStubResponseConfigurationPrompt(brisk), /Forbidden meta-frames/u);
});

test('charismatic counterpressure can be realized through forceful exhibit action', () => {
  const configuration = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    classification: classification({ requestType: 'resistance_or_low_agency', conceptual: 2 }),
    tutorLearnerDag: learnerDag(),
    learnerText: 'Move this along.',
    world: testWorld(),
  });
  const text = [
    'Fair. We will move.',
    'I slap the badge log beside the kettle and read the noon entry. What does this prove?',
  ].join('\n\n');
  const audit = auditTutorStubResponseConfiguration({
    text,
    configuration,
    world: testWorld(),
    composition: {
      uptake: 'Fair. We will move.',
      development: 'I slap the badge log beside the kettle and read the noon entry. What does this prove?',
    },
  });

  assert.equal(configuration.actorial_performance.id, 'dramatic_counterpressure');
  assert.equal(audit.axes.actorial_part.performance_visible, true);

  for (const development of [
    'I snap open the badge log beside the kettle. The room wants “guilty”; what can we actually enter?',
    'I open the incident log and block the room’s easy verdict with my pen. What does the badge prove?',
  ]) {
    const liveDraftAudit = auditTutorStubResponseConfiguration({
      text: `Fair. One clean step.\n\n${development}`,
      configuration,
      world: testWorld(),
      composition: { uptake: 'Fair. One clean step.', development },
    });
    assert.equal(liveDraftAudit.axes.actorial_part.performance_visible, true);
  }
});

test('lower adaptive-performance temperature sharpens the actorial-part choice', () => {
  const input = {
    engagementStance: 'precise',
    actionFamily: 'clarify_distinction',
  };
  const sharp = selectTutorStubActorialPart({ ...input, temperature: 0.15 });
  const broad = selectTutorStubActorialPart({ ...input, temperature: 1.5 });

  assert.equal(sharp.id, 'examiner');
  assert.equal(broad.id, 'examiner');
  assert.ok(sharp.probability > broad.probability);
  assert.ok(broad.distribution.filter((row) => row.probability >= 0.05).length > 1);

  const sampled = selectTutorStubActorialPart({ ...input, temperature: 1.5, selectedPartOverride: 'skeptic' });
  assert.equal(sampled.id, 'skeptic');
  assert.equal(sampled.selection_method, 'seeded_distribution');
  assert.ok(sampled.probability > 0);
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
  assert.match(tutorStubResponseConfigurationPrompt(configuration), /Actorial part: evidence examiner/u);
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
    text: "Let's stand beside the crucible together and take the silver coin. Which mint mark should you test next?",
    configuration: warm,
    world,
  });
  const summary = summarizeTutorStubResponseConfigurationAudits([plainAudit, warmAudit]);

  assert.equal(plainAudit.axes.action_family.visible, true);
  assert.equal(plainAudit.axes.lexical_accessibility.visible, true);
  assert.equal(warmAudit.axes.engagement_stance.visible, true);
  assert.equal(warmAudit.axes.actorial_part.selected, 'scene_partner');
  assert.equal(warmAudit.axes.actorial_part.performance_tactic, 'shared_scene_invitation');
  assert.equal(warmAudit.axes.actorial_part.performance_visible, true);
  assert.equal(warmAudit.axes.actorial_part.visible, true);
  assert.equal(warmAudit.axis_count, 6);
  assert.equal(summary.distinct_configuration_count, 2);
  assert.equal(summary.different_configuration_pairs, 1);
  assert.equal(summary.pairwise_visible_difference_rate, 1);
});

test('surface audit rejects a named character when the selected stance tactic does not permeate the performance', () => {
  const configuration = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'Move it along.',
    classification: classification({ requestType: 'resistance_or_low_agency' }),
    tutorLearnerDag: learnerDag(),
    dueEvidence: [
      {
        surface: 'Visitor code WF-11 was issued to an outside crew.',
        presentation: { mode: 'enacted_role', role: 'front-desk clerk reading the visitor badge log' },
      },
    ],
    world: testWorld(),
  });
  const flat = auditTutorStubResponseConfiguration({
    text: 'Front-desk clerk, reading the badge log: “Visitor code WF-11 was issued to an outside crew.” What does that change?',
    configuration,
    world: testWorld(),
  });
  const realized = auditTutorStubResponseConfiguration({
    text: '“I am striking my badge log open at the line that challenges the easy verdict: visitor code WF-11 was issued to an outside crew.” Does that break the obvious story, or not?',
    configuration,
    world: testWorld(),
  });

  assert.equal(flat.axes.actorial_part.part_visible, false);
  assert.equal(flat.axes.actorial_part.performance_visible, false);
  assert.equal(flat.axes.actorial_part.visible, false);
  assert.equal(flat.actorial_realization.ok, false);
  assert.deepEqual(flat.actorial_realization.issues.map((issue) => issue.type), [
    'missing_selected_actorial_part',
    'missing_selected_performance_tactic',
  ]);
  assert.equal(realized.axes.actorial_part.performance_visible, true);
  assert.equal(realized.axes.actorial_part.visible, true);
  assert.equal(realized.actorial_realization.ok, true);
  assert.notEqual(flat.visible_signature, realized.visible_signature);
});

test('deterministic clue fallback preserves every selected stance as a visible character tactic', () => {
  const dueEvidence = [
    {
      surface: 'Visitor code WF-11 was issued to an outside crew.',
      via: 'director',
      presentation: { mode: 'enacted_role', role: 'front-desk clerk reading the visitor badge log' },
    },
  ];
  const frame = buildTutorStubDramaticReleaseFrame({ dueEvidence });
  const stances = ['plain', 'precise', 'brisk', 'warm', 'witnessing', 'charismatic', 'ironic', 'sarcastic', 'face_threat'];

  for (const engagementStance of stances) {
    const configuration = buildTutorStubResponseConfiguration({
      engagementStance,
      learnerText: 'What does the log add?',
      classification: classification(),
      tutorLearnerDag: learnerDag(),
      dueEvidence,
      world: testWorld(),
    });
    const text = deterministicTutorStubDramaticReleaseFallback({
      frame,
      responseConfiguration: configuration,
      variationKey: `all-stances:${engagementStance}`,
    });
    const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

    assert.equal(configuration.actorial_part, 'authored_source');
    assert.equal(
      audit.axes.actorial_part.performance_visible,
      true,
      `${engagementStance} should visibly realize ${configuration.actorial_performance.id}: ${text}`,
    );
    assert.equal(audit.axes.actorial_part.part_visible, true, `${engagementStance} should keep the authored role visible`);
    assert.doesNotMatch(text, /front-desk clerk[^.!?]{0,140}(?::|—)/iu);
    assert.doesNotMatch(text, /role-play|I(?:'|’)ll be|another piece of information|Back to us/iu);
  }
});

test('actorial tactic is measured on development rather than a longer learner-responsive uptake', () => {
  const dueEvidence = [
    {
      surface: 'Visitor code WF-11 was issued to an outside crew.',
      via: 'director',
      presentation: { mode: 'enacted_role', role: 'front-desk clerk reading the visitor badge log' },
    },
  ];
  const configuration = buildTutorStubResponseConfiguration({
    engagementStance: 'plain',
    learnerText: 'I think the badge shows access but not who handled the lunchbox.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    dueEvidence,
    world: testWorld(),
  });
  const uptake =
    'Yes—the badge gives us a reason to examine access, while your qualification correctly keeps possession and actual handling unresolved until the public evidence supplies a stronger link.';
  const development =
    '“I opened my badge log at the noon line: WF-11 went to the outside crew.” What does that show?';
  const audit = auditTutorStubResponseConfiguration({
    text: `${uptake}\n\n${development}`,
    configuration,
    world: testWorld(),
    composition: { uptake, development },
  });

  assert.equal(audit.actorial_realization.ok, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
});

test('presented-exhibit fallback preserves the selected part and tactic across every stance', () => {
  const dueEvidence = [
    {
      surface: 'The archive names Marin as the founder’s child.',
      via: 'tutor',
      presentation: { mode: 'presented_exhibit' },
    },
  ];
  const frame = buildTutorStubDramaticReleaseFrame({ dueEvidence });
  const stances = ['plain', 'precise', 'brisk', 'warm', 'witnessing', 'charismatic', 'ironic', 'sarcastic', 'face_threat'];

  for (const engagementStance of stances) {
    const configuration = buildTutorStubResponseConfiguration({
      engagementStance,
      learnerText: 'What does the archive add?',
      classification: classification(),
      tutorLearnerDag: learnerDag(),
      dueEvidence,
      world: testWorld(),
    });
    const text = deterministicTutorStubDramaticReleaseFallback({
      frame,
      responseConfiguration: configuration,
      variationKey: `all-exhibit-stances:${engagementStance}`,
    });
    const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

    assert.equal(
      audit.actorial_realization.ok,
      true,
      `${engagementStance} should preserve ${configuration.actorial_part}/${configuration.actorial_performance.id}: ${text}`,
    );
  }
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
