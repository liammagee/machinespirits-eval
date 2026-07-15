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

  assert.equal(dueRelease.id, 'record_keeper');
  assert.equal(dueRelease.label, 'record keeper');
  assert.equal(dueRelease.locked, false);
  assert.equal(dueRelease.selection_method, 'argmax');
  assert.equal(dueRelease.authored_role, 'front-desk clerk reading the visitor badge log');
  assert.equal(dueRelease.evidence_enactment.mode, 'enacted_role');
  assert.equal(overreach.id, 'skeptic');
  assert.equal(memoryRepair.id, 'record_keeper');
  assert.equal(memoryRepair.label, 'keeper of the trial-book');
});

test('public evidence modality switches the host between record keeper and examiner at low temperature', () => {
  const common = {
    engagementStance: 'brisk',
    actionFamily: 'stage_next_step',
    temperature: 0.15,
  };
  const record = selectTutorStubActorialPart({
    ...common,
    dueEvidence: [
      {
        surface: 'The charcoal book records one signed drawing of the crucible.',
        presentation: { mode: 'enacted_role', role: 'leat-keeper reading the charcoal book' },
      },
    ],
  });
  const exhibit = selectTutorStubActorialPart({
    ...common,
    dueEvidence: [
      {
        surface: 'Under the glass, each coin bears the same square notch.',
        presentation: { mode: 'presented_exhibit' },
      },
    ],
  });

  assert.equal(record.id, 'record_keeper');
  assert.equal(exhibit.id, 'examiner');
  assert.match(record.reason, /authored source record/iu);
  assert.match(exhibit.reason, /new public exhibit/iu);
});

