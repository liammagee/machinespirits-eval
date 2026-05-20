#!/usr/bin/env node
// A17 speech-act-lock — PAID two-stage internal-pilot runner.
// notes/design-a17-speech-act-lock-prototype.md (LOCKED 2026-05-19), §7 step 3.
//
// This is the real-LLM counterpart of scripts/run-lock-puzzle-smoke.js. It
// drives buildGraph({architecture:'lock_puzzle'}) directly (NEVER eval-cli —
// `--dry-run` on adaptive cells writes the prod DB; see the project memory
// note). It is built around four locked invariants:
//
//  1. ROUTING (cost-gate (a)). The Max-plan bridge (provider 'claude-code')
//     returns cost:0, so a $-ceiling tracker is structurally blind. We invert
//     the gate: a no-abort SENSOR budget tracker is bound for the WHOLE run;
//     if it ever records a non-zero token/cost the run HARD-ABORTS — the only
//     way that happens is a silent fallback off claude-code onto metered
//     OpenRouter (DEFAULT_PROVIDER), which would bill ≈$50–150. We also force
//     ADAPTIVE_TUTOR_PROVIDER=claude-code / ADAPTIVE_TUTOR_MODEL=sonnet before
//     imports so envFor() cannot pick the metered default in the first place.
//
//  2. CONTRAST-BLIND TWO-STAGE (D3). Stage 1 and Stage 2 are SEPARATE process
//     invocations. Stage 1 runs A1 only at n_pilot=12×8=96/arm and writes
//     p̂₁ (the §8 second-half held-out unlock rate). Stage 2 refuses to start
//     without the Stage-1 artifact, re-estimates N* from p̂₁ ALONE (a nuisance
//     parameter — never the A2−A1 contrast), then runs A2/A3 at N and tops A1
//     up 96→N. A2/A3 are not generated until N is frozen, so the contrast is
//     never observed pre-lock. No α-spending (internal-pilot SSR, Wittes &
//     Brittain 1990; Friede & Kieser 2006), §8 α=0.05 unchanged.
//
//  3. SEQUENTIAL ARMS. A1→A2→A3 share one Max-plan quota window AND feed the
//     A2−A1 contrast → strictly sequential (the documented REVERSE of the
//     usual parallel-fan-out default; feedback_parallel_adaptive_pilots).
//
//  4. RESUMABLE. Every session outcome is appended to sessions.jsonl as it
//     lands; a re-run skips completed (stage,arm,scenario,sessionIndex) keys
//     and reuses their outcomes — a quota exhaustion mid-stream costs nothing
//     to recover from. The isolated EVAL_DB_PATH/EVAL_LOGS_DIR live under
//     exports/, never the prod data/evaluations.db.
//
// COST GATE: no real call is made without --confirm-spend. Without it (and
// not --mock) the runner prints the plan and exits 0. --mock forces the mock
// backend and exercises the entire two-stage machinery at ZERO cost (task 4d).
//
// Usage:
//   node scripts/run-lock-puzzle-paid.js --mock --stage 1        # 4d (free)
//   node scripts/run-lock-puzzle-paid.js --mock --stage 2        # 4d (free)
//   node scripts/run-lock-puzzle-paid.js --probe-only --confirm-spend   # 4e probe
//   node scripts/run-lock-puzzle-paid.js --stage 1 --confirm-spend      # 4e
//   node scripts/run-lock-puzzle-paid.js --stage 2 --confirm-spend      # 4f

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// ── CLI args ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valOf = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d;
};
const MOCK = has('--mock');
const PROBE_ONLY = has('--probe-only');
const CONFIRM_SPEND = has('--confirm-spend');
const STAGE = String(valOf('--stage', PROBE_ONLY ? '0' : '1'));
if (!['0', '1', '2'].includes(STAGE)) {
  console.error(`paid-runner: --stage must be 1 or 2 (got '${STAGE}')`);
  process.exit(1);
}

