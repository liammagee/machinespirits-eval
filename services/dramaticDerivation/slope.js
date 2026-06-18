/**
 * Slope instrumentation — the dramaturgy made measurable
 * (notes/2026-06-09-dramatic-derivation-plan.md §2.5).
 *
 * D(t) = remaining derivation distance to the secret given the learner's
 * current GROUNDED facts: 0 if the closure already forces S, else the
 * minimum (over authored proof paths) count of path premises the learner
 * does not yet hold. Entailment is authoritative (the chainer may find an
 * unanticipated route); the path count is the planned-path instrument.
 */

import { closure, factKey } from './chainer.js';

export function derivationDistance(world, groundedFacts) {
  const cl = closure(groundedFacts, world.rules).facts;
  if (cl.has(factKey(world.secret.fact))) return 0;
  let best = Infinity;
  for (const path of world.proofPaths) {
    const missing = path.premises.filter((id) => !cl.has(factKey(world.premiseById.get(id).fact))).length;
    best = Math.min(best, missing);
  }
  return best;
}

/**
 * Stall detection over the trajectory tail. A strict D decrease is proof
 * progress even when decay/repair churn leaves the net grounded count flat.
 * `disengagement` (no GROUNDED growth at all) and `aporia` (GROUNDED growth
 * without D decrease, D > 0) use the same window. Detection only begins once
 * something has been released (before that, a flat D is the overture, not a
 * stall).
 */
export function detectStall(trajectory, window, firstReleaseTurn) {
  if (trajectory.length < window) return null;
  const tail = trajectory.slice(-window);
  if (tail[0].turn < firstReleaseTurn) return null;
  const last = tail[tail.length - 1];
  if (last.D === 0) return null;

  const dDecreased = tail.some((entry, i) => i > 0 && entry.D < tail[i - 1].D);
  if (dDecreased) return null;

  const grew = tail.some((entry, i) => i > 0 && entry.groundedCount > tail[i - 1].groundedCount);
  if (!grew) return 'disengagement';

  return 'aporia';
}
