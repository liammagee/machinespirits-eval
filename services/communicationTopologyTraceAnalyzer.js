const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'and',
  'are',
  'because',
  'been',
  'before',
  'being',
  'between',
  'both',
  'but',
  'can',
  'could',
  'did',
  'does',
  'each',
  'for',
  'from',
  'had',
  'has',
  'have',
  'her',
  'here',
  'hers',
  'him',
  'his',
  'how',
  'into',
  'its',
  'itself',
  'more',
  'most',
  'not',
  'now',
  'only',
  'other',
  'our',
  'out',
  'over',
  'same',
  'she',
  'should',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'too',
  'under',
  'very',
  'was',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
]);

function compare(left, right) {
  return left === right ? 0 : left < right ? -1 : 1;
}

function round(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function median(values) {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!finite.length) return null;
  const midpoint = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[midpoint] : (finite[midpoint - 1] + finite[midpoint]) / 2;
}

export function informativeTokenSet(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/u)
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  );
}

export function buildCritiqueIdf(links) {
  const documents = links.map((link) => informativeTokenSet(link?.disciplinaryCheck?.text));
  const documentFrequency = new Map();
  for (const document of documents) {
    for (const token of document) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  }
  const idf = new Map();
  for (const [token, frequency] of documentFrequency) {
    idf.set(token, Math.log((documents.length + 1) / (frequency + 1)) + 1);
  }
  return idf;
}

export function critiqueSpecificUptake(draftText, critiqueText, revisionText, idf = new Map()) {
  const draft = informativeTokenSet(draftText);
  const critiqueSpecific = [...informativeTokenSet(critiqueText)].filter((token) => !draft.has(token));
  const revisionAdded = new Set([...informativeTokenSet(revisionText)].filter((token) => !draft.has(token)));
  const weight = (token) => idf.get(token) || 1;
  const denominator = critiqueSpecific.reduce((sum, token) => sum + weight(token), 0);
  const matchedTokens = critiqueSpecific.filter((token) => revisionAdded.has(token)).sort(compare);
  const numerator = matchedTokens.reduce((sum, token) => sum + weight(token), 0);

  return {
    score: denominator > 0 ? numerator / denominator : null,
    critiqueSpecificTokenCount: critiqueSpecific.length,
    revisionAddedTokenCount: revisionAdded.size,
    matchedTokenCount: matchedTokens.length,
    matchedTokens,
  };
}

function isEligibleLink(link) {
  return Boolean(
    link?.requiresRevision &&
    link?.followupKind === 'immediate' &&
    link?.immediateRevisionSignal &&
    link?.response?.text &&
    link?.disciplinaryCheck?.text &&
    link?.nextEgo?.text,
  );
}

function stratumKey(link) {
  return [
    link.scenarioId || '<unknown-scenario>',
    link.egoModel || '<unknown-ego>',
    link.superegoModel || '<unknown-superego>',
    Number.isInteger(link.ordinal) ? link.ordinal : '<unknown-ordinal>',
  ].join('\u241f');
}

export function benjaminiHochberg(rows, pField = 'empiricalP', qField = 'fdrQ') {
  const ranked = rows
    .filter((row) => Number.isFinite(row[pField]))
    .sort((left, right) => left[pField] - right[pField] || compare(left.checkId, right.checkId));
  let runningMinimum = 1;
  for (let index = ranked.length - 1; index >= 0; index--) {
    const rank = index + 1;
    runningMinimum = Math.min(runningMinimum, (ranked[index][pField] * ranked.length) / rank);
    ranked[index][qField] = Math.min(1, runningMinimum);
  }
  return rows;
}

/**
 * Compare every observed critique -> immediate revision link with a deterministic
 * broken-link null. The draft and revision stay fixed; critiques are substituted
 * from other dialogues sharing the same scenario, ego/superego model route,
 * and deliberation-link ordinal.
 * This measures link-specific lexical association, not causal effect.
 */
