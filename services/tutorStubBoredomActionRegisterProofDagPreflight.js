import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';
import { fisherExactTwoSided } from './fisherExact.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BOREDOM_PROOF_DAG_REGISTRATION_PATH =
  'config/tutor-stub-boredom-action-register-proof-dag-registration.v1.json';

function choose(n, k) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || k > n) return 0;
  let result = 1;
  for (let index = 1; index <= k; index += 1) result = (result * (n - k + index)) / index;
  return result;
}

function binomialProbability(n, k, probability) {
  return choose(n, k) * probability ** k * (1 - probability) ** (n - k);
}

function binomialLowerTail(n, k, probability) {
  let result = 0;
  for (let index = 0; index <= k; index += 1) result += binomialProbability(n, index, probability);
  return result;
}

export function exactTwoSidedMcNemarPValue(warmOnly, plainOnly) {
  const discordant = warmOnly + plainOnly;
  if (!Number.isInteger(warmOnly) || !Number.isInteger(plainOnly) || warmOnly < 0 || plainOnly < 0) {
    throw new Error('McNemar discordant counts must be non-negative integers');
  }
  if (discordant === 0) return 1;
  const lower = binomialLowerTail(discordant, warmOnly, 0.5);
  let upper = 0;
  for (let index = warmOnly; index <= discordant; index += 1) {
    upper += binomialProbability(discordant, index, 0.5);
  }
  return Math.min(1, 2 * Math.min(lower, upper));
}

export function exactMcNemarPower({ pairs, warmOnlyProbability, plainOnlyProbability, alpha = 0.05 }) {
  const discordanceProbability = warmOnlyProbability + plainOnlyProbability;
  if (
    !Number.isInteger(pairs) ||
    pairs < 1 ||
    !(discordanceProbability > 0 && discordanceProbability <= 1) ||
    warmOnlyProbability < 0 ||
    plainOnlyProbability < 0
  ) {
    throw new Error('invalid exact McNemar power inputs');
  }
  const conditionalWarmProbability = warmOnlyProbability / discordanceProbability;
  let power = 0;
  for (let discordant = 0; discordant <= pairs; discordant += 1) {
    let rejection = 0;
    for (let warmOnly = 0; warmOnly <= discordant; warmOnly += 1) {
      if (exactTwoSidedMcNemarPValue(warmOnly, discordant - warmOnly) <= alpha + Number.EPSILON) {
        rejection += binomialProbability(discordant, warmOnly, conditionalWarmProbability);
      }
    }
    power += binomialProbability(pairs, discordant, discordanceProbability) * rejection;
  }
  return power;
}

export function exactFisherPower({ perArm, plainRecoveryRate, warmRecoveryRate, alpha = 0.05 }) {
  if (
    !Number.isInteger(perArm) ||
    perArm < 1 ||
    !(plainRecoveryRate > 0 && plainRecoveryRate < 1) ||
    !(warmRecoveryRate > 0 && warmRecoveryRate < 1) ||
    !(alpha > 0 && alpha < 1)
  ) {
    throw new Error('invalid exact Fisher power inputs');
  }
  let power = 0;
  for (let plainSuccesses = 0; plainSuccesses <= perArm; plainSuccesses += 1) {
    const plainMass = binomialProbability(perArm, plainSuccesses, plainRecoveryRate);
    for (let warmSuccesses = 0; warmSuccesses <= perArm; warmSuccesses += 1) {
      if (
        fisherExactTwoSided(plainSuccesses, perArm - plainSuccesses, warmSuccesses, perArm - warmSuccesses) <= alpha
      ) {
        power += plainMass * binomialProbability(perArm, warmSuccesses, warmRecoveryRate);
      }
    }
  }
  return power;
}

export function loadTutorStubBoredomProofDagRegistration({ root = ROOT } = {}) {
  return JSON.parse(fs.readFileSync(path.join(root, BOREDOM_PROOF_DAG_REGISTRATION_PATH), 'utf8'));
}

