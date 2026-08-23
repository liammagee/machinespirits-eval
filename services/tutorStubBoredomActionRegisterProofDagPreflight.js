import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';
import { RESISTANT_LEARNER_OBSERVATION_SEMANTICS, observeResistantLearnerTurn } from './resistantLearnerObservation.js';
import { parseTutorStubBoredomSemanticAdjudication } from './tutorStubBoredomSemanticAdjudication.js';
import { parseTutorStubBoredomSemanticAdjudication as parseTutorStubBoredomSemanticAdjudicationV3 } from './tutorStubBoredomSemanticAdjudicationV3.js';
import { tutorStubResistanceActionRegisterTreatmentEligibility } from './tutorStubResistanceActionRegisterStudy.js';

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

export function loadTutorStubBoredomProofDagRegistration({
  root = ROOT,
  registrationPath = BOREDOM_PROOF_DAG_REGISTRATION_PATH,
} = {}) {
  return JSON.parse(fs.readFileSync(path.join(root, registrationPath), 'utf8'));
}

/** The endpoint names its deadline in words, so `5` has to read back as `five`. */
function numberWord(value) {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][Number(value)] || null;
}

// The secondary endpoint reads one rule on a window the registration sets. Its
// name carries that window, so the name and the window must come from the same
// number. v1-v4 read two post-trigger turns and v5 reads five; both render here.
// A literal 'two' in one file and a 2 in another is the v4 defect in miniature.
export function boredomProofProgressNames(registration) {
  const word = numberWord(registration?.design?.treatment?.postTriggerLearnerTurns);
  if (!word) return { field: null, endpoint: null };
  return { field: `proof_progress_by_${word}_turns`, endpoint: `objective_proof_progress_by_${word}_turns` };
}

/** A registration written before the contrast could vary contrasts the manner. */
export const BOREDOM_MANNER_CONTRAST = 'realization_manner_plain_versus_warm';
const BOREDOM_MOVE_CONTRAST = 'pedagogical_move';

/**
 * Which axis the primary test contrasts, and which axis is only held balanced.
 *
 * v1 to v5 contrasted the manner the tutor spoke in, so every reader could
 * assume it. v6 contrasts two pedagogical moves and balances the manner nine
 * and nine inside each move. A reader that still assumed the manner would test
 * v6 on the balanced axis and file a move result under a manner heading.
 *
 * The preflight and the analyzer both need this, and they name their rows
 * differently: a preflight case carries `pedagogical_move_level` while a report
 * row carries `move_level`. So the reading lives here once and the caller says
 * what its own two fields are called.
 */
export function boredomContrastAxis(registration, { moveField = 'pedagogical_move_level', mannerField = 'arm' } = {}) {
  const treatment = registration?.design?.treatment || {};
  const contrast = treatment.contrast || BOREDOM_MANNER_CONTRAST;
  if (contrast !== BOREDOM_MANNER_CONTRAST && contrast !== BOREDOM_MOVE_CONTRAST) {
    throw new Error(`boredom proof-DAG analysis has no reader for the ${contrast} contrast`);
  }
  const contrastIsMove = contrast === BOREDOM_MOVE_CONTRAST;
  // Every registration from v1 names its two sides, so neither branch writes
  // "plain" and "warm" out again.
  const reference = treatment.reference;
  const treatmentLevel = treatment.treatment;
  if (!reference || !treatmentLevel || reference === treatmentLevel) {
    throw new Error('boredom proof-DAG analysis requires a registered reference level and a distinct treatment level');
  }
  return {
    contrast,
    contrastIsMove,
    reference,
    treatment: treatmentLevel,
    rowField: contrastIsMove ? moveField : mannerField,
    // Under the manner contrast there is no balanced axis, because the manner
    // is the contrast.
    blockField: contrastIsMove ? mannerField : null,
    blockLevels: contrastIsMove ? [...(treatment.realizations || [])] : [],
  };
}

