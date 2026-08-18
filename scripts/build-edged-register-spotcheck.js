#!/usr/bin/env node

// Builds the operator spot-check sheet for the revised endpoint
// (notes/2026-08-16-edged-register-calibration-draft.md §2.17).
//
// The model reader is now the instrument. The twelve marks the operator made
// on 2026-08-17 check the OLD question ("did the learner move?"), not this
// one, so the reader has never been checked against a human.
//
// The check is cheap by design: the reader states its answer, and the operator
// agrees or disagrees. That is weaker than a blind read, and the sheet says so
// in its own header. It is the trade the operator chose over a cold read.
//
// The twelve rows are drawn from the yes/partly line inside the four kept
// cells, six each way, because that line is the only thing the corridor is
// sensitive to: 43% of the batch reads "partly", and counting it flips the
// pooled rate from 0.48 to 0.92. A random twelve would mostly confirm easy
// "yes" calls and check nothing.
//
// Selection is by ordinal with a fixed spread, so the sheet is reproducible
// and no row is picked by hand. Zero paid calls.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { readWindows } from './read-edged-register-endpoint.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const PER_CLASS = 6;

function loadJson(file) {
  if (!fs.existsSync(file)) throw new Error(`missing ${path.relative(ROOT, file)}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadReadings(batchDir) {
  const file = path.join(batchDir, 'endpoint-readings.jsonl');
  if (!fs.existsSync(file)) throw new Error(`missing ${path.relative(ROOT, file)}`);
  const byRowId = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed) {
      const entry = JSON.parse(trimmed);
      byRowId.set(entry.rowId, entry);
    }
  }
  return byRowId;
}

function keptScenarios(batchDir) {
  const report = loadJson(path.join(batchDir, 'corridor-report-revised-primary.json'));
  const kept = report.decision.cells.filter((cell) => cell.verdict === 'kept').map((cell) => cell.scenario);
  if (!kept.length) throw new Error('the primary reading kept no cell; there is no corridor to spot-check');
  return new Set(kept);
}

// Even spread over the class, first and last always included. No hand-picking.
function spread(items, count) {
  if (items.length <= count) return items;
  const step = (items.length - 1) / (count - 1);
  return Array.from({ length: count }, (unused, i) => items[Math.round(i * step)]);
}

function pickRows(windows, readings, kept) {
  const pool = windows
    .filter((window) => kept.has(window.scenario) && readings.has(window.rowId))
    .sort((a, b) => a.ordinal - b.ordinal);
  const byClass = { yes: [], partly: [] };
  for (const window of pool) {
    const answer = readings.get(window.rowId).reading.did_task;
    if (byClass[answer]) byClass[answer].push(window);
  }
  for (const [answer, rows] of Object.entries(byClass)) {
    if (rows.length < PER_CLASS) {
      throw new Error(`only ${rows.length} "${answer}" rows in the kept cells; the sheet needs ${PER_CLASS}`);
    }
  }
  // Interleave so the sheet does not run six "yes" rows then six "partly" ones.
  const picked = [];
  const yes = spread(byClass.yes, PER_CLASS);
  const partly = spread(byClass.partly, PER_CLASS);
  for (let i = 0; i < PER_CLASS; i += 1) picked.push(partly[i], yes[i]);
  return picked;
}

function sheetHeader(count) {
  return [
    '# Endpoint spot check — does the reader call the task the way you would?',
    '',
    'The model reader is now the measuring instrument for the study. Your marks',
    'on 2026-08-17 checked the old question — did the learner move? — not this',
    'one, so this reader has never been checked against a person.',
    '',
    `Read the three turns, then say if you agree with the reader's answer. ${count} rows.`,
    '',
    '**What this check can and cannot license.** The reader states its answer',
    'before you read, so you are confirming a claim, not reading cold. That is',
    'weaker than a blind read and can pull you toward agreement. It is the trade',
    'you chose over a slow cold read, and it is written here so the limit travels',
    'with the number.',
    '',
    '**Why these twelve rows.** They sit on the yes/partly line inside the four',
    'kept cells, six each way. That line is the only thing the corridor is',
    'sensitive to: 43% of the batch reads "partly", and counting it as a',
    'conversion lifts the pooled rate from 0.48 to 0.92 and kills every cell. The',
    'rows are picked by ordinal at a fixed spread, not by hand.',
    '',
    'The cell name and the run position are left out on purpose.',
    '',
    '**Answer per row:** agree, or disagree — and if you disagree, say what the',
    'answer should be (yes, partly, or no).',
    '',
    '---',
    '',
  ].join('\n');
}

function sheetRow(window, entry, index, total) {
  const { reading } = entry;
  return [
    `## Row ${index + 1} of ${total} — id ${window.rowId}`,
    '',
    "### The learner's turn",
    '',
    window.preLearner,
    '',
    "### The tutor's reply",
    '',
    window.tutorMessage,
    '',
    "### The learner's next turn",
    '',
    window.postLearner,
    '',
    '### What the reader said',
    '',
    `- **Task the tutor set:** ${reading.tutor_task}`,
    `- **Did the learner do it:** ${reading.did_task}`,
    `- **On these words:** ${reading.did_task_quote ? `"${reading.did_task_quote}"` : '(none quoted)'}`,
    '',
    '**Agree?**',
    '',
    '---',
    '',
  ].join('\n');
}

function main() {
  const { values } = parseArgs({
    options: {
      'batch-dir': { type: 'string', default: '' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: node scripts/build-edged-register-spotcheck.js --batch-dir <dir>');
    return;
  }
  if (!values['batch-dir']) throw new Error('--batch-dir is required');
  const batchDir = path.resolve(ROOT, values['batch-dir']);

  const state = loadJson(path.join(batchDir, 'state.json'));
  const readings = loadReadings(batchDir);
  const kept = keptScenarios(batchDir);
  const windows = readWindows(state);
  const picked = pickRows(windows, readings, kept);

  const sheet = [sheetHeader(picked.length)];
  const template = [];
  picked.forEach((window, index) => {
    const entry = readings.get(window.rowId);
    sheet.push(sheetRow(window, entry, index, picked.length));
    template.push({
      rowId: window.rowId,
      ordinal: window.ordinal,
      scenario: window.scenario,
      readerAnswer: entry.reading.did_task,
      operatorAnswer: null, // 'yes' | 'partly' | 'no'
      note: '',
    });
  });

  const sheetPath = path.join(batchDir, 'endpoint-spotcheck-sheet.md');
  fs.writeFileSync(sheetPath, `${sheet.join('\n')}\n`);
  const templatePath = path.join(batchDir, 'endpoint-spotcheck-template.json');
  fs.writeFileSync(templatePath, `${JSON.stringify(template, null, 2)}\n`);

  console.log(`[edged-spotcheck] ${path.relative(ROOT, sheetPath)}`);
  console.log(`[edged-spotcheck] ${path.relative(ROOT, templatePath)}`);
  console.log(`[edged-spotcheck] ${picked.length} rows from ${kept.size} kept cells, ${PER_CLASS} per answer class`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(`[edged-spotcheck] ${error.message}`);
    process.exitCode = 1;
  }
}
