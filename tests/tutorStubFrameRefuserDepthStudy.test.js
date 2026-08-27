import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubResistantLearnerCalibrationPlan,
  loadTutorStubResistantLearnerDesign,
  runTutorStubResistantLearnerCompilationPreflight,
  summarizeTutorStubResistantLearnerCalibration,
  tutorStubFrameRefuserDepthArmDesign,
  validateTutorStubResistantLearnerDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import {
  buildTutorStubFrameRefuserDepthApproval,
  runTutorStubFrameRefuserDepthPreflight,
  tutorStubFrameRefuserDepthRouteTable,
} from '../services/tutorStubFrameRefuserDepthLaunch.js';
import {
  executeTutorStubFrameRefuserDepthCalibration,
  main as depthLauncherMain,
  TUTOR_STUB_FRAME_REFUSER_DEPTH_USAGE,
} from '../scripts/run-tutor-stub-frame-refuser-depth-calibration.js';
import {
  TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS,
  tutorStubRegisteredStudyOutcomeFromError,
} from '../services/tutorStubRegisteredStudyOutcome.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_PATH = 'config/tutor-stub-frame-refuser-depth-design.v4.json';
const V1_DESIGN_PATH = 'config/tutor-stub-frame-refuser-depth-design.v1.json';
const V2_DESIGN_PATH = 'config/tutor-stub-frame-refuser-depth-design.v2.json';
const V3_DESIGN_PATH = 'config/tutor-stub-frame-refuser-depth-design.v3.json';

function loadDesign() {
  return loadTutorStubResistantLearnerDesign({ designPath: DESIGN_PATH, root: ROOT });
}

function designCopy() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, DESIGN_PATH), 'utf8'));
}

test('depth design file validates and every registered constant fails closed', () => {
  const design = designCopy();
  assert.equal(validateTutorStubResistantLearnerDesign(design).valid, true);
  const mutations = [
    (d) => (d.studyId = 'frame-refuser-depth-2'),
    (d) => (d.randomization.masterSeed = 2026082702),
    (d) => (d.randomization.caseIdRule = 'hyphen_allowed'),
    (d) => (d.attemptCeilings.plannedCallsCalibration = 2305),
    (d) => (d.attemptCeilings.calibrationMaximumReservations = 7129),
    (d) => (d.calibration.perArm = 10),
    (d) => d.calibration.authoritativeGates.pop(),
    (d) => (d.arms.treatment.hostActionFamily = 'clarify_distinction'),
    (d) => (d.arms.reference.actionInstruction = 'a new instruction'),
    (d) => (d.arms.distinctDeliveredBehaviourFloors.minimumTreatmentDeliveryRate = 0.7),
    (d) => (d.arms.distinctDeliveredBehaviourFloors.maximumTreatmentBridgeReadRate = 0.2),
    (d) => (d.tutorDeliveryEnforcement.perArmAdjudication.adjudicatorSeat.model = 'gpt-5.6-luna'),
    (d) => (d.tutorDeliveryEnforcement.repairsAllowedPerEpisode = 2),
    (d) => (d.population.worlds = ['world_005_marrick']),
    (d) => (d.models.tutor = 'openrouter.nemotron'),
    (d) => (d.callAuthority.grantsModelCalls = true),
    (d) => (d.lineage.measuredReferenceRung2Rate = 0.2),
    (d) => (d.lineage.firstCalibration.rowsReused = true),
  ];
  for (const mutate of mutations) {
    const mutated = designCopy();
    mutate(mutated);
    assert.equal(validateTutorStubResistantLearnerDesign(mutated).valid, false);
  }
});

