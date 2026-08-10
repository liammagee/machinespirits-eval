import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAdaptiveWarrantDecisionInputSnapshot,
  classifyLearnerSignal,
  evaluateWarrant,
} from '../services/adaptiveWarrantGateCore.js';
import {
  ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS,
  classifyAdaptiveWarrantEvidenceRequest,
  createAdaptiveWarrantActionContractTracker,
} from '../services/adaptiveWarrantActionContracts.js';
import {
  assessAdaptiveWarrantInquiryCompletion,
  projectAdaptiveWarrantEvidenceAvailability,
} from '../services/adaptiveWarrantInquiryCompletion.js';
import {
  auditAdaptiveWarrantPublicObligationDelivery,
  classifyAdaptiveWarrantPublicSpeechAct,
  createAdaptiveWarrantPublicObligationLedger,
} from '../services/adaptiveWarrantPublicObligationLedger.js';
import { recommendRepairPolicy } from '../services/adaptiveWarrantPolicy.js';
import { createTutorStubInteractiveLearnerRuntime } from '../services/tutorStubInteractiveLearnerRuntime.js';
import {
  assessTutorStubWarrantGateAtResponseSelection,
  projectTutorStubBoundedInquiryScopeAtDecision,
} from '../services/tutorStubResponseConfigurationSelectionRuntime.js';
import { invalidateTutorStubWarrantGateAfterPublicTutorRewrite } from '../services/tutorStubCharacterControlController.js';
import { buildTutorStubFirstDraftContract } from '../services/tutorStubFirstDraftContract.js';
import { renderTutorStubDueSource } from '../services/tutorStubDueSourceRenderer.js';
import {
  auditTutorStubLiveSourceActionAlignmentV1,
  tutorStubLiveResponseConfigurationSurface,
} from '../services/tutorStubLiveFirstDraftAudit.js';
import { auditTutorStubResponseConfiguration } from '../services/tutorStubResponseConfiguration.js';
import { reconcileTutorStubTypedActionWithWarrant } from '../services/tutorStubTurnOrchestration.js';
import {
  createTutorStubWarrantGate,
  enforceTutorStubWarrantGateFinalAuthority,
  ensureTutorStubWarrantGate,
  projectTutorStubWarrantGateOutcomeConfiguration,
  recordTutorStubWarrantGateOutcome,
  restoreTutorStubWarrantGateFromTurns,
  resolveTutorStubWarrantGateMode,
} from '../services/tutorStubWarrantGate.js';

function dagModel(groundedCount) {
  return { learnerRecord: { grounded: Array.from({ length: groundedCount }, (_, i) => [`f${i}`]), voicedDerived: [] } };
}

const CATALOGUE_ACTION_FAMILIES = [
  'clarify_term',
  'repair_explanation',
  'clarify_distinction',
  'stage_next_step',
  'answer_accountably',
  'compress_sayback',
  'reanchor_lived_stake',
  'reanchor_public_evidence',
  'ground_in_material',
  'challenge_resistance',
  'receive_vulnerability',
  'close_inquiry',
  'baseline_plain_response',
];

test('action contracts cover every catalogue family with typed lifecycle transitions', () => {
  assert.deepEqual(Object.keys(ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS).sort(), CATALOGUE_ACTION_FAMILIES.sort());
  for (const definition of Object.values(ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS)) {
    assert.ok(definition.expected_learner_responses.length >= 1);
    assert.ok(definition.deadline_turns >= 1);
    assert.ok(definition.success_transition);
    assert.ok(definition.defeat_transition);
    assert.ok(definition.expiry_transition);
  }
});

test('decision-input digest is canonical across object key order', () => {
  const first = buildAdaptiveWarrantDecisionInputSnapshot({
    turn: 3,
    classification: { turn: { agency: 'steering', discourse_move: 'claim' } },
    reducerStateBefore: {
      strategy_in_force: 'stage_next_step',
      trouble_turns: [{ turn: 1, defeaters: ['no_dag_growth'] }],
    },
  });
  const reordered = buildAdaptiveWarrantDecisionInputSnapshot({
    turn: 3,
    classification: { turn: { discourse_move: 'claim', agency: 'steering' } },
    reducerStateBefore: {
      trouble_turns: [{ defeaters: ['no_dag_growth'], turn: 1 }],
      strategy_in_force: 'stage_next_step',
    },
  });
  assert.deepEqual(first.snapshot, reordered.snapshot);
  assert.equal(first.sha256, reordered.sha256);
});

test('public speech acts separate proposed tests, criteria, and tutor-directed result requests', () => {
  const proposal = classifyAdaptiveWarrantPublicSpeechAct({
    learnerText: 'I would examine the assay-book entries on weight and metal first.',
  });
  const criterion = classifyAdaptiveWarrantPublicSpeechAct({
    learnerText: 'What public evidence would tie this metal to one crucible?',
  });
  const request = classifyAdaptiveWarrantPublicSpeechAct({
    learnerText: 'What mark did the touchstone leave—does it match silver, or show cheaper metal?',
  });
  assert.equal(proposal.kind, 'learner_proposed_test');
  assert.equal(proposal.creates_obligation, false);
  assert.equal(criterion.kind, 'criterion_question');
  assert.equal(criterion.creates_obligation, false);
  assert.equal(
    classifyAdaptiveWarrantPublicSpeechAct({ learnerText: 'What evidence would tie the coin to this bench?' }).kind,
    'criterion_question',
  );
  assert.equal(request.kind, 'tutor_directed_public_result_request');
  assert.equal(request.creates_obligation, true);
  assert.equal(request.target.kind, 'material_or_assay_result');
  for (const selectionText of [
    'Tell me what to test next.',
    'Tell me what to test next?',
    'Please tell me the next test.',
  ]) {
    const selection = classifyAdaptiveWarrantPublicSpeechAct({ learnerText: selectionText });
    assert.equal(selection.kind, 'tutor_selection_request', selectionText);
    assert.equal(selection.creates_obligation, false, selectionText);
  }
  const interpretation = classifyAdaptiveWarrantPublicSpeechAct({
    learnerText: 'What does this evidence mean?',
  });
  assert.equal(interpretation.kind, 'criterion_question');
  assert.equal(interpretation.creates_obligation, false);
  for (const proposalText of [
    'We should inspect what the die mark reveals.',
    'I will compare the dies before making a claim.',
  ]) {
    const embedded = classifyAdaptiveWarrantPublicSpeechAct({ learnerText: proposalText });
    assert.equal(embedded.kind, 'learner_proposed_test', proposalText);
    assert.equal(embedded.creates_obligation, false, proposalText);
  }
  assert.equal(
    classifyAdaptiveWarrantPublicSpeechAct({
      learnerText: 'Would you show me what the next assay result is?',
    }).kind,
    'tutor_directed_public_result_request',
  );
  assert.equal(
    classifyAdaptiveWarrantEvidenceRequest({ learnerText: proposal.surface }),
    null,
    'the action-contract compatibility classifier must not turn a learner proposal into tutor debt',
  );
});

test('public speech-act classifier does not invent tutor result debt from the failed study turns', () => {
  const criterion = classifyAdaptiveWarrantPublicSpeechAct({
    learnerText:
      'The record shows Hessa and Moth had access. What public evidence can we examine next that might link someone to the wiping?',
  });
  assert.equal(criterion.kind, 'criterion_question');
  assert.equal(criterion.creates_obligation, false);

  for (const learnerText of [
    'It confirms Dario was in the kitchen, but it does not show who handled the food. I’d need camera footage or an access trace.',
    'It makes the outside crew’s presence plausible, but the contents log or lost-property record would be worth checking.',
  ]) {
    const speechAct = classifyAdaptiveWarrantPublicSpeechAct({ learnerText });
    assert.equal(speechAct.creates_obligation, false, learnerText);
  }

  const contactCriterion = classifyAdaptiveWarrantPublicSpeechAct({
    learnerText:
      'So Hessa\u2019s reach and Moth\u2019s route establish opportunity, not contact; what evidence can put a hand\u2014or chassis\u2014on the music core?',
  });
  assert.equal(contactCriterion.kind, 'criterion_question');
  assert.equal(contactCriterion.creates_obligation, false);

  const wording = classifyAdaptiveWarrantPublicSpeechAct({
    learnerText:
      'Can you give me the next line for WF-11—“an outside crew’s noon badge, not proof that the crew took the lunchbox”?',
  });
  assert.equal(wording.kind, 'learner_wording_request');
  assert.equal(wording.creates_obligation, false);
  assert.equal(wording.target, null);

  for (const learnerText of [
    'Could you record that WF-11 shows outside crew access, while leaving who took the lunchbox unproved?',
    'Do you want me to record that Moth had access, but that this does not show Moth wiped the core?',
    'Should I record that Hessa had access, without treating access as proof?',
  ]) {
    const recordEntry = classifyAdaptiveWarrantPublicSpeechAct({ learnerText });
    assert.equal(recordEntry.kind, 'learner_record_entry_request', learnerText);
    assert.equal(recordEntry.creates_obligation, false, learnerText);
    assert.equal(recordEntry.target, null, learnerText);
  }

  const missingRecordResult = classifyAdaptiveWarrantPublicSpeechAct({
    learnerText: 'Could you record what the WF-11 entry reveals?',
  });
  assert.equal(missingRecordResult.kind, 'tutor_directed_public_result_request');
  assert.equal(missingRecordResult.creates_obligation, true);
});

