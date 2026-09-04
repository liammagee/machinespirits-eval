import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildDurableEvaluationStatus, reconcileSharedModelAttemptLedger } from '../services/durableAttemptJournal.js';
import {
  buildLunaReferencePlan,
  createLunaReferenceWorkflowTracker,
  lunaReferencePaidBudget,
  readLunaReferenceRecovery,
} from '../scripts/run-invested-rival-luna-reference.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan = buildLunaReferencePlan(root);

function makeAdmission(t) {
  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-durable-budget-'));
  t.after(() => fs.rmSync(stateRoot, { recursive: true, force: true }));
  const destination = path.join(stateRoot, 'run');
  fs.mkdirSync(destination);
  const runLedgerPath = path.join(destination, 'run-ledger.jsonl');
  const studyLedgerPath = path.join(stateRoot, 'study-ledger.jsonl');
  fs.writeFileSync(runLedgerPath, '');
  fs.writeFileSync(studyLedgerPath, '');
  let capacitySequence = 0;
  return {
    destination,
    runLedgerPath,
    studyLedgerPath,
    get studyReserved() {
      return readEvents(studyLedgerPath).filter((event) => event.type === 'study_model_attempt_dispatch_reserved')
        .length;
    },
    allocateModelAttemptCapacity(count, detail) {
      return { id: `capacity-${++capacitySequence}`, count, detail };
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
    releaseModelAttemptCapacity() {},
  };
}

function readEvents(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function reconcile(admission, unitId) {
  const reservation = readEvents(admission.runLedgerPath).find(
    (event) => event.type === 'model_attempt_dispatch_reserved',
  );
  return reconcileSharedModelAttemptLedger({
    runLedgerPath: admission.runLedgerPath,
    studyLedgerPath: admission.studyLedgerPath,
    capacityId: reservation.capacity_id,
    unitId,
  });
}

test('Luna paid budget durably reconciles all four crash boundaries under the registered design', (t) => {
  const beforeReservation = makeAdmission(t);
  assert.equal(readEvents(beforeReservation.runLedgerPath).length, 0);

  const unitId = 'generation/C/tutor_stub_auto_learner/1';
  const afterReservation = makeAdmission(t);
  lunaReferencePaidBudget(afterReservation, plan.total_attempt_ceiling)
    .scope('generation/C')
    .reserve({ role: 'tutor_stub_auto_learner', turn: 1 });
  let events = reconcile(afterReservation, unitId);
  assert.equal(events.filter((event) => event.type === 'attempt_cancelled_before_dispatch').length, 1);

  const afterDispatch = makeAdmission(t);
  const dispatched = lunaReferencePaidBudget(afterDispatch, plan.total_attempt_ceiling).scope('generation/C');
  dispatched.reserve({ role: 'tutor_stub_auto_learner', turn: 1 });
  dispatched.markDispatched();
  events = reconcile(afterDispatch, unitId);
  assert.equal(events.filter((event) => event.type === 'attempt_interrupted_after_dispatch').length, 1);

  const afterPersistence = makeAdmission(t);
  const persisted = lunaReferencePaidBudget(afterPersistence, plan.total_attempt_ceiling).scope('generation/C');
  persisted.reserve({ role: 'tutor_stub_auto_learner', turn: 1 });
  persisted.markDispatched();
  const responsePath = path.join(afterPersistence.destination, '1-learner.response.json');
  fs.writeFileSync(responsePath, `${JSON.stringify({ text: 'preserved response' })}\n`);
  persisted.persistResponse(responsePath);
  events = reconcile(afterPersistence, unitId);
  assert.equal(events.filter((event) => event.type === 'attempt_completed').length, 1);
  assert.equal(events.filter((event) => event.type === 'model_attempt_dispatch_reserved').length, 1);
  assert.equal(events.filter((event) => event.type.startsWith('attempt_')).length, 2);

  assert.deepEqual(
    {
      design: plan.design,
      learner: plan.models.learner,
      tutor: plan.models.tutor,
      judge: plan.models.judge,
      generation: plan.generationCap,
      assessment: plan.judge_calls,
      recovery: plan.recovery_attempt_reserve,
      total: plan.total_attempt_ceiling,
    },
    {
      design: 'notes/invested-rival-luna-reference-v1-design.md',
      learner: 'codex.gpt-5.6-luna',
      tutor: 'codex.gpt-5.6-sol',
      judge: 'claude-code.claude-opus-5',
      generation: 16,
      assessment: 5,
      recovery: 2,
      total: 23,
    },
  );
});

test('Luna recovery accepts a reconciled saved response and resumes only the missing suffix', (t) => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-durable-recovery-'));
  t.after(() => fs.rmSync(source, { recursive: true, force: true }));
  fs.writeFileSync(path.join(source, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  const armDir = path.join(source, 'C');
  fs.mkdirSync(armDir);
  fs.writeFileSync(path.join(armDir, '1-learner.request.json'), `${JSON.stringify({ prompt: 'fixed' })}\n`);
  const responsePath = path.join(armDir, '1-learner.response.json');
  fs.writeFileSync(responsePath, `${JSON.stringify({ text: 'saved' })}\n`);
  const responseSha256 = crypto.createHash('sha256').update(fs.readFileSync(responsePath)).digest('hex');
  const attemptId = 'generation/C/tutor_stub_auto_learner/1:1:fixture';
  const events = [
    { type: 'launch_admitted', study_id: plan.id, spend_cap: plan.total_attempt_ceiling },
    {
      type: 'model_attempt_dispatch_reserved',
      attempt_id: attemptId,
      unit_id: 'generation/C/tutor_stub_auto_learner/1',
      capacity_id: 'fixture-capacity',
    },
    { type: 'model_attempt_dispatch_started', attempt_id: attemptId },
    {
      type: 'attempt_response_persisted',
      attempt_id: attemptId,
      response_path: responsePath,
      response_sha256: responseSha256,
    },
    { type: 'attempt_completed', attempt_id: attemptId },
    {
      type: 'run_sealed',
      status: 'technical_failure',
      recovery_permitted: true,
      reserved_attempts: 1,
      study_reserved: 1,
    },
  ];
  fs.writeFileSync(
    path.join(source, 'run-ledger.jsonl'),
    `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );

  const recovery = readLunaReferenceRecovery(plan, source);
  assert.equal(recovery.priorAttempts, 1);
  assert.equal(recovery.completedGeneration, false);
  assert.deepEqual(Object.keys(recovery.savedReplies), ['1-learner']);
  assert.equal(recovery.generationResponses, 1);
  assert.equal(recovery.responseFreeAttempts, 0);
});

test('Luna recovery identity rejects drift anywhere in the registered prompt and measurement plan', (t) => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-recovery-plan-identity-'));
  t.after(() => fs.rmSync(source, { recursive: true, force: true }));
  const mutations = [
    ['tutor prompt', (candidate) => (candidate.tutor = `${candidate.tutor}\nDrift.`)],
    ['assessment context', (candidate) => (candidate.assessmentContext.topic = 'Changed construct')],
    ['Luna arm', (candidate) => (candidate.lunaArm.mode = 'ego_superego')],
    ['assessment instrument', (candidate) => (candidate.assessment.extended_quality = false)],
    ['generation limit', (candidate) => (candidate.max_tokens += 1)],
    ['report projection', (candidate) => (candidate.reportMeta.headline = 'Changed framing')],
  ];
  for (const [label, mutate] of mutations) {
    const candidate = structuredClone(plan);
    mutate(candidate);
    fs.writeFileSync(path.join(source, 'plan.json'), `${JSON.stringify(candidate, null, 2)}\n`);
    assert.throws(() => readLunaReferenceRecovery(plan, source), /Luna recovery plan drift/u, label);
  }

  fs.writeFileSync(
    path.join(source, 'plan.json'),
    `${JSON.stringify(
      {
        ...plan,
        sealedQwenReferenceRoot: '/private/output-specific/reference',
        provenance: { recovery: null, launch_commit: 'recorded-not-enforced' },
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    path.join(source, 'run-ledger.jsonl'),
    `${JSON.stringify({ type: 'launch_admitted', study_id: plan.id, spend_cap: 23 })}\n${JSON.stringify({
      type: 'run_sealed',
      status: 'technical_failure',
      recovery_permitted: true,
      study_reserved: 0,
    })}\n`,
  );
  assert.doesNotThrow(() => readLunaReferenceRecovery(plan, source));
});

test('durable status does not infer live provider activity from stale attempt state', () => {
  const reservation = {
    type: 'model_attempt_dispatch_reserved',
    attempt_id: 'attempt-1',
    unit_id: 'generation/C/tutor_stub_auto_learner/1',
  };
  const base = {
    plannedUnits: 1,
    plannedTurns: 1,
    completedTurns: 0,
    hardCeiling: 23,
    now: new Date('2026-09-03T12:00:00.000Z'),
  };
  assert.equal(
    buildDurableEvaluationStatus({ ...base, events: [reservation] }).planes.workflow.model_activity,
    'inactive',
  );
  assert.equal(
    buildDurableEvaluationStatus({
      ...base,
      events: [reservation, { type: 'model_attempt_dispatch_started', attempt_id: 'attempt-1' }],
    }).planes.workflow.model_activity,
    'unverifiable',
  );
  assert.equal(
    buildDurableEvaluationStatus({ ...base, events: [reservation], modelActivity: 'active' }).planes.workflow
      .model_activity,
    'active',
  );
});

test('Luna recovery ignores an unjournaled response file at the first missing call', (t) => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-unjournaled-response-'));
  t.after(() => fs.rmSync(source, { recursive: true, force: true }));
  fs.writeFileSync(path.join(source, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  const armDir = path.join(source, 'C');
  fs.mkdirSync(armDir);
  fs.writeFileSync(path.join(armDir, '1-learner.request.json'), '{}\n');
  fs.writeFileSync(path.join(armDir, '1-learner.response.json'), '{"text":"not durable"}\n');
  fs.writeFileSync(
    path.join(source, 'run-ledger.jsonl'),
    `${JSON.stringify({ type: 'launch_admitted', study_id: plan.id, spend_cap: 23 })}\n${JSON.stringify({
      type: 'run_sealed',
      status: 'technical_failure',
      recovery_permitted: true,
      reserved_attempts: 0,
      study_reserved: 0,
    })}\n`,
  );
  const recovery = readLunaReferenceRecovery(plan, source);
  assert.deepEqual(recovery.savedReplies, {});
  assert.equal(recovery.generationResponses, 0);
});

test('Luna recovery rejects hash drift in a ledger-completed response', (t) => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-response-hash-drift-'));
  t.after(() => fs.rmSync(source, { recursive: true, force: true }));
  fs.writeFileSync(path.join(source, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  const armDir = path.join(source, 'C');
  fs.mkdirSync(armDir);
  const responsePath = path.join(armDir, '1-learner.response.json');
  fs.writeFileSync(path.join(armDir, '1-learner.request.json'), '{}\n');
  fs.writeFileSync(responsePath, '{"text":"tampered"}\n');
  const attemptId = 'generation/C/tutor_stub_auto_learner/1:1:drift';
  const events = [
    { type: 'launch_admitted', study_id: plan.id, spend_cap: 23 },
    { type: 'model_attempt_dispatch_reserved', attempt_id: attemptId },
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
  fs.writeFileSync(path.join(source, 'run-ledger.jsonl'), `${events.map(JSON.stringify).join('\n')}\n`);
  assert.throws(() => readLunaReferenceRecovery(plan, source), /response hash drift/u);
});

test('Luna workflow status derives recovery units and call counts from the durable ledger state', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-workflow-status-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outDir = path.join(root, 'current');
  const source = path.join(root, 'source');
  fs.mkdirSync(outDir);
  fs.mkdirSync(source);
  const ledgerPath = path.join(outDir, 'run-ledger.jsonl');
  fs.writeFileSync(ledgerPath, '');
  fs.writeFileSync(
    path.join(source, 'run-ledger.jsonl'),
    `${[
      {
        type: 'model_attempt_dispatch_reserved',
        attempt_id: 'predecessor-attempt',
        unit_id: 'generation/C/tutor_stub_auto_learner/1',
      },
      {
        type: 'attempt_completed',
        attempt_id: 'predecessor-attempt',
        unit_id: 'generation/C/tutor_stub_auto_learner/1',
      },
    ]
      .map(JSON.stringify)
      .join('\n')}\n`,
  );
  createLunaReferenceWorkflowTracker({
    plan,
    outDir,
    admission: { ledger_path: ledgerPath, studyReserved: 1 },
    recovery: {
      source,
      completedGeneration: false,
      generationResponses: 1,
      responseFreeAttempts: 0,
      assessment: null,
    },
    at: new Date('2026-09-03T12:00:00.000Z'),
  });
  const status = JSON.parse(fs.readFileSync(path.join(outDir, 'workflow-status.json'), 'utf8'));
  assert.equal(status.current_phase, 'GENERATING');
  assert.deepEqual(status.units, { complete: 0, active: 0, failed: 0, missing: 1 });
  assert.deepEqual(status.calls, { completed: 1, failed: 0, reserved: 1, hard_ceiling: 23 });
  assert.equal(status.model_activity.state, 'inactive');
  assert.equal(status.repair_or_recovery_history.length, 1);
  const durable = JSON.parse(fs.readFileSync(path.join(outDir, 'status.json'), 'utf8'));
  assert.equal(durable.schema, 'machinespirits.durable-evaluation-status.v1');
  assert.deepEqual(durable.planes.attempt, {
    reserved: 1,
    completed: 1,
    failed: 0,
    cancelled_before_dispatch: 0,
    interrupted_after_dispatch: 0,
    active: 0,
    unexplained: 0,
    hard_ceiling: 23,
  });
  assert.equal(durable.planes.unit.complete, 1);
  assert.equal(durable.planes.unit.missing, 20);
  assert.equal(durable.planes.workflow.state, 'running');
  assert.equal(durable.planes.scientific_verdict.state, 'registered_measurement_pending');
  assert.equal(durable.eta.basis, 'registered_remaining_turn_range_plus_zero_call_postrun');

  const completeDir = path.join(root, 'complete');
  fs.mkdirSync(completeDir);
  const completeLedger = path.join(completeDir, 'run-ledger.jsonl');
  fs.writeFileSync(completeLedger, '');
  const completeTracker = createLunaReferenceWorkflowTracker({
    plan,
    outDir: completeDir,
    admission: { ledger_path: completeLedger, studyReserved: 0 },
    recovery: {
      completedGeneration: true,
      generationResponses: 0,
      responseFreeAttempts: 0,
      assessment: { completedPackets: plan.judge_calls },
    },
  });
  completeTracker.generationCompleted();
  completeTracker.assessmentCompleted();
  completeTracker.packagingCompleted();
  const packaged = JSON.parse(fs.readFileSync(path.join(completeDir, 'status.json'), 'utf8'));
  assert.equal(packaged.planes.workflow.state, 'complete');
  assert.equal(packaged.planes.unit.active, 0);
  assert.equal(packaged.planes.unit.missing, 0);
  assert.equal(packaged.planes.scientific_verdict.state, 'descriptive_result_packaged');
});
