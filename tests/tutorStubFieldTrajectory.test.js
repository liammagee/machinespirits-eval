import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIELD_PROGRESS_THRESHOLD,
  buildFieldRegisterPolicyCoreFeatures,
  buildTrajectoryWindow,
  buildTutorStubFieldTrajectoryProjection,
  finiteNumberOrNull,
  dagProgressFeatures,
  learnerSurfaceFieldPoint,
} from '../services/tutorStubFieldTrajectory.js';

function classification({
  conceptual,
  epistemic,
  evidence,
  agency,
  stance,
  discourse,
  summary,
  requestType = 'unknown_request',
  affect = 'neutral',
}) {
  return {
    turn: {
      scores: {
        conceptual_engagement: conceptual,
        epistemic_readiness: epistemic,
      },
      evidence_use: evidence,
      agency,
      epistemic_stance: stance,
      discourse_move: discourse,
      summary,
      request_type: requestType,
      affect,
    },
  };
}

function dagModel({
  turn,
  coverage,
  grounded,
  voiced,
  candidate = 0,
  answer = 0,
  missing,
  unsupported = 0,
  entailed = false,
  asserted = false,
  mirror = false,
  bottleneck = 'learner_integration_gap',
}) {
  return {
    turn,
    metrics: {
      groundedCount: grounded,
      voicedDerivedCount: voiced,
      candidateConclusionCount: candidate,
      answerCandidateCount: answer,
      missingPremiseCount: missing,
    },
    assessment: {
      bestPathCoverage: coverage,
      missingPremiseCount: missing,
      unsupportedAssertionCount: unsupported,
      finalSecretEntailed: entailed,
      assertedSecret: asserted,
      assertedMirror: mirror,
      bottleneck,
    },
  };
}

const firstClassification = classification({
  conceptual: 1,
  epistemic: 2,
  evidence: 'none',
  agency: 'passive',
  stance: 'confused',
  discourse: 'question',
  summary: 'The learner asks where to begin.',
});

const secondClassification = classification({
  conceptual: { score: 2 },
  epistemic: { score: 3 },
  evidence: 'cites_public_evidence',
  agency: 'attempting',
  stance: 'exploratory',
  discourse: 'hypothesis',
  summary: 'The learner forms a tentative evidence-backed hypothesis.',
});

const currentClassification = classification({
  conceptual: 2,
  epistemic: 3,
  evidence: 'links_evidence_to_rule',
  agency: 'self_correcting',
  stance: 'grounded',
  discourse: 'inference',
  summary: 'The learner links the evidence to a rule and revises.',
  requestType: 'proof_check',
  affect: 'engaged',
});

const firstDag = dagModel({ turn: 1, coverage: 0.2, grounded: 1, voiced: 0, missing: 4 });
const secondDag = dagModel({ turn: 2, coverage: 0.4, grounded: 2, voiced: 1, candidate: 1, missing: 3 });
const currentDag = dagModel({
  turn: 3,
  coverage: 0.8,
  grounded: 3,
  voiced: 2,
  candidate: 1,
  answer: 1,
  missing: 1,
  asserted: true,
  bottleneck: 'assertion_gap',
});

const state = {
  turns: [
    { turn: 1, classification: firstClassification, tutorLearnerDagModel: firstDag },
    { turn: 2, classification: secondClassification, tutorLearnerDagModel: secondDag },
  ],
};

const tutorLearnerDag = { model: currentDag };

test('field and DAG projections preserve the live legacy normalization contract', () => {
  assert.equal(FIELD_PROGRESS_THRESHOLD, 0.05);
  assert.deepEqual(learnerSurfaceFieldPoint(secondClassification), {
    score: 0.44166666666666665,
    dimensions: {
      conceptual: 0.25,
      epistemic: 0.5,
      evidence: 0.4,
      agency: 0.5,
      stance: 0.5,
      discourse: 0.5,
    },
    labels: {
      discourse_move: 'hypothesis',
      evidence_use: 'cites_public_evidence',
      epistemic_stance: 'exploratory',
      agency: 'attempting',
    },
    summary: 'The learner forms a tentative evidence-backed hypothesis.',
  });
  assert.deepEqual(dagProgressFeatures(currentDag), {
    bestPathCoverage: 0.8,
    groundedCount: 3,
    voicedDerivedCount: 2,
    candidateConclusionCount: 1,
    answerCandidateCount: 1,
    missingPremiseCount: 1,
    unsupportedAssertionCount: 0,
    finalSecretEntailed: false,
    assertedSecret: true,
    assertedMirror: false,
  });
});