export function validateTutorStubBoredomProofDagRegistration(registration) {
  const errors = [];
  const worlds = registration?.design?.worlds || [];
  const power = registration?.power || {};
  const execution = registration?.executionReadiness || {};
  const dialogue = execution.dialogue || {};
  const batches = execution.batches || {};
  const prospectiveV2 = registration?.version === 2;
  const prospectiveV3 = registration?.version === 3;
  const prospectiveV4 = registration?.version === 4;
  const prospectiveV5 = registration?.version === 5;
  const prospectiveV6 = registration?.version === 6;
  const semanticInstrumented = prospectiveV3 || prospectiveV4 || prospectiveV5 || prospectiveV6;
  const currentProgrammeLedger = prospectiveV2 || prospectiveV3;
  // v5 and v6 both carry the v4 semantic instrument and its spent sealed
  // corpus forward rather than earning the gates again, and both are checked on
  // derived arithmetic. Named once so a seventh version is one edit, not six.
  const carriesForwardV4Instrument = prospectiveV5 || prospectiveV6;
  // A separate name for a separate idea, even though the two versions coincide
  // today. One says which instrument a version runs; this one says how its
  // attempt arithmetic is checked.
  const derivedAttemptArithmetic = prospectiveV5 || prospectiveV6;
  // v5 widens the trigger window and the outcome horizon, so the numbers that
  // v1 to v4 assert as literals no longer describe it. Rather than add a fifth
  // set of literals, v5 is checked on the arithmetic: every attempt figure has
  // to derive from the turn budget it registers. That catches an inconsistent
  // edit the same way, and it survives the next change of turn budget. The
  // literals for v1 to v4 stay exactly as they are.
  const sealedLiteralArithmetic = !derivedAttemptArithmetic;
  if (
    ![
      'machinespirits.tutor-stub.boredom-action-register-proof-dag-registration.v1',
      'machinespirits.tutor-stub.boredom-action-register-proof-dag-registration.v2',
      'machinespirits.tutor-stub.boredom-action-register-proof-dag-registration.v3',
      'machinespirits.tutor-stub.boredom-action-register-proof-dag-registration.v4',
      'machinespirits.tutor-stub.boredom-action-register-proof-dag-registration.v5',
      'machinespirits.tutor-stub.boredom-action-register-proof-dag-registration.v6',
    ].includes(registration?.schema)
  ) {
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
  // v1 to v5 held the tutor move fixed and contrasted the manner. v6 turns that
  // around: the move is the contrast and the manner is a balancing block. Both
  // shapes have to be checkable, so the two are separate branches rather than
  // one loosened check that would pass either by accident.
  if (prospectiveV6) {
    const treatment = registration?.design?.treatment || {};
    const moves = treatment.pedagogicalMoves || {};
    if (
      JSON.stringify(treatment.pedagogicalMoveLevels) !== JSON.stringify(['ask_question', 'shrink_step']) ||
      moves.ask_question !== 'ask_discriminating_question' ||
      moves.shrink_step !== 'simplify_to_one_workable_step' ||
      treatment.reference !== 'ask_question' ||
      treatment.treatment !== 'shrink_step' ||
      treatment.hostActionFamily !== 'stage_next_step' ||
      treatment.hostActionFamilySharedByBothLevels !== true ||
      typeof treatment.hostActionFamilySharedReason !== 'string' ||
      treatment.realizationRole !== 'balancing_block_not_the_contrast' ||
      typeof treatment.treatmentMayNotSupplyTheFinding !== 'string' ||
      treatment.contentLeakageDisclosureRequired !== true ||
      treatment.assignedPedagogicalMoveTutorTurns !== 1 ||
      JSON.stringify(treatment.realizations) !== JSON.stringify(['plain', 'warm'])
    ) {
      errors.push('design must isolate the two boredom-appropriate moves with manner balanced inside each');
    }
    const randomization = registration?.design?.randomization || {};
    if (
      randomization.askQuestionDialogues !== 18 ||
      randomization.shrinkStepDialogues !== 18 ||
      randomization.askQuestionPerWorld !== 3 ||
      randomization.shrinkStepPerWorld !== 3 ||
      randomization.askQuestionPlain !== 9 ||
      randomization.askQuestionWarm !== 9 ||
      randomization.shrinkStepPlain !== 9 ||
      randomization.shrinkStepWarm !== 9
    ) {
      errors.push('registered move and manner margins do not balance to 18, 18 and 9 in each cell');
    }
  } else if (
    registration?.design?.treatment?.fixedPedagogicalMove !== 'ask_discriminating_question' ||
    JSON.stringify(registration?.design?.treatment?.realizations) !== JSON.stringify(['plain', 'warm'])
  ) {
    errors.push('design must isolate plain versus warm after the fixed boredom-appropriate action');
  }
  // The primary endpoint is byte-comparable across every version: it reads the
  // first post-trigger learner turn. The secondary endpoint names its own
  // deadline, which moves with the outcome horizon, so v5 carries a different
  // name for the same measure on a longer window.
  const secondaryEndpointId = boredomProofProgressNames(registration).endpoint;
  if (prospectiveV6) {
    // v6 reads recovery across the whole outcome horizon rather than on the
    // first turn alone, so its primary is a different measure and gets a
    // different name. The one-turn measure does not disappear: it has to be
    // carried as a named comparability endpoint, because without it the v6
    // reference move could not be read against v5 at all. Requiring the pair
    // here is what stops a version from widening its window and quietly
    // dropping the only figure that ties it to the run before it.
    const primary = registration?.measurement?.primaryEndpoint || {};
    const comparability = registration?.measurement?.comparabilityEndpoint || {};
    if (
      primary.id !== 'bored_resistance_recovery_within_outcome_horizon' ||
      primary.deadlinePostTriggerLearnerTurns !== registration?.design?.treatment?.postTriggerLearnerTurns ||
      primary.analysis !== 'two_sided_exact_conditional_blocked_score_test' ||
      primary.definitionChangedFromV5 !== true ||
      primary.notComparableWithV4OrV5Primary !== true ||
      primary.perTurnRuleUnchangedFromV5 !== true ||
      primary.mannerReportedAsBlock !== true ||
      primary.intentionToTreat !== true ||
      primary.modelJudge !== false ||
      comparability.id !== 'profile_specific_resistance_recovery' ||
      comparability.deadlinePostTriggerLearnerTurns !== 1 ||
      comparability.reportedAlways !== true ||
      comparability.analysis !== 'descriptive_only_no_hypothesis_test' ||
      registration?.measurement?.keySecondaryEndpoint?.id !== secondaryEndpointId
    ) {
      errors.push('registered recovery and objective proof-progress endpoints drifted');
    }
    if (typeof registration?.whyV6?.whyThisIsNotOutcomeFishing !== 'string') {
      errors.push('a widened primary window must record why it is not outcome fishing');
    }
  } else if (
    registration?.measurement?.primaryEndpoint?.id !== 'profile_specific_resistance_recovery' ||
    registration?.measurement?.primaryEndpoint?.deadlinePostTriggerLearnerTurns !== 1 ||
    registration?.measurement?.primaryEndpoint?.analysis !== 'two_sided_exact_conditional_blocked_score_test' ||
    registration?.measurement?.keySecondaryEndpoint?.id !== secondaryEndpointId
  ) {
    errors.push('registered recovery and objective proof-progress endpoints drifted');
  }
  if (
    derivedAttemptArithmetic &&
    registration?.measurement?.keySecondaryEndpoint?.deadlinePostTriggerLearnerTurns !==
      registration?.design?.treatment?.postTriggerLearnerTurns
  ) {
    errors.push('objective proof-progress deadline does not match the registered outcome horizon');
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
  if (sealedLiteralArithmetic) {
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
  } else if (prospectiveV6) {
    // v6 has two refuted alternatives behind it, not one, and it is the first
    // version that admits in the registration that it is underpowered for what
    // it is looking for. So the check asks for three things a copied-forward
    // claim could not supply: both refutations written down, a stated power
    // table with the reference rate it was computed from, and a plain statement
    // that a null here settles almost nothing. The paired-design audit is
    // required too, so that the question of pairing is answered once in the
    // record rather than reopened every version.
    const refuted = power.refutedAlternatives || {};
    const position = power.positionForV6 || {};
    const table = Array.isArray(power.powerTableAtEighteenPerMove) ? power.powerTableAtEighteenPerMove : [];
    const audit = power.pairedDesignAudit || {};
    if (
      power.minimumPerArm !== 18 ||
      typeof refuted.v4?.reading !== 'string' ||
      typeof refuted.v5?.v5Observed !== 'string' ||
      typeof refuted.v5?.reading !== 'string' ||
      typeof power.measuredReferenceRate?.source !== 'string' ||
      typeof power.measuredReferenceRate?.caution !== 'string' ||
      table.length < 3 ||
      table.some((row) => !(row?.power > 0 && row?.power < 1) || !(row?.treatmentRate > row?.referenceRate)) ||
      typeof position.statedPlainly !== 'string' ||
      typeof position.whatANullWouldMean !== 'string' ||
      typeof position.whyRunItAtThisSizeAtAll !== 'string' ||
      typeof position.whatThisDesignStillCannotSettle !== 'string' ||
      audit.decision !== 'rejected. v6 keeps independent units, as v5 did.' ||
      typeof audit.result !== 'string' ||
      power.powerAt17PerArm !== undefined ||
      power.powerAt18PerArm !== undefined ||
      power.designChoiceAudit !== undefined ||
      power.positionForV5 !== undefined
    ) {
      errors.push('power position does not record both refuted alternatives and the screening limit');
    }
  } else if (
    // v4 sized itself against plain 1 of 6 versus warm 4 of 6 and then observed
    // 0 of 18 versus 0 of 15. That alternative is refuted, so v5 may not restate
    // the same power figures. What v5 has to show instead is that it kept the
    // sample size, that it records the refutation, and that it carries no
    // leftover power number. The last clause is the one that matters: without it
    // the discarded claim could return simply by being copied forward.
    power.minimumPerArm !== 18 ||
    typeof power.v4AlternativeRefuted?.v4Assumed !== 'string' ||
    typeof power.v4AlternativeRefuted?.v4Observed !== 'string' ||
    typeof power.v4AlternativeRefuted?.reading !== 'string' ||
    typeof power.positionForV5?.statedPlainly !== 'string' ||
    typeof power.positionForV5?.whatANullWouldMean !== 'string' ||
    typeof power.positionForV5?.whatThisDesignStillCannotSettle !== 'string' ||
    power.powerAt17PerArm !== undefined ||
    power.powerAt18PerArm !== undefined ||
    power.designChoiceAudit !== undefined
  ) {
    errors.push('power position does not record the refuted v4 alternative');
  }
  if (sealedLiteralArithmetic) {
    if (
      execution.maximumReservationsPerPlannedCall !== 3 ||
      dialogue.oneCumulativeFullLearnerRepairCalls !== (semanticInstrumented ? 0 : 2) ||
      (semanticInstrumented && dialogue.maximumIndependentSemanticAdjudicationCalls !== 2) ||
      (semanticInstrumented && dialogue.measurementIndeterminateRepairCalls !== 0) ||
      dialogue.plannedCallsPerDialogue !== 20 ||
      dialogue.maximumReservationsPerDialogue !== 60 ||
      dialogue.dialogues !== 36 ||
      dialogue.maximumReservations !== 2160 ||
      execution.hardStudyAttemptCeiling !== 2160
    ) {
      errors.push('hard attempt arithmetic drifted');
    }
  } else {
    // v5 is checked on derivation, not on literals. Every attempt figure has to
    // fall out of the two turn counts the design registers, at the same three
    // calls per turn v4 used. An edit that widens the window but forgets the
    // ceiling fails here, and the check keeps working the next time the window
    // moves.
    const maximumTriggerTurn = registration?.design?.freshPrefixGeneration?.maximumTriggerTurn;
    const postTriggerLearnerTurns = registration?.design?.treatment?.postTriggerLearnerTurns;
    const callsPerTurn = 3;
    const plannedParts =
      dialogue.preTriggerBasePlannedCalls +
      dialogue.preTriggerTutorGuardRecoveryReserveCalls +
      dialogue.postTriggerBasePlannedCalls +
      dialogue.postTriggerTutorGuardRecoveryReserveCalls +
      dialogue.oneCumulativeFullLearnerRepairCalls +
      dialogue.maximumIndependentSemanticAdjudicationCalls +
      dialogue.measurementIndeterminateRepairCalls;
    if (
      execution.maximumReservationsPerPlannedCall !== 3 ||
      dialogue.oneCumulativeFullLearnerRepairCalls !== 0 ||
      dialogue.measurementIndeterminateRepairCalls !== 0 ||
      dialogue.preTriggerBasePlannedCalls !== callsPerTurn * maximumTriggerTurn ||
      dialogue.postTriggerBasePlannedCalls !== callsPerTurn * postTriggerLearnerTurns ||
      dialogue.maximumIndependentSemanticAdjudicationCalls !== maximumTriggerTurn ||
      dialogue.plannedCallsPerDialogue !== plannedParts ||
      dialogue.maximumReservationsPerDialogue !== plannedParts * execution.maximumReservationsPerPlannedCall ||
      dialogue.dialogues !== 36 ||
      dialogue.maximumReservations !== dialogue.maximumReservationsPerDialogue * dialogue.dialogues ||
      execution.hardStudyAttemptCeiling !== dialogue.maximumReservations
    ) {
      errors.push('hard attempt arithmetic drifted');
    }
  }
  if (
    batches.executionBatches !== 9 ||
    batches.dialoguesPerBatch !== 4 ||
    batches.plainPerBatch !== 2 ||
    batches.warmPerBatch !== 2 ||
    batches.maximumReservationsPerBatch !==
      (sealedLiteralArithmetic ? 240 : dialogue.maximumReservationsPerDialogue * batches.dialoguesPerBatch) ||
    batches.totalBatches !== 9 ||
    batches.noInterimAnalysis !== true
  ) {
    errors.push('predeclared batch partition drifted');
  }
  // In v6 a batch that is balanced on manner alone is not balanced. Every batch
  // has to hold one dialogue of each of the four move-and-manner pairs, so that
  // stopping after any batch leaves the contrast even.
  if (
    prospectiveV6 &&
    (batches.askQuestionPerBatch !== 2 || batches.shrinkStepPerBatch !== 2 || batches.executionBatches !== 9)
  ) {
    errors.push('predeclared batch partition does not balance the move under test');
  }
  if (sealedLiteralArithmetic) {
    const expectedLedger = prospectiveV4 ? 446 : currentProgrammeLedger ? 293 : 219;
    const expectedStudyCeiling = prospectiveV4 ? 2606 : currentProgrammeLedger ? 2453 : 2379;
    const expectedCombinedCeiling = prospectiveV4 ? 4766 : currentProgrammeLedger ? 4613 : 4539;
    if (
      execution.programmeCeilingForThisStudyAlone?.ledgerBefore !== expectedLedger ||
      execution.programmeCeilingForThisStudyAlone?.requiredCeiling !== expectedStudyCeiling ||
      execution.programmeCeilingForThisStudyAlone?.incrementAboveCurrentLedger !== 2160 ||
      execution.programmeCeilingIfFrameRefusalConfirmationAlsoReserved?.requiredCeiling !== expectedCombinedCeiling ||
      execution.attemptAccountingRole !==
        'operational_execution_safeguard_only_not_scientific_endpoint_design_objective_or_sample_size_constraint'
    ) {
      errors.push('programme ceiling amendment arithmetic drifted');
    }
  } else {
    // v5 states one ledger rather than two candidate ceilings, because the
    // human owner raised the safeguard outright. The check is that the ledger
    // adds up and leaves room: what v4 actually spent is added to the ledger it
    // started from, this study's own ceiling is the one derived above, and the
    // headroom is what the safeguard leaves after both.
    const ceiling = execution.programmeCeiling || {};
    // v6 has two finished runs behind it instead of one, so the chain runs
    // through both spends. Everything after the ledger line is the same check.
    const ledgerBefore = prospectiveV6 ? ceiling.ledgerBeforeV6 : ceiling.ledgerBeforeV5;
    const spentBefore = prospectiveV6 ? ceiling.v4Spend + ceiling.v5Spend : ceiling.v4Spend;
    const studyMaximum = prospectiveV6 ? ceiling.v6Maximum : ceiling.v5Maximum;
    if (
      ceiling.ledgerBeforeV4 !== 446 ||
      ledgerBefore !== ceiling.ledgerBeforeV4 + spentBefore ||
      studyMaximum !== dialogue.maximumReservations ||
      ceiling.requiredCeiling !== ledgerBefore + studyMaximum ||
      ceiling.headroom !== ceiling.programmeSafeguard - ceiling.requiredCeiling ||
      !(ceiling.headroom >= 0) ||
      ceiling.shortfall !== 0 ||
      ceiling.status !== 'SETTLED' ||
      execution.attemptAccountingRole !==
        'operational_execution_safeguard_only_not_scientific_endpoint_design_objective_or_sample_size_constraint'
    ) {
      errors.push('programme ceiling amendment arithmetic drifted');
    }
  }
  if (
    (semanticInstrumented && registration.design?.observationSemantics !== 'prospective_v9') ||
    (!semanticInstrumented && registration.design?.observationSemantics === 'prospective_v9') ||
    (semanticInstrumented &&
      (registration.measurement?.semanticAdjudicator?.modelRef !== 'codex.gpt-5.6-sol' ||
        registration.measurement?.semanticAdjudicator?.role !== 'tutor_stub_boredom_performance_adjudication' ||
        registration.measurement?.semanticAdjudicator?.independentFromGeneratingModel !== true ||
        registration.measurement?.semanticAdjudicator?.generatorSelfJudgmentAllowed !== false ||
        registration.measurement?.semanticAdjudicator?.minimumConfidence !== 0.8 ||
        registration.measurement?.semanticAdjudicator?.regexRole !==
          'auxiliary_high_precision_signal_and_disagreement_only_never_final_semantic_authority' ||
        registration.measurement?.semanticAdjudicator?.lexicalSilenceMayVetoSemanticPositive !== false ||
        registration.executionReadiness?.modelRoute?.semanticAdjudicator !== 'codex.gpt-5.6-sol')) ||
    (prospectiveV3 &&
      (registration.measurement?.semanticAdjudicator?.schema !==
        'machinespirits.tutor-stub.boredom-semantic-adjudication.v1' ||
        registration.measurement?.semanticAdjudicator?.empiricalValidationStatus !==
          'pending_no_model_calls_authorized_by_this_registration' ||
        registration.measurement?.semanticAdjudicator?.confirmationLaunchReady !== false))
  ) {
    errors.push('prospective-v9 independent semantic adjudicator boundary drifted');
  }
  if (prospectiveV4 || carriesForwardV4Instrument) {
    const adjudicator = registration.measurement?.semanticAdjudicator || {};
    const modulePath = path.join(ROOT, String(adjudicator.modulePath || ''));
    const moduleSource = fs.existsSync(modulePath) ? fs.readFileSync(modulePath) : null;
    const moduleSha = moduleSource ? crypto.createHash('sha256').update(moduleSource).digest('hex') : null;
    const validation = adjudicator.empiricalValidation || {};
    if (
      adjudicator.schema !== 'machinespirits.tutor-stub.boredom-semantic-adjudication.v3' ||
      adjudicator.modulePath !== 'services/tutorStubBoredomSemanticAdjudicationV3.js' ||
      moduleSha !== adjudicator.moduleSha256 ||
      adjudicator.empiricalValidationStatus !== 'passed_all_predeclared_gates_on_sealed_heldout_v4_corpus' ||
      (prospectiveV4 &&
        (adjudicator.confirmationLaunchReady !== true ||
          validation.determinateSensitivity !== 1 ||
          validation.determinateSpecificity !== 1 ||
          validation.referenceAgreement !== 1 ||
          validation.ambiguousIndeterminateRate !== 1 ||
          validation.lowConfidenceIndeterminateRate !== 1 ||
          typeof validation.reportSha256 !== 'string' ||
          validation.reportSha256.length !== 64))
    ) {
      errors.push('validated v3 semantic instrument binding drifted');
    }
    // The sealed 55-case corpus is spent, so v5 cannot re-earn the gates. It
    // carries them instead, and the price of carrying them is that the module's
    // bytes have to be the same bytes and the one earlier move has to be written
    // down and argued. If a byte moves from here, revalidationRequired turns
    // true and a fresh sealed corpus is owed.
    if (carriesForwardV4Instrument) {
      const provenance = adjudicator.instrumentProvenance || {};
      const sealedRecord = path.join(ROOT, String(provenance.sealedRecordOfTheValidatedTree || ''));
      // v5 named this field after itself. v6 runs the same bytes, so the value
      // is unchanged but the v5 name would read as a lie in a v6 file. Both
      // names are accepted and the newer one is preferred, so v5 still
      // revalidates byte-identically and v6 can say what it means.
      const bytesThisVersionWillRun = provenance.bytesThisVersionWillRun ?? provenance.bytesV5WillRun;
      if (
        adjudicator.moduleUnchangedFromV4 !== true ||
        adjudicator.empiricalValidationCarriedForward !== true ||
        adjudicator.revalidationRequired !== false ||
        typeof adjudicator.revalidationRequiredReason !== 'string' ||
        bytesThisVersionWillRun !== adjudicator.moduleSha256 ||
        typeof provenance.validatedBytes !== 'string' ||
        provenance.validatedBytes.length !== 64 ||
        !Array.isArray(provenance.commitsBetween) ||
        provenance.commitsBetween.length === 0 ||
        provenance.commitsBetween.some(
          (row) => typeof row?.commit !== 'string' || typeof row?.noVerdictMoved !== 'string',
        ) ||
        !fs.existsSync(sealedRecord)
      ) {
        errors.push('carried-forward semantic instrument provenance drifted');
      }
    }
  }
  if (semanticInstrumented) {
    const adjudicator = registration.measurement?.semanticAdjudicator;
    // v5 has no held-out corpus of its own. It names the v4 one as carried
    // forward and marked spent, so the file check is the same and the claim is
    // not.
    const heldout = carriesForwardV4Instrument ? adjudicator?.carriedForwardHeldoutCorpus : adjudicator?.heldoutCorpus;
    const heldoutPath = path.join(ROOT, String(heldout?.path || ''));
    const heldoutSource = fs.existsSync(heldoutPath) ? fs.readFileSync(heldoutPath) : null;
    const heldoutSha = heldoutSource ? crypto.createHash('sha256').update(heldoutSource).digest('hex') : null;
    const expectedHeldoutPath =
      prospectiveV4 || carriesForwardV4Instrument
        ? 'config/tutor-stub-boredom-semantic-adjudication-heldout.v4.json'
        : 'config/tutor-stub-boredom-semantic-adjudication-heldout.v1.json';
    const expectedHeldoutCases = prospectiveV4 || carriesForwardV4Instrument ? 55 : 22;
    if (
      heldout?.path !== expectedHeldoutPath ||
      heldout?.cases !== expectedHeldoutCases ||
      heldout?.embeddedInPrompt !== false ||
      heldout?.modelPredictionsPresent !== false ||
      heldoutSha !== heldout?.sha256 ||
      (carriesForwardV4Instrument && heldout?.spentForValidation !== true)
    ) {
      errors.push('prospective-v9 held-out semantic corpus binding drifted');
    }
  }
  // v5 changes three of the six worlds and moves the seed, so it has its own
  // assignment manifest and its own pinned digest. Both pins are literals on
  // purpose: the point of the pin is that the assignment was fixed before any
  // dialogue was generated, so it must not be recomputed from whatever the
  // registration currently says.
  const expectedAssignmentSeed = prospectiveV6 ? 20260922 : prospectiveV5 ? 20260901 : 20260820;
  const expectedAssignmentManifestSha256 = prospectiveV6
    ? 'fb84030c40bf559e1f37bbf90ef088d501843307a187939b168ea5186c74259d'
    : prospectiveV5
      ? '485f7442d2844dad9026c54ea47ed3214f5cf1e4c36bf372a2fb52dfb6304b28'
      : '4e256dfa65054747a5d6d1ac82d1aecb42f7c98f158cb76e686f24c37d71ef94';
  // v6 assigns two things per dialogue instead of one, so it ranks the same way
  // and then reads a per-world pattern. The algorithm name says so, and it is
  // pinned like the seed and the digest, so a v6 file cannot claim the v5
  // algorithm and still pass.
  const expectedAssignmentAlgorithm = prospectiveV6
    ? 'sha256_rank_within_world_with_seeded_world_pattern'
    : 'sha256_rank_within_world';
  if (
    registration?.design?.randomization?.algorithm !== expectedAssignmentAlgorithm ||
    registration?.design?.randomization?.assignmentSeed !== expectedAssignmentSeed ||
    registration?.design?.randomization?.assignmentManifestSha256 !== expectedAssignmentManifestSha256
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

// Six dialogues in one world can hold three of each move and three of each
// manner, but they cannot also split the four move-and-manner pairs evenly:
// four does not divide six. So the pair is balanced across worlds instead.
// Three worlds run one pattern and three run its mirror, the seed decides
// which world gets which, and every pair total lands on nine.
const BOREDOM_V6_WORLD_PATTERNS = Object.freeze({
  a: Object.freeze([
    'ask_question:plain',
    'ask_question:plain',
    'ask_question:warm',
    'shrink_step:plain',
    'shrink_step:warm',
    'shrink_step:warm',
  ]),
  b: Object.freeze([
    'ask_question:plain',
    'ask_question:warm',
    'ask_question:warm',
    'shrink_step:plain',
    'shrink_step:plain',
    'shrink_step:warm',
  ]),
});

function boredomV6PatternByWorld(registration) {
  const assignmentSeed = registration.design.randomization.assignmentSeed;
  const ranked = registration.design.worlds
    .map((world) => ({
      world,
      rank: crypto.createHash('sha256').update(`${assignmentSeed}:pattern:${world}`).digest('hex'),
    }))
    .sort((left, right) => left.rank.localeCompare(right.rank));
  return new Map(
    ranked.map((row, index) => [row.world, index < 3 ? BOREDOM_V6_WORLD_PATTERNS.a : BOREDOM_V6_WORLD_PATTERNS.b]),
  );
}

function buildBoredomV6AssignmentManifest(registration) {
  const assignmentSeed = registration.design.randomization.assignmentSeed;
  const patternByWorld = boredomV6PatternByWorld(registration);
  return registration.design.worlds.flatMap((world) => {
    const pattern = patternByWorld.get(world);
    const ranked = Array.from({ length: 6 }, (_, dialogueIndex) => ({
      world,
      dialogue_index: dialogueIndex + 1,
      assignment_rank_sha256: crypto
        .createHash('sha256')
        .update(`${assignmentSeed}:${world}:${dialogueIndex + 1}`)
        .digest('hex'),
    })).sort((left, right) => left.assignment_rank_sha256.localeCompare(right.assignment_rank_sha256));
    const cellByDialogue = new Map(ranked.map((row, index) => [row.dialogue_index, pattern[index]]));
    return ranked
      .map((row) => {
        const [move, realization] = cellByDialogue.get(row.dialogue_index).split(':');
        return { ...row, pedagogical_move_level: move, realization };
      })
      .sort((left, right) => left.dialogue_index - right.dialogue_index);
  });
}

export function buildTutorStubBoredomProofDagAssignments(registration) {
  if (registration.version === 6) {
    const manifest = buildBoredomV6AssignmentManifest(registration);
    const digest = assignmentManifestSha256(manifest);
    if (digest !== registration.design.randomization.assignmentManifestSha256) {
      throw new Error('predeclared boredom move and register assignment manifest drifted');
    }
    return { digest, manifest };
  }
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
  // These four numbers used to be written here as 2, 60, 240 and 2160. Each
  // was also written in the registration, and the two copies were never
  // compared. v5 widens the trigger window and the outcome horizon, so a
  // hardcoded 2 would have built v5 jobs that stop at the v4 turn. Read them
  // from the registration, which every version from v1 carries, so v1 to v4
  // rebuild byte-identical plans and v5 gets its own numbers.
  const maximumTriggerTurn = registration.design.freshPrefixGeneration.maximumTriggerTurn;
  const perDialogueCeiling = registration.executionReadiness.dialogue.maximumReservationsPerDialogue;
  const perBatchCeiling = registration.executionReadiness.batches.maximumReservationsPerBatch;
  const studyCeiling = registration.executionReadiness.dialogue.maximumReservations;
  // v1 to v5 wrote the move here as a literal, because there was only one. v6
  // assigns it, so it is read from the manifest row through the registration's
  // own level-to-move map. That is the twenty-second time this arc has had to
  // remove a constant written twice with nothing comparing the copies.
  const isV6 = registration.version === 6;
  const moveByLevel = registration.design.treatment.pedagogicalMoves || {};
  const candidates = assignments.manifest.map((row) => {
    const worldIndex = registration.design.worlds.indexOf(row.world);
    const ordinal = worldIndex * 6 + row.dialogue_index - 1;
    const pedagogicalMove = isV6
      ? moveByLevel[row.pedagogical_move_level]
      : registration.design.treatment.fixedPedagogicalMove;
    if (!pedagogicalMove) throw new Error('registered pedagogical move is missing for an assigned dialogue');
    return {
      id: `bored-confirm-w${worldIndex + 1}-d${row.dialogue_index}`,
      type: 'fresh_bored_register_confirmation_dialogue',
      assignment_index: ordinal + 1,
      world: row.world,
      seed: registration.design.freshPrefixGeneration.seedBase + ordinal + 1,
      maximum_trigger_turn: maximumTriggerTurn,
      pedagogical_move: pedagogicalMove,
      ...(isV6 ? { pedagogical_move_level: row.pedagogical_move_level } : {}),
      realization: row.realization,
      assignment_rank_sha256: row.assignment_rank_sha256,
      assignment_manifest_sha256: assignments.digest,
      maximum_model_attempt_reservations: perDialogueCeiling,
    };
  });
  // A v5 batch had to be even on manner alone. A v6 batch has to be even on
  // both, so it takes one dialogue from each of the four move-and-manner cells.
  const cell = (level, realization) =>
    candidates.filter((row) => row.pedagogical_move_level === level && row.realization === realization);
  const plain = candidates.filter((row) => row.realization === 'plain');
  const warm = candidates.filter((row) => row.realization === 'warm');
  const askPlain = isV6 ? cell('ask_question', 'plain') : [];
  const askWarm = isV6 ? cell('ask_question', 'warm') : [];
  const shrinkPlain = isV6 ? cell('shrink_step', 'plain') : [];
  const shrinkWarm = isV6 ? cell('shrink_step', 'warm') : [];
  const jobs = Array.from({ length: 9 }, (_, batchIndex) => {
    const batchId = `execution_batch_${batchIndex + 1}`;
    const rows = isV6
      ? [askPlain[batchIndex], askWarm[batchIndex], shrinkPlain[batchIndex], shrinkWarm[batchIndex]]
      : [plain[batchIndex * 2], warm[batchIndex * 2], plain[batchIndex * 2 + 1], warm[batchIndex * 2 + 1]];
    if (rows.some((row) => !row)) throw new Error('predeclared batch partition could not be filled');
    return rows.map((row) => ({ ...row, batch_id: batchId }));
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
      ...(isV6 ? { ask_question: 2, shrink_step: 2 } : {}),
      ceiling: perBatchCeiling,
    })),
    total_maximum_model_attempt_reservations: studyCeiling,
  };
}

/**
 * Which registration versions measure the learner with the independent semantic
 * adjudicator rather than with word matching alone. v3 introduced it, v4
 * validated it on the sealed corpus, and v5 carries that validation forward.
 * Written once here so a sixth version is one edit rather than five.
 */
function usesSemanticAdjudicator(version) {
  return version === 3 || version === 4 || version === 5 || version === 6;
}

/** What a case row calls the old one-turn recovery when a newer window is primary. */
const BOREDOM_COMPARABILITY_OUTCOME_FIELD = 'recovered_at_first_post_trigger_turn';

/**
 * The three things v6 measures that no earlier version had a row for.
 *
 * Each one appears only when the registration asks for it, so a v1 to v5 case
 * row keeps exactly the fields it had and its sealed preflight digest does not
 * move. A case row's byte length is inside that digest, so an ungated field
 * would break every earlier certificate.
 *
 * The case builder writes these and the assembler reads them back. That pairing
 * is where this arc keeps going wrong, so the names are read here once instead
 * of being typed on both sides.
 */
function boredomOutcomeExtensions(registration) {
  const treatment = registration?.design?.treatment || {};
  const measurement = registration?.measurement || {};
  return {
    comparability: measurement.comparabilityEndpoint || null,
    contentLeakage: treatment.contentLeakageDisclosureRequired === true,
    assignedMoveDelivery: Number.isFinite(Number(measurement.treatmentFidelity?.minimumAssignedMoveDelivery)),
  };
}

export function buildTutorStubBoredomProofDagSyntheticCases(registration) {
  const plan = buildTutorStubBoredomProofDagPlan(registration);
  const semanticMeasurement = usesSemanticAdjudicator(registration.version);
  const progressField = boredomProofProgressNames(registration).field;
  // These self-check cases put more successes on the treatment side than on the
  // reference side, so the exact test has something to read. Which side is
  // which follows the registered contrast: under v5 that is the warm manner,
  // under v6 the shrink-step move. The job row names the move level, so the
  // axis is read against the plan row rather than the report row.
  // A plan row names its manner `realization`; only the case rows built below
  // also carry it as `arm`.
  const axis = boredomContrastAxis(registration, {
    moveField: 'pedagogical_move_level',
    mannerField: 'realization',
  });
  const primaryDeadlineTurns = Number(registration.measurement.primaryEndpoint.deadlinePostTriggerLearnerTurns);
  const extensions = boredomOutcomeExtensions(registration);
  let plainSeen = 0;
  let warmSeen = 0;
  return plan.jobs.map((job) => {
    const warm = job[axis.rowField] === axis.treatment;
    const withinArm = warm ? warmSeen++ : plainSeen++;
    const recovered = warm ? withinArm < 12 : withinArm < 3;
    // Every synthetic recovery lands on the first turn, so the wider window and
    // the old one-turn window agree here. The assembler derives the same value
    // from the row and compares, rather than trusting what was written.
    const observedTurn = recovered ? 1 : null;
    return {
      case_id: job.id,
      arm: job.realization,
      batch_id: job.batch_id,
      prefix_id: `${job.id}:fresh-prefix`,
      world: job.world,
      seed: job.seed,
      pedagogical_move: job.pedagogical_move,
      ...(job.pedagogical_move_level ? { pedagogical_move_level: job.pedagogical_move_level } : {}),
      realization: job.realization,
      assignment_rank_sha256: job.assignment_rank_sha256,
      assignment_manifest_sha256: job.assignment_manifest_sha256,
      // The synthetic trigger sits on the last turn the window allows, so these
      // self-check cases exercise the widest case the registration permits
      // rather than a turn number copied from v4.
      trigger: { profile: 'bored', observed_by_turn: job.maximum_trigger_turn, profile_identity_used: false },
      ...(semanticMeasurement
        ? {
            semantic_measurement: {
              disposition: 'actionable_boredom',
              confidence: 0.95,
              independent_route_matches: true,
              evidence_spans_valid: true,
              indeterminate: false,
            },
          }
        : {}),
      outcome: {
        recovered,
        deadline_turns: primaryDeadlineTurns,
        observed_turn: observedTurn,
        ...(extensions.comparability ? { [BOREDOM_COMPARABILITY_OUTCOME_FIELD]: recovered && observedTurn === 1 } : {}),
        ...(extensions.contentLeakage ? { restated_tutor_content_only: false } : {}),
        [progressField]: recovered,
        new_supported_public_premises: recovered ? 1 : 0,
        best_path_coverage_delta: recovered ? 0.1 : 0,
        proof_debt_delta: recovered ? -1 : 0,
        unsupported_public_claims: 0,
      },
      fidelity: {
        action_visible: true,
        register_visible: true,
        ...(extensions.assignedMoveDelivery ? { assigned_move_delivered: true } : {}),
        safety_override: false,
        protected_condition: false,
      },
    };
  });
}

function semanticReferenceRaw(row, { confidence = 0.95 } = {}) {
  const evidence = Object.entries(row.evidence || {}).map(([kind, text]) => {
    const start = row.text.indexOf(text);
    if (start < 0) throw new Error(`${row.id}: semantic reference evidence is not an exact candidate span`);
    return { kind, start, end: start + text.length, text };
  });
  return {
    verdict: row.verdict,
    ...row.fields,
    confidence,
    evidence,
    reason: 'Frozen zero-call reference label for deterministic wrapper validation.',
  };
}

function semanticReferenceParserForCorpus(corpus) {
  if (corpus?.schema === 'machinespirits.tutor-stub.boredom-semantic-heldout-corpus.v1') {
    return parseTutorStubBoredomSemanticAdjudication;
  }
  if (corpus?.schema === 'machinespirits.tutor-stub.boredom-semantic-adjudication.heldout.v4') {
    return parseTutorStubBoredomSemanticAdjudicationV3;
  }
  throw new Error(`unsupported boredom semantic held-out corpus schema: ${corpus?.schema}`);
}

export function assessTutorStubBoredomSemanticSyntheticCases({
  corpusPath = 'config/tutor-stub-boredom-semantic-adjudication-heldout.v1.json',
} = {}) {
  const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, corpusPath), 'utf8'));
  const parseReferenceAdjudication = semanticReferenceParserForCorpus(corpus);
  const results = corpus.cases.map((row) => {
    const parsed = parseReferenceAdjudication({
      raw: semanticReferenceRaw(row),
      candidate: row.text,
      observedRoute: { provider: 'codex', model: 'gpt-5.6-sol' },
    });
    const expectedDisposition = row.verdict === 'indeterminate' ? 'measurement_indeterminate' : row.verdict;
    return {
      id: row.id,
      expected: expectedDisposition,
      observed: parsed.measurement_disposition,
      parse_ok: parsed.parse_ok,
      route_matches: parsed.independent_route.matches,
      evidence_spans_valid: parsed.evidence_audit.pass,
      pass:
        parsed.measurement_disposition === expectedDisposition &&
        parsed.parse_ok &&
        parsed.independent_route.matches === true &&
        parsed.evidence_audit.pass,
    };
  });
  const determinate = results.filter((row) => row.expected !== 'measurement_indeterminate');
  const positive = determinate.filter((row) => row.expected === 'actionable_boredom');
  const negative = determinate.filter((row) => row.expected !== 'actionable_boredom');
  const ambiguous = results.filter((row) => row.expected === 'measurement_indeterminate');
  const sensitivity = positive.filter((row) => row.observed === row.expected).length / positive.length;
  const specificity = negative.filter((row) => row.observed === row.expected).length / negative.length;
  const agreement = results.filter((row) => row.observed === row.expected).length / results.length;
  const ambiguousIndeterminateRate =
    ambiguous.filter((row) => row.observed === 'measurement_indeterminate').length / ambiguous.length;
  const lowConfidenceProbe = parseReferenceAdjudication({
    raw: semanticReferenceRaw(
      corpus.cases.find((row) => row.verdict === 'actionable_boredom'),
      {
        confidence: 0.79,
      },
    ),
    candidate: corpus.cases.find((row) => row.verdict === 'actionable_boredom').text,
    observedRoute: { provider: 'codex', model: 'gpt-5.6-sol' },
  });
  const gates = corpus.predeclaredGates;
  const metrics = {
    determinate_sensitivity: sensitivity,
    determinate_specificity: specificity,
    reference_agreement: agreement,
    ambiguous_indeterminate_rate: ambiguousIndeterminateRate,
    low_confidence_indeterminate_rate:
      lowConfidenceProbe.measurement_disposition === 'measurement_indeterminate' ? 1 : 0,
  };
  return {
    schema: corpus.schema,
    cases: results.length,
    metrics,
    gates,
    empirical_model_predictions_present: corpus.boundary?.modelPredictionsAbsent === false,
    empirical_model_validation_required_before_confirmation_launch:
      gates.empiricalModelValidationRequiredBeforeConfirmationLaunch === true,
    pass:
      results.every((row) => row.pass) &&
      sensitivity >= gates.determinateSensitivityMinimum &&
      specificity >= gates.determinateSpecificityMinimum &&
      agreement >= gates.referenceAgreementMinimum &&
      ambiguousIndeterminateRate >= gates.ambiguousIndeterminateRateMinimum &&
      metrics.low_confidence_indeterminate_rate >= gates.lowConfidenceIndeterminateRateMinimum,
    results,
  };
}