test('public speech-act classifier covers the bounded seventh-corpus misses without widening nearby acts', () => {
  for (const learnerText of [
    'WF-11 adds another noon-window access route, so Dario isn’t singled out; what’s the next clue?',
    'The ledger still does not identify the crew member; give me the next clue.',
    'Yes—read it aloud; could that “first” line be a missing earlier entry?',
    'The camera evidence has not been reported; please check whether it shows anyone handling shelf two.',
  ]) {
    const request = classifyAdaptiveWarrantPublicSpeechAct({ learnerText });
    assert.equal(request.kind, 'tutor_directed_public_result_request', learnerText);
    assert.equal(request.creates_obligation, true, learnerText);
  }

  for (const learnerText of [
    "Let's examine the jukebox's boot log for the last access before the wipe.",
    'Can we inspect the console access history or tamper record?',
    'May I examine the inquiry log for the first evidence entry?',
    'Before naming anyone, I want the fridge access record checked first.',
  ]) {
    const proposal = classifyAdaptiveWarrantPublicSpeechAct({ learnerText });
    assert.equal(proposal.kind, 'learner_proposed_test', learnerText);
    assert.equal(proposal.creates_obligation, false, learnerText);
  }

  for (const learnerText of [
    'Could you choose which public record would show whether Moth had the service-panel override key?',
    'Could you choose which connection you want me to record?',
  ]) {
    const selection = classifyAdaptiveWarrantPublicSpeechAct({ learnerText });
    assert.equal(selection.kind, 'tutor_selection_request', learnerText);
    assert.equal(selection.creates_obligation, false, learnerText);
  }

  for (const learnerText of [
    'I’ll record only that WF-11’s crew was present, without assigning responsibility.',
    'I can record that authorization, if that’s what you want.',
    'Let me record this distinction before we continue.',
  ]) {
    const recordEntry = classifyAdaptiveWarrantPublicSpeechAct({ learnerText });
    assert.equal(recordEntry.kind, 'learner_record_entry_request', learnerText);
    assert.equal(recordEntry.creates_obligation, false, learnerText);
  }

  assert.equal(
    classifyAdaptiveWarrantPublicSpeechAct({ learnerText: 'Could another machine have reached the jukebox?' }).kind,
    'other',
  );
  assert.equal(
    classifyAdaptiveWarrantPublicSpeechAct({ learnerText: 'What would the next clue need to establish?' }).kind,
    'criterion_question',
  );
  assert.equal(
    classifyAdaptiveWarrantPublicSpeechAct({ learnerText: 'Could you record what the boot log reveals?' }).kind,
    'tutor_directed_public_result_request',
  );
});

test('public target terms normalize alphanumeric identifiers without empty or trailing-hyphen tokens', () => {
  const request = classifyAdaptiveWarrantPublicSpeechAct({
    learnerText: 'Show me what the WF-11 record entry reveals.',
  });
  assert.equal(request.kind, 'tutor_directed_public_result_request');
  assert.ok(request.target.public_terms.includes('wf-11'));
  assert.equal(request.target.public_terms.some((term) => !term || term.endsWith('-')), false);
  assert.equal(request.target.subject_terms.some((term) => !term || term.endsWith('-')), false);
});

test('public-result debt is scoped to the directed clause instead of incidental earlier claims', () => {
  const cases = [
    {
      learnerText:
        'Then I can record only that noon access is the next check, not that Dario took it. What record would link someone on that list to Priya\u2019s lunchbox?',
      expectedSurface: 'What record would link someone on that list to Priya\u2019s lunchbox?',
      expectedSubjects: ['list', 'priya', 'lunchbox'],
    },
    {
      learnerText:
        'That makes Moth capable of opening the panel, but could the wipe still have come from Hessa or another operator using it? Can you show a record tying Moth\u2019s override key to the wipe pulse?',
      expectedSurface: 'Can you show a record tying Moth\u2019s override key to the wipe pulse?',
      expectedSubjects: ['moth', 'override', 'key', 'wipe', 'pulse'],
    },
    {
      learnerText:
        'What should I write next about what the badge log establishes and what evidence is still needed?',
      expectedSurface:
        'What should I write next about what the badge log establishes and what evidence is still needed?',
      expectedSubjects: ['badge'],
    },
    {
      learnerText: 'What is the boot log\u2019s last-activity line? I need that entry before I can record what it proves.',
      expectedSurface: 'What is the boot log\u2019s last-activity line?',
      expectedSubjects: ['boot', 'last-activity'],
    },
  ];

  for (const row of cases) {
    const speechAct = classifyAdaptiveWarrantPublicSpeechAct({ learnerText: row.learnerText });
    assert.equal(speechAct.kind, 'tutor_directed_public_result_request', row.learnerText);
    assert.equal(speechAct.target.source_surface, row.expectedSurface, row.learnerText);
    assert.deepEqual(speechAct.target.subject_terms, row.expectedSubjects, row.learnerText);
  }
});

test('delivery recognizers cover the bounded closure and precise contrast used by the study', () => {
  for (const text of [
    'I close the incident record on the supported finding.',
    'I gather these public supports into the final record and close it at the crew level.',
    'The record closes on the Wrenfold crew, not an individual worker.',
    'The record closes here; no further clue is needed.',
    'The record closes at crew level; there is no next clue to give.',
    'The record closes with Wrenfold named, not an individual handler.',
  ]) {
    const closure = auditTutorStubResponseConfiguration({
      text,
      configuration: { action_family: 'close_inquiry', engagement_stance: 'plain' },
    });
    assert.equal(closure.axes.action_family.visible, true, text);
  }

  const conditional = auditTutorStubResponseConfiguration({
    text: 'I keep the final record open until the crew-level finding is supported.',
    configuration: { action_family: 'close_inquiry', engagement_stance: 'plain' },
  });
  assert.equal(conditional.axes.action_family.visible, false);

  const pursuit = auditTutorStubResponseConfiguration({
    text: 'The record closes in on Moth as the evidence accumulates.',
    configuration: { action_family: 'close_inquiry', engagement_stance: 'plain' },
  });
  assert.equal(pursuit.axes.action_family.visible, false);

  const accountableUptake = auditTutorStubResponseConfiguration({
    text: 'You correctly separate Moth\u2019s docking from access to the core and identify the missing dated link to the wipe.',
    configuration: { action_family: 'answer_accountably', engagement_stance: 'plain' },
  });
  assert.equal(accountableUptake.axes.action_family.visible, true);

  const costumeGap = auditTutorStubResponseConfiguration({
    text: 'You identify the missing costume detail in the scene.',
    configuration: { action_family: 'answer_accountably', engagement_stance: 'plain' },
  });
  assert.equal(costumeGap.axes.action_family.visible, false);

  const precise = auditTutorStubResponseConfiguration({
    text: 'The ledger supports Wrenfold’s responsibility, not a named crew member.',
    configuration: { action_family: 'answer_accountably', engagement_stance: 'precise' },
  });
  assert.equal(precise.axes.engagement_stance.visible, true);
});

test('live host stance audit excludes immutable direct-source prose without hiding the host action', () => {
  const source = renderTutorStubDueSource({
    premise: 'p_noon',
    mode: 'presented_exhibit',
    role: 'keeper of the badge log',
    surface:
      'The badge log has Dario in the kitchen at 12:02 — mug in hand, by his own cheerful admission, and not one bit sorry about the last two times.',
  });
  const text =
    'The requested entry is not public yet; once a matching record is available, I can answer it. ' +
    `I write that line into the badge log: ${source.text} That named public-record release is next.`;
  const sourceAlignment = auditTutorStubLiveSourceActionAlignmentV1({
    text,
    firstDraftContract: {
      evidence: {
        sources: [source],
        source_accessibility: { compensation_required: false },
      },
    },
  });
  assert.equal(sourceAlignment.ok, true, JSON.stringify(sourceAlignment.issues));

  const hostSurface = tutorStubLiveResponseConfigurationSurface({
    text,
    liveSourceActionAlignmentAudit: sourceAlignment,
  });
  assert.equal(hostSurface.active, true);
  assert.equal(hostSurface.reason, 'typed_live_host_axes_exclude_exact_source');
  assert.deepEqual(hostSurface.excluded_spans.map((span) => span.kind), ['exact_source']);
  assert.doesNotMatch(hostSurface.text, /mug in hand/iu);

  const audit = auditTutorStubResponseConfiguration({
    text: hostSurface.text,
    configuration: {
      engagement_stance: 'plain',
      action_family: 'answer_accountably',
      audience_register: 'adult_novice',
      lexical_accessibility: 'plain',
      scene_immersion: 'grounded',
      actorial_part: 'record_keeper',
    },
  });
  assert.equal(audit.axes.engagement_stance.visible, true);
  assert.equal(audit.axes.action_family.visible, true);
});

test('action contract: successful challenge requires exit to stage_next_step without DAG growth', () => {
  const tracker = createAdaptiveWarrantActionContractTracker();
  const result = tracker.assess({
    turn: 2,
    actionFamily: 'challenge_resistance',
    learnerText: 'I record poor dross without naming who struck the coins.',
    signal: classifyLearnerSignal('I record poor dross without naming who struck the coins.'),
    classification: {
      turn: {
        request_type: 'stepwise_support_request',
        discourse_move: 'evidence_adoption',
        evidence_use: 'cites_public_evidence',
        epistemic_stance: 'grounded',
        agency: 'steering',
      },
    },
    dagGrowth: 0,
  });
  assert.equal(result.status, 'success');
  assert.equal(result.transition.revision_warranted, true);
  assert.equal(result.transition.recommended_action_family, 'stage_next_step');
});

test('action contract: public-result debt is not smuggled into expected-uptake status', () => {
  const tracker = createAdaptiveWarrantActionContractTracker();
  const classification = {
    turn: {
      request_type: 'stepwise_support_request',
      discourse_move: 'question',
      evidence_use: 'cites_public_evidence',
      epistemic_stance: 'reflective',
      agency: 'steering',
    },
  };
  const firstText = 'I would examine the public die-mark before attributing the coins.';
  const first = tracker.assess({
    turn: 2,
    actionFamily: 'stage_next_step',
    learnerText: firstText,
    classification,
    signal: classifyLearnerSignal(firstText),
    dagGrowth: 0,
  });
  assert.equal(first.status, 'success');
  const secondText = 'What distinctive die-mark did the comparison reveal?';
  const second = tracker.assess({
    turn: 3,
    actionFamily: 'stage_next_step',
    learnerText: secondText,
    classification,
    signal: classifyLearnerSignal(secondText),
    dagGrowth: 0,
  });
  assert.notEqual(second.status, 'defeat');
  assert.notEqual(second.reason, 'specific_evidence_request_repeated_after_tutor_turn');
});

