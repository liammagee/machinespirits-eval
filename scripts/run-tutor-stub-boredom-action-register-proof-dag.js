#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubBoredomProofDagPlan,
  runTutorStubBoredomProofDagEndpointPreflight,
} from '../services/tutorStubBoredomActionRegisterProofDagPreflight.js';
import { loadTutorStubBoredomProofDagStudy } from '../services/tutorStubBoredomActionRegisterProofDagStudy.js';
import { requiredTutorStubArtifactArchiveArgs } from '../services/tutorStubArtifactArchive.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v1.json';
const ENDPOINT = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v1.json';
const PER_DIALOGUE_CAP = 60;
const PER_BATCH_CAP = 240;
const BATCH_SIZE = 4;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function repoPath(value, label) {
  const relative = String(value || '').trim();
  if (!relative || path.isAbsolute(relative)) throw new Error(`${label} must be repository-relative`);
  const absolute = path.resolve(ROOT, relative);
  const rebased = path.relative(ROOT, absolute);
  if (rebased.startsWith('..') || path.isAbsolute(rebased)) throw new Error(`${label} escapes the repository root`);
  return absolute;
}

function sourceSnapshot(expectedSourceCommit) {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  if (status) throw new Error('boredom proof-DAG live batch requires a clean source checkout');
  if (expectedSourceCommit && expectedSourceCommit !== commit) {
    throw new Error(`boredom proof-DAG source drift: expected ${expectedSourceCommit}, found ${commit}`);
  }
  return { commit, tree };
}

function traceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(directory, name));
}

function reservationCountInDirectory(directory) {
  return traceFiles(directory)
    .flatMap(readJsonLines)
    .filter((event) => event.type === 'model_call_budget_reserved').length;
}

function traceResult(command) {
  const traces = traceFiles(command.trace_dir);
  if (traces.length !== 1)
    throw new Error(`expected exactly one trace for ${command.job_root}; found ${traces.length}`);
  const source = fs.readFileSync(traces[0]);
  return { trace: path.relative(ROOT, traces[0]), trace_sha256: sha256(source), trace_bytes: source.length };
}

export function classifyTutorStubBoredomProofDagChildFailure({
  events = [],
  signal = null,
  traceReadable = true,
} = {}) {
  if (!traceReadable) {
    return {
      category: 'unclassified_nonrecoverable',
      code: 'TUTOR_STUB_BOREDOM_PROOF_DAG_FAILURE_TRACE_UNREADABLE',
      disposition: 'manual_review_required_no_recovery',
      recoverable: false,
    };
  }
  if (!Array.isArray(events)) throw new Error('boredom proof-DAG failure classification requires trace events');
  if (events.some((event) => event.type === 'resistance_action_register_outcome_learner_turn')) {
    return {
      category: 'completed_output_nonrecoverable',
      code: 'TUTOR_STUB_BOREDOM_PROOF_DAG_TERMINAL_OUTCOME_ALREADY_RECORDED',
      disposition: 'manual_validity_review_required_no_rerun',
      recoverable: false,
    };
  }
  const substantive = events.find(
    (event) =>
      event.type === 'resistance_action_register_boredom_proof_dag_substantive_failure' ||
      (event.type === 'auto_learner_profile_adherence_exhausted' && event.profile === 'bored'),
  );
  if (substantive) {
    return {
      category: 'substantive_registered_failure',
      code: substantive.code || 'TUTOR_STUB_BOREDOM_PROOF_DAG_ADHERENCE_EXHAUSTED',
      disposition: substantive.disposition || 'substantive_registered_failure_stop_no_replacement',
      recoverable: false,
    };
  }
  const exhaustedTransport = events.some(
    (event) =>
      event.type === 'model_call_error' &&
      event.cliPolicyViolation?.reason === 'call_retry_limit_reached' &&
      Number(event.cliPolicyViolation?.audit?.prohibited_event_count || 0) === 0,
  );
  if (signal || exhaustedTransport) {
    return {
      category: 'technical_recoverable',
      code: signal
        ? 'TUTOR_STUB_BOREDOM_PROOF_DAG_CHILD_INTERRUPTED'
        : 'TUTOR_STUB_BOREDOM_PROOF_DAG_CODEX_TRANSPORT_RETRY_EXHAUSTED',
      disposition: 'bounded_missing_or_failed_unit_recovery_eligible',
      recoverable: true,
    };
  }
  return {
    category: 'unclassified_nonrecoverable',
    code: 'TUTOR_STUB_BOREDOM_PROOF_DAG_FAILURE_UNCLASSIFIED',
    disposition: 'manual_review_required_no_recovery',
    recoverable: false,
  };
}

