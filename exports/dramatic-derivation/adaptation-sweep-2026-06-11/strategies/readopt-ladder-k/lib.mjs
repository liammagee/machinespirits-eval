/**
 * readopt-ladder-k — shared template (the "one template" of the design).
 *
 * Capacity-K oldest-first re-adopting learner paired with a NEUTERED
 * no-repair tutor, so re-adoption is the ONLY repair channel. K caps
 * RE-adoptions per turn; normal (first-time) adoption is uncapped.
 *
 * Design hypothesis under test: at rate 1.0 / grace 0 / start 1 the
 * decayed pool is the oldest-m released premises (m = maxConcurrent); an
 * oldest-first re-adopter leaves the NEWEST (m-K) of that pool missing at
 * speak time, so success should equal the precomputed closure predicate
 *   S in closure(bg + (released \ pool) + oldest-K(pool) [+ final premise
 *   on its release turn])
 * cell-for-cell over (world, m, K).
 *
 * Determinism: this strategy has NO randomness (ctx.seed deliberately
 * unused) — at rate 1.0 verdicts must be seed-invariant.
 *
 * Hard-rule compliance:
 *  - learner is written from scratch and reads ONLY its view (it captures
 *    helpers.factKey/closure/matchPattern, which are world-agnostic pure
 *    functions — never the world object);
 *  - tutor wrapper never touches out.release (frozen schedule channel);
 *  - decay params are the harness's condition, not touched here.
 */

export function makeStrategy(K, nameOverride = null) {
  if (!Number.isInteger(K) || K < 1) throw new Error(`K must be an integer >= 1 (got ${K})`);
  const name = nameOverride ?? `readopt-ladder-k${K}`;
  const description =
    `Capacity-${K} oldest-first re-adopting learner (from scratch, view-only) + ` +
    `neutered no-repair tutor: re-adoption is the only repair channel; K caps re-adoptions only.`;

  function makeRoles(world, helpers, _ctx) {
    const { factKey, closure, matchPattern } = helpers;

    // --- director: stock mock (releases stay exactly on schedule) ---
    const director = helpers.makeMockDirector(world);

    // --- tutor: NEUTERED wrapper over the plain mock ---
    // The plain mock's consolidate branch targets lastRelease, which may be
    // decayed — an INCIDENTAL repair that contaminates the s00 floor. If the
    // base move targets a decayed premise, retarget it to the newest
    // non-decayed ledger entry (null if every released premise is decayed —
    // engine-safe: the repair block is guarded on truthy targetPremise).
    // The release branch targets the just-released premise, which cannot be
    // decayed yet, so releases are never disturbed. out.release is NEVER
    // touched — the schedule stays frozen.
    const base = helpers.makeMockTutor(world);
    const tutor = async (view) => {
      const out = await base(view);
      const decayedIds = new Set((view.corruption?.decayed ?? []).map((d) => d.premiseId));
      if (out.move?.targetPremise && decayedIds.has(out.move.targetPremise)) {
        let retarget = null;
        for (let i = view.ledger.length - 1; i >= 0; i -= 1) {
          if (!decayedIds.has(view.ledger[i].premiseId)) {
            retarget = view.ledger[i].premiseId;
            break;
          }
        }
        out.move = { ...out.move, targetPremise: retarget ?? null, intent: 'consolidate' };
      }
      return out;
    };

    // --- learner: from scratch, view-only, capacity-K oldest-first ---
    const heard = []; // {fact, key} — heard order = release order
    const heardKeys = new Set();
    const adoptedKeys = new Set();
    const learner = async (view) => {
      // (1) hear new releases (releasedThisTurn first; releasedFacts is the
      // defensive sweep — decayed facts are hidden from both, but a fact can
      // only decay after adoption, hence after it was heard).
      for (const f of [...view.releasedThisTurn, ...view.releasedFacts]) {
        const key = factKey(f);
        if (!heardKeys.has(key)) {
          heardKeys.add(key);
          heard.push({ fact: f, key });
        }
      }
      // (2) what the board still shows
      const visibleKeys = new Set(view.abox.grounded.map((f) => factKey(f)));
      // (3) adopted-but-vanished, in heard order (oldest first)
      const missing = heard.filter((e) => adoptedKeys.has(e.key) && !visibleKeys.has(e.key));
      // (4) never-adopted releases — normal adoption channel, UNCAPPED
      const newAdopts = heard.filter((e) => !adoptedKeys.has(e.key));
      for (const e of newAdopts) adoptedKeys.add(e.key);
      // (5) capacity-K re-adoption, oldest first
      const readopts = missing.slice(0, K);
      // (6) single adopt list
      const adopt = [...newAdopts, ...readopts].map((e) => e.fact);
      // (7) assert only what the post-adopt closure grounds (recomputed, so
      // ungrounded assertions are impossible; heard facts were released when
      // heard, so no fabricated_fact either)
      const cl = closure([...view.abox.grounded, ...adopt], view.rules);
      let asserts = null;
      for (const fact of cl.facts.values()) {
        if (matchPattern(view.questionPattern, fact)) {
          asserts = fact;
          break;
        }
      }
      // (8) no retract, no derive, no hypothesis, no randomness
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
