#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { requiredTutorStubArtifactArchiveArgs } from '../services/tutorStubArtifactArchive.js';
import { resistantLearnerObservationMarkers } from '../services/resistantLearnerObservation.js';
import {
  TUTOR_STUB_DEFIANT_WARRANT_ARM_IDS,
  TUTOR_STUB_DEFIANT_WARRANT_DEFAULT_DESIGN,
  buildTutorStubDefiantWarrantPlan,
  loadTutorStubDefiantWarrantDesign,
} from '../services/tutorStubDefiantWarrantOutcomeStudy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LUNA = 'codex.gpt-5.6-luna';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function writeOnce(filePath, value) {
  fs.writeFileSync(filePath, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, {
    flag: 'wx',
  });
}

function appendLedger(filePath, value) {
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`);
}

// Provenance is recorded into plan.json and never enforced: no commit pin, no
// clean-tree requirement, no GO-note binding. A defect fix must not void a run.
export function recordDefiantWarrantProvenance() {
  const git = (...args) => {
    try {
      return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  };
  const status = git('status', '--porcelain=v1', '--untracked-files=all');
  return {
    recorded_not_enforced: true,
    commit: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    dirty: status === null ? null : status.length > 0,
  };
}

function readTrace(traceDir) {
  if (!fs.existsSync(traceDir)) throw new Error('trace directory is missing');
  const names = fs.readdirSync(traceDir).filter((name) => name.endsWith('.jsonl'));
  if (names.length !== 1) throw new Error(`expected one trace in ${traceDir}; found ${names.length}`);
  const trace = path.join(traceDir, names[0]);
  const source = fs.readFileSync(trace);
  const events = source
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { trace, trace_sha256: sha256(source), trace_bytes: source.length, events };
}

export function classifyDefiantWarrantAttempt({ events, exit, autoTurns }) {
  const turns = events.filter((event) => event.type === 'turn_complete' && event.turnRecord);
  const started = events.some((event) => event.type === 'defiant_warrant_outcome_execution_start');
  if (started && !exit.signal && !exit.spawn_error && exit.code === 0 && turns.length === autoTurns) {
    return { terminal: true, recoverable: false, category: 'semantic_terminal' };
  }
  const substantive = events.find((event) =>
    ['auto_learner_profile_measurement_indeterminate', 'auto_learner_profile_adherence_exhausted'].includes(event.type),
  );
  if (substantive) {
    return {
      terminal: true,
      recoverable: false,
      category: 'registered_nonsemantic_terminal',
      code: substantive.code || substantive.type,
    };
  }
  const transportExhausted = events.some(
    (event) =>
      event.type === 'model_call_error' &&
      (event.cliPolicyViolation?.reason === 'call_retry_limit_reached' ||
        event.errorClassification?.responseFree === true),
  );
  return {
    terminal: false,
    recoverable: true,
    category: 'technical_recoverable',
    code: exit.signal
      ? 'child_interruption'
      : exit.spawn_error
        ? 'spawn_failure'
        : transportExhausted
          ? 'response_free_transport_failure'
          : !started
            ? 'study_dispatch_missing'
            : 'incomplete_turn_sequence',
  };
}

function childSpec({ loaded, job, attemptRoot, budget }) {
  const traceDir = path.join(attemptRoot, 'traces');
  fs.mkdirSync(traceDir, { recursive: true });
  const execution = loaded.design.execution;
  return {
    traceDir,
    transcript: path.join(attemptRoot, 'transcript.json'),
    stdout: path.join(attemptRoot, 'stdout.log'),
    stderr: path.join(attemptRoot, 'stderr.log'),
    args: [
      'scripts/tutor-stub.js',
      '--lab',
      'automated_eval',
      '--acknowledge-research-use',
      ...requiredTutorStubArtifactArchiveArgs(),
      '--model-call-budget',
      String(budget),
      '--all-models',
      LUNA,
      '--model',
      LUNA,
      '--classifier-model',
      LUNA,
      '--learner-record-model',
      LUNA,
      '--auto-learner-model',
      LUNA,
      '--cli-effort',
      loaded.design.models.cliEffort,
      '--world',
      execution.world,
      '--dag',
      '--dag-mode',
      execution.dagMode,
      '--tutor-learner-dag',
      '--auto-learner',
      '--auto-learner-profile',
      execution.autoLearnerProfile,
      '--auto-turns',
      String(execution.autoTurns),
      '--no-auto-stop-on-grounded',
      '--no-memory-summary',
      '--no-turn-feedback',
      '--run-seed',
      String(job.run_seed),
      '--eval-repeat',
      String(job.assignment_index + 1),
      '--eval-job-id',
      job.id,
      '--register-policy',
      execution.registerPolicy,
      '--register-palette',
      execution.registerPalette,
      '--register-overlay-threshold',
      execution.registerOverlayThreshold,
      '--release-speed',
      execution.releaseSpeed,
      '--history-turns',
      execution.historyTurns,
      '--max-tokens',
      execution.maxTokens,
      '--defiant-warrant-outcome-design',
      path.relative(ROOT, loaded.path),
      '--defiant-warrant-outcome-job',
      job.id,
      '--trace-dir',
      path.relative(ROOT, traceDir),
      '--save',
      path.relative(ROOT, path.join(attemptRoot, 'transcript.json')),
    ],
    env: {
      TUTOR_STUB_REMEMBER_SETTINGS: '0',
    },
  };
}

function runProcess(spec) {
  return new Promise((resolve) => {
    const stdout = fs.openSync(spec.stdout, 'wx');
    const stderr = fs.openSync(spec.stderr, 'wx');
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      fs.closeSync(stdout);
      fs.closeSync(stderr);
      resolve(value);
    };
    const child = spawn(process.execPath, spec.args, {
      cwd: ROOT,
      env: { ...process.env, ...spec.env },
      stdio: ['ignore', stdout, stderr],
    });
    child.on('error', (error) => finish({ code: null, signal: null, spawn_error: error.message }));
    child.on('close', (code, signal) => finish({ code, signal, spawn_error: null }));
  });
}

async function executeAttempt({ loaded, job, destination, attemptNumber, priorReservations }) {
  const perDialogueCap = loaded.design.execution.maximumReservationsPerDialogue;
  const budget = perDialogueCap - priorReservations;
  if (budget <= 0) throw new Error(`${job.id} exhausted its per-dialogue attempt ceiling`);
  const attemptRoot = path.join(
    destination,
    'jobs',
    job.id,
    attemptNumber === 1 ? 'initial' : `recovery-${String(attemptNumber - 1).padStart(3, '0')}`,
  );
  fs.mkdirSync(attemptRoot, { recursive: false });
  const spec = childSpec({ loaded, job, attemptRoot, budget });
  const exit = await runProcess(spec);
  let trace = null;
  let events = [];
  let traceError = null;
  try {
    const read = readTrace(spec.traceDir);
    trace = { path: path.relative(ROOT, read.trace), sha256: read.trace_sha256, bytes: read.trace_bytes };
    events = read.events;
  } catch (error) {
    traceError = error.message;
  }
  const reservations = events.filter((event) => event.type === 'model_call_budget_reserved').length;
  if (priorReservations + reservations > perDialogueCap) {
    throw new Error(`${job.id} exceeded its per-dialogue attempt ceiling`);
  }
  const disposition = classifyDefiantWarrantAttempt({
    events,
    exit,
    autoTurns: loaded.design.execution.autoTurns,
  });
  return {
    case_id: job.id,
    attempt_number: attemptNumber,
    budget,
    reservations,
    cumulative_reservations: priorReservations + reservations,
    exit,
    trace,
    trace_error: traceError,
    transcript: fs.existsSync(spec.transcript) ? path.relative(ROOT, spec.transcript) : null,
    disposition: {
      terminal: disposition.terminal,
      recoverable: disposition.recoverable,
      category: disposition.category,
      code: disposition.code || null,
    },
  };
}

async function runPool(items, parallelism, worker, onResult) {
  const pending = [...items];
  async function consume() {
    while (pending.length) {
      const item = pending.shift();
      const result = await worker(item);
      await onResult(item, result);
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallelism, items.length) }, consume));
}

function finalTraceFor(row) {
  const terminal = [...row.attempts].reverse().find((attempt) => attempt.disposition.terminal && attempt.trace?.path);
  return terminal?.trace?.path ? path.resolve(ROOT, terminal.trace.path) : null;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

// Deterministic per-dialogue endpoints, computed from the terminal trace with
// the same marker instrument that produced the held-out 14/24 dispute baseline.
// Zero model calls; the Sonnet conduct reader is a separate later pass.
export function measureDefiantWarrantDialogue(events) {
  const turns = events
    .filter((event) => event.type === 'turn_complete' && event.turnRecord)
    .map((event) => event.turnRecord)
    .sort((a, b) => Number(a.turn || 0) - Number(b.turn || 0));
  const opening = events.find((event) => event.type === 'tutor_opening')?.text || '';
  const perTurn = turns.map((turn, index) => {
    const markers = resistantLearnerObservationMarkers({
      learnerText: turn.learner,
      classification: turn.classification?.turn || {},
      tutorText: index === 0 ? opening : turns[index - 1]?.tutor || '',
    });
    const advance = turn.learnerAdvance || turn.tutorLearnerDagUpdate?.advance || null;
    return {
      turn: Number(turn.turn || index),
      dispute: Boolean(markers.frameJurisdictionDispute),
      participation: Boolean(markers.frameJurisdictionParticipation),
      refusal: Boolean(markers.frameJurisdictionRefusal),
      supported_move: Number(advance?.supportedMoveCount || 0) > 0,
      best_path_coverage: Number(turn.tutorLearnerDagModel?.assessment?.bestPathCoverage ?? NaN),
    };
  });
  const settlementTurns = perTurn.filter((row) => row.supported_move && !row.dispute);
  const half = Math.floor(perTurn.length / 2);
  const early = perTurn.slice(0, half).map((row) => (row.dispute ? 1 : 0));
  const late = perTurn.slice(half).map((row) => (row.dispute ? 1 : 0));
  const finalCoverage = perTurn.at(-1)?.best_path_coverage;
  return {
    turns_measured: perTurn.length,
    frame_settlement: settlementTurns.length > 0,
    first_settlement_turn: settlementTurns.length ? settlementTurns[0].turn : null,
    settlement_turn_count: settlementTurns.length,
    dispute_turn_count: perTurn.filter((row) => row.dispute).length,
    final_best_path_coverage: Number.isFinite(finalCoverage) ? finalCoverage : null,
    escalation_delta: perTurn.length >= 2 ? mean(late) - mean(early) : null,
    per_turn: perTurn,
  };
}

export function analyzeDefiantWarrantRows({ rows, design }) {
  const arms = {};
  for (const arm of TUTOR_STUB_DEFIANT_WARRANT_ARM_IDS) {
    const armRows = rows.filter((row) => row.assigned_arm === arm);
    const measured = armRows.filter((row) => row.measures);
    const settled = measured.filter((row) => row.measures.frame_settlement);
    arms[arm] = {
      assigned: armRows.length,
      terminal: armRows.filter((row) => row.execution_terminal).length,
      measured: measured.length,
      frame_settlement: settled.length,
      first_settlement_turns: settled.map((row) => row.measures.first_settlement_turn),
      mean_final_best_path_coverage: mean(
        measured.map((row) => row.measures.final_best_path_coverage).filter((value) => Number.isFinite(value)),
      ),
      mean_dispute_turn_count: mean(measured.map((row) => row.measures.dispute_turn_count)),
      mean_escalation_delta: mean(
        measured.map((row) => row.measures.escalation_delta).filter((value) => Number.isFinite(value)),
      ),
    };
  }
  return {
    schema: 'machinespirits.tutor-stub.defiant-warrant-outcome-pilot-report.v1',
    study_id: design.studyId,
    phase: design.sampleSize.phase,
    status: rows.every((row) => row.execution_terminal) ? 'complete' : 'incomplete',
    thresholds: 'none_gate1_freezes_them',
    confirmatory_claim_allowed: false,
    arms,
    rows,
  };
}

function analysisRows(execution, plan) {
  const results = new Map(execution.results.map((row) => [row.case_id, row]));
  return plan.jobs.map((job) => {
    const result = results.get(job.id);
    const trace = result ? finalTraceFor(result) : null;
    let measures = null;
    if (trace) {
      const events = fs
        .readFileSync(trace, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      measures = measureDefiantWarrantDialogue(events);
    }
    return {
      case_id: job.id,
      block_id: job.block_id,
      assigned_arm: job.assigned_arm,
      run_seed: job.run_seed,
      execution_terminal: Boolean(result?.terminal),
      execution_category: result?.terminal_category || 'missing',
      reservations: result?.cumulative_reservations || 0,
      trace: trace ? path.relative(ROOT, trace) : null,
      measures,
    };
  });
}

export function buildDefiantWarrantPreflight({
  designPath = TUTOR_STUB_DEFIANT_WARRANT_DEFAULT_DESIGN,
  destination,
} = {}) {
  const loaded = loadTutorStubDefiantWarrantDesign({ designPath, root: ROOT });
  const absoluteDestination = path.resolve(ROOT, destination || '');
  if (!destination || fs.existsSync(absoluteDestination)) throw new Error('create-once destination must be absent');
  const plan = buildTutorStubDefiantWarrantPlan(loaded.design);
  return {
    schema: 'machinespirits.tutor-stub.defiant-warrant-outcome-pilot-preflight.v1',
    status: 'passed_zero_call',
    model_calls: 0,
    production_writes: 0,
    provenance: recordDefiantWarrantProvenance(),
    design: { path: designPath, sha256: loaded.sha256 },
    destination: path.relative(ROOT, absoluteDestination),
    jobs: plan.jobs.length,
    arms: Object.fromEntries(
      TUTOR_STUB_DEFIANT_WARRANT_ARM_IDS.map((arm) => [
        arm,
        plan.jobs.filter((job) => job.assigned_arm === arm).length,
      ]),
    ),
    maximum_model_attempt_reservations: loaded.design.spendCeiling.pilotMaximumModelAttemptReservations,
  };
}

export async function runDefiantWarrantPilot({
  designPath = TUTOR_STUB_DEFIANT_WARRANT_DEFAULT_DESIGN,
  destination,
  parallelism = 4,
} = {}) {
  const preflight = buildDefiantWarrantPreflight({ designPath, destination });
  const loaded = loadTutorStubDefiantWarrantDesign({ designPath, root: ROOT });
  const plan = buildTutorStubDefiantWarrantPlan(loaded.design);
  const maxProcessAttempts = loaded.design.execution.technicalRecovery.maximumProcessAttemptsPerUnit;
  const absoluteDestination = path.resolve(ROOT, destination);
  fs.mkdirSync(path.dirname(absoluteDestination), { recursive: true });
  fs.mkdirSync(absoluteDestination, { recursive: false });
  fs.mkdirSync(path.join(absoluteDestination, 'jobs'), { recursive: false });
  writeOnce(path.join(absoluteDestination, 'plan.json'), {
    ...plan,
    status: 'launched',
    provenance: preflight.provenance,
    design: preflight.design,
    destination: preflight.destination,
    maximum_model_attempt_reservations: preflight.maximum_model_attempt_reservations,
  });
  const ledgerPath = path.join(absoluteDestination, 'ledger.jsonl');
  writeOnce(ledgerPath, '');
  const records = new Map(
    plan.jobs.map((job) => [
      job.id,
      {
        case_id: job.id,
        assigned_arm: job.assigned_arm,
        attempts: [],
        terminal: false,
        terminal_category: null,
        cumulative_reservations: 0,
      },
    ]),
  );
  for (const job of plan.jobs) {
    fs.mkdirSync(path.join(absoluteDestination, 'jobs', job.id), { recursive: false });
  }
  let finished = 0;
  let observedReservations = 0;
  const executeWave = async (jobs) => {
    await runPool(
      jobs,
      Number(parallelism),
      async (job) => {
        const record = records.get(job.id);
        return executeAttempt({
          loaded,
          job,
          destination: absoluteDestination,
          attemptNumber: record.attempts.length + 1,
          priorReservations: record.cumulative_reservations,
        });
      },
      async (job, attempt) => {
        const record = records.get(job.id);
        record.attempts.push(attempt);
        record.cumulative_reservations = attempt.cumulative_reservations;
        observedReservations += attempt.reservations;
        if (observedReservations > preflight.maximum_model_attempt_reservations) {
          throw new Error('pilot exceeded its study attempt ceiling');
        }
        if (attempt.disposition.terminal) {
          record.terminal = true;
          record.terminal_category = attempt.disposition.category;
          finished += 1;
        }
        appendLedger(ledgerPath, {
          timestamp: new Date().toISOString(),
          case_id: job.id,
          assigned_arm: job.assigned_arm,
          attempt_number: attempt.attempt_number,
          reservations: attempt.reservations,
          cumulative_unit_reservations: record.cumulative_reservations,
          cumulative_study_reservations: observedReservations,
          disposition: attempt.disposition,
        });
        console.log(
          JSON.stringify({
            progress: `${finished}/${plan.jobs.length}`,
            case_id: job.id,
            disposition: attempt.disposition.category,
            reservations: observedReservations,
          }),
        );
      },
    );
  };
  await executeWave(plan.jobs);
  for (let wave = 2; wave <= maxProcessAttempts; wave += 1) {
    const recoverable = plan.jobs.filter((job) => {
      const record = records.get(job.id);
      const last = record.attempts.at(-1);
      return (
        !record.terminal &&
        last?.disposition?.recoverable === true &&
        record.cumulative_reservations < loaded.design.execution.maximumReservationsPerDialogue
      );
    });
    if (!recoverable.length) break;
    console.log(JSON.stringify({ phase: 'bounded_technical_recovery', wave, units: recoverable.length }));
    await executeWave(recoverable);
  }
  const results = plan.jobs.map((job) => records.get(job.id));
  const unresolved = results.filter((row) => !row.terminal);
  const execution = {
    schema: 'machinespirits.tutor-stub.defiant-warrant-outcome-pilot-execution-result.v1',
    status: unresolved.length ? 'incomplete_technical_failures' : 'complete',
    planned_dialogues: plan.jobs.length,
    terminal_dialogues: plan.jobs.length - unresolved.length,
    unresolved_technical_dialogues: unresolved.map((row) => row.case_id),
    observed_model_attempt_reservations: observedReservations,
    maximum_model_attempt_reservations: preflight.maximum_model_attempt_reservations,
    valid_unit_reruns: false,
    semantic_indeterminacy_reruns: false,
    results,
  };
  writeOnce(path.join(absoluteDestination, 'execution-result.json'), execution);
  const rows = analysisRows(execution, plan);
  const report = analyzeDefiantWarrantRows({ rows, design: loaded.design });
  writeOnce(path.join(absoluteDestination, 'report.json'), report);
  return { execution, report, destination: preflight.destination };
}

export function reanalyzeDefiantWarrantDestination({
  designPath = TUTOR_STUB_DEFIANT_WARRANT_DEFAULT_DESIGN,
  destination,
} = {}) {
  const loaded = loadTutorStubDefiantWarrantDesign({ designPath, root: ROOT });
  const plan = buildTutorStubDefiantWarrantPlan(loaded.design);
  const absoluteDestination = path.resolve(ROOT, destination || '');
  const execution = JSON.parse(fs.readFileSync(path.join(absoluteDestination, 'execution-result.json'), 'utf8'));
  const rows = analysisRows(execution, plan);
  return analyzeDefiantWarrantRows({ rows, design: loaded.design });
}

function usage() {
  return `Usage:
  node scripts/run-tutor-stub-defiant-warrant-pilot.js --preflight --destination <absent-path> [--design <path>]
  node scripts/run-tutor-stub-defiant-warrant-pilot.js --live --accept-charges --destination <absent-path> [--design <path>] [--parallelism 4]
  node scripts/run-tutor-stub-defiant-warrant-pilot.js --analyze --destination <existing-path> [--design <path>]`;
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      preflight: { type: 'boolean', default: false },
      live: { type: 'boolean', default: false },
      analyze: { type: 'boolean', default: false },
      'accept-charges': { type: 'boolean', default: false },
      design: { type: 'string', default: TUTOR_STUB_DEFIANT_WARRANT_DEFAULT_DESIGN },
      destination: { type: 'string' },
      parallelism: { type: 'string', default: '4' },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });
  if (values.help) return void console.log(usage());
  const modes = [values.preflight, values.live, values.analyze].filter(Boolean);
  if (modes.length !== 1) throw new Error(usage());
  const common = { designPath: values.design, destination: values.destination };
  if (values.preflight) {
    console.log(JSON.stringify(buildDefiantWarrantPreflight(common), null, 2));
    return;
  }
  if (values.analyze) {
    console.log(JSON.stringify(reanalyzeDefiantWarrantDestination(common), null, 2));
    return;
  }
  if (!values['accept-charges']) throw new Error('live pilot requires --accept-charges');
  const result = await runDefiantWarrantPilot({ ...common, parallelism: Number(values.parallelism) });
  console.log(JSON.stringify(result, null, 2));
  if (result.execution.status !== 'complete') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
