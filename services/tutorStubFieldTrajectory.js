/**
 * Pure learner-state projection shared by the tutor-stub runtime and offline
 * evaluators. Keep this module free of model calls, files, clocks, and mutable
 * process state so a saved turn can be projected exactly as it was live.
 */

export const FIELD_PROGRESS_THRESHOLD = 0.05;

export const LEARNER_FIELD_RANKS = Object.freeze({
  evidence_use: Object.freeze({
    none: 0,
    repeats_setup: 0.1,
    cites_public_evidence: 0.4,
    omits_warrant: 0.15,
    revises_from_evidence: 0.5,
    links_evidence_to_rule: 0.7,
    overleaps_evidence: -0.2,
    distorts_public_evidence: -0.35,
  }),
  agency: Object.freeze({
    passive: 0,
    complying: 0.2,
    attempting: 0.5,
    steering: 0.55,
    self_correcting: 0.8,
  }),
  epistemic_stance: Object.freeze({
    answer_seeking: 0.1,
    receptive: 0.2,
    confused: 0.25,
    exploratory: 0.5,
    reflective: 0.65,
    grounded: 0.75,
    overconfident: 0.15,
    resistant: 0.1,
  }),
  discourse_move: Object.freeze({
    off_task: 0,
    answer_seeking: 0.1,
    question: 0.3,
    repair_request: 0.35,
    challenge: 0.35,
    claim: 0.45,
    hypothesis: 0.5,
    evidence_adoption: 0.65,
    inference: 0.75,
    metacognitive_reflection: 0.8,
  }),
});

function scoreValue(score) {
  if (score && typeof score === 'object' && score.score !== undefined) return score.score;
  if (score !== undefined && score !== null) return score;
  return '?';
}

function clampField01(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(1, Number(value)));
}

function roundField(value) {
  return Number((Number(value) || 0).toFixed(3));
}

