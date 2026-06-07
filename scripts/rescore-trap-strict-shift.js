#!/usr/bin/env node
/**
 * rescore-trap-strict-shift.js — OFFLINE trigger-relative re-score of the
 * cross-architecture strict_shift comparison (paper §6.8.3 / §6.8.4 / §6.8.7).
 *
 * WHY. scripts/analyze-strategy-shift.js scores the tutor policy at the FIXED
 * perTurn index `triggerTurn + 1`. The dialogue-engine baseline adapter
 * (run-dialogue-engine-trap-baseline.js, pre-fix) advanced the learner turn by
 * +1 (`turn: turn + 1`), so its trap learner fired the trigger one tutor-turn
 * EARLY, and the tutor's true response to the trigger landed at perTurn
 * `turn === triggerTurn`, NOT `triggerTurn + 1`. The fixed-index scorer reads
 * the baseline one slot too late and undercounts it — inflating the
 * state-policy vs dialogue-engine advantage. The adaptive runner passes
 * `turn: state.turn`, so it is aligned and unaffected.
 *
 * codex's source fix (scripts/lib/trapTurnConvention.js + adapter edits)
 * standardises FUTURE runs, but it does NOT re-score the EXISTING traces: the
 * scorer arithmetic is unchanged (`scoredTutorTurnAfterTrigger` still returns
 * triggerTurn+1), and the stored baseline traces still carry the shifted
 * numbering. This script recovers the corrected numbers from the stored traces
 * at ZERO API cost by locating the ACTUAL trigger emission in each dialogue (by
 * its signal text) and scoring the first tutor turn after it — adapter-agnostic,
 * so aligned architectures are unchanged and only mis-numbered baselines move.
 *
 * Read-only on DB + trace files. Imports none of codex's in-progress modules
 * (its helper is fixed-arithmetic and would reproduce the bug on old traces).
 *
 * Usage:  node scripts/rescore-trap-strict-shift.js [--verbose] [--out <path>]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.EVAL_DB_PATH || path.join(REPO_ROOT, 'data', 'evaluations.db');

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const outIdx = args.indexOf('--out');
const OUT_PATH =
  outIdx !== -1 && args[outIdx + 1]
    ? args[outIdx + 1]
    : path.join(REPO_ROOT, 'exports', 'trap-strict-shift-rescore.json');

// Trace files for these (pre-fork, May) runs live in the private archive; newer
// runs land in the local logs dir. Try both.
const LOG_DIRS = [
  path.join(process.env.EVAL_LOGS_DIR || path.join(REPO_ROOT, 'logs'), 'tutor-dialogues'),
  path.join(REPO_ROOT, '..', 'machinespirits-eval-private', 'logs', 'tutor-dialogues'),
];

// The four headline cells + the runs whose strict_shift the paper reports.
// `paper` is the published stored-convention number, used here only as a
// reproduction check that the harness reads the same data the paper did.
const CELLS = [
  {
    key: 'cell_110 state·v1',
    profile: 'cell_110_langgraph_adaptive',
    runIds: ['eval-2026-05-05-486d7d1e'],
    paper: '47.8% (11/23)',
    aligned: true,
  },
  {
    key: 'cell_114 engine·v1',
    profile: 'cell_114_dialogue_engine_trap_baseline',
    runIds: [
      'eval-2026-05-12-3db6bf3e',
      'eval-2026-05-12-41f4487f',
      'eval-2026-05-12-c53a1d8f',
      'eval-2026-05-12-f157bcd0',
    ],
    paper: '25.0% (6/24)',
    aligned: false,
  },
  {
    key: 'cell_124 state·xsuite',
    profile: 'cell_124_langgraph_adaptive_crosssuite',
    runIds: ['eval-2026-05-12-de6d48ab'],
    paper: '62.5% (15/24)',
    aligned: true,
  },
  {
    key: 'cell_125 engine·xsuite',
    profile: 'cell_125_dialogue_engine_crosssuite_baseline',
    runIds: ['eval-2026-05-12-952498c6'],
    paper: '30.4% (7/23)',
    aligned: false,
  },
];

function loadTrace(dialogueId) {
  for (const dir of LOG_DIRS) {
    const p = path.join(dir, `${dialogueId}.json`);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  }
  return null;
}

const tokenize = (s) =>
  new Set(
    String(s)
      .toLowerCase()
      .match(/\b\w+\b/g) || [],
  );
function jaccard(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

// Pedagogical families (copied verbatim from analyze-strategy-shift.js so this
// script stays self-contained). Strict label-match is brittle — the real LLM
// learner fires the trigger at content-determined turns and the tutor's correct
// move often carries a same-family but different label (e.g. request_elaboration
// vs ask_diagnostic_question). Family-level match is the robustness check.
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
  for (const [fam, actions] of Object.entries(POLICY_FAMILIES)) for (const a of actions) m.set(a, fam);
  return m;
})();
const familyOf = (action) => POLICY_TO_FAMILY.get(action) || null;

// Locate the trigger emission in the dialogue stream and return `p` = the count
// of tutor messages BEFORE it. The first tutor response to the trigger is then
// perTurnSorted[p] — adapter-agnostic, independent of the perTurn.turn numbering.
function locateTriggerTutorIndex(branch, triggerSignal) {
  const dlg = Array.isArray(branch.dialogue) ? branch.dialogue : [];
  const tNorm = norm(triggerSignal);
  let tutorsBefore = 0;
  let best = { jac: 0, p: null };
  for (const m of dlg) {
    const role = m.role === 'assistant' ? 'tutor' : m.role === 'user' ? 'learner' : m.role;
    if (role === 'tutor') {
      tutorsBefore++;
      continue;
    }
    if (role !== 'learner') continue;
    const c = norm(m.content);
    const j = jaccard(m.content, triggerSignal);
    const contained = tNorm.length > 20 && c.length > 20 && (c.includes(tNorm) || tNorm.includes(c));
    if (contained || j >= 0.6) return { p: tutorsBefore, quality: contained ? 1 : j, found: true, loose: false };
    if (j > best.jac) best = { jac: j, p: tutorsBefore };
  }
  if (best.jac >= 0.3) return { p: best.p, quality: best.jac, found: true, loose: true };
  return { p: null, quality: best.jac, found: false, loose: false };
}

// Score one trace under both conventions. Uses trace.original only (the branch
// strict_shift scores; the counterfactual is for divergence, not shift).
function scoreTrace(trace) {
  const b = trace.original;
  if (!b || !Array.isArray(b.perTurn)) return null;
  const hidden = trace.scenario?.hidden || {};
  const triggerTurn = hidden.triggerTurn ?? hidden.trigger_turn ?? -1;
  const triggerSignal = hidden.triggerSignal ?? hidden.trigger_signal ?? '';
  const expected = trace.scenario?.expectedStrategyShift ?? null;
  if (expected == null || !Number.isFinite(triggerTurn)) {
    return { storedMatch: null, relMatch: null, found: false };
  }
  const accepted = Array.isArray(expected) ? expected : [expected];
  const acceptedFamilies = new Set(accepted.map(familyOf).filter(Boolean));
  const isMatch = (pol) => (pol != null ? accepted.includes(pol) : null);
  const isFamMatch = (pol) => (pol != null ? acceptedFamilies.has(familyOf(pol)) : null);

  const perTurnSorted = [...b.perTurn].sort((x, y) => x.turn - y.turn);
  const polByTurn = new Map(perTurnSorted.map((t) => [t.turn, t.tutorInternal?.policyAction ?? null]));

  // (1) stored convention — fixed perTurn index triggerTurn+1 (current scorer).
  const storedPol = polByTurn.get(triggerTurn + 1) ?? null;
  const storedMatch = isMatch(storedPol);
  const storedFamMatch = isFamMatch(storedPol);

  // (2) content-relative — first tutor turn after the actual trigger emission.
  const loc = locateTriggerTutorIndex(b, triggerSignal);
  let relPol = storedPol; // fallback if the trigger text cannot be located
  let win2Match = null;
  if (loc.found && loc.p != null && loc.p < perTurnSorted.length) {
    relPol = perTurnSorted[loc.p]?.tutorInternal?.policyAction ?? null;
    const m0 = isMatch(relPol);
    const m1 =
      loc.p + 1 < perTurnSorted.length ? isMatch(perTurnSorted[loc.p + 1]?.tutorInternal?.policyAction ?? null) : null;
    win2Match = m0 === true || m1 === true ? true : m0 === null && m1 === null ? null : false;
  }
  const relMatch = loc.found ? isMatch(relPol) : storedMatch;
  const relFamMatch = loc.found ? isFamMatch(relPol) : storedFamMatch;

  return {
    storedMatch,
    storedFamMatch,
    relMatch,
    relFamMatch,
    win2Match,
    found: loc.found,
    loose: loc.loose,
    quality: loc.quality,
    triggerTurn,
    expected: accepted,
    storedPol,
    relPol,
  };
}

const db = new Database(DB_PATH, { readonly: true });

function dialogueIdsFor(cell) {
  const ph = cell.runIds.map(() => '?').join(',');
  const stmt = db.prepare(
    `SELECT DISTINCT dialogue_id, scenario_type FROM evaluation_results
     WHERE run_id IN (${ph}) AND profile_name = ? AND dialogue_id IS NOT NULL`,
  );
  return stmt.all(...cell.runIds, cell.profile);
}

const pct = (m, n) => (n ? ((100 * m) / n).toFixed(1) : 'n/a');
const results = [];

for (const cell of CELLS) {
  const rows = dialogueIdsFor(cell);
  const agg = {
    key: cell.key,
    profile: cell.profile,
    aligned: cell.aligned,
    paper: cell.paper,
    n: 0,
    stored_m: 0,
    stored_e: 0,
    rel_m: 0,
    rel_e: 0,
    storedFam_m: 0,
    storedFam_e: 0,
    relFam_m: 0,
    relFam_e: 0,
    win2_m: 0,
    win2_e: 0,
    found: 0,
    loose: 0,
    missingTrace: 0,
    flips: [],
  };
  for (const row of rows) {
    const trace = loadTrace(row.dialogue_id);
    if (!trace) {
      agg.missingTrace++;
      continue;
    }
    const s = scoreTrace(trace);
    if (!s) continue;
    agg.n++;
    if (s.found) agg.found++;
    if (s.loose) agg.loose++;
    if (s.storedMatch != null) {
      agg.stored_e++;
      if (s.storedMatch) agg.stored_m++;
    }
    if (s.relMatch != null) {
      agg.rel_e++;
      if (s.relMatch) agg.rel_m++;
    }
    if (s.storedFamMatch != null) {
      agg.storedFam_e++;
      if (s.storedFamMatch) agg.storedFam_m++;
    }
    if (s.relFamMatch != null) {
      agg.relFam_e++;
      if (s.relFamMatch) agg.relFam_m++;
    }
    if (s.win2Match != null) {
      agg.win2_e++;
      if (s.win2Match) agg.win2_m++;
    }
    if (s.storedMatch !== s.relMatch) {
      agg.flips.push({
        dialogue_id: row.dialogue_id,
        scenario_type: row.scenario_type,
        stored: s.storedMatch,
        rel: s.relMatch,
        storedPol: s.storedPol,
        relPol: s.relPol,
        expected: s.expected,
        triggerQuality: Number(s.quality?.toFixed?.(2) ?? s.quality),
      });
    }
  }
  results.push(agg);
}

db.close();

// ── Report ────────────────────────────────────────────────────────────────
console.log('\nOFFLINE trigger-relative re-score of cross-architecture strict_shift');
console.log('(reproduces the stored numbers, then re-scores by locating the actual trigger)\n');

const head = ['cell', 'N', 'stored strict', 'paper', 'content-rel', 'win≤2', 'trig-found'];
const widths = [22, 4, 14, 14, 14, 10, 10];
const fmtRow = (cols) => cols.map((c, i) => String(c).padEnd(widths[i])).join('');
console.log(fmtRow(head));
console.log(fmtRow(widths.map((w) => '─'.repeat(w - 1))));
for (const r of results) {
  console.log(
    fmtRow([
      r.key,
      r.n,
      `${pct(r.stored_m, r.stored_e)}% (${r.stored_m}/${r.stored_e})`,
      r.paper,
      `${pct(r.rel_m, r.rel_e)}% (${r.rel_m}/${r.rel_e})`,
      `${pct(r.win2_m, r.win2_e)}%`,
      `${r.found}/${r.n}${r.loose ? ` (${r.loose} fuzzy)` : ''}`,
    ]),
  );
}

// Family-level table (the robustness check — collapses same-family label noise).
console.log('\nFamily-level match (right pedagogical family at the scored turn):\n');
console.log(fmtRow(['cell', 'N', 'stored family', 'content-rel family', '', '', '']));
console.log(fmtRow(widths.map((w) => '─'.repeat(w - 1))));
for (const r of results) {
  console.log(
    fmtRow([
      r.key,
      r.n,
      `${pct(r.storedFam_m, r.storedFam_e)}% (${r.storedFam_m}/${r.storedFam_e})`,
      `${pct(r.relFam_m, r.relFam_e)}% (${r.relFam_m}/${r.relFam_e})`,
      '',
      '',
      '',
    ]),
  );
}

// Paired contrasts (state vs engine): strict + family, stored vs content-relative.
function contrast(stateKey, engineKey, label) {
  const s = results.find((r) => r.key === stateKey);
  const e = results.find((r) => r.key === engineKey);
  if (!s || !e) return;
  const ratio = (sm, se, em, ee) => {
    const sp = (100 * sm) / se;
    const ep = (100 * em) / ee;
    return `state ${sp.toFixed(1)}% vs engine ${ep.toFixed(1)}%  → +${(sp - ep).toFixed(1)}pp  (${(sp / ep).toFixed(2)}×)`;
  };
  console.log(`\n${label}`);
  console.log(`  strict  stored      : ${ratio(s.stored_m, s.stored_e, e.stored_m, e.stored_e)}`);
  console.log(`  strict  content-rel : ${ratio(s.rel_m, s.rel_e, e.rel_m, e.rel_e)}`);
  console.log(`  family  stored      : ${ratio(s.storedFam_m, s.storedFam_e, e.storedFam_m, e.storedFam_e)}`);
  console.log(`  family  content-rel : ${ratio(s.relFam_m, s.relFam_e, e.relFam_m, e.relFam_e)}`);
}
contrast('cell_110 state·v1', 'cell_114 engine·v1', 'v1 trap suite');
contrast('cell_124 state·xsuite', 'cell_125 engine·xsuite', 'cross-suite');

if (VERBOSE) {
  for (const r of results) {
    if (!r.flips.length) continue;
    console.log(`\n── ${r.key}: ${r.flips.length} trace(s) flipped stored→content-rel ──`);
    for (const f of r.flips) {
      console.log(
        `  [${f.scenario_type}] stored=${f.stored}(${f.storedPol}) → rel=${f.rel}(${f.relPol})  exp=${JSON.stringify(f.expected)}  q=${f.triggerQuality}`,
      );
    }
  }
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify({ generatedFrom: 'rescore-trap-strict-shift.js', cells: results }, null, 2));
console.log(`\nWrote ${path.relative(REPO_ROOT, OUT_PATH)}`);