test('arm projections carry the registered per-arm contracts on sealed face-B machinery', () => {
  const design = loadDesign().design;
  const treatment = tutorStubFrameRefuserDepthArmDesign(design, 'treatment', { root: ROOT });
  const reference = tutorStubFrameRefuserDepthArmDesign(design, 'reference', { root: ROOT });
  assert.equal(treatment.depthExecution.move, 'condition_discharge');
  assert.equal(treatment.depthExecution.hostActionFamily, 'reanchor_public_evidence');
  assert.equal(reference.depthExecution.move, 'test_bounded_distinction');
  assert.equal(reference.depthExecution.hostActionFamily, 'clarify_distinction');
  assert.equal(
    treatment.tutorDeliveryContract.actionInstructions.condition_discharge,
    design.arms.treatment.actionInstruction,
  );
  assert.equal(
    treatment.tutorDeliveryContract.enforcement.check.question,
    design.tutorDeliveryEnforcement.perArmAdjudication.treatmentQuestion,
  );
  assert.equal(
    reference.tutorDeliveryContract.enforcement.check.question,
    design.tutorDeliveryEnforcement.perArmAdjudication.referenceQuestion,
  );
  assert.equal(
    treatment.tutorDeliveryContract.enforcement.exhaustionCode,
    'tutor_stub_tutor_condition_discharge_non_delivery',
  );
  for (const arm of [treatment, reference]) {
    assert.equal(arm.tutorDeliveryContract.enforcement.check.kind, 'semantic_tutor_delivery_adjudication');
    assert.equal(arm.tutorDeliveryContract.enforcement.check.adjudicatorSeat.modelRef, 'codex.gpt-5.6-sol');
    assert.equal(arm.tutorDeliveryContract.enforcement.repairsAllowedPerEpisode, 1);
    assert.match(arm.tutorDeliveryContract.registerInstructions.plain, /concise neutral/iu);
    assert.equal(arm.models.finalSemanticReaders.length, 3);
    assert.equal(arm.calibration.dialogues, 24);
    assert.equal(arm.calibration.minimumTreatmentDeliveryRate, 0.8);
    assert.equal(arm.calibration.maximumTreatmentBridgeReadRate, 0.1);
    assert.equal(arm.calibration.maximumReferenceContaminationRate, undefined);
    assert.equal(arm.calibration.minimumPairwiseExactEndpointAgreement, 0.8);
    assert.equal(arm.randomization.masterSeed, 2026082901);
    assert.equal(arm.attemptCeilings.plannedCallsPerDialogue, 64);
    assert.equal(arm.attemptCeilings.maximumReservationsPerDialogue, 198);
  }
  assert.throws(() => tutorStubFrameRefuserDepthArmDesign(design, 'placebo', { root: ROOT }));
});

test('calibration plan is 48 jobs balanced twelve per arm-world with stable deterministic ranks', () => {
  const design = loadDesign().design;
  const plan = buildTutorStubResistantLearnerCalibrationPlan(design);
  assert.equal(plan.schema, 'machinespirits.tutor-stub.frame-refuser-depth-calibration-plan.v4');
  assert.equal(plan.jobs.length, 48);
  for (const armId of ['treatment', 'reference']) {
    for (const world of design.population.worlds) {
      assert.equal(plan.jobs.filter((job) => job.arm_id === armId && job.world === world).length, 12);
    }
  }
  for (const job of plan.jobs) {
    // Underscore-only ids: the sealed reader seat merged a hyphen-underscore
    // boundary when echoing revision-1 case ids, voiding its votes.
    assert.match(job.id, /^depth_(treatment|reference)_cal4_[a-z0-9_]+_r\d+$/u);
    assert.equal(job.register, 'plain');
    assert.match(job.batch_id, /^batch_\d{2}$/);
    assert.equal(typeof job.assignment_manifest_sha256, 'string');
  }
  assert.deepEqual(buildTutorStubResistantLearnerCalibrationPlan(design), plan);
});

