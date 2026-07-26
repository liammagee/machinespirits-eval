import path from 'node:path';

const TERMINAL_EVENTS = new Set(['test:pass', 'test:fail']);

function relativeTestFile(file) {
  if (!file) return null;
  return path.relative(process.cwd(), file).split(path.sep).join('/');
}

export default async function* hermeticTimingReporter(source) {
  const files = new Map();
  for await (const event of source) {
    if (!TERMINAL_EVENTS.has(event.type)) continue;
    const file = relativeTestFile(event.data?.file);
    if (!file) continue;
    const current = files.get(file) || { durationMs: 0, tests: 0, failures: 0 };
    current.durationMs += Number(event.data?.details?.duration_ms || 0);
    current.tests += 1;
    if (event.type === 'test:fail') current.failures += 1;
    files.set(file, current);
  }

  for (const [file, timing] of [...files.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    yield JSON.stringify({ file, ...timing }) + '\n';
  }
}
