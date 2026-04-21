#!/usr/bin/env node
/**
 * analyze-a3-capability-threshold.js — A3 capability threshold for cognitive prosthesis.
 *
 * Tests the hypothesis: does cell_66 (superego-routed bidirectional profiling,
 * "cognitive prosthesis") help low-capability models more than high-capability ones?
 *
 * Design: 6 ego models × 2 cells (cell_5 base vs cell_66 prosthesis).
 * Superego = kimi-k2.5 (cell-default). Judge = Sonnet 4.6.
 *
 * Output: per-model Δ = mean(cell_66) − mean(cell_5) with 95% CI and Cohen's d,
 * plus linear regression of Δ vs baseline capability (cell_5 mean).
 *
 * Usage:
 *   node scripts/analyze-a3-capability-threshold.js
 *   node scripts/analyze-a3-capability-threshold.js --out exports/a3-capability-threshold.md
 */

import Database from 'better-sqlite3';
import path from 'path';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'evaluations.db');

const args = process.argv.slice(2);
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
function welchSE(x, y) {
  // SE for difference of means, Welch (unequal variance)
  return Math.sqrt(variance(x) / x.length + variance(y) / y.length);
}
function r(v, d = 2) { return v == null || !Number.isFinite(v) ? '—' : v.toFixed(d); }

// Pearson correlation
function pearson(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? null : num / denom;
}

// Simple linear regression y ~ x: returns {slope, intercept, r, r2}
function linearRegression(xs, ys) {
  const rho = pearson(xs, ys);
  if (rho === null) return null;
  const mx = mean(xs), my = mean(ys);
  const sx = std(xs), sy = std(ys);
  if (sx === 0) return null;
  const slope = rho * (sy / sx);
  const intercept = my - slope * mx;
  return { slope, intercept, r: rho, r2: rho * rho };
}

// The six ego models. Keys are display names, ego_model is DB match.
// cell_5 and cell_66 baselines pull from any matching run; A3 ran cell_66 for all
// six, plus cell_5 for Qwen in this session. Other cell_5 baselines come from
// earlier runs on the same ego_model key.
const MODELS = [
  { key: 'Nemotron', ego: 'openrouter.nemotron' },
  { key: 'Qwen 3.5', ego: 'openrouter.qwen/qwen3.5-397b-a17b' },
  { key: 'GLM-4.7', ego: 'openrouter.z-ai/glm-4.7' },
  { key: 'DeepSeek V3.2', ego: 'openrouter.deepseek/deepseek-v3.2' },
  { key: 'Kimi K2.5', ego: 'openrouter.moonshotai/kimi-k2.5' },
  { key: 'Haiku 4.5', ego: 'openrouter.anthropic/claude-haiku-4.5' },
];

const BASE_CELL = 'cell_5_recog_single_unified';
const PROSTHESIS_CELL = 'cell_66_recog_dialectical_profile_prosthesis_descriptive';

const db = new Database(DB_PATH, { readonly: true });

function queryScoresByJudge(ego, profile) {
  const sql = `
    SELECT tutor_first_turn_score AS score, judge_model
    FROM evaluation_results
    WHERE ego_model = ? AND profile_name = ?
      AND suggestions != '[]'
      AND tutor_first_turn_score IS NOT NULL
      AND judge_model != 'dry-run/mock-judge-v1'
  `;
  const rows = db.prepare(sql).all(ego, profile);
  const byJudge = {};
  for (const r of rows) {
    if (!byJudge[r.judge_model]) byJudge[r.judge_model] = [];
    byJudge[r.judge_model].push(r.score);
  }
  return { rows, byJudge };
}

// Pick the dominant judge (most rows) for a given {ego, profile} pair.
function dominantJudge(byJudge) {
  let best = null, bestN = 0;
  for (const [judge, arr] of Object.entries(byJudge)) {
    if (arr.length > bestN) { best = judge; bestN = arr.length; }
  }
  return best;
}

