import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_TURN_PROGRESSION_AUDIT_SCHEMA,
  TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA,
  auditTutorStubLiveTurnProgressionV1,
  auditTutorStubTurnProgression,
  compileTutorStubTurnProgressionContract,
  deterministicTutorStubTurnProgressionHandoff,
  deterministicTutorStubTurnProgressionUptake,
  tutorStubLearnerRequestsWritableEntry,
  tutorStubTurnProgressionContractPrompt,
} from '../services/tutorStubTurnProgressionContract.js';
import { auditTutorStubQuestionSupportResponse } from '../services/tutorStubQuestionSupport.js';
import { tutorStubSubstantiveLearnerEcho } from '../services/tutorStubResponseComposition.js';
import { buildTutorStubWorldScaffold } from '../services/tutorStubWorldScaffold.js';

function composition({
  uptake = 'Your distinction keeps the seal separate from its custody.',
  entry = 'I hold the seal beside the custody sheet.',
  response = 'The mark identifies the seal while the sheet leaves custody open.',
  handoff = 'The next check must connect the blue seal to its custody chain.',
} = {}) {
  return {
    slots: {
      uptake,
      performance: { entry, response },
      handoff,
    },
  };
}

function publicObligationDirective(overrides = {}) {
  return {
    obligation_id: 'public-obligation-001',
    target: {
      kind: 'weight_or_ring_result',
      signature: 'weight_or_ring_result:clip|shilling',
      public_terms: ['balance', 'clipped', 'shilling', 'weighed'],
      subject_terms: ['clip', 'shilling'],
      required_components: [
        {
          id: 'weight_reading',
          terms: ['balance', 'weight', 'weigh', 'weighing', 'reading'],
        },
      ],
      source_surface: 'What did the balance show when the clipped shilling was weighed?',
    },
    acceptable_outcomes: ['bounded_public_answer', 'named_unavailability_with_concrete_next_step'],
    ...overrides,
  };
}

function obligationProgressionContract(overrides = {}) {
  const due = 'The die register names a fresh cutting tool.';
  return compileTutorStubTurnProgressionContract({
    learnerText: 'What did the balance show when the clipped shilling was weighed?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner requests the clipped-shilling balance result.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [due],
      public_focus_mapping: { relationship: 'sibling' },
    },
    dramaticReleaseFrame: { active: true, entries: [{ surface: due }] },
    actionFamily: 'answer_accountably',
    tactic: 'rapid_handoff',
    publicObligationDirective: publicObligationDirective(),
    ...overrides,
  });
}

test('an active public obligation owns the handoff before an unrelated due source', () => {
  const contract = obligationProgressionContract();
  const prompt = tutorStubTurnProgressionContractPrompt(contract);

  assert.equal(contract.complete, true);
  assert.equal(contract.public_obligation_contract.complete, true);
  assert.equal(contract.handoff_contract.mode, 'answer_or_accountable_deferral');
  assert.equal(contract.handoff_contract.question_allowed, false);
  assert.equal(contract.handoff_contract.question_required, false);
  assert.deepEqual(contract.handoff_contract.required_target_terms, ['balance', 'clipp', 'shill', 'weigh']);
  assert.equal(contract.turn_focus_contract.sibling_relation_requires_explicit_bridge, false);
  assert.match(prompt, /What did the balance show when the clipped shilling was weighed/iu);
  assert.match(prompt, /Do not substitute another clue or question/iu);
  assert.doesNotMatch(prompt, /public-obligation-001/u);
});

test('public obligation compilation preserves target identity and requires every named component', () => {
  const directive = publicObligationDirective({
    target: {
      kind: 'weight_or_ring_result',
      signature: 'weight_or_ring_result:clip|shilling',
      public_terms: ['balance', 'reading', 'ring', 'sound', 'clipped', 'shilling'],
      subject_terms: ['clip', 'shilling'],
      required_components: [
        {
          id: 'weight_reading',
          terms: ['balance', 'weight', 'weigh', 'weighing', 'reading'],
        },
        { id: 'ring_sound', terms: ['ring', 'sound'] },
      ],
      source_surface: 'What did the balance reading and ring sound show for the clipped shilling?',
    },
  });
  const frozenDirective = structuredClone(directive);
  const contract = obligationProgressionContract({
    learnerText: directive.target.source_surface,
    publicObligationDirective: directive,
  });

  assert.deepEqual(directive, frozenDirective);
  assert.equal(contract.public_obligation_contract.complete, true);
  assert.equal(contract.public_obligation_contract.target.signature, directive.target.signature);
  assert.deepEqual(contract.public_obligation_contract.target.subject_terms, directive.target.subject_terms);
  assert.deepEqual(
    contract.public_obligation_contract.target.required_components,
    directive.target.required_components,
  );
  assert.notEqual(contract.public_obligation_contract.target.required_components, directive.target.required_components);

  const partialText =
    'The clipped shilling balance reading shows two grains less; I keep the sound of its ring in view.';
  const partial = auditTutorStubLiveTurnProgressionV1({
    contract,
    text: partialText,
    responseComposition: { segments: { uptake: partialText, development: '' } },
  });
  assert.equal(partial.ok, false);
  assert.equal(partial.public_obligation.resolved, false);
  assert.equal(partial.public_obligation.delivery.required_components_answered, false);
  assert.deepEqual(partial.public_obligation.delivery.component_delivery, [
    { id: 'weight_reading', answered: true },
    { id: 'ring_sound', answered: false },
  ]);
  assert.ok(partial.issues.some((issue) => issue.type === 'public_obligation_unresolved'));

  const completeText = 'The clipped shilling balance reading shows two grains less; the sound of its ring is dull.';
  const complete = auditTutorStubLiveTurnProgressionV1({
    contract,
    text: completeText,
    responseComposition: { segments: { uptake: completeText, development: '' } },
  });
  assert.equal(complete.ok, true, JSON.stringify(complete.issues));
  assert.equal(complete.public_obligation.resolved, true);
  assert.equal(complete.public_obligation.delivery.required_components_answered, true);
  assert.deepEqual(complete.public_obligation.delivery.component_delivery, [
    { id: 'weight_reading', answered: true },
    { id: 'ring_sound', answered: true },
  ]);
});

