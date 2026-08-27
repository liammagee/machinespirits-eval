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
  main as depthLauncherMain,
  TUTOR_STUB_FRAME_REFUSER_DEPTH_USAGE,
} from '../scripts/run-tutor-stub-frame-refuser-depth-calibration.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_PATH = 'config/tutor-stub-frame-refuser-depth-design.v1.json';

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
    (d) => (d.randomization.masterSeed = 2026082602),
    (d) => (d.attemptCeilings.plannedCallsCalibration = 1281),
    (d) => (d.attemptCeilings.calibrationMaximumReservations = 3961),
    (d) => (d.calibration.perArm = 9),
    (d) => d.calibration.authoritativeGates.pop(),
    (d) => (d.arms.treatment.hostActionFamily = 'clarify_distinction'),
    (d) => (d.arms.reference.actionInstruction = 'a new instruction'),
    (d) => (d.arms.distinctDeliveredBehaviourFloors.minimumTreatmentDeliveryRate = 0.7),
    (d) => (d.arms.distinctDeliveredBehaviourFloors.maximumReferenceContaminationRate = 0.2),
    (d) => (d.tutorDeliveryEnforcement.perArmAdjudication.adjudicatorSeat.model = 'gpt-5.6-luna'),
    (d) => (d.tutorDeliveryEnforcement.repairsAllowedPerEpisode = 2),
    (d) => (d.population.worlds = ['world_005_marrick']),
    (d) => (d.models.tutor = 'openrouter.nemotron'),
    (d) => (d.callAuthority.grantsModelCalls = true),
    (d) => (d.lineage.measuredReferenceRung2Rate = 0.2),
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
    assert.equal(arm.calibration.dialogues, 10);
    assert.equal(arm.calibration.minimumTreatmentDeliveryRate, 0.8);
    assert.equal(arm.calibration.maximumReferenceContaminationRate, 0.1);
    assert.equal(arm.calibration.minimumPairwiseExactEndpointAgreement, 0.8);
    assert.equal(arm.randomization.masterSeed, 2026082601);
    assert.equal(arm.attemptCeilings.plannedCallsPerDialogue, 64);
    assert.equal(arm.attemptCeilings.maximumReservationsPerDialogue, 198);
  }
  assert.throws(() => tutorStubFrameRefuserDepthArmDesign(design, 'placebo', { root: ROOT }));
});