test('compilation preflight passes zero-call and pins the due-clue question precedence per scene', () => {
  const loaded = loadDesign();
  const preflight = runTutorStubResistantLearnerCompilationPreflight({ loaded, root: ROOT });
  assert.equal(preflight.status, 'passed_zero_call');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.rows.length, 8);
  assert.equal(preflight.rival_dag_count, 48);
  assert.equal(preflight.attempt_ceiling_closure.passed, true);
  for (const row of preflight.rows) {
    assert.equal(row.passed, true, `${row.arm_id}/${row.world}/${row.scene}: ${row.issues.join('|')}`);
    if (row.arm_id === 'treatment') {
      assert.equal(row.question_allowed, row.scene === 'due_clue');
    } else {
      assert.equal(row.question_allowed, true);
    }
  }
});

test('compilation preflight fails closed when the host default drifts from the registration', () => {
  const loaded = loadDesign();
  // Mutating the loaded copy after validation simulates the host map and the
  // registration disagreeing about the treatment instruction bytes.
  loaded.design = JSON.parse(JSON.stringify(loaded.design));
  loaded.design.arms.treatment.actionInstruction = `${loaded.design.arms.treatment.actionInstruction} Extra sentence.`;
  const preflight = runTutorStubResistantLearnerCompilationPreflight({ loaded, root: ROOT });
  assert.equal(preflight.status, 'failed');
  const treatmentIssues = preflight.rows.filter((row) => row.arm_id === 'treatment').flatMap((row) => row.issues);
  assert.ok(treatmentIssues.includes('host_default_instruction_drifted_from_registration'));
});

test('launch preflight covers both arm delivery roles, probes zero-call, and writes nothing', async () => {
  const loaded = loadDesign();
  loaded.relativePath = DESIGN_PATH;
  const destination = path.join(os.tmpdir(), `frame-refuser-depth-preflight-absent-${process.pid}`);
  const roles = [];
  const preflight = await runTutorStubFrameRefuserDepthPreflight({
    loaded,
    root: ROOT,
    destination,
    destinationExists: () => false,
    probeRoute: (route) => ({ ...route, status: 'passed_zero_call', model_calls: 0 }),
    smokeRole: async (route) => {
      roles.push(`${route.arm_id}:${route.transportRole}`);
      return { ...route, status: 'passed_zero_call_stub', provider_model_calls: 0 };
    },
  });
  assert.equal(preflight.status, 'passed_zero_call');
  assert.equal(preflight.model_calls_executed, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.planned_role_calls, 3072);
  assert.equal(preflight.hard_attempt_ceiling, 9504);
  assert.equal(preflight.schema, 'machinespirits.tutor-stub.frame-refuser-depth-launch-preflight.v4');
  assert.equal(preflight.checks.design_revision_current, true);
  assert.equal(preflight.checks.case_ids_underscore_only, true);
  assert.equal(fs.existsSync(destination), false);
  for (const armId of ['treatment', 'reference']) {
    assert.ok(roles.includes(`${armId}:tutor_stub_tutor_delivery_repair`));
    assert.ok(roles.includes(`${armId}:tutor_stub_tutor_delivery_tutor_delivery_adjudicator`));
    assert.ok(roles.includes(`${armId}:tutor_stub_resistant_learner_R1_primary_reader_c`));
    assert.ok(!roles.includes(`${armId}:tutor_stub_resistant_learner_R1_fidelity_reader_c`));
  }
});

test('route table refuses a non-Luna core route and requires the delivery seat', () => {
  const design = JSON.parse(JSON.stringify(loadDesign().design));
  design.models = { ...design.models };
  assert.equal(tutorStubFrameRefuserDepthRouteTable(loadDesign().design, { root: ROOT }).length, 24);
  assert.throws(() => tutorStubFrameRefuserDepthRouteTable({ schema: 'other' }, { root: ROOT }));
});

