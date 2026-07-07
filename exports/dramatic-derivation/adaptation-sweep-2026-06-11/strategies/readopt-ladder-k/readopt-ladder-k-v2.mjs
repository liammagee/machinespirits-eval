/** Canonical v2 module (K = 2) — fact-key-neutered tutor; full-grid comparable. */
import { makeStrategyV2 } from './lib-v2.mjs';

const s = makeStrategyV2(2, 'readopt-ladder-k-v2');
export const name = s.name;
export const description = `${s.description} (canonical K=2 module)`;
export const makeRoles = s.makeRoles;
