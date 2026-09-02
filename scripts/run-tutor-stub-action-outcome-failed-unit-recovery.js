#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { admitPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';
import {
  buildDurableEvaluationStatus,
  reconcileSharedModelAttemptLedger,
} from '../services/durableAttemptJournal.js';
import {
  extractTutorStubActionOutcomeCollectionRow,
  runTutorStubActionOutcomeCollectionChild,
  tutorStubActionOutcomeCollectionChildSpec,
} from './run-tutor-stub-action-outcome-collection-pilot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ACTION_OUTCOME_FAILED_UNIT_RECOVERY_DESIGN =
  'config/tutor-stub-action-outcome-failed-unit-recovery.v1.json';

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJson(filePath, label = filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function readJsonLines(filePath, label = filePath) {
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

function writeOnce(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, {
    flag: 'wx',
  });
}

function writeJsonAtomic(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filePath);
}

function writeRecoveryStatus({ loaded, preflight, admission, completedTurns, workflowState, scientificVerdict }) {
  const events = readJsonLines(admission.ledger_path, 'recovery run ledger');
  const status = buildDurableEvaluationStatus({
    events,
    plannedUnits: 3,
    plannedTurns: 12,
    completedTurns,
    hardCeiling: loaded.design.attemptCeiling.recoverySegmentHardCeiling,
    workflowState,
    scientificVerdict,
    secondsPerRemainingTurn: loaded.design.eta.secondsPerRemainingTurnRange,
    postRunSeconds: loaded.design.eta.zeroCallPostRunSecondsRange,
  });
  writeJsonAtomic(path.join(preflight.destination, 'status.json'), status);
  return status;
}

function optionValue(args, option) {
  const index = args.indexOf(option);
  if (index < 0 || index + 1 >= args.length) throw new Error(`source job is missing ${option}`);
  return args[index + 1];
}

function replaceOption(args, option, value) {
  const index = args.indexOf(option);
  if (index < 0 || index + 1 >= args.length) throw new Error(`source job is missing ${option}`);
  args[index + 1] = String(value);
}

function traceTurns(events) {
  return events.filter((event) => event?.type === 'turn_complete' && event.turnRecord);
}

function acceptedPendingLearnerEvent(events, completedTurns) {
  const turn = completedTurns + 1;
  const candidate = events.findLast(
    (event) => event?.type === 'auto_learner_turn' && Number(event.turn) === turn && event.text,
  );
  if (!candidate) return null;
  const analysis = events.findLast(
    (event) =>
      event?.type === 'model_call' &&
      event.role === 'tutor_stub_learner_analysis' &&
      Number(event.turn) === turn &&
      typeof event.response?.text === 'string',
  );
  const preflight = events.findLast(
    (event) => event?.type === 'learner_dag_preflight' && Number(event.turn) === turn,
  );
  return analysis && preflight ? candidate : null;
}

export function loadTutorStubActionOutcomeFailedUnitRecoveryDesign({
  root = ROOT,
  designPath = ACTION_OUTCOME_FAILED_UNIT_RECOVERY_DESIGN,
} = {}) {
  const relativePath = path.normalize(designPath).split(path.sep).join('/');
  if (path.isAbsolute(designPath) || relativePath.startsWith('../')) {
    throw new Error('failed-unit recovery design path must be repository-relative');
  }
  const absolutePath = path.resolve(root, relativePath);
  const design = readJson(absolutePath, 'failed-unit recovery design');
  return { root: path.resolve(root), relativePath, absolutePath, design };
}

