/**
 * ref-same-turn-release-repair — the comparison baseline for the
 * stall-clock-surfing parsimony hypothesis. Verbatim the verified wrapper
 * pattern: repair the oldest decayed premise EVERY turn, including release
 * turns (same-turn release+repair — the contention the plain repairDecayed
 * mock forgoes, which is why s01 caps ~0.49). Plain learner, releases
 * untouched, deterministic.
 */

export const name = 'ref-same-turn-release-repair';
export const description =
  'Reference: tutor repairs decayed[0] every turn including release turns (same-turn release+repair); plain learner.';

export function makeRoles(world, helpers, _ctx) {
  const base = helpers.makeMockTutor(world);
  const tutor = async (view) => {
    const out = await base(view);
    const decayed = view.corruption?.decayed ?? [];
    if (decayed.length) {
      out.move = { ...out.move, targetPremise: decayed[0].premiseId, intent: 'repair' };
    }
    return out; // NEVER touch out.release — the schedule stays frozen
  };
  return {
    director: helpers.makeMockDirector(world),
    tutor,
    learner: helpers.makeMockLearner(),
  };
}