export function buildTutorStubBoredomCompositionSyntheticCases() {
  return [
    {
      id: 'frozen_productive_false_positive',
      text: 'Sure. We could examine the delivery ledger.',
      classification: {
        turn: {
          request_type: 'stepwise_support_request',
          discourse_move: 'metacognitive_reflection',
          evidence_use: 'none',
          epistemic_stance: 'exploratory',
          agency: 'steering',
          summary: 'The learner chooses the delivery ledger as the next evidence source.',
        },
      },
      expected: 'negative_productive_uptake_precedes_cue',
    },
    {
      id: 'frozen_impatience_false_suppression',
      text: 'Fine. Is this trial nearly done?',
      classification: {
        turn: {
          request_type: 'off_task_or_mixed',
          discourse_move: 'question',
          evidence_use: 'none',
          epistemic_stance: 'receptive',
          agency: 'steering',
          summary: 'The learner asks whether the trial is nearly finished.',
        },
      },
      expected: 'positive_actionable_withdrawal_without_uptake',
    },
    {
      id: 'mixed_fails_closed',
      text: 'Fine. I could inspect the gauge, but can we finish this task?',
      classification: { turn: { discourse_move: 'question', evidence_use: 'none' } },
      expected: 'ambiguous_withdrawal_and_productive_uptake',
    },
    {
      id: 'boredom_without_withdrawal',
      text: 'I am bored.',
      classification: { turn: { discourse_move: 'affect_statement', evidence_use: 'none' } },
      expected: 'negative_boredom_without_actionable_withdrawal',
    },
    {
      id: 'bounded_evidence_use',
      text: 'Okay. The dated ledger cites the public invoice.',
      classification: { turn: { discourse_move: 'evidence_adoption', evidence_use: 'cites_public_evidence' } },
      expected: 'negative_productive_uptake_precedes_cue',
    },
    {
      id: 'lexical_near_miss',
      text: 'The finish on the coin is fine-grained.',
      classification: { turn: { discourse_move: 'observation', evidence_use: 'none' } },
      expected: 'negative_no_boredom_cue',
    },
  ];
}

