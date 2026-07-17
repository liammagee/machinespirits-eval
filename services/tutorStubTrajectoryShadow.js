const CORPUS_SCHEMA = 'machinespirits.tutor-stub.trajectory-dev-corpus.v1';
const REPORT_SCHEMA = 'machinespirits.tutor-stub.trajectory-shadow-report.v1';

const STOP_WORDS = new Set([
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
  'next',
  'only',
  'should',
  'still',
  'than',
  'that',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'under',
  'until',
  'what',
  'when',
  'where',
  'which',
  'while',
  'whose',
  'with',
  'would',
  'write',
  'your',
]);

export const TUTOR_STUB_TRAJECTORY_DEV_CORPUS_SCHEMA = CORPUS_SCHEMA;
export const TUTOR_STUB_TRAJECTORY_SHADOW_REPORT_SCHEMA = REPORT_SCHEMA;

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function divide(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return value;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function textTokens(text, { includeStopWords = false } = {}) {
  const tokens = String(text || '')
    .toLowerCase()
    .replaceAll('’', "'")
    .match(/[a-z][a-z'-]*/gu);
  if (!tokens) return [];
  return tokens.filter((token) => token.length >= 4 && (includeStopWords || !STOP_WORDS.has(token)));
}

function surfaceTokens(text) {
  return (
    String(text || '')
      .toLowerCase()
      .replaceAll('’', "'")
      .match(/[a-z][a-z'-]*/gu) || []
  );
}

function tokenSet(text) {
  return new Set(textTokens(text));
}

function sharesContent(left, right) {
  const rightTokens = tokenSet(right);
  return textTokens(left).some((token) => rightTokens.has(token));
}

function jaccard(left, right) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  const union = new Set([...leftTokens, ...rightTokens]);
  if (union.size === 0) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return overlap / union.size;
}

function ngrams(text, width = 4) {
  const tokens = surfaceTokens(text);
  const output = [];
  for (let index = 0; index <= tokens.length - width; index += 1) {
    output.push(tokens.slice(index, index + width).join(' '));
  }
  return output;
}

function sentenceStats(text) {
  const sentences = String(text || '')
    .split(/[.!?]+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const words = surfaceTokens(text);
  return {
    words: words.length,
    sentences: sentences.length,
    averageSentenceWords: divide(words.length, sentences.length) || 0,
  };
}

function maxStreak(values, predicate = (value) => Boolean(value)) {
  let longest = 0;
  let current = 0;
  for (const value of values) {
    if (predicate(value)) current += 1;
    else current = 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function maxValueStreak(values) {
  let longest = 0;
  let current = 0;
  let previous = Symbol('initial');
  for (const value of values) {
    if (value === previous) current += 1;
    else current = 1;
    previous = value;
    longest = Math.max(longest, current);
  }
  return longest;
}

function transitions(values) {
  let count = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] !== values[index - 1]) count += 1;
  }
  return count;
}

function entropy(values) {
  if (values.length === 0) return 0;
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  let result = 0;
  for (const count of counts.values()) {
    const probability = count / values.length;
    result -= probability * Math.log2(probability);
  }
  return result;
}

function genericWriteRequest(text) {
  const normalized = String(text || '').toLowerCase();
  return (
    /\b(?:what|how)\b[^?.!]{0,80}\b(?:write|put|record|enter|note)\b/u.test(normalized) ||
    /\bshould i\b[^?.!]{0,80}\b(?:write|put|record|enter|note)\b/u.test(normalized)
  );
}

function beginsWithDirectEntry(text) {
  return /^(?:yes[,.!— -]*)?(?:write|record|enter|put|note)(?::|\b)/iu.test(String(text || '').trim());
}

function contentFreeWriteRequest(text) {
  const remaining = textTokens(text).filter((token) => !['first', 'next', 'record', 'enter', 'note'].includes(token));
  return genericWriteRequest(text) && remaining.length === 0;
}

function uptakeVisible(turn) {
  if (String(turn.composition?.uptake || '').trim()) return true;
  if (genericWriteRequest(turn.learner) && beginsWithDirectEntry(turn.tutor)) return true;
  if (contentFreeWriteRequest(turn.learner)) return beginsWithDirectEntry(turn.tutor);
  return sharesContent(turn.learner, turn.tutor);
}

function developmentVisible(turn) {
  return Boolean(String(turn.composition?.development || '').trim());
}

function integrityCounts(turn) {
  const integrity = turn.hardIntegrity || {};
  return {
    privateEvidence: finite(integrity.privateEvidence),
    unsupportedEvidence: finite(integrity.unsupportedEvidence),
    sourcePerspectiveDrift: finite(integrity.sourcePerspectiveDrift),
    duplicateClueDelivery: finite(integrity.duplicateClueDelivery),
    missingClueDelivery: finite(integrity.missingClueDelivery),
    unanswerableQuestion: finite(integrity.unanswerableQuestion),
    terminalContinuation: finite(integrity.terminalContinuation),
  };
}

function addCounts(target, source) {
  for (const [key, value] of Object.entries(source)) target[key] = finite(target[key]) + finite(value);
  return target;
}

function summarizeNaturalness(turns) {
  const sentence = turns.map((turn) => sentenceStats(turn.tutor));
  const allNgrams = turns.map((turn) => new Set(ngrams(turn.tutor)));
  const documentFrequency = new Map();
  for (const grams of allNgrams) {
    for (const gram of grams) documentFrequency.set(gram, (documentFrequency.get(gram) || 0) + 1);
  }
  const repeated = new Set([...documentFrequency].filter(([, count]) => count >= 2).map(([gram]) => gram));
  let observed = 0;
  let repeatedObserved = 0;
  for (const grams of allNgrams) {
    observed += grams.size;
    repeatedObserved += [...grams].filter((gram) => repeated.has(gram)).length;
  }
  const openingCounts = new Map();
  for (const turn of turns) {
    const opening = surfaceTokens(turn.tutor).slice(0, 4).join(' ');
    if (opening) openingCounts.set(opening, (openingCounts.get(opening) || 0) + 1);
  }
  const mostCommonOpening = Math.max(0, ...openingCounts.values());
  return {
    meanSentenceWords: round(
      divide(
        sentence.reduce((sum, row) => sum + row.averageSentenceWords, 0),
        sentence.length,
      ) || 0,
    ),
    repeatedFourGramRate: round(divide(repeatedObserved, observed) || 0),
    repeatedFourGramTypes: repeated.size,
    mostCommonOpeningShare: round(divide(mostCommonOpening, turns.length) || 0),
    adjacentTutorSimilarity: round(
      divide(
        turns.slice(1).reduce((sum, turn, index) => sum + jaccard(turns[index].tutor, turn.tutor), 0),
        Math.max(0, turns.length - 1),
      ) || 0,
    ),
    interpretation: 'descriptive_proxy_only',
  };
}

function summarizeClosure(turns) {
  const mandatoryIndex = turns.findIndex((turn) => turn.closure?.mandatory === true);
  const closeIndex = turns.findIndex((turn) => turn.closure?.closesDialogue === true);
  const mandatoryTurn = mandatoryIndex >= 0 ? turns[mandatoryIndex].turn : null;
  const closeTurn = closeIndex >= 0 ? turns[closeIndex].turn : null;
  return {
    mandatoryTurn,
    closeTurn,
    latencyTurns:
      mandatoryTurn != null && closeTurn != null && closeTurn >= mandatoryTurn ? closeTurn - mandatoryTurn : null,
    requiredButMissing: mandatoryTurn != null && closeTurn == null,
    postClosureTutorTurns: closeIndex >= 0 ? Math.max(0, turns.length - closeIndex - 1) : 0,
    status:
      mandatoryTurn == null
        ? 'not_reached'
        : closeTurn == null
          ? 'missing'
          : closeTurn === mandatoryTurn
            ? 'same_turn'
            : 'delayed',
  };
}

export function summarizeTutorStubTrajectoryEpisode(episode) {
  const turns = Array.isArray(episode.turns) ? episode.turns : [];
  const uptake = turns.map((turn) => uptakeVisible(turn));
  const development = turns.map((turn) => developmentVisible(turn));
  const both = turns.map((turn, index) => uptake[index] && development[index]);
  const releaseTurns = turns.filter((turn) => (turn.release?.releasedNow || []).length > 0).map((turn) => turn.turn);
  const releaseGaps = releaseTurns.slice(1).map((turn, index) => turn - releaseTurns[index]);
  const parts = turns.map((turn) => turn.configuration?.part || 'unrecorded');
  const stances = turns.map((turn) => turn.configuration?.stance || 'unrecorded');
  const tactics = turns.map((turn) => turn.configuration?.tactic || 'unrecorded');
  const integrity = {
    privateEvidence: 0,
    unsupportedEvidence: 0,
    sourcePerspectiveDrift: 0,
    duplicateClueDelivery: 0,
    missingClueDelivery: 0,
    unanswerableQuestion: 0,
    terminalContinuation: 0,
  };
  for (const turn of turns) addCounts(integrity, integrityCounts(turn));
  const hardFailureCount = Object.values(integrity).reduce((sum, value) => sum + value, 0);
  const learnerCarryoverEligible = turns.filter((turn) => !contentFreeWriteRequest(turn.learner));
  const learnerCarryoverHits = learnerCarryoverEligible.filter(
    (turn) =>
      sharesContent(turn.learner, turn.tutor) ||
      (genericWriteRequest(turn.learner) && beginsWithDirectEntry(turn.tutor)),
  ).length;
  const priorCarryoverHits = turns
    .slice(1)
    .filter((turn, index) => sharesContent(turns[index].tutor, turn.tutor)).length;
  const due = turns.reduce((sum, turn) => sum + (turn.release?.dueNow || []).length, 0);
  const released = turns.reduce((sum, turn) => sum + (turn.release?.releasedNow || []).length, 0);
  const notDelivered = turns.reduce((sum, turn) => sum + (turn.release?.notDeliveredNow || []).length, 0);
  const configurationRealizationValues = turns
    .map((turn) => turn.configuration?.realizationRate)
    .filter(Number.isFinite);

  return {
    id: episode.id,
    source: episode.source,
    turnRange: episode.turnRange,
    turnCount: turns.length,
    hardIntegrity: {
      ok: hardFailureCount === 0,
      failureCount: hardFailureCount,
      counts: integrity,
    },
    sequenceQuality: {
      learnerUptake: {
        visibleTurns: uptake.filter(Boolean).length,
        eligibleTurns: turns.length,
        rate: round(divide(uptake.filter(Boolean).length, turns.length)),
        longestMissStreak: maxStreak(uptake, (value) => !value),
      },
      respondThenDevelop: {
        visibleTurns: both.filter(Boolean).length,
        eligibleTurns: turns.length,
        rate: round(divide(both.filter(Boolean).length, turns.length)),
        longestMissStreak: maxStreak(both, (value) => !value),
      },
      cluePace: {
        due,
        released,
        notDelivered,
        releaseTurns,
        medianGap:
          releaseGaps.length > 0
            ? [...releaseGaps].sort((left, right) => left - right)[Math.floor(releaseGaps.length / 2)]
            : null,
        maximumGap: releaseGaps.length > 0 ? Math.max(...releaseGaps) : null,
        directions: Object.fromEntries(
          [...new Set(turns.map((turn) => turn.release?.direction || 'unrecorded'))].map((direction) => [
            direction,
            turns.filter((turn) => (turn.release?.direction || 'unrecorded') === direction).length,
          ]),
        ),
      },
      continuity: {
        learnerCarryoverHits,
        learnerCarryoverEligible: learnerCarryoverEligible.length,
        learnerCarryoverRate: round(divide(learnerCarryoverHits, learnerCarryoverEligible.length)),
        adjacentTutorCarryoverHits: priorCarryoverHits,
        adjacentTutorBoundaries: Math.max(0, turns.length - 1),
        adjacentTutorCarryoverRate: round(divide(priorCarryoverHits, Math.max(0, turns.length - 1))),
      },
      naturalness: summarizeNaturalness(turns),
      adaptation: {
        distinctParts: new Set(parts).size,
        partTransitions: transitions(parts),
        partBoundaries: Math.max(0, parts.length - 1),
        partTransitionRate: round(divide(transitions(parts), Math.max(0, parts.length - 1))),
        partEntropyBits: round(entropy(parts)),
        maximumPartStreak: maxValueStreak(parts),
        distinctStances: new Set(stances).size,
        stanceTransitions: transitions(stances),
        stanceBoundaries: Math.max(0, stances.length - 1),
        stanceTransitionRate: round(divide(transitions(stances), Math.max(0, stances.length - 1))),
        stanceEntropyBits: round(entropy(stances)),
        maximumStanceStreak: maxValueStreak(stances),
        distinctTactics: new Set(tactics).size,
        meanRecordedConfigurationRealization: round(
          divide(
            configurationRealizationValues.reduce((sum, value) => sum + value, 0),
            configurationRealizationValues.length,
          ),
        ),
        exactPerTurnConfigurationIsDeliveryGate: false,
      },
      closure: summarizeClosure(turns),
    },
  };
}

function averageCandidateScores(candidates) {
  const dimensions = ['naturalness', 'learner_responsiveness', 'dramatic_effect', 'clarity', 'usefulness'];
  const output = { n: candidates.length, overall: null, dimensions: {} };
  for (const dimension of dimensions) {
    output.dimensions[dimension] = round(
      divide(
        candidates.reduce((sum, candidate) => sum + finite(candidate.scores?.[dimension]), 0),
        candidates.length,
      ),
    );
  }
  output.overall = round(
    divide(
      Object.values(output.dimensions).reduce((sum, value) => sum + finite(value), 0),
      dimensions.length,
    ),
  );
  return output;
}

function summarizePairedReview(pairs) {
  const candidates = pairs.flatMap((pair) => pair.candidates || []);
  const sourceClasses = [...new Set(candidates.map((candidate) => candidate.sourceClass))];
  const bySourceClass = Object.fromEntries(
    sourceClasses.map((sourceClass) => [
      sourceClass,
      averageCandidateScores(candidates.filter((candidate) => candidate.sourceClass === sourceClass)),
    ]),
  );
  const comparisons = pairs.map((pair) => {
    const original = pair.candidates.find((candidate) => candidate.sourceClass === 'rejected_original');
    const repair = pair.candidates.find((candidate) => candidate.sourceClass === 'delivered_repair');
    const originalScores = averageCandidateScores(original ? [original] : []);
    const repairScores = averageCandidateScores(repair ? [repair] : []);
    return {
      id: pair.id,
      campaign: pair.campaign,
      source: pair.source,
      originalAuditIssues: pair.originalAuditIssues,
      preference: pair.preference,
      originalOverall: originalScores.overall,
      repairOverall: repairScores.overall,
      deliveredMinusOriginal:
        original && repair ? round(finite(repairScores.overall) - finite(originalScores.overall)) : null,
    };
  });
  const comparable = comparisons.filter((comparison) => Number.isFinite(comparison.deliveredMinusOriginal));
  return {
    pairCount: pairs.length,
    bySourceClass,
    comparisons,
    meanDeliveredMinusOriginal: round(
      divide(
        comparable.reduce((sum, comparison) => sum + comparison.deliveredMinusOriginal, 0),
        comparable.length,
      ),
    ),
    originalPreferred: comparable.filter((comparison) => comparison.preference === 'rejected_original').length,
    repairPreferred: comparable.filter((comparison) => comparison.preference === 'delivered_repair').length,
    humanReviewDependency:
      'Exploratory saved ratings are not an independent human preference study; require another blinded human pass before changing runtime policy.',
  };
}

function aggregateEpisodes(episodes) {
  const hardCounts = {
    privateEvidence: 0,
    unsupportedEvidence: 0,
    sourcePerspectiveDrift: 0,
    duplicateClueDelivery: 0,
    missingClueDelivery: 0,
    unanswerableQuestion: 0,
    terminalContinuation: 0,
  };
  const totals = {
    episodes: episodes.length,
    turns: 0,
    hardFailures: 0,
    dueClues: 0,
    releasedClues: 0,
    missedClues: 0,
    uptakeVisible: 0,
    uptakeEligible: 0,
    respondDevelopVisible: 0,
    respondDevelopEligible: 0,
    partTransitions: 0,
    partBoundaries: 0,
    stanceTransitions: 0,
    stanceBoundaries: 0,
  };
  for (const episode of episodes) {
    totals.turns += episode.turnCount;
    totals.hardFailures += episode.hardIntegrity.failureCount;
    totals.dueClues += episode.sequenceQuality.cluePace.due;
    totals.releasedClues += episode.sequenceQuality.cluePace.released;
    totals.missedClues += episode.sequenceQuality.cluePace.notDelivered;
    totals.uptakeVisible += episode.sequenceQuality.learnerUptake.visibleTurns;
    totals.uptakeEligible += episode.sequenceQuality.learnerUptake.eligibleTurns;
    totals.respondDevelopVisible += episode.sequenceQuality.respondThenDevelop.visibleTurns;
    totals.respondDevelopEligible += episode.sequenceQuality.respondThenDevelop.eligibleTurns;
    totals.partTransitions += episode.sequenceQuality.adaptation.partTransitions;
    totals.partBoundaries += episode.sequenceQuality.adaptation.partBoundaries;
    totals.stanceTransitions += episode.sequenceQuality.adaptation.stanceTransitions;
    totals.stanceBoundaries += episode.sequenceQuality.adaptation.stanceBoundaries;
    addCounts(hardCounts, episode.hardIntegrity.counts);
  }
  return {
    hardIntegrity: {
      episodes: totals.episodes,
      turns: totals.turns,
      ok: totals.hardFailures === 0,
      failureCount: totals.hardFailures,
      counts: hardCounts,
      clueTransactions: {
        due: totals.dueClues,
        released: totals.releasedClues,
        missed: totals.missedClues,
      },
    },
    sequenceQuality: {
      episodes: totals.episodes,
      turns: totals.turns,
      learnerUptake: {
        visible: totals.uptakeVisible,
        eligible: totals.uptakeEligible,
        rate: round(divide(totals.uptakeVisible, totals.uptakeEligible)),
      },
      respondThenDevelop: {
        visible: totals.respondDevelopVisible,
        eligible: totals.respondDevelopEligible,
        rate: round(divide(totals.respondDevelopVisible, totals.respondDevelopEligible)),
      },
      partAdaptation: {
        transitions: totals.partTransitions,
        boundaries: totals.partBoundaries,
        rate: round(divide(totals.partTransitions, totals.partBoundaries)),
      },
      stanceAdaptation: {
        transitions: totals.stanceTransitions,
        boundaries: totals.stanceBoundaries,
        rate: round(divide(totals.stanceTransitions, totals.stanceBoundaries)),
      },
    },
  };
}

export function buildTutorStubTrajectoryShadowReport(corpus) {
  if (corpus?.schema !== CORPUS_SCHEMA) throw new Error(`expected ${CORPUS_SCHEMA}`);
  if (corpus.heldOut !== false) throw new Error('trajectory-dev corpus must be permanently non-held-out');
  if (corpus.runtimeDeliveryGate !== false) throw new Error('trajectory shadow evaluation cannot be a runtime gate');
  const episodes = (corpus.sequenceEpisodes || []).map(summarizeTutorStubTrajectoryEpisode);
  const aggregate = aggregateEpisodes(episodes);
  return {
    schema: REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    corpusId: corpus.id,
    heldOut: false,
    runtimeDeliveryGate: false,
    retroactiveRelabeling: false,
    sourcePolicy: corpus.sourcePolicy,
    claimBoundary: corpus.claimBoundary,
    hardIntegrity: {
      separatedFromSequenceQuality: true,
      ...aggregate.hardIntegrity,
    },
    sequenceQuality: {
      dimensions: [
        'learner_uptake',
        'respond_then_develop',
        'clue_pace',
        'continuity',
        'naturalness_boilerplate_proxies',
        'part_stance_adaptation',
        'closure_latency',
      ],
      exactPerTurnPartOrTacticIsRuntimeGate: false,
      aggregate: aggregate.sequenceQuality,
      episodes,
    },
    pairedBlindReview: summarizePairedReview(corpus.pairedReviews || []),
    calibrationCases: (corpus.calibrationCases || []).map((calibrationCase) => ({
      id: calibrationCase.id,
      source: calibrationCase.source,
      expectedLabel: calibrationCase.expectedLabel,
      expectedPerformanceRealized: calibrationCase.expectedPerformanceRealized,
      recordedAuditIssue: calibrationCase.recordedAuditIssue,
    })),
    paceProbes: (corpus.paceProbes || []).map((probe) => ({
      ...probe,
      heldOut: false,
      developmentOnly: true,
      observed: false,
      score: null,
    })),
  };
}

function percent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

export function renderTutorStubTrajectoryShadowMarkdown(report) {
  const integrity = report.hardIntegrity;
  const quality = report.sequenceQuality.aggregate;
  const lines = [
    '# Tutor-stub trajectory development shadow report',
    '',
    `Corpus: \`${report.corpusId}\` (permanently non-held-out; runtime gate: no).`,
    '',
    '## Claim boundary',
    '',
    report.claimBoundary,
    '',
    '## Hard integrity',
    '',
    `Hard integrity is reported separately from sequence quality. Observed failures: ${integrity.failureCount}; due clues ${integrity.clueTransactions.due}, released ${integrity.clueTransactions.released}, missed ${integrity.clueTransactions.missed}.`,
    '',
    '## Sequence quality',
    '',
    `Across ${quality.episodes} episodes and ${quality.turns} turns: learner uptake ${percent(quality.learnerUptake.rate)}, respond-then-develop ${percent(quality.respondThenDevelop.rate)}, part transitions ${percent(quality.partAdaptation.rate)}, stance transitions ${percent(quality.stanceAdaptation.rate)}.`,
    '',
    '| Episode | Turns | Hard failures | Clues | Uptake | Respond + develop | Continuity (learner / prior) | Repeated 4-grams | Parts / stances | Closure |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];
  for (const episode of report.sequenceQuality.episodes) {
    lines.push(
      `| ${episode.id} | ${episode.turnCount} | ${episode.hardIntegrity.failureCount} | ${episode.sequenceQuality.cluePace.released}/${episode.sequenceQuality.cluePace.due} | ${percent(episode.sequenceQuality.learnerUptake.rate)} | ${percent(episode.sequenceQuality.respondThenDevelop.rate)} | ${percent(episode.sequenceQuality.continuity.learnerCarryoverRate)} / ${percent(episode.sequenceQuality.continuity.adjacentTutorCarryoverRate)} | ${percent(episode.sequenceQuality.naturalness.repeatedFourGramRate)} | ${episode.sequenceQuality.adaptation.distinctParts} / ${episode.sequenceQuality.adaptation.distinctStances} | ${episode.sequenceQuality.closure.status} |`,
    );
  }
  lines.push(
    '',
    '## Saved blind review',
    '',
    `Pairs: ${report.pairedBlindReview.pairCount}; mean delivered-minus-original ${report.pairedBlindReview.meanDeliveredMinusOriginal}; original preferred ${report.pairedBlindReview.originalPreferred}; repair preferred ${report.pairedBlindReview.repairPreferred}.`,
    '',
    report.pairedBlindReview.humanReviewDependency,
    '',
    '## Calibration and pace probes',
    '',
    `Calibration cases: ${report.calibrationCases.length}. Development-only pace probes: ${report.paceProbes.length}; observed/scored: 0.`,
    '',
    'Exact selected part, tactic, and all-axis realization remain shadow evidence here. This report does not relabel V18-V22 or authorize a held-out claim.',
    '',
  );
  return `${lines.join('\n')}\n`;
}