test('the selected stance and adaptive host remain distinct from an authored clue source', () => {
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

  assert.equal(brisk.actorial_part, 'record_keeper');
  assert.equal(witnessing.actorial_part, 'record_keeper');
  assert.equal(brisk.evidence_enactment.authored_role, 'front-desk clerk reading the visitor badge log');
  assert.equal(witnessing.evidence_enactment.authored_role, 'front-desk clerk reading the visitor badge log');
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

test('an authored clue source does not length-penalize the adaptive host register', () => {
  const configuration = buildTutorStubResponseConfiguration({
    engagementStance: 'brisk',
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
  });
  const text =
    'I open the badge log and move straight to its live line. “I issued visitor code WF-11 to the outside crew in a very long fixed source sentence whose authored cadence should not redefine the adaptive host’s audience or lexical register.” What does that add?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.engagement_stance.visible, true);
  assert.equal(audit.axes.audience_register.visible, true);
  assert.equal(audit.axes.lexical_accessibility.visible, true);
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

test('a crowd’s easy cry missing its mark realizes dramatic counterpressure', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'I hold back Verrell’s name.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'I lift the cupel against the hall’s eager murmur: these shillings were struck anew. The crowd’s easy cry against a clipper has missed its mark.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('refusing the hall’s verdict and silencing accusatory mutters realize dramatic counterpressure', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'Verrell remains a suspicion, not a verdict.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };

  for (const text of [
    'I tap the mint-yard crucible. The hall wants that to be a verdict; it is not. What would tie these shillings to it?',
    'I set a shilling in the cupel, silencing the mutters of Verrell’s name. What does the metal actually show?',
    'I scrape the grey lead-sweat from the touchstone and turn the cupel toward the warden. “The town cries clipping, yet clipping makes no new coin.” What follows?',
    'I set the cupel down hard beside the balance, refusing the hall its easy verdict. What does this coin actually prove?',
  ]) {
    const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });
    assert.equal(audit.axes.actorial_part.part_visible, true);
    assert.equal(audit.axes.actorial_part.performance_visible, true);
    assert.equal(audit.actorial_realization.ok, true);
  }
});

test('proves one fact but names neither source nor hand realizes an evidentiary boundary', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'These are newly struck shillings.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'I hold the cupel beside the shilling: it proves a debased blank was struck, but it names neither crucible nor hand.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('a presented exhibit keeps the tutor’s direct challenge in the host performance', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    learnerText: 'The alloy must match before Verrell can be linked.',
    dueEvidence: [
      {
        surface: 'The assay shows poor dross rather than clipped sterling.',
        presentation: { mode: 'presented_exhibit', role: 'examiner' },
      },
    ],
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_part_selection: { ...base.actorial_part_selection, authored_role: null },
    evidence_enactment: { active: true, mode: 'presented_exhibit', authored_role: null },
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'That limit stands: the alloy must match. I scrape the touchstone across a shilling and hold up the grey streak. “Hear that, hall? These are not clipped sterling; these were struck.” What comparison now decides whether Verrell’s crucible touches them?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.axes.actorial_part.evaluated_segment, 'whole_response');
  assert.equal(audit.actorial_realization.ok, true);
});

test('an advocate can confront the room’s judgment directly without announcing an argument', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    classification: classification({ requestType: 'authority_refusal_or_status_challenge', conceptual: 4 }),
    tutorLearnerDag: learnerDag(),
    learnerText: 'Then no verdict can be entered yet.',
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'I tip the shilling into the glowing cupel and face the murmuring hall: “See this grey lead-sweat and copper in the silver. Clipping only shaves true coin; this poor dross was struck anew.” What does that make unsafe in the town’s ready charge?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('an advocate can force the town to face an evidentiary gap', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    learnerText: 'The assay rules out clipping.',
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'That limit stands. I press the false shilling beside Verrell’s graver and make the town face the gap: fresh dross proves a striker, not Verrell’s hand. Which comparison binds this coin to one crucible?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('a plain advocate can answer accountably around a longer authored source quotation', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'plain',
    classification: classification({ requestType: 'authority_refusal_or_status_challenge', conceptual: 1 }),
    tutorLearnerDag: learnerDag(),
    learnerText: 'Would you have the shillings examined publicly, you?',
    dueEvidence: [
      {
        surface: 'Verrell alone draws the mint-yard crucible.',
        presentation: { mode: 'enacted_role', role: 'town assayer' },
      },
    ],
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: { id: 'unadorned_report', label: 'unadorned report' },
    actorial_part_selection: { ...base.actorial_part_selection, authored_role: 'town assayer' },
    evidence_enactment: { active: true, mode: 'enacted_role', authored_role: 'town assayer' },
  };
  const uptake = 'I would, but I will not call it proof before the metal speaks.';
  const development =
    'The town assayer taps the mint-yard seal: “Verrell alone draws the crucible, licensed to no one else; whatever metal is cast in Marrick is cast by Verrell’s hand.” What does that tell us about Verrell—and what does it still not tell us about these shillings?';
  const audit = auditTutorStubResponseConfiguration({
    text: `${uptake} ${development}`,
    configuration,
    world: testWorld(),
    composition: { uptake, development },
  });

  assert.equal(audit.axes.action_family.visible, true);
  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('a conditional requirement visibly stages the next step without a question', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    learnerText: 'The account points toward Verrell.',
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const uptake = 'Right: the account points toward Verrell.';
  const development =
    'I turn the shilling beneath the balance. It points to him only if this false coin’s blank is shown to have come from that crucible.';
  const audit = auditTutorStubResponseConfiguration({
    text: `${uptake} ${development}`,
    configuration,
    world: testWorld(),
    composition: { uptake, development },
  });

  assert.equal(audit.axes.action_family.visible, true);
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
  assert.match(tutorStubResponseConfigurationPrompt(configuration), /Actorial host part: evidence examiner/u);
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
    text: 'I slap the badge log open against the room’s easy verdict. “I issued visitor code WF-11 to the outside crew.” Does that break the obvious story, or not?',
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

test('surface audit recognizes natural skeptical, record-keeping, and advocacy actions', () => {
  const base = {
    action_family: 'stage_next_step',
    audience_register: 'domain_apprentice',
    lexical_accessibility: 'standard',
    scene_immersion: 'immersive',
    unresolved_terms: [],
  };
  const cases = [
    {
      configuration: {
        ...base,
        engagement_stance: 'warm',
        actorial_part: 'skeptic',
        actorial_part_label: 'skeptical examiner',
        actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
      },
      text: 'I stop you at the stone lead: we cannot carry Bray’s name there. Stand here by the font-house with me; what does the wormwood change?',
    },
    {
      configuration: {
        ...base,
        engagement_stance: 'warm',
        actorial_part: 'record_keeper',
        actorial_part_label: 'keeper of the mod log',
        actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
      },
      text: 'I keep the audit open between us beside the locked-thread notice and enter that limit in the mod log. What do you make of it?',
    },
    {
      configuration: {
        ...base,
        engagement_stance: 'charismatic',
        actorial_part: 'advocate',
        actorial_part_label: 'advocate for the live case',
        actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
      },
      text: 'I argue the hall trial against the room’s easy verdict: the three apprentices fail differently. Will that claim survive the test?',
    },
  ];

  for (const row of cases) {
    const audit = auditTutorStubResponseConfiguration({
      text: row.text,
      configuration: row.configuration,
      world: testWorld(),
    });
    assert.equal(audit.axes.actorial_part.part_visible, true, row.text);
    assert.equal(audit.axes.actorial_part.performance_visible, true, row.text);
  }
});

test('surface audit recognizes ordinary skeptical objections and shared standing', () => {
  for (const text of [
    'Not so—the pen chart says the lamps dim before the chargers start.',
    'I cannot accept it as the brownout cause yet; the feeder connection is still missing.',
    'My only objection was whether that spur carried the street; the switch log answers it.',
  ]) {
    const audit = auditTutorStubResponseConfiguration({
      text,
      configuration: {
        engagement_stance: 'precise',
        action_family: 'answer_accountably',
        audience_register: 'informed_peer',
        lexical_accessibility: 'technical',
        scene_immersion: 'immersive',
        actorial_part: 'skeptic',
        actorial_part_label: 'skeptical examiner',
        actorial_performance: { id: 'evidentiary_boundary' },
      },
      world: { setting: 'The switch log and pen chart are open in the meeting room.' },
    });
    assert.equal(audit.actorial_realization.issues.some((issue) => issue.type === 'missing_selected_actorial_part'), false, text);
  }

  const shared = auditTutorStubResponseConfiguration({
    text:
      'I stand beside you at the fridge door, leaving space at the ledger. What does the job number establish?',
    configuration: {
      engagement_stance: 'warm',
      action_family: 'stage_next_step',
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'standard',
      scene_immersion: 'immersive',
      actorial_part: 'scene_partner',
      actorial_part_label: 'fellow investigator',
      actorial_performance: { id: 'shared_scene_invitation' },
    },
    world: { setting: 'The fridge door and lost-property ledger are open.' },
  });
  assert.equal(shared.actorial_realization.ok, true);
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

    assert.notEqual(configuration.actorial_part, 'authored_source');
    assert.equal(configuration.evidence_enactment.mode, 'enacted_role');
    assert.equal(
      audit.axes.actorial_part.performance_visible,
      true,
      `${engagementStance} should visibly realize ${configuration.actorial_performance.id}: ${text}`,
    );
    assert.equal(audit.axes.actorial_part.part_visible, true, `${engagementStance} should keep the adaptive host visible`);
    assert.doesNotMatch(text, /front-desk clerk[^.!?]{0,140}(?::|—)/iu);
    assert.doesNotMatch(text, /role-play|I(?:'|’)ll be|another piece of information|Back to us/iu);
  }
});

test('actorial tactic is measured across the continuous response rather than a heuristic span', () => {
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
    'I open the badge log and mark its noon line; “I opened my badge log at noon: WF-11 went to the outside crew.” What does that show?';
  const audit = auditTutorStubResponseConfiguration({
    text: `${uptake}\n\n${development}`,
    configuration,
    world: testWorld(),
    composition: { uptake, development },
  });

  assert.equal(audit.actorial_realization.ok, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.axes.actorial_part.evaluated_segment, 'adaptive_host_without_authored_source');
});

test('a concise Marrick trial-book entry visibly realizes precise record keeping and stages the next step', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'We must match the false shillings’ metal to metal proved from Verrell’s crucible.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    engagement_stance: 'precise',
    action_family: 'stage_next_step',
    actorial_part: 'record_keeper',
    actorial_part_label: 'keeper of the trial-book',
    actorial_performance: {
      id: 'evidentiary_boundary',
      label: 'evidentiary boundary',
    },
  };
  const text =
    'I enter that beneath the coin’s bent rim: the needed mark is a matching alloy, not merely Verrell’s access to the crucible. Until the assay ties these shillings’ metal to its leavings, his hand remains unproved.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.realization_rate, 1);
  assert.equal(audit.axes.engagement_stance.visible, true);
  assert.equal(audit.axes.action_family.visible, true);
  assert.equal(audit.axes.actorial_part.visible, true);
});

test('keeping a learner restraint in the record visibly realizes the trial-book keeper', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'brisk',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    learnerText: 'No hand can yet be named.',
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'record_keeper',
    actorial_part_label: 'keeper of the trial-book',
  };
  const audit = auditTutorStubResponseConfiguration({
    text: 'I’ll keep that restraint in the record and ask the next clue to earn more.',
    configuration,
    world: testWorld(),
  });

  assert.equal(audit.axes.actorial_part.part_visible, true);
});

