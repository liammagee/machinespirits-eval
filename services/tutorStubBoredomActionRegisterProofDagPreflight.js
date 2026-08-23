import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';
import { RESISTANT_LEARNER_OBSERVATION_SEMANTICS, observeResistantLearnerTurn } from './resistantLearnerObservation.js';
import { parseTutorStubBoredomSemanticAdjudication } from './tutorStubBoredomSemanticAdjudication.js';
import { parseTutorStubBoredomSemanticAdjudication as parseTutorStubBoredomSemanticAdjudicationV3 } from './tutorStubBoredomSemanticAdjudicationV3.js';
import {
  tutorStubResistanceActionRegisterTreatmentEligibility,
  tutorStubResistanceHostActionFamily,
} from './tutorStubResistanceActionRegisterStudy.js';
import { compileTutorStubTurnProgressionContract } from './tutorStubTurnProgressionContract.js';

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

/**
 * The same exact conditional blocked score test, read in one direction only.
 *
 * v1 to v6 all registered the two-sided rule, which sums every outcome at most
 * as probable as the one observed. A design that names which move it expects to
 * win can register the upper tail instead, and gets that direction's power for
 * the same units. v7 is the first to do so.
 *
 * The two-sided function above is left untouched on purpose: the v4, v5 and v6
 * reports are pinned to its bytes, and a shared helper that both directions
 * called would put those replays behind a change made for v7.
 *
 * `warmSuccesses` is the treatment side, so the upper tail is the direction in
 * which the treatment move recovers the learner more often than the reference
 * move. A registration that expects the other direction may not use this.
 */
