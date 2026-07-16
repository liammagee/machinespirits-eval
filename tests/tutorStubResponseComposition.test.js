import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditTutorStubResponseComposition,
  buildTutorStubResponseCompositionFrame,
  composeTutorStubFallbackWithUptake,
  deterministicTutorStubConfiguredContinuationFallback,
  deterministicTutorStubLearnerUptake,
  formatTutorStubResponseComposition,
  tutorStubLearnerSelectedToolMarkPath,
  tutorStubResponseCompositionPrompt,
} from '../services/tutorStubResponseComposition.js';
import { auditTutorStubResponseConfiguration } from '../services/tutorStubResponseConfiguration.js';

test('fallback composition includes a supplied uptake exactly once', () => {
  const uptake = 'I tap the trial-book shut on that line: fair.';
  assert.equal(
    composeTutorStubFallbackWithUptake({
      uptake,
      text: `${uptake} ${uptake} Not so fast—I hold that claim against the coin.`,
    }),
    `${uptake} Not so fast—I hold that claim against the coin.`,
  );
});

test('answer-seeking fallback uptake names the requested entry instead of using a generic transition', () => {
  const learnerText = 'What should I write next about why the extra travel time makes the loaves cold?';
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText,
    classification: { turn: { discourse_move: 'answer_seeking', request_type: 'answer_seeking_or_overreach' } },
  });
  const audit = auditTutorStubResponseComposition({
    text: `${uptake} The launch log shows the loaves leave warm, so the longer trip gives them time to cool.`,
    learnerText,
    frame: buildTutorStubResponseCompositionFrame({
      learnerText,
      classification: { turn: { summary: 'Asks for the next causal entry.', discourse_move: 'answer_seeking' } },
      registerSelection: { response_configuration: { action_family: 'stage_next_step' } },
    }),
  });

  assert.match(uptake, /next supported line about how the extra travel time makes the loaves cold/iu);
  assert.equal(audit.issues.some((issue) => issue.type === 'generic_learner_uptake'), false);
  assert.equal(audit.issues.some((issue) => issue.type === 'verbatim_learner_echo'), false);
});

test('supported terminal inference receives a non-echoing deterministic acknowledgement', () => {
  const learnerText = 'The record names bramblewasp as running the sock-puppet brigade.';
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText,
    classification: { turn: { discourse_move: 'inference', request_type: 'off_task_or_mixed' } },
  });

  assert.match(uptake, /conclusion now follows from the public evidence/iu);
  assert.doesNotMatch(uptake, /bramblewasp|sock-puppet brigade/iu);
});

test('the Gazette completion frame rejects an elegant restatement loop and accepts new pressure', () => {
  const learnerText = 'Crane is a possible culprit, but not proven guilty.';
  const dueEvidence =
    'The archive copy shows Crane filed clean prose; the false kicker was inserted after filing.';
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: {
      turn: {
        summary: 'Treats Crane as a possible culprit while withholding a verdict.',
        discourse_move: 'hypothesis',
      },
    },
    registerSelection: {
      expected_dag_move: 'Introduce genuinely new public evidence.',
      response_configuration: { action_family: 'stage_next_step' },
    },
    conversationalCompletion: {
      resolved: true,
      status: 'qualified',
      reopenForbidden: true,
      requiresNewPressure: true,
      sourceTutorQuestion:
        'What does the byline establish—and what does it leave unproved about who planted the false quote?',
      learnerSurface: learnerText,
      acceptedMeaning: 'Treats Crane as a possible culprit while withholding a verdict.',
    },
    dramaticReleaseFrame: { active: true, entries: [{ surface: dueEvidence }] },
  });
  const looping = auditTutorStubResponseComposition({
    learnerText,
    frame,
    text: 'Exactly—the byline does not prove who planted the quote. For now, can we record Crane as responsible for the filed story while leaving the planting unproved?',
  });
  const advancing = auditTutorStubResponseComposition({
    learnerText,
    frame,
    text: `Exactly—Crane remains possible, not proven. ${dueEvidence} Whose later access should we test next?`,
  });

  assert.equal(looping.ok, false);
  assert.ok(looping.issues.some((issue) => issue.type === 'resolved_point_reopened'));
  assert.equal(advancing.ok, true);
  assert.match(tutorStubResponseCompositionPrompt(frame), /genuinely new pressure/iu);
});

test('newly released custody evidence may advance from a tool to the hand that used it', () => {
  const learnerText =
    'The mark shows a worn sprung-heel burin cut the die; the striking hand remains unproved.';
  const dueEvidence =
    'The estate inventory leaves the worn sprung-heel burin in Edony’s sole keeping.';
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: { turn: { summary: learnerText, discourse_move: 'inference' } },
    registerSelection: {
      expected_dag_move: 'Introduce genuinely new public evidence.',
      response_configuration: { action_family: 'stage_next_step' },
    },
    conversationalCompletion: {
      resolved: true,
      status: 'accepted',
      reopenForbidden: true,
      requiresNewPressure: true,
      sourceTutorQuestion:
        'What does that mark tell you about the tool that cut this die, and what remains unproved of the striking hand?',
      learnerSurface: learnerText,
      acceptedMeaning: learnerText,
    },
    dramaticReleaseFrame: { active: true, entries: [{ surface: dueEvidence }] },
  });
  const audit = auditTutorStubResponseComposition({
    learnerText,
    frame,
    text: `Right—the mark identifies the cutting tool, not its keeper. ${dueEvidence} What does that now establish about who cut this die?`,
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.conversational_completion.newEvidenceVisible, true);
  assert.ok(audit.conversational_completion.questionOverlap < 0.9);
});

test('a short generic question about newly staged evidence is not a resolved-question loop', () => {
  const learnerText = 'Crane answers for the reporting, but the planting remains open.';
  const dueEvidence =
    'The version history shows that the false kicker was inserted after Crane filed the clean story.';
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: { turn: { summary: learnerText, discourse_move: 'inference' } },
    registerSelection: {
      expected_dag_move: 'Introduce genuinely new public evidence.',
      response_configuration: { action_family: 'stage_next_step' },
    },
    conversationalCompletion: {
      resolved: true,
      status: 'accepted',
      reopenForbidden: true,
      requiresNewPressure: true,
      sourceTutorQuestion:
        'What does that make Crane answer for—and what does it still leave open about who planted the quote?',
      learnerSurface: learnerText,
      acceptedMeaning: learnerText,
    },
    dramaticReleaseFrame: { active: true, entries: [{ surface: dueEvidence }] },
  });
  const audit = auditTutorStubResponseComposition({
    learnerText,
    frame,
    text: `Right—the planting remains open. I open the version history: ${dueEvidence} What do you make of it?`,
  });

  assert.equal(audit.conversational_completion.newEvidenceVisible, true);
  assert.equal(audit.conversational_completion.sharedQuestionTokenCount, 1);
  assert.equal(audit.issues.some((issue) => issue.type === 'resolved_point_reopened'), false);
});

test('natural scene-partner, skeptic, and evidentiary-boundary performances are visible', () => {
  const base = {
    engagement_stance: 'precise',
    action_family: 'stage_next_step',
    audience_register: 'domain_apprentice',
    lexical_accessibility: 'standard',
    scene_immersion: 'immersive',
  };
  const scenePartner = auditTutorStubResponseConfiguration({
    text: 'I draw my chair beside the drying folio and leave you the lamp. What do you see in the correction?',
    configuration: {
      ...base,
      actorial_part: 'scene_partner',
      actorial_part_label: 'fellow investigator',
      actorial_performance: { id: 'shared_scene_invitation', label: 'shared scene invitation' },
    },
    world: { setting: 'A flooded archive with a drying folio and lamp.' },
  });
  assert.equal(scenePartner.axes.actorial_part.part_visible, true);
  assert.equal(scenePartner.axes.actorial_part.performance_visible, true);

  const skeptic = auditTutorStubResponseConfiguration({
    text: 'I cannot admit it to save Vess; the folio shows resemblance, not authorship.',
    configuration: {
      ...base,
      actorial_part: 'skeptic',
      actorial_part_label: 'skeptical examiner',
      actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
    },
    world: { setting: 'A flooded archive with Vess and the folio in view.' },
  });
  assert.equal(skeptic.axes.actorial_part.part_visible, true);
  assert.equal(skeptic.axes.actorial_part.performance_visible, true);

  const boundary = auditTutorStubResponseConfiguration({
    text: 'Proximity is worth checking, but what would we still need before writing a name into the ledger?',
    configuration: {
      ...base,
      actorial_part: 'skeptic',
      actorial_part_label: 'skeptical examiner',
      actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
    },
    world: { setting: 'An archive with an open ledger.' },
  });
  assert.equal(boundary.axes.actorial_part.performance_visible, true);
});

