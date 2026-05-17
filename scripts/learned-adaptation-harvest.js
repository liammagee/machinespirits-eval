#!/usr/bin/env node
/**
 * learned-adaptation-harvest.js — Step 1 of the Learned-Adaptation arc.
 *
 * Builds the offline (state, action, independent-outcome) table from trace
 * files already on main. ZERO new runs, ZERO API calls, READ-ONLY DB.
 *
 * Provenance (see LEARNED-ADAPTATION-PLAN.md §2 Step 1):
 *   - state + action  : logs/tutor-dialogues/<dialogue_id>.json (schemaVersion>=3)
 *                        per-turn {learnerProfile, hypotheses[], evidenceLog[],
 *                        tutorInternal.policyAction}.
 *   - binary label    : strict_shift, recomputed with the VERBATIM analyzeBranch
 *                        predicate from scripts/analyze-strategy-shift.js, then
 *                        ASSERTED equal to the canonical
 *                        exports/a14-stage5-strategy-shift-finalN.json byProfile
 *                        rates for cell_126/127/128. Drift => hard abort.
 *   - graded label    : evaluation_results.adaptive_{trigger_recognition,
 *                        strategy_execution,strategy_quality,
 *                        pedagogical_coherence} (the §6.8/§6.9 graded channel).
 *
 * Unit of the emitted table: one row per trajectory at the pivot decision
 * (turn triggerTurn+1) — the contextual-bandit framing the strict_shift
 * definition implies. Context features are the state snapshot at turn
 * triggerTurn (what the controller knew going into the pivot).
 *
 * Usage:
 *   node scripts/learned-adaptation-harvest.js
 *   node scripts/learned-adaptation-harvest.js --out exports/learned-adaptation-table.csv
 *   EVAL_DB_PATH=/tmp/x.db EVAL_LOGS_DIR=/tmp/logs node scripts/learned-adaptation-harvest.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.EVAL_DB_PATH || path.join(REPO_ROOT, 'data', 'evaluations.db');
const LOGS_DIR = path.join(process.env.EVAL_LOGS_DIR || path.join(REPO_ROOT, 'logs'), 'tutor-dialogues');
const CANONICAL_BINARY = path.join(REPO_ROOT, 'exports', 'a14-stage5-strategy-shift-finalN.json');

const args = process.argv.slice(2);
const getOption = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const outPath = getOption('out') || path.join(REPO_ROOT, 'exports', 'learned-adaptation-table.csv');
const metaPath = outPath.replace(/\.csv$/, '') + '.meta.json';

// Cells: cell_110 = implicit baseline the policy must beat; cell_126 =
// A14 hand-authored baseline it must beat; 127/128 = A14 audit-chain;
// 118/124 = extra in-distribution data. Graded-non-null filter selects the
// real eval set and drops ungraded mock/smoke rows automatically.
const CELL_PREFIXES = ['cell_110', 'cell_118', 'cell_124', 'cell_126', 'cell_127', 'cell_128'];

// ---------------------------------------------------------------------------
// VERBATIM from scripts/analyze-strategy-shift.js (lines 116-239). Copied, not
// imported, because that file is a side-effecting CLI. The fidelity assertion
// below makes any divergence from the canonical artifact a hard failure.
// ---------------------------------------------------------------------------
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
    };
  }
  const turns = [...branch.perTurn].sort((a, b) => a.turn - b.turn);
  const policyTrace = turns.map((t) => t.tutorInternal?.policyAction || null);
  let shiftMatched = null,
    shiftWindowMatched = null,
    shiftWindowOffset = null,
    familyMatched = null,
    actualShiftAction = null,
    actualShiftFamily = null;
  if (expectedShift && Number.isFinite(triggerTurn)) {
    const accepted = Array.isArray(expectedShift) ? expectedShift : [expectedShift];
    const acceptedFamilies = new Set(accepted.map(familyOf).filter(Boolean));
    const shiftPolicy = (turns.find((t) => t.turn === triggerTurn + 1) || {}).tutorInternal?.policyAction || null;
    actualShiftAction = shiftPolicy;
    actualShiftFamily = familyOf(shiftPolicy);
    if (shiftPolicy != null) {
      shiftMatched = accepted.includes(shiftPolicy);
      if (acceptedFamilies.size > 0) familyMatched = acceptedFamilies.has(actualShiftFamily);
    }
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
  return {
    policyTrace,
    shiftMatched,
    shiftWindowMatched,
    shiftWindowOffset,
    familyMatched,
    actualShiftAction,
    actualShiftFamily,
  };
}
// ---------------------------------------------------------------------------

function loadTrace(dialogueId) {
  const p = path.join(LOGS_DIR, `${dialogueId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

const cellOf = (profileName) => {
  const m = String(profileName).match(/^(cell_\d+)/);
  return m ? m[1] : profileName;
};

// State features as of `asOfTurn` (the pre-pivot context). learnerProfile is
// replaced per turn with an updatedAtTurn guard and the terminal turn often
// carries an empty profile, so forward-fill from the most recent non-empty
// profile at or before asOfTurn. hypotheses/evidenceLog are cumulative
// monotone channels — the snap at asOfTurn already holds the full set.
function stateFeatures(perTurn, asOfTurn) {
  const turns = [...perTurn].sort((a, b) => a.turn - b.turn);
  let lp = null;
  let snap = null;
  for (const t of turns) {
    if (t.turn > asOfTurn) break;
    snap = t;
    const p = t.learnerProfile;
    if (p && Object.keys(p).length > 0 && (p.confidence != null || p.agencySignal != null)) lp = p;
  }
  const hyps = snap && Array.isArray(snap.hypotheses) ? snap.hypotheses : [];
  const ev = snap && Array.isArray(snap.evidenceLog) ? snap.evidenceLog : [];
  const conf = hyps.map((h) => (typeof h.confidence === 'number' ? h.confidence : null)).filter((x) => x != null);
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const statusCount = (s) => hyps.filter((h) => h.status === s).length;
  const contradicted = hyps.filter(
    (h) =>
      h.status === 'contradicted' || (Array.isArray(h.contradicting_evidence) && h.contradicting_evidence.length > 0),
  ).length;
  const lastObsTurn = ev.length ? Math.max(...ev.map((o) => (Number.isFinite(o.turn) ? o.turn : -1))) : null;
  return {
    confidence: lp && typeof lp.confidence === 'number' ? lp.confidence : null,
    agency_signal: lp && lp.agencySignal != null ? String(lp.agencySignal) : null,
    n_misconceptions: lp && Array.isArray(lp.misconceptions) ? lp.misconceptions.length : 0,
    zpd_estimate_len: lp && typeof lp.zpdEstimate === 'string' ? lp.zpdEstimate.length : 0,
    n_hypotheses: hyps.length,
    n_hyp_validated: statusCount('validated'),
    n_hyp_tentative: statusCount('tentative'),
    n_hyp_contradicted: contradicted,
    mean_hyp_confidence: mean(conf),
    n_evidence: ev.length,
    n_evidence_validated: ev.filter((o) => o.validated === true).length,
    evidence_recency: lastObsTurn == null ? null : asOfTurn - lastObsTurn,
    n_constraint_violations: snap && Array.isArray(snap.constraintViolations) ? snap.constraintViolations.length : 0,
  };
}

// --- pull rows + graded labels (read-only) ---------------------------------
const db = new Database(DB_PATH, { readonly: true });
const likeClause = CELL_PREFIXES.map(() => 'profile_name LIKE ?').join(' OR ');
const rows = db
  .prepare(
    `SELECT id, run_id, scenario_id, scenario_type, profile_name, dialogue_id,
          adaptive_trigger_recognition AS g_trig,
          adaptive_strategy_execution  AS g_exec,
          adaptive_strategy_quality    AS g_qual,
          adaptive_pedagogical_coherence AS g_coh,
          adaptive_grader_judge_model  AS grader
     FROM evaluation_results
    WHERE (${likeClause}) AND adaptive_strategy_quality IS NOT NULL
    ORDER BY profile_name, created_at`,
  )
  .all(...CELL_PREFIXES.map((p) => `${p}%`));
db.close();

const records = [];
const skipped = { no_trace: 0, no_perturn: 0 };
for (const r of rows) {
  const trace = loadTrace(r.dialogue_id);
  if (!trace) {
    skipped.no_trace++;
    continue;
  }
  const branch = trace.original;
  if (!branch || !Array.isArray(branch.perTurn) || branch.perTurn.length === 0) {
    skipped.no_perturn++;
    continue;
  }
  const triggerTurn = trace.scenario?.hidden?.triggerTurn ?? trace.scenario?.hidden?.trigger_turn ?? -1;
  const expectedShift = trace.scenario?.expectedStrategyShift ?? null;
  const a = analyzeBranch(branch, expectedShift, triggerTurn);
  const ctx = stateFeatures(branch.perTurn, triggerTurn); // state the controller had going into the pivot
  const gradedDims = [r.g_trig, r.g_exec, r.g_qual, r.g_coh].map(Number);
  records.push({
    dialogue_id: r.dialogue_id,
    run_id: r.run_id,
    cell: cellOf(r.profile_name),
    profile_name: r.profile_name,
    scenario_id: r.scenario_id,
    scenario_type: r.scenario_type || trace.scenario?.scenarioType || null,
    trigger_turn: triggerTurn,
    n_turns: branch.perTurn.length,
    expected_shift: Array.isArray(expectedShift) ? expectedShift.join('|') : expectedShift || null,
    expected_family: (() => {
      const fs2 = new Set(
        (Array.isArray(expectedShift) ? expectedShift : [expectedShift]).map(familyOf).filter(Boolean),
      );
      return fs2.size === 1 ? [...fs2][0] : null;
    })(),
    ...ctx,
    action: a.actualShiftAction, // policy action at trigger+1 (the decision)
    action_family: a.actualShiftFamily,
    strict_shift: a.shiftMatched == null ? null : a.shiftMatched ? 1 : 0,
    shift_window: a.shiftWindowMatched == null ? null : a.shiftWindowMatched ? 1 : 0,
    family_matched: a.familyMatched == null ? null : a.familyMatched ? 1 : 0,
    graded_trigger_recognition: r.g_trig,
    graded_strategy_execution: r.g_exec,
    graded_strategy_quality: r.g_qual,
    graded_pedagogical_coherence: r.g_coh,
    graded_mean: gradedDims.some((x) => !Number.isFinite(x)) ? null : gradedDims.reduce((s, x) => s + x, 0) / 4,
    grader_judge_model: r.grader,
  });
}

// --- FIDELITY ASSERTION: recomputed strict_shift == canonical artifact ------
function canonicalRates() {
  if (!fs.existsSync(CANONICAL_BINARY)) return null;
  const j = JSON.parse(fs.readFileSync(CANONICAL_BINARY, 'utf-8'));
  const bp = j.byProfile;
  const out = {};
  const list = Array.isArray(bp) ? bp : Object.values(bp || {});
  for (const e of list) {
    const name = e.key || e.profileName || e.profile_name || e.profile;
    const rate = e.strategy_shift_correctness ?? e.strict_match_rate ?? e.match_rate ?? e.shift_match_rate;
    if (name && rate != null) out[cellOf(name)] = Number(rate);
  }
  return out;
}
const canon = canonicalRates();
const recomputed = {};
for (const cell of ['cell_126', 'cell_127', 'cell_128']) {
  const grp = records.filter((x) => x.cell === cell && x.strict_shift != null);
  if (grp.length) recomputed[cell] = grp.filter((x) => x.strict_shift === 1).length / grp.length;
}
const fidelity = { canonical: canon, recomputed, ok: true, checked: [], note: '' };
if (!canon) {
  fidelity.ok = false;
  fidelity.note = `canonical artifact missing at ${CANONICAL_BINARY} — cannot prove label fidelity; refusing to emit.`;
} else {
  for (const cell of Object.keys(recomputed)) {
    if (canon[cell] == null) continue;
    const delta = Math.abs(canon[cell] - recomputed[cell]);
    fidelity.checked.push({ cell, canonical: canon[cell], recomputed: recomputed[cell], delta });
    if (delta > 1e-6) fidelity.ok = false;
  }
  if (fidelity.checked.length === 0) {
    fidelity.ok = false;
    fidelity.note =
      'no overlapping cells between recomputed and canonical byProfile — fidelity unproven; refusing to emit.';
  } else if (!fidelity.ok) {
    fidelity.note = 'recomputed strict_shift diverges from canonical §6.9.7 artifact — label drift; refusing to emit.';
  } else {
    fidelity.note = 'recomputed strict_shift matches canonical §6.9.7 artifact exactly (delta < 1e-6).';
  }
}

if (!fidelity.ok) {
  console.error('[harvest] FIDELITY CHECK FAILED:', fidelity.note);
  console.error(JSON.stringify(fidelity, null, 2));
  process.exit(3);
}

// --- emit CSV + metadata sidecar -------------------------------------------
const COLS = [
  'dialogue_id',
  'run_id',
  'cell',
  'profile_name',
  'scenario_id',
  'scenario_type',
  'trigger_turn',
  'n_turns',
  'expected_shift',
  'expected_family',
  'confidence',
  'agency_signal',
  'n_misconceptions',
  'zpd_estimate_len',
  'n_hypotheses',
  'n_hyp_validated',
  'n_hyp_tentative',
  'n_hyp_contradicted',
  'mean_hyp_confidence',
  'n_evidence',
  'n_evidence_validated',
  'evidence_recency',
  'n_constraint_violations',
  'action',
  'action_family',
  'strict_shift',
  'shift_window',
  'family_matched',
  'graded_trigger_recognition',
  'graded_strategy_execution',
  'graded_strategy_quality',
  'graded_pedagogical_coherence',
  'graded_mean',
  'grader_judge_model',
];
const csvCell = (v) => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [COLS.join(',')].concat(records.map((rec) => COLS.map((c) => csvCell(rec[c])).join(','))).join('\n');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, csv + '\n');

const byCell = {};
for (const rec of records) {
  const c = (byCell[rec.cell] ||= { n: 0, strict_evaluable: 0, strict_pos: 0, graded_vals: [] });
  c.n++;
  if (rec.strict_shift != null) {
    c.strict_evaluable++;
    if (rec.strict_shift === 1) c.strict_pos++;
  }
  if (rec.graded_mean != null) c.graded_vals.push(rec.graded_mean);
}
const meta = {
  generated_at: new Date().toISOString(),
  step: 'LEARNED-ADAPTATION-PLAN.md §2 Step 1 (offline harvest)',
  db_path: DB_PATH,
  logs_dir: LOGS_DIR,
  zero_api: true,
  read_only: true,
  unit: 'one row per trajectory at the pivot decision (turn triggerTurn+1)',
  n_rows_db: rows.length,
  n_records_emitted: records.length,
  skipped,
  fidelity_check: fidelity,
  per_cell: Object.fromEntries(
    Object.entries(byCell).map(([k, v]) => [
      k,
      {
        n: v.n,
        strict_shift_rate: v.strict_evaluable ? v.strict_pos / v.strict_evaluable : null,
        strict_evaluable: v.strict_evaluable,
        graded_mean_avg: v.graded_vals.length ? v.graded_vals.reduce((a, b) => a + b, 0) / v.graded_vals.length : null,
      },
    ]),
  ),
  feature_dictionary: {
    context:
      'state snapshot at turn triggerTurn (pre-pivot); learnerProfile forward-filled across empty terminal turns',
    action: 'policyAction at turn triggerTurn+1 (the single bandit decision)',
    labels: {
      strict_shift: 'binary §6.9.7 pre-registered instrument (analyzeBranch verbatim, fidelity-asserted)',
      'graded_*': 'evaluation_results.adaptive_* — §6.8/§6.9 graded channel (grader: see grader_judge_model)',
    },
  },
};
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

console.log(`[harvest] OK — ${records.length}/${rows.length} trajectories emitted`);
console.log(`[harvest] fidelity: ${fidelity.note}`);
console.log(`[harvest] table: ${path.relative(REPO_ROOT, outPath)}`);
console.log(`[harvest] meta:  ${path.relative(REPO_ROOT, metaPath)}`);
for (const [cell, v] of Object.entries(meta.per_cell)) {
  console.log(
    `  ${cell}: n=${v.n}  strict_shift=${v.strict_shift_rate == null ? 'NA' : (v.strict_shift_rate * 100).toFixed(1) + '%'}  graded_mean=${v.graded_mean_avg == null ? 'NA' : v.graded_mean_avg.toFixed(2)}`,
  );
}
