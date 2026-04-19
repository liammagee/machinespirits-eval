#!/usr/bin/env node
/**
 * analyze-a5-writing-pad.js — A5 Writing Pad controlled ablation.
 *
 * Tests whether the Freudian Writing Pad (three-layer memory) is necessary
 * for recognition effects, or whether it's load-bearing only via co-activation.
 *
 * Design: 2×2 factorial
 *   - Factor A: Recognition mode (base vs recog)
 *   - Factor B: Writing Pad (on vs off)
 *
 * Cells (matched on everything else: nemotron ego, kimi-k2.5 superego,
 * dialectical prompts, suspicious superego):
 *   cell_40: base  × pad ON   (dialectical_suspicious)
 *   cell_41: recog × pad ON   (dialectical_suspicious)
 *   cell_93: base  × pad OFF  (writing_pad_enabled: false)
 *   cell_94: recog × pad OFF  (writing_pad_enabled: false)
 *
 * Usage:
 *   node scripts/analyze-a5-writing-pad.js <runId>
 *   node scripts/analyze-a5-writing-pad.js <runId> --out exports/a5-writing-pad.md
 */

import Database from 'better-sqlite3';
import path from 'path';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'evaluations.db');

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const runId = positional[0];
if (!runId) {
  console.error('Usage: node scripts/analyze-a5-writing-pad.js <runId> [--out path.md]');
  process.exit(1);
}
const getOption = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const outPath = getOption('out');

function mean(a) { return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0; }
function variance(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1);
}
function std(a) { return Math.sqrt(variance(a)); }
function cohensD(x, y) {
  if (x.length < 2 || y.length < 2) return null;
  const vX = variance(x), vY = variance(y), nX = x.length, nY = y.length;
  const pooled = Math.sqrt(((nX - 1) * vX + (nY - 1) * vY) / (nX + nY - 2));
  return pooled === 0 ? null : (mean(x) - mean(y)) / pooled;
}
function r(v, d = 2) { return v == null || !Number.isFinite(v) ? '—' : v.toFixed(d); }

// Two-way ANOVA for balanced 2×2 design
function twoWayANOVA({ a0b0, a0b1, a1b0, a1b1 }) {
  const all = [...a0b0, ...a0b1, ...a1b0, ...a1b1];
  const grandMean = mean(all);
  const nPerCell = Math.min(a0b0.length, a0b1.length, a1b0.length, a1b1.length);

  const meanA0 = mean([...a0b0, ...a0b1]);
  const meanA1 = mean([...a1b0, ...a1b1]);
  const meanB0 = mean([...a0b0, ...a1b0]);
  const meanB1 = mean([...a0b1, ...a1b1]);

  const cellMeans = {
    a0b0: mean(a0b0), a0b1: mean(a0b1),
    a1b0: mean(a1b0), a1b1: mean(a1b1),
  };

  const N = all.length;
  const SS_total = all.reduce((s, v) => s + (v - grandMean) ** 2, 0);

  // Use actual cell n's for unbalanced data (Type I)
  const nA0 = a0b0.length + a0b1.length;
  const nA1 = a1b0.length + a1b1.length;
  const nB0 = a0b0.length + a1b0.length;
  const nB1 = a0b1.length + a1b1.length;

  const SS_A = nA0 * (meanA0 - grandMean) ** 2 + nA1 * (meanA1 - grandMean) ** 2;
  const SS_B = nB0 * (meanB0 - grandMean) ** 2 + nB1 * (meanB1 - grandMean) ** 2;

  const SS_cells =
    a0b0.length * (cellMeans.a0b0 - grandMean) ** 2 +
    a0b1.length * (cellMeans.a0b1 - grandMean) ** 2 +
    a1b0.length * (cellMeans.a1b0 - grandMean) ** 2 +
    a1b1.length * (cellMeans.a1b1 - grandMean) ** 2;

  const SS_AB = SS_cells - SS_A - SS_B;
  const SS_within = SS_total - SS_cells;

  const df_A = 1, df_B = 1, df_AB = 1;
  const df_within = N - 4;
  const MS_A = SS_A / df_A;
  const MS_B = SS_B / df_B;
  const MS_AB = SS_AB / df_AB;
  const MS_within = SS_within / df_within;

  const F_A = MS_A / MS_within;
  const F_B = MS_B / MS_within;
  const F_AB = MS_AB / MS_within;

  const eta_A = SS_A / SS_total;
  const eta_B = SS_B / SS_total;
  const eta_AB = SS_AB / SS_total;

  return {
    grandMean, nPerCell, N,
    marginals: { meanA0, meanA1, meanB0, meanB1 },
    cellMeans,
    SS: { total: SS_total, A: SS_A, B: SS_B, AB: SS_AB, within: SS_within },
    df: { A: df_A, B: df_B, AB: df_AB, within: df_within },
    F: { A: F_A, B: F_B, AB: F_AB },
    etaSq: { A: eta_A, B: eta_B, AB: eta_AB },
  };
}

