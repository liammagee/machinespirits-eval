export const TUTOR_STUB_UNANALYZED_CLASSIFICATION_SCHEMA = 'machinespirits.tutor-stub.learner-analysis-no-signal.v1';

export function isTutorStubUnanalyzedClassification(value) {
  return (
    value?.schema === TUTOR_STUB_UNANALYZED_CLASSIFICATION_SCHEMA &&
    value?.analysis_status === 'unanalyzed' &&
    value?.signal?.state === 'none'
  );
}

export function buildTutorStubFailedClassification({ code, resolved, latencyMs = 0, usage = null } = {}) {
  return {
    schema: TUTOR_STUB_UNANALYZED_CLASSIFICATION_SCHEMA,
    analysis_status: 'unanalyzed',
    signal: { state: 'none' },
    failure_code: String(code || 'analysis_unavailable'),
    provider: resolved?.provider || null,
    model: resolved?.model || null,
    latencyMs,
    usage: usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
  };
}

export function floorTutorStubClassifierScore(score, minimum, reason, { scoreValue } = {}) {
  const current = Number(scoreValue(score));
  if (Number.isFinite(current) && current >= minimum) return score;
  if (score && typeof score === 'object') return { ...score, score: minimum, reason };
  return { score: minimum, reason };
}

export function applyTutorStubLearnerAdvanceAssessment(classification, tutorLearnerDag, { scoreValue } = {}) {
  const advance = tutorLearnerDag?.advance || tutorLearnerDag?.model?.learnerAdvance || null;
  const turn = classification?.turn;
  if (!advance || !turn) return classification;
  turn.learner_advance = advance;
  if (!advance.accelerated) return classification;
  turn.learning_pace = 'accelerating';
  turn.reasoning_span = advance.multiStep ? 'multi_step' : 'multi_premise';
  turn.discourse_move = advance.derivedFactCount > 0 ? 'inference' : 'evidence_adoption';
  if (['none', 'repeats_setup', 'cites_public_evidence'].includes(turn.evidence_use)) {
    turn.evidence_use = advance.derivedFactCount > 0 ? 'links_evidence_to_rule' : 'cites_public_evidence';
  }
  if (['passive', 'complying', 'attempting'].includes(turn.agency)) turn.agency = 'steering';
  turn.scores = turn.scores || {};
  const reason = `Accepted ${advance.supportedMoveCount} learner-owned public proof moves in one turn.`;
  turn.scores.conceptual_engagement = floorTutorStubClassifierScore(turn.scores.conceptual_engagement, 4, reason, {
    scoreValue,
  });
  turn.scores.epistemic_readiness = floorTutorStubClassifierScore(turn.scores.epistemic_readiness, 4, reason, {
    scoreValue,
  });
  return classification;
}