// ── Inter-session pacing (quota-window safety) ───────────────────────────
// `--pace-seconds N` inserts an N-second idle pause AFTER each real session.
// This is an OPERATIONAL parameter, NOT a §9 deviation: it changes only the
// *timing* of byte-identical calls, is applied uniformly to every arm via a
// single constant (zero differential effect on the A2−A1 contrast), and is
// strictly MORE conservative than §7's locked "sequential, not parallel"
// rule — it lowers the sustained call rate so a Max-plan rolling window
// refills between the ~18-call session bursts, reducing the differential
// mid-window throttling §7 exists to prevent. 0 = unpaced (Stage-1
// behaviour). Forced 0 under --mock (4d must stay fast/deterministic).
// Reused Stage-1 sessions never incur the pause (they make no LLM call).
const PACE_SECONDS = Math.max(0, Number(valOf('--pace-seconds', '0')) || 0);
const PACE_MS = MOCK ? 0 : Math.round(PACE_SECONDS * 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Attended-segment checkpointing (human-gated quota review) ─────────────
// `--checkpoint-every N` makes the run STOP (exit 0, ledger durably saved)
// after every N NEW real sessions this invocation, so a human can weigh
// Max-plan quota headroom before the next segment — the run physically
// cannot overrun a gate unattended. CONTINUE = re-run the identical command
// (resumability skips done sessions). PAUSE = simply don't relaunch; the
// rolling window refills for an hour or a week while the balanced ledger
// sits safe on disk. This is the only place the human's *external* knowledge
// of their subscription usage can enter the loop (the claude-code path has
// no readable quota meter — the `budget_tracker_gap` premise). Operational,
// NOT a §9 deviation: byte-identical calls, same sequence, same per-arm
// balance — only segmented in wall-clock, strictly more conservative than
// §7's locked sequential rule. 0 = continuous. Forced 0 under --mock.
const CHECKPOINT_EVERY = MOCK ? 0 : Math.max(0, Math.floor(Number(valOf('--checkpoint-every', '0')) || 0));
let _segNewSessions = 0;
const _segStart = Date.now();

// ── Artifact dir (isolated; NEVER prod data/evaluations.db) ───────────────
const ART_DIR = path.join(REPO_ROOT, 'exports', MOCK ? 'a17-lock-paid-mockcheck' : 'a17-lock-paid');
fs.mkdirSync(path.join(ART_DIR, 'logs'), { recursive: true });
process.env.EVAL_DB_PATH = path.join(ART_DIR, 'evaluations.db');
process.env.EVAL_LOGS_DIR = path.join(ART_DIR, 'logs');

// ── Backend + FORCED claude-code/sonnet routing (cost-gate (a)) ──────────
// Set BEFORE the dynamic imports: envFor() reads process.env at call time,
// but setting here keeps it smoke-consistent and impossible to forget. The
// forced provider/model is the structural defence against the metered
// DEFAULT_PROVIDER='openrouter' fallback (≈$50–150 hazard).
process.env.ADAPTIVE_TUTOR_LLM = MOCK ? 'mock' : 'real';
if (!MOCK) {
  process.env.ADAPTIVE_TUTOR_PROVIDER = 'claude-code';
  process.env.ADAPTIVE_TUTOR_MODEL = 'sonnet';
}

const { buildGraph } = await import('../services/adaptiveTutor/graph.js');
const { initialLearnerProfile, initialTutorInternal } = await import('../services/adaptiveTutor/stateSchema.js');
const { llmMode } = await import('../services/adaptiveTutor/llm.js');
const { setActiveBudgetTracker, clearActiveBudgetTracker } = await import('../services/adaptiveTutor/realLLM.js');
const efficacy = (await import('../services/adaptiveTutor/moveEfficacyStore.js')).default;
const { MemorySaver } = await import('@langchain/langgraph');
const { deriveUnlock, unlockRateTrajectory, twoProportionNPerArm, clusterDesignEffect } =
  await import('../services/adaptiveTutor/lockPuzzleOutcome.js');

if (llmMode() !== (MOCK ? 'mock' : 'real')) {
  console.error(`paid-runner ABORT: expected '${MOCK ? 'mock' : 'real'}' backend, got '${llmMode()}'`);
  process.exit(1);
}

// ── The structural cost gate: a no-abort SENSOR tracker that HARD-ABORTS on
// the first non-zero token/cost (= a silent metered fallback off claude-code).
// callRole calls estimate()→assertBelowCeiling() pre-call (we no-op both: we
// are NOT gating on a $ ceiling — claude-code reports cost 0, so that gate is
// blind by construction) and record() post-call (the real sensor).
function makeSensorTracker() {
  const calls = [];
  let metered = null;
  return {
    estimate: () => ({ tokens: 0, cost: 0 }),
    assertBelowCeiling: () => {},
    record: ({ inputTokens = 0, outputTokens = 0, cost = 0 } = {}) => {
      calls.push({ inputTokens, outputTokens, cost });
      if (inputTokens > 0 || outputTokens > 0 || cost > 0) {
        metered = { inputTokens, outputTokens, cost, callIndex: calls.length };
        // Hard-abort: routing fell off the Max-plan bridge onto a metered
        // provider. Kill the run after exactly one stray call — the tightest
        // bound possible (provider is not surfaced to the caller pre-call).
        throw new Error(
          `paid-runner COST-GATE TRIPPED: call #${calls.length} recorded metered usage ` +
            `(in=${inputTokens} out=${outputTokens} cost=$${cost}). This means routing ` +
            `silently fell back off provider 'claude-code' onto a metered provider. ` +
            `Run HARD-ABORTED before further spend. Investigate ADAPTIVE_TUTOR_PROVIDER / ` +
            `claude CLI availability before retrying.`,
        );
      }
    },
    snapshot: () => ({ nCalls: calls.length, metered }),
  };
}

// ── Scenarios + probe bank (the harness threads the A17 fields) ──────────
const scenarioDoc = yaml.parse(fs.readFileSync(path.join(REPO_ROOT, 'config', 'lock-puzzle-scenarios.yaml'), 'utf-8'));
const probeDoc = yaml.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'config', 'lock-probes', 'fractions-unlike-denominator.yaml'), 'utf-8'),
);
const PROBE_ITEMS = probeDoc.items;
const FAMILY = scenarioDoc.meta.misconception_family;
const PANEL_SIZE = scenarioDoc.meta.unlock.criterion.panel_size;
const K = scenarioDoc.meta.unlock.criterion.consecutive_turns_all_correct;
const EPSILON = 0.1; // §5 ε-greedy
const allScen = scenarioDoc.scenarios;
const heldOut = allScen.filter((s) => s.stream === 'held_out');

