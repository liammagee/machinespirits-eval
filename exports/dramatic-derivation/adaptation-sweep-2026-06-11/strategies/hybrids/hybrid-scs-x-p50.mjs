import * as T from '../stall-clock-surfing/stall-clock-surfing.mjs';
import * as L from '../readopt-notice-p50/readopt-notice-p50.mjs';
import { compose } from './_make.mjs';
export const name = 'hybrid-scs-x-p50';
export const description = 'Round-2 hybrid: stall-clock tutor x p50-notice learner (tutor from T, learner from L, fresh roles per run).';
export const makeRoles = compose(T, L);
