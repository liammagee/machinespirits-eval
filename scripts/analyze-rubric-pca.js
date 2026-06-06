#!/usr/bin/env node
/**
 * Rubric dimension-independence PCA reproduction (§5.2.1 + §8.6).
 *
 * The paper reports, in TWO places, that the tutor rubric's per-dimension
 * scores collapse onto largely one factor:
 *
 *   §8.6  (line ~2819): "PCA on 1,584 per-turn observations ... the 8 dimensions
 *         largely measure a single construct: PC1 explains 80.7% of variance ...
 *         KMO = 0.938 ... mean inter-dimension correlation is r=0.776 (range
 *         0.589--0.921) ... Forced two-factor varimax rotation separates
 *         content_accuracy (loading 0.923 on Factor 2) from the seven
 *         pedagogical dimensions (loadings 0.68--0.85 on Factor 1)."
 *
 *   §5.2.1 (line ~476): the SAME statistics (1,584 obs, PC1=80.7%, KMO=0.938,
 *         r=0.776) but described as "across the 14 dimensions" — which cannot be
 *         literally true, since identical PCA statistics cannot hold for both a
 *         14-variable and an 8-variable analysis on the same observations. The
 *         numbers are the v2.2 8-dimension PCA; §5.2.1 borrowed them under a
 *         "14 dimensions" label. This script reproduces the 8-dim analysis from
 *         the live DB to settle which dimension count the numbers belong to, and
 *         can be re-pointed at the pre-v2.2 backup to compute the genuine 14-dim
 *         v1.0 redundancy figures separately.
 *
 * No committed script previously computed any of these values. This closes that
 * provenance gap. Read-only; no API calls; no new dependencies (the PCA, KMO and
 * varimax numerics are implemented here from the correlation matrix).
 *
 * Method:
 *   1. Pull the slice (default: the two cross-model recognition runs aea2abfb +
 *      45163390 under the Sonnet judge — the only run-set whose per-turn tutor
 *      score objects total exactly 1,584).
 *   2. Parse each row's per-turn dimension scores into observation vectors:
 *      tutor_scores is turn-keyed ({"4":{"scores":{dim:{score}}}}); the backup's
 *      scores_with_reasoning is a single flat {dim:{score}} per row.
 *   3. Pearson correlation matrix over the D dimensions; mean + range of the
 *      off-diagonal; Jacobi eigendecomposition -> PC1 share, Kaiser count;
 *      KMO from the inverse correlation matrix; closed-form 2-factor varimax.
 *   4. Condition (factor_recognition) and per-run breakdowns of PC1.
 *   5. Per-turn vs holistic correlation under several definitions (the §5.2
 *      "r=0.907 between per-turn and holistic" claim).
 *
 * Usage:
 *   node scripts/analyze-rubric-pca.js
 *   node scripts/analyze-rubric-pca.js --runs eval-2026-03-01-aea2abfb,eval-2026-03-02-45163390 --judge claude-code/sonnet
 *   node scripts/analyze-rubric-pca.js --db ~/.machinespirits-data/backups/2026-02-25-pre-dialogue-scoring/evaluations.db \
 *        --score-source scores_with_reasoning --judge claude-opus-4.6        # genuine v1.0 14-dim
 *   node scripts/analyze-rubric-pca.js --json
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function getOption(name, fallback) {
  const flag = `--${name}`;
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  return fallback;
}
function expandHome(p) {
  return p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

const DB_PATH = expandHome(getOption('db', process.env.EVAL_DB_PATH || path.join(ROOT, 'data', 'evaluations.db')));
const RUNS = getOption('runs', 'eval-2026-03-01-aea2abfb,eval-2026-03-02-45163390')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const JUDGE = getOption('judge', 'claude-code/sonnet');
const SCORE_SOURCE = getOption('score-source', 'tutor_scores'); // or scores_with_reasoning
const JSON_OUT = process.argv.includes('--json');

// Friendly labels for the per-run breakdown.
const RUN_LABELS = {
  'eval-2026-03-01-aea2abfb': 'DeepSeek',
  'eval-2026-03-02-45163390': 'Haiku',
  'eval-2026-03-02-18027efc': 'Gemini Flash',
};

// ── linear-algebra primitives (no deps) ─────────────────────────────────────
function pearson(xs, ys) {
  const n = xs.length;
  let sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0,
    sxy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i],
      y = ys[i];
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const cov = n * sxy - sx * sy;
  const vx = n * sxx - sx * sx;
  const vy = n * syy - sy * sy;
  return vx === 0 || vy === 0 ? 0 : cov / Math.sqrt(vx * vy);
}

/** Correlation matrix over D column-vectors (each length N). */
function corrMatrix(cols) {
  const D = cols.length;
  const M = Array.from({ length: D }, () => new Array(D).fill(0));
  for (let i = 0; i < D; i++) {
    for (let j = i; j < D; j++) {
      const r = i === j ? 1 : pearson(cols[i], cols[j]);
      M[i][j] = r;
      M[j][i] = r;
    }
  }
  return M;
}