test('an explicit support-versus-unshown contrast realizes an evidentiary boundary', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'What is public in the hall?',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    engagement_stance: 'precise',
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'I lay the mint-yard register beside the balance. What does this support about who cast Marrick’s metal, and what remains unshown about the false shillings?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.axes.actorial_part.visible, true);
});

test('a what-is-known versus what-must-still-show contrast realizes an evidentiary boundary', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'I would examine the shilling before naming Verrell.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    engagement_stance: 'precise',
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'I set a light shilling by the touchstone. What does that tell us about Verrell, and what must the shilling itself still show?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.axes.actorial_part.visible, true);
});

test('a must-be-matched-before-conclusion contrast realizes an evidentiary boundary', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'False striking is shown, but no hand is named.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    engagement_stance: 'precise',
    actorial_part: 'record_keeper',
    actorial_part_label: 'keeper of the trial-book',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'I mark that distinction in the trial-book. It clears the clipping charge, but names no maker. The mix must next be matched to a crucible before this coin can be tied to a cast blank.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.axes.actorial_part.visible, true);
});

test('a before-the-alloy-is-tested question realizes an evidentiary boundary', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'We should test the alloy before naming anyone.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'I set the balance beside the shilling. What does Verrell’s licence tell us now, before the alloy has been tested?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('leaving a trial-book line unentered and inviting the learner realizes warm record keeping', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'I will wait for the die-flaw before entering the link.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    engagement_stance: 'warm',
    action_family: 'reanchor_public_evidence',
    actorial_part: 'record_keeper',
    actorial_part_label: 'keeper of the trial-book',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'I leave that line unentered and close the trial-book over it. The graver is only a bench tool until the shilling itself bears its particular flaw. Take the moment—what part of the die’s mark would you want made clear when we examine it?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.axes.actorial_part.visible, true);
});

test('a rhetorical not-yet question and neither-nor contrast realize an evidentiary boundary', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'The cupel shows the metal, but not which hand cast or struck the coin.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    engagement_stance: 'precise',
    action_family: 'stage_next_step',
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const candidates = [
    'I hold the grey-stained shilling to the light. The graver bears on who could have cut a die, but does it yet show that this shilling bears a die made by that graver?',
    'I turn the light shilling beneath the lamp. The graver speaks to who could cut a die, but neither the cupel nor this graver yet ties this shilling to one.',
  ];

  for (const text of candidates) {
    const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });
    assert.equal(audit.axes.actorial_part.performance_visible, true, text);
    assert.equal(audit.actorial_realization.ok, true, text);
  }
});

test('drawing a source book beside the trial-book realizes the record keeper', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'A ledger entry could tie the crucible to a person.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'record_keeper',
    actorial_part_label: 'keeper of the trial-book',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'I draw the charcoal book beside the trial-book and make room at the bench. “I have kept this book exact.” What does that change?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.axes.actorial_part.visible, true);
});

test('pressing a source book flat beside the shillings realizes the record keeper', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'The cold crucible still needs a custodian.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'record_keeper',
    actorial_part_label: 'keeper of the trial-book',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'I press the charcoal book flat beside the shillings, and the benches fall quiet. The town’s ready verdict now buckles—what does this say about who cast these blanks?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
});

test('leaving the learner room beside an exhibit realizes the fellow investigator', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'False striking is shown, but no hand is named.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'scene_partner',
    actorial_part_label: 'fellow investigator',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text = 'I shift along the bench, leaving you room beside the broad graver. What does its clean cut show?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.visible, true);
});

test('metal outweighing the ready-made reputation realizes dramatic counterpressure', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'I will look for a source mark on the shilling.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'I turn the shilling beneath the lamp. Verrell’s ready-made reputation cannot outweigh metal that points elsewhere. What does this lead-sweat show?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.axes.actorial_part.visible, true);
});

test('pressing a Marrick shilling to the touchstone is visible examiner action', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'The alloy must match Verrell’s crucible casting.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'I press the light shilling to the touchstone beside the true one. Just so: only a matching alloy could tie its blank to that crucible. Until the assay shows that match, Verrell’s access establishes nothing about these coins.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.engagement_stance.visible, true);
  assert.equal(audit.axes.actorial_part.visible, true);
});

test('lifting the selected Marrick graver is visible examiner action', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'brisk',
    learnerText: 'The alloy still lacks its crucible.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'rapid_handoff', label: 'rapid handoff' },
  };
  const text =
    'I lift the broad graver from Verrell’s bench. “I swear this graver is Verrell’s alone.” What does that add?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.visible, true);
});

test('inviting the learner to inspect an exhibit with the tutor realizes the examiner', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The blank is tied to Edony, not yet the striking.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text = 'Make room beside the lamp and inspect the struck face with me. What mark remains to be found?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.axes.actorial_part.visible, true);
});

test('drawing a shilling across the touchstone is visible examiner action', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'The touchstone must still tie the shilling to the crucible.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'Just so. I draw one light shilling across the touchstone; its streak has not yet been matched to any crucible leavings. Until that match, what does Verrell’s licence prove?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.engagement_stance.visible, true);
  assert.equal(audit.axes.actorial_part.visible, true);
});

