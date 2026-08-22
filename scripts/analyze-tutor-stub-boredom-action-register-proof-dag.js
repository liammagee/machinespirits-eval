#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  exactBlockedScorePValue,
  objectiveProofProgressByTwoTurns,
} from '../services/tutorStubBoredomActionRegisterProofDagPreflight.js';
import {
  TUTOR_STUB_BOREDOM_PROOF_DAG_EXECUTION_START,
  loadTutorStubBoredomProofDagStudy,
} from '../services/tutorStubBoredomActionRegisterProofDagStudy.js';
import { createTutorStubResistanceAxisShadow } from '../services/tutorStubActionBeforeRegisterShadow.js';
import {
  scoreTutorStubResistanceRecovery,
  tutorStubResistanceActionRegisterTreatmentEligibility,
} from '../services/tutorStubResistanceActionRegisterStudy.js';
import {
  buildTutorStubBoredomProofDagBatchPlan,
  buildTutorStubBoredomProofDagRecoveryJob,
} from './run-tutor-stub-boredom-action-register-proof-dag.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v2.json';
const BATCH_IDS = Object.freeze(Array.from({ length: 9 }, (_, index) => `execution_batch_${index + 1}`));

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
    throw new Error(`${plan.batch_id} recovery lacks one preserved technically recoverable incomplete result`);
  }
  const initialValidIds = initialRows.filter((row) => row.status === 'complete').map((row) => row.job_id);
  const missingOrFailedIds = planIds.filter((id) => initialById.get(id)?.status !== 'complete');
  const recoveryRoot = path.join(absolute, 'recoveries', 'recovery-001');
  const recoveryPlanPath = path.join(recoveryRoot, 'recovery-plan.json');
  const recoveryResultPath = path.join(recoveryRoot, 'recovery-result.json');
  if (!fs.existsSync(recoveryPlanPath) || !fs.existsSync(recoveryResultPath)) {
    throw new Error(`${plan.batch_id} recovery provenance is incomplete`);
  }
  const recoveryPlan = readJson(recoveryPlanPath);
  const recoveryResult = readJson(recoveryResultPath);
  const recoveryIds = recoveryPlan.jobs?.map((job) => job.id) || [];
  const recoveryResultIds = recoveryResult.results?.map((row) => row.job_id) || [];
  if (
    recoveryPlan.schema !== 'machinespirits.tutor-stub.boredom-action-register-proof-dag-recovery-plan.v1' ||
    recoveryResult.schema !== 'machinespirits.tutor-stub.boredom-action-register-proof-dag-recovery-result.v1' ||
    recoveryPlan.batch_id !== plan.batch_id ||
    recoveryResult.batch_id !== plan.batch_id ||
    recoveryPlan.original_plan_sha256 !== sha256(fs.readFileSync(planPath)) ||
    recoveryPlan.original_result_sha256 !== sha256(fs.readFileSync(initialResultPath)) ||
    JSON.stringify(recoveryPlan.source) !== JSON.stringify(plan.source) ||
    recoveryPlan.hard_ceiling !== 240 ||
    !sameIds(recoveryPlan.valid_unit_ids_excluded || [], initialValidIds) ||
    !sameIds(recoveryIds, missingOrFailedIds) ||
    !sameIds(recoveryResultIds, missingOrFailedIds) ||
    recoveryResult.results.some((row) => row.status !== 'complete') ||
    seal.recovery_plan_sha256 !== sha256(fs.readFileSync(recoveryPlanPath)) ||
    seal.recovery_result_sha256 !== sha256(fs.readFileSync(recoveryResultPath)) ||
    result.technical_recovery_used !== true ||
    !sameIds(result.recovery_unit_ids || [], missingOrFailedIds)
  ) {
    throw new Error(`${plan.batch_id} recovery reran a valid unit or drifted`);
  }
  const loaded = loadTutorStubBoredomProofDagStudy({
    registrationPath: path.resolve(ROOT, plan.source.registration_path),
  });
  const recoveryJobs = new Map(recoveryPlan.jobs.map((job) => [job.id, job]));
  const recoveryRows = new Map(recoveryResult.results.map((row) => [row.job_id, row]));
  const finalRows = new Map(result.results.map((row) => [row.job_id, row]));
  const reservationsByJob = new Map();
  const finalTraceBudgetByJob = new Map();
  let usedReservationsBeforeRecovery = 0;
  for (const job of plan.jobs) {
    const initialFiles = traceFiles(job.command.trace_dir);
    if (initialFiles.length > 1) throw new Error(`${plan.batch_id} initial unit ${job.id} contains alternatives`);
    const initialReservations = reservationCount(job.command.trace_dir);
    usedReservationsBeforeRecovery += initialReservations;
    const initialRow = initialById.get(job.id);
    const finalRow = finalRows.get(job.id);
    if (initialValidIds.includes(job.id)) {
      exactTraceDirectory(initialRow, job.command, `initial valid boredom proof-DAG unit ${job.id}`);
      if (
        finalRow?.origin !== 'initial_valid_unit' ||
        finalRow.trace !== initialRow.trace ||
        finalRow.trace_sha256 !== initialRow.trace_sha256
      ) {
        throw new Error(`${plan.batch_id} rewrote initially valid unit ${job.id}`);
      }
      reservationsByJob.set(job.id, initialReservations);
      finalTraceBudgetByJob.set(job.id, 60);
      continue;
    }
    const recoveryJob = recoveryJobs.get(job.id);
    const recoveryRow = recoveryRows.get(job.id);
    const expectedRecoveryJob = buildTutorStubBoredomProofDagRecoveryJob({
      loaded,
      job,
      destination: recoveryRoot,
      priorModelAttemptReservations: initialReservations,
    });
    if (JSON.stringify(recoveryJob) !== JSON.stringify(expectedRecoveryJob)) {
      throw new Error(`${plan.batch_id} recovery command drifted for ${job.id}`);
    }
    exactTraceDirectory(recoveryRow, recoveryJob.command, `recovered boredom proof-DAG unit ${job.id}`);
    const recoveryReservations = reservationCount(recoveryJob.command.trace_dir);
    if (
      finalRow?.origin !== 'bounded_technical_recovery_missing_or_failed_unit' ||
      finalRow.trace !== recoveryRow.trace ||
      finalRow.trace_sha256 !== recoveryRow.trace_sha256
    ) {
      throw new Error(`${plan.batch_id} recovery provenance drifted for ${job.id}`);
    }
    reservationsByJob.set(job.id, initialReservations + recoveryReservations);
    finalTraceBudgetByJob.set(job.id, recoveryJob.recovery.remaining_model_attempt_reservations);
  }
  const total = [...reservationsByJob.values()].reduce((sum, value) => sum + value, 0);
  if (
    [...reservationsByJob.values()].some((value) => value > 60) ||
    total > 240 ||
    recoveryPlan.used_reservations_before_recovery !== usedReservationsBeforeRecovery ||
    result.observed_model_attempt_reservations !== total ||
    seal.observed_model_attempt_reservations !== total ||
    JSON.stringify(result.observed_model_attempt_reservations_by_job) !==
      JSON.stringify(Object.fromEntries(reservationsByJob)) ||
    JSON.stringify(seal.observed_model_attempt_reservations_by_job) !==
      JSON.stringify(Object.fromEntries(reservationsByJob)) ||
    seal.result_sha256 !== sha256(fs.readFileSync(resultPath))
  ) {
    throw new Error(`${plan.batch_id} recovery exceeded or misreported its unchanged caps`);
  }
  return { recoveredIds: new Set(missingOrFailedIds), reservationsByJob, finalTraceBudgetByJob };
}

