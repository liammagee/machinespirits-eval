/**
 * tutor-keystone-repair-v2 — v1 + "stall-wiggle" + director-aware win-now.
 *
 * Why v2 exists (the v1 falsification it tests): at rate 1.0 / grace 0 the
 * speak-time decay pool is policy-invariant (the designer was right), but the
 * VERDICT channel is not. detectStall's disengagement test looks for a strict
 * groundedCount INCREASE between consecutive in-window turns. An always-repair
 * tutor pins groundedCount at its per-turn maximum — a FLAT line — so any
 * release gap >= aporia_window kills the drama (v1's smoke|maxC2 death at t7,
 * one turn before the winning t8 release). A tutor that deliberately SKIPS a
 * repair on one turn (dip) and repairs the next (recovery) manufactures a
 * growth pair, and the D wiggle (up on skip, down on repair) defeats the
 * aporia test the same way. Between releases at grace 0 / high rate a repair
 * has NO lasting board effect (it re-decays the same end-of-turn), so the
 * skip costs nothing precisely in the regime where it is needed.
 *
 * Deltas from v1 (everything else byte-identical in spirit):
 *   1. WIN-NOW includes the director's same-turn release (visible in
 *      view.ledger at view.turn) alongside the tutor's own out.release —
 *      the learner adopts BOTH before asserting this turn.
 *   2. WIGGLE GATE: on a non-release turn with no win-now, if the premise we
 *      repaired LAST turn is already decayed again with sinceTurn = lastTurn
 *      (the repairs-don't-stick signature: grace 0 x high rate), SKIP this
 *      turn's repair (targetPremise: null) — alternation resumes next turn.
 *      Releases this turn always repair (same-turn release+repair is free).
 *
 * Roles otherwise unchanged: plain mock director, plain mock learner (NO
 * readopt — tutor-channel-only recovery), keystone set T per v1 spec.
 * Deterministic; no randomness; out.release never touched.
 */

export const name = 'tutor-keystone-repair-v2';
export const description =
  'v1 keystone repair + stall-wiggle (skip repair after an instant re-decay to manufacture groundedCount growth pairs) + director-aware win-now.';

const keystoneCache = new WeakMap();

function computeKeystoneSet(world, helpers) {
  const { closure, factKey } = helpers;
  const secretKey = factKey(world.secret.fact);
  const releasedIds = [];
  const seen = new Set();
  for (const entry of [...world.releaseSchedule].sort((a, b) => a.turn - b.turn)) {
    if (!seen.has(entry.premise)) {
      seen.add(entry.premise);
      releasedIds.push(entry.premise);
    }
  }
  const factOf = (id) => world.premiseById.get(id).fact;
  const n = releasedIds.length;
  for (let k = 1; k <= n; k += 1) {
    const idx = Array.from({ length: k }, (_, i) => i);
    for (;;) {
      const subset = idx.map((i) => releasedIds[i]);
      if (closure([...subset.map(factOf), ...world.background], world.rules).facts.has(secretKey)) {
        return new Set(subset);
      }
      let pos = k - 1;
      while (pos >= 0 && idx[pos] === n - k + pos) pos -= 1;
      if (pos < 0) break;
      idx[pos] += 1;
      for (let j = pos + 1; j < k; j += 1) idx[j] = idx[j - 1] + 1;
    }
  }
  return new Set();
}

export function makeRoles(world, helpers, _ctx) {
  const { factKey, closure } = helpers;
  let T = keystoneCache.get(world);
  if (!T) {
    T = computeKeystoneSet(world, helpers);
    keystoneCache.set(world, T);
  }
  const secretKey = factKey(world.secret.fact);
  const base = helpers.makeMockTutor(world); // plain — NOT repairDecayed

  // wiggle state (per run — makeRoles is called fresh per run)
  let lastRepairTurn = null;
  let lastRepairTarget = null;

  const tutor = async (view) => {
    const out = await base(view);
    const decayed = view.corruption?.decayed ?? [];
    if (!decayed.length) return out;

    const boardFacts = view.learnerAbox.grounded;
    // Same-turn releases the learner will adopt before asserting: the tutor's
    // own (out.release) AND the director's (already in the ledger at this turn).
    const directorReleasedNow = view.ledger
      .filter((l) => l.turn === view.turn && l.via === 'director')
      .map((l) => world.premiseById.get(l.premiseId).fact);
    const justReleased = [
      ...(out.release ? [world.premiseById.get(out.release).fact] : []),
      ...directorReleasedNow,
    ];
    const releaseThisTurn = Boolean(out.release) || directorReleasedNow.length > 0;

    // Step 1 WIN-NOW (array order over decayed)
    let target = null;
    let winNow = false;
    for (const d of decayed) {
      if (closure([...boardFacts, ...justReleased, d.fact], world.rules).facts.has(secretKey)) {
        target = d.premiseId;
        winNow = true;
        break;
      }
    }

    // WIGGLE GATE: non-release turn, no win-now, and last turn's repair
    // bounced straight back into the pool -> skip (dip) so next turn's repair
    // registers as groundedCount growth. Must null the base's incidental
    // consolidate target so the skip is a true no-repair turn.
    if (!winNow && !releaseThisTurn && lastRepairTurn === view.turn - 1) {
      const bounced = decayed.some((d) => d.premiseId === lastRepairTarget && d.sinceTurn === view.turn - 1);
      if (bounced) {
        out.move = {
          ...(out.move || {}),
          figure: out.move?.figure || 'anaphora',
          targetPremise: null,
          intent: 'observe',
        };
        return out;
      }
    }

    // Step 2 KEYSTONE: decayed premise in T with smallest sinceTurn (tie: array order)
    if (!target) {
      let best = null;
      for (const d of decayed) {
        if (T.has(d.premiseId) && (best === null || d.sinceTurn < best.sinceTurn)) best = d;
      }
      if (best) target = best.premiseId;
    }

    // Step 3 OLDEST
    if (!target) {
      let best = null;
      for (const d of decayed) {
        if (best === null || d.sinceTurn < best.sinceTurn) best = d;
      }
      target = best.premiseId;
    }

    lastRepairTurn = view.turn;
    lastRepairTarget = target;
    out.move = {
      ...(out.move || {}),
      figure: out.move?.figure || 'anaphora',
      targetPremise: target,
      intent: 'repair',
    };
    return out; // out.release untouched — the frozen channel stays frozen
  };

  return {
    director: helpers.makeMockDirector(world),
    tutor,
    learner: helpers.makeMockLearner(), // plain — tutor-channel-only recovery
  };
}