test('response composition warns against a fourth repeated exhibit-handling gesture', () => {
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText: 'That leaves Crane unproved.',
    registerSelection: { response_configuration: { action_family: 'stage_next_step' } },
    recentTutorTexts: [
      'I lay the page beside the archive copy.',
      'I slide the log beneath the lamp.',
      'I open the corrections file.',
    ],
  });

  assert.equal(frame.scene_action_budget.saturated, true);
  assert.match(tutorStubResponseCompositionPrompt(frame), /judgment, address, rhythm, and word choice/iu);
});

test('deterministic uptake preserves a learner distinction between die-cutting and striking', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText:
      'We can carry that any shared die-mark would point to a die cut with Verrell’s graver, but not yet to Verrell’s own hand striking these coins.',
  });
  assert.match(uptake, /graver/iu);
  assert.match(uptake, /striking hand|who struck/iu);
});

test('deterministic uptake preserves a selected die-mark test while correcting what the tool does', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText:
      'I would watch first for one repeated die-mark, since it may link the shillings to the tool that struck them.',
  });
  assert.match(uptake, /die-mark/iu);
  assert.match(uptake, /cuts? the die|die-cutting tool/iu);
  assert.match(uptake, /does not strike|not the striking hand/iu);
});

test('deterministic uptake preserves a learner who sets old clipping aside for metal and die evidence', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'I’ll leave Verrell’s old clipping aside until the metal or die marks give us a specific link.',
  });

  assert.match(uptake, /old clipping/iu);
  assert.match(uptake, /metal and die marks/iu);
  assert.match(uptake, /specific link/iu);
  assert.doesNotMatch(uptake, /graver tied to its owner/iu);
});

test('deterministic uptake preserves a failed graver-to-die link as the selected tool test', () => {
  const learnerText = 'It still fails to tie this graver or any die it cut to these shillings.';
  const uptake = deterministicTutorStubLearnerUptake({ learnerText });

  assert.match(uptake, /graver/iu);
  assert.match(uptake, /die/iu);
  assert.match(uptake, /unconnected|unlinked/iu);

  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: { turn: { summary: 'The learner keeps the graver-to-die link unproved.' } },
    registerSelection: { response_configuration: { action_family: 'stage_next_step' } },
  });
  const audit = auditTutorStubResponseComposition({
    learnerText,
    frame,
    text: `${uptake} I lay the graver beside the shilling and leave the die-mark comparison open.`,
  });
  assert.equal(audit.ok, true);
});

test('the explicit selected-tool path survives a simultaneous blank conclusion', () => {
  assert.equal(
    tutorStubLearnerSelectedToolMarkPath(
      'The blanks came from the old weir-forge; no striker is named until a repeated die-mark is matched.',
    ),
    true,
  );
});

test('holding an unproved graver link open is not itself a selected tool-mark test', () => {
  assert.equal(
    tutorStubLearnerSelectedToolMarkPath(
      'Let us hold it open for the next public fact; neither the crucible nor the graver yet binds this particular coin to Verrell.',
    ),
    false,
  );
});

test('deterministic uptake preserves blanks withheld pending an alloy match', () => {
  const learnerText = 'I will leave the blanks unplaced until the mint-yard leavings match their poor alloy.';
  const uptake = deterministicTutorStubLearnerUptake({ learnerText });

  assert.match(uptake, /blanks/iu);
  assert.match(uptake, /unplaced|unassigned/iu);
  assert.match(uptake, /alloy|metal/iu);

  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: { turn: { summary: 'The learner withholds source attribution pending a match.' } },
    registerSelection: { response_configuration: { action_family: 'stage_next_step' } },
    dramaticReleaseFrame: { active: true },
  });
  const audit = auditTutorStubResponseComposition({
    learnerText,
    frame,
    text: `${uptake} I lay the graver beside the shilling for the next public comparison.`,
  });
  assert.equal(audit.ok, true);
});

test('a fused scene opening can acknowledge withheld attribution with rightly', () => {
  const learnerText = 'I will leave the blanks unplaced until the mint-yard leavings match their poor alloy.';
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: { turn: { summary: 'The learner withholds source attribution pending a match.' } },
    registerSelection: { response_configuration: { action_family: 'stage_next_step' } },
    dramaticReleaseFrame: { active: true },
  });
  const audit = auditTutorStubResponseComposition({
    learnerText,
    frame,
    text: 'I hold the shilling beside the untouched cupel: rightly so—the blanks still await the leavings’ answer. I lay the graver beside it for the next public comparison.',
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'fused_opening');
});

test('deterministic uptake preserves a lab source-versus-custody boundary', () => {
  const learnerText =
    'Then Larkin is the likely exposure source because its split gasket let G17 leak out; we still need custody evidence that Corvat was inside.';
  const uptake = deterministicTutorStubLearnerUptake({ learnerText });

  assert.match(uptake, /Larkin/iu);
  assert.match(uptake, /G17|exposure/iu);
  assert.match(uptake, /Corvat/iu);
  assert.match(uptake, /unproved|missing/iu);

  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: { turn: { summary: 'The learner distinguishes source risk from custody.' } },
    registerSelection: { response_configuration: { action_family: 'stage_next_step' } },
    dramaticReleaseFrame: { active: true },
  });
  const audit = auditTutorStubResponseComposition({
    learnerText,
    frame,
    text: `${uptake} I open the overnight booking sheet beside the Larkin shelf.`,
  });

  assert.equal(audit.ok, true);
});

function traceFrame() {
  return buildTutorStubResponseCompositionFrame({
    learnerText: "nothing - doesn't prove he did it, just confirms he's a suspect",
    classification: {
      turn: {
        summary: 'Correctly limits what the badge log establishes.',
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'challenge',
        evidence_use: 'cites_public_evidence',
        epistemic_stance: 'grounded',
        pedagogical_need: 'Identify the additional required evidence.',
      },
    },
    tutorLearnerDag: {
      model: {
        assessment: {
          status: 'available',
          bottleneck: 'release_or_pacing_gap',
          bestPathCoverage: 0,
          missingPremiseCount: 3,
        },
        metrics: { groundedCount: 2 },
      },
      advance: { pace: 'advancing', supportedMoveCount: 1, adoptedPremiseCount: 1 },
    },
    registerSelection: {
      expected_dag_move: 'Move one missing public premise into the learner-owned record.',
      expected_field_move: 'Create a learner-owned public move.',
      response_configuration: {
        engagement_stance: 'charismatic',
        action_family: 'answer_accountably',
        audience_register: 'domain_apprentice',
        lexical_accessibility: 'standard',
        scene_immersion: 'immersive',
      },
    },
    dramaticReleaseFrame: { active: true },
    dialogueClosureFrame: { phase: 'open', mandatory: false },
  });
}

test('response composition maps the selected action to uptake and the DAG move to development', () => {
  const frame = traceFrame();
  assert.equal(frame.delivery.atomic_assistant_turn, true);
  assert.equal(frame.delivery.public_history_messages, 1);
  assert.equal(frame.delivery.internal_functions, 2);
  assert.equal(frame.delivery.display_beats, 1);
  assert.equal(frame.delivery.public_shape, 'continuous_performance');
  assert.equal(frame.action_target, 'uptake');
  assert.equal(frame.uptake.action_family, 'answer_accountably');
  assert.equal(frame.development.action_family, null);
  assert.equal(frame.development.kind, 'dramatic_clue_release');
  assert.match(frame.development.expected_dag_move, /missing public premise/u);
  assert.equal(frame.shared_realization.engagement_stance, 'charismatic');

  const prompt = tutorStubResponseCompositionPrompt(frame);
  assert.match(prompt, /one atomic assistant turn/u);
  assert.match(prompt, /one continuous public performance/u);
  assert.match(prompt, /answer_accountably/u);
  assert.match(prompt, /Correctly limits what the badge log establishes/u);
  assert.match(prompt, /do not let the release erase the learner uptake/u);
  assert.doesNotMatch(prompt, /p_noon|p_crew/u);
});

