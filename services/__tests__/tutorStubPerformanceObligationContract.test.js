import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_PERFORMANCE_EVIDENCE_AUDIT_SCHEMA,
  TUTOR_STUB_PERFORMANCE_OBLIGATION_CONTRACT_SCHEMA,
  compileTutorStubPerformanceObligationContract,
  tutorStubPerformanceObligationContractPrompt,
  validateTutorStubPerformanceEvidence,
} from '../tutorStubPerformanceObligationContract.js';

function counterpressureConfiguration(overrides = {}) {
  return {
    action_family: 'answer_accountably',
    engagement_stance: 'charismatic',
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: {
      id: 'dramatic_counterpressure',
      label: 'dramatic counterpressure',
      contract: 'Challenge the ready judgment with contrary public evidence.',
    },
    ...overrides,
  };
}

function publicContext(overrides = {}) {
  return {
    publicWorld: {
      visibility: 'public',
      title: 'The Recalled Edition',
      setting: 'The archive desk stands beside the corrections file.',
      question: 'Who planted the fabricated quotation?',
      ledger_term: 'corrections file',
      public_objects: ['visitor ledger', 'custody log'],
      concealed_answer: 'This field must never survive compilation.',
      ...overrides.publicWorld,
    },
    publicTurn: {
      visibility: 'public',
      learner_move: 'The learner treats Mira as guilty because the desk named her.',
      pressure_target: 'the easy verdict against Mira',
      contrary_evidence: ['The custody log puts the key with Oren.'],
      public_evidence: [{ surface: 'The visitor ledger names Mira at the desk.' }],
      due_evidence: [],
      future_evidence: 'This field must never survive compilation.',
      ...overrides.publicTurn,
    },
  };
}

function span(candidate, obligationId, quotation) {
  const start = candidate.indexOf(quotation);
  assert.notEqual(start, -1, `missing test quotation: ${quotation}`);
  return {
    obligation_id: obligationId,
    start,
    end: start + quotation.length,
    text: quotation,
  };
}

test('compiles counterpressure into stable public-only compositional obligations', () => {
  const context = publicContext();
  const contract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: {
      ...counterpressureConfiguration(),
      secret: 'private planner material',
      premise_ids: ['p_private'],
    },
    ...context,
  });

  assert.equal(contract.schema, TUTOR_STUB_PERFORMANCE_OBLIGATION_CONTRACT_SCHEMA);
  assert.equal(contract.version, 1);
  assert.equal(contract.visibility, 'public_only');
  assert.equal(contract.complete, true);
  assert.deepEqual(
    contract.obligations.map((entry) => entry.id),
    ['public_pressure_target', 'contrary_evidence', 'visible_action', 'learner_handoff'],
  );
  assert.deepEqual(contract.selection.actorial_performance, {
    id: 'dramatic_counterpressure',
    label: 'dramatic counterpressure',
    contract: 'Challenge the ready judgment with contrary public evidence.',
  });
  const serialized = JSON.stringify(contract);
  assert.doesNotMatch(serialized, /concealed_answer|future_evidence|private planner material|p_private/u);
  const prompt = tutorStubPerformanceObligationContractPrompt(contract);
  assert.deepEqual(contract.pressure_pair, {
    target_span: 'the easy verdict against Mira',
    contrary_evidence_span: 'The custody log puts the key with Oren.',
  });
  assert.match(prompt, /COUNTERPRESSURE PAIR/u);
  assert.match(prompt, /Make those two surfaces visibly meet/u);
  assert.match(prompt, /Do not merely explain the clue/u);
  assert.equal(prompt.split('the easy verdict against Mira').length - 1, 1);
  assert.equal(prompt.split('The custody log puts the key with Oren.').length - 1, 1);
  assert.doesNotMatch(prompt, /Public anchors:/u);
  assert.doesNotMatch(prompt, /concealed_answer|future_evidence|p_private/u);
});

test('question-shaped learner requests cannot become pressure targets and fall back to a boundary tactic', () => {
  const contract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: counterpressureConfiguration(),
    ...publicContext({
      publicTurn: {
        learner_move: 'What should I write next?',
        pressure_target: 'What should I write next?',
        public_claims: ['Which conclusion should I enter?'],
        contrary_evidence: ['The custody log puts the key with Oren.'],
      },
    }),
  });

  assert.equal(contract.complete, true);
  assert.equal(contract.pressure_pair, null);
  assert.equal(contract.tactic_applicability.applicable, false);
  assert.equal(contract.tactic_applicability.requested_tactic, 'dramatic_counterpressure');
  assert.equal(contract.selection.actorial_performance.id, 'evidentiary_boundary');
  assert.equal(contract.selection.actorial_part, 'advocate');
  assert.equal(contract.selection.speaking_transition.retained_actorial_part, 'advocate');
  assert.deepEqual(
    contract.obligations.map((entry) => entry.id),
    ['public_evidence', 'visible_action', 'learner_handoff'],
  );
  assert.equal(tutorStubPerformanceObligationContractPrompt(contract), '');
  assert.doesNotMatch(JSON.stringify(contract.anchors), /What should I write next/u);
});

