#!/usr/bin/env node
/**
 * Print, for one stored row, exactly what each agent was handed and what it
 * gave back — turn by turn.
 *
 * Written after a day spent proving by re-running that a register's manner
 * never reached the tutor. The evidence was already on disk: the shipped
 * system prompt, the router's choice, the tutor's reply, and the reviewer's
 * verdict all sit in `id_construction_trace`, and the learner's turns sit in
 * the dialogue log. Nothing printed them together, so the only way to see a
 * prompt was to write a throwaway script or a paid probe.
 *
 * Reads only. No model calls, no cost.
 *
 *   node scripts/dump-turn-prompts.js --row 34065
 *   node scripts/dump-turn-prompts.js --row 34065 --turn 0 --full
 *   node scripts/dump-turn-prompts.js --row 34065 --prompt-only
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { resolveTutorDialoguesDirCandidates } from '../services/evaluationDataPaths.js';
import { openEvaluationDbReadonly, describeMissingEvaluationDb } from '../services/evaluationDbReadonly.js';

const RULE = '─'.repeat(78);

function parseJson(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Find the dialogue log for a row. Returns null rather than throwing: the log
 * only carries the learner's turns, so a missing one costs a section, not the
 * dump. */
export function findDialogueLog(dialogueId, { rootDir = process.cwd(), fileSystem = fs } = {}) {
  if (!dialogueId) return null;
  for (const dir of resolveTutorDialoguesDirCandidates(rootDir)) {
    const file = path.join(dir, `${dialogueId}.json`);
    if (fileSystem.existsSync(file)) {
      return { file, log: parseJson(fileSystem.readFileSync(file, 'utf8'), null) };
    }
  }
  return null;
}

/**
 * The learner message the tutor answered on each turn, keyed by turn index.
 *
 * The learner deliberates in the open on every turn after the first, so the
 * transcript holds several learner lines per turn and only the last one was
 * sent. Turn 0 has no deliberation — the opening message comes from the
 * scenario — so the single line there is the one.
 */
export function learnerTurnsFromLog(log) {
  const events = log?.transcripts?.fullEvents;
  const byTurn = new Map();
  if (!Array.isArray(events)) return byTurn;
  for (const event of events) {
    if (event?.kind !== 'utterance') continue;
    const speaker = String(event.speaker || '');
    if (!speaker.startsWith('Learner')) continue;
    const turn = Number(event.turnIndex);
    if (!Number.isInteger(turn)) continue;
    const isFinal = speaker === 'Learner';
    const held = byTurn.get(turn);
    // A final output always wins; otherwise keep the first line of the turn.
    if (!held || (isFinal && !held.isFinal)) {
      byTurn.set(turn, { isFinal, text: String(event.content || '').replace(/^\(final output\)\s*/, '') });
    }
  }
  return new Map([...byTurn].map(([turn, held]) => [turn, held.text]));
}

function clip(text, limit, full) {
  const value = String(text ?? '').trim();
  if (full || !limit || value.length <= limit) return value || '(empty)';
  return `${value.slice(0, limit)}\n… [${value.length - limit} more chars — pass --full]`;
}

function block(label, text) {
  return `\n${label}\n${RULE}\n${text}\n`;
}

/** What the reviewer did to the turn, and what it cost us to know. */
export function describeReviewer(verification, repaired) {
  if (!verification) return { verdict: 'no reviewer ran on this turn', lines: [] };
  const reason = String(verification.reason || '').trim();
  if (verification.passes) {
    return { verdict: `passed — tutor's text kept as written`, lines: reason ? [`reason: ${reason}`] : [] };
  }
  const replacement = String(verification.repaired_response || '').trim();
  const appended = String(verification.agency_return_append || '').trim();
  const lines = reason ? [`reason: ${reason}`] : [];
  if (repaired && replacement) {
    lines.push(
      '',
      "The reply printed above is the reviewer's text, word for word.",
      "The tutor's own words were thrown away and are stored nowhere.",
    );
    return { verdict: 'failed — reviewer REPLACED the whole turn', lines };
  }
  if (repaired && appended) {
    lines.push('', "The reply printed above ends with the reviewer's sentence, not the tutor's:", appended);
    return { verdict: 'failed — reviewer appended to the turn', lines };
  }
  return { verdict: 'failed — but the text was left alone', lines };
}

