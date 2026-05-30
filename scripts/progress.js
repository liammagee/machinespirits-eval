function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}s`;
  if (minutes > 0) return `${minutes}m${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function renderProgressBar(done, total, width = 24) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const safeDone = safeTotal ? Math.min(Math.max(0, done), safeTotal) : Math.max(0, done);
  const ratio = safeTotal ? safeDone / safeTotal : 0;
  const filled = Math.round(ratio * width);
  const empty = Math.max(0, width - filled);
  const pct = safeTotal ? `${Math.round(ratio * 100)}%` : 'n/a';
  const count = safeTotal ? `${safeDone}/${safeTotal}` : `${safeDone}`;
  return `[${'#'.repeat(filled)}${'.'.repeat(empty)}] ${count} ${pct}`;
}

// Fraction-based ETA in ms: project the remaining time from the completion
// fraction so far. `microDone` is the effective progress — completed coarse
// units PLUS the live sub-progress of in-flight units (see update()) — so the
// estimate is meaningful long before the first coarse unit completes. Returns
// null when there is no basis yet (microDone <= 0) or the total is unknown.
function computeEta(elapsedMs, microDone, total) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  if (!safeTotal) return null;
  const md = Math.min(Math.max(0, microDone), safeTotal);
  if (md <= 0) return null;
  if (md >= safeTotal) return 0;
  const frac = md / safeTotal;
  return (elapsedMs * (1 - frac)) / frac;
}

// Default heartbeat cadence (ms). Overridable via PROGRESS_HEARTBEAT_MS so a run
// can be made more (or less) chatty without code changes; an explicit heartbeatMs
// argument still wins (e.g. tests pass 0 to disable).
function defaultHeartbeatMs() {
  const env = Number(process.env.PROGRESS_HEARTBEAT_MS);
  return Number.isFinite(env) && env > 0 ? env : 30000;
}

function createProgressReporter({
  label,
  total,
  width = 24,
  heartbeatMs = defaultHeartbeatMs(),
  stream = process.stdout,
  enabled = true,
} = {}) {
  let done = 0;
  let timer = null;
  let lastDetail = null;
  // key -> sub-progress in [0,1] for each in-flight unit. Summed into microDone
  // so concurrent units contribute correctly and a single unit's turn-by-turn
  // progress (fed via update()) sharpens the ETA between coarse steps.
  const activeFractions = new Map();
  const startedAt = Date.now();
  const prefix = label || 'progress';

  function microDone() {
    let sum = done;
    for (const f of activeFractions.values()) sum += f;
    return sum;
  }

  function write(message = null, currentDone = done, { eta = false } = {}) {
    if (!enabled) return;
    const elapsedMs = Date.now() - startedAt;
    let line = `${prefix} ${renderProgressBar(currentDone, total, width)} elapsed ${formatDuration(elapsedMs)}`;
    if (eta) {
      const etaMs = computeEta(elapsedMs, microDone(), total);
      if (etaMs != null) line += ` · ETA ~${formatDuration(etaMs)}`;
    }
    if (message) line += ` · ${message}`;
    stream.write(`${line}\n`);
  }

  function clearHeartbeat() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    start(message = 'started') {
      write(message, done);
      clearHeartbeat();
      if (enabled && heartbeatMs > 0) {
        // The 30s heartbeat is the only line that carries the ETA + live detail;
        // event lines (start/step/note/finish) keep their stable format.
        timer = setInterval(() => write(lastDetail || 'still running', done, { eta: true }), heartbeatMs);
        timer.unref?.();
      }
    },
    note(message) {
      if (message) lastDetail = message;
      write(message, done);
    },
    // Live sub-progress of an in-flight unit. Does NOT print — it refreshes the
    // state the next heartbeat surfaces (with a sharpened ETA). `key` identifies
    // the unit (so concurrent units sum), `fraction` is its completion in [0,1],
    // `detail` becomes the heartbeat's activity line.
    update(key, fraction, detail = null) {
      if (key != null) activeFractions.set(key, Math.max(0, Math.min(1, Number(fraction) || 0)));
      if (detail) lastDetail = detail;
    },
    step(message, increment = 1, key = null) {
      done += increment;
      if (key != null) activeFractions.delete(key);
      if (message) lastDetail = message;
      write(message, done);
    },
    finish(message = 'done') {
      done = Number.isFinite(total) && total > 0 ? total : done;
      activeFractions.clear();
      clearHeartbeat();
      write(message, done);
    },
    stop() {
      clearHeartbeat();
    },
    // Test/introspection hook: current effective progress + projected ETA.
    snapshot() {
      const elapsedMs = Date.now() - startedAt;
      const md = microDone();
      return { done, microDone: md, total, elapsedMs, etaMs: computeEta(elapsedMs, md, total) };
    },
  };
}

async function runTasksWithConcurrency(tasks, concurrency = 1) {
  if (!Array.isArray(tasks)) throw new Error('tasks must be an array');
  const width = Math.max(1, Math.min(tasks.length || 1, Number.isInteger(concurrency) ? concurrency : 1));
  const results = new Array(tasks.length);
  let index = 0;
  let firstError = null;
  async function worker() {
    while (index < tasks.length && !firstError) {
      const i = index++;
      try {
        results[i] = await tasks[i]();
      } catch (err) {
        firstError ||= err;
      }
    }
  }
  await Promise.all(Array.from({ length: width }, () => worker()));
  if (firstError) throw firstError;
  return results;
}

export { createProgressReporter, computeEta, formatDuration, renderProgressBar, runTasksWithConcurrency };
