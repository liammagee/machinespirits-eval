/**
 * Canonical module (K = 2) — used for the unmodified full-grid sweep so the
 * summary is row-comparable with the s00–s03 baseline table (sweepPlan c).
 */
import { makeStrategy } from './lib.mjs';

const s = makeStrategy(2, 'readopt-ladder-k');
export const name = s.name;
export const description = `${s.description} (canonical K=2 module)`;
export const makeRoles = s.makeRoles;
