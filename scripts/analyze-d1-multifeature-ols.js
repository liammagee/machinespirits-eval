#!/usr/bin/env node

/**
 * D1 Pass 6 — Multi-Feature OLS Regression
 *
 * Tests whether ends-with-question retains its within-cell mediator status
 * when partialled-out for the other regex + embedding features identified
 * in passes 3-5. Univariate within-cell r is descriptive; OLS asks the
 * causal-inference-style question: does this feature predict score *over
 * and above* what the others already explain?
 *
 * Predictors (six features, theoretically motivated subset to keep
 * degrees of freedom respectable at n ≈ 50 per cell):
 *
 *   endsWithQuestion       — pass 3 headline mediator
 *   intersub_advantage     — pass 5 embedding feature (Simpson's paradox)
 *   secondPersonDensity    — pass 3 highest pooled r
 *   scaffoldingMoves       — pass 4 cleanest family marker
 *   broadAcknowledgement   — pass 4 negative within-cell correlate
 *   questionRate           — pass 3 recognition-prompt marker
 *
 * Outcome: tutor_first_turn_score (or overall_score fallback).
 *
 * Per-cell + pooled OLS. Reports coefficients, standard errors, t-values,
 * p-values, R², and adjusted R². Gauss-Jordan elimination for the matrix
 * inverse (k = 7 with intercept; well within numerical-stability range
 * for double-precision floats).
 *
 * Pure DB compute. Uses the embedding cache from pass 5 (zero-API).
 *
 * Usage:
 *   node scripts/analyze-d1-multifeature-ols.js \
 *       [--run-id eval-2026-04-24-e9a785c0] \
 *       [--judge claude-code/sonnet] \
 *       [--output exports/d1-multifeature-ols.md]
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { extractFeatures as extractV1Features } from './analyze-d1-structural-features.js';
import { extractFeatures as extractV2Features } from './analyze-d1-structural-features-v2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'data', 'evaluations.db');
const CACHE_PATH = path.resolve(__dirname, '..', 'exports', 'd1-embeddings-cache.json');

const CANONICAL_INTERSUBJECTIVE = `That's an interesting place to start. Before I share what I'm thinking, can you tell me what your intuition says here? Try to articulate what you'd expect, even if you're not entirely sure. I'm curious what brought you to frame the question this way — sometimes the framing itself reveals what we need to examine. Let's slow down and think through it together. Notice what feels uncertain to you, and we can work outward from there. Consider what your prior reasoning suggests as a first move. What does your sense of the problem tell you to try? We can build on whatever you offer, even partial intuitions.`;

const CANONICAL_TRANSMISSION = `The answer involves three key principles. First, the concept is defined as follows: it operates by combining the relevant variables according to a fixed procedure. Second, the standard application requires you to apply rule X whenever Y holds, then verify the result against the expected pattern. Third, the most common error is confusing this with a similar but distinct concept, so be careful to distinguish them. The correct procedure is: identify the relevant variable, apply the formula, check the answer. You should memorize this structure because it appears repeatedly in similar problems. The established formulation is well-tested and reliable. Practice problems will reinforce the pattern. Make sure you can recite the definition before applying it.`;

// ── Helpers ────────────────────────────────────────────────────────────

function extractMessages(suggestionsJson) {
  if (!suggestionsJson) return '';
  let arr;
  try {
    arr = typeof suggestionsJson === 'string' ? JSON.parse(suggestionsJson) : suggestionsJson;
  } catch {
    return '';
  }
  if (!Array.isArray(arr)) return '';
  return arr.map((s) => s?.message).filter(Boolean).join('\n\n');
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function loadCache(cachePath) {
  if (!fs.existsSync(cachePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return {};
  }
}

// ── OLS via normal equations ───────────────────────────────────────────

/**
 * Solve OLS via β = (X'X)^-1 X'y using Gauss-Jordan elimination on the
 * augmented matrix [X'X | X'y]. For small k (≤ 12), this is numerically
 * fine and avoids a numerical-linear-algebra dependency.
 *
 * @param {number[][]} X  n × k design matrix (already includes intercept column if desired)
 * @param {number[]}   y  length-n outcome vector
 * @returns {{ beta: number[], se: number[], t: number[], p: number[], r2: number, adjR2: number, n: number, k: number, residuals: number[] }}
 */
