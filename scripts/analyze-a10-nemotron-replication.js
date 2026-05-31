#!/usr/bin/env node
/**
 * A10/A10b cross-model replication on a fourth generation model (Nemotron).
 *
 * The §7.9 A10/A10b density control was run on the paper's three generation
 * models (DeepSeek V3.2, Haiku 4.5, Gemini Flash 3.0) × three judges. This script
 * re-derives the same contrasts on a FOURTH model — NVIDIA Nemotron-Nano-30B — with
 * the ego model held constant across all four cells (the as-declared eval config
 * splits cells 95/96 onto deepseek vs recognition's nemotron, which would confound
 * recognition-content with model; the run used `--model openrouter.nemotron` to
 * remove that confound), scored on the v2.2 tutor rubric by a single Sonnet-family
 * judge (claude-code/sonnet), pooled across two runs.
 *
 * Cells (eval-only → tutor-core profile):
 *   cell_1_base_single_unified            → budget   (base prompt)
 *   cell_5_recog_single_unified           → recognition
 *   cell_95_base_matched_single_unified   → matched_pedagogical
 *   cell_96_base_behaviorist_single_unified → matched_behaviorist
 *
 * Reports, matching §7.9's metric (between-cell Cohen's d) plus a paired
 * (by run+scenario) standardized effect with 95% CI for the decisive within-family
 * contrast, and the `recognition_quality` sub-dimension means.
 *
 * Usage: node scripts/analyze-a10-nemotron-replication.js [runId ...]
 *   (defaults to the two pooled A10-nemotron runs below)
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.EVAL_DB_PATH || path.join(__dirname, '..', 'data', 'evaluations.db');
const RUN_IDS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['eval-2026-05-30-f4e36e14', 'eval-2026-05-30-a9e12d4b'];

const CELL = {
  cell_1_base_single_unified: 'base',
  cell_5_recog_single_unified: 'recognition',
  cell_95_base_matched_single_unified: 'matched_ped',
  cell_96_base_behaviorist_single_unified: 'matched_beh',
};

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
};
const erf = (x) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
const pFromT = (t) => 2 * (1 - 0.5 * (1 + erf(Math.abs(t) / Math.SQRT2)));

// Between-cell Cohen's d (pooled SD), the §7.9 metric. Positive => a higher than b.
function cohenD(a, b) {
  const na = a.length;
  const nb = b.length;
  const sp = Math.sqrt(((na - 1) * sd(a) ** 2 + (nb - 1) * sd(b) ** 2) / (na + nb - 2));
  return (mean(a) - mean(b)) / sp;
}

function main() {
  const db = new Database(DB_PATH, { readonly: true });
  const placeholders = RUN_IDS.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT run_id, scenario_id, profile_name AS p, tutor_first_turn_score AS s, scores_with_reasoning AS j
       FROM evaluation_results
       WHERE run_id IN (${placeholders}) AND tutor_first_turn_score IS NOT NULL`,
    )
    .all(...RUN_IDS);

  const byCell = {};
  const byKey = {};
  const recogDim = {};
  for (const r of rows) {
    const c = CELL[r.p];
    if (!c) continue;
    (byCell[c] ??= []).push(r.s);
    const k = `${r.run_id}|${r.scenario_id}`;
    ((byKey[k] ??= {})[c] ??= []).push(r.s);
    try {
      const o = JSON.parse(r.j);
      const sc = o.scores || o.dimensions || o;
      const v = sc.recognition_quality?.score ?? sc.recognition_quality;
      if (typeof v === 'number') (recogDim[c] ??= []).push(v);
    } catch {
      /* unparseable scores JSON — skip dimension */
    }
  }

  // Paired by (run, scenario): average within-cell replicates per key, then diff.
  function paired(a, b) {
    const d = [];
    for (const k in byKey) {
      const o = byKey[k];
      if (o[a] && o[b]) d.push(mean(o[a]) - mean(o[b]));
    }
    const m = mean(d);
    const s = sd(d);
    const n = d.length;
    const se = s / Math.sqrt(n);
    const t = m / se;
    const ci = 1.96 * se;
    return { n, delta: m, lo: m - ci, hi: m + ci, dz: m / s, t, p: pFromT(t) };
  }

  const order = ['recognition', 'matched_ped', 'matched_beh', 'base'];
  const L = [];
  L.push(`# A10/A10b cross-model replication — NVIDIA Nemotron-Nano-30B (v2.2 rubric, claude-code/sonnet judge)`);
  L.push('');
  L.push(
    `Runs: ${RUN_IDS.join(', ')} (pooled). Model held constant (\`--model openrouter.nemotron\`) across all four cells.`,
  );
  L.push('');
  L.push(`## Per-cell scores (tutor_first_turn_score, 0–100)`);
  L.push('');
  L.push(`| cell | n | mean | sd |`);
  L.push(`|---|---|---|---|`);
  for (const c of order)
    L.push(`| ${c} | ${byCell[c].length} | ${mean(byCell[c]).toFixed(1)} | ${sd(byCell[c]).toFixed(1)} |`);
  L.push('');
  L.push(`## Between-cell Cohen's d (§7.9 metric; positive = first higher)`);
  L.push('');
  L.push(`| contrast | d |`);
  L.push(`|---|---|`);
  L.push(
    `| recognition vs matched_ped (within-Hegelian) | ${cohenD(byCell.recognition, byCell.matched_ped).toFixed(2)} |`,
  );
  L.push(`| base vs matched_beh (within-transmission) | ${cohenD(byCell.base, byCell.matched_beh).toFixed(2)} |`);
  L.push(`| recognition vs base | ${cohenD(byCell.recognition, byCell.base).toFixed(2)} |`);
  L.push(`| matched_ped vs base | ${cohenD(byCell.matched_ped, byCell.base).toFixed(2)} |`);
  L.push(`| recognition vs matched_beh | ${cohenD(byCell.recognition, byCell.matched_beh).toFixed(2)} |`);
  L.push('');
  L.push(`## Paired by run+scenario (decisive within-family contrast and references)`);
  L.push('');
  L.push(`| contrast | Δ/100 | 95% CI | dz | p | n pairs |`);
  L.push(`|---|---|---|---|---|---|`);
  for (const [a, b] of [
    ['recognition', 'matched_ped'],
    ['recognition', 'matched_beh'],
    ['recognition', 'base'],
    ['matched_ped', 'base'],
    ['matched_beh', 'base'],
  ]) {
    const r = paired(a, b);
    L.push(
      `| ${a} − ${b} | ${r.delta.toFixed(2)} | [${r.lo.toFixed(1)}, ${r.hi.toFixed(1)}] | ${r.dz.toFixed(2)} | ${r.p.toFixed(3)} | ${r.n} |`,
    );
  }
  L.push('');
  L.push(`## recognition_quality sub-dimension (0–5)`);
  L.push('');
  L.push(`| cell | mean recognition_quality |`);
  L.push(`|---|---|`);
  for (const c of order) L.push(`| ${c} | ${mean(recogDim[c]).toFixed(2)} |`);
  L.push('');
  console.log(L.join('\n'));
  db.close();
}

main();
