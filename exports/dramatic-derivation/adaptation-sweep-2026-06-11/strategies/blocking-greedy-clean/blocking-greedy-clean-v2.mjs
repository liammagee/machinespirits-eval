/**
 * blocking-greedy-clean-v2 ("shield/hold" refinement) — single-diff variant
 * of blocking-greedy-clean that tests the design's secondary prediction:
 * that the clean branch's repairs of harmless premises FREE decay slots
 * which then re-bite criticals (maxConcurrent caps ACTIVE decays, so a
 * permanently-decayed harmless premise jams a slot for the whole run).
 *
 * Diff vs v1 (ONLY change): when the decayed set does NOT block the
 * scheduled eventual proof of the secret, return the base tutor output
 * unchanged (hold — leave harmless decay in place to jam slots) instead of
 * repairing the oldest decayed. Blocked branch identical to v1.
 * Note: holding keeps the plain mock's incidental consolidate-repair channel
 * (targetPremise = lastRelease on non-release turns), same as the s00 floor.
 *
 * Roles identical to v1: plain mock director, plain mock learner (no
 * readopt), wrapper over plain mock tutor. Deterministic, ctx.seed unused.
 */

export const name = 'blocking-greedy-clean-v2';
export const description =
  'Shield/hold variant: repair only when the decayed set blocks the scheduled eventual proof (same single-restore-first targeting as v1); otherwise leave harmless decay in place to jam decay slots.';

export function makeRoles(world, helpers, _ctx) {
  const SCHED = [...new Set(world.releaseSchedule.map((e) => e.premise))];
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
    const D = (view.corruption?.decayed ?? [])
      .filter((d) => d.premiseId)
      .sort(
        (a, b) =>
          a.sinceTurn - b.sinceTurn ||
          (a.premiseId < b.premiseId ? -1 : a.premiseId > b.premiseId ? 1 : 0),
      );
    if (D.length === 0) return out;
    const ids = D.map((d) => d.premiseId);

    if (!blocked(ids)) return out; // HOLD: jam decay slots with harmless decay

    const singles = ids.filter((id) => !blocked(ids.filter((x) => x !== id)));
    const pick = singles[0] ?? ids.find((id) => PATHREL.has(id)) ?? ids[0];
    out.move = { ...out.move, targetPremise: pick, intent: 'repair' };
    return out; // out.release NEVER touched — the schedule stays frozen
  };

  return { director, tutor, learner };
}