function classifyFailedChild(trace, signal) {
  try {
    const events = trace ? readJsonLines(path.resolve(ROOT, trace.trace)) : [];
    return classifyTutorStubBoredomProofDagChildFailure({ events, signal });
  } catch {
    return classifyTutorStubBoredomProofDagChildFailure({ events: [], signal, traceReadable: false });
  }
}

function childCommand({ loaded, job, destination, modelCallBudget = PER_DIALOGUE_CAP }) {
  const jobRoot = path.join(destination, 'jobs', job.id);
  const traceDir = path.join(jobRoot, 'traces');
  const transcript = path.join(jobRoot, 'transcript.json');
  return {
    executable: process.execPath,
    args: [
      'scripts/tutor-stub.js',
      '--lab',
      'automated_eval',
      '--acknowledge-research-use',
      ...requiredTutorStubArtifactArchiveArgs(),
      '--model-call-budget',
      String(modelCallBudget),
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
      job.world,
      '--dag',
      '--dag-mode',
      'strict_dag',
      '--tutor-learner-dag',
      '--auto-learner',
      '--auto-learner-profile',
      'bored',
      '--auto-turns',
      '4',
      '--no-auto-stop-on-grounded',
      '--no-memory-summary',
      '--no-turn-feedback',
      '--run-seed',
      String(job.seed),
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
      '--boredom-proof-dag-registration',
      path.relative(ROOT, loaded.path),
      '--boredom-proof-dag-job',
      job.id,
      '--trace-dir',
      path.relative(ROOT, traceDir),
      '--save',
      path.relative(ROOT, transcript),
    ],
    cwd: ROOT,
    env: {
      TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS: 'prospective_v4',
      TUTOR_STUB_REMEMBER_SETTINGS: '0',
    },
    job_root: jobRoot,
    trace_dir: traceDir,
    transcript,
  };
}

function registeredPlan(registrationPath) {
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: repoPath(registrationPath, 'registration') });
  return { loaded, plan: buildTutorStubBoredomProofDagPlan(loaded.registration) };
}

export function buildTutorStubBoredomProofDagRecoveryJob({
  loaded,
  job,
  destination,
  priorModelAttemptReservations,
} = {}) {
  const prior = Number(priorModelAttemptReservations);
  const remaining = PER_DIALOGUE_CAP - prior;
  if (!loaded?.registration || !job?.id || !Number.isInteger(prior) || prior < 0 || remaining <= 0) {
    throw new Error('boredom proof-DAG recovery requires one registered missing or failed unit with unused room');
  }
  return {
    ...job,
    command: childCommand({ loaded, job, destination, modelCallBudget: remaining }),
    recovery: { prior_model_attempt_reservations: prior, remaining_model_attempt_reservations: remaining },
  };
}

