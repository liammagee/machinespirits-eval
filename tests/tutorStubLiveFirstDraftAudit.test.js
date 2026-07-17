import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA,
  auditTutorStubLiveTurnProgressionV1,
  compileTutorStubTurnProgressionContract,
} from '../services/tutorStubTurnProgressionContract.js';
import { renderTutorStubDueSource } from '../services/tutorStubDueSourceRenderer.js';
import {
  auditTutorStubLiveSourceActionAlignmentV1,
  tutorStubLiveResponseConfigurationSurface,
} from '../services/tutorStubLiveFirstDraftAudit.js';
import { compileTutorStubSourceAccessibilityContract } from '../services/tutorStubSourceAccessibilityContract.js';
import { auditTutorStubResponseConfiguration } from '../services/tutorStubResponseConfiguration.js';
import {
  buildTutorStubDramaticReleaseFrame,
  deterministicTutorStubDramaticReleaseFallback,
} from '../services/tutorStubDramaticRelease.js';
import {
  decideTutorStubGuardDelivery,
  tutorStubGuardIssueRows,
} from '../services/tutorStubGuardDisposition.js';
import { deterministicTutorStubConfiguredContinuationFallback } from '../services/tutorStubResponseComposition.js';

function progressionContract(overrides = {}) {
  return {
    schema: TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA,
    complete: true,
    learner_uptake: {
      required: true,
      mode: 'writable_entry',
      focus_terms: ['charger', 'dark', 'stocktake'],
      accepted_meaning: null,
    },
    turn_focus_contract: {
      primary_terms: ['charger', 'dark', 'stocktake'],
      due_terms: [],
      sibling_relation_requires_explicit_bridge: false,
    },
    handoff_contract: {
      mode: 'declarative_missing_support',
      question_allowed: false,
      question_required: false,
      question_owner: null,
      terminal_if_question: false,
      required_target_surfaces: ['chargers dark during the stocktake'],
      required_target_terms: ['charger', 'dark', 'stocktake'],
      prohibited_settled_surfaces: [],
    },
    ...overrides,
  };
}

test('live V1 progression audits substantive writable uptake and declarative terminal focus without fake slots', () => {
  const uptake = 'Write: “The dark chargers did not prevent the stocktake brownout.”';
  const development =
    'My case is that dark chargers cannot explain a brownout that still happened. The stocktake leaves the chargers unproved.';
  const audit = auditTutorStubLiveTurnProgressionV1({
    contract: progressionContract(),
    text: `${uptake} ${development}`,
    responseComposition: {
      segments: { uptake, development },
      requestedEntryAnswerRecognition: { recognized: true },
    },
  });
  assert.equal(audit.ok, true);
  assert.equal(audit.scope, 'whole_response_terminal_boundary');
  assert.equal(audit.slot_ownership_inferred, false);
  assert.equal(audit.learner_uptake.visible, true);
  assert.equal(audit.handoff.owner, 'terminal_sentence');
  assert.equal(audit.observed.question_count, 0);
});

test('live V1 progression rejects generic uptake, forbidden questions, and a lost terminal focus', () => {
  const uptake = 'Fair enough.';
  const development = 'What should we inspect next?';
  const audit = auditTutorStubLiveTurnProgressionV1({
    contract: progressionContract(),
    text: `${uptake} ${development}`,
    responseComposition: {
      segments: { uptake, development },
      requestedEntryAnswerRecognition: { recognized: false },
    },
  });
  assert.equal(audit.ok, false);
  assert.deepEqual(
    audit.issues.map((issue) => issue.type),
    [
      'learner_uptake_not_realized',
      'question_forbidden_by_handoff_contract',
      'handoff_loses_turn_focus',
    ],
  );
});