export function validateTutorStubBoredomProofDagRegistration(registration) {
  const errors = [];
  const worlds = registration?.design?.worlds || [];
  const power = registration?.power || {};
  const execution = registration?.executionReadiness || {};
  const dialogue = execution.dialogue || {};
  const batches = execution.batches || {};
  if (registration?.schema !== 'machinespirits.tutor-stub.boredom-action-register-proof-dag-registration.v1') {
    errors.push('unsupported boredom proof-DAG registration schema');
  }
  if (registration?.status !== 'prospective_zero_call_readiness_hold') errors.push('registration must remain HOLD');
  if (
    registration?.authorization?.modelCallsAuthorized !== false ||
    registration?.authorization?.liveRunAuthorized !== false ||
    registration?.authorization?.goRequestPrepared !== false
  ) {
    errors.push('zero-call registration cannot authorize execution or prepare a GO request');
  }
  if (new Set(worlds).size !== 6 || worlds.length !== 6) errors.push('design must bind six distinct worlds');
  if (
    registration?.design?.freshPrefixGeneration?.requiredDistinctPrefixes !== 36 ||
    registration?.design?.randomization?.dialogues !== 36 ||
    registration?.design?.randomization?.plainDialogues !== 18 ||
    registration?.design?.randomization?.warmDialogues !== 18 ||
    registration?.design?.randomization?.continuationsPerPrefix !== 1
  ) {
    errors.push('design must bind 36 fresh distinct independently randomized dialogues');
  }
  if (
    registration?.design?.treatment?.fixedPedagogicalMove !== 'ask_discriminating_question' ||
    JSON.stringify(registration?.design?.treatment?.realizations) !== JSON.stringify(['plain', 'warm'])
  ) {
    errors.push('design must isolate plain versus warm after the fixed boredom-appropriate action');
  }
  if (
    registration?.measurement?.primaryEndpoint?.id !== 'profile_specific_resistance_recovery' ||
    registration?.measurement?.primaryEndpoint?.analysis !== 'two_sided_fisher_exact' ||
    registration?.measurement?.keySecondaryEndpoint?.id !== 'objective_proof_progress_by_two_turns'
  ) {
    errors.push('registered recovery and objective proof-progress endpoints drifted');
  }
  const powerAt17 = exactFisherPower({
    perArm: 17,
    plainRecoveryRate: 1 / 6,
    warmRecoveryRate: 4 / 6,
  });
  const powerAt18 = exactFisherPower({
    perArm: 18,
    plainRecoveryRate: 1 / 6,
    warmRecoveryRate: 4 / 6,
  });
  const pairedPowerAt27 = exactMcNemarPower({
    pairs: 27,
    warmOnlyProbability: 4 / 6,
    plainOnlyProbability: 1 / 6,
  });
  const pairedPowerAt28 = exactMcNemarPower({
    pairs: 28,
    warmOnlyProbability: 4 / 6,
    plainOnlyProbability: 1 / 6,
  });
  if (
    power.minimumPerArm !== 18 ||
    Math.abs(power.powerAt17PerArm - powerAt17) > 1e-12 ||
    Math.abs(power.powerAt18PerArm - powerAt18) > 1e-12 ||
    !(powerAt17 < 0.8 && powerAt18 >= 0.8)
  ) {
    errors.push('exact Fisher power proof does not establish 18 per arm as the minimum');
  }
  if (
    power.designChoiceAudit?.pairedExactMcNemarMinimumPairs !== 28 ||
    Math.abs(power.designChoiceAudit?.pairedPowerAt27 - pairedPowerAt27) > 1e-12 ||
    Math.abs(power.designChoiceAudit?.pairedPowerAt28 - pairedPowerAt28) > 1e-12 ||
    !(pairedPowerAt27 < 0.8 && pairedPowerAt28 >= 0.8) ||
    power.designChoiceAudit?.pairedHardAttemptCeiling !== 2856 ||
    power.designChoiceAudit?.selectedIndependentFisherHardAttemptCeiling !== 2160
  ) {
    errors.push('independent-versus-paired smallest-design audit drifted');
  }
  if (
    execution.maximumReservationsPerPlannedCall !== 3 ||
    dialogue.oneCumulativeFullLearnerRepairCalls !== 2 ||
    dialogue.plannedCallsPerDialogue !== 20 ||
    dialogue.maximumReservationsPerDialogue !== 60 ||
    dialogue.dialogues !== 36 ||
    dialogue.maximumReservations !== 2160 ||
    execution.hardStudyAttemptCeiling !== 2160
  ) {
    errors.push('hard attempt arithmetic drifted');
  }
  if (
    batches.executionBatches !== 9 ||
    batches.dialoguesPerBatch !== 4 ||
    batches.plainPerBatch !== 2 ||
    batches.warmPerBatch !== 2 ||
    batches.maximumReservationsPerBatch !== 240 ||
    batches.totalBatches !== 9 ||
    batches.noInterimAnalysis !== true
  ) {
    errors.push('predeclared batch partition drifted');
  }
  if (
    execution.programmeCeilingForThisStudyAlone?.requiredCeiling !== 2345 ||
    execution.programmeCeilingForThisStudyAlone?.amendmentAboveCurrent1200 !== 1145 ||
    execution.programmeCeilingIfFrameRefusalConfirmationAlsoReserved?.requiredCeiling !== 4505 ||
    execution.programmeCeilingIfFrameRefusalConfirmationAlsoReserved?.amendmentAboveCurrent1200 !== 3305
  ) {
    errors.push('programme ceiling amendment arithmetic drifted');
  }
  if (
    registration?.design?.noReuseOrPooling?.priorOutcomesPooled !== false ||
    registration?.design?.noReuseOrPooling?.priorTwelveCalibrationDialoguesReused !== false ||
    registration?.design?.noReuseOrPooling?.interimAnalysis !== false ||
    execution.validUnitReruns !== false ||
    execution.outcomeSelection !== false ||
    execution.liveExecutorAvailable !== false ||
    execution.combinedAnalyzerAvailable !== false ||
    execution.requestValidatorAvailable !== false
  ) {
    errors.push('no-reuse, no-selection, or zero-call readiness boundary drifted');
  }
  return { ok: errors.length === 0, errors, powerAt17, powerAt18 };
}

