import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_FIRST_DRAFT_CONTRACT_SCHEMA,
  TUTOR_STUB_HOST_PLAN_SCHEMA,
  buildTutorStubFirstDraftContract,
  tutorStubFirstDraftContractPrompt,
} from '../services/tutorStubFirstDraftContract.js';
import { compileTutorStubPerformanceObligationContract } from '../services/tutorStubPerformanceObligationContract.js';
import { tutorStubStructuredFirstDraftPrompt } from '../services/tutorStubStructuredFirstDraft.js';

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
      contract: 'State the exact support and limit.',
    },
    surface_budgets: { max_average_sentence_words: 18 },
    ...overrides,
  };
}

function wordCount(value) {
  return String(value || '')
    .trim()
    .split(/\s+/u)
    .filter(Boolean).length;
}

test('compiles one ordered host plan with exact source between part and tactic', () => {
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
      entries: [{ mode: 'enacted_role', role: 'mint warden', surface: clue }],
    },
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.equal(contract.schema, TUTOR_STUB_FIRST_DRAFT_CONTRACT_SCHEMA);
  assert.equal(contract.host_plan.schema, TUTOR_STUB_HOST_PLAN_SCHEMA);
  assert.deepEqual(contract.host_plan.ordered_slot_ids, ['uptake', 'part', 'source', 'tactic', 'handoff']);
  assert.equal(contract.host_plan.host_sentence_count, 4);
  assert.deepEqual(
    contract.host_plan.slots.filter((slot) => slot.kind === 'host').map((slot) => slot.id),
    ['uptake', 'part', 'tactic', 'handoff'],
  );
  assert.ok(prompt.indexOf('UPTAKE —') < prompt.indexOf('PART —'));
  assert.ok(prompt.indexOf('PART —') < prompt.indexOf('SOURCE —'));
  assert.ok(prompt.indexOf('SOURCE —') < prompt.indexOf('TACTIC —'));
  assert.ok(prompt.indexOf('TACTIC —') < prompt.indexOf('HANDOFF —'));
  assert.equal(prompt.split(clue).length - 1, 1);
  assert.match(prompt, /Copy exactly, marks included/iu);
  assert.match(prompt, /“I can attest that Verrell alone draws the mint-yard crucible\.”/u);
  assert.match(prompt, /Keep SOURCE words inside/iu);
});

test('assigns every delivered response axis to exactly its intended host slot', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'What should I write?',
    responseConfiguration: configuration({ engagement_stance: 'charismatic' }),
    dramaticReleaseFrame: { active: false, entries: [] },
  });

  assert.deepEqual(contract.host_plan.ordered_slot_ids, ['uptake', 'part', 'tactic', 'handoff']);
  assert.deepEqual(contract.host_plan.axis_ownership, {
    audience_register: ['uptake', 'part', 'tactic', 'handoff'],
    lexical_accessibility: ['uptake', 'part', 'tactic', 'handoff'],
    scene_immersion: ['part'],
    actorial_part: ['part'],
    actorial_performance: ['tactic'],
    public_evidence: [],
    action_family: ['handoff'],
    engagement_stance: ['handoff'],
  });
  assert.match(
    contract.host_plan.slots.find((slot) => slot.id === 'handoff').instruction,
    /decisive named challenge/iu,
  );
});

test('separates scene-partner placement from the shared-reading tactic', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'What should I write next?',
    responseConfiguration: configuration({
      engagement_stance: 'warm',
      actorial_part: 'scene_partner',
      actorial_part_label: 'fellow investigator',
      actorial_performance: {
        id: 'shared_scene_invitation',
        label: 'shared-scene invitation',
        contract: 'Bring the learner into a shared reading of the evidence.',
      },
    }),
    dramaticReleaseFrame: { active: false, entries: [] },
  });
  const part = contract.host_plan.slots.find((slot) => slot.id === 'part');
  const tactic = contract.host_plan.slots.find((slot) => slot.id === 'tactic');
  const structuredPrompt = tutorStubStructuredFirstDraftPrompt(contract);

  assert.match(part.instruction, /place both speakers/iu);
  assert.match(part.instruction, /“you”, “we”, or “together”/u);
  assert.match(part.instruction, /solitary “I”[^.]*does not count/iu);
  assert.match(part.instruction, /do not ask a question yet/iu);
  assert.match(tactic.instruction, /In a separate sentence/iu);
  assert.match(tactic.instruction, /ask the turn’s one direct question/iu);
  assert.match(tactic.instruction, /Address the learner as “you”/u);
  assert.match(tactic.instruction, /ask for their own reading of that same named public object/iu);
  assert.match(tactic.instruction, /do not supply or command the reading/iu);
  assert.match(tactic.instruction, /do not repeat the placement action/iu);
  assert.doesNotMatch(tactic.instruction, /make room beside/iu);
  assert.doesNotMatch(tactic.instruction, /invite the learner’s reading/iu);
  assert.match(structuredPrompt, /TACTIC — In a separate sentence, ask the turn’s one direct question/iu);
  assert.match(structuredPrompt, /Address the learner as “you”/u);
  assert.match(structuredPrompt, /do not supply or command the reading/iu);
});

