import path from 'node:path';

const TERMINAL_EVENTS = new Set(['test:pass', 'test:fail']);

function relativeTestFile(file) {
  if (!file) return null;
  return path.relative(process.cwd(), file).split(path.sep).join('/');
}

/**
 * One JSONL line per test file, written as that file finishes rather than
 * accumulated and flushed at the end of the run.
 *
 * The streaming matters more than the timings. Node emits a file-scoped
 * `test:summary` when a file is done and nothing at all for a file whose
 * subprocess never exits, so this report doubles as the record of which
 * selected files actually ran — and, when a run stalls, the set of files with
 * no line here is exactly the set still holding the runner open. A report
 * yielded at the end of the stream could say neither, because a stalled run
 * never reaches the end of the stream.
 */
export default async function* hermeticTimingReporter(source) {
  const files = new Map();
  for await (const event of source) {
    const file = relativeTestFile(event.data?.file);
    if (!file) continue;
    if (TERMINAL_EVENTS.has(event.type)) {
      const current = files.get(file) || { durationMs: 0, tests: 0, failures: 0, reported: false };
      current.durationMs += Number(event.data?.details?.duration_ms || 0);
      current.tests += 1;
      if (event.type === 'test:fail') current.failures += 1;
      files.set(file, current);
      continue;
    }
    if (event.type !== 'test:summary') continue;
    // A file that defines no tests still gets a summary, and it still ran.
    const timing = files.get(file) || { durationMs: 0, tests: 0, failures: 0, reported: false };
    files.set(file, timing);
    if (timing.reported) continue;
    timing.reported = true;
    yield JSON.stringify({ file, durationMs: timing.durationMs, tests: timing.tests, failures: timing.failures }) +
      '\n';
  }
}
