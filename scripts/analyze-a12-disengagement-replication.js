#!/usr/bin/env node
// A12 M3 disengagement replication analysis.
// Computes per-dialogue OLS slopes on per-turn mean dimension scores,
// aggregates by (model, condition), Welch's t + Cohen's d on slopes.
// Pre-registration: see notes/design-a12-m3-disengagement-replication.md §1.
//
// Usage:
//   node scripts/analyze-a12-disengagement-replication.js
//   (reads A12 run IDs from evaluation_runs by description LIKE 'A12%')

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.resolve(process.cwd(), 'data/evaluations.db');
const db = new Database(DB_PATH, { readonly: true });

// 8 tutor dimension keys in v2.2 rubric (from config/rubrics/v2.2/tutor.yaml).
const DIM_KEYS = [
  'perception_quality',
  'pedagogical_craft',
  'elicitation_quality',
  'adaptive_responsiveness',
  'recognition_quality',
  'productive_difficulty',
  'content_accuracy',
  'interactional_coherence',
];

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}
function variance(xs) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1);
}
function sd(xs) {
  return Math.sqrt(variance(xs));
}

function olsSlope(ys) {
  // Fit y = a + b*x where x = turn index 0..n-1; return b.
  const n = ys.length;
  if (n < 2) return NaN;
  const xs = Array.from({ length: n }, (_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  return den === 0 ? NaN : num / den;
}

function welchT(a, b) {
  if (a.length < 2 || b.length < 2) return { t: NaN, df: NaN };
  const ma = mean(a), mb = mean(b);
  const va = variance(a), vb = variance(b);
  const na = a.length, nb = b.length;
  const se = Math.sqrt(va / na + vb / nb);
  const t = (ma - mb) / se;
  const df = ((va / na + vb / nb) ** 2) /
    (((va / na) ** 2) / (na - 1) + ((vb / nb) ** 2) / (nb - 1));
  return { t, df };
}

function cohenD(a, b) {
  const ma = mean(a), mb = mean(b);
  const va = variance(a), vb = variance(b);
  const na = a.length, nb = b.length;
  if (na + nb - 2 < 1) return NaN;
  const pooled = Math.sqrt(((na - 1) * va + (nb - 1) * vb) / (na + nb - 2));
  return pooled === 0 ? NaN : (ma - mb) / pooled;
}

function perTurnMeans(tutorScoresJson) {
  // Parse tutor_scores JSON keyed by turn index; for each turn, take the
  // simple mean of its 8 dimension scores. Returns an array of per-turn means
  // sorted by turn index.
  if (!tutorScoresJson) return [];
  let obj;
  try { obj = JSON.parse(tutorScoresJson); } catch { return []; }
  if (!obj || typeof obj !== 'object') return [];
  const turnIdxs = Object.keys(obj).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const out = [];
  for (const t of turnIdxs) {
    const turn = obj[String(t)];
    const scores = turn?.scores;
    if (!scores) continue;
    const vals = DIM_KEYS.map((k) => scores[k]?.score).filter((v) => Number.isFinite(v));
    if (vals.length > 0) out.push(mean(vals));
  }
  return out;
}

function analyzeRun(runId, description) {
  const rows = db.prepare(`
    SELECT id, profile_name, tutor_scores, judge_model,
           tutor_first_turn_score, tutor_last_turn_score, tutor_overall_score
    FROM evaluation_results
    WHERE run_id = ? AND judge_model IS NOT NULL
  `).all(runId);

  if (rows.length === 0) {
    console.log(`\n## ${runId}: no scored rows yet`);
    return;
  }

  // Group by judge_model then by profile_name.
  const byJudge = {};
  for (const r of rows) {
    const j = r.judge_model;
    byJudge[j] = byJudge[j] || { base: [], recog: [] };
    const perTurn = perTurnMeans(r.tutor_scores);
    if (perTurn.length < 3) continue;
    const slope = olsSlope(perTurn);
    const rec = {
      dialogueId: r.id,
      slope,
      turnCount: perTurn.length,
      first: perTurn[0],
      last: perTurn[perTurn.length - 1],
      t_first: r.tutor_first_turn_score,
      t_last: r.tutor_last_turn_score,
      t_overall: r.tutor_overall_score,
    };
    if (r.profile_name.includes('base_single')) byJudge[j].base.push(rec);
    else if (r.profile_name.includes('recog_single')) byJudge[j].recog.push(rec);
  }

  console.log(`\n## ${runId}`);
  console.log(`${description}`);
  for (const [judge, groups] of Object.entries(byJudge)) {
    const { base, recog } = groups;
    console.log(`\n### Judge: ${judge}`);
    console.log(`  n_base = ${base.length}, n_recog = ${recog.length}`);
    if (base.length === 0 || recog.length === 0) {
      console.log(`  (insufficient data for contrast)`);
      continue;
    }
    const baseSlopes = base.map(r => r.slope).filter(Number.isFinite);
    const recogSlopes = recog.map(r => r.slope).filter(Number.isFinite);

    const baseMeanSlope = mean(baseSlopes);
    const recogMeanSlope = mean(recogSlopes);
    const baseSDslope = sd(baseSlopes);
    const recogSDslope = sd(recogSlopes);

    const d = cohenD(recogSlopes, baseSlopes);
    const { t, df } = welchT(recogSlopes, baseSlopes);

    const baseFirst = mean(base.map(r => r.t_first).filter(Number.isFinite));
    const recogFirst = mean(recog.map(r => r.t_first).filter(Number.isFinite));
    const baseLast = mean(base.map(r => r.t_last).filter(Number.isFinite));
    const recogLast = mean(recog.map(r => r.t_last).filter(Number.isFinite));

    console.log(`  Slope (pts/turn, per-turn dim-mean 1-5 scale):`);
    console.log(`    base:  mean=${baseMeanSlope.toFixed(3)}, SD=${baseSDslope.toFixed(3)}, n=${baseSlopes.length}`);
    console.log(`    recog: mean=${recogMeanSlope.toFixed(3)}, SD=${recogSDslope.toFixed(3)}, n=${recogSlopes.length}`);
    console.log(`    Cohen's d (recog - base): ${d.toFixed(3)}`);
    console.log(`    Welch's t(${df.toFixed(1)}) = ${t.toFixed(3)}`);
    console.log(`  Rubric aggregate scores (0-100 scale):`);
    console.log(`    t_first: base=${baseFirst?.toFixed(2)}, recog=${recogFirst?.toFixed(2)}, Δ=${(recogFirst - baseFirst)?.toFixed(2)}`);
    console.log(`    t_last:  base=${baseLast?.toFixed(2)}, recog=${recogLast?.toFixed(2)}, Δ=${(recogLast - baseLast)?.toFixed(2)}`);
    console.log(`  A12 pre-registered decision grid: d ≥ 1.0 → replicates; d < 0.5 → fails to replicate; d ∈ (0.5, 1.0) → partial`);
    const verdict = Number.isFinite(d)
      ? d >= 1.0 ? 'REPLICATES'
      : d < 0.5 ? 'FAILS TO REPLICATE'
      : 'PARTIAL (inconclusive)'
      : 'INSUFFICIENT DATA';
    console.log(`  Verdict on slope effect: **${verdict}**`);
  }
}

// Discover A12 runs from the DB.
const runs = db.prepare(`
  SELECT id, description FROM evaluation_runs
  WHERE description LIKE 'A12%'
  ORDER BY created_at DESC
`).all();

if (runs.length === 0) {
  console.error('No A12 runs found in DB. Expected description LIKE "A12%".');
  process.exit(1);
}

console.log(`# A12 M3 Disengagement Replication Analysis`);
console.log(`Analysing ${runs.length} A12 run(s):`);
for (const r of runs) {
  console.log(`  - ${r.id}: ${r.description}`);
}

for (const r of runs) {
  analyzeRun(r.id, r.description);
}

console.log(`\n---\n## Reference: original DeepSeek/Sonnet finding`);
console.log(`  recog slope = +2.79 pts/turn (on 0-100 aggregate); base slope = -0.21 pts/turn`);
console.log(`  Cohen's d on slopes = 1.63, Welch's t(21.9) = 3.99, p ≈ .0006, n=12/condition`);
console.log(`  Gap widens from +12 at T0 to +35 at T8-T10.`);
console.log(`\nNote: the A12 replication uses per-turn dim-mean on a 1-5 scale, so slope magnitudes are not directly comparable to the original 0-100 figure. The PRIMARY comparison is Cohen's d on slopes (dimensionless), which IS directly comparable across scale choices. The rubric aggregate Δ (t_first, t_last) is reported on the same 0-100 scale as the original for level comparison.`);
