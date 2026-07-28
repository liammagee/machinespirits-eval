export function buildTutorStubFailedClassification({ message, resolved, latencyMs = 0, usage = null } = {}) {
  return {
    error: message,
    turn: {
      summary: 'Classifier failed before the tutor turn.',
      request_type: 'off_task_or_mixed',
      discourse_move: 'unknown',
      evidence_use: 'unknown',
      epistemic_stance: 'unknown',
      affect: 'unknown',
      agency: 'unknown',
      scores: {},
      pedagogical_need: 'Proceed cautiously and use the learner input directly.',
    },
    overall: {
      summary: 'Overall classification is unavailable because the classifier failed.',
      trajectory: 'unknown',
      recurring_pattern: 'unknown',
      current_state: 'unknown',
      next_best_tutor_move: 'Ask a focused diagnostic question.',
    },
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