test('prior tutor prose and merely due evidence cannot manufacture a counterpressure pair', () => {
  const contract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: counterpressureConfiguration(),
    ...publicContext({
      publicTurn: {
        learner_move: 'What should I write next?',
        pressure_target: null,
        public_claims: [
          'Write: The metal points away from the mint crucible. My case remains open until another clue arrives.',
        ],
        contrary_evidence: [],
        due_evidence: [{ surface: 'The charcoal book names the hand at the weir crucible.' }],
      },
    }),
  });

  assert.equal(contract.pressure_pair, null);
  assert.equal(contract.tactic_applicability.applicable, false);
  assert.equal(contract.selection.actorial_performance.id, 'evidentiary_boundary');
  assert.equal(contract.selection.actorial_part, 'advocate');
});

test('accepts a concrete declarative learner handoff instead of forcing every turn into a question', () => {
  const contract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: counterpressureConfiguration(),
    ...publicContext(),
  });
  const candidate =
    'I set the visitor ledger under the lamp. The easy verdict against Mira fails here: the custody log puts the key with Oren. We need to test the visitor ledger next.';
  const audit = validateTutorStubPerformanceEvidence({
    contract,
    candidate,
    evidence: [
      span(candidate, 'visible_action', 'I set the visitor ledger under the lamp.'),
      span(candidate, 'public_pressure_target', 'The easy verdict against Mira fails here'),
      span(candidate, 'contrary_evidence', 'the custody log puts the key with Oren.'),
      span(candidate, 'learner_handoff', 'We need to test the visitor ledger next.'),
    ],
  });
  assert.equal(audit.pass, true);
  assert.deepEqual(
    contract.anchors.find((entry) => entry.id === 'contrary_evidence').surfaces,
    ['The custody log puts the key with Oren.'],
    'counterpressure remains pinned to the exact selected contrary evidence',
  );
  assert.ok(
    contract.anchors
      .find((entry) => entry.id === 'learner_handoff')
      .surfaces.includes('The visitor ledger names Mira at the desk.'),
    'the handoff may use a different declared public exhibit',
  );
});

test('accepts exact, independent public-grounded spans for all four counterpressure obligations', () => {
  const contract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: counterpressureConfiguration(),
    ...publicContext(),
  });
  const candidate =
    'I set the visitor ledger under the lamp. The easy verdict against Mira fails here: the custody log puts the key with Oren. What does the custody log make you test now?';
  const evidence = [
    span(candidate, 'visible_action', 'I set the visitor ledger under the lamp.'),
    span(candidate, 'public_pressure_target', 'The easy verdict against Mira fails here'),
    span(candidate, 'contrary_evidence', 'the custody log puts the key with Oren.'),
    span(candidate, 'learner_handoff', 'What does the custody log make you test now?'),
  ];
  const audit = validateTutorStubPerformanceEvidence({ contract, candidate, evidence });

  assert.equal(audit.schema, TUTOR_STUB_PERFORMANCE_EVIDENCE_AUDIT_SCHEMA);
  assert.equal(audit.pass, true);
  assert.deepEqual(
    audit.obligations.map((entry) => [entry.id, entry.accepted]),
    [
      ['public_pressure_target', true],
      ['contrary_evidence', true],
      ['visible_action', true],
      ['learner_handoff', true],
    ],
  );
});

test('recovers offsets mechanically only for a unique exact quotation', () => {
  const contract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: counterpressureConfiguration(),
    ...publicContext(),
  });
  const candidate =
    'I set the visitor ledger under the lamp. The easy verdict against Mira fails here: the custody log puts the key with Oren. What does the custody log make you test now?';
  const evidence = [
    span(candidate, 'visible_action', 'I set the visitor ledger under the lamp.'),
    { ...span(candidate, 'public_pressure_target', 'The easy verdict against Mira fails here'), start: 0, end: 4 },
    span(candidate, 'contrary_evidence', 'the custody log puts the key with Oren.'),
    span(candidate, 'learner_handoff', 'What does the custody log make you test now?'),
  ];
  const audit = validateTutorStubPerformanceEvidence({ contract, candidate, evidence });
  assert.equal(audit.pass, true);
  assert.equal(audit.evidence.find((row) => row.obligation_id === 'public_pressure_target').offset_recovered, true);
});

