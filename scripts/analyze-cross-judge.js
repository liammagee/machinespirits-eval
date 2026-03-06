#!/usr/bin/env node

/**
 * Cross-Judge Analysis Script
 *
 * Compares scoring across multiple judges and runs for the cells 80-87 factorial.
 * Outputs: grand means, recognition effects (delta + Cohen's d), architecture effects,
 * interaction effects, development trajectories, DQ pub/int gap, inter-judge correlations.
 *
 * Usage:
 *   node scripts/analyze-cross-judge.js [--runs <id1,id2,...>] [--judges <j1,j2,j3>] [--json]
 *
 * Defaults to the three Paper 2.0 runs and three judges if not specified.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'evaluations.db');

// --- CLI args ---
const args = process.argv.slice(2);
function getOption(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}
const jsonOutput = args.includes('--json');

const DEFAULT_RUNS = [
  'eval-2026-03-01-aea2abfb',
  'eval-2026-03-02-45163390',
  'eval-2026-03-02-18027efc',
];
const DEFAULT_JUDGES = [
  'claude-code/sonnet',
  'gemini-3.1-pro-preview',
  'gpt-5.4',
];

const runIds = (getOption('runs') || '').split(',').filter(Boolean);
const runs = runIds.length > 0 ? runIds : DEFAULT_RUNS;
const judgeList = (getOption('judges') || '').split(',').filter(Boolean);
const judges = judgeList.length > 0 ? judgeList : DEFAULT_JUDGES;

const RUN_LABELS = {
  'eval-2026-03-01-aea2abfb': 'aea2abfb (DS)',
  'eval-2026-03-02-45163390': '45163390 (DS)',
  'eval-2026-03-02-18027efc': '18027efc (GF)',
};

function runLabel(id) {
  return RUN_LABELS[id] || id.replace('eval-2026-', '').slice(0, 12);
}

// --- DB ---
const db = new Database(DB_PATH, { readonly: true });

const placeholders = runs.map(() => '?').join(',');
const baseWhere = `run_id IN (${placeholders}) AND success = 1 AND suggestions <> '[]'`;

function query(sql, params = runs) {
  return db.prepare(sql).all(...params);
}

// --- Helpers ---
function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
}

function cohensD(a, b) {
  const va = variance(a);
  const vb = variance(b);
  const pooled = Math.sqrt((va + vb) / 2);
  if (pooled === 0) return 0;
  return (mean(b) - mean(a)) / pooled;
}

function pearsonR(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

function round(v, dp = 1) {
  if (v == null) return 'N/A';
  return Number(v.toFixed(dp));
}

// --- Load data ---
const rows = query(`
  SELECT run_id, judge_model, profile_name, scenario_id, id,
    tutor_first_turn_score, tutor_last_turn_score, tutor_overall_score,
    tutor_development_score, dialogue_quality_score, dialogue_quality_internal_score,
    tutor_holistic_overall_score, learner_overall_score, learner_holistic_overall_score,
    tutor_deliberation_score, learner_deliberation_score
  FROM evaluation_results
  WHERE ${baseWhere}
  ORDER BY run_id, judge_model, profile_name, scenario_id, id
`);

// Tag each row
for (const r of rows) {
  r.isRecog = r.profile_name.includes('recog') ? 1 : 0;
  r.isMulti = r.profile_name.includes('multi') ? 1 : 0;
  r.isPsycho = r.profile_name.includes('psycho') ? 1 : 0;
}

// Group by run × judge
function groupBy(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}

const byRunJudge = groupBy(rows, (r) => `${r.run_id}|${r.judge_model}`);

// ============================================================
// 1. Grand Means
// ============================================================
console.log('=' .repeat(70));
console.log('  CROSS-JUDGE ANALYSIS: 3 runs × 3 judges × N=144');
console.log('  Runs:', runs.map(runLabel).join(', '));
console.log('  Judges:', judges.join(', '));
console.log('  Total rows:', rows.length);
console.log('=' .repeat(70));

console.log('\n1. GRAND MEANS\n');
const dims = ['tutor_overall_score', 'dialogue_quality_score', 'dialogue_quality_internal_score',
  'tutor_holistic_overall_score', 'learner_overall_score', 'tutor_development_score'];
const dimLabels = ['t_ovr', 'dq_pub', 'dq_int', 't_hol', 'l_ovr', 't_dev'];

console.log(
  'Run'.padEnd(18) + 'Judge'.padEnd(26) +
  dimLabels.map((l) => l.padStart(8)).join('')
);
for (const run of runs) {
  for (const judge of judges) {
    const key = `${run}|${judge}`;
    const data = byRunJudge.get(key) || [];
    if (!data.length) continue;
    const vals = dims.map((d) => round(mean(data.map((r) => r[d]).filter((v) => v != null))));
    console.log(
      runLabel(run).padEnd(18) +
      judge.padEnd(26) +
      vals.map((v) => String(v).padStart(8)).join('')
    );
  }
}

// ============================================================
// 2. Recognition Effect (delta + Cohen's d)
// ============================================================
console.log('\n2. RECOGNITION EFFECT (recog - base)\n');
console.log(
  'Run'.padEnd(18) + 'Judge'.padEnd(26) +
  dimLabels.slice(0, 5).map((l) => (l + '_d').padStart(10)).join('') +
  dimLabels.slice(0, 5).map((l) => (l + '_D').padStart(10)).join('')
);

const allEffects = [];
for (const run of runs) {
  for (const judge of judges) {
    const key = `${run}|${judge}`;
    const data = byRunJudge.get(key) || [];
    const base = data.filter((r) => !r.isRecog);
    const recog = data.filter((r) => r.isRecog);
    const deltas = [];
    const ds = [];
    for (const dim of dims.slice(0, 5)) {
      const bv = base.map((r) => r[dim]).filter((v) => v != null);
      const rv = recog.map((r) => r[dim]).filter((v) => v != null);
      deltas.push(round(mean(rv) - mean(bv)));
      ds.push(round(cohensD(bv, rv), 2));
    }
    allEffects.push({ run: runLabel(run), judge, deltas, ds });
    console.log(
      runLabel(run).padEnd(18) + judge.padEnd(26) +
      deltas.map((v) => String(v).padStart(10)).join('') +
      ds.map((v) => String(v).padStart(10)).join('')
    );
  }
}

// ============================================================
// 3. Architecture Effects
// ============================================================
console.log('\n3. ARCHITECTURE MAIN EFFECTS\n');
console.log(
  'Run'.padEnd(18) + 'Judge'.padEnd(26) +
  ['multi_tovr', 'multi_dq', 'multi_thol', 'psycho_tovr', 'psycho_lovr'].map((l) => l.padStart(13)).join('')
);

for (const run of runs) {
  for (const judge of judges) {
    const key = `${run}|${judge}`;
    const data = byRunJudge.get(key) || [];
    const multiD = (dim) => mean(data.filter((r) => r.isMulti).map((r) => r[dim]).filter((v) => v != null))
      - mean(data.filter((r) => !r.isMulti).map((r) => r[dim]).filter((v) => v != null));
    const psychoD = (dim) => mean(data.filter((r) => r.isPsycho).map((r) => r[dim]).filter((v) => v != null))
      - mean(data.filter((r) => !r.isPsycho).map((r) => r[dim]).filter((v) => v != null));
    const vals = [
      round(multiD('tutor_overall_score')),
      round(multiD('dialogue_quality_score')),
      round(multiD('tutor_holistic_overall_score')),
      round(psychoD('tutor_overall_score')),
      round(psychoD('learner_overall_score')),
    ];
    console.log(
      runLabel(run).padEnd(18) + judge.padEnd(26) + vals.map((v) => String(v).padStart(13)).join('')
    );
  }
}

// ============================================================
// 4. Recognition × Multi-Agent Interaction
// ============================================================
console.log('\n4. RECOGNITION × MULTI-AGENT INTERACTION (on tutor_overall)\n');
console.log(
  'Run'.padEnd(18) + 'Judge'.padEnd(26) +
  ['recog_single', 'recog_multi', 'multi_base', 'multi_recog'].map((l) => l.padStart(14)).join('')
);

for (const run of runs) {
  for (const judge of judges) {
    const key = `${run}|${judge}`;
    const data = byRunJudge.get(key) || [];
    const avg = (filter) => mean(data.filter(filter).map((r) => r.tutor_overall_score).filter((v) => v != null));
    const vals = [
      round(avg((r) => r.isRecog && !r.isMulti) - avg((r) => !r.isRecog && !r.isMulti)),
      round(avg((r) => r.isRecog && r.isMulti) - avg((r) => !r.isRecog && r.isMulti)),
      round(avg((r) => r.isMulti && !r.isRecog) - avg((r) => !r.isMulti && !r.isRecog)),
      round(avg((r) => r.isMulti && r.isRecog) - avg((r) => !r.isMulti && r.isRecog)),
    ];
    console.log(
      runLabel(run).padEnd(18) + judge.padEnd(26) + vals.map((v) => String(v).padStart(14)).join('')
    );
  }
}

// ============================================================
// 5. Development Trajectories
// ============================================================
console.log('\n5. DEVELOPMENT TRAJECTORIES (tN - t0)\n');
console.log(
  'Run'.padEnd(18) + 'Judge'.padEnd(26) + 'Cond'.padEnd(8) +
  ['avg_dev', 'improved', 'declined', 'n'].map((l) => l.padStart(10)).join('')
);

for (const run of runs) {
  for (const judge of judges) {
    const key = `${run}|${judge}`;
    const data = byRunJudge.get(key) || [];
    for (const cond of ['base', 'recog']) {
      const subset = data.filter((r) => (cond === 'recog' ? r.isRecog : !r.isRecog))
        .filter((r) => r.tutor_first_turn_score != null && r.tutor_last_turn_score != null);
      const devs = subset.map((r) => r.tutor_last_turn_score - r.tutor_first_turn_score);
      console.log(
        runLabel(run).padEnd(18) + judge.padEnd(26) + cond.padEnd(8) +
        String(round(mean(devs))).padStart(10) +
        String(devs.filter((d) => d > 0).length).padStart(10) +
        String(devs.filter((d) => d < 0).length).padStart(10) +
        String(devs.length).padStart(10)
      );
    }
  }
}

// ============================================================
// 6. DQ Public vs Internal
// ============================================================
console.log('\n6. DQ PUBLIC vs INTERNAL (by architecture)\n');
console.log(
  'Run'.padEnd(18) + 'Judge'.padEnd(26) + 'Arch'.padEnd(8) +
  ['dq_pub', 'dq_int', 'gap'].map((l) => l.padStart(10)).join('')
);

for (const run of runs) {
  for (const judge of judges) {
    const key = `${run}|${judge}`;
    const data = byRunJudge.get(key) || [];
    for (const arch of ['single', 'multi']) {
      const subset = data.filter((r) => (arch === 'multi' ? r.isMulti : !r.isMulti));
      const pub = mean(subset.map((r) => r.dialogue_quality_score).filter((v) => v != null));
      const int = mean(subset.map((r) => r.dialogue_quality_internal_score).filter((v) => v != null));
      console.log(
        runLabel(run).padEnd(18) + judge.padEnd(26) + arch.padEnd(8) +
        String(round(pub)).padStart(10) +
        String(round(int)).padStart(10) +
        String(round(int - pub)).padStart(10)
      );
    }
  }
}

// ============================================================
// 7. Inter-Judge Correlations
// ============================================================
console.log('\n7. INTER-JUDGE CORRELATIONS (paired by replication)\n');

// Build paired data: match by (run, profile, scenario, rep_number)
const byKey = new Map();
for (const r of rows) {
  const k = `${r.run_id}|${r.judge_model}|${r.profile_name}|${r.scenario_id}`;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(r);
}

// Sort each group by id to get consistent replication ordering
for (const arr of byKey.values()) {
  arr.sort((a, b) => (a.id < b.id ? -1 : 1));
}

console.log(
  'Run'.padEnd(14) + 'N'.padStart(5) +
  ['SG_tovr', 'SP_tovr', 'GP_tovr', 'SG_dq', 'SP_dq', 'GP_dq', 'SG_hol', 'SP_hol', 'GP_hol']
    .map((l) => l.padStart(10)).join('')
);

for (const run of runs) {
  // Collect paired arrays
  const paired = { s_t: [], g_t: [], p_t: [], s_d: [], g_d: [], p_d: [], s_h: [], g_h: [], p_h: [] };
  // Get all (profile, scenario) combos for this run
  const combos = new Set();
  for (const r of rows.filter((r) => r.run_id === run)) {
    combos.add(`${r.profile_name}|${r.scenario_id}`);
  }

  for (const combo of combos) {
    const [prof, scen] = combo.split('|');
    const sRows = byKey.get(`${run}|${judges[0]}|${prof}|${scen}`) || [];
    const gRows = byKey.get(`${run}|${judges[1]}|${prof}|${scen}`) || [];
    const pRows = byKey.get(`${run}|${judges[2]}|${prof}|${scen}`) || [];
    const nRep = Math.min(sRows.length, gRows.length, pRows.length);
    for (let i = 0; i < nRep; i++) {
      if (sRows[i].tutor_overall_score != null && gRows[i].tutor_overall_score != null && pRows[i].tutor_overall_score != null) {
        paired.s_t.push(sRows[i].tutor_overall_score);
        paired.g_t.push(gRows[i].tutor_overall_score);
        paired.p_t.push(pRows[i].tutor_overall_score);
        paired.s_d.push(sRows[i].dialogue_quality_score);
        paired.g_d.push(gRows[i].dialogue_quality_score);
        paired.p_d.push(pRows[i].dialogue_quality_score);
        paired.s_h.push(sRows[i].tutor_holistic_overall_score);
        paired.g_h.push(gRows[i].tutor_holistic_overall_score);
        paired.p_h.push(pRows[i].tutor_holistic_overall_score);
      }
    }
  }

  const n = paired.s_t.length;
  console.log(
    runLabel(run).padEnd(14) + String(n).padStart(5) +
    [
      pearsonR(paired.s_t, paired.g_t), pearsonR(paired.s_t, paired.p_t), pearsonR(paired.g_t, paired.p_t),
      pearsonR(paired.s_d, paired.g_d), pearsonR(paired.s_d, paired.p_d), pearsonR(paired.g_d, paired.p_d),
      pearsonR(paired.s_h, paired.g_h), pearsonR(paired.s_h, paired.p_h), pearsonR(paired.g_h, paired.p_h),
    ].map((v) => String(round(v, 3)).padStart(10)).join('')
  );
}

// ============================================================
// Summary
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('  SUMMARY');
console.log('='.repeat(70));

// Count how many cells have positive recognition effect
const posRecog = allEffects.filter((e) => e.deltas[0] > 0).length;
console.log(`  Recognition positive on t_ovr: ${posRecog}/${allEffects.length} cells`);
console.log(`  Recognition d range on t_ovr:  ${Math.min(...allEffects.map((e) => e.ds[0]))} – ${Math.max(...allEffects.map((e) => e.ds[0]))}`);

// Learner invariance
const learnerDs = allEffects.map((e) => e.ds[4]);
console.log(`  Learner d range:               ${Math.min(...learnerDs)} – ${Math.max(...learnerDs)}`);

console.log('');
db.close();
