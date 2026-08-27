import {
  buildTutorStubResistantLearnerCalibrationPlan,
  runTutorStubResistantLearnerCompilationPreflight,
  TUTOR_STUB_FRAME_REFUSER_DEPTH_CURRENT_REVISION,
  TUTOR_STUB_FRAME_REFUSER_DEPTH_DESIGN_SCHEMA_V1,
  tutorStubFrameRefuserDepthArmDesign,
  tutorStubFrameRefuserDepthArtifactSchemaVersion,
} from './tutorStubResistantLearnerCalibration.js';
import {
  probeTutorStubResistantLearnerCliRoute,
  smokeTutorStubResistantLearnerProtocolV2Role,
} from './tutorStubResistantLearnerLaunchProtocolV2.js';

const LUNA = 'codex.gpt-5.6-luna';
const ARM_IDS = ['treatment', 'reference'];

function routeRow({ armId, role, transportRole, route }) {
  return {
    arm_id: armId,
    study: 'R1',
    role,
    transportRole,
    modelRef: route.modelRef,
    provider: route.provider,
    model: route.model,
    effort: route.effort,
  };
}

function coreRoute(armDesign, key) {
  const modelRef = armDesign.models[key];
  if (modelRef !== LUNA) throw new Error(`unsupported depth ${key} route ${modelRef}`);
  return { modelRef, provider: 'codex', model: 'gpt-5.6-luna', effort: armDesign.models.cliEffort };
}

export function tutorStubFrameRefuserDepthRouteTable(design, { root = process.cwd() } = {}) {
  if (design?.schema !== TUTOR_STUB_FRAME_REFUSER_DEPTH_DESIGN_SCHEMA_V1) {
    throw new Error('depth route table requires the frame-refuser depth v1 design');
  }
  return ARM_IDS.flatMap((armId) => {
    const armDesign = tutorStubFrameRefuserDepthArmDesign(design, armId, { root });
    const rows = [
      routeRow({ armId, role: 'tutor', transportRole: 'tutor_stub_tutor', route: coreRoute(armDesign, 'tutor') }),
      routeRow({
        armId,
        role: 'analysis',
        transportRole: 'tutor_stub_learner_analysis',
        route: coreRoute(armDesign, 'analysis'),
      }),
      routeRow({
        armId,
        role: 'learner',
        transportRole: 'tutor_stub_auto_learner',
        route: coreRoute(armDesign, 'learner'),
      }),
    ];
    for (const judge of armDesign.models.triggerObservation.judges) {
      rows.push(
        routeRow({
          armId,
          role: `trigger.${judge.id}`,
          transportRole: `tutor_stub_resistance_semantic_${judge.id}`,
          route: judge,
        }),
      );
    }
    for (const judge of armDesign.models.finalSemanticReaders) {
      const instruments = armDesign.measurement.readerPanel.fidelityJudges?.includes(judge.modelRef)
        ? ['primary', 'fidelity']
        : ['primary'];
      for (const instrument of instruments) {
        rows.push(
          routeRow({
            armId,
            role: `final.${instrument}.${judge.id}`,
            transportRole: `tutor_stub_resistant_learner_R1_${instrument}_${judge.id}`,
            route: judge,
          }),
        );
      }
    }
    const tutorDelivery = armDesign.tutorDeliveryContract?.enforcement;
    if (tutorDelivery?.check?.kind !== 'semantic_tutor_delivery_adjudication') {
      // Both depth arms carry a delivered-contrast floor, so an arm without a
      // live delivery adjudication seat is unmeasurable — refuse to route it.
      throw new Error(`depth arm ${armId} is missing its delivery adjudication seat`);
    }
    rows.push(
      routeRow({
        armId,
        role: 'tutor.delivery_repair',
        transportRole: 'tutor_stub_tutor_delivery_repair',
        route: coreRoute(armDesign, 'tutor'),
      }),
      routeRow({
        armId,
        role: `tutor_delivery.${tutorDelivery.check.adjudicatorSeat.id}`,
        transportRole: `tutor_stub_tutor_delivery_${tutorDelivery.check.adjudicatorSeat.id}`,
        route: tutorDelivery.check.adjudicatorSeat,
      }),
    );
    return rows;
  });
}

