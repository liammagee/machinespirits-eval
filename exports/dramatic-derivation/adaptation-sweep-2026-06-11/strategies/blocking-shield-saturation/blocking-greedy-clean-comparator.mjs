/**
 * blocking-greedy-clean (COMPARATOR reconstruction) — run only to make the
 * blocking-shield-saturation dominance contrast computable; the original
 * blocking-greedy-clean module/results were not on disk.
 *
 * Identical roles + precomputation to blocking-shield-saturation (SCHED /
 * EVENTUAL / SECRET / blocked() / PATHREL, plain mock director/learner,
 * wrapper over plain mock tutor). Single behavioral delta, exactly the one
 * the shield spec names: in the NOT-BLOCKED branch this variant REPAIRS the
 * oldest decayed premise anyway (keeps the board clean) instead of holding
 * it as a slot-shield. Blocked branch identical (greedy single-repair pick).
 * Deterministic; ctx.seed unused; out.release never touched.
 */

export const name = 'blocking-greedy-clean-comparator';
export const description =
  'Comparator for blocking-shield-saturation: identical blocked-branch greedy repair, but the not-blocked branch repairs the oldest decayed premise (clean) instead of shielding.';

export function makeRoles(world, helpers, ctx) { // eslint-disable-line no-unused-vars
  const { makeMockDirector, makeMockTutor, makeMockLearner, factKey, closure } = helpers;

  const SCHED = world.releaseSchedule.map((e) => e.premise);
  const EVENTUAL = SCHED.map((id) => world.premiseById.get(id).fact);
  const SECRET = world.secret.fact;
  const PATHREL = new Set();
  for (const path of world.proofPaths) {
    for (const id of path.premises) PATHREL.add(id);
  }

  const memo = new Map();
  const blocked = (ids) => {
    const key = [...ids].sort().join('|');
    if (memo.has(key)) return memo.get(key);
    const dead = new Set(ids);
    const facts = [...world.background];
    for (let i = 0; i < SCHED.length; i += 1) {
      if (!dead.has(SCHED[i])) facts.push(EVENTUAL[i]);
    }
    const result = !closure(facts, world.rules).facts.has(factKey(SECRET));
    memo.set(key, result);
    return result;
  };

  const base = makeMockTutor(world);
  const tutor = async (view) => {
    const out = await base(view);
    const D = (view.corruption?.decayed ?? [])
      .filter((d) => d.premiseId)
      .sort(
        (a, b) =>
          a.sinceTurn - b.sinceTurn ||
          (a.premiseId < b.premiseId ? -1 : a.premiseId > b.premiseId ? 1 : 0),
      );
    if (!D.length) return out;
    const ids = D.map((d) => d.premiseId);

    if (blocked(ids)) {
      const singles = ids.filter((id) => !blocked(ids.filter((x) => x !== id)));
      const pick = singles[0] ?? ids.find((id) => PATHREL.has(id)) ?? ids[0];
      out.move = { ...out.move, targetPremise: pick, intent: 'repair' };
    } else {
      // CLEAN branch (the single delta): repair the oldest decayed premise
      // even though the decayed set does not block the eventual derivation.
      out.move = { ...out.move, targetPremise: ids[0], intent: 'repair' };
    }
    return out; // out.release NEVER touched
  };

  return {
    director: makeMockDirector(world),
    tutor,
    learner: makeMockLearner(),
  };
}
