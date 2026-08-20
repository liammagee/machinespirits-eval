#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  loadTutorStubResistanceActionRegisterPrefixBundle,
  resolveTutorStubResistanceActionRegisterExecutionJob,
} from '../services/tutorStubResistanceActionRegisterExecution.js';
import { scoreTutorStubResistanceRecovery } from '../services/tutorStubResistanceActionRegisterStudy.js';
import { observeResistantLearnerTurn } from '../services/resistantLearnerObservation.js';
import {
  buildTutorStubResistanceActionRegisterBatchPlan,
  buildTutorStubResistanceActionRegisterRecoveryJob,
} from './run-tutor-stub-resistance-action-register-crossed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-resistance-action-register-crossed-registration.v2.json';
const PREFIX_BUNDLE = 'config/tutor-stub-resistance-action-register-v4-public-prefixes.v1.json';
const EXPECTED_DIALOGUES = 12;
const EXPECTED_BATCH_DIALOGUES = 6;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readTrace(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function sameIds(actual, expected) {
  return (
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index])
  );
}

function reservationCountInDirectory(directory) {
  if (!directory || !fs.existsSync(directory)) return 0;
  return traceFilesInDirectory(directory)
    .flatMap((name) => readTrace(path.join(directory, name)))
    .filter((event) => event.type === 'model_call_budget_reserved').length;
}