export function meanFinite(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

export function normalizedClassifierScore(score) {
  const numeric = Number(scoreValue(score));
  return Number.isFinite(numeric) ? clampField01((numeric - 1) / 4) : null;
}

export function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function numberOr(value, fallback = 0) {
  const numeric = finiteNumberOrNull(value);
  return numeric === null ? fallback : numeric;
}

function roundOptionalField(value) {
  const numeric = finiteNumberOrNull(value);
  return numeric === null ? null : roundField(numeric);
}

function rankLearnerFieldLabel(axis, value) {
  if (value === undefined || value === null) return null;
  return LEARNER_FIELD_RANKS[axis]?.[String(value).trim()] ?? null;
}

export function dagProgressFeatures(model) {
  const metrics = model?.metrics || {};
  const assessment = model?.assessment || {};
  return {
    bestPathCoverage: Number(assessment.bestPathCoverage || 0),
    groundedCount: Number(metrics.groundedCount || 0),
    voicedDerivedCount: Number(metrics.voicedDerivedCount || 0),
    candidateConclusionCount: Number(metrics.candidateConclusionCount || 0),
    answerCandidateCount: Number(metrics.answerCandidateCount || 0),
    missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
    unsupportedAssertionCount: Number(assessment.unsupportedAssertionCount || 0),
    finalSecretEntailed: assessment.finalSecretEntailed === true,
    assertedSecret: assessment.assertedSecret === true,
    assertedMirror: assessment.assertedMirror === true,
  };
}

export function learnerSurfaceFieldPoint(classification) {
  const turn = classification?.turn || {};
  const scores = turn.scores || {};
  const dimensions = {
    conceptual: normalizedClassifierScore(scores.conceptual_engagement),
    epistemic: normalizedClassifierScore(scores.epistemic_readiness),
    evidence: rankLearnerFieldLabel('evidence_use', turn.evidence_use),
    agency: rankLearnerFieldLabel('agency', turn.agency),
    stance: rankLearnerFieldLabel('epistemic_stance', turn.epistemic_stance),
    discourse: rankLearnerFieldLabel('discourse_move', turn.discourse_move),
  };
  return {
    score: meanFinite(Object.values(dimensions)),
    dimensions,
    labels: {
      discourse_move: turn.discourse_move || null,
      evidence_use: turn.evidence_use || null,
      epistemic_stance: turn.epistemic_stance || null,
      agency: turn.agency || null,
    },
    summary: turn.summary || null,
  };
}

export function previousLearnerSurfaceFieldPoint(state) {
  const previousTurn = [...(state.turns || [])].reverse().find((turn) => turn.classification);
  return previousTurn ? learnerSurfaceFieldPoint(previousTurn.classification) : null;
}

export function fieldProgressFromClassification({ state, classification }) {
  const before = previousLearnerSurfaceFieldPoint(state);
  const after = learnerSurfaceFieldPoint(classification);
  const delta =
    before?.score === null || before?.score === undefined || after?.score === null || after?.score === undefined
      ? null
      : Number((after.score - before.score).toFixed(3));
  return {
    threshold: FIELD_PROGRESS_THRESHOLD,
    beforeScore: before?.score ?? null,
    afterScore: after?.score ?? null,
    delta,
    progress: delta !== null && delta >= FIELD_PROGRESS_THRESHOLD,
    before: before || null,
    after,
  };
}

export function classifyFieldStateRelation({ fieldProgress, dagProgress }) {
  if (fieldProgress && !dagProgress) return 'field_without_dag';
  if (dagProgress && !fieldProgress) return 'dag_without_field';
  if (fieldProgress && dagProgress) return 'both_progress';
  return 'neither_progress';
}

export function learnerDagDeltaForFieldPolicy({ state, tutorLearnerDag }) {
  const previous = state.turns?.at(-1)?.tutorLearnerDagModel || null;
  const current = tutorLearnerDag?.model || null;
  const before = dagProgressFeatures(previous);
  const after = dagProgressFeatures(current);
  const delta = Object.fromEntries(Object.keys(after).map((key) => [key, Number(after[key]) - Number(before[key])]));
  const progressScore =
    delta.bestPathCoverage * 4 +
    delta.groundedCount +
    delta.voicedDerivedCount * 2 +
    delta.candidateConclusionCount +
    delta.answerCandidateCount * 3 -
    Math.max(0, delta.unsupportedAssertionCount);
  return {
    before,
    after,
    delta,
    progressScore: Number(progressScore.toFixed(3)),
    progress: progressScore > 0,
  };
}

export function buildFieldRegisterPolicyCoreFeatures({ state, classification, tutorLearnerDag }) {
  const turn = classification?.turn || {};
  const assessment = tutorLearnerDag?.model?.assessment || {};
  const metrics = tutorLearnerDag?.model?.metrics || {};
  const field = fieldProgressFromClassification({ state, classification });
  const dag = learnerDagDeltaForFieldPolicy({ state, tutorLearnerDag });
  const turnNumber = tutorLearnerDag?.model?.turn ?? state.turns.length + 1;
  const fieldRelation =
    field.delta === null
      ? 'initial'
      : classifyFieldStateRelation({
          fieldProgress: field.progress,
          dagProgress: dag.progress,
        });
  return {
    turn: turnNumber,
    requestType: turn.request_type || 'unknown_request',
    discourseMove: turn.discourse_move || 'unknown',
    evidenceUse: turn.evidence_use || 'unknown',
    epistemicStance: turn.epistemic_stance || 'unknown',
    agency: turn.agency || 'unknown',
    affect: turn.affect || 'unknown',
    field: {
      relation: fieldRelation,
      beforeScore: field.beforeScore,
      afterScore: field.afterScore,
      delta: field.delta,
      progress: field.progress,
      dimensions: field.after?.dimensions || {},
      labels: field.after?.labels || {},
    },
    dag: {
      progress: dag.progress,
      progressScore: dag.progressScore,
      delta: dag.delta,
      bottleneck: assessment.bottleneck || 'unknown',
      bestPathCoverage: assessment.bestPathCoverage ?? null,
      missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
      unsupportedAssertionCount: Number(assessment.unsupportedAssertionCount || 0),
      finalSecretEntailed: assessment.finalSecretEntailed === true,
      assertedSecret: assessment.assertedSecret === true,
    },
  };
}

export function dagProgressScalar(features) {
  const score =
    numberOr(features.bestPathCoverage) * 4 +
    numberOr(features.groundedCount) +
    numberOr(features.voicedDerivedCount) * 2 +
    numberOr(features.candidateConclusionCount) +
    numberOr(features.answerCandidateCount) * 3 -
    numberOr(features.missingPremiseCount) * 0.15 -
    numberOr(features.unsupportedAssertionCount) * 0.8;
  return roundField(score);
}

export function dagRiskScalar(features) {
  const prematureAnswerRisk = features.assertedSecret && !features.finalSecretEntailed ? 2 : 0;
  return roundField(
    numberOr(features.missingPremiseCount) * 0.25 +
      numberOr(features.unsupportedAssertionCount) * 1.25 +
      prematureAnswerRisk,
  );
}

export function trajectoryPointFromTurn(turn, index) {
  const fieldPoint = turn?.classification ? learnerSurfaceFieldPoint(turn.classification) : null;
  const hasDag = Boolean(turn?.tutorLearnerDagModel);
  const dag = hasDag ? dagProgressFeatures(turn.tutorLearnerDagModel) : null;
  return {
    turn: Number.isFinite(Number(turn?.turn)) ? Number(turn.turn) : index + 1,
    fieldScore: fieldPoint?.score ?? null,
    dagScore: dag ? dagProgressScalar(dag) : null,
    riskScore: dag ? dagRiskScalar(dag) : null,
    bottleneck: turn?.tutorLearnerDagModel?.assessment?.bottleneck || 'unknown',
    field: fieldPoint,
    dag,
  };
}

export function trajectoryPointFromCurrent({ state, classification, tutorLearnerDag }) {
  const fieldPoint = learnerSurfaceFieldPoint(classification);
  const hasDag = Boolean(tutorLearnerDag?.model);
  const dag = hasDag ? dagProgressFeatures(tutorLearnerDag.model) : null;
  return {
    turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
    fieldScore: fieldPoint?.score ?? null,
    dagScore: dag ? dagProgressScalar(dag) : null,
    riskScore: dag ? dagRiskScalar(dag) : null,
    bottleneck: tutorLearnerDag?.model?.assessment?.bottleneck || 'unknown',
    field: fieldPoint,
    dag,
  };
}

function finitePointValues(points, key) {
  return points
    .map((point, index) => ({
      x: index,
      y: finiteNumberOrNull(point?.[key]),
    }))
    .filter((point) => point.y !== null);
}

export function linearTrajectorySlope(points, key) {
  const values = finitePointValues(points, key);
  if (values.length < 2) return null;
  const meanX = values.reduce((sum, point) => sum + point.x, 0) / values.length;
  const meanY = values.reduce((sum, point) => sum + point.y, 0) / values.length;
  const denominator = values.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  if (!denominator) return null;
  const numerator = values.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
  return numerator / denominator;
}

function latestTrajectoryDelta(points, key) {
  const values = finitePointValues(points, key).map((point) => point.y);
  if (values.length < 2) return null;
  return values.at(-1) - values.at(-2);
}

function previousTrajectoryDelta(points, key) {
  const values = finitePointValues(points, key).map((point) => point.y);
  if (values.length < 3) return null;
  return values.at(-2) - values.at(-3);
}

export function trajectoryMetric(points, key) {
  const values = finitePointValues(points, key).map((point) => point.y);
  const velocity = latestTrajectoryDelta(points, key);
  const previousVelocity = previousTrajectoryDelta(points, key);
  const acceleration = velocity !== null && previousVelocity !== null ? velocity - previousVelocity : null;
  return {
    current: roundOptionalField(values.at(-1)),
    previous: roundOptionalField(values.length >= 2 ? values.at(-2) : null),
    velocity: roundOptionalField(velocity),
    previousVelocity: roundOptionalField(previousVelocity),
    acceleration: roundOptionalField(acceleration),
    slope: roundOptionalField(linearTrajectorySlope(points, key)),
  };
}

export function buildTrajectoryWindow({ state, classification, tutorLearnerDag, window = 4 }) {
  const historical = (state.turns || [])
    .filter((turn) => turn?.classification || turn?.tutorLearnerDagModel)
    .slice(-window)
    .map((turn, index) => trajectoryPointFromTurn(turn, index));
  const points = [...historical, trajectoryPointFromCurrent({ state, classification, tutorLearnerDag })];
  const field = trajectoryMetric(points, 'fieldScore');
  const dag = trajectoryMetric(points, 'dagScore');
  const risk = trajectoryMetric(points, 'riskScore');
  const currentDag = points.at(-1)?.dag || {};
  const fieldSlope = numberOr(field.slope);
  const dagSlope = numberOr(dag.slope);
  const riskSlope = numberOr(risk.slope);
  const fieldVelocity = numberOr(field.velocity);
  const dagVelocity = numberOr(dag.velocity);
  const riskVelocity = numberOr(risk.velocity);
  const flags = {
    plateau: points.length >= 3 && Math.abs(fieldSlope) < 0.025 && Math.abs(dagSlope) < 0.25 && riskSlope >= -0.15,
    fieldRegression: points.length >= 2 && (fieldVelocity < -0.04 || fieldSlope < -0.025),
    riskRising: points.length >= 2 && (riskVelocity > 0.35 || riskSlope > 0.18),
    fieldOnlyDrift: points.length >= 3 && fieldSlope > 0.025 && dagSlope <= 0.2,
    dagOnlyDrift: points.length >= 3 && dagSlope > 0.25 && fieldSlope < 0.015,
    stableConvergence: points.length >= 3 && dagSlope > 0.2 && fieldSlope >= -0.015 && riskSlope <= 0.1,
    coerciveProgress:
      points.length >= 2 &&
      (dagVelocity > 0.9 || dagSlope > 0.45) &&
      (fieldVelocity < -0.02 || fieldSlope < -0.02 || riskVelocity > 0.4 || riskSlope > 0.18),
    noisyAcceleration:
      points.length >= 3 &&
      (Math.abs(numberOr(field.acceleration)) > 0.08 ||
        Math.abs(numberOr(dag.acceleration)) > 1.25 ||
        Math.abs(numberOr(risk.acceleration)) > 0.75),
    nearClosure:
      currentDag.finalSecretEntailed === true ||
      currentDag.assertedSecret === true ||
      numberOr(currentDag.bestPathCoverage) >= 0.8,
  };
  return {
    schema: 'machinespirits.tutor-stub.register-trajectory.v1',
    window,
    pointCount: points.length,
    points: points.map((point) => ({
      turn: point.turn,
      fieldScore: roundOptionalField(point.fieldScore),
      dagScore: roundOptionalField(point.dagScore),
      riskScore: roundOptionalField(point.riskScore),
      bottleneck: point.bottleneck,
    })),
    field,
    dag,
    risk,
    flags,
  };
}

export function buildTutorStubFieldTrajectoryProjection({ state, classification, tutorLearnerDag, window = 4 }) {
  return {
    schema: 'machinespirits.tutor-stub.field-trajectory-projection.v1',
    features: buildFieldRegisterPolicyCoreFeatures({ state, classification, tutorLearnerDag }),
    trajectory: buildTrajectoryWindow({ state, classification, tutorLearnerDag, window }),
  };
}