test('handling a concrete exhibit along a physical path is visible examiner action', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'The alloy must match Verrell’s crucible casting.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'I run the touch-needle along a light shilling’s edge. An alloy match would bind its blank to Verrell’s crucible; his sole custody would then matter. Until the metal answers, his name is only the town’s suspicion.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.engagement_stance.visible, true);
  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('keeping two exhibits physically apart is visible examiner action', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'The crucible does not yet identify the striking hand.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'I keep the crucible apart from the balance. The hall wants Verrell’s old crime to settle this, but the poor dross shows these shillings were newly struck. What does that rule out?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('drawing the learner beside an exhibit realizes the fellow investigator', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The alloy still needs a crucible match.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'scene_partner',
    actorial_part_label: 'fellow investigator',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'I draw you beside Verrell’s bench as the guild officer lays a hand on the broad graver. “I swear this graver is Verrell’s alone.” What does that support?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('the town threatening judgment from a bare tool realizes dramatic counterpressure', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'The graver is possible access, not proof of striking.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'I lower the graver and turn the shilling beside it: the town would hang a man from a tool on a bench. Yet this coin shows no matching die-flaw.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('staging an exhibit against the accused name realizes the advocate', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'New striking rules out the old clipping accusation.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'I press the coin beside Verrell’s name in the trial-book: the town wants that shame to finish the matter, but it cannot. This alloy must answer to one crucible before we lay the blank to any hand.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('a fallback that offers its case for testing realizes the advocate', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'New striking rules out the old clipping accusation.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'I lay the coin against the town’s case; your limit is where it fails. The room’s easy verdict breaks at that limit.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('leaving the accused name unentered realizes the trial-book keeper', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'plain',
    learnerText: 'The alloy is not yet tied to Verrell’s crucible.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'record_keeper',
    actorial_part_label: 'keeper of the trial-book',
    actorial_performance: { id: 'unadorned_report', label: 'unadorned report' },
  };
  const text =
    'I leave Verrell’s name unentered beside the balance. Until the alloy answers to his crucible, the town’s claim proves nothing about this blank.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('clearing exhibit space for the learner realizes the fellow investigator', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The cupel has spoken of the metal, not its vessel.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'scene_partner',
    actorial_part_label: 'fellow investigator',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'I shift beside Verrell’s bench and clear space for you at the broad graver. “I can swear this graver is Verrell’s alone.” What does it establish?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('clearing a space beside exhibits realizes the fellow investigator', () => {
  const audit = auditTutorStubResponseConfiguration({
    text:
      'I slide the two drafts across the light table and clear a space beside them for you. The archived draft has no kicker or commissioner quote.',
    configuration: {
      engagement_stance: 'warm',
      action_family: 'stage_next_step',
      audience_register: 'adult_novice',
      lexical_accessibility: 'plain',
      scene_immersion: 'immersive',
      actorial_part: 'scene_partner',
      actorial_part_label: 'fellow investigator',
      actorial_performance: { id: 'shared_scene_invitation' },
    },
    world: {
      setting: 'The Gazette light table holds Crane’s draft and the depot copy.',
      question: 'Who planted the fabricated quote?',
    },
  });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
});

test('leaving room at the bench for the learner realizes the fellow investigator', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The alloy must still be matched to one crucible.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'scene_partner',
    actorial_part_label: 'fellow investigator',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'I shift the cupel beside the touchstone and leave room at the bench for you. What would a match tell us?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('leaving exhibit space for the learner quill realizes the fellow investigator', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'Access to the crucible does not prove these shillings came from it.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'scene_partner',
    actorial_part_label: 'fellow investigator',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'I draw the balance nearer and leave space beside the crucible for your quill. Which distinction should we enter?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('inviting the learner beside an exhibit realizes the fellow investigator', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The graver has not yet been tied to this shilling.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'scene_partner',
    actorial_part_label: 'fellow investigator',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text = 'Come beside the touchstone with me; what does this lead-sweat establish?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('making room at the balance beside me realizes the fellow investigator', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'That blank is not yet tied to this crucible.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'scene_partner',
    actorial_part_label: 'fellow investigator',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared scene invitation' },
  };
  const text =
    'I touch the cold crucible’s rim. Make room at the balance beside me: the false shillings have not yet been tied to this crucible.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('making room at the bench and looking together realizes the fellow investigator', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The graver has not yet marked this coin.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'scene_partner',
    actorial_part_label: 'fellow investigator',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'I keep the shilling beneath the lamp beside Verrell’s broad graver. Make room at the bench and look with me: the coin must bear a matching flaw.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('refusing to press the town case further realizes accountable advocacy', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'brisk',
    learnerText: 'The graver has no matching die-mark yet.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: { id: 'rapid_handoff', label: 'rapid evidence handoff' },
  };
  const text =
    'I would press the town’s case no further than that: find the die’s flaw, then show it is the unique scar of Verrell’s graver. Until then, the graver is only a bench-tool.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('pressing the town claim against contrary evidence realizes advocacy', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'The licence ties Verrell to a crucible, not these coins.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'I press the town’s claim: if these shillings came from that crucible, Verrell cast their blanks. But the tray has not yet spoken of its metal; let the coins challenge the crowd’s verdict.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('an alone-names-no-evidence sentence realizes a precise boundary', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'Shall I assay the silver content?',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'I set the touch-needle against the shilling. Your assay may show whether its metal matches a crucible; this claim alone names no coin’s metal.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('a shared-scene correction visibly realizes the skeptical host', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The shillings were made light in casting.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'skeptic',
    actorial_part_label: 'skeptical examiner',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'That is possible, but the public evidence does not settle it yet. I slide the cupel and shilling between us. Poor alloy has not yet shown where the blank was melted. What mark would tie it to one crucible?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.visible, true);
});