function syntheticDepthRows(design) {
  const treatmentDesign = tutorStubFrameRefuserDepthArmDesign(design, 'treatment', { root: ROOT });
  const readers = treatmentDesign.models.finalSemanticReaders;
  const fidelityReaders = readers.filter((reader) =>
    treatmentDesign.measurement.readerPanel.fidelityJudges.includes(reader.modelRef),
  );
  return buildTutorStubResistantLearnerCalibrationPlan(design).jobs.map((job) => {
    const treatmentArm = job.arm_id === 'treatment';
    const primaryValues = {
      final_graded_engagement_rung: treatmentArm ? '2' : '1',
      final_jurisdictional_dispute_retained: 'yes',
      whole_frame_compliance: 'no',
    };
    const fidelityValues = {
      delivered_test_bounded_distinction: treatmentArm ? 'no' : 'yes',
      delivered_register: 'plain',
      prohibited_delivery: 'no',
    };
    const makePanel = (instrument, values) => ({
      status: 'determinate',
      fields: Object.fromEntries(
        Object.entries(values).map(([field, value]) => [
          field,
          {
            status: 'determinate',
            value,
            eligible_judges: (instrument === 'primary' ? readers : fidelityReaders).map((reader) => reader.id),
          },
        ]),
      ),
      seats: (instrument === 'primary' ? readers : fidelityReaders).map((reader) => ({
        judge_id: reader.id,
        validation: {
          fields: Object.fromEntries(
            Object.entries(values).map(([field, value]) => [field, { eligible: true, value }]),
          ),
        },
      })),
    });
    return {
      job,
      status: 'complete',
      delivery: [{ turn: 3, delivered: true, repairAttempts: 0 }],
      outcome: {
        primary: makePanel('primary', primaryValues),
        fidelity: makePanel('fidelity', fidelityValues),
      },
    };
  });
}

test('depth summarizer passes on clean synthetic rows and reports the sizing update', () => {
  const design = loadDesign().design;
  const rows = syntheticDepthRows(design);
  const report = summarizeTutorStubResistantLearnerCalibration({ rows, design, root: ROOT });
  assert.equal(report.schema, 'machinespirits.tutor-stub.frame-refuser-depth-calibration-report.v4');
  assert.equal(report.status, 'passed');
  assert.equal(report.calibration_only, true);
  assert.equal(report.powered_run_authorized, false);
  assert.equal(report.calibration_rows_poolable_into_powered_run, false);
  const treatment = report.arms.find((arm) => arm.arm_id === 'treatment');
  const reference = report.arms.find((arm) => arm.arm_id === 'reference');
  assert.equal(treatment.gates.treatment_delivery_rate, true);
  assert.equal(treatment.gates.treatment_any_adjudicated_delivery, true);
  assert.equal(treatment.gates.treatment_bridge_read_bound, true);
  // Revision 2 registers no reference-side contamination gate; cleanliness is
  // certified per completed row by the delivery adjudication and reported.
  assert.equal('reference_contamination_bound' in reference.gates, false);
  assert.equal(reference.statistics.completed_delivery_certified, 24);
  assert.equal(treatment.statistics.completed_delivery_certified, 24);
  assert.equal(treatment.statistics.rung_2_rate, 1);
  assert.equal(reference.statistics.rung_2_rate, 0);
  assert.equal(reference.statistics.delivered_test_bounded_distinction_report_only, 24);
  assert.equal(report.sizing_update.reference_rung_2, 0);
  assert.equal(report.sizing_update.reference_determinate, 24);
  assert.match(report.sizing_update.purpose, /not an interim outcome analysis/u);
});