test('field policy core uses the exact current field and public-DAG delta', () => {
  const features = buildFieldRegisterPolicyCoreFeatures({
    state,
    classification: currentClassification,
    tutorLearnerDag,
  });

  assert.deepEqual(features, {
    turn: 3,
    requestType: 'proof_check',
    discourseMove: 'inference',
    evidenceUse: 'links_evidence_to_rule',
    epistemicStance: 'grounded',
    agency: 'self_correcting',
    affect: 'engaged',
    field: {
      relation: 'both_progress',
      beforeScore: 0.44166666666666665,
      afterScore: 0.625,
      delta: 0.183,
      progress: true,
      dimensions: {
        conceptual: 0.25,
        epistemic: 0.5,
        evidence: 0.7,
        agency: 0.8,
        stance: 0.75,
        discourse: 0.75,
      },
      labels: {
        discourse_move: 'inference',
        evidence_use: 'links_evidence_to_rule',
        epistemic_stance: 'grounded',
        agency: 'self_correcting',
      },
    },
    dag: {
      progress: true,
      progressScore: 7.6,
      delta: {
        bestPathCoverage: 0.4,
        groundedCount: 1,
        voicedDerivedCount: 1,
        candidateConclusionCount: 0,
        answerCandidateCount: 1,
        missingPremiseCount: -2,
        unsupportedAssertionCount: 0,
        finalSecretEntailed: 0,
        assertedSecret: 1,
        assertedMirror: 0,
      },
      bottleneck: 'assertion_gap',
      bestPathCoverage: 0.8,
      missingPremiseCount: 1,
      unsupportedAssertionCount: 0,
      finalSecretEntailed: false,
      assertedSecret: true,
    },
  });
});

test('trajectory projection preserves recent finite differences and risk flags', () => {
  const trajectory = buildTrajectoryWindow({ state, classification: currentClassification, tutorLearnerDag });

  assert.deepEqual(trajectory, {
    schema: 'machinespirits.tutor-stub.register-trajectory.v1',
    window: 4,
    pointCount: 3,
    points: [
      { turn: 1, fieldScore: 0.133, dagScore: 1.2, riskScore: 1, bottleneck: 'learner_integration_gap' },
      { turn: 2, fieldScore: 0.442, dagScore: 6.15, riskScore: 0.75, bottleneck: 'learner_integration_gap' },
      { turn: 3, fieldScore: 0.625, dagScore: 14.05, riskScore: 2.25, bottleneck: 'assertion_gap' },
    ],
    field: {
      current: 0.625,
      previous: 0.442,
      velocity: 0.183,
      previousVelocity: 0.308,
      acceleration: -0.125,
      slope: 0.246,
    },
    dag: {
      current: 14.05,
      previous: 6.15,
      velocity: 7.9,
      previousVelocity: 4.95,
      acceleration: 2.95,
      slope: 6.425,
    },
    risk: {
      current: 2.25,
      previous: 0.75,
      velocity: 1.5,
      previousVelocity: -0.25,
      acceleration: 1.75,
      slope: 0.625,
    },
    flags: {
      plateau: false,
      fieldRegression: false,
      riskRising: true,
      fieldOnlyDrift: false,
      dagOnlyDrift: false,
      stableConvergence: false,
      coerciveProgress: true,
      noisyAcceleration: true,
      nearClosure: true,
    },
  });
});

test('combined projection is exactly the shared core plus the shared trajectory', () => {
  const projection = buildTutorStubFieldTrajectoryProjection({
    state,
    classification: currentClassification,
    tutorLearnerDag,
  });

  assert.equal(projection.schema, 'machinespirits.tutor-stub.field-trajectory-projection.v1');
  assert.deepEqual(
    projection.features,
    buildFieldRegisterPolicyCoreFeatures({ state, classification: currentClassification, tutorLearnerDag }),
  );
  assert.deepEqual(
    projection.trajectory,
    buildTrajectoryWindow({ state, classification: currentClassification, tutorLearnerDag }),
  );
});

test('trajectory window keeps only the configured number of completed turns', () => {
  const longState = {
    turns: Array.from({ length: 6 }, (_, index) => ({
      turn: index + 1,
      classification: secondClassification,
      tutorLearnerDagModel: { ...secondDag, turn: index + 1 },
    })),
  };
  const trajectory = buildTrajectoryWindow({
    state: longState,
    classification: currentClassification,
    tutorLearnerDag: { model: { ...currentDag, turn: 7 } },
    window: 4,
  });

  assert.equal(trajectory.pointCount, 5);
  assert.deepEqual(
    trajectory.points.map((point) => point.turn),
    [3, 4, 5, 6, 7],
  );
});

test('missing field and DAG observations remain missing instead of becoming zero-valued progress', () => {
  assert.equal(finiteNumberOrNull(null), null);
  assert.equal(finiteNumberOrNull(undefined), null);
  assert.equal(finiteNumberOrNull(''), null);

  const trajectory = buildTrajectoryWindow({
    state: { turns: [{ turn: 1 }] },
    classification: currentClassification,
    tutorLearnerDag: { model: null },
  });

  assert.equal(trajectory.field.previous, null);
  assert.equal(trajectory.field.velocity, null);
  assert.equal(trajectory.field.slope, null);
  assert.equal(trajectory.dag.current, null);
  assert.equal(trajectory.dag.velocity, null);
  assert.equal(trajectory.risk.current, null);
});
