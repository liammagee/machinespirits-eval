import {
  buildTutorStubResistantLearnerCalibrationPlan,
  buildTutorStubResistantLearnerPoweredPlan,
  runTutorStubResistantLearnerCompilationPreflight,
  tutorStubResistantLearnerMergedFaceDesign,
} from './tutorStubResistantLearnerCalibration.js';
import {
  probeTutorStubResistantLearnerCliRoute,
  smokeTutorStubResistantLearnerProtocolV2Role,
} from './tutorStubResistantLearnerLaunchProtocolV2.js';

const MERGED_SCHEMA = 'machinespirits.tutor-stub.resistant-learner-merged-study-design.v1';
const LUNA = 'codex.gpt-5.6-luna';

function routeRow({ faceId, study, role, transportRole, route }) {
  return {
    face_id: faceId,
    study,
    role,
    transportRole,
    modelRef: route.modelRef,
    provider: route.provider,
    model: route.model,
    effort: route.effort,
  };
}

function coreRoute(faceDesign, key) {
  const modelRef = faceDesign.models[key];
  if (modelRef !== LUNA) throw new Error(`unsupported merged ${key} route ${modelRef}`);
  return { modelRef, provider: 'codex', model: 'gpt-5.6-luna', effort: faceDesign.models.cliEffort };
}

export function tutorStubResistantLearnerMergedRouteTable(design) {
  if (design?.schema !== MERGED_SCHEMA) throw new Error('merged route table requires the merged v1 design');
  return ['faceA', 'faceB'].flatMap((faceId) => {
    const faceDesign = tutorStubResistantLearnerMergedFaceDesign(design, faceId);
    const study = faceId === 'faceA' ? 'B1' : 'R1';
    const rows = [
      routeRow({
        faceId,
        study,
        role: 'tutor',
        transportRole: 'tutor_stub_tutor',
        route: coreRoute(faceDesign, 'tutor'),
      }),
      routeRow({
        faceId,
        study,
        role: 'analysis',
        transportRole: 'tutor_stub_learner_analysis',
        route: coreRoute(faceDesign, 'analysis'),
      }),
      routeRow({
        faceId,
        study,
        role: 'learner',
        transportRole: 'tutor_stub_auto_learner',
        route: coreRoute(faceDesign, 'learner'),
      }),
    ];
    for (const judge of faceDesign.models.triggerObservation.judges) {
      rows.push(
        routeRow({
          faceId,
          study,
          role: `trigger.${judge.id}`,
          transportRole:
            study === 'B1'
              ? 'tutor_stub_resistant_learner_rival_attention_judge'
              : `tutor_stub_resistance_semantic_${judge.id}`,
          route: judge,
        }),
      );
    }
    for (const judge of faceDesign.models.finalSemanticReaders) {
      const instruments = faceDesign.measurement.readerPanel.fidelityJudges?.includes(judge.modelRef)
        ? ['primary', 'fidelity']
        : ['primary'];
      for (const instrument of instruments) {
        rows.push(
          routeRow({
            faceId,
            study,
            role: `final.${instrument}.${judge.id}`,
            transportRole: `tutor_stub_resistant_learner_${study}_${instrument}_${judge.id}`,
            route: judge,
          }),
        );
      }
    }
    const tutorDelivery = faceDesign.tutorDeliveryContract?.enforcement;
    if (tutorDelivery?.check?.kind === 'semantic_tutor_delivery_adjudication') {
      rows.push(
        routeRow({
          faceId,
          study,
          role: 'tutor.delivery_repair',
          transportRole: 'tutor_stub_tutor_delivery_repair',
          route: coreRoute(faceDesign, 'tutor'),
        }),
        routeRow({
          faceId,
          study,
          role: `tutor_delivery.${tutorDelivery.check.adjudicatorSeat.id}`,
          transportRole: `tutor_stub_tutor_delivery_${tutorDelivery.check.adjudicatorSeat.id}`,
          route: tutorDelivery.check.adjudicatorSeat,
        }),
      );
    }
    return rows;
  });
}

