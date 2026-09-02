#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { admitPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';
import {
  buildTutorStubActionOutcomeCollectionPlan,
  loadTutorStubActionOutcomeCollectionDesign,
  runTutorStubActionOutcomeCollectionPreflight,
  TUTOR_STUB_ACTION_OUTCOME_COLLECTION_DESIGN_PATH,
} from '../services/tutorStubActionOutcomeCollectionPilot.js';
import {
  loadTutorStubActionOutcomeComparableCollectionDesign,
  runTutorStubActionOutcomeComparableCollectionPreflight,
  TUTOR_STUB_ACTION_OUTCOME_COMPARABLE_COLLECTION_DESIGN_PATH,
} from '../services/tutorStubActionOutcomeComparableCollection.js';
import { createDurablePauseStateMachine } from '../services/durableAttemptJournal.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TUTOR_STUB_ACTION_OUTCOME_COLLECTION_USAGE = `Usage:
  node scripts/run-tutor-stub-action-outcome-collection-pilot.js \
    --design config/tutor-stub-action-outcome-collection-pilot-design.v1.json \
    --dry-run

  node scripts/run-tutor-stub-action-outcome-collection-pilot.js \
    --design config/tutor-stub-action-outcome-comparable-collection-design.v2.json \
    --dry-run

  node scripts/run-tutor-stub-action-outcome-collection-pilot.js \
    --design config/tutor-stub-action-outcome-collection-pilot-design.v1.json \
    --launch-commit <merged-detached-commit> \
    --go-note-commit <commit-containing-signed-note> \
    --go-note-path notes/<signed-go-note>.md \
    --accept-charges

  node scripts/run-tutor-stub-action-outcome-collection-pilot.js \
    --design config/tutor-stub-action-outcome-collection-pilot-design.v1.json \
    --recovery-from /absolute/path/to/sealed-technical-predecessor \
    --destination /absolute/path/to/fresh-recovery-destination \
    --launch-commit <merged-detached-recovery-commit> \
    --go-note-commit <commit-containing-study-go-note> \
    --go-note-path notes/<signed-study-go-note>.md \
    --accept-charges

--dry-run compiles all jobs in the selected registered design, probes the local CLI version, exercises
the three role transports with local stubs, verifies the private archive and all
create-once destinations, and writes nothing. It executes no provider call.