export function analyzeCritiqueRevisionLinks(checks, { minimumNullComparators = 19, fdrThreshold = 0.05 } = {}) {
  const eligible = checks
    .filter(isEligibleLink)
    .sort(
      (left, right) =>
        compare(left.dialogueId, right.dialogueId) ||
        left.ordinal - right.ordinal ||
        compare(left.checkId, right.checkId),
    );
  const idf = buildCritiqueIdf(eligible);
  const byStratum = new Map();
  for (const link of eligible) {
    const key = stratumKey(link);
    if (!byStratum.has(key)) byStratum.set(key, []);
    byStratum.get(key).push(link);
  }

  const rows = eligible.map((link) => {
    const own = critiqueSpecificUptake(link.response.text, link.disciplinaryCheck.text, link.nextEgo.text, idf);
    const comparators = (byStratum.get(stratumKey(link)) || []).filter(
      (candidate) => candidate.dialogueId !== link.dialogueId,
    );
    const nullScores = comparators
      .map(
        (candidate) =>
          critiqueSpecificUptake(link.response.text, candidate.disciplinaryCheck.text, link.nextEgo.text, idf).score,
      )
      .filter(Number.isFinite);
    const empiricalP =
      Number.isFinite(own.score) && nullScores.length >= minimumNullComparators
        ? (1 + nullScores.filter((score) => score >= own.score).length) / (1 + nullScores.length)
        : null;

    return {
      checkId: link.checkId,
      dialogueId: link.dialogueId,
      runId: link.runId,
      profileName: link.profileName,
      scenarioId: link.scenarioId,
      egoModel: link.egoModel || null,
      superegoModel: link.superegoModel || null,
      sourceTraceSha256: link.sourceTraceSha256,
      ordinal: link.ordinal,
      traceIndexes: {
        draft: link.response.traceIndex,
        critique: link.disciplinaryCheck.traceIndex,
        revision: link.nextEgo.traceIndex,
      },
      interventionType: link.disciplinaryCheck.interventionType,
      uptakeScore: round(own.score),
      critiqueSpecificTokenCount: own.critiqueSpecificTokenCount,
      revisionAddedTokenCount: own.revisionAddedTokenCount,
      matchedTokenCount: own.matchedTokenCount,
      matchedTokens: own.matchedTokens,
      nullComparatorCount: nullScores.length,
      nullMean: round(mean(nullScores)),
      nullMedian: round(median(nullScores)),
      empiricalP: round(empiricalP),
      fdrQ: null,
      outcome: null,
    };
  });

  benjaminiHochberg(rows);
  for (const row of rows) {
    row.fdrQ = round(row.fdrQ);
    if (!Number.isFinite(row.uptakeScore) || row.nullComparatorCount < minimumNullComparators) {
      row.outcome = 'indeterminate';
    } else if (row.uptakeScore > 0 && Number.isFinite(row.fdrQ) && row.fdrQ <= fdrThreshold) {
      row.outcome = 'lexical_association_detected';
    } else {
      row.outcome = 'not_detected';
    }
  }

  const outcomes = { lexical_association_detected: 0, not_detected: 0, indeterminate: 0 };
  const byProfile = {};
  for (const row of rows) {
    outcomes[row.outcome]++;
    if (!byProfile[row.profileName]) {
      byProfile[row.profileName] = {
        links: 0,
        lexical_association_detected: 0,
        not_detected: 0,
        indeterminate: 0,
        uptakeScores: [],
      };
    }
    const profile = byProfile[row.profileName];
    profile.links++;
    profile[row.outcome]++;
    if (Number.isFinite(row.uptakeScore)) profile.uptakeScores.push(row.uptakeScore);
  }
  for (const profile of Object.values(byProfile)) {
    profile.medianUptakeScore = round(median(profile.uptakeScores));
    delete profile.uptakeScores;
  }
  const testableRows = rows.filter((row) => row.outcome !== 'indeterminate');

  return {
    eligibleLinks: rows.length,
    excludedChecks: checks.length - rows.length,
    testableLinks: testableRows.length,
    positiveTestableLinks: testableRows.filter((row) => row.uptakeScore > 0).length,
    minimumNullComparators,
    fdrThreshold,
    outcomes,
    medianUptakeScore: round(median(rows.map((row) => row.uptakeScore))),
    medianNullMedian: round(median(rows.map((row) => row.nullMedian))),
    medianTestableUptakeScore: round(median(testableRows.map((row) => row.uptakeScore))),
    medianTestableNullMedian: round(median(testableRows.map((row) => row.nullMedian))),
    byProfile,
    rows,
  };
}

export default {
  analyzeCritiqueRevisionLinks,
  benjaminiHochberg,
  buildCritiqueIdf,
  critiqueSpecificUptake,
  informativeTokenSet,
};
