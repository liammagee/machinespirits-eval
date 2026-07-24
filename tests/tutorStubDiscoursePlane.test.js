import assert from 'node:assert/strict';
import test from 'node:test';

import {
  freezeTutorStubLearnerRecordUpdateForDiscoursePlane,
  resolveTutorStubDiscoursePlane,
} from '../services/tutorStubDiscoursePlane.js';
import {
  buildTutorStubFirstDraftContract,
  tutorStubFirstDraftContractPrompt,
} from '../services/tutorStubFirstDraftContract.js';
import {
  auditTutorStubResponseComposition,
  buildTutorStubResponseCompositionFrame,
  deterministicTutorStubConfiguredContinuationFallback,
} from '../services/tutorStubResponseComposition.js';
import {
  auditTutorStubResponseConfiguration,
  buildTutorStubResponseConfiguration,
} from '../services/tutorStubResponseConfiguration.js';
import {
  auditTutorStubLiveTurnProgressionV1,
  compileTutorStubTurnProgressionContract,
} from '../services/tutorStubTurnProgressionContract.js';

const learnerText = "can we simplify the language a bit I'm not following";
const classification = {
  turn: {
    summary: 'Requests simpler wording because the explanation is unclear.',
    request_type: 'plain_simplification_followup',
    discourse_move: 'repair_request',
    discourse_plane: 'instructional_meta',
    evidence_use: 'none',
    epistemic_stance: 'confused',
    agency: 'self_correcting',
    pedagogical_need: 'Restate the baseline question in plain language.',
  },
};

function responseConfiguration(discoursePlane, overrides = {}) {
  return buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText,
    classification,
    tutorLearnerDag: {
      model: {
        assessment: { bottleneck: 'release_or_pacing_gap', finalSecretEntailed: false },
        memoryReliability: { activeDroppedCount: 0 },
      },
    },
    comprehension: { pressure: 0, unresolvedTerms: [] },
    world: { title: 'Proposal workshop', setting: 'A proposal card rests on the workshop table.' },
    releasePacing: { direction: 'decelerate', dueNow: [] },
    discoursePlane,
    ...overrides,
  });
}

test('plain-language repair is instructional metalanguage, not an object-level proof claim', () => {
  const plane = resolveTutorStubDiscoursePlane({ learnerText, classification });

  assert.equal(plane.plane, 'instructional_meta');
  assert.equal(plane.meta_target.kind, 'latest_tutor_turn');
  assert.equal(plane.proof_effect, 'none');
  assert.equal(plane.freeze_learner_dag, true);
  assert.equal(plane.freeze_clue_release, true);
});

test('instructional metalanguage neutralizes every proof-changing learner-record field', () => {
  const plane = resolveTutorStubDiscoursePlane({ learnerText, classification });
  const frozen = freezeTutorStubLearnerRecordUpdateForDiscoursePlane({
    discoursePlane: plane,
    update: {
      adopt: ['p_badge_log'],
      retract: ['p_notice'],
      derive: [['baseline', 'is', 'chat']],
      hypothesis: 'The chat wording settles the implementation.',
      assert_answer: 'chat assistant',
      provider: 'codex',
      human_discourse: { proof_status: 'strict_proof' },
    },
  });

  assert.deepEqual(frozen.adopt, []);
  assert.deepEqual(frozen.retract, []);
  assert.deepEqual(frozen.derive, []);
  assert.equal(frozen.hypothesis, null);
  assert.equal(frozen.assert_answer, null);
  assert.equal(frozen.provider, 'codex');
  assert.equal(frozen.human_discourse.proof_status, 'side_arc');
  assert.equal(frozen.human_discourse.side_arc.type, 'instructional_meta');
  assert.equal(frozen.proof_update_suppressed, true);
});

test('instructional repair outranks slower clue pacing in response configuration', () => {
  const plane = resolveTutorStubDiscoursePlane({ learnerText, classification });
  const configuration = responseConfiguration(plane);

  assert.equal(configuration.action_family, 'repair_explanation');
  assert.equal(configuration.engagement_stance, 'plain');
  assert.equal(configuration.scene_immersion, 'minimal');
  assert.equal(configuration.actorial_part, 'scene_partner');
  assert.equal(configuration.actorial_performance.id, 'unadorned_report');
  assert.equal(configuration.discourse_plane.plane, 'instructional_meta');
  assert.equal(configuration.compatibility.pre_instructional_meta_engagement_stance, 'warm');
  assert.match(configuration.selection_reasons.action_family, /without advancing evidence or proof state/iu);
});

