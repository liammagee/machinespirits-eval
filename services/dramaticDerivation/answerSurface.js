/**
 * Answer-surface normalisation: the bridge between an authored world constant
 * (`pipersGullet`) and the natural English a learner actually speaks
 * ("Piper's Gullet's bolted shutter").
 *
 * This bridge is load-bearing well beyond spelling. A dialogue terminates only
 * when the learner's assertion is recognised as the concealed answer, so the
 * chain runs:
 *
 *   learner text -> answer match -> assertion -> assertedSecret
 *     -> strictGrounded -> closure frame `mandatory` -> tutor closes
 *
 * When the match fails the frame never becomes mandatory, the tutor has no
 * terminal instruction, and the dialogue runs to its safety cap. The failure is
 * silent: `assertedSecret: false` reads identically whether the learner never
 * concluded or we simply could not see that they did.
 *
 * Normalisation, in order:
 *   1. fold diacritics, so "Côte" and "Cote" agree;
 *   2. elide apostrophes *before* tokenising - an apostrophe is intra-word in
 *      English, so "Piper's" is one token, not "Piper" + "s";
 *   3. split camelCase boundaries, so authored constants decompose into words;
 *   4. reduce every remaining non-alphanumeric run to a single space;
 *   5. fold each token: a trailing inflectional "s" comes off, and a small
 *      number word becomes its digit.
 *
 * Step 5 is what makes the genitive tractable. English marks both possessive
 * and plural with a trailing s, and authored constants bake that in
 * inconsistently: `pipersGullet` keeps the genitive s on the first word and
 * drops it on the second. So "Piper's Gullet's shutter" has to reach
 * `pipersGullet` even though one word gained an s and the other did not.
 * Folding both sides to a bare stem lets the two orthographies converge without
 * anyone having to guess which words the author inflected.
 *
 * Deliberately NOT normalised: acronym runs (`HTTPServer` -> `HTTP Server`).
 * That rule mis-splits elided names - "O'Brien" becomes "OBrien" and then
 * "O Brien", which no longer matches the constant `obrien`. The derivation
 * worlds use camelCase particulars, not acronyms, so it would add risk without
 * buying anything.
 */

