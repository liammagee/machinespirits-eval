import { makeStrategy } from './lib.mjs';

const K = 3;
const s = makeStrategy(K);
export const name = s.name;
export const description = s.description;
export const makeRoles = s.makeRoles;
