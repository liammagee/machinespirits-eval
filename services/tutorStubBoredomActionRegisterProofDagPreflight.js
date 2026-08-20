import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BOREDOM_PROOF_DAG_REGISTRATION_PATH =
  'config/tutor-stub-boredom-action-register-proof-dag-registration.v1.json';
const BLOCKED_POWER_CACHE = new Map();

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

function factorial(value) {
  let result = 1;
  for (let index = 2; index <= value; index += 1) result *= index;
  return result;
}

function hypergeometricProbability({ plainN, warmN, totalSuccesses, warmSuccesses }) {
  const plainSuccesses = totalSuccesses - warmSuccesses;
  if (warmSuccesses < 0 || warmSuccesses > warmN || plainSuccesses < 0 || plainSuccesses > plainN) {
    return 0;
  }
  return (choose(warmN, warmSuccesses) * choose(plainN, plainSuccesses)) / choose(warmN + plainN, totalSuccesses);
}

function exactConditionalScoreDistribution(blocks, cache = new Map()) {
  const ordered = [...blocks].sort(
    (left, right) =>
      left.plainN - right.plainN || left.warmN - right.warmN || left.totalSuccesses - right.totalSuccesses,
  );
  const key = ordered.map((row) => `${row.plainN}:${row.warmN}:${row.totalSuccesses}`).join('|');
  if (cache.has(key)) return cache.get(key);
  let distribution = new Map([[0, 1]]);
  for (const block of ordered) {
    const next = new Map();
    const minimum = Math.max(0, block.totalSuccesses - block.plainN);
    const maximum = Math.min(block.warmN, block.totalSuccesses);
    for (const [priorSuccesses, priorMass] of distribution.entries()) {
      for (let warmSuccesses = minimum; warmSuccesses <= maximum; warmSuccesses += 1) {
        const totalWarmSuccesses = priorSuccesses + warmSuccesses;
        const mass =
          priorMass *
          hypergeometricProbability({
            plainN: block.plainN,
            warmN: block.warmN,
            totalSuccesses: block.totalSuccesses,
            warmSuccesses,
          });
        next.set(totalWarmSuccesses, (next.get(totalWarmSuccesses) || 0) + mass);
      }
    }
    distribution = next;
  }
  cache.set(key, distribution);
  return distribution;
}

export function exactBlockedScorePValue(blocks, { distributionCache = new Map() } = {}) {
  if (
    !Array.isArray(blocks) ||
    blocks.length < 1 ||
    blocks.some(
      (row) =>
        !Number.isInteger(row.plainN) ||
        !Number.isInteger(row.warmN) ||
        row.plainN < 1 ||
        row.warmN < 1 ||
        !Number.isInteger(row.plainSuccesses) ||
        !Number.isInteger(row.warmSuccesses) ||
        row.plainSuccesses < 0 ||
        row.plainSuccesses > row.plainN ||
        row.warmSuccesses < 0 ||
        row.warmSuccesses > row.warmN,
    )
  ) {
    throw new Error('invalid exact blocked score-test inputs');
  }
  const normalized = blocks.map((row) => ({
    plainN: row.plainN,
    warmN: row.warmN,
    totalSuccesses: row.plainSuccesses + row.warmSuccesses,
  }));
  const observedWarmSuccesses = blocks.reduce((sum, row) => sum + row.warmSuccesses, 0);
  const distribution = exactConditionalScoreDistribution(normalized, distributionCache);
  const observedMass = distribution.get(observedWarmSuccesses) || 0;
  return [...distribution.values()].reduce(
    (sum, mass) => sum + (mass <= observedMass + Number.EPSILON * 8 ? mass : 0),
    0,
  );
}