The paid path is unreachable without the shared standing launch contract: the
merged design, a clean detached launch commit, a signed GO note, create-once state,
the append-only ledger, and the selected design's registered hard ceiling. This launcher
collects the corpus only. It does not prepare or compare human codes, enable memory,
or authorize the later controller study. Recovery preserves and skips every prior
completed or failed unit, runs only never-attempted jobs, and remains inside the
original study-wide ceiling.`;

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

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function readJsonLines(filePath, label) {
  try {
    return fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    throw new Error(`${label} is not valid JSONL: ${error.message}`);
  }
}

function traceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(directory, name));
}

export function tutorStubActionOutcomeCollectionChildSpec({ job, admission = null, capacity = null }) {
  fs.mkdirSync(job.job_root, { recursive: false });
  fs.mkdirSync(job.trace_dir, { recursive: false });
  const attemptLedgerEnvironment =
    admission?.attemptLedgerEnvironment && capacity
      ? admission.attemptLedgerEnvironment({ unitId: job.id, capacity })
      : {};
  return {
    ...job,
    stdout: path.join(job.job_root, 'stdout.log'),
    stderr: path.join(job.job_root, 'stderr.log'),
    env: { ...process.env, ...attemptLedgerEnvironment, TUTOR_STUB_REMEMBER_SETTINGS: '0' },
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

export function extractTutorStubActionOutcomeCollectionRow({
  job,
  exit,
  destination,
  interruptionDisposition = null,
}) {
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
  let cancelledBeforeDispatch = events.filter(
    (event) => event?.type === 'model_attempt_cancelled_before_dispatch',
  ).length;
  let interruptedAfterDispatch = events.filter(
    (event) => event?.type === 'model_attempt_interrupted_after_dispatch',
  ).length;
  const initiallyUnexplained = Math.max(
    0,
    reservedAttempts - completedAttempts - failedAttempts - cancelledBeforeDispatch - interruptedAfterDispatch,
  );
  if (interruptionDisposition === 'cancelled_before_dispatch') cancelledBeforeDispatch += initiallyUnexplained;
  if (interruptionDisposition === 'interrupted_after_dispatch') interruptedAfterDispatch += initiallyUnexplained;
  const unexplainedAttempts = Math.max(
    0,
    reservedAttempts - completedAttempts - failedAttempts - cancelledBeforeDispatch - interruptedAfterDispatch,
  );
  const budgetExhausted = events.some((event) => event?.type === 'model_call_budget_exhausted');
  const attemptAccountingBalanced = unexplainedAttempts === 0;
  const successfulCallPlanComplete = completedAttempts >= job.planned_model_calls;
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
      cancelled_before_dispatch: cancelledBeforeDispatch,
      interrupted_after_dispatch: interruptedAfterDispatch,
      unexplained: unexplainedAttempts,
      budget_exhausted: budgetExhausted,
      accounting_balanced: attemptAccountingBalanced,
      accounting_equation:
        'reserved = completed + failed + cancelled_before_dispatch + interrupted_after_dispatch + unexplained',
      normal_planned_successful: job.planned_model_calls,
      successful_at_or_above_normal_plan: successfulCallPlanComplete,
      per_dialogue_ceiling: job.model_attempt_ceiling,
    },
  };
}

function comparableRecoveryJob(job) {
  const args = [...job.args];
  for (const option of ['--trace-dir', '--save']) {
    const index = args.indexOf(option);
    if (index < 0 || index + 1 >= args.length) throw new Error(`recovery job ${job.id} is missing ${option}`);
    args[index + 1] = `<${option.slice(2)}>`;
  }
  return {
    id: job.id,
    world_id: job.world_id,
    repeat: job.repeat,
    run_seed: job.run_seed,
    task_id: job.task_id,
    planned_model_calls: job.planned_model_calls,
    model_attempt_ceiling: job.model_attempt_ceiling,
    args,
  };
}

export function loadTutorStubActionOutcomeCollectionRecovery({ loaded, preflight, recoveryFrom } = {}) {
  if (!recoveryFrom || !path.isAbsolute(recoveryFrom)) throw new Error('recovery predecessor must be absolute');
  const sourceRoot = path.resolve(recoveryFrom);
  const sourcePlanPath = path.join(sourceRoot, 'plan.json');
  const sourceLedgerPath = path.join(sourceRoot, 'run-ledger.jsonl');
  const sourcePlan = readJson(sourcePlanPath, 'action-outcome predecessor plan');
  const sourceFullPlan = sourcePlan.preflight?.plan;
  if (
    sourcePlan.status !== 'admitted_under_shared_paid_study_launch_contract' ||
    sourcePlan.design?.path !== loaded.relativePath ||
    sourcePlan.model_attempt_ceiling !== preflight.plan.model_attempt_ceiling ||
    sourceFullPlan?.study_id !== loaded.design.studyId ||
    path.resolve(sourceFullPlan?.destination || '') !== sourceRoot ||
    sourceFullPlan?.jobs?.length !== preflight.plan.jobs.length
  ) {
    throw new Error('action-outcome recovery predecessor plan drift');
  }
  if (
    JSON.stringify(sourceFullPlan.jobs.map(comparableRecoveryJob)) !==
    JSON.stringify(preflight.plan.jobs.map(comparableRecoveryJob))
  ) {
    throw new Error('action-outcome recovery job plan drift');
  }

  const ledger = readJsonLines(sourceLedgerPath, 'action-outcome predecessor ledger');
  const launchEvents = ledger.filter((event) => event.type === 'launch_admitted');
  const reservationEvents = ledger.filter((event) => event.type === 'model_attempt_reserved');
  const completedEvents = ledger.filter((event) => event.type === 'unit_complete');
  const seal = ledger.at(-1);
  const linkedRecovery = Boolean(sourcePlan.recovery);
  const pausedPredecessor = seal?.status === 'paused_recoverable';
  const zeroProviderStartupFailure =
    linkedRecovery &&
    reservationEvents.length === 1 &&
    completedEvents.length === 1 &&
    reservationEvents[0].unit === completedEvents[0].job_id &&
    completedEvents[0].status === 'technical_failure' &&
    Number(completedEvents[0].child_reserved_attempts) === 0 &&
    Number(completedEvents[0].child_completed_attempts) === 0 &&
    Number(completedEvents[0].child_failed_attempts) === 0;
  if (
    launchEvents.length !== 1 ||
    launchEvents[0].study_id !== loaded.design.studyId ||
    launchEvents[0].source_commit !== sourcePlan.source?.commit ||
    launchEvents[0].design_path !== loaded.relativePath ||
    launchEvents[0].spend_cap !== preflight.plan.model_attempt_ceiling ||
    seal?.type !== 'run_sealed' ||
    !['technical_failure', 'paused_recoverable'].includes(seal?.status)
  ) {
    throw new Error('action-outcome recovery requires one sealed technical predecessor or recoverable pause');
  }
  const reservedJobIds = reservationEvents.map((event) => event.unit);
  const reservedInSourceRun = reservationEvents.reduce((sum, event) => sum + Number(event.count || 0), 0);
  const plannedById = new Map(sourceFullPlan.jobs.map((job) => [job.id, job]));
  if (
    reservationEvents.length < 1 ||
    new Set(reservedJobIds).size !== reservedJobIds.length ||
    reservationEvents.some(
      (event) =>
        !plannedById.has(event.unit) ||
        Number(event.count) !== loaded.design.attemptCeiling.maximumReservationsPerDialogue,
    ) ||
    reservedInSourceRun !== Number(seal.reserved_attempts)
  ) {
    throw new Error('action-outcome recovery reservation accounting drift');
  }

  const checkpointPath = path.join(sourceRoot, 'checkpoint.json');
  const checkpointRows = fs.existsSync(checkpointPath)
    ? readJson(checkpointPath, 'action-outcome predecessor checkpoint').rows || []
    : [];
  let priorReservedAttempts = reservedInSourceRun;
  let priorCompletedUnits;
  let failedJobIds;
  let priorRows;
  let validatedReportBackedFailure = false;
  let validatedRecoverablePause = false;
  if (pausedPredecessor) {
    const sourceReportPath = path.join(sourceRoot, 'report.json');
    const sourceReport = readJson(sourceReportPath, 'paused action-outcome predecessor report');
    const reportRows = Array.isArray(sourceReport.rows) ? sourceReport.rows : [];
    const inheritedRecovery = linkedRecovery
      ? loadTutorStubActionOutcomeCollectionRecovery({
          loaded,
          preflight: { plan: sourceFullPlan },
          recoveryFrom: path.resolve(sourcePlan.recovery.source_root || ''),
        })
      : null;
    const inheritedRows = inheritedRecovery?.priorRows || [];
    const linkedPlanDrift =
      linkedRecovery &&
      (sourcePlan.recovery.prior_reserved_attempts !== inheritedRecovery.prior_reserved_attempts ||
        sourcePlan.recovery.prior_completed_units !== inheritedRecovery.prior_completed_units ||
        JSON.stringify(sourcePlan.recovery.failed_job_ids) !== JSON.stringify(inheritedRecovery.failed_job_ids) ||
        JSON.stringify(sourcePlan.execution_job_ids) !==
          JSON.stringify(inheritedRecovery.executionJobs.map((job) => job.id)) ||
        JSON.stringify(reportRows.slice(0, inheritedRows.length)) !== JSON.stringify(inheritedRows));
    const currentRows = reportRows.slice(inheritedRows.length);
    if (
      linkedPlanDrift ||
      seal.recovery_permitted !== true ||
      sourceReport.schema !== 'machinespirits.tutor-stub.action-outcome-collection-generation-report.v1' ||
      sourceReport.study_id !== loaded.design.studyId ||
      sourceReport.status !== 'paused_recoverable' ||
      !String(sourceReport.halt_reason || '').startsWith('operator-requested pause') ||
      sourceReport.source?.commit !== sourcePlan.source?.commit ||
      sourceReport.execution?.model_attempts?.reserved_in_current_run !== reservedInSourceRun ||
      sourceReport.execution?.model_attempts?.hard_ceiling !== preflight.plan.model_attempt_ceiling ||
      !Number.isInteger(sourceReport.execution?.model_attempts?.reserved_by_shared_study_ledger) ||
      JSON.stringify(checkpointRows) !== JSON.stringify(reportRows) ||
      currentRows.length !== completedEvents.length ||
      currentRows.length !== reservationEvents.length ||
      JSON.stringify(reservedJobIds) !== JSON.stringify(completedEvents.map((event) => event.job_id)) ||
      currentRows.some(
        (row, index) =>
          row.job_id !== completedEvents[index].job_id ||
          row.status !== completedEvents[index].status ||
          Number(row.model_attempts?.reserved) !== Number(completedEvents[index].child_reserved_attempts) ||
          Number(row.model_attempts?.completed) !== Number(completedEvents[index].child_completed_attempts) ||
          Number(row.model_attempts?.failed) !== Number(completedEvents[index].child_failed_attempts) ||
          Number(row.model_attempts?.unexplained || 0) !== 0,
      )
    ) {
      throw new Error('recoverable action-outcome pause predecessor drift');
    }
    priorReservedAttempts = sourceReport.execution.model_attempts.reserved_by_shared_study_ledger;
    priorRows = reportRows.map((row) => ({ ...row, artifact_root: row.artifact_root || sourceRoot }));
    priorCompletedUnits = priorRows.filter((row) => row.status === 'complete').length;
    failedJobIds = priorRows.filter((row) => row.status === 'technical_failure').map((row) => row.job_id);
    validatedRecoverablePause = true;
  } else if (!linkedRecovery) {
    const completeJobIds = new Set(
      completedEvents.filter((event) => event.status === 'complete').map((event) => event.job_id),
    );
    if (
      checkpointRows.some((row) => row.status !== 'complete' || !completeJobIds.has(row.job_id)) ||
      completeJobIds.size !== checkpointRows.length
    ) {
      throw new Error('action-outcome recovery completed-unit checkpoint drift');
    }
    failedJobIds = reservedJobIds.filter((jobId) => !completeJobIds.has(jobId));
    if (failedJobIds.length !== 1) {
      throw new Error('interrupted action-outcome recovery requires exactly one failed active unit');
    }
    const failedJob = plannedById.get(failedJobIds[0]);
    const failedRow = extractTutorStubActionOutcomeCollectionRow({
      job: failedJob,
      exit: { code: null, signal: 'SIGINT', spawn_error: null },
      destination: sourceRoot,
    });
    if (failedRow.status !== 'technical_failure') {
      throw new Error('interrupted action-outcome unit does not reconstruct as a technical failure');
    }
    priorRows = [
      ...checkpointRows.map((row) => ({ ...row, artifact_root: sourceRoot })),
      { ...failedRow, artifact_root: sourceRoot, interruption_reason: seal.reason || null },
    ];
    priorCompletedUnits = checkpointRows.length;
  } else {
    const inheritedRecovery = loadTutorStubActionOutcomeCollectionRecovery({
      loaded,
      preflight: { plan: sourceFullPlan },
      recoveryFrom: path.resolve(sourcePlan.recovery.source_root || ''),
    });
    const inheritedRows = inheritedRecovery.priorRows;
    const linkedPlanDrift =
      sourcePlan.recovery.prior_reserved_attempts !== inheritedRecovery.prior_reserved_attempts ||
      sourcePlan.recovery.prior_completed_units !== inheritedRecovery.prior_completed_units ||
      JSON.stringify(sourcePlan.recovery.failed_job_ids) !== JSON.stringify(inheritedRecovery.failed_job_ids) ||
      JSON.stringify(sourcePlan.execution_job_ids) !==
        JSON.stringify(inheritedRecovery.executionJobs.map((job) => job.id)) ||
      JSON.stringify(checkpointRows.slice(0, inheritedRows.length)) !== JSON.stringify(inheritedRows) ||
      new Set(checkpointRows.map((row) => row.job_id)).size !== checkpointRows.length ||
      checkpointRows.some(
        (row) => !plannedById.has(row.job_id) || !['complete', 'technical_failure'].includes(row.status),
      );
    const sourceReportPath = path.join(sourceRoot, 'report.json');
    if (fs.existsSync(sourceReportPath)) {
      const sourceReport = readJson(sourceReportPath, 'action-outcome predecessor report');
      const reportRows = Array.isArray(sourceReport.rows) ? sourceReport.rows : [];
      const currentRows = reportRows.slice(inheritedRows.length);
      const currentTechnicalFailures = currentRows.filter((row) => row.status === 'technical_failure');
      if (
        linkedPlanDrift ||
        sourceReport.schema !== 'machinespirits.tutor-stub.action-outcome-collection-generation-report.v1' ||
        sourceReport.study_id !== loaded.design.studyId ||
        sourceReport.status !== 'technical_failure' ||
        sourceReport.halt_reason !== `technical_failure in ${currentRows.at(-1)?.job_id}` ||
        sourceReport.source?.commit !== sourcePlan.source?.commit ||
        path.resolve(sourceReport.recovery?.source_root || '') !==
          path.resolve(sourcePlan.recovery.source_root || '') ||
        sourceReport.execution?.model_attempts?.reserved_in_current_run !== reservedInSourceRun ||
        sourceReport.execution?.model_attempts?.hard_ceiling !== preflight.plan.model_attempt_ceiling ||
        !Number.isInteger(sourceReport.execution?.model_attempts?.reserved_by_shared_study_ledger) ||
        sourceReport.execution.model_attempts.reserved_by_shared_study_ledger < reservedInSourceRun ||
        JSON.stringify(checkpointRows) !== JSON.stringify(reportRows) ||
        currentRows.length !== completedEvents.length ||
        currentRows.length !== reservationEvents.length ||
        currentTechnicalFailures.length !== 1 ||
        currentRows.at(-1)?.status !== 'technical_failure' ||
        JSON.stringify(reservedJobIds) !== JSON.stringify(completedEvents.map((event) => event.job_id)) ||
        currentRows.some(
          (row, index) =>
            row.job_id !== completedEvents[index].job_id ||
            row.status !== completedEvents[index].status ||
            Number(row.model_attempts?.reserved) !== Number(completedEvents[index].child_reserved_attempts) ||
            Number(row.model_attempts?.completed) !== Number(completedEvents[index].child_completed_attempts) ||
            Number(row.model_attempts?.failed) !== Number(completedEvents[index].child_failed_attempts),
        )
      ) {
        throw new Error('action-outcome linked recovery predecessor drift');
      }
      validatedReportBackedFailure = true;
      priorReservedAttempts = sourceReport.execution.model_attempts.reserved_by_shared_study_ledger;
      priorRows = reportRows.map((row) => ({ ...row, artifact_root: row.artifact_root || sourceRoot }));
    } else {
      const currentRows = checkpointRows.slice(inheritedRows.length);
      const completedJobIds = completedEvents.map((event) => event.job_id);
      const interruptedJobIds = reservedJobIds.filter((jobId) => !completedJobIds.includes(jobId));
      if (
        linkedPlanDrift ||
        (seal.recovery_permitted !== true && !zeroProviderStartupFailure) ||
        completedEvents.some((event) => event.status !== 'complete') ||
        currentRows.length !== completedEvents.length ||
        currentRows.some(
          (row, index) => row.job_id !== completedEvents[index].job_id || row.status !== completedEvents[index].status,
        ) ||
        reservationEvents.length !== completedEvents.length + 1 ||
        JSON.stringify(reservedJobIds.slice(0, -1)) !== JSON.stringify(completedJobIds) ||
        interruptedJobIds.length !== 1 ||
        interruptedJobIds[0] !== reservedJobIds.at(-1)
      ) {
        throw new Error('action-outcome linked interrupted recovery predecessor drift');
      }
      const failedJob = plannedById.get(interruptedJobIds[0]);
      const failedRow = extractTutorStubActionOutcomeCollectionRow({
        job: failedJob,
        exit: { code: null, signal: 'SIGINT', spawn_error: null },
        destination: sourceRoot,
      });
      if (failedRow.status !== 'technical_failure') {
        throw new Error('interrupted linked action-outcome unit does not reconstruct as a technical failure');
      }
      priorReservedAttempts = inheritedRecovery.prior_reserved_attempts + reservedInSourceRun;
      priorRows = [
        ...checkpointRows.map((row) => ({ ...row, artifact_root: row.artifact_root || sourceRoot })),
        { ...failedRow, artifact_root: sourceRoot, interruption_reason: seal.reason || null },
      ];
    }
    priorCompletedUnits = priorRows.filter((row) => row.status === 'complete').length;
    failedJobIds = priorRows.filter((row) => row.status === 'technical_failure').map((row) => row.job_id);
  }
  const dispositionedJobIds = new Set(priorRows.map((row) => row.job_id));
  const executionJobs = preflight.plan.jobs.filter((job) => !dispositionedJobIds.has(job.id));
  if (
    priorReservedAttempts + executionJobs.length * loaded.design.attemptCeiling.maximumReservationsPerDialogue !==
    preflight.plan.model_attempt_ceiling
  ) {
    throw new Error('action-outcome recovery jobs do not close to the remaining aggregate ceiling');
  }

  const studyLedgerPath = path.resolve(launchEvents[0].study_ledger || '');
  const firstSourceRoot = linkedRecovery ? path.resolve(sourcePlan.recovery.source_root) : sourceRoot;
  const expectedStudyLedgerPath = path.join(
    path.dirname(firstSourceRoot),
    '.paid-study-state',
    loaded.design.studyId,
    'study-ledger.jsonl',
  );
  const studyLedger = readJsonLines(studyLedgerPath, 'action-outcome study ledger');
  const studySeal = studyLedger.findLast(
    (event) => event.type === 'study_run_sealed' && path.resolve(event.destination || '') === path.resolve(sourceRoot),
  );
  const studyReservationEvents = studyLedger.filter(
    (event) => event.type === 'study_model_attempt_reserved' && path.resolve(event.destination || '') === sourceRoot,
  );
  if (
    studyLedgerPath !== expectedStudyLedgerPath ||
    JSON.stringify(studyReservationEvents.map((event) => [event.unit, Number(event.count)])) !==
      JSON.stringify(reservationEvents.map((event) => [event.unit, Number(event.count)])) ||
    studySeal?.type !== 'study_run_sealed' ||
    path.resolve(studySeal.destination || '') !== sourceRoot ||
    !['technical_failure', 'paused_recoverable'].includes(studySeal.status) ||
    (studySeal.recovery_permitted !== true &&
      !zeroProviderStartupFailure &&
      !validatedReportBackedFailure &&
      !validatedRecoverablePause) ||
    Number(studySeal.reserved_in_run) !== reservedInSourceRun ||
    Number(studySeal.study_reserved) !== priorReservedAttempts ||
    Number(studySeal.model_attempt_ceiling) !== preflight.plan.model_attempt_ceiling
  ) {
    throw new Error('action-outcome study ledger is not sealed at the predecessor');
  }
  return {
    source_root: sourceRoot,
    source_plan: sourcePlanPath,
    source_ledger: sourceLedgerPath,
    study_state_root: path.dirname(path.dirname(studyLedgerPath)),
    prior_reserved_attempts: priorReservedAttempts,
    prior_completed_units: priorCompletedUnits,
    failed_job_ids: failedJobIds,
    executionJobs,
    priorRows,
  };
}

function reportForRows({ loaded, preflight, admission, rows, halt }) {
  const plannedJobIds = preflight.plan.jobs.map((job) => job.id);
  const observedJobIds = new Set(rows.map((row) => row.job_id));
  const count = (status) => rows.filter((row) => row.status === status).length;
  const sums = (field) => rows.reduce((sum, row) => sum + Number(row.model_attempts[field] || 0), 0);
  const priorReservedAttempts = preflight.recovery?.prior_reserved_attempts || 0;
  const recoveredWithPriorFailure = !halt && preflight.recovery?.failed_job_ids?.length > 0;
  return {
    schema: 'machinespirits.tutor-stub.action-outcome-collection-generation-report.v1',
    study_id: loaded.design.studyId,
    status:
      halt?.status ||
      (recoveredWithPriorFailure ? 'generation_complete_with_technical_failure' : 'generation_complete'),
    halt_reason: halt?.reason || null,
    source: admission.source,
    design: { path: loaded.relativePath },
    authorization: admission.authorization,
    claim_boundary: loaded.design.claimBoundary,
    memory_controller_enabled: false,
    control: {
      state: halt?.status === 'paused_recoverable' ? 'paused' : halt ? 'stopped' : 'complete',
      recoverable: halt?.status === 'paused_recoverable',
      resume_scope: halt?.status === 'paused_recoverable' ? 'missing_work_only' : null,
    },
    recovery: preflight.recovery
      ? {
          source_root: preflight.recovery.source_root,
          source_plan: preflight.recovery.source_plan,
          source_ledger: preflight.recovery.source_ledger,
          prior_reserved_attempts: priorReservedAttempts,
          prior_completed_units: preflight.recovery.prior_completed_units,
          failed_job_ids: preflight.recovery.failed_job_ids,
          policy: 'preserve and skip every prior completed or failed unit; execute only never-attempted jobs',
        }
      : null,
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
        cancelled_before_dispatch: sums('cancelled_before_dispatch'),
        interrupted_after_dispatch: sums('interrupted_after_dispatch'),
        unexplained: sums('unexplained'),
        reserved_in_predecessor: priorReservedAttempts,
        reserved_in_current_run: admission.reserved,
        reserved_by_shared_study_ledger: admission.studyReserved ?? priorReservedAttempts + admission.reserved,
        hard_ceiling: preflight.plan.model_attempt_ceiling,
      },
    },
    rows,
    next_step:
      halt === null
        ? 'Freeze the complete source corpus, then prepare the registered two-coder packet without inspecting auxiliary outcomes.'
        : halt.status === 'paused_recoverable'
          ? 'The run is paused at a durable checkpoint. Resume only missing work under the unchanged design and hard ceiling.'
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
  signalTarget = process,
  createPauseController = createDurablePauseStateMachine,
} = {}) {
  const { destination } = preflight;
  const perDialogueCeiling = loaded.design.attemptCeiling.maximumReservationsPerDialogue;
  const executionJobs = preflight.executionJobs || preflight.plan.jobs;
  const priorReservedAttempts = preflight.recovery?.prior_reserved_attempts || 0;
  if (priorReservedAttempts + perDialogueCeiling * executionJobs.length !== preflight.plan.model_attempt_ceiling) {
    throw new Error('current and predecessor reservations do not close to the registered study ceiling');
  }
  fs.mkdirSync(path.join(destination, 'jobs'), { recursive: false });
  writeOnce(path.join(destination, 'plan.json'), {
    status: 'admitted_under_shared_paid_study_launch_contract',
    source: admission.source,
    design: { path: loaded.relativePath },
    authorization: admission.authorization,
    model_attempt_ceiling: preflight.plan.model_attempt_ceiling,
    recovery: preflight.recovery
      ? {
          source_root: preflight.recovery.source_root,
          source_plan: preflight.recovery.source_plan,
          source_ledger: preflight.recovery.source_ledger,
          prior_reserved_attempts: priorReservedAttempts,
          prior_completed_units: preflight.recovery.prior_completed_units,
          failed_job_ids: preflight.recovery.failed_job_ids,
          policy: 'preserve and skip every prior completed or failed unit; execute only never-attempted jobs',
        }
      : null,
    execution_job_ids: executionJobs.map((job) => job.id),
    preflight,
  });

  const pauseController = createPauseController({
    statePath: path.join(destination, 'run-control.json'),
    record: (event) => admission.record(event),
    signalTarget,
  });

  const rows = [...(preflight.recovery?.priorRows || [])];
  let halt = null;
  try {
    for (const job of executionJobs) {
      if (halt) break;
      if (pauseController.snapshot().state === 'pause_requested') {
        pauseController.markPaused({ safe_boundary: 'before_reservation', next_job_id: job.id });
        halt = {
          status: 'paused_recoverable',
          reason: `operator-requested pause before reservation for ${job.id}`,
        };
        break;
      }
      const capacityDetail = {
        unit: job.id,
        world_id: job.world_id,
        reservation_scope: 'per_dialogue_fail_before_call_ceiling',
      };
      const capacity = admission.allocateModelAttemptCapacity
        ? admission.allocateModelAttemptCapacity(perDialogueCeiling, capacityDetail)
        : (admission.reserveModelAttempts(perDialogueCeiling, capacityDetail), null);
      const spec = childSpec({ loaded, job, destination, admission, capacity });
      admission.record({ type: 'unit_dispatched', job_id: job.id, world_id: job.world_id });
      const exit = await runChild(spec);
      const pauseRequested = pauseController.snapshot().state === 'pause_requested';
      const row = extractRow({
        loaded,
        job: spec,
        exit,
        destination,
        interruptionDisposition:
          pauseRequested && ['SIGINT', 'SIGTERM'].includes(exit.signal) ? 'interrupted_after_dispatch' : null,
      });
      const releasedCapacity = capacity
        ? admission.releaseModelAttemptCapacity(capacity, { unit: job.id, world_id: job.world_id })
        : null;
      rows.push(row);
      if (pauseRequested) {
        pauseController.markPaused({
          safe_boundary: 'after_child_exit_and_checkpoint',
          last_job_id: row.job_id,
          interrupted_after_dispatch: row.model_attempts.interrupted_after_dispatch,
        });
        halt = {
          status: 'paused_recoverable',
          reason: `operator-requested pause after ${row.job_id}`,
        };
      } else if (row.status !== 'complete') {
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
        child_cancelled_before_dispatch_attempts: row.model_attempts.cancelled_before_dispatch,
        child_interrupted_after_dispatch_attempts: row.model_attempts.interrupted_after_dispatch,
        child_unexplained_attempts: row.model_attempts.unexplained,
        ...(releasedCapacity
          ? {
              child_attempt_capacity_allocated: releasedCapacity.allocated,
              child_attempt_capacity_consumed: releasedCapacity.consumed,
              child_attempt_capacity_unused: releasedCapacity.unused,
            }
          : {}),
        shared_reserved_attempts: admission.reserved,
        ...(halt ? { halt_reason: halt.reason } : {}),
      });
      writeJsonAtomic(path.join(destination, 'checkpoint.json'), {
        study_id: loaded.design.studyId,
        status: halt?.status || 'generation_running',
        rows,
        missing_job_ids: preflight.plan.jobs
          .filter((candidate) => !rows.some((row) => row.job_id === candidate.id))
          .map((candidate) => candidate.id),
        shared_reserved_attempts: admission.reserved,
        hard_ceiling: preflight.plan.model_attempt_ceiling,
      });
      progress(
        `dispositioned ${rows.length}/${preflight.plan.jobs.length}; turns ${rows.reduce((sum, candidate) => sum + candidate.turns, 0)}/${preflight.plan.planned_turns}; child attempts ${rows.reduce((sum, candidate) => sum + candidate.model_attempts.reserved, 0)} reserved / ${rows.reduce((sum, candidate) => sum + candidate.model_attempts.completed, 0)} completed / ${rows.reduce((sum, candidate) => sum + candidate.model_attempts.failed, 0)} failed / ${rows.reduce((sum, candidate) => sum + Number(candidate.model_attempts.cancelled_before_dispatch || 0), 0)} cancelled before dispatch / ${rows.reduce((sum, candidate) => sum + Number(candidate.model_attempts.interrupted_after_dispatch || 0), 0)} interrupted after dispatch / ${rows.reduce((sum, candidate) => sum + Number(candidate.model_attempts.unexplained || 0), 0)} unexplained; study reserved ${admission.studyReserved ?? priorReservedAttempts + admission.reserved}/${preflight.plan.model_attempt_ceiling}${halt ? `; ${halt.status}: ${halt.reason}; recoverable ${halt.status === 'paused_recoverable'}; resume ${halt.status === 'paused_recoverable' ? 'missing work only' : 'not authorized by this status'}` : ''}`,
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
      ...(report.status === 'paused_recoverable' || (report.status === 'technical_failure' && !preflight.recovery)
        ? { recovery_permitted: true }
        : {}),
      recoverable: report.status === 'paused_recoverable' || undefined,
      resume_scope: report.status === 'paused_recoverable' ? 'missing_work_only' : undefined,
    });
    progress(`${report.status}: ${path.join(destination, 'report.json')}`);
    return report;
  } catch (error) {
    admission.record({ type: 'launcher_failed', error: error.message });
    admission.close({ type: 'run_sealed', status: 'failed', error: error.message });
    throw error;
  } finally {
    pauseController.dispose();
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
      destination: { type: 'string' },
      'recovery-from': { type: 'string' },
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
  const comparableDesign = values.design === TUTOR_STUB_ACTION_OUTCOME_COMPARABLE_COLLECTION_DESIGN_PATH;
  const loaded = comparableDesign
    ? loadTutorStubActionOutcomeComparableCollectionDesign({ root: ROOT, designPath: values.design })
    : loadTutorStubActionOutcomeCollectionDesign({ root: ROOT, designPath: values.design });
  if (values['recovery-from'] && !values.destination) {
    throw new Error('action-outcome recovery requires --destination');
  }
  const selectedPreflight = comparableDesign
    ? (input) =>
        runTutorStubActionOutcomeComparableCollectionPreflight({
          ...input,
          buildPlan: buildTutorStubActionOutcomeCollectionPlan,
        })
    : runTutorStubActionOutcomeCollectionPreflight;
  let preflight = await (overrides.runPreflight || selectedPreflight)({
    loaded,
    ...(values.destination ? { destination: path.resolve(values.destination) } : {}),
    recovery: Boolean(values['recovery-from']),
    ...(overrides.destinationExists ? { destinationExists: overrides.destinationExists } : {}),
    ...(overrides.resolveArchive ? { resolveArchive: overrides.resolveArchive } : {}),
    ...(overrides.probeRoute ? { probeRoute: overrides.probeRoute } : {}),
    ...(overrides.smokeRole ? { smokeRole: overrides.smokeRole } : {}),
  });
  if (preflight.status !== 'passed_zero_call') {
    const failedChecks = Object.entries(preflight.checks || {})
      .filter(([, passed]) => !passed)
      .map(([name]) => name);
    throw new Error(
      `action-outcome collection zero-call preflight failed${failedChecks.length ? `: ${failedChecks.join(', ')}` : ''}`,
    );
  }
  if (values['recovery-from']) {
    const recovery = (overrides.loadRecovery || loadTutorStubActionOutcomeCollectionRecovery)({
      loaded,
      preflight,
      recoveryFrom: path.resolve(values['recovery-from']),
    });
    preflight = { ...preflight, recovery, executionJobs: recovery.executionJobs };
  }
  const printablePreflight = preflight.recovery
    ? {
        ...preflight,
        recovery: {
          source_root: preflight.recovery.source_root,
          source_plan: preflight.recovery.source_plan,
          source_ledger: preflight.recovery.source_ledger,
          prior_reserved_attempts: preflight.recovery.prior_reserved_attempts,
          prior_completed_units: preflight.recovery.prior_completed_units,
          failed_job_ids: preflight.recovery.failed_job_ids,
          recovery_units: preflight.recovery.executionJobs.length,
          remaining_study_reservations:
            preflight.recovery.executionJobs.length * loaded.design.attemptCeiling.maximumReservationsPerDialogue,
        },
        executionJobs: preflight.executionJobs.map((job) => job.id),
      }
    : preflight;
  process.stdout.write(`${JSON.stringify(printablePreflight, null, 2)}\n`);
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
    studyStateRoot:
      preflight.recovery?.study_state_root || path.join(path.dirname(preflight.destination), '.paid-study-state'),
    ...(preflight.recovery ? { recoveryFrom: preflight.recovery.source_root } : {}),
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