const APOSTROPHES = /['‘’ʼʻ´`＇]/gu;
const COMBINING_MARKS = /\p{M}+/gu;
const CAMEL_BOUNDARY = /([\p{Ll}\p{N}])(\p{Lu})/gu;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;

/**
 * Below this length a trailing "s" is more likely to be part of the stem
 * ("is", "as", "gas") than an inflection, so it is left alone.
 */
const MIN_INFLECTION_FOLD_LENGTH = 4;

/**
 * Authors name the same particular both ways - the constant `grebeNine` against
 * prose that says "Grebe-9" - and no learner is going to type "Grebe nine".
 * A closed set of small numbers is safe to fold: these are spellings of one
 * token, not a guess about meaning.
 */
const NUMBER_WORDS = new Map(
  [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
    'twenty',
  ].map((word, digit) => [word, String(digit)]),
);

/** Longest phrase, in words, still treated as a name rather than a claim. */
export const MAX_ANSWER_NAME_WORDS = 4;

/**
 * Reduce any value - an authored constant, a learner utterance, a premise
 * surface - to a space-delimited lowercase word sequence.
 */
export function normalizeAnswerSurface(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(APOSTROPHES, '')
    .replace(CAMEL_BOUNDARY, '$1 $2')
    .replace(NON_ALPHANUMERIC, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

function foldToken(token) {
  const numeral = NUMBER_WORDS.get(token);
  if (numeral) return numeral;
  return token.length >= MIN_INFLECTION_FOLD_LENGTH && token.endsWith('s') ? token.slice(0, -1) : token;
}

/** Normalised, inflection-folded word list. */
export function answerSurfaceTokens(value) {
  const normalized = normalizeAnswerSurface(value);
  return normalized ? normalized.split(' ').map(foldToken) : [];
}

function tokenSequenceIndex(haystack, needle, from = 0) {
  if (!needle.length || needle.length > haystack.length) return -1;
  for (let start = from; start <= haystack.length - needle.length; start += 1) {
    if (needle.every((token, offset) => haystack[start + offset] === token)) return start;
  }
  return -1;
}

function containsTokenSequence(haystack, needle) {
  return tokenSequenceIndex(haystack, needle) >= 0;
}

/**
 * Does `text` name `value`? Matching is on whole word sequences, so `tibbin`
 * is not found inside an unrelated longer word.
 */
export function answerSurfaceMentioned(text, value) {
  const needle = answerSurfaceTokens(value);
  if (!needle.length) return false;
  return containsTokenSequence(answerSurfaceTokens(text), needle);
}

/**
 * Return the exact authored recognition surface contained in `text`.
 *
 * Unlike answer-name matching, these surfaces are complete public clauses
 * whose equivalence to a premise or conclusion has been asserted by the
 * world author. The matcher deliberately performs no semantic guessing: it
 * only folds spelling, punctuation, possessives, and inflection in the same
 * way as the answer bridge, then requires the authored token sequence.
 */
export function matchAuthoredRecognitionSurface(text, surfaces = []) {
  for (const surface of Array.isArray(surfaces) ? surfaces : []) {
    if (answerSurfaceMentioned(text, surface)) return String(surface).trim();
  }
  return null;
}

/**
 * Match an author-declared claim pattern without asking a model to decide
 * semantic equivalence.
 *
 * Each `all_of` row is a group of alternative public fragments; one fragment
 * from every group must occur, in group order when `ordered` is true.
 * `none_of` fragments fail the pattern closed.
 * This is intentionally more expressive than a single exact recognition
 * surface, but it remains a finite, inspectable author contract rather than
 * fuzzy similarity.
 */
export function matchAuthoredRecognitionPattern(text, patterns = []) {
  const textTokens = answerSurfaceTokens(text);
  for (const pattern of Array.isArray(patterns) ? patterns : []) {
    const excluded = (pattern?.none_of || []).find((surface) => answerSurfaceMentioned(text, surface));
    if (excluded) continue;
    const matchedAlternatives = [];
    let cursor = 0;
    let complete = true;
    for (const alternatives of pattern?.all_of || []) {
      const candidates = alternatives
        .map((surface) => {
          const tokens = answerSurfaceTokens(surface);
          return {
            surface,
            tokens,
            index: tokenSequenceIndex(textTokens, tokens, pattern.ordered === true ? cursor : 0),
          };
        })
        .filter((row) => row.index >= 0)
        .sort((left, right) => left.index - right.index || right.tokens.length - left.tokens.length);
      const matched = candidates[0];
      if (!matched) {
        complete = false;
        break;
      }
      matchedAlternatives.push(String(matched.surface).trim());
      if (pattern.ordered === true) cursor = matched.index + matched.tokens.length;
    }
    if (complete && matchedAlternatives.length) {
      return {
        id: String(pattern.id).trim(),
        matchedAlternatives,
      };
    }
  }
  return null;
}

/**
 * Resolve either an exact authored clause or a structured authored pattern.
 * Exact clauses retain precedence for backward-compatible trace attribution.
 */
export function matchAuthoredRecognitionClaim(text, { surfaces = [], patterns = [] } = {}) {
  const matchedSurface = matchAuthoredRecognitionSurface(text, surfaces);
  if (matchedSurface) {
    return {
      kind: 'surface',
      matchedSurface,
      matchedPattern: null,
      matchedAlternatives: [],
    };
  }
  const pattern = matchAuthoredRecognitionPattern(text, patterns);
  return pattern
    ? {
        kind: 'pattern',
        matchedSurface: null,
        matchedPattern: pattern.id,
        matchedAlternatives: pattern.matchedAlternatives,
      }
    : null;
}

/**
 * The constant a free-text answer should be recorded under when it names no
 * candidate the learner's record entails.
 *
 * A learner can name something outside the entailed set - the mirror suspect,
 * or a guess from beyond the world - and that is still an assertion, a wrong
 * one, which the assessment needs to see. But only a *name* can be minted this
 * way. A whole sentence ("The loaves cool after launch, not in Tibbin's
 * baking") is a claim about the answer, not the answer's name, and minting a
 * constant from it fabricates a fact no rule can support - which then surfaces
 * as a phantom unsupported assertion and a false `premature_assertion` verdict.
 * Returning null for those leaves the caller to record an explicit rejection
 * instead, which is the truthful outcome: we could not resolve what was named.
 *
 * Not handled, by design: denial. "Not Tibbin" names Tibbin, and nothing here
 * tells affirmation from negation. That is why only short name-shaped phrases
 * are minted at all - it keeps an unresolved claim unresolved rather than
 * guessing at its polarity.
 */
export function mintAnswerConstant(value) {
  const words = normalizeAnswerSurface(value).split(' ').filter(Boolean);
  if (!words.length || words.length > MAX_ANSWER_NAME_WORDS) return null;
  const [head, ...rest] = words;
  return [head, ...rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1))].join('');
}
