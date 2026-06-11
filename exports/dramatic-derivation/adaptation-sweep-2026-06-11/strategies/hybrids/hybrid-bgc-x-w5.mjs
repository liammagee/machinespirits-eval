import * as T from '../blocking-greedy-clean/blocking-greedy-clean.mjs';
import * as L from '../readopt-recency-w5/readopt-recency-w5.mjs';
import { compose } from './_make.mjs';
export const name = 'hybrid-bgc-x-w5';
export const description = 'Round-2 hybrid: blocking-greedy tutor x recency-w5 learner (tutor from T, learner from L, fresh roles per run).';
export const makeRoles = compose(T, L);
