#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { fisherExactTwoSidedP } from '../services/edgedRegisterCalibration.js';
import { observeResistantLearnerTurn } from '../services/resistantLearnerObservation.js';
import {
  tutorStubResistanceSemanticPromptSha256,
  tutorStubResistanceSemanticSha256,
} from '../services/tutorStubResistanceSemanticAdjudication.js';
import {
  adjudicateTutorStubResistanceFidelityPanelV8,
  adjudicateTutorStubResistanceRecoveryPrimaryPanelV8,
  buildTutorStubResistanceFidelityPromptV8,
  buildTutorStubResistanceRecoveryPrimaryPromptV8,
  tutorStubResistanceMeasurementSha256,
} from '../services/tutorStubResistanceRecoverySemanticAdjudicationV8.js';
import { loadTutorStubResistanceConfirmationSemanticInstrument } from '../services/tutorStubResistanceConfirmationSemanticRuntime.js';
import {
  loadTutorStubResistanceActionRegisterConfirmation,
  scoreTutorStubResistanceRecovery,
} from '../services/tutorStubResistanceActionRegisterConfirmation.js';
import { tutorStubResistanceActionRegisterTreatmentEligibility } from '../services/tutorStubResistanceActionRegisterStudy.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V4,
  TUTOR_STUB_RESISTANCE_SEMANTIC_SYSTEM_PROMPT,
  loadTutorStubResistanceSemanticRegistration,
  tutorStubResistanceSemanticRuntimeInstrument,
  validateTutorStubResistanceSemanticRuntimeResult,
} from '../services/tutorStubResistanceSemanticRuntime.js';
import {
  buildTutorStubResistanceActionRegisterConfirmationBatchPlan,
  buildTutorStubResistanceActionRegisterConfirmationRecoveryJob,
} from './run-tutor-stub-resistance-action-register-confirmation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-resistance-action-register-crossed-registration.v3.json';
const BATCH_IDS = Object.freeze(Array.from({ length: 9 }, (_, index) => `block_${String(index + 1).padStart(2, '0')}`));

function confirmationCaps(loaded) {
  return loaded?.registration?.version >= 9
    ? { perDialogue: 123, perBatch: 492, combined: 4428 }
    : { perDialogue: 60, perBatch: 240, combined: 2160 };
}

export function tutorStubResistanceActionRegisterConfirmationFisherGate(rows = []) {
  const indeterminateCaseIds = rows
    .filter((row) => row.measurement_disposition === 'measurement_indeterminate')
    .map((row) => row.case_id);
  return {
    execute: indeterminateCaseIds.length === 0,
    indeterminate_case_ids: indeterminateCaseIds,
    rerun_repair_replacement_or_selection_allowed: false,
  };
}

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

function metric(model, field) {
  const value = model?.metrics?.[field] ?? model?.assessment?.[field];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function traceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(directory, name));
}

function reservationCount(directory) {
  return traceFiles(directory)
    .flatMap(readTrace)
    .filter((event) => event.type === 'model_call_budget_reserved').length;
}

function sameIds(actual, expected) {
  return (
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index])
  );
}

function exactTraceDirectory(resultRow, command, label) {
  if (!resultRow?.trace || !command?.trace_dir) throw new Error(`${label} lacks its registered trace path`);
  const tracePath = path.resolve(ROOT, resultRow.trace);
  const traceDirectory = path.resolve(command.trace_dir);
  const files = traceFiles(traceDirectory);
  if (path.dirname(tracePath) !== traceDirectory || files.length !== 1 || path.resolve(files[0]) !== tracePath) {
    throw new Error(`${label} must contain exactly its one selected trace; alternatives are forbidden`);
  }
  return traceDirectory;
}