export function assessTutorStubBoredomCompositionSyntheticCases(
  rows = buildTutorStubBoredomCompositionSyntheticCases(),
) {
  const runtime = {
    consumed: false,
    profile: 'bored',
    dynamic_boredom_proof_dag: true,
    registration: { design: { trigger: { observationSemantics: 'prospective_v8' } } },
    proof_dag_registration: { design: { observationSemantics: 'prospective_v8' } },
  };
  const results = rows.map((row) => {
    const observation = observeResistantLearnerTurn({
      learnerText: row.text,
      classification: row.classification,
      tutorLearnerDag: { advance: { supportedMoveCount: 0 } },
      semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV8,
    });
    const eligibility = tutorStubResistanceActionRegisterTreatmentEligibility({
      runtime: structuredClone(runtime),
      learnerText: row.text,
      classification: row.classification,
      tutorLearnerDag: { advance: { supportedMoveCount: 0 } },
    });
    const disposition = observation.boredom_composition?.disposition || null;
    const shouldLicense = row.expected === 'positive_actionable_withdrawal_without_uptake';
    return {
      id: row.id,
      expected: row.expected,
      observed: disposition,
      eligible: eligibility.eligible,
      pass:
        disposition === row.expected &&
        eligibility.eligible === shouldLicense &&
        eligibility.boredom_compositional_precedence?.generic_uptake_override_allowed === false,
    };
  });
  return { pass: results.every((row) => row.pass), results };
}

