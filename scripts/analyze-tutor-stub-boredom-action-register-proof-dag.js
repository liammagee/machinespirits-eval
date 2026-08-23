#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  boredomContrastAxis,
  boredomProofProgressNames,
  exactBlockedScoreOneSidedPValue,
  exactBlockedScorePValue,
  objectiveProofProgress,
} from '../services/tutorStubBoredomActionRegisterProofDagPreflight.js';
import {
  TUTOR_STUB_BOREDOM_PROOF_DAG_EXECUTION_START,
  TUTOR_STUB_BOREDOM_UNREADABLE_TURN_PASS_OVER_DISPOSITION,
  loadTutorStubBoredomProofDagStudy,
} from '../services/tutorStubBoredomActionRegisterProofDagStudy.js';
import { createTutorStubResistanceAxisShadow } from '../services/tutorStubActionBeforeRegisterShadow.js';
import {
  scoreTutorStubResistanceRecovery,
  scoreTutorStubResistanceRecoveryWithinHorizon,
  tutorStubResistanceActionRegisterTreatmentEligibility,
  tutorStubResistanceHostActionFamily,
} from '../services/tutorStubResistanceActionRegisterStudy.js';
import {
  buildTutorStubBoredomProofDagBatchPlan,
  buildTutorStubBoredomProofDagRecoveryJob,
  isRegisteredStop,
} from './run-tutor-stub-boredom-action-register-proof-dag.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// There is deliberately no default registration path. A default is a study
// version written by hand in one place and never compared with the batches
// being read, so a v5 run analysed with the flag left off would have been
// scored silently against v2's window. Every caller passes the path, so
// requiring it costs nothing and removes the silent-wrong-study case.
// How many batches, dialogues and worlds a study runs is a property of the
// registration, not of this file. Written out as nine and thirty-six it was the
// same fault this arc keeps closing one layer down: a count kept in two places
// with nothing comparing them. v7 runs 84 dialogues in 21 batches, so the counts
// are now read from the registration and every check below asks it.
function batchIds(count) {
  return Array.from({ length: count }, (_, index) => `execution_batch_${index + 1}`);
}
// What this file calls the two axis fields on a report row. The reading of
// which axis is contrasted lives in the preflight service, because the endpoint
// preflight needs the same reading and names its own rows differently.
const BOREDOM_REPORT_ROW_FIELDS = Object.freeze({ moveField: 'move_level', mannerField: 'arm' });
// v5 and below hold one action fit for every unit and never write a level onto
// the plan row.
const LEGACY_SINGLE_ACTION_FIT_LEVEL = 'matched';
// The analyzer writes this name into every report, and the GO-request checker
// requires the request to carry the same name. Written out by hand in both
// places, with nothing comparing them, it is the fault this arc keeps closing.
// The checker may import nothing from the repository, so the shared copy cannot
// live in either script: the live name is a field of the registration and both
// sides read it there. Only the frozen v5-and-below spelling stays written out,
// because those registrations predate the field and are never rewritten.
const LEGACY_BOREDOM_CONFIRMATION_REPORT_SCHEMA =
  'machinespirits.tutor-stub.boredom-action-register-proof-dag-confirmation-report.v1';

function reportContrastAxis(registration) {
  return boredomContrastAxis(registration, BOREDOM_REPORT_ROW_FIELDS);
}

// Report prose spells small counts as words, because that is how v2 to v6 wrote
// them and those reports are closed. Above twelve the digits read better anyway.
const COUNT_WORDS = Object.freeze([
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
]);

function countWord(count) {
  return COUNT_WORDS[count] ?? String(count);
}

// Every count the report used to write out by hand, read once from the
// registration the batches were planned under. A study that deals its units out
// some other way is then checked against its own numbers instead of against the
// numbers a shorter study happened to use.
function boredomRegisteredReportShape(registration) {
  const worlds = registration.design.worlds.length;
  const dialogues = Number(
    registration.design.randomization.dialogues ?? registration.executionReadiness.dialogue.dialogues,
  );
  const perWorld = Number(registration.design.randomization.dialoguesPerWorld ?? dialogues / worlds);
  const batches = Number(
    registration.executionReadiness.batches.executionBatches ?? registration.executionReadiness.batches.totalBatches,
  );
  if (
    !Number.isInteger(worlds) ||
    worlds < 1 ||
    !Number.isInteger(dialogues) ||
    !Number.isInteger(batches) ||
    !Number.isInteger(perWorld) ||
    worlds * perWorld !== dialogues ||
    perWorld % 2 !== 0
  ) {
    throw new Error('boredom proof-DAG analysis requires a registration whose world, dialogue and batch counts agree');
  }
  return { worlds, dialogues, perWorld, batches, perArmPerWorld: perWorld / 2 };
}

// Which test the registration actually registered, so the p-value, the labels
// and the decision key all follow one reading. A run registered one-sided that
// reported a two-sided key would be a mismatch no reader could catch.
function boredomRegisteredTest(endpoint, shape) {
  const registeredAnalysis = String(endpoint.analysis ?? '');
  // A secondary endpoint names the test and the order it is read in, in one
  // string. The order is already a separate field of the report, so only the
  // test name goes in the test field.
  const analysis = registeredAnalysis.replace(/_only_after_primary_rejects_under_fixed_sequence$/, '');
  const sided = analysis.startsWith('one_sided') ? 'one' : 'two';
  if (sided === 'one' && !endpoint.direction) {
    throw new Error('a one-sided boredom proof-DAG endpoint must register the direction it tests');
  }
  return {
    analysis,
    registeredAnalysis,
    sided,
    direction: endpoint.direction ?? null,
    alpha: Number(endpoint.alpha ?? 0.05),
    perArmPerWorld: shape.perArmPerWorld,
  };
}

// Words that carry no content of their own. Kept short on purpose: the test
// below asks whether the learner brought anything the tutor had not just said,
// so a long list would start deciding the answer.
const FUNCTION_WORDS = new Set([
  'about',
  'after',
  'again',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'cannot',
  'could',
  'does',
  'each',
  'from',
  'have',
  'having',
  'here',
  'into',
  'just',
  'like',
  'more',
  'most',
  'much',
  'only',
  'other',
  'over',
  'said',
  'same',
  'should',
  'since',
  'some',
  'such',
  'than',
  'that',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'under',
  'until',
  'very',
  'well',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'will',
  'with',
  'would',
  'your',
]);

function contentWords(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z]+/u)
      .filter((word) => word.length >= 4 && !FUNCTION_WORDS.has(word)),
  );
}

// True when the learner turn brought back no content word the tutor had not
// just used. The move under test cuts the next step down to one small action,
// and the registration forbids the tutor from supplying the finding, because a
// learner who scores by repeating the tutor has not recovered. This is the
// deterministic reading of that rule: it counts, it never stops a unit, and it
// is disclosed per move whatever it comes to.
function onlyRestates(learnerText, tutorText) {
  const learner = contentWords(learnerText);
  if (learner.size === 0) return true;
  const tutor = contentWords(tutorText);
  return [...learner].every((word) => tutor.has(word));
}

// The conditioning a registration must already carry for an uneven block to
// need no written amendment. A registration that instead conditions on the
// predeclared three-and-three allocation has no rule for a block that lost a
// unit, so a short study under it still needs one in writing. The string names
// the two levels of whichever axis the study contrasts, so it is built from
// that axis rather than pinned to v5's two manner names.
function realisedCountConditioning(axis) {
  return `condition_on_each_world_success_total_and_that_world_realised_${axis.reference}_and_${axis.treatment}_counts`;
}
// Amendment A1. A batch is sealed complete when all four units finished, and
// sealed with registered stops when the only shortfall is an indeterminate
// measurement that may not be repaired, rerun or replaced. Both seals are the
// same two byte digests over the plan and result files.
const SEAL_STATUSES = Object.freeze(['sealed_complete', 'sealed_with_registered_stops']);

