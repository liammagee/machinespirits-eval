/**
 * readopt-ladder-k v2 — ONE refinement over lib.mjs, tutor wrapper only.
 *
 * v1's neutering compared premise IDS against view.corruption.decayed[].premiseId.
 * Worlds 002-lantern and 003-bitterwell contain ALIAS premises (two ids, one
 * fact; only one id scheduled). The engine keys decay on FACT KEYS and its
 * corruption view reports the alias id (last-writer-wins), so the v1 id-set
 * check let the base tutor's consolidate move land on the scheduled id of a
 * decayed FACT — an illicit tutor repair (224 events / 2250 canonical runs,
 * all on the two alias worlds; zero contaminated successes in the rate-1.0
 * phase surface, but up to ~7% of shoulder successes carried tutor repairs).
 *
 * v2 compares FACT KEYS: a move target is decay-touching iff the fact of the
 * premise it names is currently decayed; the retarget scan likewise skips any
 * ledger premise whose FACT is decayed. The tutor is omniscient, so reading
 * world.premiseById here is legal (only the learner is view-bound).
 * The learner is byte-identical to v1. out.release is never touched.
 */

export function makeStrategyV2(K, nameOverride = null) {
  if (!Number.isInteger(K) || K < 1) throw new Error(`K must be an integer >= 1 (got ${K})`);
  const name = nameOverride ?? `readopt-ladder-k${K}-v2`;
  const description =
    `Capacity-${K} oldest-first re-adopting learner (from scratch, view-only) + ` +
    `fact-key-neutered no-repair tutor (alias-proof): re-adoption is the only repair channel.`;

  function makeRoles(world, helpers, _ctx) {
    const { factKey, closure, matchPattern } = helpers;

    const director = helpers.makeMockDirector(world);

    // --- tutor: neutered by FACT KEY (alias-proof) ---
    const base = helpers.makeMockTutor(world);
    const premiseFactKey = (id) => {
      const p = world.premiseById.get(id);
      return p ? factKey(p.fact) : null;
    };
    const tutor = async (view) => {
      const out = await base(view);
      const decayedKeys = new Set((view.corruption?.decayed ?? []).map((d) => factKey(d.fact)));
      const tk = out.move?.targetPremise ? premiseFactKey(out.move.targetPremise) : null;
      if (tk && decayedKeys.has(tk)) {
        let retarget = null;
        for (let i = view.ledger.length - 1; i >= 0; i -= 1) {
          const lk = premiseFactKey(view.ledger[i].premiseId);
          if (lk && !decayedKeys.has(lk)) {
            retarget = view.ledger[i].premiseId;
            break;
          }
        }
        out.move = { ...out.move, targetPremise: retarget ?? null, intent: 'consolidate' };
      }
      return out;
    };

    // --- learner: byte-identical to v1 (capacity-K oldest-first re-adopter) ---
    const heard = [];
    const heardKeys = new Set();
    const adoptedKeys = new Set();
    const learner = async (view) => {
      for (const f of [...view.releasedThisTurn, ...view.releasedFacts]) {
        const key = factKey(f);
        if (!heardKeys.has(key)) {
          heardKeys.add(key);
          heard.push({ fact: f, key });
        }
      }
      const visibleKeys = new Set(view.abox.grounded.map((f) => factKey(f)));
      const missing = heard.filter((e) => adoptedKeys.has(e.key) && !visibleKeys.has(e.key));
      const newAdopts = heard.filter((e) => !adoptedKeys.has(e.key));
      for (const e of newAdopts) adoptedKeys.add(e.key);
      const readopts = missing.slice(0, K);
      const adopt = [...newAdopts, ...readopts].map((e) => e.fact);
      const cl = closure([...view.abox.grounded, ...adopt], view.rules);
      let asserts = null;
      for (const fact of cl.facts.values()) {
        if (matchPattern(view.questionPattern, fact)) {
          asserts = fact;
          break;
        }
      }
      return {
        dialogue: asserts ? `I see it now: ${asserts.join(' ')}.` : 'I am listening.',
        adopt,
        asserts,
      };
    };

    return { director, tutor, learner };
  }

  return { name, description, makeRoles };
}
