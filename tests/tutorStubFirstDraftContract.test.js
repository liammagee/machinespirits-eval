import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_FIRST_DRAFT_CONTRACT_SCHEMA,
  buildTutorStubFirstDraftContract,
  tutorStubFirstDraftContractPrompt,
} from '../services/tutorStubFirstDraftContract.js';

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
  assert.match(prompt, /PART — Work as keeper of the trial-book/iu);
  assert.match(
    prompt,
    /HOST BEAT — In the unquoted host voice, open, read, mark, enter, or close a named public record/iu,
  );
  assert.match(prompt, /TACTIC —[\s\S]*exact line and the limit/iu);
  assert.match(prompt, /Source to inhabit silently: mint warden/iu);
  assert.match(prompt, /reporting lead: I can attest that/iu);
  assert.match(prompt, /First person belongs only to the source’s act of seeing, reading, knowing, or attesting/iu);
  assert.match(prompt, /Preserve every named actor, owner, family relation, and possession/iu);
  assert.match(prompt, /never print it outside the quotation/iu);
  assert.match(prompt, /do not write “the clerk reads”/iu);
  assert.equal(prompt.split(clue).length - 1, 1);
  assert.match(prompt, /END — State the due evidence first, then ask what it changes/iu);
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
  assert.match(prompt, /direct judgment, address, rhythm, and word choice/iu);
});
