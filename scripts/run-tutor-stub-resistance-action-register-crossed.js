#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubResistanceActionRegisterPlan,
  extractTutorStubResistanceActionRegisterPrefix,
  loadTutorStubResistanceActionRegisterRegistration,
  prepareTutorStubResistanceActionRegisterFrozenBranch,
} from '../services/tutorStubResistanceActionRegisterStudy.js';
import { loadTutorStubResistanceActionRegisterPrefixBundle } from '../services/tutorStubResistanceActionRegisterExecution.js';
import { runTutorStubResistanceActionRegisterEndpointPreflight } from '../services/tutorStubResistanceActionRegisterPreflight.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION_V1 = 'config/tutor-stub-resistance-action-register-crossed-registration.v1.json';
const REGISTRATION_V2 = 'config/tutor-stub-resistance-action-register-crossed-registration.v2.json';
const ENDPOINT_V1 = 'config/paid-study-endpoints/tutor-stub-resistance-action-register-baseline.json';
const ENDPOINT_V2 = 'config/paid-study-endpoints/tutor-stub-resistance-action-register-baseline.v2.json';
const PREFIX_BUNDLE = 'config/tutor-stub-resistance-action-register-v4-public-prefixes.v1.json';
const PER_DIALOGUE_CAP = 39;
const PER_BATCH_CAP = 234;
const BATCH_SIZE = 6;

