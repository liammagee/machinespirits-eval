function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export function immutableSaveSnapshot(value) {
  return deepFreeze(cloneValue(value));
}

export function createSaveQueue({ persist, onError = () => {}, timers = globalThis } = {}) {
  if (typeof persist !== 'function') throw new TypeError('persist must be a function');
  if (typeof timers.setTimeout !== 'function' || typeof timers.clearTimeout !== 'function') {
    throw new TypeError('timers must provide setTimeout and clearTimeout');
  }

  let sequence = 0;
  let latestSequence = 0;
  let pending = null;
  let inFlight = null;
  let timer = null;

  const clearScheduledDrain = () => {
    if (timer == null) return;
    timers.clearTimeout(timer);
    timer = null;
  };

  const drain = () => {
    if (inFlight) return inFlight;
    if (!pending) return Promise.resolve();

    const operation = pending;
    pending = null;
    const isLatest = () => operation.sequence === latestSequence;
    inFlight = Promise.resolve()
      .then(() => persist(operation.payload, { sequence: operation.sequence, isLatest }))
      .catch((error) => {
        if (!isLatest()) return;
        onError(error, operation.payload);
        throw error;
      })
      .finally(() => {
        inFlight = null;
        if (pending && timer == null) void drain().catch(() => {});
      });
    return inFlight;
  };

  const schedule = (payload, { delay = null } = {}) => {
    const operation = {
      sequence: ++sequence,
      payload: immutableSaveSnapshot(payload),
    };
    latestSequence = operation.sequence;
    pending = operation;
    clearScheduledDrain();
    if (Number.isFinite(delay) && delay >= 0) {
      timer = timers.setTimeout(() => {
        timer = null;
        void drain().catch(() => {});
      }, delay);
    }
    return operation.sequence;
  };

  const flush = async () => {
    clearScheduledDrain();
    while (pending || inFlight) {
      if (!inFlight) drain();
      if (inFlight) await inFlight;
    }
  };

  return Object.freeze({
    schedule,
    flush,
    hasWork: () => Boolean(timer != null || pending || inFlight),
  });
}
