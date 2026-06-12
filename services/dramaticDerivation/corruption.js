/**
 * Seeded, parametric corruption of the learner's grounded board — the
 * "unreliable learner" condition (notes/poetics/2026-06-10-unreliable-
 * learner-design.md). The design rule is load-bearing: unreliability is
 * HARNESS-implemented, never prompt-roleplayed. The model reasons at full
 * strength from a degraded axiom base; the harness owns the ground truth of
 * what was lost and when, so manifest-vs-latent is structural, not judged.
 *
 * v1 is DECAY ONLY: a masked (forgotten) released premise disappears from the
 * learner's visible board and from D(t)/forcing until the tutor repairs it
 * (a move whose targetPremise names it) or the learner re-adopts it.
 *
 * Stage v2 (notes/poetics/2026-06-11-act-bounded-learner-design.md §1.3) adds
 * MUTATION: with probability `mutateShare`, a decay hit misremembers instead
 * of deleting — one argument of the lost fact is swapped for a plausible
 * same-slot constant, and the false form lands on the learner's belief board
 * as a mistaken axiom (engine.js owns the swap; this module only carries the
 * config key). At the default `mutateShare: 0` the draw stream and ledger are
 * byte-identical to v1. The decay schedule remains a RUN-LEVEL condition:
 * worlds stay frozen.
 *
 * Stage v3 (the lantern-p3 critic's defect report, registration §13) adds the
 * `pool` key governing where the swap constant may come from. `"world"` (the
 * default, and the only pre-v3 behavior) samples constants seen anywhere in
 * the world's premises and background — INCLUDING premises not yet released,
 * which lets a mutation whisper an unmet name onto the learner's board (in
 * lantern-p3, "senna" arrived by corruption at t3 before any exhibit staged
 * her, and scaffolded the t18 unforced leap). `"staged"` restricts the pool
 * to entities the learner has met on stage: background plus premises released
 * so far. The default stays `"world"` so archived runs' seeded draw streams
 * replay byte-identically; new arms opt in to `"staged"`.
 */

/**
 * mulberry32 — tiny seedable PRNG, deterministic across platforms. Returns a
 * function yielding floats in [0, 1). One draw per eligible board entry per
 * turn; the draw count depends only on board state, which is deterministic
 * given role outputs, so a seed pins the whole corruption schedule.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DECAY_DEFAULTS = Object.freeze({
  seed: 1,
  rate: 0.15,
  graceTurns: 2,
  maxConcurrent: 2,
  startTurn: 1,
  mutateShare: 0,
  pool: 'world',
});

/**
 * Validate and default a decay config. Accepts an object or a JSON string
 * (the CLI's `--decay '<json>'`). Unknown keys are rejected — a typo'd
 * parameter must fail loudly, not silently run at its default.
 */
export function normalizeDecayConfig(raw) {
  let cfg = raw;
  if (typeof cfg === 'string') {
    try {
      cfg = JSON.parse(cfg);
    } catch (err) {
      throw new Error(`decay config is not valid JSON: ${err.message}`);
    }
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    throw new Error('decay config must be a JSON object, e.g. {"seed":7,"rate":0.15}');
  }
  for (const key of Object.keys(cfg)) {
    if (!(key in DECAY_DEFAULTS)) {
      throw new Error(`decay config: unknown key "${key}" (known: ${Object.keys(DECAY_DEFAULTS).join(', ')})`);
    }
  }
  const out = { ...DECAY_DEFAULTS, ...cfg };
  const intField = (name, min) => {
    if (!Number.isInteger(out[name]) || out[name] < min) {
      throw new Error(`decay config: ${name} must be an integer >= ${min} (got ${JSON.stringify(out[name])})`);
    }
  };
  intField('seed', 0);
  intField('graceTurns', 0);
  intField('maxConcurrent', 1);
  intField('startTurn', 1);
  if (typeof out.rate !== 'number' || !(out.rate >= 0 && out.rate <= 1)) {
    throw new Error(`decay config: rate must be a number in [0, 1] (got ${JSON.stringify(out.rate)})`);
  }
  if (typeof out.mutateShare !== 'number' || !(out.mutateShare >= 0 && out.mutateShare <= 1)) {
    throw new Error(`decay config: mutateShare must be a number in [0, 1] (got ${JSON.stringify(out.mutateShare)})`);
  }
  if (out.pool !== 'world' && out.pool !== 'staged') {
    throw new Error(`decay config: pool must be "world" or "staged" (got ${JSON.stringify(out.pool)})`);
  }
  return out;
}