test('public-obligation ledger creates, persists, and satisfies tutor-owned result debt', () => {
  const ledger = createAdaptiveWarrantPublicObligationLedger();
  const created = ledger.assess({
    turn: 1,
    learnerText: 'What do the balance and ring show?',
  });
  assert.equal(created.open_count, 1);
  assert.equal(created.blocking_obligation.status, 'open');
  assert.equal(created.blocking_obligation.owner, 'tutor');

  const overdue = ledger.assess({
    turn: 2,
    learnerText: 'The town verdict concerns access, not the coin itself.',
    priorTutorOutcome: {
      turn: 1,
      tutor_text: 'The result is not yet recorded. What does the town verdict establish?',
      released_evidence: [],
    },
  });
  assert.equal(overdue.blocking_obligation.id, created.blocking_obligation.id);
  assert.equal(overdue.blocking_obligation.status, 'overdue');

  const satisfied = ledger.assess({
    turn: 3,
    learnerText: 'I can now use that result.',
    priorTutorOutcome: {
      turn: 2,
      tutor_text: 'The balance shows the shilling is light, and its ring sounds dull.',
      released_evidence: [],
    },
  });
  assert.equal(satisfied.blocking_obligation, null);
  assert.equal(satisfied.obligations[0].status, 'satisfied');
  assert.equal(satisfied.obligations[0].satisfied_turn, 2);
});

test('public-obligation ledger accepts only a named, concrete accountable deferral', () => {
  const ledger = createAdaptiveWarrantPublicObligationLedger();
  ledger.assess({ turn: 1, learnerText: 'What do the balance and ring show?' });
  const deferred = ledger.assess({
    turn: 2,
    learnerText: 'I will hold that request open.',
    priorTutorOutcome: {
      turn: 1,
      tutor_text: 'The balance and ring result is not public yet; when the assay entry is released, I will report it.',
    },
  });
  assert.equal(deferred.blocking_obligation, null);
  assert.equal(deferred.obligations[0].status, 'deferred');
  assert.equal(deferred.obligations[0].deferral.deadline_turn, null);
  assert.equal(
    deferred.obligations[0].deferral.reactivation_policy,
    'matching_public_release_or_explicit_learner_reminder',
  );

  const stillDeferred = ledger.assess({
    turn: 3,
    learnerText: 'What would you like me to check next?',
    priorTutorOutcome: {
      turn: 2,
      tutor_text: 'The town verdict establishes access, not who handled the coin.',
    },
  });
  assert.equal(stillDeferred.blocking_obligation, null);
  assert.equal(stillDeferred.obligations[0].status, 'deferred');

  const reminded = ledger.assess({
    turn: 4,
    learnerText: 'Can you now tell me what the weight reading showed?',
    priorTutorOutcome: {
      turn: 3,
      tutor_text: 'The witness list gives us the next public check.',
    },
  });
  assert.equal(reminded.blocking_obligation.id, deferred.obligations[0].id);
  assert.equal(reminded.blocking_obligation.status, 'reactivated');
});

test('delivery audit ignores questions inside exact released evidence when checking a deferral', () => {
  const authoredSource = '“Can I enter this die mark?” asks the public register.';
  const audit = auditAdaptiveWarrantPublicObligationDelivery({
    obligation: {
      obligation_id: 'public-obligation-001',
      target: classifyAdaptiveWarrantPublicSpeechAct({
        learnerText: 'What do the balance and ring show?',
      }).target,
    },
    tutorOutcome: {
      tutor_text: `${authoredSource} The balance and ring result is not public yet; when the assay entry is released, I will report it.`,
      released_evidence: [{ premise: 'register_question', surface: authoredSource }],
    },
  });

  assert.equal(audit.status, 'deferred');
  assert.equal(audit.terminal_question_count, 0);
});

test('public-obligation reminders coalesce across synonymous test wording', () => {
  const ledger = createAdaptiveWarrantPublicObligationLedger();
  ledger.assess({ turn: 1, learnerText: 'What do the balance and ring show?' });
  const reminded = ledger.assess({
    turn: 2,
    learnerText: 'Can you tell me the weight reading from that test?',
    priorTutorOutcome: { turn: 1, tutor_text: 'That result is not yet recorded. What comes next?' },
  });
  assert.equal(reminded.obligations.length, 1);
  assert.equal(reminded.obligations[0].occurrences, 2);
  assert.equal(reminded.obligations[0].last_reminded_turn, 2);
});

test('die-comparison paraphrases coalesce without rhetorical words becoming target identity', () => {
  const ledger = createAdaptiveWarrantPublicObligationLedger();
  ledger.assess({ turn: 1, learnerText: 'What distinctive die mark did the comparison reveal?' });
  const reminded = ledger.assess({
    turn: 2,
    learnerText: 'Can you tell me what the die match shows?',
    priorTutorOutcome: {
      turn: 1,
      tutor_text: 'That comparison is not public yet; after the next exhibit I will report it.',
    },
  });
  assert.equal(reminded.obligations.length, 1);
  assert.equal(reminded.obligations[0].occurrences, 2);
  assert.equal(reminded.obligations[0].target.kind, 'comparison_result');
});

test('one named comparison answer cannot discharge another same-kind obligation', () => {
  const foxtrotObligation = {
    obligation_id: 'public-obligation-001',
    target: classifyAdaptiveWarrantPublicSpeechAct({
      learnerText: 'Please show what the Foxtrot die comparison revealed.',
    }).target,
  };
  for (const adjacentWrongAnswer of [
    'We set the Foxtrot comparison aside. The Larkspur comparison shows a match with the northern tool.',
    'Foxtrot remains our target. There is no public comparison match for Larkspur.',
  ]) {
    assert.equal(
      auditAdaptiveWarrantPublicObligationDelivery({
        obligation: foxtrotObligation,
        tutorOutcome: { tutor_text: adjacentWrongAnswer },
      }).status,
      'unfulfilled',
      adjacentWrongAnswer,
    );
  }

  const ledger = createAdaptiveWarrantPublicObligationLedger();
  ledger.assess({ turn: 1, learnerText: 'Please show what the Foxtrot die comparison revealed.' });
  const second = ledger.assess({
    turn: 2,
    learnerText: 'Please show what the Larkspur die comparison revealed.',
    priorTutorOutcome: { turn: 1, tutor_text: 'The Foxtrot result is not yet public.' },
  });
  assert.equal(second.obligations.length, 2);

  const resolved = ledger.assess({
    turn: 3,
    learnerText: 'I will keep both comparisons separate.',
    priorTutorOutcome: {
      turn: 2,
      tutor_text: 'The Foxtrot die comparison shows a match with the northern tool.',
    },
  });
  assert.equal(resolved.obligations[0].status, 'satisfied');
  assert.equal(resolved.obligations[1].status, 'overdue');
});

test('obligation identity preserves discriminating subject terms within one named comparison', () => {
  const ledger = createAdaptiveWarrantPublicObligationLedger();
  ledger.assess({ turn: 1, learnerText: 'What did the Foxtrot outer die comparison show?' });
  const second = ledger.assess({
    turn: 2,
    learnerText: 'What did the Foxtrot inner die comparison show?',
    priorTutorOutcome: { turn: 1, tutor_text: 'Both comparison results remain pending.' },
  });
  assert.equal(second.obligations.length, 2);
  assert.equal(second.obligations[0].target.signature, 'comparison_result:foxtrot|outer');
  assert.equal(second.obligations[1].target.signature, 'comparison_result:foxtrot|inner');

  const innerOnly = ledger.assess({
    turn: 3,
    learnerText: 'I will keep the inner and outer comparisons separate.',
    priorTutorOutcome: {
      turn: 2,
      tutor_text: 'The Foxtrot inner die comparison shows a match with the northern tool.',
    },
  });
  assert.equal(innerOnly.obligations[0].status, 'overdue');
  assert.equal(innerOnly.obligations[1].status, 'satisfied');
});

test('an accountable deferral ties its next condition to the named obligation', () => {
  const obligation = {
    obligation_id: 'public-obligation-001',
    target: classifyAdaptiveWarrantPublicSpeechAct({
      learnerText: 'What did the Foxtrot die comparison show?',
    }).target,
  };
  const unrelated = auditAdaptiveWarrantPublicObligationDelivery({
    obligation,
    tutorOutcome: {
      tutor_text:
        'The Foxtrot comparison result is not public yet. When the Larkspur record is released, I can answer the Larkspur question.',
    },
  });
  assert.equal(unrelated.status, 'unfulfilled');
  assert.equal(unrelated.concrete_next_step, false);

  const linked = auditAdaptiveWarrantPublicObligationDelivery({
    obligation,
    tutorOutcome: {
      tutor_text:
        'The Foxtrot comparison result is not public yet. When its comparison record is released, I can answer it.',
    },
  });
  assert.equal(linked.status, 'deferred');
  assert.equal(linked.concrete_next_step, true);
});

test('multiple public obligations resolve independently and withdrawal closes only one', () => {
  const ledger = createAdaptiveWarrantPublicObligationLedger();
  ledger.assess({ turn: 1, learnerText: 'What do the balance and ring show?' });
  const second = ledger.assess({
    turn: 2,
    learnerText: 'What distinctive die mark did the comparison reveal?',
    priorTutorOutcome: { turn: 1, tutor_text: 'That result is not yet recorded. What comes next?' },
  });
  assert.equal(second.obligations.length, 2);
  const partlyResolved = ledger.assess({
    turn: 3,
    learnerText: 'I still need the die comparison.',
    priorTutorOutcome: {
      turn: 2,
      tutor_text: 'The balance shows the shilling is light, and its ring sounds dull.',
    },
  });
  assert.equal(partlyResolved.obligations[0].status, 'satisfied');
  assert.equal(partlyResolved.obligations[1].status, 'overdue');
  const withdrawn = ledger.assess({
    turn: 4,
    learnerText: 'Never mind; withdraw that request.',
    priorTutorOutcome: { turn: 3, tutor_text: 'The comparison remains unavailable.' },
  });
  assert.equal(withdrawn.obligations[0].status, 'satisfied');
  assert.equal(withdrawn.obligations[1].status, 'withdrawn');
  assert.equal(withdrawn.blocking_obligation, null);
});

