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
  assert.match(prompt, /“I attest: Verrell alone draws the mint-yard crucible\.”/u);
  assert.match(prompt, /Keep SOURCE words inside/iu);
});

test('live V29 source compensation replaces tactic instructions within the fixed V1 prompt budget', () => {
  const surface =
    "The private-seal register has one entry for the dusk-seal: Elian, night notary of the lower quay, drew it for curfew warrants and returned it chipped at the raven's wing the morning after the coffer left town.";
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'I cannot follow that.',
    responseConfiguration: configuration({
      engagement_stance: 'warm',
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'standard',
      scene_immersion: 'grounded',
      actorial_part: 'examiner',
      actorial_part_label: 'examiner',
      actorial_performance: {
        id: 'unadorned_report',
        label: 'unadorned report',
        contract: 'State it directly.',
      },
      surface_budgets: { max_average_sentence_words: 23 },
    }),
    responseCompositionFrame: {
      learner_move: { summary: 'Learner cannot follow the source.' },
      scene_action_budget: { saturated: false },
    },
    dramaticReleaseFrame: {
      active: true,
      entries: [{ mode: 'presented_exhibit', surface }],
    },
    sourceAccessibilityPolicy: 'direct_or_compensated_v1',
    sourceAccessibilityOwner: 'post_source_sentence',
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.equal(contract.evidence.source_accessibility.effective_mode, 'compensated');
  assert.equal(contract.evidence.source_accessibility.owner, 'post_source_sentence');
  assert.match(prompt, /TACTIC — Immediately after SOURCE/u);
  assert.match(prompt, /Reuse at least 4 material SOURCE words in order/u);
  assert.doesNotMatch(prompt, /TACTIC — After SOURCE closes/u);
  assert.doesNotMatch(prompt, /TARGET —|COUNTERPRESSURE PAIR —/u);
  assert.ok(wordCount(prompt) <= 220, `expected at most 220 V1 prompt words, received ${wordCount(prompt)}`);
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

test('keeps a writable-entry scene invitation declarative after the uptake answers the learner', () => {
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
  assert.match(tactic.instruction, /Invite shared attention[^.]*declaratively/iu);
  assert.match(tactic.instruction, /invite shared attention/iu);
  assert.match(tactic.instruction, /Ask no question/iu);
  assert.doesNotMatch(tactic.instruction, /make room beside/iu);
  assert.match(structuredPrompt, /TACTIC — Invite shared attention[^.]*declaratively/iu);
  assert.match(structuredPrompt, /Ask no question/iu);
  assert.equal(contract.progression.handoff_contract.question_allowed, false);
  const prompt = tutorStubFirstDraftContractPrompt(contract);
  assert.match(prompt, /four unlabeled host sentences \(only Write: UPTAKE may quote\)/iu);
  assert.doesNotMatch(prompt, /four unlabeled, unquoted host sentences/iu);
  assert.match(
    contract.host_plan.slots.find((slot) => slot.id === 'uptake').instruction,
    /Preserve actors, relation, and polarity/iu,
  );
  assert.match(prompt, /never reverse cause or evidentiary force/iu);
  assert.ok(wordCount(prompt) <= 220, `expected writable V1 prompt at most 220 words, received ${wordCount(prompt)}`);
});

test('binds a writable causal entry to the public relation without reversing causal role', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'What should I put in the minutes about the chargers?',
    responseConfiguration: configuration(),
    committedPublicEvidence: [
      {
        surface: 'The depot chargers stood dark throughout the stocktake, yet Tallow Street still browned out at 18:40.',
        causal_relation: {
          kind: 'inactive_candidate_with_persisting_outcome',
          family: 'production',
          subject: 'depot chargers',
          outcome: 'Tallow Street brownout',
        },
      },
    ],
    dramaticReleaseFrame: { active: false, entries: [] },
  });
  const prompt = tutorStubFirstDraftContractPrompt(contract);

  assert.equal(
    contract.opening.causal_relation_contract?.licensed_conclusion,
    'rules_out_candidate_production',
  );
  assert.equal(
    contract.opening.causal_relation_contract?.forbidden_relation,
    'candidate_failed_to_prevent_outcome',
  );
  assert.equal(contract.opening.causal_relation_contract?.subject, 'depot chargers');
  assert.equal(contract.opening.causal_relation_contract?.outcome, 'Tallow Street brownout');
  assert.match(prompt, /The depot chargers did not cause the Tallow Street brownout/iu);
  assert.match(prompt, /Keep both named roles exact/iu);
  assert.match(prompt, /never widen either role/iu);
  assert.ok(wordCount(prompt) <= 220, `expected causal writable V1 prompt at most 220 words, received ${wordCount(prompt)}`);
});

test('does not add a causal relation contract to an ordinary writable entry', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'What should I write about the badge?',
    responseConfiguration: configuration(),
    committedPublicEvidence: [{ surface: 'The visitor badge records code WF-11 at noon.' }],
    dramaticReleaseFrame: { active: false, entries: [] },
  });

  assert.equal(contract.opening.causal_relation_contract, null);
});

