/** readopt-triage-k at K=2 — see core.mjs. */
import { makeChassisRoles } from './core.mjs';
const K = 2;
export const name = 'readopt-triage-k2';
export const description = 'K-capped (K=2) necessity-aware re-adoption triage, neutered no-repair tutor.';
export function makeRoles(world, helpers, ctx) {
  return makeChassisRoles(world, helpers, ctx, { K, alloc: 'triage' });
}
