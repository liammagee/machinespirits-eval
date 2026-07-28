import { tutorStubPrivateTokenAlreadyPublic } from './tutorStubEvidenceAssertion.js';
import { splitTutorStubPublicWords } from './tutorStubPublicText.js';

export const TUTOR_STUB_RESPONSE_GUARD_SCHEMA = 'machinespirits.tutor-stub.response-guard.v1';

const TOKEN_STOPWORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'before',
  'being',
  'could',
  'does',
  'from',
  'have',
  'into',
  'only',
  'that',
  'their',
  'there',
  'these',
  'they',
  'this',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
]);

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function words(value) {
  return oneLine(value)
    .toLowerCase()
    .replace(/[’']s\b/gu, '')
    .replace(/[’']/gu, '')
    .split(/[^a-z0-9]+/u)
    .filter((word) => word.length >= 3 && !TOKEN_STOPWORDS.has(word));
}

function answerWords(value) {
  return words(String(value || '').replace(/([a-z0-9])([A-Z])/gu, '$1 $2'));
}

function wordSetContains(wordsSet, word) {
  return wordsSet.has(word) || (word.endsWith('s') && wordsSet.has(word.slice(0, -1)));
}

function normalizedText(value) {
  return words(value).join(' ');
}

function openingSentence(value) {
  return oneLine(value).match(/^.*?[.!?](?=\s|$)/u)?.[0] || oneLine(value);
}

function repeatedSentenceWithinResponse(value) {
  const sentences = (oneLine(value).match(/[^.!?]+[.!?]+|[^.!?]+$/gu) || [])
    .map((sentence) => oneLine(sentence))
    .filter((sentence) => words(sentence).length >= 6);
  for (let left = 0; left < sentences.length; left += 1) {
    for (let right = left + 1; right < sentences.length; right += 1) {
      if (normalizedText(sentences[left]) === normalizedText(sentences[right])) {
        return { sentence: sentences[right], firstIndex: left, repeatedIndex: right };
      }
    }
  }
  return null;
}

export function tutorStubAnswerNameIsPublic({ answerTerm = '', publicText = '' } = {}) {
  // World constants use compact symbolic spelling (for example
  // `larkinUnit`) while their public surfaces use ordinary words (`Larkin
  // unit`). Compare semantic tokens instead of authoring notation.
  const semanticAnswerWords = answerWords(answerTerm);
  const publicWords = new Set(words(publicText));
  return semanticAnswerWords.length > 0 && semanticAnswerWords.every((word) => wordSetContains(publicWords, word));
}

/**
 * Resolve whether a candidate actually refers to a concealed answer name.
 *
 * Compound world constants can share ordinary location or object words with
 * staged public clues. Those public components remain legal to repeat; only a
 * candidate component that is both part of the answer and still absent from
 * the public record can expose the concealed name. Once the full name is
 * public, any of its components can still anchor the downstream conclusion
 * audits without being treated as a name leak.
 */
export function resolveTutorStubAnswerReference({ answerTerm = '', text = '', publicText = '' } = {}) {
  const answerTokens = [...new Set(splitTutorStubPublicWords(answerTerm))];
  const candidateTokens = new Set(splitTutorStubPublicWords(text));
  const publicTokens = new Set(splitTutorStubPublicWords(publicText));
  const matchedTokens = answerTokens.filter((token) => tutorStubPrivateTokenAlreadyPublic(token, candidateTokens));
  const concealedTokens = answerTokens.filter((token) => !tutorStubPrivateTokenAlreadyPublic(token, publicTokens));
  const concealedTokenSet = new Set(concealedTokens);
  const concealedMatches = matchedTokens.filter((token) => concealedTokenSet.has(token));
  const answerNamePublic = tutorStubAnswerNameIsPublic({ answerTerm, publicText });

  return {
    answerTokens,
    matchedTokens,
    concealedTokens,
    concealedMatches,
    answerNamePublic,
    referencesAnswer: concealedMatches.length > 0 || (answerNamePublic && matchedTokens.length > 0),
  };
}

function similarity(left, right) {
  const leftWords = new Set(words(left));
  const rightWords = new Set(words(right));
  if (!leftWords.size || !rightWords.size) return 0;
  const intersection = [...leftWords].filter((word) => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  return union ? intersection / union : 0;
}

/**
 * Second repetition channel: does this turn say anything the recent turns have
 * not already said?
 *
 * The lexical channel asks whether a reply *resembles* an earlier one, so a
 * tutor that restates the same move in fresh words walks under it. Riverside's
 * bare arm reworded one request four turns running at similarities of
 * 0.21-0.38, nowhere near the 0.82 threshold, while the judge described the
 * last of them as nearly identical in content to the three before it. Word-set
 * novelty asks a different question: what share of this turn's content words
 * have the last ten turns not already used?
 *
 * The floor is read off observed runs rather than chosen a priori, and the two
 * channels are reported side by side because they disagree — a turn can repeat
 * a phrasing without stalling, and stall without repeating a phrasing.
 */
export function auditTutorStubAdvanceResponse({
  text = '',
  recentTutorTexts = [],
  floor = 0.25,
  minimumContentWords = 8,
  terminal = false,
} = {}) {
  const contentWords = new Set(words(text));
  const priorTexts = (Array.isArray(recentTutorTexts) ? recentTutorTexts : []).slice(-10).filter((row) => oneLine(row));
  // A turn can be word-poor without stalling when it is the closing act, or too
  // short to measure. Delivering an exhibit used to be a third exemption and is
  // deliberately not one any more: in the 2026-07-28 smoke run it fired on four
  // of the instrumented arm's six turns and left the channel a no-op on the
  // whole dialogue. It was never needed. An exhibit is text nobody has said yet,
  // so a real release scores its own way past the floor — those four turns score
  // 0.58 to 0.75 unexempted. What the exemption bought was a loophole: name an
  // exhibit, restate everything else, pass unread.
  const skipped = !priorTexts.length
    ? 'no_prior_turns'
    : terminal
      ? 'terminal_turn'
      : contentWords.size < Number(minimumContentWords)
        ? 'too_short_to_judge'
        : null;
  if (skipped) {
    return { schema: TUTOR_STUB_RESPONSE_GUARD_SCHEMA, ok: true, issues: [], novelty: null, skipped };
  }
  const priorWords = new Set(priorTexts.flatMap((row) => words(row)));
  const freshWords = [...contentWords].filter((word) => !wordSetContains(priorWords, word));
  const novelty = freshWords.length / contentWords.size;
  const issues =
    novelty < Number(floor)
      ? [
          {
            type: 'tutor_turn_without_advance',
            reason:
              'the reply introduces almost no material the recent tutor turns have not already covered, so it restates rather than advances',
            novelty,
            freshWordCount: freshWords.length,
            contentWordCount: contentWords.size,
            comparedTurns: priorTexts.length,
          },
        ]
      : [];
  return {
    schema: TUTOR_STUB_RESPONSE_GUARD_SCHEMA,
    ok: issues.length === 0,
    issues,
    novelty,
    skipped: null,
    freshWords,
  };
}

export function auditTutorStubRepetitionResponse({
  text = '',
  recentTutorTexts = [],
  threshold = 0.82,
  advance = null,
} = {}) {
  const candidate = normalizedText(text);
  if (!candidate) return { ok: true, issues: [], maxSimilarity: 0 };
  const internalRepeat = repeatedSentenceWithinResponse(text);
  const comparisons = (Array.isArray(recentTutorTexts) ? recentTutorTexts : [])
    .slice(-10)
    .map((previous, index, rows) => ({
      turnsAgo: rows.length - index,
      text: oneLine(previous),
      exact: normalizedText(previous) === candidate,
      similarity: similarity(previous, text),
      openingText: openingSentence(previous),
      openingExact:
        words(openingSentence(text)).length >= 6 &&
        normalizedText(openingSentence(previous)) === normalizedText(openingSentence(text)),
      openingSimilarity:
        words(openingSentence(text)).length >= 6 ? similarity(openingSentence(previous), openingSentence(text)) : 0,
    }))
    .filter((row) => row.text);
  const repeated = comparisons
    .filter((row) => row.exact || row.similarity >= Number(threshold))
    .sort((left, right) => Number(right.exact) - Number(left.exact) || right.similarity - left.similarity);
  const repeatedOpening = comparisons
    .filter((row) => row.openingExact || row.openingSimilarity >= 0.9)
    .sort(
      (left, right) =>
        Number(right.openingExact) - Number(left.openingExact) || right.openingSimilarity - left.openingSimilarity,
    );
  const issues = internalRepeat
    ? [
        {
          type: 'repeated_tutor_sentence',
          reason: 'repeats a substantial sentence inside the same tutor reply',
          similarity: 1,
          repeatedText: internalRepeat.sentence,
          firstSentenceIndex: internalRepeat.firstIndex,
          repeatedSentenceIndex: internalRepeat.repeatedIndex,
        },
      ]
    : repeated.length
      ? [
          {
            type: 'repeated_tutor_response',
            reason: repeated[0].exact
              ? 'repeats a recent tutor reply verbatim'
              : 'substantially repeats a recent tutor reply without adding a new clue or distinction',
            similarity: repeated[0].similarity,
            previousText: repeated[0].text,
            turnsAgo: repeated[0].turnsAgo,
          },
        ]
      : repeatedOpening.length
        ? [
            {
              type: 'repeated_tutor_opening',
              reason: 'reuses a substantial recent opening even though the rest of the reply changes',
              similarity: repeatedOpening[0].openingSimilarity,
              previousText: repeatedOpening[0].openingText,
              turnsAgo: repeatedOpening[0].turnsAgo,
            },
          ]
        : [];
  // The advance channel is opt-in so that callers who cannot supply its context
  // — whether the turn released evidence, whether it is the closing act — get
  // exactly the lexical behaviour they had before rather than a guess.
  const advanceAudit = advance ? auditTutorStubAdvanceResponse({ ...advance, text, recentTutorTexts }) : null;
  const allIssues = [...issues, ...(advanceAudit?.issues || [])];
  return {
    schema: TUTOR_STUB_RESPONSE_GUARD_SCHEMA,
    ok: allIssues.length === 0,
    issues: allIssues,
    maxSimilarity: internalRepeat ? 1 : comparisons.reduce((max, row) => Math.max(max, row.similarity), 0),
    novelty: advanceAudit ? advanceAudit.novelty : null,
    advanceSkipped: advanceAudit ? advanceAudit.skipped : null,
  };
}

function premiseRows(world, premiseIds) {
  const ids = new Set((Array.isArray(premiseIds) ? premiseIds : []).filter(Boolean));
  return [...ids].map((premise) => ({
    premise,
    row: world?.premiseById?.get?.(premise) || (world?.premises || []).find((entry) => entry.id === premise) || null,
  }));
}

export function snapshotTutorStubPublicPremiseIds({ committedEvidence = [], dueEvidence = [] } = {}) {
  return Object.freeze([
    ...new Set(
      [...(committedEvidence || []), ...(dueEvidence || [])]
        .map((row) => (typeof row === 'string' ? row : row?.premise))
        .filter(Boolean),
    ),
  ]);
}

export function auditTutorStubReleaseDelivery({ text = '', world = null, premiseIds = [] } = {}) {
  const responseWords = new Set(words(text));
  const rows = premiseRows(world, premiseIds).map(({ premise, row }) => {
    const surfaceWords = [...new Set(words(row?.surface || ''))];
    const factWords = [...new Set((Array.isArray(row?.fact) ? row.fact.slice(1) : []).flatMap(words))];
    const surfaceMatches = surfaceWords.filter((word) => responseWords.has(word));
    const factMatches = factWords.filter((word) => responseWords.has(word));
    const requiredSurfaceMatches = surfaceWords.length <= 1 ? 1 : 2;
    const delivered = Boolean(
      surfaceMatches.length >= requiredSurfaceMatches ||
      (surfaceMatches.length >= 1 && factMatches.length >= 1 && new Set([...surfaceMatches, ...factMatches]).size >= 2),
    );
    return {
      premise,
      delivered,
      surfaceMatches,
      factMatches,
      requiredSurfaceMatches,
    };
  });
  return {
    schema: TUTOR_STUB_RESPONSE_GUARD_SCHEMA,
    ok: rows.every((row) => row.delivered),
    deliveredPremises: rows.filter((row) => row.delivered).map((row) => row.premise),
    missingPremises: rows.filter((row) => !row.delivered).map((row) => row.premise),
    rows,
  };
}

function clueSurface(row) {
  return oneLine(row?.surface || '');
}

function currentRuleGloss(world, premiseId) {
  const premise = world?.premiseById?.get?.(premiseId) || (world?.premises || []).find((row) => row.id === premiseId);
  const predicate = premise?.fact?.[0];
  if (!predicate) return '';
  const rule = (world?.rules || []).find((candidate) =>
    [...(candidate?.if || []), ...(candidate?.then || [])].some((fact) => fact?.[0] === predicate),
  );
  return oneLine(rule?.gloss || '');
}

function publicClueName(surface = '') {
  const source = oneLine(surface).toLowerCase();
  if (/\bbadge\b/u.test(source)) return 'badge record';
  if (/\bnotice\b/u.test(source)) return 'notice';
  if (/\b(?:call|revision|visitor|custody) log\b|\blogbook\b/u.test(source)) return 'log';
  if (/\bledger\b/u.test(source)) return 'ledger';
  if (/\bnotebook\b/u.test(source)) return 'notebook';
  if (/\b(?:assay|residue|sample)\b/u.test(source)) return 'test result';
  if (/\b(?:witness|statement|testimony)\b/u.test(source)) return 'witness statement';
  if (/\b(?:record|register|file|entry)\b/u.test(source)) return 'record';
  return 'clue';
}

function boundedPublicMove({ support = null, world = null, surface = '' } = {}) {
  const clueName = publicClueName(surface);
  const question = oneLine(world?.question || 'what happened').replace(/[.!?]+$/u, '');
  if (support?.answerability === 'direction_only_until_evidence_is_public') {
    return `Would you like A) a plain explanation of the ${clueName}, or B) to look at the next piece of evidence before we try to answer “${question}?” You can also answer in your own words or ask me to restate the ${clueName}.`;
  }
  return `Would you like A) a plain explanation of the ${clueName}, or B) to say what it tells us about “${question}?” You can also answer in your own words or ask me to restate the ${clueName}.`;
}

export function deterministicTutorStubContextualFallback({
  support = null,
  world = null,
  learnerText = '',
  dueEvidence = [],
  latestEvidence = null,
  recentTutorTexts = [],
} = {}) {
  const clue =
    (Array.isArray(dueEvidence) ? dueEvidence : [dueEvidence]).find((row) => clueSurface(row)) ||
    (clueSurface(latestEvidence) ? latestEvidence : null);
  const surface = clueSurface(clue);
  const ruleGloss = currentRuleGloss(world, clue?.premise);
  const struggling = Boolean(support?.clarificationInvitationRequired);
  const responsiveRepairRequired = Boolean(support?.responsiveRepairRequired);
  const bounded = /bounded.*choice/iu.test(String(support?.modality || ''));
  const asksForReset = /\b(?:lost|where are we|what do you mean|explain|unclear|confus|don[’']?t know)\b/iu.test(
    learnerText,
  );
  const lead = surface
    ? responsiveRepairRequired
      ? `You’re right—I did not answer your question directly. Here is the public record that answers what we can answer now: ${surface}`
      : `${asksForReset ? 'Let’s reset with the concrete clue' : 'Here is the concrete clue'}: ${surface}`
    : responsiveRepairRequired
      ? 'You’re right—I did not answer your question directly. The public record so far does not yet settle it.'
      : `Let’s return to the actual question: ${oneLine(world?.question || 'What can the evidence establish?')}`;
  const rule = ruleGloss ? `In plain terms: ${ruleGloss}` : '';
  let move;
  if (bounded) {
    move = boundedPublicMove({ support, world, surface });
  } else if (support?.answerability === 'direction_only_until_evidence_is_public') {
    move =
      'The next step needs another stated clue, so we should keep the conclusion open instead of inventing a missing record.';
  } else if (struggling) {
    move = 'What does this clue show on its own? You can also ask which word, clue, or connection needs explaining.';
  } else {
    move = 'What does this clue show on its own?';
  }
  const candidate = [lead, rule, move].filter(Boolean).join(' ');
  const repetition = auditTutorStubRepetitionResponse({ text: candidate, recentTutorTexts });
  if (repetition.ok) return candidate;
  return [
    `A different way into ${oneLine(world?.title || 'this case')}:`,
    oneLine(world?.question || '') ? `We are trying to answer: “${oneLine(world.question)}”` : null,
    surface ? `The ${publicClueName(surface)} says: ${surface}` : null,
    ruleGloss ? `In plain terms: ${ruleGloss}` : null,
    bounded
      ? boundedPublicMove({ support, world, surface })
      : `Tell me what the ${publicClueName(surface)} says about that question, or ask me to explain it plainly.`,
  ]
    .filter(Boolean)
    .join(' ');
}
