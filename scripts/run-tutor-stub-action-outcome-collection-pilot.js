#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { admitPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';
import {
  loadTutorStubActionOutcomeCollectionDesign,
  runTutorStubActionOutcomeCollectionPreflight,
  TUTOR_STUB_ACTION_OUTCOME_COLLECTION_DESIGN_PATH,
} from '../services/tutorStubActionOutcomeCollectionPilot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TUTOR_STUB_ACTION_OUTCOME_COLLECTION_USAGE = `Usage:
  node scripts/run-tutor-stub-action-outcome-collection-pilot.js \
    --design config/tutor-stub-action-outcome-collection-pilot-design.v1.json \
    --dry-run

  node scripts/run-tutor-stub-action-outcome-collection-pilot.js \
    --design config/tutor-stub-action-outcome-collection-pilot-design.v1.json \
    --launch-commit <merged-detached-commit> \
    --go-note-commit <commit-containing-signed-note> \
    --go-note-path notes/<signed-go-note>.md \
    --accept-charges

--dry-run compiles all 24 registered jobs, probes the local CLI version, exercises
the three role transports with local stubs, verifies the private archive and all
create-once destinations, and writes nothing. It executes no provider call.

The paid path is unreachable without the shared standing launch contract: the
merged design, a clean detached launch commit, a signed GO note, create-once state,
the append-only ledger, and the registered 1,944-attempt hard ceiling. This launcher
collects the corpus only. It does not prepare or compare human codes, enable memory,
or authorize the later controller study.`;

function writeOnce(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function writeJsonAtomic(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filePath);
}

function readTrace(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function traceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(directory, name));
}

export function tutorStubActionOutcomeCollectionChildSpec({ job }) {
  fs.mkdirSync(job.job_root, { recursive: false });
  fs.mkdirSync(job.trace_dir, { recursive: false });
  return {
    ...job,
    stdout: path.join(job.job_root, 'stdout.log'),
    stderr: path.join(job.job_root, 'stderr.log'),
    env: { ...process.env, TUTOR_STUB_REMEMBER_SETTINGS: '0' },
  };
}

export function runTutorStubActionOutcomeCollectionChild(spec) {
  return new Promise((resolve) => {
    const stdout = fs.openSync(spec.stdout, 'wx');
    const stderr = fs.openSync(spec.stderr, 'wx');
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      fs.closeSync(stdout);
      fs.closeSync(stderr);
      resolve(result);
    };
    const child = spawn(process.execPath, spec.args, { cwd: ROOT, env: spec.env, stdio: ['ignore', stdout, stderr] });
    child.on('error', (error) => finish({ code: null, signal: null, spawn_error: error.message }));
    child.on('close', (code, signal) => finish({ code, signal, spawn_error: null }));
  });
}

function relativeToDestination(destination, value) {
  return value ? path.relative(destination, value).split(path.sep).join('/') : null;
}

export function extractTutorStubActionOutcomeCollectionRow({ job, exit, destination }) {
  const traces = traceFiles(job.trace_dir);
  const trace = traces.length === 1 ? traces[0] : null;
  const events = trace ? readTrace(trace) : [];
  const runEnd = events.filter((event) => event?.type === 'run_end').at(-1) || null;
  const turnRecords = events.filter((event) => event?.type === 'turn_complete' && event.turnRecord);
  const decisions = events.filter((event) => event?.type === 'tutor_typed_action_decision');
  const outcomes = events.filter((event) => event?.type === 'tutor_typed_action_outcome_closed');
  const reservedAttempts = events.filter((event) => event?.type === 'model_call_budget_reserved').length;
  const completedAttempts = events.filter((event) => event?.type === 'model_call').length;
  const failedAttempts = events.filter((event) =>
    ['model_call_error', 'model_call_aborted'].includes(event?.type),
  ).length;
  const budgetExhausted = events.some((event) => event?.type === 'model_call_budget_exhausted');
  const attemptAccountingBalanced = reservedAttempts === completedAttempts + failedAttempts;
  const successfulCallPlanComplete = completedAttempts === job.planned_model_calls;
  const complete =
    exit.code === 0 &&
    exit.signal === null &&
    !exit.spawn_error &&
    Boolean(trace) &&
    fs.existsSync(job.transcript) &&
    runEnd?.reason === 'auto_turn_cap' &&
    Number(runEnd?.turns) === 8 &&
    turnRecords.length === 8 &&
    decisions.length === 8 &&
    outcomes.length === 7 &&
    successfulCallPlanComplete &&
    attemptAccountingBalanced &&
    !budgetExhausted &&
    reservedAttempts <= job.model_attempt_ceiling;
  const technicalFailure =
    !complete &&
    (Boolean(exit.spawn_error) ||
      Boolean(exit.signal) ||
      (failedAttempts > 0 && !budgetExhausted) ||
      !attemptAccountingBalanced ||
      !successfulCallPlanComplete);
  const status = complete
    ? 'complete'
    : budgetExhausted || reservedAttempts > job.model_attempt_ceiling
      ? 'ceiling_failure'
      : technicalFailure
        ? 'technical_failure'
        : 'failed_unclassified';
  return {
    job_id: job.id,
    world_id: job.world_id,
    repeat: job.repeat,
    status,
    exit,
    trace: relativeToDestination(destination, trace),
    transcript: fs.existsSync(job.transcript) ? relativeToDestination(destination, job.transcript) : null,
    run_end: runEnd ? { reason: runEnd.reason, turns: runEnd.turns } : null,
    turns: turnRecords.length,
    typed_action_decisions: decisions.length,
    typed_action_outcomes_closed: outcomes.length,
    model_attempts: {
      reserved: reservedAttempts,
      completed: completedAttempts,
      failed: failedAttempts,
      budget_exhausted: budgetExhausted,
      accounting_balanced: attemptAccountingBalanced,
      planned_successful: job.planned_model_calls,
      per_dialogue_ceiling: job.model_attempt_ceiling,
    },
  };
}

function reportForRows({ loaded, preflight, admission, rows, halt }) {
  const plannedJobIds = preflight.plan.jobs.map((job) => job.id);
  const observedJobIds = new Set(rows.map((row) => row.job_id));
  const count = (status) => rows.filter((row) => row.status === status).length;
  const sums = (field) => rows.reduce((sum, row) => sum + row.model_attempts[field], 0);
  return {
    schema: 'machinespirits.tutor-stub.action-outcome-collection-generation-report.v1',
    study_id: loaded.design.studyId,
    status: halt?.status || 'generation_complete',
    halt_reason: halt?.reason || null,
    source: admission.source,
    design: { path: loaded.relativePath },
    authorization: admission.authorization,
    claim_boundary: loaded.design.claimBoundary,
    memory_controller_enabled: false,
    execution: {
      planned_units: plannedJobIds.length,
      complete_units: count('complete'),
      technical_failure_units: count('technical_failure'),
      ceiling_failure_units: count('ceiling_failure'),
      unclassified_failure_units: count('failed_unclassified'),
      missing_units: plannedJobIds.length - rows.length,
      missing_job_ids: plannedJobIds.filter((jobId) => !observedJobIds.has(jobId)),
      completed_turns: rows.reduce((sum, row) => sum + row.turns, 0),
      planned_turns: preflight.plan.planned_turns,
      model_attempts: {
        reserved_by_children: sums('reserved'),
        completed: sums('completed'),
        failed: sums('failed'),
        reserved_by_shared_ledger: admission.reserved,
        hard_ceiling: preflight.plan.model_attempt_ceiling,
      },
    },
    rows,
    next_step:
      halt === null
        ? 'Freeze the complete source corpus, then prepare the registered two-coder packet without inspecting auxiliary outcomes.'
        : 'Preserve the stopped corpus and apply the registered failure disposition before any further unit.',
  };
}

export async function executeTutorStubActionOutcomeCollection({
  loaded,
  preflight,
  admission,
  childSpec = tutorStubActionOutcomeCollectionChildSpec,
  runChild = runTutorStubActionOutcomeCollectionChild,
  extractRow = extractTutorStubActionOutcomeCollectionRow,
  progress = (line) => process.stdout.write(`${line}\n`),
} = {}) {
  const { destination } = preflight;
  const perDialogueCeiling = loaded.design.attemptCeiling.maximumReservationsPerDialogue;
  if (perDialogueCeiling * preflight.plan.jobs.length !== preflight.plan.model_attempt_ceiling) {
    throw new Error('per-dialogue reservations do not close to the registered study ceiling');
  }
  fs.mkdirSync(path.join(destination, 'jobs'), { recursive: false });
  writeOnce(path.join(destination, 'plan.json'), {
    status: 'admitted_under_shared_paid_study_launch_contract',
    source: admission.source,
    design: { path: loaded.relativePath },
    authorization: admission.authorization,
    model_attempt_ceiling: preflight.plan.model_attempt_ceiling,
    preflight,
  });

  const rows = [];
  let halt = null;
  try {
    for (const job of preflight.plan.jobs) {
      if (halt) break;
      admission.reserveModelAttempts(perDialogueCeiling, {
        unit: job.id,
        world_id: job.world_id,
        reservation_scope: 'per_dialogue_fail_before_call_ceiling',
      });
      const spec = childSpec({ loaded, job, destination });
      const exit = await runChild(spec);
      const row = extractRow({ loaded, job: spec, exit, destination });
      rows.push(row);
      if (row.status !== 'complete') {
        halt = {
          status: row.status,
          reason: `${row.status} in ${row.job_id}`,
        };
      }
      admission.record({
        type: 'unit_complete',
        job_id: row.job_id,
        world_id: row.world_id,
        status: row.status,
        child_reserved_attempts: row.model_attempts.reserved,
        child_completed_attempts: row.model_attempts.completed,
        child_failed_attempts: row.model_attempts.failed,
        shared_reserved_attempts: admission.reserved,
        ...(halt ? { halt_reason: halt.reason } : {}),
      });
      writeJsonAtomic(path.join(destination, 'checkpoint.json'), {
        study_id: loaded.design.studyId,
        status: halt?.status || 'generation_running',
        rows,
        missing_job_ids: preflight.plan.jobs.slice(rows.length).map((candidate) => candidate.id),
        shared_reserved_attempts: admission.reserved,
        hard_ceiling: preflight.plan.model_attempt_ceiling,
      });
      progress(
        `completed ${rows.length}/${preflight.plan.jobs.length}; turns ${rows.reduce((sum, candidate) => sum + candidate.turns, 0)}/${preflight.plan.planned_turns}; child calls ${rows.reduce((sum, candidate) => sum + candidate.model_attempts.completed, 0)}; reserved ${admission.reserved}/${preflight.plan.model_attempt_ceiling}${halt ? `; halted: ${halt.reason}` : ''}`,
      );
    }
    const report = reportForRows({ loaded, preflight, admission, rows, halt });
    writeOnce(path.join(destination, 'report.json'), report);
    admission.close({
      type: 'run_sealed',
      status: report.status,
      complete_units: report.execution.complete_units,
      failed_units:
        report.execution.technical_failure_units +
        report.execution.ceiling_failure_units +
        report.execution.unclassified_failure_units,
      missing_units: report.execution.missing_units,
      observed_attempts: report.execution.model_attempts.completed + report.execution.model_attempts.failed,
      reserved_attempts: admission.reserved,
      ...(report.status === 'technical_failure' ? { recovery_permitted: true } : {}),
    });
    progress(`${report.status}: ${path.join(destination, 'report.json')}`);
    return report;
  } catch (error) {
    admission.record({ type: 'launcher_failed', error: error.message });
    admission.close({ type: 'run_sealed', status: 'failed', error: error.message });
    throw error;
  }
}

function admitWithStandingContract(input) {
  return admitPaidStudyLaunch(input);
}

export async function main(argv = process.argv.slice(2), overrides = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      design: { type: 'string', default: TUTOR_STUB_ACTION_OUTCOME_COLLECTION_DESIGN_PATH },
      'launch-commit': { type: 'string' },
      'go-note-commit': { type: 'string' },
      'go-note-path': { type: 'string' },
      'accept-charges': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(`${TUTOR_STUB_ACTION_OUTCOME_COLLECTION_USAGE}\n`);
    return null;
  }
  const loaded = loadTutorStubActionOutcomeCollectionDesign({ root: ROOT, designPath: values.design });
  const preflight = await (overrides.runPreflight || runTutorStubActionOutcomeCollectionPreflight)({
    loaded,
    ...(overrides.destinationExists ? { destinationExists: overrides.destinationExists } : {}),
    ...(overrides.resolveArchive ? { resolveArchive: overrides.resolveArchive } : {}),
    ...(overrides.probeRoute ? { probeRoute: overrides.probeRoute } : {}),
    ...(overrides.smokeRole ? { smokeRole: overrides.smokeRole } : {}),
  });
  process.stdout.write(`${JSON.stringify(preflight, null, 2)}\n`);
  if (preflight.status !== 'passed_zero_call') throw new Error('action-outcome collection zero-call preflight failed');
  if (values['dry-run']) return preflight;
  if (!values['accept-charges'] || !values['launch-commit'] || !values['go-note-commit'] || !values['go-note-path']) {
    throw new Error('paid launch requires --accept-charges, --launch-commit, --go-note-commit, and --go-note-path');
  }
  const admission = (overrides.admit || admitWithStandingContract)({
    root: ROOT,
    designPath: loaded.relativePath,
    launchCommit: values['launch-commit'],
    goNoteCommit: values['go-note-commit'],
    goNotePath: values['go-note-path'],
    spendCap: loaded.design.attemptCeiling.hardMaximumReservations,
    destination: preflight.destination,
    studyId: loaded.design.studyId,
    studyStateRoot: path.join(path.dirname(preflight.destination), '.paid-study-state'),
  });
  return (overrides.execute || executeTutorStubActionOutcomeCollection)({ loaded, preflight, admission });
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