test('the same structural contract accepts a different world without any scenario vocabulary table', () => {
  const context = publicContext({
    publicWorld: {
      title: 'The Glasshouse Key',
      setting: 'A cracked pot rests by the greenhouse door.',
      question: 'Who entered the greenhouse?',
      ledger_term: 'garden register',
      public_objects: ['cracked pot', 'garden register'],
    },
    publicTurn: {
      learner_move: 'The learner repeats the gardeners’ accusation against Sal.',
      pressure_target: 'the gardeners’ accusation against Sal',
      contrary_evidence: ['Rain preserved Noor’s bootprint beyond the locked gate.'],
      public_evidence: [],
    },
  });
  const contract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: counterpressureConfiguration(),
    ...context,
  });
  const candidate =
    'I turn the cracked pot toward the light. The gardeners’ accusation against Sal buckles: Noor’s bootprint remains beyond the locked gate. What does Noor’s bootprint do to that accusation?';
  const audit = validateTutorStubPerformanceEvidence({
    contract,
    candidate,
    evidence: [
      span(candidate, 'visible_action', 'I turn the cracked pot toward the light.'),
      span(candidate, 'public_pressure_target', 'The gardeners’ accusation against Sal buckles'),
      span(candidate, 'contrary_evidence', 'Noor’s bootprint remains beyond the locked gate.'),
      span(candidate, 'learner_handoff', 'What does Noor’s bootprint do to that accusation?'),
    ],
  });

  assert.equal(contract.complete, true);
  assert.equal(audit.pass, true);
});

test('fails closed when either input envelope is not explicitly public', () => {
  const context = publicContext();
  delete context.publicTurn.visibility;
  const contract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: counterpressureConfiguration(),
    ...context,
  });
  const audit = validateTutorStubPerformanceEvidence({ contract, candidate: 'No public candidate.', evidence: [] });

  assert.equal(contract.complete, false);
  assert.ok(contract.compile_issues.some((issue) => issue.type === 'unverified_public_input'));
  assert.equal(audit.pass, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'incomplete_contract'));
});

test('rejects empty, inexact, unknown, and topically irrelevant evidence spans', () => {
  const contract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: counterpressureConfiguration(),
    ...publicContext(),
  });
  const candidate =
    'I set the visitor ledger under the lamp. The easy verdict against Mira fails. The custody log puts the key with Oren. What does the custody log change?';
  const validAction = span(candidate, 'visible_action', 'I set the visitor ledger under the lamp.');
  const audit = validateTutorStubPerformanceEvidence({
    contract,
    candidate,
    evidence: [
      { obligation_id: 'public_pressure_target', start: 0, end: 0, text: '' },
      { obligation_id: 'contrary_evidence', start: 1, end: 5, text: 'wrong' },
      validAction,
      span(candidate, 'learner_handoff', 'The easy verdict against Mira fails.'),
      { ...span(candidate, 'not_in_contract', 'The custody log puts the key with Oren.') },
    ],
  });

  assert.equal(audit.pass, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'empty_evidence_span'));
  assert.ok(audit.issues.some((issue) => issue.type === 'inexact_evidence_span'));
  assert.ok(audit.issues.some((issue) => issue.type === 'unknown_obligation'));
  assert.ok(audit.issues.some((issue) => issue.type === 'irrelevant_evidence_span'));
});

test('records but accepts overlapping quotations when one performed clause carries two obligations', () => {
  const contract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: counterpressureConfiguration(),
    ...publicContext(),
  });
  const candidate =
    'I set the visitor ledger under the lamp. The easy verdict against Mira meets the custody log, which puts the key with Oren. What does the custody log make you test?';
  const collision = 'The easy verdict against Mira meets the custody log, which puts the key with Oren.';
  const whole = span(candidate, 'public_pressure_target', collision);
  const evidence = [
    span(candidate, 'visible_action', 'I set the visitor ledger under the lamp.'),
    whole,
    {
      obligation_id: 'contrary_evidence',
      start: candidate.indexOf('the custody log'),
      end: whole.end,
      text: candidate.slice(candidate.indexOf('the custody log'), whole.end),
    },
    span(candidate, 'learner_handoff', 'What does the custody log make you test?'),
  ];
  const audit = validateTutorStubPerformanceEvidence({ contract, candidate, evidence });

  assert.equal(audit.pass, true);
  assert.equal(audit.overlaps.length, 1);
});

test('closure compiles a finding and terminal declaration instead of a learner handoff', () => {
  const context = publicContext({
    publicTurn: {
      public_finding: 'The custody log establishes that Oren held the key.',
    },
  });
  const contract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: counterpressureConfiguration({
      action_family: 'close_inquiry',
      actorial_part: 'foreperson',
      actorial_part_label: 'keeper of the finding',
      actorial_performance: {
        id: 'evidentiary_boundary',
        label: 'evidentiary boundary',
        contract: 'State the support and its limit.',
      },
    }),
    ...context,
  });

  assert.deepEqual(
    contract.obligations.map((entry) => entry.id),
    ['public_evidence', 'visible_action', 'public_finding', 'terminal_closure'],
  );
  assert.equal(
    contract.obligations.some((entry) => entry.id === 'learner_handoff'),
    false,
  );
});