test('public obligation compilation fails closed on malformed target-integrity fields', () => {
  const directive = publicObligationDirective({
    target: {
      kind: 'weight_or_ring_result',
      signature: 'comparison_result:wrong-kind',
      public_terms: ['balance', 'clipped', 'shilling'],
      subject_terms: 'clipped',
      required_components: [{ id: 'weight_reading', terms: [] }],
      source_surface: 'What did the balance show for the clipped shilling?',
    },
  });
  const frozenDirective = structuredClone(directive);
  const contract = obligationProgressionContract({ publicObligationDirective: directive });

  assert.deepEqual(directive, frozenDirective);
  assert.equal(contract.complete, false);
  assert.equal(contract.public_obligation_contract.complete, false);
  assert.ok(contract.public_obligation_contract.compile_issues.includes('invalid_target_signature'));
  assert.ok(contract.public_obligation_contract.compile_issues.includes('invalid_target_subject_terms'));
  assert.ok(contract.public_obligation_contract.compile_issues.includes('invalid_target_required_components'));
});

test('structured progression accepts an answer or accountable deferral and rejects a due-source pivot', () => {
  const contract = obligationProgressionContract();
  const boundedAnswer = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'The balance shows the clipped shilling weighs two grains less.',
      response: 'The separate die register names a fresh cutting tool.',
      handoff: 'That is the bounded balance result now on the public record.',
    }),
  });
  assert.equal(boundedAnswer.ok, true, JSON.stringify(boundedAnswer.issues));
  assert.equal(boundedAnswer.public_obligation.resolved, true);
  assert.equal(boundedAnswer.public_obligation.outcome, 'bounded_public_answer');

  const accountableDeferral = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake:
        'The clipped-shilling balance result is not public yet; once the weighing record is released, I can answer it.',
      response: 'The separate die register names a fresh cutting tool.',
      handoff: 'That named release is the concrete condition for answering the balance request.',
    }),
  });
  assert.equal(accountableDeferral.ok, true, JSON.stringify(accountableDeferral.issues));
  assert.equal(accountableDeferral.public_obligation.resolved, true);
  assert.equal(accountableDeferral.public_obligation.outcome, 'named_unavailability_with_concrete_next_step');

  const pivot = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'I open the die register beside us.',
      response: 'The die register names a fresh cutting tool.',
      handoff: 'What does the die mark show?',
    }),
  });
  assert.equal(pivot.ok, false);
  assert.ok(pivot.issues.some((issue) => issue.type === 'public_obligation_unresolved'));
  assert.ok(pivot.issues.some((issue) => issue.type === 'public_obligation_replaced_by_question'));
  assert.ok(pivot.issues.some((issue) => issue.type === 'question_forbidden_by_handoff_contract'));
});

test('live progression applies the same obligation audit while ignoring questions inside exact authored sources', () => {
  const contract = obligationProgressionContract();
  const authoredSource = '“Can I enter this die mark?” asks the public register.';
  const uptake =
    'The clipped-shilling balance result is not public yet; once the weighing record is released, I can answer it.';
  const development = `${authoredSource} That source does not replace the balance request.`;
  const accepted = auditTutorStubLiveTurnProgressionV1({
    contract,
    text: `${uptake} ${development} That named release is the concrete condition for answering the balance request.`,
    responseComposition: { segments: { uptake, development } },
    authoredSourceTexts: [authoredSource],
  });
  assert.equal(accepted.ok, true, JSON.stringify(accepted.issues));
  assert.equal(accepted.observed.question_count, 0);
  assert.equal(accepted.public_obligation.outcome, 'named_unavailability_with_concrete_next_step');

  const pivotUptake = 'I open the die register beside us.';
  const pivotDevelopment = 'The die register names a fresh cutting tool. What does the die mark show?';
  const rejected = auditTutorStubLiveTurnProgressionV1({
    contract,
    text: `${pivotUptake} ${pivotDevelopment}`,
    responseComposition: { segments: { uptake: pivotUptake, development: pivotDevelopment } },
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.issues.some((issue) => issue.type === 'public_obligation_unresolved'));
  assert.ok(rejected.issues.some((issue) => issue.type === 'public_obligation_replaced_by_question'));
});

test('structured and live progression reject an obligation answered only after an authored source', () => {
  const contract = obligationProgressionContract();
  const dueSource = 'The die register names a fresh cutting tool.';
  const acknowledgement = 'You asked for the clipped shilling balance result.';
  const lateAnswer = 'The balance shows the clipped shilling weighs two grains less.';

  const structured = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: acknowledgement,
      response: dueSource,
      handoff: lateAnswer,
    }),
  });
  assert.equal(structured.ok, false);
  assert.ok(structured.issues.some((issue) => issue.type === 'public_obligation_resolved_after_source_or_handoff'));

  const live = auditTutorStubLiveTurnProgressionV1({
    contract,
    text: `${acknowledgement} ${dueSource} ${lateAnswer}`,
    responseComposition: {
      segments: { uptake: acknowledgement, development: `${dueSource} ${lateAnswer}` },
    },
    authoredSourceTexts: [dueSource],
  });
  assert.equal(live.ok, false);
  assert.ok(live.issues.some((issue) => issue.type === 'public_obligation_resolved_after_source_or_handoff'));

  const developmentAnswer = auditTutorStubLiveTurnProgressionV1({
    contract,
    text: `${acknowledgement} I set the balance beside us. ${lateAnswer} ${dueSource}`,
    responseComposition: {
      segments: {
        uptake: acknowledgement,
        development: `I set the balance beside us. ${lateAnswer} ${dueSource}`,
      },
    },
    authoredSourceTexts: [dueSource],
  });
  assert.equal(developmentAnswer.ok, false);
  assert.ok(
    developmentAnswer.issues.some((issue) => issue.type === 'public_obligation_resolved_after_source_or_handoff'),
  );
});

