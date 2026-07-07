/**
 * stall-clock-surfing — tutor-side repair-parsimony probe.
 *
 * Hypothesis (designer): a tutor that repairs ONLY when the projected stall
 * detector would otherwise fire this turn, plus eager repair from T_w (the
 * first turn a fully-scheduled proof path is completely released: 8/32/20/15/19
 * across the five worlds), stays within 10 points of same-turn-release-repair's
 * full-grid success while issuing at most 50% as many tutor repairs.
 *
 * MODE 2 (turn < T_w): simulate this turn's trajectory entry BEFORE the learner
 * speaks (exact for the plain mock learner: it adopts releasedThisTurn the same
 * turn, no readoption) and repair only if detectStall would fire on the
 * projected tail; candidates ordered by projected D asc, then sinceTurn asc,
 * then list order; prefer the first that AVERTS the stall, else candidates[0].
 * MODE 1 (turn >= T_w): eager repair, intact-path premises first.
 * All no-repair branches set move.targetPremise = null — suppressing the base
 * mock's incidental lastRelease consolidate-repair is MANDATORY for the
 * repair-parsimony measurement.
 *
 * Releases are NEVER touched (frozen channel): out.release passes through
 * untouched, so same-turn release+repair happens whenever a repair lands on a
 * release turn. Fully deterministic; ctx.seed unused. The tutor is omniscient
 * by design (closes over world); the learner is the plain view-only mock.
 */

export const name = 'stall-clock-surfing';
export const description =
  'Tutor repairs only when the projected stall clock would otherwise fire (pre-T_w) and eagerly after T_w; incidental repairs suppressed; plain learner.';

export function makeRoles(world, helpers, _ctx) {
  // --- INIT (tutor closure over world) -----------------------------------
  const W = world.slope.aporia_window;
  const factOf = (premiseId) => world.premiseById.get(premiseId).fact;

  // Proof paths whose every premise is on the release schedule.
  const scheduledPaths = world.proofPaths.filter((p) =>
    p.premises.every((id) => world.releaseSchedule.some((e) => e.premise === id)),
  );
  // T_w = min over scheduledPaths of (max release turn among the path's
  // premises); intactPathSet = premise set of the T_w-achieving path.
  const pathMaxReleaseTurn = (p) =>
    Math.max(
      ...p.premises.map((id) =>
        Math.max(...world.releaseSchedule.filter((e) => e.premise === id).map((e) => e.turn)),
      ),
    );
  let T_w = Infinity;
  let intactPathSet = new Set();
  for (const p of scheduledPaths) {
    const t = pathMaxReleaseTurn(p);
    if (t < T_w) {
      T_w = t;
      intactPathSet = new Set(p.premises);
    }
  }

  // Exact reimplementation of slope.js derivationDistance via helpers.
  const dist = (facts) => {
    const cl = helpers.closure(facts, world.rules).facts;
    if (cl.has(helpers.factKey(world.secret.fact))) return 0;
    let best = Infinity;
    for (const p of world.proofPaths) {
      const missing = p.premises.filter((id) => !cl.has(helpers.factKey(factOf(id)))).length;
      best = Math.min(best, missing);
    }
    return best;
  };

  const base = helpers.makeMockTutor(world); // plain — no repairDecayed policy

  const tutor = async (view) => {
    const out = await base(view);
    const decayed = view.corruption?.decayed ?? [];

    // Facts landing on the learner's board this turn via the release channel:
    // director releases this turn are already on the view ledger (director
    // acts first); the tutor's own scheduled release rides in out.release.
    const releasedNow = view.ledger.filter((e) => e.turn === view.turn).map((e) => factOf(e.premiseId));
    if (out.release) releasedNow.push(factOf(out.release));

    // Projection of this turn's post-learner valid board (dedupe by factKey).
    const project = (repairFact) => {
      const seen = new Map();
      for (const fact of [...view.learnerAbox.grounded, ...releasedNow, ...(repairFact ? [repairFact] : [])]) {
        const key = helpers.factKey(fact);
        if (!seen.has(key)) seen.set(key, fact);
      }
      return [...seen.values()];
    };

    const p0 = project(null);
    const e0 = { turn: view.turn, D: dist(p0), groundedCount: p0.length };
    const firstRelease = view.ledger.length ? view.ledger[0].turn : Infinity;
    const danger = helpers.detectStall([...view.trajectory, e0], W, firstRelease);

    if (view.turn >= T_w) {
      // MODE 1: eager — repair anything decayed, intact-path premises first.
      if (decayed.length) {
        const pick = decayed.filter((d) => intactPathSet.has(d.premiseId))[0] ?? decayed[0];
        out.move = { ...out.move, targetPremise: pick.premiseId, intent: 'repair' };
      } else {
        out.move = { ...out.move, targetPremise: null };
      }
      return out; // out.release untouched
    }

    // MODE 2 (turn < T_w): repair only to avert a projected stall this turn.
    if (danger !== null && decayed.length) {
      const candidates = decayed.map((d, idx) => {
        const proj = project(d.fact);
        return { d, idx, D: dist(proj), groundedCount: proj.length };
      });
      candidates.sort((a, b) => a.D - b.D || a.d.sinceTurn - b.d.sinceTurn || a.idx - b.idx);
      let pick = null;
      for (const c of candidates) {
        const tail = [...view.trajectory, { turn: view.turn, D: c.D, groundedCount: c.groundedCount }];
        if (helpers.detectStall(tail, W, firstRelease) === null) {
          pick = c;
          break;
        }
      }
      if (!pick) pick = candidates[0];
      out.move = { ...out.move, targetPremise: pick.d.premiseId, intent: 'repair' };
    } else {
      // No danger (or nothing decayed): suppress the base mock's incidental
      // lastRelease consolidate-repair — mandatory for repair parsimony.
      out.move = { ...out.move, targetPremise: null };
    }
    return out; // out.release untouched
  };

  return {
    director: helpers.makeMockDirector(world),
    tutor,
    learner: helpers.makeMockLearner(), // plain — load-bearing (exact projection + clean repairsTutor)
  };
}
