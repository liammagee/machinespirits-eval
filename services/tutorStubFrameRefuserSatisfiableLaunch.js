import {
  TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_DESIGN_SCHEMA_V1,
  buildTutorStubResistantLearnerCalibrationPlan,
  runTutorStubFrameRefuserSatisfiablePlanPreflight,
  runTutorStubResistantLearnerCompilationPreflight,
  tutorStubFrameRefuserSatisfiableArmDesign,
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
    // The runtime study code, not the mint's: this study shares the
    // standing-rivalry runtime path. Its jobs carry study R2, which selects
    // the exhibit mint and nothing else.
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
  if (modelRef !== LUNA) throw new Error(`unsupported satisfiable ${key} route ${modelRef}`);
  return { modelRef, provider: 'codex', model: 'gpt-5.6-luna', effort: armDesign.models.cliEffort };
}

export function tutorStubFrameRefuserSatisfiableRouteTable(design, { root = process.cwd() } = {}) {
  if (design?.schema !== TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_DESIGN_SCHEMA_V1) {
    throw new Error('satisfiable route table requires the frame-refuser satisfiable design');
  }
  return ARM_IDS.flatMap((armId) => {
    const armDesign = tutorStubFrameRefuserSatisfiableArmDesign(design, armId, { root });
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
    const delivery = armDesign.tutorDeliveryContract?.enforcement;
    if (delivery?.check?.kind !== 'semantic_tutor_delivery_adjudication') {
      // Both arms carry a delivered-contrast floor, so an arm without a live
      // delivery adjudication seat is unmeasurable — refuse to route it.
      throw new Error(`satisfiable arm ${armId} is missing its delivery adjudication seat`);
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
        role: `tutor_delivery.${delivery.check.adjudicatorSeat.id}`,
        transportRole: `tutor_stub_tutor_delivery_${delivery.check.adjudicatorSeat.id}`,
        route: delivery.check.adjudicatorSeat,
      }),
    );
    return rows;
  });
}

export async function runTutorStubFrameRefuserSatisfiablePreflight({
  loaded,
  root,
  destination,
  destinationExists,
  probeRoute = probeTutorStubResistantLearnerCliRoute,
  smokeRole = smokeTutorStubResistantLearnerProtocolV2Role,
} = {}) {
  if (loaded?.design?.schema !== TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_DESIGN_SCHEMA_V1) {
    throw new Error('satisfiable preflight requires the frame-refuser satisfiable design');
  }
  const design = loaded.design;
  const plan = buildTutorStubResistantLearnerCalibrationPlan(design, { root });
  const planPreflight = runTutorStubFrameRefuserSatisfiablePlanPreflight({ loaded, root });
  const compilation = runTutorStubResistantLearnerCompilationPreflight({ loaded, root });
  const routeTable = tutorStubFrameRefuserSatisfiableRouteTable(design, { root });
  const uniqueRoutes = [...new Map(routeTable.map((route) => [`${route.modelRef}:${route.effort}`, route])).values()];
  const routeProbes = uniqueRoutes.map((route) => probeRoute(route));
  const roleSmokes = [];
  for (const route of routeTable) roleSmokes.push(await smokeRole(route));
  const armDesign = tutorStubFrameRefuserSatisfiableArmDesign(design, 'treatment', { root });
  const plannedRoleCalls = design.attemptCeilings.plannedCallsCalibration;
  const hardAttemptCeiling = design.attemptCeilings.calibrationMaximumReservations;
  const perWorld = design.calibration.perArm / design.population.worlds.length;

  const checks = {
    satisfiable_design_schema: design.schema === TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_DESIGN_SCHEMA_V1,
    // No revision check here on purpose. The design validator accepts only the
    // current revision, so a superseded one cannot load at all — revision 1,
    // whose treatment move could not be delivered, never reaches this point. A
    // check here could only ever recompute its own expectation.
    full_plan_job_count: plan.jobs.length === design.calibration.dialogues,
    both_arms_balanced: ARM_IDS.every(
      (armId) => plan.jobs.filter((job) => job.arm_id === armId).length === design.calibration.perArm,
    ),
    worlds_balanced_per_arm: ARM_IDS.every((armId) =>
      design.population.worlds.every(
        (world) => plan.jobs.filter((job) => job.arm_id === armId && job.world === world).length === perWorld,
      ),
    ),
    // The sealed reader seat echoes each case id byte-exactly; mixed
    // separators defeated that echo in an archived depth run.
    case_ids_underscore_only: plan.jobs.every((job) => /^[a-z0-9_]+$/u.test(job.id)),
    plan_preflight_passed: planPreflight.status === 'passed_zero_call',
    compilation_passed: compilation.status === 'passed_zero_call',
    all_rival_dags_minted: compilation.rival_dag_count === design.calibration.dialogues,
    all_8_arm_world_scene_rows_compiled: compilation.rows?.length === 8,
    route_probes_passed: routeProbes.every((probe) => probe.status === 'passed_zero_call'),
    role_smokes_passed: roleSmokes.every((smoke) => smoke.status === 'passed_zero_call_stub'),
    destination_absent: destinationExists(destination) === false,
    // Two independent registered constants: the per-dialogue plan comes from
    // the sealed parent, the calibration total from this design file.
    planned_calls_match_design:
      plannedRoleCalls === plan.jobs.length * armDesign.attemptCeilings.plannedCallsPerDialogue,
    planned_calls_within_ceiling: plannedRoleCalls <= hardAttemptCeiling,
    grants_no_model_calls: design.callAuthority.grantsModelCalls === false,
  };

  return {
    schema: 'machinespirits.tutor-stub.frame-refuser-satisfiable-launch-preflight.v1',
    status: Object.values(checks).every(Boolean) ? 'passed_zero_call' : 'failed',
    phase: 'calibration',
    study_id: design.studyId,
    destination,
    design: { path: loaded.relativePath ?? null, sha256: loaded.sha256 ?? null },
    plan,
    plan_preflight: planPreflight,
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

export default {
  runTutorStubFrameRefuserSatisfiablePreflight,
  tutorStubFrameRefuserSatisfiableRouteTable,
};