export function buildTutorStubBoredomProofDagBatchPlan({
  registrationPath = REGISTRATION,
  batchId,
  destination,
  expectedSourceCommit = null,
} = {}) {
  if (!/^execution_batch_[1-9]$/u.test(String(batchId || ''))) {
    throw new Error('boredom proof-DAG batch must be execution_batch_1..execution_batch_9');
  }
  const { loaded, plan } = registeredPlan(registrationPath);
  const jobs = plan.jobs.filter((job) => job.batch_id === batchId);
  if (
    jobs.length !== BATCH_SIZE ||
    jobs.filter((job) => job.realization === 'plain').length !== 2 ||
    jobs.filter((job) => job.realization === 'warm').length !== 2
  ) {
    throw new Error(`${batchId} must contain exactly two plain and two warm jobs`);
  }
  const source = sourceSnapshot(expectedSourceCommit);
  const absoluteDestination = path.resolve(destination);
  return {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-plan.v1',
    status: 'planned_not_started',
    batch_id: batchId,
    source: {
      ...source,
      registration_path: path.relative(ROOT, loaded.path),
      registration_sha256: loaded.sha256,
    },
    design: {
      fresh_independent_dialogues: true,
      prior_dialogues_reused: 0,
      prior_outcomes_pooled: 0,
      plain: 2,
      warm: 2,
      interim_analysis: false,
      assignment_manifest_sha256: plan.assignment_manifest_sha256,
    },
    budget: {
      dialogues: BATCH_SIZE,
      maximum_model_attempt_reservations_per_dialogue: PER_DIALOGUE_CAP,
      maximum_model_attempt_reservations: PER_BATCH_CAP,
      study_maximum_model_attempt_reservations: 2160,
      programme_ceiling: 4505,
      enlarges_ceiling: false,
    },
    destination: path.relative(ROOT, absoluteDestination),
    destination_create_once: true,
    jobs: jobs.map((job) => ({ ...job, command: childCommand({ loaded, job, destination: absoluteDestination }) })),
    recovery: {
      valid_units_may_be_rerun: false,
      missing_or_failed_units_only: true,
      requires_actual_unused_room_below_dialogue_batch_study_and_programme_caps: true,
      outcome_selection: false,
    },
  };
}

