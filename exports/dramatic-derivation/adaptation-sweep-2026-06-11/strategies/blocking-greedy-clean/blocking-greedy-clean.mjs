/**
 * blocking-greedy-clean — derivation-critical repair target selection.
 *
 * Tutor-side strategy. Per turn, if any premises are decayed:
 *   - If the decayed set BLOCKS the scheduled eventual proof of the secret
 *     (exact closure test over the scheduled universe only — background +
 *     scheduled premise facts; never-scheduled authored premises excluded),
 *     repair the single premise whose restoration alone unblocks it
 *     (deterministic first by sinceTurn asc, premiseId asc); if no single
 *     premise unblocks, fall back to the first decayed premise on any
 *     scheduled proof path, then to the oldest decayed.
 *   - Else (proof not blocked): greedy clean-up — repair the oldest decayed.
 * Release channel untouched (out.release never modified): same-turn
 * release+repair is exercised on release turns via move.targetPremise.
 *
 * Roles: director = plain mock; learner = plain mock (NO readopt — so the
 * tutor's target selection carries the whole repair load); tutor = wrapper
 * over the plain mock tutor (no repairDecayed policy).
 * Deterministic: ctx.seed unused, no randomness anywhere.
 */

export const name = 'blocking-greedy-clean';
export const description =
  'Tutor repairs whichever decayed premise blocks the scheduled eventual proof of the secret (exact closure test, single-restore preference), greedy oldest-first cleanup otherwise; plain mock learner and director.';

export function makeRoles(world, helpers, _ctx) {
  // ---- precompute (tutor/director are omniscient; the learner below never
  // touches `world`) -------------------------------------------------------
  const SCHED = [...new Set(world.releaseSchedule.map((e) => e.premise))];
  // Scheduled universe ONLY: authored-but-never-scheduled premises (e.g.
  // nocturne's alternates) must not make truly-critical premises look
  // redundant.
  const EVENTUAL = [...world.background, ...SCHED.map((id) => world.premiseById.get(id).fact)];
  const SECRET = helpers.factKey(world.secret.fact);
  const has = (facts) => helpers.closure(facts, world.rules).facts.has(SECRET);
  const blocked = (ids) => {
    const dk = new Set(ids.map((id) => helpers.factKey(world.premiseById.get(id).fact)));
    return !has(EVENTUAL.filter((f) => !dk.has(helpers.factKey(f))));
  };
  const PATHREL = new Set(
    world.proofPaths.flatMap((p) => p.premises).filter((id) => SCHED.includes(id)),
  );

  const director = helpers.makeMockDirector(world);
  const learner = helpers.makeMockLearner(); // plain: no options, no self-repair
  const base = helpers.makeMockTutor(world); // plain: no repairDecayed policy

  const tutor = async (view) => {
    const out = await base(view);
    // .filter() copies before .sort() — never mutate the view's array.
    const D = (view.corruption?.decayed ?? [])
      .filter((d) => d.premiseId)
      .sort(
        (a, b) =>
          a.sinceTurn - b.sinceTurn ||
          (a.premiseId < b.premiseId ? -1 : a.premiseId > b.premiseId ? 1 : 0),
      );
    if (D.length === 0) return out;
    const ids = D.map((d) => d.premiseId);

    let pick;
    if (blocked(ids)) {
      // Premises whose lone restoration unblocks the eventual proof.
      const singles = ids.filter((id) => !blocked(ids.filter((x) => x !== id)));
      pick = singles[0] ?? ids.find((id) => PATHREL.has(id)) ?? ids[0];
    } else {
      pick = ids[0]; // not blocked: clean everything, oldest first
    }

    out.move = { ...out.move, targetPremise: pick, intent: 'repair' };
    return out; // out.release NEVER touched — the schedule stays frozen
  };

  return { director, tutor, learner };
}
