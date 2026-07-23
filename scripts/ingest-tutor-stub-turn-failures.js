#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import Database from 'better-sqlite3';

import { resolveEvaluationDbPath } from '../services/evaluationDataPaths.js';
import {
  backfillTutorStubTurnFailures,
  parseTutorStubTraceJsonl,
  summarizeTutorStubTurnFailures,
} from '../services/tutorStubTurnFailureBackfill.js';
import {
  migrateTutorStubTurnFailureStore,
  replaceTutorStubTurnFailureRecords,
} from '../services/tutorStubTurnFailureStore.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_DB = resolveEvaluationDbPath(REPO_ROOT);

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'trace-root': { type: 'string', multiple: true, default: [] },
    db: { type: 'string', default: DEFAULT_DB },
    'include-clean': { type: 'boolean', default: false },
    'allow-malformed': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  console.log(`Usage:
  node scripts/ingest-tutor-stub-turn-failures.js [trace.jsonl | trace-dir ...] [options]

Options:
  --trace-root <path>  Trace file or directory; repeatable
  --db <path>          SQLite DB path (default: EVAL_DB_PATH or data/evaluations.db)
  --include-clean      Also store completed turns without failure labels
  --allow-malformed    Permit SQL replacement despite malformed JSONL lines
  --dry-run            Read and summarize without writing SQLite
  -h, --help           Show this help

The ingest is deterministic and makes zero model calls. It replaces records for
each supplied trace, keeps human feedback separate from ground-truth validation,
and never licenses a record for training.`);
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

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function main() {
  const inputs = [...positionals, ...args['trace-root']];
  if (!inputs.length) inputs.push(path.join(REPO_ROOT, '.tutor-stub-traces'));
  const traceFiles = [...new Set(inputs.flatMap(traceFilesUnder))].sort();
  if (!traceFiles.length) throw new Error(`No .jsonl tutor-stub traces found under: ${inputs.join(', ')}`);

  const records = [];
  const tracePaths = [];
  const sourceHashes = {};
  const malformed = [];
  let turnsScanned = 0;
  let sealedTraces = 0;
  for (const traceFile of traceFiles) {
    const tracePath = relativeTracePath(traceFile);
    const raw = fs.readFileSync(traceFile, 'utf8');
    const parsed = parseTutorStubTraceJsonl(raw);
    if (parsed.events.some((event) => event?.type === 'run_end')) sealedTraces += 1;
    tracePaths.push(tracePath);
    sourceHashes[tracePath] = sha256(raw);
    malformed.push(...parsed.malformedLines.map((line) => ({ tracePath, ...line })));
    const backfill = backfillTutorStubTurnFailures({
      events: parsed.events,
      tracePath,
      includeClean: args['include-clean'],
    });
    turnsScanned += backfill.turnsScanned;
    records.push(...backfill.records);
  }

  const dbPath = resolveInput(args.db);
  let write = null;
  if (malformed.length && !args['dry-run'] && !args['allow-malformed']) {
    throw new Error(
      `Refusing SQL replacement: ${malformed.length} malformed JSONL line(s); inspect with --dry-run or override with --allow-malformed`,
    );
  }
  if (!args['dry-run']) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    try {
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      migrateTutorStubTurnFailureStore(db);
      write = replaceTutorStubTurnFailureRecords(db, records, { tracePaths, sourceHashes });
    } finally {
      db.close();
    }
  }

  const summary = summarizeTutorStubTurnFailures(records, {
    purpose: 'failure_focused_corrective_dataset_sql_ingest',
    zeroModelCalls: true,
    trainingLicensed: false,
    traceFiles: traceFiles.length,
    sealedTraces,
    turnsScanned,
    malformedLines: malformed.length,
    malformed,
    includeClean: args['include-clean'],
    allowMalformed: args['allow-malformed'],
    dbPath,
    dbWritten: !args['dry-run'],
    write,
  });
  console.log(JSON.stringify(summary, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`[tutor-stub-turn-failure-ingest] ${error.message}`);
  process.exit(1);
}