export function preflightTutorStubActionOutcomeFailedUnitRecovery({ loaded, destination } = {}) {
  const { design } = loaded;
  const failures = [];
  const check = (condition, label) => {
    if (!condition) failures.push(label);
  };
  const reportPath = path.resolve(design.sourceArtifacts?.generationReport?.path || '');
  const planPath = path.resolve(design.sourceArtifacts?.launchPlan?.path || '');
  check(design.documentType === 'prospective_paid_study_technical_recovery', 'document_type');
  check(design.scientificDesign?.unchanged === true, 'scientific_design_unchanged');
  check(design.scientificDesign?.turnHorizon === 8, 'turn_horizon');
  check(design.scientificDesign?.model === 'codex.gpt-5.6-luna', 'model');
  check(design.scientificDesign?.cliEffort === 'low', 'effort');
  check(design.scientificDesign?.memoryControllerEnabled === false, 'memory_disabled');
  check(design.attemptCeiling?.historicalActualReservations === 2334, 'historical_reservations');
  check(design.attemptCeiling?.recoverySegmentHardCeiling === 100, 'segment_ceiling');
  check(design.attemptCeiling?.nominalAggregateEffectiveCeiling === 4960, 'aggregate_ceiling');
  check(Array.isArray(design.units) && design.units.length === 3, 'three_units');
  check(design.units?.reduce((sum, unit) => sum + Number(unit.capacity || 0), 0) === 100, 'capacity_sum');
  check(!fs.existsSync(destination), 'create_once_destination');
  check(fs.existsSync(reportPath), 'source_report_exists');
  check(fs.existsSync(planPath), 'source_plan_exists');
  if (fs.existsSync(reportPath)) {
    check(sha256File(reportPath) === design.sourceArtifacts.generationReport.sha256, 'source_report_hash');
  }
  if (fs.existsSync(planPath)) {
    check(sha256File(planPath) === design.sourceArtifacts.launchPlan.sha256, 'source_plan_hash');
  }
  const report = fs.existsSync(reportPath) ? readJson(reportPath, 'source generation report') : null;
  const sourcePlan = fs.existsSync(planPath) ? readJson(planPath, 'source launch plan') : null;
  const rows = report?.rows || [];
  const planJobs = sourcePlan?.preflight?.plan?.jobs || [];
  check(report?.study_id === design.sourceStudyId, 'source_study');
  check(report?.execution?.complete_units === 57, 'source_complete_units');
  check(report?.execution?.technical_failure_units === 3, 'source_failed_units');
  check(report?.execution?.completed_turns === 468, 'source_turns');
  check(report?.execution?.model_attempts?.reserved_by_children === 2334, 'source_child_reservations');
  check(report?.execution?.model_attempts?.completed === 2329, 'source_completed_attempts');
  check(report?.execution?.model_attempts?.failed === 3, 'source_failed_attempts');
  const expectedIds = design.units?.map((unit) => unit.jobId) || [];
  check(
    JSON.stringify(rows.filter((row) => row.status === 'technical_failure').map((row) => row.job_id)) ===
      JSON.stringify(expectedIds),
    'exact_failed_units',
  );
  const units = [];
  for (const unit of design.units || []) {
    const row = rows.find((candidate) => candidate.job_id === unit.jobId);
    const job = planJobs.find((candidate) => candidate.id === unit.jobId);
    const tracePath = path.resolve(unit.sourceTrace?.path || '');
    check(row?.status === 'technical_failure', `${unit.jobId}:source_status`);
    check(row?.turns === unit.completedTurns, `${unit.jobId}:source_turns`);
    check(Boolean(job), `${unit.jobId}:source_job`);
    check(fs.existsSync(tracePath), `${unit.jobId}:source_trace_exists`);
    if (!fs.existsSync(tracePath) || !job) continue;
    check(sha256File(tracePath) === unit.sourceTrace.sha256, `${unit.jobId}:source_trace_hash`);
    const events = readJsonLines(tracePath, `${unit.jobId} source trace`);
    const turns = traceTurns(events);
    const start = events.find((event) => event.type === 'run_start');
    check(turns.length === unit.completedTurns, `${unit.jobId}:durable_turn_count`);
    check(start?.metadata?.modelRef === 'codex.gpt-5.6-luna', `${unit.jobId}:tutor_route`);
    check(start?.metadata?.autoLearner?.modelRef === 'codex.gpt-5.6-luna', `${unit.jobId}:learner_route`);
    check(optionValue(job.args, '--auto-turns') === '8', `${unit.jobId}:fixed_horizon`);
    check(optionValue(job.args, '--eval-job-id') === unit.jobId, `${unit.jobId}:job_identity`);
    units.push({ ...unit, row, job, tracePath, events, acceptedPendingLearner: acceptedPendingLearnerEvent(events, turns.length) });
  }
  return {
    schema: 'machinespirits.tutor-stub.action-outcome-failed-unit-recovery-preflight.v1',
    status: failures.length ? 'failed_zero_call' : 'passed_zero_call',
    failures,
    modelCalls: 0,
    destination: path.resolve(destination),
    reportPath,
    planPath,
    report,
    sourcePlan,
    units,
    attempts: {
      historicalActualReservations: 2334,
      recoverySegmentReserved: 0,
      recoverySegmentHardCeiling: 100,
      nominalAggregateEffectiveCeiling: 4960,
    },
  };
}