test('live V1 progression owns at most one required question at the actual terminal boundary', () => {
  const contract = progressionContract({
    learner_uptake: {
      required: true,
      mode: 'credit_or_qualify_resolved_move',
      focus_terms: ['dario', 'shelf'],
      accepted_meaning: null,
    },
    turn_focus_contract: {
      primary_terms: ['dario', 'shelf'],
      due_terms: ['visitor', 'badge'],
      sibling_relation_requires_explicit_bridge: false,
    },
    handoff_contract: {
      mode: 'question_on_due_source',
      question_allowed: true,
      question_required: true,
      question_owner: 'handoff',
      terminal_if_question: true,
      required_target_surfaces: ['visitor badge'],
      required_target_terms: ['visitor', 'badge'],
      prohibited_settled_surfaces: [],
    },
  });
  const uptake = 'Yes—Dario reached shelf two, but that does not prove he took it.';
  const development = 'I open the new register beside us. What does the visitor badge change?';
  const passing = auditTutorStubLiveTurnProgressionV1({
    contract,
    text: `${uptake} ${development}`,
    responseComposition: { uptake, development },
  });
  assert.equal(passing.ok, true);

  const misplaced = auditTutorStubLiveTurnProgressionV1({
    contract,
    text: `Does Dario reach shelf two? ${development}`,
    responseComposition: { uptake: 'Does Dario reach shelf two?', development },
  });
  assert.equal(misplaced.ok, false);
  assert.ok(misplaced.issues.some((issue) => issue.type === 'question_outside_terminal_handoff'));
  assert.ok(misplaced.issues.some((issue) => issue.type === 'multiple_questions_violate_terminal_handoff'));
});

test('live V1 question ownership excludes question marks inside an exact authored SOURCE', () => {
  const source = renderTutorStubDueSource({
    premise: 'p_badge',
    mode: 'enacted_role',
    role: 'front-desk clerk reading the visitor badge log',
    surface: 'Who signed the badge log? WF-11 is beside the entry.',
  });
  const learnerUptake = 'Right—the badge log leaves Dario possible but unproved.';
  const declarativeContract = progressionContract({
    learner_uptake: {
      required: true,
      mode: 'credit_or_qualify_resolved_move',
      focus_terms: ['dario', 'badge'],
      accepted_meaning: null,
    },
    handoff_contract: {
      mode: 'declarative_current_limit',
      question_allowed: false,
      question_required: false,
      question_owner: null,
      terminal_if_question: false,
      required_target_surfaces: ['visitor badge log and WF-11'],
      required_target_terms: ['visitor', 'badge', 'log', 'wf-11'],
      prohibited_settled_surfaces: [],
    },
  });
  const declarativeDevelopment =
    `I open the visitor badge log. ${source.text} The visitor badge log leaves WF-11 unassigned.`;
  const declarative = auditTutorStubLiveTurnProgressionV1({
    contract: declarativeContract,
    text: `${learnerUptake} ${declarativeDevelopment}`,
    responseComposition: { uptake: learnerUptake, development: declarativeDevelopment },
    authoredSourceTexts: [source.text],
  });
  assert.equal(declarative.ok, true, JSON.stringify(declarative.issues));
  assert.equal(declarative.observed.question_count, 0);
  assert.equal(declarative.observed.authored_source_question_count, 1);

  const questionContract = progressionContract({
    learner_uptake: declarativeContract.learner_uptake,
    handoff_contract: {
      mode: 'question_on_due_source',
      question_allowed: true,
      question_required: true,
      question_owner: 'handoff',
      terminal_if_question: true,
      required_target_surfaces: ['visitor badge log and WF-11'],
      required_target_terms: ['visitor', 'badge', 'log', 'wf-11'],
      prohibited_settled_surfaces: [],
    },
  });
  const questionDevelopment =
    `I open the visitor badge log. ${source.text} What does the visitor badge log show about WF-11?`;
  const question = auditTutorStubLiveTurnProgressionV1({
    contract: questionContract,
    text: `${learnerUptake} ${questionDevelopment}`,
    responseComposition: { uptake: learnerUptake, development: questionDevelopment },
    authoredSourceTexts: [source.text],
  });
  assert.equal(question.ok, true, JSON.stringify(question.issues));
  assert.equal(question.observed.question_count, 1);
  assert.equal(question.observed.authored_source_question_count, 1);
});

