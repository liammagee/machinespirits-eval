/**
 * Belief–Desire DAG — structural scaffold (v0) for the role-playing arc.
 *
 * Implements the load-bearing pieces of BELIEF-DESIRE-DAG.md §13 as pure,
 * deterministic structure (no model calls, no eval, no DB). Two things:
 *
 *  - buildTutorDesireDag(world): the tutor's desire-DAG IS the belief-proof of
 *    the secret, inverted into desire-nodes (Aristotle's practical syllogism,
 *    §3). We reuse the chainer's `proofTree` rather than re-deriving backward —
 *    the leaves come out as exactly the proof-path premises (the releases the
 *    tutor must bring about). This makes "pacing = practical inference" (§9
 *    move #3) executable and checkable against a real world.
 *
 *  - reverse(states): role reversal (§12) as the index swap T<->L (D fixed)
 *    PLUS the content-transformation — seeding the "dependence proposition" on
 *    the surpassed party. The swap is necessary, not sufficient; reversal
 *    consummates only when that dependence is grounded.
 *
 * Seam-safe: imports only sibling chainer primitives; no tutor-core, no eval
 * layer.
 */

import { factKey, proofTree } from './chainer.js';

export const BELIEF_DESIRE_SCHEMA = 'machinespirits.derivation.belief-desire.v0';

// Origins a desire-node can have (BELIEF-DESIRE-DAG.md §13, extended in §12).
export const DESIRE_ORIGINS = Object.freeze([
  'root_end', // a bearer's seeded end (e.g. the tutor's "learner holds S")
  'practical_subgoal', // derived by backward chaining through a belief-rule
  'false_object', // mirror-seeded (the imaginary lure)
  'given', // a base fact the learner already starts grounded in (background)
  'dependence', // the §12 content-transformation forced on a surpassed party
]);

const WEBER_MODES = Object.freeze(['charismatic', 'traditional', 'rational_legal']);

function premiseIndex(world) {
  const map = new Map();
  for (const p of world.premises || []) map.set(factKey(p.fact), p.id);
  return map;
}

/** A desire-node: Des_bearer(content). `content` is a proposition about a fact. */
export function desireNode({
  id,
  bearer,
  content,
  order = 0,
  origin = 'practical_subgoal',
  fulfilledBy = null,
  slot = null,
  extra = {},
}) {
  return {
    id,
    kind: 'desire',
    statement: { content, attitude: 'Des', bearer, order },
    slot,
    fulfilledBy,
    fulfilled: false,
    origin,
    ...extra,
  };
}

/** A decomposable recognition Rec_a(b, π) (§4, §11a). Components start unbuilt. */
export function recognitionNode({
  recogniser,
  recognised,
  standing,
  authorizer = 'D',
  mode = 'rational_legal',
  believedByRecognised = true,
}) {
  if (!WEBER_MODES.includes(mode)) throw new Error(`unknown Weber mode "${mode}"`);
  return {
    kind: 'recognition',
    recogniser,
    recognised,
    standing,
    beliefComponent: null, // Bel_a(π(b)) — to be linked
    conferral: false, // status actually conferred vs merely believed
    authority: { authorizer, mode, believedByRecognised }, // §11a: force ∝ Bel_recognised(auth_D(a))
    held: false, // grounded vs merely uttered (§8)
  };
}

/**
 * The tutor's desire-DAG = the belief-proof of the secret, inverted.
 * Leaves are the premises the tutor must get the learner to hold (the releases).
 */