test('meta repair compiles an internally satisfiable declarative progression contract', () => {
  const plane = resolveTutorStubDiscoursePlane({ learnerText, classification });
  const configuration = responseConfiguration(plane);
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification,
    registerSelection: { response_configuration: configuration },
    discoursePlane: plane,
  });
  const progression = compileTutorStubTurnProgressionContract({
    learnerText,
    responseCompositionFrame: frame,
    questionSupport: {
      responsiveRepairRequired: true,
      clarificationInvitationRequired: true,
      modality: 'bounded_choice',
    },
    actionFamily: configuration.action_family,
    tactic: configuration.actorial_performance.id,
  });
  const firstDraft = buildTutorStubFirstDraftContract({
    learnerText,
    responseConfiguration: configuration,
    responseCompositionFrame: frame,
    questionSupport: {
      responsiveRepairRequired: true,
      clarificationInvitationRequired: true,
      modality: 'bounded_choice',
    },
  });
  const prompt = tutorStubFirstDraftContractPrompt(firstDraft);

  assert.equal(frame.development.kind, 'instructional_meta_repair');
  assert.equal(progression.turn_focus_contract.primary_source, 'learner_move_summary');
  assert.equal(progression.handoff_contract.mode, 'instructional_meta_repair');
  assert.equal(progression.handoff_contract.question_allowed, false);
  assert.deepEqual(progression.handoff_contract.required_target_terms, []);
  assert.match(firstDraft.opening.instruction, /latest tutor point in ordinary words/iu);
  assert.match(firstDraft.ending.instruction, /do not return to the proof/iu);
  assert.equal(firstDraft.progression.handoff_contract.question_allowed, false);
  assert.match(prompt, /two or three short, unquoted sentences/iu);
  assert.match(prompt, /ACKNOWLEDGE > RESTATE > optional CONTINUITY/u);
  assert.match(prompt, /“Of course” or “Yes” alone is not enough/u);
  assert.match(prompt, /do not ask a question, quote the public inquiry question, or output a question mark/iu);
  assert.doesNotMatch(prompt, /UPTAKE > PART|TACTIC > HANDOFF/u);
});

test('saved Luna drafts distinguish generation failures from generic repair visibility', () => {
  const plane = resolveTutorStubDiscoursePlane({ learnerText, classification });
  const configuration = responseConfiguration(plane);
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification,
    registerSelection: { response_configuration: configuration },
    discoursePlane: plane,
  });
  const firstDraft = buildTutorStubFirstDraftContract({
    learnerText,
    responseConfiguration: configuration,
    responseCompositionFrame: frame,
  });
  const initialLunaDraft =
    'Yes—by “assay,” we simply mean testing the coins to learn who made them. We stand together at the guild-hall trial-book, with the false shillings before us. We will examine one clue at a time and say only what that clue shows. For now, we do not know whose hand struck them; the evidence has not yet been read. “Whose hand struck the false shillings passed at the Marrick fair?”';
  const acceptedLunaRepair =
    'Yes—by “assay,” we simply mean testing the coins to learn who made them. We are trying to find who made the false coins, using only clues we can examine. I place the trial-book beside the coins, and we can unpack any unclear phrase.';
  const currentLunaFirstDraft =
    'Yes, I’ll make this easier to follow. We are looking for who made the false coins, using only the clues we uncover. I can explain each part in simpler words.';
  const initialComposition = auditTutorStubResponseComposition({
    text: initialLunaDraft,
    frame,
    learnerText,
    firstDraftContract: firstDraft,
  });
  const initialProgression = auditTutorStubLiveTurnProgressionV1({
    contract: firstDraft.progression,
    text: initialLunaDraft,
    responseComposition: initialComposition,
  });
  const acceptedComposition = auditTutorStubResponseComposition({
    text: acceptedLunaRepair,
    frame,
    learnerText,
    firstDraftContract: firstDraft,
  });
  const acceptedProgression = auditTutorStubLiveTurnProgressionV1({
    contract: firstDraft.progression,
    text: acceptedLunaRepair,
    responseComposition: acceptedComposition,
  });
  const configurationAudit = auditTutorStubResponseConfiguration({
    text: acceptedLunaRepair,
    configuration,
    world: {
      setting: 'The trial-book rests beside the false coins.',
      question: 'Whose hand struck the false shillings passed at the Marrick fair?',
    },
    composition: acceptedComposition.segments,
  });
  const currentComposition = auditTutorStubResponseComposition({
    text: currentLunaFirstDraft,
    frame,
    learnerText,
    firstDraftContract: firstDraft,
  });
  const currentProgression = auditTutorStubLiveTurnProgressionV1({
    contract: firstDraft.progression,
    text: currentLunaFirstDraft,
    responseComposition: currentComposition,
  });
  const currentConfigurationAudit = auditTutorStubResponseConfiguration({
    text: currentLunaFirstDraft,
    configuration,
    world: {
      setting: 'The trial-book rests beside the false coins.',
      question: 'Whose hand struck the false shillings passed at the Marrick fair?',
    },
    composition: currentComposition.segments,
  });

  assert.equal(initialProgression.ok, false);
  assert.ok(initialProgression.issues.some((issue) => issue.type === 'question_forbidden_by_handoff_contract'));
  assert.equal(acceptedComposition.ok, true, JSON.stringify(acceptedComposition.issues));
  assert.equal(acceptedProgression.ok, true, JSON.stringify(acceptedProgression.issues));
  assert.equal(configurationAudit.axes.action_family.visible, true);
  assert.equal(configurationAudit.axes.actorial_part.performance_visible, true);
  assert.equal(currentComposition.ok, true, JSON.stringify(currentComposition.issues));
  assert.equal(currentProgression.ok, true, JSON.stringify(currentProgression.issues));
  assert.equal(currentConfigurationAudit.axes.action_family.visible, true);
});