test('contract-aware no-due fallback passes live audit for forbidden and allowed-question handoffs', () => {
  const cases = [
    {
      name: 'forbidden pacing question',
      learnerText: 'I have no idea. Slow down.',
      learnerMove: {
        summary: 'Learner is confused and explicitly asks for slower pacing.',
        affect: 'overwhelmed',
        pedagogical_need: 'Slow down and offer one concrete starting point.',
      },
      uptake: 'You asked to slow the pace, so I will keep the incident log concrete.',
      support: {
        answerability: 'direction_only_until_evidence_is_public',
        modality: 'bounded_directional_choice',
        clarificationInvitationRequired: true,
      },
      questionAllowed: false,
    },
    {
      name: 'allowed unresolved question',
      learnerText: 'The badge log keeps Mara possible, but it does not show she signed the dispatch.',
      learnerMove: {
        summary: 'The learner separates the badge log from proof that Mara signed the dispatch.',
      },
      uptake: 'Right—the badge log keeps Mara possible without proving the dispatch signature.',
      support: null,
      questionAllowed: true,
    },
  ];

  for (const fixture of cases) {
    const contract = compileTutorStubTurnProgressionContract({
      learnerText: fixture.learnerText,
      responseCompositionFrame: {
        learner_move: fixture.learnerMove,
        conversational_completion: { resolved: false },
        due_evidence_surfaces: [],
      },
      questionSupport: fixture.support,
      actionFamily: 'stage_next_step',
      tactic: 'unadorned_report',
    });
    assert.equal(contract.handoff_contract.question_allowed, fixture.questionAllowed, fixture.name);
    const text = deterministicTutorStubConfiguredContinuationFallback({
      uptake: fixture.uptake,
      responseConfiguration: {
        engagement_stance: 'precise',
        action_family: 'stage_next_step',
        actorial_part: 'examiner',
      },
      support: fixture.support,
      world: {
        setting: 'The incident log and badge log lie open on the dispatch desk.',
        question: 'Who signed the dispatch?',
      },
      learnerText: fixture.learnerText,
      turnProgressionContract: contract,
    });
    const development = text.slice(fixture.uptake.length).trim();
    const audit = auditTutorStubLiveTurnProgressionV1({
      contract,
      text,
      responseComposition: { segments: { uptake: fixture.uptake, development } },
    });
    assert.equal(audit.ok, true, `${fixture.name}: ${JSON.stringify(audit.issues)}`);
    assert.equal(audit.observed.question_count, fixture.questionAllowed ? 1 : 0, fixture.name);
  }
});

test('live V1 progression binds a terminal deictic question only to its adjacent typed source', () => {
  const due = 'The visitor badge log names WF-11 for the outside crew.';
  const contract = progressionContract({
    learner_uptake: {
      required: true,
      mode: 'credit_or_qualify_resolved_move',
      focus_terms: ['dario', 'shelf'],
      accepted_meaning: null,
    },
    turn_focus_contract: {
      primary_terms: ['dario', 'shelf'],
      due_terms: ['visitor', 'badge', 'wf-11', 'outside', 'crew'],
      sibling_relation_requires_explicit_bridge: false,
    },
    handoff_contract: {
      mode: 'question_on_due_source',
      question_allowed: true,
      question_required: true,
      question_owner: 'handoff',
      terminal_if_question: true,
      required_target_surfaces: [due],
      required_target_terms: ['visitor', 'badge', 'wf-11', 'outside', 'crew'],
      prohibited_settled_surfaces: [],
    },
  });
  const uptake = 'Yes—Dario reached shelf two, but that does not prove he took it.';
  const passingDevelopment = `${due} What does that show?`;
  const passing = auditTutorStubLiveTurnProgressionV1({
    contract,
    text: `${uptake} ${passingDevelopment}`,
    responseComposition: { uptake, development: passingDevelopment },
  });
  assert.equal(passing.ok, true, JSON.stringify(passing.issues));
  assert.match(passing.observed.handoff_focus_surface, /visitor badge log/iu);

  const failingDevelopment = 'I set down the kettle. What does that show?';
  const failing = auditTutorStubLiveTurnProgressionV1({
    contract,
    text: `${uptake} ${failingDevelopment}`,
    responseComposition: { uptake, development: failingDevelopment },
  });
  assert.equal(failing.ok, false);
  assert.ok(failing.issues.some((issue) => issue.type === 'handoff_loses_turn_focus'));
});