export function buildTutorStubBoredomProofDagPlan(registration) {
  const validation = validateTutorStubBoredomProofDagRegistration(registration);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const jobs = registration.design.worlds.flatMap((world, worldIndex) =>
    Array.from({ length: 6 }, (_, dialogueIndex) => {
      const ordinal = worldIndex * 6 + dialogueIndex;
      const realization = ordinal % 2 === 0 ? 'plain' : 'warm';
      return {
        id: `bored-confirm-w${worldIndex + 1}-d${dialogueIndex + 1}__${realization}`,
        type: 'fresh_bored_register_confirmation_dialogue',
        world,
        seed: registration.design.freshPrefixGeneration.seedBase + ordinal + 1,
        maximum_trigger_turn: 2,
        pedagogical_move: 'ask_discriminating_question',
        realization,
        maximum_model_attempt_reservations: 60,
        batch_id: `execution_batch_${Math.floor(ordinal / 4) + 1}`,
      };
    }),
  );
  return {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-plan.v1',
    jobs,
    batches: Array.from({ length: 9 }, (_, index) => ({
      id: `execution_batch_${index + 1}`,
      cases: 4,
      plain: 2,
      warm: 2,
      ceiling: 240,
    })),
    total_maximum_model_attempt_reservations: 2160,
  };
}

export function buildTutorStubBoredomProofDagSyntheticCases(registration) {
  const plan = buildTutorStubBoredomProofDagPlan(registration);
  let plainSeen = 0;
  let warmSeen = 0;
  return plan.jobs.map((job) => {
    const warm = job.realization === 'warm';
    const withinArm = warm ? warmSeen++ : plainSeen++;
    const recovered = warm ? withinArm < 12 : withinArm < 3;
    return {
      case_id: job.id,
      arm: job.realization,
      batch_id: job.batch_id,
      prefix_id: `${job.id}:fresh-prefix`,
      world: job.world,
      pedagogical_move: job.pedagogical_move,
      realization: job.realization,
      trigger: { profile: 'bored', observed_by_turn: 2, profile_identity_used: false },
      outcome: {
        recovered,
        proof_progress_by_two_turns: recovered,
        new_supported_public_premises: recovered ? 1 : 0,
        best_path_coverage_delta: recovered ? 0.1 : 0,
        proof_debt_delta: recovered ? -1 : 0,
        unsupported_public_claims: 0,
      },
      fidelity: { action_visible: true, register_visible: true, safety_override: false, protected_condition: false },
    };
  });
}

