/**
 * blocking-shield-saturation — tutor-side strategy for the decay condition.
 *
 * Mechanism (per design spec): identical roles + precomputation to
 * blocking-greedy-clean — plain makeMockDirector(world), plain
 * makeMockLearner() (no readoption), wrapper over plain makeMockTutor(world).
 * Single behavioral delta in the NOT-BLOCKED branch: where clean repairs the
 * oldest decayed premise anyway, shield REFUSES to repair non-blocking
 * decayed premises so they permanently occupy maxConcurrent slots
 * (rot-as-shield), and SANITIZES the base tutor's incidental
 * consolidate-target (which points at lastRelease and could accidentally
 * repair a shield, freeing the slot).
 *
 * Precomputation (reconstructed faithfully — the blocking-greedy-clean
 * module was not present on disk; see notes in the sweep report):
 *   SCHED    scheduled premise ids, in release order
 *   EVENTUAL facts of the scheduled premises (parallel to SCHED)
 *   SECRET   the world's secret fact
 *   PATHREL  set of premise ids appearing on any authored proof path
 *   blocked(ids) true iff background + all scheduled premise facts MINUS the
 *            facts of `ids` no longer entail SECRET — i.e. if these decayed
 *            premises stayed lost forever, the full release could not force
 *            the secret. Pure function of the id set; memoized per run.
 *
 * Engine-verified invariants this leans on:
 *   - repair = move.targetPremise naming a currently-decayed premise; the
 *     release field is processed independently, so same-turn release+repair
 *     is legal (we never touch out.release — the schedule stays frozen).
 *   - nothing un-decays a fact except repair/readoption; new decays land only
 *     up to (maxConcurrent - currentlyActive) per end-of-turn — every
 *     unrepaired harmless premise is a permanent -1 on landing capacity.
 *   - the engine treats a falsy move.targetPremise as a no-op.
 *
 * Deterministic: ctx.seed is accepted but unused (no randomness anywhere).
 * The learner is the plain mock (view-only by construction — it never sees
 * the world object).
 */

export const name = 'blocking-shield-saturation';
export const description =
  'Tutor repairs decayed premises ONLY when the decayed set blocks the eventual derivation of the secret (greedy single-repair pick); non-blocking rot is deliberately left in place to saturate maxConcurrent slots, and the base tutor incidental consolidate-repair is sanitized away.';

export function makeRoles(world, helpers, ctx) { // eslint-disable-line no-unused-vars
  const { makeMockDirector, makeMockTutor, makeMockLearner, factKey, closure } = helpers;

  // --- shared precomputation (per spec, identical to blocking-greedy-clean) ---
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
      // Greedy repair: prefer the oldest single id whose lone repair unblocks
      // the eventual derivation; else the oldest path-relevant id; else the
      // oldest decayed id. Same-turn release+repair is legal: on release
      // turns out.release stays as scheduled and the move channel repairs.
      const singles = ids.filter((id) => !blocked(ids.filter((x) => x !== id)));
      const pick = singles[0] ?? ids.find((id) => PATHREL.has(id)) ?? ids[0];
      out.move = { ...out.move, targetPremise: pick, intent: 'repair' };
    } else if (out.move?.targetPremise && ids.includes(out.move.targetPremise)) {
      // SHIELD branch: do NOT repair — and sanitize. The base tutor's
      // consolidate branch targets lastRelease, which may be a decayed
      // shield; touching it would accidentally repair it and free the slot.
      // Redirect the consolidate move at the most recent NON-decayed release;
      // if every released premise is currently decayed, use a null target
      // (the engine treats a falsy target as a no-op).
      let liveId = null;
      for (let i = view.ledger.length - 1; i >= 0; i -= 1) {
        if (!ids.includes(view.ledger[i].premiseId)) {
          liveId = view.ledger[i].premiseId;
          break;
        }
      }
      out.move = { ...out.move, targetPremise: liveId, intent: 'consolidate' };
    }
    return out; // out.release NEVER touched — the release channel stays frozen
  };

  return {
    director: makeMockDirector(world),
    tutor,
    learner: makeMockLearner(), // plain: no self-repair — isolates the tutor channel
  };
}