/** Jacobi eigendecomposition of a symmetric matrix. Returns eigenvalues
 *  (desc) and matching eigenvectors (vectors[k] = vector for values[k]). */
function jacobiEigen(Ain) {
  const n = Ain.length;
  const A = Ain.map((r) => r.slice());
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let iter = 0; iter < 200; iter++) {
    let p = 0,
      q = 1,
      max = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[i][j]) > max) {
          max = Math.abs(A[i][j]);
          p = i;
          q = j;
        }
      }
    }
    if (max < 1e-14) break;
    const phi = 0.5 * Math.atan2(2 * A[p][q], A[p][p] - A[q][q]);
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    for (let k = 0; k < n; k++) {
      const akp = A[k][p],
        akq = A[k][q];
      A[k][p] = c * akp + s * akq;
      A[k][q] = -s * akp + c * akq;
    }
    for (let k = 0; k < n; k++) {
      const apk = A[p][k],
        aqk = A[q][k];
      A[p][k] = c * apk + s * aqk;
      A[q][k] = -s * apk + c * aqk;
    }
    for (let k = 0; k < n; k++) {
      const vkp = V[k][p],
        vkq = V[k][q];
      V[k][p] = c * vkp + s * vkq;
      V[k][q] = -s * vkp + c * vkq;
    }
  }
  const raw = A.map((_, i) => A[i][i]);
  const order = raw.map((v, i) => i).sort((a, b) => raw[b] - raw[a]);
  return {
    values: order.map((i) => raw[i]),
    vectors: order.map((i) => V.map((row) => row[i])),
  };
}

/** Inverse of a square matrix via Gauss-Jordan with partial pivoting. */
function inverse(M) {
  const n = M.length;
  const A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[col], A[piv]] = [A[piv], A[col]];
    const d = A[col][col];
    for (let j = 0; j < 2 * n; j++) A[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[col][j];
    }
  }
  return A.map((r) => r.slice(n));
}

/** Kaiser-Meyer-Olkin overall sampling adequacy. */
function kmo(R) {
  const n = R.length;
  const Rinv = inverse(R);
  let sumR2 = 0,
    sumP2 = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      sumR2 += R[i][j] * R[i][j];
      const p = -Rinv[i][j] / Math.sqrt(Rinv[i][i] * Rinv[j][j]);
      sumP2 += p * p;
    }
  }
  return sumR2 / (sumR2 + sumP2);
}

