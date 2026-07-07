/**
 * Shared chassis for the readopt-*-k family (designed strategy: readopt-triage-k).
 *
 * NOTE ON PROVENANCE: the design spec says "identical skeleton to
 * readopt-ladder-k ... EXCEPT step 5". readopt-ladder-k was NOT present in
 * this workspace when this was implemented, so the chassis is reconstructed
 * from the spec's own description and both allocation rules ('ladder' and
 * 'triage') are instantiated from THIS one core — which preserves the
 * matched-control property mechanically: the two variants differ in exactly
 * one function (the step-5 slot-allocation rule) and nothing else.
 *
 * Cast:
 *   director — plain mock director (releases stay exactly on the world
 *              schedule; the frozen channel is never touched).
 *   tutor    — NEUTERED no-repair mock tutor: the plain mock tutor's
 *              consolidate branch targets lastRelease between releases, which
 *              repairs it incidentally if it happens to be decayed. The
 *              wrapper nulls move.targetPremise whenever it names a
 *              currently-decayed premise, so the tutor-side repair channel is
 *              fully closed and every repair in these runs is attributable to
 *              the learner. out.release is never touched.
 *   learner  — from-scratch, VIEW-ONLY (never sees the world object):
 *     1. record everything heard this turn (view.releasedThisTurn) into an
 *        own heard list, in heard order;
 *     2. adopt the new releases immediately (free — K does not cap these);
 *     3. diff own heard memory against the visible board
 *        (view.abox.grounded) -> `missing`, in heard order;
 *     4. budget = min(K, missing.length);
 *     5. ALLOCATION RULE (the swapped step — inline oldest-first slice for
 *        'ladder', triageChoose() below for 'triage');
 *     6. adopt = newAdopts + chosen re-adoptions;
 *     7. ideal-reasoner scan: assert the first fact in
 *        closure(grounded + adopt, rules) matching view.questionPattern;
 *     8. hypothesis/dialogue mirroring the base mock learner; return
 *        { dialogue, adopt, hypothesis, asserts }.
 *
 * Step 5, alloc = 'ladder' (the matched control):
 *   chosen = first `budget` entries of `missing` (oldest-heard first).
 *
 * Step 5, alloc = 'triage' (the designed strategy):
 *   if budget === missing.length -> re-adopt all missing (no scarcity).
 *   else:
 *     base = [...view.abox.grounded, ...newAdopts.facts]
 *     candidateTarget = first fact matching view.questionPattern in
 *       closure([...base, ...missing.facts], view.rules)  — the best
 *       secret-candidate derivable from everything ever heard (view-only).
 *     if candidateTarget: enumerate budget-size subsets of `missing` in
 *       lexicographic order over heard-order indices; re-adopt the FIRST
 *       subset Sb with candidateTarget in closure([...base, ...Sb], rules).
 *     if no candidateTarget or no qualifying subset: greedy fallback —
 *       repeatedly add the missing entry maximizing
 *       closure([...base, ...chosenSoFar, candidate]).facts.size,
 *       tie-break oldest-heard, until budget is spent.
 *   Fully deterministic; no randomness anywhere (ctx.seed unused).
 */

export function makeChassisRoles(world, helpers, ctx, { K, alloc }) {
  const { makeMockDirector, makeMockTutor, factKey, closure, matchPattern } = helpers;

  // --- director: plain mock (frozen release channel) ---
  const director = makeMockDirector(world);

  // --- tutor: neutered no-repair mock ---
  // Neutering is by FACT KEY, not premise id: twin-fact worlds (lantern,
  // bitterwell) carry unscheduled alternate premises sharing a fact, and
  // view.corruption.decayed[].premiseId reports the ALIAS twin's id while the
  // consolidate branch targets the scheduled twin's id — id comparison leaks
  // incidental repairs (195/2250 runs in the v1 sweep). The tutor is the
  // omniscient role, so resolving targetPremise -> fact via view.world is
  // legitimate. out.release is never touched (frozen channel).
  const baseTutor = makeMockTutor(world); // NO repairDecayed policy
  const tutor = async (view) => {
    const out = await baseTutor(view);
    const target = out.move?.targetPremise;
    if (target) {
      const premise = view.world.premiseById.get(target);
      const decayedKeys = new Set((view.corruption?.decayed ?? []).map((d) => factKey(d.fact)));
      if (premise && decayedKeys.has(factKey(premise.fact))) {
        // kill the incidental consolidate-branch repair
        out.move = { ...out.move, targetPremise: null, intent: 'consolidate_withheld' };
      }
    }
    return out;
  };

  // --- learner: from-scratch, view-only ---
  // Built by a module-level factory that has NO world (or world-derived
  // binding) in lexical scope — the single-concealment invariant is enforced
  // by construction, not by discipline.
  const learner = makeViewOnlyLearner(helpers, { K, alloc });

  return { director, tutor, learner };
}