test('deterministic recovery discharges an active obligation with a public-only deferral', () => {
  const contract = obligationProgressionContract({
    dramaticReleaseFrame: { active: false, entries: [] },
    responseCompositionFrame: {
      learner_move: { summary: 'The learner requests the clipped-shilling balance result.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
  });
  const uptake = deterministicTutorStubTurnProgressionUptake({
    contract,
    defaultUptake: 'I hear the point; the next public fact must answer it.',
  });
  const handoff = deterministicTutorStubTurnProgressionHandoff({ contract });
  const audit = auditTutorStubTurnProgression({
    contract,
    composition: composition({ uptake, handoff }),
  });

  assert.doesNotMatch(handoff, /\?/u);
  assert.match(handoff, /not public yet/iu);
  assert.match(handoff, /once a matching public record is available/iu);
  assert.equal(audit.public_obligation.resolved, true, JSON.stringify(audit.issues));
  assert.equal(audit.public_obligation.outcome, 'named_unavailability_with_concrete_next_step');
});

test('a writable-entry turn compiles a declarative handoff on the learner requested relation', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'What should I record about the blue seal and its custody chain?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks how the blue seal relates to its custody chain.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'stage_next_step',
    tactic: 'shared_scene_invitation',
  });

  assert.equal(contract.schema, TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA);
  assert.equal(contract.complete, true);
  assert.equal(contract.learner_uptake.mode, 'writable_entry');
  assert.equal(contract.handoff_contract.mode, 'declarative_missing_support');
  assert.equal(contract.handoff_contract.question_allowed, false);
  assert.equal(contract.handoff_contract.question_required, false);
  assert.deepEqual(
    contract.turn_focus_contract.primary_groups.map((row) => row.terms),
    [
      ['blue', 'seal'],
      ['custody', 'chain'],
    ],
  );
  assert.match(tutorStubTurnProgressionContractPrompt(contract), /Keep the learner’s requested focus primary/iu);

  const accepted = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'Write: “The blue seal is identified, but its custody chain remains unproved.”',
    }),
  });
  assert.equal(accepted.schema, TUTOR_STUB_TURN_PROGRESSION_AUDIT_SCHEMA);
  assert.equal(accepted.ok, true, JSON.stringify(accepted.issues));

  const rejected = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'Write: “The blue seal is identified, but its custody chain remains unproved.”',
      response: 'The ink pattern gives us another clue.',
      handoff: 'What does the ink pattern show?',
    }),
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.issues.some((issue) => issue.type === 'question_forbidden_by_handoff_contract'));
  assert.ok(rejected.issues.some((issue) => issue.type === 'handoff_loses_turn_focus'));
});

test('a resolved point gives the only new question to the final handoff', () => {
  const due = 'The second dispatch closes the south bridge after dusk.';
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'No, the first dispatch already closes the north bridge.',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner correctly closes the north route.' },
      conversational_completion: {
        resolved: true,
        sourceTutorQuestion: 'Does the first dispatch leave the north bridge open?',
        acceptedMeaning: 'The first dispatch closes the north bridge.',
      },
      due_evidence_surfaces: [due],
    },
    dramaticReleaseFrame: { active: true, entries: [{ surface: due }] },
    actionFamily: 'stage_next_step',
    tactic: 'shared_scene_invitation',
  });

  assert.equal(contract.handoff_contract.mode, 'new_unresolved_check');
  assert.equal(contract.handoff_contract.question_allowed, true);
  assert.equal(contract.handoff_contract.question_required, true);
  assert.equal(contract.handoff_contract.question_owner, 'handoff');
  assert.deepEqual(contract.handoff_contract.prohibited_settled_surfaces, [
    'Does the first dispatch leave the north bridge open?',
    'The first dispatch closes the north bridge.',
  ]);

  const accepted = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'Right—the first dispatch closes the north bridge.',
      entry: 'I set the second dispatch beside it.',
      response: 'With that answered, the second dispatch now closes the south bridge after dusk.',
      handoff: 'What does the second dispatch change about the south bridge after dusk?',
    }),
  });
  assert.equal(accepted.ok, true, JSON.stringify(accepted.issues));

  const rejected = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'Right—the first dispatch closes the north bridge.',
      response: 'Does that mean the first dispatch closes the north bridge?',
      handoff: 'What does the second dispatch change about the south bridge?',
    }),
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.issues.some((issue) => issue.type === 'question_in_non_owner_slot'));
  assert.ok(rejected.issues.some((issue) => issue.type === 'settled_point_requestioned'));
});

test('a neighbouring due relation needs an explicit bridge back to the learner question', () => {
  const due = 'The courier seal appears beside the unsigned dispatch.';
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'Who signed the dispatch?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks who signed the dispatch.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [due],
      public_focus_mapping: { relationship: 'sibling' },
    },
    dramaticReleaseFrame: { active: true, entries: [{ surface: due }] },
    actionFamily: 'stage_next_step',
    tactic: 'unadorned_report',
  });

  assert.equal(contract.turn_focus_contract.sibling_relation_requires_explicit_bridge, true);
  const accepted = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'You are asking who signed the dispatch.',
      entry: 'I turn the unsigned dispatch toward us.',
      response: 'Before we answer who signed it, the courier seal gives us a narrower link.',
      handoff: 'What does the courier seal beside the unsigned dispatch establish?',
    }),
  });
  assert.equal(accepted.ok, true, JSON.stringify(accepted.issues));

  const rejected = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'You are asking who signed the dispatch.',
      entry: 'I turn the unsigned dispatch toward us.',
      response: 'The courier seal gives us another clue.',
      handoff: 'What does the courier seal establish?',
    }),
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.issues.some((issue) => issue.type === 'sibling_relation_without_explicit_bridge'));
});