/** Closed-form 2-factor varimax (Kaiser-normalised). loadings: [[a,b],...]. */
function varimax2(loadings) {
  const n = loadings.length;
  const h = loadings.map(([a, b]) => Math.sqrt(a * a + b * b) || 1);
  const Ln = loadings.map(([a, b], i) => [a / h[i], b / h[i]]);
  const u = Ln.map(([a, b]) => a * a - b * b);
  const v = Ln.map(([a, b]) => 2 * a * b);
  const su = u.reduce((x, y) => x + y, 0);
  const sv = v.reduce((x, y) => x + y, 0);
  let C = 0,
    D = 0;
  for (let i = 0; i < n; i++) {
    C += u[i] * u[i] - v[i] * v[i];
    D += 2 * u[i] * v[i];
  }
  const num = D - (2 * su * sv) / n;
  const den = C - (su * su - sv * sv) / n;
  const phi = 0.25 * Math.atan2(num, den);
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  // rotate the de-normalised loadings
  return loadings.map(([a, b]) => [a * c + b * s, -a * s + b * c]);
}

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// ── PCA bundle for one set of observation vectors ───────────────────────────
/** obs: array of dimension-keyed score objects {dim: number}. dims: ordered keys. */
function pcaBundle(obs, dims) {
  const cols = dims.map((d) => obs.map((o) => o[d]));
  const R = corrMatrix(cols);
  const D = dims.length;
  const off = [];
  for (let i = 0; i < D; i++) for (let j = i + 1; j < D; j++) off.push(R[i][j]);
  const { values, vectors } = jacobiEigen(R);
  const total = values.reduce((a, b) => a + b, 0);
  const loadings = obs.length
    ? dims.map((_, i) => [vectors[0][i] * Math.sqrt(values[0]), vectors[1][i] * Math.sqrt(values[1])])
    : [];
  const rot = obs.length ? varimax2(loadings) : [];
  return {
    n: obs.length,
    dims,
    pc1_share: values[0] / total,
    eigenvalues: values,
    kaiser_count: values.filter((v) => v > 1).length,
    mean_interdim_r: mean(off),
    interdim_range: [Math.min(...off), Math.max(...off)],
    kmo: kmo(R),
    corr: R,
    rotated_loadings: rot.map((l, i) => ({ dim: dims[i], factor1: l[0], factor2: l[1] })),
  };
}

// ── extract observations from a DB row's score object ───────────────────────
function turnVectors(scoreJson, source) {
  // Returns an array of {dim: number} observation objects from one DB row.
  let parsed;
  try {
    parsed = JSON.parse(scoreJson);
  } catch {
    return [];
  }
  const out = [];
  const pushFromScores = (scores) => {
    if (!scores || typeof scores !== 'object') return;
    const vec = {};
    for (const [dim, v] of Object.entries(scores)) {
      const score = v && typeof v === 'object' ? v.score : v;
      if (typeof score === 'number') vec[dim] = score;
    }
    if (Object.keys(vec).length) out.push(vec);
  };
  if (source === 'tutor_scores') {
    // turn-keyed: {"4": {"scores": {...}}, ...}
    for (const turn of Object.values(parsed)) {
      pushFromScores(turn && turn.scores ? turn.scores : turn);
    }
  } else {
    // scores_with_reasoning: flat {dim: {score, reasoning}} for one response
    pushFromScores(parsed);
  }
  return out;
}

// ── load slice ──────────────────────────────────────────────────────────────
const db = new Database(DB_PATH, { readonly: true });
// The per-turn-vs-holistic columns differ by schema: v2.2 uses tutor_overall_score /
// tutor_holistic_overall_score; the pre-v2.2 (v1.0) backup uses overall_score /
// holistic_overall_score. Detect which exist so the same script runs on either DB.
const haveCols = new Set(
  db
    .prepare(`PRAGMA table_info(evaluation_results)`)
    .all()
    .map((c) => c.name),
);
const PER_TURN_COL = ['tutor_overall_score', 'overall_score'].find((c) => haveCols.has(c)) || null;
const HOLISTIC_COL = ['tutor_holistic_overall_score', 'holistic_overall_score'].find((c) => haveCols.has(c)) || null;
const perTurnSel = PER_TURN_COL ? `${PER_TURN_COL} AS per_turn_agg` : `NULL AS per_turn_agg`;
const holisticSel = HOLISTIC_COL ? `${HOLISTIC_COL} AS holistic` : `NULL AS holistic`;
const runFilter = RUNS.length ? `AND run_id IN (${RUNS.map(() => '?').join(',')})` : '';
const rows = db
  .prepare(
    `SELECT id, run_id, factor_recognition AS rec, ${SCORE_SOURCE} AS scores,
            ${perTurnSel}, ${holisticSel}
     FROM evaluation_results
     WHERE judge_model = ? AND ${SCORE_SOURCE} IS NOT NULL AND ${SCORE_SOURCE} != '' ${runFilter}`,
  )
  .all(JUDGE, ...RUNS);
