#!/usr/bin/env node
/**
 * analyze-strategy-shift.js — primary endpoint for the LangGraph adaptive cell (A13).
 *
 * Reads deliberation traces written by services/adaptiveTutor/persistence.js
 * and asks, per scenario:
 *
 *   1. Did the tutor's policy action at turn (trigger_turn + 1) match the
 *      scenario's expected_strategy_shift?  (strategy_shift_correctness)
 *   2. When a counterfactual exists, did the post-trigger policy action
 *      differ between original and counterfactual branches?
 *      (counterfactual_divergence)
 *   3. When the same policy action repeats across turns within a single run,
 *      did the tutor's actual message text change non-trivially?  (within-
 *      action refinement proxy — addresses §5 critique #1 of the synthesis.)
 *
 * Aggregates by profile_name (cell) and scenario_type. Emits JSON + a
 * printable table.
 *
 * Usage:
 *   node scripts/analyze-strategy-shift.js --run-id <runId>
 *   node scripts/analyze-strategy-shift.js --run-id <runId> --out exports/a13-strategy-shift.json
 *   node scripts/analyze-strategy-shift.js --run-id <runId> --profile cell_110_langgraph_adaptive
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.EVAL_DB_PATH || path.join(REPO_ROOT, 'data', 'evaluations.db');
const LOGS_DIR = path.join(process.env.EVAL_LOGS_DIR || path.join(REPO_ROOT, 'logs'), 'tutor-dialogues');

const args = process.argv.slice(2);
const getOption = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

const runId = getOption('run-id') || getOption('run');
const profileFilter = getOption('profile');
const outPath = getOption('out');

if (!runId) {
  console.error('Usage: node scripts/analyze-strategy-shift.js --run-id <runId> [--profile <name>] [--out <path>]');
  process.exit(2);
}

const db = new Database(DB_PATH, { readonly: true });

let query = "SELECT id, scenario_id, scenario_type, scenario_name, profile_name, dialogue_id FROM evaluation_results WHERE run_id = ?";
const params = [runId];
if (profileFilter) { query += ' AND profile_name = ?'; params.push(profileFilter); }
const rows = db.prepare(query).all(...params);
db.close();

if (rows.length === 0) {
  console.error(`No rows found for runId=${runId}${profileFilter ? `, profile=${profileFilter}` : ''}`);
  process.exit(1);
}

function loadTrace(dialogueId) {
  const p = path.join(LOGS_DIR, `${dialogueId}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function jaccard(a, b) {
  const ta = new Set(String(a).toLowerCase().match(/\b\w+\b/g) || []);
  const tb = new Set(String(b).toLowerCase().match(/\b\w+\b/g) || []);
  if (ta.size === 0 && tb.size === 0) return 1;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

// Within-action refinement proxy: when the tutor stays on the same policy
// action across consecutive turns, count it as "refined" if the Jaccard
// overlap of token sets between the two messages is below 0.6 — a cheap
// surrogate for "the question got sharper without the action label
// changing." Threshold is heuristic; over- or under-counts are fine for
// a comparative metric (relative across conditions, not absolute).
const REFINEMENT_JACCARD = 0.6;

function analyzeBranch(branch, expectedShift, triggerTurn) {
  if (!branch || !Array.isArray(branch.perTurn)) {
    return { policyTrace: [], shiftMatched: null, withinActionRefinements: 0, sameActionRepeats: 0 };
  }
  const turns = [...branch.perTurn].sort((a, b) => a.turn - b.turn);
  const policyTrace = turns.map((t) => t.tutorInternal?.policyAction || null);

  const tutorTexts = (branch.dialogue || []).filter((m) => m.role === 'tutor').map((m) => m.content);

  // shift evaluation: policy at turn (triggerTurn + 1)
  let shiftMatched = null;
  if (expectedShift && Number.isFinite(triggerTurn)) {
    const shiftTurn = triggerTurn + 1;
    const shiftPolicy = (turns.find((t) => t.turn === shiftTurn) || {}).tutorInternal?.policyAction || null;
    if (shiftPolicy != null) {
      shiftMatched = shiftPolicy === expectedShift;
    }
  }

  // within-action refinement proxy
  let sameActionRepeats = 0;
  let withinActionRefinements = 0;
  for (let i = 1; i < turns.length; i++) {
    const a = turns[i - 1].tutorInternal?.policyAction;
    const b = turns[i].tutorInternal?.policyAction;
    if (!a || !b || a !== b) continue;
    sameActionRepeats++;
    const txtA = tutorTexts[i - 1] || '';
    const txtB = tutorTexts[i] || '';
    if (jaccard(txtA, txtB) < REFINEMENT_JACCARD) withinActionRefinements++;
  }

  return { policyTrace, shiftMatched, withinActionRefinements, sameActionRepeats };
}

function computeDivergence(originalPolicy, counterfactualPolicy, triggerTurn) {
  if (!Array.isArray(originalPolicy) || !Array.isArray(counterfactualPolicy)) return null;
  const idx = (Number.isFinite(triggerTurn) ? triggerTurn : 0) + 1;
  const o = originalPolicy[idx];
  const c = counterfactualPolicy[idx];
  if (o == null || c == null) return null;
  return o !== c;
}

const perScenario = [];
for (const row of rows) {
  const trace = loadTrace(row.dialogue_id);
  if (!trace) {
    perScenario.push({ ...row, error: 'trace file missing' });
    continue;
  }
  const triggerTurn = trace.scenario?.hidden?.triggerTurn ?? trace.scenario?.hidden?.trigger_turn ?? -1;
  const expectedShift = trace.scenario?.expectedStrategyShift ?? null;

  const orig = analyzeBranch(trace.original, expectedShift, triggerTurn);
  const cf = trace.counterfactual ? analyzeBranch(trace.counterfactual, expectedShift, triggerTurn) : null;
  const counterfactualDivergence = cf
    ? computeDivergence(orig.policyTrace, cf.policyTrace, triggerTurn)
    : null;

  perScenario.push({
    scenarioId: row.scenario_id,
    scenarioType: row.scenario_type,
    profileName: row.profile_name,
    expectedShift,
    triggerTurn,
    original: orig,
    counterfactual: cf,
    counterfactualDivergence,
  });
}

// Aggregates
function aggregate(records, key) {
  const groups = new Map();
  for (const r of records) {
    const k = key(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const out = [];
  for (const [k, group] of groups) {
    const matched = group.filter((r) => r.original.shiftMatched === true).length;
    const evaluable = group.filter((r) => r.original.shiftMatched != null).length;
    const cfRecords = group.filter((r) => r.counterfactual != null);
    const cfDivergent = cfRecords.filter((r) => r.counterfactualDivergence === true).length;
    const refinements = group.reduce((s, r) => s + (r.original.withinActionRefinements || 0), 0);
    const sameActionRepeats = group.reduce((s, r) => s + (r.original.sameActionRepeats || 0), 0);
    out.push({
      key: k,
      n: group.length,
      strategy_shift_correctness: evaluable ? matched / evaluable : null,
      strategy_shift_correct_count: matched,
      strategy_shift_evaluable: evaluable,
      counterfactual_divergence: cfRecords.length ? cfDivergent / cfRecords.length : null,
      counterfactual_divergent_count: cfDivergent,
      counterfactual_total: cfRecords.length,
      within_action_refinement_rate: sameActionRepeats ? refinements / sameActionRepeats : null,
      within_action_refinements: refinements,
      same_action_repeats: sameActionRepeats,
    });
  }
  return out;
}

const byProfile = aggregate(perScenario.filter((r) => !r.error), (r) => r.profileName);
const byScenarioType = aggregate(perScenario.filter((r) => !r.error), (r) => r.scenarioType);

const report = {
  runId,
  profileFilter: profileFilter || null,
  totalScenarios: perScenario.length,
  errors: perScenario.filter((r) => r.error).length,
  byProfile,
  byScenarioType,
  perScenario,
};

const fmtPct = (x) => (x == null ? '   --' : `${(x * 100).toFixed(1).padStart(5)}%`);
const fmtFrac = (n, d) => (d ? `${n}/${d}` : '0/0');

console.log(`\nStrategy-shift report — runId=${runId}`);
console.log(`  scenarios: ${perScenario.length} (${perScenario.filter((r) => r.error).length} errored)`);

console.log('\nBy profile:');
console.log('  profile                                   n   shift%  shift_n   cf_div%  cf_div_n  refine%  refine_n');
for (const row of byProfile) {
  console.log(
    `  ${String(row.key).padEnd(40)} ${String(row.n).padStart(3)}  ${fmtPct(row.strategy_shift_correctness)}  ${fmtFrac(row.strategy_shift_correct_count, row.strategy_shift_evaluable).padStart(7)}  ${fmtPct(row.counterfactual_divergence)}  ${fmtFrac(row.counterfactual_divergent_count, row.counterfactual_total).padStart(7)}  ${fmtPct(row.within_action_refinement_rate)}  ${fmtFrac(row.within_action_refinements, row.same_action_repeats).padStart(7)}`,
  );
}

console.log('\nBy scenario type:');
console.log('  scenario_type                       n   shift%  shift_n   cf_div%  cf_div_n');
for (const row of byScenarioType) {
  console.log(
    `  ${String(row.key).padEnd(35)} ${String(row.n).padStart(3)}  ${fmtPct(row.strategy_shift_correctness)}  ${fmtFrac(row.strategy_shift_correct_count, row.strategy_shift_evaluable).padStart(7)}  ${fmtPct(row.counterfactual_divergence)}  ${fmtFrac(row.counterfactual_divergent_count, row.counterfactual_total).padStart(7)}`,
  );
}

if (outPath) {
  const abs = path.isAbsolute(outPath) ? outPath : path.join(REPO_ROOT, outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${abs}`);
}