function auditRecovery({ absolute, plan, initial, result, seal, planPath, initialResultPath, resultPath }) {
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({
    registrationPath: path.resolve(ROOT, plan.source.registration_path),
  });
  const caps = confirmationCaps(loaded);
  const initialRows = Array.isArray(initial.results) ? initial.results : [];
  const initialById = new Map(initialRows.map((row) => [row.job_id, row]));
  const planIds = plan.jobs.map((job) => job.id);
  if (
    initial.status !== 'incomplete' ||
    initialRows.length > 4 ||
    initialById.size !== initialRows.length ||
    initialRows.some((row) => !planIds.includes(row.job_id) || !['complete', 'failed'].includes(row.status)) ||
    initialRows.some(
      (row) =>
        row.status === 'failed' &&
        (row.failure?.category !== 'technical_recoverable' || row.failure?.recoverable !== true),
    )
  ) {
    throw new Error(
      `confirmation batch ${plan.batch_id} recovery lacks one preserved technically recoverable incomplete result`,
    );
  }
  const initialValidIds = initialRows.filter((row) => row.status === 'complete').map((row) => row.job_id);
  const missingOrFailedIds = planIds.filter((id) => initialById.get(id)?.status !== 'complete');
  const recoveryRoot = path.join(absolute, 'recoveries', 'recovery-001');
  const recoveryPlanPath = path.join(recoveryRoot, 'recovery-plan.json');
  const recoveryResultPath = path.join(recoveryRoot, 'recovery-result.json');
  if (!fs.existsSync(recoveryPlanPath) || !fs.existsSync(recoveryResultPath)) {
    throw new Error(`confirmation batch ${plan.batch_id} recovery provenance is incomplete`);
  }
  const recoveryPlan = readJson(recoveryPlanPath);
  const recoveryResult = readJson(recoveryResultPath);
  const recoveryIds = recoveryPlan.jobs?.map((job) => job.id) || [];
  const recoveryResultIds = recoveryResult.results?.map((row) => row.job_id) || [];
  if (
    recoveryPlan.schema !== 'machinespirits.tutor-stub.resistance-action-register-confirmation-recovery-plan.v1' ||
    recoveryResult.schema !== 'machinespirits.tutor-stub.resistance-action-register-confirmation-recovery-result.v1' ||
    recoveryPlan.batch_id !== plan.batch_id ||
    recoveryResult.batch_id !== plan.batch_id ||
    recoveryPlan.original_plan_sha256 !== sha256(fs.readFileSync(planPath)) ||
    recoveryPlan.original_result_sha256 !== sha256(fs.readFileSync(initialResultPath)) ||
    JSON.stringify(recoveryPlan.source) !== JSON.stringify(plan.source) ||
    recoveryPlan.hard_ceiling !== caps.perBatch ||
    !sameIds(recoveryPlan.valid_unit_ids_excluded || [], initialValidIds) ||
    !sameIds(recoveryIds, missingOrFailedIds) ||
    !sameIds(recoveryResultIds, missingOrFailedIds) ||
    recoveryResult.results.some((row) => row.status !== 'complete') ||
    seal.recovery_plan_sha256 !== sha256(fs.readFileSync(recoveryPlanPath)) ||
    seal.recovery_result_sha256 !== sha256(fs.readFileSync(recoveryResultPath)) ||
    result.technical_recovery_used !== true ||
    !sameIds(result.recovery_unit_ids || [], missingOrFailedIds)
  ) {
    throw new Error(`confirmation batch ${plan.batch_id} recovery reran a valid unit or drifted`);
  }
  const recoveryJobs = new Map(recoveryPlan.jobs.map((job) => [job.id, job]));
  const recoveryRows = new Map(recoveryResult.results.map((row) => [row.job_id, row]));
  const finalRows = new Map(result.results.map((row) => [row.job_id, row]));
  const reservationsByJob = new Map();
  const finalTraceBudgetByJob = new Map();
  let usedReservationsBeforeRecovery = 0;
  for (const job of plan.jobs) {
    const initialFiles = traceFiles(job.command?.trace_dir);
    if (initialFiles.length > 1) {
      throw new Error(`confirmation batch ${plan.batch_id} initial unit ${job.id} contains alternative traces`);
    }
    const initialReservations = reservationCount(job.command?.trace_dir);
    usedReservationsBeforeRecovery += initialReservations;
    const initialRow = initialById.get(job.id);
    const finalRow = finalRows.get(job.id);
    if (initialValidIds.includes(job.id)) {
      exactTraceDirectory(initialRow, job.command, `initial valid confirmation unit ${job.id}`);
      if (
        finalRow?.origin !== 'initial_valid_unit' ||
        finalRow.trace !== initialRow.trace ||
        finalRow.trace_sha256 !== initialRow.trace_sha256
      ) {
        throw new Error(`confirmation batch ${plan.batch_id} rewrote initially valid unit ${job.id}`);
      }
      reservationsByJob.set(job.id, initialReservations);
      finalTraceBudgetByJob.set(job.id, caps.perDialogue);
      continue;
    }
    const recoveryJob = recoveryJobs.get(job.id);
    const recoveryRow = recoveryRows.get(job.id);
    const expectedRecoveryJob = buildTutorStubResistanceActionRegisterConfirmationRecoveryJob({
      loaded,
      job,
      destination: recoveryRoot,
      priorModelAttemptReservations: initialReservations,
    });
    if (JSON.stringify(recoveryJob) !== JSON.stringify(expectedRecoveryJob)) {
      throw new Error(`confirmation batch ${plan.batch_id} recovery command drifted for ${job.id}`);
    }
    exactTraceDirectory(recoveryRow, recoveryJob?.command, `recovered confirmation unit ${job.id}`);
    const recoveryReservations = reservationCount(recoveryJob.command.trace_dir);
    if (
      finalRow?.origin !== 'bounded_technical_recovery_missing_or_failed_unit' ||
      finalRow.trace !== recoveryRow.trace ||
      finalRow.trace_sha256 !== recoveryRow.trace_sha256
    ) {
      throw new Error(`confirmation batch ${plan.batch_id} recovery provenance drifted for ${job.id}`);
    }
    reservationsByJob.set(job.id, initialReservations + recoveryReservations);
    finalTraceBudgetByJob.set(job.id, recoveryJob.recovery.remaining_model_attempt_reservations);
  }
  const total = [...reservationsByJob.values()].reduce((sum, value) => sum + value, 0);
  if (
    [...reservationsByJob.values()].some((value) => value > caps.perDialogue) ||
    total > caps.perBatch ||
    recoveryPlan.used_reservations_before_recovery !== usedReservationsBeforeRecovery ||
    result.observed_model_attempt_reservations !== total ||
    seal.observed_model_attempt_reservations !== total ||
    JSON.stringify(result.observed_model_attempt_reservations_by_job) !==
      JSON.stringify(Object.fromEntries(reservationsByJob)) ||
    JSON.stringify(seal.observed_model_attempt_reservations_by_job) !==
      JSON.stringify(Object.fromEntries(reservationsByJob)) ||
    seal.result_sha256 !== sha256(fs.readFileSync(resultPath))
  ) {
    throw new Error(`confirmation batch ${plan.batch_id} recovery exceeded or misreported its unchanged caps`);
  }
  return { recoveredIds: new Set(missingOrFailedIds), reservationsByJob, finalTraceBudgetByJob };
}