function auditStoppedUnits(result) {
  const stopped = result.results.filter((row) => row.status !== 'complete');
  return {
    completed: result.results.length - stopped.length,
    stopped: stopped.map((row) => row.job_id).sort(),
    allRegistered: stopped.every((row) => isRegisteredStop(row.failure)),
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

// The caps used to be written here as 4 dialogues, 60 attempts a dialogue and
// 240 a batch. The batch plan already carries all three, frozen when the batch
// was planned, so a plan written under one registration can never be audited
// against another registration's numbers. That mismatch is the fault that cost
// v4 twenty-two of its thirty-three objective endpoints, and under v5 it would
// have made this analyzer refuse every dialogue the study paid for.
function planCaps(plan) {
  const budget = plan?.budget || {};
  return {
    batchSize: budget.dialogues,
    perDialogue: budget.maximum_model_attempt_reservations_per_dialogue,
    perBatch: budget.maximum_model_attempt_reservations,
  };
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
  const caps = planCaps(plan);
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
    recoveryPlan.hard_ceiling !== caps.perBatch ||
    !sameIds(recoveryPlan.valid_unit_ids_excluded || [], initialValidIds) ||
    !sameIds(recoveryIds, missingOrFailedIds) ||
    !sameIds(recoveryResultIds, missingOrFailedIds) ||
    // A re-run unit may end in a registered stop. The registration says so, and
    // a stop is not drift: it is one of the two ways a unit is allowed to end.
    // The counts that follow (Amendment A1) prove the result, the seal and the
    // rows all report the same stopped unit, so a stop cannot hide here.
    recoveryResult.results.some((row) => row.status !== 'complete' && !isRegisteredStop(row.failure)) ||
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
      finalTraceBudgetByJob.set(job.id, caps.perDialogue);
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
  const caps = planCaps(plan);
  const stoppedAudit = auditStoppedUnits(result);
  if (
    plan.schema !== 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-plan.v1' ||
    initial.schema !== 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-result.v1' ||
    result.schema !== 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-result.v1' ||
    seal.schema !== 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-seal.v1' ||
    (plan.source?.closure_commit ?? plan.source?.commit) !== expectedSourceCommit ||
    plan.source?.tree !== expectedSourceTree ||
    plan.source?.registration_path !== registrationPath ||
    // Amendment A1: a batch may fall short of four ONLY through registered
    // indeterminate stops, and the shortfall must be the same in the result,
    // in the seal, and in the rows themselves. Every other way of being short
    // still fails here.
    !['complete', 'incomplete'].includes(result.status) ||
    !SEAL_STATUSES.includes(seal.status) ||
    (result.status === 'complete') !== (seal.status === 'sealed_complete') ||
    result.completed_dialogues + result.failed_or_missing_dialogues !== caps.batchSize ||
    result.completed_dialogues !== stoppedAudit.completed ||
    result.failed_or_missing_dialogues !== stoppedAudit.stopped.length ||
    !stoppedAudit.allRegistered ||
    (seal.status === 'sealed_with_registered_stops' &&
      (seal.completed_dialogues !== stoppedAudit.completed ||
        JSON.stringify(seal.registered_indeterminate_stops) !== JSON.stringify(stoppedAudit.stopped))) ||
    seal.batch_id !== plan.batch_id ||
    seal.plan_sha256 !== sha256(fs.readFileSync(planPath)) ||
    seal.result_sha256 !== sha256(fs.readFileSync(resultPath)) ||
    seal.dialogues !== caps.batchSize ||
    seal.hard_ceiling !== caps.perBatch ||
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
    // Amendment A1: all four planned units must still be here. A unit may be
    // stopped, but it may not be missing, renamed or swapped.
    result.results.some(
      (row) => !planJobs.has(row.job_id) || (row.status !== 'complete' && !isRegisteredStop(row.failure)),
    )
  ) {
    throw new Error(`${plan.batch_id} does not contain its four exact planned jobs`);
  }
  if (fs.existsSync(finalResultPath)) {
    return {
      absolute,
      plan,
      result,
      planJobs,
      stoppedAudit,
      ...auditRecovery({ absolute, plan, initial, result, seal, planPath, initialResultPath, resultPath }),
    };
  }
  if (
    // `result` is `initial` on this branch, and the status was already checked
    // against the seal above. What is left to prove is that no recovery ran.
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
    if (count > caps.perDialogue) throw new Error(`${job.id} exceeds its ${caps.perDialogue}-reservation cap`);
    reservationsByJob.set(job.id, count);
    finalTraceBudgetByJob.set(job.id, caps.perDialogue);
  }
  if ([...reservationsByJob.values()].reduce((sum, value) => sum + value, 0) > caps.perBatch) {
    throw new Error(`${plan.batch_id} exceeds its ${caps.perBatch}-reservation cap`);
  }
  return {
    absolute,
    plan,
    result,
    planJobs,
    stoppedAudit,
    recoveredIds: new Set(),
    reservationsByJob,
    finalTraceBudgetByJob,
  };
}

function metric(model, field) {
  const value = model?.metrics?.[field] ?? model?.assessment?.[field];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function assertAttemptEnvelope(
  events,
  job,
  outcomeTurn,
  finalTraceBudget,
  plan,
  observationSemantics,
  { maximumTriggerTurn, postTriggerLearnerTurns },
) {
  // The dialogue length the run was told to use, and the turn the trigger
  // actually landed on. Both come from the registration the batch was planned
  // under. Written out here as v4's 4 turns and a by-turn-2 trigger, this
  // function would have refused every dialogue v5 pays for.
  const registeredTurns = maximumTriggerTurn + postTriggerLearnerTurns;
  const triggerTurn = outcomeTurn - postTriggerLearnerTurns;
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
      // Every pre-treatment turn up to and including the trigger is read, and
      // nothing after it. Under v5 that can reach turn 4.
      return observationSemantics === 'prospective_v9' && turn >= 1 && turn <= triggerTurn;
    }
    if (event.role === 'tutor_stub_auto_learner' || event.role === 'tutor_stub_learner_analysis') {
      return turn >= 1 && turn <= outcomeTurn;
    }
    return allowedTutorRoles.has(event.role) && turn >= 1 && turn < outcomeTurn;
  });
  // Four of the six registered worlds carry their opening line in the world
  // file, so the tutor speaks it without a model call. That is a property of
  // the world, the same for its plain and its warm units, and the design blocks
  // by world. Demanding an opening model call everywhere would refuse those
  // worlds for holding an authored line. The dialogue must still have opened.
  const openingRealization = events.find((event) => event.type === 'tutor_opening_realization')?.realization || null;
  const openingSpoken = events.some((event) => event.type === 'tutor_opening');
  const openingFromWorldFile = openingRealization?.source === 'authored_world_opening';
  // The reading of the learner beside the dialogue can fail and leave the
  // dialogue standing. When the provider refuses a turn to the retry limit the
  // run writes learner_analysis_unanalyzed, puts a no-signal record on the turn
  // and goes on; the measurement itself is a separate call on a separate route
  // and is untouched. This pin demanded the call at every turn regardless, so a
  // dialogue that ran end to end and was measured at every read turn was refused
  // for a gap the run had already named. The gap is now read off the mark the run
  // left, on the same rule the pass-overs use: a turn went unread only if the run
  // said so at the time, and the run said so about no other turn. A missing call
  // with no mark is still a route violation.
  const unanalyzedTurns = [
    ...new Set(
      events.filter((event) => event.type === 'learner_analysis_unanalyzed').map((event) => Number(event.turn)),
    ),
  ].sort((left, right) => left - right);
  const unanalyzedMarks = new Set(unanalyzedTurns);
  const required = [
    ...(openingFromWorldFile ? [] : [['tutor_stub_opening', 0]]),
    ...Array.from({ length: outcomeTurn }, (_, index) => ['tutor_stub_auto_learner', index + 1]),
    ...Array.from({ length: outcomeTurn }, (_, index) => ['tutor_stub_learner_analysis', index + 1]),
    ...Array.from({ length: outcomeTurn - 1 }, (_, index) => ['tutor_stub_tutor', index + 1]),
  ].every(
    ([role, turn]) =>
      calls.some((event) => event.role === role && Number(event.turn) === turn) ||
      (role === 'tutor_stub_learner_analysis' && unanalyzedMarks.has(turn)),
  );
  // A mark on a turn whose call did land would let a unit claim a gap it never
  // had, so the marks are checked both ways, exactly as the pass-over marks are.
  const unanalyzedMarksAgree = unanalyzedTurns.every(
    (turn) =>
      turn >= 1 &&
      turn <= outcomeTurn &&
      !calls.some((event) => event.role === 'tutor_stub_learner_analysis' && Number(event.turn) === turn),
  );
  // One adjudication call per turn the run read, the trigger turn included.
  // This was written as `Math.min(2, outcomeTurn - 2)`, which is the trigger
  // turn only while the outcome window is two turns wide; at five it demands
  // two readings from a dialogue that triggered on turn 1 and made one.
  const semanticRequired =
    observationSemantics !== 'prospective_v9' ||
    Array.from({ length: triggerTurn }, (_, index) => index + 1).every((turn) =>
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
  // Named one by one rather than as one boolean chain, for the same reason the
  // trigger gate names its reasons: a pin that fails with no name cannot be
  // acted on, and the names carry no outcome.
  const envelopeFailures = [
    [recipe?.schema !== 'machinespirits.tutor-stub.session-recipe.v1', 'session_recipe_schema'],
    [metadata?.provenance?.git?.sha !== plan.source.commit, 'source_commit'],
    [metadata?.provenance?.git?.dirty !== false, 'dirty_checkout'],
    [recipe?.config?.identity?.world?.id !== job.world, 'world'],
    [metadata?.experiment?.runSeed !== job.seed, 'run_seed'],
    [metadata?.experiment?.profile !== 'bored', 'profile'],
    [metadata?.experiment?.policy !== 'field', 'register_policy'],
    [metadata?.experiment?.repeat !== job.assignment_index, 'assignment_index'],
    [metadata?.experiment?.jobId !== job.id, 'job_id'],
    [metadata?.autoLearner?.observationSemantics !== observationSemantics, 'observation_semantics'],
    // The dialogue length the runner was told to use: every turn the tutor may
    // act on, then every learner turn the endpoint watches. Written here as 4 it
    // was v4's window, and it would have refused every v5 dialogue.
    [metadata?.autoLearner?.maxTurns !== registeredTurns, 'max_turns'],
    [metadata?.autoLearner?.profileId !== 'bored', 'learner_profile_id'],
    [metadata?.autoLearner?.modelRef !== 'codex.gpt-5.6-luna', 'learner_model_ref'],
    [metadata?.lab?.admission?.modelCallBudget !== finalTraceBudget, 'model_call_budget_metadata'],
    [options?.['cli-effort'] !== 'low', 'cli_effort_option'],
    [options?.['run-seed'] !== String(job.seed), 'run_seed_option'],
    [options?.['auto-turns'] !== String(registeredTurns), 'auto_turns_option'],
    [options?.['model-call-budget'] !== String(finalTraceBudget), 'model_call_budget_option'],
    [options?.['dag-mode'] !== 'strict_dag', 'dag_mode_option'],
    [options?.['register-policy'] !== 'field', 'register_policy_option'],
    [options?.['register-palette'] !== 'plain,warm', 'register_palette_option'],
    [options?.['eval-repeat'] !== String(job.assignment_index), 'eval_repeat_option'],
    [options?.['eval-job-id'] !== job.id, 'eval_job_id_option'],
    [options?.['no-opening'] === true, 'opening_suppressed'],
    [!openingSpoken, 'the_dialogue_never_opened'],
    [!openingRealization, 'no_opening_realization_record'],
    [routePinned !== true, 'model_route_not_pinned'],
    [required !== true, 'a_required_role_and_turn_call_is_missing'],
    [unanalyzedMarksAgree !== true, 'an_unread_learner_analysis_mark_does_not_match_a_missing_call'],
    [semanticRequired !== true, 'a_required_semantic_adjudication_call_is_missing'],
    [allowed !== true, 'a_call_fell_outside_its_allowed_role_and_turn_window'],
    [exactReservations !== true, 'reservations_do_not_match_attempts_one_for_one'],
    [
      attempts.some(
        (event) =>
          event.provider !== 'codex' ||
          event.model !==
            (event.role === 'tutor_stub_boredom_performance_adjudication' ? 'gpt-5.6-sol' : 'gpt-5.6-luna'),
      ),
      'an_attempt_used_the_wrong_provider_or_model',
    ],
    [calls.some((event) => event.response?.effort !== 'low'), 'a_call_reported_effort_other_than_low'],
    [
      attempts
        .filter((event) => event.type !== 'model_call')
        .some((event) => event.request?.cliEffort !== 'low' && event.request?.config?.cliEffort !== 'low'),
      'a_failed_or_aborted_attempt_requested_effort_other_than_low',
    ],
  ]
    .filter(([failed]) => failed)
    .map(([, reason]) => reason);
  if (envelopeFailures.length) {
    throw new Error(
      `${job.id} violates its observed route, source, world, horizon, or attempt pins: ${envelopeFailures.join(', ')}`,
    );
  }
  return {
    calls: calls.length,
    attempts: attempts.length,
    reservations: reservations.length,
    opening_source: openingRealization.source,
    unanalyzed_learner_turns: unanalyzedTurns,
  };
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
  // This window used to be written out here as "turn 1 or 2, and an outcome two
  // turns later". Those were v4's numbers. v5 lets the trigger show as late as
  // turn 4 and watches five learner turns after it, so both bounds are read off
  // the registration the batch was planned under. Written by hand, this gate
  // would have thrown away every dialogue v5 pays for.
  const maximumTriggerTurn = Number(loaded.registration.design.freshPrefixGeneration.maximumTriggerTurn);
  const postTriggerLearnerTurns = Number(loaded.registration.design.treatment.postTriggerLearnerTurns);
  if (!Number.isInteger(maximumTriggerTurn) || !Number.isInteger(postTriggerLearnerTurns)) {
    throw new Error(`${job.id} has no registered trigger bound or post-trigger outcome window to be read against`);
  }
  if (
    triggerTurn < 1 ||
    triggerTurn > maximumTriggerTurn ||
    outcomeTurn !== triggerTurn + postTriggerLearnerTurns ||
    outcomes[0].tutorReplyGenerated !== false
  ) {
    throw new Error(
      `${job.id} violates the by-T${maximumTriggerTurn} trigger or ${postTriggerLearnerTurns}-turn outcome horizon`,
    );
  }
  const expectedCompletedTurns = Array.from({ length: outcomeTurn - 1 }, (_, index) => index + 1);
  if (JSON.stringify(completed.map((event) => Number(event.turn))) !== JSON.stringify(expectedCompletedTurns)) {
    throw new Error(`${job.id} lacks its exact unique public turn sequence`);
  }
  const start = starts[0];
  const intervention = interventions[0].intervention;
  const assignment = intervention?.assignment;
  // Both of these used to be written out here as v5's two fixed strings. v6
  // assigns the move per unit, so a fixed string would have passed every
  // shrink-the-step dialogue only if it happened to be the string v5 used, and
  // in fact would have refused all eighteen of them. The expectation now comes
  // from the plan row, which the preflight built from the sealed assignment
  // manifest, so the trace is checked against a different document than the one
  // that wrote it.
  const registeredMoveLevels = loaded.registration.design.treatment.pedagogicalMoveLevels;
  const expectedActionFit = Array.isArray(registeredMoveLevels)
    ? job.pedagogical_move_level
    : LEGACY_SINGLE_ACTION_FIT_LEVEL;
  const expectedMove = job.pedagogical_move;
  if (Array.isArray(registeredMoveLevels) && !registeredMoveLevels.includes(expectedActionFit)) {
    throw new Error(`${job.id} is planned under an unregistered pedagogical move level`);
  }
  if (typeof expectedMove !== 'string' || expectedMove.length === 0) {
    throw new Error(`${job.id} is planned without the pedagogical move its trace must be checked against`);
  }
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
    assignment?.action_fit !== expectedActionFit ||
    assignment?.pedagogical_move !== expectedMove ||
    assignment?.realization !== job.realization ||
    assignment?.register !== job.realization ||
    assignment?.repeat !== job.batch_id ||
    assignment?.batch_id !== job.batch_id
  ) {
    throw new Error(`${job.id} drifted from its blocked randomized assignment`);
  }
  const trigger = completed.find((event) => Number(event.turn) === triggerTurn)?.turnRecord;
  // Every learner turn the endpoints watch, in order. All but the last sit in
  // the dialogue as ordinary completed turns; the last one is the outcome event,
  // which holds the same three things under different field names. They are put
  // into one shape here so no reader below has to know which kind it was handed.
  // v4 held these as two named locals, which is why the two-turn window was
  // impossible to widen without touching every reader.
  const postTriggerTurns = Array.from({ length: postTriggerLearnerTurns }, (_, index) => {
    const turn = triggerTurn + index + 1;
    if (turn === outcomeTurn) {
      return {
        turn,
        source: outcomes[0],
        learnerText: outcomes[0].learnerText,
        classification: outcomes[0].classification,
        dagModel: outcomes[0].tutorLearnerDag?.model,
        dagAssessment: outcomes[0].tutorLearnerDag?.assessment || outcomes[0].tutorLearnerDag?.model?.assessment,
      };
    }
    const record = completed.find((event) => Number(event.turn) === turn)?.turnRecord;
    if (!record) {
      return null;
    }
    return {
      turn,
      source: record,
      learnerText: record.learner,
      classification: record.classification,
      dagModel: record.tutorLearnerDagModel,
      dagAssessment: record.tutorLearnerDagModel?.assessment,
    };
  });
  const missingPostTriggerTurns = postTriggerTurns
    .map((entry, index) => (entry ? null : triggerTurn + index + 1))
    .filter((turn) => turn !== null);
  // The endpoint is read on the last watched turn, which is the outcome turn.
  const finalPost = postTriggerTurns[postTriggerTurns.length - 1];
  const triggerHash = sha256(String(trigger?.learner || ''));
  const triggerShadow = createTutorStubResistanceAxisShadow({
    learnerText: trigger?.learner,
    classification: trigger?.classification,
    tutorLearnerDag: trigger?.tutorLearnerDagModel,
    semantics: loaded.registration.design.observationSemantics,
  });
  const semanticByTurn = new Map(semanticEvents.map((event) => [Number(event.turn), event.adjudication]));
  const triggerSemanticAdjudication = semanticByTurn.get(triggerTurn) || null;
  const eligibilityAt = (turnRecord, adjudication) =>
    turnRecord
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
          learnerText: turnRecord.learner,
          classification: turnRecord.classification,
          tutorLearnerDag: turnRecord.tutorLearnerDagModel,
          semanticAdjudication: adjudication,
        })
      : null;
  // The registration names four situations that block the treatment even when the
  // adjudicator reads the turn as actionable boredom. A turn the runtime passed
  // over for one of those reasons was never an eligible turn, so it neither breaks
  // the adjudication sequence nor makes the later trigger a second choice. Reading
  // the disposition alone would confuse the judge's label with the runtime's rule.
  const protectedExclusions = new Set(loaded.registration.design.freshPrefixGeneration?.protectedExclusions || []);
  const preTriggerEligibility = new Map(
    completed
      .filter((event) => Number(event.turn) < triggerTurn)
      .map((event) => [
        Number(event.turn),
        eligibilityAt(event.turnRecord, semanticByTurn.get(Number(event.turn)) || null),
      ]),
  );
  const passedOverUnderRegisteredProtection = (turn) => {
    const eligibility = preTriggerEligibility.get(turn);
    return Boolean(
      eligibility &&
      eligibility.eligible === false &&
      eligibility.reasons.length > 0 &&
      eligibility.reasons.every((reason) => protectedExclusions.has(reason)),
    );
  };
  const protectedPassOvers = [...preTriggerEligibility.keys()]
    .filter(
      (turn) =>
        semanticByTurn.get(turn)?.measurement_disposition === 'actionable_boredom' &&
        passedOverUnderRegisteredProtection(turn),
    )
    .map((turn) => ({ turn, reasons: preTriggerEligibility.get(turn).reasons }));
  // v5 registers that a pre-treatment turn the adjudicator cannot read is passed
  // over, and the next turn is read. Earlier registrations do not carry the
  // field, so replaying a v4 plan keeps the original rule, where any
  // indeterminate turn ends the unit. A passed-over turn is never scored and can
  // never carry the trigger; it is only counted, so a reader can see how often
  // the instrument could not read a turn.
  const unreadableIsPassedOver =
    loaded.registration.design.freshPrefixGeneration?.unreadableTurnDisposition ===
    TUTOR_STUB_BOREDOM_UNREADABLE_TURN_PASS_OVER_DISPOSITION;
  const unreadablePassOver = (turn, adjudication) =>
    unreadableIsPassedOver &&
    turn < triggerTurn &&
    adjudication?.measurement_disposition === 'measurement_indeterminate';
  const unreadablePassOvers = semanticEvents
    .filter((event) => unreadablePassOver(Number(event.turn), event.adjudication))
    .map((event) => Number(event.turn));
  // The run marks each passed-over turn as it happens. Reading that mark back
  // keeps a dropped or mis-set adjudication from being counted as a deliberate
  // pass-over after the fact: a turn was passed over only if the run said so at
  // the time, and the run said so about no other turn.
  const passOverMarkerTurns = new Set(
    events
      .filter((event) => event.type === 'boredom_semantic_measurement_indeterminate_passed_over')
      .map((event) => Number(event.turn)),
  );
  const passOverMarkersDisagree =
    passOverMarkerTurns.size !== unreadablePassOvers.length ||
    unreadablePassOvers.some((turn) => !passOverMarkerTurns.has(turn));
  const exactSemanticSequence =
    !semanticMode ||
    (semanticEvents.length === triggerTurn &&
      semanticEvents.every((event, index) => {
        const turn = index + 1;
        const completedTurn = completed.find((candidate) => Number(candidate.turn) === turn)?.turnRecord;
        const adjudication = event.adjudication;
        if (unreadablePassOver(turn, adjudication)) {
          // The turn was not read. Only its identity and its route are checked,
          // because there is no reading to check.
          return (
            Number(event.turn) === turn &&
            adjudication?.candidate_sha256 === sha256(String(completedTurn?.learner || '')) &&
            adjudication?.independent_route?.required_model_ref === 'codex.gpt-5.6-sol'
          );
        }
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
            : adjudication?.measurement_disposition !== 'actionable_boredom' ||
              passedOverUnderRegisteredProtection(turn))
        );
      }));
  const earlierEligible = semanticMode
    ? [...preTriggerEligibility.values()].some((eligibility) => eligibility?.eligible === true)
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
  const triggerEligibility = eligibilityAt(trigger, triggerSemanticAdjudication);
  // Named one by one rather than as one boolean chain: when this gate fires
  // there is no way to act on it without knowing which part of the provenance
  // is missing, and the reasons carry no outcome.
  const provenanceFailures = [
    [!trigger, 'no_trigger_turn'],
    [missingPostTriggerTurns.length > 0, `missing_post_trigger_turns_${missingPostTriggerTurns.join('_')}`],
    [!semanticMode && triggerShadow.resistance_kind !== 'bored', 'shadow_resistance_kind_not_bored'],
    [!semanticMode && triggerShadow.warrant?.status !== 'licensed', 'shadow_warrant_not_licensed'],
    [triggerShadow.profile_identity_used !== false, 'profile_identity_used'],
    [triggerEligibility?.eligible !== true, 'trigger_not_eligible'],
    [
      semanticMode
        ? triggerEligibility?.boredom_semantic_precedence?.final_authority !== 'independent_llm_semantic_adjudicator'
        : triggerEligibility?.boredom_compositional_precedence?.generic_uptake_override_allowed !== false,
      'wrong_final_authority_for_the_observation_semantics',
    ],
    [!exactSemanticSequence, 'semantic_adjudication_sequence_not_exact'],
    [passOverMarkersDisagree, 'unreadable_pass_overs_do_not_match_the_marks_the_run_left'],
    [Boolean(earlierEligible), 'an_earlier_turn_was_already_eligible'],
    [interventions[0]?.triggerTurn !== triggerTurn, 'intervention_trigger_turn_mismatch'],
    [interventions[0]?.triggerLearnerSha256 !== triggerHash, 'intervention_trigger_hash_mismatch'],
    [finalPost?.source?.triggerTurn !== triggerTurn, 'final_post_trigger_turn_mismatch'],
    [finalPost?.source?.triggerLearnerSha256 !== triggerHash, 'final_post_trigger_hash_mismatch'],
  ]
    .filter(([failed]) => failed)
    .map(([, reason]) => reason);
  if (provenanceFailures.length) {
    throw new Error(
      `${job.id} lacks its first eligible fresh public boredom trigger provenance: ${provenanceFailures.join(', ')}`,
    );
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
  const expectedDeliveredRegister = safety?.applied === true ? safety.delivered_register : assignment?.register;
  const deliveredRegister = responseAudit?.axes?.engagement_stance?.selected;
  // A warm dialogue whose tutor turn came out plain, with no safety override to
  // account for it. The registration answers this in one line: the treatment is
  // recorded as nonadherent in intention to treat and never rerolled, and the
  // primary endpoint is an intention-to-treat estimand. A unit is therefore read
  // under the register it was assigned, whatever came out, and the miss is
  // counted against the registered register-visibility floor. This was written
  // as a hard refusal, so one unit of a paid 36 stopped the whole analysis for
  // the one outcome the registration says to record and carry.
  const registerDeliveredAsAssigned = deliveredRegister === expectedDeliveredRegister;
  const registerVisible = safetyOverrideNonadherent ? false : deliveredRegisterVisible && registerDeliveredAsAssigned;
  // v6 held one flag for two different facts: the tutor spoke the manner it was
  // assigned, and a reader could tell which manner the turn was in. A run failed
  // the gate on three of the second and one of the first, which are different
  // faults with different right answers, and the merged flag could not tell them
  // apart even after the run had ended. From v7 the registration splits the
  // floor, so the two facts are recorded separately from here on. The merged
  // flag stays for the closed studies, which are never rescored.
  //
  // Obedience is measured against the manner the design assigned, so a safety
  // override counts as a miss: the design said warm and a plain turn came out.
  // Legibility is measured on whatever came out, because the question is only
  // whether a reader can name the manner.
  const registerDeliveredAsDesigned = deliveredRegister === assignment?.register;
  const registerReadable = deliveredRegisterVisible === true;
  // Written out as one string, this named the host action family v5 ran and
  // nothing compared it with anything. The family now comes from the same move
  // catalogue the runtime built the turn from, so it follows the assigned move.
  // Where the registration also names a family, the two must agree; v6 names
  // one and says both its moves share it on purpose.
  const hostActionFamily = tutorStubResistanceHostActionFamily(expectedMove);
  const registeredHostActionFamily = loaded.registration.design.treatment.hostActionFamily;
  if (registeredHostActionFamily !== undefined && registeredHostActionFamily !== hostActionFamily) {
    throw new Error(
      `${job.id} runs a move whose host action family is ${hostActionFamily}, not the registered ${registeredHostActionFamily}`,
    );
  }
  // Which move the tutor actually delivered. v5 held the move fixed, so there
  // was nothing to miss; v6 assigns it, so a miss is recorded as nonadherent,
  // kept in its assigned group under intention to treat, and counted against
  // the registered delivery floor, exactly as a register miss is.
  // DEAD, and kept only so the closed studies read the same way they did.
  // `delivered_pedagogical_move` is written by no code in this repository, so
  // this falls through to the assigned move and compares it with itself: true
  // in every unit that can exist. v7 reported it as a passed 1.00 fidelity gate
  // and it measured nothing. Registrations from v8 must not put a floor on it;
  // `moveContrastDelivered` below is the reading that replaces it.
  const deliveredMove = intervention?.delivered_pedagogical_move ?? assignment?.pedagogical_move;
  const moveDeliveredAsAssigned = deliveredMove === expectedMove;
  // The real reading. Two arms are worth contrasting only if the turns they
  // produced differ, and the one difference their instructions demand is
  // countable in the delivered text: the question arm asks, the carry-on arm
  // does not. This reads the tutor's own words at the trigger turn, so no part
  // of it can be satisfied by the assignment agreeing with itself.
  const deliveredTurnText = String(trigger?.tutor || '');
  const deliveredQuestionCount = (deliveredTurnText.match(/\?/gu) || []).length;
  const contrastRule = loaded.registration.measurement?.treatmentFidelity?.deliveredContrastByMove?.[expectedMove];
  if (contrastRule !== undefined && !['requires_question', 'forbids_question'].includes(contrastRule)) {
    throw new Error(`${job.id} carries an unregistered delivered-contrast rule ${JSON.stringify(contrastRule)}`);
  }
  // A registration that names the rule must also produce a turn to read it on.
  // An empty tutor turn at the trigger is missing evidence, not a pass.
  if (contrastRule !== undefined && !deliveredTurnText.trim()) {
    throw new Error(`${job.id} has no delivered tutor turn at the trigger to read the move contrast on`);
  }
  const moveContrastDelivered =
    contrastRule === undefined
      ? null
      : contrastRule === 'requires_question'
        ? deliveredQuestionCount >= 1
        : deliveredQuestionCount === 0;
  // Descriptive only. The question arm's instruction says exactly one; a second
  // question mark is a smaller fault than none at all, so the gate takes the
  // first reading and this one is reported beside it.
  const moveContrastDeliveredExactly =
    contrastRule === undefined ? null : contrastRule === 'requires_question' ? deliveredQuestionCount === 1 : null;
  if (
    (!appliedAdherent && !safetyOverrideNonadherent) ||
    typeof responseAudit?.axes?.action_family?.visible !== 'boolean' ||
    typeof deliveredRegisterVisible !== 'boolean' ||
    typeof safety?.applied !== 'boolean' ||
    responseAudit?.axes?.action_family?.selected !== hostActionFamily ||
    // The audit must still name a register the design knows. Which one came out
    // is a measured result; a register outside the palette is missing evidence.
    !loaded.registration.design.treatment.realizations.includes(deliveredRegister) ||
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
    { maximumTriggerTurn, postTriggerLearnerTurns },
  );
  // The primary endpoint is read on the first post-trigger learner turn and no
  // later, in v5 exactly as in v4. Widening the watched window must not widen
  // this, so the scorer is handed only the turns the registration puts inside
  // the primary deadline, and its own reported deadline is checked back against
  // that number rather than assumed to match.
  const primaryDeadline = Number(loaded.registration.measurement.primaryEndpoint.deadlinePostTriggerLearnerTurns);
  if (!Number.isInteger(primaryDeadline) || primaryDeadline < 1 || primaryDeadline > postTriggerLearnerTurns) {
    throw new Error(`${job.id} has no registered primary endpoint deadline inside its outcome window`);
  }
  const scoredTurns = postTriggerTurns.map((entry) => ({
    learnerText: entry?.learnerText,
    classification: entry?.classification,
  }));
  const recovery = scoreTutorStubResistanceRecoveryWithinHorizon({
    profile: 'bored',
    triggerLearnerText: trigger.learner,
    postLearnerTurns: scoredTurns.slice(0, primaryDeadline),
    deadlinePostTriggerLearnerTurns: primaryDeadline,
  });
  if (Number(recovery.deadline_turns) !== primaryDeadline) {
    throw new Error(
      `${job.id} was scored on a ${recovery.deadline_turns}-turn primary deadline, not the registered ${primaryDeadline}`,
    );
  }
  // v6 widens the primary window, so the v5 primary is carried alongside as a
  // descriptive comparability reading and never tested. Without it the v6
  // reference group could not be read against v5 at all. Where a registration
  // does not name one, this stays null and nothing is reported.
  const comparability = loaded.registration.measurement.comparabilityEndpoint;
  let comparabilityRecovery = null;
  if (comparability) {
    const comparabilityDeadline = Number(comparability.deadlinePostTriggerLearnerTurns);
    if (
      !Number.isInteger(comparabilityDeadline) ||
      comparabilityDeadline < 1 ||
      comparabilityDeadline > primaryDeadline
    ) {
      throw new Error(`${job.id} has no registered comparability deadline inside its primary window`);
    }
    comparabilityRecovery = scoreTutorStubResistanceRecoveryWithinHorizon({
      profile: 'bored',
      triggerLearnerText: trigger.learner,
      postLearnerTurns: scoredTurns.slice(0, comparabilityDeadline),
      deadlinePostTriggerLearnerTurns: comparabilityDeadline,
    });
    // The comparability endpoint is the v5 primary and must stay byte-comparable
    // with it, so it is also read through the frozen one-turn scorer and the two
    // must agree.
    if (comparabilityDeadline === 1) {
      const frozen = scoreTutorStubResistanceRecovery({
        profile: 'bored',
        triggerLearnerText: trigger.learner,
        postLearnerTurns: scoredTurns.slice(0, 1),
      });
      if (JSON.stringify(frozen) !== JSON.stringify(comparabilityRecovery)) {
        throw new Error(`${job.id} comparability reading drifted from the frozen one-turn scorer`);
      }
    }
  }
  // The turn the primary was read from, and the tutor turn it answered. A
  // learner who only gives back the words the tutor had just made public has
  // not recovered on the merits, whatever the labels say, so the restatement is
  // counted and disclosed per move. The registration requires the count
  // whatever it is, including zero.
  const scoringTurn = recovery.recovered ? triggerTurn + Number(recovery.observed_turn) : null;
  const precedingTutorText =
    scoringTurn === null ? null : completed.find((event) => Number(event.turn) === scoringTurn - 1)?.turnRecord?.tutor;
  const scoringTurnText = scoringTurn === null ? null : postTriggerTurns[recovery.observed_turn - 1]?.learnerText;
  const scoringTurnRestatesTutor = scoringTurn === null ? null : onlyRestates(scoringTurnText, precedingTutorText);
  // The objective endpoint is read on the last watched turn. From v5 the
  // registration states that deadline on the endpoint as well as in the
  // treatment window; where it does, the two numbers must be the same one.
  const secondaryDeadline = loaded.registration.measurement.keySecondaryEndpoint?.deadlinePostTriggerLearnerTurns;
  if (secondaryDeadline !== undefined && Number(secondaryDeadline) !== postTriggerLearnerTurns) {
    throw new Error(
      `${job.id} registers a ${secondaryDeadline}-turn objective deadline inside a ${postTriggerLearnerTurns}-turn outcome window`,
    );
  }
  const initialGrounded = metric(trigger.tutorLearnerDagModel, 'groundedCount');
  const finalGrounded = metric(finalPost.dagModel, 'groundedCount');
  const initialCoverage = metric(trigger.tutorLearnerDagModel, 'bestPathCoverage');
  const finalCoverage = metric(finalPost.dagModel, 'bestPathCoverage');
  const initialDebt = metric(trigger.tutorLearnerDagModel, 'missingPremiseCount');
  const finalDebt = metric(finalPost.dagModel, 'missingPremiseCount');
  const finalUnsupported = metric(finalPost.dagModel, 'unsupportedAssertionCount');
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
  // The field name carries the registered outcome window, so it is derived from
  // the registration the batches were planned under, never written here.
  objectiveOutcome[boredomProofProgressNames(loaded.registration).field] = objectiveProofProgress(objectiveOutcome);
  // A zero on the objective endpoint has two causes that read the same in the
  // count. Either the learner could have taken a premise on the path to the
  // answer and did not, or the world had not handed out any such premise before
  // the dialogue ended. The second is a property of the world's release
  // schedule against the registered horizon, not a property of the tutor. The
  // reader must be able to tell them apart, so each unit records whether a
  // premise on the best path was ever available to take.
  // The outcome turn carries two assessments. The one inside the model holds
  // the counts the endpoint is built from; the one beside it holds the path
  // detail, including which premises are still missing and when the world hands
  // each one out. The release schedule is only in the second.
  const finalAssessment = finalPost.dagAssessment;
  if (!Array.isArray(finalAssessment?.missingPremises)) {
    throw new Error(`${job.id} lacks the premise release schedule its objective endpoint is read against`);
  }
  const onBestPath = new Set(finalAssessment?.missingOnBestPath || []);
  const bestPathMissing = (finalAssessment?.missingPremises || []).filter((premise) =>
    onBestPath.has(premise.premiseId),
  );
  const releasedNotHeld = bestPathMissing.filter((premise) => premise.bucket === 'released_but_not_held');
  const releaseTurns = bestPathMissing.map((premise) => Number(premise.releaseTurn)).filter(Number.isFinite);
  objectiveOutcome.objective_progress_reachable =
    releasedNotHeld.length > 0 || objectiveOutcome.best_path_coverage_delta > 0;
  objectiveOutcome.best_path_premises_available_to_take = releasedNotHeld.length;
  objectiveOutcome.earliest_unreleased_best_path_premise_turn = releaseTurns.length ? Math.min(...releaseTurns) : null;
  objectiveOutcome.final_turn = Number.isFinite(Number(finalAssessment?.finalTurn))
    ? Number(finalAssessment.finalTurn)
    : null;
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
    // The level name the contrast is read on. Under a registration that holds
    // the move fixed there is one level for every unit, and the contrast is the
    // manner instead.
    move_level: expectedActionFit,
    realization: job.realization,
    prefix_id: `${job.id}:${prefixSha256}`,
    public_prefix_sha256: prefixSha256,
    trigger: {
      observed_by_turn: triggerTurn,
      profile: 'bored',
      profile_identity_used: false,
      protected_pass_overs: protectedPassOvers,
      unreadable_pass_overs: unreadablePassOvers,
    },
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
    outcome: {
      ...recovery,
      // Which post-trigger learner turn the primary was read from. Under the
      // widened window this is the fact a reader needs in order to see whether
      // recovery came at once or late.
      first_recovery_turn: recovery.observed_turn,
      scoring_turn: scoringTurn,
      scoring_turn_only_restates_tutor: scoringTurnRestatesTutor,
      ...(comparabilityRecovery
        ? {
            comparability_recovered: comparabilityRecovery.recovered,
            comparability_deadline_turns: comparabilityRecovery.deadline_turns,
          }
        : {}),
      ...objectiveOutcome,
    },
    fidelity: {
      action_visible: responseAudit.axes.action_family.visible,
      register_visible: registerVisible,
      safety_override: safety.applied === true,
      protected_condition: protectedCondition,
      host_action_family: hostActionFamily,
      assigned_pedagogical_move: expectedMove,
      delivered_pedagogical_move: deliveredMove,
      move_delivered_as_assigned: moveDeliveredAsAssigned,
      // Under intention to treat the unit keeps its assigned register whatever
      // came out, so both are reported and the miss is named rather than hidden
      // inside the visibility count.
      assigned_register: expectedDeliveredRegister,
      delivered_register: deliveredRegister,
      register_delivered_as_assigned: registerDeliveredAsAssigned,
      // Only where the registration splits the floor. A closed study keeps the
      // row shape it was scored under, so the two split readings are added by
      // the registration that asks for them and by no other.
      ...(loaded.registration.measurement.treatmentFidelity.minimumRegisterReadability === undefined
        ? {}
        : {
            register_delivered_as_designed: registerDeliveredAsDesigned,
            designed_register: assignment?.register ?? null,
            register_readable: registerReadable,
          }),
      // Added only by a registration that names the contrast rule, for the same
      // reason: a closed study keeps the row shape it was scored under.
      ...(contrastRule === undefined
        ? {}
        : {
            delivered_contrast_rule: contrastRule,
            delivered_question_count: deliveredQuestionCount,
            move_contrast_delivered: moveContrastDelivered,
            move_contrast_delivered_exactly: moveContrastDeliveredExactly,
          }),
    },
    execution: {
      trace: resultRow.trace,
      trace_sha256: resultRow.trace_sha256,
      model_attempt_reservations: batch.reservationsByJob.get(job.id),
      observed_model_calls: observed.calls,
      observed_model_attempts: observed.attempts,
      opening_source: observed.opening_source,
      // Turns where the reading of the learner beside the dialogue never came
      // back. The dialogue ran on and the measurement was made; the turn carries
      // a no-signal record instead of a read. Reported per unit so a reader can
      // see where the side channel went quiet without reading the traces.
      unanalyzed_learner_turns: observed.unanalyzed_learner_turns,
      technical_recovery_used: batch.recoveredIds.has(job.id),
      tutor_turns: outcomeTurn - 1,
      learner_turns: outcomeTurn,
      // Written out as 2, this reported v4's window on every v5 unit.
      post_trigger_learner_turns: postTriggerLearnerTurns,
    },
  };
}

