#!/usr/bin/env node
/**
 * rejudge-adaptive-inter-rater.js
 *
 * Inter-rater reliability check for the bespoke 4-dimension adaptive grader
 * (scripts/grade-adaptive-dialogue.js). The first grading pass used the codex
 * CLI (GPT-5) and wrote scores to the `adaptive_*` columns of
 * evaluation_results. That pass has two known weaknesses (see
 * docs/explorations/claude/p22-p23-parking-note.md §"Engineering vs noise"):
 *   (1) single judge — no agreement check;
 *   (2) the rubric in scripts/lib/adaptiveGraderPrompt.js was authored *after*
 *       the binary strategy-shift results were known, so it is not blind.
 *
 * This script re-grades the same dialogues with a second, different-vendor CLI
 * judge (default `claude` / Sonnet, via the subscription bridge — no API $),
 * using the *identical* prompt (imported from scripts/lib/adaptiveGraderPrompt.js).
 * Judge-2 scores are written to a JSON file, NOT the DB — evaluation_results
 * has only one set of `adaptive_*` columns, so writing there would clobber the
 * GPT-5 grades. The analysis step then joins judge-1 (read live from the DB)
 * with judge-2 (the JSON file) and reports:
 *   - per-dimension Pearson r, Spearman rho, quadratic-weighted Cohen's kappa,
 *     exact / within-1 agreement %, mean signed and absolute deltas;
 *   - pooled-across-dimensions versions of the same;
 *   - the headline robustness check: does judge-2 preserve the cell ranking
 *     the parking note headlines (cell_118 top on graded overall; cell_119
 *     worst / heaviest left tail on strategy_execution)?
 *
 * Usage:
 *   node scripts/rejudge-adaptive-inter-rater.js [options]
 *
 * Options:
 *   --run-id <ids>        Comma-separated run IDs to restrict to (default: all
 *                         adaptive rows that already carry judge-1 grades).
 *   --profile <substr>    Restrict to profiles whose name contains <substr>.
 *   --judge-cli <name>    Second judge: claude | gemini | codex (default: claude).
 *   --judge-cli-model <m> Optional model override passed to the CLI.
 *   --out <file>          Judge-2 scores JSON (default:
 *                         exports/adaptive-grades-judge2-<judge>.json).
 *   --report <file>       Markdown report path (default:
 *                         exports/adaptive-inter-rater-<YYYY-MM-DD>.md).
 *   --analyze-only        Skip re-grading; recompute the report from the
 *                         existing --out file + the DB.
 *   --limit N             Cap rows graded this pass (smoke / cost control).
 *   --overwrite           Re-grade rows already present in --out (default: skip).
 *   --verbose             Print raw judge stdout per row.
 *   --dry-run             Build prompts, print one example, don't call the judge.
 */

import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { GRADER_VERSION, buildPrompt, extractJsonEnvelope } from './lib/adaptiveGraderPrompt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
process.chdir(REPO_ROOT);

const DB_PATH = process.env.EVAL_DB_PATH || path.join(REPO_ROOT, 'data', 'evaluations.db');

const DIMS = ['trigger_recognition', 'strategy_execution', 'strategy_quality', 'pedagogical_coherence'];
// DB column names, parallel to DIMS:
const DIM_COLS = {
  trigger_recognition: 'adaptive_trigger_recognition',
  strategy_execution: 'adaptive_strategy_execution',
  strategy_quality: 'adaptive_strategy_quality',
  pedagogical_coherence: 'adaptive_pedagogical_coherence',
};