test('a DAG-progression action is realized in development while uptake remains learner-responsive', () => {
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText: 'I follow the first clue. What comes next?',
    classification: { turn: { summary: 'The learner is ready for the next public clue.' } },
    registerSelection: {
      expected_dag_move: 'Stage one missing public premise.',
      response_configuration: {
        engagement_stance: 'brisk',
        action_family: 'stage_next_step',
        audience_register: 'domain_apprentice',
        lexical_accessibility: 'standard',
        scene_immersion: 'immersive',
      },
    },
  });

  assert.equal(frame.action_target, 'development');
  assert.equal(frame.uptake.action_family, null);
  assert.equal(frame.development.action_family, 'stage_next_step');
  const prompt = tutorStubResponseCompositionPrompt(frame);
  assert.match(prompt, /2\. Continue:[\s\S]*stage_next_step/u);
  assert.doesNotMatch(prompt, /1\. Respond:[^\n]*stage_next_step/u);
});

test('a responsive model draft is segmented into uptake and development without changing its words', () => {
  const frame = traceFrame();
  const text =
    'Exactly—Dario’s presence keeps him in view, but it does not prove he touched the lunchbox. “I issued one more noon badge from my front desk: visitor code WF-11.” What does that change?';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText: "nothing - doesn't prove he did it, just confirms he's a suspect",
  });

  assert.equal(audit.ok, true);
  assert.match(audit.segments.uptake, /does not prove/u);
  assert.match(audit.segments.development, /front desk/u);
  assert.equal(formatTutorStubResponseComposition(audit), `${audit.segments.uptake} ${audit.segments.development}`);
  assert.doesNotMatch(formatTutorStubResponseComposition(audit), /\n\s*\n/u);
});

test('a generic prefix does not make a verbatim learner echo acceptable uptake', () => {
  const frame = traceFrame();
  const learnerText = 'We must compare the shilling’s streak with the crucible leavings’ alloy mark.';
  const audit = auditTutorStubResponseComposition({
    text: `${learnerText.replace(/^We/u, 'That limit stands: We')} I press the broad graver beside the coin. What does it establish?`,
    frame,
    learnerText,
  });

  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'verbatim_learner_echo'));
});

test('a short necessary acknowledgement may reuse the learner’s public terms', () => {
  const frame = traceFrame();
  const audit = auditTutorStubResponseComposition({
    text: 'Right—it does not prove that. I mark the limit in the trial-book and leave the conclusion open.',
    frame,
    learnerText: "No, it doesn't prove that.",
  });

  assert.equal(audit.issues.some((issue) => issue.type === 'verbatim_learner_echo'), false);
});

test('too fast is a direct corrective uptake when the learner has overreached', () => {
  const learnerText =
    'With the G17 swab and the perished gasket, Larkin is the confirmed route into the Corvat flasks.';
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: {
      turn: {
        summary: 'The learner overstates an active source as a confirmed route into Corvat.',
        request_type: 'answer_seeking_or_overreach',
      },
    },
    registerSelection: { response_configuration: { action_family: 'clarify_distinction' } },
  });
  const audit = auditTutorStubResponseComposition({
    learnerText,
    frame,
    text: 'Too fast. I set the G17 swab beside Larkin’s cracked gasket and leave the Corvat flasks apart: together, the swab and failed seal make Larkin an active source of G17, not yet the route into those flasks.',
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.uptake, 'Too fast.');
});

test('an in-scene rightly-entered opening visibly acknowledges a trial-book inference', () => {
  const frame = traceFrame();
  const text =
    'I run my fingernail round the shilling’s rim: rightly entered. Edony’s hand supplied the blank; the striker still requires the hand that cut its die.';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText:
      'I enter: Edony alone controlled the weir crucible and thus cast the debased blanks, though this still does not show who struck them.',
  });
  assert.equal(audit.issues.some((issue) => issue.type === 'generic_learner_uptake'), false);
});

test('a clue rehearsal without learner uptake fails composition even when it develops the lesson', () => {
  const frame = traceFrame();
  const audit = auditTutorStubResponseComposition({
    text: 'Front-desk clerk, finger on the badge log: “Visitor code WF-11.” What does this entry change?',
    frame,
    learnerText: "nothing - doesn't prove he did it, just confirms he's a suspect",
  });

  assert.equal(audit.ok, false);
  assert.equal(audit.segments.method, 'development_only');
  assert.deepEqual(audit.issues.map((issue) => issue.type), ['missing_learner_uptake']);
});

test('marking the learner distinction in the scene counts as fused uptake', () => {
  const frame = traceFrame();
  const learnerText =
    'It rules out clipping as the cause of their lightness, but does not tell us whose melt supplied the dross.';
  const text =
    'I mark that beside the cupel: the false shillings were struck from debased metal, yet their melt remains unassigned. To bind that dross to any crucible, we need the crucible’s leavings to answer the same way.';
  const audit = auditTutorStubResponseComposition({ text, frame, learnerText });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'fused_opening');
  assert.match(audit.segments.uptake, /I mark that beside the cupel/u);
});

test('an uppercase first-person scene action is development, not preservable learner uptake', () => {
  const frame = traceFrame();
  const text =
    'I open the badge log at the noon line: “I issued visitor code WF-11 to the outside crew.” What does that establish?';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText: "nothing - doesn't prove he did it, just confirms he's a suspect",
  });

  assert.equal(audit.segments.method, 'development_only');
  assert.equal(audit.segments.uptake, '');
  assert.equal(audit.segments.development, text);
  assert.equal(audit.ok, false);
  assert.deepEqual(audit.issues.map((issue) => issue.type), ['missing_learner_uptake']);
});

test('a scene action can fuse learner uptake into its first sentence without becoming two replies', () => {
  const frame = traceFrame();
  const text =
    'I set the balance beneath a light shilling: “Weight, ring, and touchstone first”—that keeps your proposed test in view. I tap the assay and read its line. What changes?';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText: 'I would record weight, ring, and touchstone before naming anyone.',
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'fused_opening');
  assert.match(audit.segments.uptake, /Weight, ring, and touchstone/u);
  assert.equal(audit.segments.development, text);
  assert.equal(formatTutorStubResponseComposition(audit), text);
});

test('enacting the learner proposed touchstone comparison is fused uptake', () => {
  const frame = traceFrame();
  const learnerText =
    'I would first mark a fair shilling against one of the light pieces on the touchstone.';
  const text =
    'I set the two shillings upon the touchstone; that comparison may show what differs in their metal, but not yet whose hand struck either coin. A witness gives the next public entry.';
  const audit = auditTutorStubResponseComposition({ text, frame, learnerText });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'fused_opening');
  assert.match(audit.segments.uptake, /touchstone/u);
});

test('thou hast it is a direct period-appropriate acknowledgement', () => {
  const frame = traceFrame();
  const learnerText =
    'The graver may connect Verrell to a die, but it does not connect this blank to his crucible.';
  const text =
    'Thou hast it: Verrell’s sole graver could connect him to a die, yet the coin still lacks a proved link to his crucible. We need the dross alloy itself to answer to a particular crucible.';
  const audit = auditTutorStubResponseComposition({ text, frame, learnerText });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'first_sentence');
});

test('opening the requested custody record is a fused direct answer', () => {
  const frame = traceFrame();
  const learnerText = 'What custody evidence links the weir-forge’s cast blanks to a particular person?';
  const text =
    'I open the charcoal book beside the cold crucible: “I keep this account exact. Since the forge shut, one hand alone has drawn the weir crucible.” What does that make the named hand’s connection to this blank?';
  const audit = auditTutorStubResponseComposition({ text, frame, learnerText });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'fused_opening');
  assert.match(audit.segments.uptake, /open the charcoal book/u);
});

test('leaving an evidentiary line unentered visibly takes up a learner who withholds judgment', () => {
  const frame = traceFrame();
  const text =
    'I leave that line unentered and close the trial-book over it. The graver is only a bench tool until the shilling itself bears its particular flaw. Take the moment—what part of the die’s mark would you want made clear when we examine it?';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText: 'I will wait for the die-flaw itself before entering any link to Verrell’s graver.',
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'fused_opening');
  assert.match(audit.segments.uptake, /leave that line unentered/u);
  assert.equal(formatTutorStubResponseComposition(audit), text);
});