test('depth delivered-contrast floors fail closed on delivery loss and contamination', () => {
  const design = loadDesign().design;
  const shortDelivery = syntheticDepthRows(design);
  let flipped = 0;
  // 24 adjudicated at the 0.8 floor needs 20 delivered; five losses breach it.
  for (const row of shortDelivery) {
    if (row.job.arm_id === 'treatment' && flipped < 5) {
      row.delivery = [{ turn: 3, delivered: false, repairAttempts: 1 }];
      flipped += 1;
    }
  }
  const shortReport = summarizeTutorStubResistantLearnerCalibration({ rows: shortDelivery, design, root: ROOT });
  assert.equal(shortReport.status, 'failed');
  assert.equal(shortReport.arms.find((arm) => arm.arm_id === 'treatment').gates.treatment_delivery_rate, false);

  // Bridge-read bound: three completed treatment rows read by the blind panel
  // as the sealed bridge move (3 > 24 * 0.1) must fail the arm-separation gate.
  const converged = syntheticDepthRows(design);
  flipped = 0;
  for (const row of converged) {
    if (row.job.arm_id === 'treatment' && flipped < 3) {
      row.outcome.fidelity.fields.delivered_test_bounded_distinction.value = 'yes';
      flipped += 1;
    }
  }
  const convergedReport = summarizeTutorStubResistantLearnerCalibration({ rows: converged, design, root: ROOT });
  assert.equal(convergedReport.status, 'failed');
  assert.equal(convergedReport.arms.find((arm) => arm.arm_id === 'treatment').gates.treatment_bridge_read_bound, false);

  const unadjudicated = syntheticDepthRows(design);
  for (const row of unadjudicated) {
    if (row.job.arm_id === 'treatment') row.delivery = [];
  }
  const killReport = summarizeTutorStubResistantLearnerCalibration({ rows: unadjudicated, design, root: ROOT });
  assert.equal(killReport.status, 'failed');
  assert.equal(
    killReport.arms.find((arm) => arm.arm_id === 'treatment').gates.treatment_any_adjudicated_delivery,
    false,
  );
});

test('typed approval accepts only the exact registered phrase and the usage rejects ceremony', () => {
  const preflight = {
    phase: 'calibration',
    study_id: 'frame-refuser-depth',
    destination: '/x',
    jobs: 48,
    planned_role_calls: 3072,
    hard_attempt_ceiling: 9504,
  };
  const approval = buildTutorStubFrameRefuserDepthApproval({
    signedBy: 'operator',
    approvalPhrase: 'APPROVE CALIBRATION 9504',
    preflight,
  });
  assert.equal(approval.calibration_only, true);
  assert.equal(approval.powered_run_authorized, false);
  assert.equal(approval.attended, true);
  assert.throws(() =>
    buildTutorStubFrameRefuserDepthApproval({
      signedBy: 'operator',
      approvalPhrase: 'APPROVE CALIBRATION 3960',
      preflight,
    }),
  );
  assert.throws(() =>
    buildTutorStubFrameRefuserDepthApproval({ signedBy: '', approvalPhrase: 'APPROVE CALIBRATION 9504', preflight }),
  );
  assert.match(
    TUTOR_STUB_FRAME_REFUSER_DEPTH_USAGE,
    /No GO note, commit binding, source-file byte pin, approval schema version, or re-signature cycle is used\.$/u,
  );
});

