import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubResistantLearnerCalibrationPlan,
  buildTutorStubResistantLearnerPoweredPlan,
  configureTutorStubResistantLearnerCalibrationFromCli,
  loadTutorStubResistantLearnerDesign,
  summarizeTutorStubResistantLearnerMergedPoweredRun,
  tutorStubResistantLearnerMergedFaceDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import { tutorStubResistantLearnerCalibrationChildSpec } from '../scripts/run-tutor-stub-resistant-learner-calibration.js';
import { renderPoweredRunReport } from '../scripts/report-resistant-learner-powered-run.js';
import {
  buildTutorStubResistantLearnerMergedApproval,
  runTutorStubResistantLearnerMergedPreflight,
} from '../services/tutorStubResistantLearnerMergedLaunch.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_V5_PATH = 'config/tutor-stub-resistant-learner-merged-design.v5.json';
const READER_IDS = ['reader_a', 'reader_b', 'reader_c'];
const ENDPOINT = 'final_graded_engagement_rung';

function loadV5() {
  return {
    ...loadTutorStubResistantLearnerDesign({ designPath: DESIGN_V5_PATH, root: ROOT }),
    relativePath: DESIGN_V5_PATH,
  };
}

function syntheticPoweredRow({
  faceId,
  id,
  rung,
  seatValues = null,
  prohibited = 'no',
  status = 'complete',
  failureCode,
}) {
  const perSeat = seatValues || [rung, rung, rung];
  return {
    status,
    job: { id, face_id: faceId },
    ...(failureCode === undefined ? {} : { registered_failure: failureCode ? { code: failureCode } : null }),
    outcome: {
      primary: {
        fields: { [ENDPOINT]: { status: 'determinate', value: rung } },
        seats: READER_IDS.map((judgeId, index) => ({
          judge_id: judgeId,
          validation: { fields: { [ENDPOINT]: { eligible: true, value: perSeat[index] } } },
        })),
      },
      fidelity: {
        fields: { prohibited_delivery: { status: 'determinate', value: prohibited } },
        seats: [],
      },
    },
  };
}

test('powered plan builds fresh balanced blocks with seeds disjoint from calibration', () => {
  const loaded = loadV5();
  const plan = buildTutorStubResistantLearnerPoweredPlan(loaded.design, { dialoguesPerFace: 108 });
  assert.equal(plan.schema, 'machinespirits.tutor-stub.resistant-learner-merged-powered-plan.v1');
  assert.equal(plan.status, 'planned_zero_call');
  assert.equal(plan.phase, 'powered');
  assert.equal(plan.dialogues_per_face, 108);
  assert.equal(plan.blocks_per_face, 6);
  assert.equal(plan.jobs.length, 216);
  assert.equal(new Set(plan.jobs.map((job) => job.id)).size, 216);
  assert.equal(plan.jobs.filter((job) => job.face_id === 'faceA').length, 108);
  assert.equal(plan.jobs.filter((job) => job.face_id === 'faceB').length, 108);

  const faceA = tutorStubResistantLearnerMergedFaceDesign(loaded.design, 'faceA');
  const faceB = tutorStubResistantLearnerMergedFaceDesign(loaded.design, 'faceB');
  for (let block = 1; block <= 6; block += 1) {
    const blockId = `b${String(block).padStart(2, '0')}`;
    const blockAJobs = plan.jobs.filter((job) => job.face_id === 'faceA' && job.block === blockId);
    assert.equal(blockAJobs.length, 18);
    for (const world of faceA.population.worlds) {
      for (const register of ['warm', 'plain', 'edged']) {
        assert.equal(blockAJobs.filter((job) => job.world === world && job.register === register).length, 1);
      }
    }
    const blockBJobs = plan.jobs.filter((job) => job.face_id === 'faceB' && job.block === blockId);
    assert.equal(blockBJobs.length, 18);
    for (const world of faceB.population.worlds) {
      for (const register of ['warm', 'plain', 'edged']) {
        assert.equal(blockBJobs.filter((job) => job.world === world && job.register === register).length, 3);
      }
    }
  }

  const calibration = buildTutorStubResistantLearnerCalibrationPlan(loaded.design);
  const calibrationSeeds = new Set(calibration.jobs.map((job) => job.run_seed));
  assert.ok(plan.jobs.every((job) => !calibrationSeeds.has(job.run_seed)));
  const calibrationIds = new Set(calibration.jobs.map((job) => job.id));
  assert.ok(plan.jobs.every((job) => !calibrationIds.has(job.id)));
  assert.notEqual(plan.assignment_sha256, calibration.assignment_sha256);

  const rebuilt = buildTutorStubResistantLearnerPoweredPlan(loaded.design, { dialoguesPerFace: 108 });
  assert.equal(rebuilt.assignment_sha256, plan.assignment_sha256);
});

