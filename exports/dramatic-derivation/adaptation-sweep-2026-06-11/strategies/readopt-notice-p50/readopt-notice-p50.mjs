/**
 * readopt-notice-p50 — stochastic slip-notice degradation of the s02 ideal
 * readopt learner. Contrast pair to readopt-capacity-k1: equal expected repair
 * effort, different SHAPE (bursty-stochastic here vs metered-deterministic
 * there).
 *
 * Cast: director = plain mock; tutor = PLAIN mock (no repairDecayed — only the
 * incidental consolidate-targets-lastRelease repair that s00 also has);
 * learner = wrapper around makeMockLearner({readoptForgotten: true}).
 *
 * Wrapper policy (per learner turn):
 *   1. out = await base(view).
 *   2. Classify each fact in out.adopt sequentially by factKey:
 *      not yet in everAdopted  -> FIRST adopt: always keep, add to everAdopted;
 *      already in everAdopted  -> RE-adopt (slip repair) candidate.
 *   3. Sort candidates ascending by factKey string (fixes PRNG consumption
 *      order), one Bernoulli draw each: keep iff rng() < 0.5. Keeps per turn
 *      are UNBOUNDED (burst-preserving). A dropped slip gets a fresh draw next
 *      turn when the base re-emits it from its board diff — per-slip per-turn
 *      Bernoulli, geometric notice delay with mean 2 turns.
 *   4. If anything was dropped, recompute the assertion against the KEPT board:
 *      keep out.asserts only if its factKey is in
 *      closure([...view.abox.grounded, ...keptAdopts], view.rules).facts,
 *      else null it (the engine's learner contract has asserts as a SINGLE
 *      fact, so the spec's array-filter is realised as a membership check —
 *      see notes). out.adopt = keptAdopts. Touch nothing else.
 *
 * Randomness: rng = helpers.mulberry32(ctx.seed * 1000 + 7), created ONCE per
 * makeRoles call (one run). No other randomness anywhere.
 *
 * View-only: the learner closure captures base/everAdopted/rng/helpers only —
 * never `world`.
 */

export const name = 'readopt-notice-p50';
export const description =
  'Wrapped s02 readopt learner + plain s00 tutor: first adopts always kept; each slip re-adopt kept with p=0.5 per turn (unbounded bursts), asserts recomputed against the kept board.';

export function makeRoles(world, helpers, ctx) {
  const { makeMockDirector, makeMockTutor, makeMockLearner, factKey, closure, mulberry32 } = helpers;

  const base = makeMockLearner({ readoptForgotten: true });
  const everAdopted = new Set(); // factKeys adopted at least once (per run)
  const rng = mulberry32(ctx.seed * 1000 + 7); // ONCE per run — sole randomness source

  const learner = async (view) => {
    const out = await base(view);
    const emitted = out.adopt ?? [];

    // (2) sequential classification in emission order
    const decisions = [];
    for (const fact of emitted) {
      const fk = factKey(fact);
      if (!everAdopted.has(fk)) {
        everAdopted.add(fk);
        decisions.push({ fact, fk, kind: 'first' });
      } else {
        decisions.push({ fact, fk, kind: 'readopt' });
      }
    }

    // (3) Bernoulli notice over re-adopt candidates, PRNG consumed in
    // factKey-ascending order; keeps unbounded.
    const candidates = decisions.filter((d) => d.kind === 'readopt');
    candidates.sort((a, b) => (a.fk < b.fk ? -1 : a.fk > b.fk ? 1 : 0));
    const keptReadoptKeys = new Set();
    let dropped = 0;
    for (const c of candidates) {
      if (rng() < 0.5) keptReadoptKeys.add(c.fk);
      else dropped += 1;
    }

    if (dropped === 0) return out; // nothing dropped -> touch nothing

    // (4) kept board + assertion recompute (lucky-leap guard)
    const keptAdopts = decisions
      .filter((d) => d.kind === 'first' || keptReadoptKeys.has(d.fk))
      .map((d) => d.fact);
    const closureFacts = closure([...view.abox.grounded, ...keptAdopts], view.rules).facts;
    const asserts =
      out.asserts && closureFacts.has(factKey(out.asserts)) ? out.asserts : null;

    return { ...out, adopt: keptAdopts, asserts };
  };

  return {
    director: makeMockDirector(world),
    tutor: makeMockTutor(world), // PLAIN — no repairDecayed
    learner,
  };
}
