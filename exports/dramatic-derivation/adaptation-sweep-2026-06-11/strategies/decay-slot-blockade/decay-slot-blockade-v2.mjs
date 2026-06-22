export const name = 'decay-slot-blockade-v2';
export const description =
  'v1 blockade + BREATHING REPAIRS: never repair a freshly-decayed premise (age >= 2 only), so every decay event shows a one-turn visible dip in groundedCount before recovery — the recovery is a growth pair (resets disengagement) and a D decrease (resets aporia). Diagnosis: 191/312 v1 failures were early stall-detector kills caused by same/next-turn repairs restoring facts BEFORE the learner measurement (invisible churn, flat trajectory). Identical sacrifice set, ordering, else-null guard, plain learner.';

import { computeBlockade } from './decay-slot-blockade.mjs';

export { computeBlockade };

export function makeRoles(world, helpers, _ctx) {
  const { S, intactMembers } = computeBlockade(world, helpers);
  const base = helpers.makeMockTutor(world); // plain base — repair policy lives entirely in the wrapper

  const tutor = async (view) => {
    const out = await base(view);
    const decayed = view.corruption?.decayed ?? [];
    // v2 delta: age filter — a premise decayed at end of turn t is visible
    // from t+1 (age 1, HOLD: let the dip register in the trajectory) and
    // repaired from t+2 (age >= 2). Everything else is v1: never repair a
    // sacrifice; intact-path members first; oldest decay first; list order.
    const repairables = decayed
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => !S.has(d.premiseId) && view.turn - d.sinceTurn >= 2)
      .sort((a, b) => {
        const ap = intactMembers.has(a.d.premiseId) ? 0 : 1;
        const bp = intactMembers.has(b.d.premiseId) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        if (a.d.sinceTurn !== b.d.sinceTurn) return a.d.sinceTurn - b.d.sinceTurn;
        return a.i - b.i;
      })
      .map(({ d }) => d);

    if (repairables.length) {
      out.move = { ...out.move, targetPremise: repairables[0].premiseId, intent: 'repair' };
    } else {
      // Same MANDATORY guard as v1, now also covering hold turns (all decayed
      // are sacrifices or fresh): the base consolidate branch targets
      // lastRelease, which could be exactly the freshly-decayed premise we
      // are deliberately letting dip.
      out.move = { ...out.move, targetPremise: null };
    }
    return out; // NEVER touch out.release — the schedule stays frozen
  };

  return {
    director: helpers.makeMockDirector(world),
    tutor,
    learner: helpers.makeMockLearner(), // plain — REQUIRED (see v1)
  };
}
