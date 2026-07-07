import { makeStrategyV2 } from './lib-v2.mjs';

const K = 3;
const s = makeStrategyV2(K);
export const name = s.name;
export const description = s.description;
export const makeRoles = s.makeRoles;
