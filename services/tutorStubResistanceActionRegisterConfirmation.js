import crypto from 'node:crypto';
import path from 'node:path';

import { fisherExactPower, fisherExactTwoSidedP } from './edgedRegisterCalibration.js';
import {
  createTutorStubResistanceActionRegisterStudyRuntime,
  loadTutorStubResistanceActionRegisterRegistration,
  scoreTutorStubResistanceRecovery,
} from './tutorStubResistanceActionRegisterStudy.js';
import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';

export const TUTOR_STUB_RESISTANCE_ACTION_REGISTER_CONFIRMATION_PLAN_SCHEMA =
  'machinespirits.tutor-stub.resistance-action-register-confirmation-plan.v1';

const BALANCED_ASSIGNMENT_TOKENS = Object.freeze([
  Object.freeze({ token: 'plain_1', realization: 'plain' }),
  Object.freeze({ token: 'plain_2', realization: 'plain' }),
  Object.freeze({ token: 'warm_1', realization: 'warm' }),
  Object.freeze({ token: 'warm_2', realization: 'warm' }),
]);
const RANDOMIZATION_ALGORITHM = 'sha256_ranked_balanced_block_permutation_v1';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomizedBlockAssignments(masterSeed, blockId) {
  return BALANCED_ASSIGNMENT_TOKENS.map((entry) => ({
    ...entry,
    score_sha256: sha256(`${RANDOMIZATION_ALGORITHM}:${masterSeed}:${blockId}:${entry.token}`),
  }))
    .sort((left, right) => left.score_sha256.localeCompare(right.score_sha256))
    .map((entry, index) => ({ ...entry, permutation_rank: index + 1 }));
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function assertConfirmationRegistration(registration) {
  if (registration?.version !== 3) throw new Error('confirmation requires the V3 action/register registration');
  return registration;
}

export function buildTutorStubResistanceActionRegisterConfirmationPlan({ registration } = {}) {
  const frozen = assertConfirmationRegistration(registration);
  const blocks = frozen.design.factors.confirmationBlock.blocks;
  const masterSeed = Number(frozen.design.randomization.masterSeed);
  if (
    !Number.isSafeInteger(masterSeed) ||
    frozen.design.randomization.allocation !== 'predeclared_balanced_blocks' ||
    frozen.design.randomization.algorithm !== RANDOMIZATION_ALGORITHM
  ) {
    throw new Error('confirmation randomization requires its registered safe master seed and algorithm');
  }
  const jobs = [];
  let globalIndex = 0;
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];
    const assignments = randomizedBlockAssignments(masterSeed, block.id);
    for (let slot = 0; slot < assignments.length; slot += 1) {
      globalIndex += 1;
      const assignment = assignments[slot];
      const realization = assignment.realization;
      jobs.push({
        id: `frame_refuser-confirmation-${block.id}-s${slot + 1}`,
        block_id: block.id,
        slot: slot + 1,
        assignment_index: globalIndex,
        run_seed: masterSeed * 100 + globalIndex,
        randomization: {
          master_seed: masterSeed,
          algorithm: RANDOMIZATION_ALGORITHM,
          assignment_token: assignment.token,
          permutation_rank: assignment.permutation_rank,
          score_sha256: assignment.score_sha256,
        },
        treatment: {
          profile: 'frame_refuser',
          action_fit: 'matched',
          realization,
          pedagogical_move: 'test_bounded_distinction',
          host_action_family: 'clarify_distinction',
          register: realization,
        },
      });
    }
  }
  if (
    jobs.length !== 36 ||
    jobs.filter((job) => job.treatment.realization === 'plain').length !== 18 ||
    jobs.filter((job) => job.treatment.realization === 'warm').length !== 18 ||
    new Set(jobs.map((job) => job.id)).size !== 36 ||
    new Set(jobs.map((job) => job.run_seed)).size !== 36
  ) {
    throw new Error('confirmation plan must contain 36 unique jobs balanced 18 plain and 18 warm');
  }
  return {
    schema: TUTOR_STUB_RESISTANCE_ACTION_REGISTER_CONFIRMATION_PLAN_SCHEMA,
    status: 'planned_zero_call',
    model_calls_authorized: false,
    model_calls: 0,
    production_writes: 0,
    jobs,
    randomization: {
      master_seed: masterSeed,
      algorithm: RANDOMIZATION_ALGORITHM,
      assignment_sha256: sha256(
        JSON.stringify(
          jobs.map((job) => ({
            id: job.id,
            block_id: job.block_id,
            slot: job.slot,
            realization: job.treatment.realization,
            assignment_token: job.randomization.assignment_token,
            score_sha256: job.randomization.score_sha256,
          })),
        ),
      ),
    },
    invariants: {
      fresh_independent_dialogues: true,
      calibration_dialogues_reused: 0,
      calibration_dialogues_pooled: 0,
      pre_trigger_assignment_concealed_from_prompts: true,
      interim_analysis: false,
      valid_outputs_may_be_selected_or_rerolled: false,
    },
  };
}

