import crypto from 'node:crypto';
import { buildCritiqueIdf, critiqueSpecificUptake } from './communicationTopologyTraceAnalyzer.js';

const MATERIAL_CHANGE_LABELS = Object.freeze([
  'none',
  'surface_only',
  'reasoning_only',
  'action_only',
  'mixed',
  'measurement_indeterminate',
]);
const INCORPORATION_LABELS = Object.freeze([
  'not_incorporated',
  'partially_incorporated',
  'incorporated',
  'contradicted',
  'measurement_indeterminate',
]);

function compare(left, right) {
  return left === right ? 0 : left < right ? -1 : 1;
}

function round(value, digits = 6) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function standardDeviation(values) {
  const average = mean(values);
  if (!Number.isFinite(average) || values.length === 0) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}

function seededRandom(seed) {
  let state = Number(seed) | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function stratumKey(link) {
  return [
    link.scenarioId || '<unknown-scenario>',
    link.egoModel || '<unknown-ego>',
    link.superegoModel || '<unknown-superego>',
    Number.isInteger(link.ordinal) ? link.ordinal : '<unknown-ordinal>',
  ].join('\u241f');
}

function suggestionFromEntry(entry) {
  return entry?.suggestions?.[0] || entry?.suggestion || {};
}

function feedbackFromEntry(entry) {
  return (
    entry?.feedback ||
    entry?.verdict?.feedback ||
    entry?.verdict?.reasoning ||
    entry?.detail ||
    entry?.contextSummary ||
    ''
  ).trim();
}

export function flattenText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(flattenText).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    return Object.keys(value)
      .sort(compare)
      .map((key) => flattenText(value[key]))
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

export function publicSuggestionEnvelope(entry) {
  const suggestion = suggestionFromEntry(entry);
  return {
    type: suggestion.type || null,
    priority: suggestion.priority || null,
    title: suggestion.title || null,
    message: suggestion.message || null,
    actionType: suggestion.actionType || suggestion.action || null,
    actionTarget: suggestion.actionTarget || suggestion.target || null,
    suggestionCount: Array.isArray(entry?.suggestions) ? entry.suggestions.length : suggestion.message ? 1 : 0,
  };
}

export function critiqueEnvelope(entry) {
  return {
    feedback: feedbackFromEntry(entry),
    approved: entry?.approved ?? entry?.verdict?.approved ?? null,
    interventionType: entry?.interventionType || entry?.verdict?.interventionType || null,
    suggestedChanges: entry?.suggestedChanges ?? entry?.verdict?.suggestedChanges ?? null,
  };
}

function assertTraceEntry(entry, expectedAgent, allowedActions, label, checkId) {
  if (!entry || entry.agent !== expectedAgent || !allowedActions.includes(entry.action)) {
    throw new Error(`${checkId}: ${label} trace entry does not match the frozen link indexes`);
  }
}

export function hydrateLinkFromTrace(row, trace) {
  if (!row?.checkId || !row?.sourceTraceSha256 || !row?.traceIndexes) {
    throw new Error('A source row is missing check identity, trace indexes, or source hash');
  }
  if (!Array.isArray(trace)) throw new Error(`${row.checkId}: dialogue trace is not an array`);
  const draftEntry = trace[row.traceIndexes.draft];
  const critiqueEntry = trace[row.traceIndexes.critique];
  const revisionEntry = trace[row.traceIndexes.revision];
  assertTraceEntry(draftEntry, 'ego', ['generate', 'revise', 'revision'], 'draft', row.checkId);
  assertTraceEntry(critiqueEntry, 'superego', ['review', 'revise'], 'critique', row.checkId);
  assertTraceEntry(revisionEntry, 'ego', ['revise', 'revision'], 'revision', row.checkId);

  const draft = publicSuggestionEnvelope(draftEntry);
  const critique = critiqueEnvelope(critiqueEntry);
  const revision = publicSuggestionEnvelope(revisionEntry);
  if (!draft.message || !critique.feedback || !revision.message) {
    throw new Error(`${row.checkId}: frozen link is missing draft, critique, or revision text`);
  }
  return {
    ...row,
    draft,
    critique,
    revision,
    draftText: draft.message,
    critiqueText: critique.feedback,
    fullCritiqueText: [critique.feedback, flattenText(critique.suggestedChanges)].filter(Boolean).join(' '),
    revisionText: revision.message,
  };
}

function aggregateBy(links, field, rowNullMeans) {
  const groups = new Map();
  for (const link of links) {
    const key = String(link[field] ?? '<missing>');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(link);
  }
  const result = {};
  for (const [key, rows] of [...groups.entries()].sort(([left], [right]) => compare(left, right))) {
    const observed = rows.map((row) => row.__observedScore);
    const broken = rows.map((row) => rowNullMeans.get(row.checkId));
    result[key] = {
      links: rows.length,
      observedMean: round(mean(observed)),
      brokenMean: round(mean(broken)),
      meanDifference: round(mean(observed) - mean(broken)),
      positiveDifferenceLinks: rows.filter((row) => row.__observedScore > rowNullMeans.get(row.checkId)).length,
    };
  }
  return result;
}

/**
 * Corpus-level broken-link randomization. Each draw applies a non-zero cyclic
 * shift to the critiques inside every matched stratum. This preserves the
 * critique multiset and gives every link each wrong critique equally often
 * while preventing the observed pairing from surviving by accident.
 */
export function aggregateBrokenLinkSensitivity(
  links,
  {
    permutations = 20000,
    seed = 20260904,
    minimumStratumSize = 2,
    critiqueField = 'critiqueText',
    idfCorpus = null,
  } = {},
) {
  if (!Number.isInteger(permutations) || permutations < 1) throw new Error('permutations must be a positive integer');
  if (!Number.isInteger(minimumStratumSize) || minimumStratumSize < 2) {
    throw new Error('minimumStratumSize must be at least 2');
  }
  const prepared = links
    .filter(
      (link) =>
        link?.checkId &&
        link?.dialogueId &&
        link?.draftText &&
        link?.revisionText &&
        String(link?.[critiqueField] || '').trim(),
    )
    .map((link) => ({
      ...link,
      response: { text: link.draftText },
      disciplinaryCheck: { text: link[critiqueField] },
      nextEgo: { text: link.revisionText },
    }))
    .sort((left, right) => compare(left.checkId, right.checkId));
  const idfSource = (idfCorpus || links)
    .filter((link) => String(link?.[critiqueField] || '').trim())
    .map((link) => ({ disciplinaryCheck: { text: link[critiqueField] } }));
  const idf = buildCritiqueIdf(idfSource);
  const byStratum = new Map();
  for (const link of prepared) {
    const key = stratumKey(link);
    if (!byStratum.has(key)) byStratum.set(key, []);
    byStratum.get(key).push(link);
  }
  const strata = [...byStratum.entries()]
    .filter(([, rows]) => rows.length >= minimumStratumSize)
    .sort(([left], [right]) => compare(left, right))
    .map(([key, rows]) => {
      const ordered = rows.sort(
        (left, right) => compare(left.dialogueId, right.dialogueId) || compare(left.checkId, right.checkId),
      );
      const matrix = ordered.map((link) =>
        ordered.map(
          (candidate) => critiqueSpecificUptake(link.draftText, candidate[critiqueField], link.revisionText, idf).score,
        ),
      );
      if (matrix.some((row) => row.some((score) => !Number.isFinite(score)))) {
        throw new Error(`Non-finite uptake score in stratum ${key}`);
      }
      return { key, rows: ordered, matrix };
    });
  if (!strata.length) throw new Error('No matched strata contain enough links for aggregate randomization');

  const selected = strata.flatMap((stratum) => stratum.rows);
  const totalLinks = selected.length;
  const observedMean =
    strata.reduce((total, stratum) => total + stratum.matrix.reduce((sum, row, index) => sum + row[index], 0), 0) /
    totalLinks;
  const rowNullMeans = new Map();
  for (const stratum of strata) {
    for (let rowIndex = 0; rowIndex < stratum.rows.length; rowIndex++) {
      const alternatives = stratum.matrix[rowIndex].filter((_, columnIndex) => columnIndex !== rowIndex);
      rowNullMeans.set(stratum.rows[rowIndex].checkId, mean(alternatives));
      stratum.rows[rowIndex].__observedScore = stratum.matrix[rowIndex][rowIndex];
    }
  }

  const random = seededRandom(seed);
  const nullMeans = [];
  let atLeastObserved = 0;
  for (let draw = 0; draw < permutations; draw++) {
    let total = 0;
    for (const stratum of strata) {
      const shift = 1 + Math.floor(random() * (stratum.rows.length - 1));
      for (let rowIndex = 0; rowIndex < stratum.rows.length; rowIndex++) {
        total += stratum.matrix[rowIndex][(rowIndex + shift) % stratum.rows.length];
      }
    }
    const nullMean = total / totalLinks;
    nullMeans.push(nullMean);
    if (nullMean >= observedMean) atLeastObserved++;
  }
  const brokenMean = mean(nullMeans);
  const nullStandardDeviation = standardDeviation(nullMeans);
  const output = {
    method: 'matched-stratum non-zero cyclic-shift randomization',
    critiqueField,
    links: totalLinks,
    strata: strata.length,
    minimumStratumSize,
    permutations,
    seed,
    observedMean: round(observedMean),
    brokenMean: round(brokenMean),
    observedToBrokenRatio: round(brokenMean > 0 ? observedMean / brokenMean : null),
    meanDifference: round(observedMean - brokenMean),
    nullStandardDeviation: round(nullStandardDeviation),
    nullMinimum: round(Math.min(...nullMeans)),
    nullMaximum: round(Math.max(...nullMeans)),
    drawsAtLeastObserved: atLeastObserved,
    oneSidedMonteCarloP: round((atLeastObserved + 1) / (permutations + 1)),
    claimBoundary: 'Exploratory aggregate lexical association only; not an individual-link or causal effect.',
    byProfile: aggregateBy(selected, 'profileName', rowNullMeans),
    byScenario: aggregateBy(selected, 'scenarioId', rowNullMeans),
  };
  for (const link of selected) delete link.__observedScore;
  return output;
}

function hasSuggestedChanges(link) {
  const value = link?.critique?.suggestedChanges;
  return value !== null && value !== undefined && flattenText(value).length > 0;
}

export function auditEvidenceChannels(links) {
  const changed = (left, right, field) => (left?.[field] || null) !== (right?.[field] || null);
  return {
    links: links.length,
    parserFailureCritiques: links.filter((link) => /unable to parse review/iu.test(link.critique.feedback)).length,
    parserFailureCritiquesTestable: links.filter(
      (link) => Number.isFinite(link.empiricalP) && /unable to parse review/iu.test(link.critique.feedback),
    ).length,
    critiquesWithStructuredChanges: links.filter(hasSuggestedChanges).length,
    critiquesWithSpecificRevisionLists: links.filter(
      (link) =>
        Array.isArray(link?.critique?.suggestedChanges?.specificRevisions) &&
        link.critique.suggestedChanges.specificRevisions.length > 0,
    ).length,
    changedActionType: links.filter((link) => changed(link.draft, link.revision, 'actionType')).length,
    changedActionTarget: links.filter((link) => changed(link.draft, link.revision, 'actionTarget')).length,
    changedTitle: links.filter((link) => changed(link.draft, link.revision, 'title')).length,
    changedMessage: links.filter((link) => changed(link.draft, link.revision, 'message')).length,
    multipleDraftSuggestions: links.filter((link) => link.draft.suggestionCount > 1).length,
    multipleRevisionSuggestions: links.filter((link) => link.revision.suggestionCount > 1).length,
    originalLexicalInstrumentRead: ['critique.feedback', 'revision.firstSuggestion.message'],
    omittedFromOriginalLexicalInstrument: [
      'critique.suggestedChanges',
      'revision.firstSuggestion.title',
      'revision.firstSuggestion.actionType',
      'revision.firstSuggestion.actionTarget',
      'additional revision suggestions',
    ],
  };
}

function systematicMidpointSample(rows, count) {
  if (rows.length <= count) return rows;
  const selected = [];
  for (let index = 0; index < count; index++) {
    selected.push(rows[Math.floor(((index + 0.5) * rows.length) / count)]);
  }
  return selected;
}

function blindedItemId(link) {
  return `scr-${crypto
    .createHash('sha256')
    .update(`${link.checkId}\u241f${link.sourceTraceSha256}`)
    .digest('hex')
    .slice(0, 12)}`;
}

export function buildSemanticReviewPacket(links, { samplePerProfile = 4 } = {}) {
  if (!Number.isInteger(samplePerProfile) || samplePerProfile < 1) {
    throw new Error('samplePerProfile must be a positive integer');
  }
  const byProfile = new Map();
  for (const link of links) {
    if (!link.profileName || !link.sourceTraceSha256)
      throw new Error(`${link.checkId}: missing profile or source hash`);
    if (!byProfile.has(link.profileName)) byProfile.set(link.profileName, []);
    byProfile.get(link.profileName).push(link);
  }
  const selected = [];
  for (const [profileName, rows] of [...byProfile.entries()].sort(([left], [right]) => compare(left, right))) {
    const ordered = rows.sort(
      (left, right) =>
        compare(left.scenarioId, right.scenarioId) ||
        left.ordinal - right.ordinal ||
        compare(left.dialogueId, right.dialogueId) ||
        compare(left.checkId, right.checkId),
    );
    selected.push(...systematicMidpointSample(ordered, samplePerProfile).map((link) => ({ ...link, profileName })));
  }
  const packetRows = selected
    .map((link) => ({
      item_id: blindedItemId(link),
      draft: link.draft,
      critique: link.critique,
      revision: link.revision,
      coding: {
        semantic_incorporation: null,
        material_change: null,
        directive_fulfillment: null,
        critique_evidence_spans: [],
        revision_evidence_spans: [],
        confidence: null,
        notes: null,
      },
    }))
    .sort((left, right) => compare(left.item_id, right.item_id));
  const identityRows = selected
    .map((link) => ({
      item_id: blindedItemId(link),
      check_id: link.checkId,
      dialogue_id: link.dialogueId,
      run_id: link.runId,
      profile_name: link.profileName,
      scenario_id: link.scenarioId,
      ego_model: link.egoModel,
      superego_model: link.superegoModel,
      ordinal: link.ordinal,
      trace_indexes: link.traceIndexes,
      source_trace_sha256: link.sourceTraceSha256,
    }))
    .sort((left, right) => compare(left.item_id, right.item_id));
  return {
    packet: {
      schema_version: 'superego-semantic-review-packet-v1',
      claim_boundary:
        'Calibration packet for independent semantic coding; lexical outcomes and source identities are withheld.',
      selection: {
        method: 'profile-stratified systematic midpoint sampling before semantic labels exist',
        sample_per_profile: samplePerProfile,
        profiles: byProfile.size,
        selected: packetRows.length,
      },
      allowed_labels: {
        semantic_incorporation: INCORPORATION_LABELS,
        material_change: MATERIAL_CHANGE_LABELS,
        directive_fulfillment: ['none', 'partial', 'full', 'measurement_indeterminate'],
      },
      rows: packetRows,
    },
    identityLedger: {
      schema_version: 'superego-semantic-review-identity-ledger-v1',
      warning: 'Keep separate from coders until coding is sealed.',
      rows: identityRows,
    },
  };
}

export function causalReplayProtocolSeed() {
  return {
    schema_version: 'superego-critique-causal-replay-protocol-seed-v1',
    status: 'design_seed_not_authorized',
    frozen_unit: 'one draft plus its exact visible context, held identical across arms',
    arms: [
      { id: 'draft_only', operation: 'retain the frozen draft; no generation call' },
      { id: 'generic_revision', operation: 'one revision pass with a content-neutral improve instruction' },
      { id: 'actual_critique', operation: "one revision pass with the draft's actual complete critique" },
      { id: 'matched_wrong_critique', operation: 'one revision pass with a same-stratum critique from another draft' },
    ],
    estimands: [
      'generic_revision minus draft_only: extra-pass effect',
      'actual_critique minus generic_revision: critique-content effect',
      'actual_critique minus matched_wrong_critique: link-specific critique effect',
      'actual_critique minus draft_only: total loop effect',
    ],
    measurement: {
      semantic: 'independent pinned adjudicator with quoted critique and revision evidence spans',
      public_output: ['directive fulfillment', 'material action or strategy change', 'blind output quality'],
      separate_future_lane: 'learner response or transfer; never inferred from tutor revision quality',
      disagreement: 'measurement_indeterminate',
    },
    execution_rules: [
      'randomize arm presentation within each frozen unit',
      'use the same ego route and decoding policy in every generated arm',
      'one planned generation per arm; no outcome-driven retry or resampling',
      'keep the generating architecture separate from every semantic and quality judge',
    ],
    unresolved_before_registration: [
      'eligible frozen-unit corpus and exclusions',
      'sample size and sensitivity target',
      'master randomization seed',
      'ego model and provider route',
      'semantic adjudicator and blinded quality judge routes',
      'primary endpoint, threshold, and indeterminate disposition',
      'attempt and spend ceilings',
      'technical-failure and missing-unit policy',
    ],
    launch_boundary:
      'No provider call is authorized by this protocol seed. A complete study design and explicit GO are still required.',
  };
}

export default {
  aggregateBrokenLinkSensitivity,
  auditEvidenceChannels,
  buildSemanticReviewPacket,
  causalReplayProtocolSeed,
  critiqueEnvelope,
  flattenText,
  hydrateLinkFromTrace,
  publicSuggestionEnvelope,
};
