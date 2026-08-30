// GUARD: the satisfiable-condition launch path — arm projection, compilation,
// route table, launch preflight, typed approval. Zero-call throughout: the
// route probes and role smokes are stubbed, so nothing here contacts a
// provider.
//
// The arm projection is where a study quietly stops being the study it
// registered. It lowers each version of the tutor onto the sealed parent's
// runtime design, and everything it fails to carry across is a silent revert
// to the sealed face-B behaviour. Two things matter most: the per-arm
// adjudication question must reach the enforcement seat, or the delivery gate
// judges the wrong thing; and the arm must carry THIS study's exhibit-minting
// persona, or the learner demands rule warrants again and the whole study is
// its own predecessor.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SATISFIABLE_CURRENT_REVISION,
  buildTutorStubResistantLearnerCalibrationPlan,
  loadTutorStubResistantLearnerDesign,
  configureTutorStubResistantLearnerCalibrationFromCli,
  runTutorStubResistantLearnerCompilationPreflight,
  summarizeTutorStubResistantLearnerCalibration,
  tutorStubFrameRefuserSatisfiableArmDesign,
  validateTutorStubResistantLearnerDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import {
  runTutorStubFrameRefuserSatisfiablePreflight,
  tutorStubFrameRefuserSatisfiableRouteTable,
} from '../services/tutorStubFrameRefuserSatisfiableLaunch.js';
import {
  executeTutorStubFrameRefuserSatisfiableCalibration,
  main as satisfiableLauncherMain,
  TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_USAGE,
} from '../scripts/run-tutor-stub-frame-refuser-satisfiable-calibration.js';
import { tutorStubRegisteredStudyOutcomeFromError } from '../services/tutorStubRegisteredStudyOutcome.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_PATH = 'config/tutor-stub-frame-refuser-satisfiable-design.v1.json';
const load = () => loadTutorStubResistantLearnerDesign({ designPath: DESIGN_PATH, root: REPO_ROOT });
const design = () => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, DESIGN_PATH), 'utf8'));
const arm = (armId) => tutorStubFrameRefuserSatisfiableArmDesign(design(), armId, { root: REPO_ROOT });

// Stubs: the launch preflight's only two outward-facing steps.
const stubProbe = (route) => ({ status: 'passed_zero_call', modelRef: route.modelRef });
const stubSmoke = async (route) => ({ status: 'passed_zero_call_stub', role: route.role });
const preflight = () =>
  runTutorStubFrameRefuserSatisfiablePreflight({
    loaded: load(),
    root: REPO_ROOT,
    destination: path.join(REPO_ROOT, '.test-tmp', 'satisfiable-launch-preflight-destination'),
    destinationExists: () => false,
    probeRoute: stubProbe,
    smokeRole: stubSmoke,
  });

test('each arm carries its own registered move and adjudication question', () => {
  const treatment = arm('treatment');
  const reference = arm('reference');

  assert.equal(treatment.satisfiableExecution.registeredMoveId, 'exhibit_discharge');
  assert.equal(reference.satisfiableExecution.registeredMoveId, 'standing_conditions_bridge');
  assert.notEqual(treatment.intervention.action, reference.intervention.action);

  // The question must reach the enforcement seat on each arm. If it does not,
  // the delivery gate adjudicates the sealed face-B move on both arms and
  // reports a contrast that was never delivered.
  const questions = design().tutorDeliveryEnforcement.perArmAdjudication;
  assert.equal(treatment.tutorDeliveryContract.enforcement.check.question, questions.treatmentQuestion);
  assert.equal(reference.tutorDeliveryContract.enforcement.check.question, questions.referenceQuestion);
  assert.notEqual(
    treatment.tutorDeliveryContract.enforcement.check.question,
    reference.tutorDeliveryContract.enforcement.check.question,
  );

  // Both arms wait for the exhibit, and the arm says so rather than leaving
  // the runtime to re-derive it.
  for (const armDesign of [treatment, reference]) {
    assert.equal(
      armDesign.satisfiableExecution.deliveryTimingRule,
      'first_intervention_turn_at_or_after_the_demanded_exhibit_is_public',
    );
    assert.match(armDesign.tutorDeliveryContract.enforcement.scope, /at_or_after_the_demanded_exhibit_is_public/u);
  }
});