test('a learner-responsive question before quoted role speech is not mistaken for a stage direction', () => {
  const frame = traceFrame();
  const text =
    'Which public mark would you test next, and what would it show? “I have the front-desk log open at the exact line: visitor code WF-11 went to the outside crew.” What does that establish?';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText: 'I would test the newest public mark before deciding.',
  });

  assert.equal(audit.segments.method, 'first_sentence');
  assert.match(audit.segments.uptake, /^Which public mark/u);
  assert.match(audit.segments.development, /^“I have the front-desk log/u);
  assert.equal(audit.ok, true);
});

test('a precise in-scene acknowledgement counts as fused learner uptake', () => {
  const frame = traceFrame();
  const text =
    'I tap the balance beam: precisely. Verrell’s use of the crucible could place the blank in his hand, but casting is not yet striking. What is still missing: the blank, the die, or the finished coin?';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText:
      'If the metal led to Verrell’s crucible, that might support his casting the blank but not prove he struck it.',
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'fused_opening');
});

test('scene action followed by immediate acknowledgement remains one fused response beat', () => {
  const frame = traceFrame();
  const text =
    'I tap the balance beam. Just so: the licence speaks only if the blank first came from that crucible. What metal mark would make that link firm?';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText:
      'Any such blank was cast under Verrell’s sole licence, but that does not prove he struck the shillings.',
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'fused_opening');
  assert.match(audit.segments.uptake, /Just so/u);
});

test('world-specific handling followed by acknowledgement remains one fused response beat', () => {
  const frame = traceFrame();
  const text =
    'I turn the shilling beneath the touch-needle. Precisely: Verrell’s licence matters only if the coin’s blank can be tied to that crucible. Passing at Marrick proves no such tie; the metal’s alloy must bear it.';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText:
      'It establishes Verrell alone holds the mint-yard licence; the assay must still show these shillings were cast there, and not merely passed at Marrick.',
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'fused_opening');
  assert.match(audit.segments.uptake, /Precisely/u);
});

test('a deictic record-keeping act directly takes up the learner contribution', () => {
  const frame = traceFrame();
  const text =
    'I mark that distinction in the trial-book. Verrell’s sole hand at the crucible matters only if these shillings’ blanks can be tied to that crucible. The balance and touchstone have not yet spoken to that link.';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText:
      'It points toward Verrell’s access to casting, but it does not yet prove he made these particular shillings.',
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'first_sentence');
  assert.equal(audit.segments.uptake, 'I mark that distinction in the trial-book.');
});

test('a deictic reference to the learner’s observed marks is direct uptake', () => {
  const frame = traceFrame();
  const text =
    'I touch the bent shilling to the balance: those marks show bad metal, but not yet whose hand struck it. From the hall door comes the assayer’s ready claim: “Verrell alone draws the mint-yard crucible.” What does that tell us about Verrell—and what does it still leave unproved?';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText: 'Let us first mark what is plain: the shillings are light, ring wrong, and bend to the tooth.',
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'first_sentence');
  assert.match(audit.segments.uptake, /those marks show bad metal/u);
});

test('a direct first-person answer takes up the learner’s explicit question', () => {
  const frame = traceFrame();
  const text =
    'I would, but I will not call it proof before the metal speaks. I set the balance beside the shillings and wait for the assay.';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText: 'Would you have the shillings examined publicly, you?',
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'first_sentence');
  assert.match(audit.segments.uptake, /^I would/u);
});

test('scene action and quoted correction can jointly take up the learner contribution', () => {
  const frame = traceFrame();
  const text =
    'I tap the trial-book’s margin. “Clipping is ruled out; these were struck as poor coin.” But the alloy does not yet name the crucible. Which part needs clarifying?';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText: 'Trial-book: clipping is ruled out, so the shillings were made light in casting.',
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'fused_opening');
});

test('a scene action followed by a direct did-not correction takes up a false learner claim', () => {
  const frame = traceFrame();
  const text =
    'I set the gasket beside the sequencing report. The gasket did not supply G17; it breached the chamber that held G17. The chamber’s resident strain reached Corvat during its overnight stay—does that distinction now fit the records?';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText: 'The cracked gasket supplied the G17 from the Larkin chamber into Corvat’s flasks overnight.',
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'fused_opening');
  assert.match(audit.segments.uptake, /did not supply G17/u);
});

test('a scene action followed by an auxiliary-negated correction takes up a premature inference', () => {
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText:
      'It establishes that the Larkin unit was carrying the same G17 that ruined Corvat, so it is already the likely source.',
    classification: {
      turn: {
        summary: 'The learner prematurely identifies Larkin as the source.',
        request_type: 'answer_seeking_or_overreach',
        discourse_move: 'inference',
      },
    },
    registerSelection: {
      response_configuration: { action_family: 'stage_next_step' },
    },
    dramaticReleaseFrame: { active: true },
  });
  const text =
    'I hold up the quarantine record beside the swab. It establishes that G17 was living in the Larkin unit, but we have not identified the contaminant in Corvat yet—or shown the incubator could expose anything. The ruined line deserves that distinction.';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText:
      'It establishes that the Larkin unit was carrying the same G17 that ruined Corvat, so it is already the likely source.',
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.segments.method, 'fused_opening');
  assert.match(audit.segments.uptake, /we have not identified/iu);
});

test('a mislabelled declarative answer does not become a fair-question uptake', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'It establishes that a blank from that crucible was cast by Verrell.',
    classification: {
      turn: {
        request_type: 'conceptual_clarity_request',
        discourse_move: 'inference',
      },
    },
    actionFamily: 'stage_next_step',
  });

  assert.equal(uptake, 'I hear the point; the next public fact must answer it.');
});

test('configured non-release fallback stays current instead of rehearsing the clue and rule', () => {
  const text = deterministicTutorStubConfiguredContinuationFallback({
    uptake: 'That is a possible conclusion, but the public evidence does not settle it yet.',
    responseConfiguration: {
      engagement_stance: 'precise',
      action_family: 'stage_next_step',
      actorial_part: 'skeptic',
    },
    support: {
      modality: 'bounded_directional_choice',
      answerability: 'direction_only_until_evidence_is_public',
      clarificationInvitationRequired: true,
    },
    world: {
      setting: 'The trial-book lies open beside a crucible and a false shilling.',
      question: 'Whose hand struck the false shillings?',
    },
    learnerText: 'The crucible might show who cast the blank, but not who struck the shilling.',
  });

  assert.match(text, /^That is a possible conclusion/iu);
  assert.match(text, /Not so fast—I hold that claim against the (?:shilling|crucible)/u);
  assert.match(text, /ask me to clarify a word or connection\?/u);
  assert.doesNotMatch(text, /Here is the concrete clue|In plain terms|A blank is the work|Whose hand struck/iu);
});

test('record-keeper fallback does not duplicate an uptake that already enters the distinction', () => {
  const text = deterministicTutorStubConfiguredContinuationFallback({
    uptake: 'I mark that distinction in the trial-book.',
    responseConfiguration: {
      engagement_stance: 'precise',
      action_family: 'stage_next_step',
      actorial_part: 'record_keeper',
    },
    support: { answerability: 'direction_only_until_evidence_is_public' },
    world: { setting: 'The trial-book lies open beside a crucible.' },
    learnerText: 'The alloy names no maker.',
  });

  assert.equal((text.match(/trial-book/gu) || []).length, 1);
  assert.doesNotMatch(text, /mark that distinction.+enter that distinction/iu);
});

test('record-keeper fallback does not duplicate a first-person record action before the book is named', () => {
  const text = deterministicTutorStubConfiguredContinuationFallback({
    uptake: 'I mark that beside the balance: the crucible matters only if the alloy answers to it.',
    responseConfiguration: {
      engagement_stance: 'plain',
      action_family: 'stage_next_step',
      actorial_part: 'record_keeper',
    },
    support: { answerability: 'direction_only_until_evidence_is_public' },
    world: { setting: 'The trial-book lies open beside a crucible and a balance.' },
    learnerText: 'The alloy must match before the crucible bears on these shillings.',
  });

  assert.match(text, /^I mark that beside the balance:/u);
  assert.doesNotMatch(text, /I enter that distinction/iu);
  assert.equal((text.match(/\b(?:mark|enter|note|record|write)\b/giu) || []).length, 1);
});

