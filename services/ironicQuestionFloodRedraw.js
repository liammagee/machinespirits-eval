/**
 * A second draw of one cell.
 *
 * The 45-row negative-register grid left one cell unexplained: the ironic tutor
 * against a question-flooding learner held its assigned manner 3 of 3 and came
 * out positive 3 of 3, where the same tutor across all five resistance targets
 * held the manner in 6 of 15. Three rows, noticed after the fact, one target of
 * five picked because it looked best.
 *
 * The mood floor had that shape too, and it did not survive a second draw. So
 * this is a screen, not a study: three more rows of the same cell, under the
 * conditions of the first draw, to find out whether 3/3 comes back.
 *
 * Generation and scoring are read straight off the grid's frozen plan rather
 * than restated here. Two draws are only comparable if nothing between them
 * moved, and a copied constant is a constant that can drift.
 */

import { createHash } from 'node:crypto';

import { NEGATIVE_REGISTER_EFFECT_GRID } from './negativeRegisterEffectGrid.js';

const IRONIC_PROFILE = 'cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified';
const QUESTION_FLOOD_SCENARIO = 'charisma_desire_resistance_breakthrough_question_flood';

export const IRONIC_QUESTION_FLOOD_REDRAW = Object.freeze({
  schema: 'machinespirits.ironic-question-flood-redraw-plan.v1',
  workplanItem: 'ironic-question-flood-target',
  /** The draw this one is compared against. */
  priorRun: 'eval-2026-08-05-87fe3664',
  scenarioSource: NEGATIVE_REGISTER_EFFECT_GRID.scenarioSource,
  profiles: Object.freeze([IRONIC_PROFILE]),
  scenarios: Object.freeze([QUESTION_FLOOD_SCENARIO]),
  repeats: 3,
  /** The plain gate for this register, on the single adopting turn. */
  gate: 'ironic',
  fold: 'resistance_turn',
  generation: NEGATIVE_REGISTER_EFFECT_GRID.generation,
  scoring: NEGATIVE_REGISTER_EFFECT_GRID.scoring,
  /**
   * Frozen before the run, so the reading is not chosen from the result.
   *
   * The ironic tutor held its manner 3 times in 12 outside this cell, so a
   * second clean sweep is six of six against a 25% background and is unlikely
   * to be sampling; one or none closes the thread. Two of three leaves the
   * question where it started, which is a real outcome and is written down as
   * one rather than argued away afterwards.
   */
  decisionRule: Object.freeze({
    closesThreadAtOrBelow: 1,
    clearsForDesignAtOrAbove: 3,
    inconclusiveAt: 2,
    backgroundHeldRate: '3/12 — the ironic arm on the other four targets in the prior draw',
    claimsLicensed: 'none; a second sweep licenses writing a design, not stating a finding',
  }),
});

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

export function hashIronicQuestionFloodRedraw(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJson(value)))
    .digest('hex');
}

export function buildIronicQuestionFloodRedrawPlan() {
  const jobs = [];
  for (const profile of IRONIC_QUESTION_FLOOD_REDRAW.profiles) {
    for (const scenario of IRONIC_QUESTION_FLOOD_REDRAW.scenarios) {
      for (let repeat = 1; repeat <= IRONIC_QUESTION_FLOOD_REDRAW.repeats; repeat += 1) {
        jobs.push({ ordinal: jobs.length + 1, profile, scenario, repeat });
      }
    }
  }
  const plan = {
    ...IRONIC_QUESTION_FLOOD_REDRAW,
    profiles: [...IRONIC_QUESTION_FLOOD_REDRAW.profiles],
    scenarios: [...IRONIC_QUESTION_FLOOD_REDRAW.scenarios],
    generation: { ...IRONIC_QUESTION_FLOOD_REDRAW.generation },
    scoring: { ...IRONIC_QUESTION_FLOOD_REDRAW.scoring },
    decisionRule: { ...IRONIC_QUESTION_FLOOD_REDRAW.decisionRule },
    design: '1 register arm x 1 resistance target x 3 repeats — a second draw of one cell',
    estimands: ['held_the_manner'],
    plannedRows: jobs.length,
    jobs,
  };
  return { ...plan, planSha256: hashIronicQuestionFloodRedraw(plan) };
}

export function validateIronicQuestionFloodRedrawPlan(plan) {
  const errors = [];
  const expectedRows =
    IRONIC_QUESTION_FLOOD_REDRAW.profiles.length *
    IRONIC_QUESTION_FLOOD_REDRAW.scenarios.length *
    IRONIC_QUESTION_FLOOD_REDRAW.repeats;
  if (plan.plannedRows !== expectedRows || plan.jobs?.length !== expectedRows) {
    errors.push(`expected ${expectedRows} planned rows, found ${plan.jobs?.length || 0}`);
  }
  // The whole point is that the two draws asked for the same thing. If the
  // parent plan's generation or scoring ever moves, this plan must fail rather
  // than quietly compare a new setup against an old count.
  for (const [key, source] of [
    ['generation', NEGATIVE_REGISTER_EFFECT_GRID.generation],
    ['scoring', NEGATIVE_REGISTER_EFFECT_GRID.scoring],
  ]) {
    for (const field of Object.keys(source)) {
      if (plan[key]?.[field] !== source[field]) {
        errors.push(`${key}.${field} does not match the prior draw's plan`);
      }
    }
  }
  if (!plan.profiles?.includes(IRONIC_PROFILE)) errors.push('the ironic arm is missing from the plan');
  if (!plan.scenarios?.includes(QUESTION_FLOOD_SCENARIO)) errors.push('the question-flood target is missing');
  return { ok: errors.length === 0, errors, expectedRows };
}

/**
 * Read the frozen rule rather than eyeballing the count. `held` is the number
 * of rows that passed the plain ironic gate on the adopting turn.
 */
export function readRedrawVerdict({ held, n }) {
  const rule = IRONIC_QUESTION_FLOOD_REDRAW.decisionRule;
  if (n !== IRONIC_QUESTION_FLOOD_REDRAW.repeats) {
    return { verdict: 'INCOMPLETE', reading: `expected ${IRONIC_QUESTION_FLOOD_REDRAW.repeats} rows, found ${n}` };
  }
  if (held <= rule.closesThreadAtOrBelow) {
    return {
      verdict: 'THREAD_CLOSES',
      reading:
        `${held}/${n} held the manner. The first draw's 3/3 was a draw, as the mood floor's 0/6 was. ` +
        'The card closes and no design follows.',
    };
  }
  if (held >= rule.clearsForDesignAtOrAbove) {
    return {
      verdict: 'CLEARS_FOR_DESIGN',
      reading:
        `${held}/${n} held the manner, six of six across both draws against a 3/12 background on the ` +
        'other targets. That is unlikely to be sampling. It licenses writing a design, not stating a finding.',
    };
  }
  return {
    verdict: 'INCONCLUSIVE',
    reading:
      `${held}/${n} held the manner — five of six across both draws. The frozen rule calls this ` +
      'inconclusive: it neither closes the thread nor clears it, and the next step is a decision about ' +
      'appetite, not a result.',
  };
}
