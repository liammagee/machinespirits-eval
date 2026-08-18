#!/usr/bin/env node

// Second read of the edged-register calibration transcripts
// (notes/2026-08-16-edged-register-calibration-draft.md §3.10.2).
//
// The frozen endpoint reader returns ONE verdict — yes, partly or no — for a
// task the tutor usually sets in several parts. The main block moved almost
// entirely from yes to partly, so the interesting question is which part the
// learner dropped. One verdict cannot answer it.
//
// This reader is shown the same window and splits the task instead: it lists
// the parts the tutor set, tags each part with a fixed kind, and says whether
// the learner did that part. It also counts the parts, because a sharper tutor
// may simply ask for MORE — if it does, "partly" means a longer task, not a
// worse learner, and the counts separate the two.
//
// The reader stays blind. It never sees the version, the scenario, the
// resistance signal, the frozen endpoint verdict, or the row's place in the
// run. The version split happens in analysis, never in the reader's prompt.
//
// This reads rows already paid for; it generates no dialogue. Readings append
// one JSON object per line, so a stalled run resumes without re-reading a row.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { readWindows } from './read-edged-register-endpoint.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const CALL_TIMEOUT_MS = 300_000;
const DEFAULT_CONCURRENCY = 4;

const PART_KINDS = ['make_case', 'state_verdict', 'name_feature', 'revise_claim', 'other'];

const SYSTEM_PROMPT = `You read one moment from a tutoring dialogue and answer questions about it.

You are given three things: a learner's turn, the tutor's reply to it, and the learner's next turn.

The tutor's reply ends by setting the learner a task. That task usually has more than one part — for example "give me a counterexample AND say what feature makes it one" is two parts, and "complete the sentence in your own words" is one part.

Your job is to split the task into its parts and report each part separately.

For every part, give:
- part: what the tutor asked for, in one line, using the tutor's own terms.
- kind: one of these five labels, whichever fits best.
  - make_case: produce an example, a counterexample, a case, or an original sentence of the learner's own.
  - state_verdict: say which way it goes — hold or break, proves or fails, yes or no, choose one.
  - name_feature: name the feature, condition, property or reason that decides.
  - revise_claim: change, defend or withdraw a claim the learner made earlier.
  - other: none of the above fits.
- learner_did: yes, partly or no — did the learner do THIS part in its next turn.
- quote: the words from the learner's next turn that do this part, or empty if it did not.

Rules:
- Split only what the tutor actually asked for. Do not invent a part the tutor did not set, and do not merge two things the tutor asked for into one part.
- If the tutor set one part only, return one part.
- Judge each part on its own. A learner can do the first part fully and skip the second.
- A learner that restates the tutor's own example has NOT made a case of its own; that is "no" for a make_case part.
- A learner that keeps a phrase of complaint at the front of its turn ("this still feels dead") is not failing a part for that reason alone. Read what follows the phrase.

Answer only from the text in front of you. Return the JSON object and nothing else.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['parts'],
  properties: {
    parts: {
      type: 'array',
      minItems: 1,
      description: 'One entry per part of the task the tutor set, in the order the tutor set them.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['part', 'kind', 'learner_did', 'quote'],
        properties: {
          part: { type: 'string', description: "One line, in the tutor's own terms." },
          kind: { type: 'string', enum: PART_KINDS },
          learner_did: { type: 'string', enum: ['yes', 'partly', 'no'] },
          quote: { type: 'string', description: "Quote from the learner's next turn, or empty." },
        },
      },
    },
  },
};

function loadState(batchDir) {
  const file = path.join(batchDir, 'state.json');
  if (!fs.existsSync(file)) throw new Error(`no state at ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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
  if (!Array.isArray(parsed.parts) || !parsed.parts.length) {
    throw new Error(`${label}: reading has no parts`);
  }
  parsed.parts.forEach((part, index) => {
    const where = `${label} part ${index + 1}`;
    if (!String(part?.part || '').trim()) throw new Error(`${where}: part text is empty`);
    if (!PART_KINDS.includes(part?.kind)) throw new Error(`${where}: kind is ${JSON.stringify(part?.kind)}`);
    if (!['yes', 'partly', 'no'].includes(part?.learner_did)) {
      throw new Error(`${where}: learner_did is ${JSON.stringify(part?.learner_did)}`);
    }
    if (typeof part.quote !== 'string') throw new Error(`${where}: quote is not a string`);
  });
  return parsed;
}