test('the arm projection carries the exhibit mint, not the sealed warrant one', () => {
  // The failure this catches: an arm that inherits the sealed face-B persona
  // mints rule warrants, so the learner demands the undischargeable thing the
  // whole study exists to remove — and nothing else would notice.
  for (const armId of ['treatment', 'reference']) {
    const armDesign = arm(armId);
    assert.equal(armDesign.population.profile, 'frame_refuser_exhibit-r2-rival-dag-v1');
    assert.equal(armDesign.rivalDagPersona.mint.openNodeKind, 'exhibit');
    // The concession condition stays the sealed one, resolved rather than
    // copied, so it cannot drift from face B.
    assert.equal(
      armDesign.rivalDagPersona.concessionCondition.matchingAlgorithm.id,
      'normalized_public_token_overlap_v1',
    );
    // The trigger registration is the sealed face-B one: this study shares the
    // standing-rivalry runtime path.
    assert.ok(armDesign.population.triggerRegistration.includes('merged-turn-gate-registration'));
  }
});

test('the reference arm keeps the sealed instruction bytes', () => {
  const reference = arm('reference');
  // The measured 0.114 base rate was taken on this text. The only registered
  // change to the reference arm is when it lands, never what it says.
  assert.ok(String(reference.tutorDeliveryContract.actionInstructions.test_bounded_distinction || '').trim());
  assert.equal(reference.intervention.action, 'test_bounded_distinction');
  // The treatment contract deliberately omits the compact instruction so the
  // compact text has one source rather than two copies that can drift.
  assert.deepEqual(Object.keys(arm('treatment').tutorDeliveryContract.actionInstructions), ['condition_discharge']);
});

test('both arms compile through the runtime with the right question and mint', () => {
  const compilation = runTutorStubResistantLearnerCompilationPreflight({ loaded: load(), root: REPO_ROOT });
  assert.equal(compilation.status, 'passed_zero_call');
  assert.equal(compilation.schema, 'machinespirits.tutor-stub.frame-refuser-satisfiable-compilation-preflight.v1');
  assert.equal(compilation.rows.length, 8, 'two arms x two worlds x two scenes');
  assert.equal(compilation.rival_dag_count, 48);
  assert.equal(compilation.model_calls, 0);
  assert.deepEqual(
    compilation.rows.filter((row) => !row.passed),
    [],
    'every compiled row must pass',
  );
  // The two arms must not compile to the same thing.
  const families = new Set(compilation.rows.map((row) => `${row.arm_id}:${row.host_action_family}`));
  assert.equal(families.size, 2, 'each arm compiles to its own host action family');
});

test('the production CLI configuration projects the selected arm before execution', () => {
  const loaded = load();
  const plan = buildTutorStubResistantLearnerCalibrationPlan(loaded.design, { root: REPO_ROOT });
  for (const armId of ['treatment', 'reference']) {
    const job = plan.jobs.find((candidate) => candidate.arm_id === armId);
    const armDesign = tutorStubFrameRefuserSatisfiableArmDesign(loaded.design, armId, { root: REPO_ROOT });
    const state = {
      trace: [],
      turns: [],
      history: [],
      register: { palette: ['warm', 'plain', 'ironic', 'sarcastic'], history: [], policy: 'field' },
      world: {},
    };
    configureTutorStubResistantLearnerCalibrationFromCli({
      args: {
        'resistant-learner-calibration-design': DESIGN_PATH,
        'resistant-learner-calibration-job': job.id,
        'model-call-budget': String(armDesign.attemptCeilings.maximumReservationsPerDialogue),
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
      },
      state,
      root: REPO_ROOT,
      autoLearnerEnabled: true,
      autoLearnerProfileId: 'frame_refuser_exhibit',
      autoTurns: job.maximum_trigger_turn + job.outcome_horizon_learner_turns,
      appendTraceEvent(target, event) {
        target.push(event);
      },
      observationSemantics: armDesign.models.triggerObservation.semantics,
    });

    const projected = state.resistanceActionRegisterStudy.design;
    assert.equal(projected.satisfiableExecution.armId, armId);
    assert.equal(projected.satisfiableExecution.move, job.action);
    assert.equal(projected.population.profile, 'frame_refuser_exhibit-r2-rival-dag-v1');
    assert.ok(state.privateRivalLearnerDag.openNodes.every((node) => node.openNodeKind === 'exhibit'));
    assert.equal(state.resistanceActionRegisterStudy.delivery_timing_rule, job.delivery_timing_rule);
    assert.equal(state.resistanceActionRegisterStudy.earliest_delivery_turn, job.earliest_delivery_turn);
    assert.deepEqual(state.resistanceActionRegisterStudy.demanded_exhibit, job.demanded_exhibit);
  }
});

