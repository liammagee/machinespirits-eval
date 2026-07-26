import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANDIDATE_GATE_POLICIES,
  OBSERVATIONAL_ARMS,
  POINT_OF_ACTION_GATE_GRADE_SCHEMA,
  WARRANT_ALIGNED_FIELD,
  advanceOutcome,
  buildGateDecisions,
  checkGateGradeIntegrity,
  dagProgressState,
  isCleanDecision,
  isObservationalArm,
  isTreatmentEligible,
  isWindowEligible,
  proportionDifference,
  scoreAlternativeGate,
  summarizeGateArm,
  summarizeTreatment,
  wilsonInterval,
} from '../services/pointOfActionGateGrader.js';

function state(turn, { coverage = 0, grounded = 0, voicedDerived = 0 } = {}) {
  return {
    type: 'turn_complete',
    turn,
    turnRecord: {
      stateObservation: {
        dag: {
          best_path_coverage: coverage,
          grounded_count: grounded,
          voiced_derived_count: voicedDerived,
          unsupported_assertion_count: 0,
          missing_premise_count: 0,
        },
      },
    },
  };
}

function assignment(turn, { arm, trigger = null, evidenceUse = null, injected = false, suppression = {} } = {}) {
  return {
    type: 'point_of_action_assignment',
    turn,
    pointOfAction: {
      arm,
      turn,
      assigned_trigger: trigger,
      inputs: { evidence_use: evidenceUse },
      suppression,
      candidates: { stagnant_repeat: false },
      interruption: injected ? { kind: 'side_coach', text: 'expose the warrant' } : { kind: null },
    },
  };
}

test('dagProgressState reads the DAG block and keeps unobserved fields null', () => {
  const parsed = dagProgressState(state(3, { coverage: 0.5, grounded: 4, voicedDerived: 2 }));
  assert.deepEqual(parsed, {
    turn: 3,
    coverage: 0.5,
    grounded: 4,
    voicedDerived: 2,
    unsupported: 0,
    missingPremise: 0,
  });

  assert.equal(dagProgressState({ type: 'turn_complete', turn: 1 }), null);

  // A missing individual field stays null rather than becoming 0. Coercing it
  // would turn "not observed" into "no progress" and invent a stall.
  const partial = dagProgressState({
    type: 'turn_complete',
    turn: 2,
    turnRecord: { stateObservation: { dag: { grounded_count: 1 } } },
  });
  assert.equal(partial.coverage, null);
  assert.equal(partial.grounded, 1);
});

test('advanceOutcome measures state(N+1) minus state(N) and keeps regression separate', () => {
  const before = dagProgressState(state(1, { coverage: 0.2, grounded: 2, voicedDerived: 1 }));
  const after = dagProgressState(state(2, { coverage: 0.2, grounded: 2, voicedDerived: 3 }));
  const forward = advanceOutcome(before, after);
  assert.equal(forward.advanced, true);
  assert.deepEqual(forward.advancedOn, ['voicedDerived']);
  assert.equal(forward.regressed, false);
  assert.equal(forward.deltas.voicedDerived, 2);
  assert.equal(forward.deltas.grounded, 0);

  // A retraction is not a stall, so `regressed` is reported and never folded into
  // `advanced`.
  const retracted = advanceOutcome(after, dagProgressState(state(3, { coverage: 0.2, grounded: 1, voicedDerived: 3 })));
  assert.equal(retracted.advanced, false);
  assert.equal(retracted.regressed, true);

  assert.equal(advanceOutcome(before, null), null);
});

test('wilsonInterval stays inside [0, 1] at the low rates this grader produces', () => {
  const low = wilsonInterval(1, 40);
  assert.ok(low.low >= 0, 'lower bound must not go negative');
  assert.ok(low.high <= 1);
  assert.equal(low.n, 40);
  assert.equal(wilsonInterval(0, 0).rate, null);
  assert.equal(wilsonInterval(20, 20).high, 1);
});

test('proportionDifference signs the gap from the first argument', () => {
  const difference = proportionDifference(30, 100, 10, 100);
  assert.equal(difference.delta, 0.2);
  assert.ok(difference.z > 0);
  assert.equal(proportionDifference(1, 0, 1, 10).delta, null);
});