test('withdrawal or transfer can close one debt and create a replacement request in the same turn', () => {
  for (const learnerText of [
    'Never mind that; what did the die show?',
    'I will check it myself; what did the die show?',
  ]) {
    const ledger = createAdaptiveWarrantPublicObligationLedger();
    ledger.assess({ turn: 1, learnerText: 'What do the balance and ring show?' });
    const replaced = ledger.assess({
      turn: 2,
      learnerText,
      priorTutorOutcome: { turn: 1, tutor_text: 'We should continue with the public record.' },
    });
    assert.equal(replaced.obligations.length, 2, learnerText);
    assert.ok(['withdrawn', 'transferred_to_learner'].includes(replaced.obligations[0].status), learnerText);
    assert.equal(replaced.obligations[1].status, 'open', learnerText);
    assert.equal(replaced.obligations[1].target.kind, 'mark_or_tool_result', learnerText);
    assert.equal(replaced.blocking_obligation.id, replaced.obligations[1].id, learnerText);
  }
});

test('a named withdrawal closes the matching obligation instead of the oldest one', () => {
  const ledger = createAdaptiveWarrantPublicObligationLedger();
  ledger.assess({ turn: 1, learnerText: 'Please show what the Foxtrot die comparison revealed.' });
  ledger.assess({
    turn: 2,
    learnerText: 'Please show what the Larkspur die comparison revealed.',
    priorTutorOutcome: { turn: 1, tutor_text: 'Neither named comparison is public yet.' },
  });
  const withdrawn = ledger.assess({
    turn: 3,
    learnerText: 'Never mind the Larkspur comparison.',
    priorTutorOutcome: { turn: 2, tutor_text: 'Both named comparisons remain unavailable.' },
  });
  assert.equal(withdrawn.obligations[0].status, 'overdue');
  assert.equal(withdrawn.obligations[1].status, 'withdrawn');
  assert.equal(withdrawn.blocking_obligation.id, withdrawn.obligations[0].id);
});

test('same-turn delivery audit accepts the active directive shape without an internal id leak', () => {
  const audit = auditAdaptiveWarrantPublicObligationDelivery({
    obligation: {
      obligation_id: 'public-obligation-001',
      target: {
        kind: 'weight_or_ring_result',
        public_terms: ['balance', 'ring'],
        source_surface: 'What do the balance and ring show?',
      },
    },
    tutorOutcome: { tutor_text: 'The balance shows the coin is light, and the ring sounds dull.' },
  });
  assert.equal(audit.obligation_id, 'public-obligation-001');
  assert.equal(audit.status, 'satisfied');
});

test('delivery audit requires an answer-bearing target relation, not target nouns alone', () => {
  const obligation = {
    obligation_id: 'public-obligation-001',
    target: classifyAdaptiveWarrantPublicSpeechAct({
      learnerText: 'What do the balance and ring show?',
    }).target,
  };
  for (const tutorText of [
    'The ring was dull.',
    'The balance and ring are worth checking.',
    'The balance and ring result is the question before us.',
  ]) {
    assert.equal(
      auditAdaptiveWarrantPublicObligationDelivery({
        obligation,
        tutorOutcome: { turn: 1, tutor_text: tutorText },
      }).status,
      'unfulfilled',
      tutorText,
    );
  }
  assert.equal(
    auditAdaptiveWarrantPublicObligationDelivery({
      obligation,
      tutorOutcome: { turn: 1, tutor_text: 'The balance shows the shilling is light, and the ring sounds dull.' },
    }).status,
    'satisfied',
  );
  for (const partial of [
    'The ring sounds dull.',
    'The balance shows the shilling is light.',
    'The balance shows the shilling is light, and the ring is worth checking.',
  ]) {
    assert.equal(
      auditAdaptiveWarrantPublicObligationDelivery({
        obligation,
        tutorOutcome: { turn: 1, tutor_text: partial },
      }).status,
      'unfulfilled',
      partial,
    );
  }
});

test('evidence availability uses the pre-delivery boundary for both live and committed snapshots', () => {
  const schedule = [
    { premise: 'p1', effectiveTurn: 1, releasedTurn: 1 },
    { premise: 'p2', effectiveTurn: 2, releasedTurn: 2 },
    { premise: 'p3', effectiveTurn: 4, releasedTurn: null },
  ];
  const atTwo = projectAdaptiveWarrantEvidenceAvailability({ schedule }, { turn: 2 });
  assert.equal(atTwo.released_before_decision_count, 1);
  assert.equal(atTwo.due_now_count, 1, 'a turn-2 delivery is still due at decision 2');
  assert.equal(atTwo.future_licensed_count, 1);
  assert.equal(atTwo.release_scope_exhausted, false);

  const exhausted = projectAdaptiveWarrantEvidenceAvailability(
    { schedule: schedule.map((row) => ({ ...row, releasedTurn: row.effectiveTurn })) },
    { turn: 5 },
  );
  assert.equal(exhausted.release_scope_exhausted, true);
});

test('an explicitly empty authored schedule is known and can license grounded closure', () => {
  const evidenceAvailability = projectAdaptiveWarrantEvidenceAvailability({ turn: 1, schedule: [] }, { turn: 1 });
  assert.equal(evidenceAvailability.known, true);
  assert.equal(evidenceAvailability.release_scope_exhausted, true);

  const gate = createTutorStubWarrantGate({ mode: 'active' });
  const decision = gate.assess({
    turn: 1,
    learnerText: 'The public proof is complete.',
    dagModel: {
      learnerRecord: { grounded: [], voicedDerived: [] },
      assessment: { finalSecretEntailed: true, assertedSecret: true },
    },
    proposedActionFamily: 'close_inquiry',
    dialogueClosureFrame: { strictGrounded: true, mandatory: true, available: true },
    evidenceAvailability,
  });
  assert.equal(decision.inquiry_completion.status, 'complete');
  assert.equal(decision.decision_kind, 'terminal_transition');
  assert.equal(decision.policy.family, 'close_inquiry');
  assert.equal(decision.override, null);
});

test('inquiry completion projects strict grounded closure and is blocked by a public obligation', () => {
  const completeDag = { assessment: { finalSecretEntailed: true, assertedSecret: true } };
  const openLedger = {
    open_count: 1,
    blocking_obligation: { id: 'public-obligation-001', status: 'open' },
  };
  const blocked = assessAdaptiveWarrantInquiryCompletion({
    dagModel: completeDag,
    publicObligation: openLedger,
    evidenceAvailability: { known: true, release_scope_exhausted: true },
  });
  assert.equal(blocked.status, 'open');
  assert.deepEqual(blocked.blockers, ['open_public_obligation']);

  const complete = assessAdaptiveWarrantInquiryCompletion({
    dagModel: completeDag,
    publicObligation: { open_count: 0, blocking_obligation: null },
    evidenceAvailability: { known: true, release_scope_exhausted: true },
  });
  assert.equal(complete.status, 'complete');
  assert.equal(complete.decision_kind, 'terminal_transition');
  assert.equal(complete.transition.recommended_action_family, 'close_inquiry');
});

test('an accountably deferred obligation remains recorded without blocking grounded closure', () => {
  const result = assessAdaptiveWarrantInquiryCompletion({
    dagModel: { assessment: { finalSecretEntailed: true, assertedSecret: true } },
    publicObligation: {
      open_count: 1,
      blocking_obligation: null,
      obligations: [{ id: 'public-obligation-001', status: 'deferred' }],
    },
    evidenceAvailability: { known: true, release_scope_exhausted: true },
  });

  assert.equal(result.status, 'complete');
  assert.equal(result.checks.open_public_obligation_count, 0);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.transition.recommended_action_family, 'close_inquiry');
});

test('exhaustion or a fixed horizon alone never licenses whole-inquiry closure', () => {
  const result = assessAdaptiveWarrantInquiryCompletion({
    dagModel: { assessment: { finalSecretEntailed: false, assertedSecret: false } },
    evidenceAvailability: { known: true, release_scope_exhausted: true },
  });
  assert.equal(result.status, 'open');
  assert.equal(result.transition, null);
});

test('a grounded assertion remains nonterminal while authored evidence is still licensed', () => {
  const result = assessAdaptiveWarrantInquiryCompletion({
    dagModel: { assessment: { finalSecretEntailed: true, assertedSecret: true } },
    publicObligation: { open_count: 0, blocking_obligation: null },
    evidenceAvailability: {
      known: true,
      release_scope_exhausted: false,
      remaining_licensed_count: 2,
      future_licensed_count: 2,
    },
  });
  assert.equal(result.status, 'open');
  assert.ok(result.blockers.includes('licensed_evidence_remains'));
  assert.equal(result.transition, null);
});

test('bounded-scope completion requires an identified contract and every safety predicate explicitly true', () => {
  for (const boundedScope of [
    {
      enabled: true,
      release_scope_exhausted: true,
      terminal_outcome_asserted: true,
      evidence_integrated: true,
      proof_limit_preserved: true,
    },
    {
      enabled: true,
      id: 'missing-explicit-safety-predicates',
      release_scope_exhausted: true,
      terminal_outcome_asserted: true,
    },
  ]) {
    const result = assessAdaptiveWarrantInquiryCompletion({
      boundedScope,
      evidenceAvailability: { known: false, release_scope_exhausted: false },
    });
    assert.equal(result.status, 'open');
    assert.equal(result.transition, null);
  }
});

