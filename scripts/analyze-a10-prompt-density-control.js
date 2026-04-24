#!/usr/bin/env node
// A10 matched-specificity prompt-density control under v2.2.
// Tests whether recognition's effect is reducible to prompt density/specificity
// rather than content. Compares:
//   - cell_1_base_single_unified (base, 344-line generic pedagogical prompt)
//   - cell_5_recog_single_unified (recognition, ~2,810-word Hegelian prompt)
//   - cell_95_base_matched_single_unified (NEW: matched-specificity, ~2,835-word
//     pedagogical prompt grounded in Piaget/Vygotsky/Bloom/VanLehn/Kapur/Chi/Graesser
//     with zero recognition/Hegelian content)
// Pre-registration: see notes/design-a10-prompt-density-v22-control.md §7.
//
// Usage:
//   node scripts/analyze-a10-prompt-density-control.js

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'data/evaluations.db');
const db = new Database(DB_PATH, { readonly: true });

// Match A10 v2 explicitly (not v1, which was invalidated by bug_007).
// Pattern matches descriptions starting with "A10 v2" or "A10 v2." etc.
const A10_RUN_PATTERN = 'A10 v2%';

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

const a10Run = db.prepare(`
  SELECT id, description FROM evaluation_runs
  WHERE description LIKE ?
  ORDER BY created_at DESC LIMIT 1
`).get(A10_RUN_PATTERN);
if (!a10Run) {
  console.error(`No A10 run found matching "${A10_RUN_PATTERN}"`);
  process.exit(1);
}

console.log(`# A10 Matched-Specificity Prompt-Density Control — Analysis`);
console.log(`Run: ${a10Run.id}`);
console.log(`Primary contrast: cell_95 (matched-pedagogical) vs cell_5 (recognition)`);
console.log(`Secondary anchors: cell_1 (base, standard 344-line prompt)`);
console.log('');

const judges = db.prepare(`
  SELECT DISTINCT judge_model FROM evaluation_results
  WHERE run_id = ? AND judge_model IS NOT NULL
  ORDER BY judge_model
`).all(a10Run.id);