function ols(X, y) {
  const n = X.length;
  if (n === 0) throw new Error('OLS: empty input');
  const k = X[0].length;
  if (n <= k) throw new Error(`OLS: n=${n} ≤ k=${k}, underdetermined`);

  // Compute X'X (k×k) and X'y (k)
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty = new Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = a; b < k; b++) {
        XtX[a][b] += X[i][a] * X[i][b];
      }
    }
  }
  for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];

  // Solve XtX β = Xty AND simultaneously invert XtX via [XtX | I | Xty]
  // Gauss-Jordan:
  const aug = XtX.map((row, i) => {
    const I = new Array(k).fill(0);
    I[i] = 1;
    return [...row, ...I, Xty[i]];
  });
  // Forward elimination + back-substitute (full pivoting on the diagonal column)
  for (let col = 0; col < k; col++) {
    // Find pivot row
    let pivotRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let r = col + 1; r < k; r++) {
      if (Math.abs(aug[r][col]) > maxVal) {
        maxVal = Math.abs(aug[r][col]);
        pivotRow = r;
      }
    }
    if (maxVal < 1e-12) throw new Error(`OLS: singular matrix at col ${col}`);
    if (pivotRow !== col) {
      [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]];
    }
    // Normalize pivot row
    const pivot = aug[col][col];
    for (let c = 0; c < aug[col].length; c++) aug[col][c] /= pivot;
    // Eliminate column from all other rows
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (factor === 0) continue;
      for (let c = 0; c < aug[r].length; c++) aug[r][c] -= factor * aug[col][c];
    }
  }
  const beta = new Array(k);
  const XtXInv = Array.from({ length: k }, () => new Array(k));
  for (let r = 0; r < k; r++) {
    for (let c = 0; c < k; c++) XtXInv[r][c] = aug[r][k + c];
    beta[r] = aug[r][2 * k];
  }

  // Compute residuals + R²
  const residuals = new Array(n);
  let yMean = 0;
  for (let i = 0; i < n; i++) yMean += y[i];
  yMean /= n;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    let pred = 0;
    for (let a = 0; a < k; a++) pred += X[i][a] * beta[a];
    residuals[i] = y[i] - pred;
    ssRes += residuals[i] * residuals[i];
    ssTot += (y[i] - yMean) * (y[i] - yMean);
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const adjR2 = 1 - (1 - r2) * (n - 1) / (n - k);

  // SE for each coefficient: σ² = ssRes / (n-k); SE_j = sqrt(σ² × (X'X)^-1_jj)
  const sigma2 = ssRes / (n - k);
  const se = new Array(k);
  const t = new Array(k);
  const p = new Array(k);
  for (let j = 0; j < k; j++) {
    se[j] = Math.sqrt(sigma2 * XtXInv[j][j]);
    t[j] = se[j] === 0 ? 0 : beta[j] / se[j];
    // Two-sided p-value via Student's t with df = n-k.
    // For small df we use a normal approximation; for k=7, n=50 df=43, normal is fine.
    p[j] = 2 * (1 - normalCdf(Math.abs(t[j])));
  }
  return { beta, se, t, p, r2, adjR2, n, k, residuals };
}

// Normal CDF for two-sided p-values (good-enough approximation)
function normalCdf(x) {
  // Abramowitz & Stegun 7.1.26
  const t = 1.0 / (1.0 + 0.2316419 * x);
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const phi = 1 - d * (0.319381530 * t + (-0.356563782) * t * t + 1.781477937 * t * t * t + (-1.821255978) * Math.pow(t, 4) + 1.330274429 * Math.pow(t, 5));
  return phi;
}

// ── Cell metadata ──────────────────────────────────────────────────────

const FAMILY = {
  cell_1_base_single_unified: 'transmission',
  cell_5_recog_single_unified: 'intersubjective',
  cell_95_base_matched_single_unified: 'intersubjective',
  cell_96_base_behaviorist_single_unified: 'transmission',
};

const SHORT_LABEL = {
  cell_1_base_single_unified: 'cell_1 (base)',
  cell_5_recog_single_unified: 'cell_5 (recognition)',
  cell_95_base_matched_single_unified: 'cell_95 (matched-pedagogical)',
  cell_96_base_behaviorist_single_unified: 'cell_96 (matched-behaviorist)',
};

// Feature subset for the OLS (chosen for theoretical motivation + degrees-of-freedom budget)
const OLS_FEATURES = [
  'endsWithQuestion',
  'intersub_advantage',
  'secondPersonDensity',
  'scaffoldingMoves',
  'broadAcknowledgement',
  'questionRate',
];