test('live gate consumes only an explicit decision-time bounded-scope projection and snapshots it', () => {
  const authoredScope = {
    enabled: true,
    id: 'authored-proof-limit-1',
    release_scope_exhausted: true,
    terminal_outcome_asserted: true,
    evidence_integrated: true,
    proof_limit_preserved: true,
  };
  const state = { boundedInquiryScopeAtDecision: authoredScope };
  const projected = projectTutorStubBoundedInquiryScopeAtDecision(state);
  assert.deepEqual(projected, authoredScope);
  assert.notEqual(projected, authoredScope, 'the live planner boundary must freeze its own copy');
  assert.equal(projectTutorStubBoundedInquiryScopeAtDecision({}), null);
  assert.equal(
    projectTutorStubBoundedInquiryScopeAtDecision({
      boundedInquiryScopeAtDecision: { ...authoredScope, enabled: false },
    }),
    null,
  );
  assert.equal(
    projectTutorStubBoundedInquiryScopeAtDecision({
      boundedInquiryScopeAtDecision: {
        enabled: true,
        id: 'incomplete-contract',
        release_scope_exhausted: true,
        terminal_outcome_asserted: true,
      },
    }),
    null,
    'live projection must not inherit permissive defaults for omitted safety predicates',
  );

  let selectionBoundaryInput = null;
  assessTutorStubWarrantGateAtResponseSelection(
    {
      assess(input) {
        selectionBoundaryInput = input;
        return { accepted: true };
      },
    },
    state,
    { turn: 1, learnerText: 'bounded finding' },
  );
  assert.deepEqual(selectionBoundaryInput.boundedInquiryScope, authoredScope);

  const gate = createTutorStubWarrantGate({ mode: 'active' });
  const decision = gate.assess({
    turn: 1,
    learnerText: 'The public evidence reaches its stated limit, so no stronger answer is warranted.',
    classification: { turn: { discourse_move: 'claim', epistemic_stance: 'grounded' } },
    dagModel: { learnerRecord: { grounded: [], voicedDerived: [] }, assessment: {} },
    proposedActionFamily: 'stage_next_step',
    evidenceAvailability: { known: false, release_scope_exhausted: false },
    boundedInquiryScope: projected,
  });

  assert.equal(decision.inquiry_completion.status, 'complete');
  assert.equal(decision.inquiry_completion.basis, 'authored_bounded_scope');
  assert.equal(decision.policy.family, 'close_inquiry');
  assert.deepEqual(decision.bounded_inquiry_scope, authoredScope);
  assert.deepEqual(decision.input_snapshot.bounded_inquiry_scope, authoredScope);
  assert.deepEqual(gate.snapshot().bounded_inquiry_scope, authoredScope);

  authoredScope.id = 'mutated-after-assess';
  assert.equal(gate.snapshot().bounded_inquiry_scope.id, 'authored-proof-limit-1');
});

test('resume replays the frozen bounded-scope input with live decision and snapshot parity', () => {
  const boundedInquiryScope = {
    enabled: true,
    id: 'authored-proof-limit-resume',
    release_scope_exhausted: true,
    terminal_outcome_asserted: true,
    evidence_integrated: true,
    proof_limit_preserved: true,
  };
  const learnerText = 'The available record supports only this bounded finding.';
  const classification = { turn: { discourse_move: 'claim', epistemic_stance: 'grounded' } };
  const dag = { learnerRecord: { grounded: [], voicedDerived: [] }, assessment: {} };
  const evidenceAvailability = { known: false, release_scope_exhausted: false };
  const uninterrupted = createTutorStubWarrantGate({ mode: 'active' });
  const liveDecision = uninterrupted.assess({
    turn: 1,
    learnerText,
    classification,
    dagModel: dag,
    proposedActionFamily: 'stage_next_step',
    evidenceAvailability,
    boundedInquiryScope,
  });
  uninterrupted.recordTurnOutcome({
    turn: 1,
    actionFamily: 'close_inquiry',
    tutorText: 'That is the supported limit of this inquiry; I close it here.',
    deliveredResponseConfiguration: { action_family: 'close_inquiry' },
  });

  const restored = createTutorStubWarrantGate({ mode: 'active' });
  restoreTutorStubWarrantGateFromTurns(restored, [
    {
      turn: 1,
      learner: learnerText,
      classification,
      tutorLearnerDagModel: dag,
      warrantGateDecision: liveDecision,
      deliveredResponseConfiguration: { action_family: 'close_inquiry' },
      tutor: 'That is the supported limit of this inquiry; I close it here.',
    },
  ]);

  const replayedDecision = restored.decisions()[0];
  assert.equal(replayedDecision.input_digest, liveDecision.input_digest);
  assert.deepEqual(replayedDecision.bounded_inquiry_scope, boundedInquiryScope);
  assert.deepEqual(replayedDecision.input_snapshot.bounded_inquiry_scope, boundedInquiryScope);
  assert.deepEqual(replayedDecision.inquiry_completion, liveDecision.inquiry_completion);
  assert.deepEqual(restored.snapshot().bounded_inquiry_scope, boundedInquiryScope);
});

test('classifier: permission frame leading the utterance is deference', () => {
  const signal = classifyLearnerSignal('May I keep the entry that the shillings were struck false coin?');
  assert.equal(signal.primary, 'low_agency_deferral');
});

test('classifier: content-first turn with a trailing permission tag stays analytic', () => {
  const signal = classifyLearnerSignal(
    'It supports Verrell’s access to the crucible; may I write that we need evidence before naming him?',
  );
  assert.equal(signal.primary, 'engaged_analytic');
});

test('classifier: explicit repair request and stall', () => {
  assert.equal(classifyLearnerSignal('what are you talking about?').primary, 'repair_request');
  assert.equal(classifyLearnerSignal('no idea').primary, 'stall');
});

test('warrant: engaged-analytic masks accumulated trouble; deference does not', () => {
  const troubleTurns = [
    { turn: 1, defeaters: ['no_dag_growth'] },
    { turn: 2, defeaters: ['no_dag_growth'] },
  ];
  const masked = evaluateWarrant({
    signal: classifyLearnerSignal('That supports a rule-based baseline, but I still need a test showing separation.'),
    troubleTurns,
  });
  assert.equal(masked.revision_warranted, false);
  assert.equal(masked.warrant_basis, 'masked_by_engaged_analytic');
  const unmasked = evaluateWarrant({
    signal: classifyLearnerSignal('May I enter that the striking remains unproved?'),
    troubleTurns,
  });
  assert.equal(unmasked.revision_warranted, true);
});

test('warrant: repair request is immediate and yields the repair-explanation policy', () => {
  const result = evaluateWarrant({
    signal: classifyLearnerSignal('this makes no sense'),
    troubleTurns: [],
    strategyInForce: 'stage_next_step',
  });
  assert.equal(result.revision_warranted, true);
  assert.equal(result.warrant_basis, 'immediate:repair_request');
  assert.equal(result.policy.family, 'repair_explanation');
});

test('policy: sustained deference maps to challenge_resistance with a precise stance', () => {
  const policy = recommendRepairPolicy({
    signal: classifyLearnerSignal('Would you have me note its light weight first?'),
    warrantBasis: 'accumulated:3_trouble_turns',
    strategyInForce: 'stage_next_step',
    deferenceSustained: true,
  });
  assert.equal(policy.family, 'challenge_resistance');
  assert.equal(policy.stance_hint, 'precise');
});

test('gate: observe mode records but never overrides; active mode overrides after accumulation', () => {
  for (const mode of ['observe', 'active']) {
    const gate = createTutorStubWarrantGate({ mode });
    const turns = [
      'Would you choose what we should mark first?',
      'Would you have me note its light weight first?',
      'May I write that sole access does not show striking?',
      'May I enter that the striking remains unproved?',
    ];
    let lastDecision = null;
    turns.forEach((text, index) => {
      lastDecision = gate.assess({
        turn: index + 1,
        learnerText: text,
        dagModel: dagModel(4),
        priorActionFamily: 'stage_next_step',
      });
    });
    assert.equal(lastDecision.revision_warranted, true, `${mode}: warrant should fire by turn 4`);
    if (mode === 'observe') {
      assert.equal(lastDecision.override, null);
    } else {
      assert.equal(lastDecision.override.action_family, 'challenge_resistance');
      assert.match(lastDecision.override.reason, /warrant gate/iu);
    }
    assert.equal(gate.decisions().length, turns.length);
  }
});

test('gate separates a warranted commitment transition from a candidate that already satisfies it', () => {
  const gate = createTutorStubWarrantGate({ mode: 'active' });
  const decision = gate.assess({
    turn: 1,
    learnerText: 'What do the balance and ring show?',
    dagModel: dagModel(3),
    priorActionFamily: 'stage_next_step',
    proposedActionFamily: 'answer_accountably',
  });
  assert.equal(decision.revision_warranted, true);
  assert.equal(decision.commitment_transition_warranted, true);
  assert.equal(decision.current_candidate_override_required, false);
  assert.equal(decision.override, null);
  assert.equal(decision.obligation_directive.obligation_id, 'public-obligation-001');
});

test('same-family accountable answering receives a directive without a false strategy switch', () => {
  const gate = createTutorStubWarrantGate({ mode: 'active' });
  const decision = gate.assess({
    turn: 1,
    learnerText: 'What do the balance and ring show?',
    dagModel: dagModel(3),
    priorActionFamily: 'answer_accountably',
    proposedActionFamily: 'answer_accountably',
  });
  assert.equal(decision.revision_warranted, true);
  assert.equal(decision.commitment_transition_warranted, false);
  assert.equal(decision.current_candidate_override_required, false);
  assert.equal(decision.override, null);
  assert.equal(decision.policy.review, 'persist_with_adjustment');
  assert.ok(decision.obligation_directive);
});