export function exactBlockedScoreOneSidedPValue(blocks, { distributionCache = new Map() } = {}) {
  // Reuse the two-sided validator by calling it first. It throws on the same
  // bad inputs, so the two directions cannot disagree about what is valid.
  exactBlockedScorePValue(blocks, { distributionCache });
  const normalized = blocks.map((row) => ({
    plainN: row.plainN,
    warmN: row.warmN,
    totalSuccesses: row.plainSuccesses + row.warmSuccesses,
  }));
  const observedWarmSuccesses = blocks.reduce((sum, row) => sum + row.warmSuccesses, 0);
  const distribution = exactConditionalScoreDistribution(normalized, distributionCache);
  return [...distribution.entries()].reduce(
    (sum, [warmSuccesses, mass]) => sum + (warmSuccesses >= observedWarmSuccesses ? mass : 0),
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

/** `ask_question` becomes `askQuestion`, so a level name is written once. */
function camelLevel(level) {
  return String(level).replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
}

/** `plain` becomes `Plain`, for the cell field names that join a move to a manner. */
function capitalize(word) {
  return String(word).charAt(0).toUpperCase() + String(word).slice(1);
}

/**
 * Every count this design runs on, read from the registration and checked
 * against every other count that has to agree with it.
 *
 * This is the arc's oldest defect, one layer further in. v1 to v6 wrote 36
 * dialogues, 6 per world, 18 per move, 9 per cell and 9 batches into the
 * registration, and then wrote the same numbers again into the preflight, the
 * plan builder and the analyzer, with nothing comparing the copies. A version
 * that changed its size had to find all four places by hand.
 *
 * Nothing here is written by hand. The world count comes from the world list,
 * the margins come from the registration under field names built from the
 * registration's own level names, and the four move-and-manner cells are
 * recounted from the per-world patterns that actually drive the assignment. A
 * registration whose stated margins do not match the patterns it registers
 * fails, which is the check that never existed before.
 */
export function boredomRegisteredSizes(registration) {
  const design = registration?.design || {};
  const randomization = design.randomization || {};
  const treatment = design.treatment || {};
  const batchPlan = registration?.executionReadiness?.batches || {};
  const worlds = design.worlds || [];
  const moveLevels = treatment.pedagogicalMoveLevels || [];
  const realizations = treatment.realizations || [];
  const patterns = randomization.worldPatterns || {};
  const errors = [];
  const fail = (message) => errors.push(message);

  const worldCount = worlds.length;
  const dialogues = randomization.dialogues;
  const perWorld = randomization.dialoguesPerWorld;
  const batches = batchPlan.executionBatches;
  const perBatch = batchPlan.dialoguesPerBatch;

  if (new Set(worlds).size !== worldCount || worldCount < 2) fail('the world list repeats a world or is too short');
  if (!(dialogues > 0) || !(perWorld > 0)) fail('the dialogue count and the per-world count must both be positive');
  if (dialogues !== worldCount * perWorld) fail(`${dialogues} dialogues is not ${worldCount} worlds of ${perWorld}`);
  if (!(batches > 0) || !(perBatch > 0)) fail('the batch count and the per-batch count must both be positive');
  if (dialogues !== batches * perBatch) fail(`${dialogues} dialogues is not ${batches} batches of ${perBatch}`);
  if (design.freshPrefixGeneration?.requiredDistinctPrefixes !== dialogues) {
    fail('the required distinct prefix count is not the dialogue count');
  }
  if (randomization.continuationsPerPrefix !== 1) fail('each prefix must carry exactly one continuation');
  if (moveLevels.length !== 2 || realizations.length !== 2) fail('this design reads two move levels and two manners');

  // Each margin has to be the per-world figure times the worlds, and the two
  // margins on an axis have to add up to the whole study.
  const margin = (axis, keySuffix) =>
    axis.map((level) => {
      const total = randomization[`${camelLevel(level)}${keySuffix}`];
      const each = randomization[`${camelLevel(level)}PerWorld`];
      if (!(total > 0) || !(each > 0)) fail(`the ${level} margin is missing or not positive`);
      else if (total !== each * worldCount) fail(`${level} is ${total} but ${each} a world over ${worldCount} worlds`);
      return total;
    });
  const moveTotals = margin(moveLevels, 'Dialogues');
  const mannerTotals = margin(realizations, 'Dialogues');
  if (moveTotals.reduce((sum, value) => sum + value, 0) !== dialogues) fail('the move margins do not add to the study');
  if (mannerTotals.reduce((sum, value) => sum + value, 0) !== dialogues) {
    fail('the manner margins do not add to the study');
  }

  // The four cells, recounted from the patterns that actually deal the
  // dialogues, then read against what the registration says they come to.
  const patternNames = Object.keys(patterns);
  const worldsPerPattern = randomization.worldsPerPattern;
  if (patternNames.length < 1 || !(worldsPerPattern > 0) || patternNames.length * worldsPerPattern !== worldCount) {
    fail('the registered patterns do not cover the worlds exactly once each');
  }
  const dealt = new Map();
  for (const name of patternNames) {
    const pattern = patterns[name];
    if (!Array.isArray(pattern) || pattern.length !== perWorld) {
      fail(`pattern ${name} does not deal ${perWorld} dialogues`);
      continue;
    }
    for (const slot of pattern) {
      const [move, manner] = String(slot).split(':');
      if (!moveLevels.includes(move) || !realizations.includes(manner)) {
        fail(`pattern ${name} names an unregistered cell ${slot}`);
        continue;
      }
      dealt.set(slot, (dealt.get(slot) || 0) + worldsPerPattern);
    }
  }
  for (const move of moveLevels) {
    for (const manner of realizations) {
      const stated = randomization[`${camelLevel(move)}${capitalize(manner)}`];
      const counted = dealt.get(`${move}:${manner}`) || 0;
      if (stated !== counted) fail(`${move} with ${manner} is stated as ${stated} and dealt as ${counted}`);
    }
  }

  // A batch has to be even on both axes, so that stopping after any batch
  // leaves the contrast balanced.
  for (const level of [...moveLevels, ...realizations]) {
    const each = batchPlan[`${camelLevel(level)}PerBatch`];
    const total = randomization[`${camelLevel(level)}Dialogues`];
    if (!(each > 0) || each * batches !== total) fail(`${level} is not dealt evenly across the ${batches} batches`);
  }

  return {
    ok: errors.length === 0,
    errors,
    worlds: worldCount,
    dialogues,
    perWorld,
    batches,
    perBatch,
    perMove: moveTotals[0],
    perManner: mannerTotals[0],
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
  const prospectiveV7 = registration?.version === 7;
  const prospectiveV8 = registration?.version === 8;
  // v6, v7 and v8 all contrast two pedagogical moves and balance the manner
  // inside each. Named once, because every move-contrast check below needs them.
  const moveContrast = prospectiveV6 || prospectiveV7 || prospectiveV8;
  // v6 and v7 run both arms on one host action family. v8 does not, and the
  // separation is the point of v8 rather than an oversight, so the two shapes
  // get separate checks instead of one loosened check that would pass either.
  const sharedHostFamilyContrast = prospectiveV6 || prospectiveV7;
  const semanticInstrumented =
    prospectiveV3 || prospectiveV4 || prospectiveV5 || prospectiveV6 || prospectiveV7 || prospectiveV8;
  const currentProgrammeLedger = prospectiveV2 || prospectiveV3;
  // v5 onward all carry the v4 semantic instrument and its spent sealed corpus
  // forward rather than earning the gates again, and all are checked on derived
  // arithmetic. Named once so a further version is one edit, not six.
  const carriesForwardV4Instrument = prospectiveV5 || prospectiveV6 || prospectiveV7 || prospectiveV8;
  // A separate name for a separate idea, even though the versions coincide
  // today. One says which instrument a version runs; this one says how its
  // attempt arithmetic is checked.
  const derivedAttemptArithmetic = prospectiveV5 || prospectiveV6 || prospectiveV7 || prospectiveV8;
  // v7 introduced registration-derived size checking. v8 keeps it.
  const derivedSizeArithmetic = prospectiveV7 || prospectiveV8;
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
      'machinespirits.tutor-stub.boredom-action-register-proof-dag-registration.v7',
      'machinespirits.tutor-stub.boredom-action-register-proof-dag-registration.v8',
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
  // v1 to v6 all ran 36 dialogues in six worlds, and every count was written as
  // a literal here and again in the registration, with nothing comparing the two
  // copies. v7 changes the size, so its counts are read from the registration
  // and checked against each other: the world count, the per-world count, the
  // move margins, the manner margins and the four cells all have to multiply and
  // add to the same total. An edit that changes one of them and forgets the rest
  // fails here. The literals for v1 to v6 stay exactly as they are, because
  // their preflight certificates are pinned to them.
  const sizes = boredomRegisteredSizes(registration);
  if (derivedSizeArithmetic) {
    if (!sizes.ok) errors.push(`registered sizes do not agree with each other: ${sizes.errors.join(', ')}`);
  } else {
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
  }
  // v1 to v5 held the tutor move fixed and contrasted the manner. v6 turns that
  // around: the move is the contrast and the manner is a balancing block, and v7
  // keeps that shape. Both shapes have to be checkable, so the two are separate
  // branches rather than one loosened check that would pass either by accident.
  if (moveContrast) {
    const treatment = registration?.design?.treatment || {};
    const moves = treatment.pedagogicalMoves || {};
    if (
      treatment.realizationRole !== 'balancing_block_not_the_contrast' ||
      typeof treatment.treatmentMayNotSupplyTheFinding !== 'string' ||
      treatment.contentLeakageDisclosureRequired !== true ||
      treatment.assignedPedagogicalMoveTutorTurns !== 1 ||
      JSON.stringify(treatment.realizations) !== JSON.stringify(['plain', 'warm'])
    ) {
      errors.push('a move contrast must balance the manner inside each move and withhold the finding');
    }
    if (sharedHostFamilyContrast) {
      if (
        JSON.stringify(treatment.pedagogicalMoveLevels) !== JSON.stringify(['ask_question', 'shrink_step']) ||
        moves.ask_question !== 'ask_discriminating_question' ||
        moves.shrink_step !== 'simplify_to_one_workable_step' ||
        treatment.reference !== 'ask_question' ||
        treatment.treatment !== 'shrink_step' ||
        treatment.hostActionFamily !== 'stage_next_step' ||
        treatment.hostActionFamilySharedByBothLevels !== true ||
        typeof treatment.hostActionFamilySharedReason !== 'string'
      ) {
        errors.push('design must isolate the two boredom-appropriate moves with manner balanced inside each');
      }
    }
    // v8 contrasts making a boredom-directed move against making none, and it
    // is the first version whose two arms do not share a host action family.
    // That is the whole repair. v7 audited its own paid transcripts and found
    // both arms asking a question in 0.976 of trigger turns, the arm that
    // forbade one included, because the shared family decided the handoff and
    // the instruction text never got a vote. So the checks here are not that the
    // registration says the arms differ. They compile the contract the runtime
    // compiles, from the family the study code actually returns, and require the
    // question permission to come out different. A registration that names two
    // arms the machinery would deliver identically cannot pass.
    if (prospectiveV8) {
      const referenceMove = moves[treatment.reference];
      const treatmentMove = moves[treatment.treatment];
      if (
        JSON.stringify(treatment.pedagogicalMoveLevels) !== JSON.stringify(['carry_on', 'ask_question']) ||
        moves.carry_on !== 'stage_public_evidence_for_next_step' ||
        moves.ask_question !== 'ask_discriminating_question' ||
        treatment.reference !== 'carry_on' ||
        treatment.treatment !== 'ask_question' ||
        treatment.hostActionFamily !== undefined ||
        treatment.hostActionFamilySharedByBothLevels !== false ||
        typeof treatment.hostActionFamilySeparatedReason !== 'string' ||
        typeof treatment.whatTheSeparationCosts !== 'string' ||
        treatment.actionFit !== 'one_matched_move_against_no_move' ||
        typeof treatment.referenceIsNotAnAbsence !== 'string' ||
        typeof registration?.whyV8?.whyTheSharedFamilyRuleIsReversed !== 'string' ||
        typeof registration?.whyV8?.whatV7ActuallyDelivered !== 'string'
      ) {
        errors.push('a move-against-no-move contrast must name its two families and argue the separation');
      }
      const families = treatment.hostActionFamilyByLevel || {};
      for (const [level, move] of [
        [treatment.reference, referenceMove],
        [treatment.treatment, treatmentMove],
      ]) {
        if (!move) continue;
        let actual = null;
        try {
          actual = tutorStubResistanceHostActionFamily(move);
        } catch {
          actual = null;
        }
        if (actual === null || families[level] !== actual) {
          errors.push(`registered host action family for ${level} does not match the family the study code returns`);
        }
      }
      // The delivered contrast the analyzer reads is one question mark or none.
      // This is where that becomes reachable rather than hoped for.
      const permission = {};
      for (const [level, move] of [
        [treatment.reference, referenceMove],
        [treatment.treatment, treatmentMove],
      ]) {
        if (!move || !families[level]) continue;
        const contract = compileTutorStubTurnProgressionContract({
          learnerText: 'I suppose so. It is all a bit much and I have rather lost the thread of it.',
          publicQuestion: 'Which entry in the delivery ledger covers the third week?',
          responseCompositionFrame: {
            discourse_plane: { plane: 'inquiry' },
            learner_move: { evidence_use: 'none' },
            learner_dag: { bottleneck: null, final_secret_entailed: false, asserted_secret: false },
          },
          actionFamily: families[level],
        });
        permission[level] = contract?.handoff_contract?.question_allowed === true;
      }
      if (permission[treatment.treatment] !== true || permission[treatment.reference] !== false) {
        errors.push(
          'the two arms compile to the same question permission, so the registered contrast cannot be delivered',
        );
      }
      const rules = registration?.measurement?.treatmentFidelity?.deliveredContrastByMove || {};
      if (
        rules[treatmentMove] !== 'requires_question' ||
        rules[referenceMove] !== 'forbids_question' ||
        Object.keys(rules).length !== 2
      ) {
        errors.push('the delivered-contrast rule must read one question mark or none, on both moves and only those');
      }
    }
    // v6's margins are literals, because its preflight certificate is pinned to
    // them. v7's are checked against each other and against the patterns that
    // deal them, above, which is the check v6 did not have.
    const randomization = registration?.design?.randomization || {};
    if (
      prospectiveV6 &&
      (randomization.askQuestionDialogues !== 18 ||
        randomization.shrinkStepDialogues !== 18 ||
        randomization.askQuestionPerWorld !== 3 ||
        randomization.shrinkStepPerWorld !== 3 ||
        randomization.askQuestionPlain !== 9 ||
        randomization.askQuestionWarm !== 9 ||
        randomization.shrinkStepPlain !== 9 ||
        randomization.shrinkStepWarm !== 9)
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
  if (moveContrast) {
    // v6 reads recovery across the whole outcome horizon rather than on the
    // first turn alone, so its primary is a different measure and gets a
    // different name, and v7 keeps that measure unchanged. The one-turn measure
    // does not disappear: it has to be carried as a named comparability
    // endpoint, because without it the reference move could not be read against
    // v5 at all. Requiring the pair here is what stops a version from widening
    // its window and quietly dropping the only figure that ties it to the run
    // before it.
    const primary = registration?.measurement?.primaryEndpoint || {};
    const comparability = registration?.measurement?.comparabilityEndpoint || {};
    // v7 reads one direction rather than two, which is a real loss of what the
    // study can say and not a tuning knob. So the direction has to be named, the
    // rule that a result the other way cannot reject has to be written down, and
    // the claim boundary has to carry it too.
    // v7 read one direction. v8 goes back to two, and not as a default: v7
    // measured its difference at -0.102, pointing away from the direction it had
    // registered, and its one-sided test left it unable to say anything about
    // that at all. v8 has no measurement of its reference arm from any prior
    // run, so it has no ground to name a direction from, and the result worth
    // having may well be the reversed one.
    const expectedAnalysis = prospectiveV7
      ? 'one_sided_exact_conditional_blocked_score_test'
      : 'two_sided_exact_conditional_blocked_score_test';
    if (
      primary.id !== 'bored_resistance_recovery_within_outcome_horizon' ||
      primary.deadlinePostTriggerLearnerTurns !== registration?.design?.treatment?.postTriggerLearnerTurns ||
      primary.analysis !== expectedAnalysis ||
      (prospectiveV6 && primary.definitionChangedFromV5 !== true) ||
      primary.notComparableWithV4OrV5Primary !== true ||
      primary.perTurnRuleUnchangedFromV5 !== true ||
      primary.mannerReportedAsBlock !== true ||
      primary.intentionToTreat !== true ||
      primary.modelJudge !== false ||
      primary.alpha !== 0.05 ||
      comparability.id !== 'profile_specific_resistance_recovery' ||
      comparability.deadlinePostTriggerLearnerTurns !== 1 ||
      comparability.reportedAlways !== true ||
      comparability.analysis !== 'descriptive_only_no_hypothesis_test' ||
      registration?.measurement?.keySecondaryEndpoint?.id !== secondaryEndpointId
    ) {
      errors.push('registered recovery and objective proof-progress endpoints drifted');
    }
    if (prospectiveV6 && typeof registration?.whyV6?.whyThisIsNotOutcomeFishing !== 'string') {
      errors.push('a widened primary window must record why it is not outcome fishing');
    }
    if (prospectiveV7) {
      const secondary = registration?.measurement?.keySecondaryEndpoint || {};
      const treatment = registration?.design?.treatment || {};
      // v6's single manner floor asked two questions at once and failed if
      // either missed, and it closed a completed run on three misses of the
      // softer one. v7 splits it. Lowering a floor after seeing the data is the
      // defect this arc keeps catching, so the check demands the thing that
      // separates a repair from an excuse: the registration has to say that the
      // split rescues nothing, and it may not apply the new floors to the run
      // that failed. Obedience keeps 0.90, because a tutor either delivered the
      // manner it was told to or it did not.
      const fidelity = registration?.measurement?.treatmentFidelity || {};
      if (
        fidelity.minimumActionVisibility !== 0.9 ||
        fidelity.minimumAssignedMoveDelivery !== 0.9 ||
        fidelity.minimumAssignedRegisterDelivery !== 0.9 ||
        !(fidelity.minimumRegisterReadability > 0 && fidelity.minimumRegisterReadability <= 0.9) ||
        fidelity.minimumRegisterVisibility !== undefined ||
        fidelity.registerFloorSplitFromV6 !== true ||
        fidelity.bothRegisterRatesMustBeReported !== true ||
        typeof fidelity.registerFloorSplitReason !== 'string' ||
        typeof fidelity.registerFloorSplitAppliesToV7Only !== 'string' ||
        fidelity.failedFidelityDisposition !== 'fail_interpretability_gate_not_rerun' ||
        typeof registration?.whyV7?.whyLegibilityGetsALowerFloor !== 'string' ||
        typeof registration?.whyV7?.whyThisIsNotRelaxingAFloorAfterSeeingTheData !== 'string'
      ) {
        errors.push('a split manner-fidelity floor must argue itself and may not rescue the run that failed');
      }
      if (
        primary.direction !== 'treatment_greater_than_reference' ||
        typeof primary.directionRule !== 'string' ||
        primary.definitionChangedFromV6 !== false ||
        secondary.direction !== 'treatment_greater_than_reference' ||
        !String(secondary.analysis || '').startsWith('one_sided_exact_conditional_blocked_score_test') ||
        typeof treatment.directionRegisteredBeforeAnyV7Dialogue !== 'string' ||
        typeof registration?.whyV7?.whyOneSided !== 'string' ||
        !String(registration?.claimBoundary || '').includes('one-sided')
      ) {
        errors.push('a one-sided primary must name its direction, its rule, and what it gives up');
      }
    }
    if (prospectiveV8) {
      const secondary = registration?.measurement?.keySecondaryEndpoint || {};
      const fidelity = registration?.measurement?.treatmentFidelity || {};
      // v7's four fidelity gates all passed and two of them read nothing. The
      // move gate compared the assigned move with itself through a field no code
      // writes; the manner gate compared the study's own instruction with the
      // copy of it the study had just made. v8 keeps both, because a gate that
      // cannot fail still records what was intended, but it may no longer call
      // them readings: each has to carry the word, and the floor that decides
      // the run has to be the delivered-contrast one, which reads the tutor's
      // own sentences.
      //
      // Both echoes are pinned at 1 rather than deleted, for two reasons. The
      // analyzer refuses a registration that splits the manner floor into
      // delivery and readability and then names only one half, so deleting the
      // delivery half would make the report unreadable. And at 1 the echo does
      // state a fact worth keeping: the only way a study's own copy of its own
      // instruction can differ from the instruction is a safety override
      // replacing what was assigned, so 1 means no override happened. At
      // anything below 1 the same field would read like a measurement of the
      // tutor, which is exactly the misreading v7 fell into.
      if (
        fidelity.minimumActionVisibility !== 0.9 ||
        fidelity.minimumRegisterReadability > 0.9 ||
        !(fidelity.minimumRegisterReadability > 0) ||
        fidelity.minimumRegisterVisibility !== undefined ||
        fidelity.bothRegisterRatesMustBeReported !== true ||
        fidelity.failedFidelityDisposition !== 'fail_interpretability_gate_not_rerun' ||
        typeof fidelity.echoedGatesMayNotBeReportedAsReadings !== 'string' ||
        fidelity.minimumAssignedMoveDelivery !== 1 ||
        fidelity.minimumAssignedRegisterDelivery !== 1 ||
        !(fidelity.minimumMoveContrastDelivery > 0 && fidelity.minimumMoveContrastDelivery <= 1) ||
        typeof fidelity.moveContrastFloorReason !== 'string' ||
        typeof registration?.whyV8?.whyTheDeliveredContrastFloorReplacesTheMoveFloor !== 'string'
      ) {
        errors.push('a delivered-contrast floor must replace the move floor that read nothing');
      }
      if (
        primary.direction !== 'either_direction' ||
        typeof primary.directionRule !== 'string' ||
        primary.definitionChangedFromV7 !== false ||
        secondary.direction !== 'either_direction' ||
        !String(secondary.analysis || '').startsWith('two_sided_exact_conditional_blocked_score_test') ||
        typeof registration?.whyV8?.whyTwoSidedAgain !== 'string' ||
        !String(registration?.claimBoundary || '').includes('two-sided')
      ) {
        errors.push('a two-sided primary must say so and must not carry a registered direction');
      }
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
  } else if (prospectiveV7) {
    // v7 is the first version whose power cannot be enumerated. The exact walk
    // over every reachable state runs out of memory at six units per move per
    // world and v7 runs seven, so the rejection rate is estimated by drawing
    // outcomes and running the registered test on each draw. That is a weaker
    // kind of number than v1 to v4 carried, and the check is that it says so:
    // the method has to be named, the draws counted, and the test function has
    // to be the one the analyzer actually calls.
    //
    // v7 is also the first version that does not reach its own power target. The
    // check requires it to say that plainly rather than round it away, and it
    // requires the safeguard note, because the sample size is now set by the
    // attempt safeguard and the registration's own accounting field says a
    // safeguard must not do that.
    const method = power.howPowerWasComputed || {};
    const table = Array.isArray(power.powerTable) ? power.powerTable : [];
    const position = power.positionForV7 || {};
    const audit = power.pairedDesignAudit || {};
    const blocking = power.blockingAudit || {};
    const considered = Array.isArray(power.sizesConsidered) ? power.sizesConsidered : [];
    const chosen = considered.filter((row) => row?.chosen === true);
    if (
      power.test !== 'one_sided_exact_conditional_blocked_score_test' ||
      power.alpha !== 0.05 ||
      power.targetPower !== 0.8 ||
      power.targetPowerReached !== false ||
      typeof power.targetPowerReachedNote !== 'string' ||
      method.method !== 'simulated_rejection_rate_of_the_registered_test' ||
      typeof method.whyNotEnumerated !== 'string' ||
      !String(method.testFunctionIsTheOneTheAnalyzerCalls || '').includes('exactBlockedScoreOneSidedPValue') ||
      !(method.draws >= 1000) ||
      method.modelCalls !== 0 ||
      typeof power.referenceRate?.source !== 'string' ||
      typeof power.referenceRate?.caution !== 'string' ||
      typeof power.referenceRate?.standing !== 'string' ||
      typeof power.measuredTreatmentRate?.winnersCurse !== 'string' ||
      table.length < 3 ||
      table.some(
        (row) =>
          !(row?.oneSidedPower > 0 && row?.oneSidedPower < 1) ||
          !(row?.treatmentRate > row?.referenceRate) ||
          row?.perMove !== power.minimumPerMove ||
          row?.dialogues !== sizes.dialogues,
      ) ||
      chosen.length !== 1 ||
      chosen[0]?.dialogues !== sizes.dialogues ||
      considered.filter((row) => row?.chosen !== true).some((row) => typeof row?.rejectedBecause !== 'string') ||
      typeof position.statedPlainly !== 'string' ||
      typeof position.whatANullWouldMean !== 'string' ||
      typeof position.whatARejectionWouldMean !== 'string' ||
      typeof position.whyRunItAtThisSize !== 'string' ||
      typeof blocking.result !== 'string' ||
      typeof blocking.decision !== 'string' ||
      typeof audit.v7Recomputation !== 'string' ||
      typeof audit.result !== 'string' ||
      typeof audit.reopeningRequires !== 'string' ||
      audit.decision !== 'rejected. v7 keeps independent units, as v4, v5 and v6 did.' ||
      typeof registration?.whyV7?.whyPairingWasRejectedAgain !== 'string' ||
      power.minimumPerMove !== sizes.perMove ||
      power.minimumPerArm !== undefined ||
      power.powerAt17PerArm !== undefined ||
      power.powerAt18PerArm !== undefined ||
      power.designChoiceAudit !== undefined ||
      power.powerTableAtEighteenPerMove !== undefined ||
      power.positionForV5 !== undefined ||
      power.positionForV6 !== undefined
    ) {
      errors.push('power position does not record the estimated rejection rate and the unreached target');
    }
    if (typeof execution.programmeCeiling?.theSafeguardNowBindsTheDesign !== 'string') {
      errors.push('a design whose size is set by the attempt safeguard must say so');
    }
  } else if (prospectiveV8) {
    // v8 estimates its rejection rate the same way v7 did, and the same three
    // demands apply: name the method, count the draws, and use the test function
    // the analyzer calls. Two things are different and both need their own
    // check.
    //
    // First, the test is two-sided, so the function named has to be the
    // two-sided one. A registration that computed power one-sided and then ran a
    // two-sided test would be reporting a number it will not get.
    //
    // Second, and this is the honest weakness of v8: the reference rate is not
    // measured. Every prior version anchored both arms on a prior run. Nothing
    // in this programme has ever run a tutor that ignores a bored learner, so
    // the reference rate is scanned across a range rather than pinned, and the
    // power table is a range of answers rather than one. The check makes that
    // visible instead of letting one row stand in for a measurement: the table
    // has to span at least four reference rates, it has to include a row the
    // design is badly powered for, and the registration has to say what it will
    // and will not have learned in that case.
    const method = power.howPowerWasComputed || {};
    const table = Array.isArray(power.powerTable) ? power.powerTable : [];
    const position = power.positionForV8 || {};
    const considered = Array.isArray(power.sizesConsidered) ? power.sizesConsidered : [];
    const chosen = considered.filter((row) => row?.chosen === true);
    const underpowered = table.filter((row) => row?.twoSidedPower < 0.5);
    if (
      power.test !== 'two_sided_exact_conditional_blocked_score_test' ||
      power.alpha !== 0.05 ||
      power.targetPower !== 0.8 ||
      power.targetPowerReached !== false ||
      typeof power.targetPowerReachedNote !== 'string' ||
      method.method !== 'simulated_rejection_rate_of_the_registered_test' ||
      typeof method.whyNotEnumerated !== 'string' ||
      !String(method.testFunctionIsTheOneTheAnalyzerCalls || '').includes('exactBlockedScorePValue') ||
      !(method.draws >= 1000) ||
      method.modelCalls !== 0 ||
      power.referenceRate?.measured !== false ||
      typeof power.referenceRate?.whyItCannotBeMeasuredFromPriorRuns !== 'string' ||
      typeof power.referenceRate?.scannedRange !== 'string' ||
      typeof power.measuredTreatmentRate?.source !== 'string' ||
      typeof power.measuredTreatmentRate?.winnersCurse !== 'string' ||
      table.length < 4 ||
      table.some(
        (row) =>
          !(row?.twoSidedPower > 0 && row?.twoSidedPower < 1) ||
          !(row?.treatmentRate > row?.referenceRate) ||
          row?.perArm !== power.minimumPerMove ||
          row?.dialogues !== sizes.dialogues,
      ) ||
      underpowered.length < 1 ||
      chosen.length !== 1 ||
      chosen[0]?.dialogues !== sizes.dialogues ||
      considered.filter((row) => row?.chosen !== true).some((row) => typeof row?.rejectedBecause !== 'string') ||
      typeof position.statedPlainly !== 'string' ||
      typeof position.whatANullWouldMean !== 'string' ||
      typeof position.whatARejectionWouldMean !== 'string' ||
      typeof position.whatAReversalWouldMean !== 'string' ||
      typeof position.whyRunItAtThisSize !== 'string' ||
      typeof power.blockingAudit?.decision !== 'string' ||
      typeof power.pairedDesignAudit?.decision !== 'string' ||
      power.minimumPerMove !== sizes.perMove ||
      power.minimumPerArm !== undefined ||
      power.positionForV7 !== undefined
    ) {
      errors.push('power position does not record a scanned reference rate and the unreached target');
    }
    if (typeof execution.programmeCeiling?.theSafeguardNowBindsTheDesign !== 'string') {
      errors.push('a design whose size is set by the attempt safeguard must say so');
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
      // v5 and v6 both ran 36. v7 and v8 read their own size from the
      // registration, and the sizes check above has already made that number
      // agree with the world list, the margins, the patterns and the batches.
      dialogue.dialogues !== (derivedSizeArithmetic ? sizes.dialogues : 36) ||
      dialogue.maximumReservations !== dialogue.maximumReservationsPerDialogue * dialogue.dialogues ||
      execution.hardStudyAttemptCeiling !== dialogue.maximumReservations
    ) {
      errors.push('hard attempt arithmetic drifted');
    }
  }
  // v1 to v6 all ran nine batches of four and wrote both numbers here. v7 and v8
  // read them, and the sizes check has already tied them to the study total.
  const expectedBatches = derivedSizeArithmetic ? sizes.batches : 9;
  const expectedPerBatch = derivedSizeArithmetic ? sizes.perBatch : 4;
  if (
    batches.executionBatches !== expectedBatches ||
    batches.dialoguesPerBatch !== expectedPerBatch ||
    batches.plainPerBatch !== 2 ||
    batches.warmPerBatch !== 2 ||
    batches.maximumReservationsPerBatch !==
      (sealedLiteralArithmetic ? 240 : dialogue.maximumReservationsPerDialogue * batches.dialoguesPerBatch) ||
    batches.totalBatches !== expectedBatches ||
    batches.noInterimAnalysis !== true
  ) {
    errors.push('predeclared batch partition drifted');
  }
  // Under a move contrast a batch that is balanced on manner alone is not
  // balanced. Every batch has to hold one dialogue of each of the four
  // move-and-manner pairs, so that stopping after any batch leaves the contrast
  // even.
  //
  // v6 and v7 named their two arms here, ask_question and shrink_step. v8's
  // reference arm is called carry_on, so the names come from the registration's
  // own level list instead: whatever the two arms are called, each has to take
  // half the batch. Naming them here was a third copy of the level list, and
  // this arc has now spent six versions removing copies like it.
  if (moveContrast) {
    const levels = registration?.design?.treatment?.pedagogicalMoveLevels || [];
    const balanced =
      levels.length === 2 &&
      levels.every((level) => {
        const field = `${level.replace(/_(.)/g, (_, letter) => letter.toUpperCase())}PerBatch`;
        return batches[field] === expectedPerBatch / 2;
      });
    if (!balanced) errors.push('predeclared batch partition does not balance the move under test');
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
    // Each version has one more finished run behind it than the last, so the
    // chain runs through one more spend. Everything after the ledger line is the
    // same check. v7 adds the 382 attempts v6's failed first launch spent for
    // zero units: a launch that produced nothing still spent against the
    // safeguard, and leaving it out would understate the ledger by more than the
    // headroom v7 has left.
    //
    // v5, v6 and v7 each grew this into one more arm of a ternary that listed
    // the prior spends by name, so adding a version meant editing a chain that
    // three frozen registrations were already read by. The ledger is instead
    // read off the field names: every key ending in Spend is a prior spend and
    // all of them are added, so a version that forgets to carry one forward
    // fails here rather than quietly understating the ledger. v5, v6 and v7 all
    // sum to exactly what their ternary arm summed to.
    const ledgerBefore = ceiling[`ledgerBeforeV${registration.version}`];
    const spentBefore = Object.entries(ceiling)
      .filter(([key, value]) => key.endsWith('Spend') && typeof value === 'number')
      .reduce((total, [, value]) => total + value, 0);
    const studyMaximum = ceiling[`v${registration.version}Maximum`];
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
  // Every version since v5 has written down that its prefix seeds meet no prior
  // version's, in a field named for the version before it, and no code has ever
  // read one of those fields. This arc's recurring defect is a rule written in a
  // registration that nothing enforces, so the claim is checked here against the
  // registrations it names. A prefix seed decides the public prefix a dialogue
  // is generated from, so a reused seed would silently regenerate a prefix a
  // finished run already spent, and the two runs would share units nothing
  // recorded as shared. The seeds run from seedBase + 1 to seedBase + dialogues,
  // which is how the plan builder deals them.
  //
  // Only versions that actually spent attempts are checked. v1, v2 and v3 all
  // sit on the same seed base and none of them ever made a call, so their ranges
  // are free; a version that never ran spent no prefix. Which versions spent is
  // not guessed and is not kept in a list here: the programme ledger in this
  // same registration already names one vNSpend field per finished run, and that
  // is what is read. So a version cannot charge a prior run against the
  // safeguard without also being checked against that run's seeds.
  {
    const seedSpan = (candidate) => {
      const base = candidate?.design?.freshPrefixGeneration?.seedBase;
      const count = candidate?.design?.randomization?.dialogues;
      if (!Number.isInteger(base) || !Number.isInteger(count)) return null;
      return { from: base + 1, to: base + count };
    };
    const mine = seedSpan(registration);
    if (!mine) {
      errors.push('a registration must derive a prefix seed range from its own seed base and size');
    } else {
      const spentVersions = Object.keys(execution.programmeCeiling || {})
        .map((key) => /^v([0-9]+)Spend$/.exec(key))
        .filter(Boolean)
        .map((match) => Number(match[1]))
        .filter((version) => version < registration.version);
      for (const priorVersion of [...new Set(spentVersions)].sort((left, right) => left - right)) {
        const priorPath = path.join(
          ROOT,
          `config/tutor-stub-boredom-action-register-proof-dag-registration.v${priorVersion}.json`,
        );
        let prior = null;
        try {
          prior = JSON.parse(fs.readFileSync(priorPath, 'utf8'));
        } catch {
          errors.push(`spent boredom registration v${priorVersion} could not be read to check seed reuse`);
          continue;
        }
        const theirs = seedSpan(prior);
        if (!theirs) continue;
        if (mine.from <= theirs.to && theirs.from <= mine.to) {
          errors.push(
            `prefix seeds ${mine.from}-${mine.to} meet spent v${priorVersion}'s ${theirs.from}-${theirs.to}, so a finished run's prefixes would be regenerated`,
          );
        }
      }
    }
  }
  // v5 changes three of the six worlds and moves the seed, so it has its own
  // assignment manifest and its own pinned digest. Both pins are literals on
  // purpose: the point of the pin is that the assignment was fixed before any
  // dialogue was generated, so it must not be recomputed from whatever the
  // registration currently says.
  //
  // v6 assigns two things per dialogue instead of one, so it ranks the same way
  // and then reads a per-world pattern. The algorithm name says so, and it is
  // pinned like the seed and the digest, so a v6 file cannot claim the v5
  // algorithm and still pass. v7 and v8 deal the same way and say so with a
  // different name, because their patterns come from the registration rather
  // than from a constant in this file.
  //
  // The three pins used to be three nested ternaries that each grew an arm every
  // version. They are one table now, one row per version, because a row is what
  // they are: three frozen facts about one run. The literals are unchanged.
  const REGISTERED_ASSIGNMENT_PINS = {
    8: {
      seed: 20261122,
      sha256: '7bbd04336c5076b8fdc2a74c75fcea3e960c2e5bedee75a684e2e506789ce1ec',
      algorithm: 'sha256_rank_within_world_with_registered_world_pattern',
    },
    7: {
      seed: 20261022,
      sha256: 'a16c127908d8b05e0181b6235521c1274ff97e95e5a3cb0fdd09234f34d76016',
      algorithm: 'sha256_rank_within_world_with_registered_world_pattern',
    },
    6: {
      seed: 20260922,
      sha256: 'fb84030c40bf559e1f37bbf90ef088d501843307a187939b168ea5186c74259d',
      algorithm: 'sha256_rank_within_world_with_seeded_world_pattern',
    },
    5: {
      seed: 20260901,
      sha256: '485f7442d2844dad9026c54ea47ed3214f5cf1e4c36bf372a2fb52dfb6304b28',
      algorithm: 'sha256_rank_within_world',
    },
  };
  const DEFAULT_ASSIGNMENT_PIN = {
    seed: 20260820,
    sha256: '4e256dfa65054747a5d6d1ac82d1aecb42f7c98f158cb76e686f24c37d71ef94',
    algorithm: 'sha256_rank_within_world',
  };
  const pin = REGISTERED_ASSIGNMENT_PINS[registration?.version] || DEFAULT_ASSIGNMENT_PIN;
  const expectedAssignmentSeed = pin.seed;
  const expectedAssignmentManifestSha256 = pin.sha256;
  const expectedAssignmentAlgorithm = pin.algorithm;
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

/**
 * Where the two per-world patterns come from.
 *
 * v6 froze them in this file, and wrote the margins they had to produce into the
 * registration separately, with nothing comparing the two. v7 puts them in the
 * registration beside those margins, and boredomRegisteredSizes recounts the
 * patterns and reads the count against what the registration claims. v6's copy
 * stays here untouched, because its assignment digest is pinned to these exact
 * bytes and a moved pattern would rewrite a completed run's assignment.
 */
function boredomWorldPatterns(registration) {
  if (registration.version === 6) return [BOREDOM_V6_WORLD_PATTERNS.a, BOREDOM_V6_WORLD_PATTERNS.b];
  const registered = registration.design.randomization.worldPatterns || {};
  const names = Object.keys(registered).sort();
  if (!names.length) throw new Error('a move-contrast registration must register its per-world patterns');
  return names.map((name) => registered[name]);
}

/** Rank the worlds by the seed and hand each one a pattern, evenly. */
function boredomPatternByWorld(registration) {
  const assignmentSeed = registration.design.randomization.assignmentSeed;
  const patterns = boredomWorldPatterns(registration);
  const worlds = registration.design.worlds;
  const perPattern = worlds.length / patterns.length;
  const ranked = worlds
    .map((world) => ({
      world,
      rank: crypto.createHash('sha256').update(`${assignmentSeed}:pattern:${world}`).digest('hex'),
    }))
    .sort((left, right) => left.rank.localeCompare(right.rank));
  return new Map(ranked.map((row, index) => [row.world, patterns[Math.floor(index / perPattern)]]));
}

/**
 * Rank the dialogues inside one world by the seed, in the order the world list
 * gives. Both the move-contrast builder and the older manner-contrast builder
 * deal from this same ranking, so the two cannot drift apart.
 */
function boredomRankedDialoguesInWorld(registration, world, perWorld) {
  const assignmentSeed = registration.design.randomization.assignmentSeed;
  return Array.from({ length: perWorld }, (_, dialogueIndex) => ({
    world,
    dialogue_index: dialogueIndex + 1,
    assignment_rank_sha256: crypto
      .createHash('sha256')
      .update(`${assignmentSeed}:${world}:${dialogueIndex + 1}`)
      .digest('hex'),
  })).sort((left, right) => left.assignment_rank_sha256.localeCompare(right.assignment_rank_sha256));
}

function buildBoredomMoveContrastAssignmentManifest(registration, perWorld) {
  const patternByWorld = boredomPatternByWorld(registration);
  return registration.design.worlds.flatMap((world) => {
    const pattern = patternByWorld.get(world);
    const ranked = boredomRankedDialoguesInWorld(registration, world, perWorld);
    const cellByDialogue = new Map(ranked.map((row, index) => [row.dialogue_index, pattern[index]]));
    return ranked
      .map((row) => {
        const [move, realization] = cellByDialogue.get(row.dialogue_index).split(':');
        return { ...row, pedagogical_move_level: move, realization };
      })
      .sort((left, right) => left.dialogue_index - right.dialogue_index);
  });
}

/**
 * Deal the manifest and say what its digest is, without checking the pin.
 *
 * This exists so that pinning a new version's digest and verifying an old one
 * run the same code. v6 and v7 each had their digest computed by a throwaway
 * script that re-dealt the manifest from a second copy of the rules, and a
 * second copy of a rule with nothing comparing the copies is the defect this
 * arc has now closed six times. Nothing but the pinning step may call this:
 * every reader goes through buildTutorStubBoredomProofDagAssignments, which
 * refuses a manifest that does not match what the registration froze.
 */
export function dealTutorStubBoredomProofDagAssignments(registration) {
  // v1 to v6 all dealt six dialogues a world and wrote that 6 here twice. It now
  // comes from the registration, which every version carries, so v1 to v6
  // rebuild byte-identical manifests and v7 deals fourteen.
  const perWorld = registration.design.randomization.dialoguesPerWorld ?? 6;
  const moveContrast = registration.version >= 6;
  const manifest = moveContrast
    ? buildBoredomMoveContrastAssignmentManifest(registration, perWorld)
    : registration.design.worlds.flatMap((world) => {
        const ranked = boredomRankedDialoguesInWorld(registration, world, perWorld);
        const realizationByDialogue = new Map(
          ranked.map((row, index) => [row.dialogue_index, index < perWorld / 2 ? 'plain' : 'warm']),
        );
        return ranked
          .map((row) => ({ ...row, realization: realizationByDialogue.get(row.dialogue_index) }))
          .sort((left, right) => left.dialogue_index - right.dialogue_index);
      });
  return { digest: assignmentManifestSha256(manifest), manifest, moveContrast };
}

export function buildTutorStubBoredomProofDagAssignments(registration) {
  const { digest, manifest, moveContrast } = dealTutorStubBoredomProofDagAssignments(registration);
  if (digest !== registration.design.randomization.assignmentManifestSha256) {
    throw new Error(
      moveContrast
        ? 'predeclared boredom move and register assignment manifest drifted'
        : 'predeclared boredom register assignment manifest drifted',
    );
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
  const isMoveContrast = registration.version >= 6;
  const moveByLevel = registration.design.treatment.pedagogicalMoves || {};
  // The 6 here was the per-world dialogue count written a third time. It sets
  // each dialogue's seed, so a wrong value would silently reuse seeds across
  // worlds. It now comes from the registration like everything else.
  const perWorld = registration.design.randomization.dialoguesPerWorld ?? 6;
  const candidates = assignments.manifest.map((row) => {
    const worldIndex = registration.design.worlds.indexOf(row.world);
    const ordinal = worldIndex * perWorld + row.dialogue_index - 1;
    const pedagogicalMove = isMoveContrast
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
      ...(isMoveContrast ? { pedagogical_move_level: row.pedagogical_move_level } : {}),
      realization: row.realization,
      assignment_rank_sha256: row.assignment_rank_sha256,
      assignment_manifest_sha256: assignments.digest,
      maximum_model_attempt_reservations: perDialogueCeiling,
    };
  });
  // A v5 batch had to be even on manner alone. A move-contrast batch has to be
  // even on both, so it takes one dialogue from each of the four move-and-manner
  // cells. The level names come from the registration, so a design that renames
  // its moves does not need this line rewritten.
  const cell = (level, realization) =>
    candidates.filter((row) => row.pedagogical_move_level === level && row.realization === realization);
  const plain = candidates.filter((row) => row.realization === 'plain');
  const warm = candidates.filter((row) => row.realization === 'warm');
  const [referenceLevel, treatmentLevel] = registration.design.treatment.pedagogicalMoveLevels || [];
  const cells = isMoveContrast
    ? [
        cell(referenceLevel, 'plain'),
        cell(referenceLevel, 'warm'),
        cell(treatmentLevel, 'plain'),
        cell(treatmentLevel, 'warm'),
      ]
    : [];
  // Nine batches was written here twice and in the registration a third time.
  // It is now read once, and the registration's own sizes check has already tied
  // it to the dialogue count.
  const batchCount = registration.executionReadiness.batches.executionBatches;
  const jobs = Array.from({ length: batchCount }, (_, batchIndex) => {
    const batchId = `execution_batch_${batchIndex + 1}`;
    const rows = isMoveContrast
      ? cells.map((column) => column[batchIndex])
      : [plain[batchIndex * 2], warm[batchIndex * 2], plain[batchIndex * 2 + 1], warm[batchIndex * 2 + 1]];
    if (rows.some((row) => !row)) throw new Error('predeclared batch partition could not be filled');
    return rows.map((row) => ({ ...row, batch_id: batchId }));
  }).flat();
  if (jobs.length !== candidates.length) throw new Error('predeclared batch partition left dialogues undealt');
  return {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-plan.v1',
    assignment_manifest_sha256: assignments.digest,
    jobs,
    batches: Array.from({ length: batchCount }, (_, index) => ({
      id: `execution_batch_${index + 1}`,
      cases: 4,
      plain: 2,
      warm: 2,
      ...(isMoveContrast ? { [referenceLevel]: 2, [treatmentLevel]: 2 } : {}),
      ceiling: perBatchCeiling,
    })),
    total_maximum_model_attempt_reservations: studyCeiling,
  };
}

/**
 * Which registration versions measure the learner with the independent semantic
 * adjudicator rather than with word matching alone. v3 introduced it, v4
 * validated it on the sealed corpus, and v5 onward carry that validation
 * forward. Written once here so a further version is one edit rather than five.
 */
function usesSemanticAdjudicator(version) {
  return version >= 3;
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
    // From v7 the manner floor is two floors, so a row has to carry the two
    // facts apart. A registration that promises two rates and a run that emits
    // one merged flag is the defect this arc keeps finding, so the split is
    // read off the registration and the rows are then required to show it.
    splitRegisterFloor: Number.isFinite(Number(measurement.treatmentFidelity?.minimumRegisterReadability)),
    // From v8 the fidelity reading that decides the run counts question marks in
    // the tutor's own trigger turn. A row has to carry it, or the endpoint gate
    // can only ask for `assigned_move_delivered`, which compares the assignment
    // with itself and is true in every row that can exist.
    moveContrastDelivery:
      Number.isFinite(Number(measurement.treatmentFidelity?.minimumMoveContrastDelivery)) &&
      !!measurement.treatmentFidelity?.deliveredContrastByMove,
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
        ...(extensions.splitRegisterFloor ? { register_delivered_as_designed: true, register_readable: true } : {}),
        ...(extensions.assignedMoveDelivery ? { assigned_move_delivered: true } : {}),
        // The synthetic row states the delivered contrast and the count it was
        // read from, so a run whose rows carry neither cannot pass the endpoint
        // gate by carrying the echo alone.
        ...(extensions.moveContrastDelivery
          ? {
              move_contrast_delivered: true,
              delivered_question_count:
                registration.measurement.treatmentFidelity.deliveredContrastByMove[job.pedagogical_move] ===
                'requires_question'
                  ? 1
                  : 0,
            }
          : {}),
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
      // v6 held one flag for two facts: did the tutor deliver the manner it was
      // assigned, and can a reader tell which manner the turn is in. v7 gives
      // each its own floor, so each has to arrive as its own field, and the
      // merged flag has to be exactly the two together rather than a third
      // opinion written beside them.
      (!extensions.splitRegisterFloor ||
        (row.fidelity.register_delivered_as_designed === true &&
          row.fidelity.register_readable === true &&
          row.fidelity.register_visible ===
            (row.fidelity.register_delivered_as_designed && row.fidelity.register_readable))) &&
      // v1 to v5 held the move fixed, so there was nothing to deliver wrongly.
      // v6 assigns it, and a unit whose delivered move is not its assigned move
      // is nonadherent.
      (!extensions.assignedMoveDelivery || row.fidelity.assigned_move_delivered === true) &&
      // From v8 the row also has to carry the reading that decides the run, and
      // the flag has to follow the count rather than sit beside it: the question
      // arm shows at least one question mark, the reference arm shows none.
      (!extensions.moveContrastDelivery ||
        (row.fidelity.move_contrast_delivered === true &&
          Number.isInteger(row.fidelity.delivered_question_count) &&
          row.fidelity.move_contrast_delivered ===
            (registration.measurement.treatmentFidelity.deliveredContrastByMove[row.pedagogical_move] ===
            'requires_question'
              ? row.fidelity.delivered_question_count >= 1
              : row.fidelity.delivered_question_count === 0))) &&
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
  dealTutorStubBoredomProofDagAssignments,
  buildTutorStubBoredomProofDagPackets,
  buildTutorStubBoredomProofDagPlan,
  buildTutorStubBoredomProofDagSyntheticCases,
  boredomProofProgressNames,
  exactBlockedScoreOneSidedPValue,
  exactBlockedScorePValue,
  exactBlockedScorePower,
  exactMcNemarPower,
  exactTwoSidedMcNemarPValue,
  loadTutorStubBoredomProofDagRegistration,
  runTutorStubBoredomProofDagEndpointPreflight,
  objectiveProofProgress,
  validateTutorStubBoredomProofDagRegistration,
};