test('a detailed due clue containing the learner focus is not misclassified as a sibling relation', () => {
  const due = 'The depot’s new chargers were dark throughout the stocktake while Tallow Street still browned out.';
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'What should I write next about the depot’s new chargers?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks what to record about the depot’s new chargers.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [due],
      public_focus_mapping: { relationship: 'direct' },
    },
    dramaticReleaseFrame: { active: true, entries: [{ surface: due }] },
    actionFamily: 'stage_next_step',
    tactic: 'unadorned_report',
  });

  assert.deepEqual(contract.turn_focus_contract.primary_terms, ['depot', 'new', 'charger']);
  assert.equal(contract.turn_focus_contract.sibling_relation_requires_explicit_bridge, false);
  assert.doesNotMatch(contract.handoff_contract.instruction, /connect SOURCE/iu);
});

test('the focus audit distinguishes a requested relation from a sibling relation', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'Who assembled the sample?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks who assembled the sample.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'clarify_distinction',
    tactic: 'unadorned_report',
  });

  const accepted = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'You are asking who assembled the sample.',
      handoff: 'Which public mark could connect the assembled sample to a person?',
    }),
  });
  assert.equal(accepted.ok, true, JSON.stringify(accepted.issues));

  const rejected = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'You are asking who assembled the sample.',
      handoff: 'Which mark identifies who inspected it?',
    }),
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.issues.some((issue) => issue.type === 'handoff_loses_turn_focus'));
});

test('focus recognition treats hyphenated compounds as lexical terms without admitting unrelated handoffs', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'What should I record about the blue seal and its custody chain?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks how the blue seal relates to its custody chain.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'stage_next_step',
    tactic: 'unadorned_report',
  });

  const accepted = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'Write: “The blue seal is identified, but its custody chain remains open.”',
      handoff: 'Next, compare the blue-seal custody-chain with the register.',
    }),
  });
  assert.equal(accepted.ok, true, JSON.stringify(accepted.issues));
  assert.deepEqual(accepted.handoff.target_coverage.matched, ['blue', 'seal', 'custody', 'chain']);

  const unrelated = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'Write: “The blue seal is identified, but its custody chain remains open.”',
      handoff: 'Next, compare the red-wax archive-tag with the noon ledger.',
    }),
  });
  assert.equal(unrelated.ok, false);
  assert.deepEqual(
    unrelated.issues.map((issue) => issue.type),
    ['handoff_loses_turn_focus'],
  );
});

test('saved V32 diagnostic 2 handoff retains its exact learner focus model-free', () => {
  const learnerText = 'What should I put in the minutes about the chargers being dark during the stocktake?';
  const contract = compileTutorStubTurnProgressionContract({
    learnerText,
    responseCompositionFrame: {
      learner_move: { summary: 'Asks for wording about the stocktake evidence.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'stage_next_step',
    tactic: 'evidentiary_boundary',
  });
  const savedSlots = {
    uptake: 'Write: “The dark chargers did not stop Tallow Street’s brownout.”',
    entry: 'My case is the depot caused it, but dark chargers cannot explain the brownout.',
    response: 'The stocktake shows the brownout continued without charger current; it does not identify its source.',
    handoff: 'Next, compare the dark-charger stocktake with the 18:40 pen chart.',
  };

  // This saved draw isolates lexical focus recognition. Its separate
  // “did not stop” wording debt is recorded in the V32 result note and is not
  // endorsed as a semantically ideal minutes entry by this regression.
  const reaudited = auditTutorStubTurnProgression({
    contract,
    composition: composition(savedSlots),
  });
  assert.deepEqual(reaudited.handoff.target_coverage, {
    matched: ['charger', 'dark', 'stocktake'],
    count: 3,
    coverage: 0.6,
  });
  assert.equal(
    reaudited.issues.some((issue) => issue.type === 'handoff_loses_turn_focus'),
    false,
  );

  const unrelated = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      ...savedSlots,
      handoff: 'Next, compare the visitor-badge roster with the noon gate.',
    }),
  });
  assert.equal(unrelated.ok, false);
  assert.deepEqual(
    unrelated.issues.map((issue) => issue.type),
    ['handoff_loses_turn_focus'],
  );
});

test('closure and accountable answers cannot acquire a shared-scene question', () => {
  for (const input of [
    { dialogueClosureFrame: { mandatory: true }, actionFamily: 'close_inquiry', expected: 'closure' },
    {
      dialogueClosureFrame: { mandatory: false },
      actionFamily: 'answer_accountably',
      expected: 'declarative_current_limit',
    },
  ]) {
    const contract = compileTutorStubTurnProgressionContract({
      learnerText: 'The measured result settles the comparison.',
      responseCompositionFrame: {
        learner_move: { summary: 'The learner settles the measured comparison.' },
        conversational_completion: { resolved: false },
      },
      dialogueClosureFrame: input.dialogueClosureFrame,
      actionFamily: input.actionFamily,
      tactic: 'shared_scene_invitation',
    });
    assert.equal(contract.handoff_contract.mode, input.expected);
    assert.equal(contract.handoff_contract.question_allowed, false);
  }
});

test('generic praise does not satisfy typed learner uptake', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'The blue seal identifies the packet, not its keeper.',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner separates packet identity from custody.' },
      conversational_completion: { resolved: false },
    },
    actionFamily: 'ground_in_material',
    tactic: 'unadorned_report',
  });
  const audit = auditTutorStubTurnProgression({
    contract,
    composition: composition({ uptake: 'Good.', handoff: 'The blue seal still does not identify the keeper.' }),
  });
  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'learner_uptake_not_realized'));

  for (const uptake of ['That moves us forward.', 'Your objection is noted.', 'Right.']) {
    const genericAudit = auditTutorStubTurnProgression({
      contract,
      composition: composition({ uptake, handoff: 'The blue seal still does not identify the keeper.' }),
    });
    assert.equal(genericAudit.ok, false, uptake);
    assert.ok(genericAudit.issues.some((issue) => issue.type === 'learner_uptake_not_realized'));
  }
});