test('compound repair and result request keeps the repair family plus an orthogonal obligation directive', () => {
  const gate = createTutorStubWarrantGate({ mode: 'active' });
  const decision = gate.assess({
    turn: 1,
    learnerText: "I don't understand. What do the balance and ring show?",
    dagModel: dagModel(3),
    priorActionFamily: 'stage_next_step',
    proposedActionFamily: 'stage_next_step',
  });
  assert.equal(decision.warrant_basis, 'immediate:repair_request');
  assert.equal(decision.policy.family, 'repair_explanation');
  assert.equal(decision.override.action_family, 'repair_explanation');
  assert.equal(decision.public_obligation.blocking_obligation.status, 'open');
  assert.equal(decision.obligation_directive.obligation_id, 'public-obligation-001');
  assert.equal(decision.obligation_directive.target.kind, 'weight_or_ring_result');
});

test('strict whole-inquiry completion is carried as a terminal transition', () => {
  const gate = createTutorStubWarrantGate({ mode: 'active' });
  const decision = gate.assess({
    turn: 4,
    learnerText: 'The public proof establishes Edony as the striker.',
    classification: { turn: { discourse_move: 'claim', epistemic_stance: 'grounded' } },
    dagModel: { assessment: { finalSecretEntailed: true, assertedSecret: true }, learnerRecord: {} },
    priorActionFamily: 'compress_sayback',
    proposedActionFamily: 'stage_next_step',
    evidenceAvailability: { known: true, release_scope_exhausted: true },
  });
  assert.equal(decision.decision_kind, 'terminal_transition');
  assert.equal(decision.inquiry_completion.status, 'complete');
  assert.equal(decision.policy.family, 'close_inquiry');
  assert.equal(decision.override.action_family, 'close_inquiry');
});

test('active gate vetoes a premature close candidate without inventing a prior commitment transition', () => {
  const gate = createTutorStubWarrantGate({ mode: 'active' });
  const decision = gate.assess({
    turn: 1,
    learnerText: 'The currently public chain points to Edony.',
    dagModel: { assessment: { finalSecretEntailed: true, assertedSecret: true }, learnerRecord: {} },
    priorActionFamily: null,
    proposedActionFamily: 'close_inquiry',
    evidenceAvailability: {
      known: true,
      release_scope_exhausted: false,
      remaining_licensed_count: 1,
      future_licensed_count: 1,
    },
  });
  assert.equal(decision.decision_kind, 'candidate_safety_override');
  assert.equal(decision.commitment_transition_warranted, false);
  assert.equal(decision.current_candidate_override_required, true);
  assert.equal(decision.policy.family, 'stage_next_step');
  assert.equal(decision.override.action_family, 'stage_next_step');
});

test('gate: off mode attaches nothing to state', () => {
  const state = {};
  assert.equal(ensureTutorStubWarrantGate(state, { mode: 'off' }), null);
  assert.equal(state.warrantGate, undefined);
});

test('gate resume rebuilds the obligation ledger from committed turn records', () => {
  const firstLearner = 'What do the balance and ring show?';
  const firstTutor = 'The result is not yet recorded. What does the town verdict establish?';
  const uninterrupted = createTutorStubWarrantGate({ mode: 'active' });
  uninterrupted.assess({
    turn: 1,
    learnerText: firstLearner,
    dagModel: dagModel(4),
    priorActionFamily: null,
    proposedActionFamily: 'clarify_distinction',
  });
  uninterrupted.recordTurnOutcome({
    turn: 1,
    actionFamily: 'clarify_distinction',
    tutorText: firstTutor,
  });
  const expected = uninterrupted.assess({
    turn: 2,
    learnerText: 'The verdict establishes access, not authorship.',
    dagModel: dagModel(4),
    priorActionFamily: 'clarify_distinction',
    proposedActionFamily: 'clarify_distinction',
  });

  const state = {
    turns: [
      {
        turn: 1,
        learner: firstLearner,
        tutor: firstTutor,
        tutorLearnerDagModel: dagModel(4),
        deliveredResponseConfiguration: { action_family: 'clarify_distinction' },
        dramaticRelease: { frame: { entries: [] } },
      },
    ],
  };
  const resumed = ensureTutorStubWarrantGate(state, { mode: 'active' }).assess({
    turn: 2,
    learnerText: 'The verdict establishes access, not authorship.',
    dagModel: dagModel(4),
    priorActionFamily: 'clarify_distinction',
    proposedActionFamily: 'clarify_distinction',
  });
  assert.equal(resumed.warrant_basis, expected.warrant_basis);
  assert.deepEqual(resumed.public_obligation, expected.public_obligation);
  assert.equal(resumed.policy.family, expected.policy.family);
});

test('gate: completed-turn audits join record growth in the next decision-time evidence row', () => {
  const gate = createTutorStubWarrantGate({ mode: 'observe' });
  gate.assess({
    turn: 1,
    learnerText: 'May I enter the first public fact?',
    dagModel: dagModel(4),
    priorActionFamily: 'stage_next_step',
  });
  gate.recordTurnOutcome({
    turn: 1,
    actionFamily: 'stage_next_step',
    uptakeAudit: { ok: false, issues: [{ type: 'missing_learner_uptake' }] },
    repetitionAudit: { maxSimilarity: 0.51 },
    deterministicFallback: true,
    pacingSignal: { direction: 'decelerate', source: 'learner_request' },
  });
  const second = gate.assess({
    turn: 2,
    learnerText: 'May I keep the same entry?',
    dagModel: dagModel(4),
    priorActionFamily: 'stage_next_step',
  });
  assert.deepEqual(second.trouble_turns, [1]);
  assert.deepEqual(second.prior_turn_outcome.defeaters, [
    'uptake_audit_issues',
    'repetition:0.51',
    'tutor_response_fallback',
    'pacing_signal:decelerate',
  ]);
  assert.equal(second.revision_warranted, false, 'one defeater-bearing turn stays below the threshold');

  gate.recordTurnOutcome({ turn: 2, actionFamily: 'stage_next_step', mechanicalRepair: true });
  const third = gate.assess({
    turn: 3,
    learnerText: 'May I keep the same entry again?',
    dagModel: dagModel(4),
    priorActionFamily: 'stage_next_step',
  });
  assert.deepEqual(third.trouble_turns, [1, 2]);
  assert.equal(third.revision_warranted, true);
  assert.equal(third.warrant_basis, 'accumulated:2_trouble_turns');
});

test('gate input digest binds complete reducer history, not only the current observation', () => {
  function assessAfterHistory({ firstTurnFallback }) {
    const gate = createTutorStubWarrantGate({ mode: 'observe' });
    gate.assess({
      turn: 1,
      learnerText: 'May I keep the first entry?',
      dagModel: dagModel(4),
      priorActionFamily: 'challenge_resistance',
      proposedActionFamily: 'challenge_resistance',
    });
    gate.recordTurnOutcome({
      turn: 1,
      actionFamily: 'challenge_resistance',
      deterministicFallback: firstTurnFallback,
    });
    gate.assess({
      turn: 2,
      learnerText: 'Could I keep it even though this is annoying?',
      dagModel: dagModel(5),
      priorActionFamily: 'challenge_resistance',
      proposedActionFamily: 'challenge_resistance',
    });
    gate.recordTurnOutcome({ turn: 2, actionFamily: 'challenge_resistance' });
    return gate.assess({
      turn: 3,
      learnerText: 'May I keep the same entry again?',
      dagModel: dagModel(6),
      priorActionFamily: 'challenge_resistance',
      proposedActionFamily: 'challenge_resistance',
    });
  }

  const withEarlierTrouble = assessAfterHistory({ firstTurnFallback: true });
  const withoutEarlierTrouble = assessAfterHistory({ firstTurnFallback: false });
  const snapshot = withEarlierTrouble.input_snapshot;
  const stateBefore = snapshot.reducer_state_before;
  const currentInputs = snapshot.current_reducer_inputs;

  assert.equal(stateBefore.strategy_in_force, 'challenge_resistance');
  assert.equal(stateBefore.strategy_since_turn, 1);
  assert.equal(stateBefore.previous_dag_total, 5);
  assert.equal(stateBefore.turns_since_dag_growth, 0);
  assert.deepEqual(stateBefore.complaint_turns, [2]);
  assert.equal(stateBefore.recent_signals.length, 2);
  assert.equal(stateBefore.action_contract_state.active.action_family, 'challenge_resistance');
  assert.equal(stateBefore.action_contract_state.active.response_count, 1);
  assert.equal(stateBefore.pending_prior_turn_outcome.turn, 2);
  assert.deepEqual(stateBefore.public_obligation_ledger.obligations, []);
  assert.equal(currentInputs.deference_sustained, true);
  assert.equal(currentInputs.recent_signals.length, 3);
  assert.deepEqual(stateBefore.trouble_turns, [{ turn: 1, defeaters: ['tutor_response_fallback'] }]);
  assert.deepEqual(withoutEarlierTrouble.input_snapshot.reducer_state_before.trouble_turns, []);

  assert.equal(snapshot.learner_text, withoutEarlierTrouble.input_snapshot.learner_text);
  assert.deepEqual(snapshot.learner_dag_model, withoutEarlierTrouble.input_snapshot.learner_dag_model);
  assert.deepEqual(snapshot.prior_turn_outcome, withoutEarlierTrouble.input_snapshot.prior_turn_outcome);
  assert.notEqual(withEarlierTrouble.input_digest, withoutEarlierTrouble.input_digest);
});

test('gate: a delivered family revision resets old trouble before consuming its own outcome', () => {
  const gate = createTutorStubWarrantGate({ mode: 'active' });
  gate.assess({ turn: 1, learnerText: 'May I enter it?', dagModel: dagModel(4), priorActionFamily: 'stage_next_step' });
  gate.recordTurnOutcome({ turn: 1, actionFamily: 'stage_next_step', deterministicFallback: true });
  gate.assess({ turn: 2, learnerText: 'May I enter it?', dagModel: dagModel(4), priorActionFamily: 'stage_next_step' });
  gate.recordTurnOutcome({ turn: 2, actionFamily: 'stage_next_step', deterministicFallback: true });
  const revision = gate.assess({
    turn: 3,
    learnerText: 'May I enter it?',
    dagModel: dagModel(4),
    priorActionFamily: 'stage_next_step',
  });
  assert.equal(revision.override.action_family, 'challenge_resistance');

  gate.recordTurnOutcome({ turn: 3, actionFamily: 'challenge_resistance', deterministicFallback: true });
  const afterRevision = gate.assess({
    turn: 4,
    learnerText: 'May I enter it?',
    dagModel: dagModel(4),
    priorActionFamily: 'challenge_resistance',
  });
  assert.deepEqual(afterRevision.trouble_turns, [3]);
  assert.equal(afterRevision.revision_warranted, false);
});