function exactBatch(batchRoot, allowedBatchSources, analysisSourceCommit, registrationPath) {
  const absolute = path.resolve(ROOT, batchRoot);
  const planPath = path.join(absolute, 'batch-plan.json');
  const initialResultPath = path.join(absolute, 'batch-result.json');
  const finalResultPath = path.join(absolute, 'batch-final-result.json');
  const sealPath = path.join(absolute, 'batch-seal.json');
  if (![planPath, initialResultPath, sealPath].every(fs.existsSync)) {
    throw new Error(`confirmation batch ${batchRoot} is not sealed`);
  }
  const plan = readJson(planPath);
  const initial = readJson(initialResultPath);
  const result = fs.existsSync(finalResultPath) ? readJson(finalResultPath) : initial;
  const resultPath = fs.existsSync(finalResultPath) ? finalResultPath : initialResultPath;
  const seal = readJson(sealPath);
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({
    registrationPath: path.resolve(ROOT, registrationPath),
  });
  const caps = confirmationCaps(loaded);
  const expectedSourceTree = allowedBatchSources.get(plan.source?.commit);
  if (
    plan.schema !== 'machinespirits.tutor-stub.resistance-action-register-confirmation-live-batch-plan.v1' ||
    initial.schema !== 'machinespirits.tutor-stub.resistance-action-register-confirmation-live-batch-result.v1' ||
    result.schema !== 'machinespirits.tutor-stub.resistance-action-register-confirmation-live-batch-result.v1' ||
    seal.schema !== 'machinespirits.tutor-stub.resistance-action-register-confirmation-live-batch-seal.v1' ||
    !expectedSourceTree ||
    plan.source?.tree !== expectedSourceTree ||
    plan.source?.registration_path !== registrationPath ||
    result.status !== 'complete' ||
    result.completed_dialogues !== 4 ||
    result.failed_or_missing_dialogues !== 0 ||
    seal.status !== 'sealed_complete' ||
    seal.batch_id !== plan.batch_id ||
    seal.plan_sha256 !== sha256(fs.readFileSync(planPath)) ||
    seal.result_sha256 !== sha256(fs.readFileSync(resultPath)) ||
    seal.dialogues !== 4 ||
    seal.hard_ceiling !== caps.perBatch ||
    seal.valid_unit_reruns !== false ||
    seal.outcome_selection !== false
  ) {
    throw new Error(`confirmation batch ${batchRoot} violates its source, result, or seal contract`);
  }
  const recomputed = buildTutorStubResistanceActionRegisterConfirmationBatchPlan({
    registrationPath,
    batchId: plan.batch_id,
    destination: absolute,
    expectedSourceCommit: analysisSourceCommit,
  });
  const comparableJobs = (jobs) =>
    jobs.map((job) => {
      const command = structuredClone(job.command);
      for (const flag of ['--trace-dir', '--save']) {
        const index = command.args.indexOf(flag);
        if (index >= 0) command.args[index + 1] = path.resolve(command.cwd, command.args[index + 1]);
      }
      delete command.cwd;
      return { ...job, command };
    });
  if (
    path.resolve(plan.jobs[0]?.command?.cwd || ROOT, plan.destination) !== absolute ||
    JSON.stringify(comparableJobs(plan.jobs)) !== JSON.stringify(comparableJobs(recomputed.jobs)) ||
    JSON.stringify(plan.design) !== JSON.stringify(recomputed.design) ||
    JSON.stringify(plan.budget) !== JSON.stringify(recomputed.budget)
  ) {
    throw new Error(`confirmation batch ${plan.batch_id} command or assignment plan drifted`);
  }
  const planJobs = new Map(plan.jobs.map((job) => [job.id, job]));
  if (
    planJobs.size !== 4 ||
    !Array.isArray(result.results) ||
    result.results.length !== 4 ||
    new Set(result.results.map((row) => row.job_id)).size !== 4 ||
    result.results.some((row) => row.status !== 'complete' || !planJobs.has(row.job_id))
  ) {
    throw new Error(`confirmation batch ${plan.batch_id} does not contain its four exact complete jobs`);
  }
  const technicalRecovery = fs.existsSync(finalResultPath);
  if (technicalRecovery) {
    const audited = auditRecovery({
      absolute,
      plan,
      initial,
      result,
      seal,
      planPath,
      initialResultPath,
      resultPath,
    });
    return { absolute, plan, result, planJobs, ...audited };
  }
  if (
    initial.status !== 'complete' ||
    result.technical_recovery_used === true ||
    (result.recovery_unit_ids || []).length ||
    fs.existsSync(path.join(absolute, 'recoveries')) ||
    seal.recovery_plan_sha256 ||
    seal.recovery_result_sha256
  ) {
    throw new Error(`confirmation batch ${plan.batch_id} has inconsistent no-recovery provenance`);
  }
  const reservationsByJob = new Map();
  const finalTraceBudgetByJob = new Map();
  for (const job of plan.jobs) {
    const row = result.results.find((candidate) => candidate.job_id === job.id);
    exactTraceDirectory(row, job.command, `confirmation unit ${job.id}`);
    const count = reservationCount(job.command.trace_dir);
    if (count > caps.perDialogue) {
      throw new Error(`confirmation job ${job.id} exceeds its ${caps.perDialogue}-reservation cap`);
    }
    reservationsByJob.set(job.id, count);
    finalTraceBudgetByJob.set(job.id, caps.perDialogue);
  }
  if ([...reservationsByJob.values()].reduce((sum, value) => sum + value, 0) > caps.perBatch) {
    throw new Error(`confirmation batch ${plan.batch_id} exceeds its ${caps.perBatch}-reservation cap`);
  }
  return {
    absolute,
    plan,
    result,
    planJobs,
    recoveredIds: new Set(),
    reservationsByJob,
    finalTraceBudgetByJob,
  };
}

function assertAttemptEnvelope(events, job, outcomeTurn, finalTraceBudget, plan, loaded) {
  const runStart = events.find((event) => event.type === 'run_start');
  const metadata = runStart?.metadata;
  const recipe = metadata?.sessionRecipe;
  const options = recipe?.config?.options;
  const models = recipe?.config?.identity?.models;
  const attempts = events.filter((event) =>
    ['model_call', 'model_call_error', 'model_call_aborted'].includes(event.type),
  );
  const calls = attempts.filter((event) => event.type === 'model_call');
  const reservations = events.filter((event) => event.type === 'model_call_budget_reserved');
  const routePinned = ['classifier', 'learner', 'reasoning', 'tutor'].every(
    (role) => models?.[role]?.provider === 'codex' && models?.[role]?.model === 'gpt-5.6-luna',
  );
  const triggerJudges =
    loaded.registration.version >= 9
      ? loadTutorStubResistanceSemanticRegistration(TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V4).registration
          .measurement.judges
      : [];
  const outcomeJudges =
    loaded.registration.version >= 9
      ? loadTutorStubResistanceConfirmationSemanticInstrument(loaded.registration).registration.measurement.judges
      : [];
  const expectedAttemptRoute = (event) => {
    const role = String(event.role || '');
    const triggerJudge = triggerJudges.find((judge) => role === `tutor_stub_resistance_semantic_${judge.id}`);
    if (triggerJudge) return event.provider === triggerJudge.provider && event.model === triggerJudge.model;
    const outcomeJudge = outcomeJudges.find(
      (judge) =>
        role === `tutor_stub_resistance_semantic_confirmation_primary_recovery_${judge.id}` ||
        role === `tutor_stub_resistance_semantic_confirmation_intervention_fidelity_${judge.id}`,
    );
    if (outcomeJudge) return event.provider === outcomeJudge.provider && event.model === outcomeJudge.model;
    return event.provider === 'codex' && event.model === 'gpt-5.6-luna';
  };
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
  const allowed = attempts.every((event) => {
    const turn = Number(event.turn);
    if (event.role === 'tutor_stub_opening') return turn === 0;
    if (event.role === 'tutor_stub_auto_learner' || event.role === 'tutor_stub_learner_analysis') {
      return turn >= 1 && turn <= outcomeTurn;
    }
    if (String(event.role || '').startsWith('tutor_stub_resistance_semantic_confirmation_')) {
      return loaded.registration.version >= 9 && turn === outcomeTurn;
    }
    if (String(event.role || '').startsWith('tutor_stub_resistance_semantic_')) {
      return loaded.registration.version >= 9 && turn >= 1 && turn <= outcomeTurn;
    }
    return allowedTutorRoles.has(event.role) && turn >= 1 && turn < outcomeTurn;
  });
  const required = [
    ['tutor_stub_opening', 0],
    ...Array.from({ length: outcomeTurn }, (_, index) => ['tutor_stub_auto_learner', index + 1]),
    ...Array.from({ length: outcomeTurn }, (_, index) => ['tutor_stub_learner_analysis', index + 1]),
    ...Array.from({ length: outcomeTurn - 1 }, (_, index) => ['tutor_stub_tutor', index + 1]),
  ].every(([role, turn]) => calls.some((event) => event.role === role && Number(event.turn) === turn));
  const countByRoleTurn = (rows) =>
    rows.reduce((counts, event) => {
      const key = `${String(event.role)}:${Number(event.turn)}`;
      counts.set(key, (counts.get(key) || 0) + 1);
      return counts;
    }, new Map());
  const reserved = countByRoleTurn(reservations);
  const attempted = countByRoleTurn(attempts);
  const exactReservations =
    reserved.size === attempted.size && [...reserved].every(([key, count]) => attempted.get(key) === count);
  if (
    recipe?.schema !== 'machinespirits.tutor-stub.session-recipe.v1' ||
    metadata?.provenance?.git?.sha !== plan.source.commit ||
    metadata?.provenance?.git?.dirty !== false ||
    recipe?.config?.identity?.world?.id !== 'world_005_marrick' ||
    metadata?.experiment?.runSeed !== job.run_seed ||
    metadata?.experiment?.profile !== 'frame_refuser' ||
    metadata?.experiment?.policy !== 'field' ||
    metadata?.experiment?.repeat !== job.assignment_index ||
    metadata?.experiment?.jobId !== job.id ||
    metadata?.autoLearner?.observationSemantics !== loaded.registration.design.trigger.observationSemantics ||
    metadata?.autoLearner?.maxTurns !== 4 ||
    metadata?.autoLearner?.profileId !== 'frame_refuser' ||
    metadata?.autoLearner?.modelRef !== 'codex.gpt-5.6-luna' ||
    metadata?.lab?.admission?.modelCallBudget !== finalTraceBudget ||
    options?.['cli-effort'] !== 'low' ||
    options?.['run-seed'] !== String(job.run_seed) ||
    options?.['auto-turns'] !== '4' ||
    options?.['model-call-budget'] !== String(finalTraceBudget) ||
    options?.['dag-mode'] !== 'strict_dag' ||
    options?.['register-policy'] !== 'field' ||
    options?.['register-palette'] !== 'plain,warm' ||
    options?.['eval-repeat'] !== String(job.assignment_index) ||
    options?.['eval-job-id'] !== job.id ||
    options?.['no-opening'] === true ||
    routePinned !== true ||
    required !== true ||
    allowed !== true ||
    exactReservations !== true ||
    attempts.some((event) => !expectedAttemptRoute(event)) ||
    calls.some((event) => event.response?.effort !== 'low') ||
    attempts
      .filter((event) => event.type !== 'model_call')
      .some((event) => event.request?.cliEffort !== 'low' && event.request?.config?.cliEffort !== 'low')
  ) {
    throw new Error(`confirmation trace ${job.id} violates its observed route, source, horizon, or attempt pins`);
  }
  return { calls: calls.length, attempts: attempts.length, reservations: reservations.length };
}

