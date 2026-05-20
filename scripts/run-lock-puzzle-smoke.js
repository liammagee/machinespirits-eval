#!/usr/bin/env node
// A17 speech-act-lock — mock + hermetic smoke (task #2).
//
// notes/design-a17-speech-act-lock-prototype.md §7 step 1:
//   "ADAPTIVE_TUTOR_LLM=mock, hermetic EVAL_DB_PATH/EVAL_LOGS_DIR —
//    run-lock-puzzle-smoke.js proves the unlock predicate, the move-efficacy
//    persistence channel, and the three-arm wiring, and produces
//    floor/ceiling discrimination under a parameterized deterministic mock
//    learner (A1 flat ≈ floor · A2 rising · A3 ≈ ceiling). D3's N/arm then
//    follows from an analytic two-proportion power table the smoke prints."
//
// This does NOT use eval-cli / runAdaptiveEvaluation / runner.js: per project
// memory `eval-cli --dry-run` on adaptive cells STILL writes the prod DB, and
// runner.js's baseInitialState does not seed the lock/probeLog/moveLog
// channels. The smoke compiles buildGraph({architecture:'lock_puzzle'})
// directly and threads state.lock itself — fully self-contained, ZERO
// prod-DB / paper / cost. No paid API calls (mock backend, asserted below).
//
// Strict pass/fail at the bottom; non-zero exit on any failure.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// ── Hermetic isolation ───────────────────────────────────────────────────
// Defensive: the smoke drives buildGraph directly and never touches the eval
// DB, but §7 mandates the hermetic envelope regardless. Each arm gets its OWN
// move-efficacy SQLite file so A1's wipes can never reach A2's table.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a17-lock-smoke-'));
process.env.EVAL_DB_PATH = path.join(tmpDir, 'evaluations.db');
process.env.EVAL_LOGS_DIR = path.join(tmpDir, 'logs');
process.env.ADAPTIVE_TUTOR_LLM = 'mock';

// Imports come AFTER env is set so any EVAL_DB_PATH-aware module reads temp.
const { buildGraph } = await import('../services/adaptiveTutor/graph.js');
const { initialLearnerProfile, initialTutorInternal } = await import('../services/adaptiveTutor/stateSchema.js');
const { llmMode } = await import('../services/adaptiveTutor/llm.js');
const efficacy = (await import('../services/adaptiveTutor/moveEfficacyStore.js')).default;
const { MemorySaver } = await import('@langchain/langgraph');
const { deriveUnlock, unlockRateTrajectory, olsSlope, streamRiseSlope, powerTable } =
  await import('../services/adaptiveTutor/lockPuzzleOutcome.js');

if (llmMode() !== 'mock') {
  console.error(`SMOKE ABORT: expected mock backend, got '${llmMode()}' — refusing to make paid calls`);
  process.exit(1);
}

// ── Load scenarios + probe bank (the harness threads the A17 fields) ──────
const scenarioDoc = yaml.parse(fs.readFileSync(path.join(REPO_ROOT, 'config', 'lock-puzzle-scenarios.yaml'), 'utf-8'));
const probeDoc = yaml.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'config', 'lock-probes', 'fractions-unlike-denominator.yaml'), 'utf-8'),
);
const PROBE_ITEMS = probeDoc.items; // each {id, correct, misconception_distractor, ...}
const FAMILY = scenarioDoc.meta.misconception_family;
const PANEL_SIZE = scenarioDoc.meta.unlock.criterion.panel_size; // §3.3 = 3
const K = scenarioDoc.meta.unlock.criterion.consecutive_turns_all_correct; // D4 = 2
const EPSILON = 0.1; // §5 ε-greedy
const allScen = scenarioDoc.scenarios;
const heldOut = allScen.filter((s) => s.stream === 'held_out');
const training = allScen.filter((s) => s.stream === 'training');

const N_HELDOUT_SESSIONS = 16; // 4 bins × 4 — enough for A2's rise to clear noise
const N_TRAINING_SESSIONS = 12; // secondary transfer diagnostic only