test('gate: successful challenge exits to stage_next_step even when the strict DAG stays flat', () => {
  const gate = createTutorStubWarrantGate({ mode: 'active' });
  gate.assess({ turn: 1, learnerText: 'May I enter it?', dagModel: dagModel(4), priorActionFamily: null });
  gate.recordTurnOutcome({ turn: 1, actionFamily: 'challenge_resistance' });
  const learnerText = 'I record that the shillings were struck from poor dross, without naming who struck them.';
  const decision = gate.assess({
    turn: 2,
    learnerText,
    classification: {
      turn: {
        request_type: 'stepwise_support_request',
        discourse_move: 'evidence_adoption',
        evidence_use: 'cites_public_evidence',
        epistemic_stance: 'grounded',
        agency: 'steering',
      },
    },
    dagModel: dagModel(4),
    priorActionFamily: 'challenge_resistance',
  });
  assert.equal(decision.action_contract.status, 'success');
  assert.equal(decision.revision_warranted, true);
  assert.match(decision.warrant_basis, /^contract_success:challenge_resistance:/u);
  assert.equal(decision.policy.family, 'stage_next_step');
  assert.equal(decision.override.action_family, 'stage_next_step');
  assert.deepEqual(decision.trouble_turns, []);
});

test('gate: an unanswered public-result obligation survives a family change and defeats an analytic mask', () => {
  const gate = createTutorStubWarrantGate({ mode: 'active' });
  gate.assess({
    turn: 1,
    learnerText: 'I would examine the public coin first.',
    dagModel: dagModel(5),
    priorActionFamily: null,
    proposedActionFamily: 'stage_next_step',
  });
  gate.recordTurnOutcome({ turn: 1, actionFamily: 'stage_next_step' });
  const classification = {
    turn: {
      request_type: 'stepwise_support_request',
      discourse_move: 'question',
      evidence_use: 'cites_public_evidence',
      epistemic_stance: 'reflective',
      agency: 'steering',
    },
  };
  const firstText = 'What mark did the touchstone leave—does it show silver or cheaper metal?';
  const first = gate.assess({
    turn: 2,
    learnerText: firstText,
    classification,
    dagModel: dagModel(5),
    priorActionFamily: 'stage_next_step',
    proposedActionFamily: 'stage_next_step',
  });
  assert.equal(first.revision_warranted, true);
  assert.equal(first.public_obligation.blocking_obligation.status, 'open');
  assert.equal(first.policy.family, 'answer_accountably');
  gate.recordTurnOutcome({
    turn: 2,
    actionFamily: 'clarify_distinction',
    tutorText: 'The touchstone result is not yet recorded. What does the town verdict establish?',
  });
  const secondText = 'The verdict supports access, but it still does not establish who struck these coins.';
  const second = gate.assess({
    turn: 3,
    learnerText: secondText,
    classification,
    dagModel: dagModel(5),
    priorActionFamily: 'clarify_distinction',
    proposedActionFamily: 'clarify_distinction',
  });
  assert.equal(second.public_obligation.blocking_obligation.status, 'overdue');
  assert.equal(second.revision_warranted, true);
  assert.match(second.warrant_basis, /^public_obligation_overdue:/u);
  assert.equal(second.policy.family, 'answer_accountably');
  assert.equal(second.override.action_family, 'answer_accountably');
});

test('completed-turn helper is a no-op without a gate and delegates when attached', () => {
  assert.equal(recordTutorStubWarrantGateOutcome({}, { turn: 1 }), null);
  const state = { warrantGate: createTutorStubWarrantGate({ mode: 'observe' }) };
  const outcome = recordTutorStubWarrantGateOutcome(state, { turn: 1, deterministicFallback: true });
  assert.equal(outcome.turn, 1);
  assert.deepEqual(outcome.defeaters, ['tutor_response_fallback']);
});

test('speculative and retryable learner branches isolate the warrant reducer until commit', () => {
  const liveGate = { identity: 'live' };
  const state = {
    warrantGate: liveGate,
    history: [],
    turns: [],
    world: {},
    learnerDag: {},
    comprehension: { history: [] },
    releasePacing: {},
    register: {},
    randomPerformance: {},
    lightAdaptation: {},
    performanceDirectives: {},
    dialogueClosure: {},
    typedActions: {},
    directorGuidance: {},
    coach: { pending: [], history: [] },
    stream: { enabled: true, interim: null },
  };
  const runtime = createTutorStubInteractiveLearnerRuntime({
    state,
    mergeConcurrentTutorStubDirectorGuidance: (attempt) => attempt,
  });

  const speculative = runtime.cloneStateForMixedLearnerSpeculation();
  const attempt = runtime.cloneStateForInteractiveLearnerAttempt();
  assert.equal(speculative.warrantGate, null);
  assert.equal(attempt.warrantGate, null);
  assert.equal(state.warrantGate, liveGate);

  const committedGate = { identity: 'committed-attempt' };
  attempt.warrantGate = committedGate;
  runtime.commitInteractiveLearnerAttempt(attempt, {
    comprehension: structuredClone(state.comprehension),
    directorGuidance: structuredClone(state.directorGuidance),
    coach: structuredClone(state.coach),
  });
  assert.equal(state.warrantGate, committedGate);
});

test('rewriting a committed tutor response invalidates its pending gate outcome', () => {
  const state = { warrantGate: { pendingTutorText: 'old public answer' } };
  assert.equal(invalidateTutorStubWarrantGateAfterPublicTutorRewrite(state, 'opening'), false);
  assert.notEqual(state.warrantGate, null);
  assert.equal(invalidateTutorStubWarrantGateAfterPublicTutorRewrite(state, 'tutor_response'), true);
  assert.equal(state.warrantGate, null);
});

test('classifier: tutor-directed choice requests are deference', () => {
  assert.equal(
    classifyLearnerSignal('Could you choose the next exhibit for us to examine?').primary,
    'low_agency_deferral',
  );
  assert.equal(classifyLearnerSignal('Would you choose what we should mark first?').primary, 'low_agency_deferral');
});

test('response configuration honors the gate family override', async () => {
  const { buildTutorStubResponseConfiguration, tutorStubResponseConfigurationPrompt } =
    await import('../services/tutorStubResponseConfiguration.js');
  const configuration = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'May I enter that the striking remains unproved?',
    actionFamilyOverride: { family: 'challenge_resistance', reason: 'adaptive warrant gate test' },
    publicObligationDirective: {
      obligation_id: 'public-obligation-001',
      target: { source_surface: 'What do the balance and ring show?' },
    },
  });
  assert.equal(configuration.action_family, 'challenge_resistance');
  const prompt = tutorStubResponseConfigurationPrompt(configuration);
  assert.match(prompt, /Public learner request: answer "What do the balance and ring show\?"/u);
  assert.doesNotMatch(prompt, /public-obligation-001/u);
});

test('active warrant final authority survives later optional action-policy rewrites', () => {
  const decision = {
    mode: 'active',
    revision_warranted: true,
    decision_kind: 'public_obligation_fulfilment',
    warrant_basis: 'public_obligation_open:public-obligation-001',
    policy: { family: 'answer_accountably' },
    obligation_directive: {
      obligation_id: 'public-obligation-001',
      target: { source_surface: 'What did the die comparison show?' },
    },
  };
  const rewritten = {
    action_family: 'stage_next_step',
    warrant_gate: decision,
    response_configuration: {
      action_family: 'stage_next_step',
      selection_reasons: { action_family: 'conversational completion' },
      compatibility: {},
    },
  };
  const finalSelection = enforceTutorStubWarrantGateFinalAuthority(rewritten, decision);
  assert.equal(finalSelection.action_family, 'answer_accountably');
  assert.equal(finalSelection.response_configuration.action_family, 'answer_accountably');
  assert.equal(
    finalSelection.response_configuration.public_obligation_directive.obligation_id,
    'public-obligation-001',
  );
  assert.equal(finalSelection.adaptive_warrant_enforcement.displaced_action_family, 'stage_next_step');

  const observe = enforceTutorStubWarrantGateFinalAuthority(rewritten, { ...decision, mode: 'observe' });
  assert.equal(observe, rewritten);
});