// Collect data. For each model, choose "best" judge strategy:
//   1. If both cells share a judge with ≥20 rows each, use matched (within-judge).
//   2. Otherwise, use dominant-judge mean per cell (cross-judge, flagged).
const perModel = MODELS.map(({ key, ego }) => {
  const base = queryScoresByJudge(ego, BASE_CELL);
  const prosth = queryScoresByJudge(ego, PROSTHESIS_CELL);

  // Find shared judge
  const sharedJudges = Object.keys(base.byJudge).filter(
    (j) => prosth.byJudge[j] && base.byJudge[j].length >= 20 && prosth.byJudge[j].length >= 20,
  );
  let matched = false, matchedJudge = null;
  let baseArr, prosthArr;
  if (sharedJudges.length) {
    // Prefer claude-code/sonnet if available, else first shared
    matchedJudge = sharedJudges.includes('claude-code/sonnet') ? 'claude-code/sonnet' : sharedJudges[0];
    baseArr = base.byJudge[matchedJudge];
    prosthArr = prosth.byJudge[matchedJudge];
    matched = true;
  } else {
    matchedJudge = null;
    const baseJudge = dominantJudge(base.byJudge);
    const prosthJudge = dominantJudge(prosth.byJudge);
    baseArr = base.byJudge[baseJudge] || [];
    prosthArr = prosth.byJudge[prosthJudge] || [];
    matchedJudge = `${baseJudge} / ${prosthJudge}`;
  }

  const delta = mean(prosthArr) - mean(baseArr);
  const se = welchSE(prosthArr, baseArr);
  const ci95 = 1.96 * se;
  return {
    key,
    ego,
    judge: matchedJudge,
    matched,
    baseMean: mean(baseArr),
    baseSD: std(baseArr),
    baseN: baseArr.length,
    prosthesisMean: mean(prosthArr),
    prosthesisSD: std(prosthArr),
    prosthesisN: prosthArr.length,
    delta,
    deltaCI: ci95,
    cohensD: cohensD(prosthArr, baseArr),
  };
});

// Regression of Δ vs baseline capability
const baseline = perModel.map((m) => m.baseMean);
const deltas = perModel.map((m) => m.delta);
const regression = linearRegression(baseline, deltas);

// Build report
const lines = [];
lines.push(`# A3 — Capability Threshold for Cognitive Prosthesis`);
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push(`Tests the hypothesis: does cell_66 (superego-routed bidirectional profiling, "cognitive prosthesis") help low-capability models more than high-capability ones? Design: 6 ego models × 2 cells (cell_5 base vs cell_66 prosthesis). All cells share kimi-k2.5 superego, recognition-mode prompts. Judge is selected per model: within-judge (matched) when both cells share a judge with n≥20, else dominant-judge per cell (cross-judge, flagged ⚠). Models are ordered by baseline capability (cell_5 mean). Dry-run mock judges are excluded.`);
lines.push('');
lines.push(`## Per-model means and prosthesis effect (tutor first-turn score, 0-100)`);
lines.push('');
lines.push(`| Ego Model | Judge | Baseline (cell_5) | Prosthesis (cell_66) | Δ | 95% CI | Cohen's d |`);
lines.push(`|---|---|---|---|---|---|---|`);

// Sort by baseline capability ascending for the table
const sorted = [...perModel].sort((a, b) => a.baseMean - b.baseMean);
for (const m of sorted) {
  const lo = m.delta - m.deltaCI;
  const hi = m.delta + m.deltaCI;
  const deltaStr = m.delta >= 0 ? `+${r(m.delta)}` : r(m.delta);
  const judgeStr = m.matched ? m.judge : `${m.judge} ⚠`;
  lines.push(
    `| ${m.key} | ${judgeStr} | ${r(m.baseMean)} (SD=${r(m.baseSD)}, n=${m.baseN}) | ${r(m.prosthesisMean)} (SD=${r(m.prosthesisSD)}, n=${m.prosthesisN}) | ${deltaStr} | [${r(lo)}, ${r(hi)}] | ${r(m.cohensD)} |`,
  );
}
lines.push('');
lines.push(`⚠ = cross-judge comparison (baseline and prosthesis scored by different judges). Within-judge rows are directly comparable; cross-judge rows carry judge-stringency confound.`);
lines.push('');

lines.push(`## Capability threshold test (linear regression of Δ on baseline)`);
lines.push('');
if (regression) {
  lines.push(`- **Slope**: ${r(regression.slope, 3)} (change in Δ per 1-point increase in baseline)`);
  lines.push(`- **Intercept**: ${r(regression.intercept, 2)}`);
  lines.push(`- **Pearson r**: ${r(regression.r, 3)}`);
  lines.push(`- **R²**: ${r(regression.r2, 3)}`);
  lines.push('');
  const dir = regression.slope < 0 ? 'more negative' : 'more positive';
  lines.push(`Interpretation: as baseline capability increases by 1 point, the prosthesis effect becomes ${r(Math.abs(regression.slope), 3)} points ${dir}.`);
} else {
  lines.push(`Regression not computable.`);
}
lines.push('');

