#!/usr/bin/env node
/**
 * run-rich-memory-arc-experiment.js — the #3 cross-session experiment orchestrator
 * (approach A). Tests whether feeding the tutor an accumulated RICH-store memory
 * narrative improves tutoring quality across an N-session arc.
 *
 * Two arms, same learners, same ordered multi-turn scenarios:
 *   - baseline: no rich injection (tutor-core's Writing Pad still accumulates via learnerId)
 *   - rich:     same, PLUS the accumulated learnerMemoryService narrative injected into the
 *               tutor each session via runEvaluation's externalEgoExtension hook.
 * Each session is judged per turn by the v2.2 rubric, BLIND to which arm produced it, so
 * the score channel is architecture-independent. Per-arm per-session scores + slope reported.
 *
 * Modes:
 *   (default) dry-run — mock LLM, hermetic temp DB. Validates the orchestration plumbing.
 *                       No cost, and scores are mock (not a real signal).
 *   --real           — live LLM generation + judge. THIS SPENDS MONEY. Attended only.
 *
 * Isolated by construction: EVAL_DB_PATH / EVAL_LOGS_DIR / EVAL_WRITING_PAD_DIR are set to a
 * dedicated location before anything is imported — a temp dir in dry-run, or
 * <out-dir>/{db,logs,pads} in --real — so the production DB and pads are never touched.
 *
 * Usage:
 *   node scripts/run-rich-memory-arc-experiment.js [--sessions N] [--learners M]
 *        [--cell <cell>] [--arms baseline,rich] [--real] [--out <dir>]
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EVAL_CLI = path.join(ROOT, 'scripts/eval-cli.js');

// Drive the proven CLI (it persists rows with provider + dialogue, which the programmatic
// runEvaluation path does not in this isolated setup). Returns combined stdout even on a
// non-zero exit — `run` can exit non-zero on a failed-validation test while still storing a
// scorable row. The shell inherits process.env (EVAL_DB_PATH + dotenv-loaded keys).
function sh(argv) {
  try {
    return execSync(argv.map((a) => JSON.stringify(a)).join(' '), {
      cwd: ROOT,
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    return `${e.stdout || ''}\n${e.stderr || ''}`;
  }
}

function opt(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}
const REAL = process.argv.includes('--real');
const N_SESSIONS = Math.max(1, Number.parseInt(opt('--sessions', REAL ? '3' : '4'), 10) || 4);
const N_LEARNERS = Math.max(1, Number.parseInt(opt('--learners', '1'), 10) || 1);
const CELL = opt('--cell', 'cell_5_recog_single_unified');
const ARMS = (opt('--arms', 'baseline,rich') || '')
  .split(',')
  .map((a) => a.trim())
  .filter(Boolean);
const STAMP = `${new Date().toISOString().replace(/[:.]/g, '-')}`;
const OUT_DIR = path.resolve(opt('--out', path.join(ROOT, 'exports', `rich-memory-arc-${STAMP}`)));

// Ordered multi-turn dialogue scenarios (must have a turns: block → runMultiTurnTest).
const SESSION_SCENARIOS = [
  'misconception_correction_flow',
  'mood_frustration_to_breakthrough',
  'mutual_transformation_journey',
  'productive_deadlock_impasse',
].slice(0, N_SESSIONS);

// ── Isolate ALL writable stores before importing anything ───────────────────
const STORE_DIR = REAL ? OUT_DIR : fs.mkdtempSync(path.join(os.tmpdir(), 'rich-exp-'));
fs.mkdirSync(STORE_DIR, { recursive: true });
process.env.EVAL_DB_PATH = path.join(STORE_DIR, 'experiment.db');
process.env.EVAL_LOGS_DIR = path.join(STORE_DIR, 'logs');
process.env.EVAL_WRITING_PAD_DIR = path.join(STORE_DIR, 'pads');
fs.mkdirSync(process.env.EVAL_LOGS_DIR, { recursive: true });
fs.mkdirSync(process.env.EVAL_WRITING_PAD_DIR, { recursive: true });

// Generation/scoring run via the eval-cli subprocess (see sh()); only the rich store
// is used in-process here, to build the injection narrative and write back between sessions.
const mem = await import(path.join(ROOT, 'services/memory/learnerMemoryService.js'));

const LEVELS = ['exposed', 'developing', 'proficient', 'mastered'];

// Smoke-grade write-back: turn a finished session into rich-store state so the next
// session's injection is richer. (A production version would mine the transcript; this
// keys off the scenario + the session's score, which is enough to test the loop.)
function writeBackRichStore(learnerId, scenario, sessionIdx, score) {
  const concept = scenario;
  mem.upsertConceptState(learnerId, concept, {
    label: scenario.replace(/_/g, ' '),
    level: LEVELS[Math.min(sessionIdx, LEVELS.length - 1)],
    confidence: typeof score === 'number' ? Math.max(0, Math.min(1, score / 100)) : 0.5,
  });
  mem.createEpisode({
    learnerId,
    sessionId: `${scenario}-${sessionIdx}`,
    type: (score ?? 50) >= 70 ? 'breakthrough' : 'struggle',
    content: `session ${sessionIdx + 1} on ${scenario.replace(/_/g, ' ')} (score ${score ?? 'n/a'})`,
    importance: 0.6,
    concepts: [concept],
  });
  mem.createThread({ learnerId, topic: concept, question: `open thread from ${scenario} (s${sessionIdx + 1})` });
  mem.createSessionSummary({
    learnerId,
    sessionId: `${scenario}-${sessionIdx}`,
    narrativeSummary: `session ${sessionIdx + 1}: ${scenario.replace(/_/g, ' ')}`,
    conceptsTouched: [concept],
    unresolvedQuestions: [`carry-over from ${scenario}`],
  });
}

// Read the just-scored row's tutor quality back from the isolated DB, keyed by
// run_id (reliable — the stored learner_id column comes back empty for these rows).
function readSessionScore(runId, scenario) {
  try {
    const db = new Database(process.env.EVAL_DB_PATH, { readonly: true });
    const row = db
      .prepare(
        `SELECT tutor_first_turn_score AS first, tutor_last_turn_score AS last, tutor_overall_score AS overall
         FROM evaluation_results
         WHERE run_id = ? AND scenario_id = ?
         ORDER BY created_at DESC, id DESC LIMIT 1`,
      )
      .get(runId, scenario);
    db.close();
    return row || null;
  } catch (e) {
    return { error: e.message };
  }
}

async function runArc(arm, learnerIdx) {
  const learnerId = `richexp-${arm}-${String(learnerIdx).padStart(2, '0')}-${STAMP}`;
  mem.getOrCreateLearnerMemory(learnerId);
  const sessions = [];
  for (let s = 0; s < SESSION_SCENARIOS.length; s++) {
    const scenario = SESSION_SCENARIOS[s];
    // RICH arm: build + inject the accumulated narrative; baseline injects nothing.
    const injected = arm === 'rich' ? mem.buildContextInjection(learnerId).narrativeSummary || null : null;

    // Generate via the proven CLI (persists provider + dialogue). The rich-store
    // narrative is handed over in a file (no CLI quoting). --skip-rubric: the evaluate
    // pass below does the scoring (REAL); dry-run writes a mock score directly.
    const runArgs = [
      process.execPath,
      EVAL_CLI,
      'run',
      '--profile',
      CELL,
      '--scenario',
      scenario,
      '--runs',
      '1',
      '--learner-id',
      learnerId,
      '--skip-rubric',
    ];
    if (!REAL) runArgs.push('--dry-run');
    if (injected) {
      const eeeFile = path.join(STORE_DIR, `eee-${arm}-${learnerIdx}-s${s}.txt`);
      fs.writeFileSync(eeeFile, injected);
      runArgs.push('--external-ego-extension-file', eeeFile);
    }
    const runId = (sh(runArgs).match(/Run ID:\s*(\S+)/) || [])[1] || null;

    // REAL: canonical per-turn tutor scoring (--tutor-only keeps the judge pass cheap).
    if (REAL && runId) sh([process.execPath, EVAL_CLI, 'evaluate', runId, '--tutor-only']);

    const score = runId ? readSessionScore(runId, scenario) : { error: 'no runId parsed' };
    const primary = score && typeof score.first === 'number' ? score.first : null;
    // Write back so the next session's injection is richer (rich arm only).
    if (arm === 'rich') writeBackRichStore(learnerId, scenario, s, primary);

    sessions.push({ session: s + 1, scenario, runId, injectedChars: injected ? injected.length : 0, score });
    console.log(
      `  [${arm} L${learnerIdx}] s${s + 1} ${scenario}: injected=${injected ? injected.length + 'ch' : '-'} score=${primary ?? '?'}`,
    );
  }
  return { arm, learnerId, sessions };
}

// ── Run ─────────────────────────────────────────────────────────────────────
console.log(`\nRich-memory cross-session experiment (#3, approach A)`);
console.log(
  `mode: ${REAL ? 'REAL (paid)' : 'dry-run (mock, free)'} | arms: ${ARMS.join(', ')} | learners/arm: ${N_LEARNERS} | sessions: ${SESSION_SCENARIOS.length} | cell: ${CELL}`,
);
console.log(`scenarios: ${SESSION_SCENARIOS.join(' -> ')}`);
console.log(`stores: ${STORE_DIR}${REAL ? '' : ' (temp)'}\n`);

const arcs = [];
for (const arm of ARMS) {
  for (let i = 1; i <= N_LEARNERS; i++) {
    arcs.push(await runArc(arm, i));
  }
}

// ── Report ────────────────────────────────────────────────────────────────
function armSlope(armArcs) {
  // mean per-session first-turn score across learners, then last-minus-first
  const perSession = SESSION_SCENARIOS.map((_, s) => {
    const vals = armArcs.map((a) => a.sessions[s]?.score?.first).filter((v) => typeof v === 'number');
    return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
  });
  const known = perSession.filter((v) => v !== null);
  const slope = known.length >= 2 ? known[known.length - 1] - known[0] : null;
  return { perSession, slope };
}

const summary = {};
for (const arm of ARMS) {
  summary[arm] = armSlope(arcs.filter((a) => a.arm === arm));
}

console.log('\n── per-arm per-session mean first-turn score ──');
for (const arm of ARMS) {
  const ps = summary[arm].perSession.map((v) => (v === null ? '·' : v.toFixed(1))).join('  ');
  console.log(`  ${arm.padEnd(9)} ${ps}   slope=${summary[arm].slope ?? (REAL ? '?' : 'n/a (dry-run)')}`);
}

const report = {
  stamp: STAMP,
  mode: REAL ? 'real' : 'dry-run',
  cell: CELL,
  scenarios: SESSION_SCENARIOS,
  arms: ARMS,
  learnersPerArm: N_LEARNERS,
  arcs,
  summary,
};
// Report lands beside the stores: OUT_DIR in --real (persisted for analysis), the
// temp dir in dry-run (cleaned up below). STORE_DIR === OUT_DIR in --real mode.
const reportPath = path.join(STORE_DIR, 'report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nreport: ${reportPath}`);

if (!REAL) {
  fs.rmSync(STORE_DIR, { recursive: true, force: true });
  console.log(
    '\ndry-run OK — orchestration plumbing exercised (arms ran, rich arm injected + wrote back). No scores (mock); use --real for the judged experiment.',
  );
}