function traceFilesInDirectory(directory) {
  if (!directory || !fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((name) => name.endsWith('.jsonl'));
}

function exactTraceDirectory(resultRow, command, label) {
  if (!resultRow.trace || !command?.trace_dir) throw new Error(`${label} lacks its registered trace path`);
  const tracePath = path.resolve(ROOT, resultRow.trace);
  const traceDirectory = path.resolve(command.trace_dir);
  if (path.dirname(tracePath) !== traceDirectory)
    throw new Error(`${label} trace escaped its registered job directory`);
  const traceFiles = traceFilesInDirectory(traceDirectory);
  if (traceFiles.length !== 1 || path.resolve(traceDirectory, traceFiles[0]) !== tracePath) {
    throw new Error(`${label} must contain exactly its one selected trace; alternatives are forbidden`);
  }
  return traceDirectory;
}

function auditRecovery({ absolute, plan, initial, result, seal, planPath, initialResultPath, resultPath }) {
  const initialRows = Array.isArray(initial.results) ? initial.results : [];
  const initialById = new Map(initialRows.map((row) => [row.job_id, row]));
  const planIds = plan.jobs.map((job) => job.id);
  if (
    initial.status !== 'incomplete' ||
    initialRows.length > EXPECTED_BATCH_DIALOGUES ||
    initialById.size !== initialRows.length ||
    initialRows.some((row) => !planIds.includes(row.job_id) || !['complete', 'failed'].includes(row.status))
  ) {
    throw new Error(`batch ${plan.repeat} recovery does not preserve one valid incomplete initial result`);
  }
  const initialValidIds = initialRows.filter((row) => row.status === 'complete').map((row) => row.job_id);
  const missingOrFailedIds = planIds.filter((id) => initialById.get(id)?.status !== 'complete');
  const recoveryRoot = path.join(absolute, 'recoveries', 'recovery-001');
  const recoveryPlanPath = path.join(recoveryRoot, 'recovery-plan.json');
  const recoveryResultPath = path.join(recoveryRoot, 'recovery-result.json');
  if (!fs.existsSync(recoveryPlanPath) || !fs.existsSync(recoveryResultPath)) {
    throw new Error(`batch ${plan.repeat} recovery provenance is incomplete`);
  }
  const recoveryPlan = readJson(recoveryPlanPath);
  const recoveryResult = readJson(recoveryResultPath);
  const recoveryIds = recoveryPlan.jobs?.map((job) => job.id) || [];
  const recoveryResultIds = recoveryResult.results?.map((row) => row.job_id) || [];
  if (
    recoveryPlan.schema !== 'machinespirits.tutor-stub.resistance-action-register-live-batch-recovery-plan.v1' ||
    recoveryResult.schema !== 'machinespirits.tutor-stub.resistance-action-register-live-batch-recovery-result.v1' ||
    recoveryPlan.batch_id !== plan.batch_id ||
    recoveryResult.batch_id !== plan.batch_id ||
    recoveryPlan.repeat !== plan.repeat ||
    recoveryResult.repeat !== plan.repeat ||
    recoveryPlan.original_plan_sha256 !== sha256(fs.readFileSync(planPath)) ||
    recoveryPlan.original_result_sha256 !== sha256(fs.readFileSync(initialResultPath)) ||
    JSON.stringify(recoveryPlan.source) !== JSON.stringify(plan.source) ||
    recoveryPlan.hard_ceiling !== 234 ||
    !sameIds(recoveryPlan.valid_unit_ids_excluded || [], initialValidIds) ||
    !sameIds(recoveryIds, missingOrFailedIds) ||
    !sameIds(recoveryResultIds, missingOrFailedIds) ||
    recoveryResult.results.some((row) => row.status !== 'complete') ||
    seal.recovery_plan_sha256 !== sha256(fs.readFileSync(recoveryPlanPath)) ||
    seal.recovery_result_sha256 !== sha256(fs.readFileSync(recoveryResultPath)) ||
    result.technical_recovery_used !== true ||
    !sameIds(result.recovery_unit_ids || [], missingOrFailedIds)
  ) {
    throw new Error(`batch ${plan.repeat} recovery reran a valid unit or drifted from its bounded recovery contract`);
  }
  const recoveryJobs = new Map(recoveryPlan.jobs.map((job) => [job.id, job]));
  const recoveryRows = new Map(recoveryResult.results.map((row) => [row.job_id, row]));
  const finalRows = new Map(result.results.map((row) => [row.job_id, row]));
  const reservationsByJob = new Map();
  const finalTraceBudgetsByJob = new Map();
  const recoveryLoaded = loadTutorStubResistanceActionRegisterPrefixBundle({
    registrationPath: path.resolve(ROOT, plan.source.registration_path),
    bundlePath: path.resolve(ROOT, plan.source.prefix_bundle_path),
  });
  for (const job of plan.jobs) {
    const initialTraceFiles = traceFilesInDirectory(job.command?.trace_dir);
    if (initialTraceFiles.length > 1) {
      throw new Error(`batch ${plan.repeat} initial unit ${job.id} contains alternative traces`);
    }
    const initialReservations = reservationCountInDirectory(job.command?.trace_dir);
    const initialRow = initialById.get(job.id);
    const finalRow = finalRows.get(job.id);
    if (initialValidIds.includes(job.id)) {
      exactTraceDirectory(initialRow, job.command, `initial valid unit ${job.id}`);
      if (
        finalRow?.origin !== 'initial_valid_unit' ||
        finalRow.trace !== initialRow.trace ||
        finalRow.trace_sha256 !== initialRow.trace_sha256
      ) {
        throw new Error(`batch ${plan.repeat} rewrote an initially valid unit ${job.id}`);
      }
      reservationsByJob.set(job.id, initialReservations);
      finalTraceBudgetsByJob.set(job.id, 39);
      continue;
    }
    const recoveryJob = recoveryJobs.get(job.id);
    const recoveryRow = recoveryRows.get(job.id);
    const registeredJob = resolveTutorStubResistanceActionRegisterExecutionJob({
      loaded: recoveryLoaded,
      jobId: job.id,
    }).job;
    const expectedRecoveryJob = buildTutorStubResistanceActionRegisterRecoveryJob({
      loaded: recoveryLoaded,
      job: registeredJob,
      destination: recoveryRoot,
      priorModelAttemptReservations: initialReservations,
    });
    if (JSON.stringify(recoveryJob) !== JSON.stringify(expectedRecoveryJob)) {
      throw new Error(`batch ${plan.repeat} recovery command drifted for ${job.id}`);
    }
    exactTraceDirectory(recoveryRow, recoveryJob?.command, `recovered unit ${job.id}`);
    const recoveryReservations = reservationCountInDirectory(recoveryJob.command.trace_dir);
    if (
      recoveryJob.recovery?.prior_model_attempt_reservations !== initialReservations ||
      recoveryJob.recovery?.remaining_model_attempt_reservations !== 39 - initialReservations ||
      finalRow?.origin !== 'bounded_technical_recovery_missing_or_failed_unit' ||
      finalRow.trace !== recoveryRow.trace ||
      finalRow.trace_sha256 !== recoveryRow.trace_sha256
    ) {
      throw new Error(`batch ${plan.repeat} recovery budget or final-row provenance drifted for ${job.id}`);
    }
    reservationsByJob.set(job.id, initialReservations + recoveryReservations);
    finalTraceBudgetsByJob.set(job.id, recoveryJob.recovery.remaining_model_attempt_reservations);
  }
  const observedReservations = [...reservationsByJob.values()].reduce((sum, count) => sum + count, 0);
  if (
    [...reservationsByJob.values()].some((count) => count > 39) ||
    observedReservations > 234 ||
    result.observed_model_attempt_reservations !== observedReservations ||
    seal.observed_model_attempt_reservations !== observedReservations ||
    seal.result_sha256 !== sha256(fs.readFileSync(resultPath))
  ) {
    throw new Error(`batch ${plan.repeat} recovery exceeded or misreported its unchanged reservation ceiling`);
  }
  return { recoveredIds: new Set(missingOrFailedIds), reservationsByJob, finalTraceBudgetsByJob };
}

function parseArgs(argv) {
  const options = { registration: REGISTRATION, 'prefix-bundle': PREFIX_BUNDLE, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (['--json', '--help'].includes(arg)) {
      options[arg.slice(2)] = true;
      continue;
    }
    if (
      ['--batch-a', '--batch-b', '--registration', '--prefix-bundle', '--out', '--expected-source-commit'].includes(arg)
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

function exactBatch(root, expectedRepeat, expectedSourceCommit) {
  const absolute = path.resolve(ROOT, root);
  const planPath = path.join(absolute, 'batch-plan.json');
  const initialResultPath = path.join(absolute, 'batch-result.json');
  const finalResultPath = path.join(absolute, 'batch-final-result.json');
  const resultPath = fs.existsSync(finalResultPath) ? finalResultPath : initialResultPath;
  const sealPath = path.join(absolute, 'batch-seal.json');
  for (const required of [planPath, initialResultPath, sealPath]) {
    if (!fs.existsSync(required)) throw new Error(`combined analysis refuses partial batch: missing ${required}`);
  }
  const plan = readJson(planPath);
  const registeredPlan = buildTutorStubResistanceActionRegisterBatchPlan({
    repeat: expectedRepeat,
    destination: absolute,
    expectedSourceCommit,
  });
  const initial = readJson(initialResultPath);
  const result = readJson(resultPath);
  const seal = readJson(sealPath);
  if (
    plan.repeat !== expectedRepeat ||
    plan.batch_id !== `batch_${expectedRepeat}` ||
    result.repeat !== expectedRepeat ||
    result.batch_id !== plan.batch_id ||
    seal.repeat !== expectedRepeat ||
    seal.batch_id !== plan.batch_id ||
    result.status !== 'complete' ||
    seal.status !== 'sealed_complete' ||
    plan.jobs?.length !== EXPECTED_BATCH_DIALOGUES ||
    result.results?.length !== EXPECTED_BATCH_DIALOGUES ||
    result.results.some((row) => row.status !== 'complete') ||
    seal.plan_sha256 !== sha256(fs.readFileSync(planPath)) ||
    seal.result_sha256 !== sha256(fs.readFileSync(resultPath)) ||
    seal.hard_ceiling !== 234 ||
    plan.budget?.maximum_model_attempt_reservations !== 234 ||
    plan.budget?.maximum_model_attempt_reservations_per_dialogue !== 39 ||
    seal.valid_unit_reruns !== false ||
    seal.outcome_selection !== false ||
    path.resolve(ROOT, plan.destination) !== absolute
  ) {
    throw new Error(`batch ${expectedRepeat} is incomplete, unsealed, over budget, or selection-contaminated`);
  }
  if (JSON.stringify(plan) !== JSON.stringify(registeredPlan)) {
    throw new Error(`batch ${expectedRepeat} plan or command drifted from the registered live execution plan`);
  }
  if (expectedSourceCommit && plan.source?.commit !== expectedSourceCommit) {
    throw new Error(`batch ${expectedRepeat} source commit does not match the GO request`);
  }
  const planJobs = new Map(plan.jobs.map((job) => [job.id, job]));
  if (planJobs.size !== EXPECTED_BATCH_DIALOGUES || new Set(result.results.map((row) => row.job_id)).size !== 6) {
    throw new Error(`batch ${expectedRepeat} contains duplicate or missing units`);
  }
  let recoveredIds = new Set();
  let reservationsByJob;
  let finalTraceBudgetsByJob;
  if (resultPath === finalResultPath) {
    ({ recoveredIds, reservationsByJob, finalTraceBudgetsByJob } = auditRecovery({
      absolute,
      plan,
      initial,
      result,
      seal,
      planPath,
      initialResultPath,
      resultPath,
    }));
  } else if (fs.existsSync(path.join(absolute, 'recoveries'))) {
    throw new Error(`batch ${expectedRepeat} contains unsealed or unused recovery output`);
  } else {
    reservationsByJob = new Map(
      plan.jobs.map((job) => [
        job.id,
        reservationCountInDirectory(
          exactTraceDirectory(
            result.results.find((row) => row.job_id === job.id),
            job.command,
            `unit ${job.id}`,
          ),
        ),
      ]),
    );
    finalTraceBudgetsByJob = new Map(plan.jobs.map((job) => [job.id, 39]));
  }
  if ([...reservationsByJob.values()].some((count) => count > 39)) {
    throw new Error(`batch ${expectedRepeat} contains a dialogue above its 39-reservation ceiling`);
  }
  return { absolute, plan, result, seal, planJobs, recoveredIds, reservationsByJob, finalTraceBudgetsByJob };
}

function metric(model, field) {
  const value = model?.metrics?.[field] ?? model?.assessment?.[field];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function assertObservedRuntime({ runStart, events, job, batch, finalTraceBudget }) {
  const metadata = runStart?.metadata;
  const recipe = metadata?.sessionRecipe;
  const config = recipe?.config;
  const options = config?.options;
  const models = config?.identity?.models;
  const requiredModels = ['classifier', 'learner', 'reasoning', 'tutor'];
  const routePinned = requiredModels.every(
    (role) => models?.[role]?.provider === 'codex' && models?.[role]?.model === 'gpt-5.6-luna',
  );
  const observedModelCalls = events.filter((event) => event.type === 'model_call');
  const observedModelAttemptEvents = events.filter((event) =>
    ['model_call', 'model_call_error', 'model_call_aborted'].includes(event.type),
  );
  const failedModelAttemptEvents = observedModelAttemptEvents.filter((event) => event.type !== 'model_call');
  const requiredRoleTurns = [
    ['tutor_stub_tutor', 1],
    ['tutor_stub_tutor', 2],
    ['tutor_stub_auto_learner', 2],
    ['tutor_stub_auto_learner', 3],
    ['tutor_stub_learner_analysis', 2],
    ['tutor_stub_learner_analysis', 3],
  ];
  const observedRequiredCalls = requiredRoleTurns.every(([role, turn]) =>
    observedModelCalls.some((event) => event.role === role && Number(event.turn) === turn),
  );
  const allObservedCallsPinned = observedModelAttemptEvents.every(
    (event) => event.provider === 'codex' && event.model === 'gpt-5.6-luna',
  );
  const successfulEffortPinned = observedModelCalls.every((event) => event.response?.effort === 'low');
  const failedEffortPinned = failedModelAttemptEvents.every(
    (event) => event.request?.cliEffort === 'low' || event.request?.config?.cliEffort === 'low',
  );
  const allowedTutorRoles = new Set([
    'tutor_stub_tutor',
    'tutor_stub_tutor_actorial_part_repair',
    'tutor_stub_tutor_clue_insertion',
    'tutor_stub_tutor_composition_repair',
    'tutor_stub_tutor_fallback',
    'tutor_stub_tutor_plain_recovery',
    'tutor_stub_tutor_question_support_repair',
    'tutor_stub_tutor_recovery',
    'tutor_stub_tutor_self_correction',
    'tutor_stub_tutor_source_voice_repair',
  ]);
  const allowedObservedAttempt = (event) => {
    const turn = Number(event.turn);
    if (event.role === 'tutor_stub_auto_learner') return turn === 2 || turn === 3;
    if (event.role === 'tutor_stub_learner_analysis') return turn === 2 || turn === 3;
    return allowedTutorRoles.has(event.role) && (turn === 1 || turn === 2);
  };
  const observedAttemptEnvelopePinned = observedModelAttemptEvents.every(allowedObservedAttempt);
  if (
    recipe?.schema !== 'machinespirits.tutor-stub.session-recipe.v1' ||
    metadata?.provenance?.git?.sha !== batch.plan.source.commit ||
    metadata?.provenance?.git?.dirty !== false ||
    config?.identity?.world?.id !== 'world_005_marrick' ||
    metadata?.experiment?.runSeed !== 20260820 ||
    metadata?.experiment?.profile !== 'frame_refuser' ||
    metadata?.experiment?.policy !== 'field' ||
    metadata?.experiment?.repeat !== (job.treatment.repeat === 'A' ? 1 : 2) ||
    metadata?.experiment?.jobId !== job.id ||
    metadata?.autoLearner?.observationSemantics !== 'prospective_v4' ||
    metadata?.autoLearner?.maxTurns !== 3 ||
    metadata?.autoLearner?.profileId !== 'frame_refuser' ||
    metadata?.autoLearner?.modelRef !== 'codex.gpt-5.6-luna' ||
    metadata?.lab?.admission?.modelCallBudget !== finalTraceBudget ||
    options?.['cli-effort'] !== 'low' ||
    options?.['run-seed'] !== '20260820' ||
    options?.['auto-turns'] !== '3' ||
    options?.['model-call-budget'] !== String(finalTraceBudget) ||
    options?.['dag-mode'] !== 'strict_dag' ||
    options?.['register-policy'] !== 'field' ||
    options?.['register-palette'] !== 'plain,warm' ||
    options?.['eval-repeat'] !== (job.treatment.repeat === 'A' ? '1' : '2') ||
    options?.['eval-job-id'] !== job.id ||
    options?.['resistance-action-register-job'] !== job.id ||
    options?.['resistance-action-register-registration'] !== REGISTRATION ||
    options?.['resistance-action-register-prefix-bundle'] !== PREFIX_BUNDLE ||
    options?.['no-opening'] !== true ||
    options?.['no-auto-stop-on-grounded'] !== true ||
    routePinned !== true ||
    observedRequiredCalls !== true ||
    allObservedCallsPinned !== true ||
    successfulEffortPinned !== true ||
    failedEffortPinned !== true ||
    observedAttemptEnvelopePinned !== true
  ) {
    throw new Error(`trace ${job.id} violates its observed Luna route, runtime, horizon, or semantics pins`);
  }
  return {
    successfulModelCalls: observedModelCalls.length,
    modelAttemptEvents: observedModelAttemptEvents.length,
  };
}

function analyzeTrace({ batch, resultRow, loaded }) {
  const job = batch.planJobs.get(resultRow.job_id);
  if (!job) throw new Error(`result ${resultRow.job_id} is not in its frozen batch plan`);
  const registeredJob = resolveTutorStubResistanceActionRegisterExecutionJob({ loaded, jobId: job.id }).job;
  const { command: _command, ...registeredJobWithoutCommand } = job;
  if (JSON.stringify(registeredJobWithoutCommand) !== JSON.stringify(registeredJob)) {
    throw new Error(`batch plan job ${job.id} drifted from the frozen registration and prefix bundle`);
  }
  const tracePath = path.resolve(ROOT, resultRow.trace);
  const source = fs.readFileSync(tracePath);
  if (sha256(source) !== resultRow.trace_sha256) throw new Error(`trace digest drift for ${job.id}`);
  const events = readTrace(tracePath);
  const runStart = events.find((event) => event.type === 'run_start');
  const start = events.find((event) => event.type === 'resistance_action_register_execution_start');
  const interventions = events.filter((event) => event.type === 'resistance_action_register_intervention_applied');
  const completed = events.filter((event) => event.type === 'turn_complete' && event.turnRecord);
  const outcome = events.filter((event) => event.type === 'resistance_action_register_outcome_learner_turn');
  const reservations = events.filter((event) => event.type === 'model_call_budget_reserved');
  const totalReservations = batch.reservationsByJob.get(job.id);
  const finalTraceBudget = batch.finalTraceBudgetsByJob.get(job.id);
  const prefix = loaded.bundle.prefixes.find((candidate) => candidate.id === job.prefix_id);
  const trigger = completed.find((event) => Number(event.turn) === 1)?.turnRecord;
  const postOne = completed.find((event) => Number(event.turn) === 2)?.turnRecord;
  const postTwo = outcome[0];
  if (
    !runStart ||
    !start ||
    interventions.length !== 1 ||
    completed.length !== 2 ||
    outcome.length !== 1 ||
    Number(postTwo.turn) !== 3 ||
    postTwo.tutorReplyGenerated !== false ||
    reservations.length > 39 ||
    totalReservations > 39 ||
    trigger?.learner !== prefix?.trigger_learner_text ||
    start.prefixId !== prefix.id ||
    start.publicPrefixSha256 !== prefix.public_prefix_sha256 ||
    start.prefixBundleSha256 !== loaded.sha256 ||
    start.registrationSha256 !== loaded.registration.sha256 ||
    start.jobId !== job.id ||
    start.batchId !== job.treatment.batch_id
  ) {
    throw new Error(`trace ${job.id} violates exact-prefix, horizon, provenance, or budget constraints`);
  }
  const observedRuntime = assertObservedRuntime({ runStart, events, job, batch, finalTraceBudget });
  const countByRoleTurn = (rows) =>
    rows.reduce((counts, event) => {
      const key = `${String(event.role)}:${Number(event.turn)}`;
      counts.set(key, (counts.get(key) || 0) + 1);
      return counts;
    }, new Map());
  const reservationEnvelope = countByRoleTurn(reservations);
  const attemptEnvelope = countByRoleTurn(
    events.filter((event) => ['model_call', 'model_call_error', 'model_call_aborted'].includes(event.type)),
  );
  if (
    observedRuntime.modelAttemptEvents !== reservations.length ||
    reservationEnvelope.size !== attemptEnvelope.size ||
    [...reservationEnvelope].some(([key, count]) => attemptEnvelope.get(key) !== count)
  ) {
    throw new Error(`trace ${job.id} model-attempt reservations do not match its observed attempt envelope`);
  }
  const assignment = interventions[0].intervention?.assignment;
  const interventionStatus = interventions[0].intervention?.status;
  const safetyOverride = interventions[0].intervention?.safety_override || null;
  const protectedCondition = [
    'comprehension_repair',
    'protected_affect',
    'content_bearing_uptake_already_visible',
  ].includes(safetyOverride?.reason);
  const appliedAdherent =
    interventionStatus === 'applied' && safetyOverride?.applied === false && safetyOverride?.reason == null;
  const safetyOverrideNonadherent =
    interventionStatus === 'safety_override_nonadherent' &&
    safetyOverride?.applied === true &&
    protectedCondition &&
    safetyOverride?.assigned_register === assignment?.register &&
    safetyOverride?.delivered_register === 'plain';
  if (
    (!appliedAdherent && !safetyOverrideNonadherent) ||
    assignment?.action_fit !== 'matched' ||
    assignment?.pedagogical_move !== 'test_bounded_distinction' ||
    assignment?.realization !== job.treatment.realization ||
    assignment?.register !== job.treatment.register ||
    assignment?.repeat !== job.treatment.repeat ||
    assignment?.batch_id !== job.treatment.batch_id ||
    interventions[0].turn !== 1
  ) {
    throw new Error(`trace ${job.id} did not deliver its prebound one-turn action/register treatment`);
  }
  const responseAudit = trigger.responseConfigurationAudit;
  const actionVisible = responseAudit?.axes?.action_family?.visible;
  const deliveredRegisterVisible = responseAudit?.axes?.engagement_stance?.visible;
  const registerVisible = safetyOverrideNonadherent ? false : deliveredRegisterVisible;
  const expectedDeliveredRegister =
    safetyOverride?.applied === true ? safetyOverride.delivered_register : assignment.register;
  if (
    typeof actionVisible !== 'boolean' ||
    typeof deliveredRegisterVisible !== 'boolean' ||
    typeof safetyOverride?.applied !== 'boolean' ||
    responseAudit?.axes?.action_family?.selected !== job.treatment.host_action_family ||
    responseAudit?.axes?.engagement_stance?.selected !== expectedDeliveredRegister
  ) {
    throw new Error(`trace ${job.id} lacks typed action/register visibility evidence on its treatment turn`);
  }
  if (protectedCondition !== safetyOverrideNonadherent) {
    throw new Error(`trace ${job.id} has inconsistent protected-condition and safety-override provenance`);
  }
  const observation = observeResistantLearnerTurn({
    learnerText: trigger.learner,
    classification: trigger.classification,
    semantics: 'prospective_v4',
  });
  if (
    observation.ambiguous !== false ||
    !observation.observations?.some((row) => row.type === 'frame_jurisdiction_refusal')
  ) {
    throw new Error(`trace ${job.id} no longer begins at its registered public frame-refusal trigger`);
  }
  const postLearnerTurns = [
    { learnerText: postOne.learner, classification: postOne.classification },
    { learnerText: postTwo.learnerText, classification: postTwo.classification },
  ];
  const recovery = scoreTutorStubResistanceRecovery({
    profile: 'frame_refuser',
    triggerLearnerText: trigger.learner,
    postLearnerTurns,
  });
  const initialMissing = metric(trigger.tutorLearnerDagModel, 'missingPremiseCount');
  const finalMissing = metric(postTwo.tutorLearnerDag?.model, 'missingPremiseCount');
  const initialGrounded = metric(trigger.tutorLearnerDagModel, 'groundedCount');
  const finalGrounded = metric(postTwo.tutorLearnerDag?.model, 'groundedCount');
  if ([initialMissing, finalMissing, initialGrounded, finalGrounded].some((value) => value === null)) {
    throw new Error(`trace ${job.id} lacks the registered two-learner-turn proof-DAG endpoint`);
  }
  return {
    case_id: job.id,
    batch_id: job.treatment.batch_id,
    arm: job.treatment.repeat,
    prefix_id: job.prefix_id,
    public_prefix_sha256: job.public_prefix_sha256,
    profile: 'frame_refuser',
    action_fit: 'matched',
    realization: job.treatment.realization,
    pedagogical_move: 'test_bounded_distinction',
    assigned_register: job.treatment.register,
    trigger: { single_axis: true, profile_identity_used: false },
    outcome: {
      ...recovery,
      proof_debt_delta: finalMissing - initialMissing,
      new_supported_public_premises: Math.max(0, finalGrounded - initialGrounded),
    },
    fidelity: {
      action_visible: actionVisible,
      register_visible: registerVisible,
      safety_override: safetyOverride?.applied === true,
      protected_condition: protectedCondition,
    },
    execution: {
      trace: resultRow.trace,
      trace_sha256: resultRow.trace_sha256,
      model_attempt_reservations: totalReservations,
      final_trace_model_attempt_reservations: reservations.length,
      final_trace_observed_model_calls: observedRuntime.successfulModelCalls,
      final_trace_observed_model_attempt_events: observedRuntime.modelAttemptEvents,
      technical_recovery_used: batch.recoveredIds.has(job.id),
      tutor_turns: 2,
      post_trigger_learner_turns: 2,
    },
  };
}

export function analyzeTutorStubResistanceActionRegisterBaseline({
  batchA,
  batchB,
  registrationPath = REGISTRATION,
  prefixBundlePath = PREFIX_BUNDLE,
  expectedSourceCommit,
} = {}) {
  if (!batchA || !batchB || path.resolve(ROOT, batchA) === path.resolve(ROOT, batchB)) {
    throw new Error('combined analysis requires two distinct prebound batch destinations');
  }
  const currentSourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const currentSourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!expectedSourceCommit || currentSourceCommit !== expectedSourceCommit) {
    throw new Error('combined analysis source checkout does not match the expected GO-request commit');
  }
  const loaded = loadTutorStubResistanceActionRegisterPrefixBundle({
    registrationPath: path.resolve(ROOT, registrationPath),
    bundlePath: path.resolve(ROOT, prefixBundlePath),
  });
  const expectedRegistrationPath = path.relative(ROOT, loaded.registration.path);
  const expectedPrefixBundlePath = path.relative(ROOT, loaded.path);
  const batches = [exactBatch(batchA, 'A', expectedSourceCommit), exactBatch(batchB, 'B', expectedSourceCommit)];
  if (
    batches[0].plan.source.commit !== batches[1].plan.source.commit ||
    batches[0].plan.source.tree !== batches[1].plan.source.tree ||
    batches[0].plan.source.tree !== currentSourceTree ||
    batches.some(
      (batch) =>
        batch.plan.source.registration_path !== expectedRegistrationPath ||
        batch.plan.source.registration_sha256 !== loaded.registration.sha256 ||
        batch.plan.source.prefix_bundle_path !== expectedPrefixBundlePath ||
        batch.plan.source.prefix_bundle_sha256 !== loaded.sha256,
    )
  ) {
    throw new Error('combined analysis refuses source, registration, or prefix-bundle drift across batches');
  }
  const rows = batches.flatMap((batch) =>
    batch.result.results.map((resultRow) => analyzeTrace({ batch, resultRow, loaded })),
  );
  const exactCells = new Set(rows.map((row) => `${row.prefix_id}:${row.realization}:${row.arm}`));
  if (rows.length !== EXPECTED_DIALOGUES || exactCells.size !== EXPECTED_DIALOGUES) {
    throw new Error('combined analysis requires all 12 unique prefix by realization by repeat cells');
  }
  const reservationsByBatch = Object.fromEntries(
    ['batch_A', 'batch_B'].map((id) => [
      id,
      rows.filter((row) => row.batch_id === id).reduce((sum, row) => sum + row.execution.model_attempt_reservations, 0),
    ]),
  );
  if (reservationsByBatch.batch_A > 234 || reservationsByBatch.batch_B > 234) {
    throw new Error('combined analysis refuses a batch above its 234-reservation ceiling');
  }
  const byRealizationRepeat = Object.fromEntries(
    ['plain', 'warm'].map((realization) => [
      realization,
      Object.fromEntries(
        ['A', 'B'].map((repeat) => {
          const selected = rows.filter((row) => row.realization === realization && row.arm === repeat);
          return [repeat, selected.filter((row) => row.outcome.recovered).length / selected.length];
        }),
      ),
    ]),
  );
  const repeatPairs = ['plain', 'warm'].flatMap((realization) =>
    loaded.bundle.prefixes.map((prefix) => {
      const a = rows.find((row) => row.prefix_id === prefix.id && row.realization === realization && row.arm === 'A');
      const b = rows.find((row) => row.prefix_id === prefix.id && row.realization === realization && row.arm === 'B');
      return {
        prefix_id: prefix.id,
        realization,
        a_recovered: a.outcome.recovered,
        b_recovered: b.outcome.recovered,
        stable: a.outcome.recovered === b.outcome.recovered,
      };
    }),
  );
  const treatmentFidelity = loaded.registration.registration.measurement?.treatmentFidelity;
  const actionVisibilityRate = rows.filter((row) => row.fidelity.action_visible).length / rows.length;
  const registerVisibilityRate = rows.filter((row) => row.fidelity.register_visible).length / rows.length;
  const actionVisibilityMinimum = treatmentFidelity?.minimumActionVisibility;
  const registerVisibilityMinimum = treatmentFidelity?.minimumRegisterVisibility;
  const fidelityGatePassed =
    Number.isFinite(actionVisibilityMinimum) &&
    Number.isFinite(registerVisibilityMinimum) &&
    actionVisibilityRate >= actionVisibilityMinimum &&
    registerVisibilityRate >= registerVisibilityMinimum &&
    treatmentFidelity?.failedFidelityDisposition === 'fail_interpretability_gate_not_rerun';
  const fidelityGateStatus = fidelityGatePassed ? 'complete' : 'failed_interpretability_gate_not_rerun';
  return {
    schema: 'machinespirits.tutor-stub.resistance-action-register-baseline-report.v2',
    status: 'complete_registered_baseline',
    source: batches[0].plan.source,
    registration: { path: registrationPath, sha256: loaded.registration.sha256 },
    prefix_bundle: { path: prefixBundlePath, sha256: loaded.sha256 },
    assembly: {
      batches_complete: true,
      dialogues: rows.length,
      exact_cells: exactCells.size,
      partial_or_interim_interpretation_permitted: false,
      valid_unit_reruns: false,
      outcome_selection: false,
      v4_outcomes_pooled: false,
      reservations_by_batch: reservationsByBatch,
    },
    endpoint_status: {
      profile_specific_resistance_recovery: 'complete',
      same_treatment_repeat_stability: 'complete',
      proof_dag_debt_delta_at_two_learner_turns: 'complete',
      new_supported_public_premises_at_two_learner_turns: 'complete',
      action_register_fidelity_and_safety: fidelityGateStatus,
      trigger_specificity_and_assembly: 'complete',
    },
    rows,
    summary: {
      recovery_rate: rows.filter((row) => row.outcome.recovered).length / rows.length,
      recovery_by_realization_and_repeat: byRealizationRepeat,
      warm_minus_plain_descriptive:
        rows.filter((row) => row.realization === 'warm' && row.outcome.recovered).length / 6 -
        rows.filter((row) => row.realization === 'plain' && row.outcome.recovered).length / 6,
      same_treatment_repeat_drift: Object.fromEntries(
        Object.entries(byRealizationRepeat).map(([key, rates]) => [key, Math.abs(rates.A - rates.B)]),
      ),
      stable_repeat_pairs: repeatPairs.filter((row) => row.stable).length,
      repeat_pairs: repeatPairs,
      treatment_fidelity: {
        status: fidelityGateStatus,
        action_visibility_rate: actionVisibilityRate,
        action_visibility_minimum: actionVisibilityMinimum,
        register_visibility_rate: registerVisibilityRate,
        register_visibility_minimum: registerVisibilityMinimum,
        primary_analysis: treatmentFidelity?.primaryAnalysis || null,
        failed_disposition: treatmentFidelity?.failedFidelityDisposition || null,
        protected_condition_rate: rows.filter((row) => row.fidelity.protected_condition).length / rows.length,
        safety_override_rate: rows.filter((row) => row.fidelity.safety_override).length / rows.length,
        valid_unit_rerun_authorized: false,
      },
    },
    interpretation_status: fidelityGatePassed
      ? 'registered_baseline_interpretable_within_claim_boundary'
      : 'interpretability_gate_failed_no_rerun_or_efficacy_interpretation',
    claim_boundary:
      'This matched-action plain/warm baseline may calibrate frame-refuser recovery rates, warm-versus-plain descriptive separation, and same-treatment repeat stability for later prospective sizing. It does not establish matched-versus-mismatched action efficacy, edged-register efficacy, an action-by-register interaction, general tutor efficacy, learning, human validity, or cell-harness transfer.',
  };
}

function usage() {
  return 'Usage: node scripts/analyze-tutor-stub-resistance-action-register-baseline.js --batch-a <root> --batch-b <root> --expected-source-commit <sha> [--out <fresh.json>] [--json]';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return void console.log(usage());
  if (!args['batch-a'] || !args['batch-b'] || !args['expected-source-commit']) throw new Error(usage());
  const report = analyzeTutorStubResistanceActionRegisterBaseline({
    batchA: args['batch-a'],
    batchB: args['batch-b'],
    registrationPath: args.registration,
    prefixBundlePath: args['prefix-bundle'],
    expectedSourceCommit: args['expected-source-commit'],
  });
  if (args.out) fs.writeFileSync(path.resolve(ROOT, args.out), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  if (args.json || !args.out) console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