// ─────────────────────────────────────── args
function parseArgs(argv) {
  const a = {
    runIds: [],
    profile: null,
    judgeCli: 'claude',
    judgeCliModel: null,
    out: null,
    report: null,
    analyzeOnly: false,
    limit: null,
    overwrite: false,
    verbose: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--run-id')
      a.runIds.push(
        ...argv[++i]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
    else if (t === '--profile') a.profile = argv[++i];
    else if (t === '--judge-cli') a.judgeCli = String(argv[++i]).toLowerCase();
    else if (t === '--judge-cli-model') a.judgeCliModel = argv[++i];
    else if (t === '--out') a.out = argv[++i];
    else if (t === '--report') a.report = argv[++i];
    else if (t === '--analyze-only') a.analyzeOnly = true;
    else if (t === '--limit') a.limit = parseInt(argv[++i], 10);
    else if (t === '--overwrite') a.overwrite = true;
    else if (t === '--verbose') a.verbose = true;
    else if (t === '--dry-run') a.dryRun = true;
    else if (t === '-h' || t === '--help') {
      console.log(
        fs
          .readFileSync(fileURLToPath(import.meta.url), 'utf-8')
          .split('\n')
          .slice(1, 50)
          .join('\n'),
      );
      process.exit(0);
    } else {
      console.error(`unknown flag: ${t}`);
      process.exit(2);
    }
  }
  if (!['claude', 'gemini', 'codex'].includes(a.judgeCli)) {
    console.error(`--judge-cli must be claude | gemini | codex, got '${a.judgeCli}'`);
    process.exit(2);
  }
  if (!a.out) a.out = path.join('exports', `adaptive-grades-judge2-${a.judgeCli}.json`);
  if (!a.report) a.report = path.join('exports', `adaptive-inter-rater-${new Date().toISOString().slice(0, 10)}.md`);
  return a;
}
const ARGS = parseArgs(process.argv.slice(2));

// ─────────────────────────────────────── db rows (judge 1, live)
const db = new Database(DB_PATH, { readonly: false });
function selectRows() {
  const where = ['adaptive_trigger_recognition IS NOT NULL', 'dialogue_id IS NOT NULL'];
  const params = [];
  if (ARGS.runIds.length) {
    where.push(`run_id IN (${ARGS.runIds.map(() => '?').join(',')})`);
    params.push(...ARGS.runIds);
  }
  if (ARGS.profile) {
    where.push('profile_name LIKE ?');
    params.push(`%${ARGS.profile}%`);
  }
  let sql = `
    SELECT id, run_id, profile_name, scenario_id, dialogue_id,
           adaptive_trigger_recognition, adaptive_strategy_execution,
           adaptive_strategy_quality, adaptive_pedagogical_coherence,
           adaptive_grader_judge_model, adaptive_grader_version, created_at
    FROM evaluation_results
    WHERE ${where.join(' AND ')}
    ORDER BY profile_name, scenario_id, id`;
  if (ARGS.limit) sql += ` LIMIT ${parseInt(ARGS.limit, 10)}`;
  return db.prepare(sql).all(...params);
}

// ─────────────────────────────────────── dialogue trace
function loadTrace(dialogueId) {
  const dir = process.env.EVAL_LOGS_DIR || path.join(process.cwd(), 'logs');
  const p = path.join(dir, 'tutor-dialogues', `${dialogueId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

// ─────────────────────────────────────── CLI judge
function judgeLabel() {
  return `${ARGS.judgeCli}-cli.${ARGS.judgeCliModel || 'default'}`;
}
function cliInvocation() {
  if (ARGS.judgeCli === 'gemini') {
    const args = ['-s', '-o', 'text'];
    if (ARGS.judgeCliModel) args.push('-m', ARGS.judgeCliModel);
    return { bin: 'gemini', args, env: { ...process.env } };
  }
  if (ARGS.judgeCli === 'codex') {
    const args = ['exec', '-'];
    if (ARGS.judgeCliModel) args.push('-m', ARGS.judgeCliModel);
    return { bin: 'codex', args, env: { ...process.env } };
  }
  // claude: use the subscription bridge — strip API-key/recursion env so it
  // doesn't bill the API or trip the in-session guard.
  const args = ['-p', '-', '--output-format', 'text'];
  if (ARGS.judgeCliModel) args.push('--model', ARGS.judgeCliModel);
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDECODE;
  return { bin: 'claude', args, env };
}
async function callJudge(prompt) {
  const { bin, args, env } = cliInvocation();
  const stdout = await new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'], env });
    let out = '',
      err = '';
    child.stdout.on('data', (d) => {
      out += d;
    });
    child.stderr.on('data', (d) => {
      err += d;
    });
    child.on('error', reject);
    child.on('close', (code) => (code !== 0 ? reject(new Error(err || out || `${bin} exit ${code}`)) : resolve(out)));
    child.stdin.write(prompt);
    child.stdin.end();
  });
  return { parsed: extractJsonEnvelope(stdout), rawStdout: stdout };
}

// ─────────────────────────────────────── judge-2 file (resume-friendly)
function loadJudge2File() {
  if (!fs.existsSync(ARGS.out)) return { judge: judgeLabel(), grader_version: GRADER_VERSION, rows: {} };
  try {
    const j = JSON.parse(fs.readFileSync(ARGS.out, 'utf-8'));
    if (!j.rows) j.rows = {};
    return j;
  } catch {
    return { judge: judgeLabel(), grader_version: GRADER_VERSION, rows: {} };
  }
}
function saveJudge2File(state) {
  fs.mkdirSync(path.dirname(ARGS.out), { recursive: true });
  fs.writeFileSync(ARGS.out, JSON.stringify(state, null, 2));
}

// ─────────────────────────────────────── stats helpers (pure JS, no deps)
function mean(xs) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN;
}
function std(xs) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = mean(xs),
    my = mean(ys);
  let num = 0,
    dx = 0,
    dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx,
      b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return NaN;
  return num / Math.sqrt(dx * dy);
}
function rankVector(xs) {
  // average ranks for ties
  const idx = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const r = (i + j) / 2 + 1; // 1-based average rank
    for (let k = i; k <= j; k++) ranks[idx[k][1]] = r;
    i = j + 1;
  }
  return ranks;
}
function spearman(xs, ys) {
  return pearson(rankVector(xs), rankVector(ys));
}
function quadraticWeightedKappa(xs, ys, minR = 1, maxR = 5) {
  const n = xs.length;
  if (n === 0) return NaN;
  const K = maxR - minR + 1;
  const O = Array.from({ length: K }, () => new Array(K).fill(0));
  const rowMarg = new Array(K).fill(0),
    colMarg = new Array(K).fill(0);
  for (let i = 0; i < n; i++) {
    const a = Math.round(xs[i]) - minR,
      b = Math.round(ys[i]) - minR;
    if (a < 0 || a >= K || b < 0 || b >= K) continue;
    O[a][b]++;
    rowMarg[a]++;
    colMarg[b]++;
  }
  if (K === 1) return NaN;
  const w = (i, j) => 1 - (i - j) ** 2 / (K - 1) ** 2;
  let po = 0,
    pe = 0;
  for (let i = 0; i < K; i++)
    for (let j = 0; j < K; j++) {
      po += (w(i, j) * O[i][j]) / n;
      pe += w(i, j) * (rowMarg[i] / n) * (colMarg[j] / n);
    }
  if (pe === 1) return NaN;
  return (po - pe) / (1 - pe);
}
function fmt(x, d = 3) {
  return Number.isFinite(x) ? x.toFixed(d) : 'n/a';
}

// ─────────────────────────────────────── analysis
function analyze(rows, judge2) {
  // Join: keep rows present in both judge-1 (DB) and judge-2 (file).
  const paired = [];
  for (const r of rows) {
    const j2 = judge2.rows[r.id];
    if (!j2 || !j2.scores) continue;
    const j1 = {
      trigger_recognition: r.adaptive_trigger_recognition,
      strategy_execution: r.adaptive_strategy_execution,
      strategy_quality: r.adaptive_strategy_quality,
      pedagogical_coherence: r.adaptive_pedagogical_coherence,
    };
    // require all 4 dims on both sides
    if (DIMS.some((d) => j1[d] == null || j2.scores[d] == null)) continue;
    paired.push({
      id: r.id,
      profile: r.profile_name,
      scenario: r.scenario_id,
      j1,
      j2: j2.scores,
      j1overall: mean(DIMS.map((d) => j1[d])),
      j2overall: mean(DIMS.map((d) => j2.scores[d])),
    });
  }

  // Per-dimension + overall agreement.
  const perDim = {};
  for (const d of [...DIMS, 'overall']) {
    const xs = paired.map((p) => (d === 'overall' ? p.j1overall : p.j1[d]));
    const ys = paired.map((p) => (d === 'overall' ? p.j2overall : p.j2[d]));
    const deltas = ys.map((y, i) => y - xs[i]);
    const exact = d === 'overall' ? null : deltas.filter((x) => Math.round(x) === 0).length / deltas.length;
    const within1 = d === 'overall' ? null : deltas.filter((x) => Math.abs(x) <= 1).length / deltas.length;
    perDim[d] = {
      n: paired.length,
      j1mean: mean(xs),
      j2mean: mean(ys),
      pearson: pearson(xs, ys),
      spearman: spearman(xs, ys),
      qwk: d === 'overall' ? null : quadraticWeightedKappa(xs, ys),
      exact,
      within1,
      meanSignedDelta: mean(deltas),
      meanAbsDelta: mean(deltas.map(Math.abs)),
    };
  }

  // Pooled across the 4 dims (each (row,dim) one obs).
  const pooledX = [],
    pooledY = [];
  for (const p of paired)
    for (const d of DIMS) {
      pooledX.push(p.j1[d]);
      pooledY.push(p.j2[d]);
    }
  const pooledDeltas = pooledY.map((y, i) => y - pooledX[i]);
  const pooled = {
    n: pooledX.length,
    pearson: pearson(pooledX, pooledY),
    spearman: spearman(pooledX, pooledY),
    qwk: quadraticWeightedKappa(pooledX, pooledY),
    exact: pooledDeltas.filter((x) => Math.round(x) === 0).length / pooledDeltas.length,
    within1: pooledDeltas.filter((x) => Math.abs(x) <= 1).length / pooledDeltas.length,
    meanSignedDelta: mean(pooledDeltas),
    meanAbsDelta: mean(pooledDeltas.map(Math.abs)),
  };

  // Per-cell judge-2 means + left-tail counts (<=3 on strategy_execution).
  const cells = {};
  for (const p of paired) {
    const c = (cells[p.profile] ||= {
      n: 0,
      j2: Object.fromEntries([...DIMS, 'overall'].map((d) => [d, []])),
      j1: Object.fromEntries([...DIMS, 'overall'].map((d) => [d, []])),
      j2ExecLE3: 0,
      j1ExecLE3: 0,
    });
    c.n++;
    for (const d of DIMS) {
      c.j2[d].push(p.j2[d]);
      c.j1[d].push(p.j1[d]);
    }
    c.j2.overall.push(p.j2overall);
    c.j1.overall.push(p.j1overall);
    if (p.j2.strategy_execution <= 3) c.j2ExecLE3++;
    if (p.j1.strategy_execution <= 3) c.j1ExecLE3++;
  }
  const cellSummary = {};
  for (const [name, c] of Object.entries(cells)) {
    cellSummary[name] = {
      n: c.n,
      j1: Object.fromEntries([...DIMS, 'overall'].map((d) => [d, mean(c.j1[d])])),
      j2: Object.fromEntries([...DIMS, 'overall'].map((d) => [d, mean(c.j2[d])])),
      j1ExecLE3: c.j1ExecLE3,
      j2ExecLE3: c.j2ExecLE3,
    };
  }

  // Ranking robustness: order cells by mean on a metric (desc), under each judge.
  const orderBy = (judgeKey, metric) =>
    Object.entries(cellSummary)
      .sort((a, b) => b[1][judgeKey][metric] - a[1][judgeKey][metric])
      .map(([n]) => n);

  const robustness = {
    overall: { j1: orderBy('j1', 'overall'), j2: orderBy('j2', 'overall') },
    strategy_execution: { j1: orderBy('j1', 'strategy_execution'), j2: orderBy('j2', 'strategy_execution') },
  };

  return { paired, perDim, pooled, cellSummary, robustness };
}

// ─────────────────────────────────────── report
function shortCell(name) {
  return name
    .replace('cell_110_langgraph_adaptive', 'cell_110 (full state)')
    .replace('cell_118_state_policy_minimal_profile', 'cell_118 (minimal)')
    .replace('cell_119_state_policy_no_misconceptions', 'cell_119 (no_misc)');
}
function interpretKappa(k) {
  if (!Number.isFinite(k)) return 'n/a';
  if (k < 0) return 'worse than chance';
  if (k < 0.2) return 'slight';
  if (k < 0.4) return 'fair';
  if (k < 0.6) return 'moderate';
  if (k < 0.8) return 'substantial';
  return 'almost perfect';
}
function buildReport(a, judge2Label, rowsTotal) {
  const L = [];
  L.push(`# Adaptive grader — inter-rater reliability (judge 1 vs judge 2)`);
  L.push('');
  L.push(`- **Generated:** ${new Date().toISOString()}`);
  L.push(`- **Judge 1 (original, in DB):** \`codex-cli.default\` (GPT-5), grader v${GRADER_VERSION}`);
  L.push(`- **Judge 2 (this pass, file):** \`${judge2Label}\`, grader v${GRADER_VERSION}`);
  L.push(`- **Rows paired (both judges, all 4 dims):** ${a.paired.length} / ${rowsTotal}`);
  L.push(`- **Prompt:** identical for both judges (\`scripts/lib/adaptiveGraderPrompt.js\`)`);
  L.push('');
  L.push(
    `> Context: ${'`'}docs/explorations/claude/p22-p23-parking-note.md${'`'} §"Engineering vs noise" flags single-judge + non-blind rubric as the two biggest threats to the cell_118 > cell_119 > cell_110 result. This is the inter-rater check that section recommends as the highest-ROI validation move.`,
  );
  L.push('');

  // Headline verdict
  const r = a.robustness;
  const sameOverall = JSON.stringify(r.overall.j1) === JSON.stringify(r.overall.j2);
  const c118TopBoth = r.overall.j1[0]?.includes('cell_118') && r.overall.j2[0]?.includes('cell_118');
  L.push(`## Headline`);
  L.push('');
  L.push(`- **Cell ranking on graded overall — judge 1:** ${r.overall.j1.map(shortCell).join('  >  ')}`);
  L.push(`- **Cell ranking on graded overall — judge 2:** ${r.overall.j2.map(shortCell).join('  >  ')}`);
  L.push(
    `- **Identical ordering?** ${sameOverall ? 'YES' : 'NO'}. **cell_118 top under both judges?** ${c118TopBoth ? 'YES' : 'NO'}.`,
  );
  L.push(`- **Cell ranking on strategy_execution — judge 1:** ${r.strategy_execution.j1.map(shortCell).join('  >  ')}`);
  L.push(`- **Cell ranking on strategy_execution — judge 2:** ${r.strategy_execution.j2.map(shortCell).join('  >  ')}`);
  L.push(
    `- **Pooled agreement (4 dims × ${a.paired.length} rows = ${a.pooled.n} obs):** Pearson r=${fmt(a.pooled.pearson)}, Spearman ρ=${fmt(a.pooled.spearman)}, quadratic-weighted κ=${fmt(a.pooled.qwk)} (${interpretKappa(a.pooled.qwk)}), exact-match ${fmt(100 * a.pooled.exact, 1)}%, within-1 ${fmt(100 * a.pooled.within1, 1)}%.`,
  );
  L.push(
    `- **Judge-2 leniency vs judge-1 (pooled mean signed Δ):** ${a.pooled.meanSignedDelta >= 0 ? '+' : ''}${fmt(a.pooled.meanSignedDelta)} points on the 1–5 scale (mean |Δ| = ${fmt(a.pooled.meanAbsDelta)}).`,
  );
  L.push('');

  // Per-dimension agreement table
  L.push(`## Per-dimension agreement`);
  L.push('');
  L.push(
    `| Dimension | n | j1 mean | j2 mean | Pearson r | Spearman ρ | QW κ | exact % | within-1 % | mean Δ (j2−j1) | mean \\|Δ\\| |`,
  );
  L.push(`|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const d of [...DIMS, 'overall']) {
    const m = a.perDim[d];
    L.push(
      `| ${d} | ${m.n} | ${fmt(m.j1mean, 2)} | ${fmt(m.j2mean, 2)} | ${fmt(m.pearson)} | ${fmt(m.spearman)} | ${m.qwk == null ? '—' : fmt(m.qwk)} | ${m.exact == null ? '—' : fmt(100 * m.exact, 1)} | ${m.within1 == null ? '—' : fmt(100 * m.within1, 1)} | ${m.meanSignedDelta >= 0 ? '+' : ''}${fmt(m.meanSignedDelta, 2)} | ${fmt(m.meanAbsDelta, 2)} |`,
    );
  }
  L.push(
    `| **pooled (4 dims)** | ${a.pooled.n} | — | — | ${fmt(a.pooled.pearson)} | ${fmt(a.pooled.spearman)} | ${fmt(a.pooled.qwk)} | ${fmt(100 * a.pooled.exact, 1)} | ${fmt(100 * a.pooled.within1, 1)} | ${a.pooled.meanSignedDelta >= 0 ? '+' : ''}${fmt(a.pooled.meanSignedDelta, 2)} | ${fmt(a.pooled.meanAbsDelta, 2)} |`,
  );
  L.push('');

  // Per-cell side-by-side
  L.push(`## Per-cell means: judge 1 vs judge 2`);
  L.push('');
  L.push(`| Cell | n | metric | j1 | j2 | Δ | j1 exec≤3 | j2 exec≤3 |`);
  L.push(`|---|---|---|---|---|---|---|---|`);
  const cellOrder = Object.keys(a.cellSummary).sort();
  for (const name of cellOrder) {
    const c = a.cellSummary[name];
    let first = true;
    for (const d of [...DIMS, 'overall']) {
      const j1 = c.j1[d],
        j2 = c.j2[d];
      L.push(
        `| ${first ? shortCell(name) : ''} | ${first ? c.n : ''} | ${d} | ${fmt(j1, 2)} | ${fmt(j2, 2)} | ${j2 - j1 >= 0 ? '+' : ''}${fmt(j2 - j1, 2)} | ${first ? `${c.j1ExecLE3}/${c.n}` : ''} | ${first ? `${c.j2ExecLE3}/${c.n}` : ''} |`,
      );
      first = false;
    }
  }
  L.push('');

  // Interpretation scaffold
  L.push(`## Reading`);
  L.push('');
  L.push(
    `1. **Does the headline survive a second judge?** The parking note's central claim is cell_118 (minimal state) > cell_119 (no_misc) > cell_110 (full state) on graded overall, with cell_119 carrying a heavy left tail on \`strategy_execution\`. If judge 2's orderings (above) match and cell_119 still has the most \`exec≤3\` rows, the result is not a single-judge artefact. If they diverge, the parking note's ~25% "engineering artefact" weight goes up.`,
  );
  L.push(
    `2. **Agreement magnitude.** Quadratic-weighted κ in the 0.4–0.6 band = "moderate" (typical for LLM judges on 1–5 ordinal scales); >0.6 = "substantial". Pearson/Spearman track linear/rank concordance. Low κ but matching cell *rankings* still supports the comparative claim even if absolute levels disagree.`,
  );
  L.push(
    `3. **Leniency.** A non-zero pooled mean signed Δ means one judge is systematically harsher — expected, and harmless for *within-judge* cell comparisons, which is what the parking note's claims rest on.`,
  );
  L.push(
    `4. **What this does NOT fix.** The rubric itself (4 dims, chosen after the binary results were known) is the same for both judges, so this check addresses single-judge variance, not rubric-not-blind. Closing that needs a rubric authored before seeing results, or an externally-defined one — out of scope here.`,
  );
  L.push('');
  L.push(`---`);
  L.push(
    `Raw judge-2 scores: \`${path.relative(REPO_ROOT, ARGS.out)}\`. Judge-1 snapshot: \`exports/adaptive-grades-judge1-codex.json\`. Re-run analysis only: \`node scripts/rejudge-adaptive-inter-rater.js --analyze-only --judge-cli ${ARGS.judgeCli}\`.`,
  );
  L.push('');
  return L.join('\n');
}

// ─────────────────────────────────────── main
async function main() {
  const rows = selectRows();
  console.log(
    `PLAN: ${rows.length} graded adaptive rows in scope${ARGS.profile ? ` (profile~${ARGS.profile})` : ''}${ARGS.runIds.length ? ` (runs: ${ARGS.runIds.length})` : ''}`,
  );
  const byProfile = {};
  for (const r of rows) byProfile[r.profile_name] = (byProfile[r.profile_name] || 0) + 1;
  for (const [p, n] of Object.entries(byProfile)) console.log(`  ${shortCell(p)}: ${n}`);
  console.log(
    `JUDGE 2: ${judgeLabel()} | out=${ARGS.out} | analyzeOnly=${ARGS.analyzeOnly} | overwrite=${ARGS.overwrite}${ARGS.dryRun ? ' | DRY RUN' : ''}`,
  );
  console.log('');

  const state = loadJudge2File();
  state.judge = judgeLabel();
  state.grader_version = GRADER_VERSION;

  if (!ARGS.analyzeOnly) {
    let i = 0,
      graded = 0,
      skipped = 0,
      errors = 0,
      dryShown = false;
    for (const row of rows) {
      const tag = `[${++i}/${rows.length}]`;
      if (!ARGS.overwrite && state.rows[row.id]) {
        skipped++;
        if (ARGS.verbose)
          console.log(`${tag} ${row.scenario_id} ${shortCell(row.profile_name)} — already in out-file, skip`);
        continue;
      }
      const trace = loadTrace(row.dialogue_id);
      if (!trace) {
        skipped++;
        console.log(`${tag} ${row.scenario_id} ${shortCell(row.profile_name)} — trace missing, skip`);
        continue;
      }
      const prompt = buildPrompt(trace);
      if (ARGS.dryRun) {
        if (!dryShown) {
          console.log('=== DRY RUN: prompt for first row ===\n' + prompt + '\n=== END PROMPT ===');
          dryShown = true;
        }
        continue;
      }
      try {
        const t0 = Date.now();
        const { parsed, rawStdout } = await callJudge(prompt);
        const dt = Date.now() - t0;
        const s = parsed.scores || {};
        // basic shape check
        if (DIMS.some((d) => typeof s[d] !== 'number')) throw new Error(`malformed scores: ${JSON.stringify(s)}`);
        state.rows[row.id] = {
          id: row.id,
          run_id: row.run_id,
          profile_name: row.profile_name,
          scenario_id: row.scenario_id,
          dialogue_id: row.dialogue_id,
          judge: judgeLabel(),
          grader_version: GRADER_VERSION,
          scores: {
            trigger_recognition: s.trigger_recognition,
            strategy_execution: s.strategy_execution,
            strategy_quality: s.strategy_quality,
            pedagogical_coherence: s.pedagogical_coherence,
          },
          reasoning: parsed.reasoning || null,
          summary: parsed.summary || null,
          latency_ms: dt,
        };
        saveJudge2File(state); // incremental — crash-safe
        graded++;
        const j1o = mean(DIMS.map((d) => row[DIM_COLS[d]]));
        const j2o = mean(DIMS.map((d) => s[d]));
        console.log(
          `${tag} ${row.scenario_id} ${shortCell(row.profile_name)} | trig=${s.trigger_recognition} exec=${s.strategy_execution} qual=${s.strategy_quality} coh=${s.pedagogical_coherence} | overall j2=${j2o.toFixed(2)} vs j1=${j1o.toFixed(2)} (Δ${(j2o - j1o >= 0 ? '+' : '') + (j2o - j1o).toFixed(2)}) | ${dt}ms`,
        );
        if (ARGS.verbose) console.log('  raw:', rawStdout.slice(0, 400).replace(/\n/g, ' '));
      } catch (e) {
        errors++;
        console.error(`${tag} ${row.scenario_id} ${shortCell(row.profile_name)} — ERROR: ${e.message}`);
      }
    }
    console.log(`\n=== grading done: graded=${graded} skipped=${skipped} errors=${errors} ===`);
    if (ARGS.dryRun) {
      db.close();
      return;
    }
  }

  // ── analysis ──
  const a = analyze(rows, state);
  if (a.paired.length === 0) {
    console.log(
      '\nNo rows paired between judge 1 (DB) and judge 2 (file) — nothing to analyze. Run without --analyze-only first.',
    );
    db.close();
    return;
  }
  const report = buildReport(a, state.judge, rows.length);
  fs.mkdirSync(path.dirname(ARGS.report), { recursive: true });
  fs.writeFileSync(ARGS.report, report);

  // console summary
  console.log('\n────────── INTER-RATER SUMMARY ──────────');
  console.log(`paired rows: ${a.paired.length}/${rows.length}  |  judge2: ${state.judge}`);
  console.log(
    `pooled (4 dims): Pearson r=${fmt(a.pooled.pearson)}  Spearman ρ=${fmt(a.pooled.spearman)}  QWκ=${fmt(a.pooled.qwk)} (${interpretKappa(a.pooled.qwk)})  exact=${fmt(100 * a.pooled.exact, 1)}%  within1=${fmt(100 * a.pooled.within1, 1)}%  Δ(j2−j1)=${a.pooled.meanSignedDelta >= 0 ? '+' : ''}${fmt(a.pooled.meanSignedDelta, 2)}`,
  );
  console.log('per-dimension Pearson r / QWκ:');
  for (const d of DIMS)
    console.log(
      `  ${d.padEnd(22)} r=${fmt(a.perDim[d].pearson)}  QWκ=${fmt(a.perDim[d].qwk)}  (j1 ${fmt(a.perDim[d].j1mean, 2)} → j2 ${fmt(a.perDim[d].j2mean, 2)})`,
    );
  console.log(`cell ranking on graded overall:`);
  console.log(`  judge1: ${a.robustness.overall.j1.map(shortCell).join('  >  ')}`);
  console.log(`  judge2: ${a.robustness.overall.j2.map(shortCell).join('  >  ')}`);
  console.log(
    `  → identical ordering: ${JSON.stringify(a.robustness.overall.j1) === JSON.stringify(a.robustness.overall.j2) ? 'YES' : 'NO'}`,
  );
  console.log(`cell ranking on strategy_execution:`);
  console.log(`  judge1: ${a.robustness.strategy_execution.j1.map(shortCell).join('  >  ')}`);
  console.log(`  judge2: ${a.robustness.strategy_execution.j2.map(shortCell).join('  >  ')}`);
  for (const [name, c] of Object.entries(a.cellSummary)) {
    console.log(
      `  ${shortCell(name).padEnd(24)} n=${c.n}  overall j1=${fmt(c.j1.overall, 2)} j2=${fmt(c.j2.overall, 2)}  | exec≤3: j1 ${c.j1ExecLE3}/${c.n}, j2 ${c.j2ExecLE3}/${c.n}`,
    );
  }
  console.log(`\nreport: ${ARGS.report}`);
  console.log(`judge-2 scores: ${ARGS.out}`);
  db.close();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
