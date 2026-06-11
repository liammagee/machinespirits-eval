export const name = 'decay-slot-blockade';
export const description =
  'Tutor precomputes a derivation-irrelevant sacrifice set S (greedy, schedule order, keeping one fully-scheduled proof path intact) and PERMANENTLY refuses to repair S: decayed sacrifices are absorbing states that saturate the maxConcurrent slots, starving the decay process. Repairs (every turn, release turns included) go only to non-sacrifice premises, intact-path members first, oldest decay first. No-repairable turns force move.targetPremise=null to stop the plain base consolidate branch from accidentally repairing a fresh sacrifice. Plain learner (REQUIRED: readopt would dismantle the blockade). Director plain; deterministic, ctx.seed unused.';

/**
 * INIT (exported for verification): compute the blockade sacrifice set S and
 * the repair-priority class (members of scheduled proof paths left intact).
 * The tutor legitimately closes over the world — it holds the plot.
 *
 *   released   = unique premise ids of world.releaseSchedule in schedule order
 *   derivable(removed) = closure(background + released \ removed) |- secret
 *   scheduledPaths     = proofPaths fully covered by the schedule (NOT
 *                        premiseById — e.g. nocturne's ink path is authored
 *                        but never released)
 *   intact(removed)    = some scheduledPath disjoint from removed
 *   greedy: for id of released (earliest first, so slots fill soonest):
 *           if derivable(S+id) && intact(S+id) then S.add(id)
 */
export function computeBlockade(world, helpers) {
  const seen = new Set();
  const released = [];
  for (const entry of world.releaseSchedule) {
    if (!seen.has(entry.premise)) {
      seen.add(entry.premise);
      released.push(entry.premise);
    }
  }
  const factOf = (id) => world.premiseById.get(id).fact;
  const secretKey = helpers.factKey(world.secret.fact);
  const derivable = (removedSet) =>
    helpers
      .closure(
        [...world.background, ...released.filter((id) => !removedSet.has(id)).map(factOf)],
        world.rules,
      )
      .facts.has(secretKey);
  const scheduledPaths = world.proofPaths.filter((p) => p.premises.every((id) => released.includes(id)));
  const intact = (removedSet) => scheduledPaths.some((p) => p.premises.every((id) => !removedSet.has(id)));

  const S = new Set();
  for (const id of released) {
    const trial = new Set([...S, id]);
    if (derivable(trial) && intact(trial)) S.add(id);
  }

  // Repair-priority class: members of scheduled proof paths that the final S
  // leaves fully intact (by construction disjoint from S).
  const intactMembers = new Set();
  for (const p of scheduledPaths) {
    if (p.premises.every((id) => !S.has(id))) {
      for (const id of p.premises) intactMembers.add(id);
    }
  }
  return { S, intactMembers, released, scheduledPaths };
}

export function makeRoles(world, helpers, _ctx) {
  const { S, intactMembers } = computeBlockade(world, helpers);
  const base = helpers.makeMockTutor(world); // plain base — repair policy lives entirely in the wrapper

  const tutor = async (view) => {
    const out = await base(view);
    const decayed = view.corruption?.decayed ?? [];
    // Never repair a sacrifice: filter S out, then order intact-path members
    // first, then oldest decay (sinceTurn ascending), then list order.
    const repairables = decayed
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => !S.has(d.premiseId))
      .sort((a, b) => {
        const ap = intactMembers.has(a.d.premiseId) ? 0 : 1;
        const bp = intactMembers.has(b.d.premiseId) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        if (a.d.sinceTurn !== b.d.sinceTurn) return a.d.sinceTurn - b.d.sinceTurn;
        return a.i - b.i;
      })
      .map(({ d }) => d);

    if (repairables.length) {
      // Release turns INCLUDED — folds in same-turn release+repair.
      out.move = { ...out.move, targetPremise: repairables[0].premiseId, intent: 'repair' };
    } else {
      // MANDATORY blockade guard: the plain base's consolidate branch targets
      // lastRelease, which would accidentally repair a freshly-decayed
      // sacrifice (e.g. nocturne's m_guest just after its release). null is a
      // legal move shape (the base's own orient branch emits it; the engine
      // guards with tutorOut.move?.targetPremise).
      out.move = { ...out.move, targetPremise: null };
    }
    return out; // NEVER touch out.release — the schedule stays frozen
  };

  return {
    director: helpers.makeMockDirector(world),
    tutor,
    // Plain learner REQUIRED, not just preferred: readoptForgotten diffs its
    // memory against the board and re-adopts sacrificed premises every turn,
    // re-validating them and dismantling the blockade (and it ceilings at
    // 1.000 anyway). The plain learner never re-adopts, so sacrifices stay
    // decayed and the slots stay occupied.
    learner: helpers.makeMockLearner(),
  };
}