// One scenario → one externalised lock-puzzle session against the mock.
async function runSession({ arm, scenario, stream, sessionIndex }) {
  const graph = buildGraph({ architecture: 'lock_puzzle' }).compile({ checkpointer: new MemorySaver() });
  const initial = {
    dialogue: scenario.opening_turns ?? [],
    learnerProfile: initialLearnerProfile(),
    tutorInternal: initialTutorInternal(),
    constraintViolations: [],
    hiddenLearnerState: {
      actualMisconception: scenario.hidden?.actual_misconception || '',
      actualSophistication: scenario.hidden?.actual_sophistication || 'novice',
      triggerTurn: scenario.hidden?.trigger_turn ?? 0,
      triggerSignal: scenario.hidden?.trigger_signal || '',
    },
    turn: 0,
    maxTurns: scenario.max_turns ?? 6,
    lock: {
      enabled: true,
      arm,
      misconceptionFamily: scenario.misconception_family || FAMILY,
      stream,
      sessionIndex,
      oracleKey: scenario.oracle_key || [],
      panelSize: PANEL_SIZE,
      consecutiveK: K,
      epsilon: EPSILON,
      probeItems: PROBE_ITEMS,
    },
  };
  const config = {
    configurable: { thread_id: `${arm}__${stream}__s${sessionIndex}__${scenario.id}` },
    recursionLimit: 200,
  };
  const final = await graph.invoke(initial, config);
  const { unlocked, unlockTurn, maxRun } = deriveUnlock(final.probeLog, K);
  return { unlocked: unlocked ? 1 : 0, unlockTurn, maxRun, probeLog: final.probeLog };
}

// Run a whole stream for one arm. A1 wipes the move table before EACH session
// (cold start — the entire operationalisation of the no-memory control, §6);
// A2 never wipes (memory persists across sessions); A3 bypasses the table in
// the graph node, so wiping is irrelevant.
async function runArmStream({ arm, scenarios, stream, nSessions, wipeEachSession }) {
  efficacy.configure({ dbPath: path.join(tmpDir, `move-efficacy-${arm}-${stream}.db`) });
  if (!wipeEachSession) efficacy.wipe(); // clean slate once at stream start
  const sessions = [];
  for (let i = 0; i < nSessions; i++) {
    if (wipeEachSession) efficacy.wipe();
    const scenario = scenarios[i % scenarios.length];
    const r = await runSession({ arm, scenario, stream, sessionIndex: i });
    sessions.push({ sessionIndex: i, unlocked: r.unlocked, unlockTurn: r.unlockTurn });
  }
  efficacy.close();
  const traj = unlockRateTrajectory(sessions, { bins: 4 });
  const slope = streamRiseSlope(sessions);
  return { sessions, traj, slope };
}

console.log(`A17 lock-puzzle smoke — mock + hermetic`);
console.log(`tmp: ${tmpDir}`);
console.log(
  `family=${FAMILY} panel_size=${PANEL_SIZE} k=${K} ε=${EPSILON} ` +
    `held_out_scenarios=${heldOut.length} sessions/arm=${N_HELDOUT_SESSIONS}\n`,
);

// ── Primary: clean three-arm held-out trajectory (no warmup) ─────────────
const A1 = await runArmStream({
  arm: 'A1_no_memory',
  scenarios: heldOut,
  stream: 'held_out',
  nSessions: N_HELDOUT_SESSIONS,
  wipeEachSession: true,
});
const A2 = await runArmStream({
  arm: 'A2_persistent',
  scenarios: heldOut,
  stream: 'held_out',
  nSessions: N_HELDOUT_SESSIONS,
  wipeEachSession: false,
});
const A3 = await runArmStream({
  arm: 'A3_oracle',
  scenarios: heldOut,
  stream: 'held_out',
  nSessions: N_HELDOUT_SESSIONS,
  wipeEachSession: false,
});

const binRates = (t) => t.traj.binned.map((b) => b.rate.toFixed(2)).join(' → ');
const fmt = (arm, r) =>
  `  ${arm}: overall=${r.traj.overallRate.toFixed(3)}  riseSlope=${r.slope.toFixed(4)}  ` +
  `bins[${binRates(r)}]  series=[${r.traj.series.join('')}]`;

console.log('=== Held-out unlock trajectory (PRIMARY — §8 outcome surface) ===');
console.log(fmt('A1 (no-memory · floor )', A1));
console.log(fmt('A2 (persistent · test )', A2));
console.log(fmt('A3 (oracle · ceiling  )', A3));