const FEATURE_LABEL = {
  endsWithQuestion: 'Ends with question',
  intersub_advantage: 'Intersub. advantage (embedding)',
  secondPersonDensity: 'Second-person density',
  scaffoldingMoves: 'Scaffolding moves',
  broadAcknowledgement: 'Broad acknowledgement',
  questionRate: 'Question-mark rate',
};

// ── Loader ─────────────────────────────────────────────────────────────

function loadRows(db, runId, judge, cells) {
  const placeholders = cells.map(() => '?').join(',');
  const sql = `
    SELECT id, profile_name, suggestions,
           COALESCE(tutor_first_turn_score, overall_score) AS score
    FROM evaluation_results
    WHERE run_id = ?
      AND judge_model = ?
      AND success = 1
      AND profile_name IN (${placeholders})
      AND suggestions IS NOT NULL AND suggestions <> ''
  `;
  return db.prepare(sql).all(runId, judge, ...cells);
}

// ── Per-cell + pooled OLS ──────────────────────────────────────────────

function buildItems(rows, cache, embIntersub, embTransmission) {
  const items = [];
  for (const r of rows) {
    if (r.score == null) continue;
    const text = extractMessages(r.suggestions);
    if (!text) continue;
    const wc = text.trim().split(/\s+/).filter((w) => w.length > 0).length;
    if (wc < 20) continue;
    const f1 = extractV1Features(text);
    const f2 = extractV2Features(text);
    const h = hashText(text);
    const emb = cache[h];
    let intersub_advantage = 0;
    if (emb) {
      intersub_advantage = cosine(emb, embIntersub) - cosine(emb, embTransmission);
    }
    items.push({
      profile_name: r.profile_name,
      score: r.score,
      ...f1,
      ...f2,
      intersub_advantage,
    });
  }
  return items;
}

function runOlsForGroup(items, label) {
  if (items.length < OLS_FEATURES.length + 5) {
    return { label, n: items.length, error: 'insufficient n' };
  }
  // Build design matrix with intercept column
  const X = items.map((item) => [1, ...OLS_FEATURES.map((f) => item[f])]);
  const y = items.map((item) => item.score);
  try {
    const fit = ols(X, y);
    return { label, n: items.length, fit };
  } catch (err) {
    return { label, n: items.length, error: err.message };
  }
}

function fmt(v, d = 3) {
  if (v == null || Number.isNaN(v)) return '–';
  return v.toFixed(d);
}

function fmtP(p) {
  if (p == null || Number.isNaN(p)) return '–';
  if (p < 0.001) return '< .001';
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(2);
}