db.close();

if (!rows.length) {
  console.error(`No rows for judge=${JUDGE}, runs=[${RUNS.join(', ')}], source=${SCORE_SOURCE} in ${DB_PATH}`);
  process.exit(1);
}

// Build observation list, tagged with condition + run for breakdowns.
const all = [];
for (const row of rows) {
  for (const vec of turnVectors(row.scores, SCORE_SOURCE)) {
    all.push({ vec, rec: row.rec, run: row.run_id });
  }
}

// Dimensions = keys present in at least DIM_MIN_FRAC of observations, then a
// complete-case filter on exactly those dims. On the v2.2 DB every dimension is
// present in 100% of rows, so this reduces to "all 8 dims, all 1,584 rows". On
// the pre-v2.2 backup the corpus spans rubric sub-versions (some rows carry 12 or
// 13 dims); the default 0.9 threshold keeps the full 14-dim set (each present in
// >=95% of rows) and restricts to the 4,844 rows scored on all 14 — a clean
// 14-dim slice — instead of silently dropping to the 11-dim intersection.
const DIM_MIN_FRAC = Number(getOption('dim-min-frac', '0.9'));
const dimCounts = new Map();
for (const o of all) for (const d of Object.keys(o.vec)) dimCounts.set(d, (dimCounts.get(d) || 0) + 1);
const dims = [...dimCounts.entries()]
  .filter(([, c]) => c >= DIM_MIN_FRAC * all.length)
  .map(([d]) => d)
  .sort();
const complete = all.filter((o) => dims.every((d) => d in o.vec));

const overall = pcaBundle(
  complete.map((o) => o.vec),
  dims,
);

// Condition breakdown.
const byCond = {};
for (const key of ['0', '1']) {
  const sub = complete.filter((o) => String(o.rec) === key);
  if (sub.length)
    byCond[key === '1' ? 'recognition' : 'base'] = pcaBundle(
      sub.map((o) => o.vec),
      dims,
    ).pc1_share;
}
// Per-run breakdown.
const byRun = {};
for (const run of RUNS) {
  const sub = complete.filter((o) => o.run === run);
  if (sub.length)
    byRun[RUN_LABELS[run] || run] = {
      n: sub.length,
      pc1: pcaBundle(
        sub.map((o) => o.vec),
        dims,
      ).pc1_share,
    };
}

// Per-turn vs holistic correlation — several candidate definitions.
const dialoguePairs = rows
  .filter((r) => r.per_turn_agg != null && r.holistic != null)
  .map((r) => [r.per_turn_agg, r.holistic]);
const perTurnHolistic = {
  dialogue_level_overall_vs_holistic: dialoguePairs.length
    ? {
        n: dialoguePairs.length,
        r: pearson(
          dialoguePairs.map((p) => p[0]),
          dialoguePairs.map((p) => p[1]),
        ),
      }
    : null,
};

// ── report ──────────────────────────────────────────────────────────────────
const fmt = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');
const pct = (x) => (Number.isFinite(x) ? (x * 100).toFixed(1) + '%' : 'n/a');