test('configured fallback makes charismatic advocate counterpressure visible to the strict auditor', () => {
  const responseConfiguration = {
    engagement_stance: 'charismatic',
    action_family: 'stage_next_step',
    audience_register: 'adult_novice',
    lexical_accessibility: 'plain',
    scene_immersion: 'immersive',
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: {
      id: 'dramatic_counterpressure',
      label: 'dramatic counterpressure',
    },
  };
  const world = {
    setting: 'The Tallow Street meeting room, with the minute-book open beside the depot motion.',
    question: 'What browns out Tallow Street every Thursday evening?',
  };
  const text = deterministicTutorStubConfiguredContinuationFallback({
    uptake: 'Yes: record that the lamps began to dim before the depot chargers switched on.',
    responseConfiguration,
    support: { answerability: 'direction_only_until_evidence_is_public' },
    world,
    learnerText: 'Could you choose what conclusion we should record from that gap?',
  });
  const audit = auditTutorStubResponseConfiguration({
    text,
    configuration: responseConfiguration,
    world,
    composition: {
      uptake: 'Yes: record that the lamps began to dim before the depot chargers switched on.',
      development: text,
    },
  });

  assert.match(text, /press the (?:record|minute-book) against the room’s easy verdict/iu);
  assert.equal(audit.actorial_realization.ok, true, JSON.stringify(audit.actorial_realization));
  assert.equal(audit.axes.engagement_stance.visible, true);
  assert.equal(audit.axes.action_family.visible, true);
  assert.equal(audit.transcript_visible, true);
});

test('the deterministic uptake is public, learner-specific, and action-aware', () => {
  assert.equal(
    deterministicTutorStubLearnerUptake({
      learnerText: "nothing - doesn't prove he did it, just confirms he's a suspect",
      classification: { turn: { request_type: 'authority_refusal_or_status_challenge' } },
      actionFamily: 'answer_accountably',
    }),
    'You’re right to separate suspicion from proof.',
  );
  assert.equal(
    deterministicTutorStubLearnerUptake({
      learnerText: 'Let us first look upon the assay.',
      classification: { turn: { request_type: 'stepwise_support_request' } },
      actionFamily: 'stage_next_step',
    }),
    'That is the right order: test the public evidence before naming a hand.',
  );
  assert.equal(
    deterministicTutorStubLearnerUptake({
      learnerText:
        'I enter: no repeated die-flaw has yet tied the false shillings to a die cut by Verrell’s broad graver, so no hand can yet be named.',
      classification: { turn: { request_type: 'stepwise_support_request' } },
      actionFamily: 'stage_next_step',
    }),
    'You have kept the graver tied to its owner without pretending it has marked this coin.',
  );
});

test('evidence adoption names the learner\'s record instead of using a generic transition', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'The badge log puts Dario in the kitchen at noon, so I will keep that clue in the record.',
    classification: {
      turn: {
        request_type: 'stepwise_support_request',
        discourse_move: 'evidence_adoption',
      },
    },
    actionFamily: 'stage_next_step',
  });

  assert.match(uptake, /badge log/iu);
  assert.match(uptake, /public record|evidence/iu);
  assert.doesNotMatch(uptake, /what you have established/iu);
});

test('Marrick source-and-striker gaps receive a concrete acknowledgement', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText:
      'What remains unshown is that these light shillings were cast at Marrick at all, and that Verrell struck them.',
    classification: {
      turn: {
        request_type: 'stepwise_support_request',
        discourse_move: 'inference',
      },
    },
    actionFamily: 'stage_next_step',
    world: {
      id: 'world_005_marrick',
      title: 'The Light Shillings',
      question: 'Whose hand struck the false shillings passed at the Marrick fair?',
    },
  });

  assert.equal(
    uptake,
    'You have kept both gaps open: these shillings are not yet tied to Marrick’s crucible, and no striking hand is proved.',
  );
  assert.doesNotMatch(uptake, /evidentiary distinction|inference stands|proof step/iu);
});

test('deterministic uptake preserves a settled blank source while leaving the die trail open', () => {
  const learnerText =
    'The divide is clear: the blank names the weir-forge, but nothing yet connects this shilling’s die to Verrell.';
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText,
    classification: {
      turn: {
        request_type: 'stepwise_support_request',
        discourse_move: 'inference',
      },
    },
    actionFamily: 'reanchor_public_evidence',
    world: {
      id: 'world_005_marrick',
      title: 'The Light Shillings',
    },
  });

  assert.equal(
    uptake,
    'You have kept the blank’s known source separate from the still-unproved die trail.',
  );

  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: { turn: { summary: 'Separates the blank source from the open die trail.' } },
    registerSelection: { action_family: 'reanchor_public_evidence' },
    dramaticReleaseFrame: {
      active: true,
      entries: [{ surface: 'Twelve shillings bear the same square notch in the R.' }],
    },
  });
  const audit = auditTutorStubResponseComposition({
    learnerText,
    frame,
    text: `${uptake} I set twelve shillings beneath the glass: each bears the same square notch in the R. What does that shared flaw show?`,
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.issues.some((issue) => issue.type === 'generic_learner_uptake'), false);
});

test('generic safe uptake avoids evaluator vocabulary in public speech', () => {
  const bounded = deterministicTutorStubLearnerUptake({
    learnerText: 'Then we must weigh the sample before naming anyone.',
    classification: { turn: { request_type: 'stepwise_support_request', discourse_move: 'claim' } },
    actionFamily: 'stage_next_step',
  });
  const inferred = deterministicTutorStubLearnerUptake({
    learnerText: 'The public entry supports the stated date.',
    classification: {
      turn: { request_type: 'stepwise_support_request', discourse_move: 'inference' },
    },
    actionFamily: 'stage_next_step',
  });

  assert.equal(bounded, 'I hear the limit; we will not claim more than you have shown.');
  assert.equal(inferred, 'I enter what you have established and leave the unanswered part open.');
  assert.doesNotMatch(`${bounded} ${inferred}`, /evidentiary|inference stands|proof step/iu);
});

test('Marrick’s caster-versus-striker gap names both missing hands without stock language', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'Trial-book: the weir-forge fixes the shillings’ blank, but shows neither who cast it nor who struck the coins.',
    classification: {
      turn: { request_type: 'stepwise_support_request', discourse_move: 'inference' },
    },
    actionFamily: 'stage_next_step',
    world: { id: 'world_005_marrick', title: 'The Light Shillings' },
  });

  assert.equal(
    uptake,
    'You have left both hands unnamed: who cast the blank, and who struck it into coin.',
  );
  assert.doesNotMatch(uptake, /enough for now|evidentiary|contribution/iu);
});

test('Edony’s crucible access is not misread as an unproved source match', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText:
      'It adds that Edony alone had recorded access to the weir crucible and its charcoal, but it still does not show she struck these shillings.',
    classification: {
      turn: { request_type: 'stepwise_support_request', discourse_move: 'inference' },
    },
    actionFamily: 'stage_next_step',
    world: { id: 'world_005_marrick', title: 'The Light Shillings' },
  });

  assert.equal(
    uptake,
    'You have separated Edony’s control of the weir crucible from proof that she struck the coins.',
  );
  assert.doesNotMatch(uptake, /source crucible still unproved|alloy link provisional/iu);
});

test('Edony controlled-and-cast wording preserves the established caster and open striker', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText:
      'I enter: Edony alone controlled the weir crucible and thus cast the debased blanks, though this still does not show who struck them.',
  });
  assert.match(uptake, /Edony’s control/iu);
  assert.match(uptake, /proof that she struck/iu);
  assert.doesNotMatch(uptake, /sole custodian is the fact still missing|source crucible still unproved/iu);
});

test('an established blank source is not reopened while the responsible hands remain unknown', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText:
      'The shilling’s blank was cast from the weir-forge crucible’s alloy, which does not yet put it in Verrell’s hand.',
  });
  assert.match(uptake, /blank.*(?:source|leads).*weir-forge crucible/iu);
  assert.match(uptake, /(?:caster and striker|hand that cast or struck)/iu);
  assert.doesNotMatch(uptake, /source crucible (?:still )?unproved|crucible that supplied it remains open/iu);
});