test('holding a learner entry against the town cry realizes counterpressured advocacy', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'The graver shows opportunity, not a die-mark on this shilling.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    engagement_stance: 'charismatic',
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'I hold your entry against the town’s cry: Verrell’s graver cannot condemn this shilling without its own die-mark. The town’s easy case now buckles: what does the lead-sweat say about its blank?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('resting a case on an exhibit and offering its limit for testing realizes advocacy', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'The graver still does not mark this coin.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    engagement_stance: 'charismatic',
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'I rest my case on the crucible; test its limit against the room’s easy verdict. Will that line survive the case we were ready to make?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('putting a falsifiable lab case to the PI realizes the advocate', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'Devlin’s flasks were there too.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'I set Devlin’s shelf note beside the Larkin booking sheet: we have no record placing Devlin’s flasks in Larkin overnight. I would put the case to the PI this way: Corvat spent the night in the breached G17 chamber, and the ruined-flask swab is G17. If you can point to a public record that contradicts that, bring it forward.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('physically separating exhibits while withholding an unproved link realizes the skeptic', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The swab proves Devlin’s shelf carried G17.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'skeptic',
    actorial_part_label: 'skeptical examiner',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'The G17 swab does not yet place that mould on Devlin’s shelf. I pull a stool beside the retired unit and tap the seal: unless we can show a breach and overnight exposure, that link remains unproven. Which part of that link needs clarifying?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('steadying the assay weights keeps a concise plain release visibly unadorned', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'plain',
    learnerText: 'May I compare the coins first?',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'unadorned_report', label: 'unadorned report' },
  };
  const text =
    'Aye—set the fair coin beside the light shilling; the balance and touchstone may show a difference, though they do not yet name the striker. I steady the weights as a voice cuts across the guild-hall: “Verrell alone draws the mint-yard crucible, licensed to no one else.” What does that tell us about the hand that could have cast a blank, and what does it still leave unknown?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('holding back the verdict while separating casting from striking realizes skepticism', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'Then Verrell cast it, if the metal came from his crucible.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'skeptic',
    actorial_part_label: 'skeptical examiner',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'Aye—if the metal proves to be Marrick-cast, the blanks point to Verrell’s casting hand. I draw the balance nearer between us and hold back the verdict: casting a blank is not yet striking a coin. What further mark would we need?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('tipping a public shilling from the cupel visibly realizes the examiner', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'plain',
    learnerText: 'Leave the claim open until the metal is tested.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'unadorned_report', label: 'unadorned report' },
  };
  const text =
    'Good. I tip a shilling from the cupel: it is not clipped sterling, but newly struck poor dross—silver thinned with copper and grey lead-sweat. What does that rule out?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('an easy verdict outrunning its marks realizes dramatic counterpressure', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'The coin needs a distinctive die-flaw tied to the graver.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'Yes—the die must bear a distinctive flaw tied to Verrell’s graver. I turn the shilling beneath the lamp and set the touch-needle aside: the town’s easy verdict has outrun its marks. What does the metal trail rule out?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('yet not by itself states a visible evidentiary boundary', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'A peculiar alloy match would bind the blanks to the crucible.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'Just so: a peculiar alloy match would bind these blanks to the mint-yard crucible, yet not by itself to the striking hand. I scrape the touchstone and turn a shilling in the cupel.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('asking which evidentiary link is still absent realizes a boundary', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'The cupel establishes the alloy, but the source crucible is still unknown.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'I lift the cupel for the hall to see. What does this settle, and what link to the crucible is still absent?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('tapping two lab records together while testing their limit realizes skepticism', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'brisk',
    learnerText: 'The cracked gasket itself is proved to have carried G17 into Corvat.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'skeptic',
    actorial_part_label: 'skeptical examiner',
    actorial_performance: { id: 'rapid_handoff', label: 'rapid evidence handoff' },
  };
  const text =
    'I tap the sequencing report against the overnight booking sheet: the match identifies the strain, but the gasket and overnight placement establish the exposure. Together, do they license the finding that Larkin ruined the Corvat line?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('stating a supported lab finding while exposing its remaining limit realizes advocacy', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The report traced G17 through the gasket itself.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'I set the sequencing report beside the cracked gasket: it matches G17 in the flasks to G17 in Larkin, not to one observed leak through the gasket. Still, Larkin ruined the line: it held G17 with a breached seal, Corvat sat there overnight, and the flasks carried that exact strain. Does that distinction fit what you carry forward?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('a placement likelihood question realizes a rapid examiner handoff', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'brisk',
    learnerText: 'We need to know whether Corvat was actually inside Larkin.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'rapid_handoff', label: 'rapid evidence handoff' },
  };
  const text =
    'That is the missing link. I compare the overnight placement sheet against the incubator bookings; the margin note puts Corvat in Larkin overnight. What does that placement make likely about Corvat’s contact with G17?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('establishes a breach not a witnessed release realizes an evidentiary boundary', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'The cracked gasket released G17 into Corvat.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'skeptic',
    actorial_part_label: 'skeptical examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'I hold the cracked gasket against the quarantine file: it establishes a breached Larkin chamber, not a witnessed release through the gasket. Does that license the narrower finding?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('making a supported causal case for testing realizes advocacy', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The gasket itself carried G17 into Corvat.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'I keep the Larkin file beside the sequencing report: its resident G17, breached seal, and Corvat’s overnight stay make the case that Larkin ruined the line. Does that leave any basis for blaming Devlin personally?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('a first-person refusal to overweigh an exhibit visibly realizes the skeptical host', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'Then clipping explains the light shillings.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'skeptic',
    actorial_part_label: 'skeptical examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'I tap the balance-beam flat. I will not let the cupel bear more weight than it has earned: it shows debased, struck shillings, but not whose crucible supplied their metal. The alloy must answer to one crucible alone before it can point toward any hand.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('a concrete record comparison and explicit refusal visibly realize the skeptical host', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The cracked gasket supplied G17 to Corvat.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'skeptic',
    actorial_part_label: 'skeptical examiner',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };

  for (const text of [
    'I check the swab record against the shelf notes: G17 was identified in the incubator, not in Devlin’s flasks. Which part of that gap needs clarifying?',
    'I slide the quarantine record beside you on the bench: the incubator is suspicious, but the shelf does not carry its strain. Which part do you want to pin down?',
    'I slide aside and leave room beside the cracked gasket and report. I would not say the gasket supplied G17; it was the breach. Does that distinction fit?',
  ]) {
    const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });
    assert.equal(audit.axes.actorial_part.part_visible, true, text);
  }
});

