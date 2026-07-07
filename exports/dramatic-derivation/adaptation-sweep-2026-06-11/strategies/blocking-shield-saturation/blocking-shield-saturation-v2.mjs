/**
 * blocking-shield-saturation-v2 — the ONE permitted refinement.
 *
 * v1 finding: shield (hold non-blocking rot to saturate maxConcurrent slots)
 * UNDERPERFORMS clean (repair rot anyway) — 0.816 vs 0.849 full grid — and
 * the entire deficit is disengagement (382 of 413 failures, 172 of them
 * mid-schedule). Mechanism: groundedCount growth pairs come only from
 * releases and repairs; a decay landing at end of turn t-1 cancels the
 * release growth at turn t pairwise, and a held shield generates NO repair
 * churn — so the stall detector starves. Clean's "wasted" repairs on
 * harmless rot are exactly what keep its trajectory churning.
 *
 * v2 = v1 + a deterministic anti-stall HEARTBEAT in the not-blocked branch:
 * hold shields as in v1, EXCEPT when the disengagement window is about to
 * fill (turn - lastGrowthTurn >= aporia_window - 2) and no growth is
 * otherwise guaranteed this turn (scheduled releases minus decay landings
 * from end of last turn <= 0) — then spend this turn's repair on the oldest
 * decayed premise, buying a growth pair at minimum shield cost. Repairing a
 * shield re-exposes it to decay, so the slot saturation is otherwise kept.
 *
 * If v2 >= clean: shield's v1 deficit was purely stall-detector starvation.
 * If v2 ~= v1: shielding is intrinsically harmful beyond the stall channel.
 *
 * Everything else identical to v1 (and to the blocking-greedy-clean
 * comparator): precomputation, blocked(), greedy pick, sanitize, plain mock
 * roles, frozen release channel, deterministic (ctx.seed unused).
 */

export const name = 'blocking-shield-saturation-v2';
export const description =
  'Shield variant with a deterministic anti-stall heartbeat: hold non-blocking rot as slot-shields except when the disengagement window is about to fill without a guaranteed growth pair — then repair the oldest shield that turn.';

export function makeRoles(world, helpers, ctx) { // eslint-disable-line no-unused-vars
  const { makeMockDirector, makeMockTutor, makeMockLearner, factKey, closure } = helpers;

  const SCHED = world.releaseSchedule.map((e) => e.premise);
  const EVENTUAL = SCHED.map((id) => world.premiseById.get(id).fact);
  const SECRET = world.secret.fact;
  const PATHREL = new Set();
  for (const path of world.proofPaths) {
    for (const id of path.premises) PATHREL.add(id);
  }

  const memo = new Map();
  const blocked = (ids) => {
    const key = [...ids].sort().join('|');
    if (memo.has(key)) return memo.get(key);
    const dead = new Set(ids);
    const facts = [...world.background];
    for (let i = 0; i < SCHED.length; i += 1) {
      if (!dead.has(SCHED[i])) facts.push(EVENTUAL[i]);
    }
    const result = !closure(facts, world.rules).facts.has(factKey(SECRET));
    memo.set(key, result);
    return result;
  };

  const W = world.slope.aporia_window;
  const releasesAtTurn = new Map();
  for (const e of world.releaseSchedule) {
    releasesAtTurn.set(e.turn, (releasesAtTurn.get(e.turn) || 0) + 1);
  }

  const base = makeMockTutor(world);
  const tutor = async (view) => {
    const out = await base(view);
    const D = (view.corruption?.decayed ?? [])
      .filter((d) => d.premiseId)
      .sort(
        (a, b) =>
          a.sinceTurn - b.sinceTurn ||
          (a.premiseId < b.premiseId ? -1 : a.premiseId > b.premiseId ? 1 : 0),
      );
    if (!D.length) return out;
    const ids = D.map((d) => d.premiseId);

    if (blocked(ids)) {
      const singles = ids.filter((id) => !blocked(ids.filter((x) => x !== id)));
      const pick = singles[0] ?? ids.find((id) => PATHREL.has(id)) ?? ids[0];
      out.move = { ...out.move, targetPremise: pick, intent: 'repair' };
      return out;
    }

    // --- anti-stall heartbeat (the v2 delta) ---
    // Last turn whose trajectory entry shows groundedCount growth over its
    // predecessor (trajectory holds turns 1..turn-1 at tutor time).
    const traj = view.trajectory;
    let lastGrowth = 0;
    for (let i = traj.length - 1; i >= 1; i -= 1) {
      if (traj[i].groundedCount > traj[i - 1].groundedCount) {
        lastGrowth = traj[i].turn;
        break;
      }
    }
    const danger = view.turn - lastGrowth >= W - 2;
    // Growth already guaranteed this turn? scheduled releases (the plain
    // learner adopts releasedThisTurn immediately, +1 each) minus the decay
    // landings from end of last turn (they first depress THIS turn's count).
    const landedLastTurn = D.filter((d) => d.sinceTurn === view.turn - 1).length;
    const expectedDelta = (releasesAtTurn.get(view.turn) || 0) - landedLastTurn;
    if (danger && expectedDelta <= 0) {
      out.move = { ...out.move, targetPremise: ids[0], intent: 'repair' };
      return out;
    }

    // SHIELD hold + sanitize (identical to v1).
    if (out.move?.targetPremise && ids.includes(out.move.targetPremise)) {
      let liveId = null;
      for (let i = view.ledger.length - 1; i >= 0; i -= 1) {
        if (!ids.includes(view.ledger[i].premiseId)) {
          liveId = view.ledger[i].premiseId;
          break;
        }
      }
      out.move = { ...out.move, targetPremise: liveId, intent: 'consolidate' };
    }
    return out; // out.release NEVER touched
  };

  return {
    director: makeMockDirector(world),
    tutor,
    learner: makeMockLearner(),
  };
}