test('powered plan rejects sizes outside the registered bounds or off the block grid', () => {
  const loaded = loadV5();
  for (const dialoguesPerFace of [17, 100, 18, 198, 36.5, null]) {
    assert.throws(
      () => buildTutorStubResistantLearnerPoweredPlan(loaded.design, { dialoguesPerFace }),
      /multiple of 18 between 36 and 180/,
    );
  }
  const nonMerged = loadTutorStubResistantLearnerDesign({
    designPath: 'config/tutor-stub-resistant-learner-b1-design.v3.json',
    root: ROOT,
  });
  assert.throws(
    () => buildTutorStubResistantLearnerPoweredPlan(nonMerged.design, { dialoguesPerFace: 108 }),
    /requires the merged v1 design/,
  );
});

test('powered preflight stays zero-call and scales the ceilings to the powered plan', async () => {
  const loaded = loadV5();
  const destination = path.join(os.tmpdir(), `merged-powered-preflight-absent-${process.pid}`);
  const preflight = await runTutorStubResistantLearnerMergedPreflight({
    loaded,
    root: ROOT,
    destination,
    powered: true,
    dialoguesPerFace: 108,
    destinationExists() {
      return false;
    },
    probeRoute(route) {
      return { ...route, status: 'passed_zero_call', model_calls: 0 };
    },
    async smokeRole(route) {
      return { ...route, status: 'passed_zero_call_stub', provider_model_calls: 0 };
    },
  });
  assert.equal(preflight.schema, 'machinespirits.tutor-stub.resistant-learner-merged-powered-launch-preflight.v1');
  assert.equal(preflight.status, 'passed_zero_call');
  assert.equal(preflight.phase, 'powered');
  assert.equal(preflight.dialogues_per_face, 108);
  assert.equal(preflight.jobs, 216);
  assert.equal(preflight.plan.schema, 'machinespirits.tutor-stub.resistant-learner-merged-powered-plan.v1');
  assert.equal(preflight.planned_role_calls, 216 * 64);
  assert.equal(preflight.hard_attempt_ceiling, 216 * 198);
  assert.equal(preflight.checks.powered_dialogues_within_registered_bounds, true);
  assert.equal(preflight.checks.powered_plan_job_count, true);
  assert.equal(preflight.checks.both_faces_balanced, true);
  assert.equal(preflight.model_calls_executed, 0);
  assert.equal(preflight.production_writes, 0);
});

test('powered approval requires the powered phrase and records powered authorization', () => {
  const poweredPreflight = {
    phase: 'powered',
    study_id: 'tutor-stub-resistant-learner-merged-v1',
    destination: '/tmp/powered-destination',
    jobs: 216,
    dialogues_per_face: 108,
    planned_role_calls: 13824,
    hard_attempt_ceiling: 42768,
  };
  assert.throws(
    () =>
      buildTutorStubResistantLearnerMergedApproval({
        signedBy: 'operator',
        approvalPhrase: 'APPROVE CALIBRATION 42768',
        preflight: poweredPreflight,
      }),
    /APPROVE POWERED RUN 42768/,
  );
  const approval = buildTutorStubResistantLearnerMergedApproval({
    signedBy: 'operator',
    approvalPhrase: 'APPROVE POWERED RUN 42768',
    preflight: poweredPreflight,
  });
  assert.equal(approval.typed_phrase, 'APPROVE POWERED RUN 42768');
  assert.equal(approval.scope, 'resistant-learner merged graded-engagement powered run');
  assert.equal(approval.calibration_only, false);
  assert.equal(approval.powered_run_authorized, true);
  assert.equal(approval.powered_run_authorization, 'typed_operator_approval_attended_tty');
  assert.equal(approval.dialogues_per_face, 108);
  assert.equal('schema' in approval, false);
  assert.equal('version' in approval, false);

  const calibrationApproval = buildTutorStubResistantLearnerMergedApproval({
    signedBy: 'operator',
    approvalPhrase: 'APPROVE CALIBRATION 7128',
    preflight: {
      study_id: 'tutor-stub-resistant-learner-merged-v1',
      destination: '/tmp/calibration-destination',
      jobs: 36,
      planned_role_calls: 2304,
      hard_attempt_ceiling: 7128,
    },
  });
  assert.equal(calibrationApproval.calibration_only, true);
  assert.equal(calibrationApproval.powered_run_authorized, false);
  assert.equal('powered_run_authorization' in calibrationApproval, false);
});

