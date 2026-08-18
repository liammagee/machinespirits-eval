#!/usr/bin/env node
/**
 * Registered re-analysis: relay 117's P3 re-based on the decision readers.
 *
 * Registration: docs/adaptation-refinement/relay/123-registration-evidence-move-rebase.md
 * (sealed 2026-08-16, ruling quoted verbatim: "1. Yes. 2. Count the turn").
 *
 * Moments, windows and the act list come from the frozen scorers, imported and
 * never edited: delivered challenges, shadow selections, the two-turn reply
 * window, and relay 116's registered evidence acts. Only the act source
 * changes: each decision reader tagged every case with one speech act; a
 * window turn is an evidence move when BOTH readers name an act on the
 * registered list (list membership, per the ruling). Zero model calls. Reads
 * stored artifacts, edits nothing.
 *
 * Usage:
 *   node scripts/score-evidence-move-rebase.js --run <run-dir> [--out <file>] [--json]
 *
 * Exit codes: 0 computed, 2 bad input. The inherited prediction (delivered
 * side higher) is directional and never gates; this script reports, the note
 * interprets.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  findDeliveredChallenges,
  findShadowSelections,
  EVIDENCE_ACTS,
  RESPONSE_WINDOW_TURNS,
} from './score-guarded-pilot-primary-endpoint.js';
import { readDialogueGateTrace, conditionOfDialogueId } from './score-guarded-pilot-gate.js';

export const EVIDENCE_MOVE_REBASE_SCHEMA = 'machinespirits.adaptation-refinement.evidence-move-rebase.v1';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Same loading as the frozen endpoint scorer: every dialogue's stored gate trace. */
export function loadDialogues(runDir) {
  const dialoguesDir = path.join(runDir, 'dialogues');
  const dialogues = [];
  for (const name of fs.readdirSync(dialoguesDir).sort()) {
    const dir = path.join(dialoguesDir, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const trace = readDialogueGateTrace(dir);
    if (trace) dialogues.push({ ...trace, condition: conditionOfDialogueId(name) });
  }
  return dialogues;
}

/** Both decision readers' one-act tags, keyed `dialogue#turn`. */
export function decisionActsByTurn(runDir) {
  const key = readJson(path.join(runDir, 'annotation-key.private.json'));
  const at = new Map(key.cases.map((row) => [row.sample_id, `${row.job_id}#${row.turn}`]));
  const tags = new Map();
  for (const readerId of ['decision-reader-a', 'decision-reader-b']) {
    for (const row of readJson(path.join(runDir, `${readerId}.assembled.json`)).cases || []) {
      const where = at.get(row.sample_id);
      if (!where) continue;
      const cell = tags.get(where) ?? {};
      cell[readerId] = row.speech_act;
      tags.set(where, cell);
    }
  }
  return tags;
}

function scoreWindow(row, tags) {
  const turns = [];
  for (const turn of row.response_turns) {
    const pair = tags.get(`${row.dialogue_id}#${turn}`);
    if (!pair || !pair['decision-reader-a'] || !pair['decision-reader-b']) {
      turns.push({ turn, missing_tags: true });
      continue;
    }
    const a = pair['decision-reader-a'];
    const b = pair['decision-reader-b'];
    const aListed = EVIDENCE_ACTS.includes(a);
    const bListed = EVIDENCE_ACTS.includes(b);
    turns.push({
      turn,
      reader_a: a,
      reader_b: b,
      both_listed: aListed && bListed,
      one_listed: aListed !== bListed,
      exact_act_match: a === b,
    });
  }
  return {
    ...row,
    window_turns: turns,
    evidence_move: turns.some((t) => t.both_listed),
    one_reader_only: !turns.some((t) => t.both_listed) && turns.some((t) => t.one_listed),
    turns_missing_tags: turns.filter((t) => t.missing_tags).length,
  };
}

function sideSummary(rows) {
  const scored = rows.filter((row) => row.response_turns.length > 0);
  const hits = scored.filter((row) => row.evidence_move);
  const byCondition = {};
  for (const row of scored) {
    const c = (byCondition[row.condition] ??= { windows: 0, evidence_moves: 0 });
    c.windows += 1;
    if (row.evidence_move) c.evidence_moves += 1;
  }
  return {
    moments: rows.length,
    excluded_no_reply_turn: rows.length - scored.length,
    windows: scored.length,
    partial_windows: scored.filter((row) => row.response_turns.length < RESPONSE_WINDOW_TURNS).length,
    evidence_moves: hits.length,
    rate: scored.length ? hits.length / scored.length : null,
    dialogues_with_a_hit: new Set(hits.map((row) => row.dialogue_id)).size,
    one_reader_only_windows: scored.filter((row) => row.one_reader_only).length,
    windows_touching_untagged_turns: scored.filter((row) => row.turns_missing_tags > 0).length,
    by_condition: byCondition,
    rows: scored,
  };
}

export function scoreRun(runDir) {
  const resolved = path.resolve(runDir);
  const dialogues = loadDialogues(resolved);
  const tags = decisionActsByTurn(resolved);

  const delivered = sideSummary(findDeliveredChallenges(dialogues).map((row) => scoreWindow(row, tags)));
  const shadow = sideSummary(findShadowSelections(dialogues).map((row) => scoreWindow(row, tags)));

  // The coarseness bound: over every scored window turn with both tags, how
  // often the readers disagreed on the act at all, and how often two listed
  // tags named the same act.
  const allTurns = [...delivered.rows, ...shadow.rows]
    .flatMap((row) => row.window_turns)
    .filter((t) => !t.missing_tags);
  const bothListed = allTurns.filter((t) => t.both_listed);
  const disagreement = {
    window_turns_with_both_tags: allTurns.length,
    any_act_disagreement: allTurns.filter((t) => !t.exact_act_match).length,
    both_listed_turns: bothListed.length,
    both_listed_exact_match: bothListed.filter((t) => t.exact_act_match).length,
  };

  const stripRows = (summary) => Object.fromEntries(Object.entries(summary).filter(([key]) => key !== 'rows'));
  return {
    schema: EVIDENCE_MOVE_REBASE_SCHEMA,
    registration: 'relay 123, sealed 2026-08-16',
    inferential_role:
      'registered post-hoc re-analysis of relay 117 P3; labeled as such wherever it is cited; never stands as the pre-registered P3',
    zero_model_calls: true,
    run_dir: resolved,
    evidence_acts: [...EVIDENCE_ACTS],
    consensus_rule: 'both readers name an act on the registered list (ruling: count the turn)',
    delivered: stripRows(delivered),
    shadow: stripRows(shadow),
    disagreement_bound: disagreement,
    prediction: {
      inherited: 'relay 117 P3: delivered evidence-move rate exceeds shadow rate',
      delivered_exceeds_shadow: delivered.rate !== null && shadow.rate !== null && delivered.rate > shadow.rate,
    },
    window_detail: {
      delivered: delivered.rows,
      shadow: shadow.rows,
    },
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      run: { type: 'string' },
      out: { type: 'string' },
      json: { type: 'boolean', default: false },
    },
  });
  if (!values.run || !fs.existsSync(values.run)) {
    console.error('usage: score-evidence-move-rebase.js --run <run-dir> [--out <file>] [--json]');
    process.exit(2);
  }
  const report = scoreRun(values.run);
  const text = JSON.stringify(report, null, 2);
  if (values.out) fs.writeFileSync(values.out, `${text}\n`);
  if (values.json || !values.out) console.log(text);
  if (!values.json) {
    for (const side of ['delivered', 'shadow']) {
      const s = report[side];
      console.error(
        `${side}: ${s.evidence_moves} / ${s.windows} windows (${((s.rate ?? 0) * 100).toFixed(1)}%), ` +
          `${s.excluded_no_reply_turn} moments left the denominator, ` +
          `${s.one_reader_only_windows} one-reader-only`,
      );
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main();
}