export async function runTutorStubResistantLearnerMergedPreflight({
  loaded,
  root,
  destination,
  destinationExists,
  probeRoute = probeTutorStubResistantLearnerCliRoute,
  smokeRole = smokeTutorStubResistantLearnerProtocolV2Role,
  powered = false,
  dialoguesPerFace = null,
} = {}) {
  if (loaded?.design?.schema !== MERGED_SCHEMA) throw new Error('merged preflight requires the merged v1 design');
  const plan = powered
    ? buildTutorStubResistantLearnerPoweredPlan(loaded.design, { dialoguesPerFace })
    : buildTutorStubResistantLearnerCalibrationPlan(loaded.design);
  const compilation = runTutorStubResistantLearnerCompilationPreflight({ loaded, root });
  const routeTable = tutorStubResistantLearnerMergedRouteTable(loaded.design);
  const uniqueRoutes = [...new Map(routeTable.map((route) => [`${route.modelRef}:${route.effort}`, route])).values()];
  const routeProbes = uniqueRoutes.map((route) => probeRoute(route));
  const roleSmokes = [];
  for (const route of routeTable) roleSmokes.push(await smokeRole(route));
  const plannedRoleCalls = powered
    ? plan.jobs.length * loaded.design.attemptCeilings.plannedCallsPerDialogue
    : loaded.design.attemptCeilings.plannedCallsCalibration;
  const hardAttemptCeiling = powered
    ? plan.jobs.length * loaded.design.attemptCeilings.maximumReservationsPerDialogue
    : loaded.design.attemptCeilings.calibrationMaximumReservations;
  const planShapeChecks = powered
    ? {
        powered_dialogues_within_registered_bounds:
          dialoguesPerFace >= loaded.design.poweredRun.minimumDialoguesPerFace &&
          dialoguesPerFace <= loaded.design.poweredRun.maximumDialoguesPerFace,
        powered_plan_job_count: plan.jobs.length === dialoguesPerFace * 2,
        both_faces_balanced:
          plan.jobs.filter((job) => job.face_id === 'faceA').length === dialoguesPerFace &&
          plan.jobs.filter((job) => job.face_id === 'faceB').length === dialoguesPerFace,
      }
    : {
        full_plan_36_jobs: plan.jobs.length === 36,
        both_faces_18_jobs:
          plan.jobs.filter((job) => job.face_id === 'faceA').length === 18 &&
          plan.jobs.filter((job) => job.face_id === 'faceB').length === 18,
      };
  const checks = {
    merged_design_v1: loaded.design.schema === MERGED_SCHEMA,
    ...planShapeChecks,
    compilation_passed: compilation.status === 'passed_zero_call',
    all_36_rival_dags_minted: compilation.rival_dag_count === 36,
    all_48_world_register_scenes_compiled: compilation.rows?.length === 48,
    route_probes_passed: routeProbes.every((probe) => probe.status === 'passed_zero_call'),
    role_smokes_passed: roleSmokes.every((smoke) => smoke.status === 'passed_zero_call_stub'),
    destination_absent: destinationExists(destination) === false,
    planned_calls_match_design:
      plannedRoleCalls === plan.jobs.length * loaded.design.attemptCeilings.plannedCallsPerDialogue,
    planned_calls_within_ceiling: plannedRoleCalls <= hardAttemptCeiling,
  };
  return {
    schema: powered
      ? 'machinespirits.tutor-stub.resistant-learner-merged-powered-launch-preflight.v1'
      : 'machinespirits.tutor-stub.resistant-learner-merged-launch-preflight.v1',
    status: Object.values(checks).every(Boolean) ? 'passed_zero_call' : 'failed',
    phase: powered ? 'powered' : 'calibration',
    ...(powered ? { dialogues_per_face: dialoguesPerFace } : {}),
    study_id: loaded.design.studyId,
    destination,
    design: { path: loaded.relativePath, sha256: loaded.sha256 },
    plan,
    compilation,
    route_table: routeTable,
    route_probes: routeProbes,
    role_smokes: roleSmokes,
    jobs: plan.jobs.length,
    planned_role_calls: plannedRoleCalls,
    hard_attempt_ceiling: hardAttemptCeiling,
    checks,
    model_calls_executed: 0,
    production_writes: 0,
  };
}

export function buildTutorStubResistantLearnerMergedApproval({
  signedBy,
  approvalPhrase,
  preflight,
  approvedAt = new Date().toISOString(),
} = {}) {
  const powered = preflight.phase === 'powered';
  const expectedPhrase = powered
    ? `APPROVE POWERED RUN ${preflight.hard_attempt_ceiling}`
    : `APPROVE CALIBRATION ${preflight.hard_attempt_ceiling}`;
  if (!String(signedBy || '').trim()) throw new Error('typed approval requires the operator name');
  if (approvalPhrase !== expectedPhrase) throw new Error(`typed approval must be exactly: ${expectedPhrase}`);
  return {
    approved_by: String(signedBy).trim(),
    approved_at: approvedAt,
    typed_phrase: approvalPhrase,
    scope: powered
      ? 'resistant-learner merged graded-engagement powered run'
      : 'resistant-learner merged graded-engagement calibration only',
    study_id: preflight.study_id,
    destination: preflight.destination,
    jobs: preflight.jobs,
    ...(powered ? { dialogues_per_face: preflight.dialogues_per_face } : {}),
    planned_role_calls: preflight.planned_role_calls,
    hard_attempt_ceiling: preflight.hard_attempt_ceiling,
    create_once: true,
    attended: true,
    calibration_only: !powered,
    powered_run_authorized: powered,
    ...(powered ? { powered_run_authorization: 'typed_operator_approval_attended_tty' } : {}),
  };
}

export default {
  buildTutorStubResistantLearnerMergedApproval,
  runTutorStubResistantLearnerMergedPreflight,
  tutorStubResistantLearnerMergedRouteTable,
};