test('calibration plan is 20 jobs balanced five per arm-world with stable deterministic ranks', () => {
  const design = loadDesign().design;
  const plan = buildTutorStubResistantLearnerCalibrationPlan(design);
  assert.equal(plan.schema, 'machinespirits.tutor-stub.frame-refuser-depth-calibration-plan.v1');
  assert.equal(plan.jobs.length, 20);
  for (const armId of ['treatment', 'reference']) {
    for (const world of design.population.worlds) {
      assert.equal(plan.jobs.filter((job) => job.arm_id === armId && job.world === world).length, 5);
    }
  }
  for (const job of plan.jobs) {
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
  assert.equal(preflight.rival_dag_count, 20);
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
  assert.equal(preflight.planned_role_calls, 1280);
  assert.equal(preflight.hard_attempt_ceiling, 3960);
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
  assert.equal(report.schema, 'machinespirits.tutor-stub.frame-refuser-depth-calibration-report.v1');
  assert.equal(report.status, 'passed');
  assert.equal(report.calibration_only, true);
  assert.equal(report.powered_run_authorized, false);
  assert.equal(report.calibration_rows_poolable_into_powered_run, false);
  const treatment = report.arms.find((arm) => arm.arm_id === 'treatment');
  const reference = report.arms.find((arm) => arm.arm_id === 'reference');
  assert.equal(treatment.gates.treatment_delivery_rate, true);
  assert.equal(treatment.gates.treatment_any_adjudicated_delivery, true);
  assert.equal(reference.gates.reference_contamination_bound, true);
  assert.equal(treatment.statistics.rung_2_rate, 1);
  assert.equal(reference.statistics.rung_2_rate, 0);
  assert.equal(reference.statistics.delivered_test_bounded_distinction_report_only, 10);
  assert.equal(report.sizing_update.reference_rung_2, 0);
  assert.equal(report.sizing_update.reference_determinate, 10);
  assert.match(report.sizing_update.purpose, /not an interim outcome analysis/u);
});

test('depth delivered-contrast floors fail closed on delivery loss and contamination', () => {
  const design = loadDesign().design;
  const shortDelivery = syntheticDepthRows(design);
  let flipped = 0;
  for (const row of shortDelivery) {
    if (row.job.arm_id === 'treatment' && flipped < 3) {
      row.delivery = [{ turn: 3, delivered: false, repairAttempts: 1 }];
      flipped += 1;
    }
  }
  const shortReport = summarizeTutorStubResistantLearnerCalibration({ rows: shortDelivery, design, root: ROOT });
  assert.equal(shortReport.status, 'failed');
  assert.equal(shortReport.arms.find((arm) => arm.arm_id === 'treatment').gates.treatment_delivery_rate, false);

  const contaminated = syntheticDepthRows(design);
  flipped = 0;
  for (const row of contaminated) {
    if (row.job.arm_id === 'reference' && flipped < 2) {
      row.delivery = [{ turn: 3, delivered: false, repairAttempts: 1 }];
      flipped += 1;
    }
  }
  const contaminatedReport = summarizeTutorStubResistantLearnerCalibration({ rows: contaminated, design, root: ROOT });
  assert.equal(contaminatedReport.status, 'failed');
  assert.equal(
    contaminatedReport.arms.find((arm) => arm.arm_id === 'reference').gates.reference_contamination_bound,
    false,
  );

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
    jobs: 20,
    planned_role_calls: 1280,
    hard_attempt_ceiling: 3960,
  };
  const approval = buildTutorStubFrameRefuserDepthApproval({
    signedBy: 'operator',
    approvalPhrase: 'APPROVE CALIBRATION 3960',
    preflight,
  });
  assert.equal(approval.calibration_only, true);
  assert.equal(approval.powered_run_authorized, false);
  assert.equal(approval.attended, true);
  assert.throws(() =>
    buildTutorStubFrameRefuserDepthApproval({
      signedBy: 'operator',
      approvalPhrase: 'APPROVE CALIBRATION 4000',
      preflight,
    }),
  );
  assert.throws(() =>
    buildTutorStubFrameRefuserDepthApproval({ signedBy: '', approvalPhrase: 'APPROVE CALIBRATION 3960', preflight }),
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
        jobs: 20,
        planned_role_calls: 1280,
        hard_attempt_ceiling: 3960,
        plan: { jobs: [] },
      }),
      destinationExists: () => false,
      isTTY: true,
      operatorApproval: async () => ({
        signedBy: 'operator',
        approvalPhrase: 'APPROVE CALIBRATION 3960',
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
  assert.equal(captured.approval.typed_phrase, 'APPROVE CALIBRATION 3960');
  assert.equal(captured.approval.method, 'attended_interactive_phrase');
  assert.equal(captured.parallelism, 2);
  assert.equal(captured.provenance.enforcement, 'recorded_not_pinned');
  await assert.rejects(
    depthLauncherMain(['--design', DESIGN_PATH, '--destination', '/absolute/depth-root'], {}),
    /exactly one of --dry-run or --launch/u,
  );
  await assert.rejects(
    depthLauncherMain(['--design', DESIGN_PATH, '--destination', '/absolute/depth-root', '--launch'], {
      runPreflight: async () => ({ status: 'passed_zero_call', hard_attempt_ceiling: 3960, plan: { jobs: [] } }),
      isTTY: false,
    }),
    /attended TTY/u,
  );
});