export function buildTutorStubBoredomProofDagPackets(cases) {
  return [...new Set(cases.map((row) => row.batch_id))].map((batchId) => {
    const rows = cases.filter((row) => row.batch_id === batchId);
    return {
      schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-packet.v1',
      packet_id: batchId,
      case_ids: rows.map((row) => row.case_id),
      cases: rows,
    };
  });
}

export function assembleTutorStubBoredomProofDagPreflight({ cases, contract }) {
  const plain = cases.filter((row) => row.arm === 'plain');
  const warm = cases.filter((row) => row.arm === 'warm');
  const plainSuccesses = plain.filter((row) => row.outcome.recovered).length;
  const warmSuccesses = warm.filter((row) => row.outcome.recovered).length;
  const distinctPrefixes = new Set(cases.map((row) => row.prefix_id)).size;
  const balancedWorlds = [...new Set(cases.map((row) => row.world))].every((world) => {
    const rows = cases.filter((row) => row.world === world);
    return (
      rows.filter((row) => row.arm === 'plain').length === 3 && rows.filter((row) => row.arm === 'warm').length === 3
    );
  });
  const objective = cases.every(
    (row) =>
      typeof row.outcome.proof_progress_by_two_turns === 'boolean' &&
      Number.isInteger(row.outcome.new_supported_public_premises) &&
      Number.isFinite(row.outcome.best_path_coverage_delta) &&
      Number.isFinite(row.outcome.proof_debt_delta) &&
      Number.isInteger(row.outcome.unsupported_public_claims),
  );
  const fidelity = cases.every(
    (row) =>
      row.fidelity.action_visible === true &&
      row.fidelity.register_visible === true &&
      row.fidelity.safety_override === false &&
      row.fidelity.protected_condition === false,
  );
  return {
    case_ids: cases.map((row) => row.case_id),
    endpoint_status: {
      profile_specific_resistance_recovery: plain.length === 18 && warm.length === 18 ? 'complete' : 'incomplete',
      objective_proof_progress_by_two_turns: objective ? 'complete' : 'incomplete',
      randomized_register_assembly: distinctPrefixes === 36 && balancedWorlds ? 'complete' : 'incomplete',
      action_register_fidelity_and_safety: fidelity ? 'complete' : 'incomplete',
    },
    report: {
      schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-preflight-report.v1',
      status: 'synthetic_endpoint_complete',
      distinct_fresh_prefixes: distinctPrefixes,
      plain_dialogues: plain.length,
      warm_dialogues: warm.length,
      plain_successes: plainSuccesses,
      warm_successes: warmSuccesses,
      exact_two_sided_fisher_p: fisherExactTwoSided(
        plainSuccesses,
        plain.length - plainSuccesses,
        warmSuccesses,
        warm.length - warmSuccesses,
      ),
      rows: cases,
      contract_study_id: contract.study_id,
    },
  };
}

export function runTutorStubBoredomProofDagEndpointPreflight({ contract, registration }) {
  const validation = validateTutorStubBoredomProofDagRegistration(registration);
  if (!validation.ok) throw new Error(`registration invalid: ${validation.errors.join('; ')}`);
  const preflight = runPaidStudyEndpointPreflight({
    contract,
    cases: buildTutorStubBoredomProofDagSyntheticCases(registration),
    buildPackets: buildTutorStubBoredomProofDagPackets,
    assemble: assembleTutorStubBoredomProofDagPreflight,
  });
  return {
    ...preflight,
    readiness: {
      status: 'passed_zero_call_hold',
      source_prefixes: 36,
      independent_dialogues: 36,
      execution_batches: 9,
      hard_study_attempt_ceiling: 2160,
      required_programme_ceiling_study_alone: 2345,
      required_programme_ceiling_with_frame_refusal_reservation: 4505,
      live_executor_available: false,
      combined_analyzer_available: false,
      request_validator_available: false,
      model_calls: 0,
      production_writes: 0,
    },
  };
}

export default {
  assembleTutorStubBoredomProofDagPreflight,
  buildTutorStubBoredomProofDagPackets,
  buildTutorStubBoredomProofDagPlan,
  buildTutorStubBoredomProofDagSyntheticCases,
  exactFisherPower,
  exactMcNemarPower,
  exactTwoSidedMcNemarPValue,
  loadTutorStubBoredomProofDagRegistration,
  runTutorStubBoredomProofDagEndpointPreflight,
  validateTutorStubBoredomProofDagRegistration,
};