// The exact conditional test takes a block as a reference side and a treatment
// side. Its own parameter names still say plain and warm, because the engine
// was written when the manner was the only contrast; the mapping is made here,
// once, so the report never calls a move a manner.
function blockedRows(rows, outcomeField, axis) {
  return [...new Set(rows.map((row) => row.world))].sort().map((world) => {
    const worldRows = rows.filter((row) => row.world === world);
    const reference = worldRows.filter((row) => row[axis.rowField] === axis.reference);
    const treatment = worldRows.filter((row) => row[axis.rowField] === axis.treatment);
    const won = (group) => group.filter((row) => row.outcome[outcomeField] === true).length;
    return {
      world,
      referenceLevel: axis.reference,
      treatmentLevel: axis.treatment,
      referenceN: reference.length,
      treatmentN: treatment.length,
      referenceSuccesses: won(reference),
      treatmentSuccesses: won(treatment),
    };
  });
}

function engineBlocks(blocks) {
  return blocks.map((block) => ({
    plainN: block.referenceN,
    warmN: block.treatmentN,
    plainSuccesses: block.referenceSuccesses,
    warmSuccesses: block.treatmentSuccesses,
  }));
}

function blockedAnalysis(rows, outcomeField, axis, registeredTest) {
  const blocks = blockedRows(rows, outcomeField, axis);
  const reference = rows.filter((row) => row[axis.rowField] === axis.reference);
  const treatment = rows.filter((row) => row[axis.rowField] === axis.treatment);
  const won = (group) => group.filter((row) => row.outcome[outcomeField] === true).length;
  const referenceSuccesses = won(reference);
  const treatmentSuccesses = won(treatment);
  const perArm = registeredTest.perArmPerWorld;
  const oneSided = registeredTest.sided === 'one';
  return {
    test: registeredTest.analysis,
    // Amendment A1. The predeclared allocation was an even split of each level
    // in every world. Where a unit stopped as indeterminate, its world holds one
    // side short. The test conditions on the allocation that was realised, which
    // is what these block counts already are.
    contrast: { axis: axis.contrast, reference_level: axis.reference, treatment_level: axis.treatment },
    conditioning: `world_success_totals_and_realised_per_world_${axis.reference}_${axis.treatment}_allocation`,
    predeclared_allocation: `${countWord(perArm)}_${axis.reference}_${countWord(perArm)}_${axis.treatment}_per_world`,
    allocation_realised_as_predeclared: blocks.every(
      (block) => block.referenceN === perArm && block.treatmentN === perArm,
    ),
    // A one-sided run must not report a two-sided key. The key itself follows
    // the registration, so a reader sees which tail was registered without
    // having to trust the number under it.
    ...(oneSided
      ? {
          one_sided_rule:
            'sum_conditional_score_probabilities_of_every_score_at_least_as_far_in_the_registered_direction_as_the_observed_score',
          registered_direction: registeredTest.direction,
        }
      : { two_sided_rule: 'sum_conditional_score_probabilities_no_greater_than_observed_score_probability' }),
    alpha: registeredTest.alpha,
    reference: {
      level: axis.reference,
      successes: referenceSuccesses,
      total: reference.length,
      rate: referenceSuccesses / reference.length,
    },
    treatment: {
      level: axis.treatment,
      successes: treatmentSuccesses,
      total: treatment.length,
      rate: treatmentSuccesses / treatment.length,
    },
    treatment_minus_reference_risk_difference:
      treatmentSuccesses / treatment.length - referenceSuccesses / reference.length,
    p_value: oneSided
      ? exactBlockedScoreOneSidedPValue(engineBlocks(blocks))
      : exactBlockedScorePValue(engineBlocks(blocks)),
    blocks,
  };
}