test('frozen structured uptake accepts substantive semantic linkage across worlds, not generic or unrelated assent', () => {
  const fixtures = [
    {
      learnerText: 'The blue seal identifies the packet, not its keeper.',
      summary: 'The learner separates packet identity from custody.',
      linked: 'The seal identifies the packet while custody remains unresolved.',
      unrelated: 'The lunchbox ledger remains unresolved.',
      handoff: 'The blue seal still does not identify the keeper.',
    },
    {
      learnerText: 'The lunchbox ledger proves recovery, not who moved it.',
      summary: 'The learner separates recovery from who moved the lunchbox.',
      linked: 'The ledger establishes recovery while the mover remains unknown.',
      unrelated: 'The blue seal still leaves custody open.',
      handoff: 'The lunchbox ledger still does not identify who moved it.',
    },
  ];

  for (const fixture of fixtures) {
    const contract = compileTutorStubTurnProgressionContract({
      learnerText: fixture.learnerText,
      responseCompositionFrame: {
        learner_move: { summary: fixture.summary },
        conversational_completion: { resolved: false },
      },
      actionFamily: 'ground_in_material',
      tactic: 'unadorned_report',
    });
    const linked = auditTutorStubTurnProgression({
      contract,
      composition: composition({ uptake: fixture.linked, handoff: fixture.handoff }),
    });
    assert.equal(linked.ok, true, `${fixture.linked}: ${JSON.stringify(linked.issues)}`);
    assert.equal(linked.learner_uptake.visible, true);

    for (const uptake of ['Good.', fixture.unrelated]) {
      const rejected = auditTutorStubTurnProgression({
        contract,
        composition: composition({ uptake, handoff: fixture.handoff }),
      });
      assert.equal(rejected.ok, false, uptake);
      assert.ok(rejected.issues.some((issue) => issue.type === 'learner_uptake_not_realized'));
    }
  }
});

test('a typed Marrick rule link does not falsely classify the due premise as a sibling relation', () => {
  const due =
    "The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony.";
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'What should I write next about whose hand cast the blanks at the weir-forge?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks whose hand cast the blanks at the weir-forge.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [due],
      public_focus_mapping: {
        source: 'world_scaffold_rule',
        rule_id: 'R2',
        premise_id: 'p_caster',
        evidence_predicate: 'soleCasterAt',
        input_predicates: ['blankFrom', 'soleCasterAt'],
        conclusion_predicates: ['castBlankFor'],
      },
    },
    dramaticReleaseFrame: {
      active: true,
      entries: [{ premise: 'p_caster', fact: ['soleCasterAt', 'weirCrucible', 'edony'], surface: due }],
    },
    actionFamily: 'stage_next_step',
    tactic: 'unadorned_report',
  });

  assert.equal(contract.turn_focus_contract.relation_kind, 'direct');
  assert.equal(contract.turn_focus_contract.relation_basis, 'typed_world_rule');
  assert.equal(contract.turn_focus_contract.sibling_relation_requires_explicit_bridge, false);
  assert.doesNotMatch(contract.handoff_contract.instruction, /connect SOURCE/iu);
});

test('the public world scaffold exposes a typed rule relation for progression', () => {
  const evidence = {
    premise: 'p_caster',
    fact: ['soleCasterAt', 'weirCrucible', 'edony'],
    surface: 'The charcoal book names Edony as the sole caster at the weir crucible.',
  };
  const scaffold = buildTutorStubWorldScaffold({
    world: {
      title: 'The Light Shillings',
      question: 'Whose hand cast the blanks?',
      questionPattern: ['castBlankFor', '?coin', '?person'],
      rules: [
        {
          id: 'R2',
          if: [
            ['blankFrom', '?coin', '?crucible'],
            ['soleCasterAt', '?crucible', '?person'],
          ],
          then: [['castBlankFor', '?coin', '?person']],
          gloss: 'A blank from a crucible was cast by that crucible’s sole caster.',
        },
      ],
    },
    evidence,
  });

  assert.deepEqual(scaffold.publicRelationMap, {
    source: 'world_scaffold_rule',
    rule_id: 'R2',
    evidence_predicate: 'soleCasterAt',
    premise_id: 'p_caster',
    input_predicates: ['blankFrom', 'soleCasterAt'],
    conclusion_predicates: ['castBlankFor'],
    relationship: null,
    authored_focus_surface: '',
  });
});

test('typed rule matching requires the whole multi-term relation across worlds', () => {
  const due = 'The dispatch seal identifies the noon clerk.';
  const release = {
    active: true,
    entries: [{ premise: 'p_seal', fact: ['sealKeeper', 'dispatchSeal', 'noonClerk'], surface: due }],
  };
  const mapping = (conclusionPredicate) => ({
    source: 'world_scaffold_rule',
    rule_id: 'R_dispatch',
    premise_id: 'p_seal',
    evidence_predicate: 'sealKeeper',
    input_predicates: ['sealKeeper'],
    conclusion_predicates: [conclusionPredicate],
  });
  const compile = (conclusionPredicate) =>
    compileTutorStubTurnProgressionContract({
      learnerText: 'Who signed the dispatch?',
      responseCompositionFrame: {
        learner_move: { summary: 'The learner asks who signed the dispatch.' },
        conversational_completion: { resolved: false },
        due_evidence_surfaces: [due],
        public_focus_mapping: mapping(conclusionPredicate),
      },
      dramaticReleaseFrame: release,
      actionFamily: 'stage_next_step',
      tactic: 'unadorned_report',
    });

  const direct = compile('signedDispatchBy');
  assert.equal(direct.turn_focus_contract.relation_kind, 'direct');
  assert.equal(direct.turn_focus_contract.relation_basis, 'typed_world_rule');

  const crossWorldCollision = compile('signedPermitBy');
  assert.equal(crossWorldCollision.turn_focus_contract.relation_kind, 'unmapped');
  assert.equal(crossWorldCollision.turn_focus_contract.relation_basis, 'typed_world_rule_ambiguous');
  assert.equal(crossWorldCollision.turn_focus_contract.sibling_relation_requires_explicit_bridge, false);
});

