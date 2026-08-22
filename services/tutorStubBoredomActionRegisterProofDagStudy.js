import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildTutorStubBoredomProofDagPlan,
  validateTutorStubBoredomProofDagRegistration,
} from './tutorStubBoredomActionRegisterProofDagPreflight.js';
import { createTutorStubBoredomSemanticAdjudicator } from './tutorStubBoredomSemanticAdjudication.js';
import { createTutorStubBoredomSemanticAdjudicator as createTutorStubBoredomSemanticAdjudicatorV3 } from './tutorStubBoredomSemanticAdjudicationV3.js';
import { TUTOR_STUB_CLI_POLICY_RETRY_DELAYS_MS } from './tutorStubCliPolicyRetry.js';
import { assertTutorStubTurnAttemptCurrent } from './tutorStubTurnAttempt.js';

export const TUTOR_STUB_BOREDOM_PROOF_DAG_EXECUTION_START =
  'resistance_action_register_boredom_proof_dag_execution_start';
export const BOREDOM_PROOF_DAG_ADHERENCE_EXHAUSTED_CODE = 'TUTOR_STUB_BOREDOM_PROOF_DAG_ADHERENCE_EXHAUSTED';

const BOREDOM_PROOF_DAG_PLANNED_WORST_CASE_CALLS = 20;
const BOREDOM_PROOF_DAG_MODEL_CALL_BUDGET = 60;
const MAX_RESERVATIONS_PER_PLANNED_CALL = 1 + TUTOR_STUB_CLI_POLICY_RETRY_DELAYS_MS.length;

export function selectTutorStubBoredomSemanticAdjudicatorFactory({ args, root }) {
  const registrationPath = args?.['boredom-proof-dag-registration'];
  if (!registrationPath) return createTutorStubBoredomSemanticAdjudicator;
  const registration = JSON.parse(fs.readFileSync(path.resolve(root, registrationPath), 'utf8'));
  const schema = registration?.measurement?.semanticAdjudicator?.schema;
  if (schema === undefined || schema === 'machinespirits.tutor-stub.boredom-semantic-adjudication.v1') {
    return createTutorStubBoredomSemanticAdjudicator;
  }
  if (schema === 'machinespirits.tutor-stub.boredom-semantic-adjudication.v3') {
    return createTutorStubBoredomSemanticAdjudicatorV3;
  }
  throw new Error(`unsupported boredom semantic adjudication schema in registration: ${schema}`);
}

export function buildTutorStubBoredomProofDagRepairBudgetDiagnostic({ maxFullRepairsByT2 = 1 } = {}) {
  return {
    turns: 4,
    repairDecisionTurn: 2,
    maxFullRepairsByT2,
    callsPerFullRepair: 2,
    plannedWorstCaseCalls: BOREDOM_PROOF_DAG_PLANNED_WORST_CASE_CALLS,
    maximumReservationsPerPlannedCall: MAX_RESERVATIONS_PER_PLANNED_CALL,
    maximumModelAttemptReservations: BOREDOM_PROOF_DAG_MODEL_CALL_BUDGET,
    ready:
      maxFullRepairsByT2 === 1 &&
      BOREDOM_PROOF_DAG_PLANNED_WORST_CASE_CALLS * MAX_RESERVATIONS_PER_PLANNED_CALL ===
        BOREDOM_PROOF_DAG_MODEL_CALL_BUDGET,
  };
}

export function buildTutorStubBoredomProofDagSemanticBudgetDiagnostic() {
  return {
    turns: 4,
    maximumPreTriggerSemanticAdjudications: 2,
    learnerAdherenceRepairCalls: 0,
    displacedLegacyRepairCalls: 2,
    plannedWorstCaseCalls: BOREDOM_PROOF_DAG_PLANNED_WORST_CASE_CALLS,
    maximumReservationsPerPlannedCall: MAX_RESERVATIONS_PER_PLANNED_CALL,
    maximumModelAttemptReservations: BOREDOM_PROOF_DAG_MODEL_CALL_BUDGET,
    ready:
      BOREDOM_PROOF_DAG_PLANNED_WORST_CASE_CALLS * MAX_RESERVATIONS_PER_PLANNED_CALL ===
      BOREDOM_PROOF_DAG_MODEL_CALL_BUDGET,
  };
}