export function loadTutorStubResistanceActionRegisterConfirmation({ registrationPath } = {}) {
  const loaded = loadTutorStubResistanceActionRegisterRegistration(registrationPath);
  const plan = buildTutorStubResistanceActionRegisterConfirmationPlan({ registration: loaded.registration });
  return { ...loaded, plan };
}

export function resolveTutorStubResistanceActionRegisterConfirmationJob({ loaded, jobId } = {}) {
  const job = loaded?.plan?.jobs?.find((candidate) => candidate.id === jobId);
  if (!job) throw new Error(`confirmation job ${JSON.stringify(jobId)} is not registered`);
  return job;
}

export function configureTutorStubResistanceActionRegisterConfirmationExecution({
  state,
  loaded,
  jobId,
  appendTraceEvent,
} = {}) {
  if (!state || state.turns?.length || state.history?.length) {
    throw new Error('confirmation execution requires a fresh empty dialogue state');
  }
  const job = resolveTutorStubResistanceActionRegisterConfirmationJob({ loaded, jobId });
  state.resistanceActionRegisterStudy = {
    ...createTutorStubResistanceActionRegisterStudyRuntime({
      registration: loaded.registration,
      registrationPath: path.relative(process.cwd(), loaded.path),
      registrationSha256: loaded.sha256,
      profile: job.treatment.profile,
      actionFit: job.treatment.action_fit,
      realization: job.treatment.realization,
      repeat: job.block_id,
    }),
    dynamic_confirmation: true,
    job_id: job.id,
    batch_id: job.block_id,
    prefix_id: null,
    trigger_turn: null,
    trigger_learner_text: null,
    trigger_learner_sha256: null,
    maximum_trigger_turn: 2,
    outcome_horizon_learner_turns: 2,
    final_learner_without_tutor_reply: true,
  };
  appendTraceEvent(state.trace, {
    type: 'resistance_action_register_confirmation_execution_start',
    jobId: job.id,
    batchId: job.block_id,
    assignmentIndex: job.assignment_index,
    runSeed: job.run_seed,
    registrationSha256: loaded.sha256,
    treatment: clone(job.treatment),
    triggerEligibleByTurn: 2,
    outcomeHorizonLearnerTurns: 2,
    freshIndependentDialogue: true,
    calibrationDialogueReused: false,
    publicTranscriptChanged: false,
  });
  return job;
}

