export function projectTutorStubStrictDagAuditState(tutorLearnerDag) {
  const model = tutorLearnerDag?.model || tutorLearnerDag || null;
  const assessment = model?.assessment || {};
  const metrics = model?.metrics || {};
  return {
    enabled: Boolean(model),
    coverage: assessment.bestPathCoverage ?? null,
    bottleneck: assessment.bottleneck || null,
    finalSecretEntailed: assessment.finalSecretEntailed === true,
    assertedSecret: assessment.assertedSecret === true,
    assertedMirror: assessment.assertedMirror === true,
    unsupportedAssertionCount: Number(assessment.unsupportedAssertionCount || 0),
    missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
    missingPremiseBuckets: assessment.missingPremiseBuckets || {},
  };
}
