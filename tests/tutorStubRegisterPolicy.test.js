// Unit tests for the deterministic assessment→register pipeline extracted from
// scripts/tutor-stub.js into services/tutorStubRegisterPolicy.js.
//
// Three families:
//  1. golden decision traces — synthetic classification+DAG fixtures pin field
//     point dimensions, trajectory flags, state-vector axes, logits, and the
//     stance distribution at roundField (3dp) precision;
//  2. monotonicity/guard invariants — worsening evidence_use must not raise
//     brisk/face_threat; affective_risk > 0.45 strictly reduces
//     sarcastic/face_threat logits; a riskRising trajectory must not raise
//     face_threat under the trajectory policy;
//  3. sampling — distribution normalization and the recorded random envelope
//     shape only. sampleEngagementStanceDistribution keeps Math.random()
//     semantics on purpose: deterministic seeding is owned by P0.2 in
//     PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DYNAMICAL_SYSTEM_BASE_WEIGHTS,
  DYNAMICAL_SYSTEM_REGISTER_AFFINITY,
  LEARNER_FIELD_RANKS,
  buildDynamicalSystemRegisterScores,
  buildDynamicalSystemState,
  buildFieldRegisterScores,
  buildStateRegisterScores,
  buildTrajectoryRegisterScores,
  buildTrajectoryWindow,
  classifyFieldStateRelation,
  dynamicalGuardAdjustment,
  fieldProgressFromClassification,
  learnerSurfaceFieldPoint,
  logitsToRegisterScores,
  normalizeEngagementStanceDistribution,
  normalizedClassifierScore,
  registerEfficacyFromDagProgress,
  roundField,
  sampleEngagementStanceDistribution,
} from '../services/tutorStubRegisterPolicy.js';
import {
  classificationFixture,
  dagModelFixture,
  highRiskDagModelFixture,
  historicalTurnFixture,
  lowRiskDagModelFixture,
  stateFixture,
  tutorLearnerDagFixture,
  weakClassificationFixture,
} from './tutorStubRegisterPolicyFixtures.js';

function assertClose(actual, expected, label, eps = 15e-4) {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= eps,
    `${label}: expected ${expected}±${eps}, got ${actual}`,
  );
}

function roundedScores(scores) {
  return Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)]));
}

// ---------------------------------------------------------------------------
// 1. Golden decision traces
// ---------------------------------------------------------------------------

test('one-way dependency: the service never imports from scripts/', () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../services/tutorStubRegisterPolicy.js', import.meta.url)),
    'utf8',
  );
  assert.ok(!/from\s+'[^']*scripts\//u.test(source), 'service must not import from scripts/');
});

test('LEARNER_FIELD_RANKS pins the evidence_use ladder the invariants rely on', () => {
  assert.equal(LEARNER_FIELD_RANKS.evidence_use.links_evidence_to_rule, 0.7);
  assert.equal(LEARNER_FIELD_RANKS.evidence_use.distorts_public_evidence, -0.35);
  assert.equal(LEARNER_FIELD_RANKS.agency.attempting, 0.5);
  assert.equal(LEARNER_FIELD_RANKS.discourse_move.inference, 0.75);
});

test('normalizedClassifierScore maps 1..5 (score envelopes included) onto clamped [0,1]', () => {
  assert.equal(normalizedClassifierScore({ score: 3 }), 0.5);
  assert.equal(normalizedClassifierScore(4), 0.75);
  assert.equal(normalizedClassifierScore(6), 1); // clamped high
  assert.equal(normalizedClassifierScore(0), 0); // clamped low
  assert.equal(normalizedClassifierScore('not-a-number'), null);
  assert.equal(normalizedClassifierScore(undefined), null);
});