test('buildGateDecisions keeps passed-over moments and drops the unscorable final turn', () => {
  const turnStates = new Map(
    [state(0, { grounded: 0 }), state(1, { grounded: 1 }), state(2, { grounded: 1 })].map((record) => [
      record.turn,
      dagProgressState(record),
    ]),
  );
  const decisions = buildGateDecisions({
    assignments: [
      assignment(0, { arm: 'standing_book', trigger: 'warrant_skip', evidenceUse: 'omits_warrant' }),
      assignment(1, { arm: 'standing_book', evidenceUse: 'cites_public_evidence' }),
      // Turn 2 has no turn-3 observation, so it cannot be scored.
      assignment(2, { arm: 'standing_book', trigger: 'warrant_skip', evidenceUse: 'omits_warrant' }),
    ],
    turnStates,
  });
  assert.equal(decisions.length, 2, 'the passed-over moment counts; the unscorable final turn does not');
  assert.deepEqual(
    decisions.map((row) => [row.turn, row.fired, row.advanced]),
    [
      [0, true, true],
      [1, false, false],
    ],
  );
});

test('buildGateDecisions labels a moment that would have fired but was suppressed', () => {
  const turnStates = new Map([state(0), state(1)].map((record) => [record.turn, dagProgressState(record)]));
  const [decision] = buildGateDecisions({
    assignments: [
      assignment(0, {
        arm: 'standing_book',
        trigger: null,
        evidenceUse: 'omits_warrant',
        suppression: { cooldown: true },
      }),
    ],
    turnStates,
  });
  assert.equal(decision.fired, false);
  assert.equal(decision.suppressed, true, 'a held-back firing is a gate decision too');
});

test('the delivered-text leak excludes a row; a caught first-draft leak does not', () => {
  const delivered = { deliveryLeaked: true, draftLeaked: true, fallback: false };
  const caught = { deliveryLeaked: false, draftLeaked: true, fallback: false };
  const fallback = { deliveryLeaked: false, draftLeaked: false, fallback: true };

  assert.equal(isCleanDecision(delivered), false, 'the learner read the answer, so the outcome is not theirs');
  assert.equal(isCleanDecision(caught), true, 'a leak the guard caught before delivery is the guard working');
  assert.equal(isCleanDecision(fallback), true);

  // The fallback replaced the model candidate with a canned reply, so the
  // intervention never landed as written. That bears on the treatment contrast and
  // not on whether the gate picked a stalling moment.
  assert.equal(isTreatmentEligible(fallback), false);
  assert.equal(isTreatmentEligible(caught), true);
});

test('arm classification is derived from the traces, not from the declared list', () => {
  const silentRows = [
    { fired: true, injected: false },
    { fired: false, injected: false },
  ];
  const injectingRows = [
    { fired: true, injected: true },
    { fired: false, injected: false },
  ];
  assert.equal(isObservationalArm('standing_book', silentRows), true);
  assert.equal(isObservationalArm('standing_book', injectingRows), false, 'observed injection overrides the list');
  assert.equal(isObservationalArm('side_coach', silentRows), true, 'an arm that never injected is observational here');

  // With no firings the data cannot answer, so the declared list decides.
  assert.equal(isObservationalArm('standing_book', [{ fired: false, injected: false }]), true);
  assert.equal(isObservationalArm('side_coach', [{ fired: false, injected: false }]), false);
  assert.ok(OBSERVATIONAL_ARMS.includes('committee'), 'committee logs the gate decision and injects nothing');
});