test('final authority restores the complete frozen gate bundle before first-draft compilation', () => {
  const decision = {
    mode: 'active',
    revision_warranted: true,
    decision_kind: 'pedagogical_commitment_transition',
    warrant_basis: 'contract_success:clarify_distinction:learner_tested_distinction',
    policy: { family: 'answer_accountably' },
  };
  const frozenResponseConfiguration = {
    schema: 'machinespirits.tutor-stub.response-configuration.v1',
    engagement_stance: 'plain',
    action_family: 'answer_accountably',
    addressee_profile: 'adult_novice',
    audience_register: 'adult_novice',
    lexical_accessibility: 'plain',
    scene_immersion: 'grounded',
    actorial_part: 'advocate',
    actorial_part_label: 'advocate',
    actorial_part_selection: { id: 'advocate', reason: 'gate-coherent accountable answer' },
    actorial_performance: {
      id: 'unadorned_report',
      label: 'unadorned report',
      contract: 'Use one direct public answer.',
    },
    surface_budgets: { max_average_sentence_words: 18 },
    selection_reasons: {
      action_family: 'Adaptive warrant gate selected an accountable answer.',
      actorial_part: 'The advocate owns the accountable public answer.',
    },
    compatibility: {},
  };
  const frozen = {
    schema: 'machinespirits.tutor-stub.response-configuration-selection.v5',
    turn: 3,
    warrant_gate: decision,
    engagement_stance: 'plain',
    action_family: 'answer_accountably',
    actorial_part: 'advocate',
    actorial_part_selection: frozenResponseConfiguration.actorial_part_selection,
    actorial_performance: frozenResponseConfiguration.actorial_performance,
    response_configuration: frozenResponseConfiguration,
  };
  const typedRewrite = {
    ...structuredClone(frozen),
    support_level: 3,
    task_id: 'typed-task-stale',
    knowledge_component: 'typed knowledge component',
    typed_action_decision: { contract_id: 'typed-t3', chosen_action: { action_type: 'request_evidence' } },
    actorial_part: 'skeptic',
    actorial_part_selection: { id: 'skeptic', reason: 'typed action reselection' },
    actorial_performance: { id: 'adversarial_pressure', label: 'adversarial pressure' },
    response_configuration: {
      ...structuredClone(frozenResponseConfiguration),
      actorial_part: 'skeptic',
      actorial_part_label: 'skeptic',
      actorial_part_selection: { id: 'skeptic', reason: 'typed action reselection' },
      actorial_performance: {
        id: 'adversarial_pressure',
        label: 'adversarial pressure',
        contract: 'Press the learner through an adversarial test.',
      },
      support_level: 3,
      task_id: 'typed-task-stale',
      knowledge_component: 'typed knowledge component',
      typed_action_schema: 'machinespirits.tutor-stub.typed-action-decision.v1',
      selection_reasons: {
        action_family: 'Typed action selected the move.',
        actorial_part: 'Typed action selected the skeptic.',
        support_level: 'Typed action selected strong support.',
      },
    },
  };

  const restored = enforceTutorStubWarrantGateFinalAuthority(typedRewrite, decision, {
    frozenPreOptionalSelection: frozen,
  });
  assert.equal(restored.adaptive_warrant_enforcement.configuration_restored, true);
  assert.equal(restored.adaptive_warrant_enforcement.optional_configuration_displaced, true);
  assert.equal(restored.adaptive_warrant_enforcement.displaced_action_family, null);
  assert.ok(restored.adaptive_warrant_enforcement.displaced_response_configuration_fields.includes('support_level'));
  assert.ok(restored.adaptive_warrant_enforcement.displaced_selection_fields.includes('typed_action_decision'));
  assert.equal(
    restored.adaptive_warrant_enforcement.final_authority_audit.schema,
    'machinespirits.tutor-stub.warrant-gate-final-authority-audit.v1',
  );
  assert.deepEqual(restored.adaptive_warrant_enforcement.final_authority_audit.pre_final_selection, typedRewrite);
  assert.deepEqual(restored.adaptive_warrant_enforcement.final_authority_audit.frozen_pre_optional_selection, frozen);
  assert.equal(restored.response_configuration.actorial_part, 'advocate');
  assert.equal(restored.response_configuration.actorial_performance.id, 'unadorned_report');
  assert.equal(restored.response_configuration.support_level, undefined);
  assert.equal(restored.response_configuration.task_id, undefined);
  assert.equal(restored.response_configuration.typed_action_schema, undefined);
  assert.equal(restored.typed_action_decision, undefined);

  const firstDraft = buildTutorStubFirstDraftContract({
    learnerText: 'I still need the answer and its public limit.',
    responseConfiguration: restored.response_configuration,
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks for the bounded public answer.' },
      scene_action_budget: { saturated: false },
    },
    dramaticReleaseFrame: { active: false, entries: [] },
  });
  assert.equal(firstDraft.development.action_family, 'answer_accountably');
  assert.equal(firstDraft.development.support_level, null);
  assert.equal(firstDraft.performance.actorial_part, 'advocate');
  assert.equal(firstDraft.performance.tactic, 'unadorned_report');
});

test('gate outcomes carry a digest-bound projection instead of recursively nesting final-authority proofs', () => {
  const finalAuthorityAudit = {
    schema: 'machinespirits.tutor-stub.warrant-gate-final-authority-audit.v1',
    pre_final_selection: { response_configuration: { large_prior_proof: 'x'.repeat(10_000) } },
    frozen_pre_optional_selection: { response_configuration: { large_prior_proof: 'y'.repeat(10_000) } },
  };
  const delivered = {
    action_family: 'answer_accountably',
    engagement_stance: 'precise',
    adaptive_warrant_enforcement: {
      schema: 'machinespirits.tutor-stub.warrant-gate-final-authority.v1',
      final_authority_audit: finalAuthorityAudit,
    },
  };
  const directProjection = projectTutorStubWarrantGateOutcomeConfiguration(delivered);
  assert.equal(
    directProjection.configuration.adaptive_warrant_enforcement.final_authority_audit,
    undefined,
  );
  assert.equal(directProjection.provenance.omitted_schema, finalAuthorityAudit.schema);
  assert.match(directProjection.provenance.omitted_sha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(delivered.adaptive_warrant_enforcement.final_authority_audit, finalAuthorityAudit);

  const gate = createTutorStubWarrantGate({ mode: 'active' });
  gate.assess({
    turn: 1,
    learnerText: 'The record supports only a bounded finding.',
    dagModel: dagModel(1),
    proposedActionFamily: 'answer_accountably',
  });
  const outcome = gate.recordTurnOutcome({
    turn: 1,
    actionFamily: 'answer_accountably',
    tutorText: 'The record supports access, not authorship.',
    deliveredResponseConfiguration: delivered,
  });
  assert.equal(outcome.delivered_response_configuration.adaptive_warrant_enforcement.final_authority_audit, undefined);
  assert.equal(
    outcome.delivered_response_configuration_provenance.omitted_sha256,
    directProjection.provenance.omitted_sha256,
  );

  const next = gate.assess({
    turn: 2,
    learnerText: 'That limit is clear.',
    dagModel: dagModel(1),
    priorActionFamily: 'answer_accountably',
    proposedActionFamily: 'stage_next_step',
  });
  const prior = next.input_snapshot.prior_turn_outcome;
  assert.equal(prior.delivered_response_configuration.adaptive_warrant_enforcement.final_authority_audit, undefined);
  assert.equal(
    prior.delivered_response_configuration_provenance.omitted_sha256,
    directProjection.provenance.omitted_sha256,
  );
});

test('a typed action displaced before delivery is cancelled rather than scored next turn', () => {
  const lifecycleBefore = { phase: 'diagnose', pending_contract_id: null };
  const state = {
    trace: [],
    typedActions: {
      ledger: [{ contract_id: 'typed-t2', status: 'pending', action_type: 'request_evidence' }],
      currentDecision: { contract_id: 'typed-t2' },
      scaffoldLifecycle: { phase: 'observe_uptake', pending_contract_id: 'typed-t2' },
    },
  };
  const typedAction = {
    registerSelection: { action_family: 'stage_next_step' },
    decision: {
      contract_id: 'typed-t2',
      scaffold_lifecycle: { before: lifecycleBefore },
    },
  };
  const trace = [];
  const result = reconcileTutorStubTypedActionWithWarrant({
    state,
    typedAction,
    warrantFinalAuthority: { desired_action_family: 'repair_explanation' },
    turn: 2,
    turnId: 'turn-2',
    appendTrace: (_target, event) => trace.push(event),
  });
  assert.equal(result.displaced, true);
  assert.equal(typedAction.decision.delivery.delivered, false);
  assert.equal(state.typedActions.ledger[0].status, 'cancelled_before_delivery');
  assert.equal(state.typedActions.currentDecision, null);
  assert.deepEqual(state.typedActions.scaffoldLifecycle, lifecycleBefore);
  assert.equal(trace[0].type, 'tutor_typed_action_decision_displaced');
});

test('same-family typed metadata is cancelled when final authority restores the frozen bundle', () => {
  const lifecycleBefore = { phase: 'diagnose', pending_contract_id: null };
  const finalRegisterSelection = {
    action_family: 'answer_accountably',
    actorial_part: 'advocate',
    response_configuration: { action_family: 'answer_accountably', actorial_part: 'advocate' },
  };
  const state = {
    trace: [],
    typedActions: {
      ledger: [{ contract_id: 'typed-same-family', status: 'pending', action_type: 'explain_concept' }],
      currentDecision: { contract_id: 'typed-same-family' },
      scaffoldLifecycle: { phase: 'observe_uptake', pending_contract_id: 'typed-same-family' },
    },
  };
  const typedAction = {
    registerSelection: {
      action_family: 'answer_accountably',
      support_level: 3,
      response_configuration: {
        action_family: 'answer_accountably',
        actorial_part: 'skeptic',
        support_level: 3,
      },
    },
    decision: {
      contract_id: 'typed-same-family',
      scaffold_lifecycle: { before: lifecycleBefore },
    },
  };
  const result = reconcileTutorStubTypedActionWithWarrant({
    state,
    typedAction,
    warrantFinalAuthority: {
      desired_action_family: 'answer_accountably',
      optional_configuration_displaced: true,
      displaced_response_configuration_fields: ['actorial_part', 'support_level'],
      displaced_selection_fields: ['support_level', 'typed_action_decision'],
    },
    finalRegisterSelection,
  });
  assert.equal(result.displaced, true);
  assert.equal(state.typedActions.ledger[0].status, 'cancelled_before_delivery');
  assert.equal(state.typedActions.currentDecision, null);
  assert.deepEqual(state.typedActions.scaffoldLifecycle, lifecycleBefore);
  assert.deepEqual(typedAction.registerSelection, finalRegisterSelection);
  assert.deepEqual(typedAction.decision.delivery.displaced_configuration_fields, [
    'actorial_part',
    'support_level',
    'selection.support_level',
    'selection.typed_action_decision',
  ]);
});

test('gate mode resolution rejects unknown values', () => {
  assert.equal(resolveTutorStubWarrantGateMode('observe'), 'observe');
  assert.equal(resolveTutorStubWarrantGateMode(''), 'off');
  assert.throws(() => resolveTutorStubWarrantGateMode('sometimes'));
});