function v9SemanticTriggerEligibility({ events, record, loaded }) {
  const semanticAdjudication = record?.resistanceSemanticAdjudication || null;
  const binding = loadTutorStubResistanceSemanticRegistration(TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V4);
  if (
    loaded.registration.design?.trigger?.observationSemantics !== binding.registration.observationSemantics ||
    loaded.registration.semanticAdjudication?.instrumentRegistrationSha256 !== binding.sha256
  ) {
    throw new Error('V9 trigger semantic instrument binding drifted');
  }
  const validation = validateTutorStubResistanceSemanticRuntimeResult({
    result: semanticAdjudication,
    learnerText: record?.learner,
    turnNumber: Number(record?.turn),
    registrationBinding: binding,
    expectedPublicContext: semanticAdjudication?.publicContext,
  });
  const aggregateEvents = events.filter(
    (event) =>
      event.type === 'resistance_semantic_adjudication' &&
      event.caseId === semanticAdjudication?.caseId &&
      Number(event.turn) === Number(record?.turn),
  );
  const judgeEvents = events.filter(
    (event) =>
      event.type === 'resistance_semantic_judge_result' &&
      event.caseId === semanticAdjudication?.caseId &&
      Number(event.turn) === Number(record?.turn),
  );
  const instrument = tutorStubResistanceSemanticRuntimeInstrument(binding);
  const prompts = {};
  for (const judge of binding.registration.measurement.judges) {
    const event = judgeEvents.find((candidate) => candidate.judgeId === judge.id);
    let prompt = null;
    try {
      prompt = JSON.parse(String(event?.userPrompt || ''));
    } catch {
      throw new Error(`V9 trace has an invalid trigger prompt for ${judge.id}`);
    }
    prompts[judge.id] = prompt;
    if (
      event?.role !== `tutor_stub_resistance_semantic_${judge.id}` ||
      event.expectedProvider !== judge.provider ||
      event.expectedModel !== judge.model ||
      event.expectedEffort !== judge.effort ||
      event.systemPrompt !== TUTOR_STUB_RESISTANCE_SEMANTIC_SYSTEM_PROMPT ||
      event.systemPromptSha256 !== tutorStubResistanceSemanticSha256(TUTOR_STUB_RESISTANCE_SEMANTIC_SYSTEM_PROMPT) ||
      event.userPromptSha256 !== tutorStubResistanceSemanticSha256(event.userPrompt) ||
      event.promptSha256 !== tutorStubResistanceSemanticPromptSha256(prompt) ||
      event.packetSha256 !== prompt.packet_sha256 ||
      prompt.case_id !== semanticAdjudication?.caseId ||
      prompt.utterance?.text !== record?.learner ||
      JSON.stringify(prompt.public_context) !== JSON.stringify(semanticAdjudication?.publicContext) ||
      JSON.stringify(event.outputSchema) !== JSON.stringify(instrument.outputSchema)
    ) {
      throw new Error(`V9 trace trigger judge envelope drifted for ${judge.id}`);
    }
  }
  const recomputedAggregate = instrument.adjudicate({
    source: record?.learner,
    publicContext: semanticAdjudication?.publicContext,
    caseId: semanticAdjudication?.caseId,
    responses: judgeEvents.map((event) => event.record).filter(Boolean),
    registration: binding.registration,
    prompts,
    advisorySignals: semanticAdjudication?.aggregate?.advisory_signals || [],
  });
  if (
    !validation.valid ||
    aggregateEvents.length !== 1 ||
    aggregateEvents[0].aggregateSha256 !== semanticAdjudication.aggregateSha256 ||
    JSON.stringify(aggregateEvents[0].aggregate) !== JSON.stringify(semanticAdjudication.aggregate) ||
    JSON.stringify(recomputedAggregate) !== JSON.stringify(semanticAdjudication.aggregate) ||
    judgeEvents.length !== 3 ||
    new Set(judgeEvents.map((event) => event.judgeId)).size !== 3 ||
    judgeEvents.some(
      (event) =>
        event.registrationSha256 !== binding.sha256 ||
        event.registrationPath !== binding.path ||
        event.publicTranscriptChanged !== false,
    )
  ) {
    throw new Error(`V9 trace has invalid independent semantic trigger evidence at turn ${record?.turn}`);
  }
  const runtime = {
    registration: loaded.registration,
    profile: 'frame_refuser',
    consumed: false,
    dynamic_confirmation: true,
  };
  return tutorStubResistanceActionRegisterTreatmentEligibility({
    runtime,
    learnerText: record.learner,
    classification: record.classification,
    tutorLearnerDag: record.tutorLearnerDagModel,
    semanticAdjudication,
    turnNumber: Number(record.turn),
    expectedPublicContext: semanticAdjudication.publicContext,
  });
}