test('summarizeGateArm signs discrimination so positive means the gate found real stalls', () => {
  const rows = [
    // Flagged moments that stalled.
    ...Array.from({ length: 8 }, () => ({
      arm: 'standing_book',
      fired: true,
      injected: false,
      deltas: { voicedDerived: 0 },
      advanced: false,
    })),
    // Flagged moments that advanced anyway.
    ...Array.from({ length: 2 }, () => ({
      arm: 'standing_book',
      fired: true,
      injected: false,
      deltas: { voicedDerived: 1 },
      advanced: true,
    })),
    // Passed-over moments, mostly advancing.
    ...Array.from({ length: 8 }, () => ({
      arm: 'standing_book',
      fired: false,
      injected: false,
      deltas: { voicedDerived: 1 },
      advanced: true,
    })),
    ...Array.from({ length: 2 }, () => ({
      arm: 'standing_book',
      fired: false,
      injected: false,
      deltas: { voicedDerived: 0 },
      advanced: false,
    })),
  ];
  const summary = summarizeGateArm('standing_book', rows);
  assert.equal(summary.observational, true);
  assert.equal(summary.armClassificationMismatch, false);
  assert.equal(summary.outcomes[WARRANT_ALIGNED_FIELD].fired.advanced, 2);
  assert.equal(summary.outcomes[WARRANT_ALIGNED_FIELD].silent.advanced, 8);
  assert.ok(summary.discrimination.delta > 0, 'the gate flagged the stalling moments, so discrimination is positive');
  assert.equal(summary.outcomes.grounded.tutorGated, true, 'grounded needs a tutor premise release');
  assert.equal(summary.outcomes.coverage.tutorGated, true);
  assert.equal(summary.outcomes[WARRANT_ALIGNED_FIELD].tutorGated, false, 'the warrant-aligned field is not gated');
  assert.equal(summary.outcomes[WARRANT_ALIGNED_FIELD].warrantAligned, true);
});

test('summarizeGateArm reports fire rate and covariates without excluding on them', () => {
  const rows = [
    {
      arm: 'side_coach',
      fired: true,
      injected: true,
      draftLeaked: true,
      fallback: true,
      deltas: { voicedDerived: 1 },
      advanced: true,
    },
    { arm: 'side_coach', fired: false, injected: false, deltas: { voicedDerived: 0 }, advanced: false },
    {
      arm: 'side_coach',
      fired: false,
      injected: false,
      deliveryLeaked: true,
      deltas: { voicedDerived: 1 },
      advanced: true,
    },
  ];
  const summary = summarizeGateArm('side_coach', rows);
  assert.equal(summary.decisions, 3);
  assert.equal(summary.clean, 2, 'only the delivered-leak row is excluded');
  assert.equal(summary.excluded.deliveryLeaked, 1);
  assert.equal(summary.covariates.draftLeaked, 1);
  assert.equal(summary.covariates.fallback, 1);
  assert.equal(summary.covariates.fireRate.rate, 0.5);
  assert.equal(summary.observational, false, 'a fired turn carried injected text');
});

test('summarizeTreatment phase-matches the baseline instead of pooling across archives', () => {
  const advanced = { deltas: { voicedDerived: 1 }, advanced: true };
  const stalled = { deltas: { voicedDerived: 0 }, advanced: false };
  const decisionsByArm = new Map([
    [
      'standing_book',
      [
        // Same phase as the treated arm: this is the baseline.
        { arm: 'standing_book', phase: 'step4', fired: true, injected: false, ...stalled },
        { arm: 'standing_book', phase: 'step4', fired: true, injected: false, ...stalled },
        // A different phase entirely. Pooling it in would compare scenario suites.
        ...Array.from({ length: 6 }, () => ({
          arm: 'standing_book',
          phase: 'phase5b',
          fired: true,
          injected: false,
          ...advanced,
        })),
      ],
    ],
    [
      'side_coach',
      [
        { arm: 'side_coach', phase: 'step4', fired: true, injected: true, ...advanced },
        { arm: 'side_coach', phase: 'step4', fired: true, injected: true, ...advanced },
      ],
    ],
  ]);
  const [treatment] = summarizeTreatment(decisionsByArm);
  assert.equal(treatment.arm, 'side_coach');
  assert.deepEqual(treatment.phases, ['step4']);
  assert.equal(treatment.baseline.total, 2, 'the out-of-phase observational rows are not in the baseline');
  assert.equal(treatment.baseline.advanced, 0);
  assert.equal(treatment.treated.total, 2);
  assert.ok(treatment.effect.delta > 0);
  assert.equal(treatment.field, WARRANT_ALIGNED_FIELD);
});

