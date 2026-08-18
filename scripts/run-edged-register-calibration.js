#!/usr/bin/env node

// Edged-register outcome study — Stage-0 calibration runner (warm-only) and
// main-block runner (three arms over the four kept cells).
//
// Calibration implements the frozen design in
// notes/2026-08-16-edged-register-calibration-draft.md §2.3–§2.9:
// screen block (5 rows × 12 cells), zero-call screen decision, confirm block
// (survivors topped up to 12 rows), 4 lanes, hard cap 120 generated rows,
// report-only harm guardrail that pauses generation before the next dialogue,
// and the attended-resume discipline (single resume of the exact missing
// jobs, no --force, no widening, no model change).
//
// The main block implements the frozen Part 3 registration: arms A/B/C
// (cells 207/208/206) × the four kept corridor cells, sized by the exact
// test from the frozen 23/48 baseline and the registered +20 points, rows
// split evenly over cells within each arm, same lanes, guardrail pause and
// resume discipline. Endpoint conversion is read afterwards by the model
// reader (scripts/read-edged-register-endpoint.js), not by this runner.
//
// No paid call leaves this runner without all three gates: a committed GO
// note carrying the plan SHA, --launch-approved, and --expected-sha matching
// a clean checkout. The draft note licenses no paid call by itself.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import yaml from 'yaml';

import {
  EDGED_REGISTER_CALIBRATION as GRID,
  applyRowCap,
  buildEdgedRegisterCalibrationPlan,
  buildEdgedRegisterMainBlockPlan,
  confirmTopUpJobs,
  decideScreenOutcome,
  harmGuardrailFindings,
  validateEdgedRegisterCalibrationPlan,
  validateEdgedRegisterMainBlockPlan,
} from '../services/edgedRegisterCalibration.js';
import { readHarmVerdict } from '../services/edgedRegisterHarmReader.js';
import { openEvaluationDbReadonly } from '../services/evaluationDbReadonly.js';
import {
  analyzeCharismaDesireRows,
  isPositiveCharismaDesireOutcome,
} from './report-charisma-desire-breakthrough-matrix.js';
import { findDialogueLog } from './dump-turn-prompts.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_OUTPUT_DIR = 'exports/edged-register-calibration';
const STATE_SCHEMA = 'machinespirits.edged-register-calibration-state.v1';
const MAIN_STATE_SCHEMA = 'machinespirits.edged-register-main-block-state.v1';
const MAX_ATTEMPTS_PER_JOB = 2; // initial run + the single attended resume

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

export function calibrationJobDescription(batchId, job, attempt) {
  return `edged-register-calibration ${batchId} ${job.block} job ${job.ordinal} ${job.scenario} attempt ${attempt}`;
}

export function calibrationGenerationCommand(job, { grid = GRID, batchId, attempt }) {
  return [
    process.execPath,
    'scripts/eval-cli.js',
    'run',
    '--profiles',
    // Main-block jobs carry their arm's profile; calibration jobs fall back
    // to the warm calibration arm the grid pins.
    job.profile || grid.profile,
    '--scenario',
    job.scenario,
    '--runs',
    '1',
    '--parallelism',
    '1',
    '--skip-rubric',
    '--tutor-model',
    grid.generation.tutorModel,
    '--learner-model',
    grid.generation.learnerModel,
    '--description',
    calibrationJobDescription(batchId, job, attempt),
  ];
}

// A note that is still a draft says so at the top. Amendment 2 makes that
// banner load-bearing instead of decorative.
const GO_NOTE_DRAFT_MARKERS = /DRAFT FOR HUMAN REVIEW|NOT SIGNED|unsigned draft/iu;

/** Content check for the GO note (the git-tracked check lives in assertGoNote). */
export function checkGoNoteContent(content, planSha256) {
  const errors = [];
  const text = String(content || '');
  if (!text.includes(planSha256)) errors.push(`GO note does not carry the plan SHA ${planSha256}`);
  // The word alone is not a signature: every draft's own title carries it.
  // The three signed notes all end with GO on a line of its own.
  if (!/^GO$/mu.test(text)) errors.push('GO note does not say GO on a line of its own');
  if (GO_NOTE_DRAFT_MARKERS.test(text)) errors.push('GO note still carries its draft banner — it is not signed');
  return { ok: errors.length === 0, errors };
}

export function newBatchState(plan, batchId) {
  return {
    schema: STATE_SCHEMA,
    batchId,
    planSha256: plan.planSha256,
    scenarioSourceSha256: plan.scenarioSourceSha256,
    profile: plan.profile,
    createdAt: new Date().toISOString(),
    rowsAttempted: 0,
    jobs: plan.screenJobs.map((job) => ({ ...job, status: 'pending', attempts: [] })),
    screenDecision: null,
    deferredJobs: [],
    guardrailFlags: [],
    operatorDecisions: [],
    killed: false,
  };
}