test('Greyfen record correction, notebook work, and live advocacy realize their selected parts', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The gasket proves Larkin ruined Corvat.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const cases = [
    {
      part: 'skeptic',
      label: 'skeptical examiner',
      tactic: 'evidentiary_boundary',
      text: 'I tap the cracked gasket. I draw a line beneath “capable”: the split seal shows an active source, not that Corvat encountered it.',
    },
    {
      part: 'record_keeper',
      label: 'keeper of the lab notebook',
      tactic: 'evidentiary_boundary',
      text: 'I open the sequencing report over the notebook and mark its result: the Corvat flasks contain G17, but the route remains unshown.',
    },
    {
      part: 'advocate',
      label: 'advocate for the live case',
      tactic: 'shared_scene_invitation',
      text: 'I make the case that Larkin ruined Corvat because G17 was resident there. I slide the report and gasket between us, leaving room at the bench for you. Does anything remain in doubt?',
    },
  ];

  for (const row of cases) {
    const configuration = {
      ...base,
      actorial_part: row.part,
      actorial_part_label: row.label,
      actorial_performance: { id: row.tactic, label: row.tactic.replaceAll('_', ' ') },
    };
    const audit = auditTutorStubResponseConfiguration({ text: row.text, configuration, world: testWorld() });
    assert.equal(audit.axes.actorial_part.part_visible, true, row.text);
    assert.equal(audit.axes.actorial_part.performance_visible, true, row.text);
  }
});

test('Greyfen proof-complete objections and a falsifiable case realize skeptic and advocate parts', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The strain match proves the gasket itself supplied G17.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag({ bottleneck: 'assertion_gap', coverage: 1 }),
    world: testWorld(),
  });
  const cases = [
    {
      part: 'skeptic',
      tactic: 'shared_scene_invitation',
      text: 'I pull the notebook toward you and leave a clear space beside the report. One objection remains: are we blaming Larkin merely because it was nearby, or because the records make it the contaminating chamber?',
    },
    {
      part: 'skeptic',
      tactic: 'shared_scene_invitation',
      text: 'I clear a space beside the records for you, then press the objection: neither record watched G17 cross the gasket. Would you state the finding, or is one link still troubling you?',
    },
    {
      part: 'advocate',
      tactic: 'shared_scene_invitation',
      text: 'I make room at the bench beside the booking sheet. Taken together, the records show Larkin ruined Corvat—unless you can point to evidence that breaks one of those links.',
    },
  ];

  for (const row of cases) {
    const configuration = {
      ...base,
      actorial_part: row.part,
      actorial_part_label: row.part === 'advocate' ? 'advocate for the live case' : 'skeptical examiner',
      actorial_performance: { id: row.tactic, label: 'shared-scene invitation' },
    };
    const audit = auditTutorStubResponseConfiguration({ text: row.text, configuration, world: testWorld() });
    assert.equal(audit.axes.actorial_part.part_visible, true, row.text);
    assert.equal(audit.axes.actorial_part.performance_visible, true, row.text);
  }
});

test('Greyfen boundary stops, explicit corrections, objections, and notebook entries realize their parts', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'The swab already proves Larkin ruined Corvat.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag({ coverage: 0.8 }),
    world: testWorld(),
  });
  const cases = [
    {
      part: 'skeptic',
      tactic: 'evidentiary_boundary',
      text: 'I run a finger along the incubator’s seal and stop there: G17 inside makes this unit suspect, but not yet the exposure source.',
    },
    {
      part: 'skeptic',
      tactic: 'shared_scene_invitation',
      text: 'Not yet—the overnight placement had not been in the record. I make room beside the incubator log and slide it between us. Does that now show exposure?',
    },
    {
      part: 'skeptic',
      tactic: 'shared_scene_invitation',
      text: 'I slide the sequencing report beside the cracked gasket and make room at the bench. I would still object to calling that direct observation: no one watched the breach.',
    },
    {
      part: 'record_keeper',
      tactic: 'evidentiary_boundary',
      text: 'I mark the overnight exposure in the notebook, but not yet the final verdict: the swab showed G17 inside the chamber.',
    },
  ];

  for (const row of cases) {
    const configuration = {
      ...base,
      actorial_part: row.part,
      actorial_part_label: row.part === 'record_keeper' ? 'keeper of the lab notebook' : 'skeptical examiner',
      actorial_performance: { id: row.tactic, label: row.tactic.replaceAll('_', ' ') },
    };
    const audit = auditTutorStubResponseConfiguration({ text: row.text, configuration, world: testWorld() });
    assert.equal(audit.axes.actorial_part.part_visible, true, row.text);
    assert.equal(audit.axes.actorial_part.performance_visible, true, row.text);
  }
});

test('a first-person possessive objection realizes a skeptical shared-scene host', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'The overnight placement and exact strain match make Larkin the source.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag({ bottleneck: 'assertion_gap', coverage: 1 }),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'skeptic',
    actorial_part_label: 'skeptical examiner',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'I tap the cracked gasket: G17 was resident in the Larkin chamber, not shown in the gasket itself. I shift the sequencing report beside the booking clipboard and leave room at the bench. My objection is narrow: why do the overnight placement and the exact G17 match together make Larkin the source, rather than merely a suspicious coincidence?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('refusing to move a damaged object on one distinction realizes skepticism outside a courtroom', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The G17 swab shows Devlin carried the mould into Corvat.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'skeptic',
    actorial_part_label: 'skeptical examiner',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'The G17 swab places that mould inside the Larkin incubator, not inside Devlin’s flasks. I would not move a ruined culture on that distinction alone—residency is not yet carriage or exposure. What mark or record would you want next to connect the incubator to the Corvat flasks?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
});

test('a shared refusal to enter an unsupported claim realizes the skeptical host', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'Verrell’s old clipping proves nothing about these new coins.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'skeptic',
    actorial_part_label: 'skeptical examiner',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'I tap the trial-book shut on Verrell’s old offence. Just so: the cupel proves new false coin was struck, but it names neither the melt nor the hand. I draw the balance aside and make room for you at the touchstone. Until this dross answers to one crucible’s leavings, what claim about a caster must we refuse to enter?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
});

