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

import { factKey, proofTree, closure } from './chainer.js';

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

// ---------------------------------------------------------------------------
// Live symmetry (BELIEF-DESIRE-DAG.md §5): the learner side made first-class,
// mirroring the tutor, plus a learner->tutor model (the missing half of
// proxyDagMemory) and a whole-subject assembler that reverse() operates over.
// ---------------------------------------------------------------------------

/** A per-bearer state (the §13 BearerState): belief graph, desire graph, models of others. */
export function buildBearerState(
  bearer,
  { belief = { nodes: [], edges: [] }, desire = { nodes: [], edges: [] }, models = {} } = {},
) {
  return { bearer, belief, desire, models };
}

/** The learner's belief-DAG: what it has grounded from its held board (closure under R). */
export function buildLearnerBeliefDag(world, heldFacts = []) {
  const held = (heldFacts || []).filter((f) => Array.isArray(f) && f.length);
  const cl = closure(held, world.rules);
  const byPremise = premiseIndex(world);
  const nodes = [];
  for (const [key, fact] of cl.facts) {
    const derived = Boolean(cl.proofs.get(key));
    nodes.push({
      id: `bel:${key}`,
      kind: 'fact',
      statement: { content: fact, attitude: 'Bel', bearer: 'L', order: 0 },
      status: derived ? 'grounded' : 'held',
      grounded: true,
      source: byPremise.has(key) ? 'released_premise' : 'background_or_derived',
      premiseId: byPremise.get(key) || null,
    });
  }
  return {
    schema: BELIEF_DESIRE_SCHEMA,
    bearer: 'L',
    nodes,
    edges: [],
    secretGrounded: cl.facts.has(factKey(world.secret.fact)),
  };
}

/**
 * 𝔐_L(T): the learner's PUBLIC-ONLY model of the tutor's wants — the missing
 * half of proxyDagMemory, and the home of Lacan's "desire of the Other" (§5,
 * §11a). The learner reads the tutor as wanting it to fill the answer-slot but
 * cannot see the secret (audit.secretIncluded === false).
 */
export function buildLearnerTutorModel(world, { releasedPremiseIds = [], prompts = [] } = {}) {
  const inferredDesires = [
    desireNode({
      id: 'mLT:wants-slot',
      bearer: 'T',
      content: { rel: 'grounded_L', of: world.questionPattern },
      origin: 'root_end',
      slot: { var: '?x', binding: null },
    }),
  ];
  return {
    schema: BELIEF_DESIRE_SCHEMA,
    of: 'T',
    publicOnly: true,
    observedReleases: [...releasedPremiseIds],
    observedPrompts: [...prompts],
    inferredDesires,
    audit: { authoredPathsIncluded: false, secretIncluded: false },
  };
}

/** D's desire-DAG (§10): the aesthetic ends, read off the world's slope + mirror + schedule. */
export function buildDirectorDesireDag(world) {
  const node = (id, label, content) => ({
    id,
    kind: 'desire',
    statement: { content, attitude: 'Des', bearer: 'D', order: 0 },
    origin: 'root_end',
    label,
  });
  const nodes = [
    node('des:D:suspense', 'suspense', { rel: 'underivableBefore', secret: 'S', turn: world.slope.t_min }),
    node('des:D:temptation', 'temptation', { rel: 'mirrorTempting', mirror: world.mirror ? 'M' : null }),
    node('des:D:peripeteia', 'peripeteia', { rel: 'reversalOccurs' }),
    node('des:D:anagnorisis', 'anagnorisis', { rel: 'recognitionScene' }),
    node('des:D:noAporia', 'no_aporia', { rel: 'distanceDecreasesWithin', window: world.slope.aporia_window }),
  ];
  return {
    schema: BELIEF_DESIRE_SCHEMA,
    bearer: 'D',
    nodes,
    edges: [],
    note: 'plotLint is D’s satisfaction condition (§10)',
  };
}

/**
 * Assemble the whole synthetic-subject state for a world at a point in the run:
 * the three bearers {T, L, D}, each with its belief/desire graphs and models of
 * the others. This is the object the app renders and reverse() transforms.
 */