test('golden: learnerSurfaceFieldPoint dimensions for the default fixture', () => {
  const point = learnerSurfaceFieldPoint(classificationFixture());
  // conceptual (3-1)/4, epistemic (4-1)/4, then the rank tables verbatim.
  assert.deepEqual(point.dimensions, {
    conceptual: 0.5,
    epistemic: 0.75,
    evidence: 0.7,
    agency: 0.5,
    stance: 0.5,
    discourse: 0.75,
  });
  assertClose(point.score, 3.7 / 6, 'field point score', 1e-9);
  assert.deepEqual(point.labels, {
    discourse_move: 'inference',
    evidence_use: 'links_evidence_to_rule',
    epistemic_stance: 'exploratory',
    agency: 'attempting',
  });
  assert.equal(point.summary, 'Learner links the assay residue to the rule.');
});

test('golden: fieldProgressFromClassification on turn 1 and turn 2', () => {
  const first = fieldProgressFromClassification({
    state: stateFixture(),
    classification: classificationFixture(),
  });
  assert.equal(first.delta, null);
  assert.equal(first.progress, false);
  assert.equal(first.before, null);
  assert.equal(first.threshold, 0.05);

  // Prior weak turn: dims (0.25+0.25+0.1+0.2+0.2+0.3)/6 = 1.3/6; current 3.7/6.
  const state = stateFixture({
    turns: [historicalTurnFixture({ turn: 1, classification: weakClassificationFixture(), model: dagModelFixture() })],
  });
  const second = fieldProgressFromClassification({ state, classification: classificationFixture() });
  assertClose(second.beforeScore, 1.3 / 6, 'before score', 1e-9);
  assertClose(second.afterScore, 3.7 / 6, 'after score', 1e-9);
  assert.equal(second.delta, 0.4);
  assert.equal(second.progress, true);
});

test('classifyFieldStateRelation covers all four quadrants', () => {
  assert.equal(classifyFieldStateRelation({ fieldProgress: true, dagProgress: false }), 'field_without_dag');
  assert.equal(classifyFieldStateRelation({ fieldProgress: false, dagProgress: true }), 'dag_without_field');
  assert.equal(classifyFieldStateRelation({ fieldProgress: true, dagProgress: true }), 'both_progress');
  assert.equal(classifyFieldStateRelation({ fieldProgress: false, dagProgress: false }), 'neither_progress');
});

test('golden: registerEfficacyFromDagProgress scores a clean positive advance', () => {
  const state = stateFixture({
    turns: [historicalTurnFixture({ turn: 1, classification: weakClassificationFixture(), model: dagModelFixture() })],
  });
  const currentModel = dagModelFixture({
    turn: 2,
    assessment: { bestPathCoverage: 0.5, missingPremiseCount: 1 },
    metrics: { groundedCount: 2, answerCandidateCount: 1, missingPremiseCount: 1 },
  });
  const efficacy = registerEfficacyFromDagProgress({
    selection: { selectedAtDag: dagModelFixture(), turn: 1, selected_register: 'precise' },
    currentModel,
    accepted: { adopt: ['fact_1'], derive: [], hypothesis: null, assertAnswer: null },
    state,
    classification: classificationFixture(),
  });
  // delta: coverage +0.25*4, grounded +1, answers +1*3, missing -1 → 1+1+3+1 = 6.
  assert.equal(efficacy.progressScore, 6);
  assert.equal(efficacy.label, 'positive_progress');
  assert.equal(efficacy.dagProgress, true);
  assert.equal(efficacy.mismatch, 'both_progress'); // field delta 0.4 also progressed
  assert.equal(efficacy.summary, 'coverage +0.25, grounded +1, answers +1, missing -1');
  assert.equal(efficacy.evaluatedAtTurn, 2);
  assert.equal(efficacy.registerTurn, 1);
  assert.deepEqual(efficacy.acceptedUpdate, {
    adopted: 1,
    derived: 0,
    hypothesis: false,
    assertedAnswer: null,
    learnerAdvance: null,
  });
});