function exactBatch(batchRoot, expectedSourceCommit, expectedSourceTree, registrationPath) {
  const absolute = path.resolve(ROOT, batchRoot);
  const planPath = path.join(absolute, 'batch-plan.json');
  const initialResultPath = path.join(absolute, 'batch-result.json');
  const finalResultPath = path.join(absolute, 'batch-final-result.json');
  const sealPath = path.join(absolute, 'batch-seal.json');
  if (![planPath, initialResultPath, sealPath].every(fs.existsSync)) throw new Error(`${batchRoot} is not sealed`);
  const plan = readJson(planPath);
  const initial = readJson(initialResultPath);
  const result = fs.existsSync(finalResultPath) ? readJson(finalResultPath) : initial;
  const resultPath = fs.existsSync(finalResultPath) ? finalResultPath : initialResultPath;
  const seal = readJson(sealPath);
  if (
    plan.schema !== 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-plan.v1' ||
    initial.schema !== 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-result.v1' ||
    result.schema !== 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-result.v1' ||
    seal.schema !== 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-seal.v1' ||
    (plan.source?.closure_commit ?? plan.source?.commit) !== expectedSourceCommit ||
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
    seal.hard_ceiling !== 240 ||
    seal.valid_unit_reruns !== false ||
    seal.outcome_selection !== false
  ) {
    throw new Error(`${batchRoot} violates its source, result, or seal contract`);
  }
  // Re-derived without a commit pin. Only `jobs`, `design` and `budget` are
  // compared below, and none of them depend on the source snapshot — passing a
  // pin here would only re-run a byte check over the runner's own code, which
  // is what stranded the first attempt at this analysis.
  const recomputed = buildTutorStubBoredomProofDagBatchPlan({
    registrationPath,
    batchId: plan.batch_id,
    destination: absolute,
  });
  if (
    path.resolve(ROOT, plan.destination) !== absolute ||
    JSON.stringify(plan.jobs) !== JSON.stringify(recomputed.jobs) ||
    JSON.stringify(plan.design) !== JSON.stringify(recomputed.design) ||
    JSON.stringify(plan.budget) !== JSON.stringify(recomputed.budget)
  ) {
    throw new Error(`${plan.batch_id} command or assignment plan drifted`);
  }
  const planJobs = new Map(plan.jobs.map((job) => [job.id, job]));
  if (
    planJobs.size !== 4 ||
    !Array.isArray(result.results) ||
    result.results.length !== 4 ||
    new Set(result.results.map((row) => row.job_id)).size !== 4 ||
    result.results.some((row) => row.status !== 'complete' || !planJobs.has(row.job_id))
  ) {
    throw new Error(`${plan.batch_id} does not contain its four exact complete jobs`);
  }
  if (fs.existsSync(finalResultPath)) {
    return {
      absolute,
      plan,
      result,
      planJobs,
      ...auditRecovery({ absolute, plan, initial, result, seal, planPath, initialResultPath, resultPath }),
    };
  }
  if (
    initial.status !== 'complete' ||
    result.technical_recovery_used === true ||
    (result.recovery_unit_ids || []).length ||
    fs.existsSync(path.join(absolute, 'recoveries')) ||
    seal.recovery_plan_sha256 ||
    seal.recovery_result_sha256
  ) {
    throw new Error(`${plan.batch_id} has inconsistent no-recovery provenance`);
  }
  const reservationsByJob = new Map();
  const finalTraceBudgetByJob = new Map();
  for (const job of plan.jobs) {
    const row = result.results.find((candidate) => candidate.job_id === job.id);
    exactTraceDirectory(row, job.command, `boredom proof-DAG unit ${job.id}`);
    const count = reservationCount(job.command.trace_dir);
    if (count > 60) throw new Error(`${job.id} exceeds its 60-reservation cap`);
    reservationsByJob.set(job.id, count);
    finalTraceBudgetByJob.set(job.id, 60);
  }
  if ([...reservationsByJob.values()].reduce((sum, value) => sum + value, 0) > 240) {
    throw new Error(`${plan.batch_id} exceeds its 240-reservation cap`);
  }
  return { absolute, plan, result, planJobs, recoveredIds: new Set(), reservationsByJob, finalTraceBudgetByJob };
}