// The axis the design balances instead of testing. v6 balances manner nine and
// nine inside each move, v7 twenty-one and twenty-one, and the registration
// requires the recovery counts split that way so a reader can see the balance
// held. Either way this is a table, never a test: the design puts no power on
// this axis, so the cell size is written from the registration rather than said
// out loud as nine.
function balancedBlockReport(rows, outcomeField, axis, shape) {
  if (!axis.blockField) return null;
  const perCell = shape.dialogues / (2 * axis.blockLevels.length);
  const won = (group) => group.filter((row) => row.outcome[outcomeField] === true).length;
  return {
    axis: axis.blockField === 'arm' ? 'realization_manner' : axis.blockField,
    role: 'balancing_block_not_the_contrast',
    analysis: 'descriptive_only_no_hypothesis_test',
    cells: [axis.reference, axis.treatment].flatMap((level) =>
      axis.blockLevels.map((blockLevel) => {
        const cell = rows.filter((row) => row[axis.rowField] === level && row[axis.blockField] === blockLevel);
        return {
          contrast_level: level,
          block_level: blockLevel,
          scored: cell.length,
          successes: won(cell),
        };
      }),
    ),
    reading: `the manner the tutor spoke in is balanced inside each move rather than tested. These counts are here so a reader can see the balance held and can see whether a move result rests on one manner. At ${countWord(perCell)} per cell no test on this axis would have the power to say anything.`,
  };
}

