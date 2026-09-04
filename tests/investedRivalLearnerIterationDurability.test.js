import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { reconcileSharedModelAttemptLedger } from '../services/durableAttemptJournal.js';
import { buildBenchmarkJobs, readBenchmarkArm } from '../scripts/score-local-qwen-resistant-learner-benchmark.js';
import { investedRivalDeliveredSourceContext } from '../scripts/run-local-qwen-invested-rival.js';
import {
  buildLearnerIterationPlan,
  createLearnerIterationWorkflowTracker,
  learnerIterationPaidBudget,
  readLearnerIterationRecovery,
} from '../scripts/run-invested-rival-learner-iteration.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan = buildLearnerIterationPlan(root);
const sha256File = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function schemaFixture(schema, key = '', index = 0) {
  if (Object.hasOwn(schema, 'const')) return schema.const;
  if (schema.anyOf) return schemaFixture(schema.anyOf[0], key, index);
  if (schema.type === 'null') return null;
  if (schema.type === 'string') return 'fixture';
  if (schema.type === 'boolean') return false;
  if (schema.type === 'number') return schema.minimum ?? 3;
  if (schema.type === 'integer') {
    if (key === 'turn') return index + 1;
    if (key.endsWith('_index')) return index;
    return schema.minimum ?? 0;
  }
  if (schema.type === 'array') {
    return Array.from({ length: schema.minItems || 0 }, (_, row) => schemaFixture(schema.items, key, row));
  }
  if (schema.type === 'object') {
    return Object.fromEntries(
      (schema.required || []).map((child) => [child, schemaFixture(schema.properties[child], child, index)]),
    );
  }
  throw new Error(`unsupported fixture schema at ${key}`);
}

