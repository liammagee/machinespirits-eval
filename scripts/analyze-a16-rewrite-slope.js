#!/usr/bin/env node
/**
 * analyze-a16-rewrite-slope.js — §6.3.10 (A16) pre-registered primary endpoint.
 *
 * Question (paper-full-2.0.md §6.3.10): does a *cumulative-rewrite* superego
 * (S1 = cell_130_superego_revise_cumulative) produce a RATE effect that a
 * byte-identical *stateless-rewrite* superego (S0 = cell_129_superego_revise_
 * stateless) does not — i.e. is the externalised in-family policyAction
 * indicator's per-dialogue OLS slope reliably higher for S1 than S0?
 *
 * Primary endpoint (pre-registered):
 *   - For each clean dialogue, build the per-turn binary indicator
 *     in_family_t = 1[ familyOf(policyAction_t) === expectedFamily(scenario) ]
 *     over the FULL UNCAPPED dialogue (all perTurn entries of the `original`
 *     branch with a non-null policyAction).
 *   - Per-dialogue OLS slope of in_family_t on turn index (the §6.3.2/§6.3.4
 *     per-turn OLS slope machinery, parameterised to the in-family indicator
 *     instead of a rubric dimension).
 *   - Decisive contrast: S1 − S0 Cohen's d on the per-dialogue slope
 *     distributions, against the §6.3.2 80%-power detectability bar
 *     |d| >= 0.27. Pre-registration: a null is as informative as a hit
 *     (extends the §6.3 slope-null to cumulative lightweight rewrite).
 *
 * Secondary criteria reported (partial until A/F arms finish):
 *   (2) channel localisation — A (cell_131, advisory ego_superego) and F
 *       (cell_132, recognition_only floor) mean slopes ~ 0 / not above S0.
 *   (3) cross-judge robustness — N/A by construction: the in-family
 *       policyAction indicator is an externalised programmatic label, not a
 *       judged rubric score, so it is judge-independent. (Criterion 3 in the
 *       pre-registration applies to the rubric-scored secondary endpoint.)
 *   (4) brittleness guard — counterfactual-branch in-family "false-fire"
 *       rate not greater for S1 than S0 (computed where a counterfactual
 *       branch exists; coverage reported).
 *
 * Pooling is config-clean: runId is only a batch label; profile +
 * ADAPTIVE_TUTOR_LLM=real are byte-identical per arm across quota windows
 * (see /Users/lmagee/.claude/jobs/05bb1981/P3-RUNID-LEDGER.md).
 *
 * Usage:
 *   node scripts/analyze-a16-rewrite-slope.js \
 *     --arm 'S1:cell_130_superego_revise_cumulative=eval-2026-05-17-59efc743,eval-2026-05-17-180f1610' \
 *     --arm 'S0:cell_129_superego_revise_stateless=eval-2026-05-17-f1d2fdda,eval-2026-05-17-73af0f28,eval-2026-05-17-b76058ea' \
 *     [--arm 'A:cell_131_a16_A_egosuperego=<runIds>'] \
 *     [--arm 'F:cell_132_a16_F_recognition_only=<runIds>'] \
 *     [--out exports/a16-rewrite-slope.json]
 *
 * With no --arm flags, the decisive pair (S1, S0) defaults to the pooled
 * runIds recorded in the P3 ledger as of 2026-05-17.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.EVAL_DB_PATH || path.join(REPO_ROOT, 'data', 'evaluations.db');
const LOGS_DIR = path.join(process.env.EVAL_LOGS_DIR || path.join(REPO_ROOT, 'logs'), 'tutor-dialogues');

// ── Pedagogical family map ───────────────────────────────────────────
// Copied verbatim from scripts/analyze-strategy-shift.js (which in turn
// derives it from config/adaptive-policy-actions.yaml trigger_conditions /
// contraindications). Kept as a local copy — same pattern the codebase
// already uses — so this script is a faithful standalone parameterisation
// of the pre-registered in-family indicator. If the family grouping in
// analyze-strategy-shift.js changes, mirror the change here.
const POLICY_FAMILIES = Object.freeze({
  substantive_engagement: [
    'mirror_and_extend',
    'scope_test',
    'name_the_disagreement',
    'pose_counterexample',
    'invite_objection',
  ],
  diagnostic: ['ask_diagnostic_question', 'request_elaboration', 'summarize_and_check'],
  scaffolding: ['give_worked_example', 'lower_cognitive_load', 'provide_hint', 'withhold_answer'],
  repair_affective: ['repair_misrecognition', 'acknowledge_and_redirect'],
});
const POLICY_TO_FAMILY = (() => {
  const m = new Map();
  for (const [family, actions] of Object.entries(POLICY_FAMILIES)) {
    for (const a of actions) m.set(a, family);
  }
  return m;
})();
const familyOf = (action) => POLICY_TO_FAMILY.get(action) || null;

// expectedFamilyOf collapses an expectedStrategyShift (string or array of
// pedagogically-equivalent labels) into a single family. Returns null when
// the accepted set spans multiple families (none of the trap scenarios do,
// but handled defensively — such a dialogue is excluded, with reason).
function expectedFamilyOf(expectedShift) {
  if (expectedShift == null) return null;
  const accepted = Array.isArray(expectedShift) ? expectedShift : [expectedShift];
  const families = new Set(accepted.map(familyOf).filter(Boolean));
  if (families.size === 1) return [...families][0];
  return null;
}

// ── Stats ────────────────────────────────────────────────────────────
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
function sd(xs) {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
// OLS slope of ys on xs. null when < 2 points or x has zero variance
// (degenerate — cannot define a rate). y constant ⇒ slope 0 (a real,
// meaningful "no rate" outcome, NOT excluded).
function olsSlope(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}
// Cohen's d with pooled SD (S1 − S0 convention; positive ⇒ S1 > S0).
function cohenD(a, b) {
  const na = a.length;
  const nb = b.length;
  if (na < 2 || nb < 2) return null;
  const ma = mean(a);
  const mb = mean(b);
  const va = a.reduce((s, x) => s + (x - ma) ** 2, 0) / (na - 1);
  const vb = b.reduce((s, x) => s + (x - mb) ** 2, 0) / (nb - 1);
  const pooled = Math.sqrt(((na - 1) * va + (nb - 1) * vb) / (na + nb - 2));
  if (pooled === 0) return null;
  return (ma - mb) / pooled;
}
// Welch two-sample t and two-sided p (context only — not pre-registered;
// the pre-registered decision is the Cohen's d vs the 0.27 bar).
function welch(a, b) {
  const na = a.length;
  const nb = b.length;
  if (na < 2 || nb < 2) return null;
  const ma = mean(a);
  const mb = mean(b);
  const va = a.reduce((s, x) => s + (x - ma) ** 2, 0) / (na - 1);
  const vb = b.reduce((s, x) => s + (x - mb) ** 2, 0) / (nb - 1);
  const se = Math.sqrt(va / na + vb / nb);
  if (se === 0) return null;
  const t = (ma - mb) / se;
  const df = (va / na + vb / nb) ** 2 / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1));
  // two-sided p via a small-error normal approx of the t tail (df reported
  // alongside so the approximation is auditable; exact p is not the
  // pre-registered decision rule).
  const z = Math.abs(t);
  const p = 2 * (1 - 0.5 * (1 + erf(z / Math.SQRT2)));
  return { t, df, p };
}
function erf(x) {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const pp = 0.3275911;
  const tt = 1 / (1 + pp * x);
  const y = 1 - ((((a5 * tt + a4) * tt + a3) * tt + a2) * tt + a1) * tt * Math.exp(-x * x);
  return s * y;
}

// ── CLI ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const armSpecs = [];
let outPath = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--arm' && argv[i + 1]) armSpecs.push(argv[++i]);
  else if (argv[i] === '--out' && argv[i + 1]) outPath = argv[++i];
}
if (armSpecs.length === 0) {
  // Decisive pair defaults — pooled runIds per the P3 ledger (2026-05-17).
  armSpecs.push('S1:cell_130_superego_revise_cumulative=eval-2026-05-17-59efc743,eval-2026-05-17-180f1610');
  armSpecs.push(
    'S0:cell_129_superego_revise_stateless=eval-2026-05-17-f1d2fdda,eval-2026-05-17-73af0f28,eval-2026-05-17-b76058ea',
  );
}
// "LABEL:profile_name=runId,runId,..."
const arms = armSpecs.map((spec) => {
  const [label, rest] = spec.split(':');
  const [profile, runIdCsv] = rest.split('=');
  return {
    label: label.trim(),
    profile: profile.trim(),
    runIds: runIdCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
});

// ── Per-dialogue in-family slope ─────────────────────────────────────
function loadTrace(dialogueId) {
  const p = path.join(LOGS_DIR, `${dialogueId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

// Returns { slope, nTurns, expectedFamily, reason } for the `original`
// branch. slope===null with a reason ⇒ excluded from the arm's slope
// sample (counted, reason tallied).
function dialogueInFamilySlope(trace) {
  if (!trace || !trace.original || !Array.isArray(trace.original.perTurn)) {
    return { slope: null, reason: 'no_original_perTurn' };
  }
  const expectedFamily = expectedFamilyOf(trace.scenario && trace.scenario.expectedStrategyShift);
  if (!expectedFamily) return { slope: null, reason: 'expected_family_unresolved' };
  const turns = [...trace.original.perTurn].sort((a, b) => a.turn - b.turn);
  const xs = [];
  const ys = [];
  for (const t of turns) {
    const action = t.tutorInternal && t.tutorInternal.policyAction;
    if (!action) continue; // indicator undefined for turns with no action
    xs.push(t.turn);
    ys.push(familyOf(action) === expectedFamily ? 1 : 0);
  }
  if (xs.length < 2) return { slope: null, reason: 'fewer_than_2_action_turns', nTurns: xs.length };
  const slope = olsSlope(xs, ys);
  if (slope === null) return { slope: null, reason: 'degenerate_x', nTurns: xs.length };
  return { slope, nTurns: xs.length, expectedFamily, inFamilyMean: mean(ys) };
}

// Counterfactual-branch in-family "false-fire" rate: fraction of cf turns
// (where it exists) whose policyAction is in the expected family. Used for
// the brittleness guard (criterion 4): a *higher* cf in-family rate for S1
// than S0 would mean cumulative rewrite makes the architecture fire the
// trap-correct family even when the trap signal was counterfactually
// removed (brittle / state-insensitive). Lower-or-equal for S1 = passes.
function dialogueCfInFamilyRate(trace) {
  if (!trace || !trace.counterfactual || !Array.isArray(trace.counterfactual.perTurn)) return null;
  const expectedFamily = expectedFamilyOf(trace.scenario && trace.scenario.expectedStrategyShift);
  if (!expectedFamily) return null;
  let n = 0;
  let hit = 0;
  for (const t of trace.counterfactual.perTurn) {
    const action = t.tutorInternal && t.tutorInternal.policyAction;
    if (!action) continue;
    n++;
    if (familyOf(action) === expectedFamily) hit++;
  }
  return n > 0 ? { rate: hit / n, n } : null;
}

// ── Run ──────────────────────────────────────────────────────────────
const db = new Database(DB_PATH, { readonly: true });
const armResults = {};
for (const arm of arms) {
  const ph = arm.runIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT dialogue_id, scenario_type, run_id FROM evaluation_results
       WHERE run_id IN (${ph}) AND profile_name = ?
         AND suggestions NOT IN ('[]','')`,
    )
    .all(...arm.runIds, arm.profile);
  const slopes = [];
  const perScenario = {};
  const excluded = {};
  const cfRates = [];
  for (const r of rows) {
    const trace = loadTrace(r.dialogue_id);
    const res = dialogueInFamilySlope(trace);
    if (res.slope === null) {
      excluded[res.reason] = (excluded[res.reason] || 0) + 1;
      continue;
    }
    slopes.push(res.slope);
    const st = r.scenario_type || 'unknown';
    (perScenario[st] = perScenario[st] || []).push(res.slope);
    const cf = dialogueCfInFamilyRate(trace);
    if (cf) cfRates.push(cf.rate);
  }
  armResults[arm.label] = {
    profile: arm.profile,
    runIds: arm.runIds,
    nCleanRows: rows.length,
    nSlopes: slopes.length,
    excluded,
    meanSlope: slopes.length ? mean(slopes) : null,
    sdSlope: sd(slopes),
    slopes,
    perScenarioMeanSlope: Object.fromEntries(
      Object.entries(perScenario).map(([k, v]) => [k, { n: v.length, mean: mean(v) }]),
    ),
    cfInFamilyRate: cfRates.length ? { n: cfRates.length, mean: mean(cfRates) } : null,
  };
}
db.close();

// ── Decisive contrast + decision grid ────────────────────────────────
const S1 = armResults.S1;
const S0 = armResults.S0;
let primary = null;
if (S1 && S0 && S1.slopes.length >= 2 && S0.slopes.length >= 2) {
  const d = cohenD(S1.slopes, S0.slopes);
  const w = welch(S1.slopes, S0.slopes);
  const BAR = 0.27;
  primary = {
    contrast: 'S1 − S0 (sole config difference: ledger-statefulness)',
    s1: { n: S1.slopes.length, meanSlope: S1.meanSlope, sdSlope: S1.sdSlope },
    s0: { n: S0.slopes.length, meanSlope: S0.meanSlope, sdSlope: S0.sdSlope },
    meanSlopeDiff: S1.meanSlope - S0.meanSlope,
    cohenD: d,
    welch: w,
    preRegBar: BAR,
    predictedDirection: 'S1 > S0 (cumulative rewrite ⇒ positive in-family rate)',
    decision:
      d === null
        ? 'INSUFFICIENT N'
        : Math.abs(d) >= BAR
          ? d > 0
            ? `HIT — |d|=${d.toFixed(3)} ≥ ${BAR}, sign matches prediction (S1 > S0)`
            : `DETECTABLE BUT WRONG SIGN — |d|=${d.toFixed(3)} ≥ ${BAR} but S0 > S1`
          : `NULL — |d|=${d.toFixed(3)} < ${BAR} (pre-registered: a null is as informative as a hit; extends the §6.3 slope-null to cumulative lightweight rewrite)`,
  };
}

// ── Criterion 2: channel-localisation grid ───────────────────────────
// Pre-reg: localisation HOLDS iff A and S0 slope ≈ 0 vs F (|d| < 0.15).
// S0 (or S1) materially above F ⇒ the rewrite channel itself carries
// rate ⇒ criterion 2 FAILS as pre-specified, and the S1−S0 null reads
// as "cumulation adds nothing" rather than "rewrite is inert". The
// A-anchored contrasts (S0−A, S1−A) isolate rewrite-channel rate from
// advisory-channel rate and are exact whenever both arms are at full n.
const LOC_BAND = 0.15; // pre-registered localisation band
const pair = (x, y) =>
  x && y && x.slopes.length >= 2 && y.slopes.length >= 2
    ? {
        nX: x.slopes.length,
        nY: y.slopes.length,
        meanDiff: x.meanSlope - y.meanSlope,
        cohenD: cohenD(x.slopes, y.slopes),
        welch: welch(x.slopes, y.slopes),
      }
    : null;
const localisation = {
  band: LOC_BAND,
  detectabilityBar: 0.27,
  note: 'vs-F rows are PROVISIONAL until F reaches full n; A-anchored rows (S0−A, S1−A) are exact at full n',
  contrasts: {
    'S0-F': pair(armResults.S0, armResults.F),
    'S1-F': pair(armResults.S1, armResults.F),
    'A-F': pair(armResults.A, armResults.F),
    'S0-A': pair(armResults.S0, armResults.A),
    'S1-A': pair(armResults.S1, armResults.A),
  },
};

const out = {
  generatedAt: new Date().toISOString(),
  endpoint: 'per-dialogue OLS slope of in-family policyAction indicator (uncapped), S1−S0 Cohen’s d vs |d|≥0.27',
  arms: armResults,
  primary,
  localisation,
};

// ── Print ────────────────────────────────────────────────────────────
const f3 = (x) => (x === null || x === undefined ? 'n/a' : Number(x).toFixed(3));
console.log('\n=== §6.3.10 (A16) — in-family policyAction per-dialogue slope ===\n');
console.log('arm  profile                                  runs  clean  slopes  meanSlope   sdSlope');
for (const [label, a] of Object.entries(armResults)) {
  console.log(
    `${label.padEnd(4)} ${a.profile.padEnd(40)} ${String(a.runIds.length).padStart(4)} ${String(a.nCleanRows).padStart(6)} ${String(a.nSlopes).padStart(7)}  ${f3(a.meanSlope).padStart(9)}  ${f3(a.sdSlope).padStart(8)}`,
  );
  if (Object.keys(a.excluded).length) console.log(`     excluded: ${JSON.stringify(a.excluded)}`);
}
if (primary) {
  console.log('\n--- PRIMARY (pre-registered decisive contrast) ---');
  console.log(`  S1 mean slope = ${f3(primary.s1.meanSlope)} (sd ${f3(primary.s1.sdSlope)}, n=${primary.s1.n})`);
  console.log(`  S0 mean slope = ${f3(primary.s0.meanSlope)} (sd ${f3(primary.s0.sdSlope)}, n=${primary.s0.n})`);
  console.log(`  mean slope diff (S1−S0) = ${f3(primary.meanSlopeDiff)}`);
  console.log(`  Cohen's d (S1−S0, pooled) = ${f3(primary.cohenD)}   [pre-reg bar |d| ≥ ${primary.preRegBar}]`);
  if (primary.welch)
    console.log(
      `  Welch t = ${f3(primary.welch.t)}, df ≈ ${f3(primary.welch.df)}, p ≈ ${f3(primary.welch.p)} (context only)`,
    );
  console.log(`  → ${primary.decision}`);
}
console.log('\n--- secondary criteria ---');
console.log(
  `  (2) channel localisation : band |d| < ${localisation.band} (holds) · detectability |d| ≥ ${localisation.detectabilityBar}`,
);
for (const [name, c] of Object.entries(localisation.contrasts)) {
  if (!c) {
    console.log(`        ${name.padEnd(6)} : (arm not present)`);
    continue;
  }
  const ad = Math.abs(c.cohenD);
  const verdict =
    ad < localisation.band
      ? 'localised (≈0)'
      : ad >= localisation.detectabilityBar
        ? 'DETECTABLE separation'
        : 'between band & bar';
  const prov =
    name.endsWith('-F') && armResults.F && armResults.F.nSlopes < 48
      ? '  [PROVISIONAL: F n=' + armResults.F.nSlopes + ']'
      : '';
  console.log(
    `        ${name.padEnd(6)} : Δmean=${f3(c.meanDiff)}  d=${f3(c.cohenD)}  (n ${c.nX}v${c.nY})  → ${verdict}${prov}`,
  );
}
console.log(
  '  (3) cross-judge          : N/A by construction (in-family policyAction is an externalised programmatic label, judge-independent)',
);
const g1 = armResults.S1 && armResults.S1.cfInFamilyRate;
const g0 = armResults.S0 && armResults.S0.cfInFamilyRate;
if (g1 && g0) {
  const pass = g1.mean <= g0.mean + 1e-9;
  console.log(
    `  (4) brittleness guard    : cf in-family rate S1=${f3(g1.mean)} (n=${g1.n}) vs S0=${f3(g0.mean)} (n=${g0.n}) → ${pass ? 'PASS (S1 not > S0)' : 'FAIL (S1 > S0)'}`,
  );
} else {
  console.log(
    '  (4) brittleness guard    : no counterfactual branches in pooled traces for this suite (adaptive-trap-scenarios.yaml has counterfactual=null) — not computable; report as not-applicable for this run',
  );
}

if (outPath) {
  const abs = path.isAbsolute(outPath) ? outPath : path.join(REPO_ROOT, outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(out, null, 2));
  console.log(`\nJSON → ${abs}`);
}