test('mentioning a crucible status while choosing the die-face does not become a two-exhibit request', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText:
      'Trial-book: The shilling is false metal, but its source crucible remains unproved; let us inspect the die-face next.',
    classification: { turn: { request_type: 'stepwise_support_request', discourse_move: 'request' } },
  });
  assert.match(uptake, /die|graver|tool/iu);
  assert.doesNotMatch(uptake, /selected both exhibits|test the crucible first/iu);
});

test('a learner selecting Marrick’s graver and crucible keeps both examination paths visible', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'I will mark Verrell’s graver and crucible for examination.',
    classification: {
      turn: { request_type: 'off_task_or_mixed', discourse_move: 'claim' },
    },
    actionFamily: 'stage_next_step',
    world: {
      id: 'world_005_marrick',
      title: 'The Light Shillings',
    },
  });

  assert.equal(
    uptake,
    'You have selected both exhibits: I will test the crucible first and keep the graver beside it for its own comparison.',
  );
  assert.match(uptake, /crucible/iu);
  assert.match(uptake, /graver/iu);
});

test('a learner’s coin-to-coin assay is not replaced by a crucible comparison', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText:
      'I would first examine the light shillings themselves by touchstone and balance, and enter how their metal differs from a true shilling.',
    classification: {
      turn: { request_type: 'stepwise_support_request', discourse_move: 'claim' },
    },
    actionFamily: 'stage_next_step',
    world: { id: 'world_005_marrick', title: 'The Light Shillings' },
  });

  assert.equal(
    uptake,
    'You have chosen the coins themselves first: compare the light shilling with a true one by balance and touchstone.',
  );
  assert.doesNotMatch(uptake, /crucible|leavings/iu);
});

test('a learner searching the Marrick hall receives scene-specific uptake', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'I would look about the hall for the first coin or witness to enter in the trial-book.',
    classification: { turn: { request_type: 'off_task_or_mixed', discourse_move: 'claim' } },
    actionFamily: 'stage_next_step',
    world: { id: 'world_005_marrick', title: 'The Light Shillings' },
  });

  assert.equal(uptake, 'We will begin with the first public coin or witness the hall can supply.');
  assert.doesNotMatch(uptake, /contribution|proposed next move|evidence develops/iu);
});

test('a learner withholding names before the Marrick assay receives a concrete trial-book response', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'Let us observe the assay’s order first; no proof is entered yet.',
    classification: { turn: { request_type: 'stepwise_support_request', discourse_move: 'claim' } },
    actionFamily: 'stage_next_step',
    world: { id: 'world_005_marrick', title: 'The Light Shillings' },
  });

  assert.equal(uptake, 'Agreed—no name enters the trial-book before the assay has something to show.');
  assert.doesNotMatch(uptake, /enough for now|evidentiary|contribution/iu);
});

test('deterministic uptake avoids a substantial opener used in recent tutor turns', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'I will make one public move.',
    classification: { turn: { request_type: 'stepwise_support_request' } },
    actionFamily: 'stage_next_step',
    recentTutorTexts: [
      'Your proposed move sets our next public check. I open the register.',
    ],
  });

  assert.equal(uptake, 'We will test what you proposed against the next public evidence.');
});

test('alloy-boundary uptake stays fresh after both common phrasings were used', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'The alloy still has no proved source until it matches one crucible’s leavings.',
    classification: { turn: { request_type: 'stepwise_support_request' } },
    actionFamily: 'stage_next_step',
    recentTutorTexts: [
      'You have kept the alloy link provisional until one crucible’s leavings answer it. We continue.',
      'That leaves the metal observed but its source crucible still unproved. We continue.',
    ],
  });

  assert.equal(uptake, 'The metal is now described, while the crucible that supplied it remains open.');
});

test('deterministic uptake keeps a learner-proposed die test visible while another record enters', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'I would look for a repeated die flaw traceable to a particular graver.',
    classification: { turn: { request_type: 'stepwise_support_request' } },
    actionFamily: 'stage_next_step',
  });

  assert.equal(
    uptake,
    'That is the right tool-mark test; keep the shared flaw before us.',
  );
});

test('a must-compare die proposal outranks generic uncertainty handling', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'Then we must compare the false shilling’s die-mark with a die Verrell controlled.',
    classification: { turn: { request_type: 'stepwise_support_request', discourse_move: 'metacognitive_reflection' } },
  });
  assert.match(uptake, /tool-mark test|die test/iu);
  assert.doesNotMatch(uptake, /kept the graver tied to its owner|work on these shillings still unproved/iu);
});

test('deterministic uptake specifically credits a two-part metal and tool-mark examination plan', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'I would first examine the shillings’ weight and metal, then compare their marks with Verrell’s tools.',
    classification: { turn: { request_type: 'off_task_or_mixed', discourse_move: 'claim' } },
    actionFamily: 'reanchor_public_evidence',
  });

  assert.equal(
    uptake,
    'Your plan keeps the blank’s metal test separate from the die’s tool-mark comparison.',
  );
  assert.doesNotMatch(uptake, /contribution|proposed next move/u);
});

test('trial-book mark used as a verb does not invent a die-mark test', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'Let us first assay the shillings’ weight and silver; that is matter enough to mark before naming any hand.',
    classification: { turn: { request_type: 'stepwise_support_request', discourse_move: 'claim' } },
    actionFamily: 'stage_next_step',
  });

  assert.doesNotMatch(uptake, /die|tool-mark/u);
});

test('deterministic uptake credits a completed clipping inference as an inference, not a proposed move', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'It rules out clipping of true shillings; these coins were made anew from debased metal.',
    classification: { turn: { request_type: 'stepwise_support_request', discourse_move: 'inference' } },
    actionFamily: 'stage_next_step',
  });

  assert.equal(uptake, 'You have separated newly struck dross from clipped true coin.');
  assert.doesNotMatch(uptake, /proposed|next move/u);
});

test('deterministic uptake credits an access-versus-proof inference instead of calling it a proposal', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'It protects us from mistaking Verrell’s access to the crucible for proof that he made this coin.',
    classification: { turn: { request_type: 'stepwise_support_request', discourse_move: 'inference' } },
    actionFamily: 'reanchor_public_evidence',
  });

  assert.equal(uptake, 'You have separated access from proof that this hand made the coin.');
  assert.doesNotMatch(uptake, /proposed|next move/u);
});

test('mentioning an unproved die is not itself treated as a proposed tool-mark test', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'No evidence yet ties the blank or its striking die to his hand.',
    classification: { turn: { request_type: 'stepwise_support_request' } },
    actionFamily: 'stage_next_step',
  });

  assert.equal(uptake, 'You have kept the graver tied to its owner without pretending it has marked this coin.');
});

test('a modal die-mark proposal is acknowledged without confusing striking with the blank path', () => {
  const learnerText = 'The shilling itself must bear a die-mark matching a die proved to be in Verrell’s hand.';
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText,
    classification: {
      turn: {
        request_type: 'answer_seeking_or_overreach',
        summary: 'Proposes the die path when the question asks about the blank path.',
      },
    },
    actionFamily: 'stage_next_step',
  });
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: {
      turn: {
        request_type: 'answer_seeking_or_overreach',
        summary: 'Proposes the die path when the question asks about the blank path.',
      },
    },
    registerSelection: { action_family: 'stage_next_step' },
    dramaticReleaseFrame: { active: false },
  });
  const audit = auditTutorStubResponseComposition({
    text: `${uptake} I set the shilling between us so we can test the distinction together.`,
    frame,
    learnerText,
  });

  assert.equal(
    uptake,
    'You have named a coin-specific die-mark test, but it tests striking rather than which crucible supplied the blank.',
  );
  assert.equal(audit.ok, true);
});

test('what is public inside a declarative evidence boundary is not mistaken for a comprehension request', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'Let us test it against what is public: Verrell’s graver is his alone, but no flaw yet links it to these coins.',
    classification: { turn: { request_type: 'stepwise_support_request' } },
    actionFamily: 'reanchor_public_evidence',
  });

  assert.equal(uptake, 'You have kept the graver tied to its owner without pretending it has marked this coin.');
});

test('explicit alloy boundary outranks a resistant-profile misclassification', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'I keep it open: Verrell alone casts here, but these shillings are not yet tied to his crucible.',
    classification: { turn: { request_type: 'resistance_or_low_agency', discourse_move: 'challenge' } },
    actionFamily: 'challenge_resistance',
  });

  assert.match(uptake, /kept|left/iu);
  assert.match(uptake, /unplaced|unassigned|provisional/iu);
  assert.match(uptake, /alloy|crucible|leavings/iu);
  assert.doesNotMatch(uptake, /route is not giving you enough|lower the pressure/u);
});

