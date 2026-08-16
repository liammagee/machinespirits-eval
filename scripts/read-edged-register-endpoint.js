#!/usr/bin/env node

// Revised endpoint reader for the edged-register calibration
// (notes/2026-08-16-edged-register-calibration-draft.md §2.16).
//
// The §2.5 M-C2 human read failed at 33% disagreement, so the lexical
// endpoint is void for selection. This script applies the revised endpoint:
// a model reader is shown one moment — the learner's earlier turn, the
// tutor's push, the learner's next turn — and answers what task the tutor
// set and whether the learner did it.
//
// The reader is blind. It never sees the cell, the resistance signal the
// persona was told to hold, the row's place in the run, or the old
// classifier's verdict. It reads the same window the operator read.
//
// Readings are appended one JSON object per line, so a stalled run resumes
// without re-reading a row. Nothing here generates a dialogue; it reads rows
// already paid for.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import yaml from 'yaml';

import { EDGED_REGISTER_CALIBRATION as GRID } from '../services/edgedRegisterCalibration.js';
import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { openEvaluationDbReadonly } from '../services/evaluationDbReadonly.js';
import { analyzeCharismaDesireRows } from './report-charisma-desire-breakthrough-matrix.js';
import { findDialogueLog } from './dump-turn-prompts.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const CALL_TIMEOUT_MS = 300_000;
const DEFAULT_CONCURRENCY = 4;

const SYSTEM_PROMPT = `You read one moment from a tutoring dialogue and answer questions about it.

You are given three things: a learner's turn, the tutor's reply to it, and the learner's next turn.

The tutor's reply always ends by setting the learner a task — name the one feature that decides, give a counterexample, complete this sentence in your own words, choose hold or break, and so on. Your first job is to say what that task was, in one line, using the tutor's own terms.

Your second job is to say whether the learner did that task in its next turn: yes, partly, or no. Quote the words that do it. "Partly" means the learner did some of what was set and left the rest — for example it named a feature but gave no counterexample when both were asked for.

Your third job is a separate reading: did the learner do fresh work of its own in that next turn? Two rules apply to this question and to no other:
- A learner that keeps a phrase of complaint or reluctance at the front of its turn ("this still feels dead", "it still feels like repeating terms") is NOT stuck for that reason alone. Read what follows the phrase.
- A learner that restates the tutor's own example in new words has NOT done fresh work. Fresh work means the learner brings a case, a distinction, a defeater or a revision of its own earlier claim that the tutor did not hand it.

Answer only from the text in front of you. Return the JSON object and nothing else.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tutor_task', 'did_task', 'did_task_quote', 'fresh_work', 'fresh_work_quote', 'echoes_tutor_example'],
  properties: {
    tutor_task: { type: 'string', description: "One line: the task the tutor's reply set the learner." },
    did_task: { type: 'string', enum: ['yes', 'partly', 'no'] },
    did_task_quote: {
      type: 'string',
      description: "Quote from the learner's next turn, or empty if it did not do the task.",
    },
    fresh_work: { type: 'boolean' },
    fresh_work_quote: { type: 'string' },
    echoes_tutor_example: {
      type: 'boolean',
      description: "True if the learner mainly restates the tutor's own example.",
    },
  },
};

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

/**
 * The read window per completed job, in run order. Fails closed twice: an
 * unreadable window is unmeasured, and identical endpoint turns across rows
 * mean the loader silently fell back to the scenario's scripted text — the
 * defect that produced a whole reading sheet of the same learner turn.
 */
function readWindows(state) {
  const scenariosPath = path.join(ROOT, GRID.scenarioSource);
  const scenarios = yaml.parse(fs.readFileSync(scenariosPath, 'utf8'))?.scenarios || {};
  const jobs = state.jobs.filter((job) => job.status === 'completed' && job.rowId);
  if (!jobs.length) throw new Error('no completed rows in this batch');

  const rows = withReadonlyDb((db) => {
    const select = db.prepare(
      `SELECT id, run_id, scenario_id, profile_name, dialogue_id, dialogue_content_hash, success
       FROM evaluation_results WHERE id = ?`,
    );
    return jobs.map((job) => {
      const row = select.get(job.rowId);
      if (!row) throw new Error(`job ${job.ordinal}: row ${job.rowId} not found in the evaluation DB`);
      return row;
    });
  });

  const analyzed = analyzeCharismaDesireRows(rows, scenarios, { loadLog: (row) => loadDialogueLog(row) });
  const byRowId = new Map(analyzed.map((entry) => [entry.rowId, entry]));

  const windows = jobs.map((job) => {
    const entry = byRowId.get(job.rowId);
    if (!entry) throw new Error(`job ${job.ordinal}: row ${job.rowId} produced no read window`);
    for (const field of ['preLearner', 'tutorMessage', 'postLearner']) {
      if (!String(entry[field] || '').trim()) {
        throw new Error(`job ${job.ordinal} (row ${job.rowId}): ${field} is empty; the window is unreadable`);
      }
    }
    return {
      rowId: job.rowId,
      ordinal: job.ordinal,
      block: job.block,
      scenario: job.scenario,
      preLearner: String(entry.preLearner).trim(),
      tutorMessage: String(entry.tutorMessage).trim(),
      postLearner: String(entry.postLearner).trim(),
    };
  });

  const distinct = new Set(windows.map((w) => w.postLearner)).size;
  if (distinct < windows.length) {
    throw new Error(
      `only ${distinct} distinct endpoint turns across ${windows.length} rows — the dialogue loader fell back to scripted text`,
    );
  }
  return windows;
}

function userPrompt(window) {
  return [
    "The learner's turn:",
    '',
    window.preLearner,
    '',
    "The tutor's reply:",
    '',
    window.tutorMessage,
    '',
    "The learner's next turn:",
    '',
    window.postLearner,
  ].join('\n');
}

function parseJsonObject(text, label) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1].trim() : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`${label}: no JSON object in the reader's reply`);
  return JSON.parse(body.slice(start, end + 1));
}