test('launcher main records the typed approval and hands execute the sealed preflight', async () => {
  const captured = {};
  const report = await depthLauncherMain(
    ['--design', DESIGN_PATH, '--destination', '/absolute/depth-root', '--launch', '--parallelism', '2'],
    {
      runPreflight: async ({ loaded, destination }) => ({
        status: 'passed_zero_call',
        phase: 'calibration',
        study_id: loaded.design.studyId,
        destination,
        jobs: 48,
        planned_role_calls: 3072,
        hard_attempt_ceiling: 9504,
        plan: { jobs: [] },
      }),
      destinationExists: () => false,
      isTTY: true,
      operatorApproval: async () => ({
        signedBy: 'operator',
        approvalPhrase: 'APPROVE CALIBRATION 9504',
        method: 'attended_interactive_phrase',
      }),
      sourceProvenance: () => ({ commit: 'c', tree: 't', dirty: false, enforcement: 'recorded_not_pinned' }),
      execute: async (input) => {
        Object.assign(captured, input);
        return { status: 'passed' };
      },
    },
  );
  assert.equal(report.status, 'passed');
  assert.equal(captured.approval.typed_phrase, 'APPROVE CALIBRATION 9504');
  assert.equal(captured.approval.method, 'attended_interactive_phrase');
  assert.equal(captured.parallelism, 2);
  assert.equal(captured.provenance.enforcement, 'recorded_not_pinned');
  await assert.rejects(
    depthLauncherMain(['--design', DESIGN_PATH, '--destination', '/absolute/depth-root'], {}),
    /exactly one of --dry-run, --launch, or --resume/u,
  );
  await assert.rejects(
    depthLauncherMain(['--design', DESIGN_PATH, '--destination', '/absolute/depth-root', '--launch'], {
      runPreflight: async () => ({ status: 'passed_zero_call', hard_attempt_ceiling: 9504, plan: { jobs: [] } }),
      isTTY: false,
    }),
    /attended TTY/u,
  );
});

test('revision 1 stays valid as provenance but the launch preflight refuses to run it', async () => {
  const loadedV1 = loadTutorStubResistantLearnerDesign({ designPath: V1_DESIGN_PATH, root: ROOT });
  assert.equal(validateTutorStubResistantLearnerDesign(loadedV1.design).valid, true);
  assert.equal(loadedV1.design.revision, 1);
  loadedV1.relativePath = V1_DESIGN_PATH;
  const preflight = await runTutorStubFrameRefuserDepthPreflight({
    loaded: loadedV1,
    root: ROOT,
    destination: path.join(os.tmpdir(), `frame-refuser-depth-v1-refused-${process.pid}`),
    destinationExists: () => false,
    probeRoute: (route) => ({ ...route, status: 'passed_zero_call', model_calls: 0 }),
    smokeRole: async (route) => ({ ...route, status: 'passed_zero_call_stub', provider_model_calls: 0 }),
  });
  assert.equal(preflight.status, 'failed');
  assert.equal(preflight.checks.design_revision_current, false);
  // Revision 1's hyphenated ids are also refused on their own terms.
  assert.equal(preflight.checks.case_ids_underscore_only, false);
  assert.equal(preflight.schema, 'machinespirits.tutor-stub.frame-refuser-depth-launch-preflight.v1');
  assert.equal(preflight.model_calls_executed, 0);
});

test('revision 2 stays valid as provenance but the launch preflight refuses to run it', async () => {
  const loadedV2 = loadTutorStubResistantLearnerDesign({ designPath: V2_DESIGN_PATH, root: ROOT });
  assert.equal(validateTutorStubResistantLearnerDesign(loadedV2.design).valid, true);
  assert.equal(loadedV2.design.revision, 2);
  loadedV2.relativePath = V2_DESIGN_PATH;
  const preflight = await runTutorStubFrameRefuserDepthPreflight({
    loaded: loadedV2,
    root: ROOT,
    destination: path.join(os.tmpdir(), `frame-refuser-depth-v2-refused-${process.pid}`),
    destinationExists: () => false,
    probeRoute: (route) => ({ ...route, status: 'passed_zero_call', model_calls: 0 }),
    smokeRole: async (route) => ({ ...route, status: 'passed_zero_call_stub', provider_model_calls: 0 }),
  });
  assert.equal(preflight.status, 'failed');
  assert.equal(preflight.checks.design_revision_current, false);
  // Revision 2's underscore ids are fine on their own terms; only currency fails.
  assert.equal(preflight.checks.case_ids_underscore_only, true);
  assert.equal(preflight.schema, 'machinespirits.tutor-stub.frame-refuser-depth-launch-preflight.v2');
  assert.equal(preflight.model_calls_executed, 0);
});