const a1Overall = A1.traj.overallRate;
const a2FirstBin = A2.traj.binned[0]?.rate ?? 0;
const a2LastBin = A2.traj.binned[A2.traj.binned.length - 1]?.rate ?? 0;
const a3Overall = A3.traj.overallRate;
const a2Rise = a2LastBin - a2FirstBin;

// ── Secondary diagnostic: A2 warmed on the TRAINING stream, then measured
// cold on held-out. Evidences the persistence channel carries ACROSS
// SURFACES (the construct's transfer claim, §3.2) for ~one extra loop's
// cost. Soft-asserted only — the PRIMARY contrast is the held-out rise.
efficacy.configure({ dbPath: path.join(tmpDir, 'move-efficacy-A2-warm.db') });
efficacy.wipe();
for (let i = 0; i < N_TRAINING_SESSIONS; i++) {
  const scenario = training[i % training.length];
  await runSession({ arm: 'A2_persistent', scenario, stream: 'training', sessionIndex: i });
}
const warmSessions = [];
for (let i = 0; i < heldOut.length; i++) {
  const r = await runSession({
    arm: 'A2_persistent',
    scenario: heldOut[i % heldOut.length],
    stream: 'held_out',
    sessionIndex: i,
  });
  warmSessions.push({ sessionIndex: i, unlocked: r.unlocked });
}
efficacy.close();
const warmRate = unlockRateTrajectory(warmSessions).overallRate;
console.log(
  `\n=== Secondary (transfer diagnostic) ===\n` +
    `  A2 warmed on ${N_TRAINING_SESSIONS} training sessions, then held-out ` +
    `(unseen surface, same misconception): overall=${warmRate.toFixed(3)}\n` +
    `  cf. A2 cold held-out first bin=${a2FirstBin.toFixed(2)} — warmed should clear it (transfer, not memorisation)`,
);

// ── Analytic two-proportion power table (D3) ─────────────────────────────
// Binary unlock ⇒ the A2−A1 contrast is a difference of proportions; its
// variance is analytic p(1−p)/n (worst case p≈0.5), NOT mock-estimated. The
// mock's job above was pipeline + floor/ceiling discrimination ONLY.
const DELTA_STAR = 0.15; // D1 proposed
const pt = powerTable({
  deltaStar: DELTA_STAR,
  baselines: [0.1, 0.2, 0.3, 0.4, 0.5],
  alpha: 0.05,
  power: 0.8,
  runsPerCluster: 8, // D3: 12 puzzles × 8 runs ⇒ m = 8
  icc: 0.05,
  proposedNPerArm: 96, // D3: 12 × 8
});
console.log(`\n=== Analytic two-proportion power table (D3 · Δ*=${DELTA_STAR}) ===`);
console.log(
  `  design effect (m=${pt.runsPerCluster}, ICC=${pt.icc}) = ${pt.designEffect}   ` +
    `proposed N/arm = ${pt.proposedNPerArm}`,
);
for (const row of pt.rows) {
  console.log(
    `  p1=${row.p1.toFixed(2)} → p2=${row.p2.toFixed(2)} | ` +
      `n_iid=${String(row.nIidPerArm).padStart(4)}/arm  ` +
      `n_clustered=${String(row.nClusteredPerArm).padStart(4)}/arm  ` +
      `${row.proposedClears ? '✓ 96 clears' : '✗ 96 SHORT'}`,
  );
}
console.log(
  `  worst case: p1=${pt.worstCase.p1.toFixed(2)} needs ${pt.worstCase.nClusteredPerArm}/arm — ` +
    `proposed 96/arm ${pt.proposedClearsWorstCase ? 'CLEARS worst case ✓' : 'is SHORT of worst case ✗'}`,
);

// ── D2-faithful signature statistics ─────────────────────────────────────
// design-a17 §8 D2 defines the discriminator as the unlock-rate-vs-SESSION
// slope: the raw 0/1 series regressed on session index. NOT the slope of the
// cumulative running rate (streamRiseSlope) — on a short stream an early
// unlock run drags the cumulative curve negative even when the raw series is
// perfectly STATIONARY (the A1 floor is a stationary 0/1 process, not a
// declining one). The smoke gates the D2 statistic; streamRiseSlope is kept
// only as a printed visual. A first-half/second-half mean delta complements
// the slope (robust to a single early/late run on a short series).
const sessionSlope = (traj) =>
  olsSlope(
    traj.series.map((_, i) => i),
    traj.series,
  );
