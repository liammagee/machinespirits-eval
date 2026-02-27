#!/usr/bin/env node

/**
 * Cross-Level Rubric Consistency Analysis
 *
 * Implements the 5 consistency checks from notes/paper-2-0/rubric/metrics-procedure.md:
 *
 *   Check 1: Per-Turn → Holistic Convergence
 *   Check 2: Agent-Level → Dialogue-Level Prediction
 *   Check 3: Public vs Full Dialogue Quality
 *   Check 4: Deliberation → Output Quality
 *   Check 5: Process Measures → Rubric Scores
 *
 * Usage:
 *   node scripts/analyze-rubric-consistency.js
 *   node scripts/analyze-rubric-consistency.js --run-id <runId>
 *   node scripts/analyze-rubric-consistency.js --judge claude  (filter by judge)
 *   node scripts/analyze-rubric-consistency.js --verbose        (show scatter data)
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'evaluations.db');

// ── CLI args ──
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}
const runId = getArg('run-id');
const judgeFilter = getArg('judge');
const verbose = args.includes('--verbose');

// ── ANSI colors ──
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// ── Statistics ──

function mean(arr) {
  if (arr.length === 0) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function standardDeviation(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((acc, val) => acc + (val - m) ** 2, 0) / (arr.length - 1));
}

/**
 * Pearson correlation coefficient between two arrays.
 * Returns { r, n, p } where p is approximate two-tailed p-value.
 */
function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return { r: NaN, n, p: NaN };

  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));

  let sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  if (sumX2 === 0 || sumY2 === 0) return { r: NaN, n, p: NaN };

  const r = sumXY / Math.sqrt(sumX2 * sumY2);

  // t-test for significance
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const df = n - 2;
  const p = tDistributionPValue(t, df);

  return { r, n, p };
}

/**
 * Approximate two-tailed p-value from t-distribution.
 * Uses the Abramowitz and Stegun approximation.
 */
function tDistributionPValue(t, df) {
  const _x = df / (df + t * t);
  // Regularized incomplete beta function approximation
  const _a = df / 2;
  const _b = 0.5;
  // Simple approximation via normal for df > 30
  if (df > 30) {
    const z = Math.abs(t);
    // Normal CDF approximation
    const p1 = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
    const t1 = 1 / (1 + 0.2316419 * z);
    const poly = t1 * (0.319381530 + t1 * (-0.356563782 + t1 * (1.781477937 + t1 * (-1.821255978 + 1.330274429 * t1))));
    return 2 * p1 * poly;
  }
  // For small df, use a cruder approximation
  const z = Math.abs(t) * Math.sqrt(1 - 1 / (4 * df)) / Math.sqrt(1 + t * t / (2 * df));
  const p1 = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const t1 = 1 / (1 + 0.2316419 * z);
  const poly = t1 * (0.319381530 + t1 * (-0.356563782 + t1 * (1.781477937 + t1 * (-1.821255978 + 1.330274429 * t1))));
  return 2 * p1 * poly;
}

/**
 * Interpret a correlation against expected range.
 */
function interpretCorrelation(r, low, high, tooHighMsg, tooLowMsg) {
  if (isNaN(r)) return `${c.dim}insufficient data${c.reset}`;
  if (r > high + 0.05) return `${c.yellow}⚠ HIGH (${tooHighMsg})${c.reset}`;
  if (r < low - 0.05) return `${c.red}⚠ LOW (${tooLowMsg})${c.reset}`;
  return `${c.green}✓ within expected range${c.reset}`;
}

function formatR(r) {
  if (isNaN(r)) return '  —  ';
  const sign = r >= 0 ? '+' : '';
  return `${sign}${r.toFixed(3)}`;
}

function formatP(p) {
  if (isNaN(p)) return '—';
  if (p < 0.001) return '<.001';
  if (p < 0.01) return `${p.toFixed(3)}`;
  if (p < 0.05) return `${p.toFixed(3)}`;
  return `${p.toFixed(3)} (ns)`;
}

// ── Database ──

const db = new Database(DB_PATH, { readonly: true });