test('renders a compact prompt and removes the competing legacy prose sections', () => {
  const clue = 'Verrell alone draws the mint-yard crucible.';
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'His tools make him suspicious, but they do not prove he struck the coins.',
    responseConfiguration: configuration(),
    responseCompositionFrame: { learner_move: { summary: 'The learner separates suspicion from proof.' } },
    dramaticReleaseFrame: {
      active: true,
      entries: [{ mode: 'enacted_role', role: 'mint warden', surface: clue }],
    },
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);
  const instructionWords = wordCount(prompt.replace(clue, ''));

  assert.ok(instructionWords >= 150, `expected at least 150 instruction words, received ${instructionWords}`);
  assert.ok(instructionWords <= 220, `expected at most 220 instruction words, received ${instructionWords}`);
  assert.doesNotMatch(prompt, /\b(?:FORM|OPEN|DEVELOP|END|VOICE) —/u);
  assert.match(prompt, /four unlabeled, unquoted host sentences/iu);
  assert.match(prompt, /SOURCE is a separate quotation/iu);
});

test('keeps a complete typed counterpressure pair inside the tactic slot only', () => {
  const responseConfiguration = configuration({
    engagement_stance: 'charismatic',
    actorial_part: 'examiner',
    actorial_part_label: 'evidence examiner',
    actorial_performance: {
      id: 'dramatic_counterpressure',
      label: 'dramatic counterpressure',
      contract: 'Challenge the easy verdict with contrary evidence.',
    },
  });
  const obligation = compileTutorStubPerformanceObligationContract({
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
      pressure_target: 'The easy answer sends every glider by the direct route.',
      contrary_evidence: ['The route board closes the direct crossing.'],
    },
  });
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'What should I write next about the gliders?',
    responseConfiguration,
    dramaticReleaseFrame: { active: false, entries: [] },
    performanceObligationContract: obligation,
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.equal(obligation.complete, true);
  assert.match(contract.host_plan.slots.find((slot) => slot.id === 'tactic').semantic_instruction, /TARGET —/u);
  assert.ok(prompt.indexOf('TACTIC —') < prompt.indexOf('COUNTERPRESSURE PAIR —'));
  assert.ok(prompt.indexOf('COUNTERPRESSURE PAIR —') < prompt.indexOf('HANDOFF —'));
  assert.equal(prompt.split('The easy answer sends every glider by the direct route.').length - 1, 1);
  assert.equal(prompt.split('The route board closes the direct crossing.').length - 1, 1);
});

test('a due role source carries contrary evidence once before a separate counterpressure tactic', () => {
  const target = 'The room has already decided the north route is open.';
  const clue = 'The signal book closes the north route after dusk.';
  const responseConfiguration = configuration({
    engagement_stance: 'charismatic',
    actorial_part: 'record_keeper',
    actorial_part_label: 'keeper of the signal book',
    actorial_performance: {
      id: 'dramatic_counterpressure',
      label: 'dramatic counterpressure',
      contract: 'Challenge the ready route judgment with the public record.',
    },
  });
  const obligation = compileTutorStubPerformanceObligationContract({
    responseConfiguration,
    publicWorld: {
      visibility: 'public',
      setting: 'The signal book lies open beside the route board.',
      question: 'Which route remained open?',
      public_objects: ['signal book', 'route board'],
    },
    publicTurn: {
      visibility: 'public',
      learner_move: 'What should I write next?',
      pressure_target: target,
      contrary_evidence: [clue],
      due_evidence: [{ surface: clue }],
    },
  });
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'What should I write next?',
    responseConfiguration,
    dramaticReleaseFrame: {
      active: true,
      requiresEnactment: true,
      entries: [{ mode: 'enacted_role', role: 'signal keeper reading the book', surface: clue }],
    },
    performanceObligationContract: obligation,
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.equal(prompt.split(clue).length - 1, 1);
  assert.equal(prompt.split(target).length - 1, 1);
  assert.match(prompt, /SOURCE already supplies the contrary evidence exactly once/iu);
  assert.match(prompt, /After SOURCE closes, name that ready judgment/iu);
  assert.match(prompt, /Do not repeat SOURCE or quote TARGET in full/iu);
  assert.match(prompt, /After SOURCE closes, make TACTIC a new unquoted sentence/iu);
  assert.ok(prompt.indexOf('SOURCE —') < prompt.indexOf('TACTIC —'));
  assert.ok(prompt.indexOf('TACTIC —') < prompt.indexOf('HANDOFF —'));
});

