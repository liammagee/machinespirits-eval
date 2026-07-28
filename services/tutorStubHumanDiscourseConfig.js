export const TUTOR_STUB_HUMAN_DISCOURSE_RUN_CONFIG_SCHEMA = 'machinespirits.tutor-stub.human-discourse-run-config.v1';
export const TUTOR_STUB_HUMAN_DISCOURSE_PHASE = 'phase_2_human_scaffold_prompting';

export function buildTutorStubHumanDiscourseRunConfig({ dagMode, dagEnabled, tutorLearnerDagEnabled }) {
  const scaffoldActive = dagMode !== 'strict_dag';
  const stepCompression =
    dagMode === 'defeasible_human_scaffold'
      ? {
          enabled: true,
          policy:
            'accept obvious public bridges as implied proof debt; ask for explicit warrants only when the leap is unsafe, conflicting, or case-closing',
          maxExplicitDemandsPerTurn: 1,
        }
      : {
          enabled: false,
          policy:
            dagMode === 'human_scaffold'
              ? 'frame one local warrant without expanding the whole proof chain'
              : 'strict proof audit only',
          maxExplicitDemandsPerTurn: dagMode === 'human_scaffold' ? 1 : 0,
        };
  return {
    schema: TUTOR_STUB_HUMAN_DISCOURSE_RUN_CONFIG_SCHEMA,
    dagMode,
    strictAuditDag: Boolean(dagEnabled),
    tutorLearnerDag: Boolean(tutorLearnerDagEnabled),
    phase: TUTOR_STUB_HUMAN_DISCOURSE_PHASE,
    scaffoldActive,
    stepCompression,
    scaffoldPolicy:
      dagMode === 'defeasible_human_scaffold'
        ? 'allow learner-owned compressed inference, keep implied proof debt internal, and only surface warrant gaps when they matter'
        : dagMode === 'human_scaffold'
          ? 'frame local human-facing warrants while strict DAG audit remains authoritative'
          : 'strict DAG audit only; no human-scaffold prompt adaptation',
    traceFields: [
      'humanDiscourseFrame',
      'scaffoldState',
      'sideArc',
      'discoursePlane',
      'proofDebt',
      'warrantPremiseAudit',
      'generousInference',
      'conversationalCompletion',
      'questionSupport',
    ],
    behaviorChange: scaffoldActive,
  };
}