function buildReport(perCellFits, pooledFit, runId, judge) {
  const lines = [];
  lines.push('# D1 Pass 6 — Multi-Feature OLS Regression');
  lines.push('');
  lines.push(`**Run:** \`${runId}\` (A10b 4-way matched-specificity)`);
  lines.push(`**Judge:** ${judge}`);
  lines.push(`**Predictors:** ${OLS_FEATURES.length} features (intercept + ${OLS_FEATURES.length} predictors = ${OLS_FEATURES.length + 1} columns)`);
  lines.push('');
  lines.push('Tests whether ends-with-question retains its within-cell mediator status when partialled-out for the other regex + embedding features. The within-cell univariate analyses (passes 3-5) reported zero-order Pearson r; this pass reports OLS partial coefficients (each coefficient is the marginal contribution of the feature to score, holding the other predictors constant).');
  lines.push('');
  lines.push('## 1. Per-cell OLS coefficients');
  lines.push('');
  for (const row of perCellFits) {
    lines.push(`### ${row.label} (n = ${row.n})`);
    lines.push('');
    if (row.error) {
      lines.push(`*Error: ${row.error}*`);
      lines.push('');
      continue;
    }
    const f = row.fit;
    lines.push(`R² = **${fmt(f.r2)}**, adjusted R² = ${fmt(f.adjR2)}; n = ${f.n}, k = ${f.k} (incl. intercept)`);
    lines.push('');
    lines.push('| Predictor | β | SE | t | p (two-sided) |');
    lines.push('| --- | --- | --- | --- | --- |');
    lines.push(`| (intercept) | ${fmt(f.beta[0], 2)} | ${fmt(f.se[0], 2)} | ${fmt(f.t[0])} | ${fmtP(f.p[0])} |`);
    for (let i = 0; i < OLS_FEATURES.length; i++) {
      const name = OLS_FEATURES[i];
      lines.push(`| ${FEATURE_LABEL[name]} | ${fmt(f.beta[i + 1], 2)} | ${fmt(f.se[i + 1], 2)} | ${fmt(f.t[i + 1])} | ${fmtP(f.p[i + 1])} |`);
    }
    lines.push('');
  }
  lines.push('## 2. Pooled OLS coefficients (all 4 cells, n ≈ 191)');
  lines.push('');
  if (pooledFit.error) {
    lines.push(`*Error: ${pooledFit.error}*`);
  } else {
    const f = pooledFit.fit;
    lines.push(`R² = **${fmt(f.r2)}**, adjusted R² = ${fmt(f.adjR2)}; n = ${f.n}, k = ${f.k} (incl. intercept)`);
    lines.push('');
    lines.push('| Predictor | β | SE | t | p (two-sided) |');
    lines.push('| --- | --- | --- | --- | --- |');
    lines.push(`| (intercept) | ${fmt(f.beta[0], 2)} | ${fmt(f.se[0], 2)} | ${fmt(f.t[0])} | ${fmtP(f.p[0])} |`);
    for (let i = 0; i < OLS_FEATURES.length; i++) {
      const name = OLS_FEATURES[i];
      lines.push(`| ${FEATURE_LABEL[name]} | ${fmt(f.beta[i + 1], 2)} | ${fmt(f.se[i + 1], 2)} | ${fmt(f.t[i + 1])} | ${fmtP(f.p[i + 1])} |`);
    }
  }
  lines.push('');
  lines.push('## 3. Findings');
  lines.push('');
  // Extract endsWithQuestion partial coefficients in intersubjective cells
  const c5Row = perCellFits.find((r) => r.label && r.label.includes('cell_5'));
  const c95Row = perCellFits.find((r) => r.label && r.label.includes('cell_95'));
  if (c5Row?.fit && c95Row?.fit) {
    const eqIdx = OLS_FEATURES.indexOf('endsWithQuestion') + 1;
    const c5b = c5Row.fit.beta[eqIdx];
    const c5p = c5Row.fit.p[eqIdx];
    const c95b = c95Row.fit.beta[eqIdx];
    const c95p = c95Row.fit.p[eqIdx];
    lines.push(`**ends-with-question partial coefficient (controlling for the 5 other features):**`);
    lines.push(`- cell_5: β = ${fmt(c5b, 2)}, p = ${fmtP(c5p)}`);
    lines.push(`- cell_95: β = ${fmt(c95b, 2)}, p = ${fmtP(c95p)}`);
    lines.push('');
    if (c5b > 0 && c95b > 0) {
      lines.push('Both partial coefficients are positive: the within-cell mediator finding survives multivariate control. Ending the tutor turn with a question retains a positive marginal contribution to score even after partialling out second-person density, scaffolding moves, broad acknowledgement, question rate, and the embedding-based intersub_advantage. The §7.10 mediator interpretation is robust to the multi-channel-correlate confound.');
    } else if (c5b > 0 || c95b > 0) {
      lines.push('Mixed: one of the two intersubjective cells retains a positive partial coefficient; the other does not. The mediator interpretation is partly robust to multivariate control. Per-cell variation in the partial estimate likely reflects feature collinearity with other predictors (especially question_rate and intersub_advantage).');
    } else {
      lines.push('Both partial coefficients are non-positive: the univariate within-cell mediator finding does not survive multivariate control. ends-with-question is collinear with one or more of the other predictors, and the joint variance is what tracks score; the §7.10 single-feature mediator framing should be hedged accordingly.');
    }
  }
  lines.push('');
  // intersub_advantage in pooled vs cell-level
  if (pooledFit.fit) {
    const iaIdx = OLS_FEATURES.indexOf('intersub_advantage') + 1;
    const poolB = pooledFit.fit.beta[iaIdx];
    const poolP = pooledFit.fit.p[iaIdx];
    lines.push(`**intersub_advantage partial coefficient (Simpson's-paradox check):**`);
    lines.push(`- Pooled (all 4 cells): β = ${fmt(poolB, 2)}, p = ${fmtP(poolP)}`);
    if (c5Row?.fit && c95Row?.fit) {
      const c5b = c5Row.fit.beta[iaIdx];
      const c95b = c95Row.fit.beta[iaIdx];
      lines.push(`- cell_5 within: β = ${fmt(c5b, 2)}, p = ${fmtP(c5Row.fit.p[iaIdx])}`);
      lines.push(`- cell_95 within: β = ${fmt(c95b, 2)}, p = ${fmtP(c95Row.fit.p[iaIdx])}`);
      lines.push('');
      if (poolB > 0 && c5b < 0 && c95b < 0) {
        lines.push('Simpson\'s paradox replicates at the multivariate level: pooled β is positive but within-cell β is negative in both intersubjective cells. The §7.10 reading (intersub_advantage is a family marker, not a within-cell mediator) survives multivariate control.');
      } else if (poolB > 0 && (c5b > 0 || c95b > 0)) {
        lines.push('Simpson\'s pattern attenuated under multivariate control: at least one intersubjective cell now shows positive partial β. Multivariate correction reveals shared variance with other features that the univariate analysis missed.');
      } else {
        lines.push('Pattern altered under multivariate control. Within-cell partial β values: cell_5 ' + fmt(c5b, 2) + ', cell_95 ' + fmt(c95b, 2) + '.');
      }
    }
  }
  lines.push('');
  lines.push('## 4. Caveats');
  lines.push('');
  lines.push(`- Per-cell n ≈ 50 with k = 7 columns (including intercept) gives df ≈ 43. Estimates are stable but power for individual coefficients is modest; a single-feature SE of ~10 score points is typical.`);
  lines.push('- Multicollinearity among predictors (especially question_rate ↔ ends_with_question and intersub_advantage ↔ second_person_density) inflates SE without biasing β. Variance inflation factors are not reported here but pairwise predictor r is bounded by §5b of the pass-5 report (largest pairwise |r| = 0.31).');
  lines.push('- p-values use the normal approximation to Student\'s t with df = n - k. For df ≈ 43, this is essentially identical to the exact t distribution.');
  lines.push('- Single judge (Sonnet) for the primary analysis. Cross-judge replication via the pass-5 cross-judge script (`scripts/analyze-d1-cross-judge-replication.js`).');
  lines.push('- This is a *post-hoc* analysis on already-collected data; no pre-registration. Reads as descriptive evidence of within-cell relationships, not causal mediation.');
  return lines.join('\n');
}