// The rule reads deltas only. It never sees a turn number, so it carries no
// window in its name; the window lives in the registration and reaches the
// field name through boredomProofProgressNames.
export function objectiveProofProgress(outcome) {
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
  const registration = loadTutorStubBoredomProofDagRegistration({
    registrationPath: contract.registration?.registration_path || BOREDOM_PROOF_DAG_REGISTRATION_PATH,
  });
  const plan = buildTutorStubBoredomProofDagPlan(registration);
  const expectedById = new Map(plan.jobs.map((row) => [row.id, row]));
  // v1 to v5 cut these two groups on the manner, because the manner was the
  // contrast. v6 contrasts two moves, so the groups follow the registered
  // contrast axis and the manner becomes the balanced block.
  const axis = boredomContrastAxis(registration);
  const plain = cases.filter((row) => row[axis.rowField] === axis.reference);
  const warm = cases.filter((row) => row[axis.rowField] === axis.treatment);
  const plainSuccesses = plain.filter((row) => row.outcome.recovered).length;
  const warmSuccesses = warm.filter((row) => row.outcome.recovered).length;
  const distinctPrefixes = new Set(cases.map((row) => row.prefix_id)).size;
  // The three registered numbers this assembler used to write out as 18, 18
  // and 36.
  const registeredDialogues = registration.design.randomization.dialogues;
  const dialoguesPerContrastLevel = registeredDialogues / 2;
  const primaryEndpointId = registration.measurement.primaryEndpoint.id;
  const primaryDeadlineTurns = Number(registration.measurement.primaryEndpoint.deadlinePostTriggerLearnerTurns);
  const extensions = boredomOutcomeExtensions(registration);
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
        // A v6 case also has to carry the move level it was dealt. Matching the
        // move alone would pass a case that named the right move under the
        // wrong level, and the level is what the contrast is cut on.
        row.pedagogical_move_level === expected.pedagogical_move_level &&
        row.assignment_rank_sha256 === expected.assignment_rank_sha256 &&
        row.assignment_manifest_sha256 === plan.assignment_manifest_sha256,
      );
    });
  const recovery = cases.every(
    (row) =>
      typeof row.outcome?.recovered === 'boolean' &&
      row.outcome.deadline_turns === primaryDeadlineTurns &&
      Object.hasOwn(row.outcome, 'observed_turn') &&
      (row.outcome.recovered
        ? Number.isInteger(row.outcome.observed_turn) &&
          row.outcome.observed_turn >= 1 &&
          row.outcome.observed_turn <= primaryDeadlineTurns
        : row.outcome.observed_turn === null),
  );
  const progress = boredomProofProgressNames(registration);
  const objective = cases.every(
    (row) =>
      typeof row.outcome[progress.field] === 'boolean' &&
      Number.isInteger(row.outcome.new_supported_public_premises) &&
      Number.isFinite(row.outcome.best_path_coverage_delta) &&
      Number.isFinite(row.outcome.proof_debt_delta) &&
      Number.isInteger(row.outcome.unsupported_public_claims) &&
      row.outcome[progress.field] === objectiveProofProgress(row.outcome),
  );
  const fidelity = cases.every(
    (row) =>
      row.fidelity.action_visible === true &&
      row.fidelity.register_visible === true &&
      // v1 to v5 held the move fixed, so there was nothing to deliver wrongly.
      // v6 assigns it, and a unit whose delivered move is not its assigned move
      // is nonadherent.
      (!extensions.assignedMoveDelivery || row.fidelity.assigned_move_delivered === true) &&
      row.fidelity.safety_override === false &&
      row.fidelity.protected_condition === false,
  );
  // The v5 primary, kept as a v6 comparability reading. The row states it and
  // this derives it again from the recovery and the turn it landed on, so the
  // two have to agree rather than one copying the other.
  const comparability =
    !extensions.comparability ||
    cases.every(
      (row) =>
        typeof row.outcome?.[BOREDOM_COMPARABILITY_OUTCOME_FIELD] === 'boolean' &&
        row.outcome[BOREDOM_COMPARABILITY_OUTCOME_FIELD] ===
          (row.outcome.recovered === true && row.outcome.observed_turn === 1),
    );
  // Under the move contrast the manner is balanced inside each move rather than
  // tested. These cells let a reader see the balance held. Under the manner
  // contrast there is no balanced axis and the list is empty.
  const contrastLevels = [axis.reference, axis.treatment];
  const mannerBlock = axis.blockField
    ? axis.blockLevels.flatMap((blockLevel) =>
        contrastLevels.map((contrastLevel) => {
          const rows = cases.filter(
            (row) => row[axis.blockField] === blockLevel && row[axis.rowField] === contrastLevel,
          );
          return {
            block: blockLevel,
            contrast_level: contrastLevel,
            units: rows.length,
            successes: rows.filter((row) => row.outcome.recovered).length,
          };
        }),
      )
    : [];
  const mannerBalance =
    !axis.blockField ||
    (mannerBlock.length === axis.blockLevels.length * contrastLevels.length &&
      mannerBlock.every((cell) => cell.units === registeredDialogues / mannerBlock.length));
  // A learner who only says back what the tutor just made public has not
  // recovered. The count is reported per move whatever it is, including zero.
  const restatedByContrastLevel = extensions.contentLeakage
    ? contrastLevels.map((level) => ({
        contrast_level: level,
        restated_tutor_content_only: cases.filter(
          (row) => row[axis.rowField] === level && row.outcome.restated_tutor_content_only === true,
        ).length,
      }))
    : [];
  const contentSeparation =
    !extensions.contentLeakage || cases.every((row) => typeof row.outcome?.restated_tutor_content_only === 'boolean');
  const composition = assessTutorStubBoredomCompositionSyntheticCases();
  const semanticInstrumented = usesSemanticAdjudicator(registration.version);
  // v3 and v4 earned their gates on a corpus they held out. v5 cannot earn them
  // again, because that corpus is spent, so it names the same file under a
  // different key. The replay below makes no model call and claims no accuracy;
  // it only shows the parser still reads those 55 cases the way it did.
  const semanticCorpus =
    registration.measurement.semanticAdjudicator?.heldoutCorpus ||
    registration.measurement.semanticAdjudicator?.carriedForwardHeldoutCorpus;
  const semantic = semanticInstrumented
    ? assessTutorStubBoredomSemanticSyntheticCases({ corpusPath: semanticCorpus.path })
    : null;
  const semanticCaseFidelity =
    !semanticInstrumented ||
    cases.every(
      (row) =>
        row.semantic_measurement?.disposition === 'actionable_boredom' &&
        row.semantic_measurement?.confidence >= 0.8 &&
        row.semantic_measurement?.independent_route_matches === true &&
        row.semantic_measurement?.evidence_spans_valid === true &&
        row.semantic_measurement?.indeterminate === false,
    );
  const blocks = registration.design.worlds.map((world) => {
    const rows = cases.filter((row) => row.world === world);
    const worldPlain = rows.filter((row) => row[axis.rowField] === axis.reference);
    const worldWarm = rows.filter((row) => row[axis.rowField] === axis.treatment);
    return {
      world,
      plainN: worldPlain.length,
      warmN: worldWarm.length,
      plainSuccesses: worldPlain.filter((row) => row.outcome.recovered).length,
      warmSuccesses: worldWarm.filter((row) => row.outcome.recovered).length,
    };
  });
  const endpointStatus = {
    ...(contract.endpoints.some((endpoint) => endpoint.id === 'compositional_boredom_observer_timing')
      ? { compositional_boredom_observer_timing: composition.pass ? 'complete' : 'incomplete' }
      : {}),
    ...(contract.endpoints.some((endpoint) => endpoint.id === 'independent_boredom_semantic_measurement')
      ? {
          independent_boredom_semantic_measurement: semantic?.pass && semanticCaseFidelity ? 'complete' : 'incomplete',
        }
      : {}),
    [primaryEndpointId]:
      exactPlanFidelity &&
      recovery &&
      plain.length === dialoguesPerContrastLevel &&
      warm.length === dialoguesPerContrastLevel
        ? 'complete'
        : 'incomplete',
    ...(extensions.comparability
      ? { [extensions.comparability.id]: exactPlanFidelity && comparability ? 'complete' : 'incomplete' }
      : {}),
    ...(axis.blockField || extensions.contentLeakage
      ? {
          pedagogical_move_balance_and_content_separation:
            exactPlanFidelity && mannerBalance && contentSeparation ? 'complete' : 'incomplete',
        }
      : {}),
    [progress.endpoint]: exactPlanFidelity && objective ? 'complete' : 'incomplete',
    randomized_register_assembly:
      exactPlanFidelity && distinctPrefixes === registeredDialogues ? 'complete' : 'incomplete',
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
      manner_block: mannerBlock,
      restated_tutor_content_only: restatedByContrastLevel,
      compositional_observer_timing: composition,
      independent_semantic_measurement: semantic,
      deadline_turns: primaryDeadlineTurns,
      rows: cases,
      contract_study_id: contract.study_id,
    },
  };
}

