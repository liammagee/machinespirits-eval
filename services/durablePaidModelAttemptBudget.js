import path from 'node:path';

import { createSharedModelAttemptLedgerClient } from './durableAttemptJournal.js';

/**
 * Adapt a paid-study admission to the per-dispatch budget interface used by
 * model-backed runners. Modern admissions get the durable shared attempt
 * journal; the legacy branch is retained only for isolated unit tests and
 * callers that have not yet moved to shared launch admission.
 */
export function createDurablePaidModelAttemptBudget({
  admission,
  limit,
  hooks = {},
  priorAttemptBase = 0,
  unitPrefix = null,
} = {}) {
  if (!admission || !Number.isSafeInteger(limit) || limit < 1) {
    throw new Error('durable paid model-attempt budget requires an admission and positive limit');
  }
  if (!Number.isSafeInteger(priorAttemptBase) || priorAttemptBase < 0 || priorAttemptBase > limit) {
    throw new Error('durable paid model-attempt budget prior-attempt base is invalid');
  }
  let activeAttempt = null;
  const budget = {
    scope(prefix) {
      if (!prefix || unitPrefix) throw new Error('model-attempt budget scope requires one stable root unit id');
      return createDurablePaidModelAttemptBudget({ admission, limit, hooks, priorAttemptBase, unitPrefix: prefix });
    },
    reserve(detail = {}) {
      if (activeAttempt) throw new Error('model-attempt tracking found an unresolved active attempt');
      const unitId =
        detail.unitId ||
        [unitPrefix, detail.role, detail.turn].filter((value) => value !== null && value !== undefined).join('/');
      if (priorAttemptBase + admission.studyReserved + 1 > limit) {
        throw new Error(
          `paid study aggregate spend cap exceeded before call: ${priorAttemptBase + admission.studyReserved + 1}/${limit}`,
        );
      }
      if (typeof admission.allocateModelAttemptCapacity !== 'function') {
        const reservation = admission.reserveModelAttempts(1, detail);
        activeAttempt = {
          reservation: {
            ...reservation,
            call: priorAttemptBase + reservation.study_reserved,
            limit,
            remaining: limit - priorAttemptBase - reservation.study_reserved,
          },
          detail: { ...detail, unitId },
          startedAt: Date.now(),
          legacy: true,
          dispatched: false,
          responsePersisted: false,
        };
        return activeAttempt.reservation;
      }
      if (!unitId) throw new Error('durable model-attempt reservation requires a stable unit id');
      const capacity = admission.allocateModelAttemptCapacity(1, { ...detail, unit_id: unitId });
      const environment = admission.attemptLedgerEnvironment({ unitId, capacity });
      const client = createSharedModelAttemptLedgerClient(JSON.parse(environment.TUTOR_STUB_SHARED_ATTEMPT_LEDGER));
      const durableReservation = client.reserve(detail);
      const reservation = {
        ...durableReservation,
        study_reserved: admission.studyReserved,
        call: priorAttemptBase + admission.studyReserved,
        limit,
        remaining: limit - priorAttemptBase - admission.studyReserved,
      };
      activeAttempt = {
        reservation,
        detail: { ...detail, unitId },
        startedAt: Date.now(),
        capacity,
        client,
        dispatched: false,
        responsePersisted: false,
      };
      return reservation;
    },
    markDispatched() {
      if (!activeAttempt) throw new Error('cannot dispatch without an active durable reservation');
      activeAttempt.client?.markDispatched({
        attemptId: activeAttempt.reservation.attemptId,
        role: activeAttempt.detail.role,
        turn: activeAttempt.detail.turn,
      });
      activeAttempt.dispatched = true;
      hooks.onAttemptStarted?.(activeAttempt);
    },
    persistResponse(responsePath) {
      if (!activeAttempt?.dispatched) throw new Error('cannot persist a response before durable dispatch');
      activeAttempt.client?.persistResponse({
        attemptId: activeAttempt.reservation.attemptId,
        responsePath: path.resolve(responsePath),
        role: activeAttempt.detail.role,
        turn: activeAttempt.detail.turn,
      });
      activeAttempt.responsePersisted = true;
    },
    complete() {
      if (!activeAttempt) return;
      if (!activeAttempt.legacy && !activeAttempt.responsePersisted) {
        throw new Error('cannot complete a model attempt before response persistence');
      }
      activeAttempt.client?.terminalize({
        attemptId: activeAttempt.reservation.attemptId,
        disposition: 'completed',
        role: activeAttempt.detail.role,
        turn: activeAttempt.detail.turn,
      });
      if (!activeAttempt.legacy) {
        admission.releaseModelAttemptCapacity(activeAttempt.capacity, {
          unit_id: activeAttempt.detail.unitId,
          reason: 'attempt_completed',
        });
      }
      const finished = { ...activeAttempt, durationMs: Date.now() - activeAttempt.startedAt };
      activeAttempt = null;
      hooks.onAttemptCompleted?.(finished);
    },
    fail(error) {
      if (!activeAttempt) return;
      activeAttempt.client?.terminalize({
        attemptId: activeAttempt.reservation.attemptId,
        disposition: activeAttempt.dispatched ? 'failed' : 'cancelled_before_dispatch',
        role: activeAttempt.detail.role,
        turn: activeAttempt.detail.turn,
      });
      if (!activeAttempt.legacy) {
        admission.releaseModelAttemptCapacity(activeAttempt.capacity, {
          unit_id: activeAttempt.detail.unitId,
          reason: 'attempt_failed',
        });
      }
      const finished = { ...activeAttempt, durationMs: Date.now() - activeAttempt.startedAt, error };
      activeAttempt = null;
      hooks.onAttemptFailed?.(finished);
    },
    snapshot() {
      return { used: priorAttemptBase + admission.studyReserved, limit };
    },
  };
  return budget;
}