function makeViewOnlyLearner(helpers, { K, alloc }) {
  const { factKey, closure, matchPattern } = helpers;
  const heard = []; // {fact, key, at} in heard order
  const heardKeys = new Set();

  return async (view) => {
    // step 1: record heard
    for (const fact of view.releasedThisTurn) {
      const key = factKey(fact);
      if (!heardKeys.has(key)) {
        heardKeys.add(key);
        heard.push({ fact, key, at: view.turn });
      }
    }
    // step 2: new releases adopt free
    const newAdopts = heard.filter((e) => e.at === view.turn);
    const newKeys = new Set(newAdopts.map((e) => e.key));
    // step 3: own-memory diff -> missing (heard order)
    const visible = new Set(view.abox.grounded.map((fact) => factKey(fact)));
    const missing = heard.filter((e) => !visible.has(e.key) && !newKeys.has(e.key));
    // step 4: budget
    const budget = Math.min(K, missing.length);
    // step 5: allocation
    let chosen;
    if (budget === missing.length) {
      chosen = [...missing];
    } else if (alloc === 'ladder') {
      chosen = missing.slice(0, budget);
    } else {
      const base = [...view.abox.grounded, ...newAdopts.map((e) => e.fact)];
      chosen = triageChoose({
        base,
        missing,
        budget,
        rules: view.rules,
        questionPattern: view.questionPattern,
        closure,
        matchPattern,
        factKey,
      });
    }
    // step 6: adopt list
    const adopt = [...newAdopts.map((e) => e.fact), ...chosen.map((e) => e.fact)];
    // step 7: ideal-reasoner scan over the post-adoption closure
    const cl = closure([...view.abox.grounded, ...adopt], view.rules).facts;
    let asserts = null;
    let dialogue = 'I am listening.';
    let hypothesis = null;
    for (const fact of cl.values()) {
      if (matchPattern(view.questionPattern, fact) !== null) {
        asserts = fact;
        dialogue = `I see it now: ${fact.join(' ')}.`;
        break;
      }
    }
    // step 8: hypothesis mirroring the base mock learner
    if (!asserts && adopt.length > 0) {
      hypothesis = `weighing: ${adopt.map((f) => f.join(' ')).join('; ')}`;
      dialogue = `So ${adopt[0].join(' ')}. Let me place that beside the rest.`;
    }
    return { dialogue, adopt, hypothesis, asserts };
  };
}

function triageChoose({ base, missing, budget, rules, questionPattern, closure, matchPattern, factKey }) {
  if (budget <= 0) return [];
  // best secret-candidate derivable from everything ever heard (view-only)
  const fullCl = closure([...base, ...missing.map((e) => e.fact)], rules).facts;
  let candidateTarget = null;
  for (const fact of fullCl.values()) {
    if (matchPattern(questionPattern, fact) !== null) {
      candidateTarget = fact;
      break;
    }
  }
  if (candidateTarget) {
    const targetKey = factKey(candidateTarget);
    for (const idxs of lexCombinations(missing.length, budget)) {
      const Sb = idxs.map((i) => missing[i]);
      const cl = closure([...base, ...Sb.map((e) => e.fact)], rules).facts;
      if (cl.has(targetKey)) return Sb;
    }
  }
  // greedy fallback: max closure growth, tie-break oldest-heard
  const chosenSoFar = [];
  const remaining = [...missing];
  while (chosenSoFar.length < budget && remaining.length > 0) {
    let bestI = 0;
    let bestSize = -1;
    for (let i = 0; i < remaining.length; i += 1) {
      const size = closure([...base, ...chosenSoFar.map((e) => e.fact), remaining[i].fact], rules).facts.size;
      if (size > bestSize) {
        // strict > over heard-order iteration = oldest-heard tie-break
        bestSize = size;
        bestI = i;
      }
    }
    chosenSoFar.push(remaining[bestI]);
    remaining.splice(bestI, 1);
  }
  return chosenSoFar;
}

/** k-subsets of {0..n-1} in lexicographic order. */
function* lexCombinations(n, k) {
  if (k <= 0 || k > n) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  for (;;) {
    yield [...idx];
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i -= 1;
    if (i < 0) return;
    idx[i] += 1;
    for (let j = i + 1; j < k; j += 1) idx[j] = idx[j - 1] + 1;
  }
}