function writeCompletedDialogue(source, kind, stage, arm) {
  const armDir = path.join(source, kind, arm.id);
  fs.mkdirSync(armDir, { recursive: true });
  const tracePath = path.join(armDir, 'trace.jsonl');
  fs.writeFileSync(
    tracePath,
    `${JSON.stringify({ type: 'tutor_opening', text: stage.world.opening_frame.authored_text })}\n`,
  );
  const snapshot = {
    turns: [{ turn: 1, learner: 'Fixture learner turn.', tutor: 'Fixture tutor turn.' }],
    trace: tracePath,
    maxExchanges: stage.max_exchanges,
    disposition: 'exchange_cap',
    proofControl: { releasedPremiseIds: [] },
  };
  const responsePaths = ['learner', 'tutor'].map((speaker) => {
    const responsePath = path.join(armDir, `1-${speaker}.response.json`);
    fs.writeFileSync(responsePath, `${JSON.stringify({ text: `Fixture ${speaker} response.` })}\n`);
    return responsePath;
  });
  fs.writeFileSync(path.join(armDir, 'dialogue.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
  return {
    responsePaths,
    arm: {
      ...arm,
      snapshot,
      opening: stage.world.opening_frame.authored_text,
      transcript: 'Learner: Fixture learner turn.\nTutor: Fixture tutor turn.',
    },
  };
}

function acceptedAttemptEvents(responsePath, index, stage = 'generation') {
  const attemptId = `fixture-attempt-${index}`;
  return [
    { type: 'model_attempt_dispatch_reserved', attempt_id: attemptId, stage },
    { type: 'model_attempt_dispatch_started', attempt_id: attemptId },
    {
      type: 'attempt_response_persisted',
      attempt_id: attemptId,
      response_path: responsePath,
      response_sha256: sha256File(responsePath),
    },
    { type: 'attempt_completed', attempt_id: attemptId },
  ];
}

function readJsonLines(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function makeAdmission() {
  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-iteration-durable-budget-'));
  const destination = path.join(stateRoot, 'run');
  fs.mkdirSync(destination);
  const runLedgerPath = path.join(destination, 'run-ledger.jsonl');
  const studyLedgerPath = path.join(stateRoot, 'study-attempts.jsonl');
  fs.writeFileSync(runLedgerPath, '');
  fs.writeFileSync(studyLedgerPath, '');
  let capacitySequence = 0;
  const capacities = new Map();
  return {
    destination,
    runLedgerPath,
    studyLedgerPath,
    get studyReserved() {
      return readJsonLines(studyLedgerPath).filter((event) => event.type === 'study_model_attempt_dispatch_reserved')
        .length;
    },
    allocateModelAttemptCapacity(count, detail) {
      const capacity = { id: `capacity-${++capacitySequence}`, count };
      capacities.set(capacity.id, { ...capacity, detail });
      return capacity;
    },
    attemptLedgerEnvironment({ unitId, capacity }) {
      return {
        TUTOR_STUB_SHARED_ATTEMPT_LEDGER: JSON.stringify({
          runLedgerPath,
          studyLedgerPath,
          studyId: plan.id,
          destination,
          hardCeiling: plan.total_attempt_ceiling,
          unitId,
          capacityId: capacity.id,
          capacityLimit: capacity.count,
        }),
      };
    },
    releaseModelAttemptCapacity(capacity) {
      capacities.delete(capacity.id);
    },
  };
}

function reconcile(admission, unitId) {
  const reservation = readJsonLines(admission.runLedgerPath).find(
    (event) => event.type === 'model_attempt_dispatch_reserved',
  );
  return reconcileSharedModelAttemptLedger({
    runLedgerPath: admission.runLedgerPath,
    studyLedgerPath: admission.studyLedgerPath,
    capacityId: reservation.capacity_id,
    unitId,
  });
}

test('learner iteration keeps the registered routes, instruments, and 110-attempt allocation', () => {
  assert.deepEqual(
    {
      total: plan.total_attempt_ceiling,
      generation: plan.generation_attempt_ceiling,
      assessment: plan.assessment_packets,
      recovery: plan.recovery_attempt_reserve,
    },
    { total: 110, generation: 80, assessment: 25, recovery: 5 },
  );
  assert.deepEqual(plan.models, {
    learner_luna: 'codex.gpt-5.6-luna',
    learner_luna_effort: 'medium',
    learner_qwen_normal: 'mlx-community/Qwen3.8-27B-4bit',
    learner_qwen_abliterated: 'Qwen3.8-27B-Uncensored-MLX/4-bit',
    tutor: 'codex.gpt-5.6-sol',
    tutor_effort: 'medium',
    judge: 'claude-code.claude-opus-5',
    judge_effort: 'max',
  });
  assert.deepEqual(
    plan.development.map((stage) => stage.world.id),
    ['world_030_rowan_flat', 'world_030_rowan_flat'],
  );
  assert.equal(plan.holdout.world.id, 'world_034_groupwork_flag');
  assert.ok(
    [...plan.development.flatMap((stage) => stage.arms), ...plan.holdout.arms].every(
      (arm) => arm.mode === 'direct' && arm.tutorMode === 'direct',
    ),
  );
});

test('learner iteration durable budget reconciles all four crash boundaries without duplicate acceptance', () => {
  const beforeReservation = makeAdmission();
  assert.equal(readJsonLines(beforeReservation.runLedgerPath).length, 0);

  const afterReservation = makeAdmission();
  learnerIterationPaidBudget(afterReservation, 110)
    .scope('generation/development/D1')
    .reserve({ role: 'tutor_stub_auto_learner', turn: 1 });
  let events = reconcile(afterReservation, 'generation/development/D1/tutor_stub_auto_learner/1');
  assert.equal(events.filter((event) => event.type === 'attempt_cancelled_before_dispatch').length, 1);

  const afterDispatch = makeAdmission();
  const dispatched = learnerIterationPaidBudget(afterDispatch, 110).scope('generation/holdout/A');
  dispatched.reserve({ role: 'tutor_stub_tutor', turn: 2 });
  dispatched.markDispatched();
  events = reconcile(afterDispatch, 'generation/holdout/A/tutor_stub_tutor/2');
  assert.equal(events.filter((event) => event.type === 'attempt_interrupted_after_dispatch').length, 1);

  const afterPersistence = makeAdmission();
  const persisted = learnerIterationPaidBudget(afterPersistence, 110).scope('assessment/holdout');
  persisted.reserve({
    role: 'local-qwen-benchmark-quality',
    unitId: 'assessment/holdout/A/quality-summary',
  });
  persisted.markDispatched();
  const responsePath = path.join(afterPersistence.destination, 'A-quality-summary.response.txt');
  fs.writeFileSync(responsePath, '{"fixture":true}\n');
  persisted.persistResponse(responsePath);
  events = reconcile(afterPersistence, 'assessment/holdout/A/quality-summary');
  assert.equal(events.filter((event) => event.type === 'model_attempt_dispatch_reserved').length, 1);
  assert.equal(events.filter((event) => event.type === 'attempt_response_persisted').length, 1);
  assert.equal(events.filter((event) => event.type === 'attempt_completed').length, 1);
  assert.equal(
    events.filter((event) =>
      ['attempt_failed', 'attempt_cancelled_before_dispatch', 'attempt_interrupted_after_dispatch'].includes(
        event.type,
      ),
    ).length,
    0,
  );

  const ordinaryCompletion = makeAdmission();
  const completed = learnerIterationPaidBudget(ordinaryCompletion, 110).scope('generation/holdout/B');
  completed.reserve({ role: 'tutor_stub_auto_learner', turn: 1 });
  completed.markDispatched();
  const completedPath = path.join(ordinaryCompletion.destination, '1-learner.response.json');
  fs.writeFileSync(completedPath, '{"text":"accepted once"}\n');
  completed.persistResponse(completedPath);
  completed.complete();
  events = reconcile(ordinaryCompletion, 'generation/holdout/B/tutor_stub_auto_learner/1');
  assert.equal(events.filter((event) => event.type === 'attempt_completed').length, 1);
  assert.deepEqual(completed.snapshot(), { used: 1, limit: 110 });
});

test('learner iteration restart reuses a durably accepted reply and exposes only missing work', () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-iteration-restart-'));
  fs.writeFileSync(path.join(source, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  const armDir = path.join(source, 'development', 'D1');
  fs.mkdirSync(armDir, { recursive: true });
  const requestPath = path.join(armDir, '1-learner.request.json');
  const responsePath = path.join(armDir, '1-learner.response.json');
  fs.writeFileSync(requestPath, '{"systemPrompt":"fixture","prompt":"fixture","messageHistory":[]}\n');
  fs.writeFileSync(responsePath, '{"text":"preserved reply"}\n');
  const attemptId = 'generation/development/D1/tutor_stub_auto_learner/1:1:fixture';
  const ledger = [
    { type: 'launch_admitted', study_id: plan.id, spend_cap: 110 },
    {
      type: 'model_attempt_dispatch_reserved',
      attempt_id: attemptId,
      unit_id: 'generation/development/D1/tutor_stub_auto_learner/1',
    },
    { type: 'model_attempt_dispatch_started', attempt_id: attemptId },
    {
      type: 'attempt_response_persisted',
      attempt_id: attemptId,
      response_path: responsePath,
      response_sha256: sha256File(responsePath),
    },
    { type: 'attempt_completed', attempt_id: attemptId },
    { type: 'run_sealed', status: 'technical_failure', recovery_permitted: true },
  ];
  fs.writeFileSync(
    path.join(source, 'run-ledger.jsonl'),
    `${ledger.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );

  const recovery = readLearnerIterationRecovery(plan, source);
  assert.equal(recovery.priorAttempts, 1);
  assert.equal(recovery.completed.length, 0);
  assert.equal(recovery.partial.arm.id, 'D1');
  assert.deepEqual(Object.keys(recovery.partial.savedReplies), ['1-learner']);
  assert.equal(recovery.partial.savedReplies['1-learner'].response.text, 'preserved reply');
  assert.equal(recovery.completedPackets, 0);
  assert.equal(recovery.responseFreeFailures, 0);
});

test('learner iteration restart ignores a response file written before durable persistence', () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-iteration-unpersisted-response-'));
  fs.writeFileSync(path.join(source, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  const armDir = path.join(source, 'development', 'D1');
  fs.mkdirSync(armDir, { recursive: true });
  fs.writeFileSync(path.join(armDir, '1-learner.request.json'), '{"prompt":"fixture"}\n');
  fs.writeFileSync(path.join(armDir, '1-learner.response.json'), '{"text":"must not be reused"}\n');
  const attemptId = 'unpersisted-fixture';
  const ledger = [
    { type: 'launch_admitted', study_id: plan.id, spend_cap: 110 },
    { type: 'model_attempt_dispatch_reserved', attempt_id: attemptId, stage: 'generation' },
    { type: 'model_attempt_dispatch_started', attempt_id: attemptId },
    { type: 'attempt_interrupted_after_dispatch', attempt_id: attemptId },
    { type: 'run_sealed', status: 'technical_failure', recovery_permitted: true },
  ];
  fs.writeFileSync(
    path.join(source, 'run-ledger.jsonl'),
    `${ledger.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );

  const recovery = readLearnerIterationRecovery(plan, source);
  assert.equal(recovery.partial.arm.id, 'D1');
  assert.deepEqual(recovery.partial.savedReplies, {});
  assert.equal(recovery.failedAttempts, 1);
  assert.equal(recovery.generationFailures, 1);
  assert.equal(recovery.responseFreeFailures, 0);
});

test('learner iteration restart permits an empty prefix after cancellation before dispatch', () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-iteration-cancelled-before-dispatch-'));
  fs.writeFileSync(path.join(source, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  const armDir = path.join(source, 'development', 'D1');
  fs.mkdirSync(armDir, { recursive: true });
  fs.writeFileSync(path.join(armDir, '1-learner.request.json'), '{"prompt":"fixture"}\n');
  const attemptId = 'cancelled-fixture';
  const ledger = [
    { type: 'launch_admitted', study_id: plan.id, spend_cap: 110 },
    { type: 'model_attempt_dispatch_reserved', attempt_id: attemptId, stage: 'generation' },
    { type: 'attempt_cancelled_before_dispatch', attempt_id: attemptId },
    { type: 'run_sealed', status: 'technical_failure', recovery_permitted: true },
  ];
  fs.writeFileSync(
    path.join(source, 'run-ledger.jsonl'),
    `${ledger.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
  const recovery = readLearnerIterationRecovery(plan, source);
  assert.deepEqual(recovery.partial.savedReplies, {});
  assert.equal(recovery.generationFailures, 1);
});

test('learner iteration recovery counts generation failures against the global five-attempt reserve', () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-iteration-global-recovery-reserve-'));
  fs.writeFileSync(path.join(source, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  const armDir = path.join(source, 'development', 'D1');
  fs.mkdirSync(armDir, { recursive: true });
  fs.writeFileSync(path.join(armDir, '1-learner.request.json'), '{"prompt":"fixture"}\n');
  const failed = Array.from({ length: 6 }, (_, index) => {
    const attemptId = `cancelled-${index}`;
    return [
      { type: 'model_attempt_dispatch_reserved', attempt_id: attemptId, stage: 'generation' },
      { type: 'attempt_cancelled_before_dispatch', attempt_id: attemptId },
    ];
  }).flat();
  const ledger = [
    { type: 'launch_admitted', study_id: plan.id, spend_cap: 110 },
    ...failed,
    { type: 'run_sealed', status: 'technical_failure', recovery_permitted: true },
  ];
  fs.writeFileSync(
    path.join(source, 'run-ledger.jsonl'),
    `${ledger.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
  assert.throws(() => readLearnerIterationRecovery(plan, source), /exceeds the registered response-free reserve/iu);
});

test('learner iteration restart rejects persisted-response hash drift', () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-iteration-hash-drift-'));
  fs.writeFileSync(path.join(source, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  const armDir = path.join(source, 'development', 'D1');
  fs.mkdirSync(armDir, { recursive: true });
  const responsePath = path.join(armDir, '1-learner.response.json');
  fs.writeFileSync(path.join(armDir, '1-learner.request.json'), '{"prompt":"fixture"}\n');
  fs.writeFileSync(responsePath, '{"text":"drifted"}\n');
  const attemptId = 'hash-drift-fixture';
  const ledger = [
    { type: 'launch_admitted', study_id: plan.id, spend_cap: 110 },
    { type: 'model_attempt_dispatch_reserved', attempt_id: attemptId, stage: 'generation' },
    { type: 'model_attempt_dispatch_started', attempt_id: attemptId },
    {
      type: 'attempt_response_persisted',
      attempt_id: attemptId,
      response_path: responsePath,
      response_sha256: '0'.repeat(64),
    },
    { type: 'attempt_completed', attempt_id: attemptId },
    { type: 'run_sealed', status: 'technical_failure', recovery_permitted: true },
  ];
  fs.writeFileSync(
    path.join(source, 'run-ledger.jsonl'),
    `${ledger.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
  assert.throws(() => readLearnerIterationRecovery(plan, source), /persisted response hash drift/iu);
});

test('learner iteration recovery identity covers registered character and measurement inputs', () => {
  const fixture = createDevelopmentAssessmentRecoveryFixture();
  const priorPlan = JSON.parse(fs.readFileSync(path.join(fixture.source, 'plan.json'), 'utf8'));
  priorPlan.development[0].character.goal = 'drifted goal';
  fs.writeFileSync(path.join(fixture.source, 'plan.json'), `${JSON.stringify(priorPlan, null, 2)}\n`);
  assert.throws(() => readLearnerIterationRecovery(plan, fixture.source), /recovery plan drift/iu);
});

function createDevelopmentAssessmentRecoveryFixture() {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-iteration-development-assessment-'));
  fs.writeFileSync(path.join(source, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  const d1 = writeCompletedDialogue(source, 'development', plan.development[0], plan.development[0].arms[0]);
  const d2 = writeCompletedDialogue(source, 'development', plan.development[1], plan.development[1].arms[0]);
  const d1Arm = readBenchmarkArm({
    ...plan.development[0].arms[0],
    path: path.join(source, 'development', 'D1', 'dialogue.json'),
  });
  const evaluationDir = path.join(source, 'development-evaluation', 'D1');
  fs.mkdirSync(evaluationDir, { recursive: true });
  const jobs = buildBenchmarkJobs([d1Arm], {
    extendedQuality: true,
    splitQuality: true,
    assessmentContext: plan.development[0].assessmentContext,
    publicSourceContextByArm: {
      D1: investedRivalDeliveredSourceContext(plan.development[0], d1Arm),
    },
  });
  const tutorJob = jobs.find((job) => job.kind === 'tutor');
  const tutorRaw = schemaFixture(tutorJob.outputSchema);
  const assessmentResponse = path.join(evaluationDir, 'D1-tutor.response.txt');
  fs.writeFileSync(path.join(evaluationDir, 'D1-tutor.prompt.txt'), tutorJob.prompt);
  fs.writeFileSync(path.join(evaluationDir, 'D1-tutor.schema.json'), `${JSON.stringify(tutorJob.outputSchema)}\n`);
  fs.writeFileSync(assessmentResponse, JSON.stringify(tutorRaw));
  fs.writeFileSync(path.join(evaluationDir, 'D1-tutor.json'), `${JSON.stringify(tutorRaw)}\n`);
  const responsePaths = [...d1.responsePaths, ...d2.responsePaths, assessmentResponse];
  const attemptEvents = responsePaths.flatMap((responsePath, index) =>
    acceptedAttemptEvents(responsePath, index + 1, index === responsePaths.length - 1 ? 'assessment' : 'generation'),
  );
  const ledger = [
    { type: 'launch_admitted', study_id: plan.id, spend_cap: 110 },
    ...attemptEvents,
    { type: 'run_sealed', status: 'technical_failure', recovery_permitted: true },
  ];
  fs.writeFileSync(
    path.join(source, 'run-ledger.jsonl'),
    `${ledger.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
  return { source, ledger };
}

test('learner iteration recovery preserves development assessments before holdout generation', () => {
  const fixture = createDevelopmentAssessmentRecoveryFixture();
  const recovery = readLearnerIterationRecovery(plan, fixture.source);
  assert.deepEqual(
    recovery.completed.map((target) => `${target.kind}/${target.arm.id}`),
    ['development/D1', 'development/D2'],
  );
  assert.equal(recovery.completedPackets, 1);
  assert.deepEqual(
    recovery.assessment.development.get('D1').priorScores.map((score) => `${score.arm}/${score.kind}`),
    ['D1/tutor'],
  );
  assert.equal(recovery.assessment.development.get('D2').completedPackets, 0);
  assert.equal(recovery.assessment.holdout.completedPackets, 0);
});

test('learner iteration recovery ignores an unjournaled assessment result and leaves the packet pending', () => {
  const fixture = createDevelopmentAssessmentRecoveryFixture();
  const assessmentReservation = fixture.ledger.find(
    (event) => event.type === 'model_attempt_dispatch_reserved' && event.stage === 'assessment',
  );
  const withoutAssessmentLifecycle = fixture.ledger.filter(
    (event) => event.attempt_id !== assessmentReservation.attempt_id,
  );
  fs.writeFileSync(
    path.join(fixture.source, 'run-ledger.jsonl'),
    `${withoutAssessmentLifecycle.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
  assert.equal(fs.existsSync(path.join(fixture.source, 'development-evaluation', 'D1', 'D1-tutor.json')), true);
  const recovery = readLearnerIterationRecovery(plan, fixture.source);
  assert.equal(recovery.assessment.development.get('D1').completedPackets, 0);
  assert.deepEqual(recovery.assessment.development.get('D1').priorScores, []);
  assert.equal(5 - recovery.assessment.development.get('D1').completedPackets, 5);
});

test('learner iteration recovery rejects holdout work before all development assessments', () => {
  const fixture = createDevelopmentAssessmentRecoveryFixture();
  const holdout = writeCompletedDialogue(fixture.source, 'holdout', plan.holdout, plan.holdout.arms[0]);
  const ledger = [...fixture.ledger];
  ledger.splice(
    -1,
    0,
    ...holdout.responsePaths.flatMap((responsePath, index) => acceptedAttemptEvents(responsePath, 20 + index)),
  );
  fs.writeFileSync(
    path.join(fixture.source, 'run-ledger.jsonl'),
    `${ledger.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
  assert.throws(
    () => readLearnerIterationRecovery(plan, fixture.source),
    /holdout work appears before development assessment is complete/iu,
  );
});

test('learner iteration workflow status projects units and calls through completion', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-iteration-workflow-'));
  let studyReserved = 0;
  const admission = {
    get studyReserved() {
      return studyReserved;
    },
  };
  const tracker = createLearnerIterationWorkflowTracker({
    plan,
    outDir,
    admission,
    at: '2026-09-03T12:00:00.000Z',
  });
  assert.equal(tracker.snapshot().current_phase, 'GENERATING');
  assert.deepEqual(tracker.snapshot().units, { complete: 0, active: 0, failed: 0, missing: 5 });
  let durableStatus = JSON.parse(fs.readFileSync(path.join(outDir, 'status.json'), 'utf8'));
  assert.equal(durableStatus.schema, 'machinespirits.durable-evaluation-status.v1');
  assert.deepEqual(Object.keys(durableStatus.planes), ['attempt', 'unit', 'workflow', 'scientific_verdict']);
  assert.equal(durableStatus.planes.workflow.state, 'running');
  assert.equal(durableStatus.planes.scientific_verdict.state, 'registered_measurement_pending');
  assert.equal(durableStatus.eta.basis, 'registered_remaining_turn_range_plus_zero_call_postrun');
  assert.deepEqual(
    {
      planned: durableStatus.planes.unit.planned,
      complete: durableStatus.planes.unit.complete,
      active: durableStatus.planes.unit.active,
      failed: durableStatus.planes.unit.failed,
      missing: durableStatus.planes.unit.missing,
    },
    { planned: 105, complete: 0, active: 0, failed: 0, missing: 105 },
  );
  for (let index = 0; index < 5; index += 1) {
    tracker.dialogueStarted();
    tracker.dialogueCompleted(10);
  }
  tracker.generationCompleted();
  assert.equal(tracker.snapshot().current_phase, 'AUDITING');
  durableStatus = tracker.durableSnapshot();
  assert.deepEqual(
    {
      planned: durableStatus.planes.unit.planned,
      complete: durableStatus.planes.unit.complete,
      active: durableStatus.planes.unit.active,
      failed: durableStatus.planes.unit.failed,
      missing: durableStatus.planes.unit.missing,
    },
    { planned: 25, complete: 0, active: 0, failed: 0, missing: 25 },
  );
  for (let index = 0; index < 25; index += 1) {
    studyReserved += 1;
    tracker.attemptStarted({ detail: { stage: 'assessment' } });
    tracker.attemptCompleted({ detail: { stage: 'assessment' }, durationMs: 10 });
  }
  tracker.assessmentCompleted();
  assert.equal(tracker.snapshot().current_phase, 'PACKAGING');
  tracker.packagingCompleted();
  const status = tracker.snapshot();
  assert.equal(status.current_phase, 'WORKFLOW_COMPLETE');
  assert.deepEqual(status.calls, { completed: 25, failed: 0, reserved: 25, hard_ceiling: 110 });
  assert.equal(fs.existsSync(path.join(outDir, 'workflow-status.json')), true);
  durableStatus = tracker.durableSnapshot();
  assert.equal(durableStatus.planes.workflow.state, 'complete');
  assert.equal(durableStatus.planes.scientific_verdict.state, 'descriptive_result_packaged');
  assert.equal(durableStatus.planes.attempt.active, 0);
  assert.equal(durableStatus.planes.attempt.unexplained, 0);
  assert.equal(durableStatus.planes.unit.active, 0);
  assert.equal(durableStatus.planes.unit.missing, 0);
  assert.equal(durableStatus.eta.basis, 'workflow_complete');
});

test('learner iteration four-plane status reads shared durable attempt unit ids', () => {
  const admission = makeAdmission();
  admission.ledger_path = admission.runLedgerPath;
  const budget = learnerIterationPaidBudget(admission, 110).scope('generation/development/D1');
  budget.reserve({ role: 'tutor_stub_auto_learner', turn: 1 });
  budget.markDispatched();
  const responsePath = path.join(admission.destination, '1-learner.response.json');
  fs.writeFileSync(responsePath, '{"text":"fixture"}\n');
  budget.persistResponse(responsePath);
  budget.complete();
  const tracker = createLearnerIterationWorkflowTracker({
    plan,
    outDir: admission.destination,
    admission,
    at: '2026-09-03T12:00:00.000Z',
  });
  const status = tracker.durableSnapshot();
  assert.deepEqual(status.planes.attempt, {
    reserved: 1,
    completed: 1,
    failed: 0,
    cancelled_before_dispatch: 0,
    interrupted_after_dispatch: 0,
    active: 0,
    unexplained: 0,
    hard_ceiling: 110,
  });
  assert.deepEqual(
    {
      planned: status.planes.unit.planned,
      complete: status.planes.unit.complete,
      active: status.planes.unit.active,
      failed: status.planes.unit.failed,
      missing: status.planes.unit.missing,
    },
    { planned: 105, complete: 1, active: 0, failed: 0, missing: 104 },
  );
  for (let index = 0; index < 5; index += 1) {
    tracker.dialogueStarted();
    tracker.dialogueCompleted(10);
  }
  tracker.generationCompleted();
  const auditingStatus = tracker.durableSnapshot();
  assert.deepEqual(
    {
      planned: auditingStatus.planes.unit.planned,
      complete: auditingStatus.planes.unit.complete,
      active: auditingStatus.planes.unit.active,
      failed: auditingStatus.planes.unit.failed,
      missing: auditingStatus.planes.unit.missing,
    },
    { planned: 26, complete: 1, active: 0, failed: 0, missing: 25 },
  );
});