export function admitTutorStubBoredomProofDagFullRepair({ state, profile, turnNumber, contract } = {}) {
  if (profile !== 'bored') return { applicable: false, admitted: true, reason: 'profile_not_bored' };
  const maxFullRepairsByT2 = Number(contract?.repairModel?.maxFullRepairsPer8Turns);
  const diagnostic = buildTutorStubBoredomProofDagRepairBudgetDiagnostic({ maxFullRepairsByT2 });
  if (!diagnostic.ready) {
    return { applicable: true, admitted: false, reason: 'registered_boredom_repair_budget_not_ready', diagnostic };
  }
  const current = state?.boredomProofDagRepairAdmission || { used: 0, history: [] };
  const admitted = turnNumber === 2 && current.used < maxFullRepairsByT2;
  const result = {
    applicable: true,
    admitted,
    profile,
    turn: turnNumber,
    usedBefore: current.used,
    usedAfter: admitted ? current.used + 1 : current.used,
    reason:
      turnNumber !== 2
        ? 'repair_deferred_until_boredom_t2_candidate'
        : admitted
          ? 'within_boredom_trigger_repair_envelope'
          : 'boredom_trigger_repair_envelope_exhausted',
    diagnostic,
  };
  if (state) {
    state.boredomProofDagRepairAdmission = { used: result.usedAfter, history: [...current.history, result] };
  }
  return result;
}

export function throwTutorStubBoredomProofDagAdherenceExhaustion({ repairAttempts }) {
  const error = new Error(
    `bored proof-DAG trigger adherence exhausted after ${repairAttempts} repair attempts; refusing to publish an invalid source prefix`,
  );
  error.code = BOREDOM_PROOF_DAG_ADHERENCE_EXHAUSTED_CODE;
  error.profile = 'bored';
  error.repairAttempts = repairAttempts;
  error.disposition = 'substantive_boredom_trigger_nonadherence_stop_no_replacement';
  error.publishPublicCandidate = false;
  throw error;
}

export const TUTOR_STUB_BOREDOM_UNREADABLE_TURN_PASS_OVER_DISPOSITION = 'pass_over_this_turn_and_read_the_next_one';

/**
 * Does the frozen registration say that a pre-treatment turn the adjudicator
 * cannot read is passed over rather than fatal to the whole dialogue?
 *
 * v4 and earlier registrations do not carry the field and keep the original
 * stop-the-dialogue behaviour, so replaying a v4 plan today reproduces v4.
 * v5 declares the pass-over disposition, which makes the boredom path match
 * the resistance path: the turn becomes ineligible to trigger and the next
 * turn is read. The unit still stops when no turn up to the registered
 * `maximumTriggerTurn` is eligible.
 *
 * This lives beside the loader that writes `proof_dag_registration` rather
 * than in the adjudication facade, whose bytes the spent v4 validation
 * request pins.
 */
export function tutorStubBoredomUnreadableTurnIsPassedOver(runtime) {
  // `proof_dag_registration` is the frozen boredom registration, and is the
  // same field the prospective-v9 adjudication gate above reads.
  const disposition = runtime?.proof_dag_registration?.design?.freshPrefixGeneration?.unreadableTurnDisposition;
  return disposition === TUTOR_STUB_BOREDOM_UNREADABLE_TURN_PASS_OVER_DISPOSITION;
}

