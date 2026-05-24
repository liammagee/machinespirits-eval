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

function createProgressReporter({
  label,
  total,
  width = 24,
  heartbeatMs = 30000,
  stream = process.stdout,
  enabled = true,
} = {}) {
  let done = 0;
  let timer = null;
  const startedAt = Date.now();
  const prefix = label || 'progress';

  function write(message = null, currentDone = done) {
    if (!enabled) return;
    const elapsed = formatDuration(Date.now() - startedAt);
    const suffix = message ? ` · ${message}` : '';
    stream.write(`${prefix} ${renderProgressBar(currentDone, total, width)} elapsed ${elapsed}${suffix}\n`);
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
        timer = setInterval(() => write('still running', done), heartbeatMs);
        timer.unref?.();
      }
    },
    note(message) {
      write(message, done);
    },
    step(message, increment = 1) {
      done += increment;
      write(message, done);
    },
    finish(message = 'done') {
      done = Number.isFinite(total) && total > 0 ? total : done;
      clearHeartbeat();
      write(message, done);
    },
    stop() {
      clearHeartbeat();
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

export { createProgressReporter, formatDuration, renderProgressBar, runTasksWithConcurrency };
