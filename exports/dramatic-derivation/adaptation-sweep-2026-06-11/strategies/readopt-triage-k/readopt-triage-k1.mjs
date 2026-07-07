/** readopt-triage-k at K=1 — see core.mjs. */
import { makeChassisRoles } from './core.mjs';
const K = 1;
export const name = 'readopt-triage-k1';
export const description = 'K-capped (K=1) necessity-aware re-adoption triage, neutered no-repair tutor.';
export function makeRoles(world, helpers, ctx) {
  return makeChassisRoles(world, helpers, ctx, { K, alloc: 'triage' });
}
