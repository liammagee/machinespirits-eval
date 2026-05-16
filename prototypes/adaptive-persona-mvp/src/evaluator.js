function mean(values) {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function scoreFromRatio(ratio) {
  if (ratio >= 0.95) return 5;
  if (ratio >= 0.8) return 4;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.4) return 2;
  return 1;
}

export function evaluateTrace(trace, rubric) {
  const turns = trace.turns || [];
  const policyMatches = turns.map((t) => t.expectedPolicy ? t.policy.selectedPolicy === t.expectedPolicy : true);
  const evidenceBound = turns.map((t) => Boolean(t.evidence.quote && t.policy.evidenceRefs.includes(t.evidence.obsId)));
  const ktDirections = turns.map((t) => {
    const delta = t.masteryDelta;
    if (t.evidence.outcome === 'correct') return delta > 0;
    if (t.evidence.outcome === 'incorrect') return delta < 0;
    if (t.evidence.outcome === 'unobserved') return delta <= 0.001;
    if (t.evidence.outcome === 'partial') return Math.abs(delta) <= 0.25;
    return true;
  });
  const personaControlled = turns.map((t) => {
    const values = Object.entries(t.personaDelta)
      .filter(([key]) => key !== 'tempo')
      .map(([, value]) => Math.abs(value));
    return values.every((value) => value <= 0.2) && values.some((value) => value > 0);
  });
  const repairTurns = turns.filter((t) => t.expectedPolicy === 'repair_misrecognition');
  const repairScore = repairTurns.length === 0
    ? 5
    : scoreFromRatio(mean(repairTurns.map((t) =>
        t.policy.selectedPolicy === 'repair_misrecognition' && /misread|reset|not what/i.test(t.tutorMessage) ? 1 : 0,
      )));

  const cf = trace.counterfactualComparison;
  const cfScore = cf
    ? (cf.policyDiverged && cf.masteryDiverged && cf.personaDiverged ? 5
        : cf.policyDiverged ? 3
          : 1)
    : 3;

  const terminalPolicies = turns.map((t) => t.policy.selectedPolicy);
  const trajectoryScore = terminalPolicies.includes('transfer_challenge')
    ? 5
    : terminalPolicies.includes('teach_back') || terminalPolicies.includes('minimal_hint')
      ? 4
      : 3;

  const scores = {
    evidence_bound_state_update: scoreFromRatio(mean(evidenceBound.map(BooleanNumber))),
    knowledge_tracing_signal: scoreFromRatio(mean(ktDirections.map(BooleanNumber))),
    policy_evidence_fit: scoreFromRatio(mean(policyMatches.map(BooleanNumber))),
    persona_evolution_control: scoreFromRatio(mean(personaControlled.map(BooleanNumber))),
    recognition_repair: repairScore,
    counterfactual_sensitivity: cfScore,
    trajectory_gain: trajectoryScore,
  };

  const dimensions = rubric.dimensions || {};
  let weighted = 0;
  let totalWeight = 0;
  for (const [key, score] of Object.entries(scores)) {
    const weight = dimensions[key]?.weight ?? 0;
    weighted += score * weight;
    totalWeight += weight;
  }
  const weightedScore = totalWeight > 0 ? ((weighted / totalWeight - 1) / 4) * 100 : 0;

  return {
    scores,
    weightedScore: Number(weightedScore.toFixed(1)),
    summary: summarize(scores, weightedScore),
  };
}

function BooleanNumber(value) {
  return value ? 1 : 0;
}

function summarize(scores, weightedScore) {
  const weak = Object.entries(scores)
    .filter(([, score]) => score <= 2)
    .map(([key]) => key);
  if (weak.length === 0) {
    return `Adaptation chain held; weighted score ${weightedScore.toFixed(1)}.`;
  }
  return `Adaptation chain has weak dimensions: ${weak.join(', ')}.`;
}
