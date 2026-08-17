#!/usr/bin/env node

// Post-block harm sweep for the edged-register main block
// (notes/2026-08-16-edged-register-calibration-draft.md §2.11, closed by
// Part 3 amendment 1).
//
// §2.11 registered the requirement in plain words: "The harm channel gets a
// reader, not a word list: a model reads every edged turn and a human rules
// on its flags." The word list cannot see who a sentence targets, and it
// misses in both directions — it fired 11 times on the two words "your
// capacity" in praise, and any cruel sentence phrased without its five nouns
// passes it unseen.
//
// Amendment 1 splits that requirement in two. During the run, the reader
// screens the word list's matches, so only a confirmed attack stops the
// block. After the run, this script reads EVERY tutor turn of the edged arm,
// match or no match, and lists what it calls an attack for the operator to
// rule on. The run-time screen buys attention; this sweep buys coverage.
//
// The reading never enters the endpoint. It is a safety record, not a score.
//
// Readings append one JSON object per line, so a stalled sweep resumes
// without re-reading a turn. Nothing here generates a dialogue.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { EDGED_REGISTER_MAIN_BLOCK as MAIN_GRID, harmGuardrailFindings } from '../services/edgedRegisterCalibration.js';
import { readHarmVerdict } from '../services/edgedRegisterHarmReader.js';
import { openEvaluationDbReadonly } from '../services/evaluationDbReadonly.js';
import { findDialogueLog } from './dump-turn-prompts.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_CONCURRENCY = 4;

