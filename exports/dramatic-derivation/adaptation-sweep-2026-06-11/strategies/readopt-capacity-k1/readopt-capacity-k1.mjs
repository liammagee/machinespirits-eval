/**
 * readopt-capacity-k1 — throughput-capped self-repair.
 *
 * Hypothesis under test: survival is governed by the headroom (maxC - k),
 * not by the mere presence of repair. Wraps s02's exact learner
 * (makeMockLearner({readoptForgotten:true})) and caps the RE-adoption channel
 * at k = 1 per turn; first adopts always pass. Tutor is the PLAIN s00 mock
 * (no repairDecayed) so the learner channel is isolated.
 *
 * Wrapper state (fresh per makeRoles): everAdopted = Set<factKey>,
 * missingSince = Map<factKey, turn first seen missing>. Per call:
 *   1. out = await base(view)
 *   2. board-diff BEFORE filtering: mark newly-missing everAdopted keys with
 *      view.turn; delete keys visible again (covers incidental tutor repairs
 *      and past readopts).
 *   3. classify each adopted fact: first adopt (always keep, record) vs
 *      re-adopt candidate.
 *   4. keep exactly ONE re-adopt candidate — smallest missingSince (oldest
 *      slip first; missing map entry treated as view.turn; tie-break
 *      ascending factKey string) — drop the rest. The base's own board diff
 *      re-emits dropped slips next turn (no wrapper queue needed).
 *   5. if anything was dropped, anti-lucky-leap: keep out.asserts only if it
 *      is still in closure([...view.abox.grounded, ...keptAdopts], rules).
 *
 * Faithful deviations from the design spec (engine contract, not policy):
 *   - The learner output channel is `out.adopt` (engine contract:
 *     { dialogue, adopt?: fact[], ..., asserts?: fact }), not `out.adopts`.
 *   - `out.asserts` is a SINGLE fact (array of atoms), not an array of facts,
 *     so the spec's `.filter(...)` recipe becomes: null it out unless its
 *     factKey is in the closure Map. `closure().facts` is a Map ALREADY keyed
 *     by factKey, so membership uses the map keys directly (equivalent to the
 *     spec's `.map(helpers.factKey)` set).
 *
 * Deterministic, no RNG, view-only learner (never reads world).
 */
export const name = 'readopt-capacity-k1';
export const description =
  "s02's readoptForgotten learner capped at one re-adoption per turn (k=1), plain s00 tutor — tests the headroom law maxC - k.";

export function makeRoles(world, helpers, _ctx) {
  const base = helpers.makeMockLearner({ readoptForgotten: true });
  const everAdopted = new Set(); // factKey of every fact this learner has (kept-)adopted
  const missingSince = new Map(); // factKey -> turn the wrapper first saw it missing

  const learner = async (view) => {
    const out = await base(view);

    // (2) board-diff BEFORE filtering
    const boardKeys = new Set((view.abox.grounded ?? []).map(helpers.factKey));
    for (const fk of everAdopted) {
      if (!boardKeys.has(fk)) {
        if (!missingSince.has(fk)) missingSince.set(fk, view.turn);
      } else {
        missingSince.delete(fk);
      }
    }

    // (3) classify: first adopt (always keep) vs re-adopt candidate
    const adopts = out.adopt ?? [];
    const firstKeys = new Set();
    const reCandidates = [];
    for (const a of adopts) {
      const fk = helpers.factKey(a);
      if (!everAdopted.has(fk)) {
        everAdopted.add(fk);
        firstKeys.add(fk);
      } else {
        reCandidates.push({
          fk,
          since: missingSince.has(fk) ? missingSince.get(fk) : view.turn,
        });
      }
    }

    // (4) keep exactly ONE re-adopt: oldest slip first, tie-break ascending factKey
    let keptReKey = null;
    if (reCandidates.length > 0) {
      reCandidates.sort((x, y) => x.since - y.since || (x.fk < y.fk ? -1 : x.fk > y.fk ? 1 : 0));
      keptReKey = reCandidates[0].fk;
    }

    const keptAdopts = adopts.filter((a) => {
      const fk = helpers.factKey(a);
      return firstKeys.has(fk) || fk === keptReKey;
    });
    const droppedAny = keptAdopts.length !== adopts.length;

    // (5) anti-lucky-leap: dropped adopts shrink the closure the base assumed
    if (droppedAny && out.asserts) {
      const closureFacts = helpers.closure(
        [...(view.abox.grounded ?? []), ...keptAdopts],
        view.rules,
      ).facts;
      if (!closureFacts.has(helpers.factKey(out.asserts))) out.asserts = null;
    }

    out.adopt = keptAdopts;
    return out; // dialogue / hypothesis untouched; learner emits no release
  };

  return {
    director: helpers.makeMockDirector(world),
    tutor: helpers.makeMockTutor(world), // PLAIN — no repairDecayed (s00's tutor)
    learner,
  };
}