for (const { judge_model: judge } of judges) {
  console.log(`## Judge: ${judge}`);

  const cellData = {};
  for (const cell of [
    'cell_1_base_single_unified',
    'cell_5_recog_single_unified',
    'cell_95_base_matched_single_unified',
  ]) {
    const rows = db.prepare(`
      SELECT tutor_first_turn_score, tutor_overall_score
      FROM evaluation_results
      WHERE run_id = ? AND judge_model = ? AND profile_name = ?
        AND tutor_first_turn_score IS NOT NULL
    `).all(a10Run.id, judge, cell);
    cellData[cell] = {
      t_first: rows.map(r => r.tutor_first_turn_score).filter(Number.isFinite),
      t_overall: rows.map(r => r.tutor_overall_score).filter(Number.isFinite),
    };
  }

  const c1 = cellData.cell_1_base_single_unified;
  const c5 = cellData.cell_5_recog_single_unified;
  const c95 = cellData.cell_95_base_matched_single_unified;

  if (c1.t_first.length === 0 || c5.t_first.length === 0 || c95.t_first.length === 0) {
    console.log(`  n: cell_1=${c1.t_first.length}, cell_5=${c5.t_first.length}, cell_95=${c95.t_first.length}`);
    console.log(`  → skipping: need all three cells scored under ${judge}\n`);
    continue;
  }

  // Cell-level means.
  console.log(`  tutor_first_turn_score (0-100 scale):`);
  console.log(`    cell_1  (base, 344-line generic):   n=${c1.t_first.length}, M=${mean(c1.t_first).toFixed(2)} (SD ${sd(c1.t_first).toFixed(2)})`);
  console.log(`    cell_95 (matched-pedagogical):      n=${c95.t_first.length}, M=${mean(c95.t_first).toFixed(2)} (SD ${sd(c95.t_first).toFixed(2)})`);
  console.log(`    cell_5  (recognition):              n=${c5.t_first.length}, M=${mean(c5.t_first).toFixed(2)} (SD ${sd(c5.t_first).toFixed(2)})`);

  // Primary contrasts.
  const d_5_vs_95 = cohenD(c5.t_first, c95.t_first);
  const delta_5_vs_95 = mean(c5.t_first) - mean(c95.t_first);
  const d_95_vs_1 = cohenD(c95.t_first, c1.t_first);
  const delta_95_vs_1 = mean(c95.t_first) - mean(c1.t_first);
  const d_5_vs_1 = cohenD(c5.t_first, c1.t_first);
  const delta_5_vs_1 = mean(c5.t_first) - mean(c1.t_first);

  const w_5_vs_95 = welchT(c5.t_first, c95.t_first);

  console.log(`  Contrasts (t_first):`);
  console.log(`    recog vs base        (5 vs 1):  Δ=${(delta_5_vs_1 >= 0 ? '+' : '')}${delta_5_vs_1.toFixed(2)}, d=${d_5_vs_1.toFixed(3)}`);
  console.log(`    matched vs base     (95 vs 1):  Δ=${(delta_95_vs_1 >= 0 ? '+' : '')}${delta_95_vs_1.toFixed(2)}, d=${d_95_vs_1.toFixed(3)}`);
  console.log(`    recog vs matched    (5 vs 95):  Δ=${(delta_5_vs_95 >= 0 ? '+' : '')}${delta_5_vs_95.toFixed(2)}, d=${d_5_vs_95.toFixed(3)}, Welch's t(${w_5_vs_95.df.toFixed(1)})=${w_5_vs_95.t.toFixed(3)}`);

  // Pre-registered decision grid (§7 of design note).
  const m1 = mean(c1.t_first), m5 = mean(c5.t_first), m95 = mean(c95.t_first);
  let verdict;
  if (m5 > m95 && m95 > m1 && d_5_vs_95 >= 0.5) {
    verdict = 'RECOG > MATCHED > BASE (d ≥ 0.5). Density helps, recognition content adds further. **§7.9 stands, strengthened.**';
  } else if (Math.abs(d_5_vs_95) < 0.2 && m95 > m1 && m5 > m1) {
    verdict = 'MATCHED ≈ RECOG, both > BASE. Density is sufficient; recognition content adds nothing. **§7.9 content-over-density claim must be RETRACTED.**';
  } else if (m95 > m5) {
    verdict = 'MATCHED > RECOG. Paradigm failure — pedagogical specificity without recognition outperforms recognition. **Major revision required.**';
  } else if (m95 < m1) {
    verdict = 'MATCHED < BASE. Density is counterproductive (matches Paper 1.0 Haiku pattern). §7.9 strengthened differently (density alone hurts).';
  } else if (d_5_vs_95 > 0.2 && d_5_vs_95 < 0.5) {
    verdict = 'PARTIAL (d in 0.2-0.5 band): recognition > matched but below threshold for strong claim. Report as weak support for content-over-density.';
  } else {
    verdict = 'AMBIGUOUS — manual inspection needed.';
  }
  console.log(`  **Verdict: ${verdict}**`);

  // Secondary: overall score.
  const d_5_vs_95_over = cohenD(c5.t_overall, c95.t_overall);
  const delta_5_vs_95_over = mean(c5.t_overall) - mean(c95.t_overall);
  console.log(`  (secondary: recog vs matched on t_overall: Δ=${(delta_5_vs_95_over >= 0 ? '+' : '')}${delta_5_vs_95_over.toFixed(2)}, d=${d_5_vs_95_over.toFixed(3)})`);
  console.log('');
}

console.log(`---`);
console.log(`## Reference points`);
console.log(`  Paper 2.0 main factorial recognition effect: Sonnet d ≈ 1.88, pooled d ≈ 1.63 (§8.3)`);
console.log(`  Paper 1.0 Kimi placebo (cells 15-18, v1.0 rubric): placebo below base`);
console.log(`  Paper 1.0 Haiku naive-vs-elaborate: naive 35-line > 344-line base on Haiku (+6.8 pts)`);
console.log(`  §7.9 autotuning: recognition/base gap widens under optimisation; optimised base ceiling < unoptimised recognition`);
