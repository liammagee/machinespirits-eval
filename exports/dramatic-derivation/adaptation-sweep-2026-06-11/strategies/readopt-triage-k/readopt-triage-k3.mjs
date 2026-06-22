/** readopt-triage-k at K=3 — see core.mjs. */
import { makeChassisRoles } from './core.mjs';
const K = 3;
export const name = 'readopt-triage-k3';
export const description = 'K-capped (K=3) necessity-aware re-adoption triage, neutered no-repair tutor.';
export function makeRoles(world, helpers, ctx) {
  return makeChassisRoles(world, helpers, ctx, { K, alloc: 'triage' });
}