test('live V1 requires one exact source and binds its carrier to the nearest pre-source host boundary', () => {
  const source = renderTutorStubDueSource({
    premise: 'p_crew',
    mode: 'enacted_role',
    role: 'front-desk clerk reading the visitor badge log',
    surface: 'WF-11 was issued to the outside crew.',
  });
  const contract = { evidence: { sources: [source] } };
  const passingText = `I open the visitor badge log. ${source.text} What does WF-11 change?`;
  const passing = auditTutorStubLiveSourceActionAlignmentV1({
    text: passingText,
    firstDraftContract: contract,
  });
  assert.equal(passing.ok, true);
  assert.equal(passing.scope, 'exact_source_occurrence_and_nearest_pre_source_host_boundary');
  assert.equal(passing.slot_ownership_inferred, false);
  assert.equal(passing.exact_source_occurrence_passes, 1);
  assert.equal(passing.exact_source_occurrence_failures, 0);
  assert.deepEqual(passing.source_occurrences[0].spans, [{ start: 30, end: 93 }]);
  assert.equal(
    passing.pre_source_boundaries[0].audited_host_text,
    'I open the visitor badge log.',
  );
  assert.equal(
    passing.pre_source_boundaries[0].audited_host_text,
    passingText.slice(
      passing.pre_source_boundaries[0].boundary_start,
      passing.pre_source_boundaries[0].boundary_end,
    ),
  );
  assert.doesNotMatch(passing.audited_host_text, /outside crew/iu);

  const failing = auditTutorStubLiveSourceActionAlignmentV1({
    text: `I set the kettle beside us. ${source.text} What does the visitor badge log change?`,
    firstDraftContract: contract,
  });
  assert.equal(failing.ok, false);
  assert.equal(failing.issues[0].type, 'due_source_action_referent_missing');
  assert.equal(
    failing.pre_source_boundaries[0].audited_host_text,
    'I set the kettle beside us.',
  );
  assert.match(failing.audited_host_text, /visitor badge log/iu);
});

