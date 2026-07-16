import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_FIRST_DRAFT_CONTRACT_SCHEMA,
  buildTutorStubFirstDraftContract,
  tutorStubFirstDraftContractPrompt,
} from '../services/tutorStubFirstDraftContract.js';
import { compileTutorStubPerformanceObligationContract } from '../services/tutorStubPerformanceObligationContract.js';
import { auditTutorStubQuestionSupportResponse } from '../services/tutorStubQuestionSupport.js';
import { auditTutorStubResponseConfiguration } from '../services/tutorStubResponseConfiguration.js';

function configuration(overrides = {}) {
  return {
    engagement_stance: 'precise',
    action_family: 'stage_next_step',
    audience_register: 'adult_novice',
    lexical_accessibility: 'plain',
    scene_immersion: 'immersive',
    actorial_part: 'record_keeper',
    actorial_part_label: 'keeper of the trial-book',
    actorial_performance: {
      id: 'evidentiary_boundary',
      label: 'evidentiary boundary',
      contract: 'Make the exact line and the limit of what it establishes visible in the character’s handling of the clue.',
    },
    surface_budgets: { max_average_sentence_words: 18 },
    ...overrides,
  };
}

test('the first-draft contract compiles uptake, character, tactic, public clue, and ending once in performance order', () => {
  const clue = 'Verrell alone draws the mint-yard crucible.';
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'His tools make him suspicious, but they do not prove he struck the coins.',
    responseConfiguration: configuration(),
    responseCompositionFrame: {
      learner_move: { summary: 'The learner separates suspicion from proof.' },
      scene_action_budget: { saturated: false },
    },
    dramaticReleaseFrame: {
      active: true,
      requiresEnactment: true,
      requiresExhibitHandoff: false,
      entries: [{ mode: 'enacted_role', role: 'mint warden', surface: clue }],
    },
    questionSupport: {
      tutorInstruction: 'State the due evidence first, then ask what it changes.',
    },
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.equal(contract.schema, TUTOR_STUB_FIRST_DRAFT_CONTRACT_SCHEMA);
  assert.deepEqual(contract.compatibility.decisions, [
    'due_public_evidence_replaces_generic_development',
    'authored_source_is_nested_inside_host_part',
  ]);
  assert.match(prompt, /OPEN[\s\S]*learner separates suspicion from proof/iu);
  assert.match(prompt, /Paraphrase its concrete claim or concern rather than echoing/iu);
  assert.match(prompt, /DEVELOP —[\s\S]*Perform one mandatory development beat as keeper of the trial-book/iu);
  assert.match(
    prompt,
    /In the unquoted host voice, open, read, mark, enter, or close a named public record/iu,
  );
  assert.match(prompt, /state the exact support and its limit[\s\S]*“only,” “not yet,” or “does not establish[.”]*”/iu);
  assert.match(prompt, /Source to inhabit silently: mint warden/iu);
  assert.match(prompt, /reporting lead: I can attest that/iu);
  assert.match(prompt, /First person belongs only to the source’s act of seeing, reading, knowing, or attesting/iu);
  assert.match(prompt, /Preserve every named actor, owner, family relation, and possession/iu);
  assert.match(prompt, /never print it outside the quotation/iu);
  assert.match(prompt, /do not write “the clerk reads”/iu);
  assert.equal(prompt.split(clue).length - 1, 1);
  assert.match(prompt, /END — State the due evidence first, then ask what it changes/iu);
  assert.doesNotMatch(prompt, /\n(?:ACT|ENACT|ENTRY|PROP|RETURN) —/u);
  assert.doesNotMatch(prompt, /release schedule|premise id|rule id|concealed answer/iu);
});

test('an enacted source is compiled as direct speech rather than a printable role direction', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'What does the entry show?',
    responseConfiguration: configuration(),
    dramaticReleaseFrame: {
      active: true,
      requiresEnactment: true,
      entries: [
        {
          mode: 'enacted_role',
          role: 'estate clerk reading the founder’s inventory',
          surface: 'The old founder’s tools were never sold off; the inventory leaves them to Edony alone.',
        },
      ],
    },
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.match(prompt, /Source to inhabit silently: estate clerk reading the founder’s inventory/iu);
  assert.match(prompt, /reporting lead: I read in the record that/iu);
  assert.match(prompt, /Transform only the reporting frame into direct source voice/iu);
  assert.match(prompt, /do not write [\s\S]*the officer says[\s\S]*the witness opens/iu);
  assert.equal(
    prompt.split('The old founder’s tools were never sold off; the inventory leaves them to Edony alone.').length - 1,
    1,
  );
});