function metric(model, field) {
  const value = model?.metrics?.[field] ?? model?.assessment?.[field];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function assertAttemptEnvelope(events, job, outcomeTurn, finalTraceBudget, plan, observationSemantics) {
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
    if (event.role === 'tutor_stub_boredom_performance_adjudication') {
      return observationSemantics === 'prospective_v9' && turn >= 1 && turn <= 2;
    }
    if (event.role === 'tutor_stub_auto_learner' || event.role === 'tutor_stub_learner_analysis') {
      return turn >= 1 && turn <= outcomeTurn;
    }
    return allowedTutorRoles.has(event.role) && turn >= 1 && turn < outcomeTurn;
  });
  const required = [
    ['tutor_stub_opening', 0],
    ...Array.from({ length: outcomeTurn }, (_, index) => ['tutor_stub_auto_learner', index + 1]),
    ...Array.from({ length: outcomeTurn }, (_, index) => ['tutor_stub_learner_analysis', index + 1]),
    ...Array.from({ length: outcomeTurn - 1 }, (_, index) => ['tutor_stub_tutor', index + 1]),
  ].every(([role, turn]) => calls.some((event) => event.role === role && Number(event.turn) === turn));
  const semanticRequired =
    observationSemantics !== 'prospective_v9' ||
    Array.from({ length: Math.min(2, outcomeTurn - 2) }, (_, index) => index + 1).every((turn) =>
      calls.some(
        (event) => event.role === 'tutor_stub_boredom_performance_adjudication' && Number(event.turn) === turn,
      ),
    );
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
    recipe?.config?.identity?.world?.id !== job.world ||
    metadata?.experiment?.runSeed !== job.seed ||
    metadata?.experiment?.profile !== 'bored' ||
    metadata?.experiment?.policy !== 'field' ||
    metadata?.experiment?.repeat !== job.assignment_index ||
    metadata?.experiment?.jobId !== job.id ||
    metadata?.autoLearner?.observationSemantics !== observationSemantics ||
    metadata?.autoLearner?.maxTurns !== 4 ||
    metadata?.autoLearner?.profileId !== 'bored' ||
    metadata?.autoLearner?.modelRef !== 'codex.gpt-5.6-luna' ||
    metadata?.lab?.admission?.modelCallBudget !== finalTraceBudget ||
    options?.['cli-effort'] !== 'low' ||
    options?.['run-seed'] !== String(job.seed) ||
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
    semanticRequired !== true ||
    allowed !== true ||
    exactReservations !== true ||
    attempts.some(
      (event) =>
        event.provider !== 'codex' ||
        event.model !== (event.role === 'tutor_stub_boredom_performance_adjudication' ? 'gpt-5.6-sol' : 'gpt-5.6-luna'),
    ) ||
    calls.some((event) => event.response?.effort !== 'low') ||
    attempts
      .filter((event) => event.type !== 'model_call')
      .some((event) => event.request?.cliEffort !== 'low' && event.request?.config?.cliEffort !== 'low')
  ) {
    throw new Error(`${job.id} violates its observed route, source, world, horizon, or attempt pins`);
  }
  return { calls: calls.length, attempts: attempts.length, reservations: reservations.length };
}

