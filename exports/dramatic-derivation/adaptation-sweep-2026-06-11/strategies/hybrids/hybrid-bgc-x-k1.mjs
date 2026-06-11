import * as T from '../blocking-greedy-clean/blocking-greedy-clean.mjs';
import * as L from '../readopt-capacity-k1/readopt-capacity-k1.mjs';
import { compose } from './_make.mjs';
export const name = 'hybrid-bgc-x-k1';
export const description = 'Round-2 hybrid: blocking-greedy tutor x k1-metered learner (tutor from T, learner from L, fresh roles per run).';
export const makeRoles = compose(T, L);