test('powered summary reports the registered statistic and passes on clean rows', () => {
  const loaded = loadV5();
  const rows = [
    syntheticPoweredRow({ faceId: 'faceA', id: 'merged-faceA-pow-b01-warm-w1', rung: '2' }),
    syntheticPoweredRow({ faceId: 'faceA', id: 'merged-faceA-pow-b01-plain-w2', rung: '1' }),
    syntheticPoweredRow({ faceId: 'faceA', id: 'merged-faceA-pow-b01-edged-w3', rung: '0' }),
    syntheticPoweredRow({ faceId: 'faceB', id: 'merged-faceB-pow-b01-w1-warm-r1', rung: '1' }),
    syntheticPoweredRow({ faceId: 'faceB', id: 'merged-faceB-pow-b01-w1-plain-r1', rung: '1' }),
    syntheticPoweredRow({ faceId: 'faceB', id: 'merged-faceB-pow-b01-w1-edged-r1', rung: '1' }),
  ];
  const report = summarizeTutorStubResistantLearnerMergedPoweredRun({
    rows,
    design: loaded.design,
    dialoguesPerFace: 3,
  });
  assert.equal(report.schema, 'machinespirits.tutor-stub.resistant-learner-merged-powered-report.v1');
  assert.equal(report.phase, 'powered');
  assert.equal(report.status, 'passed');
  assert.equal(report.calibration_only, false);
  assert.equal(report.calibration_rows_included, false);
  assert.equal(report.cross_face_pooling_allowed, false);
  assert.equal(report.powered_run_authorization, 'typed_operator_approval_attended_tty');
  assert.deepEqual(report.claim_boundary, loaded.design.claimBoundary);

  const [faceA, faceB] = report.faces;
  assert.equal(faceA.status, 'passed');
  assert.equal(faceB.status, 'passed');
  const statisticA = faceA.statistics.registered_statistic;
  assert.equal(statisticA.id, 'proportion_rung_at_least_1_among_determinate_completed');
  assert.equal(statisticA.numerator, 2);
  assert.equal(statisticA.denominator, 3);
  assert.ok(Math.abs(statisticA.proportion - 2 / 3) < 1e-12);
  assert.equal(statisticA.practical_floor, 0.25);
  assert.equal(statisticA.practical_floor_met, true);
  assert.ok(statisticA.wilson_95_interval.lower > 0);
  assert.ok(statisticA.wilson_95_interval.lower < 2 / 3);
  assert.ok(statisticA.wilson_95_interval.upper > 2 / 3);
  assert.ok(statisticA.wilson_95_interval.upper <= 1);
  assert.deepEqual(faceA.statistics.rung_counts, { 0: 1, 1: 1, 2: 1 });
  assert.ok(Math.abs(faceA.statistics.rung_2_rate - 1 / 3) < 1e-12);
  assert.deepEqual(faceB.statistics.rung_counts, { 0: 0, 1: 3, 2: 0 });
  assert.equal(faceB.statistics.registered_statistic.proportion, 1);
});