export function buildTutorDesireDag(world) {
  const base = [...(world.background || []), ...world.premises.map((p) => p.fact)];
  const tree = proofTree(base, world.rules, world.secret.fact);
  if (!tree) {
    return {
      schema: BELIEF_DESIRE_SCHEMA,
      bearer: 'T',
      derivable: false,
      nodes: [],
      edges: [],
      leaves: [],
      root: null,
    };
  }
  const byPremise = premiseIndex(world);
  const nodes = [];
  const edges = [];
  const seen = new Map(); // factKey -> nodeId

  const visit = (node) => {
    const key = factKey(node.fact);
    if (seen.has(key)) return seen.get(key);

    if (node.base) {
      // a leaf: Des_T(holds_L premise), or a given-background fact
      const premiseId = byPremise.get(key) || null;
      const id = `des:hold:${premiseId || key}`;
      nodes.push(
        desireNode({
          id,
          bearer: 'T',
          content: { rel: 'holds_L', premise: premiseId, fact: node.fact },
          origin: premiseId ? 'practical_subgoal' : 'given',
          extra: { leaf: true, premiseId },
        }),
      );
      seen.set(key, id);
      return id;
    }

    // an intermediate / the root: Des_T(grounded_L fact)
    const id = `des:ground:${key}`;
    nodes.push(
      desireNode({
        id,
        bearer: 'T',
        content: { rel: 'grounded_L', of: node.fact },
        origin: 'practical_subgoal',
        extra: { rule: node.rule, fact: node.fact },
      }),
    );
    seen.set(key, id);
    for (const premise of node.premises) {
      const childId = visit(premise);
      edges.push({ kind: 'practical', from: id, to: childId, rule: node.rule });
    }
    return id;
  };

  const root = visit(tree);
  const leaves = nodes
    .filter((n) => n.leaf && n.premiseId)
    .map((n) => n.premiseId)
    .sort();
  // re-tag the root's origin as the bearer's end
  const rootNode = nodes.find((n) => n.id === root);
  if (rootNode) rootNode.origin = 'root_end';
  return { schema: BELIEF_DESIRE_SCHEMA, bearer: 'T', derivable: true, nodes, edges, leaves, root };
}

/**
 * The learner's seed desires: first-order (de dicto, the answer-slot) and
 * second-order (recognition). BELIEF-DESIRE-DAG.md §4.
 */
export function seedLearnerDesires(world) {
  const slotVar = (world.questionPattern || []).find((a) => typeof a === 'string' && a.startsWith('?')) || '?x';
  const firstOrder = desireNode({
    id: 'des:L:first',
    bearer: 'L',
    content: { rel: 'grounded_L', of: world.questionPattern }, // ∃x. Q(x)
    origin: 'root_end',
    slot: { var: slotVar, binding: null }, // de dicto; binding may later become the mirror (§9)
  });
  const recognition = recognitionNode({
    recogniser: 'T',
    recognised: 'L',
    standing: { rel: 'derived', of: world.secret.fact },
  });
  const secondOrder = desireNode({
    id: 'des:L:recognition',
    bearer: 'L',
    content: recognition,
    order: 1,
    origin: 'root_end',
    extra: { recognition },
  });
  return { firstOrder, secondOrder };
}

/**
 * The dependence proposition δ (§12): what a surpassed party must come to
 * ground — that the OTHER bore the truth (its own standing was borrowed).
 */
export function dependenceProposition(victor) {
  return { rel: 'truthBearer', who: victor };
}

/**
 * Role reversal R (§12). Index swap T<->L (D fixed) PLUS the content-
 * transformation: seed δ on the surpassed party. NECESSARY ONLY — `consummated`
 * stays false until that dependence desire is grounded.
 */
export function reverse(states = { T: null, L: null, D: null }, { surpassed = 'T' } = {}) {
  const swap = (b) => (b === 'T' ? 'L' : b === 'L' ? 'T' : b); // D and any other index untouched
  const victor = swap(surpassed);
  const swapped = { T: states.L ?? null, L: states.T ?? null, D: states.D ?? null };
  const seeded = desireNode({
    id: `des:dependence:${surpassed}`,
    bearer: swap(surpassed), // the surpassed party now occupies the swapped index
    content: { rel: 'grounded', of: dependenceProposition(victor) },
    origin: 'dependence',
  });
  return {
    schema: BELIEF_DESIRE_SCHEMA,
    swap: { T: swap('T'), L: swap('L'), D: 'D' },
    states: swapped,
    seeded,
    consummated: false,
  };
}