function buildEqualBlockAlternativeStates({ blocks, perArm, plainRecoveryRate, warmRecoveryRate }) {
  const categories = [];
  for (let plainSuccesses = 0; plainSuccesses <= perArm; plainSuccesses += 1) {
    for (let warmSuccesses = 0; warmSuccesses <= perArm; warmSuccesses += 1) {
      categories.push({
        plainSuccesses,
        warmSuccesses,
        totalSuccesses: plainSuccesses + warmSuccesses,
        mass:
          binomialProbability(perArm, plainSuccesses, plainRecoveryRate) *
          binomialProbability(perArm, warmSuccesses, warmRecoveryRate),
      });
    }
  }
  const states = [];
  const selected = [];
  function visit(startIndex) {
    if (selected.length === blocks) {
      const counts = new Map();
      let mass = 1;
      let warmSuccesses = 0;
      const totals = [];
      for (const index of selected) {
        counts.set(index, (counts.get(index) || 0) + 1);
        const category = categories[index];
        mass *= category.mass;
        warmSuccesses += category.warmSuccesses;
        totals.push(category.totalSuccesses);
      }
      let multiplicity = factorial(blocks);
      for (const count of counts.values()) multiplicity /= factorial(count);
      states.push({
        blocks: totals
          .sort((left, right) => left - right)
          .map((totalSuccesses) => ({
            plainN: perArm,
            warmN: perArm,
            totalSuccesses,
          })),
        mass: mass * multiplicity,
        warmSuccesses,
      });
      return;
    }
    for (let index = startIndex; index < categories.length; index += 1) {
      selected.push(index);
      visit(index);
      selected.pop();
    }
  }
  visit(0);
  return states;
}