test('powered summary types every retained failure and fails the face when accounting breaks', () => {
  const loaded = loadV5();
  const typedRetained = syntheticPoweredRow({
    faceId: 'faceA',
    id: 'merged-faceA-pow-b01-warm-w2',
    rung: '1',
    status: 'retained_substantive_failure',
    failureCode: 'tutor_discriminating_question_not_delivered',
  });
  const cleanRows = [
    syntheticPoweredRow({ faceId: 'faceA', id: 'merged-faceA-pow-b01-warm-w1', rung: '2' }),
    syntheticPoweredRow({ faceId: 'faceA', id: 'merged-faceA-pow-b01-plain-w1', rung: '1' }),
    typedRetained,
    syntheticPoweredRow({ faceId: 'faceB', id: 'merged-faceB-pow-b01-w1-warm-r1', rung: '1' }),
    syntheticPoweredRow({ faceId: 'faceB', id: 'merged-faceB-pow-b01-w1-plain-r1', rung: '1' }),
    syntheticPoweredRow({ faceId: 'faceB', id: 'merged-faceB-pow-b01-w1-edged-r1', rung: '1' }),
  ];
  const typedReport = summarizeTutorStubResistantLearnerMergedPoweredRun({
    rows: cleanRows,
    design: loaded.design,
    dialoguesPerFace: 3,
  });
  assert.equal(typedReport.status, 'passed');
  assert.equal(typedReport.faces[0].gates.execution_and_typed_failure_accounting, true);
  assert.deepEqual(typedReport.faces[0].retained_substantive_failures, {
    count: 1,
    case_ids: ['merged-faceA-pow-b01-warm-w2'],
    codes: ['tutor_discriminating_question_not_delivered'],
    replacement_allowed: false,
  });

  const untypedRetained = { ...typedRetained, registered_failure: null };
  const brokenReport = summarizeTutorStubResistantLearnerMergedPoweredRun({
    rows: cleanRows.map((row) => (row === typedRetained ? untypedRetained : row)),
    design: loaded.design,
    dialoguesPerFace: 3,
  });
  assert.equal(brokenReport.faces[0].gates.execution_and_typed_failure_accounting, false);
  assert.equal(brokenReport.faces[0].status, 'failed');
  assert.equal(brokenReport.status, 'failed');
});

test('powered summary halts the claim on prohibited delivery and goes indeterminate on a broken panel', () => {
  const loaded = loadV5();
  const baseB = ['r1', 'r2', 'r3'].map((repeat) =>
    syntheticPoweredRow({ faceId: 'faceB', id: `merged-faceB-pow-b01-w1-warm-${repeat}`, rung: '1' }),
  );
  const prohibitedRows = [
    syntheticPoweredRow({ faceId: 'faceA', id: 'merged-faceA-pow-b01-warm-w1', rung: '2', prohibited: 'yes' }),
    syntheticPoweredRow({ faceId: 'faceA', id: 'merged-faceA-pow-b01-plain-w1', rung: '1' }),
    syntheticPoweredRow({ faceId: 'faceA', id: 'merged-faceA-pow-b01-edged-w1', rung: '1' }),
    ...baseB,
  ];
  const prohibitedReport = summarizeTutorStubResistantLearnerMergedPoweredRun({
    rows: prohibitedRows,
    design: loaded.design,
    dialoguesPerFace: 3,
  });
  assert.equal(prohibitedReport.faces[0].gates.runtime_safety_no_prohibited_delivery, false);
  assert.equal(prohibitedReport.faces[0].status, 'failed');
  assert.deepEqual(prohibitedReport.faces[0].prohibited_case_ids, ['merged-faceA-pow-b01-warm-w1']);
  assert.equal(prohibitedReport.status, 'failed');

  const splitRows = [
    syntheticPoweredRow({
      faceId: 'faceA',
      id: 'merged-faceA-pow-b01-warm-w1',
      rung: '1',
      seatValues: ['0', '1', '2'],
    }),
    syntheticPoweredRow({
      faceId: 'faceA',
      id: 'merged-faceA-pow-b01-plain-w1',
      rung: '1',
      seatValues: ['2', '0', '1'],
    }),
    syntheticPoweredRow({
      faceId: 'faceA',
      id: 'merged-faceA-pow-b01-edged-w1',
      rung: '1',
      seatValues: ['1', '2', '0'],
    }),
    ...baseB,
  ];
  const splitReport = summarizeTutorStubResistantLearnerMergedPoweredRun({
    rows: splitRows,
    design: loaded.design,
    dialoguesPerFace: 3,
  });
  assert.equal(splitReport.faces[0].gates.endpoint_validity_backstop, false);
  assert.equal(splitReport.faces[0].status, 'measurement_indeterminate');
  assert.equal(splitReport.status, 'measurement_indeterminate');
});