test('summarizeTreatment drops fallback turns because the intervention did not land', () => {
  const decisionsByArm = new Map([
    [
      'standing_book',
      [
        {
          arm: 'standing_book',
          phase: 'step4',
          fired: true,
          injected: false,
          deltas: { voicedDerived: 0 },
          advanced: false,
        },
      ],
    ],
    [
      'side_coach',
      [
        {
          arm: 'side_coach',
          phase: 'step4',
          fired: true,
          injected: true,
          fallback: true,
          deltas: { voicedDerived: 1 },
          advanced: true,
        },
        {
          arm: 'side_coach',
          phase: 'step4',
          fired: true,
          injected: true,
          deltas: { voicedDerived: 1 },
          advanced: true,
        },
      ],
    ],
  ]);
  const [treatment] = summarizeTreatment(decisionsByArm);
  assert.equal(treatment.treated.total, 1, 'the canned-reply turn cannot speak to whether acting helped');
});

test('scoreAlternativeGate benchmarks a rule against always-firing and flags itself off-policy', () => {
  const rows = [
    { fired: true, evidenceUse: 'omits_warrant', deltas: { voicedDerived: 0 }, advanced: false },
    { fired: true, evidenceUse: 'omits_warrant', deltas: { voicedDerived: 0 }, advanced: false },
    { fired: false, evidenceUse: 'cites_public_evidence', deltas: { voicedDerived: 1 }, advanced: true },
    { fired: false, evidenceUse: 'cites_public_evidence', deltas: { voicedDerived: 0 }, advanced: false },
  ];
  const live = scoreAlternativeGate(rows, (row) => row.fired);
  assert.equal(live.offPolicy, true, 'the outcomes followed the gate that actually ran');
  assert.equal(live.field, WARRANT_ALIGNED_FIELD);
  assert.equal(live.firesOn, 2);
  assert.equal(live.stallPrecision.rate, 1);
  assert.equal(live.stallPrecision.total, 2);

  // Firing on everything gives the base stall rate, which is what any real rule
  // has to beat before it can be said to carry information.
  const always = scoreAlternativeGate(rows, () => true);
  assert.equal(always.stallPrecision.rate, 0.75);
  assert.equal(always.silenceAccuracy.total, 0);
  assert.ok(live.stallPrecision.rate > always.stallPrecision.rate);
});

test('the grade schema is stamped so a report can be traced to this instrument', () => {
  assert.equal(POINT_OF_ACTION_GATE_GRADE_SCHEMA, 'machinespirits.tutor-stub.point-of-action-gate-grade.v1');
});

test('buildGateDecisions carries the deterministic layer flags separately from the model vote', () => {
  const turnStates = new Map(
    [state(0), state(1), state(2), state(3)].map((record) => [record.turn, dagProgressState(record)]),
  );
  const decisions = buildGateDecisions({
    assignments: [
      assignment(0, {
        arm: 'standing_book',
        evidenceUse: 'omits_warrant',
        suppression: { outside_window: true, near_closure: false, close_inquiry: false, unresolved_glossary: false },
      }),
      assignment(1, {
        arm: 'standing_book',
        evidenceUse: 'omits_warrant',
        suppression: { outside_window: false, near_closure: true, close_inquiry: false, unresolved_glossary: false },
      }),
      assignment(2, {
        arm: 'standing_book',
        trigger: 'warrant_skip',
        evidenceUse: 'omits_warrant',
        suppression: { outside_window: false, near_closure: false, close_inquiry: false, unresolved_glossary: false },
      }),
    ],
    turnStates,
  });
  assert.deepEqual(
    decisions.map((row) => [row.turn, row.outsideWindow, row.nearClosure, row.suppressionRecorded]),
    [
      [0, true, false, true],
      [1, false, true, true],
      [2, false, false, true],
    ],
  );

  // The window is a harness constant every candidate policy inherits, so a turn
  // outside it is not a moment any rule could be scored on.
  assert.equal(isWindowEligible(decisions[0]), false);
  assert.equal(isWindowEligible(decisions[1]), true, 'near_closure is a policy choice, not a structural exclusion');
  assert.equal(isWindowEligible({ ...decisions[2], deliveryLeaked: true }), false);
});