function v9SemanticOutcome({ events, job, loaded, trigger, postOne, postTwo, outcomeTurn }) {
  const stored = postTwo.resistanceConfirmationSemanticOutcome;
  const adjudicationEvents = events.filter(
    (event) =>
      event.type === 'resistance_confirmation_semantic_adjudication' &&
      event.case_id === job.id &&
      Number(event.turn) === outcomeTurn,
  );
  const judgeEvents = events.filter(
    (event) =>
      event.type === 'resistance_confirmation_semantic_judge_result' &&
      event.caseId === job.id &&
      Number(event.turn) === outcomeTurn,
  );
  if (
    !stored ||
    stored.schema !== 'machinespirits.tutor-stub.resistance-confirmation-semantic-outcome.v9' ||
    adjudicationEvents.length !== 1 ||
    judgeEvents.length !== 6 ||
    new Set(judgeEvents.map((event) => `${event.instrument}:${event.judgeId}`)).size !== 6 ||
    JSON.stringify(adjudicationEvents[0].primary) !== JSON.stringify(stored.primary) ||
    JSON.stringify(adjudicationEvents[0].fidelity) !== JSON.stringify(stored.fidelity)
  ) {
    throw new Error(`confirmation trace ${job.id} lacks its exact V9 semantic outcome panels`);
  }
  const loadedInstrument = loadTutorStubResistanceConfirmationSemanticInstrument(loaded.registration);
  const publicPacket = {
    trigger: String(trigger.learner || ''),
    intervention: String(trigger.tutor || ''),
    prior_post_trigger: String(postOne.learner || ''),
    intervening_tutor: String(postOne.tutor || ''),
    current_learner: String(postTwo.learnerText || ''),
  };
  const primaryPrompts = Object.fromEntries(
    loadedInstrument.registration.measurement.judges.map((judge) => [
      judge.id,
      buildTutorStubResistanceRecoveryPrimaryPromptV8({ caseId: job.id, publicPacket, judge }),
    ]),
  );
  const fidelityPrompts = Object.fromEntries(
    loadedInstrument.registration.measurement.judges.map((judge) => [
      judge.id,
      buildTutorStubResistanceFidelityPromptV8({ caseId: job.id, intervention: publicPacket.intervention, judge }),
    ]),
  );
  for (const [instrument, prompts] of [
    ['primary_recovery', primaryPrompts],
    ['intervention_fidelity', fidelityPrompts],
  ]) {
    for (const judge of loadedInstrument.registration.measurement.judges) {
      const event = judgeEvents.find((row) => row.instrument === instrument && row.judgeId === judge.id);
      const prompt = prompts[judge.id];
      if (
        !event ||
        event.role !== `tutor_stub_resistance_semantic_confirmation_${instrument}_${judge.id}` ||
        event.promptSha256 !== tutorStubResistanceMeasurementSha256(prompt) ||
        event.packetSha256 !== prompt.packet_sha256 ||
        event.expectedProvider !== judge.provider ||
        event.expectedModel !== judge.model ||
        event.expectedEffort !== judge.effort ||
        event.publicTranscriptChanged !== false
      ) {
        throw new Error(`confirmation trace ${job.id} semantic ${instrument} seat ${judge.id} drifted`);
      }
    }
  }
  const responses = (instrument) =>
    judgeEvents.filter((event) => event.instrument === instrument && event.record).map((event) => event.record);
  const primary = adjudicateTutorStubResistanceRecoveryPrimaryPanelV8({
    caseId: job.id,
    publicPacket,
    responses: responses('primary_recovery'),
    registration: loadedInstrument.registration,
    prompts: primaryPrompts,
  });
  const fidelity = adjudicateTutorStubResistanceFidelityPanelV8({
    caseId: job.id,
    intervention: publicPacket.intervention,
    responses: responses('intervention_fidelity'),
    registration: loadedInstrument.registration,
    prompts: fidelityPrompts,
  });
  const disposition =
    primary.status === 'determinate' && fidelity.status === 'determinate' ? 'determinate' : 'measurement_indeterminate';
  if (
    JSON.stringify(primary) !== JSON.stringify(stored.primary) ||
    JSON.stringify(fidelity) !== JSON.stringify(stored.fidelity) ||
    stored.instrument?.path !== loadedInstrument.path ||
    stored.instrument?.sha256 !== loadedInstrument.sha256 ||
    stored.public_packet_sha256 !== tutorStubResistanceMeasurementSha256(publicPacket) ||
    stored.measurement_disposition !== disposition ||
    stored.regex_keyword_learner_classifier_or_generator_authority !== 'none' ||
    stored.primary_and_fidelity_claims_separate !== true ||
    stored.repair_rerun_replacement_or_selection_allowed !== false
  ) {
    throw new Error(`confirmation trace ${job.id} semantic outcome cannot be reproduced exactly`);
  }
  return stored;
}