test('keeps an optional unresolved handoff optional in the compiled speaking prompt', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'The blue seal may belong to another packet.',
    responseConfiguration: configuration({
      action_family: 'clarify_distinction',
      actorial_performance: {
        id: 'unadorned_report',
        label: 'unadorned report',
        contract: 'State the live public distinction directly.',
      },
    }),
    responseCompositionFrame: {
      learner_move: { summary: 'The learner keeps ownership of the blue seal open.' },
      conversational_completion: { resolved: false },
      scene_action_budget: { saturated: false },
    },
    dramaticReleaseFrame: { active: false, entries: [] },
  });
  const handoff = contract.host_plan.slots.find((slot) => slot.id === 'handoff');

  assert.equal(contract.progression.handoff_contract.mode, 'new_unresolved_check');
  assert.equal(contract.progression.handoff_contract.question_allowed, true);
  assert.equal(contract.progression.handoff_contract.question_required, false);
  assert.match(handoff.instruction, /may ask one final question/iu);
  assert.match(handoff.instruction, /otherwise end declaratively/iu);
  assert.doesNotMatch(handoff.instruction, /owns the one final question/iu);
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
  assert.match(
    contract.host_plan.slots.find((slot) => slot.id === 'part').instruction,
    /Anchor the due source entrance in its own referent \(the book\)/u,
  );
  assert.equal(contract.evidence.sources[0].action_referents.primary.label, 'the book');
  assert.ok(prompt.indexOf('SOURCE —') < prompt.indexOf('TACTIC —'));
  assert.ok(prompt.indexOf('TACTIC —') < prompt.indexOf('HANDOFF —'));
});

test('due-source alignment remains possible for a declarative advocate part', () => {
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'What can we safely claim?',
    responseConfiguration: configuration({
      actorial_part: 'advocate',
      actorial_part_label: 'advocate for the live case',
    }),
    dramaticReleaseFrame: {
      active: true,
      entries: [
        {
          mode: 'enacted_role',
          role: 'archive clerk reading the transfer log',
          surface: 'The transfer log records one sealed parcel at noon.',
        },
      ],
    },
  });
  const part = contract.host_plan.slots.find((slot) => slot.id === 'part').instruction;

  assert.match(part, /^As advocate for the live case/iu);
  assert.match(part, /transfer log/u);
  assert.match(part, /declarative part may name that referent without handling it/iu);
  assert.doesNotMatch(part, /must (?:open|handle|touch) the transfer log/iu);
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

test('closure and accountable shared-scene turns never reintroduce a tactic question', () => {
  for (const input of [
    {
      learnerText: 'The measured result settles the comparison.',
      responseConfiguration: configuration({
        action_family: 'close_inquiry',
        actorial_part: 'scene_partner',
        actorial_performance: { id: 'shared_scene_invitation', label: 'shared scene', contract: 'Share attention.' },
      }),
      dialogueClosureFrame: { mandatory: true, allowCheckIn: false },
    },
    {
      learnerText: 'Can you answer what the measurement means?',
      responseConfiguration: configuration({
        action_family: 'answer_accountably',
        actorial_part: 'scene_partner',
        actorial_performance: { id: 'shared_scene_invitation', label: 'shared scene', contract: 'Share attention.' },
      }),
      dialogueClosureFrame: { mandatory: false },
    },
  ]) {
    const contract = buildTutorStubFirstDraftContract({
      ...input,
      dramaticReleaseFrame: { active: false, entries: [] },
    });
    const tactic = contract.host_plan.slots.find((slot) => slot.id === 'tactic');
    assert.equal(contract.progression.handoff_contract.question_allowed, false);
    assert.match(tactic.instruction, /declarative/iu);
    assert.match(tactic.instruction, /Ask no question/iu);
  }
});

test('rapid handoff is declarative when direct answer, closure, or writable uptake owns the turn', () => {
  const fixtures = [
    {
      learnerText: 'Can you answer what the visitor code means?',
      responseConfiguration: configuration({ action_family: 'answer_accountably' }),
      questionSupport: { responsiveRepairRequired: true },
      expectedMode: 'direct_answer',
    },
    {
      learnerText: 'The evidence settles the finding.',
      responseConfiguration: configuration({ action_family: 'close_inquiry' }),
      dialogueClosureFrame: { mandatory: true, allowCheckIn: false },
      expectedMode: 'closure',
    },
    {
      learnerText: 'What should I put in the minutes about the visitor code?',
      responseConfiguration: configuration({ action_family: 'stage_next_step' }),
      expectedMode: 'declarative_missing_support',
    },
  ];

  for (const fixture of fixtures) {
    fixture.responseConfiguration.actorial_performance = {
      id: 'rapid_handoff',
      label: 'rapid handoff',
      contract: 'Move directly to the shortest useful next move.',
    };
    const contract = buildTutorStubFirstDraftContract({
      ...fixture,
      responseCompositionFrame: {
        learner_move: { summary: 'The learner keeps the visitor code in view.' },
        scene_action_budget: { saturated: false },
      },
      dramaticReleaseFrame: { active: false, entries: [] },
    });
    const tactic = contract.host_plan.slots.find((slot) => slot.id === 'tactic');
    const prompt = tutorStubFirstDraftContractPrompt(contract);

    assert.equal(contract.progression.handoff_contract.mode, fixture.expectedMode);
    assert.equal(contract.progression.handoff_contract.question_allowed, false);
    assert.ok(contract.compatibility.decisions.includes('question_ownership_recasts_tactic_as_declarative'));
    assert.match(contract.performance.tactic_execution, /one short declarative observation/iu);
    assert.match(tactic.instruction, /Ask no question here/iu);
    assert.doesNotMatch(tactic.instruction, /shortest useful concrete question/iu);
    assert.doesNotMatch(prompt, /TACTIC —[^\n]*(?:ending with|shortest useful concrete question)/iu);
  }
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