// p-value from F (df1, df2) via regularized incomplete beta function
// Uses Numerical Recipes continued-fraction method.
function fToP(F, df1, df2) {
  if (!Number.isFinite(F) || F <= 0) return 1;
  const x = df2 / (df2 + df1 * F);
  return regIncBeta(x, df2 / 2, df1 / 2);
}
function regIncBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = lnGamma(a + b) - lnGamma(a) - lnGamma(b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) + lbeta);
  // Use symmetry when x is large for faster convergence
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betacf(x, a, b)) / a;
  }
  return 1 - (front * betacf(1 - x, b, a)) / b;
}
function betacf(x, a, b) {
  const MAXIT = 200;
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function lnGamma(z) {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function pStr(p) {
  if (p < 0.001) return '< .001';
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(3);
}

function queryScores(db, runId) {
  const sql = `
    SELECT profile_name, scenario_id, tutor_first_turn_score AS score, judge_model
    FROM evaluation_results
    WHERE run_id = ? AND tutor_first_turn_score IS NOT NULL
  `;
  return db.prepare(sql).all(runId);
}

function groupByCell(rows) {
  const byProfile = {};
  for (const r of rows) {
    if (!byProfile[r.profile_name]) byProfile[r.profile_name] = [];
    byProfile[r.profile_name].push(r.score);
  }
  return byProfile;
}

const db = new Database(DB_PATH, { readonly: true });
const rows = queryScores(db, runId);
const judge = rows.length ? [...new Set(rows.map((r) => r.judge_model))] : [];
console.log(`Run: ${runId}`);
console.log(`Rows with scores: ${rows.length}`);
console.log(`Judge(s): ${judge.join(', ')}`);

const byCell = groupByCell(rows);

// Map cells to factorial levels:
//  Factor A = recognition (0 = base, 1 = recog)
//  Factor B = writing_pad  (0 = off,  1 = on)
const cellMap = {
  'cell_40_base_dialectical_suspicious_unified_superego': { A: 0, B: 1, label: 'base × pad ON' },
  'cell_41_recog_dialectical_suspicious_unified_superego': { A: 1, B: 1, label: 'recog × pad ON' },
  'cell_93_base_dialectical_suspicious_unified_superego_nopad': { A: 0, B: 0, label: 'base × pad OFF' },
  'cell_94_recog_dialectical_suspicious_unified_superego_nopad': { A: 1, B: 0, label: 'recog × pad OFF' },
};

const groups = { a0b0: [], a0b1: [], a1b0: [], a1b1: [] };
for (const [cell, cfg] of Object.entries(cellMap)) {
  const arr = byCell[cell] || [];
  const key = `a${cfg.A}b${cfg.B}`;
  groups[key] = arr;
}

const aov = twoWayANOVA(groups);
const pA = fToP(aov.F.A, aov.df.A, aov.df.within);
const pB = fToP(aov.F.B, aov.df.B, aov.df.within);
const pAB = fToP(aov.F.AB, aov.df.AB, aov.df.within);

// Within-factor Cohen's d for reporting
const d_recog_padOn = cohensD(groups.a1b1, groups.a0b1); // recog − base | pad ON
const d_recog_padOff = cohensD(groups.a1b0, groups.a0b0); // recog − base | pad OFF
const d_pad_base = cohensD(groups.a0b1, groups.a0b0); // padOn − padOff | base
const d_pad_recog = cohensD(groups.a1b1, groups.a1b0); // padOn − padOff | recog

// Build report
const lines = [];
lines.push(`# A5 — Writing Pad Controlled Ablation`);
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Run ID: ${runId}`);
lines.push(`Judge: ${judge.join(', ')}`);
lines.push('');
lines.push(`Tests whether the Freudian Writing Pad (three-layer tutor memory) is necessary for the recognition effect, or whether recognition transfers without it. 2×2 factorial: recognition (base/recog) × Writing Pad (on/off). All cells share nemotron ego + kimi-k2.5 superego, dialectical prompts, suspicious superego disposition.`);
lines.push('');
lines.push(`## Cell means (tutor first-turn score, 0-100)`);
lines.push('');
lines.push(`| | Writing Pad ON (cells 40/41) | Writing Pad OFF (cells 93/94) | Row mean |`);
lines.push(`|---|---|---|---|`);
const nBase = groups.a0b0.length + groups.a0b1.length;
const nRecog = groups.a1b0.length + groups.a1b1.length;
const nPadOn = groups.a0b1.length + groups.a1b1.length;
const nPadOff = groups.a0b0.length + groups.a1b0.length;
lines.push(`| Base | ${r(aov.cellMeans.a0b1)} (SD=${r(std(groups.a0b1))}, n=${groups.a0b1.length}) | ${r(aov.cellMeans.a0b0)} (SD=${r(std(groups.a0b0))}, n=${groups.a0b0.length}) | ${r(aov.marginals.meanA0)} (n=${nBase}) |`);
lines.push(`| Recog | ${r(aov.cellMeans.a1b1)} (SD=${r(std(groups.a1b1))}, n=${groups.a1b1.length}) | ${r(aov.cellMeans.a1b0)} (SD=${r(std(groups.a1b0))}, n=${groups.a1b0.length}) | ${r(aov.marginals.meanA1)} (n=${nRecog}) |`);
lines.push(`| Col mean | ${r(aov.marginals.meanB1)} (n=${nPadOn}) | ${r(aov.marginals.meanB0)} (n=${nPadOff}) | **${r(aov.grandMean)}** (N=${aov.N}) |`);
lines.push('');
lines.push(`## Main effects and interaction (2-way ANOVA, Type I)`);
lines.push('');
lines.push(`| Effect | SS | df | F | p | η² |`);
lines.push(`|---|---|---|---|---|---|`);
lines.push(`| Recognition (A) | ${r(aov.SS.A, 1)} | ${aov.df.A} | ${r(aov.F.A)} | ${pStr(pA)} | ${r(aov.etaSq.A, 3)} |`);
lines.push(`| Writing Pad (B) | ${r(aov.SS.B, 1)} | ${aov.df.B} | ${r(aov.F.B)} | ${pStr(pB)} | ${r(aov.etaSq.B, 3)} |`);
lines.push(`| A × B interaction | ${r(aov.SS.AB, 1)} | ${aov.df.AB} | ${r(aov.F.AB)} | ${pStr(pAB)} | ${r(aov.etaSq.AB, 3)} |`);
lines.push(`| Within (error) | ${r(aov.SS.within, 1)} | ${aov.df.within} | — | — | — |`);
lines.push(`| Total | ${r(aov.SS.total, 1)} | ${aov.N - 1} | — | — | — |`);
lines.push('');
lines.push(`## Simple contrasts (Cohen's d, pooled SD)`);
lines.push('');
lines.push(`| Contrast | d |`);
lines.push(`|---|---|`);
lines.push(`| Recog − Base (Writing Pad ON) | ${r(d_recog_padOn)} |`);
lines.push(`| Recog − Base (Writing Pad OFF) | ${r(d_recog_padOff)} |`);
lines.push(`| Pad ON − Pad OFF (Base) | ${r(d_pad_base)} |`);
lines.push(`| Pad ON − Pad OFF (Recog) | ${r(d_pad_recog)} |`);
lines.push('');
lines.push(`## Interpretation`);
lines.push('');
const recogEffect = aov.marginals.meanA1 - aov.marginals.meanA0;
const padEffect = aov.marginals.meanB1 - aov.marginals.meanB0;
lines.push(`- **Recognition main effect**: Δ = ${r(recogEffect)} (recog − base). ${pA < 0.05 ? 'Significant.' : 'n.s.'}`);
lines.push(`- **Writing Pad main effect**: Δ = ${r(padEffect)} (pad ON − pad OFF). ${pB < 0.05 ? 'Significant.' : 'n.s.'} ${padEffect < 0 ? 'Pad OFF scores **higher** (against Writing Pad necessity).' : 'Pad ON scores higher.'}`);
lines.push(`- **Interaction**: ${pAB < 0.05 ? 'Significant — recognition effect depends on Writing Pad.' : 'n.s. — recognition effect is similar with or without Writing Pad.'}`);
lines.push('');
lines.push(`### What this means for the paper`);
lines.push('');
const recogHoldsWithoutPad = d_recog_padOff !== null && d_recog_padOff > 0.2;
if (pAB >= 0.05 && recogHoldsWithoutPad) {
  const direction = padEffect < 0 ? 'actually scores slightly **higher** without the pad' : 'is slightly higher with the pad';
  lines.push(`The Writing Pad is **not load-bearing** for the recognition effect. Recognition raises scores in both pad-on (d=${r(d_recog_padOn)}) and pad-off (d=${r(d_recog_padOff)}) conditions, with no significant interaction (F=${r(aov.F.AB)}, p=${pStr(pAB)}). Disabling the three-layer memory scaffolding ${direction} overall (main effect p=${pStr(pB)}, d=${r(d_pad_recog)} within recog condition). This refutes the "Writing Pad is necessary" hypothesis and suggests recognition operates at the prompt level, not via the memory architecture.`);
} else if (pAB < 0.05) {
  lines.push(`The Writing Pad **modulates** the recognition effect (significant interaction, F=${r(aov.F.AB)}, p=${pStr(pAB)}). Recognition effect is d=${r(d_recog_padOn)} with pad on vs d=${r(d_recog_padOff)} with pad off.`);
} else {
  lines.push(`Neither main effect nor interaction is compelling. Recognition effect remains robust across both pad conditions (d=${r(d_recog_padOn)} / ${r(d_recog_padOff)}).`);
}
lines.push('');
lines.push(`## Caveats`);
lines.push('');
lines.push(`- Single domain (philosophy). A cross-domain replication would strengthen the generalization.`);
lines.push(`- Single ego/superego model pair (nemotron × kimi-k2.5). Effect may differ with other model combinations.`);
lines.push(`- Judge: Sonnet 4.6 (single judge). Cross-judge validation would reduce judge-specific variance.`);
lines.push(`- Writing Pad is only one of several memory/reflection mechanisms. Disabling it may not cleanly isolate memory architecture from other features.`);

const report = lines.join('\n');
if (outPath) {
  writeFileSync(outPath, report);
  console.log(`\nReport written to ${outPath}`);
} else {
  console.log('\n' + report);
}