export function dumpRow({
  rowId,
  turn = null,
  headChars = 1200,
  full = false,
  promptOnly = false,
  db,
  log = console.log,
}) {
  const row = db
    .prepare(
      `SELECT id, run_id, profile_name, scenario_id, dialogue_id, id_construction_trace
         FROM evaluation_results WHERE id = ?`,
    )
    .get(rowId);
  if (!row) throw new Error(`no evaluation_results row with id ${rowId}`);

  const trace = parseJson(row.id_construction_trace, []);
  if (!Array.isArray(trace) || trace.length === 0) {
    throw new Error(
      `row ${rowId} has no id_construction_trace — it was not written by the id-director, so there is no shipped prompt to show`,
    );
  }

  const found = findDialogueLog(row.dialogue_id);
  const learnerTurns = found ? learnerTurnsFromLog(found.log) : new Map();

  log(`row       ${row.id}`);
  log(`run       ${row.run_id}`);
  log(`cell      ${row.profile_name}`);
  log(`scenario  ${row.scenario_id}`);
  log(`dialogue  ${found ? found.file : `${row.dialogue_id} — log not found, learner turns unavailable`}`);
  log(`turns     ${trace.length}`);

  const wanted = turn === null ? trace : trace.filter((entry) => Number(entry.turn) === Number(turn));
  if (wanted.length === 0) throw new Error(`row ${rowId} has no turn ${turn}`);

  for (const entry of wanted) {
    const state = entry.engagementState || {};
    const construction = entry.construction || {};
    log(`\n\n${'═'.repeat(78)}\nTURN ${entry.turn}\n${'═'.repeat(78)}`);

    if (!promptOnly) {
      log(block('LEARNER SAID', clip(learnerTurns.get(Number(entry.turn)) ?? '(not in the log)', headChars, full)));
      const register = state.selected_register || state.selected_mode || '(unrouted)';
      const reason = String(state.register_reason || state.mode_reason || '').trim();
      log(block('ROUTER PICKED', `${register}${reason ? `\n\nwhy: ${reason}` : ''}`));
    }

    const shipped = String(construction.generated_prompt || '');
    const appended = construction.manner_block_appended === true;
    log(
      block(
        `TUTOR'S SYSTEM PROMPT — ${shipped.length} chars${appended ? ', manner block appended' : ''}`,
        clip(shipped, full ? 0 : Math.max(headChars, 2400), full),
      ),
    );
    if (promptOnly) continue;

    log(block('TUTOR REPLIED', clip(entry.tutorText, headChars, full)));

    const reviewer = describeReviewer(entry.agencyReturnVerification, entry.agencyReturnRepaired === true);
    log(block('REVIEWER', [reviewer.verdict, ...reviewer.lines].join('\n')));
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      row: { type: 'string' },
      turn: { type: 'string' },
      head: { type: 'string' },
      full: { type: 'boolean', default: false },
      'prompt-only': { type: 'boolean', default: false },
    },
  });
  if (!values.row) {
    console.error(
      'usage: node scripts/dump-turn-prompts.js --row <evaluation_results id> [--turn N] [--head CHARS] [--full] [--prompt-only]',
    );
    process.exit(2);
  }
  const opened = openEvaluationDbReadonly();
  if (!opened.db) {
    console.error(describeMissingEvaluationDb(opened));
    process.exit(1);
  }
  dumpRow({
    rowId: Number.parseInt(values.row, 10),
    turn: values.turn === undefined ? null : Number.parseInt(values.turn, 10),
    headChars: values.head ? Number.parseInt(values.head, 10) : 1200,
    full: values.full,
    promptOnly: values['prompt-only'],
    db: opened.db,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error?.message || String(error));
    process.exit(1);
  });
}
