#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { fisherExactTwoSidedP } from '../services/edgedRegisterCalibration.js';
import { requiredTutorStubArtifactArchiveArgs } from '../services/tutorStubArtifactArchive.js';
import {
  buildTutorStubResistanceWarmNonwarmPlan,
  loadTutorStubResistanceWarmNonwarmDesign,
} from '../services/tutorStubResistanceWarmNonwarmConfirmation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DESIGN = 'config/tutor-stub-resistance-action-register-warm-nonwarm-confirmation.v1.json';
const MAX_PROCESS_ATTEMPTS_PER_UNIT = 3;

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

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function repoPath(relative, label) {
  if (!relative || path.isAbsolute(relative)) throw new Error(`${label} must be repository-relative`);
  const absolute = path.resolve(ROOT, relative);
  const rebased = path.relative(ROOT, absolute);
  if (rebased.startsWith('..') || path.isAbsolute(rebased)) throw new Error(`${label} escapes repository root`);
  return absolute;
}

function assertSource(expectedCommit, designRelative) {
  const commit = git('rev-parse', 'HEAD');
  if (commit !== expectedCommit) throw new Error(`launch commit drift: expected ${expectedCommit}, found ${commit}`);
  if (git('status', '--porcelain=v1', '--untracked-files=all')) {
    throw new Error('warm/nonwarm confirmation requires a clean detached checkout');
  }
  let branch = '';
  try {
    branch = git('symbolic-ref', '-q', '--short', 'HEAD');
  } catch {
    branch = '';
  }
  if (branch) throw new Error(`warm/nonwarm confirmation requires detached HEAD, found ${branch}`);
  const committed = execFileSync('git', ['show', `${commit}:${designRelative}`], { cwd: ROOT });
  const onDisk = fs.readFileSync(repoPath(designRelative, 'design'));
  if (!committed.equals(onDisk)) throw new Error('launch commit does not contain the exact design bytes');
  return { commit, tree: git('rev-parse', 'HEAD^{tree}') };
}