export function exactBlockedScorePower({ perArmByWorld, plainRecoveryRate, warmRecoveryRate, alpha = 0.05 }) {
  if (
    !Array.isArray(perArmByWorld) ||
    perArmByWorld.length < 1 ||
    perArmByWorld.some((value) => !Number.isInteger(value) || value < 1) ||
    !(plainRecoveryRate > 0 && plainRecoveryRate < 1) ||
    !(warmRecoveryRate > 0 && warmRecoveryRate < 1) ||
    !(alpha > 0 && alpha < 1)
  ) {
    throw new Error('invalid exact blocked score-test power inputs');
  }
  const cacheKey = JSON.stringify({ perArmByWorld, plainRecoveryRate, warmRecoveryRate, alpha });
  if (BLOCKED_POWER_CACHE.has(cacheKey)) return BLOCKED_POWER_CACHE.get(cacheKey);
  const groups = new Map();
  for (const perArm of perArmByWorld) groups.set(perArm, (groups.get(perArm) || 0) + 1);
  const groupedStates = [...groups.entries()].map(([perArm, blocks]) =>
    buildEqualBlockAlternativeStates({ blocks, perArm, plainRecoveryRate, warmRecoveryRate }),
  );
  const distributionCache = new Map();
  const pValueCache = new Map();
  let power = 0;
  function combine(groupIndex, blocks, warmSuccesses, mass) {
    if (groupIndex === groupedStates.length) {
      const ordered = [...blocks].sort(
        (left, right) =>
          left.plainN - right.plainN || left.warmN - right.warmN || left.totalSuccesses - right.totalSuccesses,
      );
      const key = `${ordered.map((row) => `${row.plainN}:${row.warmN}:${row.totalSuccesses}`).join('|')}#${warmSuccesses}`;
      let pValue = pValueCache.get(key);
      if (pValue === undefined) {
        const distribution = exactConditionalScoreDistribution(ordered, distributionCache);
        const observedMass = distribution.get(warmSuccesses) || 0;
        pValue = [...distribution.values()].reduce(
          (sum, value) => sum + (value <= observedMass + Number.EPSILON * 8 ? value : 0),
          0,
        );
        pValueCache.set(key, pValue);
      }
      if (pValue <= alpha + Number.EPSILON * 8) power += mass;
      return;
    }
    for (const state of groupedStates[groupIndex]) {
      combine(groupIndex + 1, [...blocks, ...state.blocks], warmSuccesses + state.warmSuccesses, mass * state.mass);
    }
  }
  combine(0, [], 0, 1);
  BLOCKED_POWER_CACHE.set(cacheKey, power);
  return power;
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
    registration?.measurement?.primaryEndpoint?.deadlinePostTriggerLearnerTurns !== 1 ||
    registration?.measurement?.primaryEndpoint?.analysis !== 'two_sided_exact_conditional_blocked_score_test' ||
    registration?.measurement?.keySecondaryEndpoint?.id !== 'objective_proof_progress_by_two_turns'
  ) {
    errors.push('registered recovery and objective proof-progress endpoints drifted');
  }
  const powerAt17 = exactBlockedScorePower({
    perArmByWorld: [2, 3, 3, 3, 3, 3],
    plainRecoveryRate: 1 / 6,
    warmRecoveryRate: 4 / 6,
  });
  const powerAt18 = exactBlockedScorePower({
    perArmByWorld: [3, 3, 3, 3, 3, 3],
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
    Math.abs(power.powerAt17PerArm - powerAt17) > 1e-10 ||
    Math.abs(power.powerAt18PerArm - powerAt18) > 1e-10 ||
    !(powerAt17 < 0.8 && powerAt18 >= 0.8)
  ) {
    errors.push('exact blocked score-test power proof does not establish 18 per arm as the minimum');
  }
  if (
    power.designChoiceAudit?.pairedExactMcNemarMinimumPairs !== 28 ||
    Math.abs(power.designChoiceAudit?.pairedPowerAt27 - pairedPowerAt27) > 1e-12 ||
    Math.abs(power.designChoiceAudit?.pairedPowerAt28 - pairedPowerAt28) > 1e-12 ||
    !(pairedPowerAt27 < 0.8 && pairedPowerAt28 >= 0.8) ||
    power.designChoiceAudit?.pairedHardAttemptCeiling !== 2856 ||
    power.designChoiceAudit?.selectedIndependentBlockedHardAttemptCeiling !== 2160
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
    execution.programmeCeilingForThisStudyAlone?.requiredCeiling !== 2379 ||
    execution.programmeCeilingForThisStudyAlone?.incrementAboveCurrentLedger !== 2160 ||
    execution.programmeCeilingIfFrameRefusalConfirmationAlsoReserved?.requiredCeiling !== 4539 ||
    execution.programmeCeilingIfFrameRefusalConfirmationAlsoReserved?.incrementAboveFrameRefusalSuccessorCeiling !==
      2160 ||
    execution.attemptAccountingRole !==
      'operational_execution_safeguard_only_not_scientific_endpoint_design_objective_or_sample_size_constraint'
  ) {
    errors.push('programme ceiling amendment arithmetic drifted');
  }
  if (
    registration?.design?.randomization?.algorithm !== 'sha256_rank_within_world' ||
    registration?.design?.randomization?.assignmentSeed !== 20260820 ||
    registration?.design?.randomization?.assignmentManifestSha256 !==
      '4e256dfa65054747a5d6d1ac82d1aecb42f7c98f158cb76e686f24c37d71ef94'
  ) {
    errors.push('randomization assignment drifted');
  }
  if (
    registration?.design?.noReuseOrPooling?.priorOutcomesPooled !== false ||
    registration?.design?.noReuseOrPooling?.priorTwelveCalibrationDialoguesReused !== false ||
    registration?.design?.noReuseOrPooling?.interimAnalysis !== false ||
    execution.validUnitReruns !== false ||
    execution.outcomeSelection !== false ||
    execution.liveExecutorAvailable !== true ||
    execution.combinedAnalyzerAvailable !== true ||
    execution.requestValidatorAvailable !== true
  ) {
    errors.push('no-reuse, no-selection, or zero-call readiness boundary drifted');
  }
  return { ok: errors.length === 0, errors, powerAt17, powerAt18 };
}