function analyzeTrace(batch, resultRow, loaded) {
  const job = batch.planJobs.get(resultRow.job_id);
  if (!job) throw new Error(`result ${resultRow.job_id} is not planned`);
  const tracePath = path.resolve(ROOT, resultRow.trace);
  const source = fs.readFileSync(tracePath);
  if (sha256(source) !== resultRow.trace_sha256) throw new Error(`trace digest drift for ${job.id}`);
  const events = readTrace(tracePath);
  const starts = events.filter((event) => event.type === TUTOR_STUB_BOREDOM_PROOF_DAG_EXECUTION_START);
  const runStarts = events.filter((event) => event.type === 'run_start');
  const oldStarts = events.filter((event) => event.type === 'resistance_action_register_execution_start');
  const interventions = events.filter((event) => event.type === 'resistance_action_register_intervention_applied');
  const outcomes = events.filter((event) => event.type === 'resistance_action_register_outcome_learner_turn');
  const exhausted = events.filter(
    (event) =>
      event.type === 'resistance_action_register_boredom_proof_dag_substantive_failure' ||
      (event.type === 'auto_learner_profile_adherence_exhausted' && event.profile === 'bored'),
  );
  const completed = events.filter((event) => event.type === 'turn_complete' && event.turnRecord);
  const semanticEvents = events.filter((event) => event.type === 'boredom_semantic_adjudication');
  const semanticIndeterminate = events.filter((event) => event.type === 'boredom_semantic_measurement_indeterminate');
  const learnerRepairs = events.filter((event) => event.type === 'auto_learner_profile_repair_requested');
  const semanticMode = loaded.registration.design.observationSemantics === 'prospective_v9';
  if (
    runStarts.length !== 1 ||
    starts.length !== 1 ||
    oldStarts.length ||
    interventions.length !== 1 ||
    outcomes.length !== 1 ||
    exhausted.length ||
    (semanticMode && (semanticIndeterminate.length || learnerRepairs.length))
  ) {
    throw new Error(`${job.id} lacks its exact fresh execution, treatment, or outcome event`);
  }
  const triggerTurn = Number(interventions[0].turn);
  const outcomeTurn = Number(outcomes[0].turn);
  if (![1, 2].includes(triggerTurn) || outcomeTurn !== triggerTurn + 2 || outcomes[0].tutorReplyGenerated !== false) {
    throw new Error(`${job.id} violates the by-T2 trigger or two-turn outcome horizon`);
  }
  const expectedCompletedTurns = Array.from({ length: outcomeTurn - 1 }, (_, index) => index + 1);
  if (JSON.stringify(completed.map((event) => Number(event.turn))) !== JSON.stringify(expectedCompletedTurns)) {
    throw new Error(`${job.id} lacks its exact unique public turn sequence`);
  }
  const start = starts[0];
  const intervention = interventions[0].intervention;
  const assignment = intervention?.assignment;
  if (
    start.jobId !== job.id ||
    start.batchId !== job.batch_id ||
    start.assignmentIndex !== job.assignment_index ||
    start.runSeed !== job.seed ||
    start.world !== job.world ||
    start.registrationSha256 !== loaded.sha256 ||
    start.assignmentManifestSha256 !== job.assignment_manifest_sha256 ||
    start.assignmentRankSha256 !== job.assignment_rank_sha256 ||
    start.freshIndependentDialogue !== true ||
    start.priorDialogueReused !== false ||
    start.priorOutcomePooled !== false ||
    assignment?.action_fit !== 'matched' ||
    assignment?.pedagogical_move !== 'ask_discriminating_question' ||
    assignment?.realization !== job.realization ||
    assignment?.register !== job.realization ||
    assignment?.repeat !== job.batch_id ||
    assignment?.batch_id !== job.batch_id
  ) {
    throw new Error(`${job.id} drifted from its blocked randomized assignment`);
  }
  const trigger = completed.find((event) => Number(event.turn) === triggerTurn)?.turnRecord;
  const postOne = completed.find((event) => Number(event.turn) === triggerTurn + 1)?.turnRecord;
  const postTwo = outcomes[0];
  const triggerHash = sha256(String(trigger?.learner || ''));
  const triggerShadow = createTutorStubResistanceAxisShadow({
    learnerText: trigger?.learner,
    classification: trigger?.classification,
    tutorLearnerDag: trigger?.tutorLearnerDagModel,
    semantics: loaded.registration.design.observationSemantics,
  });
  const semanticByTurn = new Map(semanticEvents.map((event) => [Number(event.turn), event.adjudication]));
  const triggerSemanticAdjudication = semanticByTurn.get(triggerTurn) || null;
  const exactSemanticSequence =
    !semanticMode ||
    (semanticEvents.length === triggerTurn &&
      semanticEvents.every((event, index) => {
        const turn = index + 1;
        const completedTurn = completed.find((candidate) => Number(candidate.turn) === turn)?.turnRecord;
        const adjudication = event.adjudication;
        return (
          Number(event.turn) === turn &&
          adjudication?.candidate_sha256 === sha256(String(completedTurn?.learner || '')) &&
          adjudication?.independent_route?.required_model_ref === 'codex.gpt-5.6-sol' &&
          adjudication?.independent_route?.matches === true &&
          adjudication?.low_confidence === false &&
          adjudication?.parse_ok === true &&
          adjudication?.measurement_disposition !== 'measurement_indeterminate' &&
          (turn === triggerTurn
            ? adjudication?.measurement_disposition === 'actionable_boredom'
            : adjudication?.measurement_disposition !== 'actionable_boredom')
        );
      }));
  const earlierEligible = semanticMode
    ? semanticEvents.some(
        (event) =>
          Number(event.turn) < triggerTurn && event.adjudication?.measurement_disposition === 'actionable_boredom',
      )
    : completed
        .filter((event) => Number(event.turn) < triggerTurn)
        .some(
          (event) =>
            createTutorStubResistanceAxisShadow({
              learnerText: event.turnRecord.learner,
              classification: event.turnRecord.classification,
              tutorLearnerDag: event.turnRecord.tutorLearnerDagModel,
              semantics: loaded.registration.design.observationSemantics,
            }).resistance_kind === 'bored',
        );
  const triggerEligibility = trigger
    ? tutorStubResistanceActionRegisterTreatmentEligibility({
        runtime: {
          consumed: false,
          profile: 'bored',
          dynamic_boredom_proof_dag: true,
          registration: {
            design: { trigger: { observationSemantics: loaded.registration.design.observationSemantics } },
          },
          proof_dag_registration: loaded.registration,
        },
        learnerText: trigger.learner,
        classification: trigger.classification,
        tutorLearnerDag: trigger.tutorLearnerDagModel,
        semanticAdjudication: triggerSemanticAdjudication,
      })
    : null;
  if (
    !trigger ||
    !postOne ||
    !postTwo ||
    (!semanticMode && triggerShadow.resistance_kind !== 'bored') ||
    (!semanticMode && triggerShadow.warrant?.status !== 'licensed') ||
    triggerShadow.profile_identity_used !== false ||
    triggerEligibility?.eligible !== true ||
    (semanticMode
      ? triggerEligibility?.boredom_semantic_precedence?.final_authority !== 'independent_llm_semantic_adjudicator'
      : triggerEligibility?.boredom_compositional_precedence?.generic_uptake_override_allowed !== false) ||
    !exactSemanticSequence ||
    earlierEligible ||
    interventions[0].triggerTurn !== triggerTurn ||
    interventions[0].triggerLearnerSha256 !== triggerHash ||
    postTwo.triggerTurn !== triggerTurn ||
    postTwo.triggerLearnerSha256 !== triggerHash
  ) {
    throw new Error(`${job.id} lacks its first eligible fresh public boredom trigger provenance`);
  }
  const prefixTurns = completed
    .filter((event) => Number(event.turn) <= triggerTurn)
    .map((event) => ({
      turn: Number(event.turn),
      learner: event.turnRecord.learner,
      ...(Number(event.turn) < triggerTurn ? { tutor: event.turnRecord.tutor } : {}),
    }));
  const prefixSha256 = sha256(JSON.stringify({ world: job.world, turns: prefixTurns }));
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
    typeof responseAudit?.axes?.action_family?.visible !== 'boolean' ||
    typeof deliveredRegisterVisible !== 'boolean' ||
    typeof safety?.applied !== 'boolean' ||
    responseAudit?.axes?.action_family?.selected !== 'stage_next_step' ||
    responseAudit?.axes?.engagement_stance?.selected !== expectedDeliveredRegister ||
    protectedCondition !== safetyOverrideNonadherent
  ) {
    throw new Error(`${job.id} lacks adherent typed action/register visibility evidence`);
  }
  const observed = assertAttemptEnvelope(
    events,
    job,
    outcomeTurn,
    batch.finalTraceBudgetByJob.get(job.id),
    batch.plan,
    loaded.registration.design.observationSemantics,
  );
  const recovery = scoreTutorStubResistanceRecovery({
    profile: 'bored',
    triggerLearnerText: trigger.learner,
    postLearnerTurns: [
      { learnerText: postOne.learner, classification: postOne.classification },
      { learnerText: postTwo.learnerText, classification: postTwo.classification },
    ],
  });
  const initialGrounded = metric(trigger.tutorLearnerDagModel, 'groundedCount');
  const finalGrounded = metric(postTwo.tutorLearnerDag?.model, 'groundedCount');
  const initialCoverage = metric(trigger.tutorLearnerDagModel, 'bestPathCoverage');
  const finalCoverage = metric(postTwo.tutorLearnerDag?.model, 'bestPathCoverage');
  const initialDebt = metric(trigger.tutorLearnerDagModel, 'missingPremiseCount');
  const finalDebt = metric(postTwo.tutorLearnerDag?.model, 'missingPremiseCount');
  const finalUnsupported = metric(postTwo.tutorLearnerDag?.model, 'unsupportedAssertionCount');
  if (
    [initialGrounded, finalGrounded, initialCoverage, finalCoverage, initialDebt, finalDebt, finalUnsupported].some(
      (v) => v === null,
    )
  ) {
    throw new Error(`${job.id} lacks its objective proof-DAG endpoint`);
  }
  const objectiveOutcome = {
    new_supported_public_premises: Math.max(0, finalGrounded - initialGrounded),
    best_path_coverage_delta: finalCoverage - initialCoverage,
    proof_debt_delta: finalDebt - initialDebt,
    unsupported_public_claims: finalUnsupported,
  };
  objectiveOutcome.proof_progress_by_two_turns = objectiveProofProgressByTwoTurns(objectiveOutcome);
  return {
    case_id: job.id,
    batch_id: job.batch_id,
    world: job.world,
    seed: job.seed,
    assignment_index: job.assignment_index,
    assignment_rank_sha256: job.assignment_rank_sha256,
    assignment_manifest_sha256: job.assignment_manifest_sha256,
    arm: job.realization,
    profile: 'bored',
    pedagogical_move: job.pedagogical_move,
    realization: job.realization,
    prefix_id: `${job.id}:${prefixSha256}`,
    public_prefix_sha256: prefixSha256,
    trigger: { observed_by_turn: triggerTurn, profile: 'bored', profile_identity_used: false },
    ...(semanticMode
      ? {
          semantic_measurement: {
            authority: 'independent_llm_semantic_adjudicator',
            model_ref: 'codex.gpt-5.6-sol',
            adjudications: semanticEvents.length,
            trigger_disposition: triggerSemanticAdjudication.measurement_disposition,
            regex_role: 'auxiliary_only',
            measurement_indeterminate: false,
          },
        }
      : {}),
    outcome: { ...recovery, ...objectiveOutcome },
    fidelity: {
      action_visible: responseAudit.axes.action_family.visible,
      register_visible: registerVisible,
      safety_override: safety.applied === true,
      protected_condition: protectedCondition,
    },
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

function blockedRows(rows, outcomeField) {
  return [...new Set(rows.map((row) => row.world))].sort().map((world) => {
    const worldRows = rows.filter((row) => row.world === world);
    const plain = worldRows.filter((row) => row.arm === 'plain');
    const warm = worldRows.filter((row) => row.arm === 'warm');
    return {
      world,
      plainN: plain.length,
      warmN: warm.length,
      plainSuccesses: plain.filter((row) => row.outcome[outcomeField] === true).length,
      warmSuccesses: warm.filter((row) => row.outcome[outcomeField] === true).length,
    };
  });
}

function blockedAnalysis(rows, outcomeField) {
  const blocks = blockedRows(rows, outcomeField);
  const plain = rows.filter((row) => row.arm === 'plain');
  const warm = rows.filter((row) => row.arm === 'warm');
  const plainSuccesses = plain.filter((row) => row.outcome[outcomeField] === true).length;
  const warmSuccesses = warm.filter((row) => row.outcome[outcomeField] === true).length;
  return {
    test: 'two_sided_exact_conditional_blocked_score_test',
    conditioning: 'world_success_totals_and_three_plain_three_warm_allocation',
    two_sided_rule: 'sum_conditional_score_probabilities_no_greater_than_observed_score_probability',
    alpha: 0.05,
    plain: { successes: plainSuccesses, total: plain.length, rate: plainSuccesses / plain.length },
    warm: { successes: warmSuccesses, total: warm.length, rate: warmSuccesses / warm.length },
    warm_minus_plain_risk_difference: warmSuccesses / warm.length - plainSuccesses / plain.length,
    p_value: exactBlockedScorePValue(blocks),
    blocks,
  };
}

export function analyzeTutorStubBoredomProofDag({
  batchRoots,
  registrationPath = REGISTRATION,
  expectedSourceCommit,
} = {}) {
  if (
    !Array.isArray(batchRoots) ||
    batchRoots.length !== 9 ||
    new Set(batchRoots.map((root) => path.resolve(ROOT, root))).size !== 9
  ) {
    throw new Error('boredom proof-DAG analysis requires nine distinct predeclared batch roots');
  }
  // The invariant worth holding is that all nine batches came from one source
  // state — not that the analysing checkout still matches it. So the pin is
  // read out of the sealed batches themselves and every batch is required to
  // agree with the others. Analysis can then run later, from a moved-on tree,
  // and a code correction between the run and the analysis cannot strand the
  // data. `expectedSourceCommit` stays available for a caller that wants to
  // assert which commit it believes produced the batches.
  const firstPlanPath = path.join(path.resolve(ROOT, batchRoots[0]), 'batch-plan.json');
  if (!fs.existsSync(firstPlanPath)) throw new Error(`${batchRoots[0]} is not sealed`);
  const firstPlan = readJson(firstPlanPath);
  const pinnedCommit = firstPlan.source?.closure_commit ?? firstPlan.source?.commit;
  const pinnedTree = firstPlan.source?.tree;
  if (!pinnedCommit || !pinnedTree) {
    throw new Error('boredom proof-DAG analysis requires the batches to record their source commit and tree');
  }
  if (expectedSourceCommit && expectedSourceCommit !== pinnedCommit) {
    throw new Error(`boredom proof-DAG batches were produced at ${pinnedCommit}, not ${expectedSourceCommit}`);
  }
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.resolve(ROOT, registrationPath) });
  const batches = batchRoots.map((root) => exactBatch(root, pinnedCommit, pinnedTree, registrationPath));
  if (JSON.stringify(batches.map((batch) => batch.plan.batch_id).sort()) !== JSON.stringify([...BATCH_IDS])) {
    throw new Error('boredom proof-DAG analysis requires all nine registered batches exactly once');
  }
  if (batches.some((batch) => batch.plan.source.registration_sha256 !== loaded.sha256)) {
    throw new Error('boredom proof-DAG registration digest drifted across batches');
  }
  const rows = batches.flatMap((batch) => batch.result.results.map((row) => analyzeTrace(batch, row, loaded)));
  const plain = rows.filter((row) => row.arm === 'plain');
  const warm = rows.filter((row) => row.arm === 'warm');
  if (
    rows.length !== 36 ||
    plain.length !== 18 ||
    warm.length !== 18 ||
    new Set(rows.map((row) => row.case_id)).size !== 36 ||
    new Set(rows.map((row) => row.seed)).size !== 36 ||
    new Set(rows.map((row) => row.public_prefix_sha256)).size !== 36 ||
    new Set(rows.map((row) => row.execution.trace_sha256)).size !== 36
  ) {
    throw new Error('boredom proof-DAG analysis requires 36 distinct fresh independent dialogues, 18 per arm');
  }
  for (const world of loaded.registration.design.worlds) {
    const worldRows = rows.filter((row) => row.world === world);
    if (
      worldRows.length !== 6 ||
      worldRows.filter((row) => row.arm === 'plain').length !== 3 ||
      worldRows.filter((row) => row.arm === 'warm').length !== 3
    ) {
      throw new Error(`boredom proof-DAG world block ${world} is not exactly three plain and three warm`);
    }
  }
  const reservationsByBatch = Object.fromEntries(
    BATCH_IDS.map((id) => [
      id,
      rows.filter((row) => row.batch_id === id).reduce((sum, row) => sum + row.execution.model_attempt_reservations, 0),
    ]),
  );
  if (Object.values(reservationsByBatch).some((value) => value > 240)) {
    throw new Error('boredom proof-DAG analysis refuses a batch above 240 reservations');
  }
  const totalReservations = Object.values(reservationsByBatch).reduce((sum, value) => sum + value, 0);
  if (totalReservations > 2160) throw new Error('boredom proof-DAG analysis refuses a run above 2160 reservations');
  const primary = blockedAnalysis(rows, 'recovered');
  const keySecondary = blockedAnalysis(rows, 'proof_progress_by_two_turns');
  const primaryRejects = primary.p_value <= 0.05;
  const keySecondaryRejects = primaryRejects && keySecondary.p_value <= 0.05;
  const actionVisibility = rows.filter((row) => row.fidelity.action_visible).length / 36;
  const registerVisibility = rows.filter((row) => row.fidelity.register_visible).length / 36;
  const fidelity = loaded.registration.measurement.treatmentFidelity;
  const fidelityPassed =
    actionVisibility >= fidelity.minimumActionVisibility && registerVisibility >= fidelity.minimumRegisterVisibility;
  return {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-confirmation-report.v1',
    status: fidelityPassed ? 'complete_registered_confirmation' : 'failed_interpretability_gate_not_rerun',
    source: { commit: pinnedCommit, tree: pinnedTree },
    registration: { path: registrationPath, sha256: loaded.sha256 },
    assembly: {
      batches_complete: 9,
      dialogues: 36,
      plain: 18,
      warm: 18,
      worlds: 6,
      distinct_fresh_public_prefixes: 36,
      prior_dialogues_reused: 0,
      prior_outcomes_pooled: 0,
      partial_or_interim_interpretation_permitted: false,
      valid_unit_reruns: false,
      outcome_selection: false,
      reservations_by_batch: reservationsByBatch,
      total_model_attempt_reservations: totalReservations,
    },
    rows,
    primary_analysis: {
      endpoint: 'profile_specific_resistance_recovery',
      ...primary,
      significant_two_sided: primaryRejects,
      registered_decision: primaryRejects
        ? 'warm_plain_recovery_separation_confirmed'
        : 'warm_plain_recovery_not_confirmed',
    },
    key_secondary_analysis: {
      endpoint: 'objective_proof_progress_by_two_turns',
      ...keySecondary,
      fixed_sequence_gate_open: primaryRejects,
      significant_two_sided_under_fixed_sequence: keySecondaryRejects,
      registered_decision: !primaryRejects
        ? 'not_tested_inferentially_primary_gate_closed'
        : keySecondaryRejects
          ? 'warm_plain_objective_proof_progress_separation_confirmed'
          : 'objective_proof_progress_separation_not_confirmed',
    },
    treatment_fidelity: {
      status: fidelityPassed ? 'complete' : 'failed_interpretability_gate_not_rerun',
      action_visibility_rate: actionVisibility,
      register_visibility_rate: registerVisibility,
      protected_condition_count: rows.filter((row) => row.fidelity.protected_condition).length,
      safety_override_count: rows.filter((row) => row.fidelity.safety_override).length,
      action_visibility_minimum: fidelity.minimumActionVisibility,
      register_visibility_minimum: fidelity.minimumRegisterVisibility,
      primary_analysis: 'intention_to_treat',
      valid_unit_rerun_authorized: false,
    },
    interpretation_status: fidelityPassed
      ? 'registered_confirmation_interpretable_within_claim_boundary'
      : 'interpretability_gate_failed_no_rerun_or_confirmation_claim',
    claim_boundary:
      'This report tests only the prospectively registered bored matched-action warm-versus-plain recovery primary and fixed-sequence objective proof-progress secondary in 36 fresh independent strict-DAG dialogues. Prior held-out detection, historical action-fit, and 12-dialogue calibration outcomes are neither reused nor pooled. No action-fit, interaction, edged-register, general tutor-efficacy, durable-learning, human-validity, or cell-harness claim is licensed.',
  };
}

function parseArgs(argv) {
  const options = { batches: [], registration: REGISTRATION, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (['--json', '--help'].includes(arg)) {
      options[arg.slice(2)] = true;
      continue;
    }
    if (['--batch', '--registration', '--expected-source-commit', '--out'].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--batch') options.batches.push(value);
      else options[arg.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

function usage() {
  return 'Usage: node scripts/analyze-tutor-stub-boredom-action-register-proof-dag.js --batch <root> (repeat exactly 9 times) --expected-source-commit <sha> [--out <fresh.json>] [--json]';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return void console.log(usage());
  if (args.batches.length !== 9 || !args['expected-source-commit']) throw new Error(usage());
  const report = analyzeTutorStubBoredomProofDag({
    batchRoots: args.batches,
    registrationPath: args.registration,
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