function assertGoNote({ goNoteCommit, goNotePath, launchCommit, designPath, spendCap }) {
  execFileSync('git', ['merge-base', '--is-ancestor', launchCommit, goNoteCommit], { cwd: ROOT });
  const text = execFileSync('git', ['show', `${goNoteCommit}:${goNotePath}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (
    !text.split(/\r?\n/u).some((line) => line.trim() === 'GO') ||
    !text.includes(designPath) ||
    !text.includes(launchCommit) ||
    !text.includes(String(spendCap))
  ) {
    throw new Error('signed GO note does not bind GO, design, launch commit, and spend cap');
  }
  return { commit: goNoteCommit, path: goNotePath, sha256: sha256(text) };
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

function classifyAttempt({ events, exit }) {
  const semantic = events.find((event) => event.type === 'resistance_confirmation_semantic_adjudication');
  if (semantic) return { terminal: true, recoverable: false, category: 'semantic_terminal', semantic };
  const substantive = events.find((event) =>
    [
      'resistance_action_register_confirmation_substantive_failure',
      'auto_learner_profile_measurement_indeterminate',
      'auto_learner_profile_adherence_exhausted',
    ].includes(event.type),
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
  if (exit.signal || exit.spawn_error || transportExhausted || exit.code !== 0 || !events.length) {
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
            : 'missing_process_output',
    };
  }
  return {
    terminal: false,
    recoverable: true,
    category: 'technical_recoverable',
    code: 'missing_terminal_semantic_output',
  };
}

function childSpec({ loaded, job, attemptRoot, budget }) {
  const traceDir = path.join(attemptRoot, 'traces');
  fs.mkdirSync(traceDir, { recursive: true });
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
      'codex.gpt-5.6-luna',
      '--model',
      'codex.gpt-5.6-luna',
      '--classifier-model',
      'codex.gpt-5.6-luna',
      '--learner-record-model',
      'codex.gpt-5.6-luna',
      '--auto-learner-model',
      'codex.gpt-5.6-luna',
      '--cli-effort',
      'low',
      '--world',
      loaded.design.execution.world,
      '--dag',
      '--dag-mode',
      loaded.design.execution.dagMode,
      '--tutor-learner-dag',
      '--auto-learner',
      '--auto-learner-profile',
      loaded.design.execution.autoLearnerProfile,
      '--auto-turns',
      String(loaded.design.execution.autoTurns),
      '--no-auto-stop-on-grounded',
      '--no-memory-summary',
      '--no-turn-feedback',
      '--run-seed',
      String(job.run_seed),
      '--eval-repeat',
      String(job.assignment_index),
      '--eval-job-id',
      job.id,
      '--register-policy',
      'field',
      '--register-palette',
      'plain,warm',
      '--dag-fact-dropout',
      '0',
      '--dag-fact-dropout-seed',
      '1',
      '--resistance-warm-nonwarm-confirmation-design',
      path.relative(ROOT, loaded.path),
      '--resistance-warm-nonwarm-confirmation-job',
      job.id,
      '--trace-dir',
      path.relative(ROOT, traceDir),
      '--save',
      path.relative(ROOT, path.join(attemptRoot, 'transcript.json')),
    ],
    env: {
      TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS:
        loaded.design.measurement.triggerInstrument.observationSemantics,
      TUTOR_STUB_RESISTANCE_BINARY_SEMANTIC_SMOKE: '0',
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
  const perDialogueCap = loaded.design.execution.maximumReservationsPerDialogueAcrossInitialAndRecoveryAttempts;
  const budget = perDialogueCap - priorReservations;
  if (budget <= 0) throw new Error(`${job.id} exhausted its unchanged per-dialogue attempt ceiling`);
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
    trace = {
      path: path.relative(ROOT, read.trace),
      sha256: read.trace_sha256,
      bytes: read.trace_bytes,
    };
    events = read.events;
  } catch (error) {
    traceError = error.message;
  }
  const reservations = events.filter((event) => event.type === 'model_call_budget_reserved').length;
  if (priorReservations + reservations > perDialogueCap) {
    throw new Error(`${job.id} exceeded its unchanged per-dialogue attempt ceiling`);
  }
  const disposition = classifyAttempt({ events, exit });
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

function safeRatio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function oddsRatio(warmYes, warmNo, nonwarmYes, nonwarmNo) {
  if (!warmYes || !warmNo || !nonwarmYes || !nonwarmNo) return null;
  return (warmYes * nonwarmNo) / (warmNo * nonwarmYes);
}

export function analyzeTutorStubResistanceWarmNonwarmRows({ rows, design }) {
  const arms = {};
  for (const arm of ['warm_shared_invitation', 'nonwarm_reference']) {
    const armRows = rows.filter((row) => row.assigned_arm === arm);
    const determinateRows = armRows.filter((row) => row.primary_status === 'determinate');
    const recovered = determinateRows.filter((row) => row.final_recovery === 'yes').length;
    const actionMatch = armRows.filter(
      (row) => row.action_status === 'determinate' && row.action_value === 'yes',
    ).length;
    const expectedRegister = arm === 'warm_shared_invitation' ? 'warm' : 'nonwarm';
    const registerMatch = armRows.filter(
      (row) => row.register_status === 'determinate' && row.register_value === expectedRegister,
    ).length;
    arms[arm] = {
      assigned: armRows.length,
      determinate: determinateRows.length,
      recovered,
      not_recovered: determinateRows.length - recovered,
      measurement_coverage: safeRatio(determinateRows.length, armRows.length),
      recovery_rate: safeRatio(recovered, determinateRows.length),
      action_fidelity: safeRatio(actionMatch, armRows.length),
      assigned_register_fidelity: safeRatio(registerMatch, armRows.length),
      indeterminate_or_missing: armRows.length - determinateRows.length,
    };
  }
  const warm = arms.warm_shared_invitation;
  const nonwarm = arms.nonwarm_reference;
  const fisherReady = warm.determinate > 0 && nonwarm.determinate > 0;
  const riskDifference = fisherReady ? warm.recovery_rate - nonwarm.recovery_rate : null;
  const gates = {
    all_planned_units_terminal: rows.length === 200 && rows.every((row) => row.execution_terminal),
    minimum_determinate_per_arm:
      warm.determinate >= design.analysis.minimumDeterminatePerArm &&
      nonwarm.determinate >= design.analysis.minimumDeterminatePerArm,
    minimum_outcome_coverage_per_arm:
      warm.measurement_coverage >= design.analysis.minimumOutcomeCoveragePerArm &&
      nonwarm.measurement_coverage >= design.analysis.minimumOutcomeCoveragePerArm,
    maximum_differential_outcome_coverage:
      Math.abs(warm.measurement_coverage - nonwarm.measurement_coverage) <=
      design.analysis.maximumDifferentialOutcomeCoverage,
    minimum_action_fidelity_per_arm:
      warm.action_fidelity >= design.analysis.minimumActionFidelityPerArm &&
      nonwarm.action_fidelity >= design.analysis.minimumActionFidelityPerArm,
    minimum_assigned_register_fidelity_per_arm:
      warm.assigned_register_fidelity >= design.analysis.minimumAssignedRegisterFidelityPerArm &&
      nonwarm.assigned_register_fidelity >= design.analysis.minimumAssignedRegisterFidelityPerArm,
  };
  const claimGatePassed = Object.values(gates).every(Boolean);
  return {
    schema: 'machinespirits.tutor-stub.resistance-action-register-warm-nonwarm-confirmation-report.v1',
    status: gates.all_planned_units_terminal ? 'complete' : 'incomplete',
    analysis_count: 1,
    interim_analysis_performed: false,
    estimand: design.analysis.primaryEstimand,
    arms,
    contrast: {
      risk_difference_warm_minus_nonwarm: riskDifference,
      odds_ratio: fisherReady
        ? oddsRatio(warm.recovered, warm.not_recovered, nonwarm.recovered, nonwarm.not_recovered)
        : null,
      fisher_exact_two_sided_p: fisherReady
        ? fisherExactTwoSidedP(warm.recovered, warm.determinate, nonwarm.recovered, nonwarm.determinate)
        : null,
      worst_case_indeterminate_bounds: {
        lower:
          safeRatio(warm.recovered, warm.assigned) -
          safeRatio(nonwarm.recovered + nonwarm.indeterminate_or_missing, nonwarm.assigned),
        upper:
          safeRatio(warm.recovered + warm.indeterminate_or_missing, warm.assigned) -
          safeRatio(nonwarm.recovered, nonwarm.assigned),
      },
    },
    gates,
    confirmatory_claim_allowed: claimGatePassed,
    claim_boundary: design.claimBoundary,
    rows,
  };
}

function analysisRows(execution, plan) {
  const results = new Map(execution.results.map((row) => [row.case_id, row]));
  return plan.jobs.map((job) => {
    const result = results.get(job.id);
    const trace = result ? finalTraceFor(result) : null;
    let semantic = null;
    if (trace) {
      const events = fs
        .readFileSync(trace, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const semanticEvents = events.filter(
        (event) => event.type === 'resistance_confirmation_semantic_adjudication' && event.case_id === job.id,
      );
      if (semanticEvents.length !== 1)
        throw new Error(`${job.id} has ${semanticEvents.length} terminal semantic events`);
      semantic = semanticEvents[0];
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
      primary_status: semantic?.primary?.status || 'measurement_indeterminate',
      final_recovery: semantic?.primary?.final_recovery || 'indeterminate',
      action_status: semantic?.fidelity?.action_measurement?.status || 'measurement_indeterminate',
      action_value: semantic?.fidelity?.action_measurement?.value || 'indeterminate',
      register_status: semantic?.fidelity?.register_measurement?.status || 'measurement_indeterminate',
      register_value: semantic?.fidelity?.register_measurement?.value || 'indeterminate',
    };
  });
}

export function buildTutorStubResistanceWarmNonwarmExecutionPreflight({
  designPath = DEFAULT_DESIGN,
  destination,
  expectedSourceCommit,
  goNoteCommit,
  goNotePath,
} = {}) {
  const loaded = loadTutorStubResistanceWarmNonwarmDesign({ designPath, root: ROOT });
  const source = assertSource(expectedSourceCommit, designPath);
  if (loaded.design.execution.technicalRecovery.maximumProcessAttemptsPerUnit !== MAX_PROCESS_ATTEMPTS_PER_UNIT) {
    throw new Error('technical process-attempt limit drifted from the merged design');
  }
  const authorization = assertGoNote({
    goNoteCommit,
    goNotePath,
    launchCommit: expectedSourceCommit,
    designPath,
    spendCap: loaded.design.spendCeiling.confirmationMaximumModelAttemptReservations,
  });
  const absoluteDestination = path.resolve(ROOT, destination || '');
  if (!destination || fs.existsSync(absoluteDestination)) throw new Error('create-once destination must be absent');
  const plan = buildTutorStubResistanceWarmNonwarmPlan(loaded.design);
  return {
    schema: 'machinespirits.tutor-stub.resistance-action-register-warm-nonwarm-execution-preflight.v1',
    status: 'passed_zero_call',
    model_calls: 0,
    production_writes: 0,
    source,
    authorization,
    design: { path: designPath, sha256: loaded.sha256 },
    destination: path.relative(ROOT, absoluteDestination),
    jobs: plan.jobs.length,
    arms: Object.fromEntries(
      ['warm_shared_invitation', 'nonwarm_reference'].map((arm) => [
        arm,
        plan.jobs.filter((job) => job.assigned_arm === arm).length,
      ]),
    ),
    maximum_model_attempt_reservations: loaded.design.spendCeiling.confirmationMaximumModelAttemptReservations,
  };
}

export async function runTutorStubResistanceWarmNonwarmConfirmation({
  designPath = DEFAULT_DESIGN,
  destination,
  expectedSourceCommit,
  goNoteCommit,
  goNotePath,
  parallelism = 4,
} = {}) {
  const preflight = buildTutorStubResistanceWarmNonwarmExecutionPreflight({
    designPath,
    destination,
    expectedSourceCommit,
    goNoteCommit,
    goNotePath,
  });
  const loaded = loadTutorStubResistanceWarmNonwarmDesign({ designPath, root: ROOT });
  const plan = buildTutorStubResistanceWarmNonwarmPlan(loaded.design);
  const absoluteDestination = path.resolve(ROOT, destination);
  fs.mkdirSync(path.dirname(absoluteDestination), { recursive: true });
  fs.mkdirSync(absoluteDestination, { recursive: false });
  fs.mkdirSync(path.join(absoluteDestination, 'jobs'), { recursive: false });
  const planRecord = {
    ...plan,
    status: 'launched',
    source: preflight.source,
    authorization: preflight.authorization,
    design: preflight.design,
    destination: preflight.destination,
    maximum_model_attempt_reservations: preflight.maximum_model_attempt_reservations,
  };
  writeOnce(path.join(absoluteDestination, 'plan.json'), planRecord);
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
          throw new Error('confirmation exceeded its unchanged study attempt ceiling');
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
        if (finished % 10 === 0 && attempt.disposition.terminal) {
          console.log(
            JSON.stringify({ progress: `${finished}/200`, reservations: observedReservations, phase: 'execution' }),
          );
        }
      },
    );
  };
  await executeWave(plan.jobs);
  for (let wave = 2; wave <= MAX_PROCESS_ATTEMPTS_PER_UNIT; wave += 1) {
    const recoverable = plan.jobs.filter((job) => {
      const record = records.get(job.id);
      const last = record.attempts.at(-1);
      return (
        !record.terminal &&
        last?.disposition?.recoverable === true &&
        record.cumulative_reservations <
          loaded.design.execution.maximumReservationsPerDialogueAcrossInitialAndRecoveryAttempts
      );
    });
    if (!recoverable.length) break;
    console.log(JSON.stringify({ phase: 'bounded_technical_recovery', wave, units: recoverable.length }));
    await executeWave(recoverable);
  }
  const results = plan.jobs.map((job) => records.get(job.id));
  const unresolved = results.filter((row) => !row.terminal);
  const execution = {
    schema: 'machinespirits.tutor-stub.resistance-action-register-warm-nonwarm-execution-result.v1',
    status: unresolved.length ? 'incomplete_technical_failures' : 'complete',
    planned_dialogues: 200,
    terminal_dialogues: 200 - unresolved.length,
    unresolved_technical_dialogues: unresolved.map((row) => row.case_id),
    observed_model_attempt_reservations: observedReservations,
    maximum_model_attempt_reservations: preflight.maximum_model_attempt_reservations,
    valid_unit_reruns: false,
    semantic_indeterminacy_reruns: false,
    results,
  };
  writeOnce(path.join(absoluteDestination, 'execution-result.json'), execution);
  const rows = analysisRows(execution, plan);
  const report = analyzeTutorStubResistanceWarmNonwarmRows({ rows, design: loaded.design });
  writeOnce(path.join(absoluteDestination, 'report.json'), report);
  writeOnce(path.join(absoluteDestination, 'seal.json'), {
    schema: 'machinespirits.tutor-stub.resistance-action-register-warm-nonwarm-seal.v1',
    status: execution.status === 'complete' ? 'sealed_complete' : 'sealed_incomplete',
    source: preflight.source,
    design: preflight.design,
    authorization: preflight.authorization,
    plan_sha256: sha256(fs.readFileSync(path.join(absoluteDestination, 'plan.json'))),
    ledger_sha256: sha256(fs.readFileSync(ledgerPath)),
    execution_result_sha256: sha256(fs.readFileSync(path.join(absoluteDestination, 'execution-result.json'))),
    report_sha256: sha256(fs.readFileSync(path.join(absoluteDestination, 'report.json'))),
    observed_model_attempt_reservations: observedReservations,
    analysis_count: 1,
    interim_analysis_performed: false,
  });
  return { execution, report, destination: preflight.destination };
}

function usage() {
  return `Usage:
  node scripts/run-tutor-stub-resistance-warm-nonwarm-confirmation.js --preflight --destination <absent-path> --expected-source-commit <sha> --go-note-commit <sha> --go-note-path <path>
  node scripts/run-tutor-stub-resistance-warm-nonwarm-confirmation.js --live --accept-charges --destination <absent-path> --expected-source-commit <sha> --go-note-commit <sha> --go-note-path <path> [--parallelism 4]`;
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      preflight: { type: 'boolean', default: false },
      live: { type: 'boolean', default: false },
      'accept-charges': { type: 'boolean', default: false },
      design: { type: 'string', default: DEFAULT_DESIGN },
      destination: { type: 'string' },
      'expected-source-commit': { type: 'string' },
      'go-note-commit': { type: 'string' },
      'go-note-path': { type: 'string' },
      parallelism: { type: 'string', default: '4' },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });
  if (values.help) return void console.log(usage());
  const common = {
    designPath: values.design,
    destination: values.destination,
    expectedSourceCommit: values['expected-source-commit'],
    goNoteCommit: values['go-note-commit'],
    goNotePath: values['go-note-path'],
  };
  if (values.preflight === values.live) throw new Error(usage());
  if (values.preflight) {
    console.log(JSON.stringify(buildTutorStubResistanceWarmNonwarmExecutionPreflight(common), null, 2));
    return;
  }
  if (!values['accept-charges']) throw new Error('live confirmation requires --accept-charges');
  const result = await runTutorStubResistanceWarmNonwarmConfirmation({
    ...common,
    parallelism: Number(values.parallelism),
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.execution.status !== 'complete') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
