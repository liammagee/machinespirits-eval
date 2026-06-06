#!/usr/bin/env node
/**
 * A7 Phase 2 — H2 per-arc score-slope reproduction (§6.6.11).
 *
 * The paper's H2 claims that across 8 sequential sessions, recognition arcs
 * (cell 41) RISE in tutor Turn-0 score while base arcs (cell 40) DEGRADE:
 *
 *   "recog +1.31 pts/sess, base -1.08; Welch t(7.88)=1.99, p=0.032 | supported"
 *   "mean score across all sessions favouring recog by 9 points (Cohen d = 0.70)"
 *
 * The cited reproduction path (scripts/analyze-a7-longitudinal.js) is a stub
 * that computes writing-pad moment counts, NOT the slope test — its own header
 * lists "per-session tutor score curve" as an unimplemented open item. This
 * script closes that provenance gap: it recomputes H2 directly from the DB.
 *
 * Method (per-ARC slope, NOT per-session — the unit is the learner arc):
 *   1. Pull the canonical 80 rows: learner_id LIKE 'a7-phase2-%-<ts>',
 *      judge_model = Sonnet. Session index parsed from the run description
 *      ("... session N: <scenario>").
 *   2. For each arc (learner_id), OLS-fit tutor_first_turn_score ~ session
 *      index (1..8) -> one slope per arc. 5 base slopes + 5 recog slopes.
 *   3. Welch two-sample t-test on the two slope sets (recog vs base).
 *   4. Descriptive 9-point mean-score gap + Cohen's d, at both the per-arc
 *      (n=5+5) and per-session (n=40+40) levels, so the paper's d=0.70 can be
 *      attributed to the correct unit.
 *   5. Sensitivity subset: in-sequence arcs only (created_at monotone with
 *      session index), matching the paper's "n=4 base, n=3 recog" check.
 *
 * Read-only. No paid API calls. Reuses the tested incomplete-beta numerics
 * from services/anovaStats.js for the Student-t p-value.
 *
 * Usage:
 *   node scripts/analyze-a7-h2-slope.js [--ts 1777173286] [--db data/evaluations.db] [--json]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { regularizedBeta } from '../services/anovaStats.js';

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

const TS = getOption('ts', '1777173286');
const DB_PATH = getOption('db', process.env.EVAL_DB_PATH || path.join(ROOT, 'data', 'evaluations.db'));
const JSON_OUT = process.argv.includes('--json');

// ── stats helpers ────────────────────────────────────────────────────────
function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function sampleVariance(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
}
/** OLS slope of y on x. */
function olsSlope(xs, ys) {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}
/**
 * Welch two-sample t-test (unequal variances). Returns {t, df, p} where p is
 * the two-sided p-value via the Student-t survival function expressed through
 * the regularized incomplete beta: p_two = I_{df/(df+t^2)}(df/2, 1/2).
 */
function welch(a, b) {
  const ma = mean(a);
  const mb = mean(b);
  const va = sampleVariance(a);
  const vb = sampleVariance(b);
  const na = a.length;
  const nb = b.length;
  const se = Math.sqrt(va / na + vb / nb);
  const t = (ma - mb) / se;
  const df = (va / na + vb / nb) ** 2 / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1));
  const x = df / (df + t * t);
  const p = regularizedBeta(x, df / 2, 0.5);
  return { t, df, p, meanA: ma, meanB: mb, varA: va, varB: vb };
}
/** Pooled-SD Cohen's d (group A minus group B). */
function cohensD(a, b) {
  const na = a.length;
  const nb = b.length;
  const sp = Math.sqrt(((na - 1) * sampleVariance(a) + (nb - 1) * sampleVariance(b)) / (na + nb - 2));
  return sp === 0 ? 0 : (mean(a) - mean(b)) / sp;
}

// ── load the canonical 80 rows ─────────────────────────────────────────────
const db = new Database(DB_PATH, { readonly: true });
const rows = db
  .prepare(
    `SELECT r.learner_id AS learner_id,
            r.created_at AS created_at,
            CAST(substr(rn.description, instr(rn.description,'session ')+8, 1) AS INTEGER) AS sess,
            r.tutor_first_turn_score AS score
     FROM evaluation_results r
     JOIN evaluation_runs rn ON rn.id = r.run_id
     WHERE r.learner_id LIKE 'a7-phase2-%-' || ?
       AND r.judge_model LIKE '%sonnet%'
       AND r.tutor_first_turn_score IS NOT NULL
     ORDER BY r.learner_id, sess`,
  )
  .all(TS);