const result = {
  db: DB_PATH.replace(os.homedir(), '~'),
  judge: JUDGE,
  runs: RUNS,
  score_source: SCORE_SOURCE,
  n_observations: overall.n,
  n_dimensions: dims.length,
  dimensions: dims,
  pc1_share: overall.pc1_share,
  kaiser_count: overall.kaiser_count,
  mean_interdim_r: overall.mean_interdim_r,
  interdim_range: overall.interdim_range,
  kmo: overall.kmo,
  eigenvalues: overall.eigenvalues,
  pc1_by_condition: byCond,
  pc1_by_run: byRun,
  rotated_loadings: overall.rotated_loadings,
  per_turn_vs_holistic: perTurnHolistic,
};

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const L = [];
L.push(`# Rubric dimension-independence PCA reproduction (§5.2.1 + §8.6)`);
L.push('');
L.push(`DB: \`${result.db}\`  ·  judge: ${JUDGE}  ·  source: \`${SCORE_SOURCE}\``);
L.push(`Runs: ${RUNS.map((r) => RUN_LABELS[r] || r).join(' + ')}`);
L.push(`Observations: **${overall.n} per-turn** across **${dims.length} dimensions**.`);
L.push('');
L.push(`## Primary statistics vs paper (§8.6 / §5.2.1)`);
L.push('');
L.push(`| Quantity | Paper | Reproduced |`);
L.push(`|---|---|---|`);
L.push(`| N per-turn observations | 1,584 | ${overall.n} |`);
L.push(`| dimension count | 8 (§8.6) / "14" (§5.2.1) | ${dims.length} |`);
L.push(`| PC1 variance share | 80.7% | ${pct(overall.pc1_share)} |`);
L.push(`| Kaiser eigenvalues >1 | 1 | ${overall.kaiser_count} |`);
L.push(`| mean inter-dimension r | 0.776 | ${fmt(overall.mean_interdim_r)} |`);
L.push(
  `| inter-dimension range | 0.589--0.921 | ${fmt(overall.interdim_range[0])}--${fmt(overall.interdim_range[1])} |`,
);
L.push(`| KMO | 0.938 | ${fmt(overall.kmo)} |`);
L.push('');
L.push(`Eigenvalues: ${overall.eigenvalues.map((v) => fmt(v, 2)).join(', ')}`);
L.push('');
L.push(`## PC1 share by condition (paper: base 80.2%, recognition 75.6%)`);
L.push('');
for (const [k, v] of Object.entries(byCond)) L.push(`- ${k}: ${pct(v)}`);
L.push('');
L.push(`## PC1 share by model (paper: DeepSeek 77.3%, Haiku 68.0%)`);
L.push('');
for (const [k, v] of Object.entries(byRun)) L.push(`- ${k} (n=${v.n}): ${pct(v.pc1)}`);
L.push('');
L.push(`## Two-factor varimax loadings (paper: content_accuracy 0.923 on F2; 7 pedagogical 0.68--0.85 on F1)`);
L.push('');
L.push(`| dimension | Factor 1 | Factor 2 |`);
L.push(`|---|---|---|`);
for (const r of overall.rotated_loadings) L.push(`| ${r.dim} | ${fmt(r.factor1)} | ${fmt(r.factor2)} |`);
L.push('');
L.push(`## Per-turn vs holistic correlation (paper §5.2: r=0.907)`);
L.push('');
const pth = perTurnHolistic.dialogue_level_overall_vs_holistic;
L.push(
  pth
    ? `- dialogue-level \`${PER_TURN_COL}\` vs \`${HOLISTIC_COL}\`: r=${fmt(pth.r)} (n=${pth.n})`
    : `- (no holistic scores in this slice)`,
);
L.push('');

const report = L.join('\n');
const outPath = path.join(ROOT, 'exports', `rubric-pca-${dims.length}dim.md`);
fs.writeFileSync(outPath, report, 'utf8');
console.log(report);
console.error(`\nWrote ${path.relative(ROOT, outPath)}`);
