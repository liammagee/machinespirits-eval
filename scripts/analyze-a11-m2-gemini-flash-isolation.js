#!/usr/bin/env node
// A11 M2-alone isolation on Gemini Flash 3.0.
// Compares base+superego cells (82/83) on Gemini Flash vs base+single-agent
// cells (80/81) already scored in run 18027efc (Paper 2.0 Gemini Flash data).
// Pre-registration: see notes/design-a11-m2-gemini-flash-isolation.md §4.1.
//
// Usage:
//   node scripts/analyze-a11-m2-gemini-flash-isolation.js

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'data/evaluations.db');
const db = new Database(DB_PATH, { readonly: true });

const BASELINE_RUN = 'eval-2026-03-02-18027efc';  // Existing Gemini Flash base data
const A11_RUN_PATTERN = 'A11 M2-alone isolation on Gemini Flash%';

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN; }
function variance(xs) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1);
}
function sd(xs) { return Math.sqrt(variance(xs)); }
function cohenD(a, b) {
  const ma = mean(a), mb = mean(b);
  const va = variance(a), vb = variance(b);
  const na = a.length, nb = b.length;
  if (na + nb - 2 < 1) return NaN;
  const pooled = Math.sqrt(((na - 1) * va + (nb - 1) * vb) / (na + nb - 2));
  return pooled === 0 ? NaN : (ma - mb) / pooled;
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

// Find the most-recent A11 run.
const a11Run = db.prepare(`
  SELECT id, description FROM evaluation_runs
  WHERE description LIKE ?
  ORDER BY created_at DESC LIMIT 1
`).get(A11_RUN_PATTERN);
if (!a11Run) {
  console.error(`No A11 run found matching "${A11_RUN_PATTERN}"`);
  process.exit(1);
}

console.log(`# A11 M2-Alone Isolation on Gemini Flash 3.0 — Analysis`);
console.log(`A11 run: ${a11Run.id}`);
console.log(`Baseline run (cells 80/81, single-agent Gemini Flash): ${BASELINE_RUN}`);
console.log('');

// What judges are available on both?
const judges = db.prepare(`
  SELECT DISTINCT judge_model FROM evaluation_results
  WHERE run_id IN (?, ?) AND judge_model IS NOT NULL
  ORDER BY judge_model
`).all(a11Run.id, BASELINE_RUN);

for (const { judge_model: judge } of judges) {
  // Per-cell n and mean on the target score columns we care about:
  // tutor_first_turn_score is the primary (T0, not confounded by multi-turn decay).
  const baselineRows = db.prepare(`
    SELECT tutor_first_turn_score, tutor_overall_score, tutor_last_turn_score
    FROM evaluation_results
    WHERE run_id = ? AND judge_model = ?
      AND profile_name IN ('cell_80_messages_base_single_unified','cell_81_messages_base_single_psycho')
      AND tutor_first_turn_score IS NOT NULL
  `).all(BASELINE_RUN, judge);

  const isolationRows = db.prepare(`
    SELECT tutor_first_turn_score, tutor_overall_score, tutor_last_turn_score
    FROM evaluation_results
    WHERE run_id = ? AND judge_model = ?
      AND profile_name IN ('cell_82_messages_base_multi_unified','cell_83_messages_base_multi_psycho')
      AND tutor_first_turn_score IS NOT NULL
  `).all(a11Run.id, judge);

  if (baselineRows.length === 0 || isolationRows.length === 0) {
    console.log(`### ${judge}`);
    console.log(`  baseline n = ${baselineRows.length}, M2-isolation n = ${isolationRows.length}`);
    console.log(`  → skipping: need both baseline and isolation rows under same judge\n`);
    continue;
  }

  const baselineT0 = baselineRows.map(r => r.tutor_first_turn_score).filter(Number.isFinite);
  const isolationT0 = isolationRows.map(r => r.tutor_first_turn_score).filter(Number.isFinite);

  const delta = mean(isolationT0) - mean(baselineT0);
  const d = cohenD(isolationT0, baselineT0);
  const { t, df } = welchT(isolationT0, baselineT0);

  const baselineOver = baselineRows.map(r => r.tutor_overall_score).filter(Number.isFinite);
  const isolationOver = isolationRows.map(r => r.tutor_overall_score).filter(Number.isFinite);
  const deltaOver = mean(isolationOver) - mean(baselineOver);
  const dOver = cohenD(isolationOver, baselineOver);

  console.log(`### ${judge}`);
  console.log(`  Cells 80/81 (base, single-agent, Gemini Flash): n=${baselineT0.length}, mean t_first = ${mean(baselineT0).toFixed(2)} (SD ${sd(baselineT0).toFixed(2)})`);
  console.log(`  Cells 82/83 (base + superego, Gemini Flash):     n=${isolationT0.length}, mean t_first = ${mean(isolationT0).toFixed(2)} (SD ${sd(isolationT0).toFixed(2)})`);
  console.log(`  Δ (M2 vs M0) on tutor_first_turn_score: ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} pts`);
  console.log(`  Cohen's d: ${d.toFixed(3)}`);
  console.log(`  Welch's t(${df.toFixed(1)}) = ${t.toFixed(3)}`);
  console.log(`  (secondary: Δ on tutor_overall_score = ${deltaOver >= 0 ? '+' : ''}${deltaOver.toFixed(2)} pts, d = ${dOver.toFixed(3)})`);

  const verdict = (Number.isFinite(d) && Number.isFinite(delta))
    ? (delta >= 9 && d >= 0.8)
      ? 'CONFIRMS residual (Δ ≥ +9 AND d ≥ 0.8 — matches DeepSeek M2-alone d=1.13)'
    : (delta > 0 && d >= 0.3)
      ? 'PARTIAL (superego helps but less than +12.3 inferred residual — soften §6.4.1 language)'
    : (Math.abs(d) < 0.3)
      ? 'RESIDUAL NOT CONFIRMED (factorial-inferred +12.3 was likely statistical noise — §6.4.1 / §7.3 need rewriting)'
    : (delta < 0)
      ? 'INVERSION (prosthesis-style — superego actively hurts Gemini Flash under base)'
    : 'INSUFFICIENT / AMBIGUOUS'
    : 'INSUFFICIENT DATA';

  console.log(`  **Verdict: ${verdict}**`);
  console.log('');
}

console.log(`---`);
console.log(`## Reference: factorial-inferred residual from §6.4.1`);
console.log(`  On Gemini Flash, the A × B interaction yielded an inferred +12.3-point residual`);
console.log(`  architecture benefit under recognition (calibration does not saturate).`);
console.log(`  A11 is the direct test: does M2 alone (no recognition) add >= +9 pts on base Gemini Flash?`);
console.log(`  If yes, the +12.3 residual story is corroborated by direct isolation.`);
console.log(`  If no, the §6.4.1 interaction-based residual was likely a statistical artifact.`);
console.log(`  `);
console.log(`## Reference: DeepSeek M2-alone isolation (run 768ba77b)`);
console.log(`  Δ = +9.2 pts, d = 1.13, p = .002, n=54`);
console.log(`  This is the comparison: does Gemini Flash show a similar-or-larger M2 effect?`);
