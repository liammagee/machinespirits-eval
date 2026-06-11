/**
 * readopt-triage-k — canonical module (K = 3, the hypothesis's headline k).
 * Necessity-aware slot triage for K-capped learner re-adoption, paired with a
 * neutered no-repair tutor. See core.mjs for the full mechanism + provenance
 * notes. Per-k variants: readopt-triage-k{1,2,3,4}.mjs; matched control:
 * control-ladder-k{1,2,3,4}.mjs (same chassis, oldest-first allocation).
 */
import { makeChassisRoles } from './core.mjs';

const K = 3;

export const name = 'readopt-triage-k';
export const description =
  `Learner-side K-capped re-adoption (K=${K}) with necessity-aware slot triage ` +
  '(view-only subset search toward the best heard-derivable question-pattern candidate; ' +
  'greedy closure-growth fallback), neutered no-repair tutor.';

export function makeRoles(world, helpers, ctx) {
  return makeChassisRoles(world, helpers, ctx, { K, alloc: 'triage' });
}