test('golden: buildTrajectoryWindow single-point flags and rounded point values', () => {
  const trajectory = buildTrajectoryWindow({
    state: stateFixture(),
    classification: classificationFixture(),
    tutorLearnerDag: tutorLearnerDagFixture(),
  });
  assert.equal(trajectory.pointCount, 1);
  assert.equal(trajectory.window, 4);
  assert.deepEqual(trajectory.flags, {
    plateau: false,
    fieldRegression: false,
    riskRising: false,
    fieldOnlyDrift: false,
    dagOnlyDrift: false,
    stableConvergence: false,
    learnerAcceleration: false,
    coerciveProgress: false,
    noisyAcceleration: false,
    nearClosure: false,
  });
  // dagScore = 0.25*4 + 1 - 2*0.15 = 1.7; riskScore = 2*0.25 = 0.5.
  assert.deepEqual(trajectory.points, [
    { turn: 1, fieldScore: 0.617, dagScore: 1.7, riskScore: 0.5, advanceScore: 0, bottleneck: 'none' },
  ]);
  assert.equal(trajectory.field.current, 0.617);
  // Pinned quirk: roundOptionalField passes null through Number(null) === 0,
  // so single-point velocity/slope surface as 0, not null — "no data yet" and
  // "zero movement" are indistinguishable downstream.
  assert.equal(trajectory.field.velocity, 0);
  assert.equal(trajectory.field.slope, 0);
  assert.equal(trajectory.risk.current, 0.5);
});

test('golden: buildFieldRegisterScores first-turn scores and drivers', () => {
  const { features, scores, drivers } = buildFieldRegisterScores({
    state: stateFixture(),
    classification: classificationFixture(),
    tutorLearnerDag: tutorLearnerDagFixture(),
  });
  assert.equal(features.field.relation, 'initial');
  assert.equal(features.explicitStepwise, false);
  // Base weights, +0.6 warm/precise for the first turn, brisk ×0.65 non-default.
  assert.deepEqual(roundedScores(scores), {
    plain: 1,
    precise: 1.6,
    brisk: 0.455,
    warm: 1.4,
    witnessing: 0.55,
    charismatic: 0.75,
    ironic: 0.35,
    sarcastic: 0.2,
    face_threat: 0.08,
  });
  assert.deepEqual(drivers, [
    'warm+0.60 for first-turn invitation',
    'precise+0.60 for first-turn warranting',
    'briskx0.65 brisk remains non-default without explicit stepwise need',
  ]);
});

test('golden: buildStateRegisterScores first-turn scores and drivers', () => {
  const { features, scores, drivers } = buildStateRegisterScores({
    state: stateFixture(),
    classification: classificationFixture(),
    tutorLearnerDag: tutorLearnerDagFixture(),
  });
  assert.equal(features.scores.conceptual, 0.5);
  assert.equal(features.scores.epistemicReadiness, 0.75);
  // grounded-evidence regex fires (+0.9 precise, +0.55 brisk); brisk ×0.55
  // non-default; sarcastic ×0.55 and face_threat ×0.3 negative dampening.
  assert.deepEqual(roundedScores(scores), {
    plain: 1.15,
    precise: 2.1,
    brisk: 0.605,
    warm: 0.9,
    witnessing: 0.55,
    charismatic: 0.8,
    ironic: 0.22,
    sarcastic: 0.044,
    face_threat: 0.009,
  });
  assert.deepEqual(drivers, [
    'precise+0.90 for current grounded evidence use',
    'brisk+0.55 for current momentum',
    'briskx0.55 brisk non-default without explicit stepwise need',
    'sarcasticx0.55 negative-register dampening under state policy',
    'face_threatx0.30 negative-register dampening under state policy',
  ]);
});