function checkReading(parsed, label) {
  for (const field of OUTPUT_SCHEMA.required) {
    if (!(field in parsed)) throw new Error(`${label}: reading has no ${field}`);
  }
  if (!['yes', 'partly', 'no'].includes(parsed.did_task)) {
    throw new Error(`${label}: did_task is ${JSON.stringify(parsed.did_task)}`);
  }
  if (typeof parsed.fresh_work !== 'boolean') throw new Error(`${label}: fresh_work is not a boolean`);
  if (typeof parsed.echoes_tutor_example !== 'boolean') {
    throw new Error(`${label}: echoes_tutor_example is not a boolean`);
  }
  return parsed;
}

// Deterministic stand-in so the plumbing — window build, prompt, parse,
// append, resume, summary — runs with zero spend. Never used without --mock.
function mockReading(window) {
  const post = window.postLearner.toLowerCase();
  const named = /because|feature|if |unless|would break|counterexample/.test(post);
  return {
    tutor_task: 'mock: name the deciding feature and defend it',
    did_task: named ? 'yes' : 'partly',
    did_task_quote: window.postLearner.slice(0, 80),
    fresh_work: named,
    fresh_work_quote: named ? window.postLearner.slice(0, 60) : '',
    echoes_tutor_example: false,
  };
}

async function readOne(window, { model, mock }) {
  if (mock) return mockReading(window);
  const result = await callAIWithCliBridge(
    { provider: 'claude-code', model },
    SYSTEM_PROMPT,
    userPrompt(window),
    `edged-endpoint-read-${window.rowId}`,
    { outputSchema: OUTPUT_SCHEMA, timeoutMs: CALL_TIMEOUT_MS, maxStdoutBytes: 512_000, maxStderrBytes: 64_000 },
  );
  return checkReading(parseJsonObject(result.text, `row ${window.rowId}`), `row ${window.rowId}`);
}

