import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeTraceOutcomeClosure,
  buildOutcomeClosureReport,
} from '../scripts/analyze-adaptation-outcome-closure.js';
import { observeInterventionOutcome } from '../services/adaptiveTutor/outcomeObserver.js';

function contract(action) {
  return {
    state_belief: { hypotheses: [{ id: 'missing_prerequisite', probability: 1 }] },
    selected_action: { action_type: action },
    candidate_actions: [{ action_type: action }],
    gate_result: { allowed: true, violations: [], repairs: [] },
    realization_checks: { action_consistent: true, forbidden_move_detected: false },
  };
}

function turn(turnIndex, action, trace = []) {
  return {
    turn: turnIndex,
    selectedPedagogicalAction: { action_type: action },
    adaptationContract: contract(action),
    tutorInternal: { adaptationAction: action },
    adaptationTrace: trace,
  };
}

function pending(turnIndex, action, hypotheses = ['missing_prerequisite']) {
  return {
    contract_id: `c${turnIndex}`,
    turn_index: turnIndex,
    action_type: action,
    hypothesis_ids: hypotheses,
    expected_transition: { proof: 0.1 },
    status: 'pending',
    evidence: [],
  };
}

function closed(turnIndex, action, outcome, hypotheses = ['missing_prerequisite']) {
  return {
    ...pending(turnIndex, action, hypotheses),
    status: 'closed',
    outcome,
    observed_transition: { proof: outcome === 'success' ? 0.1 : 0 },
    evidence: [{ quote: 'learner evidence', categories: { 'state-disambiguating response': outcome === 'success' } }],
    policy_update: outcome === 'success' ? null : { type: 'do_not_treat_state_as_improved' },
  };
}

test('analyzeTraceOutcomeClosure counts complete contracts and observed closures', () => {
  const trace = {
    profileName: 'profile',
    scenario: { id: 'scenario' },
    original: {
      perTurn: [turn(0, 'diagnose_with_discriminating_question'), turn(1, 'minimal_hint')],
      finalInterventionLedger: [
        closed(0, 'diagnose_with_discriminating_question', 'success'),
        pending(1, 'minimal_hint'),
      ],
    },
  };

  const result = analyzeTraceOutcomeClosure(trace);

  assert.equal(result.completeContractN, 2);
  assert.equal(result.nonFinalPendingClosedN, 1);
  assert.equal(result.observableTransitionN, 1);
  assert.equal(result.evidenceBearingOutcomeN, 1);
  assert.equal(result.evidenceBearingSuccessN, 1);
  assert.equal(result.successN, 1);
});

test('analyzeTraceOutcomeClosure flags repeated action after non-success', () => {
  const trace = {
    profileName: 'profile',
    scenario: { id: 'scenario' },
    original: {
      perTurn: [turn(0, 'diagnose_with_discriminating_question'), turn(1, 'diagnose_with_discriminating_question')],
      finalInterventionLedger: [
        closed(0, 'diagnose_with_discriminating_question', 'inconclusive'),
        pending(1, 'diagnose_with_discriminating_question'),
      ],
    },
  };

  const result = analyzeTraceOutcomeClosure(trace);

  assert.equal(result.nonSuccessRecords, 1);
  assert.equal(result.policyUpdatedAfterNonSuccess, 1);
  assert.equal(result.repeatedAfterNonSuccess, 1);
});

test('analyzeTraceOutcomeClosure records gate repair events', () => {
  const repairedTurn = turn(0, 'diagnose_with_discriminating_question', [
    {
      type: 'select_pedagogical_action',
      payload: { action_type: 'acknowledge_and_redirect' },
    },
    {
      type: 'validate_adaptation_contract',
      payload: {
        gate_allowed: false,
        repaired_from: 'acknowledge_and_redirect',
        action_type: 'diagnose_with_discriminating_question',
        gate_violations: ['HIGH_CONFIDENCE_WITH_HIGH_UNCERTAINTY'],
      },
    },
  ]);
  const trace = {
    profileName: 'profile',
    scenario: { id: 'scenario' },
    original: {
      perTurn: [repairedTurn],
      finalInterventionLedger: [pending(0, 'diagnose_with_discriminating_question')],
    },
  };

  const result = analyzeTraceOutcomeClosure(trace);

  assert.equal(result.gateBlocked, 1);
  assert.equal(result.gateRepaired, 1);
  assert.equal(result.selectedThenRepaired[0].repairedFrom, 'acknowledge_and_redirect');
});

