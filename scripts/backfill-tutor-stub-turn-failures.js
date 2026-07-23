#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  backfillTutorStubTurnFailures,
  parseTutorStubTraceJsonl,
  summarizeTutorStubTurnFailures,
  tutorStubFailureModeMatches,
} from '../services/tutorStubTurnFailureBackfill.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const GENERATED_TAG = new Date().toISOString().replace(/[:.]/gu, '-');

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'trace-root': { type: 'string', multiple: true, default: [] },
    out: {
      type: 'string',
      default: path.join(os.homedir(), '.machinespirits-data/tutor-stub/turn-failure-backfill', GENERATED_TAG),
    },
    'failure-mode': { type: 'string', multiple: true, default: [] },
    'include-clean': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  console.log(`Usage:
  node scripts/backfill-tutor-stub-turn-failures.js [trace.jsonl | trace-dir ...] [options]

Options:
  --trace-root <path>       Trace file or directory; repeatable
  --out <dir>               Local output directory outside the repo by default
  --failure-mode <prefix>   Keep records with this mode/prefix; repeatable
  --include-clean           Include completed turns without failure labels
  --dry-run                 Read and summarize without writing output files
  -h, --help                Show this help

The backfill is deterministic and makes zero model calls. It exports public
dialogue plus existing trace verdicts; hidden prompts and private proof state
are not copied into the dataset.`);
}

if (args.help) {
  usage();
  process.exit(0);
}

function resolveInput(value) {
  const selected = String(value || '').trim();
  if (!selected) return null;
  if (selected === '~') return os.homedir();
  if (selected.startsWith('~/')) return path.join(os.homedir(), selected.slice(2));
  return path.isAbsolute(selected) ? selected : path.resolve(REPO_ROOT, selected);
}

function traceFilesUnder(input) {
  const resolved = resolveInput(input);
  if (!resolved || !fs.existsSync(resolved)) throw new Error(`Trace input does not exist: ${input}`);
  const stat = fs.statSync(resolved);
  if (stat.isFile()) return resolved.endsWith('.jsonl') ? [resolved] : [];
  if (!stat.isDirectory()) return [];
  return fs
    .readdirSync(resolved, { withFileTypes: true })
    .flatMap((entry) => traceFilesUnder(path.join(resolved, entry.name)));
}

function relativeTracePath(filePath) {
  const relative = path.relative(REPO_ROOT, filePath);
  return relative.startsWith('..') ? filePath : relative;
}

const inputs = [...positionals, ...args['trace-root']];
if (!inputs.length) inputs.push(path.join(REPO_ROOT, '.tutor-stub-traces'));
const traceFiles = [...new Set(inputs.flatMap(traceFilesUnder))].sort();
if (!traceFiles.length) throw new Error(`No .jsonl tutor-stub traces found under: ${inputs.join(', ')}`);

const records = [];
const malformed = [];
let turnsScanned = 0;
let sealedTraces = 0;
for (const traceFile of traceFiles) {
  const parsed = parseTutorStubTraceJsonl(fs.readFileSync(traceFile, 'utf8'));
  if (parsed.events.some((event) => event?.type === 'run_end')) sealedTraces += 1;
  malformed.push(
    ...parsed.malformedLines.map((line) => ({
      tracePath: relativeTracePath(traceFile),
      ...line,
    })),
  );
  const backfill = backfillTutorStubTurnFailures({
    events: parsed.events,
    tracePath: relativeTracePath(traceFile),
    includeClean: args['include-clean'],
  });
  turnsScanned += backfill.turnsScanned;
  records.push(...backfill.records.filter((record) => tutorStubFailureModeMatches(record, args['failure-mode'])));
}

const payload = records.map((record) => JSON.stringify(record)).join('\n') + (records.length ? '\n' : '');
const outputDir = resolveInput(args.out);
const summary = summarizeTutorStubTurnFailures(records, {
  purpose: 'failure_focused_corrective_dataset_preparation',
  zeroModelCalls: true,
  trainingLicensed: false,
  inputs: inputs.map(resolveInput),
  traceFiles: traceFiles.length,
  sealedTraces,
  turnsScanned,
  malformedLines: malformed.length,
  malformed,
  includeClean: args['include-clean'],
  modeFilters: args['failure-mode'],
  outputDir: args['dry-run'] ? null : outputDir,
  sha256: createHash('sha256').update(payload).digest('hex'),
});

if (!args['dry-run']) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'turn-failures.jsonl'), payload);
  fs.writeFileSync(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
}

console.log(JSON.stringify(summary, null, 2));