test('authored public focus relationship overrides ambiguous predicate vocabulary', () => {
  const evidence = {
    premise: 'p_seal',
    fact: ['sealKeeper', 'dispatchSeal', 'noonClerk'],
    surface: 'The dispatch seal identifies the noon clerk.',
  };
  const scaffold = buildTutorStubWorldScaffold({
    world: {
      title: 'The Noon Dispatch',
      question: 'Who signed the dispatch?',
      rules: [
        {
          id: 'R_dispatch',
          public_focus: {
            relationship: 'direct',
            surface: 'which person signed the dispatch',
          },
          if: [['sealKeeper', '?seal', '?person']],
          then: [['authoredBy', '?dispatch', '?person']],
          gloss: 'The keeper of this seal signed this dispatch.',
        },
      ],
    },
    evidence,
  });
  assert.equal(scaffold.publicRelationMap.relationship, 'direct');
  assert.equal(scaffold.publicRelationMap.authored_focus_surface, 'which person signed the dispatch');

  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'Who signed the dispatch?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks who signed the dispatch.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [evidence.surface],
      public_focus_mapping: scaffold.publicRelationMap,
    },
    dramaticReleaseFrame: { active: true, entries: [evidence] },
    actionFamily: 'stage_next_step',
    tactic: 'unadorned_report',
  });
  assert.equal(contract.turn_focus_contract.relation_kind, 'direct');
  assert.equal(contract.turn_focus_contract.relation_basis, 'explicit_public_focus_mapping');
});

test('new unresolved check permits a declarative handoff when its question is optional', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'The blue seal may belong to another packet.',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner keeps ownership of the blue seal open.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'clarify_distinction',
    tactic: 'unadorned_report',
  });

  assert.equal(contract.handoff_contract.mode, 'new_unresolved_check');
  assert.equal(contract.handoff_contract.question_allowed, true);
  assert.equal(contract.handoff_contract.question_required, false);
  assert.match(contract.handoff_contract.instruction, /may ask one final question/iu);
  assert.doesNotMatch(contract.handoff_contract.instruction, /alone asks/iu);

  const audit = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'Right—the blue seal may belong to another packet.',
      handoff: 'The blue seal may still belong to another packet.',
    }),
  });
  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
});

test('elliptical confusion and affect use typed semantic focus while retaining the raw learner surface', () => {
  const fixtures = [
    {
      learnerText: 'dunno',
      move: {
        summary: 'The learner is unsure what the visitor badge log establishes.',
        epistemic_stance: 'uncertain',
        pedagogical_need: 'Reanchor the visitor badge log in plain language.',
      },
      expectedSource: 'learner_move_summary',
      expectedTerms: ['unsure', 'visitor', 'badge', 'log', 'establish'],
      uptake: 'Fair—the visitor badge log still leaves what it establishes open.',
      handoff: 'The visitor badge log still leaves what it establishes open.',
    },
    {
      learnerText: 'no idea',
      move: {
        summary: 'The learner cannot yet interpret the fixed-intent evidence.',
        epistemic_stance: 'confused',
        pedagogical_need: 'Guide interpretation of the fixed intents.',
      },
      expectedSource: 'learner_move_summary',
      expectedTerms: ['learner', 'cannot', 'yet', 'interpret', 'fixed', 'intent', 'evidence'],
      uptake: 'I hear that the fixed-intent evidence is not clear yet.',
      handoff: 'The fixed-intent evidence remains the live public limit.',
    },
    {
      learnerText: 'sorry what',
      move: {
        summary: null,
        request_type: 'clarification',
        pedagogical_need: 'Explain the visitor badge log in plain language.',
      },
      expectedSource: 'pedagogical_need',
      expectedTerms: ['explain', 'visitor', 'badge', 'log', 'plain', 'language'],
      uptake: 'Fair—the visitor badge log needs plain language.',
      handoff: 'The visitor badge log is now in plain language.',
    },
    {
      learnerText: 'move it along',
      move: {
        summary: 'The learner asks to accelerate the clue pace.',
        affect: 'bored',
        pedagogical_need: 'Increase the release pace.',
      },
      expectedSource: 'learner_move_summary',
      expectedTerms: ['accelerate', 'clue', 'pace'],
      uptake: 'Fair—we will accelerate the clue pace.',
      handoff: 'The clue pace accelerates now.',
    },
    {
      learnerText: 'no',
      move: { summary: 'The learner gives an elliptical answer.' },
      completion: {
        resolved: true,
        sourceTutorQuestion: 'Does the first dispatch leave the north bridge open?',
        acceptedMeaning: 'The first dispatch closes the north bridge.',
      },
      expectedSource: 'conversational_completion',
      expectedTerms: ['first', 'dispatch', 'clos', 'north', 'bridge'],
      uptake: 'Right—the first dispatch closes the north bridge.',
      handoff: 'The first dispatch closes the north bridge.',
    },
  ];

  for (const fixture of fixtures) {
    const contract = compileTutorStubTurnProgressionContract({
      learnerText: fixture.learnerText,
      responseCompositionFrame: {
        learner_move: fixture.move,
        conversational_completion: fixture.completion || { resolved: false },
        due_evidence_surfaces: [],
      },
      actionFamily: 'reanchor_public_evidence',
      tactic: 'rapid_handoff',
    });
    assert.equal(contract.turn_focus_contract.raw_learner_surface, fixture.learnerText);
    assert.equal(contract.learner_uptake.learner_surface, fixture.learnerText);
    assert.equal(contract.turn_focus_contract.primary_source, fixture.expectedSource);
    assert.deepEqual(contract.turn_focus_contract.primary_terms, fixture.expectedTerms);
    assert.notEqual(contract.turn_focus_contract.primary_surface, fixture.learnerText);

    const audit = auditTutorStubTurnProgression({
      contract,
      composition: composition({ uptake: fixture.uptake, handoff: fixture.handoff }),
    });
    assert.equal(audit.ok, true, `${fixture.learnerText}: ${JSON.stringify(audit.issues)}`);
  }
});