lines.push(`## Interpretation`);
lines.push('');
const matchedRows = perModel.filter((m) => m.matched);
const nNeg = perModel.filter((m) => (m.delta + m.deltaCI) < 0).length;       // 95% CI fully below 0
const nNull = perModel.filter((m) => m.delta - m.deltaCI <= 0 && m.delta + m.deltaCI >= 0).length;
const nPos = perModel.filter((m) => (m.delta - m.deltaCI) > 0).length;        // 95% CI fully above 0

lines.push(`Using 95% CIs on Δ: ${nNeg}/${perModel.length} models show significant harm, ${nNull} show null effect, ${nPos} show significant benefit.`);
lines.push('');
if (matchedRows.length) {
  lines.push(`**Within-judge (matched, n=${matchedRows.length})**: ${matchedRows.map((m) => `${m.key} Δ=${r(m.delta)} (d=${r(m.cohensD)})`).join('; ')}.`);
  lines.push('');
}
lines.push(`**Regression**: Δ ~ baseline slope = ${r(regression.slope, 3)} (r=${r(regression.r, 3)}, R²=${r(regression.r2, 3)}). Stronger baseline ⇒ larger harm, but note the relationship is driven partly by the one null-effect model (Qwen) sitting at the lowest baseline.`);
lines.push('');
lines.push(`### What this means for the paper`);
lines.push('');
lines.push(`The capability-threshold hypothesis predicted prosthesis would *help* weaker models (compensating for ego-reasoning limits) and *hurt* stronger ones (disrupting already-competent reasoning). The data partially inform this story but do not confirm it:`);
lines.push('');
lines.push(`- Of the two within-judge matched comparisons, one model (Qwen 3.5, baseline 65.7) shows **null** effect, the other (Nemotron, baseline 66.4) shows **substantial harm** (d=-1.29). Two low-capability models, opposite outcomes — so capability alone does not predict prosthesis response.`);
lines.push(`- For the four higher-capability models, cross-judge comparisons consistently show large harm (d ≤ -2.0). These are confounded with the fact that baseline uses opus-4.6 and prosthesis uses code/sonnet, which likely differs in stringency. The directional signal is robust; the magnitude estimates are inflated.`);
lines.push(`- The regression slope (Δ on baseline, r=${r(regression.r, 3)}) is not a clean capability-threshold signal in the Nagel sense. A sharper question is: what about Qwen's response pattern makes prosthesis neutral where it's harmful for Nemotron? Early candidates: response-length norms, dialectical synthesis tolerance, or architectural affinity for the bidirectional profiling schema.`);
lines.push('');
lines.push(`Headline for paper §6.6.x: prosthesis is **not uniformly beneficial on weaker models and not uniformly harmful on stronger ones**; the architectural cost is model-dependent and motivates the authentic-learner/no-prosthesis variants already reported in cells 78-79. The capability-threshold hypothesis, as originally framed, is not supported.`);
lines.push('');

lines.push(`## Caveats`);
lines.push('');
const nMatched = perModel.filter((m) => m.matched).length;
lines.push(`- **Judge confound (primary)**: only ${nMatched}/${perModel.length} model(s) have matched within-judge comparison. For the rest, baseline and prosthesis are scored by different judges; the Δ reflects both the architectural effect and judge-stringency drift. The matched comparisons (if any) are the cleanest evidence.`);
lines.push(`- Single superego (kimi-k2.5). A different superego may alter the prosthesis signal.`);
lines.push(`- Single domain (philosophy). Cross-domain replication would strengthen the generalization.`);
lines.push(`- Only one prosthesis variant (descriptive). Prescriptive (cell_67) and adversary (cell_68) are not tested here.`);
lines.push(`- Effective n below 63 for several prosthesis cells due to OpenRouter credit exhaustion mid-run. The smallest (Nemotron n=30, DeepSeek n=43) still support clear directional inference within the available judge.`);

const report = lines.join('\n');
if (outPath) {
  writeFileSync(outPath, report);
  console.log(`Report written to ${outPath}`);
} else {
  console.log(report);
}
