export const name = 's02-learner-readopt';
export const description =
  'Learner readoptForgotten policy: diff own memory of adopted facts vs visible board, re-adopt what slipped (view-only, no world peeking).';
export function makeRoles(world, helpers) {
  return {
    director: helpers.makeMockDirector(world),
    tutor: helpers.makeMockTutor(world),
    learner: helpers.makeMockLearner({ readoptForgotten: true }),
  };
}
