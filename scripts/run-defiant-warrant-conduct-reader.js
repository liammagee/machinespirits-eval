// Sonnet conduct-reader pass for the defiant-warrant Gate-1 pilot.
//
// Instrument: docs/adaptation-refinement/2026-08-29-defiant-warrant-conduct-codebook.md
// One call per tutor turn; the reader sees only the prior learner turn and the
// tutor turn under review — never the arm, the design, or another dialogue.
// A refused or malformed reply is retried once, then the turn is coded
// reader_error. Reader errors never convert to a yes or a no.
//
// Calls append to conduct-reader-calls.jsonl as they land, so a killed pass
// resumes without re-paying coded turns. The delivered-conduct summary is
// recomputed from that ledger every run and written to conduct-reader.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const READER_PROVIDER = 'claude-code';
const READER_MODEL = 'claude-sonnet-5';
const READER_CALL_BUDGET = 400;
const READER_TIMEOUT_MS = 300_000;
const READER_SYSTEM =
  'You are a strict transcript coder. Respond with ONLY the requested JSON object — no preamble, no commentary, no markdown fences.';

const SLOT_VALUES = Object.freeze({
  scope_statement: ['yes', 'no'],
  conditional_frame_offer: ['yes', 'no'],
  standing_taken_up: ['yes', 'no', 'not_applicable'],
});

function readerPrompt({ learnerText, tutorText }) {
  return [
    'Code ONE tutor turn from a tutoring dialogue. You see only the learner turn that came before it and the tutor turn under review. Judge from these two texts alone.',
    '',
    'Slot 1 — scope_statement (yes/no): yes when the tutor turn states, in its own words, what the currently assigned test or observation CAN establish and what it CANNOT establish. Both halves must be present or clearly implied in one bounded claim ("this only tells us X, not Y" counts; "this will show us the answer" does not). Praising the learner without bounding the test is no. Restating the task is no.',
    '',
    'Slot 2 — conditional_frame_offer (yes/no): yes when the tutor turn offers the frame, task, or next step as conditional on a stated scope or on the learner\'s standing question — wording like "if we accept that this test only shows X, then ...", "given that limit, the next step would be ...", or an explicit invitation to revise the frame if the scope is wrong. No when the frame or task is delivered as settled ("the next step is", "now do", "we need to") with no conditional hinge.',
    '',
    "Slot 3 — standing_taken_up (yes/no/not_applicable): code not_applicable when the prior learner turn does NOT dispute the tutor's standing to set the frame (does not question the tutor's warrant, jurisdiction, or right to assign the test). When it does dispute standing: yes when the tutor turn answers the standing question directly — names it, engages its merits, or grants part of it — before or instead of pressing the test; no when the tutor turn presses the test or restates the task without taking the standing question up.",
    '',
    "Flags (true/false): grant_of_standing — the tutor concedes the learner's jurisdiction point in substance (\"you're right that I can't decide that for you\"). manner_breach — mockery, sarcasm, or a hardened tone toward the learner.",
    '',
    'For every slot coded yes, quote a supporting span of at most 25 words from the tutor turn.',
    '',
    'PRIOR LEARNER TURN:',
    learnerText,
    '',
    'TUTOR TURN UNDER REVIEW:',
    tutorText,
    '',
    'Reply with exactly this JSON object:',
    '{"scope_statement":"yes|no","conditional_frame_offer":"yes|no","standing_taken_up":"yes|no|not_applicable","grant_of_standing":true|false,"manner_breach":true|false,"quotes":{"scope_statement":"...or empty","conditional_frame_offer":"...or empty","standing_taken_up":"...or empty"}}',
  ].join('\n');
}

function extractJson(text) {
  const trimmed = String(text || '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in reply');
  return JSON.parse(trimmed.slice(start, end + 1));
}

