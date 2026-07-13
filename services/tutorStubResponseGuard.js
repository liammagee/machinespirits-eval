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
    .replace(/[’']/gu, '')
    .split(/[^a-z0-9]+/u)
    .filter((word) => word.length >= 3 && !TOKEN_STOPWORDS.has(word));
}

function normalizedText(value) {
  return words(value).join(' ');
}

export function tutorStubAnswerNameIsPublic({ answerTerm = '', publicText = '' } = {}) {
  const answerWords = words(answerTerm);
  const publicWords = new Set(words(publicText));
  return answerWords.length > 0 && answerWords.every((word) => publicWords.has(word));
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
  const comparisons = (Array.isArray(recentTutorTexts) ? recentTutorTexts : [])
    .slice(-3)
    .map((previous, index, rows) => ({
      turnsAgo: rows.length - index,
      text: oneLine(previous),
      exact: normalizedText(previous) === candidate,
      similarity: similarity(previous, text),
    }))
    .filter((row) => row.text);
  const repeated = comparisons
    .filter((row) => row.exact || row.similarity >= Number(threshold))
    .sort((left, right) => Number(right.exact) - Number(left.exact) || right.similarity - left.similarity);
  const issues = repeated.length
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
    : [];
  return {
    schema: TUTOR_STUB_RESPONSE_GUARD_SCHEMA,
    ok: issues.length === 0,
    issues,
    maxSimilarity: comparisons.reduce((max, row) => Math.max(max, row.similarity), 0),
  };
}

function premiseRows(world, premiseIds) {
  const ids = new Set((Array.isArray(premiseIds) ? premiseIds : []).filter(Boolean));
  return [...ids].map((premise) => ({
    premise,
    row: world?.premiseById?.get?.(premise) || (world?.premises || []).find((entry) => entry.id === premise) || null,
  }));
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
  const bounded = /bounded.*choice/iu.test(String(support?.modality || ''));
  const asksForReset = /\b(?:lost|where are we|what do you mean|explain|unclear|confus|don[’']?t know)\b/iu.test(
    learnerText,
  );
  const lead = surface
    ? `${asksForReset ? 'Let’s reset with the concrete clue' : 'Here is the concrete clue'}: ${surface}`
    : `Let’s return to the actual question: ${oneLine(world?.question || 'What can the evidence establish?')}`;
  const rule = ruleGloss ? `The rule we can use is: ${ruleGloss}` : '';
  let move;
  if (bounded) {
    move =
      'Which reading is safer: A) this clue establishes one condition in the rule, or B) this clue settles the whole case? You can choose either, answer freely, or ask which part needs explaining.';
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
    surface || oneLine(world?.question || ''),
    ruleGloss ? `Use this rule only: ${ruleGloss}` : null,
    bounded
      ? 'Is this one supporting step, or the complete answer? Ask me to unpack any part before choosing.'
      : 'Say only the smallest conclusion this supports, or ask me to unpack the clue.',
  ]
    .filter(Boolean)
    .join(' ');
}
