/** matched control: oldest-first ladder at K=2 — same chassis as triage, only step 5 swapped. */
import { makeChassisRoles } from './core.mjs';
const K = 2;
export const name = 'control-ladder-k2';
export const description = 'K-capped (K=2) oldest-first re-adoption ladder (matched control for readopt-triage-k).';
export function makeRoles(world, helpers, ctx) {
  return makeChassisRoles(world, helpers, ctx, { K, alloc: 'ladder' });
}