export function buildTutorStubActionOutcomeContinuationJob({ unit, destination }) {
  const jobRoot = path.join(destination, 'jobs', unit.jobId);
  const traceDir = path.join(jobRoot, 'continuation-trace');
  const transcript = path.join(jobRoot, 'transcript.json');
  const args = [...unit.job.args];
  replaceOption(args, '--trace-dir', traceDir);
  replaceOption(args, '--save', transcript);
  if (args.includes('--resume')) throw new Error(`${unit.jobId} source job already contains --resume`);
  args.push('--resume', unit.tracePath);
  return {
    ...unit.job,
    job_root: jobRoot,
    trace_dir: traceDir,
    transcript,
    args,
    model_attempt_ceiling: unit.capacity,
    source_trace: unit.tracePath,
    source_completed_turns: unit.completedTurns,
    accepted_pending_learner: Boolean(unit.acceptedPendingLearner),
  };
}

export function composeTutorStubActionOutcomeRecoveryTrace({ sourceTrace, continuationTrace, outputPath }) {
  const sourceEvents = readJsonLines(sourceTrace, 'source recovery trace');
  const continuationEvents = readJsonLines(continuationTrace, 'continuation recovery trace');
  const sourceTurns = traceTurns(sourceEvents);
  const pending = acceptedPendingLearnerEvent(sourceEvents, sourceTurns.length);
  const sourceEnd = pending ? sourceEvents.indexOf(pending) : sourceEvents.length - 1;
  const sourceRunStart = sourceEvents.find((event) => event.type === 'run_start');
  const continuationRunStart = continuationEvents.find((event) => event.type === 'run_start');
  if (!sourceRunStart || !continuationRunStart) throw new Error('recovery lineage requires both run_start events');
  const runId = sourceRunStart.runId;
  const body = [
    ...sourceEvents.slice(1, sourceEnd + 1),
    ...continuationEvents.filter(
      (event) =>
        event.type !== 'run_start' &&
        !(pending && event.type === 'auto_learner_turn' && event.resumedFromAcceptedOutput === true),
    ),
  ];
  const rows = [
    {
      ...sourceRunStart,
      seq: 1,
      metadata: {
        ...(sourceRunStart.metadata || {}),
        recoveryLineage: {
          schema: 'machinespirits.tutor-stub.partial-dialogue-recovery-lineage.v1',
          sourceTrace: path.resolve(sourceTrace),
          continuationTrace: path.resolve(continuationTrace),
          sourceCompletedTurns: sourceTurns.length,
          acceptedPendingLearnerOutputReused: Boolean(pending),
          continuationRunId: continuationRunStart.runId,
        },
      },
    },
    ...body.map((event, index) => ({ ...event, runId, seq: index + 2 })),
  ];
  const turns = traceTurns(rows);
  const decisions = rows.filter((event) => event.type === 'tutor_typed_action_decision');
  const outcomes = rows.filter((event) => event.type === 'tutor_typed_action_outcome_closed');
  const runEnd = rows.findLast((event) => event.type === 'run_end');
  if (turns.length !== 8 || decisions.length !== 8 || outcomes.length !== 7 || runEnd?.turns !== 8) {
    throw new Error(
      `recovered lineage is incomplete: turns ${turns.length}/8, decisions ${decisions.length}/8, outcomes ${outcomes.length}/7`,
    );
  }
  writeOnce(outputPath, `${rows.map((event) => JSON.stringify(event)).join('\n')}\n`);
  return { outputPath, runId, turns: 8, decisions: 8, outcomes: 7, acceptedPendingLearnerOutputReused: Boolean(pending) };
}

function copyValidCorpus({ report, recoveredRows, destination }) {
  const corpus = path.join(destination, 'reconciled-corpus');
  fs.mkdirSync(corpus, { recursive: false });
  const replacements = new Map(recoveredRows.map((row) => [row.job_id, row]));
  const rows = report.rows.map((row) => replacements.get(row.job_id) || row);
  for (const row of rows) {
    if (row.status !== 'complete') throw new Error(`reconciled corpus retains incomplete unit ${row.job_id}`);
    const source = row.reconciled_trace || path.resolve(row.artifact_root, row.trace);
    fs.copyFileSync(source, path.join(corpus, `${row.job_id}.jsonl`), fs.constants.COPYFILE_EXCL);
  }
  return { corpus, rows };
}

