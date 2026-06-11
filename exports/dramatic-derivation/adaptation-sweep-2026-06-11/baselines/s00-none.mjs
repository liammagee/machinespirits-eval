export const name = 's00-none';
export const description =
  'Plain mock cast, no repair policy. Floor — but NOT a pure floor: the plain tutor consolidate branch targets lastRelease, repairing it incidentally.';
export function makeRoles(world, helpers) {
  return {
    director: helpers.makeMockDirector(world),
    tutor: helpers.makeMockTutor(world),
    learner: helpers.makeMockLearner(),
  };
}
