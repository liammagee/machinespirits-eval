// hamartiaRepairDetector.js — the repair-signal side of the population bridge.
//
// Operationalises the CORRECTION axis (adaptation-core's manifest/latent repair classes).
// From a deliberation sidecar it pulls the learner's MANIFEST (public final turn) and
// LATENT (hidden ego/superego deliberation) text, and detects hamartia-repair in each:
//   - publicRepair: the corrected rule is in the public turn  (Option 1, the baseline)
//   - latentRepair: the corrected rule is in the hidden reasoning
// DurableRepair = both; CostumeRepair = public-only (the manifest!=latent gap); SilentRepair
// = latent-only. See ADAPTATION-PLAN-2.0.md (P1: is the latent separable from the surface?).
//
// Detection is dependency-injected so the module is testable offline: `mode: 'mock'` reads a
// fixture map; `mode: 'llm'` calls an injected `callLLM(prompt)` (the robust Stage-1 probe;
// needs an API key, so it lives at the script edge, not here).

const WORD = /[a-z0-9]+/g;

export const PUBLIC_TEXT_REPAIR_DEFINITION = 'public-text-v1';
export const PUBLIC_TEXT_REPAIR_DISPOSITIONS = Object.freeze({
  REPAIRED: 'repaired',
  NOT_REPAIRED: 'not_repaired',
  INDETERMINATE: 'indeterminate',
});

// Option 1's deliberately narrow public-text rule. A decisive repair must name the
// old check, name a replacement check, mark the contradiction, and anchor that
// contrast in the specific hamartia. The rule is intentionally lossy: partial or
// mixed evidence stays indeterminate rather than being coerced to a negative.
const OLD_CHECK_FRAME =
  /\b(?:the old check|the earlier check|the old rule|the prior check|i was treating|i was using|i was letting|i was reading|i had been treating)\b/i;
const REPLACEMENT_CHECK_FRAME =
  /\b(?:now the check|now the test|now the replacement check|my replacement check|the new check|the new test|the new rule|the replacement check|the replacement test|the replacement rule|the check is now|the test is now|instead the check|instead the test)\b/i;
