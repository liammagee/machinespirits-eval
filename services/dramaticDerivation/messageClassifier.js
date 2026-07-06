/**
 * Text-only learner-message classifier over proof-DAG regions
 * (workplan/items/classifier-dag-register.md, Phase A).
 *
 * The AUDITED sensor: deterministic, lexical, chain-grain. Phase A
 * (142 runs, 2,930 learner turns, labels from the engine's own derive
 * channel — never from text) measured 87.2% chain-level accuracy with
 * the goal region excluded from the codomain; node grain is NOT licensed
 * (within-chain siblings share vocabulary by construction). Bare mirror
 * mention saturates these dramas (58.9% of learner lines), so mirror is
 * the RESIDUAL class: mirror term present AND no lemma region scored.
 *
 * This module is the single source of truth — the Phase A audit script
 * and the Phase B register router both import from here, so the shipped
 * sensor is exactly the audited one.
 */

const STOPWORDS = new Set(
  `the a an and or but of to in on at by for with from as is are was were be been has have had it its this that these those
   i you he she we they them his her their our your my me us who whom whose which what when where why how not no yes so if
   then than too very just about into over under out up down off again once more most other some such only own same can
   will would should could may might must do does did done say said says one two first last next now here there
   coin coins shilling shillings false work works hand hands man men town room record book question answer answers`
    .split(/\s+/)
    .filter(Boolean),
);

export function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Region lexicons: tf-weighted, lemma-first. Each region's raw multiset =
 * predicate-derived tokens (camel-split, weighted high), fact args, and
 * support-premise surfaces. Token weight = raw weight / number of regions
 * containing the token (soft distinctiveness — nested supports keep their
 * own predicate anchors instead of draining to a superset sibling). The
 * GOAL region is excluded from the codomain: its support is the union of
 * every chain's, making it a superset attractor (Phase A measured it
 * stealing ~17% of labeled turns) — and the router never routes to the
 * join anyway.
 */
export function buildRegionLexicons(world, dag) {
  const raw = new Map(); // regionKey -> Map(token -> weight)
  const bump = (m, t, w) => m.set(t, (m.get(t) || 0) + w);
  for (const node of dag.nodes) {
    if (node.isGoal) continue;
    const m = new Map();
    tokens(node.fact[0].replace(/([A-Z])/g, ' $1')).forEach((t) => bump(m, t, 3));
    for (const part of node.fact.slice(1)) tokens(part).forEach((t) => bump(m, t, 2));
    for (const pid of node.support) {
      const prem = world.premiseById.get(pid);
      if (prem?.surface) tokens(prem.surface).forEach((t) => bump(m, t, 1));
      if (prem?.fact) for (const part of prem.fact.slice(1)) tokens(part).forEach((t) => bump(m, t, 1));
    }
    raw.set(node.key, m);
  }
  const regionCount = new Map();
  for (const m of raw.values()) for (const t of m.keys()) regionCount.set(t, (regionCount.get(t) || 0) + 1);
  const lex = new Map();
  for (const [key, m] of raw) {
    const weighted = new Map();
    for (const [t, w] of m) weighted.set(t, w / regionCount.get(t));
    lex.set(key, weighted);
  }
  return lex;
}

/**
 * Chain map: group nodes by which subtree under the goal they belong to
 * (the goal's direct lemma-parents root the chains; the goal maps to
 * 'goal'). Register routing operates at chain grain.
 */
export function buildChainMap(dag) {
  const goal = dag.nodes.find((n) => n.isGoal);
  const userOf = new Map(); // sub-lemma key -> the node that uses it
  for (const node of dag.nodes) for (const p of node.parents || []) userOf.set(p, node.key);
  const chainOf = new Map();
  for (const node of dag.nodes) {
    if (node.isGoal) {
      chainOf.set(node.key, 'goal');
      continue;
    }
    let cur = node.key;
    let guard = 0;
    while (guard++ < 50) {
      const up = userOf.get(cur);
      if (!up || up === goal.key) break;
      cur = up;
    }
    chainOf.set(node.key, cur);
  }
  return chainOf;
}

/**
 * Lemma-first classification: score regions by weighted token overlap
 * (strict argmax, threshold 1); mirror is the RESIDUAL (mirror term
 * present AND no lemma region scored); else 'neither'.
 */
export function classifyMessage(text, lexicons, mirrorTerm) {
  const toks = new Set(tokens(text));
  let best = null;
  let bestScore = 0;
  let second = 0;
  for (const [key, lex] of lexicons) {
    let score = 0;
    for (const t of toks) if (lex.has(t)) score += lex.get(t);
    if (score > bestScore) {
      second = bestScore;
      best = key;
      bestScore = score;
    } else if (score > second) {
      second = score;
    }
  }
  if (bestScore >= 1 && bestScore > second) return { label: best, score: bestScore };
  if (mirrorTerm && toks.has(mirrorTerm)) return { label: 'mirror', score: 0 };
  return { label: 'neither', score: 0 };
}