test('displacing a ready scene story with a concrete record realizes dramatic counterpressure', () => {
  const world = {
    title: 'The Contamination in the Greyfen Lab',
    setting: 'The Corvat flasks sit between Devlin’s shelf log and the Larkin incubator booking sheet.',
    question: 'What ruined the Corvat line?',
    premiseById: new Map(),
  };
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'The return swab already tied G17 to Corvat.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag(),
    world,
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'The return swab tied G17 to the Larkin chamber, not yet to Corvat. I hold up the booking sheet against Devlin’s shelf log: the messy shelf is not tonight’s decisive mark. “I found every booked incubator full. The Corvat flasks were parked in Larkin overnight—the only shelf left before nine.” Given G17 and the broken gasket, what does that overnight stay mean for Corvat?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
});

test('a directly handled concise exhibit remains an unadorned report despite one long sentence', () => {
  const world = {
    title: 'The Contamination in the Greyfen Lab',
    setting: 'Devlin’s shelf holds unmarked flasks beside the Corvat line.',
    question: 'What ruined Corvat?',
    premiseById: new Map(),
  };
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'plain',
    learnerText: 'I saw Devlin’s flasks cloud first.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world,
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'unadorned_report', label: 'unadorned report' },
  };
  const text =
    'I can inspect the shelf and the log, but we cannot treat what you saw as evidence until it is recorded. I lift one flask from Devlin’s shelf and turn it toward the light: no date, no initials; the Corvat flasks sat here all week among identical unmarked glass. What does that make the shelf suggest, and what does it still fail to show?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world });

  assert.equal(audit.axes.actorial_part.performance_visible, true);
});

test('setting the obvious story aside for contrary evidence realizes skeptical counterpressure', () => {
  const world = {
    title: 'The Contamination in the Greyfen Lab',
    setting: 'Devlin’s shelf faces the Larkin incubator across the lab.',
    question: 'What ruined Corvat?',
    premiseById: new Map(),
  };
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'The swab proves Devlin’s shelf carried G17.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag(),
    world,
  });
  const configuration = {
    ...base,
    actorial_part: 'skeptic',
    actorial_part_label: 'skeptical examiner',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'No—the swab was taken from the retired Larkin incubator, not Devlin’s shelf. I set Devlin’s messy flask row aside: it cannot borrow evidence from a different machine. G17 is inside the Larkin unit, but for it to threaten Corvat, what must be true about that incubator besides merely containing the strain?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
});

test('testing verdict wording against an unobserved route realizes the skeptic', () => {
  const world = {
    title: 'The Contamination in the Greyfen Lab',
    setting: 'The gasket, sequencing report, and booking sheet lie on the lab bench.',
    question: 'What ruined Corvat?',
    premiseById: new Map(),
  };
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'G17 escaped through the faulty gasket.',
    classification: classification({ requestType: 'answer_seeking_or_overreach' }),
    tutorLearnerDag: learnerDag({ bottleneck: 'assertion_gap', coverage: 1 }),
    world,
  });
  const configuration = {
    ...base,
    actorial_part: 'skeptic',
    actorial_part_label: 'skeptical examiner',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'I put my finger on the cracked gasket, then the G17 sequencing report. I pull a stool beside the booking sheet for you, but I test the wording: enter Larkin as the source, not “G17 came through the gasket.” Does that distinction keep the record accurate?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
});

test('pressing an exhibit into the town argument realizes an advocate under counterpressure', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'This graver is not yet tied to the shillings.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  for (const text of [
    'Just so. I press the broad graver into the town’s argument: Verrell’s sole hand on it proves nothing about these coins until a die-mark on them answers to that tool. The next decisive mark must be on the shilling itself.',
    'I hold Verrell’s graver before the warden: the town calls it enough, but I refuse that easy verdict. Until a die-flaw on these shillings matches this tool, his graver has touched only suspicion.',
  ]) {
    const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });
    assert.equal(audit.axes.actorial_part.part_visible, true, text);
    assert.equal(audit.axes.actorial_part.performance_visible, true, text);
  }
});

test('a bounded one-question exhibit transfer realizes a rapid handoff', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'brisk',
    learnerText: 'Let us assay a fair shilling against residue from the crucible.',
    classification: classification(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'rapid_handoff', label: 'rapid evidence handoff' },
  };
  const text =
    'A sound assay, and it tests the gap between Verrell’s crucible and these coins. I set a fair shilling on the touchstone and scrape its edge: the cupel shows poor dross, silver thinned with copper and a grey sweat of lead. This is no clipped sterling; clipping shaves a true coin, but these shillings were struck anew. What does that settle about the shillings, and what comparison with the crucible residue still matters?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
});

test('an eighty-one word exhibit transfer remains a rapid handoff', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'brisk',
    learnerText: 'Keep the name open until the metal answers.',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'rapid_handoff', label: 'rapid evidence handoff' },
  };
  const text =
    'Aye, you hold the line rightly: Verrell’s access names no hand until the metal itself points to one crucible. I draw the shilling across the touchstone beside the cupel; its streak shows poor dross, silver thinned with too much copper and a grey sweat of lead. These are not clipped sterling, for clipping shaves a true coin and strikes none anew. What does this tell you about the false shillings themselves, before we can tie their alloy to any crucible?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.metrics.wordCount, 81);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
});

test('a record statement with a choice of clarification realizes a warm record keeper', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'Can we slow down?',
    classification: classification({ requestType: 'stepwise_support_request' }),
  });
  const configuration = {
    ...base,
    actorial_part: 'record_keeper',
    actorial_part_label: 'keeper of the trial book',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'Yes—we can slow down. So far, the record says only that Verrell alone worked the mint-yard crucible. It does not show these shillings came from it or that he struck them. Which word or connection would you like me to unpack?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
});

test('material evidence biting harder than the town tale realizes dramatic counterpressure', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'charismatic',
    learnerText: 'A repeated flaw must answer uniquely to Verrell’s graver.',
    classification: classification(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
  };
  const text =
    'A sound restraint: a flaw must bind these shillings to one graver before it names Verrell. The touchstone bites harder than the town’s tale; I hold the grey lead-sweat beneath the founder’s eye. What does the weir-forge match do to the easy verdict?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
});