test('uses the delivered safe tactic after typed counterpressure is inapplicable', () => {
  const requested = configuration({
    engagement_stance: 'charismatic',
    actorial_performance: {
      id: 'dramatic_counterpressure',
      label: 'dramatic counterpressure',
      contract: 'Challenge the easy verdict with contrary evidence.',
    },
  });
  const obligation = compileTutorStubPerformanceObligationContract({
    responseConfiguration: requested,
    publicWorld: {
      visibility: 'public',
      setting: 'The trial-book rests beside the crucible.',
      question: 'Who struck the coins?',
      public_objects: ['trial-book', 'crucible'],
    },
    publicTurn: {
      visibility: 'public',
      learner_move: 'What should I write?',
      public_evidence: [{ surface: 'The trial-book names the crucible.' }],
    },
  });
  const delivered = {
    ...requested,
    actorial_performance: obligation.selection.actorial_performance,
    speaking_transition: obligation.selection.speaking_transition,
  };
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'What should I write?',
    responseConfiguration: delivered,
    dramaticReleaseFrame: { active: false, entries: [] },
    performanceObligationContract: obligation,
  });
  const tactic = contract.host_plan.slots.find((slot) => slot.id === 'tactic');

  assert.equal(obligation.tactic_applicability.applicable, false);
  assert.equal(contract.performance.tactic, 'evidentiary_boundary');
  assert.match(tactic.instruction, /delivered boundary tactic/iu);
  assert.doesNotMatch(tactic.instruction, /Make the already-public shortcut/iu);
});

test('mandatory closure owns the handoff and forbids a further question', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'So the evidence establishes the finding.',
    responseConfiguration: configuration({ action_family: 'clarify_distinction' }),
    dramaticReleaseFrame: { active: false, entries: [] },
    questionSupport: { tutorInstruction: 'Ask what the clue changes.' },
    dialogueClosureFrame: { mandatory: true, allowCheckIn: false },
  });
  const handoff = contract.host_plan.slots.find((slot) => slot.id === 'handoff');

  assert.equal(handoff.closure, true);
  assert.match(handoff.instruction, /close the inquiry; ask no question/iu);
  assert.doesNotMatch(tutorStubFirstDraftContractPrompt(contract), /Ask what the clue changes/iu);
});

test('fails closed when a supplied typed public obligation contract is incomplete', () => {
  const incomplete = compileTutorStubPerformanceObligationContract({
    responseConfiguration: configuration(),
    publicWorld: { visibility: 'private', public_objects: [] },
    publicTurn: { visibility: 'public', learner_move: 'What should I write?' },
  });

  assert.equal(incomplete.complete, false);
  assert.throws(
    () =>
      buildTutorStubFirstDraftContract({
        learnerText: 'What should I write?',
        responseConfiguration: configuration(),
        dramaticReleaseFrame: { active: false, entries: [] },
        performanceObligationContract: incomplete,
      }),
    /host plan invalid: invalid_performance_obligation_contract/iu,
  );
});

test('renderer fails closed if required slot ordering or ownership is corrupted', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'I am not convinced.',
    responseConfiguration: configuration(),
    dramaticReleaseFrame: { active: false, entries: [] },
  });
  const wrongOrder = structuredClone(contract);
  wrongOrder.host_plan.ordered_slot_ids = ['uptake', 'tactic', 'part', 'handoff'];
  assert.throws(() => tutorStubFirstDraftContractPrompt(wrongOrder), /invalid_slot_order/iu);

  const missingOwner = structuredClone(contract);
  missingOwner.host_plan.axis_ownership.actorial_part = [];
  assert.throws(() => tutorStubFirstDraftContractPrompt(missingOwner), /unowned_delivered_axis:actorial_part/iu);
});
