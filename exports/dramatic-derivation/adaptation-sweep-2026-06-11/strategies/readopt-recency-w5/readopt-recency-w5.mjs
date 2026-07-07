/**
 * readopt-recency-w5 — recency-windowed learner self-repair (w = 5 turns).
 *
 * Wraps the s02 ideal readopt learner with a 5-turn recency window: a
 * re-adoption (self-repair of a decayed fact) is only KEPT if the fact was
 * last "heard" within the last 5 turns. Hearing = release witnessed in
 * releasedThisTurn, first adoption, a KEPT re-adoption, or witnessed
 * reappearance on the board after a tutor repair (tracked via missingPrev).
 * A dropped re-adoption does NOT refresh lastHeard — the slip becomes
 * permanently unrepairable by the learner unless a later tutor repair
 * re-surfaces the fact and it re-slips within the window.
 *
 * Hypothesis under test: the window INVERTS the decay-rate gradient
 * (rate-1.0 slips arrive fresh and are caught; rate-0.15 slips arrive stale
 * and die permanently) — the context-window analogy for real LLM learners.
 *
 * Cast: plain mock director + PLAIN mock tutor (no repairDecayed policy;
 * only the incidental consolidate-targets-lastRelease repair) + wrapped
 * makeMockLearner({readoptForgotten: true}).
 *
 * View-only learner: reads nothing but its view; helpers used are factKey
 * and closure (pure functions). Fully deterministic — no randomness at all.
 *
 * IMPLEMENTATION NOTE vs the design spec: the engine's learner-output
 * contract is `adopt` (array of facts) and `asserts` (a SINGLE fact or
 * null) — the spec text wrote `out.adopts` and an array-filter on
 * `out.asserts`. Faithful translation: classify/filter `out.adopt`, and on
 * any drop, null `out.asserts` unless its factKey is in the closure of
 * [...view.abox.grounded, ...keptAdopts] under view.rules (same semantics,
 * single-fact channel). Everything else is implemented exactly as specified.
 */

const WINDOW = 5;

export const name = 'readopt-recency-w5';
export const description =
  'Learner self-repair gated by a 5-turn recency window: re-adopt a slipped fact only if last heard (release/adopt/kept-readopt/witnessed tutor repair) within 5 turns; stale slips die permanently. Plain tutor.';

export function makeRoles(world, helpers, ctx) { // eslint-disable-line no-unused-vars
  const director = helpers.makeMockDirector(world);
  const tutor = helpers.makeMockTutor(world); // PLAIN — no repairDecayed policy
  const base = helpers.makeMockLearner({ readoptForgotten: true });

  // Wrapper state — fresh per makeRoles call (one run).
  const everAdopted = new Set(); // factKey
  const lastHeard = new Map(); // factKey -> turn
  let missingPrev = new Set(); // factKeys seen missing as of the previous call

  const learner = async (view) => {
    const fk = helpers.factKey;
    // (1) base output first
    const out = await base(view);

    // (2) refresh hearing BEFORE filtering
    for (const f of view.releasedThisTurn ?? []) {
      lastHeard.set(fk(f), view.turn);
    }
    const boardKeys = new Set((view.abox.grounded ?? []).map(fk));
    for (const k of missingPrev) {
      // witnessed reappearance (a tutor repair re-surfaced the fact) counts
      // as re-hearing
      if (boardKeys.has(k)) lastHeard.set(k, view.turn);
    }

    // (3) classify each adopt; (4) recency policy on re-adopt candidates
    const keptAdopts = [];
    let droppedAny = false;
    for (const a of out.adopt ?? []) {
      const k = fk(a);
      if (!everAdopted.has(k)) {
        // FIRST adopt — always keep
        everAdopted.add(k);
        lastHeard.set(k, view.turn);
        keptAdopts.push(a);
      } else if (view.turn - (lastHeard.get(k) ?? -Infinity) <= WINDOW) {
        // RE-adopt within the window — keep, and the keep refreshes hearing
        lastHeard.set(k, view.turn);
        keptAdopts.push(a);
      } else {
        // stale slip — drop; do NOT update lastHeard
        droppedAny = true;
      }
    }

    // (5) on any drop, recompute the assert against the REAL post-adopt board
    if (droppedAny) {
      const closureKeys = helpers.closure(
        [...(view.abox.grounded ?? []), ...keptAdopts],
        view.rules,
      ).facts; // Map keyed by factKey
      if (out.asserts && !closureKeys.has(fk(out.asserts))) {
        out.asserts = null;
      }
    }
    out.adopt = keptAdopts;

    // (6) end of call: facts we once adopted, not on the (pre-adopt) board,
    // and not re-adopted this turn — candidates for witnessed reappearance
    const keptKeys = new Set(keptAdopts.map(fk));
    const nextMissing = new Set();
    for (const k of everAdopted) {
      if (!boardKeys.has(k) && !keptKeys.has(k)) nextMissing.add(k);
    }
    missingPrev = nextMissing;

    return out;
  };

  return { director, tutor, learner };
}