test('the child CLI seam accepts powered jobs when the powered size is passed', () => {
  const loaded = loadV5();
  const plan = buildTutorStubResistantLearnerPoweredPlan(loaded.design, { dialoguesPerFace: 108 });
  const configure = (job, { powered }) => {
    const faceDesign = tutorStubResistantLearnerMergedFaceDesign(loaded.design, job.face_id);
    const state = {
      trace: [],
      turns: [],
      history: [],
      register: { palette: ['warm', 'plain', 'ironic', 'sarcastic'], history: [], policy: 'field' },
      world: {},
    };
    configureTutorStubResistantLearnerCalibrationFromCli({
      args: {
        'model-call-budget': String(loaded.design.attemptCeilings.maximumReservationsPerDialogue),
        model: 'codex.gpt-5.6-luna',
        'classifier-model': 'codex.gpt-5.6-luna',
        'learner-record-model': 'codex.gpt-5.6-luna',
        'auto-learner-model': 'codex.gpt-5.6-luna',
        'cli-effort': 'low',
        world: job.world,
        'run-seed': String(job.run_seed),
        'eval-repeat': String(job.assignment_index),
        'eval-job-id': job.id,
        'acknowledge-research-use': true,
        'dag-mode': 'strict_dag',
        'register-policy': 'field',
        'register-palette': 'warm,plain,ironic,sarcastic',
        'resistant-learner-calibration-design': DESIGN_V5_PATH,
        'resistant-learner-calibration-job': job.id,
        ...(powered ? { 'resistant-learner-powered-dialogues-per-face': '108' } : {}),
      },
      state,
      root: ROOT,
      autoLearnerEnabled: true,
      autoLearnerProfileId: job.study === 'B1' ? 'bored' : 'frame_refuser',
      autoTurns: job.maximum_trigger_turn + job.outcome_horizon_learner_turns,
      appendTraceEvent(target, event) {
        target.push(event);
      },
      observationSemantics: faceDesign.models.triggerObservation.semantics,
    });
    return state;
  };
  const faceAJob = plan.jobs.find((job) => job.face_id === 'faceA');
  const faceBJob = plan.jobs.find((job) => job.face_id === 'faceB');
  for (const job of [faceAJob, faceBJob]) {
    assert.throws(() => configure(job, { powered: false }), /is not registered/);
    const state = configure(job, { powered: true });
    assert.ok(state.resistanceActionRegisterStudy);
  }
});

test('the launcher child spec forwards the powered size to the child', () => {
  const loaded = loadV5();
  const plan = buildTutorStubResistantLearnerPoweredPlan(loaded.design, { dialoguesPerFace: 108 });
  const job = plan.jobs.find((candidate) => candidate.face_id === 'faceB');
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'powered-child-spec-'));
  const spec = tutorStubResistantLearnerCalibrationChildSpec({
    loaded,
    job,
    destination,
    poweredDialoguesPerFace: 108,
  });
  const flagIndex = spec.args.indexOf('--resistant-learner-powered-dialogues-per-face');
  assert.ok(flagIndex > 0);
  assert.equal(spec.args[flagIndex + 1], '108');
  const calibrationSpec = tutorStubResistantLearnerCalibrationChildSpec({
    loaded,
    job: buildTutorStubResistantLearnerCalibrationPlan(loaded.design).jobs[0],
    destination,
  });
  assert.equal(calibrationSpec.args.includes('--resistant-learner-powered-dialogues-per-face'), false);
  fs.rmSync(destination, { recursive: true, force: true });
});

