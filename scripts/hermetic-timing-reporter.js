import path from 'node:path';

const TERMINAL_EVENTS = new Set(['test:pass', 'test:fail']);

function relativeTestFile(file) {
  if (!file) return null;
  return path.relative(process.cwd(), file).split(path.sep).join('/');
}

function timingLine(file, timing, summaryDurationMs = null) {
  timing.reported = true;
  const fileDurationMs = Number(summaryDurationMs);
  const hasFileDuration = summaryDurationMs != null && Number.isFinite(fileDurationMs);
  return (
    JSON.stringify({
      file,
      durationMs: hasFileDuration ? fileDurationMs : timing.testDurationMs,
      durationSource: hasFileDuration ? 'file_summary' : 'test_sum',
      testDurationMs: timing.testDurationMs,
      tests: timing.tests,
      failures: timing.failures,
    }) + '\n'
  );
}

/**
 * One JSONL line per test file, written as that file finishes where Node can say
 * when that is, and at the end of the stream otherwise.
 *
 * The streaming matters more than the timings. Node emits a file-scoped
 * `test:summary` when a file is done and nothing at all for a file whose
 * subprocess never exits, so this report doubles as the record of which selected
 * files actually ran — and, when a run stalls, the set of files with no line here
 * is exactly the set still holding the runner open. The end-of-stream flush
 * cannot say that second thing, because a stalled run never reaches the end of
 * its stream; it is here because `test:summary` arrived in Node 22 and this
 * project still supports Node 20, where the whole report necessarily comes at
 * the end. On Node 20 a completed run is still accounted for exactly; a stalled
 * one just cannot be narrowed to a file.
 */
export default async function* hermeticTimingReporter(source) {
  const files = new Map();
  for await (const event of source) {
    const file = relativeTestFile(event.data?.file);
    if (!file) continue;
    if (TERMINAL_EVENTS.has(event.type)) {
      const current = files.get(file) || { testDurationMs: 0, tests: 0, failures: 0, reported: false };
      current.testDurationMs += Number(event.data?.details?.duration_ms || 0);
      current.tests += 1;
      if (event.type === 'test:fail') current.failures += 1;
      files.set(file, current);
      continue;
    }
    if (event.type !== 'test:summary') continue;
    // A file that defines no tests still gets a summary, and it still ran.
    const timing = files.get(file) || { testDurationMs: 0, tests: 0, failures: 0, reported: false };
    files.set(file, timing);
    if (timing.reported) continue;
    yield timingLine(file, timing, event.data?.duration_ms);
  }
  for (const [file, timing] of files) {
    if (!timing.reported) yield timingLine(file, timing);
  }
}