export async function executeTutorStubActionOutcomeFailedUnitRecovery({
  loaded,
  preflight,
  admission,
  childSpec = tutorStubActionOutcomeCollectionChildSpec,
  runChild = runTutorStubActionOutcomeCollectionChild,
  progress = (line) => process.stdout.write(`${line}\n`),
} = {}) {
  const destination = preflight.destination;
  fs.mkdirSync(path.join(destination, 'jobs'), { recursive: false });
  writeOnce(path.join(destination, 'plan.json'), {
    schema: 'machinespirits.tutor-stub.action-outcome-failed-unit-recovery-plan.v1',
    design: loaded.relativePath,
    source: admission.source,
    authorization: admission.authorization,
    attempts: preflight.attempts,
    units: preflight.units.map((unit) => ({
      jobId: unit.jobId,
      completedTurns: unit.completedTurns,
      capacity: unit.capacity,
      sourceTrace: unit.tracePath,
      acceptedPendingLearnerOutput: Boolean(unit.acceptedPendingLearner),
    })),
  });
  const recoveredRows = [];
  let currentUnitId = null;
  writeRecoveryStatus({
    loaded,
    preflight,
    admission,
    completedTurns: 0,
    workflowState: 'running',
    scientificVerdict: 'registered_measurement_pending_human_review',
  });
  try {
    for (const unit of preflight.units) {
      currentUnitId = unit.jobId;
      const capacity = admission.allocateModelAttemptCapacity(unit.capacity, { unit: unit.jobId });
      const continuationJob = buildTutorStubActionOutcomeContinuationJob({ unit, destination });
      const spec = childSpec({ job: continuationJob, admission, capacity });
      admission.record({ type: 'partial_dialogue_continuation_dispatched', unit: unit.jobId });
      writeRecoveryStatus({
        loaded,
        preflight,
        admission,
        completedTurns: recoveredRows.reduce((sum, row) => sum + (row.turns - row.recovery.source_completed_turns), 0),
        workflowState: 'running',
        scientificVerdict: 'registered_measurement_pending_human_review',
      });
      const exit = await runChild(spec);
      reconcileSharedModelAttemptLedger({
        runLedgerPath: admission.ledger_path,
        studyLedgerPath: admission.study_ledger_path,
        capacityId: capacity.id,
        unitId: unit.jobId,
      });
      const continuationFiles = fs.existsSync(spec.trace_dir)
        ? fs.readdirSync(spec.trace_dir).filter((name) => name.endsWith('.jsonl'))
        : [];
      if (continuationFiles.length !== 1) throw new Error(`${unit.jobId} did not produce exactly one continuation trace`);
      const continuationTrace = path.join(spec.trace_dir, continuationFiles[0]);
      const lineageDir = path.join(spec.job_root, 'reconciled-trace');
      fs.mkdirSync(lineageDir, { recursive: false });
      const reconciledTrace = path.join(lineageDir, `${unit.jobId}.jsonl`);
      const lineage = composeTutorStubActionOutcomeRecoveryTrace({
        sourceTrace: unit.tracePath,
        continuationTrace,
        outputPath: reconciledTrace,
      });
      const row = extractTutorStubActionOutcomeCollectionRow({
        job: { ...spec, trace_dir: lineageDir, model_attempt_ceiling: 81 },
        exit,
        destination,
      });
      const released = admission.releaseModelAttemptCapacity(capacity, { unit: unit.jobId });
      if (row.status !== 'complete') throw new Error(`repeated technical failure in ${unit.jobId}: ${row.status}`);
      const recovered = {
        ...row,
        artifact_root: destination,
        reconciled_trace: reconciledTrace,
        recovery: {
          source_trace: unit.tracePath,
          continuation_trace: continuationTrace,
          accepted_pending_learner_output_reused: lineage.acceptedPendingLearnerOutputReused,
          new_attempts_reserved: released.consumed,
          unused_capacity_released: released.unused,
          source_completed_turns: unit.completedTurns,
        },
      };
      recoveredRows.push(recovered);
      currentUnitId = null;
      admission.record({
        type: 'partial_dialogue_continuation_completed',
        unit: unit.jobId,
        turns: row.turns,
        new_attempts_reserved: released.consumed,
        unused_capacity_released: released.unused,
      });
      writeRecoveryStatus({
        loaded,
        preflight,
        admission,
        completedTurns: recoveredRows.reduce((sum, candidate) =>
          sum + (candidate.turns - candidate.recovery.source_completed_turns), 0),
        workflowState: 'running',
        scientificVerdict: 'registered_measurement_pending_human_review',
      });
      progress(`recovered ${recoveredRows.length}/3 ${unit.jobId}; new attempts ${admission.reserved}/100`);
    }
    const { corpus, rows } = copyValidCorpus({ report: preflight.report, recoveredRows, destination });
    const newAttempts = admission.reserved;
    const segmentAttemptStatus = buildDurableEvaluationStatus({
      events: readJsonLines(admission.ledger_path, 'recovery run ledger'),
      plannedUnits: 3,
      plannedTurns: 12,
      completedTurns: 12,
      hardCeiling: loaded.design.attemptCeiling.recoverySegmentHardCeiling,
      workflowState: 'running',
      scientificVerdict: 'registered_measurement_pending_human_review',
      secondsPerRemainingTurn: loaded.design.eta.secondsPerRemainingTurnRange,
      postRunSeconds: loaded.design.eta.zeroCallPostRunSecondsRange,
    }).planes.attempt;
    const rowLineageReserved = rows.reduce((sum, row) => sum + Number(row.model_attempts?.reserved || 0), 0);
    const report = {
      schema: 'machinespirits.tutor-stub.action-outcome-reconciled-generation-report.v1',
      study_id: loaded.design.sourceStudyId,
      recovery_study_id: loaded.design.studyId,
      status: 'generation_complete_after_exact_partial_recovery',
      halt_reason: null,
      source_report: {
        path: preflight.reportPath,
        sha256: loaded.design.sourceArtifacts.generationReport.sha256,
        preserved: true,
      },
      source: admission.source,
      design: { path: loaded.design.scientificDesign.path },
      authorization: admission.authorization,
      scientific_design: loaded.design.scientificDesign,
      claim_boundary: loaded.design.claimBoundary,
      memory_controller_enabled: false,
      execution: {
        planned_units: 60,
        complete_units: 60,
        recovered_units: 3,
        technical_failure_units: 0,
        ceiling_failure_units: 0,
        unclassified_failure_units: 0,
        missing_units: 0,
        missing_job_ids: [],
        completed_turns: 480,
        planned_turns: 480,
        model_attempts: {
          reserved_by_children: loaded.design.attemptCeiling.historicalActualReservations + newAttempts,
          completed: loaded.design.attemptCeiling.historicalCompleted + segmentAttemptStatus.completed,
          failed: loaded.design.attemptCeiling.historicalFailed + segmentAttemptStatus.failed,
          cancelled_before_dispatch: segmentAttemptStatus.cancelled_before_dispatch,
          interrupted_after_dispatch:
            loaded.design.attemptCeiling.historicalOperatorInterruptedAfterDispatch +
            segmentAttemptStatus.interrupted_after_dispatch,
          unexplained: segmentAttemptStatus.unexplained,
          reserved_in_predecessor: loaded.design.attemptCeiling.historicalActualReservations,
          reserved_in_current_run: newAttempts,
          reserved_by_shared_study_ledger:
            loaded.design.attemptCeiling.historicalActualReservations + newAttempts,
          hard_ceiling: loaded.design.attemptCeiling.nominalAggregateEffectiveCeiling,
          historical_actual_reserved: loaded.design.attemptCeiling.historicalActualReservations,
          recovery_segment_reserved: newAttempts,
          actual_reserved_total: loaded.design.attemptCeiling.historicalActualReservations + newAttempts,
          recovery_segment_hard_ceiling: loaded.design.attemptCeiling.recoverySegmentHardCeiling,
          nominal_aggregate_effective_ceiling: loaded.design.attemptCeiling.nominalAggregateEffectiveCeiling,
          reconciled_trace_lineage_reserved: rowLineageReserved,
          preserved_non_lineage_interrupted_after_dispatch:
            loaded.design.attemptCeiling.historicalOperatorInterruptedAfterDispatch,
          unused_capacity_is_not_consumed: true,
        },
      },
      recovered_rows: recoveredRows,
      rows,
      reconciled_corpus: corpus,
      next_step: 'Run the unchanged zero-call extraction, quality audit, and fresh two-coder packet preparation.',
    };
    writeOnce(path.join(destination, 'reconciled-generation-report.json'), report);
    const originalInput = readJson(
      path.join(path.dirname(preflight.reportPath), '..', 'action-outcome-comparable-collection-v2-2026-09-02-readiness-input.json'),
      'original readiness input',
    );
    writeOnce(path.join(destination, 'readiness-input.json'), {
      ...originalInput,
      asOf: new Date().toISOString(),
      sources: [
        {
          path: corpus,
          role: 'memory',
          contextKey: originalInput.sources[0].contextKey,
        },
      ],
      recoveryProvenance: {
        design: loaded.relativePath,
        sourceReport: preflight.reportPath,
        exactRecoveredUnits: preflight.units.map((unit) => unit.jobId),
      },
    });
    admission.close({
      type: 'run_sealed',
      status: 'complete',
      complete_units: 3,
      failed_units: 0,
      reserved_attempts: newAttempts,
    });
    writeRecoveryStatus({
      loaded,
      preflight,
      admission,
      completedTurns: 12,
      workflowState: 'complete',
      scientificVerdict: 'registered_measurement_pending_human_review',
    });
    return report;
  } catch (error) {
    admission.record({ type: 'partial_dialogue_recovery_failed', unit: currentUnitId, error: error.message });
    writeRecoveryStatus({
      loaded,
      preflight,
      admission,
      completedTurns: recoveredRows.reduce((sum, candidate) =>
        sum + (candidate.turns - candidate.recovery.source_completed_turns), 0),
      workflowState: 'failed',
      scientificVerdict: 'registered_measurement_pending_human_review',
    });
    admission.close({ type: 'run_sealed', status: 'technical_failure', error: error.message });
    throw error;
  }
}