test('golden: buildDynamicalSystemState axes for the default first-turn fixture', () => {
  const system = buildDynamicalSystemState({
    state: stateFixture(),
    classification: classificationFixture(),
    tutorLearnerDag: tutorLearnerDagFixture(),
  });
  assert.equal(system.schema, 'machinespirits.tutor-stub.dynamical-system-state.v1');
  const vector = system.state_vector;
  // Hand-derived (see fixture comments): surface = mean(0.5,0.75,0.7,0.5).
  assert.equal(vector.language_opacity, 0);
  assert.equal(vector.momentum, 0);
  assert.equal(vector.tempo_affordance, 0);
  assert.equal(vector.field_regression, 0);
  assert.equal(vector.learner_acceleration, 0);
  assert.equal(vector.empirical_uncertainty, 1); // no efficacy history yet
  assert.equal(vector.agency_deficit, 0.5);
  assert.equal(vector.warrant_gap, 0.025); // (1-0.75)*0.1
  assert.equal(vector.stagnation, 0.15); // flat-velocity term only
  assertClose(vector.evidence_gap, 0.499, 'evidence_gap');
  assertClose(vector.affective_risk, 0.033, 'affective_risk');
  assertClose(vector.coercion_risk, 0.007, 'coercion_risk');
  assertClose(vector.recognition_pressure, 0.182, 'recognition_pressure');
  assertClose(vector.integration_need, 0.136, 'integration_need');
  assertClose(vector.compression_need, 0.136, 'compression_need');
  assertClose(vector.disruption_need, 0.161, 'disruption_need');
  assertClose(vector.closure_pressure, 0.088, 'closure_pressure');
  assert.deepEqual(Object.keys(system.attractors), [
    'recognition_safety',
    'learner_ownership',
    'evidence_grounding',
    'accountable_closure',
    'productive_disruption',
    'controlled_pace',
  ]);
});

test('golden: buildDynamicalSystemRegisterScores logits compose base + affinity·state + guards', () => {
  const palette = ['plain', 'precise', 'face_threat'];
  const inputs = {
    state: stateFixture({ palette }),
    classification: classificationFixture(),
    tutorLearnerDag: tutorLearnerDagFixture(),
  };
  const result = buildDynamicalSystemRegisterScores(inputs);
  assert.deepEqual(Object.keys(result.logits), palette);
  assert.deepEqual(result.empirical.corrections, { plain: 0, precise: 0, face_threat: 0 });
  assert.equal(result.corpusEmpirical.enabled, false);

  // Recompute each logit from the exported constants and the emitted state
  // vector: ln(base) + Σ axis·affinity + guard (no history ⇒ no corrections,
  // no repetition penalties). Same operations in the same order ⇒ exact.
  for (const register of palette) {
    const base = Math.max(0.01, DYNAMICAL_SYSTEM_BASE_WEIGHTS[register] ?? 0.25);
    const affinity = DYNAMICAL_SYSTEM_REGISTER_AFFINITY[register] || {};
    let expected = Math.log(base);
    for (const [axis, value] of Object.entries(result.system.state_vector)) {
      expected += (Number(value) || 0) * (Number(affinity[axis]) || 0);
    }
    expected += dynamicalGuardAdjustment(register, result.system, result.features, []);
    assert.equal(result.logits[register], expected, `logit composition for ${register}`);
  }
  // face_threat draws the empirical-uncertainty guard (-0.45) on turn one.
  assert.ok(
    result.drivers.some((driver) => driver.includes('face_threat-0.45 empirical uncertainty guard')),
    'expected the empirical-uncertainty guard driver for face_threat',
  );
  assert.deepEqual(result.scores, logitsToRegisterScores(result.logits, { temperature: 0.85 }));
});

// ---------------------------------------------------------------------------
// 2. Monotonicity / guard invariants
// ---------------------------------------------------------------------------

function scoresForEvidence(builder, evidenceUse, { withHistory = false } = {}) {
  const turns = withHistory
    ? [historicalTurnFixture({ turn: 1, classification: weakClassificationFixture(), model: dagModelFixture() })]
    : [];
  return builder({
    state: stateFixture({ turns }),
    classification: classificationFixture({ evidence_use: evidenceUse }),
    tutorLearnerDag: tutorLearnerDagFixture(),
  }).scores;
}