// D3 locked instrument geometry.
const N_PUZZLES = heldOut.length; // must be 12 (4a conformed the instrument)
const M_PILOT = 8; // runs/puzzle at Stage 1 → n_pilot = 12×8 = 96
const N_PILOT = N_PUZZLES * M_PILOT;
const DELTA_STAR = scenarioDoc.meta?.unlock?.delta_star ?? 0.15; // D1
const ICC = 0.05; // D3
const N_FLOOR = 96; // D3 clamp floor
const N_CAP = 240; // D3 clamp cap = 12×20

if (N_PUZZLES !== 12) {
  console.error(
    `paid-runner ABORT: locked D3 assumes 12 held-out puzzles, found ${N_PUZZLES}. ` +
      `The instrument must conform to the registered design before any paid run.`,
  );
  process.exit(1);
}

// ── One scenario → one externalised lock-puzzle session ──────────────────
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
  return { unlocked: unlocked ? 1 : 0, unlockTurn, maxRun };
}

// ── Resumable session log ────────────────────────────────────────────────
const SESS_LOG = path.join(ART_DIR, 'sessions.jsonl');
const keyOf = (stage, arm, scenarioId, i) => `${stage}|${arm}|${scenarioId}|${i}`;

function loadCompleted() {
  const done = new Map();
  if (!fs.existsSync(SESS_LOG)) return done;
  for (const line of fs.readFileSync(SESS_LOG, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      done.set(keyOf(r.stage, r.arm, r.scenarioId, r.sessionIndex), r);
    } catch {
      /* skip a torn final line from a hard crash */
    }
  }
  return done;
}

function appendSession(rec) {
  fs.appendFileSync(SESS_LOG, JSON.stringify(rec) + '\n');
}