test('the live rule is the conjunction of the model vote and the position layer', () => {
  // Turn 1 is the row that separates the two halves: the model voted to fire and
  // the position layer held it back, so it is in `model vote alone` and not in the
  // live rule. Scoring the halves apart is what says which one carries the gate.
  const rows = [
    { fired: true, suppressed: false, nearClosure: false, closeInquiry: false, evidenceUse: 'omits_warrant' },
    { fired: false, suppressed: true, nearClosure: true, closeInquiry: false, evidenceUse: 'omits_warrant' },
    { fired: false, suppressed: false, nearClosure: false, closeInquiry: false, evidenceUse: 'links_evidence_to_rule' },
  ];
  const fires = (label) => rows.filter((row) => CANDIDATE_GATE_POLICIES[label](row)).length;
  assert.equal(fires('live rule (model vote AND position layer)'), 1);
  assert.equal(fires('model vote alone (ignore position layer)'), 2);
  assert.equal(fires('position layer alone (no model call)'), 2, 'fires without asking the model on turns 0 and 2');
  assert.equal(fires('always fire'), 3);
  assert.equal(fires('never fire'), 0);

  // The position-layer policy must not read an absent flag as permission to fire —
  // that is the failure `suppression_not_recorded` exists to catch.
  assert.equal(CANDIDATE_GATE_POLICIES['position layer alone (no model call)']({ nearClosure: true }), false);
});

test('checkGateGradeIntegrity passes a well-formed pass and fails on structure, never on a number', () => {
  const armSummary = (arm, overrides = {}) => ({
    arm,
    observational: OBSERVATIONAL_ARMS.includes(arm),
    declaredObservational: OBSERVATIONAL_ARMS.includes(arm),
    armClassificationMismatch: false,
    injectedOnFired: 0,
    clean: 10,
    covariates: { fireRate: { rate: 0.3 } },
    ...overrides,
  });
  const rows = [
    { deliveryLeaked: false, suppressionRecorded: true, outsideWindow: false },
    { deliveryLeaked: false, suppressionRecorded: true, outsideWindow: true },
  ];

  const clean = checkGateGradeIntegrity({
    decisions: rows,
    armSummaries: [armSummary('standing_book'), armSummary('side_coach')],
  });
  assert.equal(clean.ok, true);
  assert.deepEqual(clean.failures, []);

  // A null result is the easy thing to keep reporting once the records drift, so an
  // empty pass is a failure rather than a clean bill of health.
  assert.equal(checkGateGradeIntegrity({ decisions: [], armSummaries: [] }).ok, false);
  assert.equal(checkGateGradeIntegrity({ decisions: [], armSummaries: [] }).failures[0].code, 'no_scorable_decisions');

  const codes = (result) => result.failures.map((failure) => failure.code);
  assert.deepEqual(
    codes(checkGateGradeIntegrity({ decisions: rows, armSummaries: [armSummary('some_new_arm')] })),
    ['unknown_arm', 'no_observational_arm'],
    'an arm nobody has classified must not quietly enter a pooled baseline',
  );
  assert.deepEqual(
    codes(
      checkGateGradeIntegrity({
        decisions: rows,
        armSummaries: [armSummary('standing_book', { armClassificationMismatch: true, injectedOnFired: 4 })],
      }),
    ),
    ['arm_classification_mismatch'],
  );
  assert.deepEqual(
    codes(
      checkGateGradeIntegrity({
        decisions: [{ deliveryLeaked: false, suppressionRecorded: false, outsideWindow: false }],
        armSummaries: [armSummary('standing_book')],
      }),
    ),
    ['suppression_not_recorded'],
  );
  assert.deepEqual(
    codes(
      checkGateGradeIntegrity({
        decisions: [{ deliveryLeaked: false, suppressionRecorded: true, outsideWindow: true }],
        armSummaries: [armSummary('standing_book')],
      }),
    ),
    ['no_window_eligible_decisions'],
  );

  // Nothing here fails on a result. A gate with no discrimination and a zero advance
  // rate is a finding; a check that failed on it would be a check demanding an
  // outcome.
  const nullResult = checkGateGradeIntegrity({
    decisions: rows,
    armSummaries: [armSummary('standing_book', { covariates: { fireRate: { rate: 0 } } })],
  });
  assert.equal(nullResult.ok, true);
  assert.deepEqual(
    nullResult.warnings.map((warning) => warning.code),
    ['arm_never_fired'],
  );
});