export function analyzeTutorStubResistanceActionRegisterConfirmationTrace(batch, resultRow, loaded) {
  const job = batch.planJobs.get(resultRow.job_id);
  if (!job) throw new Error(`confirmation result ${resultRow.job_id} is not planned`);
  const tracePath = path.resolve(ROOT, resultRow.trace);
  const source = fs.readFileSync(tracePath);
  if (sha256(source) !== resultRow.trace_sha256) throw new Error(`confirmation trace digest drift for ${job.id}`);
  const events = readTrace(tracePath);
  const start = events.filter((event) => event.type === 'resistance_action_register_confirmation_execution_start');
  const runStarts = events.filter((event) => event.type === 'run_start');
  const oldStarts = events.filter((event) => event.type === 'resistance_action_register_execution_start');
  const interventions = events.filter((event) => event.type === 'resistance_action_register_intervention_applied');
  const outcomes = events.filter((event) => event.type === 'resistance_action_register_outcome_learner_turn');
  const completed = events.filter((event) => event.type === 'turn_complete' && event.turnRecord);
  if (
    runStarts.length !== 1 ||
    start.length !== 1 ||
    oldStarts.length ||
    interventions.length !== 1 ||
    outcomes.length !== 1
  ) {
    throw new Error(`confirmation trace ${job.id} lacks its exact fresh execution, treatment, or outcome event`);
  }
  const triggerTurn = Number(interventions[0].turn);
  const outcomeTurn = Number(outcomes[0].turn);
  if (![1, 2].includes(triggerTurn) || outcomeTurn !== triggerTurn + 2 || outcomes[0].tutorReplyGenerated !== false) {
    throw new Error(`confirmation trace ${job.id} violates the by-T2 trigger or two-turn outcome horizon`);
  }
  const completedTurns = completed.map((event) => Number(event.turn));
  const expectedCompletedTurns = Array.from({ length: outcomeTurn - 1 }, (_, index) => index + 1);
  if (JSON.stringify(completedTurns) !== JSON.stringify(expectedCompletedTurns)) {
    throw new Error(`confirmation trace ${job.id} lacks its exact unique public turn sequence`);
  }
  const startEvent = start[0];
  const intervention = interventions[0].intervention;
  const assignment = intervention?.assignment;
  if (
    startEvent.jobId !== job.id ||
    startEvent.batchId !== job.block_id ||
    startEvent.assignmentIndex !== job.assignment_index ||
    startEvent.runSeed !== job.run_seed ||
    startEvent.registrationSha256 !== loaded.sha256 ||
    startEvent.freshIndependentDialogue !== true ||
    startEvent.calibrationDialogueReused !== false ||
    assignment?.action_fit !== 'matched' ||
    assignment?.pedagogical_move !== 'test_bounded_distinction' ||
    assignment?.realization !== job.treatment.realization ||
    assignment?.register !== job.treatment.register ||
    assignment?.repeat !== job.block_id ||
    assignment?.batch_id !== job.block_id
  ) {
    throw new Error(`confirmation trace ${job.id} drifted from its randomized treatment assignment`);
  }
  const trigger = completed.find((event) => Number(event.turn) === triggerTurn)?.turnRecord;
  const postOne = completed.find((event) => Number(event.turn) === triggerTurn + 1)?.turnRecord;
  const postTwo = outcomes[0];
  const triggerHash = sha256(String(trigger?.learner || ''));
  const v9 = loaded.registration.version >= 9;
  const observation = v9
    ? null
    : observeResistantLearnerTurn({
        learnerText: trigger?.learner,
        classification: trigger?.classification,
        semantics: loaded.registration.design.trigger.observationSemantics,
      });
  const eligibilityRuntime = {
    registration: loaded.registration,
    profile: 'frame_refuser',
    consumed: false,
    dynamic_confirmation: true,
  };
  const triggerEligibility = v9
    ? v9SemanticTriggerEligibility({ events, record: trigger, loaded })
    : tutorStubResistanceActionRegisterTreatmentEligibility({
        runtime: eligibilityRuntime,
        learnerText: trigger?.learner,
        classification: trigger?.classification,
        tutorLearnerDag: trigger?.tutorLearnerDagModel,
      });
  const earlierEligible = completed
    .filter((event) => Number(event.turn) < triggerTurn)
    .some((event) =>
      v9
        ? v9SemanticTriggerEligibility({ events, record: event.turnRecord, loaded }).eligible
        : tutorStubResistanceActionRegisterTreatmentEligibility({
            runtime: eligibilityRuntime,
            learnerText: event.turnRecord.learner,
            classification: event.turnRecord.classification,
            tutorLearnerDag: event.turnRecord.tutorLearnerDagModel,
          }).eligible,
    );
  if (
    !trigger ||
    !postOne ||
    !postTwo ||
    (!v9 && observation.ambiguous !== false) ||
    (!v9 && !observation.observations?.some((row) => row.type === 'frame_jurisdiction_refusal')) ||
    triggerEligibility.eligible !== true ||
    earlierEligible ||
    interventions[0].triggerTurn !== triggerTurn ||
    interventions[0].triggerLearnerSha256 !== triggerHash ||
    postTwo.triggerTurn !== triggerTurn ||
    postTwo.triggerLearnerSha256 !== triggerHash
  ) {
    throw new Error(`confirmation trace ${job.id} lacks its first eligible fresh public trigger provenance`);
  }
  const responseAudit = trigger.responseConfigurationAudit;
  const safety = intervention.safety_override;
  const protectedCondition = [
    'comprehension_repair',
    'protected_affect',
    'content_bearing_uptake_already_visible',
  ].includes(safety?.reason);
  const appliedAdherent = intervention?.status === 'applied' && safety?.applied === false && safety?.reason == null;
  const safetyOverrideNonadherent =
    intervention?.status === 'safety_override_nonadherent' &&
    safety?.applied === true &&
    protectedCondition &&
    safety?.assigned_register === assignment?.register &&
    safety?.delivered_register === 'plain';
  const deliveredRegisterVisible = responseAudit?.axes?.engagement_stance?.visible;
  const registerVisible = safetyOverrideNonadherent ? false : deliveredRegisterVisible;
  const expectedDeliveredRegister = safety?.applied === true ? safety.delivered_register : assignment?.register;
  if (
    (!appliedAdherent && !safetyOverrideNonadherent) ||
    typeof safety?.applied !== 'boolean' ||
    protectedCondition !== safetyOverrideNonadherent ||
    (!v9 &&
      (typeof responseAudit?.axes?.action_family?.visible !== 'boolean' ||
        typeof deliveredRegisterVisible !== 'boolean' ||
        responseAudit?.axes?.action_family?.selected !== 'clarify_distinction' ||
        responseAudit?.axes?.engagement_stance?.selected !== expectedDeliveredRegister))
  ) {
    throw new Error(`confirmation trace ${job.id} lacks adherent typed action/register visibility evidence`);
  }
  const observed = assertAttemptEnvelope(
    events,
    job,
    outcomeTurn,
    batch.finalTraceBudgetByJob.get(job.id),
    batch.plan,
    loaded,
  );
  const semanticOutcome = v9
    ? v9SemanticOutcome({ events, job, loaded, trigger, postOne, postTwo, outcomeTurn })
    : null;
  const recovery = v9
    ? {
        recovered:
          semanticOutcome.primary.status === 'determinate' ? semanticOutcome.primary.final_recovery === 'yes' : null,
        status: semanticOutcome.primary.status,
        authority: 'v8_three_judge_primary_recovery_panel',
        panel: semanticOutcome.primary,
      }
    : scoreTutorStubResistanceRecovery({
        profile: 'frame_refuser',
        triggerLearnerText: trigger.learner,
        postLearnerTurns: [
          { learnerText: postOne.learner, classification: postOne.classification },
          { learnerText: postTwo.learnerText, classification: postTwo.classification },
        ],
      });
  const initialMissing = metric(trigger.tutorLearnerDagModel, 'missingPremiseCount');
  const finalMissing = metric(postTwo.tutorLearnerDag?.model, 'missingPremiseCount');
  const initialGrounded = metric(trigger.tutorLearnerDagModel, 'groundedCount');
  const finalGrounded = metric(postTwo.tutorLearnerDag?.model, 'groundedCount');
  if ([initialMissing, finalMissing, initialGrounded, finalGrounded].some((value) => value === null)) {
    throw new Error(`confirmation trace ${job.id} lacks its proof-DAG endpoint`);
  }
  return {
    case_id: job.id,
    block_id: job.block_id,
    assignment_index: job.assignment_index,
    run_seed: job.run_seed,
    profile: 'frame_refuser',
    action_fit: 'matched',
    realization: job.treatment.realization,
    trigger: { turn: triggerTurn, learner_sha256: triggerHash, single_axis: true, profile_identity_used: false },
    outcome: {
      ...recovery,
      proof_debt_delta: finalMissing - initialMissing,
      new_supported_public_premises: Math.max(0, finalGrounded - initialGrounded),
    },
    fidelity: {
      action_visible: v9
        ? semanticOutcome.fidelity.action_measurement.value === 'yes'
        : responseAudit.axes.action_family.visible,
      register_visible: v9
        ? semanticOutcome.fidelity.register_measurement.value === assignment.realization
        : registerVisible,
      ...(v9
        ? {
            status: semanticOutcome.fidelity.status,
            authority: 'v8_three_judge_intervention_fidelity_panel',
            panel: semanticOutcome.fidelity,
          }
        : {}),
      safety_override: safety?.applied === true,
      protected_condition: protectedCondition,
    },
    ...(v9 ? { measurement_disposition: semanticOutcome.measurement_disposition } : {}),
    execution: {
      trace: resultRow.trace,
      trace_sha256: resultRow.trace_sha256,
      model_attempt_reservations: batch.reservationsByJob.get(job.id),
      observed_model_calls: observed.calls,
      observed_model_attempts: observed.attempts,
      technical_recovery_used: batch.recoveredIds.has(job.id),
      tutor_turns: outcomeTurn - 1,
      learner_turns: outcomeTurn,
      post_trigger_learner_turns: 2,
    },
  };
}