// Attended-segment gate: ledger is already durably appended when this fires,
// so exiting here is a clean, balanced checkpoint (resumable). Exit-and-rerun
// (not in-process wait) survives terminal close / machine sleep / multi-day
// pauses — the pause can be arbitrarily long.
function checkpointAndExit() {
  const recs = loadCompleted();
  const byArm = {};
  for (const r of recs.values()) {
    if (r.stage !== 2) continue;
    byArm[r.arm] = (byArm[r.arm] || 0) + 1;
  }
  const elapsedMin = (Date.now() - _segStart) / 60000;
  const callsPerHr = elapsedMin > 0 ? Math.round((_segNewSessions * 18) / (elapsedMin / 60)) : 0;
  console.log('\n┌─ ATTENDED CHECKPOINT — stopping for quota review ────────────');
  console.log(
    `│ ${_segNewSessions} NEW real sessions this segment in ${elapsedMin.toFixed(0)} min (≈${callsPerHr} calls/hr).`,
  );
  console.log('│ Stage-2 ledger (durably saved — safe to leave for days):');
  for (const a of Object.keys(byArm).sort()) console.log(`│   ${a}: ${byArm[a]} / 120`);
  console.log('│');
  console.log('│ CONTINUE → re-run the SAME command (skips done sessions,');
  console.log('│            runs the next segment).');
  console.log("│ PAUSE    → just don't relaunch. Hours or weeks — the rolling");
  console.log('│            quota window refills while the ledger sits balanced.');
  console.log('└──────────────────────────────────────────────────────────────\n');
  clearActiveBudgetTracker();
  process.exit(0);
}

// Run a contiguous block of sessions for one arm (sessionIndex iStart..iEnd-1),
// round-robin over the held-out puzzles. Resumable + STRICTLY SEQUENTIAL.
async function runArmBlock({ stage, arm, wipeEachSession, iStart, iEnd, completed }) {
  efficacy.configure({ dbPath: path.join(ART_DIR, `move-efficacy-${arm}-held_out.db`) });
  // A1 (no-memory control) wipes the move table before EACH session — the
  // entire operationalisation of the memory channel (§6). A2 never wipes.
  // A3 bypasses the table in the graph node (oracle), so wiping is moot.
  // On RESUME we must NOT wipe A2's accumulated table: it is only configured
  // here and the prior increment's rows persist in the per-arm sqlite file.
  if (!wipeEachSession && iStart === 0 && !completed.size) efficacy.wipe();
  const sessions = [];
  for (let i = iStart; i < iEnd; i++) {
    const scenario = heldOut[i % heldOut.length];
    const k = keyOf(stage, arm, scenario.id, i);
    const prior = completed.get(k);
    if (prior) {
      sessions.push({ sessionIndex: i, unlocked: prior.unlocked });
      continue;
    }
    if (wipeEachSession) efficacy.wipe();
    const r = await runSession({ arm, scenario, stream: 'held_out', sessionIndex: i });
    const rec = {
      stage,
      arm,
      scenarioId: scenario.id,
      sessionIndex: i,
      unlocked: r.unlocked,
      unlockTurn: r.unlockTurn,
      maxRun: r.maxRun,
      ts: new Date().toISOString(),
    };
    appendSession(rec);
    sessions.push({ sessionIndex: i, unlocked: r.unlocked });
    // Only genuinely-new real sessions reach here (the reused-Stage-1 path
    // `continue`s above), so this counts LLM-spending sessions exactly.
    _segNewSessions += 1;
    if ((i - iStart + 1) % 8 === 0 || i === iEnd - 1) {
      process.stdout.write(`    [${arm}] ${i - iStart + 1}/${iEnd - iStart} sessions\n`);
    }
    // Attended-segment gate FIRST: if this segment is full, stop cleanly for
    // human quota review (ledger durably saved above) — don't pace-sleep on
    // the way out the door.
    if (CHECKPOINT_EVERY && _segNewSessions % CHECKPOINT_EVERY === 0) checkpointAndExit();
    // Quota-window pacing: idle AFTER a real session, never after the block's
    // last one (no trailing sleep), never on the reused-Stage-1 path (that
    // `continue`s above — no LLM call was made, so there is nothing to pace).
    if (PACE_MS && i < iEnd - 1) await sleep(PACE_MS);
  }
  return sessions;
}

