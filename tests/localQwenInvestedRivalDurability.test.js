import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { reconcileSharedModelAttemptLedger } from '../services/durableAttemptJournal.js';
import {
  buildInvestedRivalPlan,
  countInvestedRivalRunReservations,
  createInvestedRivalWorkflowTracker,
  investedRivalPaidBudget,
  readArmBoundaryRecovery,
  readDurableInvestedRivalRecovery,
} from '../scripts/run-local-qwen-invested-rival.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan = buildInvestedRivalPlan(root);

function makeAdmission() {
  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'local-qwen-invested-rival-durable-'));
  const destination = path.join(stateRoot, 'run');
  fs.mkdirSync(destination);
  const runLedgerPath = path.join(destination, 'run-ledger.jsonl');
  const studyLedgerPath = path.join(stateRoot, 'study-ledger.jsonl');
  fs.writeFileSync(runLedgerPath, '');
  fs.writeFileSync(studyLedgerPath, '');
  let capacitySequence = 0;
  const capacities = new Map();
  return {
    destination,
    runLedgerPath,
    studyLedgerPath,
    get studyReserved() {
      return events(studyLedgerPath).filter((event) => event.type === 'study_model_attempt_dispatch_reserved').length;
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

function events(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function reconcile(admission, unitId) {
  const reservation = events(admission.runLedgerPath).find(
    (event) => event.type === 'model_attempt_dispatch_reserved' && event.unit_id === unitId,
  );
  assert.ok(reservation);
  return reconcileSharedModelAttemptLedger({
    runLedgerPath: admission.runLedgerPath,
    studyLedgerPath: admission.studyLedgerPath,
    capacityId: reservation.capacity_id,
    unitId,
  });
}

test('local-Qwen invested-rival budget closes all four crash boundaries under its registered ceiling', () => {
  const beforeReservation = makeAdmission();
  assert.equal(events(beforeReservation.runLedgerPath).length, 0);

  const afterReservation = makeAdmission();
  investedRivalPaidBudget(afterReservation, plan.total_attempt_ceiling)
    .scope('generation/A')
    .reserve({ role: 'tutor_stub_auto_learner', turn: 1 });
  let reconciled = reconcile(afterReservation, 'generation/A/tutor_stub_auto_learner/1');
  assert.equal(reconciled.filter((event) => event.type === 'attempt_cancelled_before_dispatch').length, 1);

  const afterDispatch = makeAdmission();
  const dispatched = investedRivalPaidBudget(afterDispatch, plan.total_attempt_ceiling).scope('generation/A');
  dispatched.reserve({ role: 'tutor_stub_auto_learner', turn: 1 });
  dispatched.markDispatched();
  reconciled = reconcile(afterDispatch, 'generation/A/tutor_stub_auto_learner/1');
  assert.equal(reconciled.filter((event) => event.type === 'attempt_interrupted_after_dispatch').length, 1);

  const afterPersistence = makeAdmission();
  const persisted = investedRivalPaidBudget(afterPersistence, plan.total_attempt_ceiling).scope('generation/A');
  persisted.reserve({ role: 'tutor_stub_auto_learner', turn: 1 });
  persisted.markDispatched();
  const responsePath = path.join(afterPersistence.destination, '1-learner.response.json');
  fs.writeFileSync(
    responsePath,
    `${JSON.stringify({ text: '{"settled":[],"open":[],"speech":"saved","end_dialogue":false}' })}\n`,
  );
  persisted.persistResponse(responsePath);
  reconciled = reconcile(afterPersistence, 'generation/A/tutor_stub_auto_learner/1');
  assert.equal(reconciled.filter((event) => event.type === 'attempt_completed').length, 1);
  assert.equal(reconciled.filter((event) => event.type === 'model_attempt_dispatch_reserved').length, 1);
  assert.equal(afterPersistence.studyReserved, 1);

  const completed = makeAdmission();
  const budget = investedRivalPaidBudget(completed, plan.total_attempt_ceiling).scope('assessment/A/tutor');
  budget.reserve({ role: 'local-qwen-benchmark-tutor' });
  budget.markDispatched();
  const scorePath = path.join(completed.destination, 'A-tutor.response.txt');
  fs.writeFileSync(scorePath, '{"score":1}\n');
  budget.persistResponse(scorePath);
  budget.complete();
  const completedEvents = events(completed.runLedgerPath);
  assert.equal(completedEvents.filter((event) => event.type === 'attempt_completed').length, 1);
  assert.equal(completedEvents.filter((event) => event.type === 'model_attempt_capacity_released').length, 0);

  assert.deepEqual(
    {
      design: plan.design,
      generation: plan.generationCap,
      assessment: plan.judge_calls,
      recovery: plan.recovery_attempt_reserve,
      total: plan.total_attempt_ceiling,
      completionTotal: plan.completion_attempt_ceiling,
      completionRecovery: plan.completion_recovery_attempt_ceiling,
    },
    {
      design: 'notes/qwen-invested-rival-theorist-v1-design.md',
      generation: 32,
      assessment: 8,
      recovery: 8,
      total: 48,
      completionTotal: 50,
      completionRecovery: 2,
    },
  );
});

test('local-Qwen invested-rival linked recovery counts preserved attempts without widening the ceiling', () => {
  let studyReserved = 0;
  const admission = {
    get studyReserved() {
      return studyReserved;
    },
    reserveModelAttempts() {
      studyReserved += 1;
      return { study_reserved: studyReserved, remaining: 48 - studyReserved };
    },
  };
  const budget = investedRivalPaidBudget(admission, plan.total_attempt_ceiling, 40);
  for (let call = 41; call <= 48; call += 1) {
    assert.equal(budget.reserve({ role: 'recovery' }).call, call);
    budget.complete();
  }
  assert.deepEqual(budget.snapshot(), { used: 48, limit: 48 });
  assert.throws(() => budget.reserve({ role: 'recovery' }), /49\/48/u);
});

test('local-Qwen workflow status starts from the fresh durable ledger', (t) => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-qwen-invested-rival-status-fresh-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  const ledgerPath = path.join(outDir, 'run-ledger.jsonl');
  fs.writeFileSync(ledgerPath, '');
  createInvestedRivalWorkflowTracker({
    plan,
    outDir,
    admission: { ledger_path: ledgerPath, studyReserved: 0 },
    at: new Date('2026-09-03T12:00:00.000Z'),
  });
  const status = JSON.parse(fs.readFileSync(path.join(outDir, 'workflow-status.json'), 'utf8'));
  assert.equal(status.current_phase, 'GENERATING');
  assert.deepEqual(status.units, { complete: 0, active: 0, failed: 0, missing: 2 });
  assert.deepEqual(status.calls, { completed: 0, failed: 0, reserved: 0, hard_ceiling: 48 });
  assert.equal(status.model_activity.state, 'inactive');
  assert.equal(status.repair_or_recovery_history.length, 0);
  const durable = JSON.parse(fs.readFileSync(path.join(outDir, 'status.json'), 'utf8'));
  assert.equal(durable.schema, 'machinespirits.durable-evaluation-status.v1');
  assert.equal(durable.planes.attempt.hard_ceiling, 48);
  assert.deepEqual(durable.planes.unit, {
    planned: 40,
    complete: 0,
    active: 0,
    failed: 0,
    missing: 40,
    completed_turns: 0,
    planned_turns: 32,
  });
  assert.equal(durable.planes.workflow.state, 'running');
  assert.equal(durable.planes.scientific_verdict.state, 'registered_measurement_pending');
  assert.equal(durable.eta.basis, 'registered_remaining_turn_range_plus_zero_call_postrun');
});

test('local-Qwen recovery status preserves cumulative attempts and exposes only missing assessment packets', (t) => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-qwen-invested-rival-status-recovery-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  const ledgerPath = path.join(outDir, 'run-ledger.jsonl');
  fs.writeFileSync(ledgerPath, '');
  const tracker = createInvestedRivalWorkflowTracker({
    plan,
    outDir,
    admission: { ledger_path: ledgerPath, studyReserved: 0 },
    recovery: true,
    priorAttemptBase: 37,
    completedArms: 2,
    completedAssessments: 3,
    baselineCompletedCalls: 35,
    baselineFailedCalls: 2,
    at: new Date('2026-09-03T12:00:00.000Z'),
  });
  tracker.generationCompleted();
  const status = JSON.parse(fs.readFileSync(path.join(outDir, 'workflow-status.json'), 'utf8'));
  assert.equal(status.current_phase, 'AUDITING');
  assert.deepEqual(status.units, { complete: 3, active: 0, failed: 0, missing: 5 });
  assert.deepEqual(status.calls, { completed: 35, failed: 2, reserved: 37, hard_ceiling: 48 });
  assert.equal(status.model_activity.state, 'inactive');
  assert.equal(status.repair_or_recovery_history.length, 1);
});

test('local-Qwen packaged status has no active or missing current-work units', (t) => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-qwen-invested-rival-status-complete-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  const ledgerPath = path.join(outDir, 'run-ledger.jsonl');
  fs.writeFileSync(ledgerPath, '');
  const tracker = createInvestedRivalWorkflowTracker({
    plan,
    outDir,
    admission: { ledger_path: ledgerPath, studyReserved: 0 },
    completedArms: 2,
    completedAssessments: plan.judge_calls,
  });
  tracker.generationCompleted();
  tracker.assessmentCompleted();
  tracker.packagingCompleted();
  const durable = JSON.parse(fs.readFileSync(path.join(outDir, 'status.json'), 'utf8'));
  assert.equal(durable.planes.workflow.state, 'complete');
  assert.equal(durable.planes.unit.active, 0);
  assert.equal(durable.planes.unit.missing, 0);
  assert.equal(durable.planes.scientific_verdict.state, 'descriptive_result_packaged');
  assert.equal(durable.eta.basis, 'workflow_complete');
});

