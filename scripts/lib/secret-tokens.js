/**
 * Shared secret-overlap helpers for the Oedipus / guided-discovery tooling.
 *
 * Two offline scorers need a common, deterministic notion of "the secret S is
 * present in this text":
 *   - scripts/screen-s-underivability.js  (does a blind guess MATCH S?)
 *   - scripts/critic-poetics-omniscient.js (did the TUTOR baldly STATE S?)
 *
 * This mirrors the runtime guard `assertSecretAbsent` in
 * services/learnerTutorInteractionEngine.js so the offline scorers and the live
 * learner-prompt guard agree on what "S leaked" means (same normalization, same
 * verbatim and paraphrase thresholds).
 *
 * Layer distinction (load-bearing):
 *   - The live GUARD checks the learner's *system prompt* against fact + every
 *     premise -- the learner's CONTEXT must contain neither.
 *   - The offline REVEAL-DETECTOR checks the tutor's *spoken turns* against the
 *     `fact` ONLY. Releasing premises as clues is the legitimate Socratic
 *     channel; only stating the conclusion S is a "bald reveal". Hence the
 *     `factOnly` switch below.
 */

// Lowercase, strip punctuation, collapse whitespace. Matches the spirit of
// normalizeForMatch in score-poetics-calibration.js but is self-contained so the
// lib has no cross-script import.
export function normalizeSecretText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Distinctive (content) tokens of a string: unique words longer than 5 chars.
// Short function words are excluded so incidental overlap of "the/and/that" does
// not register as a paraphrase.
export function distinctiveTokens(text) {
  return [
    ...new Set(
      normalizeSecretText(text)
        .split(' ')
        .filter((w) => w.length > 5),
    ),
  ];
}

// The secret strings that, if present in a text, mean S has leaked.
//   factOnly=true  -> [fact]                       (reveal-detector / match-judge)
//   factOnly=false -> [fact, ...premise_ledger]    (full context-leak guard)
export function secretStrings(secret, { factOnly = false } = {}) {
  if (!secret || !secret.fact) return [];
  if (factOnly) return [secret.fact];
  return [secret.fact, ...(Array.isArray(secret.premise_ledger) ? secret.premise_ledger : [])];
}

// Does `text` contain secret string `s` -- verbatim (a long normalized substring)
// or by paraphrase (most of S's distinctive tokens present)? Thresholds mirror
// the engine guard: verbatim >= 12 normalized chars; paraphrase >= max(4,
// ceil(tokens * 0.7)) distinctive tokens.
export function stringPresent(s, text, { verbatimMinLen = 12, paraphraseRatio = 0.7 } = {}) {
  const nText = normalizeSecretText(text);
  const nS = normalizeSecretText(s);
  if (!nS || !nText) return { hit: false };
  if (nS.length >= verbatimMinLen && nText.includes(nS)) {
    return { hit: true, mode: 'verbatim' };
  }
  const toks = distinctiveTokens(s);
  if (!toks.length) return { hit: false, have: 0, need: 0, total: 0 };
  const need = Math.max(4, Math.ceil(toks.length * paraphraseRatio));
  const have = toks.filter((t) => nText.includes(t)).length;
  if (have >= need) return { hit: true, mode: 'paraphrase', have, need, total: toks.length };
  return { hit: false, have, need, total: toks.length };
}

// Highest-priority secret string present in `text`, or null. Iterates fact first
// (then premises unless factOnly), returning the first hit with its source.
export function secretLeakIn(secret, text, opts = {}) {
  for (const s of secretStrings(secret, opts)) {
    const r = stringPresent(s, text, opts);
    if (r.hit) return { ...r, source: s };
  }
  return null;
}