// Deterministic stand-in so the plumbing — window build, prompt, parse, append,
// resume, summary — runs with zero spend. Never used without --mock.
function mockReading(window) {
  const post = window.postLearner.toLowerCase();
  const madeCase = /for example|counterexample|suppose|imagine|consider/.test(post);
  const gaveVerdict = /\b(hold|break|proves|fails)\b/.test(post);
  return {
    parts: [
      {
        part: 'mock: give a case of your own',
        kind: 'make_case',
        learner_did: madeCase ? 'yes' : 'no',
        quote: madeCase ? window.postLearner.slice(0, 60) : '',
      },
      {
        part: 'mock: say whether it holds or breaks',
        kind: 'state_verdict',
        learner_did: gaveVerdict ? 'yes' : 'no',
        quote: gaveVerdict ? window.postLearner.slice(0, 60) : '',
      },
    ],
  };
}

async function readOne(window, { model, mock }) {
  if (mock) return mockReading(window);
  const result = await callAIWithCliBridge(
    { provider: 'claude-code', model },
    SYSTEM_PROMPT,
    userPrompt(window),
    `edged-parts-read-${window.rowId}`,
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
        console.error(`[edged-parts] row ${item.rowId} failed: ${error.message}`);
      }
    }
  });
  await Promise.all(lanes);
  return failures;
}

/**
 * Summary is per scenario and per kind of part. It never groups by version:
 * the version split belongs in analysis, after the reading sheet is closed.
 */
function summarize(readings) {
  const byScenario = new Map();
  const byKind = new Map();
  for (const entry of readings) {
    const cell = byScenario.get(entry.scenario) || { scenario: entry.scenario, rows: 0, partsSet: 0, partsDone: 0 };
    cell.rows += 1;
    for (const part of entry.reading.parts) {
      cell.partsSet += 1;
      if (part.learner_did === 'yes') cell.partsDone += 1;
      const kind = byKind.get(part.kind) || { kind: part.kind, set: 0, done: 0 };
      kind.set += 1;
      if (part.learner_did === 'yes') kind.done += 1;
      byKind.set(part.kind, kind);
    }
    byScenario.set(entry.scenario, cell);
  }
  return {
    scenarios: [...byScenario.values()].sort((a, b) => a.scenario.localeCompare(b.scenario)),
    kinds: [...byKind.values()].sort((a, b) => b.set - a.set),
  };
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
      'Usage: node scripts/read-edged-register-task-parts.js --batch-dir <dir> [--out <file.jsonl>]\n' +
        '       [--model <id>] [--concurrency 4] [--limit N] [--mock]',
    );
    return;
  }
  if (!values['batch-dir']) throw new Error('--batch-dir is required');

  const batchDir = path.resolve(ROOT, values['batch-dir']);
  const state = loadState(batchDir);
  const outPath = values.out
    ? path.resolve(ROOT, values.out)
    : path.join(batchDir, values.mock ? 'task-parts-readings-mock.jsonl' : 'task-parts-readings.jsonl');

  const windows = readWindows(state);
  const done = loadDone(outPath);
  let pending = windows.filter((window) => !done.has(window.rowId));
  if (values.limit) pending = pending.slice(0, Number(values.limit));

  console.log(
    `[edged-parts] ${windows.length} rows in batch, ${done.size} already read, ${pending.length} to read` +
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
    const didCount = reading.parts.filter((part) => part.learner_did === 'yes').length;
    console.log(
      `[edged-parts] row ${window.rowId} (${done.size}/${windows.length}) ` +
        `${didCount}/${reading.parts.length} parts done [${reading.parts.map((p) => p.kind).join(',')}]`,
    );
  });
  if (stream) await new Promise((resolve) => stream.end(resolve));

  const readings = [...done.values()];
  const { scenarios, kinds } = summarize(readings);
  for (const cell of scenarios) {
    console.log(
      `[edged-parts] ${cell.scenario}: ${cell.partsSet} parts set over ${cell.rows} rows ` +
        `(${(cell.partsSet / cell.rows).toFixed(2)} per row), ${cell.partsDone} done`,
    );
  }
  for (const kind of kinds) {
    console.log(`[edged-parts] kind ${kind.kind}: set ${kind.set}, done ${kind.done}`);
  }
  console.log(`[edged-parts] ${path.relative(ROOT, outPath)} — ${readings.length}/${windows.length} rows read`);
  if (failures.length) {
    console.error(`[edged-parts] ${failures.length} row(s) failed; re-run to pick them up`);
    process.exitCode = 2;
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[edged-parts] ${error.message}`);
    process.exitCode = 1;
  });
}