async function runChild(planJob) {
  const command = planJob.command;
  fs.mkdirSync(command.job_root, { recursive: false });
  fs.mkdirSync(command.trace_dir, { recursive: false });
  const stdoutPath = path.join(command.job_root, 'stdout.log');
  const stderrPath = path.join(command.job_root, 'stderr.log');
  const stdout = fs.createWriteStream(stdoutPath, { flags: 'wx' });
  const stderr = fs.createWriteStream(stderrPath, { flags: 'wx' });
  return new Promise((resolve) => {
    const child = spawn(command.executable, command.args, {
      cwd: command.cwd,
      env: { ...process.env, ...command.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(stdout);
    child.stderr.pipe(stderr);
    child.on('close', (code, signal) => {
      stdout.end();
      stderr.end();
      let trace = null;
      let traceError = null;
      try {
        trace = traceResult(command);
      } catch (error) {
        traceError = error.message;
      }
      const complete = code === 0 && trace;
      resolve({
        job_id: planJob.id,
        status: complete ? 'complete' : 'failed',
        exit_code: code,
        signal,
        ...trace,
        trace_error: traceError,
        failure: complete ? null : classifyFailedChild(trace, signal),
        stdout: path.relative(ROOT, stdoutPath),
        stderr: path.relative(ROOT, stderrPath),
        transcript: path.relative(ROOT, command.transcript),
      });
    });
  });
}

async function runPool(items, parallelism, worker) {
  const pending = [...items];
  const results = [];
  async function consume() {
    while (pending.length) results.push(await worker(pending.shift()));
  }
  await Promise.all(Array.from({ length: Math.min(parallelism, items.length) }, consume));
  return results;
}

export function selectTutorStubBoredomProofDagRecoveryCandidates({ plan, initial } = {}) {
  if (!Array.isArray(plan?.jobs) || !Array.isArray(initial?.results)) {
    throw new Error('boredom proof-DAG recovery candidate audit requires one plan and initial result');
  }
  const plannedIds = new Set(plan.jobs.map((job) => job.id));
  const resultIds = initial.results.map((row) => row.job_id);
  if (
    new Set(resultIds).size !== resultIds.length ||
    resultIds.some((id) => !plannedIds.has(id)) ||
    initial.results.some((row) => !['complete', 'failed'].includes(row.status))
  ) {
    throw new Error('boredom proof-DAG recovery rows drifted from the registered plan');
  }
  const rows = new Map(initial.results.map((row) => [row.job_id, row]));
  const valid = new Map();
  const missing = [];
  for (const job of plan.jobs) {
    const row = rows.get(job.id);
    const traces = traceFiles(job.command?.trace_dir);
    if (traces.length > 1) {
      throw new Error(`boredom proof-DAG recovery refuses multiple original traces for ${job.id}`);
    }
    let observed = null;
    if (traces.length === 1) {
      try {
        observed = classifyTutorStubBoredomProofDagChildFailure({
          events: readJsonLines(traces[0]),
          signal: row?.signal || null,
        });
      } catch {
        observed = classifyTutorStubBoredomProofDagChildFailure({ traceReadable: false });
      }
    }
    if (row?.status === 'complete') {
      if (observed?.category !== 'completed_output_nonrecoverable') {
        throw new Error(`boredom proof-DAG complete row lacks one terminal output for ${job.id}`);
      }
      valid.set(job.id, row);
    } else if (observed?.category === 'completed_output_nonrecoverable') {
      throw new Error(`boredom proof-DAG recovery refuses completed original output ${job.id}`);
    } else if (!row && traces.length === 0) {
      missing.push(job);
    } else if (
      observed?.category === 'technical_recoverable' &&
      (!row || (row.failure?.category === 'technical_recoverable' && row.failure?.recoverable === true))
    ) {
      missing.push(job);
    } else {
      throw new Error(`boredom proof-DAG recovery refuses nontechnical or unclassified partial failure ${job.id}`);
    }
  }
  return { valid, missing };
}

function sealBatch(destination, plan, result, recovery = {}) {
  const seal = {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-seal.v1',
    status: 'sealed_complete',
    batch_id: plan.batch_id,
    plan_sha256: sha256(fs.readFileSync(path.join(destination, 'batch-plan.json'))),
    result_sha256: sha256(fs.readFileSync(path.join(destination, recovery.resultFile || 'batch-result.json'))),
    ...recovery.hashes,
    dialogues: BATCH_SIZE,
    hard_ceiling: PER_BATCH_CAP,
    valid_unit_reruns: false,
    outcome_selection: false,
  };
  writeJson(path.join(destination, 'batch-seal.json'), seal);
  return seal;
}

export async function runTutorStubBoredomProofDagBatch({
  registrationPath = REGISTRATION,
  batchId,
  destination,
  parallelism = 4,
  expectedSourceCommit,
} = {}) {
  const absoluteDestination = path.resolve(destination);
  if (fs.existsSync(absoluteDestination)) throw new Error('boredom proof-DAG batch destination must be fresh');
  const plan = buildTutorStubBoredomProofDagBatchPlan({
    registrationPath,
    batchId,
    destination: absoluteDestination,
    expectedSourceCommit,
  });
  fs.mkdirSync(path.dirname(absoluteDestination), { recursive: true });
  fs.mkdirSync(absoluteDestination, { recursive: false });
  fs.mkdirSync(path.join(absoluteDestination, 'jobs'), { recursive: false });
  writeJson(path.join(absoluteDestination, 'batch-plan.json'), plan);
  const results = await runPool(plan.jobs, Number(parallelism), runChild);
  results.sort((left, right) => left.job_id.localeCompare(right.job_id));
  const completed = results.filter((row) => row.status === 'complete').length;
  const result = {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-result.v1',
    batch_id: batchId,
    status: completed === BATCH_SIZE ? 'complete' : 'incomplete',
    completed_dialogues: completed,
    failed_or_missing_dialogues: BATCH_SIZE - completed,
    maximum_model_attempt_reservations: PER_BATCH_CAP,
    results,
  };
  writeJson(path.join(absoluteDestination, 'batch-result.json'), result);
  if (result.status === 'complete') sealBatch(absoluteDestination, plan, result);
  return result;
}

export async function recoverTutorStubBoredomProofDagBatch({
  destination,
  expectedSourceCommit,
  parallelism = 4,
} = {}) {
  const absoluteDestination = path.resolve(destination);
  const planPath = path.join(absoluteDestination, 'batch-plan.json');
  const resultPath = path.join(absoluteDestination, 'batch-result.json');
  if (!fs.existsSync(planPath) || !fs.existsSync(resultPath)) {
    throw new Error('boredom proof-DAG recovery requires one preserved initial plan and result');
  }
  if (fs.existsSync(path.join(absoluteDestination, 'batch-seal.json'))) {
    throw new Error('boredom proof-DAG recovery refuses a sealed batch');
  }
  if (fs.existsSync(path.join(absoluteDestination, 'batch-final-result.json'))) {
    throw new Error('boredom proof-DAG recovery is create-once');
  }
  const plan = readJson(planPath);
  const initial = readJson(resultPath);
  const currentSource = sourceSnapshot(expectedSourceCommit);
  if (
    plan.source?.commit !== expectedSourceCommit ||
    plan.source?.tree !== currentSource.tree ||
    initial.status !== 'incomplete' ||
    plan.budget?.maximum_model_attempt_reservations !== PER_BATCH_CAP
  ) {
    throw new Error('boredom proof-DAG recovery source, status, or ceiling drifted');
  }
  const { valid, missing } = selectTutorStubBoredomProofDagRecoveryCandidates({ plan, initial });
  if (!missing.length) throw new Error('boredom proof-DAG recovery found no missing or failed units');
  const initialReservations = Object.fromEntries(
    plan.jobs.map((job) => [job.id, reservationCountInDirectory(job.command.trace_dir)]),
  );
  const usedBefore = Object.values(initialReservations).reduce((sum, value) => sum + value, 0);
  if (usedBefore >= PER_BATCH_CAP || Object.values(initialReservations).some((value) => value >= PER_DIALOGUE_CAP)) {
    throw new Error('boredom proof-DAG recovery has no room under the unchanged caps');
  }
  const { loaded, plan: registered } = registeredPlan(plan.source.registration_path);
  if (loaded.sha256 !== plan.source.registration_sha256) throw new Error('boredom proof-DAG registration drifted');
  const registeredById = new Map(registered.jobs.map((job) => [job.id, job]));
  const recoveryRoot = path.join(absoluteDestination, 'recoveries', 'recovery-001');
  if (fs.existsSync(recoveryRoot)) throw new Error('boredom proof-DAG recovery-001 must be absent');
  const recoveryJobs = missing.map((original) => {
    const job = registeredById.get(original.id);
    if (!job || job.batch_id !== plan.batch_id)
      throw new Error(`boredom proof-DAG recovery unit ${original.id} drifted`);
    return buildTutorStubBoredomProofDagRecoveryJob({
      loaded,
      job,
      destination: recoveryRoot,
      priorModelAttemptReservations: initialReservations[original.id],
    });
  });
  fs.mkdirSync(path.join(recoveryRoot, 'jobs'), { recursive: true });
  const recoveryPlan = {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-recovery-plan.v1',
    status: 'planned_missing_or_failed_only',
    batch_id: plan.batch_id,
    source: plan.source,
    original_plan_sha256: sha256(fs.readFileSync(planPath)),
    original_result_sha256: sha256(fs.readFileSync(resultPath)),
    used_reservations_before_recovery: usedBefore,
    hard_ceiling: PER_BATCH_CAP,
    valid_unit_ids_excluded: [...valid.keys()].sort(),
    jobs: recoveryJobs,
  };
  writeJson(path.join(recoveryRoot, 'recovery-plan.json'), recoveryPlan);
  const recovered = await runPool(recoveryJobs, Number(parallelism), runChild);
  recovered.sort((left, right) => left.job_id.localeCompare(right.job_id));
  const recoveryResultPath = path.join(recoveryRoot, 'recovery-result.json');
  writeJson(recoveryResultPath, {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-recovery-result.v1',
    batch_id: plan.batch_id,
    results: recovered,
  });
  if (recovered.some((row) => row.status !== 'complete')) return { status: 'incomplete', recovered, sealed: false };
  const finalRows = plan.jobs.map((job) =>
    valid.has(job.id)
      ? { ...valid.get(job.id), origin: 'initial_valid_unit' }
      : {
          ...recovered.find((row) => row.job_id === job.id),
          origin: 'bounded_technical_recovery_missing_or_failed_unit',
        },
  );
  const totals = Object.fromEntries(
    plan.jobs.map((job) => {
      const recovery = recoveryJobs.find((row) => row.id === job.id);
      return [
        job.id,
        initialReservations[job.id] + (recovery ? reservationCountInDirectory(recovery.command.trace_dir) : 0),
      ];
    }),
  );
  const totalReservations = Object.values(totals).reduce((sum, value) => sum + value, 0);
  if (totalReservations > PER_BATCH_CAP || Object.values(totals).some((value) => value > PER_DIALOGUE_CAP)) {
    throw new Error('boredom proof-DAG recovery exceeded an unchanged cap');
  }
  const finalResultPath = path.join(absoluteDestination, 'batch-final-result.json');
  writeJson(finalResultPath, {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-result.v1',
    batch_id: plan.batch_id,
    status: 'complete',
    completed_dialogues: BATCH_SIZE,
    failed_or_missing_dialogues: 0,
    maximum_model_attempt_reservations: PER_BATCH_CAP,
    observed_model_attempt_reservations: totalReservations,
    observed_model_attempt_reservations_by_job: totals,
    technical_recovery_used: true,
    recovery_unit_ids: recovered.map((row) => row.job_id),
    results: finalRows,
  });
  sealBatch(absoluteDestination, plan, readJson(finalResultPath), {
    resultFile: 'batch-final-result.json',
    hashes: {
      recovery_plan_sha256: sha256(fs.readFileSync(path.join(recoveryRoot, 'recovery-plan.json'))),
      recovery_result_sha256: sha256(fs.readFileSync(recoveryResultPath)),
      observed_model_attempt_reservations: totalReservations,
      observed_model_attempt_reservations_by_job: totals,
    },
  });
  return { status: 'complete', recovered, sealed: true, observed_model_attempt_reservations: totalReservations };
}

function parseArgs(argv) {
  const options = { parallelism: '4' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (['--preflight', '--execution-preflight', '--live-batch', '--recover-batch', '--json', '--help'].includes(arg)) {
      options[arg.slice(2)] = true;
      continue;
    }
    if (
      [
        '--registration',
        '--endpoint-contract',
        '--batch',
        '--destination',
        '--parallelism',
        '--expected-source-commit',
      ].includes(arg)
    ) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      options[arg.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

function usage() {
  return `Usage:
  node scripts/run-tutor-stub-boredom-action-register-proof-dag.js --preflight [--json]
  node scripts/run-tutor-stub-boredom-action-register-proof-dag.js --execution-preflight --batch <execution_batch_1..9> --destination <fresh-path> --expected-source-commit <sha>
  node scripts/run-tutor-stub-boredom-action-register-proof-dag.js --live-batch --batch <execution_batch_1..9> --destination <fresh-path> --expected-source-commit <sha> [--parallelism 4]
  node scripts/run-tutor-stub-boredom-action-register-proof-dag.js --recover-batch --destination <incomplete-path> --expected-source-commit <sha> [--parallelism 4]

Execution preflight makes zero model calls and writes nothing. Live execution requires a separately validated digest-bound GO request.`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return void console.log(usage());
  if (args.preflight) {
    const loaded = loadTutorStubBoredomProofDagStudy({
      registrationPath: repoPath(args.registration || REGISTRATION, 'registration'),
    });
    const contract = readJson(repoPath(args['endpoint-contract'] || ENDPOINT, 'endpoint contract'));
    console.log(
      JSON.stringify(
        runTutorStubBoredomProofDagEndpointPreflight({ contract, registration: loaded.registration }),
        null,
        2,
      ),
    );
    return;
  }
  if (!args.destination || !args['expected-source-commit']) throw new Error(usage());
  const destination = path.resolve(ROOT, args.destination);
  if (args['recover-batch']) {
    const result = await recoverTutorStubBoredomProofDagBatch({
      destination,
      expectedSourceCommit: args['expected-source-commit'],
      parallelism: Number(args.parallelism),
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'complete') process.exitCode = 1;
    return;
  }
  if (!args.batch) throw new Error(usage());
  if (args['execution-preflight']) {
    if (fs.existsSync(destination)) throw new Error('boredom proof-DAG preflight destination must be absent');
    const plan = buildTutorStubBoredomProofDagBatchPlan({
      registrationPath: args.registration || REGISTRATION,
      batchId: args.batch,
      destination,
      expectedSourceCommit: args['expected-source-commit'],
    });
    console.log(JSON.stringify({ ...plan, model_calls: 0, production_writes: 0 }, null, 2));
    return;
  }
  if (!args['live-batch']) throw new Error(usage());
  const result = await runTutorStubBoredomProofDagBatch({
    registrationPath: args.registration || REGISTRATION,
    batchId: args.batch,
    destination,
    parallelism: Number(args.parallelism),
    expectedSourceCommit: args['expected-source-commit'],
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'complete') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