const secondHalfMean = (series) => {
  const tail = series.slice(Math.floor(series.length / 2));
  return tail.length ? tail.reduce((a, b) => a + b, 0) / tail.length : 0;
};

// §8 statistic: held-out end-of-stream unlock rate = second-half mean of the
// per-session 0/1 series, ordered by sessionIndex (lockPuzzleOutcome's
// audited unlockRateTrajectory.series — same predicate the smoke gates).
function endOfStreamRate(sessions) {
  const traj = unlockRateTrajectory(sessions, { bins: 4 });
  return { rate: secondHalfMean(traj.series), n: traj.series.length, overall: traj.overallRate };
}

// ── The cost-gate preamble (run once before any real spend) ──────────────
function refuseUnconfirmed(plan) {
  console.log('\n┌─ A17 PAID RUNNER — COST GATE ───────────────────────────────');
  console.log('│ Real LLM calls are NOT permitted without --confirm-spend.');
  console.log('│');
  for (const line of plan) console.log('│ ' + line);
  console.log('│');
  console.log('│ This is design cost-gate (b): the owner confirms Max-plan');
  console.log('│ quota-window headroom, THEN re-runs with --confirm-spend.');
  console.log('│ Re-run, adding:  --confirm-spend');
  console.log('└─────────────────────────────────────────────────────────────\n');
}