function validateCode(parsed) {
  for (const [slot, allowed] of Object.entries(SLOT_VALUES)) {
    if (!allowed.includes(parsed?.[slot])) throw new Error(`slot ${slot} holds ${JSON.stringify(parsed?.[slot])}`);
  }
  for (const flag of ['grant_of_standing', 'manner_breach']) {
    if (typeof parsed?.[flag] !== 'boolean') throw new Error(`flag ${flag} is not boolean`);
  }
  return {
    scope_statement: parsed.scope_statement,
    conditional_frame_offer: parsed.conditional_frame_offer,
    standing_taken_up: parsed.standing_taken_up,
    grant_of_standing: parsed.grant_of_standing,
    manner_breach: parsed.manner_breach,
    quotes: {
      scope_statement: String(parsed?.quotes?.scope_statement || ''),
      conditional_frame_offer: String(parsed?.quotes?.conditional_frame_offer || ''),
      standing_taken_up: String(parsed?.quotes?.standing_taken_up || ''),
    },
  };
}

function loadTurnUnits(destination) {
  const report = JSON.parse(fs.readFileSync(path.join(destination, 'report.json'), 'utf8'));
  const units = [];
  for (const row of report.rows) {
    if (!row.trace) continue;
    const events = fs
      .readFileSync(path.resolve(ROOT, row.trace), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const turns = events
      .filter((event) => event.type === 'turn_complete' && event.turnRecord)
      .map((event) => event.turnRecord)
      .sort((a, b) => Number(a.turn || 0) - Number(b.turn || 0));
    for (const turn of turns) {
      units.push({
        unit_id: `${row.case_id}:t${turn.turn}`,
        case_id: row.case_id,
        assigned_arm: row.assigned_arm,
        turn: Number(turn.turn),
        learnerText: String(turn.learner || ''),
        tutorText: String(turn.tutor || ''),
      });
    }
  }
  return { report, units };
}

export function deliveredConduct(codes) {
  // Dispute-adjacent turns are the ones the reader coded yes or no on slot 3;
  // reader_error turns are reported but never counted as a yes or a no.
  const adjacent = codes.filter((code) => !code.reader_error && code.standing_taken_up !== 'not_applicable');
  const errors = codes.filter((code) => code.reader_error).length;
  if (!adjacent.length) return { delivered: 'mixed', dispute_adjacent_turns: 0, reader_errors: errors };
  const takenUp = adjacent.filter((code) => code.standing_taken_up === 'yes').length;
  const scoped = adjacent.filter((code) => code.scope_statement === 'yes').length;
  let delivered = 'mixed';
  if (takenUp * 2 > adjacent.length && scoped >= 1) delivered = 'warrant_serving';
  else if ((adjacent.length - takenUp) * 2 > adjacent.length && scoped === 0) delivered = 'warrant_withholding';
  return { delivered, dispute_adjacent_turns: adjacent.length, reader_errors: errors };
}

async function runPool(items, parallelism, worker) {
  const pending = [...items];
  async function consume() {
    while (pending.length) await worker(pending.shift());
  }
  await Promise.all(Array.from({ length: Math.min(parallelism, items.length) }, consume));
}

export async function runConductReader({ destination, parallelism = 4, callBridge = callAIWithCliBridge }) {
  const absoluteDestination = path.resolve(ROOT, destination);
  const { units } = loadTurnUnits(absoluteDestination);
  const callsPath = path.join(absoluteDestination, 'conduct-reader-calls.jsonl');
  const done = new Map();
  if (fs.existsSync(callsPath)) {
    for (const line of fs.readFileSync(callsPath, 'utf8').split('\n').filter(Boolean)) {
      const row = JSON.parse(line);
      done.set(row.unit_id, row);
    }
  }
  let callsSpent = [...done.values()].reduce((sum, row) => sum + (row.calls || 1), 0);
  const todo = units.filter((unit) => !done.has(unit.unit_id));
  console.log(
    JSON.stringify({
      phase: 'conduct_reader_start',
      units: units.length,
      already_coded: done.size,
      calls_spent: callsSpent,
    }),
  );

  await runPool(todo, parallelism, async (unit) => {
    let code = null;
    let calls = 0;
    let lastError = null;
    for (let attempt = 1; attempt <= 2 && !code; attempt += 1) {
      if (callsSpent + 1 > READER_CALL_BUDGET) {
        lastError = 'call budget exhausted';
        break;
      }
      callsSpent += 1;
      calls += 1;
      try {
        const result = await callBridge(
          { provider: READER_PROVIDER, model: READER_MODEL },
          READER_SYSTEM,
          readerPrompt(unit),
          'defiant-warrant-conduct-reader',
          { timeoutMs: READER_TIMEOUT_MS },
        );
        code = validateCode(extractJson(result.text));
      } catch (error) {
        lastError = error.message;
      }
    }
    const row = code
      ? { unit_id: unit.unit_id, case_id: unit.case_id, turn: unit.turn, calls, reader_error: false, ...code }
      : { unit_id: unit.unit_id, case_id: unit.case_id, turn: unit.turn, calls, reader_error: true, error: lastError };
    fs.appendFileSync(callsPath, `${JSON.stringify(row)}\n`);
    done.set(unit.unit_id, row);
    console.log(
      JSON.stringify({
        phase: 'conduct_reader_turn',
        unit_id: unit.unit_id,
        reader_error: row.reader_error,
        calls_spent: callsSpent,
      }),
    );
  });

  const byCase = new Map();
  for (const unit of units) {
    const row = done.get(unit.unit_id);
    if (!row) continue;
    if (!byCase.has(unit.case_id)) byCase.set(unit.case_id, { assigned_arm: unit.assigned_arm, codes: [] });
    byCase.get(unit.case_id).codes.push(row);
  }
  const dialogues = [...byCase.entries()].map(([caseId, entry]) => {
    const summary = deliveredConduct(entry.codes.sort((a, b) => a.turn - b.turn));
    return {
      case_id: caseId,
      assigned_arm: entry.assigned_arm,
      ...summary,
      matches_assignment: summary.delivered === entry.assigned_arm,
      manner_breach_turns: entry.codes
        .filter((code) => !code.reader_error && code.manner_breach)
        .map((code) => code.turn),
      grant_of_standing_turns: entry.codes
        .filter((code) => !code.reader_error && code.grant_of_standing)
        .map((code) => code.turn),
    };
  });
  const fidelity = {};
  for (const arm of ['warrant_serving', 'warrant_withholding']) {
    const armRows = dialogues.filter((row) => row.assigned_arm === arm);
    fidelity[arm] = {
      dialogues: armRows.length,
      matching: armRows.filter((row) => row.matches_assignment).length,
      delivered: Object.fromEntries(
        ['warrant_serving', 'warrant_withholding', 'mixed'].map((kind) => [
          kind,
          armRows.filter((row) => row.delivered === kind).length,
        ]),
      ),
    };
  }
  const summary = {
    schema: 'machinespirits.tutor-stub.defiant-warrant-conduct-reader.v1',
    codebook: 'docs/adaptation-refinement/2026-08-29-defiant-warrant-conduct-codebook.md',
    reader: {
      provider: READER_PROVIDER,
      model: READER_MODEL,
      call_budget: READER_CALL_BUDGET,
      calls_spent: callsSpent,
    },
    turns_coded: [...done.values()].filter((row) => !row.reader_error).length,
    turns_reader_error: [...done.values()].filter((row) => row.reader_error).length,
    turns_planned: units.length,
    fidelity,
    dialogues,
  };
  fs.writeFileSync(path.join(absoluteDestination, 'conduct-reader.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ phase: 'conduct_reader_done', calls_spent: callsSpent, fidelity }));
  return summary;
}

function usage() {
  return `Usage:
  node scripts/run-defiant-warrant-conduct-reader.js --destination <run-folder> [--parallelism 4]`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { values } = parseArgs({
    options: {
      destination: { type: 'string' },
      parallelism: { type: 'string', default: '4' },
    },
  });
  if (!values.destination) {
    console.error(usage());
    process.exit(1);
  }
  runConductReader({ destination: values.destination, parallelism: Number(values.parallelism) }).catch((error) => {
    console.error(`Fatal: ${error.message}`);
    process.exit(1);
  });
}
