export const TUTOR_STUB_SESSION_HOST_SCHEMA = 'machinespirits.tutor-stub.session-host.v1';
export const TUTOR_STUB_SESSION_HOST_VERSION = 1;

const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

function clone(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSessionId(value) {
  const id = String(value || '').trim();
  if (!SESSION_ID_PATTERN.test(id)) {
    throw new TutorStubSessionHostError(
      'invalid_session_id',
      'session id must be 1-128 letters, numbers, dots, colons, underscores, or hyphens',
      400,
    );
  }
  return id;
}

function assertRuntime(runtime) {
  const required = ['load', 'resume', 'reset', 'step', 'finalize', 'snapshot'];
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('tutor-stub session factory must return a runtime object');
  }
  const missing = required.filter((name) => typeof runtime[name] !== 'function');
  if (missing.length) throw new Error(`tutor-stub session runtime is missing: ${missing.join(', ')}`);
  const snapshot = runtime.snapshot();
  normalizeSessionId(runtime.id || snapshot?.sessionId);
  return runtime;
}

export class TutorStubSessionHostError extends Error {
  constructor(code, message, status = 400, options = {}) {
    super(message, options);
    this.name = 'TutorStubSessionHostError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Owns multiple importable tutor-stub runtimes for non-terminal transports.
 *
 * The injected factory remains the only place that constructs tutor behavior.
 * A web or Electron host can therefore reuse the real engine, while tests can
 * inject a fake provider without teaching this control plane how tutoring works.
 * Runtime snapshots returned by the factory must be presentation-safe.
 */
export function createTutorStubSessionHost({ createSession, maxSessions = 32 } = {}) {
  if (typeof createSession !== 'function') throw new Error('tutor-stub session host requires createSession');
  if (!Number.isInteger(maxSessions) || maxSessions < 1) {
    throw new Error('tutor-stub session host maxSessions must be a positive integer');
  }

  const sessions = new Map();
  const pendingIds = new Set();
  let pendingCreates = 0;

  const snapshotFor = (entry) => {
    const snapshot = clone(entry.runtime.snapshot());
    // Runtime events are an internal diagnostic channel and may contain raw
    // adapter/provider failure messages. Public HTTP consumers need only the
    // lifecycle, counters, capability projection, and presentation-safe state.
    if (snapshot && typeof snapshot === 'object') delete snapshot.events;
    return snapshot;
  };

  const evict = (id, entry, reason = 'session_evicted') => {
    if (sessions.get(id) !== entry) return false;
    sessions.delete(id);
    entry.runtime.terminate?.(reason);
    return true;
  };

  const entryFor = (id) => {
    const normalizedId = normalizeSessionId(id);
    const entry = sessions.get(normalizedId);
    if (!entry) {
      throw new TutorStubSessionHostError('session_not_found', `unknown tutor-stub session: ${normalizedId}`, 404);
    }
    return entry;
  };

  const queueMutation = (id, operation, mutate) => {
    const entry = entryFor(id);
    const task = entry.queue.then(async () => {
      try {
        const result = await mutate(entry.runtime);
        return {
          result: clone(result),
          session: snapshotFor(entry),
        };
      } catch (error) {
        if (error?.fatalSession === true) evict(id, entry, error.code || 'fatal_session_error');
        if (error instanceof TutorStubSessionHostError) throw error;
        if (/while status is/u.test(String(error?.message || ''))) {
          throw new TutorStubSessionHostError(
            'session_state_conflict',
            `cannot ${operation} tutor-stub session ${entry.runtime.id}: ${error.message}`,
            409,
            { cause: error },
          );
        }
        throw error;
      }
    });
    entry.queue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };

  return Object.freeze({
    schema: TUTOR_STUB_SESSION_HOST_SCHEMA,
    version: TUTOR_STUB_SESSION_HOST_VERSION,
    async create(specification = {}) {
      if (!isPlainObject(specification)) {
        throw new TutorStubSessionHostError('invalid_request', 'session specification must be an object', 400);
      }
      const spec = clone(specification);
      const requestedId = spec.id === undefined || spec.id === null ? null : normalizeSessionId(spec.id);
      if (requestedId && (sessions.has(requestedId) || pendingIds.has(requestedId))) {
        throw new TutorStubSessionHostError('session_exists', `tutor-stub session already exists: ${requestedId}`, 409);
      }
      if (sessions.size + pendingCreates >= maxSessions) {
        throw new TutorStubSessionHostError(
          'session_capacity_reached',
          `tutor-stub session capacity reached (${maxSessions})`,
          429,
        );
      }

      pendingCreates += 1;
      if (requestedId) pendingIds.add(requestedId);
      let runtime;
      let adoptedRuntime = false;
      try {
        runtime = assertRuntime(await createSession(spec));
        const runtimeId = normalizeSessionId(runtime.id || runtime.snapshot()?.sessionId);
        if (requestedId && requestedId !== runtimeId) {
          throw new TutorStubSessionHostError(
            'session_id_mismatch',
            `session factory returned ${runtimeId} for requested id ${requestedId}`,
            500,
          );
        }
        if (sessions.has(runtimeId)) {
          throw new TutorStubSessionHostError('session_exists', `tutor-stub session already exists: ${runtimeId}`, 409);
        }

        const entry = { runtime, queue: Promise.resolve() };
        sessions.set(runtimeId, entry);
        adoptedRuntime = true;
        if (runtime.closed && typeof runtime.closed.then === 'function') {
          Promise.resolve(runtime.closed).then(
            () => evict(runtimeId, entry, 'runtime_closed'),
            () => evict(runtimeId, entry, 'runtime_closed'),
          );
        }
        try {
          if (runtime.status === 'created') {
            const load = isPlainObject(spec.load) ? clone(spec.load) : {};
            await runtime.load({ ...load, source: load.source || 'http_session_create' });
          }
          // Let a synchronously-settled `closed` watcher run before claiming
          // creation succeeded. Otherwise a runtime that dies during load can
          // be returned even though it has already been evicted.
          await Promise.resolve();
          if (sessions.get(runtimeId) !== entry) {
            throw new TutorStubSessionHostError(
              'session_closed_during_create',
              `tutor-stub session ${runtimeId} closed during creation`,
              503,
            );
          }
        } catch (error) {
          evict(runtimeId, entry, 'session_load_failed');
          throw error;
        }
        return snapshotFor(entry);
      } catch (error) {
        if (runtime && !adoptedRuntime) runtime.terminate?.('session_create_failed');
        throw error;
      } finally {
        pendingCreates -= 1;
        if (requestedId) pendingIds.delete(requestedId);
      }
    },
    get(id) {
      return snapshotFor(entryFor(id));
    },
    list() {
      return [...sessions.values()]
        .map((entry) => snapshotFor(entry))
        .sort((left, right) => left.sessionId.localeCompare(right.sessionId));
    },
    step(id, input, options = {}) {
      return queueMutation(id, 'step', (runtime) => runtime.step(input, options));
    },
    resume(id, payload = {}) {
      return queueMutation(id, 'resume', (runtime) => runtime.resume(payload));
    },
    reset(id, payload = {}) {
      return queueMutation(id, 'reset', (runtime) => runtime.reset(payload));
    },
    interrupt(id, reason = 'http_interrupt') {
      const normalizedId = normalizeSessionId(id);
      const entry = entryFor(normalizedId);
      if (typeof entry.runtime.terminate !== 'function') {
        throw new TutorStubSessionHostError(
          'session_interrupt_unavailable',
          `tutor-stub session ${normalizedId} does not support interruption`,
          409,
        );
      }

      // Interruption deliberately bypasses the per-session mutation queue: its
      // job is to stop a model call that may be occupying that queue. Remove
      // the session first so no new work can be admitted, then terminate the
      // runtime. Process-backed runtimes synchronously signal the child and
      // reject their pending RPC before their `closed` promise settles.
      const session = snapshotFor(entry);
      sessions.delete(normalizedId);
      try {
        const closing = entry.runtime.terminate(reason);
        Promise.resolve(closing).catch(() => undefined);
      } catch (error) {
        throw new TutorStubSessionHostError(
          'session_interrupt_failed',
          `failed to interrupt tutor-stub session ${normalizedId}`,
          500,
          { cause: error },
        );
      }
      return {
        result: { sessionId: normalizedId, interrupted: true, reason },
        session,
      };
    },
    async finalize(id, reason = 'http_finalize', payload = {}) {
      const normalizedId = normalizeSessionId(id);
      const entry = entryFor(normalizedId);
      const operation = await queueMutation(normalizedId, 'finalize', (runtime) => runtime.finalize(reason, payload));
      evict(normalizedId, entry, 'finalized');
      return operation;
    },
    async closeAll(reason = 'host_shutdown') {
      const entries = [...sessions.entries()];
      sessions.clear();
      for (const [, entry] of entries) entry.runtime.terminate?.(reason);
      await Promise.allSettled(entries.map(([, entry]) => entry.queue));
    },
  });
}
