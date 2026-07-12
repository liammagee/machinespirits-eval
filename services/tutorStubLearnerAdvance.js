export const TUTOR_STUB_LEARNER_ADVANCE_SCHEMA = 'machinespirits.tutor-stub.learner-advance.v1';

function number(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function uniqueFacts(facts = []) {
  const seen = new Set();
  return facts.filter((fact) => {
    const key = JSON.stringify(fact);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dagFeatures(model) {
  const metrics = model?.metrics || {};
  const assessment = model?.assessment || {};
  return {
    groundedCount: number(metrics.groundedCount),
    voicedDerivedCount: number(metrics.voicedDerivedCount),
    missingPremiseCount: number(metrics.missingPremiseCount ?? assessment.missingPremiseCount),
    bestPathCoverage: number(assessment.bestPathCoverage),
  };
}

function rounded(value) {
  return Number(number(value).toFixed(3));
}

/**
 * Describe how much learner-owned proof work was accepted in one public turn.
 * This deliberately counts only extractor updates that survived DAG validation;
 * closure facts that were never voiced by the learner cannot manufacture pace.
 */
export function buildTutorStubLearnerAdvance({ accepted = {}, beforeModel = null, afterModel = null } = {}) {
  const adoptedPremiseIds = [...new Set(Array.isArray(accepted.adopt) ? accepted.adopt : [])];
  const derivedFacts = uniqueFacts(Array.isArray(accepted.derive) ? accepted.derive : []);
  const retractedPremiseIds = [...new Set(Array.isArray(accepted.retract) ? accepted.retract : [])];
  const before = dagFeatures(beforeModel);
  const after = dagFeatures(afterModel);
  const delta = {
    groundedCount: after.groundedCount - before.groundedCount,
    voicedDerivedCount: after.voicedDerivedCount - before.voicedDerivedCount,
    missingPremiseCount: after.missingPremiseCount - before.missingPremiseCount,
    bestPathCoverage: rounded(after.bestPathCoverage - before.bestPathCoverage),
  };
  const adoptedPremiseCount = adoptedPremiseIds.length;
  const derivedFactCount = derivedFacts.length;
  const supportedMoveCount = adoptedPremiseCount + derivedFactCount;
  const multiPremise = adoptedPremiseCount > 1;
  const multiStep = derivedFactCount > 1 || (adoptedPremiseCount > 0 && derivedFactCount > 0);
  const accelerated = supportedMoveCount > 1 && (delta.groundedCount > 0 || delta.voicedDerivedCount > 0);
  const regressed =
    retractedPremiseIds.length > adoptedPremiseCount || delta.groundedCount < 0 || delta.bestPathCoverage < 0;
  const pace = regressed
    ? 'regressing'
    : accelerated
      ? 'accelerating'
      : supportedMoveCount === 1
        ? 'advancing'
        : 'steady';
  const strength = Math.max(
    0,
    Math.min(
      1,
      supportedMoveCount * 0.25 +
        Math.max(0, delta.groundedCount) * 0.08 +
        Math.max(0, delta.voicedDerivedCount) * 0.12 +
        Math.max(0, delta.bestPathCoverage) * 0.35,
    ),
  );

  return {
    schema: TUTOR_STUB_LEARNER_ADVANCE_SCHEMA,
    pace,
    accelerated,
    multiPremise,
    multiStep,
    suppliedFollowUp: supportedMoveCount > 1,
    adoptedPremiseCount,
    derivedFactCount,
    supportedMoveCount,
    retractedPremiseCount: retractedPremiseIds.length,
    adoptedPremiseIds,
    derivedFacts,
    delta,
    strength: rounded(strength),
  };
}
