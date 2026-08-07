/**
 * Forced-card schedule (card: adaptive-causality-crossed-effects, figure
 * lattice). The launcher names which move the tutor is told to make, so a run
 * can hold the move fixed and vary something else.
 *
 * The cards split in two, and the split is the whole point of this file:
 *
 * - The five move cards (demand, stake, mockery, grievance, settled_claim)
 *   name a tactic the TUTOR takes. Ordering one is coherent at any moment.
 * - A quiet card (`quiet:flat` and friends) asserts a fact about the LEARNER —
 *   "she has gone flat". Ordering one when she has not gone flat tells the
 *   tutor something untrue, and the reply it writes is a reply to nothing.
 *
 * So a forced quiet card is checked against her actual last turn and withheld
 * when she is not in that state, while move cards ship as scheduled.
 *
 * Why this exists: in world_030_rowan_flat (2026-08-07) the schedule pinned
 * `quiet:flat` to four turns by number. On all four she wrote 22-30 words, at
 * or above her own running length. The detector called her flat once in 62
 * turns, on a one-word reply that was never ordered. The tutor was told to
 * draw back a learner who was mid-argument; its four replies had nothing in
 * common, because there was no shared situation behind them, and the
 * figure-recovery guesser scored 0 of 4 on that move as a result.
 */

import { createTutorStubQuietDetectorState, detectTutorStubQuietState } from './tutorStubQuietDetector.js';

export const TUTOR_STUB_CARD_FORCE_GATE_VERSION = 'cfg-v1';

const QUIET_PREFIX = 'quiet:';

/**
 * Parse TUTOR_STUB_CARD_FORCE.
 *
 * - `9=settled_claim` pins that card to turn 9, as before.
 * - `5+=quiet:flat` waits: the first turn from 5 onward where she really is
 *   flat. Only quiet cards may wait, since only they name a state to wait for.
 */
export function parseCardForceSchedule(raw) {
  if (!raw) return { map: null, waits: null };
  const map = new Map();
  const waits = [];
  for (const part of String(raw).split(',')) {
    const [lhs, card] = part.split('=').map((x) => x.trim());
    if (!lhs || !card) continue;
    if (lhs.endsWith('+')) {
      const from = Number(lhs.slice(0, -1));
      if (!Number.isFinite(from)) continue;
      if (!card.startsWith(QUIET_PREFIX)) {
        throw new Error(
          `TUTOR_STUB_CARD_FORCE: only ${QUIET_PREFIX}* cards can wait for an occasion, got '${part.trim()}'. ` +
            'The move cards name a tactic the tutor takes, so they pin to a turn.',
        );
      }
      waits.push({ from, card });
      continue;
    }
    const turn = Number(lhs);
    if (Number.isFinite(turn)) map.set(turn, card);
  }
  waits.sort((a, b) => a.from - b.from);
  return { map: map.size ? map : null, waits: waits.length ? waits : null };
}

/**
 * The gate judges her state from the running length the quiet detector keeps.
 * With the detector switched off that history stays empty, so every quiet card
 * would be withheld and the arm would run empty without saying so. Refuse the
 * combination instead: turn the detector on, or set the gate to 0 on purpose.
 */
export function assertQuietGateFeasible({ map, waits, quietDetectorEnabled, gateOn }) {
  if (!gateOn || quietDetectorEnabled) return;
  const ordered = [...(waits || []).map((w) => w.card), ...(map ? map.values() : [])];
  const quiet = ordered.find((card) => card.startsWith(QUIET_PREFIX));
  if (!quiet) return;
  throw new Error(
    `TUTOR_STUB_CARD_FORCE orders '${quiet}', but TUTOR_STUB_QUIET_DETECTOR is off, so there is no ` +
      'reading of her state to check it against. Set TUTOR_STUB_QUIET_DETECTOR=1, or ' +
      'TUTOR_STUB_CARD_FORCE_QUIET_GATE=0 to ship the card unchecked as the older arms did.',
  );
}

/**
 * Read her real quiet state without spending a turn of the length history.
 * The history advances on the card-silent path in the caller, so the gate must
 * only look — otherwise a scheduled turn would shift every later average.
 */
export function peekQuietState({ state, learnerText }) {
  state.quietDetector = state.quietDetector || createTutorStubQuietDetectorState();
  const peek = { ...state.quietDetector, lengths: [...state.quietDetector.lengths] };
  return detectTutorStubQuietState(peek, learnerText, {
    pressure: state.mannerSwitch?.lastAdvance?.pressure || null,
  }).type;
}

/**
 * What does the schedule order this turn? Returns null when the turn carries
 * no order. `withheld: true` means a quiet card came due but she is not in that
 * state, so it does not ship and the natural card stands.
 */
export function resolveCardForce({ state, learnerText, tutorTurn, map, waits, gateOn = true }) {
  const gateQuiet = (forced, waited) => {
    const wanted = forced.startsWith(QUIET_PREFIX) ? forced.slice(QUIET_PREFIX.length) : null;
    if (!wanted || !gateOn) {
      return { forced, withheld: false, observedQuietState: null, gated: false, waited };
    }
    const observedQuietState = peekQuietState({ state, learnerText });
    return {
      forced,
      withheld: observedQuietState !== wanted,
      observedQuietState,
      gated: true,
      waited,
    };
  };
  // A waiting order fires on the first turn from its start where she really is
  // in that state, then retires. Waits are checked before pinned turns so one
  // run can carry both kinds.
  if (waits) {
    state.cardForceWaitsFired = state.cardForceWaitsFired || new Set();
    for (let i = 0; i < waits.length; i += 1) {
      if (state.cardForceWaitsFired.has(i)) continue;
      if (tutorTurn < waits[i].from) continue;
      const resolved = gateQuiet(waits[i].card, true);
      // Still waiting is not the same as withheld: nothing was ordered for
      // this turn, so nothing is recorded and the order stays live.
      if (resolved.withheld) continue;
      state.cardForceWaitsFired.add(i);
      return resolved;
    }
  }
  if (map && map.has(tutorTurn)) return gateQuiet(map.get(tutorTurn), false);
  return null;
}