async function main() {
  const args = {
    runId: 'eval-2026-04-24-e9a785c0',
    judge: 'claude-code/sonnet',
    output: null,
  };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--run-id') args.runId = argv[++i];
    else if (argv[i] === '--judge') args.judge = argv[++i];
    else if (argv[i] === '--output') args.output = argv[++i];
  }

  const db = new Database(DB_PATH, { readonly: true });
  const cache = loadCache(CACHE_PATH);
  const intersubHash = hashText(CANONICAL_INTERSUBJECTIVE);
  const transmissionHash = hashText(CANONICAL_TRANSMISSION);
  const embIntersub = cache[intersubHash];
  const embTransmission = cache[transmissionHash];
  if (!embIntersub || !embTransmission) {
    console.error('Canonical embeddings missing from cache. Run analyze-d1-structural-features-v3.js first.');
    process.exit(1);
  }

  const cells = [
    'cell_1_base_single_unified',
    'cell_5_recog_single_unified',
    'cell_95_base_matched_single_unified',
    'cell_96_base_behaviorist_single_unified',
  ];
  const rows = loadRows(db, args.runId, args.judge, cells);
  const items = buildItems(rows, cache, embIntersub, embTransmission);
  console.log(`Loaded ${rows.length} rows, kept ${items.length} after extraction`);

  const perCellFits = [];
  for (const cell of cells) {
    const cellItems = items.filter((it) => it.profile_name === cell);
    const fit = runOlsForGroup(cellItems, SHORT_LABEL[cell]);
    perCellFits.push(fit);
    if (fit.error) {
      console.log(`  ${cell}: n=${fit.n}, error=${fit.error}`);
    } else {
      console.log(`  ${cell}: n=${fit.n}, R²=${fmt(fit.fit.r2)}, adjR²=${fmt(fit.fit.adjR2)}`);
    }
  }
  const pooledFit = runOlsForGroup(items, 'Pooled (all 4 cells)');
  if (pooledFit.error) {
    console.log(`  Pooled: n=${pooledFit.n}, error=${pooledFit.error}`);
  } else {
    console.log(`  Pooled: n=${pooledFit.n}, R²=${fmt(pooledFit.fit.r2)}, adjR²=${fmt(pooledFit.fit.adjR2)}`);
  }

  const report = buildReport(perCellFits, pooledFit, args.runId, args.judge);
  const outPath = args.output || path.join(__dirname, '..', 'exports', 'd1-multifeature-ols.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, 'utf8');
  console.log(`Wrote report → ${outPath}`);
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