export async function runTutorStubFrameRefuserDepthPreflight({
  loaded,
  root,
  destination,
  destinationExists,
  probeRoute = probeTutorStubResistantLearnerCliRoute,
  smokeRole = smokeTutorStubResistantLearnerProtocolV2Role,
} = {}) {
  if (loaded?.design?.schema !== TUTOR_STUB_FRAME_REFUSER_DEPTH_DESIGN_SCHEMA_V1) {
    throw new Error('depth preflight requires the frame-refuser depth v1 design');
  }
  const design = loaded.design;
  const plan = buildTutorStubResistantLearnerCalibrationPlan(design);
  const compilation = runTutorStubResistantLearnerCompilationPreflight({ loaded, root });
  const routeTable = tutorStubFrameRefuserDepthRouteTable(design, { root });
  const uniqueRoutes = [...new Map(routeTable.map((route) => [`${route.modelRef}:${route.effort}`, route])).values()];
  const routeProbes = uniqueRoutes.map((route) => probeRoute(route));
  const roleSmokes = [];
  for (const route of routeTable) roleSmokes.push(await smokeRole(route));
  const armDesign = tutorStubFrameRefuserDepthArmDesign(design, 'treatment', { root });
  const plannedRoleCalls = design.attemptCeilings.plannedCallsCalibration;
  const hardAttemptCeiling = design.attemptCeilings.calibrationMaximumReservations;
  const dialogues = design.calibration.dialogues;
  const perArm = design.calibration.perArm;
  const perWorld = perArm / design.population.worlds.length;
  const checks = {
    depth_design_schema: design.schema === TUTOR_STUB_FRAME_REFUSER_DEPTH_DESIGN_SCHEMA_V1,
    // A superseded revision must not be runnable: revision 1 failed its own
    // Gate 1 on 2026-08-27 and rerunning it would be resampling after a
    // failure. This is a registration-identity check, not an approval gate.
    design_revision_current: design.revision === TUTOR_STUB_FRAME_REFUSER_DEPTH_CURRENT_REVISION,
    full_plan_job_count: plan.jobs.length === dialogues,
    both_arms_balanced: ARM_IDS.every((armId) => plan.jobs.filter((job) => job.arm_id === armId).length === perArm),
    worlds_balanced_per_arm: ARM_IDS.every((armId) =>
      design.population.worlds.every(
        (world) => plan.jobs.filter((job) => job.arm_id === armId && job.world === world).length === perWorld,
      ),
    ),
    // The sealed reader seat must echo each case id byte-exactly; mixed
    // separators defeated that echo in the failed revision-1 run.
    case_ids_underscore_only: plan.jobs.every((job) => /^[a-z0-9_]+$/u.test(job.id)),
    compilation_passed: compilation.status === 'passed_zero_call',
    all_rival_dags_minted: compilation.rival_dag_count === dialogues,
    all_8_arm_world_scene_rows_compiled: compilation.rows?.length === 8,
    route_probes_passed: routeProbes.every((probe) => probe.status === 'passed_zero_call'),
    role_smokes_passed: roleSmokes.every((smoke) => smoke.status === 'passed_zero_call_stub'),
    destination_absent: destinationExists(destination) === false,
    // The two sides of this product are independent registered constants: the
    // per-dialogue plan comes from the parent design, the calibration total
    // from the depth file.
    planned_calls_match_design:
      plannedRoleCalls === plan.jobs.length * armDesign.attemptCeilings.plannedCallsPerDialogue,
    planned_calls_within_ceiling: plannedRoleCalls <= hardAttemptCeiling,
  };
  return {
    schema: `machinespirits.tutor-stub.frame-refuser-depth-launch-preflight.${tutorStubFrameRefuserDepthArtifactSchemaVersion(design)}`,
    status: Object.values(checks).every(Boolean) ? 'passed_zero_call' : 'failed',
    phase: 'calibration',
    study_id: design.studyId,
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

export function buildTutorStubFrameRefuserDepthApproval({
  signedBy,
  approvalPhrase,
  preflight,
  approvedAt = new Date().toISOString(),
} = {}) {
  const expectedPhrase = `APPROVE CALIBRATION ${preflight.hard_attempt_ceiling}`;
  if (!String(signedBy || '').trim()) throw new Error('typed approval requires the operator name');
  if (approvalPhrase !== expectedPhrase) throw new Error(`typed approval must be exactly: ${expectedPhrase}`);
  return {
    approved_by: String(signedBy).trim(),
    approved_at: approvedAt,
    typed_phrase: approvalPhrase,
    scope: 'frame-refuser depth condition-discharge calibration only',
    study_id: preflight.study_id,
    destination: preflight.destination,
    jobs: preflight.jobs,
    planned_role_calls: preflight.planned_role_calls,
    hard_attempt_ceiling: preflight.hard_attempt_ceiling,
    create_once: true,
    attended: true,
    calibration_only: true,
    powered_run_authorized: false,
  };
}

export default {
  buildTutorStubFrameRefuserDepthApproval,
  runTutorStubFrameRefuserDepthPreflight,
  tutorStubFrameRefuserDepthRouteTable,
};