function loadDone(outPath) {
  if (!fs.existsSync(outPath)) return new Map();
  const done = new Map();
  for (const line of fs.readFileSync(outPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const entry = JSON.parse(trimmed);
    done.set(entry.rowId, entry);
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
        failures.push({ rowId: item.rowId, message: error.message });
        console.error(`[edged-endpoint] row ${item.rowId} failed: ${error.message}`);
      }
    }
  });
  await Promise.all(lanes);
  return failures;
}

function summarize(readings) {
  const byCell = new Map();
  for (const entry of readings) {
    const cell = byCell.get(entry.scenario) || {
      scenario: entry.scenario,
      rows: 0,
      did: 0,
      partly: 0,
      fresh: 0,
      echo: 0,
    };
    cell.rows += 1;
    if (entry.reading.did_task === 'yes') cell.did += 1;
    if (entry.reading.did_task === 'partly') cell.partly += 1;
    if (entry.reading.fresh_work) cell.fresh += 1;
    if (entry.reading.echoes_tutor_example) cell.echo += 1;
    byCell.set(entry.scenario, cell);
  }
  return [...byCell.values()].sort((a, b) => a.scenario.localeCompare(b.scenario));
}

async function main() {
  const { values } = parseArgs({
    options: {
      'batch-dir': { type: 'string', default: '' },
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
      'Usage: node scripts/read-edged-register-endpoint.js --batch-dir <dir> [--out <file.jsonl>]\n' +
        '       [--model <id>] [--concurrency 4] [--limit N] [--mock]',
    );
    return;
  }
  if (!values['batch-dir']) throw new Error('--batch-dir is required');

  const batchDir = path.resolve(ROOT, values['batch-dir']);
  const state = loadState(batchDir);
  const outPath = values.out
    ? path.resolve(ROOT, values.out)
    : path.join(batchDir, values.mock ? 'endpoint-readings-mock.jsonl' : 'endpoint-readings.jsonl');

  const windows = readWindows(state);
  const done = loadDone(outPath);
  let pending = windows.filter((window) => !done.has(window.rowId));
  if (values.limit) pending = pending.slice(0, Number(values.limit));

  console.log(
    `[edged-endpoint] ${windows.length} rows in batch, ${done.size} already read, ${pending.length} to read` +
      `${values.mock ? ' (mock, zero spend)' : ''}`,
  );
  if (!pending.length && !done.size) throw new Error('nothing to read');

  const stream = pending.length ? fs.createWriteStream(outPath, { flags: 'a' }) : null;
  const failures = await runPool(pending, Number(values.concurrency), async (window) => {
    const reading = await readOne(window, { model: values.model || null, mock: values.mock });
    const entry = {
      rowId: window.rowId,
      ordinal: window.ordinal,
      block: window.block,
      scenario: window.scenario,
      readAt: new Date().toISOString(),
      reader: values.mock ? 'mock' : `claude-code:${values.model || 'default'}`,
      reading,
    };
    stream.write(`${JSON.stringify(entry)}\n`);
    done.set(window.rowId, entry);
    console.log(`[edged-endpoint] row ${window.rowId} (${done.size}/${windows.length}) did_task=${reading.did_task}`);
  });
  if (stream) await new Promise((resolve) => stream.end(resolve));

  const readings = [...done.values()];
  for (const cell of summarize(readings)) {
    console.log(
      `[edged-endpoint] ${cell.scenario}: did the task ${cell.did}/${cell.rows} ` +
        `(+${cell.partly} partly), fresh work ${cell.fresh}/${cell.rows}, echoes tutor ${cell.echo}`,
    );
  }
  console.log(`[edged-endpoint] ${path.relative(ROOT, outPath)} — ${readings.length}/${windows.length} rows read`);
  if (failures.length) {
    console.error(`[edged-endpoint] ${failures.length} row(s) failed; re-run to pick them up`);
    process.exitCode = 2;
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[edged-endpoint] ${error.message}`);
    process.exitCode = 1;
  });
}