export function createTutorStubBoredomProofDagLearnerRuntime({
  appendTraceEvent,
  automatedLearnerDraftMatchesRuntime,
  extractCombinedLearnerAnalysis,
  generateAutomatedLearnerTurn,
} = {}) {
  return async function enforceTutorStubBoredomProofDagLearnerProfile({
    state,
    resolved,
    profile,
    runtime,
    turnNumber,
    generated,
    precomputeFinalLearnerAnalysis = false,
    cliEffort = null,
    signal = null,
    isCurrent = null,
  } = {}) {
    const applicable =
      state.resistanceActionRegisterStudy?.dynamic_boredom_proof_dag === true && runtime?.profileId === 'bored';
    if (!applicable) return null;
    const canPreclassify = Boolean(state.classifier.enabled && state.learnerDag.enabled && state.world);
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    if (state.resistanceActionRegisterStudy?.consumed === true) {
      const precomputedRaw =
        precomputeFinalLearnerAnalysis && canPreclassify && generated.text
          ? await extractCombinedLearnerAnalysis({
              learnerText: generated.text,
              state,
              tutorTurn: turnNumber,
              preflightSource: 'registered_final_learner_outcome',
              signal,
            })
          : null;
      if (precomputedRaw) assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      return { generated, precomputedRaw, repaired: false, passed: null };
    }
    if (
      state.resistanceActionRegisterStudy?.proof_dag_registration?.design?.observationSemantics === 'prospective_v9'
    ) {
      appendTraceEvent(state.trace, {
        type: 'auto_learner_profile_measurement_delegated',
        turn: turnNumber,
        profile: runtime.profileId,
        authority: 'independent_llm_semantic_adjudicator',
        learnerGeneratorMayJudgeItself: false,
        repairRequested: false,
        measurementIndeterminateMeansNonadherence: false,
        study: 'boredom_proof_dag_confirmation',
      });
      return { generated, precomputedRaw: null, repaired: false, passed: null };
    }
    if (turnNumber < 2) {
      appendTraceEvent(state.trace, {
        type: 'auto_learner_profile_adherence_deferred',
        turn: turnNumber,
        profile: runtime.profileId,
        decisionTurn: 2,
        repairRequested: false,
        typedExhaustionEvaluated: false,
        study: 'boredom_proof_dag_confirmation',
      });
      return { generated, precomputedRaw: null, repaired: false, passed: null };
    }
    if (!runtime.requiredNow || !canPreclassify || !generated.text) {
      const precomputedRaw =
        precomputeFinalLearnerAnalysis && canPreclassify && generated.text
          ? await extractCombinedLearnerAnalysis({
              learnerText: generated.text,
              state,
              tutorTurn: turnNumber,
              preflightSource: 'registered_final_learner_outcome',
              signal,
            })
          : null;
      if (precomputedRaw) assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      return { generated, precomputedRaw, repaired: false, passed: null };
    }

    let candidate = generated;
    let raw = null;
    let passed = false;
    let repairs = 0;
    while (repairs <= 1) {
      raw = await extractCombinedLearnerAnalysis({
        learnerText: candidate.text,
        state,
        tutorTurn: turnNumber,
        preflightSource: 'automated_learner_profile_adherence',
        signal,
      });
      assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      passed = automatedLearnerDraftMatchesRuntime({ text: candidate.text, raw, state, runtime });
      if (passed || repairs === 1) break;
      const admission = admitTutorStubBoredomProofDagFullRepair({
        state,
        profile: runtime.profileId,
        turnNumber,
        contract: runtime.contract,
      });
      appendTraceEvent(state.trace, {
        type: 'auto_learner_profile_repair_admission',
        turn: turnNumber,
        profile: runtime.profileId,
        ...admission,
      });
      if (!admission.admitted) break;
      appendTraceEvent(state.trace, {
        type: 'auto_learner_profile_repair_requested',
        turn: turnNumber,
        profile: runtime.profileId,
        attempt: repairs + 1,
        failureOperator: runtime.contract.intent.failureOperator,
        draft: candidate.text,
      });
      const repaired = await generateAutomatedLearnerTurn({
        state,
        resolved,
        profile,
        turnNumber,
        adherenceFeedback: `Your previous draft was too normalized and did not visibly perform the required failure operator (${runtime.contract.intent.failureOperator}). Rewrite the learner turn. Make the required failure public and unmistakable without repairing it in the same turn. Keep it natural and concise.`,
        stream: { enabled: false, interim: state.interim },
        cliEffort,
        signal,
      });
      assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      if (repaired.text) candidate = repaired;
      repairs += 1;
    }
    appendTraceEvent(state.trace, {
      type: 'auto_learner_profile_adherence',
      turn: turnNumber,
      profile: runtime.profileId,
      required: true,
      passed,
      repaired: repairs > 0,
      repairAttempts: repairs,
    });
    if (!passed) {
      const repairAttempts = Math.max(repairs, Number(state?.boredomProofDagRepairAdmission?.used || 0));
      appendTraceEvent(state.trace, {
        type: 'auto_learner_profile_adherence_exhausted',
        turn: turnNumber,
        profile: 'bored',
        repairAttempts,
        disposition: 'substantive_boredom_trigger_nonadherence_stop_no_replacement',
      });
      throwTutorStubBoredomProofDagAdherenceExhaustion({ repairAttempts });
    }
    return { generated: candidate, precomputedRaw: raw, repaired: repairs > 0, passed };
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function runtimeRegistrationAdapter(registration, world) {
  return {
    schema: 'machinespirits.tutor-stub.resistance-action-register-crossed-registration.v1',
    version: 1,
    status: 'frozen_design_hold',
    authorization: { modelCallsAuthorized: false, liveRunAuthorized: false },
    design: {
      world,
      dagMode: registration.design.dagMode,
      trigger: { observationSemantics: registration.design.observationSemantics },
      profiles: ['bored'],
      factors: {
        actionFit: {
          levels: ['matched'],
          assignments: { bored: { matched: registration.design.treatment.fixedPedagogicalMove } },
        },
        realization: { levels: ['plain', 'warm'], plain: 'plain', warm: 'warm' },
        replicationBlock: {
          levels: [
            'execution_batch_1',
            'execution_batch_2',
            'execution_batch_3',
            'execution_batch_4',
            'execution_batch_5',
            'execution_batch_6',
            'execution_batch_7',
            'execution_batch_8',
            'execution_batch_9',
          ],
        },
      },
      intervention: {
        applicationOrder: [...registration.design.treatment.applicationOrder],
        studyOnlyOptIn: true,
        legacyDefaultOutsideStudy: true,
      },
    },
  };
}

export function loadTutorStubBoredomProofDagStudy({ registrationPath } = {}) {
  const absolute = path.resolve(registrationPath);
  const source = fs.readFileSync(absolute, 'utf8');
  const registration = JSON.parse(source);
  const validation = validateTutorStubBoredomProofDagRegistration(registration);
  if (!validation.ok) throw new Error(`boredom proof-DAG registration invalid: ${validation.errors.join('; ')}`);
  return {
    path: absolute,
    source,
    sha256: sha256(source),
    registration,
    plan: buildTutorStubBoredomProofDagPlan(registration),
  };
}

export function resolveTutorStubBoredomProofDagJob({ loaded, jobId } = {}) {
  const job = loaded?.plan?.jobs?.find((candidate) => candidate.id === jobId);
  if (!job) throw new Error(`boredom proof-DAG job ${JSON.stringify(jobId)} is not registered`);
  return job;
}

export function configureTutorStubBoredomProofDagExecution({ state, loaded, jobId, appendTraceEvent } = {}) {
  if (!state || state.turns?.length || state.history?.length) {
    throw new Error('boredom proof-DAG execution requires a fresh empty dialogue state');
  }
  const job = resolveTutorStubBoredomProofDagJob({ loaded, jobId });
  state.resistanceActionRegisterStudy = {
    schema: 'machinespirits.tutor-stub.resistance-action-register-study-runtime.v1',
    enabled: true,
    authority: 'explicit_study_only_opt_in',
    profile: 'bored',
    action_fit: 'matched',
    realization: job.realization,
    repeat: job.batch_id,
    registration_path: path.relative(process.cwd(), loaded.path),
    registration_sha256: loaded.sha256,
    registration: runtimeRegistrationAdapter(loaded.registration, job.world),
    proof_dag_registration: clone(loaded.registration),
    semantic_adjudicator:
      loaded.registration.design.observationSemantics === 'prospective_v9'
        ? {
            required: true,
            model_ref: loaded.registration.measurement?.semanticAdjudicator?.modelRef || null,
            role: loaded.registration.measurement?.semanticAdjudicator?.role || null,
            generator_self_judgment_allowed: false,
          }
        : null,
    consumed: false,
    history: [],
    dynamic_confirmation: true,
    dynamic_boredom_proof_dag: true,
    job_id: job.id,
    batch_id: job.batch_id,
    prefix_id: null,
    trigger_turn: null,
    trigger_learner_text: null,
    trigger_learner_sha256: null,
    maximum_trigger_turn: job.maximum_trigger_turn,
    outcome_horizon_learner_turns: loaded.registration.design.treatment.postTriggerLearnerTurns,
    final_learner_without_tutor_reply: true,
  };
  appendTraceEvent(state.trace, {
    type: TUTOR_STUB_BOREDOM_PROOF_DAG_EXECUTION_START,
    jobId: job.id,
    batchId: job.batch_id,
    assignmentIndex: job.assignment_index,
    runSeed: job.seed,
    world: job.world,
    registrationSha256: loaded.sha256,
    assignmentManifestSha256: job.assignment_manifest_sha256,
    assignmentRankSha256: job.assignment_rank_sha256,
    treatment: {
      profile: 'bored',
      action_fit: 'matched',
      realization: job.realization,
      pedagogical_move: job.pedagogical_move,
      register: job.realization,
    },
    triggerEligibleByTurn: job.maximum_trigger_turn,
    outcomeHorizonLearnerTurns: loaded.registration.design.treatment.postTriggerLearnerTurns,
    freshIndependentDialogue: true,
    priorDialogueReused: false,
    priorOutcomePooled: false,
    publicTranscriptChanged: false,
  });
  return job;
}

export function configureTutorStubBoredomProofDagFromCli({
  args,
  state,
  root,
  autoLearnerEnabled,
  autoLearnerProfileId,
  autoTurns,
  appendTraceEvent,
  observationSemantics,
} = {}) {
  const registrationPath = args?.['boredom-proof-dag-registration'];
  const jobId = args?.['boredom-proof-dag-job'];
  if (!registrationPath || !jobId)
    throw new Error('boredom proof-DAG execution requires registration and job together');
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.resolve(root, registrationPath) });
  const job = resolveTutorStubBoredomProofDagJob({ loaded, jobId });
  const budget = Number(args['model-call-budget']);
  // A dialogue has to be long enough to hold the whole registered window: every
  // turn on which the tutor may act, then every learner turn the endpoint
  // watches. This used to read 4, and the per-dialogue ceiling used to read 60.
  // Both were v4's numbers, written here and also in the registration, and never
  // compared. v4 still comes out as 4 and 60, because 2 plus 2 is 4.
  const expectedAutoTurns =
    loaded.registration.design.freshPrefixGeneration.maximumTriggerTurn +
    loaded.registration.design.treatment.postTriggerLearnerTurns;
  const perDialogueCeiling = loaded.registration.executionReadiness.dialogue.maximumReservationsPerDialogue;
  if (
    !autoLearnerEnabled ||
    Number(autoTurns) !== expectedAutoTurns ||
    !Number.isInteger(budget) ||
    budget < 1 ||
    budget > perDialogueCeiling ||
    args.model !== 'codex.gpt-5.6-luna' ||
    args['classifier-model'] !== 'codex.gpt-5.6-luna' ||
    args['learner-record-model'] !== 'codex.gpt-5.6-luna' ||
    args['auto-learner-model'] !== 'codex.gpt-5.6-luna' ||
    args['cli-effort'] !== 'low' ||
    args.world !== job.world ||
    autoLearnerProfileId !== 'bored' ||
    Number(args['run-seed']) !== job.seed ||
    Number(args['eval-repeat']) !== job.assignment_index ||
    args['eval-job-id'] !== job.id ||
    args['no-opening'] === true ||
    args['acknowledge-research-use'] !== true ||
    args['dag-mode'] !== 'strict_dag' ||
    args['register-policy'] !== 'field' ||
    args['register-palette'] !== 'plain,warm' ||
    observationSemantics !== loaded.registration.design.observationSemantics
  ) {
    throw new Error(
      `boredom proof-DAG launch pins, ${expectedAutoTurns}-turn window, or remaining ${perDialogueCeiling}-attempt ceiling drifted`,
    );
  }
  configureTutorStubBoredomProofDagExecution({ state, loaded, jobId, appendTraceEvent });
  return { loaded, job };
}

export default {
  configureTutorStubBoredomProofDagExecution,
  configureTutorStubBoredomProofDagFromCli,
  loadTutorStubBoredomProofDagStudy,
  resolveTutorStubBoredomProofDagJob,
};