// RESUME runs: a session re-run after the OpenRouter credit top-up. The paper's
// in-sequence sensitivity excludes arcs whose trajectory order was disturbed,
// i.e. any session BEFORE the final one was resumed; resuming only the last
// session (8) leaves the rise/degrade trajectory intact. Parse "[base 01]" and
// "session N" from the RESUME run descriptions to find the disturbed sessions.
const resumeRuns = db
  .prepare(`SELECT description FROM evaluation_runs WHERE description LIKE 'A7 Phase 2 RESUME%'`)
  .all();
db.close();

if (rows.length === 0) {
  console.error(`No A7 Phase 2 rows found for timestamp tag ${TS} under a Sonnet judge.`);
  process.exit(1);
}

// arcKey ("base-01") -> set of resumed session indices.
const resumedSessions = new Map();
for (const { description } of resumeRuns) {
  const arcMatch = description.match(/\[(base|recog)\s+(\d+)\]/);
  const sessMatch = description.match(/session\s+(\d+)/);
  if (!arcMatch || !sessMatch) continue;
  const arcKey = `${arcMatch[1]}-${arcMatch[2]}`;
  if (!resumedSessions.has(arcKey)) resumedSessions.set(arcKey, new Set());
  resumedSessions.get(arcKey).add(Number(sessMatch[1]));
}

// ── group into arcs ────────────────────────────────────────────────────────
const arcs = new Map();
for (const row of rows) {
  if (!arcs.has(row.learner_id)) arcs.set(row.learner_id, []);
  arcs.get(row.learner_id).push(row);
}

const maxSession = Math.max(...rows.map((r) => r.sess)); // 8

const arcStats = [];
for (const [learnerId, arcRows] of arcs) {
  const ordered = [...arcRows].sort((a, b) => a.sess - b.sess);
  const xs = ordered.map((r) => r.sess);
  const ys = ordered.map((r) => r.score);
  const arm = learnerId.includes('-recog-') ? 'recog' : 'base';
  // learnerId "a7-phase2-base-01-<ts>" -> arcKey "base-01".
  const arcKey = (learnerId.match(/-(base|recog)-(\d+)-/) || []).slice(1, 3).join('-');
  const resumed = resumedSessions.get(arcKey) || new Set();
  // In-sequence iff no PRE-FINAL session was resumed (a resumed final session
  // keeps the trajectory order intact).
  const inSequence = ![...resumed].some((s) => s < maxSession);
  arcStats.push({
    learnerId,
    arm,
    n: ordered.length,
    slope: olsSlope(xs, ys),
    meanScore: mean(ys),
    sessions: ys,
    resumedSessions: [...resumed].sort((a, b) => a - b),
    inSequence,
  });
}

const base = arcStats.filter((a) => a.arm === 'base');
const recog = arcStats.filter((a) => a.arm === 'recog');

// ── H2: Welch on per-arc slopes ────────────────────────────────────────────
const baseSlopes = base.map((a) => a.slope);
const recogSlopes = recog.map((a) => a.slope);
const h2 = welch(recogSlopes, baseSlopes); // recog - base

// Descriptive mean-score gap + Cohen's d (per-arc and per-session units).
const baseArcMeans = base.map((a) => a.meanScore);
const recogArcMeans = recog.map((a) => a.meanScore);
const dArc = cohensD(recogArcMeans, baseArcMeans);
const baseAllSessions = base.flatMap((a) => a.sessions);
const recogAllSessions = recog.flatMap((a) => a.sessions);
const dSession = cohensD(recogAllSessions, baseAllSessions);
const scoreGap = mean(recogAllSessions) - mean(baseAllSessions);

// ── sensitivity: in-sequence arcs only ─────────────────────────────────────
const baseInSeq = base.filter((a) => a.inSequence).map((a) => a.slope);
const recogInSeq = recog.filter((a) => a.inSequence).map((a) => a.slope);
const h2InSeq = baseInSeq.length >= 2 && recogInSeq.length >= 2 ? welch(recogInSeq, baseInSeq) : null;

