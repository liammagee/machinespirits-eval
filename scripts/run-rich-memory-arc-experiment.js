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
 * Isolation: EVAL_DB_PATH + EVAL_WRITING_PAD_DIR go to a dedicated location (temp in
 * dry-run, <out-dir>/ in --real). EVAL_LOGS_DIR is intentionally NOT overridden — tutor-core
 * writes transcripts to a hardcoded <repo>/logs/tutor-dialogues and the evaluate pass must
 * read them from the same default, so isolating it breaks judging. Transcripts therefore
 * live in the shared (gitignored) repo logs/, keyed by unique dialogue_id; results do not.
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
import Anthropic from '@anthropic-ai/sdk';

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
// Optional overrides to dodge a slow/contended provider: --gen-model swaps the
// generation model for ALL agents (e.g. gemini.flash → direct Gemini API, off OpenRouter);
// --judge-cli scores via a CLI backend (claude|codex|gemini) instead of an API judge.
const GEN_MODEL = opt('--gen-model', null);
const JUDGE_CLI = opt('--judge-cli', null);
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

// ── Isolate the DB + writing pads before importing anything ─────────────────
// NOTE: we deliberately do NOT override EVAL_LOGS_DIR. tutor-core's dialogueLogService
// writes the per-turn transcript to a hardcoded <repo>/logs/tutor-dialogues, which the
// evaluate pass only finds if its reader (EVAL_LOGS_DIR-based) defaults to the same place.
// Isolating EVAL_LOGS_DIR split write (repo/logs) from read (isolated) → "dialogue log not
// found". The DB + pads (the experiment's results) stay isolated; transcripts live in the
// shared, gitignored repo logs/ keyed by unique dialogue_id.
const STORE_DIR = REAL ? OUT_DIR : fs.mkdtempSync(path.join(os.tmpdir(), 'rich-exp-'));
fs.mkdirSync(STORE_DIR, { recursive: true });
process.env.EVAL_DB_PATH = path.join(STORE_DIR, 'experiment.db');
process.env.EVAL_WRITING_PAD_DIR = path.join(STORE_DIR, 'pads');
fs.mkdirSync(process.env.EVAL_WRITING_PAD_DIR, { recursive: true });

// Generation/scoring run via the eval-cli subprocess (see sh()); only the rich store
// is used in-process here, to build the injection narrative and write back between sessions.
const mem = await import(path.join(ROOT, 'services/memory/learnerMemoryService.js'));

const LEVELS = ['exposed', 'developing', 'proficient', 'mastered'];
const EPISODE_TYPES = new Set([
  'breakthrough',
  'struggle',
  'insight',
  'question',
  'connection',
  'misconception',
  'emotional',
  'metacognitive',
]);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Load a session transcript (tutor suggestion + learner reply per turn) from its dialogue
// log, found via the row's dialogue_id. Returns null if unavailable.
function loadTranscript(runId, scenario) {
  let dialogueId = null;
  try {
    const db = new Database(process.env.EVAL_DB_PATH, { readonly: true });
    dialogueId = db
      .prepare(
        'SELECT dialogue_id FROM evaluation_results WHERE run_id = ? AND scenario_id = ? ORDER BY id DESC LIMIT 1',
      )
      .get(runId, scenario)?.dialogue_id;
    db.close();
  } catch {
    return null;
  }
  if (!dialogueId) return null;
  const logPath = path.join(ROOT, 'logs', 'tutor-dialogues', `${dialogueId}.json`);
  if (!fs.existsSync(logPath)) return null;
  let log;
  try {
    log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  } catch {
    return null;
  }
  const turns = Array.isArray(log.conversationHistory) ? log.conversationHistory : [];
  const text = turns
    .map((t) => {
      const sug = t.suggestion;
      const tutor = typeof sug === 'string' ? sug : sug?.message || sug?.text || JSON.stringify(sug || '');
      return `Tutor: ${tutor}\nLearner: ${t.learnerMessage || t.learnerAction || ''}`;
    })
    .join('\n\n');
  return text.trim() || null;
}