function buildWhereClause() {
  const conditions = [];
  const params = [];
  if (runId) {
    conditions.push('run_id = ?');
    params.push(runId);
  }
  if (judgeFilter) {
    conditions.push('judge_model LIKE ?');
    params.push(`%${judgeFilter}%`);
  }
  // Only multi-turn rows (have dialogue_id and multiple turns)
  conditions.push('dialogue_id IS NOT NULL');
  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

// ── Check implementations ──

function check1_perTurnToHolistic() {
  console.log(`\n${c.bold}${c.cyan}━━━ Check 1: Per-Turn → Holistic Convergence ━━━${c.reset}`);
  console.log(`${c.dim}Expected: r = 0.60–0.85${c.reset}\n`);

  const { where, params } = buildWhereClause();

  // Tutor
  const tutorRows = db.prepare(`
    SELECT tutor_overall_score AS perturn, tutor_holistic_overall_score AS holistic
    FROM evaluation_results
    ${where} ${where ? 'AND' : 'WHERE'} tutor_overall_score IS NOT NULL AND tutor_holistic_overall_score IS NOT NULL
  `).all(...params);

  const tutorPT = tutorRows.map(r => r.perturn);
  const tutorH = tutorRows.map(r => r.holistic);
  const tutorCorr = pearsonCorrelation(tutorPT, tutorH);

  console.log(`  ${c.bold}Tutor${c.reset}: r = ${formatR(tutorCorr.r)}  N = ${tutorCorr.n}  p = ${formatP(tutorCorr.p)}`);
  console.log(`    ${interpretCorrelation(tutorCorr.r, 0.60, 0.85,
    'holistic may not add value beyond per-turn average',
    'holistic measures something very different — check alignment')}`);

  // Learner
  const learnerRows = db.prepare(`
    SELECT learner_overall_score AS perturn, learner_holistic_overall_score AS holistic
    FROM evaluation_results
    ${where} ${where ? 'AND' : 'WHERE'} learner_overall_score IS NOT NULL AND learner_holistic_overall_score IS NOT NULL
  `).all(...params);

  const learnerPT = learnerRows.map(r => r.perturn);
  const learnerH = learnerRows.map(r => r.holistic);
  const learnerCorr = pearsonCorrelation(learnerPT, learnerH);

  console.log(`  ${c.bold}Learner${c.reset}: r = ${formatR(learnerCorr.r)}  N = ${learnerCorr.n}  p = ${formatP(learnerCorr.p)}`);
  console.log(`    ${interpretCorrelation(learnerCorr.r, 0.60, 0.85,
    'holistic may not add value beyond per-turn average',
    'holistic measures something very different — check alignment')}`);

  if (verbose && tutorRows.length > 0) {
    console.log(`\n  ${c.dim}Tutor: mean(per-turn)=${mean(tutorPT).toFixed(1)}, SD=${standardDeviation(tutorPT).toFixed(1)}, mean(holistic)=${mean(tutorH).toFixed(1)}, SD=${standardDeviation(tutorH).toFixed(1)}${c.reset}`);
  }
  if (verbose && learnerRows.length > 0) {
    console.log(`  ${c.dim}Learner: mean(per-turn)=${mean(learnerPT).toFixed(1)}, SD=${standardDeviation(learnerPT).toFixed(1)}, mean(holistic)=${mean(learnerH).toFixed(1)}, SD=${standardDeviation(learnerH).toFixed(1)}${c.reset}`);
  }

  return { tutorCorr, learnerCorr };
}

function check2_agentToDialogue() {
  console.log(`\n${c.bold}${c.cyan}━━━ Check 2: Agent-Level → Dialogue-Level Prediction ━━━${c.reset}`);
  console.log(`${c.dim}Expected: r = 0.50–0.80${c.reset}\n`);

  const { where, params } = buildWhereClause();

  const rows = db.prepare(`
    SELECT
      tutor_overall_score,
      learner_overall_score,
      dialogue_quality_score
    FROM evaluation_results
    ${where} ${where ? 'AND' : 'WHERE'}
      tutor_overall_score IS NOT NULL
      AND learner_overall_score IS NOT NULL
      AND dialogue_quality_score IS NOT NULL
  `).all(...params);

  const agentComposite = rows.map(r => (r.tutor_overall_score + r.learner_overall_score) / 2);
  const dialogue = rows.map(r => r.dialogue_quality_score);
  const corr = pearsonCorrelation(agentComposite, dialogue);

  console.log(`  r(tutor+learner avg, dialogue) = ${formatR(corr.r)}  N = ${corr.n}  p = ${formatP(corr.p)}`);
  console.log(`    ${interpretCorrelation(corr.r, 0.50, 0.80,
    'dialogue rubric adds nothing beyond combined agent scores',
    'dialogue rubric measures emergent construct not captured by agents — potentially good')}`);

  if (verbose && rows.length > 0) {
    console.log(`\n  ${c.dim}mean(agent composite)=${mean(agentComposite).toFixed(1)}, mean(dialogue)=${mean(dialogue).toFixed(1)}${c.reset}`);
  }

  return corr;
}

function check3_publicVsFull() {
  console.log(`\n${c.bold}${c.cyan}━━━ Check 3: Public vs Full Dialogue Quality ━━━${c.reset}`);
  console.log(`${c.dim}Expected: r = 0.70–0.90${c.reset}\n`);

  const { where, params } = buildWhereClause();

  const rows = db.prepare(`
    SELECT
      dialogue_quality_score AS public_score,
      dialogue_quality_internal_score AS full_score
    FROM evaluation_results
    ${where} ${where ? 'AND' : 'WHERE'}
      dialogue_quality_score IS NOT NULL
      AND dialogue_quality_internal_score IS NOT NULL
  `).all(...params);

  const pub = rows.map(r => r.public_score);
  const full = rows.map(r => r.full_score);
  const corr = pearsonCorrelation(pub, full);

  console.log(`  r(public, full) = ${formatR(corr.r)}  N = ${corr.n}  p = ${formatP(corr.p)}`);
  console.log(`    ${interpretCorrelation(corr.r, 0.70, 0.90,
    'internal trace adds no information',
    'seeing internals substantially changes assessment — investigate')}`);

  if (verbose && rows.length > 0) {
    const diff = rows.map(r => r.full_score - r.public_score);
    console.log(`\n  ${c.dim}mean(public)=${mean(pub).toFixed(1)}, mean(full)=${mean(full).toFixed(1)}, mean(Δ)=${mean(diff).toFixed(1)}${c.reset}`);
  }

  return corr;
}

function check4_deliberationToOutput() {
  console.log(`\n${c.bold}${c.cyan}━━━ Check 4: Deliberation → Output Quality ━━━${c.reset}`);
  console.log(`${c.dim}Expected: r = 0.30–0.60 (multi-agent cells only)${c.reset}\n`);

  const { where, params } = buildWhereClause();

  // Tutor deliberation vs tutor output
  const tutorRows = db.prepare(`
    SELECT
      tutor_deliberation_score AS delib,
      tutor_overall_score AS output
    FROM evaluation_results
    ${where} ${where ? 'AND' : 'WHERE'}
      tutor_deliberation_score IS NOT NULL
      AND tutor_overall_score IS NOT NULL
  `).all(...params);

  const tutorDelib = tutorRows.map(r => r.delib);
  const tutorOutput = tutorRows.map(r => r.output);
  const tutorCorr = pearsonCorrelation(tutorDelib, tutorOutput);

  console.log(`  ${c.bold}Tutor${c.reset}: r(deliberation, output) = ${formatR(tutorCorr.r)}  N = ${tutorCorr.n}  p = ${formatP(tutorCorr.p)}`);
  console.log(`    ${interpretCorrelation(tutorCorr.r, 0.30, 0.60,
    'output quality entirely determined by deliberation — agent scoring may be redundant',
    'deliberation quality unrelated to output — architecture may not be working')}`);

  // Learner deliberation vs learner output
  const learnerRows = db.prepare(`
    SELECT
      learner_deliberation_score AS delib,
      learner_overall_score AS output
    FROM evaluation_results
    ${where} ${where ? 'AND' : 'WHERE'}
      learner_deliberation_score IS NOT NULL
      AND learner_overall_score IS NOT NULL
  `).all(...params);

  const learnerDelib = learnerRows.map(r => r.delib);
  const learnerOutput = learnerRows.map(r => r.output);
  const learnerCorr = pearsonCorrelation(learnerDelib, learnerOutput);

  console.log(`  ${c.bold}Learner${c.reset}: r(deliberation, output) = ${formatR(learnerCorr.r)}  N = ${learnerCorr.n}  p = ${formatP(learnerCorr.p)}`);
  console.log(`    ${interpretCorrelation(learnerCorr.r, 0.30, 0.60,
    'output quality entirely determined by deliberation',
    'deliberation quality unrelated to output')}`);

  return { tutorCorr, learnerCorr };
}

function check5_processToRubric() {
  console.log(`\n${c.bold}${c.cyan}━━━ Check 5: Process Measures → Rubric Scores ━━━${c.reset}`);
  console.log(`${c.dim}Validates that process measures and AI-judged scores track the same constructs${c.reset}\n`);

  const { where, params } = buildWhereClause();

  // 5a: adaptationIndex → tutor_development_score
  const adaptRows = db.prepare(`
    SELECT
      adaptation_index AS process,
      tutor_development_score AS rubric
    FROM evaluation_results
    ${where} ${where ? 'AND' : 'WHERE'}
      adaptation_index IS NOT NULL
      AND tutor_development_score IS NOT NULL
  `).all(...params);

  const adaptCorr = pearsonCorrelation(
    adaptRows.map(r => r.process),
    adaptRows.map(r => r.rubric),
  );

  console.log(`  ${c.bold}5a${c.reset}: r(adaptationIndex, tutor_development) = ${formatR(adaptCorr.r)}  N = ${adaptCorr.n}  p = ${formatP(adaptCorr.p)}`);
  console.log(`    ${c.dim}Expected: > 0.40${c.reset}  ${
    isNaN(adaptCorr.r) ? `${c.dim}insufficient data${c.reset}` :
    adaptCorr.r > 0.40 ? `${c.green}✓ convergent validity${c.reset}` :
    adaptCorr.r > 0.20 ? `${c.yellow}⚠ weak convergence${c.reset}` :
    `${c.red}⚠ divergent — measures may track different constructs${c.reset}`
  }`);

  // 5b: learnerGrowthIndex → learner_holistic_overall_score
  const growthRows = db.prepare(`
    SELECT
      learner_growth_index AS process,
      learner_holistic_overall_score AS rubric
    FROM evaluation_results
    ${where} ${where ? 'AND' : 'WHERE'}
      learner_growth_index IS NOT NULL
      AND learner_holistic_overall_score IS NOT NULL
  `).all(...params);

  const growthCorr = pearsonCorrelation(
    growthRows.map(r => r.process),
    growthRows.map(r => r.rubric),
  );

  console.log(`  ${c.bold}5b${c.reset}: r(learnerGrowthIndex, learner_holistic) = ${formatR(growthCorr.r)}  N = ${growthCorr.n}  p = ${formatP(growthCorr.p)}`);
  console.log(`    ${c.dim}Expected: > 0.30${c.reset}  ${
    isNaN(growthCorr.r) ? `${c.dim}insufficient data${c.reset}` :
    growthCorr.r > 0.30 ? `${c.green}✓ convergent validity${c.reset}` :
    growthCorr.r > 0.15 ? `${c.yellow}⚠ weak convergence${c.reset}` :
    `${c.red}⚠ divergent${c.reset}`
  }`);

  // 5c: incorporationRate → tutor_deliberation_score
  const incorpRows = db.prepare(`
    SELECT
      incorporation_rate AS process,
      tutor_deliberation_score AS rubric
    FROM evaluation_results
    ${where} ${where ? 'AND' : 'WHERE'}
      incorporation_rate IS NOT NULL
      AND tutor_deliberation_score IS NOT NULL
  `).all(...params);

  const incorpCorr = pearsonCorrelation(
    incorpRows.map(r => r.process),
    incorpRows.map(r => r.rubric),
  );

  console.log(`  ${c.bold}5c${c.reset}: r(incorporationRate, tutor_deliberation) = ${formatR(incorpCorr.r)}  N = ${incorpCorr.n}  p = ${formatP(incorpCorr.p)}`);
  console.log(`    ${c.dim}Expected: > 0.40${c.reset}  ${
    isNaN(incorpCorr.r) ? `${c.dim}insufficient data${c.reset}` :
    incorpCorr.r > 0.40 ? `${c.green}✓ convergent validity${c.reset}` :
    incorpCorr.r > 0.20 ? `${c.yellow}⚠ weak convergence${c.reset}` :
    `${c.red}⚠ divergent${c.reset}`
  }`);

  // 5d: bilateralTransformationIndex → dialogue_quality_score
  const bilateralRows = db.prepare(`
    SELECT
      bilateral_transformation_index AS process,
      dialogue_quality_score AS rubric
    FROM evaluation_results
    ${where} ${where ? 'AND' : 'WHERE'}
      bilateral_transformation_index IS NOT NULL
      AND dialogue_quality_score IS NOT NULL
  `).all(...params);

  const bilateralCorr = pearsonCorrelation(
    bilateralRows.map(r => r.process),
    bilateralRows.map(r => r.rubric),
  );

  console.log(`  ${c.bold}5d${c.reset}: r(bilateralTransformation, dialogue_quality) = ${formatR(bilateralCorr.r)}  N = ${bilateralCorr.n}  p = ${formatP(bilateralCorr.p)}`);
  console.log(`    ${c.dim}(bonus check — bilateral transformation should predict dialogue quality)${c.reset}`);

  return { adaptCorr, growthCorr, incorpCorr, bilateralCorr };
}

// ── Data availability summary ──

function dataSummary() {
  const { where, params } = buildWhereClause();

  const counts = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN tutor_overall_score IS NOT NULL THEN 1 ELSE 0 END) AS tutor_perturn,
      SUM(CASE WHEN tutor_holistic_overall_score IS NOT NULL THEN 1 ELSE 0 END) AS tutor_holistic,
      SUM(CASE WHEN learner_overall_score IS NOT NULL THEN 1 ELSE 0 END) AS learner_perturn,
      SUM(CASE WHEN learner_holistic_overall_score IS NOT NULL THEN 1 ELSE 0 END) AS learner_holistic,
      SUM(CASE WHEN dialogue_quality_score IS NOT NULL THEN 1 ELSE 0 END) AS dialogue_public,
      SUM(CASE WHEN dialogue_quality_internal_score IS NOT NULL THEN 1 ELSE 0 END) AS dialogue_full,
      SUM(CASE WHEN tutor_deliberation_score IS NOT NULL THEN 1 ELSE 0 END) AS tutor_delib,
      SUM(CASE WHEN learner_deliberation_score IS NOT NULL THEN 1 ELSE 0 END) AS learner_delib,
      SUM(CASE WHEN adaptation_index IS NOT NULL THEN 1 ELSE 0 END) AS has_adaptation,
      SUM(CASE WHEN learner_growth_index IS NOT NULL THEN 1 ELSE 0 END) AS has_growth,
      SUM(CASE WHEN incorporation_rate IS NOT NULL THEN 1 ELSE 0 END) AS has_incorporation,
      SUM(CASE WHEN bilateral_transformation_index IS NOT NULL THEN 1 ELSE 0 END) AS has_bilateral
    FROM evaluation_results
    ${where}
  `).get(...params);

  console.log(`${c.bold}${c.magenta}═══ Cross-Level Rubric Consistency Analysis ═══${c.reset}\n`);

  if (runId) console.log(`  Run: ${c.bold}${runId}${c.reset}`);
  if (judgeFilter) console.log(`  Judge filter: ${c.bold}${judgeFilter}${c.reset}`);
  console.log(`  Multi-turn rows: ${c.bold}${counts.total}${c.reset}\n`);

  console.log(`  ${c.bold}Data availability:${c.reset}`);
  console.log(`    L1 Tutor per-turn:        ${counts.tutor_perturn}`);
  console.log(`    L2 Learner per-turn:       ${counts.learner_perturn}`);
  console.log(`    L3 Tutor holistic:         ${counts.tutor_holistic}`);
  console.log(`    L4 Learner holistic:       ${counts.learner_holistic}`);
  console.log(`    L5a Dialogue (public):     ${counts.dialogue_public}`);
  console.log(`    L5b Dialogue (full):       ${counts.dialogue_full}`);
  console.log(`    L6a Tutor deliberation:    ${counts.tutor_delib}`);
  console.log(`    L6b Learner deliberation:  ${counts.learner_delib}`);
  console.log(`    Process: adaptation_index: ${counts.has_adaptation}`);
  console.log(`    Process: growth_index:     ${counts.has_growth}`);
  console.log(`    Process: incorporation:    ${counts.has_incorporation}`);
  console.log(`    Process: bilateral:        ${counts.has_bilateral}`);

  return counts;
}

// ── Summary matrix ──

function summaryMatrix(results) {
  console.log(`\n${c.bold}${c.magenta}═══ Summary Matrix ═══${c.reset}\n`);
  console.log(`  ${'Check'.padEnd(50)}  ${'r'.padStart(7)}  ${'N'.padStart(5)}  ${'p'.padStart(8)}  ${'Range'.padStart(11)}  Verdict`);
  console.log(`  ${'─'.repeat(50)}  ${'─'.repeat(7)}  ${'─'.repeat(5)}  ${'─'.repeat(8)}  ${'─'.repeat(11)}  ${'─'.repeat(30)}`);

  const rows = [
    ['1  Tutor per-turn → holistic', results.check1.tutorCorr, '0.60–0.85'],
    ['1  Learner per-turn → holistic', results.check1.learnerCorr, '0.60–0.85'],
    ['2  Agent composite → dialogue', results.check2, '0.50–0.80'],
    ['3  Public vs full dialogue', results.check3, '0.70–0.90'],
    ['4  Tutor deliberation → output', results.check4.tutorCorr, '0.30–0.60'],
    ['4  Learner deliberation → output', results.check4.learnerCorr, '0.30–0.60'],
    ['5a adaptationIndex → dev score', results.check5.adaptCorr, '>0.40'],
    ['5b growthIndex → learner holistic', results.check5.growthCorr, '>0.30'],
    ['5c incorporationRate → delib', results.check5.incorpCorr, '>0.40'],
    ['5d bilateral → dialogue quality', results.check5.bilateralCorr, '—'],
  ];

  for (const [label, corr, range] of rows) {
    const r = isNaN(corr.r) ? '  —  ' : (corr.r >= 0 ? '+' : '') + corr.r.toFixed(3);
    const n = isNaN(corr.n) ? '—' : String(corr.n);
    const p = formatP(corr.p);
    const verdict = isNaN(corr.r) ? `${c.dim}no data${c.reset}` :
      (corr.n < 10 ? `${c.yellow}low N${c.reset}` :
       (corr.p < 0.05 ? `${c.green}sig${c.reset}` : `${c.dim}ns${c.reset}`));
    console.log(`  ${label.padEnd(50)}  ${r.padStart(7)}  ${n.padStart(5)}  ${p.padStart(8)}  ${range.padStart(11)}  ${verdict}`);
  }

  // Overall assessment
  const sigChecks = rows.filter(([, corr]) => !isNaN(corr.r) && corr.n >= 10);
  const inRange = sigChecks.filter(([, corr]) => corr.p < 0.05);
  console.log(`\n  ${c.bold}Testable checks: ${sigChecks.length}/10${c.reset}  |  ${c.bold}Significant: ${inRange.length}/${sigChecks.length}${c.reset}`);

  if (sigChecks.length === 0) {
    console.log(`\n  ${c.yellow}No checks have sufficient data. Run 'evaluate' on multi-turn runs to populate scores,`);
    console.log(`  then backfill process measures by re-running this script.${c.reset}`);
  }
}

// ── Main ──

const _counts = dataSummary();

const results = {
  check1: check1_perTurnToHolistic(),
  check2: check2_agentToDialogue(),
  check3: check3_publicVsFull(),
  check4: check4_deliberationToOutput(),
  check5: check5_processToRubric(),
};

summaryMatrix(results);

console.log('');
db.close();
