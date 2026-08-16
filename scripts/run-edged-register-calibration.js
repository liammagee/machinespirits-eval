#!/usr/bin/env node

// Edged-register outcome study — Stage-0 calibration runner (warm-only).
//
// Implements the frozen calibration design in
// notes/2026-08-16-edged-register-calibration-draft.md §2.3–§2.9:
// screen block (5 rows × 12 cells), zero-call screen decision, confirm block
// (survivors topped up to 12 rows), 4 lanes, hard cap 120 generated rows,
// report-only harm guardrail that pauses generation before the next dialogue,
// and the attended-resume discipline (single resume of the exact missing
// jobs, no --force, no widening, no model change).
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
  confirmTopUpJobs,
  decideScreenOutcome,
  harmGuardrailFindings,
  validateEdgedRegisterCalibrationPlan,
} from '../services/edgedRegisterCalibration.js';
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
    grid.profile,
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

/** Content check for the GO note (the git-tracked check lives in assertGoNote). */
export function checkGoNoteContent(content, planSha256) {
  const errors = [];
  const text = String(content || '');
  if (!text.includes(planSha256)) errors.push(`GO note does not carry the plan SHA ${planSha256}`);
  if (!/\bGO\b/.test(text)) errors.push('GO note does not say GO');
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
  if (state.schema !== STATE_SCHEMA) throw new Error(`unrecognized state schema ${state.schema} at ${file}`);
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
      findings.push({ ...finding, turnIndex: turn?.turnIndex ?? index });
    }
  }
  return findings;
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

async function runBlock(state, batchDir, block, { lanes = GRID.generation.lanes } = {}) {
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
    if (state.rowsAttempted >= GRID.hardCapRows) return null;
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
          state.guardrailFlags.push({
            ordinal: job.ordinal,
            scenario: job.scenario,
            rowId: row.id,
            findings,
            raisedAt: new Date().toISOString(),
            resolution: null,
          });
          paused = true; // report-only: the row stays; no new dialogue starts
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
  console.log(`[edged-calibration] rows attempted ${state.rowsAttempted}/${GRID.hardCapRows}`);
  const open = unresolvedGuardrailFlags(state);
  for (const flag of open) {
    const families = flag.findings.map((finding) => finding.family).join(', ');
    console.log(`[edged-calibration] OPEN GUARDRAIL FLAG job ${flag.ordinal} (${flag.scenario}): ${families}`);
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

function printReport(state) {
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
    if (!GRID.cells.some((cell) => cell.scenario === detail)) {
      throw new Error(`kill_cell needs a registered calibration scenario, got ${detail || '(none)'}`);
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

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      screen: { type: 'boolean', default: false },
      confirm: { type: 'boolean', default: false },
      'decide-screen': { type: 'boolean', default: false },
      status: { type: 'boolean', default: false },
      report: { type: 'boolean', default: false },
      'batch-dir': { type: 'string', default: '' },
      'go-note': { type: 'string', default: '' },
      'launch-approved': { type: 'boolean', default: false },
      'expected-sha': { type: 'string', default: '' },
      'resume-decision': { type: 'string', default: '' },
      'output-dir': { type: 'string', default: DEFAULT_OUTPUT_DIR },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(
      'Usage: node scripts/run-edged-register-calibration.js --dry-run | --status --batch-dir <dir> | ' +
        '--decide-screen --batch-dir <dir> | --report --batch-dir <dir> | ' +
        '--resume-decision <resume_unchanged|kill_cell:<scenario>|kill_study> --batch-dir <dir> | ' +
        '(--screen|--confirm) --batch-dir <dir> --go-note <note> --launch-approved --expected-sha <commit>',
    );
    return;
  }

  const modes = ['dry-run', 'screen', 'confirm', 'decide-screen', 'status', 'report'].filter((mode) => values[mode]);
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
    if (state.planSha256 !== plan.planSha256) {
      throw new Error(`plan drift: state carries ${state.planSha256}, checkout builds ${plan.planSha256}`);
    }
    decideScreen(state, batchDir);
    return;
  }

  // Paid modes from here down.
  const validation = validateEdgedRegisterCalibrationPlan(plan);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  assertProfileRegistered(plan.profile);
  assertGoNote(values['go-note'], plan.planSha256);
  if (!values['launch-approved']) throw new Error('paid calibration blocks require --launch-approved');
  assertLaunchAuthorization(values['expected-sha']);

  let state = loadState(batchDir);
  if (values.screen) {
    if (!state) {
      state = newBatchState(plan, path.basename(batchDir));
      saveState(batchDir, state);
    }
  } else if (!state) {
    throw new Error(`--confirm needs an existing screen batch at ${batchDir}`);
  }
  if (state.planSha256 !== plan.planSha256) {
    throw new Error(
      `plan drift: state carries ${state.planSha256}, checkout builds ${plan.planSha256}; ` +
        'no widening or model change is available mid-calibration',
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

  const block = values.screen ? 'screen' : 'confirm';
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