test('deterministic fallback repairs the explanation without reifying the learner request as evidence', () => {
  const plane = resolveTutorStubDiscoursePlane({ learnerText, classification });
  const configuration = responseConfiguration(plane);
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification,
    registerSelection: { response_configuration: configuration },
    discoursePlane: plane,
  });
  const progression = compileTutorStubTurnProgressionContract({
    learnerText,
    responseCompositionFrame: frame,
    actionFamily: configuration.action_family,
  });
  const text = deterministicTutorStubConfiguredContinuationFallback({
    uptake: 'You want plainer words; I will explain the same point directly.',
    responseConfiguration: configuration,
    world: {
      setting: 'A proposal card rests on the workshop table.',
      openingFrame: { situation: 'We are reviewing a proposal.' },
      question: 'What should the first implementation baseline be?',
    },
    learnerText,
    turnProgressionContract: progression,
  });
  const firstSentence = text.match(/^[^.!?]+[.!?]/u)?.[0] || text;
  const audit = auditTutorStubLiveTurnProgressionV1({
    contract: progression,
    text,
    responseComposition: {
      segments: {
        uptake: firstSentence,
        development: text.slice(firstSentence.length).trim(),
      },
    },
  });

  assert.match(text, /plainer words/iu);
  assert.match(text, /does not add a clue or move the inquiry forward/iu);
  assert.doesNotMatch(text, /use the record to decide can we simplify/iu);
  assert.doesNotMatch(text, /choose one way forward/iu);
  assert.doesNotMatch(text, /\?/u);
  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
});

test('object-level learner claims remain eligible for proof updates and pacing actions', () => {
  const objectClassification = {
    turn: {
      summary: 'Uses the badge log to support a claim about the proposal.',
      request_type: 'conceptual_clarity_request',
      discourse_move: 'inference',
      discourse_plane: 'object',
      evidence_use: 'links_evidence_to_rule',
      pedagogical_need: 'Test the inference against the public record.',
    },
  };
  const plane = resolveTutorStubDiscoursePlane({
    learnerText: 'The badge log means the first version should only answer public questions.',
    classification: objectClassification,
  });
  const configuration = buildTutorStubResponseConfiguration({
    engagementStance: 'warm',
    learnerText: 'The badge log means the first version should only answer public questions.',
    classification: objectClassification,
    tutorLearnerDag: { model: { assessment: {}, memoryReliability: { activeDroppedCount: 0 } } },
    comprehension: { pressure: 0, unresolvedTerms: [] },
    world: { setting: 'A badge log lies on the table.' },
    releasePacing: { direction: 'decelerate', dueNow: [] },
    discoursePlane: plane,
  });

  assert.equal(plane.plane, 'object');
  assert.equal(plane.freeze_learner_dag, false);
  assert.equal(configuration.action_family, 'reanchor_public_evidence');
});

test('object-language uses of mean are not mistaken for requests about the explanation', () => {
  const plane = resolveTutorStubDiscoursePlane({
    learnerText: 'I mean the badge log establishes access, but not which implementation should be built.',
    classification: {
      turn: {
        summary: 'Qualifies an inference from the badge log.',
        request_type: 'conceptual_clarity_request',
        discourse_move: 'inference',
        evidence_use: 'links_evidence_to_rule',
      },
    },
  });

  assert.equal(plane.plane, 'object');
  assert.equal(plane.freeze_learner_dag, false);
});

test('subject-matter confusion is not mistaken for a request to rewrite the tutor wording', () => {
  const learnerText = 'I am not sure because I do not understand the basic concept behind the public mark.';
  const plane = resolveTutorStubDiscoursePlane({
    learnerText,
    classification: {
      turn: {
        discourse_plane: 'instructional_meta',
        request_type: 'plain_simplification_followup',
        discourse_move: 'repair_request',
        evidence_use: 'none',
        summary: 'The learner is uncertain about the public mark.',
        pedagogical_need: 'Explain how the mark functions in the inquiry.',
      },
    },
  });

  assert.equal(plane.plane, 'object');
  assert.equal(plane.signals.surface_meta_visible, false);
  assert.equal(plane.freeze_learner_dag, false);
  assert.equal(plane.freeze_clue_release, false);
});

test('a pacing request remains object-level scaffolding even when a classifier overcalls the plane', () => {
  const plane = resolveTutorStubDiscoursePlane({
    learnerText: 'I have no idea. Slow down.',
    classification: {
      turn: {
        discourse_plane: 'instructional_meta',
        request_type: 'stepwise_support_request',
        discourse_move: 'repair_request',
        evidence_use: 'none',
        summary: 'Learner asks for slower pacing.',
        pedagogical_need: 'Slow down and offer one concrete starting point.',
      },
    },
    sideArc: { type: 'clarification_or_plain_language' },
  });

  assert.equal(plane.plane, 'object');
  assert.equal(plane.freeze_learner_dag, false);
  assert.equal(plane.freeze_clue_release, false);
});