test('revision 3 stays valid as provenance but the launch preflight refuses to run it', async () => {
  const loadedV3 = loadTutorStubResistantLearnerDesign({ designPath: V3_DESIGN_PATH, root: ROOT });
  assert.equal(validateTutorStubResistantLearnerDesign(loadedV3.design).valid, true);
  assert.equal(loadedV3.design.revision, 3);
  loadedV3.relativePath = V3_DESIGN_PATH;
  const preflight = await runTutorStubFrameRefuserDepthPreflight({
    loaded: loadedV3,
    root: ROOT,
    destination: path.join(os.tmpdir(), `frame-refuser-depth-v3-refused-${process.pid}`),
    destinationExists: () => false,
    probeRoute: (route) => ({ ...route, status: 'passed_zero_call', model_calls: 0 }),
    smokeRole: async (route) => ({ ...route, status: 'passed_zero_call_stub', provider_model_calls: 0 }),
  });
  assert.equal(preflight.status, 'failed');
  assert.equal(preflight.checks.design_revision_current, false);
  // Revision 3's quote-echo trap lives in its instruction text, not its ids;
  // only currency fails here.
  assert.equal(preflight.checks.case_ids_underscore_only, true);
  assert.equal(preflight.schema, 'machinespirits.tutor-stub.frame-refuser-depth-launch-preflight.v3');
  assert.equal(preflight.model_calls_executed, 0);
});

test('the treatment condition-discharge exhaustion is a retained typed failure, not technical', () => {
  const outcome = tutorStubRegisteredStudyOutcomeFromError({
    error: { code: 'tutor_stub_tutor_condition_discharge_non_delivery', substantiveStudyFailure: true },
    jobId: 'depth_treatment_cal4_world_030_rowan_flat_r1',
  });
  assert.equal(outcome.status, TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS);
  assert.equal(outcome.code, 'tutor_stub_tutor_condition_discharge_non_delivery');
  assert.equal(outcome.replacement_allowed, false);
  // The reference arm's exhaustion code was already retained; the two arms'
  // typed non-deliveries must cross the child boundary the same way.
  assert.ok(
    tutorStubRegisteredStudyOutcomeFromError({
      error: { code: 'tutor_stub_tutor_bounded_test_non_delivery', substantiveStudyFailure: true },
      jobId: 'depth_reference_cal4_world_005_marrick_r1',
    }),
  );
});

function depthResumeHarness() {
  const loaded = loadDesign();
  loaded.relativePath = DESIGN_PATH;
  const design = loaded.design;
  const plan = buildTutorStubResistantLearnerCalibrationPlan(design);
  const destination = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'depth-resume-')), 'run-root');
  const spawned = [];
  return {
    loaded,
    design,
    plan,
    destination,
    spawned,
    fullRows: new Map(syntheticDepthRows(design).map((row) => [row.job.id, { ...row, attempts: 8 }])),
    base: {
      loaded,
      destination,
      parallelism: 1,
      preflight: { plan, hard_attempt_ceiling: design.attemptCeilings.calibrationMaximumReservations },
      approval: {
        approved_by: 'operator',
        typed_phrase: 'APPROVE CALIBRATION 9504',
        method: 'attended_interactive_phrase',
      },
      provenance: { commit: 'commit', tree: 'tree', dirty: false },
      childSpec: ({ job, destination: dest }) => {
        spawned.push(job.id);
        const jobRoot = path.join(dest, 'jobs', job.id);
        fs.mkdirSync(jobRoot, { recursive: true });
        return { jobRoot, job_id: job.id };
      },
      runChild: async () => ({ code: 0, signal: null, spawn_error: null }),
    },
  };
}

