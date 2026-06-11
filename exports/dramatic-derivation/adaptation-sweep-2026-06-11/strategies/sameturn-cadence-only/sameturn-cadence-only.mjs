/**
 * sameturn-cadence-only
 *
 * Delta vs s01-tutor-repair is CADENCE ONLY. s01's repairDecayed base checks
 * its tutor-release branch first and forgoes repair on tutor-release turns;
 * this wrapper repairs on EVERY turn that shows decay, including release
 * turns (legal same-turn release+repair: out.release stays exactly the
 * scheduled premise — only move.targetPremise is repointed, and the engine
 * processes the two fields independently).
 *
 * Target selection is deliberately identical to s01: view.corruption.decayed[0]
 * in the engine's array order (grounded-map insertion = adoption order =
 * release order) — NOT sorted by sinceTurn, because mockRoles.js repairDecayed
 * also takes decayed[0]. The ONLY behavioural difference is cadence.
 *
 * Cast: director = makeMockDirector(world); learner = plain makeMockLearner()
 * (no readoptForgotten / adoptLag / stallAfter — the learner that does not
 * self-repair); tutor = wrapper over plain makeMockTutor(world) (NOT
 * repairDecayed). Fully deterministic; ctx.seed unused.
 *
 * Note on non-release turns: the plain base lands in its consolidate branch
 * (or orient on turn 1); the wrapper then overrides move.targetPremise to
 * decayed[0] with intent 'repair' — mechanically the same repair the s01
 * repairDecayed branch would emit (dialogue text differs; the mock learner
 * never reads it).
 */
export const name = 'sameturn-cadence-only';
export const description =
  'Tutor wrapper over the PLAIN mock: whenever decay is visible, point move.targetPremise at decayed[0] (engine array order) every turn incl. release turns; never touch out.release. Plain learner. Isolates repair cadence vs s01.';

export function makeRoles(world, helpers) {
  const base = helpers.makeMockTutor(world); // plain — NOT repairDecayed
  const tutor = async (view) => {
    const out = await base(view);
    const d = view.corruption?.decayed ?? [];
    if (d.length && d[0].premiseId) {
      out.move = { ...out.move, targetPremise: d[0].premiseId, intent: 'repair' };
    }
    return out; // NEVER touch out.release — the schedule stays frozen
  };
  return {
    director: helpers.makeMockDirector(world),
    tutor,
    learner: helpers.makeMockLearner(), // plain: no options
  };
}