test('buildOutcomeClosureReport aggregates by profile', () => {
  const rows = [
    {
      id: 1,
      run_id: 'run',
      profile_name: 'profile',
      scenario_id: 'a',
      trace: {
        profileName: 'profile',
        scenario: { id: 'a' },
        original: {
          perTurn: [turn(0, 'minimal_hint'), turn(1, 'minimal_hint')],
          finalInterventionLedger: [closed(0, 'minimal_hint', 'inconclusive'), pending(1, 'minimal_hint')],
        },
      },
    },
  ];

  const report = buildOutcomeClosureReport(rows, { runIds: ['run'] });
  const profile = report.profiles[0];

  assert.equal(profile.profileName, 'profile');
  assert.equal(profile.contractCompletenessRate, 1);
  assert.equal(profile.failureUpdateRate, 1);
  assert.equal(profile.noUnreasonedRepeatRate, 0);
  assert.equal(profile.evidenceBearingOutcomeRate, 0);
  assert.equal(profile.inconclusiveWithEvidenceRate, 1);
});

test('buildOutcomeClosureReport flags false success from mere agreement evidence', () => {
  const rows = [
    {
      id: 1,
      run_id: 'run',
      profile_name: 'profile',
      scenario_id: 'a',
      trace: {
        profileName: 'profile',
        scenario: { id: 'a' },
        original: {
          perTurn: [turn(0, 'minimal_hint'), turn(1, 'minimal_hint')],
          finalInterventionLedger: [
            {
              ...closed(0, 'minimal_hint', 'success'),
              evidence: [{ quote: 'okay', categories: { 'mere agreement': true } }],
            },
            pending(1, 'minimal_hint'),
          ],
        },
      },
    },
  ];

  const report = buildOutcomeClosureReport(rows, { runIds: ['run'] });
  const profile = report.profiles[0];

  assert.equal(profile.evidenceBearingOutcomeRate, 1);
  assert.equal(profile.falseSuccessFromAgreementN, 1);
});

test('buildOutcomeClosureReport can reobserve stored dialogue outcomes without mutating traces', () => {
  const rows = [
    {
      id: 1,
      run_id: 'run',
      profile_name: 'profile',
      scenario_id: 'a',
      trace: {
        profileName: 'profile',
        scenario: { id: 'a' },
        original: {
          dialogue: [
            { role: 'learner', content: "I don't get why that works." },
            { role: 'tutor', content: 'What exactly feels missing?' },
            { role: 'learner', content: 'Hmm, can you explain more?' },
            { role: 'tutor', content: 'Small hint only.' },
          ],
          perTurn: [turn(0, 'diagnose_with_discriminating_question'), turn(1, 'minimal_hint')],
          finalInterventionLedger: [
            {
              ...closed(0, 'diagnose_with_discriminating_question', 'inconclusive'),
              evidence: [{ quote: 'Hmm, can you explain more?', categories: {} }],
            },
            pending(1, 'minimal_hint'),
          ],
        },
      },
    },
  ];

  const stored = buildOutcomeClosureReport(rows, { runIds: ['run'] }).profiles[0];
  const reobserved = buildOutcomeClosureReport(rows, { runIds: ['run'], reobserve: true }).profiles[0];

  assert.equal(stored.failureN, 0);
  assert.equal(stored.inconclusiveN, 1);
  assert.equal(reobserved.failureN, 1);
  assert.equal(reobserved.inconclusiveN, 0);
});

test('outcome observer recognizes non-formulaic resistance breakthrough evidence', () => {
  const outcome = observeInterventionOutcome({
    pendingIntervention: {
      action_type: 'elicit_prediction',
      success_signal: {
        required_evidence: ['learner-authored prediction', 'non-formulaic learner rationale'],
        forbidden_evidence: ['mere agreement'],
      },
    },
    learnerTurn:
      'I predict the formula will break if the case changes, because parroting the sequence does not explain the relation.',
    turnIndex: 1,
  });

  assert.equal(outcome.outcome, 'success');
  assert.equal(outcome.required_evidence_satisfied, true);
  assert.equal(outcome.evidence[0].categories['learner-authored prediction'], true);
  assert.equal(outcome.evidence[0].categories['non-formulaic learner rationale'], true);
  assert.ok(outcome.observed_transition.resistance_breakthrough > 0);
});

test('outcome observer closes combined proof-DAG and resistance evidence', () => {
  const outcome = observeInterventionOutcome({
    pendingIntervention: {
      action_type: 'request_evidence',
      success_signal: {
        required_evidence: [
          'learner-authored rationale',
          'learner-authored prediction',
          'non-formulaic learner rationale',
        ],
        forbidden_evidence: ['mere agreement'],
      },
    },
    learnerTurn:
      'I predict the formula is not enough because I need to test a concrete case and explain the relation in my own words.',
    turnIndex: 1,
  });

  assert.equal(outcome.outcome, 'success');
  assert.equal(outcome.required_evidence_satisfied, true);
  assert.equal(outcome.evidence[0].categories['learner-authored rationale'], true);
  assert.equal(outcome.evidence[0].categories['learner-authored prediction'], true);
  assert.equal(outcome.evidence[0].categories['non-formulaic learner rationale'], true);
  assert.ok(outcome.observed_transition.proof > 0);
  assert.ok(outcome.observed_transition.resistance_breakthrough > 0);
});