test('rubbing a public sample on the touchstone visibly realizes the examiner host', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'A repeated die-flaw would tie these shillings to a graver.',
    classification: classification(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
    actorial_part_selection: {
      ...(base.actorial_part_selection || {}),
      authored_role: "founder's man identifying the lead-sweat",
    },
  };
  const text =
    'A repeated die-flaw would tie these shillings to a graver, but none has yet been shown. I rub the grey lead-sweat from the touchstone as the founder’s man leans over it: “I know that dross; it answers to the weir-forge leavings.” What does that establish about the blank, and what remains unproved about the die?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
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

test('a direct evidence correction visibly answers an overreaching learner', () => {
  const configuration = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The retired tag bears Devlin’s initials, so it names him.',
    classification: classification({ requestType: 'answer_seeking_or_overreach', conceptual: 3 }),
    tutorLearnerDag: learnerDag({ bottleneck: 'premature_assertion' }),
    world: testWorld(),
  });
  const uptake = 'The retired tag identifies the Larkin unit, not Devlin or the person who moved Corvat.';
  const audit = auditTutorStubResponseConfiguration({
    text: `${uptake} I leave the tag beside the report so we can test its limit together.`,
    configuration: { ...configuration, action_family: 'answer_accountably' },
    world: testWorld(),
    composition: {
      uptake,
      development: 'I leave the tag beside the report so we can test its limit together.',
    },
  });

  assert.equal(audit.axes.action_family.visible, true);
  assert.equal(audit.axes.action_family.evaluated_segment, 'uptake');
});

test('a skeptic can hold a physical record at an unsupported attribution across sentences', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The tag names Devlin as the person who moved Corvat.',
    classification: classification({ requestType: 'answer_seeking_or_overreach', conceptual: 3 }),
    tutorLearnerDag: learnerDag({ bottleneck: 'premature_assertion' }),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'skeptic',
    actorial_part_label: 'skeptical examiner',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
  };
  const text =
    'I leave room beside the asset tag and booking sheet. The tag shows Larkin is retired, but no initials are recorded on it; we cannot add Devlin’s name because the loss hurts. Which actual mark identifies who moved Corvat?';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('a skeptic can stop a lab inference at not-proof while holding both records', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'The cracked seal proves Corvat was exposed.',
    classification: classification({ requestType: 'answer_seeking_or_overreach', conceptual: 3 }),
    tutorLearnerDag: learnerDag({ bottleneck: 'premature_assertion' }),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'skeptic',
    actorial_part_label: 'skeptical examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'I hold the cracked gasket beside the G17 swab and stop you there: it makes Larkin an active source, not proof that Corvat was inside it. The booking record must place the flasks there overnight.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('nothing yet beyond a handled crucible is a visible evidentiary boundary', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'Verrell alone used the crucible.',
    classification: classification({ requestType: 'stepwise_support_request', conceptual: 3 }),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text =
    'I run a finger along the crucible’s rim and set the licence beside it: this shows Verrell alone used that vessel. It tells us nothing yet about whether these shillings came from its melt.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('an enacted clue source does not length-penalize its plain adaptive host', () => {
  const dueEvidence = [
    {
      surface:
        'An incubator Facilities decommissioned last spring is back on the floor. Its quarantine record and return swab identify resident Aspergillus G17. Someone retrieved it for overflow.',
      via: 'director',
    },
  ];
  const frame = buildTutorStubDramaticReleaseFrame({ dueEvidence });
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The shelf log proves Devlin contaminated Corvat.',
    classification: classification({ requestType: 'answer_seeking_or_overreach', conceptual: 2 }),
    tutorLearnerDag: learnerDag({ bottleneck: 'premature_assertion' }),
    dueEvidence,
    world: testWorld(),
  });
  const configuration = {
    ...base,
    action_family: 'answer_accountably',
    audience_register: 'adult_novice',
    lexical_accessibility: 'plain',
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_host_part: 'advocate',
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
    actorial_part_selection: { ...base.actorial_part_selection },
    evidence_enactment: { ...base.evidence_enactment },
  };
  const uptake = 'The shelf log shows disorder and proximity, not that Devlin contaminated Corvat.';
  const text = deterministicTutorStubDramaticReleaseFallback({
    frame,
    uptake,
    responseConfiguration: configuration,
    variationKey: 'greyfen-enacted-source-host',
  });
  const audit = auditTutorStubResponseConfiguration({
    text,
    configuration,
    world: testWorld(),
    composition: { uptake, development: text.slice(uptake.length).trim() },
  });

  assert.doesNotMatch(text, /trial-book/iu);
  assert.match(text, /strongest case/iu);
  assert.equal(configuration.evidence_enactment.mode, 'enacted_role');
  assert.ok(configuration.evidence_enactment.authored_role);
  assert.equal(audit.axes.action_family.visible, true);
  assert.equal(audit.axes.audience_register.visible, true);
  assert.equal(audit.axes.lexical_accessibility.visible, true);
  assert.equal(audit.actorial_realization.ok, true);
});

test('directly bounded evidence language visibly clarifies a distinction', () => {
  const configuration = {
    ...buildTutorStubResponseConfiguration({
      engagementStance: 'precise',
      learnerText: 'So Crane planted the quote?',
      classification: classification(),
      tutorLearnerDag: learnerDag(),
      world: testWorld(),
    }),
    action_family: 'clarify_distinction',
  };
  const text = 'The byline establishes responsibility for the reporting, not who inserted the false kicker.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.action_family.visible, true);
});

test('stating what the record still needs visibly stages the next step', () => {
  const configuration = {
    ...buildTutorStubResponseConfiguration({
      engagementStance: 'plain',
      learnerText: 'Can we name the culprit now?',
      classification: classification(),
      tutorLearnerDag: learnerDag(),
      world: testWorld(),
    }),
    action_family: 'stage_next_step',
  };
  const text = 'To name a hand, the record still needs an entry that connects this tool to its user.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.action_family.visible, true);
});

test('opening a version history visibly performs the record-keeper part', () => {
  const base = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'What changed after filing?',
    classification: classification(),
    tutorLearnerDag: learnerDag(),
    world: testWorld(),
  });
  const configuration = {
    ...base,
    actorial_part: 'record_keeper',
    actorial_part_label: 'record keeper',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const text = 'I open the version history: it shows that the kicker was inserted after filing, but it does not name the editor.';
  const audit = auditTutorStubResponseConfiguration({ text, configuration, world: testWorld() });

  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
});