test('the route table covers every seat the run needs, on the sealed stack', () => {
  const routes = tutorStubFrameRefuserSatisfiableRouteTable(design(), { root: REPO_ROOT });
  for (const armId of ['treatment', 'reference']) {
    const armRoutes = routes.filter((route) => route.arm_id === armId);
    const roles = armRoutes.map((route) => route.role);
    for (const role of ['tutor', 'analysis', 'learner', 'tutor.delivery_repair']) {
      assert.ok(roles.includes(role), `${armId} must route ${role}`);
    }
    assert.ok(
      roles.some((role) => role.startsWith('trigger.')),
      `${armId} must route a trigger seat`,
    );
    assert.ok(
      roles.some((role) => role.startsWith('final.primary.')),
      `${armId} must route the endpoint panel`,
    );
    assert.ok(
      roles.some((role) => role.startsWith('tutor_delivery.')),
      `${armId} must route the delivery adjudication seat — without it the delivered-contrast floor is unmeasurable`,
    );
  }
  // The stack is held to the sealed one so the reference arm stays comparable.
  const models = new Set(routes.map((route) => route.modelRef));
  assert.ok(models.has('codex.gpt-5.6-luna'));
  assert.ok(![...models].some((modelRef) => /nemotron|kimi/u.test(modelRef)), 'the weak stack must never appear here');
});

test('the launch preflight passes zero-call and grants nothing', async () => {
  const result = await preflight();
  assert.equal(result.status, 'passed_zero_call');
  assert.equal(result.model_calls_executed, 0);
  assert.equal(result.production_writes, 0);
  assert.deepEqual(
    Object.entries(result.checks).filter(([, passed]) => !passed),
    [],
  );
  assert.equal(result.jobs, 48);
  assert.equal(result.planned_role_calls, 3072);
  assert.equal(result.hard_attempt_ceiling, 9504);
  // Passing the preflight is not authorization. It never was and must not
  // become one.
  assert.equal(design().callAuthority.grantsModelCalls, false);
  assert.equal(result.checks.grants_no_model_calls, true);
});

test('a superseded revision cannot be loaded, let alone launched', () => {
  // Revision 1's treatment move could not be delivered at all; rerunning it
  // would spend on a study known to fail its own delivery gate. The design
  // validator refuses it outright, so it never reaches the launch preflight —
  // which is why the preflight carries no revision check of its own. A check
  // there could only recompute its own expectation.
  const stale = { ...design(), revision: 1 };
  const result = validateTutorStubResistantLearnerDesign(stale);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => /design identity is unsupported/u.test(issue)));
  assert.equal(SATISFIABLE_CURRENT_REVISION, 2);
});

test('a destination that already exists stops the launch', async () => {
  const result = await runTutorStubFrameRefuserSatisfiablePreflight({
    loaded: load(),
    root: REPO_ROOT,
    destination: '/tmp/already-there',
    destinationExists: () => true,
    probeRoute: stubProbe,
    smokeRole: stubSmoke,
  });
  assert.equal(result.checks.destination_absent, false);
  assert.equal(result.status, 'failed');
});

function syntheticSatisfiableRows(studyDesign) {
  const treatmentDesign = tutorStubFrameRefuserSatisfiableArmDesign(studyDesign, 'treatment', { root: REPO_ROOT });
  const readers = treatmentDesign.models.finalSemanticReaders;
  const fidelityReaders = readers.filter((reader) =>
    treatmentDesign.measurement.readerPanel.fidelityJudges.includes(reader.modelRef),
  );
  return buildTutorStubResistantLearnerCalibrationPlan(studyDesign, { root: REPO_ROOT }).jobs.map((job) => {
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
      delivery: [{ turn: job.earliest_delivery_turn, delivered: true, repairAttempts: 0 }],
      release_pacing: [{ turn: job.demanded_exhibit.release_turn, released_now: [job.demanded_exhibit.premise_id] }],
      outcome: {
        primary: makePanel('primary', primaryValues),
        fidelity: makePanel('fidelity', fidelityValues),
      },
    };
  });
}

