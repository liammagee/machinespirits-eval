// generator helper — composes tutor from strategy A with learner from strategy B.
// Each parent builds fresh, closure-scoped roles per makeRoles call; discarding
// A's learner and B's tutor discards unused closures (audited: no module-level
// mutable state in any parent).
export function compose(A, B) {
  return function makeRoles(world, helpers, ctx) {
    const a = A.makeRoles(world, helpers, ctx);
    const b = B.makeRoles(world, helpers, ctx);
    return { director: a.director, tutor: a.tutor, learner: b.learner };
  };
}