function parseArgs(argv) {
  const options = { preflight: false, plan: false, json: false, stage: 'baseline', parallelism: '3' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (
      [
        '--preflight',
        '--plan',
        '--execution-preflight',
        '--live-batch',
        '--recover-batch',
        '--json',
        '--help',
      ].includes(arg)
    ) {
      options[arg.slice(2)] = true;
      continue;
    }
    if (
      [
        '--registration',
        '--endpoint-contract',
        '--prefix-manifest',
        '--prefix-bundle',
        '--stage',
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

function repoPath(value, label) {
  const relative = String(value || '').trim();
  if (!relative || path.isAbsolute(relative)) throw new Error(`${label} must be repository-relative`);
  const absolute = path.resolve(ROOT, relative);
  const resolvedRelative = path.relative(ROOT, absolute);
  if (resolvedRelative.startsWith('..') || path.isAbsolute(resolvedRelative)) {
    throw new Error(`${label} escapes the repository root`);
  }
  return absolute;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

export function buildTutorStubResistanceActionRegisterPrefixPlan({ registration, manifest }) {
  if (manifest?.schema !== 'machinespirits.tutor-stub.resistance-action-register-prefix-manifest.v1') {
    throw new Error('prefix manifest has an unsupported schema');
  }
  if (!Array.isArray(manifest.sources) || !manifest.sources.length) {
    throw new Error('prefix manifest requires source traces');
  }
  const prefixes = manifest.sources.map((source) =>
    extractTutorStubResistanceActionRegisterPrefix({
      tracePath: repoPath(source.trace, `prefix trace ${source.trace}`),
      profile: source.profile,
      observationSemantics:
        manifest.observationSemantics || registration.design?.trigger?.observationSemantics || undefined,
    }),
  );
  const plan = buildTutorStubResistanceActionRegisterPlan({
    registration,
    prefixes,
    stage: manifest.stage || 'baseline',
  });
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml'));
  const prefixById = new Map(prefixes.map((prefix) => [prefix.id, prefix]));
  return {
    ...plan,
    jobs: plan.jobs.map((job) => {
      const branch = prepareTutorStubResistanceActionRegisterFrozenBranch({
        prefix: prefixById.get(job.prefix_id),
        registration,
        world,
        actionFit: job.treatment.action_fit,
        realization: job.treatment.realization,
        repeat: job.treatment.repeat,
      });
      return {
        ...job,
        exact_prefix_branch: {
          schema: branch.schema,
          frozen_bundle_prefix_sha256: branch.frozen_bundle_prefix_sha256,
          request_sha256: sha256(JSON.stringify(branch.bundle.request)),
          treatment: branch.treatment,
          bundle: branch.bundle,
        },
      };
    }),
  };
}

export function runTutorStubResistanceActionRegisterZeroCall({
  registrationPath = REGISTRATION_V1,
  endpointContractPath = ENDPOINT_V1,
} = {}) {
  const loaded = loadTutorStubResistanceActionRegisterRegistration(repoPath(registrationPath, 'registration'));
  const contract = readJson(repoPath(endpointContractPath, 'endpoint contract'));
  if (contract.registration?.registration_sha256 !== loaded.sha256) {
    throw new Error('endpoint contract registration digest does not match the frozen registration');
  }
  const preflight = runTutorStubResistanceActionRegisterEndpointPreflight({
    contract,
    registration: loaded.registration,
  });
  return {
    schema: 'machinespirits.tutor-stub.resistance-action-register-zero-call-readiness.v1',
    status: 'passed_hold',
    model_calls: 0,
    production_writes: 0,
    registration: { path: path.relative(ROOT, loaded.path), sha256: loaded.sha256, status: loaded.registration.status },
    endpoint_preflight: preflight,
    live_execution_available: loaded.registration.version === 2,
    live_execution_blocker:
      loaded.registration.version === 2
        ? 'A post-merge HOLD request must pin the exact source, both create-once batch destinations, commands, and ceilings.'
        : 'No live executor is registered for the historical V1 design.',
  };
}

function portablePrefixes(bundle) {
  return bundle.prefixes.map((prefix) => ({
    schema: prefix.schema,
    id: prefix.id,
    profile: prefix.profile,
    world: prefix.world,
    trigger_turn: prefix.trigger_turn,
    trigger_turn_id: `${prefix.id}:trigger`,
    trigger_learner_text: prefix.trigger_learner_text,
    trigger_classification: null,
    trigger_observation: null,
    observation_semantics: prefix.observation_semantics,
    source_trace: `sha256:${prefix.source_trace_sha256}`,
    source_trace_sha256: prefix.source_trace_sha256,
    prefix_trace_sha256: prefix.public_prefix_sha256,
    public_prefix_sha256: prefix.public_prefix_sha256,
    prior_turn_count: 0,
  }));
}

function registeredExecutionPlan({ registrationPath, prefixBundlePath }) {
  const loaded = loadTutorStubResistanceActionRegisterPrefixBundle({
    registrationPath: repoPath(registrationPath, 'registration'),
    bundlePath: repoPath(prefixBundlePath, 'prefix bundle'),
  });
  const plan = buildTutorStubResistanceActionRegisterPlan({
    registration: loaded.registration.registration,
    prefixes: portablePrefixes(loaded.bundle),
    stage: 'baseline',
  });
  return { loaded, plan };
}

function childCommand({ loaded, job, destination, modelCallBudget = PER_DIALOGUE_CAP }) {
  const prefix = loaded.bundle.prefixes.find((candidate) => candidate.id === job.prefix_id);
  const jobRoot = path.join(destination, 'jobs', job.id);
  const traceDir = path.join(jobRoot, 'traces');
  const transcript = path.join(jobRoot, 'transcript.json');
  const args = [
    'scripts/tutor-stub.js',
    '--lab',
    'automated_eval',
    '--acknowledge-research-use',
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
    'world_005_marrick',
    '--dag',
    '--dag-mode',
    'strict_dag',
    '--tutor-learner-dag',
    '--auto-learner',
    '--auto-learner-profile',
    'frame_refuser',
    '--auto-turns',
    '3',
    '--no-auto-stop-on-grounded',
    '--once',
    prefix.trigger_learner_text,
    '--no-opening',
    '--no-memory-summary',
    '--no-turn-feedback',
    '--run-seed',
    '20260820',
    '--eval-repeat',
    job.treatment.repeat === 'A' ? '1' : '2',
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
    '--resistance-action-register-registration',
    path.relative(ROOT, loaded.registration.path),
    '--resistance-action-register-prefix-bundle',
    path.relative(ROOT, loaded.path),
    '--resistance-action-register-job',
    job.id,
    '--trace-dir',
    path.relative(ROOT, traceDir),
    '--save',
    path.relative(ROOT, transcript),
  ];
  return {
    executable: process.execPath,
    args,
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

export function buildTutorStubResistanceActionRegisterBatchPlan({
  registrationPath = REGISTRATION_V2,
  prefixBundlePath = PREFIX_BUNDLE,
  repeat,
  destination,
  expectedSourceCommit = null,
} = {}) {
  const normalizedRepeat = String(repeat || '').toUpperCase();
  if (!['A', 'B'].includes(normalizedRepeat)) throw new Error('batch repeat must be A or B');
  const { loaded, plan } = registeredExecutionPlan({ registrationPath, prefixBundlePath });
  const jobs = plan.jobs.filter((job) => job.treatment.repeat === normalizedRepeat);
  if (
    jobs.length !== BATCH_SIZE ||
    jobs.some((job) => job.treatment.batch_id !== `batch_${normalizedRepeat}`) ||
    new Set(jobs.map((job) => `${job.prefix_id}:${job.treatment.realization}`)).size !== BATCH_SIZE
  ) {
    throw new Error(`registered batch ${normalizedRepeat} is not the exact 3-prefix by 2-realization tranche`);
  }
  const absoluteDestination = path.resolve(destination);
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (expectedSourceCommit && expectedSourceCommit !== sourceCommit) {
    throw new Error(`live source drift: expected ${expectedSourceCommit}, found ${sourceCommit}`);
  }
  return {
    schema: 'machinespirits.tutor-stub.resistance-action-register-live-batch-plan.v1',
    status: 'planned_not_started',
    batch_id: `batch_${normalizedRepeat}`,
    repeat: normalizedRepeat,
    source: {
      commit: sourceCommit,
      tree: sourceTree,
      registration_path: path.relative(ROOT, loaded.registration.path),
      registration_sha256: loaded.registration.sha256,
      prefix_bundle_path: path.relative(ROOT, loaded.path),
      prefix_bundle_sha256: loaded.sha256,
    },
    budget: {
      dialogues: BATCH_SIZE,
      maximum_model_attempt_reservations_per_dialogue: PER_DIALOGUE_CAP,
      maximum_model_attempt_reservations: PER_BATCH_CAP,
      enlarges_ceiling: false,
    },
    destination: path.relative(ROOT, absoluteDestination),
    destination_create_once: true,
    jobs: jobs.map((job) => ({ ...job, command: childCommand({ loaded, job, destination: absoluteDestination }) })),
    recovery: {
      valid_units_may_be_rerun: false,
      missing_or_failed_units_only: true,
      requires_actual_unused_room_below_batch_cap: true,
      outcome_selection: false,
    },
  };
}

function traceResult(command) {
  const traces = fs.existsSync(command.trace_dir)
    ? fs
        .readdirSync(command.trace_dir)
        .filter((name) => name.endsWith('.jsonl'))
        .map((name) => path.join(command.trace_dir, name))
    : [];
  if (traces.length !== 1)
    throw new Error(`expected exactly one trace for ${command.job_root}; found ${traces.length}`);
  const source = fs.readFileSync(traces[0]);
  return { trace: path.relative(ROOT, traces[0]), trace_sha256: sha256(source), trace_bytes: source.length };
}

function runChild(planJob) {
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
      if (code === 0) {
        try {
          trace = traceResult(command);
        } catch (error) {
          traceError = error.message;
        }
      }
      resolve({
        job_id: planJob.id,
        status: code === 0 && trace ? 'complete' : 'failed',
        exit_code: code,
        signal,
        ...trace,
        trace_error: traceError,
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

export async function runTutorStubResistanceActionRegisterBatch({
  registrationPath = REGISTRATION_V2,
  prefixBundlePath = PREFIX_BUNDLE,
  repeat,
  destination,
  parallelism = 3,
  expectedSourceCommit,
} = {}) {
  const absoluteDestination = path.resolve(destination);
  if (fs.existsSync(absoluteDestination)) throw new Error('batch destination must be fresh and absent');
  const plan = buildTutorStubResistanceActionRegisterBatchPlan({
    registrationPath,
    prefixBundlePath,
    repeat,
    destination: absoluteDestination,
    expectedSourceCommit,
  });
  fs.mkdirSync(absoluteDestination, { recursive: false });
  fs.mkdirSync(path.join(absoluteDestination, 'jobs'), { recursive: false });
  writeJson(path.join(absoluteDestination, 'batch-plan.json'), plan);
  const results = await runPool(plan.jobs, Number(parallelism), runChild);
  results.sort((a, b) => a.job_id.localeCompare(b.job_id));
  const completed = results.filter((row) => row.status === 'complete').length;
  const result = {
    schema: 'machinespirits.tutor-stub.resistance-action-register-live-batch-result.v1',
    batch_id: plan.batch_id,
    repeat: plan.repeat,
    status: completed === BATCH_SIZE ? 'complete' : 'incomplete',
    completed_dialogues: completed,
    failed_or_missing_dialogues: BATCH_SIZE - completed,
    maximum_model_attempt_reservations: PER_BATCH_CAP,
    results,
  };
  writeJson(path.join(absoluteDestination, 'batch-result.json'), result);
  if (result.status === 'complete') {
    writeJson(path.join(absoluteDestination, 'batch-seal.json'), {
      schema: 'machinespirits.tutor-stub.resistance-action-register-live-batch-seal.v1',
      status: 'sealed_complete',
      batch_id: plan.batch_id,
      repeat: plan.repeat,
      plan_sha256: sha256(fs.readFileSync(path.join(absoluteDestination, 'batch-plan.json'))),
      result_sha256: sha256(fs.readFileSync(path.join(absoluteDestination, 'batch-result.json'))),
      dialogues: BATCH_SIZE,
      hard_ceiling: PER_BATCH_CAP,
      valid_unit_reruns: false,
      outcome_selection: false,
    });
  }
  return result;
}

function reservationCountInDirectory(directory) {
  if (!fs.existsSync(directory)) return 0;
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => readJsonLines(path.join(directory, name)))
    .flat()
    .filter((event) => event.type === 'model_call_budget_reserved').length;
}

function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function recoverTutorStubResistanceActionRegisterBatch({
  destination,
  expectedSourceCommit,
  parallelism = 3,
} = {}) {
  const absoluteDestination = path.resolve(destination);
  const planPath = path.join(absoluteDestination, 'batch-plan.json');
  const initialResultPath = path.join(absoluteDestination, 'batch-result.json');
  if (!fs.existsSync(planPath) || !fs.existsSync(initialResultPath)) {
    throw new Error('batch recovery requires one preserved initial plan and result');
  }
  if (fs.existsSync(path.join(absoluteDestination, 'batch-seal.json'))) {
    throw new Error('batch recovery refuses a sealed batch and will not rerun valid outputs');
  }
  if (fs.existsSync(path.join(absoluteDestination, 'batch-final-result.json'))) {
    throw new Error('batch recovery is create-once and may not overwrite an earlier recovery result');
  }
  const plan = readJson(planPath);
  const initial = readJson(initialResultPath);
  const currentSourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const currentSourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (
    plan.source?.commit !== expectedSourceCommit ||
    currentSourceCommit !== expectedSourceCommit ||
    plan.source?.tree !== currentSourceTree ||
    initial.status !== 'incomplete' ||
    plan.budget?.maximum_model_attempt_reservations !== PER_BATCH_CAP
  ) {
    throw new Error('batch recovery source, status, or ceiling drifted');
  }
  const registeredJobIds = new Set(plan.jobs?.map((job) => job.id) || []);
  if (
    registeredJobIds.size !== BATCH_SIZE ||
    !Array.isArray(initial.results) ||
    new Set(initial.results.map((row) => row.job_id)).size !== initial.results.length ||
    initial.results.some((row) => !registeredJobIds.has(row.job_id) || !['complete', 'failed'].includes(row.status))
  ) {
    throw new Error('batch recovery initial result does not match the six registered units');
  }
  const validInitial = new Map(
    initial.results.filter((row) => row.status === 'complete').map((row) => [row.job_id, row]),
  );
  const missingOrFailed = plan.jobs.filter((job) => !validInitial.has(job.id));
  if (!missingOrFailed.length) throw new Error('batch recovery found no missing or failed units');
  const initialReservations = Object.fromEntries(
    plan.jobs.map((job) => [job.id, reservationCountInDirectory(job.command.trace_dir)]),
  );
  const usedBeforeRecovery = Object.values(initialReservations).reduce((sum, count) => sum + count, 0);
  if (
    usedBeforeRecovery >= PER_BATCH_CAP ||
    Object.values(initialReservations).some((count) => count >= PER_DIALOGUE_CAP)
  ) {
    throw new Error('batch recovery has no unused room below the unchanged dialogue or batch cap');
  }
  const recoveryRoot = path.join(absoluteDestination, 'recoveries', 'recovery-001');
  if (fs.existsSync(recoveryRoot)) {
    throw new Error('batch recovery-001 destination must be fresh and absent');
  }
  const { loaded, plan: registeredPlan } = registeredExecutionPlan({
    registrationPath: plan.source.registration_path,
    prefixBundlePath: plan.source.prefix_bundle_path,
  });
  if (
    loaded.registration.sha256 !== plan.source.registration_sha256 ||
    loaded.sha256 !== plan.source.prefix_bundle_sha256
  ) {
    throw new Error('batch recovery registration or prefix bundle drifted from the initial plan');
  }
  const registeredById = new Map(registeredPlan.jobs.map((job) => [job.id, job]));
  const recoveryJobs = missingOrFailed.map((original) => {
    const job = registeredById.get(original.id);
    if (!job || job.treatment.repeat !== plan.repeat)
      throw new Error(`recovery unit ${original.id} drifted from registration`);
    const remainingDialogueReservations = PER_DIALOGUE_CAP - initialReservations[job.id];
    if (remainingDialogueReservations <= 0) throw new Error(`recovery unit ${job.id} exhausted its 39-reservation cap`);
    return {
      ...job,
      command: childCommand({
        loaded,
        job,
        destination: recoveryRoot,
        modelCallBudget: remainingDialogueReservations,
      }),
      recovery: {
        prior_model_attempt_reservations: initialReservations[job.id],
        remaining_model_attempt_reservations: remainingDialogueReservations,
      },
    };
  });
  fs.mkdirSync(path.join(recoveryRoot, 'jobs'), { recursive: true });
  const recoveryPlan = {
    schema: 'machinespirits.tutor-stub.resistance-action-register-live-batch-recovery-plan.v1',
    status: 'planned_missing_or_failed_only',
    batch_id: plan.batch_id,
    repeat: plan.repeat,
    source: plan.source,
    original_plan_sha256: sha256(fs.readFileSync(planPath)),
    original_result_sha256: sha256(fs.readFileSync(initialResultPath)),
    used_reservations_before_recovery: usedBeforeRecovery,
    hard_ceiling: PER_BATCH_CAP,
    valid_unit_ids_excluded: [...validInitial.keys()].sort(),
    jobs: recoveryJobs,
  };
  writeJson(path.join(recoveryRoot, 'recovery-plan.json'), recoveryPlan);
  const recovered = await runPool(recoveryJobs, Number(parallelism), runChild);
  recovered.sort((a, b) => a.job_id.localeCompare(b.job_id));
  writeJson(path.join(recoveryRoot, 'recovery-result.json'), {
    schema: 'machinespirits.tutor-stub.resistance-action-register-live-batch-recovery-result.v1',
    batch_id: plan.batch_id,
    repeat: plan.repeat,
    results: recovered,
  });
  if (recovered.some((row) => row.status !== 'complete')) {
    return { status: 'incomplete', recovered, sealed: false };
  }
  const finalRows = plan.jobs.map((job) => {
    const initialRow = validInitial.get(job.id);
    const recoveryRow = recovered.find((row) => row.job_id === job.id);
    return initialRow
      ? { ...initialRow, origin: 'initial_valid_unit' }
      : { ...recoveryRow, origin: 'bounded_technical_recovery_missing_or_failed_unit' };
  });
  const finalReservationsByJob = Object.fromEntries(
    plan.jobs.map((job) => {
      const recoveryJob = recoveryJobs.find((row) => row.id === job.id);
      return [
        job.id,
        initialReservations[job.id] + (recoveryJob ? reservationCountInDirectory(recoveryJob.command.trace_dir) : 0),
      ];
    }),
  );
  const totalReservations = Object.values(finalReservationsByJob).reduce((sum, count) => sum + count, 0);
  if (
    totalReservations > PER_BATCH_CAP ||
    Object.values(finalReservationsByJob).some((count) => count > PER_DIALOGUE_CAP)
  ) {
    throw new Error('batch recovery exceeded the unchanged dialogue or batch reservation cap');
  }
  const finalResultPath = path.join(absoluteDestination, 'batch-final-result.json');
  writeJson(finalResultPath, {
    schema: 'machinespirits.tutor-stub.resistance-action-register-live-batch-result.v1',
    batch_id: plan.batch_id,
    repeat: plan.repeat,
    status: 'complete',
    completed_dialogues: BATCH_SIZE,
    failed_or_missing_dialogues: 0,
    maximum_model_attempt_reservations: PER_BATCH_CAP,
    observed_model_attempt_reservations: totalReservations,
    observed_model_attempt_reservations_by_job: finalReservationsByJob,
    technical_recovery_used: true,
    recovery_unit_ids: recovered.map((row) => row.job_id),
    results: finalRows,
  });
  writeJson(path.join(absoluteDestination, 'batch-seal.json'), {
    schema: 'machinespirits.tutor-stub.resistance-action-register-live-batch-seal.v1',
    status: 'sealed_complete',
    batch_id: plan.batch_id,
    repeat: plan.repeat,
    plan_sha256: sha256(fs.readFileSync(planPath)),
    result_sha256: sha256(fs.readFileSync(finalResultPath)),
    recovery_plan_sha256: sha256(fs.readFileSync(path.join(recoveryRoot, 'recovery-plan.json'))),
    recovery_result_sha256: sha256(fs.readFileSync(path.join(recoveryRoot, 'recovery-result.json'))),
    dialogues: BATCH_SIZE,
    hard_ceiling: PER_BATCH_CAP,
    observed_model_attempt_reservations: totalReservations,
    observed_model_attempt_reservations_by_job: finalReservationsByJob,
    valid_unit_reruns: false,
    outcome_selection: false,
  });
  return { status: 'complete', recovered, sealed: true, observed_model_attempt_reservations: totalReservations };
}

function usage() {
  return `Usage:
  node scripts/run-tutor-stub-resistance-action-register-crossed.js --preflight [--json]
  node scripts/run-tutor-stub-resistance-action-register-crossed.js --plan --prefix-manifest <path> [--json]
  node scripts/run-tutor-stub-resistance-action-register-crossed.js --execution-preflight --batch <A|B> --destination <fresh-path> [--json]
  node scripts/run-tutor-stub-resistance-action-register-crossed.js --live-batch --batch <A|B> --destination <fresh-path> [--parallelism 3]
  node scripts/run-tutor-stub-resistance-action-register-crossed.js --recover-batch --destination <incomplete-batch-path> --expected-source-commit <sha>

Preflight and plan modes make zero model calls. Live batch mode requires a future
validated GO request and uses an exact six-dialogue create-once destination.`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return void console.log(usage());
  const v2Mode = args['execution-preflight'] || args['live-batch'] || args['recover-batch'];
  const registrationPath = args.registration || (v2Mode ? REGISTRATION_V2 : REGISTRATION_V1);
  const prefixBundlePath = args['prefix-bundle'] || PREFIX_BUNDLE;
  if (args.plan) {
    if (!args['prefix-manifest']) throw new Error('--plan requires --prefix-manifest');
    const loaded = loadTutorStubResistanceActionRegisterRegistration(repoPath(registrationPath, 'registration'));
    const manifest = readJson(repoPath(args['prefix-manifest'], 'prefix manifest'));
    if (args.stage) manifest.stage = args.stage;
    return void console.log(
      JSON.stringify(
        buildTutorStubResistanceActionRegisterPrefixPlan({ registration: loaded.registration, manifest }),
        null,
        2,
      ),
    );
  }
  if (v2Mode) {
    if (!args.destination) throw new Error('--destination is required');
    const destination = path.resolve(ROOT, args.destination);
    if (args['recover-batch']) {
      if (!args['expected-source-commit']) throw new Error('--recover-batch requires --expected-source-commit');
      const result = await recoverTutorStubResistanceActionRegisterBatch({
        destination,
        expectedSourceCommit: args['expected-source-commit'],
        parallelism: Number(args.parallelism),
      });
      console.log(JSON.stringify(result, null, 2));
      if (result.status !== 'complete') process.exitCode = 1;
      return;
    }
    if (args['execution-preflight']) {
      if (fs.existsSync(destination)) throw new Error('execution-preflight destination must be absent');
      const plan = buildTutorStubResistanceActionRegisterBatchPlan({
        registrationPath,
        prefixBundlePath,
        repeat: args.batch,
        destination,
        expectedSourceCommit: args['expected-source-commit'] || null,
      });
      return void console.log(JSON.stringify({ ...plan, model_calls: 0, production_writes: 0 }, null, 2));
    }
    if (!args['expected-source-commit']) throw new Error('--live-batch requires --expected-source-commit');
    const result = await runTutorStubResistanceActionRegisterBatch({
      registrationPath,
      prefixBundlePath,
      repeat: args.batch,
      destination,
      parallelism: Number(args.parallelism),
      expectedSourceCommit: args['expected-source-commit'],
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'complete') process.exitCode = 1;
    return;
  }
  const result = runTutorStubResistanceActionRegisterZeroCall({
    registrationPath,
    endpointContractPath:
      args['endpoint-contract'] || (registrationPath === REGISTRATION_V2 ? ENDPOINT_V2 : ENDPOINT_V1),
  });
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`resistance action/register readiness: ${result.status}`);
    console.log(`model calls: ${result.model_calls}; production writes: ${result.production_writes}`);
    console.log(`baseline cases: ${result.endpoint_preflight.registered_scale.cases}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