// ── report ─────────────────────────────────────────────────────────────────
const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');
const result = {
  timestamp_tag: TS,
  db: path.relative(ROOT, DB_PATH),
  judge: 'sonnet (LIKE %sonnet%)',
  arcs: { base: base.length, recog: recog.length, sessions_per_arc: 8, total_rows: rows.length },
  h2_full: {
    recog_mean_slope: h2.meanA,
    base_mean_slope: h2.meanB,
    ratio_recog_over_base_abs: Math.abs(h2.meanA / h2.meanB),
    welch_t: h2.t,
    welch_df: h2.df,
    p_two_sided: h2.p,
    p_one_sided: h2.p / 2,
  },
  descriptive_gap: {
    recog_minus_base_points: scoreGap,
    cohens_d_per_arc_n5v5: dArc,
    cohens_d_per_session_n40v40: dSession,
  },
  sensitivity_in_sequence: h2InSeq
    ? {
        n_base: baseInSeq.length,
        n_recog: recogInSeq.length,
        recog_mean_slope: h2InSeq.meanA,
        base_mean_slope: h2InSeq.meanB,
        welch_t: h2InSeq.t,
        welch_df: h2InSeq.df,
        p_two_sided: h2InSeq.p,
      }
    : { note: `in-sequence arcs too few (base=${baseInSeq.length}, recog=${recogInSeq.length})` },
  per_arc: arcStats.map((a) => ({
    arc: a.learnerId,
    arm: a.arm,
    slope: a.slope,
    mean_score: a.meanScore,
    resumed_sessions: a.resumedSessions,
    in_sequence: a.inSequence,
  })),
};

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const lines = [];
lines.push(`# A7 Phase 2 — H2 per-arc slope reproduction (§6.6.11)`);
lines.push('');
lines.push(`Timestamp tag: \`${TS}\`  ·  DB: \`${result.db}\`  ·  judge: Sonnet`);
lines.push(`Arcs: ${base.length} base + ${recog.length} recog × 8 sessions = ${rows.length} rows.`);
lines.push('');
lines.push(`## H2 (full sample, n=5+5 per-arc slopes)`);
lines.push('');
lines.push(`| Quantity | Paper §6.6.11 | Reproduced |`);
lines.push(`|---|---|---|`);
lines.push(`| recog mean slope (pts/sess) | +1.31 | ${fmt(h2.meanA)} |`);
lines.push(`| base mean slope (pts/sess) | -1.08 | ${fmt(h2.meanB)} |`);
lines.push(`| Welch t | 1.99 | ${fmt(h2.t)} |`);
lines.push(`| Welch df | 7.88 | ${fmt(h2.df)} |`);
lines.push(`| p (two-sided) | 0.032* | ${fmt(h2.p, 4)} |`);
lines.push(`| p (one-sided) | — | ${fmt(h2.p / 2, 4)} |`);
lines.push('');
lines.push(`\\* The paper reports p=0.032 against a one-sided "recog slope > 0 AND >= 1.5x base" pre-registration.`);
lines.push('');
lines.push(`## Descriptive mean-score gap`);
lines.push('');
lines.push(`- recog - base = ${fmt(scoreGap)} points (paper: ~9)`);
lines.push(`- Cohen's d, per-arc (n=5+5): ${fmt(dArc)}`);
lines.push(`- Cohen's d, per-session (n=40+40): ${fmt(dSession)} (paper: 0.70)`);
lines.push('');
lines.push(`## Sensitivity — in-sequence arcs only`);
lines.push('');
if (h2InSeq) {
  lines.push(`- base (n=${baseInSeq.length}) mean slope: ${fmt(h2InSeq.meanB)} (paper: -1.10)`);
  lines.push(`- recog (n=${recogInSeq.length}) mean slope: ${fmt(h2InSeq.meanA)} (paper: +0.72)`);
  lines.push(`- Welch t=${fmt(h2InSeq.t)}, df=${fmt(h2InSeq.df)}, p=${fmt(h2InSeq.p, 4)}`);
} else {
  lines.push(`- ${result.sensitivity_in_sequence.note}`);
}
lines.push('');
lines.push(`## Per-arc slopes`);
lines.push('');
lines.push(`"resumed" = sessions re-run after credit top-up; in-seq=N iff a PRE-final session was resumed.`);
lines.push('');
lines.push(`| arc | arm | slope | mean score | resumed | in-seq |`);
lines.push(`|---|---|---|---|---|---|`);
for (const a of arcStats) {
  const resumed = a.resumedSessions.length ? a.resumedSessions.join(',') : '-';
  lines.push(
    `| ${a.learnerId} | ${a.arm} | ${fmt(a.slope)} | ${fmt(a.meanScore)} | ${resumed} | ${a.inSequence ? 'Y' : 'N'} |`,
  );
}
lines.push('');

const report = lines.join('\n');
const outPath = path.join(ROOT, 'exports', `a7-phase2-h2-slope-${TS}.md`);
fs.writeFileSync(outPath, report, 'utf8');
console.log(report);
console.error(`\nWrote ${path.relative(ROOT, outPath)}`);