test('mandatory closure deterministically overrides generic continuation and question-support wording', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'So the evidence establishes the finding.',
    responseConfiguration: configuration({ action_family: 'clarify_distinction' }),
    responseCompositionFrame: { learner_move: { summary: 'The learner states the supported conclusion.' } },
    dramaticReleaseFrame: { active: false, entries: [] },
    questionSupport: {
      tutorInstruction: 'Ask what the clue changes.',
      clarificationInvitationRequired: true,
    },
    dialogueClosureFrame: { mandatory: true, allowCheckIn: false },
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.ok(contract.compatibility.decisions.includes('closure_overrides_generic_continuation'));
  assert.ok(contract.compatibility.decisions.includes('closure_suppresses_question_support_prompt'));
  assert.ok(contract.compatibility.decisions.includes('closure_instruction_overrides_nonclosing_action_wording'));
  assert.match(prompt, /END — Explicitly close the inquiry and ask no question/iu);
  assert.doesNotMatch(prompt, /END — Ask what the clue changes/iu);
});

test('recent prop saturation compiles character work without another stock exhibit gesture', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'I am not convinced.',
    responseConfiguration: configuration({ actorial_part: 'skeptic', actorial_part_label: 'skeptical examiner' }),
    responseCompositionFrame: {
      learner_move: { summary: 'The learner remains unconvinced.' },
      scene_action_budget: { saturated: true },
    },
    dramaticReleaseFrame: { active: false, entries: [], requiresExhibitHandoff: false },
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.ok(contract.compatibility.decisions.includes('recent_prop_saturation_prefers_spoken_character_work'));
  assert.match(prompt, /introduce no new prop/iu);
  assert.match(prompt, /Still perform the host-and-tactic beat once/iu);
});

test('direction-only support with no new evidence recasts a rapid handoff as a declarative boundary', () => {
  const responseConfiguration = configuration({
    engagement_stance: 'brisk',
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: {
      id: 'rapid_handoff',
      label: 'rapid evidence handoff',
      contract: 'Move the evidence straight to the learner and ask the shortest useful question.',
    },
  });
  const questionSupport = {
    answerability: 'direction_only_until_evidence_is_public',
    tutorInstruction: 'Do not ask the learner to invent unseen evidence.',
  };
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'Does the style make Vess possible without proving authorship?',
    responseConfiguration,
    responseCompositionFrame: {
      learner_move: { summary: 'The learner treats style as suggestive but not conclusive.' },
    },
    dramaticReleaseFrame: { active: false, entries: [] },
    questionSupport,
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.ok(
    contract.compatibility.decisions.includes(
      'direction_only_recasts_rapid_handoff_as_declarative_boundary',
    ),
  );
  assert.match(prompt, /No new evidence is available in this reply/iu);
  assert.match(prompt, /State the direction of the missing support yourself and end declaratively/iu);
  assert.doesNotMatch(prompt, /Put the next available public evidence/iu);
  assert.doesNotMatch(prompt, /ending with the shortest useful concrete question/iu);

  const response =
    'That is the safe entry. I trace the suspensions on the damp leaf: style supports Vess, but does not establish authorship. Next we test the leaf itself rather than guess at unseen evidence.';
  assert.equal(auditTutorStubQuestionSupportResponse({ text: response, support: questionSupport }).ok, true);
  const realization = auditTutorStubResponseConfiguration({
    text: response,
    configuration: responseConfiguration,
  });
  assert.equal(realization.axes.actorial_part.part_visible, true);
  assert.equal(realization.axes.actorial_part.performance_visible, true);
});

test('a saturated shared-scene turn still receives one executable host-and-tactic beat', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'What should I write next?',
    responseConfiguration: configuration({
      engagement_stance: 'warm',
      actorial_part: 'scene_partner',
      actorial_part_label: 'fellow investigator',
      actorial_performance: {
        id: 'shared_scene_invitation',
        label: 'shared-scene invitation',
        contract: 'Make physical room for the learner beside the exhibit.',
      },
    }),
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks for the next supported line.' },
      scene_action_budget: { saturated: true },
    },
    dramaticReleaseFrame: { active: false, entries: [], requiresExhibitHandoff: false },
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.match(prompt, /DEVELOP —[\s\S]*Perform one mandatory development beat as fellow investigator/iu);
  assert.match(prompt, /I make room for you beside \[named public object\]/u);
  assert.match(prompt, /Make room beside a named public object for the learner/iu);
  assert.match(prompt, /introduce no new prop/iu);
  assert.doesNotMatch(prompt, /instead of another prop gesture/iu);
});

test('mandatory closure recasts a shared-scene invitation as a joint terminal finding', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'The record now names the culprit.',
    responseConfiguration: configuration({
      engagement_stance: 'warm',
      action_family: 'close_inquiry',
      actorial_part: 'foreperson',
      actorial_part_label: 'keeper of the final finding',
      actorial_performance: {
        id: 'shared_scene_invitation',
        label: 'shared-scene invitation',
        contract: 'Make room for the learner beside the record.',
      },
    }),
    responseCompositionFrame: { learner_move: { summary: 'The learner states the final finding.' } },
    dramaticReleaseFrame: { active: false, entries: [] },
    dialogueClosureFrame: { mandatory: true, allowCheckIn: false },
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.ok(contract.compatibility.decisions.includes('closure_recasts_invitation_as_joint_finding'));
  assert.match(prompt, /Credit the learner inside the joint finding with “together,” then close the record/iu);
  assert.match(prompt, /END — Explicitly close the inquiry and ask no question/iu);
});