export function newMainBlockState(plan, batchId) {
  return {
    schema: MAIN_STATE_SCHEMA,
    batchId,
    planSha256: plan.planSha256,
    scenarioSourceSha256: plan.scenarioSourceSha256,
    arms: plan.arms.map((armSpec) => ({ ...armSpec })),
    hardCapRows: plan.sizing.hardCapRows,
    createdAt: new Date().toISOString(),
    rowsAttempted: 0,
    jobs: plan.mainJobs.map((job) => ({ ...job, status: 'pending', attempts: [] })),
    guardrailFlags: [],
    // Part 3 amendment 1: the harm reader's calls are priced in the GO note,
    // so the block counts them and stops reading at the registered ceiling.
    harmReaderCalls: 0,
    harmReaderCallCeiling: plan.guardrail.screen.readerCallCeiling,
    operatorDecisions: [],
    killed: false,
  };
}

/** Calibration states predate the per-state cap and run under the grid's 120. */
export function stateHardCap(state) {
  return state.hardCapRows ?? GRID.hardCapRows;
}

/**
 * Jobs a paid block may still run: pending or failed-once, minus killed cells,
 * with the attended-resume discipline enforced (a job that has already burned
 * its initial attempt and its single resume needs an operator ruling instead).
 */
export function enumerateRunnableJobs(state, block) {
  const runnable = [];
  const needsRuling = [];
  for (const job of state.jobs) {
    if (job.block !== block) continue;
    if (job.status === 'completed' || job.status === 'killed_cell') continue;
    if (job.attempts.length >= MAX_ATTEMPTS_PER_JOB) {
      needsRuling.push(job);
      continue;
    }
    runnable.push(job);
  }
  return { runnable, needsRuling };
}

export function unresolvedGuardrailFlags(state) {
  return (state.guardrailFlags || []).filter((flag) => !flag.resolution);
}

/** Per-cell screen outcomes from classified rows, keyed back through job → rowId. */
export function screenCellOutcomes(state, positiveByRowId, { grid = GRID } = {}) {
  const perCell = new Map(
    grid.cells.map((cell) => [cell.scenario, { scenario: cell.scenario, rows: 0, positives: 0 }]),
  );
  const errors = [];
  for (const job of state.jobs) {
    if (job.block !== 'screen') continue;
    if (job.status !== 'completed' || !job.rowId) {
      errors.push(
        `screen job ${job.ordinal} (${job.scenario}) is ${job.status}; the screen decision needs all 60 rows`,
      );
      continue;
    }
    if (!positiveByRowId.has(job.rowId)) {
      errors.push(`screen job ${job.ordinal} (${job.scenario}) row ${job.rowId} was not classified`);
      continue;
    }
    const cell = perCell.get(job.scenario);
    cell.rows += 1;
    if (positiveByRowId.get(job.rowId)) cell.positives += 1;
  }
  return { outcomes: [...perCell.values()], errors };
}

// ---------------------------------------------------------------------------
// State file
// ---------------------------------------------------------------------------

function statePath(batchDir) {
  return path.join(batchDir, 'state.json');
}

function loadState(batchDir) {
  const file = statePath(batchDir);
  if (!fs.existsSync(file)) return null;
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (state.schema !== STATE_SCHEMA && state.schema !== MAIN_STATE_SCHEMA) {
    throw new Error(`unrecognized state schema ${state.schema} at ${file}`);
  }
  return state;
}

function decisionKey(record) {
  return `${record.decision}|${record.detail ?? ''}|${record.recordedAt}`;
}

// The operator records a guardrail ruling with --resume-decision in a SECOND
// process, while this one is still alive: registered stop rule 2 stops the next
// dialogue, it does not exit the runner. A whole-object write from memory would
// silently discard that ruling (draft note §2.14), so every save re-reads the
// file and carries the operator-owned fields forward.
//
// The split is by owner, not by field type. The operator owns `killed`,
// `operatorDecisions`, flag resolutions, and the kill of unstarted work; the
// runner owns attempts, completions and `rowsAttempted`. A row already
// generated is a paid fact and is never downgraded to killed.
function mergeOperatorFields(batchDir, state) {
  const file = statePath(batchDir);
  if (!fs.existsSync(file)) return state;
  let disk;
  try {
    disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return state; // a torn read carries nothing forward; the writer below is atomic
  }
  if (disk.schema !== state.schema || disk.batchId !== state.batchId) return state;

  if (disk.killed) state.killed = true;

  const seen = new Set((state.operatorDecisions || []).map(decisionKey));
  for (const record of disk.operatorDecisions || []) {
    if (seen.has(decisionKey(record))) continue;
    state.operatorDecisions.push(record);
    seen.add(decisionKey(record));
  }

  const ruled = new Map();
  for (const flag of disk.guardrailFlags || []) {
    if (flag.resolution) ruled.set(flag.ordinal, flag.resolution);
  }
  for (const flag of state.guardrailFlags || []) {
    if (!flag.resolution && ruled.has(flag.ordinal)) flag.resolution = ruled.get(flag.ordinal);
  }

  const killedOrdinals = new Set(
    (disk.jobs || []).filter((job) => job.status === 'killed_cell').map((job) => job.ordinal),
  );
  for (const job of state.jobs || []) {
    if (job.status !== 'completed' && killedOrdinals.has(job.ordinal)) job.status = 'killed_cell';
  }
  return state;
}