export function configureTutorStubResistanceActionRegisterConfirmationFromCli({
  args,
  state,
  root,
  autoLearnerEnabled,
  autoTurns,
  appendTraceEvent,
  observationSemantics,
} = {}) {
  const registrationPath = args?.['resistance-action-register-confirmation-registration'];
  const jobId = args?.['resistance-action-register-confirmation-job'];
  if (!registrationPath || !jobId) {
    throw new Error('fresh action/register confirmation requires registration and job together');
  }
  const budget = Number(args['model-call-budget']);
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({
    registrationPath: path.resolve(root, registrationPath),
  });
  const job = resolveTutorStubResistanceActionRegisterConfirmationJob({ loaded, jobId });
  if (
    !autoLearnerEnabled ||
    Number(autoTurns) !== 4 ||
    !Number.isInteger(budget) ||
    budget < 1 ||
    budget > 60 ||
    args.model !== 'codex.gpt-5.6-luna' ||
    args['classifier-model'] !== 'codex.gpt-5.6-luna' ||
    args['learner-record-model'] !== 'codex.gpt-5.6-luna' ||
    args['auto-learner-model'] !== 'codex.gpt-5.6-luna' ||
    args['cli-effort'] !== 'low' ||
    Number(args['run-seed']) !== job.run_seed ||
    Number(args['eval-repeat']) !== job.assignment_index ||
    args['eval-job-id'] !== job.id ||
    args['no-opening'] === true ||
    args['acknowledge-research-use'] !== true ||
    observationSemantics !== 'prospective_v4'
  ) {
    throw new Error('fresh action/register confirmation launch pins or remaining 60-attempt ceiling drifted');
  }
  configureTutorStubResistanceActionRegisterConfirmationExecution({ state, loaded, jobId, appendTraceEvent });
  return { loaded, job };
}

function syntheticOutcome(index, realization) {
  const recovered = realization === 'warm' ? index % 3 !== 0 : index % 6 === 0;
  return {
    recovered,
    proof_debt_delta: recovered ? -1 : 0,
    new_supported_public_premises: recovered ? 1 : 0,
  };
}

export function buildTutorStubResistanceActionRegisterConfirmationSyntheticCorpus(registration) {
  return buildTutorStubResistanceActionRegisterConfirmationPlan({ registration }).jobs.map((job, index) => ({
    case_id: job.id,
    block_id: job.block_id,
    profile: 'frame_refuser',
    action_fit: 'matched',
    realization: job.treatment.realization,
    trigger: { turn: index % 2 === 0 ? 1 : 2, single_axis: true, profile_identity_used: false },
    outcome: syntheticOutcome(index, job.treatment.realization),
    fidelity: {
      action_visible: true,
      register_visible: true,
      safety_override: false,
      protected_condition: false,
    },
  }));
}

export function assembleTutorStubResistanceActionRegisterConfirmationPreflight({ packets, contract: _contract }) {
  const rows = packets.flatMap((packet) => packet.cases);
  const plain = rows.filter((row) => row.realization === 'plain');
  const warm = rows.filter((row) => row.realization === 'warm');
  const plainRecovered = plain.filter((row) => row.outcome.recovered).length;
  const warmRecovered = warm.filter((row) => row.outcome.recovered).length;
  const fisherP = fisherExactTwoSidedP(warmRecovered, warm.length, plainRecovered, plain.length);
  const endpointComplete =
    rows.length === 36 &&
    plain.length === 18 &&
    warm.length === 18 &&
    rows.every(
      (row) =>
        typeof row.outcome.recovered === 'boolean' &&
        Number.isFinite(row.outcome.proof_debt_delta) &&
        Number.isInteger(row.outcome.new_supported_public_premises),
    );
  return {
    case_ids: rows.map((row) => row.case_id),
    endpoint_status: {
      profile_specific_resistance_recovery: endpointComplete ? 'complete' : 'incomplete',
      fisher_exact_two_sided_confirmation: endpointComplete && Number.isFinite(fisherP) ? 'complete' : 'incomplete',
      action_register_fidelity_and_safety: rows.every(
        (row) => typeof row.fidelity.action_visible === 'boolean' && typeof row.fidelity.register_visible === 'boolean',
      )
        ? 'complete'
        : 'incomplete',
      fresh_independent_assembly: endpointComplete ? 'complete' : 'incomplete',
    },
    report: {
      schema: 'machinespirits.tutor-stub.resistance-action-register-confirmation-report.v1',
      status: 'synthetic_endpoint_complete',
      rows,
      analysis: {
        test: 'fisher_exact_two_sided',
        alpha: 0.05,
        plain: { recovered: plainRecovered, total: plain.length },
        warm: { recovered: warmRecovered, total: warm.length },
        p_value: fisherP,
      },
    },
  };
}