// Faithful write-back: summarise the SESSION TRANSCRIPT into memory updates with NO access
// to the judge's score (removes the smoke's score→memory feedback path). A cheap Claude-haiku
// extractor returns concept levels, episodes, and open threads grounded in what happened.
async function extractMemoryFromTranscript(transcript, scenario) {
  const prompt =
    `Summarise this tutoring session into a learner-memory record, based ONLY on the transcript ` +
    `(do NOT invent or infer a quality score). Output STRICT JSON, no prose:\n` +
    `{"concepts":[{"id":"<slug>","label":"<name>","level":"exposed|developing|proficient|mastered"}],` +
    `"episodes":[{"type":"breakthrough|struggle|insight|misconception|question","content":"<=15 words"}],` +
    `"threads":[{"topic":"<slug>","question":"<an open question the learner still has>"}],` +
    `"sessionSummary":"<one sentence>"}\n` +
    `Set each concept "level" by how the learner engaged THIS session (grasped vs. struggled), not by any score. ` +
    `Scenario tag: ${scenario}.\n\nTRANSCRIPT:\n${transcript.slice(0, 12000)}`;
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = (msg.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

async function writeBackRichStore(learnerId, scenario, sessionIdx, runId) {
  // session_id is globally UNIQUE in tutor_session_summaries, so scope it to the
  // learner (learnerId already carries arm + index + run STAMP) — otherwise rich L2's
  // session 1 collides with rich L1's, and the same scenario reused across learners
  // would crash the arc.
  const sessionId = `${learnerId}__${scenario}-${sessionIdx}`;
  // A summary collision must never kill the run — the concepts/episodes are the signal;
  // the summary row is incidental. Wrap it so it can only warn.
  const safeSummary = (narrativeSummary, conceptsTouched) => {
    try {
      mem.createSessionSummary({
        learnerId,
        sessionId,
        narrativeSummary: narrativeSummary.slice(0, 300),
        conceptsTouched,
      });
    } catch (e) {
      console.error(`  [warn] session-summary write skipped (${e.message})`);
    }
  };
  // Dry-run: no transcript and no paid extractor — a minimal stub keeps the loop exercised.
  if (!REAL) {
    mem.upsertConceptState(learnerId, scenario, {
      label: scenario.replace(/_/g, ' '),
      level: LEVELS[Math.min(sessionIdx, 3)],
    });
    mem.createEpisode({ learnerId, sessionId, type: 'insight', content: `dry-run ${scenario}`, concepts: [scenario] });
    safeSummary(`dry-run s${sessionIdx + 1}: ${scenario}`, [scenario]);
    return;
  }
  // REAL: faithful, transcript-derived, score-independent.
  try {
    const transcript = loadTranscript(runId, scenario);
    if (!transcript) throw new Error('transcript unavailable');
    const m = await extractMemoryFromTranscript(transcript, scenario);
    const conceptIds = (m.concepts || []).map((c) => c.id).filter(Boolean);
    for (const c of m.concepts || []) {
      if (c.id && LEVELS.includes(c.level))
        mem.upsertConceptState(learnerId, c.id, { label: c.label || c.id, level: c.level });
    }
    for (const e of m.episodes || []) {
      if (e.content)
        mem.createEpisode({
          learnerId,
          sessionId,
          type: EPISODE_TYPES.has(e.type) ? e.type : 'insight',
          content: String(e.content).slice(0, 200),
          concepts: conceptIds,
        });
    }
    for (const t of m.threads || []) {
      if (t && t.question)
        mem.createThread({ learnerId, topic: t.topic || scenario, question: String(t.question).slice(0, 200) });
    }
    safeSummary(m.sessionSummary || `session on ${scenario}`, conceptIds.length ? conceptIds : [scenario]);
  } catch (e) {
    console.error(`  [warn] faithful write-back failed (${e.message}); minimal fallback`);
    safeSummary(`session ${sessionIdx + 1}: ${scenario.replace(/_/g, ' ')}`, [scenario]);
  }
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
    if (GEN_MODEL) runArgs.push('--model', GEN_MODEL); // override all agents' model (e.g. off OpenRouter)

    // A transient provider hiccup can drop a session silently: eval-cli prints a Run ID
    // (early, at run creation) but a generation error then leaves no persisted, scored
    // row. A first powered run lost a contiguous ~7-session window this way, unscoring
    // whole learners. Verify the OUTCOME (a non-null score landed), not just that an ID
    // was printed, and retry generate+judge so a short outage self-heals.
    let runId = null;
    let score = null;
    let primary = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      runId = (sh(runArgs).match(/Run ID:\s*(\S+)/) || [])[1] || null;
      // REAL: canonical per-turn tutor scoring (--tutor-only keeps the judge pass cheap;
      // --judge-cli routes scoring to a CLI backend [claude|codex|gemini] vs an API judge).
      if (REAL && runId) {
        const evalArgs = [process.execPath, EVAL_CLI, 'evaluate', runId, '--tutor-only'];
        if (JUDGE_CLI) evalArgs.push('--judge-cli', JUDGE_CLI);
        sh(evalArgs);
      }
      score = runId ? readSessionScore(runId, scenario) : { error: 'no runId parsed' };
      primary = score && typeof score.overall === 'number' ? score.overall : null;
      if (!REAL || primary !== null) break; // dry-run: one pass; REAL: retry until scored
      console.error(`  [retry] ${arm} L${learnerIdx} s${s + 1}: attempt ${attempt}/3 produced no score`);
    }
    // Write back so the next session's injection is richer (rich arm only).
    if (arm === 'rich') await writeBackRichStore(learnerId, scenario, s, runId);

    sessions.push({ session: s + 1, scenario, runId, injectedChars: injected ? injected.length : 0, score });
    // Incremental persistence: a kill mid-run still leaves every completed session on disk.
    if (REAL)
      fs.appendFileSync(
        path.join(STORE_DIR, 'sessions.jsonl'),
        JSON.stringify({ arm, learnerIdx, session: s + 1, scenario, runId, score }) + '\n',
      );
    console.log(
      `  [${arm} L${learnerIdx}] s${s + 1} ${scenario}: injected=${injected ? injected.length + 'ch' : '-'} score=${primary ?? '?'}`,
    );
  }
  return { arm, learnerId, sessions };
}

// ── Run ─────────────────────────────────────────────────────────────────────
console.log(`\nRich-memory cross-session experiment (#3, approach A)`);
console.log(
  `mode: ${REAL ? 'REAL (paid)' : 'dry-run (mock, free)'} | arms: ${ARMS.join(', ')} | learners/arm: ${N_LEARNERS} | sessions: ${SESSION_SCENARIOS.length} | cell: ${CELL} | gen-model: ${GEN_MODEL || '(cell default)'} | judge: ${JUDGE_CLI ? JUDGE_CLI + ' CLI' : '(api default)'}`,
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
  // mean per-session OVERALL tutor score across learners, then last-minus-first.
  // (overall is more granular than first-turn, which clusters at a few discrete values.)
  const perSession = SESSION_SCENARIOS.map((_, s) => {
    const vals = armArcs.map((a) => a.sessions[s]?.score?.overall).filter((v) => typeof v === 'number');
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

console.log('\n── per-arm per-session mean OVERALL tutor score ──');
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