test('local-Qwen arm-boundary recovery reads durable reservations without counting lifecycle mirrors', (t) => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-qwen-durable-arm-recovery-'));
  t.after(() => fs.rmSync(sourceDir, { recursive: true, force: true }));
  const armDir = path.join(sourceDir, 'A');
  fs.mkdirSync(armDir);
  fs.writeFileSync(
    path.join(sourceDir, 'plan.json'),
    JSON.stringify({
      id: plan.id,
      provenance: {
        recovery: true,
        linkedRecoveryStudyId: `${plan.id}-generation-recovery-v1`,
        priorAttemptCount: 1,
      },
    }),
  );
  fs.writeFileSync(
    path.join(sourceDir, 'stopped.json'),
    JSON.stringify({
      error: 'loaded model does not exactly match the planned arm',
      budget: { used: 16, limit: 48 },
      armsCompleted: 1,
    }),
  );
  const lifecycle = Array.from({ length: 15 }, (_, index) => {
    const attemptId = `generation/A/fixture/${index + 1}`;
    return [
      { type: 'model_attempt_dispatch_reserved', attempt_id: attemptId },
      { type: 'model_attempt_dispatch_started', attempt_id: attemptId },
      { type: 'attempt_response_persisted', attempt_id: attemptId },
      { type: 'attempt_completed', attempt_id: attemptId },
    ];
  }).flat();
  fs.writeFileSync(
    path.join(sourceDir, 'run-ledger.jsonl'),
    `${lifecycle.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
  const tracePath = path.join(armDir, 'trace.jsonl');
  fs.writeFileSync(
    tracePath,
    `${JSON.stringify({ at: '2026-09-03T12:00:00.000Z', type: 'tutor_opening', text: 'Opening' })}\n`,
  );
  fs.writeFileSync(
    path.join(armDir, 'dialogue.json'),
    JSON.stringify({
      turns: Array.from({ length: 8 }, (_, index) => ({
        turn: index + 1,
        learner: `Learner ${index + 1}`,
        tutor: `Tutor ${index + 1}`,
      })),
      trace: tracePath,
      disposition: 'exchange_cap',
      proofControl: { releasedPremiseIds: [] },
    }),
  );

  assert.equal(countInvestedRivalRunReservations(lifecycle), 15);
  assert.equal(
    countInvestedRivalRunReservations([
      { type: 'model_attempt_reserved', count: 2 },
      { type: 'model_attempt_dispatch_reserved' },
      { type: 'study_model_attempt_dispatch_reserved' },
      { type: 'model_attempt_dispatch_started' },
    ]),
    3,
  );
  const recovery = readArmBoundaryRecovery(plan, sourceDir);
  assert.equal(recovery.priorArms.length, 1);
  assert.equal(recovery.priorArms[0].snapshot.turns.length, 8);
});

function durableRecoveryFixture(t, boundary) {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), `local-qwen-generic-recovery-${boundary}-`));
  t.after(() => fs.rmSync(sourceDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(sourceDir, 'plan.json'), JSON.stringify({ ...plan, provenance: { fixture: true } }));
  const events = [{ type: 'launch_admitted', study_id: plan.id, spend_cap: plan.total_attempt_ceiling }];
  if (boundary !== 'before-reservation') {
    const attemptId = 'generation/A/tutor_stub_auto_learner/1:1:fixture';
    events.push({
      type: 'model_attempt_dispatch_reserved',
      attempt_id: attemptId,
      unit_id: 'generation/A/tutor_stub_auto_learner/1',
    });
    if (boundary === 'after-reservation') {
      events.push({ type: 'attempt_cancelled_before_dispatch', attempt_id: attemptId });
    } else {
      events.push({ type: 'model_attempt_dispatch_started', attempt_id: attemptId });
      if (boundary === 'after-dispatch') {
        events.push({ type: 'attempt_interrupted_after_dispatch', attempt_id: attemptId });
      } else {
        const armDir = path.join(sourceDir, 'A');
        fs.mkdirSync(armDir);
        fs.writeFileSync(path.join(armDir, '1-learner.request.json'), '{}\n');
        const responsePath = path.join(armDir, '1-learner.response.json');
        fs.writeFileSync(responsePath, '{"text":"durably accepted"}\n');
        events.push({
          type: 'attempt_response_persisted',
          attempt_id: attemptId,
          response_path: responsePath,
          response_sha256: crypto.createHash('sha256').update(fs.readFileSync(responsePath)).digest('hex'),
        });
        events.push({ type: 'attempt_completed', attempt_id: attemptId });
      }
    }
  }
  events.push({
    type: 'run_sealed',
    status: 'technical_failure',
    recovery_permitted: true,
    study_reserved: boundary === 'before-reservation' ? 0 : 1,
  });
  fs.writeFileSync(path.join(sourceDir, 'run-ledger.jsonl'), `${events.map(JSON.stringify).join('\n')}\n`);
  return sourceDir;
}

test('generic local-Qwen recovery covers all crash boundaries and reuses only ledger-accepted output', (t) => {
  const before = readDurableInvestedRivalRecovery(plan, durableRecoveryFixture(t, 'before-reservation'));
  assert.equal(before.stop.budget.used, 0);
  assert.equal(before.partial, null);

  const reserved = readDurableInvestedRivalRecovery(plan, durableRecoveryFixture(t, 'after-reservation'));
  assert.equal(reserved.responseFreeAttempts, 1);
  assert.equal(reserved.partial, null);

  const dispatched = readDurableInvestedRivalRecovery(plan, durableRecoveryFixture(t, 'after-dispatch'));
  assert.equal(dispatched.responseFreeAttempts, 1);
  assert.equal(dispatched.partial, null);

  const persistedSource = durableRecoveryFixture(t, 'after-persistence');
  const persisted = readDurableInvestedRivalRecovery(plan, persistedSource);
  assert.equal(persisted.responseFreeAttempts, 0);
  assert.equal(persisted.partial.armId, 'A');
  assert.deepEqual(Object.keys(persisted.partial.savedReplies), ['1-learner']);

  fs.writeFileSync(path.join(persistedSource, 'A', '1-tutor.request.json'), '{}\n');
  fs.writeFileSync(path.join(persistedSource, 'A', '1-tutor.response.json'), '{"text":"unjournaled"}\n');
  const ignored = readDurableInvestedRivalRecovery(plan, persistedSource);
  assert.deepEqual(Object.keys(ignored.partial.savedReplies), ['1-learner']);
});

test('generic local-Qwen recovery rejects hash drift in a completed response', (t) => {
  const sourceDir = durableRecoveryFixture(t, 'after-persistence');
  fs.appendFileSync(path.join(sourceDir, 'A', '1-learner.response.json'), 'tamper');
  assert.throws(() => readDurableInvestedRivalRecovery(plan, sourceDir), /response hash drift/u);
});