test('a custody question after source attribution is not mistaken for a missing source match', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText:
      'Trial-book: We must learn who had custody of the weir-forge crucible after the founder died before naming the hand that cast these blanks.',
    classification: { turn: { request_type: 'stepwise_support_request', discourse_move: 'claim' } },
    actionFamily: 'stage_next_step',
  });

  assert.equal(
    uptake,
    'You have identified the remaining blank question: who alone controlled that source crucible.',
  );
  assert.doesNotMatch(uptake, /source crucible still unproved/u);
});

test('deterministic uptake directly answers an alloy-leavings question before development', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'What in the crucible leavings would need to match the shillings’ alloy before we tie them to Verrell’s fire?',
    classification: { turn: { request_type: 'conceptual_clarity_request', discourse_move: 'question' } },
    actionFamily: 'stage_next_step',
  });

  assert.match(uptake, /distinctive agreement/u);
  assert.match(uptake, /crucible’s leavings/u);
  assert.doesNotMatch(uptake, /fair question|answer that directly/u);
});

test('a direct cupelling question outranks a generic statement that the source remains open', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText:
      'Must the crucible leavings be cupelled to show the same copper and grey lead-sweat, rather than merely match by streak?',
    classification: { turn: { request_type: 'conceptual_clarity_request', discourse_move: 'question' } },
  });
  assert.match(uptake, /Cupelling|material comparison/iu);
  assert.match(uptake, /copper.*lead|copper and lead/iu);
  assert.match(uptake, /streak alone is too weak|not merely a similar-looking streak/iu);
  assert.doesNotMatch(uptake, /source crucible still unproved|metal observed/iu);
});

test('an inflected alloy-match question is not misrouted to the die-mark answer', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'Which crucible’s mark matches the alloy on this light shilling?',
  });

  assert.match(uptake, /crucible’s leavings|crucible’s residue/u);
  assert.doesNotMatch(uptake, /nick|burr|die-cutting tool/u);
});

test('deterministic uptake directly answers a proposed examination question', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'Shall I first assay whether the light shillings bear the proper silver content?',
    classification: { turn: { request_type: 'conceptual_clarity_request', discourse_move: 'question' } },
    actionFamily: 'stage_next_step',
  });

  assert.match(uptake, /^Yes—begin with that public examination/u);
  assert.doesNotMatch(uptake, /fair question|answer that directly/u);
});

test('deterministic uptake recognizes beginning with the touchstone as a proposed examination', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'May we begin with the touchstone, you, and enter only what the metal shows?',
    classification: { turn: { request_type: 'stepwise_support_request', discourse_move: 'question' } },
    actionFamily: 'stage_next_step',
  });

  assert.match(uptake, /^Yes—begin with that public examination/u);
  assert.doesNotMatch(uptake, /needed match|crucible’s leavings/u);
});

test('deterministic uptake understands Marrick behold as an examination request', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'May I first behold one of the light shillings at the touchstone?',
    classification: { turn: { request_type: 'conceptual_clarity_request' } },
    actionFamily: 'stage_next_step',
  });

  assert.equal(
    uptake,
    'Yes—begin with that public examination; it can establish what the exhibit shows without naming a hand.',
  );
});

test('deterministic uptake credits a declarative assay plan before naming a hand', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText:
      'I would first assay the light shillings themselves—weight, ring, and touchstone mark—before naming Verrell’s hand.',
    classification: { turn: { request_type: 'unknown_request' } },
    actionFamily: 'ground_in_material',
  });

  assert.equal(uptake, 'You have set the right order: examine the public exhibit before entering any hand.');
});

test('a proposed metal test cannot be described as a completed evidentiary distinction', () => {
  const learnerText =
    'I would press first on the coin’s metal, to see whether it can be tied to the crucible’s leavings.';
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: { turn: { summary: 'Proposes testing the coin metal first.' } },
    registerSelection: {
      expected_dag_move: 'Stage the next public test.',
      response_configuration: { action_family: 'stage_next_step' },
    },
    dramaticReleaseFrame: { active: true },
  });
  const audit = auditTutorStubResponseComposition({
    text:
      'I keep that completed evidentiary distinction in the record as the case advances. I draw the shilling across the touchstone.',
    frame,
    learnerText,
  });

  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'proposed_move_misread_as_completed'));
  assert.equal(
    deterministicTutorStubLearnerUptake({ learnerText, actionFamily: 'stage_next_step' }),
    'Your proposed first test is clear: compare the coin’s metal with the crucible leavings.',
  );
});

test('an imperative assay plan cannot be described as a completed evidentiary distinction', () => {
  const learnerText =
    'First mark that the light shillings ring wrong and bend to the tooth; have a sample assayed before naming Verrell.';
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: { turn: { summary: 'Requests an assay before attribution.' } },
    registerSelection: {
      expected_dag_move: 'Stage the next public test.',
      response_configuration: { action_family: 'stage_next_step' },
    },
    dramaticReleaseFrame: { active: true },
  });
  const audit = auditTutorStubResponseComposition({
    text:
      'I keep that completed evidentiary distinction in the record as the case advances. I turn the shilling on the touchstone.',
    frame,
    learnerText,
  });

  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'proposed_move_misread_as_completed'));
  assert.equal(
    deterministicTutorStubLearnerUptake({ learnerText, actionFamily: 'stage_next_step' }),
    'You have set the right order: examine the public exhibit before entering any hand.',
  );
});

test('a correct conditional answer is not misread as a present claim', () => {
  const learnerText = 'If the metal answers to that crucible, its blank was cast by Verrell.';
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: { turn: { summary: 'Correctly answers the conditional question.' } },
    registerSelection: {
      expected_dag_move: 'Keep the metal match open.',
      response_configuration: { action_family: 'stage_next_step' },
    },
  });
  const audit = auditTutorStubResponseComposition({
    text:
      'That is a possible conclusion, but the public evidence does not settle it yet. I shift the balance aside and leave room beside the shilling.',
    frame,
    learnerText,
  });

  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'conditional_answer_misread_as_present_claim'));
  assert.equal(
    deterministicTutorStubLearnerUptake({
      learnerText,
      classification: { turn: { request_type: 'answer_seeking_or_overreach' } },
      actionFamily: 'stage_next_step',
    }),
    'Yes—if that metal match is established, the blank’s casting is tied to the sole hand at that crucible.',
  );
});

test('deterministic uptake credits a learner-specified trace-metal comparison', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText:
      'A matching trace-metal mark in the blanks and Verrell’s crucible melt would let the metal tie the two together.',
    classification: { turn: { request_type: 'unknown_request', discourse_move: 'inference' } },
    actionFamily: 'stage_next_step',
  });

  assert.equal(
    uptake,
    'That names the needed comparison: a distinctive trace-metal match between the blank and one crucible.',
  );
});

test('deterministic uptake directly answers what to enter first in the Marrick assay', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'What public matter shall I enter first, warden?',
    classification: { turn: { request_type: 'stepwise_support_request', discourse_move: 'question' } },
    actionFamily: 'stage_next_step',
    world: {
      id: 'world_005_marrick',
      title: 'The Light Shillings',
      discipline: 'Moneyer’s assay',
    },
  });

  assert.match(uptake, /shillings themselves/u);
  assert.match(uptake, /weight, ring, and touchstone mark/u);
  assert.doesNotMatch(uptake, /fair question|answer it before/u);
});

test('a first-turn clipping-versus-metal question receives a direct assay answer', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'May I first mark whether the shillings’ lightness is in the metal itself or only in their clipping?',
    classification: { turn: { request_type: 'conceptual_clarity_request', discourse_move: 'question' } },
  });
  assert.match(uptake, /^Yes/iu);
  assert.match(uptake, /balance and touchstone|first assay question/iu);
  assert.match(uptake, /clipped|clipping/iu);
  assert.match(uptake, /poor metal|debased coin/iu);
  assert.doesNotMatch(uptake, /alloy link provisional|source crucible/iu);
});

test('deterministic uptake directly answers a die-mark question before development', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'Which mark on the shilling could tie its die to the graver?',
    classification: { turn: { request_type: 'conceptual_clarity_request', discourse_move: 'question' } },
    actionFamily: 'stage_next_step',
  });

  assert.match(uptake, /repeated nick, burr, or crooked stroke/u);
  assert.doesNotMatch(uptake, /fair question|answer that directly/u);
});