export function buildSubjectState(
  world,
  { learnerHeld = [], releasedPremiseIds = [], prompts = [], learnerDesireNodes = null, tutorDesireNodes = null } = {},
) {
  const tutorDesire = buildTutorDesireDag(world);
  const { firstOrder, secondOrder } = seedLearnerDesires(world);
  // learnerDesireNodes / tutorDesireNodes: injected riders from characterDesire.js
  // (which cannot be imported here — the seam is one-way). The learner default =
  // the generic proof-pattern seed; the tutor's proof-DAG gets any authored
  // second-order recognition APPENDED, so reverse() can read a recognition-seeking
  // tutor and classify the swap `mutual` (§12).
  const learnerDesire = learnerDesireNodes || [firstOrder, secondOrder];
  const tutorNodes = tutorDesireNodes ? [...tutorDesire.nodes, ...tutorDesireNodes] : tutorDesire.nodes;
  const directorDesire = buildDirectorDesireDag(world);
  return {
    world: world.id,
    T: buildBearerState('T', { desire: { nodes: tutorNodes, edges: tutorDesire.edges }, models: {} }),
    L: buildBearerState('L', {
      belief: buildLearnerBeliefDag(world, learnerHeld),
      desire: { nodes: learnerDesire, edges: [] },
      models: { T: buildLearnerTutorModel(world, { releasedPremiseIds, prompts }) },
    }),
    D: buildBearerState('D', { desire: { nodes: directorDesire.nodes, edges: directorDesire.edges } }),
  };
}

function relabelBearer(state, newBearer) {
  return state ? { ...state, bearer: newBearer } : state;
}

/** Find a second-order recognition desire-node in a bearer's desire graph (§4). */
function findRecognitionDesire(graph) {
  return (graph?.nodes || []).find((n) => n?.statement?.content?.kind === 'recognition') || null;
}

/**
 * Consummate a recognition desire-node at reversal: the anagnorisis marks the
 * recognition held + conferred IFF the reversal is licensed (the secret was
 * grounded). Returns a transformed CLONE — reverse() never mutates its input.
 */
function consummateRecognition(node, licensed) {
  if (!node) return null;
  const rec = node.statement?.content;
  const heldRec = rec ? { ...rec, held: licensed, conferral: licensed } : rec;
  return {
    ...node,
    statement: { ...node.statement, content: heldRec },
    fulfilled: licensed,
    consummatedAt: licensed ? 'reversal' : null,
    retiredFromRole: node.statement?.bearer || null,
  };
}

/**
 * Role reversal R (§12) over a live subject state. Index swap T<->L (D fixed)
 * PLUS two content-transformations:
 *
 *  - the dependence δ: seeded into the surpassed party's NEW desire graph.
 *    NECESSARY ONLY — `consummated` stays false until that δ is grounded.
 *
 *  - the second-order recognition: it travels with ROLE, not person (§4, §12).
 *    The pre-reversal learner's recognition is consummated by the anagnorisis
 *    (`licensed` = it has grounded the secret) and RETIRED from the side that
 *    became the tutor — a tutor does not seek D's verdict on itself. The side
 *    that became the learner keeps whatever recognition its pre-image carried:
 *    none → an *inverted* (one-way) reversal; some → a *mutual* one; an
 *    unlicensed swap is *premature* (the recognition is unearned).
 *
 * (Shallow bearer relabel; per-node statement.bearer relabel is a follow-up.)
 */
export function reverse(subject, { surpassed = 'T' } = {}) {
  const swap = (b) => (b === 'T' ? 'L' : b === 'L' ? 'T' : b);
  const victor = swap(surpassed);
  const newT = relabelBearer(subject.L, 'T');
  const newL = relabelBearer(subject.T, 'L');
  const surpassedNew = surpassed === 'T' ? newL : newT;

  const delta = desireNode({
    id: `des:dependence:${surpassed}`,
    bearer: swap(surpassed),
    content: { rel: 'grounded', of: dependenceProposition(victor) },
    origin: 'dependence',
  });
  if (surpassedNew?.desire?.nodes) {
    surpassedNew.desire = { ...surpassedNew.desire, nodes: [...surpassedNew.desire.nodes, delta] };
  }

  // The recognition node travels with role. licensed = the pre-reversal learner
  // grounded the secret (the anagnorisis trigger). Retire the learner's
  // recognition from the new tutor; classify by what the new learner inherits.
  const licensed = Boolean(subject.L?.belief?.secretGrounded);
  const learnerRec = findRecognitionDesire(subject.L?.desire);
  const newLearnerRec = findRecognitionDesire(subject.T?.desire);
  if (learnerRec && newT?.desire?.nodes) {
    newT.desire = { ...newT.desire, nodes: newT.desire.nodes.filter((n) => n !== learnerRec) };
  }
  const kind = !licensed ? 'premature' : newLearnerRec ? 'mutual' : 'inverted';

  return {
    world: subject.world,
    T: newT,
    L: newL,
    D: subject.D,
    swap: { T: 'L', L: 'T', D: 'D' },
    seeded: delta,
    consummated: false, // the δ-dependence is forward-looking — grounded later, not at the swap
    kind,
    recognition: {
      licensed,
      consummated: consummateRecognition(learnerRec, licensed), // the learner's 2nd-order → anagnorisis
      newLearnerSeeks: newLearnerRec
        ? { recogniser: newLearnerRec.recogniserFigure || newLearnerRec.statement?.content?.recogniser || null }
        : null,
    },
  };
}