// The registration requires every scored dialogue to open differently: it asks
// for 84 distinct public prefixes and sets requireDistinctPublicPrefixHashes.
// It also names what to do when one repeats. The rule is called "substantive
// missing or duplicate trigger", and its disposition is to stop the unit,
// replace nothing and analyse nothing.
//
// Only the missing half of that rule was ever built. The runner computes it per
// dialogue and stops the unit there. The duplicate half was computed nowhere —
// the distinctness flag was read by no code in this repository — so the first
// thing to notice a repeat was this analysis, after all 83 dialogues had been
// paid for. A live check was never cheap to build either: a prefix exists only
// once its dialogue has grown to the trigger turn, and batches run in separate
// processes that cannot see each other's openings.
//
// So the registered rule is applied here, on the terms it would have had live.
// Inside a group of dialogues that share an opening, the one that ran first is
// the original and every later one is the duplicate, which is what a live check
// would have concluded. Order comes from the batch number and then the unit
// name, so it does not depend on the order the caller listed the batches, and
// it reads nothing about how any dialogue ended.
function registeredDuplicatePublicPrefixStops(rows) {
  const batchNumber = (row) => Number(String(row.batch_id).replace(/^\D+/, '')) || 0;
  const ordered = [...rows].sort(
    (left, right) =>
      batchNumber(left) - batchNumber(right) || String(left.case_id).localeCompare(String(right.case_id)),
  );
  const firstByPrefix = new Map();
  const stops = new Map();
  for (const row of ordered) {
    const prefix = row.public_prefix_sha256;
    if (!firstByPrefix.has(prefix)) {
      firstByPrefix.set(prefix, row);
      continue;
    }
    stops.set(row.case_id, {
      case_id: row.case_id,
      batch_id: row.batch_id,
      world: row.world,
      public_prefix_sha256: prefix,
      repeats_the_opening_of: firstByPrefix.get(prefix).case_id,
    });
  }
  return stops;
}