test('the satisfiable report gates the actual exhibit opportunity and remains calibration-only', () => {
  const studyDesign = design();
  const rows = syntheticSatisfiableRows(studyDesign);
  const report = summarizeTutorStubResistantLearnerCalibration({ rows, design: studyDesign, root: REPO_ROOT });
  assert.equal(report.schema, 'machinespirits.tutor-stub.frame-refuser-satisfiable-calibration-report.v1');
  assert.equal(report.status, 'passed');
  assert.equal(report.calibration_only, true);
  assert.equal(report.powered_run_authorized, false);
  const treatment = report.arms.find((candidate) => candidate.arm_id === 'treatment');
  assert.equal(treatment.gates.discharge_opportunity, true);
  assert.equal(treatment.statistics.demanded_exhibit_available_within_horizon, 24);

  for (const row of rows.filter((candidate) => candidate.job.arm_id === 'treatment').slice(0, 5)) {
    row.release_pacing = [];
  }
  const failed = summarizeTutorStubResistantLearnerCalibration({ rows, design: studyDesign, root: REPO_ROOT });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.arms.find((candidate) => candidate.arm_id === 'treatment').gates.discharge_opportunity, false);
});

test('exhibit-discharge non-delivery crosses the child boundary as a retained typed outcome', () => {
  const outcome = tutorStubRegisteredStudyOutcomeFromError({
    error: {
      code: 'tutor_stub_tutor_exhibit_discharge_non_delivery',
      substantiveStudyFailure: true,
    },
    jobId: 'sat1_treatment_cal_world_005_marrick_r1',
  });
  assert.equal(outcome.status, 'retained_substantive_failure');
  assert.equal(outcome.code, 'tutor_stub_tutor_exhibit_discharge_non_delivery');
  assert.equal(outcome.replacement_allowed, false);
});

test('the executable path reserves every unit through the shared ledger and writes the registered report', async (t) => {
  const loaded = load();
  loaded.relativePath = DESIGN_PATH;
  const plan = buildTutorStubResistantLearnerCalibrationPlan(loaded.design, { root: REPO_ROOT });
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'satisfiable-launch-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const destination = path.join(base, 'run');
  fs.mkdirSync(destination);
  const events = [];
  let reserved = 0;
  let closed = false;
  const admission = {
    source: { commit: 'launch', tree: 'tree' },
    authorization: { commit: 'go', path: 'notes/go.md' },
    get reserved() {
      return reserved;
    },
    reserveModelAttempts(count, detail) {
      reserved += count;
      events.push({ type: 'reservation', count, ...detail });
    },
    record(event) {
      events.push(event);
    },
    close(event) {
      closed = true;
      events.push(event);
    },
  };
  const report = await executeTutorStubFrameRefuserSatisfiableCalibration({
    loaded,
    destination,
    preflight: { plan, hard_attempt_ceiling: 9504 },
    admission,
    childSpec: ({ job }) => ({ job }),
    runChild: async () => ({ code: 0, signal: null, spawn_error: null }),
    extractRow: ({ job }) => ({ job, status: 'complete', attempts: 1 }),
    summarize: ({ rows: reportedRows }) => ({ schema: 'synthetic', status: 'passed', rows: reportedRows }),
    progress: () => {},
  });
  assert.equal(report.status, 'passed');
  assert.equal(report.execution.complete_units, 48);
  assert.equal(report.execution.reserved_model_attempts, 9504);
  assert.equal(report.execution.observed_model_attempts, 48);
  assert.equal(events.filter((event) => event.type === 'reservation').length, 48);
  assert.equal(closed, true);
  assert.equal(fs.existsSync(path.join(destination, 'plan.json')), true);
  assert.equal(fs.existsSync(path.join(destination, 'report.json')), true);
});

test('launcher main admits through the shared contract and has no approval or resume ceremony', async () => {
  const captured = {};
  const result = await satisfiableLauncherMain(
    [
      '--design',
      DESIGN_PATH,
      '--destination',
      '/absolute/satisfiable-root',
      '--launch-commit',
      'launch',
      '--go-note-commit',
      'go',
      '--go-note-path',
      'notes/go.md',
      '--accept-charges',
    ],
    {
      runPreflight: async ({ loaded, destination }) => ({
        status: 'passed_zero_call',
        study_id: loaded.design.studyId,
        destination,
        hard_attempt_ceiling: 9504,
        plan: { jobs: [] },
      }),
      destinationExists: () => false,
      admit: (input) => {
        captured.admission = input;
        return { source: { commit: 'launch' } };
      },
      execute: async (input) => {
        captured.execution = input;
        return { status: 'passed' };
      },
    },
  );
  assert.equal(result.status, 'passed');
  assert.equal(captured.admission.designPath, DESIGN_PATH);
  assert.equal(captured.admission.spendCap, 9504);
  assert.equal(captured.admission.launchCommit, 'launch');
  assert.equal(captured.execution.admission.source.commit, 'launch');
  assert.doesNotMatch(TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_USAGE, /APPROVE CALIBRATION|--resume/u);
  assert.match(TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_USAGE, /shared standing launch contract/u);
});
