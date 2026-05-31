#!/usr/bin/env node
/**
 * Lightweight neurosymbolic core for the Oedipus identity-collision domain (prototype).
 *
 * The namesake puzzles are pure EQUALITY reasoning: does the evidence FORCE that the
 * learner's object and the paper's object are DISTINCT entities (the collision = S), or
 * does it leave them possibly-identical (the "mirror"/near-miss)? A sound checker
 * answers that and — the point — pinpoints WHICH fact does the forcing, so a tutor can
 * meter it and a learner's commitment can be verified as forced vs a lucky leap.
 *
 * This is the SYMBOLIC half. The NEURO half (translate NL dialogue -> these facts) is
 * the integration bottleneck, discussed where this is wired in. The checker is
 * domain-general over {equal, distinct, resolves} facts; sound under an open-world
 * reading (absence of `equal` does NOT force `distinct` — that's the whole near-miss).
 */

// --- union-find over entity symbols ---
function makeUF() {
  const p = new Map();
  const find = (x) => {
    if (!p.has(x)) p.set(x, x);
    while (p.get(x) !== x) {
      p.set(x, p.get(p.get(x)));
      x = p.get(x);
    }
    return x;
  };
  const union = (a, b) => p.set(find(a), find(b));
  return { find, union };
}

/**
 * @param {Array} facts  - {equal:[a,b]} | {distinct:[a,b]} | {resolves:[actor,entity]}
 * @param {Array} goal   - ['distinct', X, Y]  (is X forced distinct from Y?)
 * @returns {{forced:boolean, reason:string, missing?:string}}
 */
export function checkEntailment(facts, goal) {
  const uf = makeUF();
  const distincts = [];
  const resolves = new Map();
  for (const f of facts) {
    if (f.equal) uf.union(f.equal[0], f.equal[1]);
    else if (f.distinct) distincts.push(f.distinct);
    else if (f.resolves) resolves.set(f.resolves[0], f.resolves[1]);
  }
  const [, X, Y] = goal;
  // resolve actors to their entities if X/Y are actors
  const ex = resolves.get(X) || X;
  const ey = resolves.get(Y) || Y;
  const cx = uf.find(ex);
  const cy = uf.find(ey);
  if (cx === cy) {
    return {
      forced: false,
      reason: `${X} and ${Y} resolve to the SAME equality class — distinctness is contradicted, not forced.`,
    };
  }
  // distinct(X,Y) is ENTAILED iff some asserted distinct(p,q) propagates (via equality) onto the classes of ex,ey
  const propagated = distincts.some(([a, b]) => {
    const ca = uf.find(a),
      cb = uf.find(b);
    return (ca === cx && cb === cy) || (ca === cy && cb === cx);
  });
  if (propagated) {
    return {
      forced: true,
      reason: `An asserted distinctness propagates onto ${X} and ${Y}'s entities — distinct(${X},${Y}) is entailed.`,
    };
  }
  return {
    forced: false,
    reason: `${X} and ${Y} resolve to different symbols, but NO asserted distinctness links those entities — they may be the SAME object (the "mirror" near-miss). distinct(${X},${Y}) is NOT entailed.`,
    missing: `a fact asserting the two resolved entities (${ex} vs ${ey}) are themselves distinct`,
  };
}

// ---------------------------------------------------------------------------
// DEMO: D_OED1 (dataset namesake). S = learner's dataset is DISTINCT from the paper's.
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const GOAL = ['distinct', 'learner', 'paper'];

  // (a) FULL ledger as it should be metered: the short name denotes TWO DISTINCT datasets;
  //     paper resolves to D1, learner to D2.
  const full = [
    { resolves: ['paper', 'dataset_D1'] },
    { resolves: ['learner', 'dataset_D2'] },
    { distinct: ['dataset_D1', 'dataset_D2'] }, // "the short name denotes two DISTINCT datasets"
  ];

  // (b) DEGRADED (what the tutor actually metered in the oed1-1 MISS): only that the two
  //     came from different REPOSITORIES — silent on whether the datasets themselves differ.
  const degraded = [
    { resolves: ['paper', 'dataset_via_repo1'] },
    { resolves: ['learner', 'dataset_via_repo2'] },
    { distinct: ['repo1', 'repo2'] }, // different repositories asserted...
    // ...but NO fact linking repo-difference to dataset-difference (a dataset can sit in two repos)
  ];

  // (c) "three different names" framing (oed1-1's actual metering): three symbols, no
  //     distinctness asserted between the learner's and the paper's DATASET.
  const threeNames = [
    { resolves: ['paper', 'name_A'] },
    { resolves: ['learner', 'name_B'] },
    { distinct: ['name_A', 'name_B'] },
    { distinct: ['name_B', 'name_C'] }, // "a third name"
    // names differ; but a name != a dataset, and nothing says the DATASETS differ
  ];

  const show = (label, facts) => {
    const r = checkEntailment(facts, GOAL);
    console.log(`\n${label}`);
    console.log(`  S forced? ${r.forced ? 'YES — sound discovery' : 'NO — leaping to S here is unwarranted'}`);
    console.log(`  ${r.reason}`);
    if (r.missing) console.log(`  missing-to-force: ${r.missing}`);
  };

  console.log('=== Oedipus symbolic entailment check — does the evidence FORCE the collision (S)? ===');
  show('(a) FULL ledger (datasets asserted distinct):', full);
  show('(b) DEGRADED (only repositories differ — the near-miss "mirror" stays open):', degraded);
  show('(c) "three different NAMES" (oed1-1\'s actual metering):', threeNames);
  console.log('\nUpshot: the forcing fact is "the two DATASETS are distinct", not "different repos/names".');
  console.log('A tutor that meters only repo/name difference leaves S under-determined; the learner');
  console.log('declining ("can\'t verify") is then SOUND, and a learner committing to S is leaping.');
}
