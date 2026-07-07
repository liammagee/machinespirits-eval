export const name = 'same-turn-release-repair';
export const description =
  "s01's tutor (repairDecayed FIFO) + same-turn release+repair: override move.targetPremise with the decayed head on EVERY turn incl. release turns; out.release/out.dialogue untouched, schedule frozen. Learner = plain mock (s01's). Deterministic — ctx.seed unused.";

export function makeRoles(world, helpers, _ctx) {
  // Base policy: identical to s01 — repairDecayed targets the oldest decayed
  // premise on non-release turns. The ONLY behavioral delta added here is that
  // repairs also fire on release turns (the engine processes out.release and
  // move.targetPremise independently, so same-turn release+repair is legal).
  const base = helpers.makeMockTutor(world, { repairDecayed: true });

  const tutor = async (view) => {
    const out = await base(view);
    const decayed = view.corruption?.decayed ?? [];
    if (decayed.length) {
      // decayed[0] = board-insertion-order head — exactly s01's selection rule.
      // On non-release turns this override is idempotent with the base's
      // repairDecayed branch; on release turns it adds the repair the plain
      // mock forgoes. NEVER touch out.release — the schedule stays frozen.
      out.move = { ...out.move, targetPremise: decayed[0].premiseId, intent: 'repair' };
    }
    return out;
  };

  return {
    director: helpers.makeMockDirector(world),
    tutor,
    learner: helpers.makeMockLearner(), // plain — no readoptForgotten, no adoptLag (s01's exact learner)
  };
}
