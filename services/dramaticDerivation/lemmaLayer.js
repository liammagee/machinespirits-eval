/**
 * Lemma layer — a maintained proof structure one level above the per-turn
 * premise grain (LEMMA-LAYER-PREREGISTRATION.md).
 *
 * The lemma DAG is COMPUTED from the world's authored proof path via the
 * engine's own chainer (nodes = the derived facts of S's proof, S included;
 * exactly the objects the Gate-0 audit counted) — never authored, never an
 * LLM estimate. Clearance is criterial: a lemma is grounded iff its fact is
 * derivable from the learner's currently grounded assertions, so under decay
 * a lemma can UN-ground and the frontier moves backward with no appraisal
 * call. The frontier is the set of ungrounded lemmas whose lemma-parents are
 * all grounded — the formal object the outer loop decides over.
 *
 * Concealment discipline: the TUTOR rendering may name every lemma (the
 * tutor holds the full premise ledger already). The LEARNER mirror renders
 * only what the learner's own grounded assertions support — grounded lemmas
 * by name, everything else as counts and shape, never content
 * (tests/dramaticDerivationWorlds.test.js-style concealment applies).
 */
import { closure, factKey } from './chainer.js';

export const LEMMA_DEFAULTS = Object.freeze({
  display: false,
  bind: false,
  refusalTrigger: 'regression',
  mockUntagged: false,
  mockBadChoice: false,
  mockRefusal: false,
});

export function normalizeLemmaConfig(raw) {
  if (!raw) return null;
  const src = raw === true || raw === 'on' ? { display: true } : typeof raw === 'string' ? JSON.parse(raw) : raw;
  const config = { ...LEMMA_DEFAULTS };
  if (typeof src.display === 'boolean') config.display = src.display;
  if (typeof src.bind === 'boolean') config.bind = src.bind;
  // Refusal trigger source: 'regression' (decay evidence — the promotion
  // stack, default) or 'stall' (no-D-progress span — the frontier-tier
  // variant, refusal-stall-trigger-codex.md).
  if (src.refusalTrigger === 'regression' || src.refusalTrigger === 'stall') {
    config.refusalTrigger = src.refusalTrigger;
  }
  // test-only knob: the MOCK backend omits the departure tag so gates can
  // exercise the block path; the real backend never reads it.
  if (typeof src.mockUntagged === 'boolean') config.mockUntagged = src.mockUntagged;
  if (typeof src.mockBadChoice === 'boolean') config.mockBadChoice = src.mockBadChoice;
  if (src.mockRefusal === 'defend' || src.mockRefusal === 'switch') config.mockRefusal = src.mockRefusal;
  if (config.bind) config.display = true; // binding always carries the map signal
  if (!config.display && !config.bind) return null;
  return config;
}

export function lemmaLabel(fact) {
  return `${fact[0]}(${fact.slice(1).join(', ')})`;
}

/**
 * Compute the lemma DAG from the world's first authored proof path.
 *
 * @returns {{nodes: Array<{key, fact, label, isGoal, parents: string[],
 *   directBase: string[], support: string[]}>, byKey: Map, goalKey: string,
 *   proofPremiseIds: Set<string>}|null} null when the path does not entail S
 *   (worlds are plot-linted, so this is a config error surfaced upstream).
 */
export function buildLemmaDag(world) {
  const path = world.proofPaths?.[0];
  if (!path) return null;
  const byId = new Map(world.premises.map((p) => [p.id, p]));
  const idByKey = new Map(world.premises.map((p) => [factKey(p.fact), p.id]));
  const baseFacts = path.premises.map((id) => byId.get(id).fact);
  const { facts, proofs } = closure(baseFacts, world.rules);
  const goalKey = factKey(world.secret.fact);
  if (!facts.has(goalKey)) return null;

  const byKey = new Map();
  const stack = [goalKey];
  while (stack.length) {
    const key = stack.pop();
    const proof = proofs.get(key);
    if (!proof || byKey.has(key)) continue; // base fact or already expanded
    const parents = [];
    const directBase = [];
    for (const premKey of proof.premises) {
      if (proofs.get(premKey)) {
        parents.push(premKey);
        stack.push(premKey);
      } else if (idByKey.has(premKey)) {
        directBase.push(idByKey.get(premKey));
      }
    }
    byKey.set(key, {
      key,
      fact: facts.get(key),
      label: lemmaLabel(facts.get(key)),
      isGoal: key === goalKey,
      parents,
      directBase,
      support: [],
    });
  }
  // transitive base support, and the set of premises that feed ANY lemma
  const proofPremiseIds = new Set();
  const supportOf = (key, seen = new Set()) => {
    if (seen.has(key)) return new Set();
    seen.add(key);
    const node = byKey.get(key);
    const out = new Set(node.directBase);
    for (const p of node.parents) for (const id of supportOf(p, seen)) out.add(id);
    return out;
  };
  for (const node of byKey.values()) {
    node.support = [...supportOf(node.key)].sort();
    for (const id of node.support) proofPremiseIds.add(id);
  }
  // deterministic node order: by depth then label (stable across runs)
  const depthOf = new Map();
  const depth = (key) => {
    if (depthOf.has(key)) return depthOf.get(key);
    const node = byKey.get(key);
    const d = node.parents.length ? 1 + Math.max(...node.parents.map(depth)) : 1;
    depthOf.set(key, d);
    return d;
  };
  const nodes = [...byKey.values()].sort((a, b) => depth(a.key) - depth(b.key) || (a.label < b.label ? -1 : 1));
  return { nodes, byKey, goalKey, proofPremiseIds };
}

