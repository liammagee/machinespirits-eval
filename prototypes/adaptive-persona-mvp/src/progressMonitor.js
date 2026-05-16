export function createPercentageMonitor({
  label = 'run',
  total = 0,
  enabled = true,
  logger = console.log,
} = {}) {
  let completed = 0;
  let totalUnits = Math.max(0, Number(total) || 0);
  const startedAt = Date.now();

  function percent() {
    if (totalUnits <= 0) return '0.0';
    return ((Math.min(completed, totalUnits) / totalUnits) * 100).toFixed(1);
  }

  function elapsed() {
    return `${Math.round((Date.now() - startedAt) / 1000)}s`;
  }

  function emit(event = {}) {
    if (!enabled) return;
    const units = Number(event.units || 0);
    if (units > 0) completed += units;
    const marker = units > 0 ? 'done' : event.status || 'start';
    logger(`[${label}] ${percent()}% (${Math.min(completed, totalUnits)}/${totalUnits}) ${marker}: ${formatProgressEvent(event)} elapsed=${elapsed()}`);
  }

  return {
    setTotal(nextTotal) {
      totalUnits = Math.max(0, Number(nextTotal) || 0);
    },
    addTotal(extraUnits) {
      totalUnits += Math.max(0, Number(extraUnits) || 0);
    },
    event: emit,
    get completed() {
      return completed;
    },
    get total() {
      return totalUnits;
    },
  };
}

export function progressEvent(onProgress, event) {
  if (typeof onProgress === 'function') onProgress(event);
}

export async function withProgress(onProgress, event, fn) {
  progressEvent(onProgress, { ...event, units: 0, status: 'start' });
  try {
    const result = await fn();
    progressEvent(onProgress, { ...event, units: event.units ?? 1, status: 'done' });
    return result;
  } catch (error) {
    progressEvent(onProgress, {
      ...event,
      units: 0,
      status: 'error',
      detail: error?.message || 'failed',
    });
    throw error;
  }
}

export function formatProgressEvent(event = {}) {
  return [
    event.phase,
    event.scenarioId,
    event.condition,
    event.branchName,
    Number.isInteger(event.turnIndex) ? `turn=${event.turnIndex}` : '',
    event.step,
    event.detail,
  ].filter(Boolean).join(' ');
}