function loadState(batchDir) {
  const file = path.join(batchDir, 'state.json');
  if (!fs.existsSync(file)) throw new Error(`no state at ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function withReadonlyDb(fn) {
  const { db, dbPath, reason } = openEvaluationDbReadonly(ROOT);
  if (!db) throw new Error(`evaluation DB unavailable at ${dbPath}: ${reason}`);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function loadDialogueLog(row) {
  for (const id of [row.dialogue_id, row.dialogue_content_hash]) {
    if (!id) continue;
    const found = findDialogueLog(id, { rootDir: ROOT });
    if (found?.log) return found.log;
  }
  return null;
}

/** Every tutor turn of every completed row in the named arms, in run order. */
export function sweepWindows(state, { arms }) {
  const jobs = state.jobs.filter(
    (job) => job.status === 'completed' && job.rowId && (!arms.length || arms.includes(job.arm)),
  );
  if (!jobs.length) throw new Error('no completed rows in this batch for those arms');

  const rows = withReadonlyDb((db) => {
    const select = db.prepare(
      `SELECT id, scenario_id, profile_name, dialogue_id, dialogue_content_hash
       FROM evaluation_results WHERE id = ?`,
    );
    return new Map(jobs.map((job) => [job.rowId, select.get(job.rowId)]));
  });

  const windows = [];
  for (const job of jobs) {
    const row = rows.get(job.rowId);
    if (!row) throw new Error(`job ${job.ordinal}: row ${job.rowId} not found in the evaluation DB`);
    const log = loadDialogueLog(row);
    // Fail closed: an unreadable log is unswept, and the sweep says so
    // rather than passing the row in silence.
    if (!log) {
      windows.push({ rowId: job.rowId, ordinal: job.ordinal, arm: job.arm, scenario: job.scenario, unreadable: true });
      continue;
    }
    const turns = Array.isArray(log.turnResults) ? log.turnResults : [];
    turns.forEach((turn, index) => {
      const tutorMessage = turn?.suggestions?.[0]?.message || turn?.suggestion?.message || turn?.tutorMessage || '';
      if (!String(tutorMessage).trim()) return;
      windows.push({
        rowId: job.rowId,
        ordinal: job.ordinal,
        arm: job.arm,
        scenario: job.scenario,
        turnIndex: turn?.turnIndex ?? index,
        learnerBefore: String(turn?.learnerMessage || '').trim(),
        tutorMessage: String(tutorMessage).trim(),
        // Recorded so the sweep shows what the word list would have said on
        // the same turn — the two channels are compared, not merged.
        wordListMatch:
          harmGuardrailFindings({ tutorMessage, postLearnerMessage: turns[index + 1]?.learnerMessage || '' })
            .map((finding) => finding.family)
            .join(',') || '',
      });
    });
  }
  return windows;
}

const keyOf = (window) => `${window.rowId}:${window.turnIndex ?? 'x'}`;

function loadDone(outPath) {
  if (!fs.existsSync(outPath)) return new Map();
  const done = new Map();
  for (const line of fs.readFileSync(outPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const entry = JSON.parse(trimmed);
    done.set(`${entry.rowId}:${entry.turnIndex ?? 'x'}`, entry);
  }
  return done;
}

async function runPool(items, concurrency, worker) {
  let next = 0;
  const failures = [];
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await worker(item);
      } catch (error) {
        failures.push({ key: keyOf(item), message: error.message });
        console.error(`[edged-harm] ${keyOf(item)} failed: ${error.message}`);
      }
    }
  });
  await Promise.all(lanes);
  return failures;
}

/** Rows the operator must rule on, and the two-channel disagreement count. */
export function summarizeSweep(entries) {
  const attacks = entries.filter((entry) => entry.verdict?.attacksPerson);
  const matched = entries.filter((entry) => entry.wordListMatch);
  const missedByList = attacks.filter((entry) => !entry.wordListMatch);
  const clearedByReader = matched.filter((entry) => !entry.verdict?.attacksPerson);
  return {
    turns: entries.length,
    attacks: attacks.length,
    wordListMatches: matched.length,
    readerFoundListMissed: missedByList.length,
    listFiredReaderCleared: clearedByReader.length,
    attackKeys: attacks.map((entry) => `${entry.rowId}:${entry.turnIndex}`),
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      'batch-dir': { type: 'string', default: '' },
      arms: { type: 'string', default: 'A' },
      out: { type: 'string', default: '' },
      model: { type: 'string', default: '' },
      concurrency: { type: 'string', default: String(DEFAULT_CONCURRENCY) },
      limit: { type: 'string', default: '' },
      mock: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/read-edged-register-harm-sweep.js --batch-dir <dir> [--arms A|A,B,C|all]\n' +
        '       [--out <file.jsonl>] [--model <id>] [--concurrency 4] [--limit N] [--mock]',
    );
    return;
  }
  if (!values['batch-dir']) throw new Error('--batch-dir is required');

  const armLetters = values.arms === 'all' ? [] : values.arms.split(',').map((s) => s.trim().toUpperCase());
  const known = new Set(MAIN_GRID.arms.map((armSpec) => armSpec.arm));
  for (const letter of armLetters) {
    if (!known.has(letter)) throw new Error(`unknown arm ${letter}; the block runs ${[...known].join(', ')}`);
  }

  const batchDir = path.resolve(ROOT, values['batch-dir']);
  const state = loadState(batchDir);
  const outPath = values.out
    ? path.resolve(ROOT, values.out)
    : path.join(batchDir, values.mock ? 'harm-sweep-mock.jsonl' : 'harm-sweep.jsonl');

  const windows = sweepWindows(state, { arms: armLetters });
  const unreadable = windows.filter((window) => window.unreadable);
  const readable = windows.filter((window) => !window.unreadable);
  const done = loadDone(outPath);
  let pending = readable.filter((window) => !done.has(keyOf(window)));
  if (values.limit) pending = pending.slice(0, Number(values.limit));

  console.log(
    `[edged-harm] ${readable.length} tutor turns in arms ${armLetters.join(',') || 'A,B,C'}, ` +
      `${done.size} already read, ${pending.length} to read${values.mock ? ' (mock, zero spend)' : ''}`,
  );
  for (const window of unreadable) {
    console.error(`[edged-harm] job ${window.ordinal} row ${window.rowId}: dialogue log missing — UNSWEPT`);
  }

  const stream = pending.length ? fs.createWriteStream(outPath, { flags: 'a' }) : null;
  const failures = await runPool(pending, Number(values.concurrency), async (window) => {
    const verdict = await readHarmVerdict(window, { model: values.model || null, mock: values.mock });
    const entry = {
      rowId: window.rowId,
      ordinal: window.ordinal,
      arm: window.arm,
      scenario: window.scenario,
      turnIndex: window.turnIndex,
      wordListMatch: window.wordListMatch,
      readAt: new Date().toISOString(),
      reader: values.mock ? 'mock' : `claude-code:${values.model || 'default'}`,
      verdict,
    };
    stream.write(`${JSON.stringify(entry)}\n`);
    done.set(keyOf(window), entry);
    if (verdict.attacksPerson) {
      console.log(`[edged-harm] ATTACK row ${window.rowId} turn ${window.turnIndex}: ${verdict.reason}`);
    }
  });
  if (stream) await new Promise((resolve) => stream.end(resolve));

  const summary = summarizeSweep([...done.values()]);
  console.log(
    `[edged-harm] ${summary.turns} turns read, ${summary.attacks} called an attack on the person; ` +
      `word list fired ${summary.wordListMatches} times`,
  );
  console.log(
    `[edged-harm] the two channels disagree: reader found ${summary.readerFoundListMissed} the list missed, ` +
      `list fired ${summary.listFiredReaderCleared} times the reader cleared`,
  );
  if (summary.attacks) {
    console.log(`[edged-harm] operator ruling needed on: ${summary.attackKeys.join(', ')}`);
  }
  console.log(`[edged-harm] ${path.relative(ROOT, outPath)}`);
  if (unreadable.length || failures.length) {
    console.error(`[edged-harm] ${unreadable.length} unswept row(s), ${failures.length} failed turn(s); re-run`);
    process.exitCode = 2;
  }
}

if (process.argv[1] === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(`[edged-harm] ${error.message}`);
    process.exitCode = 1;
  });
}
