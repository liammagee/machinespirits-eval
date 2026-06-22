export const name = 's03-both';
export const description = 'Both repair channels: tutor repairDecayed + learner readoptForgotten.';
export function makeRoles(world, helpers) {
  return {
    director: helpers.makeMockDirector(world),
    tutor: helpers.makeMockTutor(world, { repairDecayed: true }),
    learner: helpers.makeMockLearner({ readoptForgotten: true }),
  };
}
