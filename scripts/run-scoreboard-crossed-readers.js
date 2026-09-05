#!/usr/bin/env node
/**
 * Reader seats and scorer for the scoreboard crossed run (Step 2 of
 * notes/2026-09-04-scoreboard-replay-prompt.md).
 *
 *   --dry-run   write packets, count calls, make none
 *   (live)      call the reader seats; --max-calls is the ceiling checked
 *               before each call; retries 0; a failure stops the run
 *   --score     zero calls: read the board channel, decision correctness,
 *               warranted shift share, delivery agreement and the two kills
 *
 * Usage:
 *   node scripts/run-scoreboard-crossed-readers.js --traces <dir> [--traces <dir>] --out <dir> --dry-run
 *   node scripts/run-scoreboard-crossed-readers.js --traces <dir> --out <dir> --max-calls <n> [--reader-model codex.gpt-5.6-luna] [--effort medium]
 *   node scripts/run-scoreboard-crossed-readers.js --traces <dir> --score [--readers <out dir>] [--score-out <file.json>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_READER_COUNT,
  DEFAULT_READER_MODEL,
  renderCrossedScoreMarkdown,
  runScoreboardCrossedReaders,
  scoreScoreboardCrossedRun,
} from '../services/tutorStubScoreboardCrossedReaders.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return [
    'node scripts/run-scoreboard-crossed-readers.js --traces <dir> [--traces <dir>] --out <dir> --dry-run',
    'node scripts/run-scoreboard-crossed-readers.js --traces <dir> --out <dir> --max-calls <n> [--reader-model <spec>] [--readers-count 2] [--effort medium]',
    'node scripts/run-scoreboard-crossed-readers.js --traces <dir> --score [--readers <out dir>] [--score-out <file.json>]',
  ].join('\n');
}

export async function main(argv = process.argv.slice(2), { log = console.log } = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      traces: { type: 'string', multiple: true, default: [] },
      out: { type: 'string' },
      'reader-model': { type: 'string', default: DEFAULT_READER_MODEL },
      'readers-count': { type: 'string', default: String(DEFAULT_READER_COUNT) },
      effort: { type: 'string', default: 'medium' },
      'max-calls': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      score: { type: 'boolean', default: false },
      readers: { type: 'string' },
      'score-out': { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help || !values.traces.length) {
    log(usage());
    return values.help ? 0 : 2;
  }
  const rootDirs = values.traces.map((p) => path.resolve(p));
  if (values.score) {
    const score = scoreScoreboardCrossedRun({
      rootDirs,
      readerDir: values.readers ? path.resolve(values.readers) : null,
      repoRoot: ROOT,
    });
    if (values['score-out']) {
      fs.mkdirSync(path.dirname(path.resolve(values['score-out'])), { recursive: true });
      fs.writeFileSync(path.resolve(values['score-out']), `${JSON.stringify(score, null, 2)}\n`);
    }
    log(renderCrossedScoreMarkdown(score));
    return score.kill.indeterminate ? 3 : 0;
  }
  if (!values.out) {
    log(usage());
    return 2;
  }
  const maxCalls = values['max-calls'] === undefined ? null : Number(values['max-calls']);
  const result = await runScoreboardCrossedReaders({
    rootDirs,
    outDir: path.resolve(values.out),
    readerModel: values['reader-model'],
    readerCount: Number(values['readers-count']),
    effort: values.effort,
    maxCalls,
    dryRun: values['dry-run'],
    log,
  });
  log(
    `${result.run.status}: ${result.dialogues} dialogues, ${result.packets} packets, ${result.plannedCalls} calls planned, ${result.callsMade} calls made this invocation`,
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