test('invariant: worsening evidence_use must not increase brisk or face_threat (field + state policies)', () => {
  for (const builder of [buildFieldRegisterScores, buildStateRegisterScores]) {
    for (const withHistory of [false, true]) {
      const better = scoresForEvidence(builder, 'links_evidence_to_rule', { withHistory });
      const worse = scoresForEvidence(builder, 'distorts_public_evidence', { withHistory });
      const label = `${builder.name} withHistory=${withHistory}`;
      assert.ok(worse.brisk <= better.brisk + 1e-12, `${label}: brisk rose ${better.brisk} -> ${worse.brisk}`);
      assert.ok(
        worse.face_threat <= better.face_threat + 1e-12,
        `${label}: face_threat rose ${better.face_threat} -> ${worse.face_threat}`,
      );
    }
  }
});

test('invariant: affective_risk > 0.45 strictly reduces sarcastic/face_threat guard adjustments', () => {
  const features = { explicitStepwise: false, comprehension: null, dag: { finalSecretEntailed: false } };
  const systemAt = (affectiveRisk) => ({
    state_vector: { affective_risk: affectiveRisk, coercion_risk: 0, empirical_uncertainty: 0 },
  });
  for (const register of ['sarcastic', 'face_threat']) {
    const drivers = [];
    const atBoundary = dynamicalGuardAdjustment(register, systemAt(0.45), features, []);
    const aboveBoundary = dynamicalGuardAdjustment(register, systemAt(0.46), features, drivers);
    assert.equal(atBoundary, 0, `${register} guard must be silent at the 0.45 boundary`);
    assert.equal(aboveBoundary, -1.05, `${register} guard must fire above 0.45`);
    assert.ok(aboveBoundary < atBoundary, `${register} adjustment must strictly decrease`);
    assert.deepEqual(drivers, [`${register}-1.05 affective risk guard`]);
  }
  // ironic takes the lighter -0.55 form of the same guard.
  assert.equal(dynamicalGuardAdjustment('ironic', systemAt(0.46), features, []), -0.55);
});

test('invariant: high affective risk lowers sarcastic/face_threat logits end-to-end', () => {
  const build = (affect) =>
    buildDynamicalSystemRegisterScores({
      state: stateFixture(),
      classification: classificationFixture({ affect }),
      tutorLearnerDag: tutorLearnerDagFixture(),
    });
  const calm = build('neutral');
  const anxious = build('anxious'); // matches the explicit affective-signal regex
  assert.ok(anxious.system.state_vector.affective_risk > 0.45, 'fixture must push affective_risk over the guard');
  assert.ok(calm.system.state_vector.affective_risk < 0.45, 'calm fixture must stay under the guard');
  for (const register of ['sarcastic', 'face_threat']) {
    assert.ok(
      anxious.logits[register] < calm.logits[register],
      `${register} logit must drop under affective risk (${calm.logits[register]} -> ${anxious.logits[register]})`,
    );
  }
});

function trajectoryArm(riskShape) {
  // Both arms share the last historical turn and the current turn, so the
  // field-policy base is identical; only earlier history varies the risk
  // trace (dagProgressScalar stays flat by construction — see fixtures).
  const models =
    riskShape === 'rising'
      ? [lowRiskDagModelFixture(1), highRiskDagModelFixture(2), highRiskDagModelFixture(3)]
      : [highRiskDagModelFixture(1), highRiskDagModelFixture(2), highRiskDagModelFixture(3)];
  const turns = models.map((model, index) =>
    historicalTurnFixture({ turn: index + 1, classification: classificationFixture(), model }),
  );
  return buildTrajectoryRegisterScores({
    state: stateFixture({ turns }),
    classification: classificationFixture(),
    tutorLearnerDag: tutorLearnerDagFixture(highRiskDagModelFixture(4)),
  });
}

