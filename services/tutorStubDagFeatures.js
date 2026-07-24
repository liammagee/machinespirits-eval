/**
 * Canonical pure projection from a learner-DAG model to register-policy
 * features. Keep this leaf independent of field, trajectory, and policy
 * modules so each layer can consume the same normalized DAG shape.
 */

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