const halfMean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const secondHalfMean = (traj) => halfMean(traj.series.slice(Math.floor(traj.series.length / 2)));
const firstHalfMean = (traj) => halfMean(traj.series.slice(0, Math.floor(traj.series.length / 2)));
const halfMeanDelta = (traj) => secondHalfMean(traj) - firstHalfMean(traj);

const slopeA1 = sessionSlope(A1.traj);
const slopeA2 = sessionSlope(A2.traj);
const slopeA3 = sessionSlope(A3.traj);
const halfA1 = halfMeanDelta(A1.traj);
const halfA3 = halfMeanDelta(A3.traj);
// §8 PRIMARY outcome surface: held-out end-state separation = the difference
// of second-half mean unlock rates. This is the contrast the paid run and the
// task-#5 analyzer test for real; the smoke asserts the mock exercises it
// past the locked margin Δ* (D1) so the analytic power table is meaningful.
const tailA1 = secondHalfMean(A1.traj);
const tailA2 = secondHalfMean(A2.traj);
const primarySeparation = tailA2 - tailA1;

console.log(
  `\n=== D2-faithful signature (raw session slope · half-mean Δ) ===\n` +
    `  A1 slope=${slopeA1.toFixed(4)} halfΔ=${halfA1.toFixed(3)} | ` +
    `A2 slope=${slopeA2.toFixed(4)} halfΔ=${halfMeanDelta(A2.traj).toFixed(3)} | ` +
    `A3 slope=${slopeA3.toFixed(4)} halfΔ=${halfA3.toFixed(3)}\n` +
    `  (cumulative streamRiseSlope — visual only: ` +
    `A1=${A1.slope.toFixed(4)} A2=${A2.slope.toFixed(4)} A3=${A3.slope.toFixed(4)})\n` +
    `  §8 PRIMARY end-state separation (2nd-half mean): ` +
    `A2=${tailA2.toFixed(3)} − A1=${tailA1.toFixed(3)} = ${primarySeparation.toFixed(3)} (Δ*=${DELTA_STAR})`,
);

// ── Strict assertions (the SIGNATURE, not the curve shape) ───────────────
// §7 step 1 scopes the mock to "pipeline + floor/ceiling discrimination, not
// variance/shape" — and A2−A1 variance is analytic (power table), never
// mock-estimated. So the gates are: A1 stationary floor · A2 rises · A3
// ceiling · held-out A2−A1 ≥ Δ*. Tuning the mock to prettify the curve would
// be a closed-loop tell — deliberately not done.
const fails = [];
const FLAT_SLOPE = 0.03; // |raw session slope| below this ≈ stationary
const FLAT_HALF = 0.15; // |2nd−1st half mean| below this ≈ stationary
const BIN_TOL = 0.25; // one 4-session bin may dip by ≤1 session (ε-explore)

// Wiring sanity: every arm must have produced probe-scored sessions.
if (A1.traj.n !== N_HELDOUT_SESSIONS) fails.push(`A1 produced ${A1.traj.n} sessions, expected ${N_HELDOUT_SESSIONS}`);
if (A2.traj.n !== N_HELDOUT_SESSIONS) fails.push(`A2 produced ${A2.traj.n} sessions, expected ${N_HELDOUT_SESSIONS}`);
if (A3.traj.n !== N_HELDOUT_SESSIONS) fails.push(`A3 produced ${A3.traj.n} sessions, expected ${N_HELDOUT_SESSIONS}`);

// A1 — no-memory floor: a STATIONARY 0/1 process (cold every session, iid).
// D2 statistic + half-mean delta, NOT the cumulative slope (a short series
// with an early unlock run has a negative cumulative slope yet is stationary).
if (Math.abs(slopeA1) > FLAT_SLOPE)
  fails.push(`A1 not stationary: |session slope|=${Math.abs(slopeA1).toFixed(4)} > ${FLAT_SLOPE}`);
if (Math.abs(halfA1) > FLAT_HALF)
  fails.push(`A1 not stationary: |half-mean Δ|=${Math.abs(halfA1).toFixed(3)} > ${FLAT_HALF}`);