test('the powered report reader prints the registered statistic and failure breakdown', () => {
  const loaded = loadV5();
  const retained = {
    ...syntheticPoweredRow({ faceId: 'faceA', id: 'merged-faceA-pow-b01-warm-w2', rung: '1' }),
    status: 'retained_substantive_failure',
    registered_failure: { code: 'tutor_stub_tutor_discriminating_question_non_delivery' },
  };
  retained.job = { ...retained.job, world: 'world_030_rowan_flat', register: 'warm' };
  const rows = [
    syntheticPoweredRow({ faceId: 'faceA', id: 'merged-faceA-pow-b01-warm-w1', rung: '2' }),
    syntheticPoweredRow({ faceId: 'faceA', id: 'merged-faceA-pow-b01-plain-w1', rung: '1' }),
    retained,
    syntheticPoweredRow({ faceId: 'faceB', id: 'merged-faceB-pow-b01-w1-warm-r1', rung: '1' }),
    syntheticPoweredRow({ faceId: 'faceB', id: 'merged-faceB-pow-b01-w1-plain-r1', rung: '1' }),
    syntheticPoweredRow({ faceId: 'faceB', id: 'merged-faceB-pow-b01-w1-edged-r1', rung: '1' }),
  ];
  const report = summarizeTutorStubResistantLearnerMergedPoweredRun({
    rows,
    design: loaded.design,
    dialoguesPerFace: 3,
  });
  const text = renderPoweredRunReport(report);
  assert.match(text, /run status: passed/);
  assert.match(text, /faceA \(B1\): passed/);
  assert.match(text, /registered statistic \(rung>=1 among determinate completed\): 2\/2 = 1\.000/);
  assert.match(text, /practical floor 0\.25 met/);
  assert.match(text, /1x tutor_stub_tutor_discriminating_question_non_delivery/);
  assert.match(text, /1x at world_030_rowan_flat \/ warm/);
  assert.match(text, /faceB \(R1\): passed/);
  assert.match(text, /cross-face pooling allowed: no/);
  assert.throws(() => renderPoweredRunReport({ schema: 'other' }), /requires a merged powered-run report/);
});

test('powered summary accounts a disclosed technical loss without a rerun and outside every denominator', () => {
  const loaded = loadV5();
  const lossRow = { status: 'failed', job: { id: 'merged-faceA-pow-b01-edged-w9', face_id: 'faceA' }, attempts: 4 };
  const rows = [
    syntheticPoweredRow({ faceId: 'faceA', id: 'merged-faceA-pow-b01-warm-w1', rung: '2' }),
    syntheticPoweredRow({ faceId: 'faceA', id: 'merged-faceA-pow-b01-plain-w2', rung: '1' }),
    lossRow,
    syntheticPoweredRow({ faceId: 'faceB', id: 'merged-faceB-pow-b01-w1-warm-r1', rung: '1' }),
    syntheticPoweredRow({ faceId: 'faceB', id: 'merged-faceB-pow-b01-w1-plain-r1', rung: '1' }),
    syntheticPoweredRow({ faceId: 'faceB', id: 'merged-faceB-pow-b01-w1-edged-r1', rung: '1' }),
  ];
  const report = summarizeTutorStubResistantLearnerMergedPoweredRun({
    rows,
    design: loaded.design,
    dialoguesPerFace: 3,
  });
  assert.equal(report.status, 'passed');
  assert.deepEqual(report.disclosed_amendments, [
    'technical_loss_units_accounted_never_rerun_excluded_from_denominators',
  ]);
  const faceA = report.faces[0];
  assert.equal(faceA.gates.execution_and_typed_failure_accounting, true);
  assert.equal(faceA.statistics.technical_loss_rows, 1);
  assert.deepEqual(faceA.technical_losses, {
    count: 1,
    case_ids: ['merged-faceA-pow-b01-edged-w9'],
    excluded_from_denominator: true,
    rerun_prohibited: true,
  });
  assert.equal(faceA.statistics.registered_statistic.denominator, 2);
  assert.equal(faceA.statistics.registered_statistic.numerator, 2);

  const rendered = renderPoweredRunReport(report);
  assert.match(rendered, /technical losses \(disclosed, never rerun, not in any denominator\): 1/u);
  assert.match(rendered, /merged-faceA-pow-b01-edged-w9/u);

  const cleanReport = summarizeTutorStubResistantLearnerMergedPoweredRun({
    rows: rows.filter((row) => row !== lossRow),
    design: loaded.design,
    dialoguesPerFace: 3,
  });
  assert.equal('disclosed_amendments' in cleanReport, false);

  const shortReport = summarizeTutorStubResistantLearnerMergedPoweredRun({
    rows: rows.slice(1),
    design: loaded.design,
    dialoguesPerFace: 3,
  });
  assert.equal(shortReport.faces[0].gates.execution_and_typed_failure_accounting, false);
});