// The contract and the registration are two files that must describe one study.
// The contract states which registration it belongs to, states that file's bytes,
// and names the objective endpoint after the outcome window. Read against the
// wrong registration it does not fail quietly: it asks every dialogue for a field
// a different outcome window would have written. Nothing compared the pair until
// here, which is how a v5 registration reached a v2 contract.
function assertContractBelongsToRegistration({ contract, registration, registrationPath }) {
  const stated = contract?.registration || {};
  if (registrationPath && stated.registration_path && stated.registration_path !== registrationPath) {
    throw new Error(`endpoint contract belongs to ${stated.registration_path}, not the ${registrationPath} being read`);
  }
  const expectedSecondary = boredomProofProgressNames(registration).endpoint;
  if (expectedSecondary && stated.key_secondary_endpoint_id !== expectedSecondary) {
    throw new Error(
      `endpoint contract names ${stated.key_secondary_endpoint_id} where this outcome window reads ${expectedSecondary}`,
    );
  }
  // The contract also states the registration bytes it was written against. That
  // is reported, not enforced: a closed study's registration goes on being edited
  // long after its contract is sealed, and v4's has moved five times. What holds
  // a live run to its bytes is the launch authorization fingerprint, which is
  // checked at launch. Failing here would only break the zero-cost check for
  // studies that are already finished.
  const contractRegistrationPath = stated.registration_path || registrationPath;
  if (!stated.registration_sha256 || !contractRegistrationPath) return null;
  const digest = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, contractRegistrationPath)))
    .digest('hex');
  return {
    contract_registration_path: contractRegistrationPath,
    contract_pinned_registration_sha256: stated.registration_sha256,
    observed_registration_sha256: digest,
    registration_bytes_match_contract: digest === stated.registration_sha256,
  };
}