export function buildTutorStubResistanceActionRegisterConfirmationPackets(cases) {
  return Array.from({ length: 9 }, (_, index) => {
    const blockId = `block_${String(index + 1).padStart(2, '0')}`;
    const rows = cases.filter((row) => row.block_id === blockId);
    return {
      schema: 'machinespirits.tutor-stub.resistance-action-register-confirmation-preflight-packet.v1',
      packet_id: blockId,
      case_ids: rows.map((row) => row.case_id),
      cases: rows,
    };
  });
}

export function runTutorStubResistanceActionRegisterConfirmationPreflight({ contract, registration }) {
  const preflight = runPaidStudyEndpointPreflight({
    contract,
    cases: buildTutorStubResistanceActionRegisterConfirmationSyntheticCorpus(registration),
    buildPackets: buildTutorStubResistanceActionRegisterConfirmationPackets,
    assemble: assembleTutorStubResistanceActionRegisterConfirmationPreflight,
  });
  const test = registration.measurement.confirmatoryTest;
  const readiness = registration.executionReadiness;
  const powerAt17 = fisherExactPower(17, 1 / 6, 4 / 6, 0.05);
  const powerAt18 = fisherExactPower(18, 1 / 6, 4 / 6, 0.05);
  if (
    test.test !== 'fisher_exact_two_sided' ||
    test.alpha !== 0.05 ||
    test.interimAnalysis !== false ||
    test.calibrationDataPooled !== false ||
    powerAt17 !== test.powering.powerAt17PerArm ||
    powerAt18 !== test.powering.powerAt18PerArm ||
    powerAt17 >= 0.8 ||
    powerAt18 < 0.8 ||
    readiness.maximumModelAttemptReservationsPerDialogue !== 60 ||
    readiness.batches.length !== 9 ||
    readiness.batches.some((batch) => batch.maximumModelAttemptReservations !== 240) ||
    readiness.combinedMaximumModelAttemptReservations !== 2160
  ) {
    throw new Error('confirmation preflight power, no-interim, or hard-attempt contract drifted');
  }
  return {
    ...preflight,
    confirmation_readiness_audit: {
      status: 'passed_zero_call',
      fresh_independent_dialogues: 36,
      plain: 18,
      warm: 18,
      balanced_batches: 9,
      dialogues_per_batch: 4,
      fisher_exact_two_sided: true,
      alpha: 0.05,
      target_power: 0.8,
      power_at_17_per_arm: powerAt17,
      power_at_18_per_arm: powerAt18,
      minimum_n_per_arm: 18,
      maximum_model_attempt_reservations_per_dialogue: 60,
      maximum_model_attempt_reservations_per_batch: 240,
      combined_maximum_model_attempt_reservations: 2160,
      programme_ceiling_required: 2345,
      calibration_dialogues_reused_or_pooled: 0,
      partial_or_interim_interpretation_permitted: false,
      model_calls: 0,
      production_writes: 0,
    },
  };
}

export { scoreTutorStubResistanceRecovery };

export default {
  assembleTutorStubResistanceActionRegisterConfirmationPreflight,
  buildTutorStubResistanceActionRegisterConfirmationPackets,
  buildTutorStubResistanceActionRegisterConfirmationPlan,
  buildTutorStubResistanceActionRegisterConfirmationSyntheticCorpus,
  configureTutorStubResistanceActionRegisterConfirmationExecution,
  configureTutorStubResistanceActionRegisterConfirmationFromCli,
  loadTutorStubResistanceActionRegisterConfirmation,
  resolveTutorStubResistanceActionRegisterConfirmationJob,
  runTutorStubResistanceActionRegisterConfirmationPreflight,
};