/**
 * Criterial clearance against the learner's grounded assertions.
 * groundedFacts = the engine's valid grounded board (background included).
 */
export function computeLemmaState(dag, groundedFacts, rules) {
  const derivable = closure(groundedFacts, rules).facts;
  const groundedKeys = new Set();
  for (const node of dag.nodes) if (derivable.has(node.key)) groundedKeys.add(node.key);
  const frontier = dag.nodes
    .filter((n) => !groundedKeys.has(n.key) && n.parents.every((p) => groundedKeys.has(p)))
    .map((n) => n.key);
  return { groundedKeys, frontier, goalGrounded: groundedKeys.has(dag.goalKey) };
}

/** Ungrounded-and-unreleased base premises of one lemma (its live support). */
export function supportRemaining(dag, lemmaKey, releasedIds) {
  const node = dag.byKey.get(lemmaKey);
  if (!node) return [];
  return node.support.filter((id) => !releasedIds.has(id));
}

/**
 * Release-eligibility partition under BIND for one candidate premise id.
 * Mirror/background fuel (feeding no lemma) is always exempt; harness-forced
 * plays are adjudicated by the caller (they pass through with a log line).
 */
export function classifyRelease(dag, activeLemmaKey, premiseId) {
  if (!dag.proofPremiseIds.has(premiseId)) return 'exempt';
  const active = activeLemmaKey ? dag.byKey.get(activeLemmaKey) : null;
  if (active && active.support.includes(premiseId)) return 'in_support';
  return 'out_of_support';
}

/** Tutor-side rendering: full map (the tutor already holds the ledger). */
export function renderTutorLemmaLines(dag, state, activeLemmaKey, { bind = false } = {}) {
  const lines = [
    'THE LEMMA MAP (the proof one level up — computed by the harness from the',
    "learner's own grounded assertions; it moves only when their board does):",
  ];
  for (const node of dag.nodes) {
    const mark = state.groundedKeys.has(node.key)
      ? 'GROUNDED'
      : state.frontier.includes(node.key)
        ? 'FRONTIER'
        : 'locked';
    const active = activeLemmaKey === node.key ? '  << ACTIVE' : '';
    lines.push(`- [${mark}] ${node.label}${node.isGoal ? ' (the question itself)' : ''}${active}`);
  }
  if (bind) {
    lines.push(
      'Your releases of proof exhibits are bound to the ACTIVE lemma: only its',
      'unplayed support exhibits are yours to play freely. Playing a proof',
      'exhibit outside it requires "lemma_departure": a one-line justification',
      '(untagged departures are held by the harness). Colour exhibits that feed',
      'no lemma are unrestricted. Harness-forced plays override this binding.',
    );
  }
  return lines;
}

/**
 * Learner-side mirror: STRICT concealment — grounded lemmas by name (their
 * own achievement), everything ungrounded as count/shape only.
 */
export function renderLearnerLemmaLines(dag, state) {
  const groundedLabels = dag.nodes.filter((n) => state.groundedKeys.has(n.key) && !n.isGoal).map((n) => n.label);
  const remaining = dag.nodes.filter((n) => !state.groundedKeys.has(n.key) && !n.isGoal).length;
  const lines = ['YOUR PROOF LEDGER (what your own grounded facts establish, one level up):'];
  if (groundedLabels.length) for (const label of groundedLabels) lines.push(`- established: ${label}`);
  else lines.push('- nothing established yet above the bare facts');
  lines.push(
    remaining > 0
      ? `- ${remaining} intermediate link${remaining === 1 ? '' : 's'} remain unproven before the question can close (contents unknown to you until your facts force them)`
      : state.goalGrounded
        ? '- every link is in place: your facts force the answer'
        : '- every intermediate link is in place: the closing inference remains',
  );
  return lines;
}