const REJECTION_WORD_SOURCE = String.raw`(?:fail(?:s|ed)?|wrong|mistake(?:n)?|incorrect|irrelevant|does not work|doesn't work|cannot work|can't work)`;
const OLD_CHECK_REJECTION_FRAME = new RegExp(
  String.raw`\b(?:(?:the )?(?:old|earlier|prior) (?:check|rule|test)[^.!?]{0,100}${REJECTION_WORD_SOURCE}|(?:old|earlier|prior) mistake|(?:that|this|it) (?:was|is|would be) (?:wrong|mistaken|incorrect)|instead of|rather than|no longer)\b`,
  'i',
);
const PERSISTENCE_FRAME =
  /\b(?:i still (?:think|believe|use|apply|follow|hold)|i(?:'|’)ll keep (?:using|applying|following)|the (?:old|replacement|new) (?:check|rule) (?:is )?still(?!\s+(?:wrong|incorrect|mistaken|false|fail(?:s|ing)?))|i stand by|remains (?:right|correct))\b/i;
const UNCERTAINTY_FRAME = /\b(?:maybe|perhaps|might|could be|i guess|i(?:'| a)m not sure|not certain|possibly)\b/i;
const AMBIGUOUS_COMMITMENT_FRAME =
  /\b(?:both [^.!?]{0,60}(?:right|correct|valid|works?)|either [^.!?]{0,60}(?:right|correct|valid|works?)|(?:the )?(?:old|earlier|prior) (?:check|rule|test|approach|direction)[^.!?]{0,60}(?:right|correct|valid|works?|still works?)|i (?:can|could) use both|i (?:only |just )?(?:prefer|lean toward)|(?:also|still) seems? (?:right|correct|valid))\b/i;
const COPY_FRAME = /\b(?:i(?:'|’)ll copy|i will copy|just copying)\b/i;
const NO_OWNERSHIP_FRAME = /\b(?:do not know why|don't know why|not sure why|without understanding)\b/i;

// Generic function words are excluded before checking that the public turn is about
// the named misconception. Overall anchors plus a correction-distinct term or bigram
// in the replacement segment are fixed detector rules, not thresholds tuned on the
// loop population.
const ANCHOR_STOPWORDS = new Set(
  'about after again against also and are because been before being between both but can could did does doing each for from had has have having here how into its itself just learner learners may more most must not now off once only other our out over same should some such than that the their them then there these they this those through too under until very was were what when where which while who why will with would your misconception rule check'.split(
    ' ',
  ),
);

function normalizeAnchorToken(token) {
  if (token.length > 5 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith('ied')) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function normalizedTokenList(text, { omitStopwords = false } = {}) {
  return (
    String(text || '')
      .replace(/\[[^\]]*\]/g, ' ')
      .toLowerCase()
      .replace(/\bcan(?:not|['’]t)\b/g, ' cannot ')
      .replace(/\b(?:is|does|do|did|was|were|should|would|could)n['’]t\b/g, ' not ')
      .match(WORD) || []
  )
    .map(normalizeAnchorToken)
    .filter((token) => token.length >= 2 && (!omitStopwords || !ANCHOR_STOPWORDS.has(token)));
}

function contentTokens(text) {
  return new Set(normalizedTokenList(text, { omitStopwords: true }).filter((token) => token.length >= 3));
}

function tokenNgrams(text, size = 2) {
  const sequence = normalizedTokenList(text);
  const grams = new Set();
  for (let i = 0; i <= sequence.length - size; i++) grams.add(sequence.slice(i, i + size).join(' '));
  return grams;
}

function distinctiveValues(primary, comparison) {
  return [...primary].filter((value) => !comparison.has(value)).sort();
}

function matchedValues(values, observed) {
  return values.filter((value) => observed.has(value));
}

const REJECTION_TOKENS = new Set([
  'not',
  'never',
  'no',
  'without',
  'reject',
  'cannot',
  'fail',
  'mistake',
  'mistaken',
  'irrelevant',
  'deny',
  'wrong',
  'false',
  'incorrect',
]);

function hasScopedRejection(text, matchedTerms, matchedNgrams) {
  const phrases = [...matchedTerms.map((term) => [term]), ...matchedNgrams.map((gram) => gram.split(' '))];
  if (!phrases.length) return false;
  for (const clause of String(text || '').split(/[.!?;,]+/)) {
    const sequence = normalizedTokenList(clause);
    for (const phrase of phrases) {
      for (let i = 0; i <= sequence.length - phrase.length; i++) {
        if (!phrase.every((token, offset) => sequence[i + offset] === token)) continue;
        const window = sequence.slice(Math.max(0, i - 4), Math.min(sequence.length, i + phrase.length + 4));
        if (window.some((token) => REJECTION_TOKENS.has(token))) return true;
      }
    }
  }
  return false;
}

function frameIndex(text, frame) {
  return String(text || '').match(frame)?.index ?? -1;
}

function tokens(text) {
  // strip bracketed stage directions, lowercase, keep word tokens
  return new Set(
    String(text || '')
      .replace(/\[[^\]]*\]/g, ' ')
      .toLowerCase()
      .match(WORD) || [],
  );
}

// Pull the learner's manifest (public final turn) + latent (hidden deliberation) from a
// deliberation sidecar. latentInitial = the ego's unguarded FIRST draft (the sharpest
// concealment probe); latentFull = the whole ego/superego trace at that turn.
export function extractLearnerRepairText(deliberation) {
  const turns = (deliberation && deliberation.turns) || [];
  const learnerTurns = turns.filter((t) => t && t.phase === 'learner');
  if (!learnerTurns.length) return null;
  const last = learnerTurns[learnerTurns.length - 1];
  const delib = Array.isArray(last.internalDeliberation) ? last.internalDeliberation : [];
  const egoInitial = delib.find((d) => d && d.role === 'ego' && /initial/i.test(d.stage || ''));
  const latentFull = delib
    .filter((d) => d && /ego|superego/i.test(d.role || ''))
    .map((d) => `[${d.role}/${d.stage}] ${d.content || ''}`)
    .join('\n\n');
  return {
    turnNumber: last.turnNumber ?? null,
    publicText: String(last.externalMessage || ''),
    latentInitial: String((egoInitial && egoInitial.content) || ''),
    latentFull,
  };
}

// Pull only the last public learner turn from a ROLE-labelled sample transcript. This
// does not inspect a full trace or hidden deliberation; the public-text rule is surface
// evidence by construction.
export function extractFinalLearnerPublicText(publicTranscript) {
  const raw = String(publicTranscript || '').replace(/\r\n?/g, '\n');
  const markers = [...raw.matchAll(/^[ \t]*(STAGE|TUTOR|LEARNER):[ \t]*/gim)];
  const learnerTurns = [];
  for (let i = 0; i < markers.length; i++) {
    if (markers[i][1].toUpperCase() !== 'LEARNER') continue;
    learnerTurns.push({
      turnNumber: learnerTurns.length + 1,
      publicText: raw.slice(markers[i].index + markers[i][0].length, markers[i + 1]?.index ?? raw.length).trim(),
    });
  }
  return learnerTurns.length ? learnerTurns[learnerTurns.length - 1] : null;
}

function publicTextRepairResult(disposition, reason, evidence) {
  const repaired =
    disposition === PUBLIC_TEXT_REPAIR_DISPOSITIONS.REPAIRED
      ? true
      : disposition === PUBLIC_TEXT_REPAIR_DISPOSITIONS.NOT_REPAIRED
        ? false
        : null;
  return {
    definition: PUBLIC_TEXT_REPAIR_DEFINITION,
    disposition,
    durableRepair: repaired,
    reason,
    evidence,
  };
}

// Deterministic, zero-call classifier for the least-ambitious registered definition:
// the learner's FINAL PUBLIC turn explicitly replaces a hamartia-specific old check.
// Absence of a hit is not evidence of absence. Only explicit persistence supports a
// negative; every partial, mixed, missing, or uncertain case remains indeterminate.
export function detectPublicTextRepair({ hamartia, correctedRule, publicText } = {}) {
  const misconception = String(hamartia || '').trim();
  const correction = String(correctedRule || '').trim();
  const text = String(publicText || '').trim();
  const hamartiaTerms = [...contentTokens(misconception)].sort();
  const correctedRuleTerms = [...contentTokens(correction)].sort();
  const publicTerms = contentTokens(text);
  const oldCheckIndex = frameIndex(text, OLD_CHECK_FRAME);
  const replacementCheckIndex = frameIndex(text, REPLACEMENT_CHECK_FRAME);
  const oldCheckSegment =
    oldCheckIndex >= 0
      ? text.slice(oldCheckIndex, replacementCheckIndex > oldCheckIndex ? replacementCheckIndex : text.length)
      : '';
  const replacementSegment = replacementCheckIndex >= 0 ? text.slice(replacementCheckIndex) : '';
  const oldCheckTerms = contentTokens(oldCheckSegment);
  const replacementTerms = contentTokens(replacementSegment);
  const hamartiaTermSet = new Set(hamartiaTerms);
  const correctedRuleTermSet = new Set(correctedRuleTerms);
  const hamartiaOnlyTerms = distinctiveValues(hamartiaTermSet, correctedRuleTermSet);
  const correctedRuleOnlyTerms = distinctiveValues(correctedRuleTermSet, hamartiaTermSet);
  const hamartiaOnlyNgrams = distinctiveValues(tokenNgrams(misconception), tokenNgrams(correction));
  const correctedRuleOnlyNgrams = distinctiveValues(tokenNgrams(correction), tokenNgrams(misconception));
  const replacementNgrams = tokenNgrams(replacementSegment);
  const matchedHamartiaTerms = hamartiaTerms.filter((term) => publicTerms.has(term));
  const matchedCorrectedRuleTerms = correctedRuleTerms.filter((term) => publicTerms.has(term));
  const matchedOldCheckHamartiaTerms = hamartiaTerms.filter((term) => oldCheckTerms.has(term));
  const matchedReplacementCorrectedOnlyTerms = matchedValues(correctedRuleOnlyTerms, replacementTerms);
  const matchedReplacementHamartiaOnlyTerms = matchedValues(hamartiaOnlyTerms, replacementTerms);
  const matchedReplacementCorrectedOnlyNgrams = matchedValues(correctedRuleOnlyNgrams, replacementNgrams);
  const matchedReplacementHamartiaOnlyNgrams = matchedValues(hamartiaOnlyNgrams, replacementNgrams);
  const requiredHamartiaAnchors = Math.min(2, hamartiaTerms.length);
  const requiredCorrectedRuleAnchors = Math.min(2, correctedRuleTerms.length);
  const echoCopyMarked = COPY_FRAME.test(text);
  const noOwnershipMarked = NO_OWNERSHIP_FRAME.test(text);
  const correctedDistinctiveEvidenceRejected = hasScopedRejection(
    replacementSegment,
    matchedReplacementCorrectedOnlyTerms,
    matchedReplacementCorrectedOnlyNgrams,
  );
  const hamartiaDistinctiveEvidenceRejected = hasScopedRejection(
    replacementSegment,
    matchedReplacementHamartiaOnlyTerms,
    matchedReplacementHamartiaOnlyNgrams,
  );
  const replacementHamartiaDistinctiveAnchored =
    matchedReplacementHamartiaOnlyTerms.length > 0 || matchedReplacementHamartiaOnlyNgrams.length > 0;
  const evidence = {
    publicTextPresent: Boolean(text),
    hamartiaPresent: Boolean(misconception),
    correctedRulePresent: Boolean(correction),
    oldCheckNamed: oldCheckIndex >= 0,
    replacementCheckNamed: replacementCheckIndex >= 0,
    oldCheckRejected: OLD_CHECK_REJECTION_FRAME.test(text),
    persistenceMarked: PERSISTENCE_FRAME.test(text),
    uncertaintyMarked: UNCERTAINTY_FRAME.test(text),
    ambiguousCommitmentMarked: AMBIGUOUS_COMMITMENT_FRAME.test(text),
    echoCopyMarked,
    noOwnershipMarked,
    echoWithoutOwnershipMarked: echoCopyMarked && noOwnershipMarked,
    requiredHamartiaAnchors,
    requiredCorrectedRuleAnchors,
    matchedHamartiaTerms,
    matchedCorrectedRuleTerms,
    matchedOldCheckHamartiaTerms,
    matchedReplacementCorrectedOnlyTerms,
    matchedReplacementCorrectedOnlyNgrams,
    matchedReplacementHamartiaOnlyTerms,
    matchedReplacementHamartiaOnlyNgrams,
    correctedDistinctiveEvidenceRejected,
    hamartiaDistinctiveEvidenceRejected,
    hamartiaAnchored: requiredHamartiaAnchors > 0 && matchedHamartiaTerms.length >= requiredHamartiaAnchors,
    correctedRuleAnchored:
      requiredCorrectedRuleAnchors > 0 && matchedCorrectedRuleTerms.length >= requiredCorrectedRuleAnchors,
    oldCheckHamartiaAnchored: matchedOldCheckHamartiaTerms.length >= 1,
    replacementCorrectedDistinctiveAnchored:
      matchedReplacementCorrectedOnlyTerms.length > 0 || matchedReplacementCorrectedOnlyNgrams.length > 0,
    replacementHamartiaDistinctiveAnchored,
    replacementRepeatsHamartia: replacementHamartiaDistinctiveAnchored && !hamartiaDistinctiveEvidenceRejected,
  };

  if (!misconception) {
    return publicTextRepairResult(PUBLIC_TEXT_REPAIR_DISPOSITIONS.INDETERMINATE, 'missing_hamartia', evidence);
  }
  if (!hamartiaTerms.length) {
    return publicTextRepairResult(
      PUBLIC_TEXT_REPAIR_DISPOSITIONS.INDETERMINATE,
      'hamartia_has_no_usable_anchor_terms',
      evidence,
    );
  }
  if (!correction) {
    return publicTextRepairResult(PUBLIC_TEXT_REPAIR_DISPOSITIONS.INDETERMINATE, 'missing_corrected_rule', evidence);
  }
  if (!correctedRuleTerms.length) {
    return publicTextRepairResult(
      PUBLIC_TEXT_REPAIR_DISPOSITIONS.INDETERMINATE,
      'corrected_rule_has_no_usable_anchor_terms',
      evidence,
    );
  }
  if (!text) {
    return publicTextRepairResult(
      PUBLIC_TEXT_REPAIR_DISPOSITIONS.INDETERMINATE,
      'missing_public_learner_turn',
      evidence,
    );
  }

  if (
    evidence.uncertaintyMarked ||
    evidence.ambiguousCommitmentMarked ||
    evidence.correctedDistinctiveEvidenceRejected ||
    (evidence.echoWithoutOwnershipMarked &&
      evidence.oldCheckRejected &&
      evidence.replacementCorrectedDistinctiveAnchored) ||
    (evidence.persistenceMarked && evidence.oldCheckRejected) ||
    (evidence.replacementCorrectedDistinctiveAnchored && evidence.replacementRepeatsHamartia)
  ) {
    return publicTextRepairResult(
      PUBLIC_TEXT_REPAIR_DISPOSITIONS.INDETERMINATE,
      'mixed_or_uncertain_commitment',
      evidence,
    );
  }

  if (
    evidence.hamartiaAnchored &&
    ((evidence.oldCheckNamed && evidence.persistenceMarked && evidence.replacementRepeatsHamartia) ||
      evidence.echoWithoutOwnershipMarked)
  ) {
    return publicTextRepairResult(
      PUBLIC_TEXT_REPAIR_DISPOSITIONS.NOT_REPAIRED,
      evidence.echoWithoutOwnershipMarked ? 'unowned_echo_of_corrected_rule' : 'explicit_persistence_of_hamartia',
      evidence,
    );
  }

  if (
    evidence.hamartiaAnchored &&
    evidence.correctedRuleAnchored &&
    evidence.oldCheckNamed &&
    evidence.replacementCheckNamed &&
    evidence.oldCheckRejected &&
    evidence.oldCheckHamartiaAnchored &&
    evidence.replacementCorrectedDistinctiveAnchored &&
    !evidence.replacementRepeatsHamartia &&
    !evidence.persistenceMarked &&
    !evidence.echoWithoutOwnershipMarked
  ) {
    return publicTextRepairResult(
      PUBLIC_TEXT_REPAIR_DISPOSITIONS.REPAIRED,
      'explicit_hamartia_contradiction_with_replacement_check',
      evidence,
    );
  }

  return publicTextRepairResult(
    PUBLIC_TEXT_REPAIR_DISPOSITIONS.INDETERMINATE,
    'incomplete_public_repair_evidence',
    evidence,
  );
}

// Zero-API concealment-signal proxy: how much the learner's latent first-thought diverges
// from the public turn. Low overlap => the public turn is NOT just the surface of the latent
// (concealment signal present). High overlap => latent ~ surface-determined (P1 leans null).
export function latentManifestDivergence(publicText, latentText) {
  const a = tokens(publicText);
  const b = tokens(latentText);
  if (!a.size && !b.size) return { overlap: 1, diverged: false, publicTokens: 0, latentTokens: 0 };
  const inter = [...a].filter((t) => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  const overlap = union ? inter / union : 0;
  return { overlap, diverged: overlap < 0.5, publicTokens: a.size, latentTokens: b.size };
}

export function buildRepairPrompt(hamartia, text) {
  return (
    `A learner held this misconception:\n"${hamartia}"\n\n` +
    `Does the following learner text show the learner has CORRECTED that misconception — ` +
    `stating or applying the right rule in a way that CONTRADICTS the misconception — as ` +
    `opposed to still holding it, or merely restating the tutor's words without it? ` +
    `Answer strictly with one word: YES or NO.\n\nLearner text:\n"${text}"`
  );
}

// Detect repair in one text. mode 'mock' -> fixture map (tests / free pipeline). mode 'llm'
// -> the injected callLLM(prompt) judge (the robust probe; needs an API key at the edge).
export async function detectRepair(hamartia, text, opts = {}) {
  const mode = opts.mode || 'mock';
  if (!text || !text.trim()) return false;
  if (mode === 'mock') {
    const map = opts.mockMap || {};
    if (text in map) return Boolean(map[text]);
    return Boolean(map.default);
  }
  if (mode === 'llm') {
    if (typeof opts.callLLM !== 'function') {
      throw new Error(
        'repair detector mode "llm" requires an injected opts.callLLM (set an API key + wire the provider)',
      );
    }
    // Fail closed at the judge boundary: never spend a paid judge call on an empty/undefined
    // misconception — buildRepairPrompt would ask the judge to assess repair of "" (the bug
    // that invalidated the 4438d4b run). Guarding HERE means no caller can trigger it, not
    // just this probe; the misconception must be present before any LLM repair verdict.
    if (!hamartia || !String(hamartia).trim()) {
      throw new Error(
        'repair detector mode "llm": refusing to judge an empty/undefined hamartia (misconception); provide a non-empty misconception or skip the cell',
      );
    }
    const reply = await opts.callLLM(buildRepairPrompt(hamartia, text));
    return /^\s*yes\b/i.test(String(reply || ''));
  }
  throw new Error(`unknown repair-detector mode: ${mode}`);
}

export default {
  PUBLIC_TEXT_REPAIR_DEFINITION,
  PUBLIC_TEXT_REPAIR_DISPOSITIONS,
  extractLearnerRepairText,
  extractFinalLearnerPublicText,
  detectPublicTextRepair,
  latentManifestDivergence,
  buildRepairPrompt,
  detectRepair,
};
