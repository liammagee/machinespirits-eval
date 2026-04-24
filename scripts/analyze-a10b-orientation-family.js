#!/usr/bin/env node
// A10b four-way orientation-family comparison.
// cell_1 (base) / cell_5 (recognition) / cell_95 (matched-pedagogical, Hegelian-family)
//                                      / cell_96 (matched-behaviorist, transmission-family)
//
// Tests whether a matched-specificity prompt grounded in a GENUINELY ORTHOGONAL
// pedagogical family (behaviorism: Skinner/Gagné/Keller/Thorndike/Rosenshine)
// reproduces recognition's effect, or whether the intersubjective-family
// orientation is what matters.
//
// Pre-registration: see notes/design-a10-prompt-density-v22-control.md §6a (orientation-family framing).

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'data/evaluations.db');
const db = new Database(DB_PATH, { readonly: true });

const A10B_RUN_PATTERN = 'A10b%';

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

const a10bRun = db.prepare(`
  SELECT id, description FROM evaluation_runs
  WHERE description LIKE ?
  ORDER BY created_at DESC LIMIT 1
`).get(A10B_RUN_PATTERN);
if (!a10bRun) {
  console.error(`No A10b run found matching "${A10B_RUN_PATTERN}"`);
  process.exit(1);
}

const CELLS = {
  base:         { name: 'cell_1_base_single_unified',          label: 'base (344-line generic)',       family: 'transmission' },
  recog:        { name: 'cell_5_recog_single_unified',         label: 'recognition',                    family: 'Hegelian' },
  matched_ped:  { name: 'cell_95_base_matched_single_unified', label: 'matched-pedagogical (Vygotsky family)', family: 'Hegelian' },
  behaviorist:  { name: 'cell_96_base_behaviorist_single_unified', label: 'matched-behaviorist (Skinner family)',  family: 'transmission' },
};

console.log(`# A10b Four-Way Orientation-Family Comparison — Analysis`);
console.log(`Run: ${a10bRun.id}`);
console.log(`Description: ${a10bRun.description}`);
console.log(`Cells:`);
for (const [key, c] of Object.entries(CELLS)) {
  console.log(`  - ${c.name} (${c.label}, family: ${c.family})`);
}
console.log('');

const judges = db.prepare(`
  SELECT DISTINCT judge_model FROM evaluation_results
  WHERE run_id = ? AND judge_model IS NOT NULL
  ORDER BY judge_model
`).all(a10bRun.id);

for (const { judge_model: judge } of judges) {
  console.log(`## Judge: ${judge}`);

  const data = {};
  for (const [key, c] of Object.entries(CELLS)) {
    const rows = db.prepare(`
      SELECT tutor_first_turn_score, tutor_overall_score
      FROM evaluation_results
      WHERE run_id = ? AND judge_model = ? AND profile_name = ?
        AND tutor_first_turn_score IS NOT NULL
    `).all(a10bRun.id, judge, c.name);
    data[key] = {
      t_first: rows.map(r => r.tutor_first_turn_score).filter(Number.isFinite),
    };
  }

  const any_missing = Object.values(data).some(d => d.t_first.length === 0);
  if (any_missing) {
    console.log(`  n: ${Object.entries(data).map(([k, d]) => `${k}=${d.t_first.length}`).join(', ')}`);
    console.log(`  → skipping: not all cells scored under ${judge}\n`);
    continue;
  }

  // Cell-level means
  console.log(`  Cell-level means (t_first, 0-100 scale):`);
  for (const [key, d] of Object.entries(data)) {
    const c = CELLS[key];
    console.log(`    ${c.name.padEnd(45)} n=${d.t_first.length.toString().padStart(3)}, M=${mean(d.t_first).toFixed(2)} (SD ${sd(d.t_first).toFixed(2)})   [${c.family}]`);
  }

  // Within-family contrasts
  console.log(`\n  Within-family contrasts:`);
  const d_heg_internal = cohenD(data.recog.t_first, data.matched_ped.t_first);
  const delta_heg = mean(data.recog.t_first) - mean(data.matched_ped.t_first);
  const d_trans_internal = cohenD(data.base.t_first, data.behaviorist.t_first);
  const delta_trans = mean(data.base.t_first) - mean(data.behaviorist.t_first);
  console.log(`    Hegelian:     recog vs matched-ped:        Δ=${delta_heg >= 0 ? '+' : ''}${delta_heg.toFixed(2)}, d=${d_heg_internal.toFixed(3)}`);
  console.log(`    Transmission: base  vs matched-behaviorist: Δ=${delta_trans >= 0 ? '+' : ''}${delta_trans.toFixed(2)}, d=${d_trans_internal.toFixed(3)}`);

  // Between-family contrast
  const hegelian_all = [...data.recog.t_first, ...data.matched_ped.t_first];
  const transmission_all = [...data.base.t_first, ...data.behaviorist.t_first];
  const d_between = cohenD(hegelian_all, transmission_all);
  const delta_between = mean(hegelian_all) - mean(transmission_all);
  const w_between = welchT(hegelian_all, transmission_all);
  console.log(`\n  Between-family contrast:`);
  console.log(`    Hegelian-mean (${mean(hegelian_all).toFixed(2)}) vs Transmission-mean (${mean(transmission_all).toFixed(2)}): Δ=${delta_between >= 0 ? '+' : ''}${delta_between.toFixed(2)}, d=${d_between.toFixed(3)}, Welch's t(${w_between.df.toFixed(1)})=${w_between.t.toFixed(3)}`);

  // Pairwise full matrix
  console.log(`\n  Full pairwise contrast matrix (t_first):`);
  const keys = ['base', 'behaviorist', 'matched_ped', 'recog'];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = data[keys[i]].t_first, b = data[keys[j]].t_first;
      const delta = mean(b) - mean(a);
      const d = cohenD(b, a);
      console.log(`    ${CELLS[keys[j]].name} vs ${CELLS[keys[i]].name}: Δ=${delta >= 0 ? '+' : ''}${delta.toFixed(2)}, d=${d.toFixed(3)}`);
    }
  }

  // Verdict
  console.log(`\n  **Verdict under ${judge}**:`);
  if (Math.abs(d_heg_internal) < 0.2) {
    console.log(`    - Hegelian-family density-sufficient (recog ≈ matched-pedagogical, |d| < 0.2)`);
  } else {
    console.log(`    - Hegelian-family: small residual recognition edge (|d| = ${Math.abs(d_heg_internal).toFixed(2)})`);
  }
  if (d_trans_internal > 0) {
    console.log(`    - Transmission-family: base > behaviorist by d=${d_trans_internal.toFixed(2)} — density HURTS when orientation is wrong`);
  } else {
    console.log(`    - Transmission-family: behaviorist >= base`);
  }
  if (d_between > 0.8) {
    console.log(`    - Between-family gap (d=${d_between.toFixed(2)}) is LARGE — orientation family is the dominant effect`);
  } else if (d_between > 0.3) {
    console.log(`    - Between-family gap (d=${d_between.toFixed(2)}) is moderate`);
  } else {
    console.log(`    - Between-family gap (d=${d_between.toFixed(2)}) is small`);
  }
  console.log('');
}

console.log(`---`);
console.log(`## Reference: A10 v2 three-judge final (eval-2026-04-23-42e7acbe)`);
console.log(`  recog vs matched-ped: Sonnet d=0.22, Opus d=0.23, GPT d=0.05, pooled d=0.17`);
console.log(`  Pooled reading: density-sufficient within Hegelian family. A10b tests the orientation-family confound.`);
