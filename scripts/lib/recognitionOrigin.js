const CUT = 75;

const ORIGIN_CLASSES = ['none', 'organic', 'peripeteia_induced', 'false_closure', 'ambiguous'];

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roleScores(row = {}) {
  const metadata = row.metadata || {};
  return row.roleSymmetricScores || metadata.role_symmetric_scores || {};
}

function scoreValue(...values) {
  for (const value of values) {
    const n = asNumber(value);
    if (n != null) return n;
  }
  return 0;
}

function evidenceValue(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function recognitionOriginForScoreRow(row = {}) {
  if (row.error) {
    return {
      class: 'none',
      basis: 'score_error',
      justification: 'The critic did not return a usable score.',
      completeEndingShape: false,
      scores: {},
      evidence: {},
    };
  }

  const roles = roleScores(row);
  const learnerSelf = roles.learner_self_reframe || {};
  const learnerAction = roles.learner_actional_breakthrough || {};
  const tutorMechanism = roles.tutor_adaptive_mechanism || roles.tutor_strategy_reversal || {};
  const mechanismQuality = roles.tutor_adaptive_mechanism_quality || {};
  const formClass = row.formClass || row.form_class || null;
  const recon = scoreValue(row.recontextualization, learnerSelf.score100);
  const statedInsight = scoreValue(row.statedInsight, row.stated_insight);
  const learnerActionScore = scoreValue(row.actionalBreakthrough, row.metadata?.actional_breakthrough, learnerAction.score100);
  const tutorMechanismScore = scoreValue(
    row.tutorAdaptiveMechanism,
    row.tutorStrategicReversal,
    row.metadata?.tutor_adaptive_mechanism,
    row.metadata?.tutor_strategic_reversal,
    tutorMechanism.score100,
  );
  const mechanismQualityScore = scoreValue(
    row.adaptiveMechanismQuality,
    row.metadata?.adaptive_mechanism_quality,
    mechanismQuality.score100,
  );
  const completeEndingShape = recon >= CUT && learnerActionScore >= CUT && tutorMechanismScore >= CUT;
  const scores = {
    learnerSelfReframe: recon,
    learnerAction: learnerActionScore,
    tutorAdaptiveMechanism: tutorMechanismScore,
    adaptiveMechanismQuality: mechanismQualityScore,
    statedInsight,
  };
  const evidence = {
    learnerSelfReframe: evidenceValue(row.recoheredEarlier, row.recohered_earlier, learnerSelf.evidence),
    learnerAction: evidenceValue(
      row.actionalBreakthroughEvidence,
      row.metadata?.actional_breakthrough_evidence,
      learnerAction.evidence,
    ),
    tutorAdaptiveMechanism: evidenceValue(
      row.tutorReversalEvidence,
      row.metadata?.tutor_reversal_evidence,
      tutorMechanism.evidence,
    ),
    adaptiveMechanismQuality: evidenceValue(
      row.adaptiveMechanismQualityEvidence,
      row.metadata?.adaptive_mechanism_quality_evidence,
      mechanismQuality.evidence,
    ),
  };

  if (formClass === 'trap' || (statedInsight >= CUT && recon < CUT)) {
    return {
      class: 'false_closure',
      basis: 'stated_insight_without_recontextualization',
      justification:
        'The learner marks relief or closure without enough recontextualization of earlier learner turns.',
      completeEndingShape,
      scores,
      evidence,
    };
  }

  if (formClass !== 'recognition' && recon < CUT) {
    return {
      class: 'none',
      basis: 'no_recognitive_reframe',
      justification: 'The critic did not find a recognitive learner self-reframe.',
      completeEndingShape,
      scores,
      evidence,
    };
  }

  if (completeEndingShape) {
    return {
      class: 'peripeteia_induced',
      basis: 'tutor_mechanism_then_learner_performance_then_reorientation',
      justification:
        'The same critic found tutor adaptive mechanism, learner public performance, and learner reorientation.',
      completeEndingShape,
      scores,
      evidence,
    };
  }

  if (tutorMechanismScore >= CUT || mechanismQualityScore >= CUT) {
    return {
      class: 'ambiguous',
      basis: 'recognition_with_partial_tutor_mechanism_chain',
      justification:
        'Recognition appears alongside some tutor mechanism evidence, but the full mechanism-performance-reorientation chain is incomplete.',
      completeEndingShape,
      scores,
      evidence,
    };
  }

  return {
    class: 'organic',
    basis: 'recognition_without_tutor_mechanism_chain',
    justification:
      'The learner reorientation appears without enough evidence that a tutor adaptive mechanism caused it.',
    completeEndingShape,
    scores,
    evidence,
  };
}

function originCounts(rows = []) {
  const counts = Object.fromEntries(ORIGIN_CLASSES.map((name) => [name, 0]));
  for (const row of rows) {
    const cls = row?.recognitionOrigin?.class || row?.metadata?.recognition_origin?.class || row?.class || 'none';
    if (counts[cls] == null) counts[cls] = 0;
    counts[cls] += 1;
  }
  return counts;
}

export { CUT as RECOGNITION_ORIGIN_CUT, ORIGIN_CLASSES, recognitionOriginForScoreRow, originCounts };
