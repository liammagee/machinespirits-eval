/**
 * Deterministic forward chainer with proof trees — the symbolic half of the
 * dramatic-derivation arc (notes/2026-06-09-dramatic-derivation-plan.md §2.4).
 *
 * Facts are arrays of atoms (strings); rules are horn clauses whose `if`
 * patterns may bind "?variables". `entails`/`proofTree` are the
 * architecture-independent success channel (grounded anagnorisis = the
 * learner's OWN facts force the secret), so this module must stay free of
 * any model call and any source of nondeterminism. Sibling in spirit to
 * scripts/oedipus-symbolic-check.js (union-find over equality facts); this
 * one is generic over authored horn rules and produces full proof trees.
 */

export function factKey(fact) {
  return JSON.stringify(fact);
}

function isVar(atom) {
  return typeof atom === 'string' && atom.startsWith('?');
}

export function matchPattern(pattern, fact, bindings = {}) {
  if (!Array.isArray(pattern) || !Array.isArray(fact) || pattern.length !== fact.length) {
    return null;
  }
  const out = { ...bindings };
  for (let i = 0; i < pattern.length; i += 1) {
    const p = pattern[i];
    const f = fact[i];
    if (isVar(p)) {
      if (p in out && out[p] !== f) return null;
      out[p] = f;
    } else if (p !== f) {
      return null;
    }
  }
  return out;
}

function substitute(pattern, bindings) {
  return pattern.map((atom) => (isVar(atom) ? bindings[atom] : atom));
}

function* joinPatterns(patterns, known, index = 0, bindings = {}, premises = []) {
  if (index === patterns.length) {
    yield { bindings, premises };
    return;
  }
  for (const [key, fact] of known) {
    const next = matchPattern(patterns[index], fact, bindings);
    if (next) {
      yield* joinPatterns(patterns, known, index + 1, next, [...premises, key]);
    }
  }
}

/**
 * Closure of `baseFacts` under `rules`, to fixpoint. Derivations found in the
 * same pass are applied between passes (snapshot semantics), so the result and
 * the recorded first-proof of each fact are deterministic in input order.
 *
 * @returns {{facts: Map<string, string[]>, proofs: Map<string, {rule: string, premises: string[]}|null>}}
 */
export function closure(baseFacts, rules) {
  const known = new Map();
  const proofs = new Map();
  for (const fact of baseFacts) {
    const key = factKey(fact);
    if (!known.has(key)) {
      known.set(key, fact);
      proofs.set(key, null);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    const pending = [];
    const pendingKeys = new Set();
    for (const rule of rules) {
      for (const { bindings, premises } of joinPatterns(rule.if, known)) {
        for (const pattern of rule.then) {
          const derived = substitute(pattern, bindings);
          const key = factKey(derived);
          if (!known.has(key) && !pendingKeys.has(key)) {
            pendingKeys.add(key);
            pending.push({ key, fact: derived, proof: { rule: rule.id, premises } });
          }
        }
      }
    }
    for (const entry of pending) {
      known.set(entry.key, entry.fact);
      proofs.set(entry.key, entry.proof);
      changed = true;
    }
  }
  return { facts: known, proofs };
}

export function entails(baseFacts, rules, goal) {
  return closure(baseFacts, rules).facts.has(factKey(goal));
}

/**
 * Full proof of `goal` down to base facts ("which facts did the forcing"),
 * or null if not entailed.
 */
export function proofTree(baseFacts, rules, goal) {
  const { facts, proofs } = closure(baseFacts, rules);
  const goalKey = factKey(goal);
  if (!facts.has(goalKey)) return null;
  const expand = (key) => {
    const proof = proofs.get(key);
    if (!proof) return { fact: facts.get(key), base: true };
    return {
      fact: facts.get(key),
      base: false,
      rule: proof.rule,
      premises: proof.premises.map(expand),
    };
  };
  return expand(goalKey);
}
