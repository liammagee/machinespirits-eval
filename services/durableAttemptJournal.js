import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const DURABLE_ATTEMPT_TERMINAL_DISPOSITIONS = Object.freeze([
  'completed',
  'failed',
  'cancelled_before_dispatch',
  'interrupted_after_dispatch',
]);

const TERMINAL_EVENT_BY_DISPOSITION = Object.freeze({
  completed: 'attempt_completed',
  failed: 'attempt_failed',
  cancelled_before_dispatch: 'attempt_cancelled_before_dispatch',
  interrupted_after_dispatch: 'attempt_interrupted_after_dispatch',
});

function appendDurableJsonLine(filePath, event) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const descriptor = fs.openSync(filePath, 'a');
  try {
    fs.writeSync(descriptor, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function readEvents(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  const descriptor = fs.openSync(temporary, 'wx');
  try {
    fs.writeSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(temporary, filePath);
  const directory = fs.openSync(path.dirname(filePath), 'r');
  try {
    fs.fsyncSync(directory);
  } finally {
    fs.closeSync(directory);
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sleepSync(milliseconds) {
  const buffer = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(buffer, 0, 0, milliseconds);
}

function withDirectoryLock(lockPath, callback) {
  const deadline = Date.now() + 30_000;
  while (true) {
    try {
      fs.mkdirSync(lockPath);
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST' || Date.now() >= deadline) throw error;
      sleepSync(10);
    }
  }
  try {
    return callback();
  } finally {
    fs.rmdirSync(lockPath);
  }
}

export function reconcileSharedModelAttemptLedger({
  runLedgerPath,
  studyLedgerPath,
  capacityId,
  unitId,
  lockPath = `${studyLedgerPath}.attempt-lock`,
} = {}) {
  return withDirectoryLock(lockPath, () => {
    const studyReservations = readEvents(studyLedgerPath).filter(
      (event) => event.type === 'study_model_attempt_dispatch_reserved' && event.capacity_id === capacityId,
    );
    let runEvents = readEvents(runLedgerPath);
    for (const reservation of studyReservations) {
      if (
        !runEvents.some(
          (event) => event.type === 'model_attempt_dispatch_reserved' && event.attempt_id === reservation.attempt_id,
        )
      ) {
        appendDurableJsonLine(runLedgerPath, {
          ...reservation,
          type: 'model_attempt_dispatch_reserved',
          recovered_study_reservation_mirror: true,
        });
      }
    }
    runEvents = readEvents(runLedgerPath);
    const terminalTypes = new Set(Object.values(TERMINAL_EVENT_BY_DISPOSITION));
    for (const reservation of runEvents.filter(
      (event) => event.type === 'model_attempt_dispatch_reserved' && event.capacity_id === capacityId,
    )) {
      if (runEvents.some((event) => terminalTypes.has(event.type) && event.attempt_id === reservation.attempt_id)) {
        continue;
      }
      const dispatched = runEvents.some(
        (event) => event.type === 'model_attempt_dispatch_started' && event.attempt_id === reservation.attempt_id,
      );
      appendDurableJsonLine(runLedgerPath, {
        type: dispatched ? 'attempt_interrupted_after_dispatch' : 'attempt_cancelled_before_dispatch',
        attempt_id: reservation.attempt_id,
        unit_id: unitId,
        capacity_id: capacityId,
        reconciled_on_restart: true,
      });
    }
    return readEvents(runLedgerPath);
  });
}

export function createSharedModelAttemptLedgerClient({
  runLedgerPath,
  studyLedgerPath,
  studyId,
  destination,
  hardCeiling,
  unitId,
  capacityId,
  capacityLimit,
  lockPath = `${studyLedgerPath}.attempt-lock`,
} = {}) {
  if (![runLedgerPath, studyLedgerPath, destination].every((value) => path.isAbsolute(value || ''))) {
    throw new Error('shared attempt ledger paths and destination must be absolute');
  }
  if (!studyId || !unitId || !capacityId) throw new Error('shared attempt ledger identity is incomplete');
  if (!Number.isInteger(hardCeiling) || hardCeiling < 1 || !Number.isInteger(capacityLimit) || capacityLimit < 1) {
    throw new Error('shared attempt ledger ceilings must be positive integers');
  }
  reconcileSharedModelAttemptLedger({ runLedgerPath, studyLedgerPath, capacityId, unitId, lockPath });
  const terminalTypes = new Set(Object.values(TERMINAL_EVENT_BY_DISPOSITION));
  return Object.freeze({
    reserve({ role = 'unknown', turn = null } = {}) {
      return withDirectoryLock(lockPath, () => {
        const studyEvents = readEvents(studyLedgerPath);
        const studyReservations = studyEvents.filter((event) => event.type === 'study_model_attempt_dispatch_reserved');
        const capacityReservations = studyReservations.filter((event) => event.capacity_id === capacityId);
        if (studyReservations.length >= hardCeiling) {
          throw new Error(
            `paid study attempt ceiling exhausted before dispatch: ${studyReservations.length}/${hardCeiling}`,
          );
        }
        if (capacityReservations.length >= capacityLimit) {
          throw new Error(`unit ${unitId} attempt capacity exhausted before dispatch`);
        }
        const attemptId = `${unitId}:${capacityReservations.length + 1}:${randomUUID()}`;
        const event = {
          type: 'model_attempt_dispatch_reserved',
          attempt_id: attemptId,
          study_id: studyId,
          destination,
          unit_id: unitId,
          capacity_id: capacityId,
          role,
          turn,
          study_reserved: studyReservations.length + 1,
          hard_ceiling: hardCeiling,
        };
        appendDurableJsonLine(studyLedgerPath, { ...event, type: 'study_model_attempt_dispatch_reserved' });
        appendDurableJsonLine(runLedgerPath, event);
        return Object.freeze({ attemptId, role, turn, call: capacityReservations.length + 1, limit: capacityLimit });
      });
    },
    markDispatched({ attemptId, role = 'unknown', turn = null } = {}) {
      appendDurableJsonLine(runLedgerPath, {
        type: 'model_attempt_dispatch_started',
        attempt_id: attemptId,
        unit_id: unitId,
        capacity_id: capacityId,
        role,
        turn,
      });
    },
    terminalize({ attemptId, disposition, role = 'unknown', turn = null, traceSequence = null } = {}) {
      if (!DURABLE_ATTEMPT_TERMINAL_DISPOSITIONS.includes(disposition)) {
        throw new Error(`invalid terminal model-attempt disposition ${disposition}`);
      }
      return withDirectoryLock(lockPath, () => {
        const runEvents = readEvents(runLedgerPath);
        const reservation = runEvents.find(
          (event) => event.type === 'model_attempt_dispatch_reserved' && event.attempt_id === attemptId,
        );
        const terminals = runEvents.filter((event) => terminalTypes.has(event.type) && event.attempt_id === attemptId);
        if (!reservation) throw new Error(`attempt ${attemptId} has no durable reservation`);
        if (terminals.length) throw new Error(`attempt ${attemptId} already has a terminal disposition`);
        appendDurableJsonLine(runLedgerPath, {
          type: TERMINAL_EVENT_BY_DISPOSITION[disposition],
          attempt_id: attemptId,
          unit_id: unitId,
          capacity_id: capacityId,
          role,
          turn,
          trace_sequence: traceSequence,
        });
      });
    },
  });
}

export function sharedModelAttemptLedgerClientFromEnv(env = process.env) {
  if (!env.TUTOR_STUB_SHARED_ATTEMPT_LEDGER) return null;
  const config = JSON.parse(env.TUTOR_STUB_SHARED_ATTEMPT_LEDGER);
  return createSharedModelAttemptLedgerClient(config);
}

export function summarizeDurableAttemptEvents(events) {
  const attempts = new Map();
  for (const event of events) {
    if (event.type === 'attempt_reserved') {
      if (!event.attempt_id || attempts.has(event.attempt_id))
        throw new Error('duplicate or missing attempt reservation id');
      attempts.set(event.attempt_id, {
        attemptId: event.attempt_id,
        unitId: event.unit_id,
        reserved: true,
        dispatched: false,
        responsePersisted: false,
        responsePath: null,
        responseSha256: null,
        disposition: null,
      });
      continue;
    }
    if (!event.attempt_id || !attempts.has(event.attempt_id)) continue;
    const attempt = attempts.get(event.attempt_id);
    if (event.type === 'attempt_dispatched') attempt.dispatched = true;
    if (event.type === 'attempt_response_persisted') {
      attempt.responsePersisted = true;
      attempt.responsePath = event.response_path;
      attempt.responseSha256 = event.response_sha256;
    }
    const disposition = Object.entries(TERMINAL_EVENT_BY_DISPOSITION).find(([, type]) => type === event.type)?.[0];
    if (disposition) {
      if (attempt.disposition) throw new Error(`attempt ${event.attempt_id} has more than one terminal disposition`);
      if (disposition === 'cancelled_before_dispatch' && attempt.dispatched) {
        throw new Error(`attempt ${event.attempt_id} was cancelled before dispatch after dispatch was recorded`);
      }
      if (disposition === 'interrupted_after_dispatch' && (!attempt.dispatched || attempt.responsePersisted)) {
        throw new Error(`attempt ${event.attempt_id} has an invalid interrupted-after-dispatch disposition`);
      }
      if (disposition === 'completed' && !attempt.responsePersisted) {
        throw new Error(`attempt ${event.attempt_id} completed without a durable response`);
      }
      if (disposition === 'failed' && !attempt.dispatched) {
        throw new Error(`attempt ${event.attempt_id} failed before dispatch`);
      }
      attempt.disposition = disposition;
    }
  }
  const values = [...attempts.values()];
  const counts = Object.fromEntries(DURABLE_ATTEMPT_TERMINAL_DISPOSITIONS.map((value) => [value, 0]));
  for (const attempt of values) {
    if (attempt.disposition) counts[attempt.disposition] += 1;
  }
  return {
    attempts: values,
    reserved: values.length,
    ...counts,
    unexplained: values.filter((attempt) => !attempt.disposition).length,
  };
}

export function buildDurableEvaluationStatus({
  events = [],
  plannedUnits,
  plannedTurns,
  completedTurns,
  hardCeiling,
  workflowState = 'running',
  scientificVerdict = 'pending_measurement',
  secondsPerRemainingTurn = [60, 180],
  postRunSeconds = [120, 600],
  now = new Date(),
} = {}) {
  const reservations = events.filter((event) => event.type === 'model_attempt_dispatch_reserved');
  const terminalByAttempt = new Map();
  for (const event of events) {
    const disposition = Object.entries(TERMINAL_EVENT_BY_DISPOSITION).find(([, type]) => type === event.type)?.[0];
    if (disposition && event.attempt_id) terminalByAttempt.set(event.attempt_id, disposition);
  }
  const attemptCounts = Object.fromEntries(DURABLE_ATTEMPT_TERMINAL_DISPOSITIONS.map((value) => [value, 0]));
  for (const disposition of terminalByAttempt.values()) attemptCounts[disposition] += 1;
  const activeAttempts = reservations.filter((event) => !terminalByAttempt.has(event.attempt_id)).length;
  const completedUnitEvents = events.filter((event) => event.type === 'partial_dialogue_continuation_completed');
  const failedUnitEvents = events.filter((event) => event.type === 'partial_dialogue_recovery_failed');
  const dispatchedUnitIds = new Set(
    events.filter((event) => event.type === 'partial_dialogue_continuation_dispatched').map((event) => event.unit),
  );
  const completeUnitIds = new Set(completedUnitEvents.map((event) => event.unit));
  const failedUnitIds = new Set(failedUnitEvents.map((event) => event.unit).filter(Boolean));
  const activeUnits = [...dispatchedUnitIds].filter(
    (unitId) => !completeUnitIds.has(unitId) && !failedUnitIds.has(unitId),
  ).length;
  const missingUnits = Math.max(0, Number(plannedUnits || 0) - completeUnitIds.size - failedUnitIds.size - activeUnits);
  const remainingTurns = Math.max(0, Number(plannedTurns || 0) - Number(completedTurns || 0));
  const lowerSeconds = remainingTurns * Number(secondsPerRemainingTurn[0] || 0) + Number(postRunSeconds[0] || 0);
  const upperSeconds = remainingTurns * Number(secondsPerRemainingTurn[1] || 0) + Number(postRunSeconds[1] || 0);
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const eta =
    workflowState === 'complete'
      ? { earliest: new Date(nowMs).toISOString(), latest: new Date(nowMs).toISOString(), basis: 'workflow_complete' }
      : {
          earliest: new Date(nowMs + lowerSeconds * 1000).toISOString(),
          latest: new Date(nowMs + upperSeconds * 1000).toISOString(),
          basis: 'registered_remaining_turn_range_plus_zero_call_postrun',
        };
  return {
    schema: 'machinespirits.durable-evaluation-status.v1',
    generated_at: new Date(nowMs).toISOString(),
    planes: {
      attempt: {
        reserved: reservations.length,
        completed: attemptCounts.completed,
        failed: attemptCounts.failed,
        cancelled_before_dispatch: attemptCounts.cancelled_before_dispatch,
        interrupted_after_dispatch: attemptCounts.interrupted_after_dispatch,
        active: activeAttempts,
        unexplained: Math.max(0, reservations.length - terminalByAttempt.size),
        hard_ceiling: hardCeiling,
      },
      unit: {
        planned: plannedUnits,
        complete: completeUnitIds.size,
        active: activeUnits,
        failed: failedUnitIds.size,
        missing: missingUnits,
        completed_turns: completedTurns,
        planned_turns: plannedTurns,
      },
      workflow: {
        state: workflowState,
        model_activity: activeAttempts > 0 ? 'active' : 'inactive',
        human_input_required: failedUnitIds.size > 0,
      },
      scientific_verdict: {
        state: scientificVerdict,
        changed_by_pause_or_recovery: false,
      },
    },
    eta,
    last_event_at: events.at(-1)?.at || null,
  };
}

export function reconcileDurableAttemptJournal({ ledgerPath, responseDirectory } = {}) {
  const before = summarizeDurableAttemptEvents(readEvents(ledgerPath));
  for (const attempt of before.attempts.filter((candidate) => !candidate.disposition)) {
    if (attempt.responsePersisted) {
      const responsePath = path.resolve(responseDirectory, attempt.responsePath || '');
      const bytes = fs.readFileSync(responsePath);
      if (sha256(bytes) !== attempt.responseSha256)
        throw new Error(`persisted response drift for ${attempt.attemptId}`);
      appendDurableJsonLine(ledgerPath, {
        type: 'attempt_completed',
        attempt_id: attempt.attemptId,
        unit_id: attempt.unitId,
        recovered_from_persisted_response: true,
      });
    } else {
      appendDurableJsonLine(ledgerPath, {
        type: attempt.dispatched ? 'attempt_interrupted_after_dispatch' : 'attempt_cancelled_before_dispatch',
        attempt_id: attempt.attemptId,
        unit_id: attempt.unitId,
        reconciled_on_restart: true,
      });
    }
  }
  return summarizeDurableAttemptEvents(readEvents(ledgerPath));
}

export function createDurablePauseStateMachine({ statePath, record = () => {}, signalTarget = null } = {}) {
  let state = fs.existsSync(statePath)
    ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
    : {
        schema: 'machinespirits.durable-pause-state.v1',
        state: 'running',
        recoverable: false,
        reason: null,
        resume_from: null,
      };
  const persist = (next, detail = {}) => {
    const previous = state.state;
    state = { ...state, ...detail, state: next, updated_at: new Date().toISOString() };
    writeJsonAtomic(statePath, state);
    record({ type: 'pause_state_transition', from: previous, to: next, recoverable: state.recoverable, ...detail });
    return snapshot();
  };
  const snapshot = () => JSON.parse(JSON.stringify(state));
  const requestPause = (signal = 'SIGINT') => {
    if (state.state === 'pause_requested' || state.state === 'paused') return snapshot();
    if (!['running', 'resuming'].includes(state.state)) throw new Error(`cannot request pause from ${state.state}`);
    return persist('pause_requested', {
      recoverable: true,
      reason: 'operator_requested_safe_pause',
      signal,
    });
  };
  const onSignal = (signal) => requestPause(signal);
  if (signalTarget) {
    signalTarget.on('SIGINT', onSignal);
    signalTarget.on('SIGTERM', onSignal);
  }
  return Object.freeze({
    snapshot,
    requestPause,
    markPaused(detail = {}) {
      if (state.state !== 'pause_requested') throw new Error(`cannot mark paused from ${state.state}`);
      return persist('paused', { recoverable: true, ...detail });
    },
    markResuming(detail = {}) {
      if (state.state !== 'paused') throw new Error(`cannot resume from ${state.state}`);
      return persist('resuming', { recoverable: true, ...detail });
    },
    markRunning(detail = {}) {
      if (state.state !== 'resuming') throw new Error(`cannot mark running from ${state.state}`);
      return persist('running', { recoverable: false, reason: null, ...detail });
    },
    dispose() {
      if (!signalTarget) return;
      signalTarget.off('SIGINT', onSignal);
      signalTarget.off('SIGTERM', onSignal);
    },
  });
}

export async function runDurableAttemptUnit({
  ledgerPath,
  responseDirectory,
  unitId,
  hardCeiling,
  plannedInitialAttempts = 1,
  recoveryReserve = 1,
  dispatch,
  faultAt = null,
} = {}) {
  if (!Number.isInteger(hardCeiling) || hardCeiling < 1) throw new Error('hard ceiling must be a positive integer');
  if (!Number.isInteger(recoveryReserve) || recoveryReserve < 1 || recoveryReserve >= hardCeiling) {
    throw new Error('future durable runs must pre-register a positive recovery reserve below the hard ceiling');
  }
  if (plannedInitialAttempts + recoveryReserve > hardCeiling) {
    throw new Error('planned attempts plus recovery reserve exceed the hard ceiling');
  }
  fs.mkdirSync(responseDirectory, { recursive: true });
  let events = readEvents(ledgerPath);
  if (events.length) reconcileDurableAttemptJournal({ ledgerPath, responseDirectory });
  events = readEvents(ledgerPath);
  const accepted = events.findLast((event) => event.type === 'unit_completed' && event.unit_id === unitId);
  if (accepted) return { accepted, accounting: summarizeDurableAttemptEvents(events), resumed: true };

  const completed = summarizeDurableAttemptEvents(events).attempts.find(
    (attempt) => attempt.unitId === unitId && attempt.disposition === 'completed' && attempt.responsePersisted,
  );
  if (completed) {
    const completion = {
      type: 'unit_completed',
      unit_id: unitId,
      accepted_attempt_id: completed.attemptId,
      response_path: completed.responsePath,
      response_sha256: completed.responseSha256,
      recovered_from_persisted_response: true,
    };
    appendDurableJsonLine(ledgerPath, completion);
    return { accepted: completion, accounting: summarizeDurableAttemptEvents(readEvents(ledgerPath)), resumed: true };
  }

  if (faultAt === 'before_reservation') throw new Error('fault injection: before_reservation');
  const current = summarizeDurableAttemptEvents(events);
  const initialReservationLimit = events.length ? hardCeiling : plannedInitialAttempts;
  if (current.reserved >= initialReservationLimit) throw new Error('durable attempt hard ceiling exhausted');
  const attemptId = `${unitId}:${current.reserved + 1}`;
  appendDurableJsonLine(ledgerPath, { type: 'attempt_reserved', attempt_id: attemptId, unit_id: unitId });
  if (faultAt === 'after_reservation_before_dispatch') {
    throw new Error('fault injection: after_reservation_before_dispatch');
  }
  appendDurableJsonLine(ledgerPath, { type: 'attempt_dispatched', attempt_id: attemptId, unit_id: unitId });
  let response;
  try {
    response = await dispatch({ attemptId, unitId });
  } catch (error) {
    appendDurableJsonLine(ledgerPath, {
      type: 'attempt_failed',
      attempt_id: attemptId,
      unit_id: unitId,
      error: String(error?.message || error),
    });
    throw error;
  }
  if (faultAt === 'after_dispatch_before_response_persistence') {
    throw new Error('fault injection: after_dispatch_before_response_persistence');
  }
  const responseName = `${attemptId.replace(/[^a-zA-Z0-9._-]/gu, '_')}.json`;
  const responsePath = path.join(responseDirectory, responseName);
  writeJsonAtomic(responsePath, response);
  const bytes = fs.readFileSync(responsePath);
  appendDurableJsonLine(ledgerPath, {
    type: 'attempt_response_persisted',
    attempt_id: attemptId,
    unit_id: unitId,
    response_path: responseName,
    response_sha256: sha256(bytes),
  });
  if (faultAt === 'after_response_persistence_before_unit_completion') {
    throw new Error('fault injection: after_response_persistence_before_unit_completion');
  }
  appendDurableJsonLine(ledgerPath, { type: 'attempt_completed', attempt_id: attemptId, unit_id: unitId });
  const completion = {
    type: 'unit_completed',
    unit_id: unitId,
    accepted_attempt_id: attemptId,
    response_path: responseName,
    response_sha256: sha256(bytes),
  };
  appendDurableJsonLine(ledgerPath, completion);
  return { accepted: completion, accounting: summarizeDurableAttemptEvents(readEvents(ledgerPath)), resumed: false };
}