export function analyzeTutorStubResistanceActionRegisterConfirmation({
  batchRoots,
  registrationPath = REGISTRATION,
  expectedSourceCommit,
  allowedBatchSourceCommits = null,
} = {}) {
  if (
    !Array.isArray(batchRoots) ||
    batchRoots.length !== 9 ||
    new Set(batchRoots.map((root) => path.resolve(ROOT, root))).size !== 9
  ) {
    throw new Error('confirmation analysis requires nine distinct predeclared batch roots');
  }
  const current = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const currentTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  if (!expectedSourceCommit || current !== expectedSourceCommit || status) {
    throw new Error('confirmation analysis requires its exact clean GO-request source');
  }
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({
    registrationPath: path.resolve(ROOT, registrationPath),
  });
  const caps = confirmationCaps(loaded);
  const allowedCommits = allowedBatchSourceCommits?.length
    ? [...new Set(allowedBatchSourceCommits)]
    : [expectedSourceCommit];
  const allowedBatchSources = new Map(
    allowedCommits.map((commit) => {
      const tree = execFileSync('git', ['rev-parse', `${commit}^{tree}`], { cwd: ROOT, encoding: 'utf8' }).trim();
      const registeredSource = execFileSync('git', ['show', `${commit}:${registrationPath}`], {
        cwd: ROOT,
        encoding: null,
      });
      if (sha256(registeredSource) !== loaded.sha256) {
        throw new Error(`confirmation analysis batch source ${commit} does not contain the registered design`);
      }
      return [commit, tree];
    }),
  );
  const batches = batchRoots.map((root) =>
    exactBatch(root, allowedBatchSources, expectedSourceCommit, registrationPath),
  );
  const observedBatchSourceCommits = [...new Set(batches.map((batch) => batch.plan.source.commit))].sort();
  if (JSON.stringify(observedBatchSourceCommits) !== JSON.stringify([...allowedBatchSources.keys()].sort())) {
    throw new Error('confirmation analysis batch-source allowlist contains an unused or missing commit');
  }
  if (JSON.stringify(batches.map((batch) => batch.plan.batch_id).sort()) !== JSON.stringify([...BATCH_IDS])) {
    throw new Error('confirmation analysis requires all nine registered blocks exactly once');
  }
  if (batches.some((batch) => batch.plan.source.registration_sha256 !== loaded.sha256)) {
    throw new Error('confirmation analysis registration digest drifted across batches');
  }
  const rows = batches.flatMap((batch) =>
    batch.result.results.map((row) => analyzeTutorStubResistanceActionRegisterConfirmationTrace(batch, row, loaded)),
  );
  const plain = rows.filter((row) => row.realization === 'plain');
  const warm = rows.filter((row) => row.realization === 'warm');
  if (
    rows.length !== 36 ||
    plain.length !== 18 ||
    warm.length !== 18 ||
    new Set(rows.map((row) => row.case_id)).size !== 36 ||
    new Set(rows.map((row) => row.run_seed)).size !== 36 ||
    new Set(rows.map((row) => row.execution.trace_sha256)).size !== 36
  ) {
    throw new Error('confirmation analysis requires 36 unique fresh independent dialogues, 18 per arm');
  }
  const reservationsByBatch = Object.fromEntries(
    BATCH_IDS.map((id) => [
      id,
      rows.filter((row) => row.block_id === id).reduce((sum, row) => sum + row.execution.model_attempt_reservations, 0),
    ]),
  );
  if (Object.values(reservationsByBatch).some((value) => value > caps.perBatch)) {
    throw new Error(`confirmation analysis refuses a batch above ${caps.perBatch} reservations`);
  }
  const totalReservations = Object.values(reservationsByBatch).reduce((sum, value) => sum + value, 0);
  if (totalReservations > caps.combined) {
    throw new Error(`confirmation analysis refuses a run above ${caps.combined} reservations`);
  }
  const fisherGate = tutorStubResistanceActionRegisterConfirmationFisherGate(rows);
  const indeterminateRows = rows.filter((row) => fisherGate.indeterminate_case_ids.includes(row.case_id));
  const plainRecovered = plain.filter((row) => row.outcome.recovered).length;
  const warmRecovered = warm.filter((row) => row.outcome.recovered).length;
  const pValue = fisherGate.execute ? fisherExactTwoSidedP(warmRecovered, 18, plainRecovered, 18) : null;
  const plainRate = plainRecovered / 18;
  const warmRate = warmRecovered / 18;
  const actionVisibility = rows.filter((row) => row.fidelity.action_visible).length / 36;
  const registerVisibility = rows.filter((row) => row.fidelity.register_visible).length / 36;
  const protectedConditionCount = rows.filter((row) => row.fidelity.protected_condition).length;
  const safetyOverrideCount = rows.filter((row) => row.fidelity.safety_override).length;
  const fidelity = loaded.registration.measurement.treatmentFidelity;
  const fidelityPassed =
    actionVisibility >= fidelity.minimumActionVisibility && registerVisibility >= fidelity.minimumRegisterVisibility;
  const significant = pValue === null ? null : pValue <= 0.05;
  const measurementDeterminate = fisherGate.execute;
  const reportStatus = !measurementDeterminate
    ? 'measurement_indeterminate_no_fisher_no_rerun'
    : fidelityPassed
      ? 'complete_registered_confirmation'
      : 'failed_interpretability_gate_not_rerun';
  return {
    schema:
      loaded.registration.version >= 9
        ? 'machinespirits.tutor-stub.resistance-action-register-confirmation-report.v2'
        : 'machinespirits.tutor-stub.resistance-action-register-confirmation-report.v1',
    status: reportStatus,
    source: {
      analysis_commit: current,
      analysis_tree: currentTree,
      batch_commits: Object.fromEntries(
        BATCH_IDS.map((id) => [id, batches.find((batch) => batch.plan.batch_id === id).plan.source.commit]),
      ),
    },
    registration: { path: registrationPath, sha256: loaded.sha256 },
    assembly: {
      batches_complete: 9,
      dialogues: 36,
      plain: 18,
      warm: 18,
      fresh_independent_dialogues: true,
      calibration_dialogues_reused: 0,
      calibration_dialogues_pooled: 0,
      partial_or_interim_interpretation_permitted: false,
      valid_unit_reruns: false,
      outcome_selection: false,
      reservations_by_batch: reservationsByBatch,
      total_model_attempt_reservations: totalReservations,
      operational_attempt_ceiling: caps.combined,
    },
    rows,
    primary_analysis: measurementDeterminate
      ? {
          ...(loaded.registration.version >= 9
            ? { status: 'complete', authority: 'independent_v8_three_judge_semantic_panel' }
            : {}),
          endpoint: 'profile_specific_resistance_recovery',
          test: 'fisher_exact_two_sided',
          alpha: 0.05,
          plain: { recovered: plainRecovered, total: 18, rate: plainRate },
          warm: { recovered: warmRecovered, total: 18, rate: warmRate },
          warm_minus_plain_risk_difference: warmRate - plainRate,
          odds_ratio:
            warmRecovered * (18 - plainRecovered) === 0 || plainRecovered * (18 - warmRecovered) === 0
              ? null
              : (warmRecovered * (18 - plainRecovered)) / (plainRecovered * (18 - warmRecovered)),
          p_value: pValue,
          significant_two_sided: significant,
          direction: warmRate > plainRate ? 'warm_higher' : warmRate < plainRate ? 'plain_higher' : 'equal',
          registered_decision: significant ? 'warm_plain_separation_confirmed' : 'warm_plain_separation_not_confirmed',
        }
      : {
          status: 'withheld_measurement_indeterminate',
          endpoint: 'profile_specific_resistance_recovery',
          test: 'fisher_exact_two_sided',
          executed: false,
          reason: 'one_or_more_dialogues_lack_a_determinate_registered_semantic_measurement',
          indeterminate_case_ids: indeterminateRows.map((row) => row.case_id),
          rerun_repair_replacement_or_selection_allowed: false,
        },
    treatment_fidelity: {
      status: !measurementDeterminate
        ? 'measurement_indeterminate_no_rerun'
        : fidelityPassed
          ? 'complete'
          : 'failed_interpretability_gate_not_rerun',
      action_visibility_rate: actionVisibility,
      register_visibility_rate: registerVisibility,
      protected_condition_count: protectedConditionCount,
      protected_condition_rate: protectedConditionCount / 36,
      safety_override_count: safetyOverrideCount,
      safety_override_rate: safetyOverrideCount / 36,
      action_visibility_minimum: fidelity.minimumActionVisibility,
      register_visibility_minimum: fidelity.minimumRegisterVisibility,
      primary_analysis: 'intention_to_treat',
      valid_unit_rerun_authorized: false,
    },
    interpretation_status: !measurementDeterminate
      ? 'measurement_indeterminate_no_fisher_no_rerun_or_confirmation_claim'
      : fidelityPassed
        ? 'registered_confirmation_interpretable_within_claim_boundary'
        : 'interpretability_gate_failed_no_rerun_or_confirmation_claim',
    claim_boundary:
      'This report tests only the prospectively registered frame-refuser matched-action warm-versus-plain recovery contrast in 36 fresh independent dialogues. The 12 calibration dialogues are sizing evidence only and are not reused or pooled. No matched-versus-mismatched, edged-register, interaction, general tutor-efficacy, learning, human-validity, or cell-harness claim is licensed.',
  };
}

function parseArgs(argv) {
  const options = { batches: [], allowedBatchSourceCommits: [], registration: REGISTRATION, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (['--json', '--help'].includes(arg)) {
      options[arg.slice(2)] = true;
      continue;
    }
    if (
      ['--batch', '--registration', '--expected-source-commit', '--allowed-batch-source-commit', '--out'].includes(arg)
    ) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--batch') options.batches.push(value);
      else if (arg === '--allowed-batch-source-commit') options.allowedBatchSourceCommits.push(value);
      else options[arg.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

function usage() {
  return 'Usage: node scripts/analyze-tutor-stub-resistance-action-register-confirmation.js --batch <root> (repeat exactly 9 times) --expected-source-commit <clean-analysis-sha> [--allowed-batch-source-commit <sha> (repeat for each immutable batch source)] [--out <fresh.json>] [--json]';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return void console.log(usage());
  if (args.batches.length !== 9 || !args['expected-source-commit']) throw new Error(usage());
  const report = analyzeTutorStubResistanceActionRegisterConfirmation({
    batchRoots: args.batches,
    registrationPath: args.registration,
    expectedSourceCommit: args['expected-source-commit'],
    allowedBatchSourceCommits: args.allowedBatchSourceCommits,
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