export function analyzeTutorStubBoredomProofDag({
  batchRoots,
  registrationPath,
  expectedSourceCommit,
  amendmentPath,
} = {}) {
  // How many batches there should be is the registration's business, so the
  // count is checked below once the registration is loaded. What can be checked
  // without it is that the caller passed some roots and passed each one once.
  if (
    !Array.isArray(batchRoots) ||
    batchRoots.length === 0 ||
    new Set(batchRoots.map((root) => path.resolve(ROOT, root))).size !== batchRoots.length
  ) {
    throw new Error('boredom proof-DAG analysis requires distinct predeclared batch roots');
  }
  if (typeof registrationPath !== 'string' || registrationPath.length === 0) {
    throw new Error('boredom proof-DAG analysis requires the path of the registration these batches were run under');
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
  const shape = boredomRegisteredReportShape(loaded.registration);
  if (batchRoots.length !== shape.batches) {
    throw new Error(`boredom proof-DAG analysis requires ${shape.batches} distinct predeclared batch roots`);
  }
  const batches = batchRoots.map((root) => exactBatch(root, pinnedCommit, pinnedTree, registrationPath));
  // Sorted as a set of names, not as text. Past twelve batches the plain string
  // order puts batch 10 before batch 2, so a text sort would have compared two
  // differently ordered lists and passed a run that was missing a batch.
  const seenBatchIds = [...new Set(batches.map((batch) => batch.plan.batch_id))].sort();
  if (JSON.stringify(seenBatchIds) !== JSON.stringify(batchIds(shape.batches).sort())) {
    throw new Error(`boredom proof-DAG analysis requires all ${shape.batches} registered batches exactly once`);
  }
  if (batches.some((batch) => batch.plan.source.registration_sha256 !== loaded.sha256)) {
    throw new Error('boredom proof-DAG registration digest drifted across batches');
  }
  // Amendment A1. The 36 planned units still have to all be there. What may
  // now differ is how many of them carry an outcome: a unit that stopped as a
  // registered indeterminate measurement is excluded, never repaired, rerun or
  // replaced. Rows are built from completed units only.
  // Which axis this registration contrasts, read once and passed everywhere
  // below. Every count, block, table and sentence that used to say plain and
  // warm now asks this object what the two sides are called.
  const axis = reportContrastAxis(loaded.registration);
  const primaryDeadlineTurns = Number(loaded.registration.measurement.primaryEndpoint.deadlinePostTriggerLearnerTurns);
  const comparabilityEndpoint = loaded.registration.measurement.comparabilityEndpoint ?? null;
  const plannedUnits = batches.flatMap((batch) =>
    batch.plan.jobs.map((job) => ({
      case_id: job.id,
      world: job.world,
      arm: job.realization,
      move_level: job.pedagogical_move_level ?? LEGACY_SINGLE_ACTION_FIT_LEVEL,
      completed: batch.result.results.find((row) => row.job_id === job.id)?.status === 'complete',
    })),
  );
  if (
    plannedUnits.length !== shape.dialogues ||
    new Set(plannedUnits.map((unit) => unit.case_id)).size !== shape.dialogues
  ) {
    throw new Error(
      `boredom proof-DAG analysis requires all ${shape.dialogues} planned units to be present exactly once`,
    );
  }
  // Every dialogue that finished is read before anything is counted, because
  // the registered duplicate-opening rule can be applied only once the openings
  // exist. A unit that rule stops is not scored, in the same way a unit the
  // runner stopped is not scored, and it is never repaired, rerun or replaced.
  const scoredCandidateRows = batches.flatMap((batch) =>
    batch.result.results.filter((row) => row.status === 'complete').map((row) => analyzeTrace(batch, row, loaded)),
  );
  const duplicatePrefixStops = registeredDuplicatePublicPrefixStops(scoredCandidateRows);
  for (const unit of plannedUnits) {
    unit.duplicate_public_prefix = duplicatePrefixStops.has(unit.case_id);
    unit.scored = unit.completed && !unit.duplicate_public_prefix;
    unit.stop_reason = unit.scored
      ? null
      : unit.duplicate_public_prefix
        ? 'duplicate_public_prefix_stop_no_replacement_no_analysis'
        : 'measurement_indeterminate_stop_no_repair_no_replacement';
  }
  const stoppedUnits = plannedUnits.filter((unit) => !unit.scored);
  // A short study needs a written rule for how an uneven block is conditioned
  // on. v4 had none, so amendment A1 had to supply it after collection ended.
  // v5 registers the realised-count conditioning from the start and says so in
  // its own words: "an uneven block needs no amendment". This gate was written
  // for v4 and never asked the registration, so on v5 it demanded a paper the
  // governing document says is not needed. The question now goes to the
  // registration. A registration that still conditions on the predeclared
  // allocation demands an amendment exactly as before.
  const conditioning = loaded.registration.measurement?.primaryEndpoint?.conditioning;
  const amendmentRequired = stoppedUnits.length > 0 && conditioning !== realisedCountConditioning(axis);
  if (amendmentRequired && !amendmentPath) {
    throw new Error(
      `boredom proof-DAG analysis of a short study requires a written amendment: ${stoppedUnits.length} of ${shape.dialogues} units stopped`,
    );
  }
  let amendment = null;
  if (amendmentPath) {
    const amendmentAbsolute = path.resolve(ROOT, amendmentPath);
    const amendmentBytes = fs.readFileSync(amendmentAbsolute);
    const amendmentDocument = JSON.parse(amendmentBytes.toString('utf8'));
    if (amendmentDocument.amends?.registrationSha256 !== loaded.sha256) {
      throw new Error('boredom proof-DAG amendment does not cite the registration these batches were run under');
    }
    amendment = { path: amendmentPath, id: amendmentDocument.id, sha256: sha256(amendmentBytes) };
  } else if (stoppedUnits.length > 0) {
    amendment = {
      path: null,
      id: null,
      sha256: null,
      not_required_because: `the registration conditions on realised per-world ${axis.reference} and ${axis.treatment} counts`,
      registered_conditioning: conditioning,
    };
  }
  // The attrition caveat used to name "Amendment A1" in prose, because on v4 an
  // amendment was the only thing that could supply the realised-count rule. v5
  // registers that rule from the start and the amendment block above says so,
  // so the prose was telling a reader to go and find a paper that does not
  // exist. The sentence now names whichever document actually did the
  // conditioning, on the same test the gate above uses.
  const conditioningAuthority = amendment?.path
    ? `A written amendment (${amendment.id}) conditions`
    : 'The registration conditions';
  const rows = scoredCandidateRows.filter((row) => !duplicatePrefixStops.has(row.case_id));
  if (
    rows.length !== shape.dialogues - stoppedUnits.length ||
    new Set(rows.map((row) => row.case_id)).size !== rows.length ||
    new Set(rows.map((row) => row.seed)).size !== rows.length ||
    new Set(rows.map((row) => row.public_prefix_sha256)).size !== rows.length ||
    new Set(rows.map((row) => row.execution.trace_sha256)).size !== rows.length
  ) {
    throw new Error('boredom proof-DAG analysis requires every scored dialogue to be fresh, distinct and independent');
  }
  for (const world of loaded.registration.design.worlds) {
    const worldPlanned = plannedUnits.filter((unit) => unit.world === world);
    const worldRows = rows.filter((row) => row.world === world);
    const plannedOn = (field, level) => worldPlanned.filter((unit) => unit[field] === level).length;
    if (
      worldPlanned.length !== shape.perWorld ||
      plannedOn(axis.rowField, axis.reference) !== shape.perArmPerWorld ||
      plannedOn(axis.rowField, axis.treatment) !== shape.perArmPerWorld
    ) {
      throw new Error(
        `boredom proof-DAG world block ${world} was not planned as ${countWord(shape.perArmPerWorld)} ${axis.reference} and ${countWord(shape.perArmPerWorld)} ${axis.treatment}`,
      );
    }
    // The balanced axis is not tested, but it still has to have been dealt out
    // evenly. v6 balances the manner three and three inside each world so that
    // a move result cannot rest on one manner, and a world that lost that
    // balance in the plan would break the claim before a single unit ran.
    const perBlockLevel = axis.blockField ? shape.perWorld / axis.blockLevels.length : null;
    if (axis.blockField && axis.blockLevels.some((level) => plannedOn(axis.blockField, level) !== perBlockLevel)) {
      throw new Error(
        `boredom proof-DAG world block ${world} was not planned as ${countWord(perBlockLevel)} ${axis.blockLevels.join(` and ${countWord(perBlockLevel)} `)}`,
      );
    }
    // The exact conditional test conditions on a block. A block with nothing on
    // one side is not a block, so it cannot be conditioned on at all.
    if (
      worldRows.filter((row) => row[axis.rowField] === axis.reference).length < 1 ||
      worldRows.filter((row) => row[axis.rowField] === axis.treatment).length < 1
    ) {
      throw new Error(`boredom proof-DAG world block ${world} lost a whole side and cannot be conditioned on`);
    }
  }
  // Counted off the batches, not off the scored rows. A unit that stopped as
  // indeterminate still spent model calls, and the caps are on what was spent.
  const reservationsByBatch = Object.fromEntries(
    batches.map((batch) => [
      batch.plan.batch_id,
      [...batch.reservationsByJob.values()].reduce((sum, value) => sum + value, 0),
    ]),
  );
  // The caps come from the registration the batches were planned under, so a
  // longer study is not judged against a shorter study's numbers.
  const perBatchCeiling = loaded.registration.executionReadiness.batches.maximumReservationsPerBatch;
  const studyCeiling = loaded.registration.executionReadiness.dialogue.maximumReservations;
  if (Object.values(reservationsByBatch).some((value) => value > perBatchCeiling)) {
    throw new Error(`boredom proof-DAG analysis refuses a batch above ${perBatchCeiling} reservations`);
  }
  const totalReservations = Object.values(reservationsByBatch).reduce((sum, value) => sum + value, 0);
  if (totalReservations > studyCeiling) {
    throw new Error(`boredom proof-DAG analysis refuses a run above ${studyCeiling} reservations`);
  }
  const progressNames = boredomProofProgressNames(loaded.registration);
  // Which test to run, and which tail, comes from the registration. Written out
  // here as two-sided, a v7 run registered one-sided would have been scored by
  // the wrong test and filed under a key that said so in the other direction.
  const primaryTest = boredomRegisteredTest(loaded.registration.measurement.primaryEndpoint, shape);
  const keySecondaryTest = boredomRegisteredTest(
    loaded.registration.measurement.keySecondaryEndpoint ?? loaded.registration.measurement.primaryEndpoint,
    shape,
  );
  const primary = blockedAnalysis(rows, 'recovered', axis, primaryTest);
  const keySecondary = blockedAnalysis(rows, progressNames.field, axis, keySecondaryTest);
  const primaryRejects = primary.p_value <= primaryTest.alpha;
  const keySecondaryRejects = primaryRejects && keySecondary.p_value <= keySecondaryTest.alpha;
  // Over the dialogues that produced an outcome, not over every planned unit. A
  // stopped unit has no fidelity reading to average in either direction.
  const actionVisibility = rows.filter((row) => row.fidelity.action_visible).length / rows.length;
  const registerVisibility = rows.filter((row) => row.fidelity.register_visible).length / rows.length;
  const moveDelivery = rows.filter((row) => row.fidelity.move_delivered_as_assigned).length / rows.length;
  // Amendment A1 makes this table travel with the result. It is the part a
  // reader needs in order to see what the test could not fix: which units were
  // lost, from which side, and why. The two sides are the levels the
  // registration contrasts, so on v5 they are the two manners and on v6 the two
  // moves.
  const contrastLevels = [axis.reference, axis.treatment];
  const stoppedByLevel = Object.fromEntries(contrastLevels.map((level) => [level, 0]));
  for (const unit of stoppedUnits) stoppedByLevel[unit[axis.rowField]] += 1;
  const attritionBalanced = stoppedByLevel[axis.reference] === stoppedByLevel[axis.treatment];
  const attrition = {
    planned: shape.dialogues,
    scored: rows.length,
    stopped: stoppedUnits.length,
    contrast: { axis: axis.contrast, reference_level: axis.reference, treatment_level: axis.treatment },
    stopped_by_contrast_level: stoppedByLevel,
    balanced_across_contrast_levels: attritionBalanced,
    // Two rules can stop a unit, so the reason is carried per unit rather than
    // once for the whole run. A reader who sees only a total cannot tell a
    // learner who never showed boredom from a dialogue that repeated another
    // dialogue's opening.
    stop_reasons: {
      measurement_indeterminate_stop_no_repair_no_replacement: stoppedUnits.filter(
        (unit) => unit.stop_reason === 'measurement_indeterminate_stop_no_repair_no_replacement',
      ).length,
      duplicate_public_prefix_stop_no_replacement_no_analysis: duplicatePrefixStops.size,
    },
    duplicate_public_prefix_stops: [...duplicatePrefixStops.values()],
    stopped_units: stoppedUnits.map((unit) => ({
      case_id: unit.case_id,
      world: unit.world,
      arm: unit.arm,
      move_level: unit.move_level,
      contrast_level: unit[axis.rowField],
      stop_reason: unit.stop_reason,
    })),
    per_world: loaded.registration.design.worlds.map((world) => {
      const planned = plannedUnits.filter((unit) => unit.world === world);
      const scored = planned.filter((unit) => unit.scored);
      const count = (group, level) => group.filter((unit) => unit[axis.rowField] === level).length;
      return {
        world,
        planned_by_contrast_level: Object.fromEntries(contrastLevels.map((level) => [level, count(planned, level)])),
        scored_by_contrast_level: Object.fromEntries(contrastLevels.map((level) => [level, count(scored, level)])),
      };
    }),
    reading: attritionBalanced
      ? 'Units were lost evenly across the two sides the study contrasts.'
      : 'Units were lost unevenly across the two sides the study contrasts. The kept sample on the side that lost units is conditional on not stopping as indeterminate, while the other side is not. The exact conditional test is valid for the units that exist, and it does not repair this. Report it beside any result.',
  };
  const fidelity = loaded.registration.measurement.treatmentFidelity;
  // A registration that assigns more than one move has to say how often the
  // assigned move must actually be delivered, or the contrast is between two
  // labels rather than two moves. v5 assigns one move to every unit and names no
  // floor, so there is nothing to hold it to.
  const moveDeliveryFloor = fidelity.minimumAssignedMoveDelivery ?? null;
  // The reading that replaces it. A registration names the rule per move and a
  // floor on the rate; naming one without the other is a registration fault,
  // because a rule with no floor gates nothing and a floor with no rule has
  // nothing to count.
  const contrastRules = fidelity.deliveredContrastByMove ?? null;
  const contrastDeliveryFloor = fidelity.minimumMoveContrastDelivery ?? null;
  if ((contrastRules === null) !== (contrastDeliveryFloor === null)) {
    throw new Error(
      'a boredom proof-DAG registration must name deliveredContrastByMove and minimumMoveContrastDelivery together, or neither',
    );
  }
  if (contrastRules && !rows.every((row) => typeof row.fidelity.move_contrast_delivered === 'boolean')) {
    throw new Error('a registration that names a delivered contrast must produce a reading on every scored unit');
  }
  const contrastDelivery = contrastRules
    ? rows.filter((row) => row.fidelity.move_contrast_delivered).length / rows.length
    : null;
  // Also reported per arm. A pooled rate can hide one arm failing completely
  // while the other carries the average, and one arm failing completely is the
  // fault that would make the contrast meaningless.
  const contrastDeliveryByLevel = contrastRules
    ? Object.fromEntries(
        [axis.reference, axis.treatment].map((level) => {
          const armRows = rows.filter((row) => row[axis.rowField] === level);
          return [
            level,
            armRows.length
              ? armRows.filter((row) => row.fidelity.move_contrast_delivered).length / armRows.length
              : null,
          ];
        }),
      )
    : null;
  // v6 held the manner to one floor on one flag that merged two facts: the tutor
  // spoke the manner it was assigned, and a reader could tell which manner it
  // was. The run failed on three of the second and one of the first. From v7 the
  // registration splits them, so each fact is counted on its own and held to its
  // own floor. A registration that names no readability floor keeps the merged
  // reading exactly as it was scored.
  const splitRegisterFloor = fidelity.minimumRegisterReadability !== undefined;
  const registerDeliveryFloor = splitRegisterFloor ? fidelity.minimumAssignedRegisterDelivery : null;
  const registerReadabilityFloor = splitRegisterFloor ? fidelity.minimumRegisterReadability : null;
  const registerDelivery = splitRegisterFloor
    ? rows.filter((row) => row.fidelity.register_delivered_as_designed).length / rows.length
    : null;
  const registerReadability = splitRegisterFloor
    ? rows.filter((row) => row.fidelity.register_readable).length / rows.length
    : null;
  if (splitRegisterFloor && (registerDeliveryFloor === undefined || registerReadabilityFloor === undefined)) {
    throw new Error('a boredom proof-DAG registration that splits the manner floor must name both halves');
  }
  const fidelityPassed =
    actionVisibility >= fidelity.minimumActionVisibility &&
    (splitRegisterFloor
      ? registerDelivery >= registerDeliveryFloor && registerReadability >= registerReadabilityFloor
      : registerVisibility >= fidelity.minimumRegisterVisibility) &&
    (moveDeliveryFloor === null || moveDelivery >= moveDeliveryFloor) &&
    (contrastDeliveryFloor === null ||
      (contrastDelivery >= contrastDeliveryFloor &&
        // Every arm has to clear the floor on its own. A pooled rate that passes
        // on one arm doing all the work leaves the other arm undelivered, and
        // the contrast is between arms.
        Object.values(contrastDeliveryByLevel).every((rate) => rate !== null && rate >= contrastDeliveryFloor)));
  return {
    schema: loaded.registration.measurement.reportSchema ?? LEGACY_BOREDOM_CONFIRMATION_REPORT_SCHEMA,
    status: fidelityPassed ? 'complete_registered_confirmation' : 'failed_interpretability_gate_not_rerun',
    source: { commit: pinnedCommit, tree: pinnedTree },
    registration: { path: registrationPath, sha256: loaded.sha256 },
    amendment,
    assembly: {
      batches_run: batches.length,
      batches_sealed_complete: batches.filter((batch) => batch.stoppedAudit.stopped.length === 0).length,
      batches_sealed_with_registered_stops: batches.filter((batch) => batch.stoppedAudit.stopped.length > 0).length,
      dialogues_planned: shape.dialogues,
      dialogues_scored: rows.length,
      // Counted off the plan, never written out as eighteen and eighteen. The
      // planned split is a fact about the batch files, so a design that deals
      // the units out some other way is reported as it ran instead of being
      // reported as the number this line used to carry.
      contrast: { axis: axis.contrast, reference_level: axis.reference, treatment_level: axis.treatment },
      planned_by_contrast_level: Object.fromEntries(
        contrastLevels.map((level) => [level, plannedUnits.filter((unit) => unit[axis.rowField] === level).length]),
      ),
      scored_by_contrast_level: Object.fromEntries(
        contrastLevels.map((level) => [level, rows.filter((row) => row[axis.rowField] === level).length]),
      ),
      planned_by_balanced_block_level: axis.blockField
        ? Object.fromEntries(
            axis.blockLevels.map((level) => [
              level,
              plannedUnits.filter((unit) => unit[axis.blockField] === level).length,
            ]),
          )
        : null,
      scored_by_balanced_block_level: axis.blockField
        ? Object.fromEntries(
            axis.blockLevels.map((level) => [level, rows.filter((row) => row[axis.blockField] === level).length]),
          )
        : null,
      worlds: shape.worlds,
      distinct_fresh_public_prefixes: rows.length,
      prior_dialogues_reused: 0,
      prior_outcomes_pooled: 0,
      partial_or_interim_interpretation_permitted: false,
      valid_unit_reruns: false,
      outcome_selection: false,
      reservations_by_batch: reservationsByBatch,
      total_model_attempt_reservations: totalReservations,
    },
    attrition,
    rows,
    primary_analysis: {
      // Named from the registration. Written out here, a v6 run would have been
      // filed under v5's endpoint name and a reader comparing the two would have
      // taken a five-turn window for a one-turn window.
      endpoint: loaded.registration.measurement.primaryEndpoint.id,
      deadline_post_trigger_learner_turns: primaryDeadlineTurns,
      ...primary,
      balanced_block: balancedBlockReport(rows, 'recovered', axis, shape),
      // Named after the tail the registration registered. A one-sided run that
      // reported a two-sided key would tell a reader it had tested both
      // directions when it had tested one.
      [primaryTest.sided === 'one' ? 'significant_one_sided' : 'significant_two_sided']: primaryRejects,
      registered_decision: primaryRejects
        ? `${axis.treatment}_${axis.reference}_recovery_separation_confirmed`
        : `${axis.treatment}_${axis.reference}_recovery_not_confirmed`,
    },
    // The v5 primary, unchanged, so the v6 reference side can be read against
    // what v5 reported. Counts only: the registration gives it no test, and a
    // second test would be a second chance at a positive result.
    comparability_analysis: comparabilityEndpoint
      ? {
          endpoint: comparabilityEndpoint.id,
          deadline_post_trigger_learner_turns: comparabilityEndpoint.deadlinePostTriggerLearnerTurns,
          analysis: 'descriptive_only_no_hypothesis_test',
          scored: rows.length,
          by_contrast_level: contrastLevels.map((level) => {
            const group = rows.filter((row) => row[axis.rowField] === level);
            return {
              contrast_level: level,
              scored: group.length,
              recovered: group.filter((row) => row.outcome.comparability_recovered === true).length,
            };
          }),
          v5_reference_value: comparabilityEndpoint.v5ReferenceValue ?? null,
          reading:
            'the same one-turn reading v5 reported, on the same frozen scorer. It is here so the reference side of this study can be compared with the earlier one, and it carries no test of its own.',
        }
      : null,
    // Required by the registration whatever it comes to, including zero. A
    // learner who scores by giving the tutor's own words back has not recovered,
    // and the move under test hands the learner one small step, so the count of
    // scoring turns that only restate the tutor has to travel with the result.
    content_leakage_disclosure: {
      rule: 'count_scoring_learner_turns_that_only_restate_the_tutor_report_whatever_it_comes_to',
      by_contrast_level: contrastLevels.map((level) => {
        const group = rows.filter((row) => row[axis.rowField] === level);
        const scoring = group.filter((row) => row.outcome.scoring_turn !== null);
        return {
          contrast_level: level,
          scored: group.length,
          scoring_turns: scoring.length,
          scoring_turns_that_only_restate_the_tutor: scoring.filter(
            (row) => row.outcome.scoring_turn_only_restates_tutor === true,
          ).length,
          units: scoring
            .filter((row) => row.outcome.scoring_turn_only_restates_tutor === true)
            .map((row) => ({ case_id: row.case_id, world: row.world, scoring_turn: row.outcome.scoring_turn })),
        };
      }),
      reading:
        'a scoring turn counted here brought back no content word the tutor had not just made public. The unit is still counted as it was scored: this is a disclosure, not a rule that removes units. Read a positive result against it, because a move that recovers only by handing the learner the words has not moved the learner.',
    },
    key_secondary_analysis: {
      endpoint: progressNames.endpoint,
      ...keySecondary,
      balanced_block: balancedBlockReport(rows, progressNames.field, axis, shape),
      fixed_sequence_gate_open: primaryRejects,
      [keySecondaryTest.sided === 'one'
        ? 'significant_one_sided_under_fixed_sequence'
        : 'significant_two_sided_under_fixed_sequence']: keySecondaryRejects,
      registered_decision: !primaryRejects
        ? 'not_tested_inferentially_primary_gate_closed'
        : keySecondaryRejects
          ? `${axis.treatment}_${axis.reference}_objective_proof_progress_separation_confirmed`
          : 'objective_proof_progress_separation_not_confirmed',
    },
    treatment_fidelity: {
      status: fidelityPassed ? 'complete' : 'failed_interpretability_gate_not_rerun',
      action_visibility_rate: actionVisibility,
      register_visibility_rate: registerVisibility,
      // The two facts the merged rate above ran together, each against its own
      // registered floor, on a registration that asks for both. Both are
      // reported whatever they come to, and both must clear their floor.
      ...(splitRegisterFloor
        ? {
            assigned_register_delivery_rate: registerDelivery,
            assigned_register_delivery_minimum: registerDeliveryFloor,
            register_readability_rate: registerReadability,
            register_readability_minimum: registerReadabilityFloor,
            register_floor_split_reading:
              'the manner is held to two floors rather than one. Delivery asks whether the tutor spoke in the manner the design assigned it, and a safety override counts as a miss there because the design said one manner and another came out. Readability asks only whether a reader can name the manner the turn came out in. The merged rate above stays so this run can be read against v6, which was scored on it and is never rescored.',
            register_unreadable_units: rows
              .filter((row) => row.fidelity.register_readable === false)
              .map((row) => ({
                case_id: row.case_id,
                world: row.world,
                arm: row.arm,
                designed_register: row.fidelity.designed_register,
                delivered_register: row.fidelity.delivered_register,
              })),
            register_undelivered_units: rows
              .filter((row) => row.fidelity.register_delivered_as_designed === false)
              .map((row) => ({
                case_id: row.case_id,
                world: row.world,
                arm: row.arm,
                designed_register: row.fidelity.designed_register,
                delivered_register: row.fidelity.delivered_register,
                safety_override: row.fidelity.safety_override,
              })),
          }
        : {}),
      // DEAD. This was meant to say how often the tutor turn carried the move it
      // was assigned. It compares the assigned move with itself, because the
      // field it reads is written nowhere, so it is 1.00 in every run that can
      // exist. v7 reported it against a 0.90 floor and it measured nothing.
      // Registrations from v8 set no floor here and use the contrast reading
      // below. It is still emitted so the closed studies read as they did.
      assigned_move_delivery_rate: moveDelivery,
      assigned_move_delivery_minimum: moveDeliveryFloor,
      assigned_move_delivery_reading:
        'dead field, kept for the closed studies. `delivered_pedagogical_move` is written by no code in the repository, so this compares the assigned move with itself and is always 1.00. Read move_contrast_delivery_rate instead.',
      // The live reading. Counts a feature of the words the tutor produced, so
      // nothing in it can be satisfied by the assignment agreeing with itself.
      ...(contrastRules
        ? {
            move_contrast_delivery_rate: contrastDelivery,
            move_contrast_delivery_rate_by_level: contrastDeliveryByLevel,
            move_contrast_delivery_minimum: contrastDeliveryFloor,
            move_contrast_rules: contrastRules,
            move_contrast_exact_single_question_rate: (() => {
              const asking = rows.filter((row) => row.fidelity.move_contrast_delivered_exactly !== null);
              return asking.length
                ? asking.filter((row) => row.fidelity.move_contrast_delivered_exactly).length / asking.length
                : null;
            })(),
            move_contrast_undelivered_units: rows
              .filter((row) => row.fidelity.move_contrast_delivered === false)
              .map((row) => ({
                case_id: row.case_id,
                world: row.world,
                arm: row.arm,
                move_level: row.move_level,
                assigned_pedagogical_move: row.fidelity.assigned_pedagogical_move,
                delivered_contrast_rule: row.fidelity.delivered_contrast_rule,
                delivered_question_count: row.fidelity.delivered_question_count,
              })),
            move_contrast_reading:
              'the two arms are worth contrasting only if the turns they produced differ. The question arm is instructed to ask exactly one question and the carry-on arm to ask none, so a question mark in the delivered turn is the one difference a reader can count. The floor is applied to each arm on its own as well as to the pool. A miss in either direction pulls the arms together, so a confirmed result survives it and a null is weakened by it. The exact-single-question rate is descriptive: a second question mark in the question arm is a smaller fault than none at all and is not gated.',
          }
        : {}),
      move_nonadherent_units: rows
        .filter((row) => row.fidelity.move_delivered_as_assigned === false)
        .map((row) => ({
          case_id: row.case_id,
          world: row.world,
          arm: row.arm,
          move_level: row.move_level,
          assigned_pedagogical_move: row.fidelity.assigned_pedagogical_move,
          delivered_pedagogical_move: row.fidelity.delivered_pedagogical_move,
        })),
      move_nonadherent_reading:
        'the move the tutor was assigned did not come out in the turn. The registration records nonadherence in intention to treat and never rerolls it, so the unit stays in its assigned group and the miss is counted against the registered delivery floor. A unit that drifted onto the other side’s move can only pull the two sides together, so a positive result survives it and a null is weakened by it.',
      protected_condition_count: rows.filter((row) => row.fidelity.protected_condition).length,
      safety_override_count: rows.filter((row) => row.fidelity.safety_override).length,
      protected_pass_over_units: rows
        .filter((row) => (row.trigger.protected_pass_overs || []).length > 0)
        .map((row) => ({
          case_id: row.case_id,
          arm: row.arm,
          trigger_turn: row.trigger.observed_by_turn,
          passed_over: row.trigger.protected_pass_overs,
        })),
      // A turn the instrument could not read. Under a registration that passes
      // such a turn over, the unit continues and the next turn is read, so this
      // count says how often that happened rather than how many units were lost.
      unreadable_pass_over_units: rows
        .filter((row) => (row.trigger.unreadable_pass_overs || []).length > 0)
        .map((row) => ({
          case_id: row.case_id,
          arm: row.arm,
          trigger_turn: row.trigger.observed_by_turn,
          passed_over: row.trigger.unreadable_pass_overs,
        })),
      // A unit whose tutor turn did not come out in the register it was assigned,
      // with no safety override to account for it. The registration records this
      // as nonadherent in intention to treat and never rerolls it, so the unit is
      // read under its assigned register and counted against the visibility floor.
      register_nonadherent_units: rows
        .filter((row) => row.fidelity.register_delivered_as_assigned === false)
        .map((row) => ({
          case_id: row.case_id,
          world: row.world,
          arm: row.arm,
          assigned_register: row.fidelity.assigned_register,
          delivered_register: row.fidelity.delivered_register,
          safety_override: row.fidelity.safety_override,
        })),
      register_nonadherent_reading:
        'the register the tutor was assigned did not come out in the turn, and no safety override accounts for it. The registration records nonadherence in intention to treat and never rerolls it, so the unit stays in its assigned group and the miss is counted against the registered register-visibility floor. Keeping it there is the conservative direction: a warm unit that spoke plain can only pull the warm side toward the plain side.',
      // A turn where the reading of the learner beside the dialogue never came
      // back. The provider refused it to the retry limit, the run marked it, put
      // a no-signal record on the turn and went on. The measurement is a separate
      // call on the pinned adjudicator route and was made at every read turn, so
      // no unit is stopped for this. It is a small unplanned difference in what
      // the tutor had in front of it on those turns, so it is disclosed by unit,
      // by turn and by version of the tutor, and read against the endpoint turns.
      unanalyzed_learner_turn_units: rows
        .filter((row) => (row.execution.unanalyzed_learner_turns || []).length > 0)
        .map((row) => {
          const triggerTurn = row.trigger.observed_by_turn;
          const endpointTurns = new Set([
            triggerTurn,
            triggerTurn + Number(loaded.registration.measurement.primaryEndpoint.deadlinePostTriggerLearnerTurns),
            triggerTurn + Number(loaded.registration.design.treatment.postTriggerLearnerTurns),
          ]);
          return {
            case_id: row.case_id,
            arm: row.arm,
            world: row.world,
            trigger_turn: triggerTurn,
            unread_turns: row.execution.unanalyzed_learner_turns,
            unread_turns_that_an_endpoint_is_read_from: row.execution.unanalyzed_learner_turns.filter((turn) =>
              endpointTurns.has(turn),
            ),
          };
        }),
      unanalyzed_learner_turn_reading:
        'the reading of the learner that runs beside the dialogue failed to the retry limit on these turns. The run named each one, wrote a no-signal record and carried the dialogue on, and the registration names no stop for it: its two stops are a missing trigger and an unreadable measurement, and this is neither. The measurement itself was made on every read turn by the pinned adjudicator on its own route. On a turn an endpoint is read from, the carried-forward proof record cannot show a premise the learner grounded only in that turn, which pushes a reading down, not up, on the objective endpoint, and can only lose a success on the primary. The units are kept and the turns are listed here so a reader can weigh that.',
      opening_source_by_world: [...new Set(rows.map((row) => row.world))].sort().map((world) => {
        const inWorld = rows.filter((row) => row.world === world);
        return {
          world,
          sources: [...new Set(inWorld.map((row) => row.execution.opening_source))].sort(),
          units_by_contrast_level: Object.fromEntries(
            contrastLevels.map((level) => [level, inWorld.filter((row) => row[axis.rowField] === level).length]),
          ),
        };
      }),
      opening_source_reading:
        'a world whose file carries its own opening line needs no model call to speak it. The source is fixed per world, so it is the same for both sides of that world’s block and the blocked design absorbs it.',
      protected_pass_over_reading:
        'the adjudicator read these earlier turns as actionable boredom and a registered protected exclusion blocked the treatment there, so the trigger fell to a later turn still inside the registered by-turn-2 deadline. The judge label was never recoded.',
      action_visibility_minimum: fidelity.minimumActionVisibility,
      // Null where the registration split the floor: there is no single manner
      // minimum to report, and the two that replaced it are above.
      register_visibility_minimum: fidelity.minimumRegisterVisibility ?? null,
      primary_analysis: 'intention_to_treat',
      valid_unit_rerun_authorized: false,
      objective_endpoint_reachability: {
        units: rows.length,
        units_where_progress_was_reachable: rows.filter((row) => row.outcome.objective_progress_reachable).length,
        units_where_no_best_path_premise_had_been_released: rows.filter(
          (row) => !row.outcome.objective_progress_reachable,
        ).length,
        by_world: [...new Set(rows.map((row) => row.world))].sort().map((world) => {
          const inWorld = rows.filter((row) => row.world === world);
          return {
            world,
            units: inWorld.length,
            reachable: inWorld.filter((row) => row.outcome.objective_progress_reachable).length,
            final_turns: [...new Set(inWorld.map((row) => row.outcome.final_turn))].sort((a, b) => a - b),
            earliest_release_turns: [
              ...new Set(inWorld.map((row) => row.outcome.earliest_unreleased_best_path_premise_turn)),
            ].sort((a, b) => a - b),
          };
        }),
        reading:
          'the objective endpoint needs the learner to take a premise that lies on the path to the answer. A world releases those premises on a schedule. Where no such premise had been released before the dialogue ended, the endpoint could not move whatever the tutor did, so a zero there measures the release schedule against the registered horizon and not the tutor. Read the objective null only over the units counted as reachable.',
      },
    },
    interpretation_status: !fidelityPassed
      ? 'interpretability_gate_failed_no_rerun_or_confirmation_claim'
      : attritionBalanced
        ? 'registered_confirmation_interpretable_within_claim_boundary'
        : 'registered_confirmation_interpretable_within_claim_boundary_and_unbalanced_attrition_caveat',
    claim_boundary: `This report tests only the prospectively registered bored ${axis.treatment}-versus-${axis.reference} recovery primary, read within ${primaryDeadlineTurns} post-trigger learner turn${
      primaryDeadlineTurns === 1 ? '' : 's'
    }${
      primaryTest.sided === 'one' ? ', read one-sided in the registered direction' : ''
    }, and the fixed-sequence objective proof-progress secondary, in fresh independent strict-DAG dialogues. ${shape.dialogues} dialogues were planned and ${rows.length} produced an outcome; ${attrition.stopped} stopped as an indeterminate measurement and were not repaired, rerun or replaced.${
      axis.blockField
        ? ` The ${axis.blockLevels.join(' and ')} manner the tutor spoke in is balanced inside each side, not tested, and no manner claim is licensed from it.`
        : ''
    } Prior held-out detection, historical action-fit, and 12-dialogue calibration outcomes are neither reused nor pooled. No action-fit, interaction, edged-register, general tutor-efficacy, durable-learning, human-validity, or cell-harness claim is licensed.${
      attritionBalanced
        ? ''
        : ` Attrition was unbalanced across the two sides (${axis.reference} ${stoppedByLevel[axis.reference]}, ${axis.treatment} ${stoppedByLevel[axis.treatment]}), so the two kept samples are conditioned differently. ${conditioningAuthority} the test on the realised per-world allocation; that does not repair this, and the attrition table must be reported beside any result.`
    }`,
  };
}

function parseArgs(argv) {
  const options = { batches: [], registration: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (['--json', '--help'].includes(arg)) {
      options[arg.slice(2)] = true;
      continue;
    }
    if (['--batch', '--registration', '--amendment', '--expected-source-commit', '--out'].includes(arg)) {
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
  return `Usage: node scripts/analyze-tutor-stub-boredom-action-register-proof-dag.js --batch <root> (repeat once per registered batch: 9 on v2 to v6, 21 on v7) --expected-source-commit <sha> --registration <path> [--amendment <path>] [--out <fresh.json>] [--json]

--registration has no default: the registration names the study version these batches were run under, and a default would silently score a run against another version's rules.

--amendment is required only when a unit stopped as a registered indeterminate measurement, and the amendment must cite the digest of the registration the batches were run under.`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return void console.log(usage());
  // How many batches is the registration's business, and the analysis checks it
  // against the registration it loads. Here only the flags are checked.
  if (args.batches.length === 0 || !args['expected-source-commit'] || !args.registration) throw new Error(usage());
  const report = analyzeTutorStubBoredomProofDag({
    batchRoots: args.batches,
    registrationPath: args.registration,
    amendmentPath: args.amendment,
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
