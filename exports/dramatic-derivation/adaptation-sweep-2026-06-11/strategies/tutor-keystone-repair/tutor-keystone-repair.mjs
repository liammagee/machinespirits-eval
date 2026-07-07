/**
 * tutor-keystone-repair — tutor-only repair policy with same-turn release+repair,
 * win-now closure targeting, and keystone (minimum proof support) prioritisation.
 *
 * Design (verbatim from the designing agent):
 *   - director = plain helpers.makeMockDirector(world)
 *   - learner  = plain helpers.makeMockLearner() — NO readoptForgotten, so every
 *     recovery is tutor-channel only (isolates the tutor channel)
 *   - tutor    = wrapper over plain helpers.makeMockTutor(world) (NOT repairDecayed):
 *       out = await base(view); decayed = view.corruption?.decayed ?? []
 *       if no decayed: return out unchanged (refreshing a live premise is a no-op)
 *       Step 1 WIN-NOW : scan decayed in array order; target the first d where
 *                        closure([...board, ...justReleased, d.fact], rules) ∋ S
 *                        (justReleased = the tutor's own out.release this turn, if any
 *                         — per spec, a same-turn DIRECTOR release is NOT included)
 *       Step 2 KEYSTONE: else target the decayed premise with premiseId in T having
 *                        smallest sinceTurn (tie: decayed-array order)
 *       Step 3 OLDEST  : else the oldest decayed (smallest sinceTurn, tie: array order)
 *       out.move = { ...(out.move||{}), figure: out.move?.figure || 'anaphora',
 *                    targetPremise: target, intent: 'repair' }
 *       out.release is NEVER touched — release and targetPremise are processed
 *       independently by the engine, so same-turn release+repair is legal and the
 *       schedule stays frozen.
 *
 *   T (keystone set) = first minimum-size subset of releasedIds (schedule premises
 *   sorted by turn; sizes ascending, subsets in lexicographic index order) whose
 *   facts + world.background close (helpers.closure) to contain factKey(secret).
 *
 * Determinism: no randomness anywhere (ctx.seed deliberately unused).
 * T depends only on the frozen world object, so it is cached per world via a
 * WeakMap — byte-identical behavior to recomputing inside every makeRoles call
 * (the harness reuses one world object per world across all runs).
 */

export const name = 'tutor-keystone-repair';
export const description =
  'Tutor-only repair: same-turn release+repair, win-now closure targeting, keystone (min proof support) priority, else oldest decayed. Plain learner (no readopt).';

const keystoneCache = new WeakMap();

/**
 * First minimum-size subset of the scheduled premises whose facts + background
 * entail the secret. Sizes ascending; within a size, subsets in lexicographic
 * index order over releasedIds (schedule order = sorted by turn).
 */
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
    // lexicographic combinations of indices [0..n-1] of size k
    const idx = Array.from({ length: k }, (_, i) => i);
    for (;;) {
      const subset = idx.map((i) => releasedIds[i]);
      const base = [...subset.map(factOf), ...world.background];
      if (closure(base, world.rules).facts.has(secretKey)) {
        return new Set(subset);
      }
      let pos = k - 1;
      while (pos >= 0 && idx[pos] === n - k + pos) pos -= 1;
      if (pos < 0) break;
      idx[pos] += 1;
      for (let j = pos + 1; j < k; j += 1) idx[j] = idx[j - 1] + 1;
    }
  }
  // Unreachable for lint-clean worlds (full schedule must entail S); empty set
  // degrades the policy to win-now + oldest-decayed.
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

  const tutor = async (view) => {
    const out = await base(view);
    const decayed = view.corruption?.decayed ?? [];
    if (!decayed.length) return out; // nothing to repair; refreshing live premises is a no-op

    const boardFacts = view.learnerAbox.grounded;
    const justReleased = out.release ? [world.premiseById.get(out.release).fact] : [];

    // Step 1 WIN-NOW: first decayed d (array order) whose restoration makes the
    // learner's closure (board + tutor's just-released fact + d) contain S.
    let target = null;
    for (const d of decayed) {
      if (closure([...boardFacts, ...justReleased, d.fact], world.rules).facts.has(secretKey)) {
        target = d.premiseId;
        break;
      }
    }

    // Step 2 KEYSTONE: decayed premise in T with smallest sinceTurn (tie: array order).
    if (!target) {
      let best = null;
      for (const d of decayed) {
        if (T.has(d.premiseId) && (best === null || d.sinceTurn < best.sinceTurn)) best = d;
      }
      if (best) target = best.premiseId;
    }

    // Step 3 OLDEST: smallest sinceTurn overall (tie: array order).
    if (!target) {
      let best = null;
      for (const d of decayed) {
        if (best === null || d.sinceTurn < best.sinceTurn) best = d;
      }
      target = best.premiseId;
    }

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