test('rapid handoff cannot take a question owned or forbidden by the handoff contract', () => {
  const cases = [
    {
      learnerText: 'Can you answer what the visitor code means?',
      questionSupport: { responsiveRepairRequired: true },
      expectedMode: 'direct_answer',
    },
    {
      learnerText: 'The evidence settles the finding.',
      dialogueClosureFrame: { mandatory: true },
      expectedMode: 'closure',
    },
    {
      learnerText: 'What should I put in the minutes about the visitor code?',
      expectedMode: 'declarative_missing_support',
    },
  ];

  for (const fixture of cases) {
    const contract = compileTutorStubTurnProgressionContract({
      ...fixture,
      responseCompositionFrame: {
        learner_move: { summary: 'The learner keeps the visitor code in view.' },
        conversational_completion: { resolved: false },
        due_evidence_surfaces: [],
      },
      actionFamily: 'stage_next_step',
      tactic: 'rapid_handoff',
    });
    assert.equal(contract.handoff_contract.mode, fixture.expectedMode);
    assert.equal(contract.handoff_contract.question_allowed, false);

    const audit = auditTutorStubTurnProgression({
      contract,
      composition: composition({
        uptake: tutorStubLearnerRequestsWritableEntry(fixture.learnerText)
          ? 'Write: “The visitor code remains unproved.”'
          : 'Fair—the visitor code remains open.',
        response: 'What does the visitor code show?',
        handoff: 'The visitor code remains open.',
      }),
    });
    assert.equal(audit.ok, false);
    assert.ok(audit.issues.some((issue) => issue.type === 'question_forbidden_by_handoff_contract'));
  }
});

test('typed writable requests include adding a fact to a public record without licensing ordinary echoes', () => {
  const learner = 'What should I put in the minutes about the chargers being dark during the stocktake?';
  assert.equal(tutorStubLearnerRequestsWritableEntry(learner), true);
  assert.equal(tutorStubLearnerRequestsWritableEntry('The chargers were dark during the stocktake.'), false);

  const contract = compileTutorStubTurnProgressionContract({
    learnerText: learner,
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks how to record the chargers being dark during the stocktake.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'stage_next_step',
    tactic: 'unadorned_report',
  });
  assert.equal(contract.learner_uptake.mode, 'writable_entry');
  assert.deepEqual(contract.turn_focus_contract.primary_terms, ['charger', 'being', 'dark', 'during', 'stocktake']);

  const directEntry = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'Write: “The chargers were dark during the stocktake, so they did not cause that dip.”',
      handoff: 'The next check must keep the dark chargers and stocktake timing together.',
    }),
  });
  assert.equal(directEntry.ok, true, JSON.stringify(directEntry.issues));

  const ordinaryEcho = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'The chargers were dark during the stocktake.',
      handoff: 'The next check must keep the dark chargers and stocktake timing together.',
    }),
  });
  assert.equal(ordinaryEcho.ok, false);
  assert.ok(ordinaryEcho.issues.some((issue) => issue.type === 'learner_uptake_not_realized'));
});

test('typed writable requests include ordinary modal inversion but exclude declarative record echoes', () => {
  for (const learner of [
    'Can I put that in the minutes?',
    'Should I add that to the record?',
    'Could I enter this in the ledger?',
    'May I write that in the trial-book?',
  ]) {
    assert.equal(tutorStubLearnerRequestsWritableEntry(learner), true, learner);
    const contract = compileTutorStubTurnProgressionContract({
      learnerText: learner,
      responseCompositionFrame: {
        learner_move: { summary: 'The learner asks whether to add the current point to the public record.' },
        conversational_completion: { resolved: false },
        due_evidence_surfaces: [],
      },
      actionFamily: 'answer_accountably',
      tactic: 'unadorned_report',
    });
    assert.equal(contract.learner_uptake.mode, 'writable_entry', learner);
  }

  for (const echo of [
    'I can put that in the minutes.',
    'I should add that to the record.',
    'That was added to the record.',
    'The minutes include that point.',
  ]) {
    assert.equal(tutorStubLearnerRequestsWritableEntry(echo), false, echo);
  }
});

test('deterministic V1 recovery makes a bounded pacing choice declarative when questions are forbidden', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'I have no idea. Slow down.',
    responseCompositionFrame: {
      learner_move: {
        summary: 'Learner is confused and explicitly asks for slower pacing.',
        affect: 'overwhelmed',
        pedagogical_need: 'Slow down and offer one concrete starting point.',
      },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    questionSupport: {
      answerability: 'direction_only_until_evidence_is_public',
      responsiveRepairRequired: false,
    },
  });
  assert.equal(contract.handoff_contract.question_allowed, false);
  const handoff = deterministicTutorStubTurnProgressionHandoff({
    contract,
    support: {
      modality: 'bounded_directional_choice',
      clarificationInvitationRequired: true,
    },
    defaultQuestion: 'What would you like to inspect?',
    publicObject: 'incident log',
  });
  assert.doesNotMatch(handoff, /\?/u);
  assert.match(handoff, /slow the pace/iu);
  assert.match(handoff, /either begin with the incident log, or ask me to unpack/iu);
});

