/**
 * readopt-capacity-k1-v2 — identical wrapper to readopt-capacity-k1 but with
 * the re-adoption throughput cap raised to k = 2 per turn.
 *
 * Why: the k=1 capacity probe (rate 1.0, grace 0) came back a STEP function —
 * maxC=1 -> 1.000, maxC=2/4/8 -> 0.000 — not the predicted graded decline in
 * (maxC - k). Refinement hypothesis: the step tracks headroom sign exactly,
 * i.e. saturation survival <=> k >= maxC. Prediction for k=2 on the same
 * probe: maxC=1 -> 1.0, maxC=2 -> 1.0 (headroom 0), maxC=4/8 -> 0.0.
 *
 * Mechanism identical to v1 (see readopt-capacity-k1.mjs): keep ALL first
 * adopts; keep up to K=2 re-adopt candidates ordered oldest-slip-first
 * (missing map entry treated as view.turn; tie-break ascending factKey);
 * anti-lucky-leap recompute of out.asserts when anything is dropped.
 * Plain s00 tutor; deterministic; view-only learner.
 */
export const name = 'readopt-capacity-k1-v2';
export const description =
  "v1 wrapper with the re-adoption cap raised to k=2 — tests whether the saturation step is exactly k >= maxC.";

const K = 2;

export function makeRoles(world, helpers, _ctx) {
  const base = helpers.makeMockLearner({ readoptForgotten: true });
  const everAdopted = new Set();
  const missingSince = new Map();

  const learner = async (view) => {
    const out = await base(view);

    const boardKeys = new Set((view.abox.grounded ?? []).map(helpers.factKey));
    for (const fk of everAdopted) {
      if (!boardKeys.has(fk)) {
        if (!missingSince.has(fk)) missingSince.set(fk, view.turn);
      } else {
        missingSince.delete(fk);
      }
    }

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

    const keptReKeys = new Set();
    if (reCandidates.length > 0) {
      reCandidates.sort((x, y) => x.since - y.since || (x.fk < y.fk ? -1 : x.fk > y.fk ? 1 : 0));
      for (const c of reCandidates.slice(0, K)) keptReKeys.add(c.fk);
    }

    const keptAdopts = adopts.filter((a) => {
      const fk = helpers.factKey(a);
      return firstKeys.has(fk) || keptReKeys.has(fk);
    });
    const droppedAny = keptAdopts.length !== adopts.length;

    if (droppedAny && out.asserts) {
      const closureFacts = helpers.closure(
        [...(view.abox.grounded ?? []), ...keptAdopts],
        view.rules,
      ).facts;
      if (!closureFacts.has(helpers.factKey(out.asserts))) out.asserts = null;
    }

    out.adopt = keptAdopts;
    return out;
  };

  return {
    director: helpers.makeMockDirector(world),
    tutor: helpers.makeMockTutor(world), // PLAIN — no repairDecayed
    learner,
  };
}
