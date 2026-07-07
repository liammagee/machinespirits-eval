export const name = 's01-tutor-repair';
export const description =
  'Tutor repairDecayed policy: on non-release turns, target the oldest decayed premise (reads omniscient corruption block).';
export function makeRoles(world, helpers) {
  return {
    director: helpers.makeMockDirector(world),
    tutor: helpers.makeMockTutor(world, { repairDecayed: true }),
    learner: helpers.makeMockLearner(),
  };
}