function preflightClaudeCli() {
  try {
    const v = execSync('claude --version', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    console.log(`  claude CLI present: ${v}`);
    return true;
  } catch {
    console.error(
      'paid-runner ABORT: `claude` CLI not found on PATH. The Max-plan bridge ' +
        '(callClaudeCli) needs it; without it every call would fall back metered.',
    );
    return false;
  }
}

// One real call through the full callRole→callAI→callClaudeCli path. The
// sensor tracker is already bound: a metered fallback throws inside record()
// before we get here; we additionally assert the recorded usage is {0,0,0}.
async function routingProbe(tracker) {
  const { callRole } = await import('../services/adaptiveTutor/llm.js');
  console.log('  routing probe: 1 real call (tutorMoveRealise)…');
  const out = await callRole('tutorMoveRealise', {
    selectedMove: 'elicit',
    dialogue: [{ role: 'learner', content: 'I think 1/2 + 1/3 is 2/5.' }],
    turn: 0,
  });
  const text = typeof out === 'string' ? out : (out?.text ?? '');
  const snap = tracker.snapshot();
  if (MOCK) {
    console.log(
      `  mock backend: tracker untouched (mock makes no metered calls). probe text: ${JSON.stringify(text.slice(0, 80))}`,
    );
    return true;
  }
  if (snap.nCalls !== 1 || snap.metered) {
    console.error(
      `paid-runner ABORT: routing probe sensor = ${JSON.stringify(snap)} (expected exactly 1 call, {0,0,0}).`,
    );
    return false;
  }
  if (!text || text.length < 2) {
    console.error('paid-runner ABORT: routing probe returned empty text — claude-code path produced no output.');
    return false;
  }
  console.log(`  ✓ claude-code path confirmed: recorded {0,0,0} usage, non-empty output (${text.length} chars).`);
  console.log(`    probe output: ${JSON.stringify(text.slice(0, 120))}`);
  return true;
}

// ── Stage 1: A1-only held-out @ n_pilot=96. Compute p̂₁. STOP. ────────────
async function stage1() {
  const plan = [
    `STAGE 1 (A1 no-memory only): ${N_PILOT} held-out sessions`,
    `(${N_PUZZLES} puzzles × ${M_PILOT} runs/puzzle), ~${N_PILOT * 18} Max-plan calls upper bound`,
    `(≤ ${18} LLM calls/session × ${N_PILOT}). Sequential. Outputs p̂₁ then STOPS`,
    `(A2/A3 not generated — contrast-blind by construction).`,
  ];
  if (!MOCK && !CONFIRM_SPEND) {
    refuseUnconfirmed(plan);
    return;
  }
  if (!MOCK && !preflightClaudeCli()) process.exit(1);

  const tracker = makeSensorTracker();
  setActiveBudgetTracker(tracker);
  try {
    if (!(await routingProbe(tracker))) process.exit(1);

    console.log(`\n=== STAGE 1 — A1 no-memory, ${N_PILOT} held-out sessions ===`);
    const completed = loadCompleted();
    const a1 = await runArmBlock({
      stage: 1,
      arm: 'A1_no_memory',
      wipeEachSession: true,
      iStart: 0,
      iEnd: N_PILOT,
      completed,
    });
    const { rate: p1Hat, n, overall } = endOfStreamRate(a1);

    const result = {
      stage: 1,
      backend: MOCK ? 'mock' : 'claude-code/sonnet',
      nPilotPerArm: N_PILOT,
      nPuzzles: N_PUZZLES,
      mPilot: M_PILOT,
      deltaStar: DELTA_STAR,
      p1Hat,
      p1HatBasis: `secondHalfMean of A1 held-out series (n=${n}, overallRate=${overall.toFixed(4)})`,
      sensorCalls: tracker.snapshot().nCalls,
      ts: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(ART_DIR, 'stage1-result.json'), JSON.stringify(result, null, 2));

    console.log(
      `\n  p̂₁ (held-out end-of-stream unlock rate) = ${p1Hat.toFixed(4)}  [n=${n}, overall=${overall.toFixed(4)}]`,
    );
    console.log(`  sensor: ${tracker.snapshot().nCalls} calls, all {0,0,0} ✓`);
    console.log(`\n  STAGE 1 COMPLETE → exports/${path.basename(ART_DIR)}/stage1-result.json`);
    console.log('  STOPPING (contrast-blind). Run Stage 2 to re-estimate N and run A2/A3 + A1 top-up.\n');
  } finally {
    clearActiveBudgetTracker();
  }
}

// ── D3 N* re-estimation (computed-not-chosen; faithful to the locked rule) ─
function reestimateN(p1Hat) {
  const p2 = Math.min(0.999, p1Hat + DELTA_STAR); // mirror lockPuzzleOutcome.powerTable
  const nIid = twoProportionNPerArm(p1Hat, p2, { alpha: 0.05, power: 0.8 });
  const deff = clusterDesignEffect(M_PILOT, ICC); // m=8 (the locked power-table m)
  const nStarRaw = Math.ceil(nIid * deff);
  // "rounded up to a whole runs-per-puzzle m" → smallest multiple of 12 ≥ nStarRaw
  const mFromStar = Math.ceil(nStarRaw / N_PUZZLES);
  const nStarWholeM = mFromStar * N_PUZZLES;
  // clamp N = min(max(N*,96),240); both bounds are multiples of 12
  const N = Math.min(N_CAP, Math.max(N_FLOOR, nStarWholeM));
  const mFinal = N / N_PUZZLES;
  return { p1Hat, p2, nIid, deff, nStarRaw, mFromStar, nStarWholeM, N, mFinal };
}

// ── Stage 2: re-estimate N from p̂₁; A1 top-up 96→N, then A2, then A3 ─────
async function stage2() {
  const s1Path = path.join(ART_DIR, 'stage1-result.json');
  if (!fs.existsSync(s1Path)) {
    console.error(
      `paid-runner ABORT: Stage 2 requires Stage 1's artifact (${s1Path}). ` +
        `Run --stage 1 first. (This is the mechanical contrast-blind guarantee.)`,
    );
    process.exit(1);
  }
  const s1 = JSON.parse(fs.readFileSync(s1Path, 'utf-8'));
  const est = reestimateN(s1.p1Hat);

  console.log('\n=== D3 N* RE-ESTIMATION (computed-not-chosen, from Stage-1 A1 p̂₁ only) ===');
  console.log(`  p̂₁ = ${est.p1Hat.toFixed(4)}   Δ* = ${DELTA_STAR}   p2 = p̂₁+Δ* = ${est.p2.toFixed(4)}`);
  console.log(`  twoProportionNPerArm(p̂₁, p2, α=0.05, power=0.8) = ${est.nIid}/arm (iid)`);
  console.log(`  clusterDesignEffect(m=${M_PILOT}, ICC=${ICC}) = ${est.deff.toFixed(4)}`);
  console.log(`  N* = ceil(${est.nIid} × ${est.deff.toFixed(4)}) = ${est.nStarRaw}`);
  console.log(`  → whole runs/puzzle: ceil(${est.nStarRaw}/${N_PUZZLES}) = m=${est.mFromStar} ⇒ ${est.nStarWholeM}`);
  console.log(`  → clamp [${N_FLOOR},${N_CAP}]:  N = ${est.N}/arm  (m_final = ${est.mFinal} runs/puzzle)`);
  console.log('\n  DATED §9 ENTRY to add to notes/design-a17-speech-act-lock-prototype.md');
  console.log('  (scheduled decision, NOT a deviation — N* is a deterministic function of');
  console.log('   Stage-1 A1 data, exactly like the D9 domain identity):');
  console.log('  ────────────────────────────────────────────────────────────────');
  console.log(`  - **${new Date().toISOString().slice(0, 10)} — D3 N re-estimated: N = ${est.N}/arm`);
  console.log(`    (m=${est.mFinal} runs/puzzle).** Computed from Stage-1 A1 held-out`);
  console.log(`    p̂₁=${est.p1Hat.toFixed(4)} (§8 second-half mean, n=${s1.nPilotPerArm}) via the`);
  console.log(`    locked D3 rule: ceil(twoProportionNPerArm(${est.p1Hat.toFixed(4)},`);
  console.log(`    ${est.p2.toFixed(4)}) × clusterDesignEffect(${M_PILOT}, ${ICC})) = ${est.nStarRaw},`);
  console.log(`    rounded up to a whole runs-per-puzzle (${est.nStarWholeM}), clamped`);
  console.log(`    [${N_FLOOR},${N_CAP}] → ${est.N}. Contrast-blind: A2/A3 ungenerated until now.`);
  console.log('  ────────────────────────────────────────────────────────────────');

  const plan = [
    `STAGE 2: N=${est.N}/arm (m=${est.mFinal}). Sequential, in order:`,
    `  (1) A1 TOP-UP: sessions 96→${est.N} (${Math.max(0, est.N - N_PILOT)} new; Stage-1 96 reused)`,
    `  (2) A2 persistent-memory: ${est.N} held-out sessions`,
    `  (3) A3 oracle ceiling: ${est.N} held-out sessions`,
    `Upper bound ≈ ${(Math.max(0, est.N - N_PILOT) + 2 * est.N) * 18} Max-plan calls.`,
  ];
  if (!MOCK && !CONFIRM_SPEND) {
    refuseUnconfirmed(plan);
    return;
  }
  if (!MOCK && !preflightClaudeCli()) process.exit(1);

  const tracker = makeSensorTracker();
  setActiveBudgetTracker(tracker);
  try {
    if (!(await routingProbe(tracker))) process.exit(1);
    const completed = loadCompleted();

    // (1) A1 top-up — reuse Stage-1's 96 (re-logged under stage 2 keys for a
    // single balanced N-sized A1 series), only sessions 96→N are new calls.
    console.log(`\n=== STAGE 2 (1/3) — A1 top-up 96→${est.N} ===`);
    // Carry the Stage-1 A1 outcomes forward so the A1 series is the full N
    // (Stage-1 reused, only the increment newly run — D3 "tops A1 up").
    const s1A1 = [...completed.entries()].filter(([key]) => key.startsWith('1|A1_no_memory|')).map(([, r]) => r);
    for (const r of s1A1) {
      const k = keyOf(2, 'A1_no_memory', r.scenarioId, r.sessionIndex);
      if (!completed.has(k)) {
        appendSession({ ...r, stage: 2, reusedFromStage1: true });
        completed.set(k, { ...r, stage: 2 });
      }
    }
    const a1full = await runArmBlock({
      stage: 2,
      arm: 'A1_no_memory',
      wipeEachSession: true,
      iStart: 0,
      iEnd: est.N,
      completed: loadCompleted(),
    });

    console.log(`\n=== STAGE 2 (2/3) — A2 persistent-memory, ${est.N} sessions ===`);
    const a2 = await runArmBlock({
      stage: 2,
      arm: 'A2_persistent',
      wipeEachSession: false,
      iStart: 0,
      iEnd: est.N,
      completed: loadCompleted(),
    });

    console.log(`\n=== STAGE 2 (3/3) — A3 oracle ceiling, ${est.N} sessions ===`);
    const a3 = await runArmBlock({
      stage: 2,
      arm: 'A3_oracle',
      wipeEachSession: false,
      iStart: 0,
      iEnd: est.N,
      completed: loadCompleted(),
    });

    const A1 = endOfStreamRate(a1full);
    const A2 = endOfStreamRate(a2);
    const A3 = endOfStreamRate(a3);
    const result = {
      stage: 2,
      backend: MOCK ? 'mock' : 'claude-code/sonnet',
      N: est.N,
      mFinal: est.mFinal,
      reestimation: est,
      heldOutEndOfStream: {
        A1: A1.rate,
        A2: A2.rate,
        A3: A3.rate,
        primarySeparation_A2_minus_A1: A2.rate - A1.rate,
        deltaStar: DELTA_STAR,
      },
      sensorCalls: tracker.snapshot().nCalls,
      ts: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(ART_DIR, 'stage2-result.json'), JSON.stringify(result, null, 2));

    console.log('\n=== STAGE 2 COMPLETE — §8 held-out end-of-stream unlock rate ===');
    console.log(`  A1 no-memory  = ${A1.rate.toFixed(4)}`);
    console.log(`  A2 persistent = ${A2.rate.toFixed(4)}`);
    console.log(`  A3 oracle     = ${A3.rate.toFixed(4)}`);
    console.log(`  PRIMARY contrast A2 − A1 = ${(A2.rate - A1.rate).toFixed(4)}  (Δ* = ${DELTA_STAR})`);
    console.log(`  sensor: ${tracker.snapshot().nCalls} calls, all {0,0,0} ✓`);
    console.log(`\n  → exports/${path.basename(ART_DIR)}/stage2-result.json`);
    console.log('  Confirmatory test + CI is task #5 (judge-free analyzer + /author-paper2). NOT computed here.\n');
  } finally {
    clearActiveBudgetTracker();
  }
}

// ── Dispatch ─────────────────────────────────────────────────────────────
console.log(`A17 lock-puzzle PAID runner — backend=${MOCK ? 'mock(4d)' : 'real claude-code/sonnet'}`);
console.log(`  artifact dir: exports/${path.basename(ART_DIR)}  (isolated; NOT prod data/evaluations.db)`);
console.log(
  `  held-out puzzles=${N_PUZZLES}  n_pilot=${N_PILOT}  Δ*=${DELTA_STAR}  ICC=${ICC}  clamp=[${N_FLOOR},${N_CAP}]`,
);
if (!MOCK) {
  console.log(
    `  pacing: ${
      PACE_SECONDS
        ? `${PACE_SECONDS}s inter-session pause (quota-window safety; uniform across all arms — operational, not a §9 deviation)`
        : 'NONE (unpaced — same as Stage 1)'
    }`,
  );
  console.log(
    `  checkpoint: ${
      CHECKPOINT_EVERY
        ? `every ${CHECKPOINT_EVERY} new sessions → STOP for attended quota review (resume = re-run same command)`
        : 'NONE (continuous — runs to completion unattended)'
    }`,
  );
}

if (PROBE_ONLY) {
  if (!MOCK && !CONFIRM_SPEND) {
    refuseUnconfirmed(['PROBE ONLY: 1 real call (tutorMoveRealise) to verify claude-code routing + {0,0,0}.']);
    process.exit(0);
  }
  if (!MOCK && !preflightClaudeCli()) process.exit(1);
  const tracker = makeSensorTracker();
  setActiveBudgetTracker(tracker);
  try {
    const ok = await routingProbe(tracker);
    process.exit(ok ? 0 : 1);
  } finally {
    clearActiveBudgetTracker();
  }
} else if (STAGE === '1') {
  await stage1();
} else if (STAGE === '2') {
  await stage2();
}
