import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyLearnerSignal, evaluateWarrant } from '../services/adaptiveWarrantGateCore.js';
import {
  ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS,
  classifyAdaptiveWarrantEvidenceRequest,
  createAdaptiveWarrantActionContractTracker,
} from '../services/adaptiveWarrantActionContracts.js';
import { recommendRepairPolicy } from '../services/adaptiveWarrantPolicy.js';
import {
  createTutorStubWarrantGate,
  ensureTutorStubWarrantGate,
  recordTutorStubWarrantGateOutcome,
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

test('evidence request classifier gives repeated die-mark requests a stable typed signature', () => {
  const first = classifyAdaptiveWarrantEvidenceRequest({
    learnerText: 'What public mark on the coin or dies would establish the link?',
    classification: { turn: { request_type: 'stepwise_support_request', discourse_move: 'question' } },
  });
  const second = classifyAdaptiveWarrantEvidenceRequest({
    learnerText: 'No flaw is recorded; please record a distinctive cut or die-mark before comparison.',
    classification: { turn: { request_type: 'stepwise_support_request', discourse_move: 'question' } },
  });
  assert.equal(first.signature, 'comparison_evidence:mark_or_tool_match');
  assert.equal(second.signature, first.signature);
  assert.equal(second.explicitly_unresolved, true);
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

test('action contract: a repeated specific evidence request defeats stage_next_step', () => {
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
  const firstText = 'What public mark on the coin or dies would establish the link?';
  const first = tracker.assess({
    turn: 2,
    actionFamily: 'stage_next_step',
    learnerText: firstText,
    classification,
    signal: classifyLearnerSignal(firstText),
    dagGrowth: 0,
  });
  assert.equal(first.status, 'success', 'one new bounded evidence question does not yet defeat the family');
  const secondText = 'No flaw is recorded; please record a distinctive cut or die-mark before comparison.';
  const second = tracker.assess({
    turn: 3,
    actionFamily: 'stage_next_step',
    learnerText: secondText,
    classification,
    signal: classifyLearnerSignal(secondText),
    dagGrowth: 0,
  });
  assert.equal(second.status, 'defeat');
  assert.equal(second.transition.revision_warranted, true);
  assert.equal(second.transition.recommended_action_family, 'answer_accountably');
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

test('gate: off mode attaches nothing to state', () => {
  const state = {};
  assert.equal(ensureTutorStubWarrantGate(state, { mode: 'off' }), null);
  assert.equal(state.warrantGate, undefined);
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

test('gate: a repeated unresolved mark request defeats an analytic mask in live mode', () => {
  const gate = createTutorStubWarrantGate({ mode: 'active' });
  gate.assess({ turn: 1, learnerText: 'Start with the public coin.', dagModel: dagModel(5), priorActionFamily: null });
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
  const firstText = 'What public mark on the coin or dies would establish the link?';
  const first = gate.assess({
    turn: 2,
    learnerText: firstText,
    classification,
    dagModel: dagModel(5),
    priorActionFamily: 'stage_next_step',
  });
  assert.equal(first.revision_warranted, false);
  gate.recordTurnOutcome({ turn: 2, actionFamily: 'stage_next_step' });
  const secondText = 'No visible flaw is recorded; please record a distinctive cut or die-mark before comparison.';
  const second = gate.assess({
    turn: 3,
    learnerText: secondText,
    classification,
    dagModel: dagModel(5),
    priorActionFamily: 'stage_next_step',
  });
  assert.equal(second.action_contract.status, 'defeat');
  assert.equal(second.revision_warranted, true);
  assert.match(second.warrant_basis, /^contract_defeat:stage_next_step:/u);
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

test('classifier: tutor-directed choice requests are deference', () => {
  assert.equal(
    classifyLearnerSignal('Could you choose the next exhibit for us to examine?').primary,
    'low_agency_deferral',
  );
  assert.equal(classifyLearnerSignal('Would you choose what we should mark first?').primary, 'low_agency_deferral');
});

test('response configuration honors the gate family override', async () => {
  const { buildTutorStubResponseConfiguration } = await import('../services/tutorStubResponseConfiguration.js');
  const configuration = buildTutorStubResponseConfiguration({
    engagementStance: 'precise',
    learnerText: 'May I enter that the striking remains unproved?',
    actionFamilyOverride: { family: 'challenge_resistance', reason: 'adaptive warrant gate test' },
  });
  assert.equal(configuration.action_family, 'challenge_resistance');
});

test('gate mode resolution rejects unknown values', () => {
  assert.equal(resolveTutorStubWarrantGateMode('observe'), 'observe');
  assert.equal(resolveTutorStubWarrantGateMode(''), 'off');
  assert.throws(() => resolveTutorStubWarrantGateMode('sometimes'));
});