function assignmentManifestSha256(rows) {
  return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

export function buildTutorStubBoredomProofDagAssignments(registration) {
  const assignmentSeed = registration.design.randomization.assignmentSeed;
  const manifest = registration.design.worlds.flatMap((world) => {
    const ranked = Array.from({ length: 6 }, (_, dialogueIndex) => ({
      world,
      dialogue_index: dialogueIndex + 1,
      assignment_rank_sha256: crypto
        .createHash('sha256')
        .update(`${assignmentSeed}:${world}:${dialogueIndex + 1}`)
        .digest('hex'),
    })).sort((left, right) => left.assignment_rank_sha256.localeCompare(right.assignment_rank_sha256));
    const realizationByDialogue = new Map(
      ranked.map((row, index) => [row.dialogue_index, index < 3 ? 'plain' : 'warm']),
    );
    return ranked
      .map((row) => ({ ...row, realization: realizationByDialogue.get(row.dialogue_index) }))
      .sort((left, right) => left.dialogue_index - right.dialogue_index);
  });
  const digest = assignmentManifestSha256(manifest);
  if (digest !== registration.design.randomization.assignmentManifestSha256) {
    throw new Error('predeclared boredom register assignment manifest drifted');
  }
  return { digest, manifest };
}

export function buildTutorStubBoredomProofDagPlan(registration) {
  const validation = validateTutorStubBoredomProofDagRegistration(registration);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const assignments = buildTutorStubBoredomProofDagAssignments(registration);
  const candidates = assignments.manifest.map((row) => {
    const worldIndex = registration.design.worlds.indexOf(row.world);
    const ordinal = worldIndex * 6 + row.dialogue_index - 1;
    return {
      id: `bored-confirm-w${worldIndex + 1}-d${row.dialogue_index}`,
      type: 'fresh_bored_register_confirmation_dialogue',
      assignment_index: ordinal + 1,
      world: row.world,
      seed: registration.design.freshPrefixGeneration.seedBase + ordinal + 1,
      maximum_trigger_turn: 2,
      pedagogical_move: 'ask_discriminating_question',
      realization: row.realization,
      assignment_rank_sha256: row.assignment_rank_sha256,
      assignment_manifest_sha256: assignments.digest,
      maximum_model_attempt_reservations: 60,
    };
  });
  const plain = candidates.filter((row) => row.realization === 'plain');
  const warm = candidates.filter((row) => row.realization === 'warm');
  const jobs = Array.from({ length: 9 }, (_, batchIndex) => {
    const batchId = `execution_batch_${batchIndex + 1}`;
    return [plain[batchIndex * 2], warm[batchIndex * 2], plain[batchIndex * 2 + 1], warm[batchIndex * 2 + 1]].map(
      (row) => ({ ...row, batch_id: batchId }),
    );
  }).flat();
  return {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-plan.v1',
    assignment_manifest_sha256: assignments.digest,
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
      seed: job.seed,
      pedagogical_move: job.pedagogical_move,
      realization: job.realization,
      assignment_rank_sha256: job.assignment_rank_sha256,
      assignment_manifest_sha256: job.assignment_manifest_sha256,
      trigger: { profile: 'bored', observed_by_turn: 2, profile_identity_used: false },
      outcome: {
        recovered,
        deadline_turns: 1,
        observed_turn: recovered ? 1 : null,
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

export function objectiveProofProgressByTwoTurns(outcome) {
  return Boolean(
    Number.isInteger(outcome?.new_supported_public_premises) &&
    outcome.new_supported_public_premises >= 1 &&
    Number.isFinite(outcome?.best_path_coverage_delta) &&
    outcome.best_path_coverage_delta > 0 &&
    Number.isFinite(outcome?.proof_debt_delta) &&
    outcome.proof_debt_delta < 0 &&
    Number.isInteger(outcome?.unsupported_public_claims) &&
    outcome.unsupported_public_claims === 0,
  );
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
  const registration = loadTutorStubBoredomProofDagRegistration();
  const plan = buildTutorStubBoredomProofDagPlan(registration);
  const expectedById = new Map(plan.jobs.map((row) => [row.id, row]));
  const plain = cases.filter((row) => row.arm === 'plain');
  const warm = cases.filter((row) => row.arm === 'warm');
  const plainSuccesses = plain.filter((row) => row.outcome.recovered).length;
  const warmSuccesses = warm.filter((row) => row.outcome.recovered).length;
  const distinctPrefixes = new Set(cases.map((row) => row.prefix_id)).size;
  const exactPlanFidelity =
    cases.length === plan.jobs.length &&
    new Set(cases.map((row) => row.case_id)).size === plan.jobs.length &&
    cases.every((row) => {
      const expected = expectedById.get(row.case_id);
      return Boolean(
        expected &&
        row.arm === expected.realization &&
        row.realization === expected.realization &&
        row.world === expected.world &&
        row.seed === expected.seed &&
        row.batch_id === expected.batch_id &&
        row.pedagogical_move === expected.pedagogical_move &&
        row.assignment_rank_sha256 === expected.assignment_rank_sha256 &&
        row.assignment_manifest_sha256 === plan.assignment_manifest_sha256,
      );
    });
  const recovery = cases.every(
    (row) =>
      typeof row.outcome?.recovered === 'boolean' &&
      row.outcome.deadline_turns === 1 &&
      Object.hasOwn(row.outcome, 'observed_turn') &&
      (row.outcome.recovered ? row.outcome.observed_turn === 1 : row.outcome.observed_turn === null),
  );
  const objective = cases.every(
    (row) =>
      typeof row.outcome.proof_progress_by_two_turns === 'boolean' &&
      Number.isInteger(row.outcome.new_supported_public_premises) &&
      Number.isFinite(row.outcome.best_path_coverage_delta) &&
      Number.isFinite(row.outcome.proof_debt_delta) &&
      Number.isInteger(row.outcome.unsupported_public_claims) &&
      row.outcome.proof_progress_by_two_turns === objectiveProofProgressByTwoTurns(row.outcome),
  );
  const fidelity = cases.every(
    (row) =>
      row.fidelity.action_visible === true &&
      row.fidelity.register_visible === true &&
      row.fidelity.safety_override === false &&
      row.fidelity.protected_condition === false,
  );
  const blocks = registration.design.worlds.map((world) => {
    const rows = cases.filter((row) => row.world === world);
    const worldPlain = rows.filter((row) => row.arm === 'plain');
    const worldWarm = rows.filter((row) => row.arm === 'warm');
    return {
      world,
      plainN: worldPlain.length,
      warmN: worldWarm.length,
      plainSuccesses: worldPlain.filter((row) => row.outcome.recovered).length,
      warmSuccesses: worldWarm.filter((row) => row.outcome.recovered).length,
    };
  });
  const endpointStatus = {
    profile_specific_resistance_recovery:
      exactPlanFidelity && recovery && plain.length === 18 && warm.length === 18 ? 'complete' : 'incomplete',
    objective_proof_progress_by_two_turns: exactPlanFidelity && objective ? 'complete' : 'incomplete',
    randomized_register_assembly: exactPlanFidelity && distinctPrefixes === 36 ? 'complete' : 'incomplete',
    action_register_fidelity_and_safety: exactPlanFidelity && fidelity ? 'complete' : 'incomplete',
  };
  return {
    case_ids: cases.map((row) => row.case_id),
    endpoint_status: endpointStatus,
    report: {
      schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-preflight-report.v1',
      status: Object.values(endpointStatus).every((status) => status === 'complete')
        ? 'synthetic_endpoint_complete'
        : 'synthetic_endpoint_incomplete',
      distinct_fresh_prefixes: distinctPrefixes,
      plain_dialogues: plain.length,
      warm_dialogues: warm.length,
      plain_successes: plainSuccesses,
      warm_successes: warmSuccesses,
      exact_two_sided_conditional_blocked_score_p: exactBlockedScorePValue(blocks),
      blocks,
      exact_plan_fidelity: exactPlanFidelity,
      deadline_turns: 1,
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
      required_programme_ceiling_study_alone: 2379,
      required_programme_ceiling_with_frame_refusal_reservation: 4539,
      live_executor_available: true,
      combined_analyzer_available: true,
      request_validator_available: true,
      model_calls: 0,
      production_writes: 0,
    },
  };
}

export default {
  assembleTutorStubBoredomProofDagPreflight,
  buildTutorStubBoredomProofDagAssignments,
  buildTutorStubBoredomProofDagPackets,
  buildTutorStubBoredomProofDagPlan,
  buildTutorStubBoredomProofDagSyntheticCases,
  exactBlockedScorePValue,
  exactBlockedScorePower,
  exactMcNemarPower,
  exactTwoSidedMcNemarPValue,
  loadTutorStubBoredomProofDagRegistration,
  runTutorStubBoredomProofDagEndpointPreflight,
  objectiveProofProgressByTwoTurns,
  validateTutorStubBoredomProofDagRegistration,
};