test('invariant: a riskRising trajectory must not increase face_threat under the trajectory policy', () => {
  const flat = trajectoryArm('flat');
  const rising = trajectoryArm('rising');
  // Self-check the construction: the flag is the only intended difference.
  assert.equal(flat.trajectory.flags.riskRising, false);
  assert.equal(rising.trajectory.flags.riskRising, true);
  assert.equal(rising.trajectory.risk.slope, 1.5); // [1.75, 6.75, 6.75, 6.75] regression
  assert.deepEqual(roundedScores(rising.baseScores), roundedScores(flat.baseScores));
  assert.ok(
    rising.scores.face_threat < flat.scores.face_threat,
    `face_threat must not rise when risk is rising (${flat.scores.face_threat} -> ${rising.scores.face_threat})`,
  );
  assert.ok(rising.scores.sarcastic < flat.scores.sarcastic, 'sarcastic is dampened by the same guard');
});

// ---------------------------------------------------------------------------
// 3. Distribution normalization + sampling envelope
// ---------------------------------------------------------------------------

test('golden: normalizeEngagementStanceDistribution at temperature 1', () => {
  const distribution = normalizeEngagementStanceDistribution(
    { plain: 2, precise: 1, face_threat: 0 },
    { temperature: 1 },
  );
  // Floor 0.02 applies to the zero score; at T=1 weights are score/max.
  assert.deepEqual(distribution, [
    { register: 'plain', weight: 1, sourceWeight: 2, probability: 0.6623 },
    { register: 'precise', weight: 0.5, sourceWeight: 1, probability: 0.3311 },
    { register: 'face_threat', weight: 0.01, sourceWeight: 0.02, probability: 0.0066 },
  ]);
  const total = distribution.reduce((sum, entry) => sum + entry.probability, 0);
  assertClose(total, 1, 'probabilities sum to 1', 5e-4);
});

test('normalizeEngagementStanceDistribution sharpens under low temperature and sorts deterministically', () => {
  const distribution = normalizeEngagementStanceDistribution({ plain: 2, precise: 1 }, { temperature: 0.5 });
  assert.deepEqual(
    distribution.map((entry) => entry.register),
    ['plain', 'precise'],
  );
  assert.equal(distribution[0].weight, 1); // (2/2)^2
  assert.equal(distribution[1].weight, 0.25); // (1/2)^2
  assert.equal(distribution[0].probability, 0.8); // 1 / 1.25
  assert.equal(distribution[1].probability, 0.2);
});

test('sampleEngagementStanceDistribution records the Math.random envelope without changing semantics', () => {
  const distribution = normalizeEngagementStanceDistribution({ plain: 2, precise: 1 }, { temperature: 1 });
  const originalRandom = Math.random;
  try {
    Math.random = () => 0; // threshold 0 ⇒ first entry
    const first = sampleEngagementStanceDistribution(distribution);
    assert.equal(first.entry.register, 'plain');
    assert.deepEqual(first.random, { method: 'Math.random', value: 0, threshold: 0 });

    Math.random = () => 0.999999; // threshold ≈ total ⇒ last entry
    const last = sampleEngagementStanceDistribution(distribution);
    assert.equal(last.entry.register, 'precise');
    assert.equal(last.random.method, 'Math.random');
    assert.equal(last.random.value, 0.999999);
    assertClose(last.random.threshold, 1.5, 'threshold = value × total weight', 1e-4);
  } finally {
    Math.random = originalRandom;
  }
  // Unstubbed: envelope shape only (seeding is P0.2's job, not this test's).
  const sampled = sampleEngagementStanceDistribution(distribution);
  assert.ok(distribution.some((entry) => entry.register === sampled.entry.register));
  assert.equal(sampled.random.method, 'Math.random');
  assert.ok(sampled.random.value >= 0 && sampled.random.value < 1);
  assert.ok(Math.abs(sampled.random.threshold - sampled.random.value * 1.5) <= 1e-4);
});