if (a1Overall >= 0.9) fails.push(`A1 not a floor: overall=${a1Overall.toFixed(3)} ≥ 0.90`);

// A2 — persistent: rises across the stream, ends well above its start, and
// the binned rate is non-decreasing to within one ε-exploration session.
if (slopeA2 < -0.005) fails.push(`A2 did not rise: session slope=${slopeA2.toFixed(4)} < −0.005`);
if (a2Rise < DELTA_STAR) fails.push(`A2 rise too small: lastBin−firstBin=${a2Rise.toFixed(3)} < Δ*=${DELTA_STAR}`);
for (let i = 1; i < A2.traj.binned.length; i++) {
  const prev = A2.traj.binned[i - 1].rate;
  const cur = A2.traj.binned[i].rate;
  if (cur < prev - BIN_TOL)
    fails.push(`A2 binned not non-decreasing: bin${i}=${cur.toFixed(2)} < bin${i - 1}=${prev.toFixed(2)} − ${BIN_TOL}`);
}

// A3 — oracle ceiling: high and stationary at the top.
if (a3Overall < 0.9) fails.push(`A3 below ceiling: overall=${a3Overall.toFixed(3)} < 0.90`);
if (Math.abs(halfA3) > 0.05) fails.push(`A3 ceiling not flat: |half-mean Δ|=${Math.abs(halfA3).toFixed(3)} > 0.05`);

// Floor < rise → ceiling ordering.
if (!(a1Overall < a2LastBin))
  fails.push(`ordering broke: A1 overall ${a1Overall.toFixed(3)} ≥ A2 last bin ${a2LastBin.toFixed(3)}`);
if (!(a2LastBin <= a3Overall + 1e-9))
  fails.push(`A2 last bin ${a2LastBin.toFixed(3)} exceeds A3 ceiling ${a3Overall.toFixed(3)}`);

// §8 PRIMARY headline: held-out end-state A2−A1 separation clears Δ* (D1).
if (primarySeparation < DELTA_STAR)
  fails.push(`§8 primary separation ${primarySeparation.toFixed(3)} < Δ*=${DELTA_STAR}`);

// Secondary (soft): warmed-A2 transfer should at least clear cold first bin.
if (warmRate + 1e-9 < a2FirstBin) {
  console.warn(
    `\n[soft] warmed-A2 transfer ${warmRate.toFixed(3)} < cold first bin ${a2FirstBin.toFixed(2)} — investigate, not fatal`,
  );
}

// Analytic power table must be WELL-FORMED. Whether 96/arm clears the
// worst-case baseline is a D3 decision-support input for the OWNER at task #3
// lock-in — explicitly NOT a smoke gate. The smoke neither passes nor fails
// on the proposed N; it surfaces the table so D3 is ratified on evidence.
if (!Number.isFinite(pt.designEffect) || pt.designEffect <= 1)
  fails.push(`design effect malformed: ${pt.designEffect}`);
if (pt.rows.length !== 5) fails.push(`power table expected 5 baseline rows, got ${pt.rows.length}`);

if (fails.length) {
  console.error('\nA17 LOCK-PUZZLE SMOKE FAILED:');
  for (const f of fails) console.error('  -', f);
  process.exit(1);
}
console.log('\nA17 LOCK-PUZZLE SMOKE PASSED');
console.log(
  `  signature: A1 stationary@${a1Overall.toFixed(2)} (slope ${slopeA1.toFixed(3)}) · ` +
    `A2 ${a2FirstBin.toFixed(2)}→${a2LastBin.toFixed(2)} (rise) · A3 ceiling@${a3Overall.toFixed(2)}`,
);
console.log(`  §8 primary: held-out end-state A2−A1 = ${primarySeparation.toFixed(3)} ≥ Δ*=${DELTA_STAR} ✓`);
console.log(
  `  D3 decision-support (NOT a gate): 96/arm ` +
    `${pt.proposedClearsWorstCase ? 'CLEARS' : 'is SHORT of'} the worst-case baseline ` +
    `at Δ*=${DELTA_STAR} → owner ratifies N at task #3 lock-in`,
);
console.log(`  tmp dir (auto-cleanup left to OS): ${tmpDir}`);