export async function main(argv = process.argv.slice(2), overrides = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      design: { type: 'string', default: ACTION_OUTCOME_FAILED_UNIT_RECOVERY_DESIGN },
      destination: { type: 'string' },
      'launch-commit': { type: 'string' },
      'go-note-commit': { type: 'string' },
      'go-note-path': { type: 'string' },
      'accept-charges': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    process.stdout.write('Usage: node scripts/run-tutor-stub-action-outcome-failed-unit-recovery.js --destination <fresh-dir> --dry-run | --launch-commit <sha> --go-note-commit <sha> --go-note-path <note> --accept-charges\n');
    return null;
  }
  const loaded = loadTutorStubActionOutcomeFailedUnitRecoveryDesign({ root: ROOT, designPath: values.design });
  const destination = path.resolve(values.destination || loaded.design.execution.freshDestination);
  const preflight = preflightTutorStubActionOutcomeFailedUnitRecovery({ loaded, destination });
  if (preflight.status !== 'passed_zero_call') {
    throw new Error(`failed-unit recovery preflight failed: ${preflight.failures.join(', ')}`);
  }
  if (values['dry-run']) {
    process.stdout.write(`${JSON.stringify({ ...preflight, report: undefined, sourcePlan: undefined, units: preflight.units.map((unit) => ({ jobId: unit.jobId, completedTurns: unit.completedTurns, acceptedPendingLearner: Boolean(unit.acceptedPendingLearner) })) }, null, 2)}\n`);
    return preflight;
  }
  if (!values['accept-charges']) throw new Error('paid recovery requires --accept-charges');
  const admission = (overrides.admit || admitPaidStudyLaunch)({
    root: ROOT,
    designPath: loaded.relativePath,
    launchCommit: values['launch-commit'],
    goNoteCommit: values['go-note-commit'],
    goNotePath: values['go-note-path'],
    spendCap: loaded.design.attemptCeiling.recoverySegmentHardCeiling,
    studyId: loaded.design.studyId,
    studyStateRoot: path.join(path.dirname(destination), '.paid-study-state'),
    destination,
  });
  return executeTutorStubActionOutcomeFailedUnitRecovery({ loaded, preflight, admission, ...overrides });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