test('resume keeps recorded outcomes, re-types the mislabeled exhaustion, and runs only pending jobs', async () => {
  const harness = depthResumeHarness();
  const { plan, destination, spawned, fullRows, base } = harness;
  // Index 7 is a treatment job with both arms recorded before it, mirroring
  // the halted live run: paid completes, then the mislabeled exhaustion.
  const mislabeledJob = plan.jobs[7];
  assert.equal(mislabeledJob.arm_id, 'treatment');
  const mislabeledRow = {
    job: mislabeledJob,
    status: 'failed',
    attempts: 9,
    delivery: [{ turn: 1, delivered: false, repairAttempts: 1 }],
    outcome: null,
  };
  const extractRow = ({ job }) => (job.id === mislabeledJob.id ? mislabeledRow : fullRows.get(job.id));

  const halted = await executeTutorStubFrameRefuserDepthCalibration({ ...base, extractRow });
  assert.equal(halted.status, 'failed');
  assert.equal(halted.halt_reason, `technical failure in ${mislabeledJob.id}`);
  assert.equal(halted.execution.complete_units, 7);
  assert.equal(halted.execution.failed_units, 1);
  assert.equal(halted.execution.missing_units, 40);
  const recordedIds = plan.jobs.slice(0, 8).map((job) => job.id);
  assert.deepEqual(spawned, recordedIds);

  spawned.length = 0;
  const resumed = await executeTutorStubFrameRefuserDepthCalibration({
    ...base,
    parallelism: 2,
    extractRow,
    resume: true,
  });
  // No recorded dialogue re-ran: the six paid job ids never respawned.
  assert.equal(spawned.length, 40);
  assert.deepEqual(
    spawned.filter((id) => recordedIds.includes(id)),
    [],
  );
  assert.equal(resumed.status, 'passed');
  assert.equal(resumed.execution.complete_units, 47);
  assert.equal(resumed.execution.retained_substantive_units, 1);
  assert.equal(resumed.execution.failed_units, 0);
  assert.equal(resumed.execution.missing_units, 0);
  assert.equal(resumed.execution.model_attempts, 7 * 8 + 9 + 40 * 8);
  const retyped = resumed.rows.find((row) => row.job.id === mislabeledJob.id);
  assert.equal(retyped.status, TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS);
  assert.equal(retyped.registered_failure.code, 'tutor_stub_tutor_condition_discharge_non_delivery');
  assert.equal(retyped.registered_failure.retyped_on_resume, true);
  const treatment = resumed.arms.find((arm) => arm.arm_id === 'treatment');
  assert.equal(treatment.gates.execution_and_typed_failure_accounting, true);
  assert.equal(treatment.statistics.retained_typed_failures, 1);
  assert.equal(fs.existsSync(path.join(destination, 'report.halted-1.json')), true);
  const ledger = fs
    .readFileSync(path.join(destination, 'run-ledger.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const resumeEntry = ledger.find((entry) => entry.type === 'resume');
  assert.equal(resumeEntry.recorded_units, 8);
  assert.equal(resumeEntry.pending_units, 40);
  assert.deepEqual(resumeEntry.retyped_units, [mislabeledJob.id]);
  assert.match(resumeEntry.note, /never re-run/u);
  assert.equal(ledger.filter((entry) => entry.type === 'unit_complete').length, 48);
});

test('resume refuses a recorded technical failure the trace cannot re-type', async () => {
  const harness = depthResumeHarness();
  const { plan, fullRows, base } = harness;
  // No delivery verdict on record: the child died before the gate spoke, so
  // nothing licenses a typed re-read and the resume must fail closed.
  const technicalJob = plan.jobs[0];
  const technicalRow = { job: technicalJob, status: 'failed', attempts: 3, delivery: [], outcome: null };
  const extractRow = ({ job }) => (job.id === technicalJob.id ? technicalRow : fullRows.get(job.id));
  const halted = await executeTutorStubFrameRefuserDepthCalibration({ ...base, extractRow });
  assert.equal(halted.status, 'failed');
  await assert.rejects(
    executeTutorStubFrameRefuserDepthCalibration({ ...base, extractRow, resume: true }),
    /cannot re-type; refusing to resume/u,
  );
});
