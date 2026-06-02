#!/usr/bin/env node
/**
 * analyze-strategy-shift.js — primary endpoint for the LangGraph adaptive cell (A13).
 *
 * Reads deliberation traces written by services/adaptiveTutor/persistence.js
 * and asks, per scenario:
 *
 *   1. Did the tutor's policy action at turn (trigger_turn + 1) match the
 *      scenario's expected_strategy_shift?  (strategy_shift_correctness —
 *      pre-registered binary metric)
 *   2. When a counterfactual exists, did the post-trigger policy action
 *      differ between original and counterfactual branches?
 *      (counterfactual_divergence)
 *   3. When the same policy action repeats across turns within a single run,
 *      did the tutor's actual message text change non-trivially?  (within-
 *      action refinement proxy — addresses §5 critique #1 of the synthesis.)
 *
 * Exploratory granular metrics (added post-hoc; hypothesis-generating, not
 * confirmatory):
 *
 *   4. shift_window: did the expected pivot occur at turn (trigger+1),
 *      (trigger+2), or (trigger+3)?  Resolves "late but right" failures
 *      that the strict trigger+1 binary collapses with "never".
 *   5. family_match: at turn (trigger+1), did the actual policy fall in the
 *      same pedagogical family as the expected pivot?  Resolves "wrong label,
 *      right intent" failures.  Families derived from policyActions.js
 *      trigger_conditions/contraindications (see POLICY_FAMILIES below).
 *
 * Aggregates by profile_name (cell) and scenario_type. Emits JSON + a
 * printable table.
 *
 * Usage:
 *   node scripts/analyze-strategy-shift.js --run-id <runId>
 *   node scripts/analyze-strategy-shift.js --run-id <runId>,<runId2>,...   # combine multiple runs
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

const runIdArg = getOption('run-id') || getOption('run');
const profileFilter = getOption('profile');
const outPath = getOption('out');

if (!runIdArg) {
  console.error(
    'Usage: node scripts/analyze-strategy-shift.js --run-id <runId>[,<runId2>,...] [--profile <name>] [--out <path>]',
  );
  process.exit(2);
}

const runIds = runIdArg
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const runId = runIds.length === 1 ? runIds[0] : runIds.join(',');

const db = new Database(DB_PATH, { readonly: true });

const placeholders = runIds.map(() => '?').join(',');
let query = `SELECT id, run_id, scenario_id, scenario_type, scenario_name, profile_name, dialogue_id FROM evaluation_results WHERE run_id IN (${placeholders})`;
const params = [...runIds];
if (profileFilter) {
  query += ' AND profile_name = ?';
  params.push(profileFilter);
}
const rows = db.prepare(query).all(...params);
db.close();

if (rows.length === 0) {
  console.error(`No rows found for runId(s)=${runIds.join(',')}${profileFilter ? `, profile=${profileFilter}` : ''}`);
  process.exit(1);
}

function loadTrace(dialogueId) {
  const p = path.join(LOGS_DIR, `${dialogueId}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function jaccard(a, b) {
  const ta = new Set(
    String(a)
      .toLowerCase()
      .match(/\b\w+\b/g) || [],
  );
  const tb = new Set(
    String(b)
      .toLowerCase()
      .match(/\b\w+\b/g) || [],
  );
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

// Pedagogical families for the 14 policy actions. Grouping derives from
// the trigger_conditions / contraindications in
// config/adaptive-policy-actions.yaml: actions that fire on similar learner
// signals and are contraindicated by similar conditions sit in the same
// family. Used by the exploratory family_match metric — softer than label
// match (right family, possibly wrong action), harder than wildcard.
//
// The accepted-set logic for resistance_to_insight ({scope_test,
// name_the_disagreement, pose_counterexample}) is implicitly a family
// match within "substantive engagement" — this metric generalises that
// principle to all scenarios.
const POLICY_FAMILIES = Object.freeze({
  substantive_engagement: [
    'mirror_and_extend',
    'scope_test',
    'name_the_disagreement',
    'pose_counterexample',
    'invite_objection',
  ],
  diagnostic: ['ask_diagnostic_question', 'request_elaboration', 'summarize_and_check'],
  scaffolding: ['give_worked_example', 'lower_cognitive_load', 'provide_hint', 'withhold_answer'],
  repair_affective: ['repair_misrecognition', 'acknowledge_and_redirect'],
});

const POLICY_TO_FAMILY = (() => {
  const m = new Map();
  for (const [family, actions] of Object.entries(POLICY_FAMILIES)) {
    for (const a of actions) m.set(a, family);
  }
  return m;
})();

const familyOf = (action) => POLICY_TO_FAMILY.get(action) || null;

// expectedFamily collapses an expected_strategy_shift (string or array of
// pedagogically-equivalent labels) into a single family. Returns null when
// the accepted set spans multiple families — in practice none of the
// scenarios in adaptive-trap-scenarios.yaml do, but we handle it defensively.
function expectedFamilyOf(expectedShift) {
  if (expectedShift == null) return null;
  const accepted = Array.isArray(expectedShift) ? expectedShift : [expectedShift];
  const families = new Set(accepted.map(familyOf).filter(Boolean));
  if (families.size === 1) return [...families][0];
  return null;
}

const FAMILY_NAMES = Object.freeze(['substantive_engagement', 'diagnostic', 'scaffolding', 'repair_affective']);

// Look-ahead window for shift_window metric. Trigger+1 is the canonical
// pivot turn; +2 and +3 catch "late but right" pivots. Bounded by
// scenario.max_turns at runtime — scenarios with max_turns=3 only have
// trigger+1 and trigger+2 available.
const SHIFT_WINDOW_OFFSETS = [1, 2, 3];

function analyzeBranch(branch, expectedShift, triggerTurn) {
  if (!branch || !Array.isArray(branch.perTurn)) {
    return {
      policyTrace: [],
      shiftMatched: null,
      shiftWindowMatched: null,
      shiftWindowOffset: null,
      familyMatched: null,
      actualShiftAction: null,
      actualShiftFamily: null,
      withinActionRefinements: 0,
      sameActionRepeats: 0,
    };
  }
  const turns = [...branch.perTurn].sort((a, b) => a.turn - b.turn);
  const policyTrace = turns.map((t) => t.tutorInternal?.policyAction || null);

  const tutorTexts = (branch.dialogue || []).filter((m) => m.role === 'tutor').map((m) => m.content);

  // expected_strategy_shift may be a single action label OR an array of
  // pedagogically-equivalent labels (e.g. resistance_to_insight accepts any
  // of {scope_test, name_the_disagreement, pose_counterexample}).
  let shiftMatched = null;
  let shiftWindowMatched = null;
  let shiftWindowOffset = null;
  let familyMatched = null;
  let actualShiftAction = null;
  let actualShiftFamily = null;

  if (expectedShift && Number.isFinite(triggerTurn)) {
    const accepted = Array.isArray(expectedShift) ? expectedShift : [expectedShift];
    const acceptedFamilies = new Set(accepted.map(familyOf).filter(Boolean));

    // (1) strict trigger+1 match (pre-registered binary metric)
    // (2) family match at trigger+1 (exploratory): right family, possibly wrong action
    const shiftPolicy = (turns.find((t) => t.turn === triggerTurn + 1) || {}).tutorInternal?.policyAction || null;
    actualShiftAction = shiftPolicy;
    actualShiftFamily = familyOf(shiftPolicy);
    if (shiftPolicy != null) {
      shiftMatched = accepted.includes(shiftPolicy);
      if (acceptedFamilies.size > 0) {
        familyMatched = acceptedFamilies.has(actualShiftFamily);
      }
    }

    // (3) shift-window (exploratory): expected pivot at trigger+1, +2, or +3.
    // null if no turns in the window have a policy action; false if some
    // do but none match; true if any match (offset records the earliest).
    for (const offset of SHIFT_WINDOW_OFFSETS) {
      const turn = turns.find((t) => t.turn === triggerTurn + offset);
      if (!turn) continue;
      const action = turn.tutorInternal?.policyAction || null;
      if (action == null) continue;
      if (shiftWindowMatched == null) shiftWindowMatched = false;
      if (accepted.includes(action)) {
        shiftWindowMatched = true;
        shiftWindowOffset = offset;
        break;
      }
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

  return {
    policyTrace,
    shiftMatched,
    shiftWindowMatched,
    shiftWindowOffset,
    familyMatched,
    actualShiftAction,
    actualShiftFamily,
    withinActionRefinements,
    sameActionRepeats,
  };
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
  const counterfactualDivergence = cf ? computeDivergence(orig.policyTrace, cf.policyTrace, triggerTurn) : null;

  // Family-level counterfactual divergence: under perturbation, does the
  // family of the selected action change? When this is much lower than
  // label-level cf_div, the architecture has a strong type-prior the
  // state can't override (different label, same family). When the two
  // are similar, family selection is genuinely state-driven.
  let counterfactualFamilyDivergence = null;
  if (cf && orig.actualShiftFamily != null && cf.actualShiftFamily != null) {
    counterfactualFamilyDivergence = orig.actualShiftFamily !== cf.actualShiftFamily;
  }

  const expectedFamily = expectedFamilyOf(expectedShift);

  perScenario.push({
    scenarioId: row.scenario_id,
    scenarioType: row.scenario_type,
    profileName: row.profile_name,
    expectedShift,
    expectedFamily,
    triggerTurn,
    original: orig,
    counterfactual: cf,
    counterfactualDivergence,
    counterfactualFamilyDivergence,
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

    // Exploratory metrics
    const windowMatched = group.filter((r) => r.original.shiftWindowMatched === true).length;
    const windowEvaluable = group.filter((r) => r.original.shiftWindowMatched != null).length;
    const familyMatched = group.filter((r) => r.original.familyMatched === true).length;
    const familyEvaluable = group.filter((r) => r.original.familyMatched != null).length;
    // Offset distribution of when the pivot actually landed
    const windowOffsets = { 1: 0, 2: 0, 3: 0 };
    for (const r of group) {
      const off = r.original.shiftWindowOffset;
      if (off === 1 || off === 2 || off === 3) windowOffsets[off] += 1;
    }
    // Family-of-actual-action distribution (when shift didn't match the
    // accepted set, what did the tutor actually do?). Helps diagnose
    // *which* family the wrong picks fall into.
    const actualFamilyDist = {};
    for (const r of group) {
      const fam = r.original.actualShiftFamily;
      if (fam == null) continue;
      actualFamilyDist[fam] = (actualFamilyDist[fam] || 0) + 1;
    }

    // Confusion matrix: rows = expected family, cols = actual family.
    // confusionMatrix[expected][actual] = count. Diagonal entries are
    // family-correct picks; off-diagonal entries reveal systematic
    // misdirection (e.g. "expected diagnostic, got substantive_engagement").
    const confusionMatrix = {};
    for (const ef of FAMILY_NAMES) {
      confusionMatrix[ef] = {};
      for (const af of FAMILY_NAMES) confusionMatrix[ef][af] = 0;
    }
    for (const r of group) {
      const ef = r.expectedFamily;
      const af = r.original.actualShiftFamily;
      if (ef == null || af == null) continue;
      if (!confusionMatrix[ef]) continue; // ef outside FAMILY_NAMES (defensive)
      confusionMatrix[ef][af] = (confusionMatrix[ef][af] || 0) + 1;
    }

    // Counterfactual family-level divergence
    const cfFamilyRecords = group.filter((r) => r.counterfactualFamilyDivergence != null);
    const cfFamilyDivergent = cfFamilyRecords.filter((r) => r.counterfactualFamilyDivergence === true).length;

    out.push({
      key: k,
      n: group.length,
      strategy_shift_correctness: evaluable ? matched / evaluable : null,
      strategy_shift_correct_count: matched,
      strategy_shift_evaluable: evaluable,
      shift_window_correctness: windowEvaluable ? windowMatched / windowEvaluable : null,
      shift_window_correct_count: windowMatched,
      shift_window_evaluable: windowEvaluable,
      shift_window_offset_distribution: windowOffsets,
      family_match_rate: familyEvaluable ? familyMatched / familyEvaluable : null,
      family_match_count: familyMatched,
      family_match_evaluable: familyEvaluable,
      actual_family_distribution: actualFamilyDist,
      counterfactual_divergence: cfRecords.length ? cfDivergent / cfRecords.length : null,
      counterfactual_divergent_count: cfDivergent,
      counterfactual_total: cfRecords.length,
      counterfactual_family_divergence: cfFamilyRecords.length ? cfFamilyDivergent / cfFamilyRecords.length : null,
      counterfactual_family_divergent_count: cfFamilyDivergent,
      counterfactual_family_total: cfFamilyRecords.length,
      confusion_matrix: confusionMatrix,
      within_action_refinement_rate: sameActionRepeats ? refinements / sameActionRepeats : null,
      within_action_refinements: refinements,
      same_action_repeats: sameActionRepeats,
    });
  }
  return out;
}

const byProfile = aggregate(
  perScenario.filter((r) => !r.error),
  (r) => r.profileName,
);
const byScenarioType = aggregate(
  perScenario.filter((r) => !r.error),
  (r) => r.scenarioType,
);

const report = {
  runId,
  runIds,
  profileFilter: profileFilter || null,
  totalScenarios: perScenario.length,
  errors: perScenario.filter((r) => r.error).length,
  byProfile,
  byScenarioType,
  perScenario,
};

const fmtPct = (x) => (x == null ? '   --' : `${(x * 100).toFixed(1).padStart(5)}%`);
const fmtFrac = (n, d) => (d ? `${n}/${d}` : '0/0');

console.log(`\nStrategy-shift report — runId(s)=${runIds.join(',')}`);
console.log(`  scenarios: ${perScenario.length} (${perScenario.filter((r) => r.error).length} errored)`);

console.log('\nBy profile:');
console.log(
  '  profile                                   n   shift%  shift_n  window%  window_n  family%  family_n   cf_div%  cf_div_n  cf_fam%  cf_fam_n  refine%  refine_n',
);
for (const row of byProfile) {
  console.log(
    `  ${String(row.key).padEnd(40)} ${String(row.n).padStart(3)}  ${fmtPct(row.strategy_shift_correctness)}  ${fmtFrac(row.strategy_shift_correct_count, row.strategy_shift_evaluable).padStart(7)}  ${fmtPct(row.shift_window_correctness)}  ${fmtFrac(row.shift_window_correct_count, row.shift_window_evaluable).padStart(8)}  ${fmtPct(row.family_match_rate)}  ${fmtFrac(row.family_match_count, row.family_match_evaluable).padStart(8)}  ${fmtPct(row.counterfactual_divergence)}  ${fmtFrac(row.counterfactual_divergent_count, row.counterfactual_total).padStart(7)}  ${fmtPct(row.counterfactual_family_divergence)}  ${fmtFrac(row.counterfactual_family_divergent_count, row.counterfactual_family_total).padStart(7)}  ${fmtPct(row.within_action_refinement_rate)}  ${fmtFrac(row.within_action_refinements, row.same_action_repeats).padStart(7)}`,
  );
}

// Per-cell family confusion matrix. Diagonal entries show right-family
// pick rate; off-diagonal entries reveal systematic misdirection.
const FAMILY_ABBR = {
  substantive_engagement: 'subst',
  diagnostic: 'diag',
  scaffolding: 'scaf',
  repair_affective: 'rep',
};
console.log('\nFamily confusion matrix per profile (rows = expected family, cols = actual at trigger+1):');
for (const row of byProfile) {
  const cm = row.confusion_matrix || {};
  console.log(`  ${row.key}`);
  console.log(
    `    expected\\actual         ${FAMILY_NAMES.map((f) => FAMILY_ABBR[f].padStart(5)).join('  ')}    diag_rate`,
  );
  for (const ef of FAMILY_NAMES) {
    const cells = FAMILY_NAMES.map((af) => String((cm[ef] && cm[ef][af]) || 0).padStart(5));
    const rowTotal = FAMILY_NAMES.reduce((s, af) => s + ((cm[ef] && cm[ef][af]) || 0), 0);
    const diag = (cm[ef] && cm[ef][ef]) || 0;
    const diagRate = rowTotal ? `${diag}/${rowTotal} (${((100 * diag) / rowTotal).toFixed(0)}%)` : '   --';
    console.log(`    ${ef.padEnd(24)}${cells.join('  ')}    ${diagRate}`);
  }
}

// Exploratory diagnostic: where pivots actually landed and which family
// the trigger+1 action fell in. Useful for separating "wrong label"
// from "wrong family" failures, and "late pivot" from "no pivot".
console.log('\nBy profile (pivot landing diagnostics):');
console.log(
  '  profile                                   trigger+1  trigger+2  trigger+3   actual_family_distribution_at_trigger+1',
);
for (const row of byProfile) {
  const off = row.shift_window_offset_distribution || { 1: 0, 2: 0, 3: 0 };
  const famParts = Object.entries(row.actual_family_distribution || {})
    .sort((a, b) => b[1] - a[1])
    .map(([f, c]) => `${f}=${c}`)
    .join(' ');
  console.log(
    `  ${String(row.key).padEnd(40)} ${String(off[1]).padStart(9)}  ${String(off[2]).padStart(9)}  ${String(off[3]).padStart(9)}   ${famParts}`,
  );
}

console.log('\nBy scenario type:');
console.log(
  '  scenario_type                       n   shift%  shift_n  window%  window_n  family%  family_n   cf_div%  cf_div_n',
);
for (const row of byScenarioType) {
  console.log(
    `  ${String(row.key).padEnd(35)} ${String(row.n).padStart(3)}  ${fmtPct(row.strategy_shift_correctness)}  ${fmtFrac(row.strategy_shift_correct_count, row.strategy_shift_evaluable).padStart(7)}  ${fmtPct(row.shift_window_correctness)}  ${fmtFrac(row.shift_window_correct_count, row.shift_window_evaluable).padStart(8)}  ${fmtPct(row.family_match_rate)}  ${fmtFrac(row.family_match_count, row.family_match_evaluable).padStart(8)}  ${fmtPct(row.counterfactual_divergence)}  ${fmtFrac(row.counterfactual_divergent_count, row.counterfactual_total).padStart(7)}`,
  );
}

if (outPath) {
  const abs = path.isAbsolute(outPath) ? outPath : path.join(REPO_ROOT, outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${abs}`);
}