test('a useful-mark answer visibly responds to a direct die-flaw question', () => {
  const learnerText = 'What die-flaw on the shilling could be matched uniquely to Verrell’s broad graver?';
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: { turn: { summary: 'Asks which die flaw would be probative.' } },
    registerSelection: {
      expected_dag_move: 'Stage the next clue.',
      response_configuration: { action_family: 'answer_accountably' },
    },
    dramaticReleaseFrame: { active: true },
  });
  const audit = auditTutorStubResponseComposition({
    text:
      'The useful mark would be a repeated nick, burr, or crooked stroke on the coins that can be compared with one die-cutting tool. I set the next exhibit beside the shilling.',
    frame,
    learnerText,
  });

  assert.equal(audit.ok, true);
});

test('deterministic uptake names the live tool boundary without reusing a stock limit opener', () => {
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText: 'Verrell owns the graver, but no mark yet links it to these shillings.',
    classification: { turn: { request_type: 'stepwise_support_request' } },
    actionFamily: 'stage_next_step',
  });

  assert.equal(uptake, 'You have kept the graver tied to its owner without pretending it has marked this coin.');
});

test('a possessive learner tool reference is recognized by a specific custody-boundary uptake', () => {
  const learnerText =
    'The graver’s ownership is only means; we still need a matching die flaw on these shillings before naming Verrell.';
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: {
      turn: {
        summary: 'Distinguishes graver ownership from a coin-specific die-flaw match.',
        request_type: 'stepwise_support_request',
      },
    },
    registerSelection: { action_family: 'stage_next_step' },
    dramaticReleaseFrame: { active: true },
  });
  const audit = auditTutorStubResponseComposition({
    text:
      'You have kept the graver tied to its owner without pretending it has marked this coin. I set the next assay record beside it.',
    frame,
    learnerText,
  });

  assert.equal(audit.ok, true);
});

test('a stock transition does not count as specific uptake of a learner-proposed test', () => {
  const learnerText =
    'A distinctive nick repeated in the shilling’s impression could be compared with Verrell’s graver.';
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: {
      turn: {
        summary: 'Proposes a coin-specific die-flaw comparison.',
        request_type: 'stepwise_support_request',
      },
    },
    registerSelection: { action_family: 'stage_next_step' },
    dramaticReleaseFrame: { active: true },
  });
  const audit = auditTutorStubResponseComposition({
    text:
      'Right—that gives us a sound place to begin; we’ll examine it before extending the case. I draw the next assay record across the bench.',
    frame,
    learnerText,
  });

  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'generic_learner_uptake'));
});

test('keep your contribution is always treated as generic uptake', () => {
  const learnerText =
    'Verrell’s past misdeeds are not yet proof that he struck these shillings.';
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: { turn: { summary: 'Separates reputation from proof.' } },
    registerSelection: {
      expected_dag_move: 'Stage the next clue.',
      response_configuration: { action_family: 'ground_in_material' },
    },
    dramaticReleaseFrame: { active: true },
  });
  const audit = auditTutorStubResponseComposition({
    text:
      'I keep your contribution in view as the next public fact develops it. I set a light shilling beside the crucible.',
    frame,
    learnerText,
  });

  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'generic_learner_uptake'));
  assert.equal(
    deterministicTutorStubLearnerUptake({ learnerText, actionFamily: 'ground_in_material' }),
    'You’re right to separate suspicion from proof.',
  );
});

test('deterministic uptake answers a low-agency request for the tutor to choose the record entry', () => {
  const learnerText = 'Could you choose what change in the register I should enter first?';
  const uptake = deterministicTutorStubLearnerUptake({ learnerText });
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: {
      turn: {
        summary: 'Asks the tutor to choose the first register entry.',
        request_type: 'stepwise_support_request',
      },
    },
    registerSelection: { response_configuration: { action_family: 'stage_next_step' } },
  });
  const audit = auditTutorStubResponseComposition({
    learnerText,
    frame,
    text: uptake + ' I open the register to the next public line.',
  });

  assert.match(uptake, /choose the first concrete register entry/iu);
  assert.equal(audit.issues.some((issue) => issue.type === 'generic_learner_uptake'), false);
});

test('a concrete choice directly answers a low-agency which-first question', () => {
  const learnerText = 'Can you choose which would tell us more first?';
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: {
      turn: {
        summary: 'Asks the tutor to choose which public check comes first.',
        request_type: 'stepwise_support_request',
      },
    },
    registerSelection: { response_configuration: { action_family: 'stage_next_step' } },
    dramaticReleaseFrame: { active: true },
  });

  for (const text of [
    'I’d start at the well. I lift the well-head stone and read the mason’s note.',
    'The well first. I lift the well-head stone and read the mason’s note.',
  ]) {
    const audit = auditTutorStubResponseComposition({ learnerText, frame, text });
    assert.equal(
      audit.issues.some((issue) => issue.type === 'generic_learner_uptake'),
      false,
      text,
    );
  }

  const uptake = deterministicTutorStubLearnerUptake({
    learnerText,
    recentTutorTexts: [
      'I’ll choose the first concrete point for you before we extend the case. We start at the tan-pits.',
    ],
  });
  assert.equal(uptake, 'I’ll choose the next public check and carry only that one step.');
  const repaired = auditTutorStubResponseComposition({
    learnerText,
    frame,
    text: `${uptake} I lift the well-head stone and read the mason’s note.`,
  });
  assert.equal(repaired.ok, true, JSON.stringify(repaired.issues));
});

test('deterministic uptake answers a repeated low-agency request for the conclusion', () => {
  const learnerText = 'Can you choose the conclusion you want me to enter?';
  const uptake = deterministicTutorStubLearnerUptake({
    learnerText,
    classification: {
      turn: {
        summary: 'Asks the tutor to provide the conclusion.',
        request_type: 'answer_seeking_or_overreach',
      },
    },
  });
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: {
      turn: {
        summary: 'Asks the tutor to provide the conclusion.',
        request_type: 'answer_seeking_or_overreach',
      },
    },
    registerSelection: { response_configuration: { action_family: 'stage_next_step' } },
  });
  const audit = auditTutorStubResponseComposition({
    learnerText,
    frame,
    text: `${uptake} I pull the report beside the log and ask what their match supports.`,
  });

  assert.match(uptake, /choose the conclusion/iu);
  assert.equal(audit.issues.some((issue) => issue.type === 'generic_learner_uptake'), false);
});

test('sparse scene-partner fallback uses a public record without a doubled spatial phrase', () => {
  const learnerText = 'Can you choose the conclusion you want me to enter?';
  const uptake = deterministicTutorStubLearnerUptake({ learnerText });
  const text = deterministicTutorStubConfiguredContinuationFallback({
    uptake,
    responseConfiguration: {
      engagement_stance: 'warm',
      action_family: 'stage_next_step',
      actorial_part: 'scene_partner',
    },
    support: { answerability: 'direction_only_until_evidence_is_public' },
    world: { setting: 'A laboratory inquiry.', question: 'What ruined the line?' },
    learnerText,
  });

  assert.match(text, /public record between us/iu);
  assert.doesNotMatch(text, /before us between us/iu);
  assert.match(text, /choose the conclusion/iu);
});

test('a learner-selected maker-mark test must be carried forward before another clue develops', () => {
  const learnerText =
    'Let us examine them for a maker’s mark; that could speak to the hand that struck them.';
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: { turn: { summary: 'Selects the offered maker-mark examination.', request_type: 'stepwise_support_request' } },
    registerSelection: {
      expected_dag_move: 'Stage the due alloy clue.',
      response_configuration: { action_family: 'stage_next_step' },
    },
    dramaticReleaseFrame: { active: true },
  });
  const audit = auditTutorStubResponseComposition({
    text:
      'That is the right order: test the public evidence before naming a hand. I draw the shilling across the touchstone.',
    frame,
    learnerText,
  });

  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'learner_selected_test_not_acknowledged'));
  assert.equal(
    deterministicTutorStubLearnerUptake({
      learnerText,
      classification: { turn: { request_type: 'stepwise_support_request' } },
      actionFamily: 'stage_next_step',
    }),
    'That is the right tool-mark test; keep the shared flaw before us.',
  );
});