export function saveState(batchDir, state) {
  fs.mkdirSync(batchDir, { recursive: true });
  mergeOperatorFields(batchDir, state);
  const file = statePath(batchDir);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

// ---------------------------------------------------------------------------
// Launch gates
// ---------------------------------------------------------------------------

function gitOutput(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

export function assertLaunchAuthorization(expectedSha) {
  if (!/^[0-9a-f]{40}$/u.test(expectedSha || '')) {
    throw new Error('--launch-approved also requires --expected-sha with the exact 40-character clean commit SHA');
  }
  const head = gitOutput(['rev-parse', 'HEAD']);
  if (head !== expectedSha) throw new Error(`launch SHA mismatch: expected ${expectedSha}, checkout is ${head}`);
  if (gitOutput(['status', '--porcelain'])) throw new Error('paid calibration work requires a clean checkout');
  return head;
}

function assertGoNote(goNotePath, planSha256) {
  if (!goNotePath) throw new Error('paid calibration work requires --go-note <committed GO note>');
  const absolute = path.resolve(ROOT, goNotePath);
  if (!fs.existsSync(absolute)) throw new Error(`GO note not found: ${absolute}`);
  const relative = path.relative(ROOT, absolute);
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', relative], { cwd: ROOT, encoding: 'utf8' });
  if (tracked.status !== 0) throw new Error(`GO note ${relative} is not committed (git ls-files does not know it)`);
  if (gitOutput(['status', '--porcelain', '--', relative])) {
    throw new Error(`GO note ${relative} has uncommitted changes`);
  }
  const content = checkGoNoteContent(fs.readFileSync(absolute, 'utf8'), planSha256);
  if (!content.ok) throw new Error(`GO note ${relative} rejected: ${content.errors.join('; ')}`);
  return absolute;
}

function assertProfileRegistered(profileName) {
  const configPath = path.join(ROOT, 'config', 'tutor-agents.yaml');
  const registered = yaml.parse(fs.readFileSync(configPath, 'utf8'))?.profiles?.[profileName];
  if (!registered) {
    throw new Error(
      `profile ${profileName} is not registered in config/tutor-agents.yaml; run the cell registration first`,
    );
  }
}

// ---------------------------------------------------------------------------
// DB reads (readonly; never creates the file)
// ---------------------------------------------------------------------------

function withReadonlyDb(fn) {
  const { db, dbPath, reason } = openEvaluationDbReadonly(ROOT);
  if (!db) throw new Error(`evaluation DB unavailable at ${dbPath}: ${reason}`);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function findRunIdByDescription(description) {
  return withReadonlyDb(
    (db) =>
      db
        .prepare('SELECT id FROM evaluation_runs WHERE description = ? ORDER BY created_at DESC LIMIT 1')
        .get(description)?.id || null,
  );
}

function loadRunRows(runId) {
  return withReadonlyDb((db) =>
    db
      .prepare(
        `SELECT id, run_id, scenario_id, profile_name, dialogue_id, dialogue_content_hash, success
         FROM evaluation_results WHERE run_id = ? ORDER BY id`,
      )
      .all(runId),
  );
}

function loadDialogueLog(row) {
  for (const id of [row.dialogue_id, row.dialogue_content_hash]) {
    if (!id) continue;
    const found = findDialogueLog(id, { rootDir: ROOT });
    if (found?.log) return found.log;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Guardrail (report-only, pause before the next dialogue — §2.7 rule 2)
// ---------------------------------------------------------------------------

function guardrailFindingsForRow(row) {
  const log = loadDialogueLog(row);
  if (!log) {
    // Fail-closed engineering, not a registered family: an unreadable log
    // means the guardrail could not run, so the pause fires anyway.
    return [{ family: 'guardrail_unreadable', match: 'dialogue log missing', turnIndex: null }];
  }
  const turns = Array.isArray(log.turnResults) ? log.turnResults : [];
  const findings = [];
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    const tutorMessage = turn?.suggestions?.[0]?.message || turn?.suggestion?.message || turn?.tutorMessage || '';
    const postLearnerMessage = turns[index + 1]?.learnerMessage || '';
    for (const finding of harmGuardrailFindings({ tutorMessage, postLearnerMessage })) {
      findings.push({
        ...finding,
        turnIndex: turn?.turnIndex ?? index,
        tutorMessage,
        learnerBefore: turn?.learnerMessage || '',
      });
    }
  }
  return findings;
}

/**
 * Part 3 amendment 1 (2026-08-17): screen the word list's matches with the
 * harm reader. Every match keeps its place in the record; only a reader
 * "attacks the person" pauses the block. The reader fails closed — a failed
 * or unparsable call pauses, a match the reader never saw pauses, and the
 * block stops reading at the priced call ceiling rather than overspending.
 *
 * Returns the calls it made so the caller can carry the count in state.
 */
export async function screenGuardrailFindings(
  findings,
  { model, mock = false, rowId, read = readHarmVerdict, callsMade = 0, callCeiling = Infinity } = {},
) {
  const screened = [];
  let pause = false;
  let calls = 0;
  for (const finding of findings) {
    if (finding.family === 'guardrail_unreadable') {
      screened.push({ ...finding, reader: null, pausedOn: true });
      pause = true;
      continue;
    }
    if (callsMade + calls >= callCeiling) {
      screened.push({
        family: finding.family,
        match: finding.match,
        turnIndex: finding.turnIndex,
        reader: null,
        readerError: `harm reader call ceiling ${callCeiling} reached; this match was not read`,
        pausedOn: true,
      });
      pause = true;
      continue;
    }
    let verdict = null;
    let readerError = null;
    calls += 1;
    try {
      verdict = await read(
        {
          rowId,
          turnIndex: finding.turnIndex,
          match: finding.match,
          tutorMessage: finding.tutorMessage,
          learnerBefore: finding.learnerBefore,
        },
        { model, mock },
      );
    } catch (error) {
      readerError = error.message;
    }
    const pausedOn = readerError !== null || verdict?.attacksPerson === true;
    if (pausedOn) pause = true;
    screened.push({
      family: finding.family,
      match: finding.match,
      turnIndex: finding.turnIndex,
      reader: verdict,
      readerError,
      pausedOn,
    });
  }
  return { screened, pause, calls };
}

// ---------------------------------------------------------------------------
// Paid block pump (4 lanes, guardrail latch, hard cap)
// ---------------------------------------------------------------------------

function runChildToLog(command, logFile) {
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const out = fs.openSync(logFile, 'a');
    const child = spawn(command[0], command.slice(1), {
      cwd: ROOT,
      env: { ...process.env, EVAL_SCENARIOS_FILE: GRID.scenarioSource },
      stdio: ['ignore', out, out],
    });
    child.on('error', () => {
      fs.closeSync(out);
      resolve(1);
    });
    child.on('exit', (code, signal) => {
      fs.closeSync(out);
      resolve(signal ? 1 : (code ?? 1));
    });
  });
}

async function runBlock(
  state,
  batchDir,
  block,
  { lanes = GRID.generation.lanes, harmReaderMock = process.env.EDGED_HARM_READER === 'mock' } = {},
) {
  // Part 3 amendment 1 (main block only): the word list still runs on every
  // completed row, but a match is screened by the harm reader and only a
  // reader-confirmed attack pauses. The calibration block keeps its frozen
  // rule — every match pauses — because its plan SHA is cited provenance.
  const screenMatches = block === 'main';
  const queue = enumerateRunnableJobs(state, block);
  if (queue.needsRuling.length) {
    const list = queue.needsRuling.map((job) => `${job.ordinal} (${job.scenario})`).join(', ');
    throw new Error(
      `jobs ${list} already used their initial attempt and single attended resume; ` +
        'an explicit operator ruling is required before any further attempt',
    );
  }
  let cursor = 0;
  let paused = false;

  const takeJob = () => {
    if (paused || state.killed) return null;
    if (state.rowsAttempted >= stateHardCap(state)) return null;
    while (cursor < queue.runnable.length) {
      const job = queue.runnable[cursor];
      cursor += 1;
      if (job.status !== 'completed' && job.status !== 'killed_cell') return job;
    }
    return null;
  };

  const worker = async () => {
    for (;;) {
      const job = takeJob();
      if (!job) return;
      const attempt = job.attempts.length + 1;
      const description = calibrationJobDescription(state.batchId, job, attempt);
      job.status = 'running';
      job.attempts.push({ attempt, description, startedAt: new Date().toISOString() });
      state.rowsAttempted += 1;
      saveState(batchDir, state);

      const logFile = path.join(batchDir, 'logs', `job-${job.ordinal}-attempt-${attempt}.log`);
      const exitCode = await runChildToLog(
        calibrationGenerationCommand(job, { batchId: state.batchId, attempt }),
        logFile,
      );

      const attemptRecord = job.attempts.at(-1);
      attemptRecord.finishedAt = new Date().toISOString();
      attemptRecord.exitCode = exitCode;

      const runId = findRunIdByDescription(description);
      const row = runId ? loadRunRows(runId).find((r) => r.scenario_id === job.scenario && r.success === 1) : null;
      if (exitCode === 0 && row) {
        job.status = 'completed';
        job.runId = runId;
        job.rowId = row.id;
        const findings = guardrailFindingsForRow(row);
        if (findings.length) {
          // Reserve this row's worst case before awaiting, so four lanes
          // cannot each read a stale count and jointly overshoot the ceiling.
          const reserved = screenMatches ? findings.length : 0;
          state.harmReaderCalls = (state.harmReaderCalls || 0) + reserved;
          const screened = screenMatches
            ? await screenGuardrailFindings(findings, {
                mock: harmReaderMock,
                rowId: row.id,
                callsMade: state.harmReaderCalls - reserved,
                callCeiling: state.harmReaderCallCeiling ?? Infinity,
              })
            : { screened: findings, pause: true, calls: 0 };
          state.harmReaderCalls += (screened.calls || 0) - reserved;
          state.guardrailFlags.push({
            ordinal: job.ordinal,
            scenario: job.scenario,
            rowId: row.id,
            findings: screened.screened,
            screened: screenMatches,
            raisedAt: new Date().toISOString(),
            // A match the reader cleared is written to the record and closes
            // itself: it never reaches the operator, and the end-of-block read
            // still sees it.
            resolution: screened.pause ? null : 'cleared_by_harm_reader',
          });
          // report-only: the row stays; a confirmed attack starts no new dialogue
          if (screened.pause) paused = true;
        }
      } else {
        job.status = 'failed';
        attemptRecord.runId = runId;
      }
      saveState(batchDir, state);
    }
  };

  await Promise.all(Array.from({ length: lanes }, () => worker()));
  return { paused };
}

// ---------------------------------------------------------------------------
// Zero-call modes
// ---------------------------------------------------------------------------

function classifyCompletedRows(state, { blocks }) {
  const scenariosPath = path.join(ROOT, GRID.scenarioSource);
  const scenarios = yaml.parse(fs.readFileSync(scenariosPath, 'utf8'))?.scenarios || {};
  const jobs = state.jobs.filter((job) => blocks.includes(job.block) && job.status === 'completed' && job.runId);
  const rows = [];
  const seenRowIds = new Set();
  for (const job of jobs) {
    for (const row of loadRunRows(job.runId)) {
      if (row.id !== job.rowId || seenRowIds.has(row.id)) continue;
      seenRowIds.add(row.id);
      rows.push(row);
    }
  }
  const outcomes = analyzeCharismaDesireRows(rows, scenarios, { loadLog: (row) => loadDialogueLog(row) });
  const positiveByRowId = new Map(outcomes.map((outcome) => [outcome.rowId, isPositiveCharismaDesireOutcome(outcome)]));
  return { rows, positiveByRowId };
}

function decideScreen(state, batchDir) {
  const { positiveByRowId } = classifyCompletedRows(state, { blocks: ['screen'] });
  const { outcomes, errors } = screenCellOutcomes(state, positiveByRowId);
  if (errors.length) {
    for (const error of errors) console.error(`[edged-calibration] ${error}`);
    throw new Error('screen decision failed closed: the screen block is not fully measured');
  }
  const decision = decideScreenOutcome(outcomes);
  if (!decision.ok) throw new Error(`screen decision rejected: ${decision.errors.join('; ')}`);

  const topUp = confirmTopUpJobs(decision, { startOrdinal: GRID.screen.plannedRows + 1 });
  const { runnable, deferred } = applyRowCap(topUp, state.rowsAttempted);
  state.screenDecision = { decidedAt: new Date().toISOString(), decision };
  state.jobs = [
    ...state.jobs.filter((job) => job.block === 'screen'),
    ...runnable.map((job) => ({ ...job, status: 'pending', attempts: [] })),
  ];
  state.deferredJobs = deferred;
  saveState(batchDir, state);

  for (const cell of decision.cells) {
    console.log(`[edged-calibration] ${cell.scenario}: ${cell.positives}/${cell.rows} -> ${cell.verdict}`);
  }
  console.log(
    `[edged-calibration] confirm block: ${runnable.length} jobs enqueued` +
      (deferred.length ? `; ${deferred.length} deferred at the ${GRID.hardCapRows}-row cap (recorded unmeasured)` : ''),
  );
}

function printStatus(state) {
  const byKey = new Map();
  for (const job of state.jobs) {
    const key = `${job.block}/${job.status}`;
    byKey.set(key, (byKey.get(key) || 0) + 1);
  }
  console.log(`[edged-calibration] batch ${state.batchId} plan ${state.planSha256.slice(0, 12)}…`);
  for (const [key, count] of [...byKey.entries()].sort()) console.log(`[edged-calibration] ${key}: ${count}`);
  console.log(`[edged-calibration] rows attempted ${state.rowsAttempted}/${stateHardCap(state)}`);
  const open = unresolvedGuardrailFlags(state);
  for (const flag of open) {
    const families = flag.findings.map((finding) => finding.family).join(', ');
    console.log(`[edged-calibration] OPEN GUARDRAIL FLAG job ${flag.ordinal} (${flag.scenario}): ${families}`);
    for (const finding of flag.findings) {
      if (finding.readerError) console.log(`[edged-calibration]   harm read failed: ${finding.readerError}`);
      else if (finding.reader?.attacksPerson) {
        console.log(`[edged-calibration]   reader: ${finding.reader.reason}`);
        if (finding.reader.quote) console.log(`[edged-calibration]   quote: ${finding.reader.quote}`);
      }
    }
  }
  // The amendment's own record: matches the reader cleared never reached the
  // operator, and the end-of-block read still sees them.
  const cleared = (state.guardrailFlags || []).filter((flag) => flag.resolution === 'cleared_by_harm_reader');
  if (cleared.length) {
    const matches = cleared.reduce((total, flag) => total + flag.findings.length, 0);
    console.log(`[edged-calibration] harm reader cleared ${matches} word-list matches on ${cleared.length} rows`);
  }
  if (state.harmReaderCallCeiling) {
    console.log(`[edged-calibration] harm reader calls ${state.harmReaderCalls || 0}/${state.harmReaderCallCeiling}`);
  }
  if (open.length) {
    console.log(
      '[edged-calibration] generation is paused; record the human ruling with ' +
        '--resume-decision resume_unchanged | kill_cell:<scenario> | kill_study',
    );
  }
  if (state.killed) console.log('[edged-calibration] STUDY KILLED by operator decision');
  if (state.screenDecision) {
    console.log(`[edged-calibration] screen decided ${state.screenDecision.decidedAt}`);
  }
}

// The main block has no deterministic classifier: conversion comes from the
// model reader afterwards. This report counts landed rows only.
function printMainBlockReport(state) {
  const perKey = new Map();
  for (const job of state.jobs) {
    if (job.status !== 'completed') continue;
    const key = `${job.arm} ${job.scenario}`;
    perKey.set(key, (perKey.get(key) || 0) + 1);
  }
  for (const [key, count] of [...perKey.entries()].sort()) {
    console.log(`[edged-main] ${key}: ${count} completed rows`);
  }
  console.log(
    '[edged-main] endpoint conversion is read afterwards by the model reader ' +
      '(scripts/read-edged-register-endpoint.js); no deterministic classifier applies here',
  );
}

function printReport(state) {
  if (state.schema === MAIN_STATE_SCHEMA) {
    printMainBlockReport(state);
    return;
  }
  const { positiveByRowId } = classifyCompletedRows(state, { blocks: ['screen', 'confirm'] });
  const perCell = new Map(GRID.cells.map((cell) => [cell.scenario, { rows: 0, positives: 0 }]));
  for (const job of state.jobs) {
    if (job.status !== 'completed' || !positiveByRowId.has(job.rowId)) continue;
    const cell = perCell.get(job.scenario);
    cell.rows += 1;
    if (positiveByRowId.get(job.rowId)) cell.positives += 1;
  }
  for (const [scenario, cell] of perCell) {
    console.log(`[edged-calibration] ${scenario}: ${cell.positives}/${cell.rows} pooled conversions`);
  }
  console.log(
    '[edged-calibration] corridor decision (kept 4/12–8/12, M-C1 eligibility, M-C2 audit) ' +
      'runs in the corridor selector, not here',
  );
}

function recordResumeDecision(state, batchDir, rawDecision) {
  const [decision, detail] = String(rawDecision).split(':');
  if (!GRID.guardrail.resumeOptions.includes(decision)) {
    throw new Error(
      `unknown resume decision ${rawDecision}; registered options: ${GRID.guardrail.resumeOptions.join(', ')}`,
    );
  }
  if (decision === 'kill_cell') {
    // Scenarios come from the batch itself, so a main-block ruling can only
    // kill one of the four kept cells and a calibration ruling one of its 12.
    const known = new Set(state.jobs.map((job) => job.scenario));
    if (!known.has(detail)) {
      throw new Error(`kill_cell needs a scenario from this batch, got ${detail || '(none)'}`);
    }
    for (const job of state.jobs) {
      if (job.scenario === detail && job.status !== 'completed') job.status = 'killed_cell';
    }
  }
  if (decision === 'kill_study') state.killed = true;
  const record = { decision, detail: detail || null, recordedAt: new Date().toISOString() };
  state.operatorDecisions.push(record);
  for (const flag of unresolvedGuardrailFlags(state)) flag.resolution = record;
  saveState(batchDir, state);
  console.log(`[edged-calibration] recorded operator decision ${decision}${detail ? `:${detail}` : ''}`);
}

function writeDryRunArtifact(plan, outputDir) {
  const validation = validateEdgedRegisterCalibrationPlan(plan);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  let profileRegistered = true;
  try {
    assertProfileRegistered(plan.profile);
  } catch {
    profileRegistered = false;
  }
  const artifact = {
    schema: 'machinespirits.edged-register-calibration-dry-run.v1',
    modelCalls: 0,
    paidLaunchStatus: 'locked_pending_go_note_and_clean_commit_launch',
    validation,
    planSha256: plan.planSha256,
    scenarioSourceSha256: plan.scenarioSourceSha256,
    profile: plan.profile,
    profileRegistered,
    screenJobs: plan.screenJobs,
    hardCapRows: plan.hardCapRows,
    exampleGenerationCommand: calibrationGenerationCommand(plan.screenJobs[0], {
      batchId: '<batch-id>',
      attempt: 1,
    }).join(' '),
  };
  fs.mkdirSync(outputDir, { recursive: true });
  const artifactPath = path.join(outputDir, 'plan.json');
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return { artifactPath, profileRegistered };
}

function writeMainBlockDryRunArtifact(plan, outputDir) {
  const validation = validateEdgedRegisterMainBlockPlan(plan);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const unregisteredProfiles = [];
  for (const armSpec of plan.arms) {
    try {
      assertProfileRegistered(armSpec.profile);
    } catch {
      unregisteredProfiles.push(armSpec.profile);
    }
  }
  const artifact = {
    schema: 'machinespirits.edged-register-main-block-dry-run.v1',
    modelCalls: 0,
    paidLaunchStatus: 'locked_pending_go_note_and_clean_commit_launch',
    validation,
    planSha256: plan.planSha256,
    scenarioSourceSha256: plan.scenarioSourceSha256,
    arms: plan.arms,
    armSelection: plan.armSelection || null,
    sizing: plan.sizing,
    harmReaderCallCeiling: plan.guardrail.screen.readerCallCeiling,
    unregisteredProfiles,
    // One example per arm so the GO note copies, never composes, a command.
    exampleGenerationCommands: plan.arms.map((armSpec) => {
      const job = plan.mainJobs.find((candidate) => candidate.arm === armSpec.arm);
      return calibrationGenerationCommand(job, { batchId: '<batch-id>', attempt: 1 }).join(' ');
    }),
  };
  fs.mkdirSync(outputDir, { recursive: true });
  // A subset writes beside the full plan, never over it: a signed GO note
  // cites the full artefact, and a subset dry run must not replace it.
  const artifactName = plan.armSelection
    ? `plan-main-block-${plan.armSelection.requested.join('').toLowerCase()}.json`
    : 'plan-main-block.json';
  const artifactPath = path.join(outputDir, artifactName);
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return { artifactPath, unregisteredProfiles };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'dry-run-main': { type: 'boolean', default: false },
      screen: { type: 'boolean', default: false },
      confirm: { type: 'boolean', default: false },
      'main-block': { type: 'boolean', default: false },
      'decide-screen': { type: 'boolean', default: false },
      status: { type: 'boolean', default: false },
      report: { type: 'boolean', default: false },
      'batch-dir': { type: 'string', default: '' },
      'go-note': { type: 'string', default: '' },
      'launch-approved': { type: 'boolean', default: false },
      'expected-sha': { type: 'string', default: '' },
      'resume-decision': { type: 'string', default: '' },
      arms: { type: 'string', default: '' },
      'output-dir': { type: 'string', default: DEFAULT_OUTPUT_DIR },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(
      'Usage: node scripts/run-edged-register-calibration.js --dry-run | --dry-run-main | ' +
        '--status --batch-dir <dir> | ' +
        '--decide-screen --batch-dir <dir> | --report --batch-dir <dir> | ' +
        '--resume-decision <resume_unchanged|kill_cell:<scenario>|kill_study> --batch-dir <dir> | ' +
        '(--screen|--confirm|--main-block) --batch-dir <dir> --go-note <note> --launch-approved --expected-sha <commit>\n' +
        '       (--dry-run-main|--main-block) [--arms A|B|C or a comma list; default all three]',
    );
    return;
  }

  const modes = [
    'dry-run',
    'dry-run-main',
    'screen',
    'confirm',
    'main-block',
    'decide-screen',
    'status',
    'report',
  ].filter((mode) => values[mode]);
  if (values['resume-decision']) modes.push('resume-decision');
  if (modes.length !== 1) throw new Error(`choose exactly one mode, got: ${modes.join(', ') || 'none'}`);

  const plan = buildEdgedRegisterCalibrationPlan({ root: ROOT });

  if (values['dry-run']) {
    const { artifactPath, profileRegistered } = writeDryRunArtifact(plan, path.resolve(ROOT, values['output-dir']));
    console.log(`[edged-calibration] plan SHA-256 ${plan.planSha256}`);
    console.log(`[edged-calibration] scenario source SHA-256 ${plan.scenarioSourceSha256}`);
    console.log(`[edged-calibration] ${plan.screenJobs.length} screen jobs, hard cap ${plan.hardCapRows} rows`);
    if (!profileRegistered) {
      console.log(`[edged-calibration] NOTE profile ${plan.profile} is not yet registered in tutor-agents.yaml`);
    }
    console.log(`[edged-calibration] ${path.relative(ROOT, artifactPath)}`);
    console.log(
      '[edged-calibration] paid calibration locked; a committed GO note plus clean-commit launch is required',
    );
    return;
  }

  if (values['dry-run-main']) {
    const mainPlan = buildEdgedRegisterMainBlockPlan({ root: ROOT, arms: values.arms });
    const { artifactPath, unregisteredProfiles } = writeMainBlockDryRunArtifact(
      mainPlan,
      path.resolve(ROOT, values['output-dir']),
    );
    const { sizing } = mainPlan;
    console.log(`[edged-main] plan SHA-256 ${mainPlan.planSha256}`);
    console.log(`[edged-main] scenario source SHA-256 ${mainPlan.scenarioSourceSha256}`);
    console.log(
      `[edged-main] exact-test size: ${sizing.nPerArm} rows per arm ` +
        `(${sizing.rowsPerCellPerArm} per cell), ${sizing.plannedRows} rows over ` +
        `${mainPlan.arms.length} arm${mainPlan.arms.length === 1 ? '' : 's'} ` +
        `(${mainPlan.arms.map((armSpec) => armSpec.arm).join('')}), ` +
        `power ${sizing.powerAtN} at baseline ${sizing.baselineRate} vs ${sizing.targetRate}`,
    );
    if (mainPlan.armSelection) {
      console.log(
        `[edged-main] SUBSET of the registered block: ${mainPlan.armSelection.requested.join(', ')} of ` +
          `${mainPlan.armSelection.registered.join(', ')} — ${mainPlan.armSelection.randomisationNote}`,
      );
    }
    console.log(`[edged-main] ${mainPlan.mainJobs.length} main jobs, hard cap ${sizing.hardCapRows} rows`);
    const screen = mainPlan.guardrail.screen;
    console.log(
      `[edged-main] harm guardrail: ${mainPlan.guardrail.disposition}, ` +
        `${screen.readerCallsPerMatch} reader call per match, ceiling ${screen.readerCallCeiling} calls`,
    );
    for (const profileName of unregisteredProfiles) {
      console.log(`[edged-main] NOTE profile ${profileName} is not yet registered in tutor-agents.yaml`);
    }
    console.log(`[edged-main] ${path.relative(ROOT, artifactPath)}`);
    console.log('[edged-main] paid main block locked; a committed GO note plus clean-commit launch is required');
    return;
  }

  const batchDir = values['batch-dir'] ? path.resolve(ROOT, values['batch-dir']) : null;
  if (!batchDir) throw new Error('this mode requires --batch-dir');

  if (values['resume-decision']) {
    const state = loadState(batchDir);
    if (!state) throw new Error(`no state at ${statePath(batchDir)}`);
    recordResumeDecision(state, batchDir, values['resume-decision']);
    return;
  }

  if (values.status) {
    const state = loadState(batchDir);
    if (!state) throw new Error(`no state at ${statePath(batchDir)}`);
    printStatus(state);
    return;
  }

  if (values.report) {
    const state = loadState(batchDir);
    if (!state) throw new Error(`no state at ${statePath(batchDir)}`);
    printReport(state);
    return;
  }

  if (values['decide-screen']) {
    const state = loadState(batchDir);
    if (!state) throw new Error(`no state at ${statePath(batchDir)}`);
    if (state.schema !== STATE_SCHEMA) {
      throw new Error('--decide-screen applies to a calibration batch, not the main block');
    }
    if (state.planSha256 !== plan.planSha256) {
      throw new Error(`plan drift: state carries ${state.planSha256}, checkout builds ${plan.planSha256}`);
    }
    decideScreen(state, batchDir);
    return;
  }

  // Paid modes from here down.
  const isMainBlock = values['main-block'];
  if (values.arms && !isMainBlock && !values['dry-run-main']) {
    throw new Error('--arms applies to the main block only');
  }
  const activePlan = isMainBlock ? buildEdgedRegisterMainBlockPlan({ root: ROOT, arms: values.arms }) : plan;
  const validation = isMainBlock
    ? validateEdgedRegisterMainBlockPlan(activePlan)
    : validateEdgedRegisterCalibrationPlan(activePlan);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  if (isMainBlock) {
    for (const armSpec of activePlan.arms) assertProfileRegistered(armSpec.profile);
  } else {
    assertProfileRegistered(activePlan.profile);
  }
  assertGoNote(values['go-note'], activePlan.planSha256);
  if (!values['launch-approved']) throw new Error('paid blocks require --launch-approved');
  assertLaunchAuthorization(values['expected-sha']);

  let state = loadState(batchDir);
  if (values.screen) {
    if (!state) {
      state = newBatchState(activePlan, path.basename(batchDir));
      saveState(batchDir, state);
    }
  } else if (isMainBlock) {
    if (!state) {
      state = newMainBlockState(activePlan, path.basename(batchDir));
      saveState(batchDir, state);
    }
    if (state.schema !== MAIN_STATE_SCHEMA) {
      throw new Error(`--main-block found a ${state.schema} state at ${batchDir}; use a fresh batch dir`);
    }
  } else if (!state) {
    throw new Error(`--confirm needs an existing screen batch at ${batchDir}`);
  }
  if (state.planSha256 !== activePlan.planSha256) {
    throw new Error(
      `plan drift: state carries ${state.planSha256}, checkout builds ${activePlan.planSha256}; ` +
        'no widening or model change is available mid-block',
    );
  }
  if (state.killed) throw new Error('the study was killed by operator decision; no further generation');
  const openFlags = unresolvedGuardrailFlags(state);
  if (openFlags.length) {
    throw new Error(
      `generation is paused on ${openFlags.length} open guardrail flag(s); ` +
        'record the human ruling with --resume-decision first',
    );
  }
  if (values.confirm && !state.screenDecision) {
    throw new Error('--confirm needs the zero-call --decide-screen pass to have recorded the screen decision');
  }

  let block = 'main';
  if (values.screen) block = 'screen';
  else if (values.confirm) block = 'confirm';
  const { paused } = await runBlock(state, batchDir, block);
  printStatus(state);
  if (paused) {
    console.log('[edged-calibration] PAUSED on a guardrail flag before the next dialogue (registered stop rule 2)');
    process.exitCode = 2;
    return;
  }
  console.log(`[edged-calibration] ${block} block pass complete; run npm run archive:runs and commit the archive repo`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[edged-calibration] ${error.message}`);
    process.exitCode = 1;
  });
}