test('live V1 rejects a paraphrased or duplicated host-rendered source', () => {
  const source = renderTutorStubDueSource({
    premise: 'p_crew',
    mode: 'enacted_role',
    role: 'front-desk clerk reading the visitor badge log',
    surface: 'WF-11 was issued to the outside crew.',
  });
  const firstDraftContract = { evidence: { sources: [source] } };
  const paraphrase = auditTutorStubLiveSourceActionAlignmentV1({
    text:
      'I open the visitor badge log. “I report this: WF-11 was issued to the outside crew.” What changes?',
    firstDraftContract,
  });
  assert.equal(paraphrase.ok, false);
  assert.equal(paraphrase.source_occurrences[0].observed_count, 0);
  assert.deepEqual(
    paraphrase.issues.map((issue) => issue.type),
    ['due_source_exact_occurrence_count'],
  );

  const duplicate = auditTutorStubLiveSourceActionAlignmentV1({
    text: `I open the visitor badge log. ${source.text} ${source.text} What changes?`,
    firstDraftContract,
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.source_occurrences[0].observed_count, 2);
  assert.equal(duplicate.exact_source_occurrence_failures, 1);
  assert.deepEqual(
    duplicate.issues.map((issue) => issue.type),
    ['due_source_exact_occurrence_count'],
  );
});

test('live V1 binds opt-in compensation only to the first complete sentence after exact SOURCE', () => {
  const source = renderTutorStubDueSource({
    premise: 'p_seal',
    mode: 'presented_exhibit',
    role: 'night notary reading the private-seal register',
    surface:
      "The private-seal register has one entry for the dusk-seal: Elian, night notary of the lower quay, drew it for curfew warrants and returned it chipped at the raven's wing the morning after the coffer left town.",
  });
  const sourceAccessibility = compileTutorStubSourceAccessibilityContract({
    sources: [source],
    configuration: {
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'standard',
      source_accessibility_owner: 'post_source_sentence',
    },
    policy: 'direct_or_compensated_v1',
  });
  assert.equal(sourceAccessibility.effective_mode, 'compensated');
  const contract = {
    evidence: {
      sources: [source],
      source_accessibility: sourceAccessibility,
    },
  };
  const compensation =
    'Elian drew it for curfew warrants and returned it chipped after the coffer left town.';
  const passing = auditTutorStubLiveSourceActionAlignmentV1({
    text: `I open the private-seal register. ${source.text} ${compensation} What does the chipped seal show?`,
    firstDraftContract: contract,
  });
  assert.equal(passing.ok, true, JSON.stringify(passing.issues));
  assert.equal(passing.effective_mode, 'compensated');
  assert.equal(passing.compensation_visible, true);
  assert.equal(passing.passing_compensation_spans.length, 1);
  assert.equal(passing.passing_compensation_spans[0].text, compensation);

  const intervening = auditTutorStubLiveSourceActionAlignmentV1({
    text:
      `I open the private-seal register. ${source.text} ` +
      `I turn the page. ${compensation} What does the chipped seal show?`,
    firstDraftContract: contract,
  });
  assert.equal(intervening.ok, false);
  assert.ok(intervening.issues.some((issue) => issue.type === 'compensation_not_ordered_source_subsequence'));
  assert.equal(intervening.compensation_visible, false);
});

test('live V1 compensation cannot rescue weak host part, tactic, or stance realization', () => {
  const source = renderTutorStubDueSource({
    premise: 'p_seal',
    mode: 'presented_exhibit',
    role: 'night notary reading the private-seal register',
    surface:
      'I examine only the private-seal register entry naming Elian during the lower-quay curfew, after the dusk-seal returned chipped and before the coffer left town under the morning watch.',
  });
  const sourceAccessibility = compileTutorStubSourceAccessibilityContract({
    sources: [source],
    configuration: {
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'standard',
      source_accessibility_owner: 'post_source_sentence',
    },
    policy: 'direct_or_compensated_v1',
  });
  assert.equal(sourceAccessibility.effective_mode, 'compensated');
  const compensation = 'I examine only the private-seal register entry naming Elian.';
  const firstDraftContract = {
    evidence: { sources: [source], source_accessibility: sourceAccessibility },
  };
  const configuration = {
    engagement_stance: 'precise',
    action_family: 'ground_in_material',
    audience_register: 'domain_apprentice',
    lexical_accessibility: 'standard',
    scene_immersion: 'grounded',
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
  };
  const world = {
    setting: 'The private-seal register and chipped dusk-seal lie on the quay desk.',
    question: 'Who drew the dusk-seal?',
  };
  const weakText =
    `I hear you. The private-seal register lies open. ${source.text} ` +
    `${compensation} What does the entry show?`;
  const weakLiveAudit = auditTutorStubLiveSourceActionAlignmentV1({
    text: weakText,
    firstDraftContract,
  });
  assert.equal(weakLiveAudit.ok, true, JSON.stringify(weakLiveAudit.issues));
  const unpartitioned = auditTutorStubResponseConfiguration({
    text: weakText,
    configuration,
    world,
  });
  assert.equal(unpartitioned.axes.actorial_part.part_visible, true);
  assert.equal(
    unpartitioned.axes.actorial_part.performance_visible,
    false,
    'a lexical-only source/compensation surface must not impersonate an evidentiary boundary',
  );
  assert.equal(unpartitioned.axes.engagement_stance.visible, true);

  const weakHostSurface = tutorStubLiveResponseConfigurationSurface({
    text: weakText,
    liveSourceActionAlignmentAudit: weakLiveAudit,
  });
  assert.equal(weakHostSurface.active, true);
  assert.deepEqual(
    weakHostSurface.excluded_spans.map((span) => span.kind),
    ['exact_source', 'passing_compensation'],
  );
  const partitionedWeak = auditTutorStubResponseConfiguration({
    text: weakHostSurface.text,
    configuration,
    world,
  });
  assert.equal(partitionedWeak.axes.actorial_part.part_visible, false);
  assert.equal(partitionedWeak.axes.actorial_part.performance_visible, false);
  assert.equal(partitionedWeak.axes.engagement_stance.visible, false);

  const strongText =
    `I hear you. I examine the private-seal register: it shows a name, but not who held the seal. ${source.text} ` +
    `${compensation} What does the entry show?`;
  const strongLiveAudit = auditTutorStubLiveSourceActionAlignmentV1({
    text: strongText,
    firstDraftContract,
  });
  assert.equal(strongLiveAudit.ok, true, JSON.stringify(strongLiveAudit.issues));
  const strongHostSurface = tutorStubLiveResponseConfigurationSurface({
    text: strongText,
    liveSourceActionAlignmentAudit: strongLiveAudit,
  });
  const partitionedStrong = auditTutorStubResponseConfiguration({
    text: strongHostSurface.text,
    configuration,
    world,
  });
  assert.equal(partitionedStrong.axes.actorial_part.part_visible, true);
  assert.equal(partitionedStrong.axes.actorial_part.performance_visible, true);
  assert.equal(partitionedStrong.axes.engagement_stance.visible, true);
});

test('an authored source cannot satisfy its own live host carrier audit', () => {
  const source = renderTutorStubDueSource({
    premise: 'p_crew',
    mode: 'presented_exhibit',
    role: 'front-desk clerk reading the visitor badge log',
    surface: 'The visitor badge log names WF-11.',
  });
  const audit = auditTutorStubLiveSourceActionAlignmentV1({
    text: `I set down the kettle. ${source.text}`,
    firstDraftContract: { evidence: { sources: [source] } },
  });
  assert.equal(audit.ok, false);
  assert.doesNotMatch(audit.audited_host_text, /visitor badge log/iu);
});

test('live V1 failures remain hard delivery issues in strict and shadow policies', () => {
  const issues = tutorStubGuardIssueRows({
    liveTurnProgressionAudit: {
      issues: [{ type: 'question_forbidden_by_handoff_contract' }],
    },
    liveSourceActionAlignmentAudit: {
      issues: [{ type: 'due_source_action_referent_missing' }],
    },
  });
  assert.deepEqual(
    issues.map((issue) => issue.guard),
    ['live_turn_progression_v1', 'live_source_action_alignment_v1'],
  );
  for (const boundaryPolicy of ['strict', 'shadow_advisory']) {
    const decision = decideTutorStubGuardDelivery(issues, { boundaryPolicy });
    assert.equal(decision.ok, false);
    assert.deepEqual(
      decision.hardIssues.map((issue) => issue.guard),
      ['live_turn_progression_v1', 'live_source_action_alignment_v1'],
    );
    assert.ok(decision.dispositions.every((row) => row.match === 'guard_wildcard'));
  }
});

test('the deterministic live fallback consumes the same exact due-source renderer', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_crew',
        surface: 'WF-11 was issued to the outside crew.',
        presentation: {
          mode: 'enacted_role',
          role: 'front-desk clerk reading the visitor badge log',
        },
      },
    ],
  });
  const source = renderTutorStubDueSource(frame.entries[0], 0);
  const text = deterministicTutorStubDramaticReleaseFallback({
    frame,
    uptake: 'Yes—the first claim remains unproved.',
    responseConfiguration: {
      engagement_stance: 'plain',
      actorial_part: 'examiner',
    },
    variationKey: 'live-v1-single-source',
  });
  assert.equal(
    text,
    `Yes—the first claim remains unproved. I call for the visitor badge log; I examine the visitor badge log; ${source.text} What changes now?`,
  );
  assert.equal(text.split(source.text).length - 1, 1);
  const alignment = auditTutorStubLiveSourceActionAlignmentV1({
    text,
    firstDraftContract: { evidence: { sources: [source] } },
  });
  assert.equal(alignment.ok, true, JSON.stringify(alignment.issues));
});

