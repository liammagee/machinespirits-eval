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
  const answerWords = words(String(answerTerm || '').replace(/([a-z0-9])([A-Z])/gu, '$1 $2'));
  const publicWords = new Set(words(publicText));
  return (
    answerWords.length > 0 &&
    answerWords.every(
      (word) => publicWords.has(word) || (word.endsWith('s') && publicWords.has(word.slice(0, -1))),
    )
  );
}

function similarity(left, right) {
  const leftWords = new Set(words(left));
  const rightWords = new Set(words(right));
  if (!leftWords.size || !rightWords.size) return 0;
  const intersection = [...leftWords].filter((word) => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  return union ? intersection / union : 0;
}

export function auditTutorStubRepetitionResponse({ text = '', recentTutorTexts = [], threshold = 0.82 } = {}) {
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
        words(openingSentence(text)).length >= 6
          ? similarity(openingSentence(previous), openingSentence(text))
          : 0,
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
  return {
    schema: TUTOR_STUB_RESPONSE_GUARD_SCHEMA,
    ok: issues.length === 0,
    issues,
    maxSimilarity: internalRepeat
      ? 1
      : comparisons.reduce((max, row) => Math.max(max, row.similarity), 0),
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
  return Object.freeze(
    [
      ...new Set(
        [...(committedEvidence || []), ...(dueEvidence || [])]
          .map((row) => (typeof row === 'string' ? row : row?.premise))
          .filter(Boolean),
      ),
    ],
  );
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
  const clue = (Array.isArray(dueEvidence) ? dueEvidence : [dueEvidence]).find((row) => clueSurface(row)) ||
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