export function runTutorStubBoredomProofDagEndpointPreflight({ contract, registration, registrationPath }) {
  const validation = validateTutorStubBoredomProofDagRegistration(registration);
  if (!validation.ok) throw new Error(`registration invalid: ${validation.errors.join('; ')}`);
  const contractBinding = assertContractBelongsToRegistration({ contract, registration, registrationPath });
  const preflight = runPaidStudyEndpointPreflight({
    contract,
    cases: buildTutorStubBoredomProofDagSyntheticCases(registration),
    buildPackets: buildTutorStubBoredomProofDagPackets,
    assemble: assembleTutorStubBoredomProofDagPreflight,
  });
  const execution = registration.executionReadiness;
  // Ask the registration which shape it holds instead of listing the versions
  // that hold it, so a seventh version does not need this line edited.
  const carriedForward = Boolean(execution.programmeCeiling);
  // v1-v4 reserved a second confirmation alongside this study and so carried two
  // ceilings. v5 carries one, because the frame-refusal reservation was settled
  // before it was written. Emit whichever the registration actually holds rather
  // than reaching for a key that is not there.
  const ceilings = carriedForward
    ? { required_programme_ceiling_study_alone: execution.programmeCeiling.requiredCeiling }
    : {
        required_programme_ceiling_study_alone: execution.programmeCeilingForThisStudyAlone.requiredCeiling,
        required_programme_ceiling_with_frame_refusal_reservation:
          execution.programmeCeilingIfFrameRefusalConfirmationAlsoReserved.requiredCeiling,
      };
  return {
    ...preflight,
    readiness: {
      status: carriedForward
        ? 'passed_zero_call_hold_carried_forward_semantic_instrument_launch_authorization_pending'
        : registration.version === 4
          ? 'passed_zero_call_hold_empirical_semantic_validation_passed_launch_authorization_pending'
          : registration.version === 3
            ? 'passed_zero_call_hold_empirical_semantic_validation_pending'
            : 'passed_zero_call_hold',
      contract_binding: contractBinding,
      source_prefixes: execution.dialogue.dialogues,
      independent_dialogues: execution.dialogue.dialogues,
      execution_batches: execution.batches.executionBatches,
      hard_study_attempt_ceiling: execution.hardStudyAttemptCeiling,
      ...ceilings,
      live_executor_available: execution.liveExecutorAvailable === true,
      combined_analyzer_available: execution.combinedAnalyzerAvailable === true,
      request_validator_available: execution.requestValidatorAvailable === true,
      independent_semantic_adjudicator: usesSemanticAdjudicator(registration.version) ? 'codex.gpt-5.6-sol' : null,
      empirical_semantic_validation_status: carriedForward
        ? 'carried_forward_from_sealed_heldout_v4_corpus_no_fresh_claim_earned'
        : registration.version === 4
          ? 'passed_all_predeclared_gates_on_sealed_heldout_v4_corpus'
          : registration.version === 3
            ? 'pending_no_model_calls_authorized'
            : null,
      confirmation_launch_ready:
        carriedForward || registration.version === 4 ? true : registration.version === 3 ? false : null,
      model_calls: 0,
      production_writes: 0,
    },
  };
}

export default {
  assessTutorStubBoredomSemanticSyntheticCases,
  assembleTutorStubBoredomProofDagPreflight,
  buildTutorStubBoredomProofDagAssignments,
  buildTutorStubBoredomProofDagPackets,
  buildTutorStubBoredomProofDagPlan,
  buildTutorStubBoredomProofDagSyntheticCases,
  boredomProofProgressNames,
  exactBlockedScorePValue,
  exactBlockedScorePower,
  exactMcNemarPower,
  exactTwoSidedMcNemarPValue,
  loadTutorStubBoredomProofDagRegistration,
  runTutorStubBoredomProofDagEndpointPreflight,
  objectiveProofProgress,
  validateTutorStubBoredomProofDagRegistration,
};