test('advocate counterpressure receives one accountable breakable public sentence shape', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'What should I write next?',
    responseConfiguration: configuration({
      engagement_stance: 'charismatic',
      actorial_part: 'advocate',
      actorial_part_label: 'advocate for the live case',
      actorial_performance: {
        id: 'dramatic_counterpressure',
        label: 'dramatic counterpressure',
        contract: 'Challenge the easy verdict with contrary evidence.',
      },
    }),
    responseCompositionFrame: { learner_move: { summary: 'The learner asks for the next entry.' } },
    dramaticReleaseFrame: { active: false, entries: [] },
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.match(prompt, /My case is \[licensed claim\]; break it if \[concrete public observation\]/u);
  assert.match(prompt, /Replace both brackets with scene facts/iu);
});

test('scene-partner work receives a concrete shared-placement sentence', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'What should I write next?',
    responseConfiguration: configuration({
      engagement_stance: 'warm',
      actorial_part: 'scene_partner',
      actorial_part_label: 'fellow investigator',
      actorial_performance: {
        id: 'shared_scene_invitation',
        label: 'shared-scene invitation',
        contract: 'Make room beside the evidence.',
      },
    }),
    responseCompositionFrame: { learner_move: { summary: 'The learner asks for the next entry.' } },
    dramaticReleaseFrame: { active: false, entries: [] },
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.match(prompt, /I make room for you beside \[named public object\]/u);
  assert.match(prompt, /bracket replaced by a scene object/iu);
});

test('a request for the next written entry must be answered before the dramatic beat', () => {
  const responseConfiguration = configuration({
    engagement_stance: 'charismatic',
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: {
      id: 'dramatic_counterpressure',
      label: 'dramatic counterpressure',
      contract: 'Break the easy answer with the route evidence.',
    },
  });
  const performanceObligationContract = compileTutorStubPerformanceObligationContract({
    responseConfiguration,
    publicWorld: {
      visibility: 'public',
      setting: 'The route board hangs beside the gliders.',
      question: 'Which route could the gliders have taken?',
      public_objects: ['route board', 'gliders'],
    },
    publicTurn: {
      visibility: 'public',
      learner_move: 'What should I write next about the gliders?',
      public_claims: ['The easy answer sends every glider by the direct route.'],
      contrary_evidence: ['The route board closes the direct crossing.'],
    },
  });
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'What should I write next about the gliders?',
    responseConfiguration,
    responseCompositionFrame: { learner_move: { summary: 'The learner asks for the next entry.' } },
    dramaticReleaseFrame: { active: false, entries: [] },
    performanceObligationContract,
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.equal(contract.opening.writable_entry_requested, true);
  assert.match(prompt, /Begin exactly with “Write:”/u);
  assert.match(prompt, /only then perform the selected development beat/iu);
  assert.match(prompt, /COUNTERPRESSURE PAIR/u);
  assert.match(prompt, /TARGET — The easy answer sends every glider by the direct route\./u);
  assert.match(prompt, /CONTRARY EVIDENCE — The route board closes the direct crossing\./u);
  assert.equal(prompt.split('The easy answer sends every glider by the direct route.').length - 1, 1);
  assert.equal(prompt.split('The route board closes the direct crossing.').length - 1, 1);
  assert.doesNotMatch(prompt, /use the verb “breaks”/u);
});

test('a Write entry complements rather than duplicates evidence due in the same reply', () => {
  const clue =
    'The depot’s six new chargers draw their heaviest current in the evening, when the vans come home to plug in.';
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'What should I write next about the chargers?',
    responseConfiguration: configuration(),
    responseCompositionFrame: { learner_move: { summary: 'The learner asks for the next entry.' } },
    dramaticReleaseFrame: {
      active: true,
      requiresEnactment: true,
      entries: [{ mode: 'enacted_role', role: 'depot engineer', surface: clue }],
    },
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.equal(contract.opening.writable_entry_requested, true);
  assert.equal(contract.opening.complementary_to_due_evidence, true);
  assert.match(prompt, /pre-turn public status or evidentiary limit/iu);
  assert.match(prompt, /do not state, paraphrase, preview, or summarize any PUBLIC EVIDENCE DUE NOW/iu);
  assert.match(prompt, /SINGLE DELIVERY — State each due clue exactly once/iu);
  assert.equal(prompt.split(clue).length - 1, 1);
});