test('deterministic V1 recovery makes ordinary uncertainty a declarative bounded choice', () => {
  const support = {
    guardRequired: true,
    modality: 'bounded_directional_choice',
    clarificationInvitationRequired: true,
    answerability: 'direction_only_until_evidence_is_public',
    responsiveRepairRequired: false,
  };
  const contract = {
    schema: TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA,
    complete: true,
    public_only: true,
    learner_uptake: {
      required: true,
      mode: 'direct_response',
      learner_surface: 'Not really sure.',
      accepted_meaning: null,
      focus_terms: ['language', 'interface', 'clue'],
    },
    turn_focus_contract: {
      primary_surface: 'Expresses uncertainty about what the language-interface clue shows',
      primary_terms: ['language', 'interface', 'clue'],
      due_surfaces: [],
      due_terms: [],
    },
    handoff_contract: {
      mode: 'declarative_missing_support',
      question_allowed: false,
      question_required: false,
      required_target_surfaces: ['Expresses uncertainty about what the language-interface clue shows'],
      required_target_terms: ['language', 'interface', 'clue'],
      prohibited_settled_surfaces: [],
    },
  };
  assert.equal(contract.handoff_contract.mode, 'declarative_missing_support');
  assert.equal(contract.handoff_contract.question_allowed, false);

  const handoff = deterministicTutorStubTurnProgressionHandoff({
    contract,
    support,
    defaultQuestion: 'Which reading should we test?',
    publicObject: 'formulation card',
  });

  assert.doesNotMatch(handoff, /\?/u);
  assert.match(handoff, /Choose one way forward/iu);
  assert.match(handoff, /use the formulation card to decide/iu);
  assert.match(handoff, /what the language-interface clue shows/iu);
  assert.match(handoff, /or leave that reading open/iu);
  assert.equal(auditTutorStubQuestionSupportResponse({ text: handoff, support }).ok, true);
});

test('deterministic bounded choice keeps classifier analyst prose out of public speech', () => {
  const support = {
    modality: 'bounded_directional_choice',
    clarificationInvitationRequired: true,
  };
  const contract = {
    schema: TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA,
    complete: true,
    public_only: true,
    learner_uptake: {
      required: true,
      mode: 'credit_or_qualify_resolved_move',
      learner_surface:
        'It rules out confident generated advice when policy consequences are uncertain; the tool should instead use approved guidance or hand off.',
      accepted_meaning: 'Learner links unacceptable uncertainty to approved guidance or handoff.',
      focus_terms: ['unacceptable', 'uncertainty', 'approved', 'guidance', 'handoff'],
    },
    turn_focus_contract: {
      primary_surface: 'Learner links unacceptable uncertainty to approved guidance or handoff',
      primary_terms: ['unacceptable', 'uncertainty', 'approved', 'guidance', 'handoff'],
      due_surfaces: [],
      due_terms: [],
    },
    handoff_contract: {
      mode: 'declarative_missing_support',
      question_allowed: false,
      question_required: false,
      required_target_surfaces: ['Learner links unacceptable uncertainty to approved guidance or handoff'],
      required_target_terms: ['unacceptable', 'uncertainty', 'approved', 'guidance', 'handoff'],
      prohibited_settled_surfaces: [],
    },
  };

  const handoff = deterministicTutorStubTurnProgressionHandoff({
    contract,
    support,
    publicObject: 'formulation card',
  });

  assert.doesNotMatch(handoff, /\blearner\b/iu);
  assert.match(handoff, /decide whether it rules out confident generated advice/iu);
  assert.match(handoff, /ask me to unpack one word or connection/iu);
});

test('deterministic V1 recovery replaces generic uptake with bounded typed learner focus', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'First learner message?',
    responseCompositionFrame: {
      learner_move: {},
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'stage_next_step',
  });
  const uptake = deterministicTutorStubTurnProgressionUptake({
    contract,
    defaultUptake: 'I hear the point; the next public fact must answer it.',
  });

  assert.equal(uptake, 'Your point about “First learner message” is the one I will carry forward.');
  assert.doesNotMatch(uptake, /\?/u);
  const audit = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake,
      handoff: 'What does that let us carry forward about “First learner message”?',
    }),
  });
  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
});

test('deterministic V1 recovery varies bounded uptake after a recent tutor turn', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'Second learner message?',
    responseCompositionFrame: {
      learner_move: {},
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'stage_next_step',
  });
  const uptake = deterministicTutorStubTurnProgressionUptake({
    contract,
    defaultUptake: 'I hear the point; the next public fact must answer it.',
    recentTutorTexts: ['An earlier deterministic tutor reply.'],
    variationKey: 'run:t2',
  });

  assert.doesNotMatch(uptake, /^Your point/iu);
  assert.match(uptake, /Second learner message/iu);
  assert.doesNotMatch(uptake, /\?/u);
});

test('deterministic V1 recovery bounds the quoted focus below the learner echo audit', () => {
  const learnerText = 'I am not sure; can you just tell me which public clue matters?';
  const contract = compileTutorStubTurnProgressionContract({
    learnerText,
    responseCompositionFrame: {
      learner_move: {},
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'stage_next_step',
  });
  const learnerEchoGuard = (candidate) => tutorStubSubstantiveLearnerEcho(candidate, learnerText);
  const unguarded = deterministicTutorStubTurnProgressionUptake({
    contract,
    defaultUptake: 'That is a fair question; I’ll answer it before we extend the case.',
  });
  const uptake = deterministicTutorStubTurnProgressionUptake({
    contract,
    defaultUptake: 'That is a fair question; I’ll answer it before we extend the case.',
    learnerEchoGuard,
  });

  // Without the delivery echo guard the realized uptake quotes the learner's
  // whole surface back — exactly what the response-composition audit rejects
  // as verbatim_learner_echo on the deterministic fallback.
  assert.equal(tutorStubSubstantiveLearnerEcho(unguarded, learnerText), true);
  assert.equal(uptake, 'Your point about “I am not sure, can you just tell” is the one I will carry forward.');
  assert.equal(tutorStubSubstantiveLearnerEcho(uptake, learnerText), false);
});

test('deterministic V1 recovery replaces interrogative uptake instead of stripping punctuation', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'Which public mark would connect the tool to one hand?',
    responseCompositionFrame: {
      learner_move: {},
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'stage_next_step',
  });
  const uptake = deterministicTutorStubTurnProgressionUptake({
    contract,
    defaultUptake: 'Which public mark would connect the tool to one hand?',
  });

  assert.notEqual(uptake, 'Which public mark would connect the tool to one hand');
  assert.match(uptake, /Your point about/iu);
  assert.doesNotMatch(uptake, /\?/u);
});
