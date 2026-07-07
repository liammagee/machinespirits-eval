/**
 * stall-clock-surfing-v2 — ablation of MODE 2 (the pre-T_w stall-clock
 * simulation). Repairs ONLY from T_w onward (eager, intact-path premises
 * first, identical to v1's MODE 1); BEFORE T_w it never repairs and
 * suppresses the base mock's incidental lastRelease consolidate-repair.
 *
 * Purpose: v1 inverted the hypothesis (0.869 vs same-turn-release-repair's
 * 0.615 at 15.7% of the repairs). This ablation isolates whether v1's rare
 * danger-triggered pre-T_w repairs are load-bearing (v2 craters on stalls
 * pre-T_w, since stopOnStall ends the run) or whether the whole win is
 * endgame eagerness. Releases untouched; deterministic; ctx.seed unused.
 */

export const name = 'stall-clock-surfing-v2';
export const description =
  'Ablation: eager repair from T_w only, ZERO pre-T_w repairs (incidental repairs suppressed); plain learner.';

export function makeRoles(world, helpers, _ctx) {
  const scheduledPaths = world.proofPaths.filter((p) =>
    p.premises.every((id) => world.releaseSchedule.some((e) => e.premise === id)),
  );
  const pathMaxReleaseTurn = (p) =>
    Math.max(
      ...p.premises.map((id) =>
        Math.max(...world.releaseSchedule.filter((e) => e.premise === id).map((e) => e.turn)),
      ),
    );
  let T_w = Infinity;
  let intactPathSet = new Set();
  for (const p of scheduledPaths) {
    const t = pathMaxReleaseTurn(p);
    if (t < T_w) {
      T_w = t;
      intactPathSet = new Set(p.premises);
    }
  }

  const base = helpers.makeMockTutor(world);

  const tutor = async (view) => {
    const out = await base(view);
    const decayed = view.corruption?.decayed ?? [];
    if (view.turn >= T_w && decayed.length) {
      const pick = decayed.filter((d) => intactPathSet.has(d.premiseId))[0] ?? decayed[0];
      out.move = { ...out.move, targetPremise: pick.premiseId, intent: 'repair' };
    } else {
      out.move = { ...out.move, targetPremise: null };
    }
    return out; // out.release untouched
  };

  return {
    director: helpers.makeMockDirector(world),
    tutor,
    learner: helpers.makeMockLearner(),
  };
}