test('deterministic live fallback places an audited extractive compensation immediately after dense SOURCE', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_seal',
        surface:
          "The private-seal register has one entry for the dusk-seal: Elian, night notary of the lower quay, drew it for curfew warrants and returned it chipped at the raven's wing the morning after the coffer left town.",
        presentation: {
          mode: 'presented_exhibit',
          role: 'night notary reading the private-seal register',
        },
      },
    ],
  });
  const source = renderTutorStubDueSource(frame.entries[0], 0);
  const sourceAccessibility = compileTutorStubSourceAccessibilityContract({
    sources: [source],
    configuration: {
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'standard',
      source_accessibility_owner: 'post_source_sentence',
    },
    policy: 'direct_or_compensated_v1',
  });
  const text = deterministicTutorStubDramaticReleaseFallback({
    frame,
    uptake: 'You are right to ask for one concrete record.',
    responseConfiguration: {
      engagement_stance: 'precise',
      actorial_part: 'record_keeper',
    },
    sourceAccessibilityContract: sourceAccessibility,
    variationKey: 'live-v1-compensated-source',
  });
  const audit = auditTutorStubLiveSourceActionAlignmentV1({
    text,
    firstDraftContract: {
      evidence: { sources: [source], source_accessibility: sourceAccessibility },
    },
  });
  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
  assert.equal(audit.compensation_visible, true);
  assert.equal(audit.passing_compensation_spans.length, 1);
  assert.match(
    audit.passing_compensation_spans[0].text,
    /^Elian drew it for curfew warrants/u,
  );
});
