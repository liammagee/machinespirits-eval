import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import Database from 'better-sqlite3';

const METRIC_DIM_KEYS = [
  'mutual_recognition',
  'dialectical_responsiveness',
  'memory_integration',
  'transformative_potential',
  'tutor_adaptation',
  'learner_growth',
  'productive_struggle',
  'epistemic_honesty',
];

const ALLOWED_COLUMNS = new Set([
  'run_id',
  'profile_name',
  'scenario_name',
  'judge_model',
  'tutor_first_turn_score',
  'learner_scores',
  'learner_overall_score',
  'factor_recognition',
  'factor_multi_agent_tutor',
  'factor_multi_agent_learner',
  'created_at',
  'dialogue_id',
  'dialogue_rounds',
  'scenario_type',
  'success',
  'error_message',
  'tutor_last_turn_score',
  'scenario_id',
  'prompt_id',
]);

function stableSerialize(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function ensureColumnName(name) {
  if (!ALLOWED_COLUMNS.has(name)) {
    throw new Error(`Unsupported column in discourse spec: ${name}`);
  }
  return name;
}

export function mean(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function std(values) {
  if (!Array.isArray(values) || values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((acc, value) => acc + (value - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function cohensD(groupA, groupB) {
  if (!Array.isArray(groupA) || !Array.isArray(groupB) || groupA.length < 2 || groupB.length < 2) {
    return 0;
  }
  const mA = mean(groupA);
  const mB = mean(groupB);
  const sA = std(groupA);
  const sB = std(groupB);
  const pooled = Math.sqrt(
    ((groupA.length - 1) * sA ** 2 + (groupB.length - 1) * sB ** 2) / (groupA.length + groupB.length - 2),
  );
  return pooled > 0 ? (mA - mB) / pooled : 0;
}

export function pearsonCorrelation(groupA, groupB) {
  if (!Array.isArray(groupA) || !Array.isArray(groupB) || groupA.length !== groupB.length || groupA.length < 2) {
    return 0;
  }
  const meanA = mean(groupA);
  const meanB = mean(groupB);
  let numerator = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < groupA.length; i++) {
    const da = groupA[i] - meanA;
    const db = groupB[i] - meanB;
    numerator += da * db;
    denA += da ** 2;
    denB += db ** 2;
  }
  const denominator = Math.sqrt(denA * denB);
  return denominator > 0 ? numerator / denominator : 0;
}

function fTest2x2(data) {
  const allValues = [...data.a0b0, ...data.a0b1, ...data.a1b0, ...data.a1b1];
  const n = allValues.length;
  if (n < 8) {
    return {
      n,
      mainA: { F: NaN, delta: NaN, marginals: [NaN, NaN] },
      mainB: { F: NaN, delta: NaN, marginals: [NaN, NaN] },
      interaction: { F: NaN, delta: NaN },
      cellMeans: { a0b0: NaN, a0b1: NaN, a1b0: NaN, a1b1: NaN },
      cellNs: { a0b0: data.a0b0.length, a0b1: data.a0b1.length, a1b0: data.a1b0.length, a1b1: data.a1b1.length },
      dfW: n - 4,
      msW: NaN,
    };
  }

  const grandMean = mean(allValues);
  const cellMeans = {
    a0b0: mean(data.a0b0),
    a0b1: mean(data.a0b1),
    a1b0: mean(data.a1b0),
    a1b1: mean(data.a1b1),
  };
  const cellNs = {
    a0b0: data.a0b0.length,
    a0b1: data.a0b1.length,
    a1b0: data.a1b0.length,
    a1b1: data.a1b1.length,
  };

  const margA0 = mean([...data.a0b0, ...data.a0b1]);
  const margA1 = mean([...data.a1b0, ...data.a1b1]);
  const margB0 = mean([...data.a0b0, ...data.a1b0]);
  const margB1 = mean([...data.a0b1, ...data.a1b1]);

  const ssA =
    (cellNs.a0b0 + cellNs.a0b1) * (margA0 - grandMean) ** 2 +
    (cellNs.a1b0 + cellNs.a1b1) * (margA1 - grandMean) ** 2;
  const ssB =
    (cellNs.a0b0 + cellNs.a1b0) * (margB0 - grandMean) ** 2 +
    (cellNs.a0b1 + cellNs.a1b1) * (margB1 - grandMean) ** 2;

  const ssAB =
    cellNs.a0b0 * (cellMeans.a0b0 - margA0 - margB0 + grandMean) ** 2 +
    cellNs.a0b1 * (cellMeans.a0b1 - margA0 - margB1 + grandMean) ** 2 +
    cellNs.a1b0 * (cellMeans.a1b0 - margA1 - margB0 + grandMean) ** 2 +
    cellNs.a1b1 * (cellMeans.a1b1 - margA1 - margB1 + grandMean) ** 2;

  let ssW = 0;
  for (const [key, arr] of Object.entries(data)) {
    const m = cellMeans[key];
    ssW += arr.reduce((sum, value) => sum + (value - m) ** 2, 0);
  }
  const dfW = n - 4;
  const msW = ssW / dfW;

  return {
    n,
    mainA: { F: ssA / msW, delta: margA1 - margA0, marginals: [margA0, margA1] },
    mainB: { F: ssB / msW, delta: margB1 - margB0, marginals: [margB0, margB1] },
    interaction: {
      F: ssAB / msW,
      delta: cellMeans.a1b1 - cellMeans.a1b0 - (cellMeans.a0b1 - cellMeans.a0b0),
    },
    cellMeans,
    cellNs,
    dfW,
    msW,
  };
}

function safeJsonParse(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseBooleanish(value) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return null;
}

function hasToken(text, token) {
  if (!text) return false;
  const re = new RegExp(`(^|_)${token}(_|$)`);
  return re.test(text);
}

export function inferRecognitionFromProfileName(profileName) {
  const value = (profileName || '').toLowerCase();
  if (/(^|_)recog(nition)?(_|$)/.test(value) || value.includes('recognition')) return true;
  if (
    /(^|_)base(line)?(_|$)/.test(value) ||
    value.includes('baseline') ||
    value.includes('naive') ||
    value.includes('placebo') ||
    value.includes('hardwired')
  ) {
    return false;
  }
  return null;
}

export function inferMultiFromProfileName(profileName) {
  const value = (profileName || '').toLowerCase();
  if (hasToken(value, 'single')) return false;
  if (hasToken(value, 'multi') || value.includes('dialectical')) return true;
  return null;
}

export function extractSuggestionText(suggestions, rawResponse = '') {
  const parsed = safeJsonParse(suggestions);
  if (Array.isArray(parsed)) {
    return parsed.map((item) => [item?.message, item?.title, item?.reason].filter(Boolean).join(' ')).join(' ');
  }
  if (typeof suggestions === 'string') return suggestions;
  if (typeof rawResponse === 'string') return rawResponse;
  return '';
}

function ttr(text) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);
  if (words.length === 0) return 0;
  return new Set(words).size / words.length;
}

function computeDimensionVariance14(row) {
  const base = [
    row.score_relevance,
    row.score_specificity,
    row.score_pedagogical,
    row.score_personalization,
    row.score_actionability,
    row.score_tone,
  ].filter((value) => value != null);
  const scores = [...base];

  const parsed = safeJsonParse(row.scores_with_reasoning);
  if (parsed && typeof parsed === 'object') {
    for (const key of METRIC_DIM_KEYS) {
      const score = parsed?.[key]?.score;
      if (isFiniteNumber(score)) scores.push(score);
    }
  }
  return std(scores);
}

function learnerCompositeFromTurnScores(scores) {
  const revision = scores?.revision_signals?.score || 0;
  const question = scores?.question_quality?.score || 0;
  const conceptual = scores?.conceptual_engagement?.score || 0;
  return ((revision * 0.35 + question * 0.3 + conceptual * 0.35 - 1) / 4) * 100;
}

export function computeLearnerSummaryFromScores(rawLearnerScores) {
  const parsed = safeJsonParse(rawLearnerScores);
  if (!parsed || typeof parsed !== 'object') return null;
  const turns = [];

  for (const [turnKey, turnValue] of Object.entries(parsed)) {
    const scores = turnValue?.scores;
    if (!scores) continue;
    const turnIndexFromKey = Number(String(turnKey).replace(/[^0-9]/g, ''));
    const turnIndex = Number.isFinite(turnIndexFromKey) && turnIndexFromKey > 0 ? turnIndexFromKey : turnValue?.turnIndex || 0;
    const revision = scores?.revision_signals?.score || 0;
    turns.push({
      turnIndex,
      revision,
      composite: learnerCompositeFromTurnScores(scores),
    });
  }

  if (turns.length === 0) return null;
  turns.sort((a, b) => a.turnIndex - b.turnIndex);
  const first = turns[0];
  const last = turns[turns.length - 1];
  return {
    turnCount: turns.length,
    avgComposite: mean(turns.map((turn) => turn.composite)),
    finalComposite: last.composite,
    learningArc: turns.length > 1 ? last.composite - first.composite : 0,
    revisionArc: turns.length > 1 ? last.revision - first.revision : 0,
  };
}

function resolveRowFlags(row, domain) {
  // Prefer profile-name inference because historical factor columns are not
  // consistently populated or semantically stable across runs.
  const inferredRecognition = inferRecognitionFromProfileName(row.profile_name);
  const factorRec = parseBooleanish(row.factor_recognition);
  const recognition = inferredRecognition ?? factorRec;

  const inferredMulti = inferMultiFromProfileName(row.profile_name);
  const factorMulti =
    domain === 'learner' ? parseBooleanish(row.factor_multi_agent_learner) : parseBooleanish(row.factor_multi_agent_tutor);
  const multi = inferredMulti ?? factorMulti;

  return { recognition, multi };
}

function computeTutorMetric(row, metric) {
  if (metric === 'response_length') {
    return extractSuggestionText(row.suggestions, row.raw_response).length;
  }
  if (metric === 'ttr') {
    return ttr(extractSuggestionText(row.suggestions, row.raw_response));
  }
  if (metric === 'dimension_variance_14') {
    return computeDimensionVariance14(row);
  }
  return null;
}

function computeLearnerMetric(row, metric) {
  const summary = computeLearnerSummaryFromScores(row.learner_scores);
  if (!summary) return null;
  if (metric === 'avg_composite') return summary.avgComposite;
  if (metric === 'final_composite') return summary.finalComposite;
  if (metric === 'learning_arc') return summary.learningArc;
  if (metric === 'revision_arc') return summary.revisionArc;
  return null;
}

const TUTOR_METRICS = new Set(['response_length', 'ttr', 'dimension_variance_14']);
const LEARNER_METRICS = new Set(['avg_composite', 'final_composite', 'learning_arc', 'revision_arc']);

function requiredColumnsForMetric(metric) {
  if (metric === 'tutor_first_turn_score' || metric === 'tutor_last_turn_score' || metric === 'learner_overall_score') {
    return [metric];
  }
  if (metric === 'response_length' || metric === 'ttr') {
    return ['suggestions', 'raw_response'];
  }
  if (metric === 'dimension_variance_14') {
    return [
      'score_relevance',
      'score_specificity',
      'score_pedagogical',
      'score_personalization',
      'score_actionability',
      'score_tone',
      'scores_with_reasoning',
    ];
  }
  if (LEARNER_METRICS.has(metric)) return ['learner_scores'];
  return [];
}

function metricValueFromRow(row, metric) {
  if (metric === 'tutor_first_turn_score' || metric === 'tutor_last_turn_score' || metric === 'learner_overall_score') {
    return row?.[metric];
  }
  if (TUTOR_METRICS.has(metric)) {
    return computeTutorMetric(row, metric);
  }
  if (LEARNER_METRICS.has(metric)) {
    return computeLearnerMetric(row, metric);
  }
  return null;
}

function profileMatches(profileName, patterns = [], exactList = []) {
  const value = profileName || '';
  if (Array.isArray(exactList) && exactList.includes(value)) return true;
  if (!Array.isArray(patterns)) return false;
  for (const pattern of patterns) {
    try {
      if (new RegExp(pattern, 'i').test(value)) return true;
    } catch {
      /* ignore invalid regex */
    }
  }
  return false;
}

function mergeStatus(current, next) {
  const rank = { pass: 0, warn: 1, fail: 2 };
  if (!(current in rank)) return next;
  if (!(next in rank)) return current;
  return rank[next] > rank[current] ? next : current;
}

function findStatementOccurrences(paperText, statement) {
  const pattern = statement?.pattern;
  if (!pattern) return { count: 0, matches: [] };
  const flags = statement?.flags || 'i';
  const countFlags = flags.includes('g') ? flags : `${flags}g`;

  const reCount = new RegExp(pattern, countFlags);
  const reFirst = new RegExp(pattern, flags.replace(/g/g, ''));
  const matches = [...paperText.matchAll(reCount)];
  const annotated = matches.map((match) => {
    const index = match.index ?? -1;
    const line = index >= 0 ? paperText.slice(0, index).split('\n').length : null;
    return { text: match[0], index, line };
  });

  if (annotated.length === 0) {
    const first = paperText.match(reFirst);
    if (!first) return { count: 0, matches: [] };
  }
  return { count: annotated.length, matches: annotated };
}

function buildWhereClause(filters = {}) {
  const clauses = [];
  const params = [];

  if (Array.isArray(filters.run_ids) && filters.run_ids.length > 0) {
    clauses.push(`run_id IN (${filters.run_ids.map(() => '?').join(', ')})`);
    params.push(...filters.run_ids);
  }

  if (filters.not_null && Array.isArray(filters.not_null)) {
    for (const column of filters.not_null) {
      clauses.push(`${ensureColumnName(column)} IS NOT NULL`);
    }
  }

  if (filters.is_null && Array.isArray(filters.is_null)) {
    for (const column of filters.is_null) {
      clauses.push(`${ensureColumnName(column)} IS NULL`);
    }
  }

  if (filters.like && typeof filters.like === 'object') {
    for (const [column, value] of Object.entries(filters.like)) {
      clauses.push(`${ensureColumnName(column)} LIKE ?`);
      params.push(value);
    }
  }

  if (filters.equals && typeof filters.equals === 'object') {
    for (const [column, value] of Object.entries(filters.equals)) {
      clauses.push(`${ensureColumnName(column)} = ?`);
      params.push(value);
    }
  }

  if (filters.in && typeof filters.in === 'object') {
    for (const [column, values] of Object.entries(filters.in)) {
      if (!Array.isArray(values) || values.length === 0) continue;
      clauses.push(`${ensureColumnName(column)} IN (${values.map(() => '?').join(', ')})`);
      params.push(...values);
    }
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function evaluateManifestTotal(manifest, evidence) {
  const field = evidence?.field;
  if (!field) throw new Error('manifest_total evidence requires "field"');
  const value = manifest?.totals?.[field];
  if (!isFiniteNumber(value)) {
    throw new Error(`manifest_total could not read numeric totals.${field}`);
  }
  return {
    value,
    details: { field, value },
    fingerprint: { source: 'manifest', version: manifest?.version || null, generated: manifest?.generated || null, field, value },
  };
}

function evaluateDbCount(db, evidence) {
  const { sql, params } = buildWhereClause(evidence?.filters || {});
  const row = db.prepare(`SELECT COUNT(*) AS value, MAX(created_at) AS max_created_at FROM evaluation_results ${sql}`).get(...params);
  const value = Number(row?.value || 0);
  return {
    value,
    details: { count: value, max_created_at: row?.max_created_at || null },
    fingerprint: { source: 'db_count', count: value, max_created_at: row?.max_created_at || null },
  };
}

function evaluateEffectSize(db, evidence) {
  const domain = evidence?.domain;
  const metric = evidence?.metric;
  const groupBy = evidence?.group_by;
  const scope = evidence?.scope || 'all';

  if (!['tutor', 'learner'].includes(domain)) {
    throw new Error('effect_size evidence requires domain=tutor|learner');
  }
  if (!['recognition', 'architecture'].includes(groupBy)) {
    throw new Error('effect_size evidence requires group_by=recognition|architecture');
  }

  const selectColumns = [
    'profile_name',
    'factor_recognition',
    'factor_multi_agent_tutor',
    'factor_multi_agent_learner',
    'created_at',
  ];

  if (domain === 'tutor') {
    selectColumns.push(
      'suggestions',
      'raw_response',
      'score_relevance',
      'score_specificity',
      'score_pedagogical',
      'score_personalization',
      'score_actionability',
      'score_tone',
      'scores_with_reasoning',
    );
  } else {
    selectColumns.push('learner_scores');
  }

  const filters = {
    ...(evidence?.filters || {}),
    not_null: [...(evidence?.filters?.not_null || []), domain === 'tutor' ? 'tutor_first_turn_score' : 'learner_scores'],
  };
  const { sql, params } = buildWhereClause(filters);
  const rows = db.prepare(`SELECT ${selectColumns.join(', ')} FROM evaluation_results ${sql}`).all(...params);

  const group1 = [];
  const group0 = [];
  let maxCreatedAt = null;
  let skippedForUnknownGroup = 0;

  for (const row of rows) {
    if (row.created_at && (!maxCreatedAt || row.created_at > maxCreatedAt)) maxCreatedAt = row.created_at;
    const flags = resolveRowFlags(row, domain);

    if (scope === 'multi_only' && flags.multi !== true) continue;
    if (scope === 'single_only' && flags.multi !== false) continue;

    const value = domain === 'tutor' ? computeTutorMetric(row, metric) : computeLearnerMetric(row, metric);
    if (!isFiniteNumber(value)) continue;

    const bucket = groupBy === 'recognition' ? flags.recognition : flags.multi;
    if (bucket === true) group1.push(value);
    else if (bucket === false) group0.push(value);
    else skippedForUnknownGroup++;
  }

  const value = cohensD(group1, group0);
  return {
    value,
    details: {
      metric,
      domain,
      group_by: groupBy,
      scope,
      n_group1: group1.length,
      n_group0: group0.length,
      mean_group1: mean(group1),
      mean_group0: mean(group0),
      skipped_for_unknown_group: skippedForUnknownGroup,
    },
    fingerprint: {
      source: 'effect_size',
      domain,
      metric,
      group_by: groupBy,
      scope,
      n_rows: rows.length,
      max_created_at: maxCreatedAt,
      n_group1: group1.length,
      n_group0: group0.length,
    },
  };
}

function evaluateManifestSectionTotal(manifest, evidence) {
  const sections = Array.isArray(evidence?.sections)
    ? evidence.sections
    : evidence?.section
      ? [evidence.section]
      : [];
  if (sections.length === 0) {
    throw new Error('manifest_section_total evidence requires section or sections');
  }

  const field = evidence?.field || 'expected_scored';
  if (!['expected_scored', 'expected_attempts'].includes(field)) {
    throw new Error(`manifest_section_total unsupported field: ${field}`);
  }

  const matchMode = evidence?.match || 'exact';
  const rows = Array.isArray(manifest?.key_evaluations) ? manifest.key_evaluations : [];
  let value = 0;
  let matchedRows = 0;
  for (const row of rows) {
    const section = row?.section;
    if (!section) continue;
    const matches = sections.some((target) => (matchMode === 'prefix' ? section.startsWith(String(target)) : section === target));
    if (!matches) continue;
    const cellValue = Number(row?.[field] || 0);
    value += cellValue;
    matchedRows++;
  }

  return {
    value,
    details: {
      field,
      sections,
      match: matchMode,
      matched_rows: matchedRows,
      value,
    },
    fingerprint: {
      source: 'manifest_section_total',
      manifest_version: manifest?.version || null,
      generated: manifest?.generated || null,
      field,
      sections,
      match: matchMode,
      value,
    },
  };
}

function evaluateProfileGroupEffectSize(db, evidence) {
  const metric = evidence?.metric || 'tutor_first_turn_score';
  const metricColumns = requiredColumnsForMetric(metric);
  const columns = ['profile_name', 'created_at', ...metricColumns];
  const { sql, params } = buildWhereClause(evidence?.filters || {});
  const rows = db.prepare(`SELECT ${[...new Set(columns)].join(', ')} FROM evaluation_results ${sql}`).all(...params);

  const group1Profiles = Array.isArray(evidence?.group1_profiles) ? evidence.group1_profiles : [];
  const group0Profiles = Array.isArray(evidence?.group0_profiles) ? evidence.group0_profiles : [];
  const group1Patterns = Array.isArray(evidence?.group1_patterns) ? evidence.group1_patterns : [];
  const group0Patterns = Array.isArray(evidence?.group0_patterns) ? evidence.group0_patterns : [];

  const group1 = [];
  const group0 = [];
  let skipped = 0;
  let maxCreatedAt = null;

  for (const row of rows) {
    if (row.created_at && (!maxCreatedAt || row.created_at > maxCreatedAt)) maxCreatedAt = row.created_at;
    const value = metricValueFromRow(row, metric);
    if (!isFiniteNumber(value)) continue;

    const inGroup1 = profileMatches(row.profile_name, group1Patterns, group1Profiles);
    const inGroup0 = profileMatches(row.profile_name, group0Patterns, group0Profiles);
    if (inGroup1 && !inGroup0) group1.push(value);
    else if (inGroup0 && !inGroup1) group0.push(value);
    else skipped++;
  }

  return {
    value: cohensD(group1, group0),
    details: {
      metric,
      n_group1: group1.length,
      n_group0: group0.length,
      mean_group1: mean(group1),
      mean_group0: mean(group0),
      skipped_rows: skipped,
    },
    fingerprint: {
      source: 'profile_group_effect_size',
      metric,
      n_rows: rows.length,
      n_group1: group1.length,
      n_group0: group0.length,
      max_created_at: maxCreatedAt,
      group1_profiles: group1Profiles,
      group0_profiles: group0Profiles,
      group1_patterns: group1Patterns,
      group0_patterns: group0Patterns,
    },
  };
}

function evaluateAnova2x2Evidence(db, evidence) {
  const metric = evidence?.metric || 'tutor_first_turn_score';
  const term = evidence?.term || 'interaction';
  const output = evidence?.output || 'F';
  const metricColumns = requiredColumnsForMetric(metric);
  const columns = ['profile_name', 'factor_recognition', 'factor_multi_agent_tutor', 'created_at', ...metricColumns];
  const { sql, params } = buildWhereClause(evidence?.filters || {});
  const rows = db.prepare(`SELECT ${[...new Set(columns)].join(', ')} FROM evaluation_results ${sql}`).all(...params);

  const data = { a0b0: [], a0b1: [], a1b0: [], a1b1: [] };
  let skipped = 0;
  let maxCreatedAt = null;

  for (const row of rows) {
    if (row.created_at && (!maxCreatedAt || row.created_at > maxCreatedAt)) maxCreatedAt = row.created_at;
    const value = metricValueFromRow(row, metric);
    if (!isFiniteNumber(value)) continue;

    const flags = resolveRowFlags(row, 'tutor');
    if (flags.recognition == null || flags.multi == null) {
      skipped++;
      continue;
    }
    const key = `a${flags.recognition ? 1 : 0}b${flags.multi ? 1 : 0}`;
    data[key].push(value);
  }

  const anova = fTest2x2(data);
  let value = NaN;
  if (term === 'recognition') {
    value = output === 'delta' ? anova.mainA.delta : anova.mainA.F;
  } else if (term === 'architecture') {
    value = output === 'delta' ? anova.mainB.delta : anova.mainB.F;
  } else if (term === 'interaction') {
    value = output === 'delta' ? anova.interaction.delta : anova.interaction.F;
  } else {
    throw new Error(`anova_2x2 unsupported term: ${term}`);
  }

  return {
    value,
    details: {
      metric,
      term,
      output,
      n: anova.n,
      dfW: anova.dfW,
      cell_ns: anova.cellNs,
      cell_means: anova.cellMeans,
      recognition: anova.mainA,
      architecture: anova.mainB,
      interaction: anova.interaction,
      skipped_rows: skipped,
    },
    fingerprint: {
      source: 'anova_2x2',
      metric,
      term,
      output,
      n_rows: rows.length,
      n_used: anova.n,
      max_created_at: maxCreatedAt,
      cell_ns: anova.cellNs,
    },
  };
}

function evaluateJudgePairCorrelation(db, evidence) {
  const runIds = Array.isArray(evidence?.run_ids) ? evidence.run_ids : [];
  if (runIds.length === 0) throw new Error('judge_pair_correlation requires run_ids');
  const judgeALike = evidence?.judge_a_like || 'claude-opus%';
  const judgeBLike = evidence?.judge_b_like || 'gpt-5.2%';
  const metric = evidence?.metric || 'tutor_first_turn_score';
  const keyFields = Array.isArray(evidence?.key_fields) && evidence.key_fields.length > 0
    ? evidence.key_fields
    : ['run_id', 'scenario_id', 'profile_name', 'dialogue_id'];
  for (const field of keyFields) ensureColumnName(field);
  ensureColumnName(metric);

  const where = buildWhereClause({
    ...(evidence?.filters || {}),
    run_ids: runIds,
    not_null: [...(evidence?.filters?.not_null || []), metric],
  });
  const columns = [...new Set(['judge_model', metric, 'created_at', ...keyFields])];
  const rows = db.prepare(`SELECT ${columns.join(', ')} FROM evaluation_results ${where.sql}`).all(...where.params);

  const aMap = new Map();
  const bMap = new Map();
  let maxCreatedAt = null;
  for (const row of rows) {
    if (row.created_at && (!maxCreatedAt || row.created_at > maxCreatedAt)) maxCreatedAt = row.created_at;
    const key = keyFields.map((field) => String(row[field] ?? '')).join('|');
    if (new RegExp(judgeALike.replace(/%/g, '.*'), 'i').test(row.judge_model || '')) {
      aMap.set(key, row[metric]);
    } else if (new RegExp(judgeBLike.replace(/%/g, '.*'), 'i').test(row.judge_model || '')) {
      bMap.set(key, row[metric]);
    }
  }

  const aValues = [];
  const bValues = [];
  for (const [key, value] of aMap.entries()) {
    if (!bMap.has(key)) continue;
    const b = bMap.get(key);
    if (!isFiniteNumber(value) || !isFiniteNumber(b)) continue;
    aValues.push(value);
    bValues.push(b);
  }

  return {
    value: pearsonCorrelation(aValues, bValues),
    details: {
      metric,
      judge_a_like: judgeALike,
      judge_b_like: judgeBLike,
      key_fields: keyFields,
      n_pairs: aValues.length,
      mean_a: mean(aValues),
      mean_b: mean(bValues),
    },
    fingerprint: {
      source: 'judge_pair_correlation',
      run_ids: runIds,
      metric,
      key_fields: keyFields,
      n_rows: rows.length,
      n_pairs: aValues.length,
      max_created_at: maxCreatedAt,
    },
  };
}

function evaluateLogTraceCoverage(db, evidence, rootDir) {
  const runIds = Array.isArray(evidence?.run_ids) ? evidence.run_ids : [];
  if (runIds.length === 0) throw new Error('log_trace_coverage requires run_ids');
  const logDir = resolvePath(rootDir, evidence?.log_dir || 'logs/tutor-dialogues');
  const where = buildWhereClause({
    ...(evidence?.filters || {}),
    run_ids: runIds,
    not_null: [...(evidence?.filters?.not_null || []), 'dialogue_id'],
  });
  const rows = db
    .prepare(`SELECT run_id, dialogue_id, created_at FROM evaluation_results ${where.sql}`)
    .all(...where.params);

  let maxCreatedAt = null;
  let valid = 0;
  let missing = 0;
  let noTrace = 0;
  let notMultiTurn = 0;

  for (const row of rows) {
    if (row.created_at && (!maxCreatedAt || row.created_at > maxCreatedAt)) maxCreatedAt = row.created_at;
    const filePath = path.join(logDir, `${row.dialogue_id}.json`);
    if (!fs.existsSync(filePath)) {
      missing++;
      continue;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const trace = Array.isArray(parsed?.dialogueTrace) ? parsed.dialogueTrace : [];
      if (parsed?.isMultiTurn !== true) {
        notMultiTurn++;
      }
      if (trace.length === 0) {
        noTrace++;
        continue;
      }
      valid++;
    } catch {
      missing++;
    }
  }

  const value = rows.length > 0 ? valid / rows.length : 0;
  return {
    value,
    details: {
      run_ids: runIds,
      total_rows: rows.length,
      valid,
      missing,
      no_trace: noTrace,
      not_multi_turn: notMultiTurn,
      coverage_rate: value,
    },
    fingerprint: {
      source: 'log_trace_coverage',
      run_ids: runIds,
      total_rows: rows.length,
      valid,
      max_created_at: maxCreatedAt,
    },
  };
}

function evaluateEvidence(db, manifest, evidence) {
  const type = evidence?.type;
  if (type === 'manifest_total') return evaluateManifestTotal(manifest, evidence);
  if (type === 'manifest_section_total') return evaluateManifestSectionTotal(manifest, evidence);
  if (type === 'db_count') return evaluateDbCount(db, evidence);
  if (type === 'effect_size') return evaluateEffectSize(db, evidence);
  if (type === 'profile_group_effect_size') return evaluateProfileGroupEffectSize(db, evidence);
  if (type === 'anova_2x2') return evaluateAnova2x2Evidence(db, evidence);
  if (type === 'judge_pair_correlation') return evaluateJudgePairCorrelation(db, evidence);
  if (type === 'log_trace_coverage') throw new Error('log_trace_coverage requires rootDir context');
  throw new Error(`Unsupported evidence type: ${type}`);
}

export function evaluateAssertion(actualValue, assertion = {}) {
  const op = assertion.op || 'eq';
  const expected = assertion.expected;
  const toleranceAbs = assertion.tolerance_abs ?? 0;

  if (!isFiniteNumber(actualValue)) {
    return { pass: false, reason: 'actual-not-numeric' };
  }

  if (op === 'eq') return { pass: actualValue === expected, reason: 'eq' };
  if (op === 'approx') {
    if (!isFiniteNumber(expected)) return { pass: false, reason: 'expected-not-numeric' };
    const delta = Math.abs(actualValue - expected);
    return { pass: delta <= toleranceAbs, reason: 'approx', delta };
  }
  if (op === 'gte') return { pass: actualValue >= expected, reason: 'gte' };
  if (op === 'lte') return { pass: actualValue <= expected, reason: 'lte' };
  if (op === 'abs_lte') return { pass: Math.abs(actualValue) <= expected, reason: 'abs_lte' };
  if (op === 'in_range') {
    if (!Array.isArray(expected) || expected.length !== 2) return { pass: false, reason: 'invalid-range' };
    return { pass: actualValue >= expected[0] && actualValue <= expected[1], reason: 'in_range' };
  }
  return { pass: false, reason: `unsupported-op:${op}` };
}

export function evaluateSymmetryRule(rule, claimById) {
  const type = rule?.type || 'paired_presence';
  const left = claimById.get(rule?.left_claim_id);
  const right = claimById.get(rule?.right_claim_id);
  const result = {
    id: rule?.id,
    type,
    status: 'pass',
    details: {},
    remediation: Array.isArray(rule?.remediation) ? rule.remediation : [],
  };

  if (!left || !right) {
    result.status = 'fail';
    result.details = {
      missing_claims: [rule?.left_claim_id, rule?.right_claim_id].filter((id) => !claimById.has(id)),
    };
    return result;
  }

  if (type === 'paired_presence') {
    const leftPresent = left.statement_found === true;
    const rightPresent = right.statement_found === true;
    result.status = leftPresent && rightPresent ? 'pass' : 'fail';
    result.details = { left_present: leftPresent, right_present: rightPresent };
    return result;
  }

  const leftValue = left.actual_value;
  const rightValue = right.actual_value;
  if (!isFiniteNumber(leftValue) || !isFiniteNumber(rightValue)) {
    result.status = 'warn';
    result.details = { reason: 'non_numeric_values', left_value: leftValue, right_value: rightValue };
    return result;
  }

  if (type === 'both_abs_lte') {
    const threshold = Number(rule.threshold ?? 0);
    const pass = Math.abs(leftValue) <= threshold && Math.abs(rightValue) <= threshold;
    result.status = pass ? 'pass' : 'fail';
    result.details = { threshold, left_value: leftValue, right_value: rightValue };
    return result;
  }

  if (type === 'difference_lte') {
    const threshold = Number(rule.threshold ?? 0);
    const delta = Math.abs(leftValue - rightValue);
    result.status = delta <= threshold ? 'pass' : 'fail';
    result.details = { threshold, delta, left_value: leftValue, right_value: rightValue };
    return result;
  }

  if (type === 'difference_gte') {
    const threshold = Number(rule.threshold ?? 0);
    const delta = Math.abs(leftValue - rightValue);
    result.status = delta >= threshold ? 'pass' : 'fail';
    result.details = { threshold, delta, left_value: leftValue, right_value: rightValue };
    return result;
  }

  if (type === 'abs_gap_gte') {
    const threshold = Number(rule.threshold ?? 0);
    const delta = Math.abs(Math.abs(leftValue) - Math.abs(rightValue));
    result.status = delta >= threshold ? 'pass' : 'fail';
    result.details = { threshold, abs_delta: delta, left_value: leftValue, right_value: rightValue };
    return result;
  }

  result.status = 'warn';
  result.details = { reason: `unsupported-symmetry-type:${type}` };
  return result;
}

function parseAuditChecks(auditPath) {
  if (!auditPath || !fs.existsSync(auditPath)) return new Map();
  try {
    const parsed = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    const checks = Array.isArray(parsed?.checks) ? parsed.checks : [];
    return new Map(checks.map((check) => [check.id, check.status]));
  } catch {
    return new Map();
  }
}

function readSnapshot(snapshotPath) {
  if (!snapshotPath || !fs.existsSync(snapshotPath)) return { claims: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return { claims: {} };
    if (!parsed.claims || typeof parsed.claims !== 'object') parsed.claims = {};
    return parsed;
  } catch {
    return { claims: {} };
  }
}

function writeSnapshot(snapshotPath, snapshot) {
  if (!snapshotPath) return;
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
}

function resolvePath(rootDir, value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function loadClaimInventory(inventoryPath) {
  if (!inventoryPath || !fs.existsSync(inventoryPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    return {
      generated_at: parsed?.generated_at || null,
      source_claim_audit: parsed?.source_claim_audit || null,
      summary: parsed?.summary || null,
      entries,
    };
  } catch {
    return null;
  }
}

function loadClaimsFromImportPath(importPath) {
  if (!importPath || !fs.existsSync(importPath)) return { claims: [], symmetry_rules: [] };
  const ext = path.extname(importPath).toLowerCase();
  const raw = fs.readFileSync(importPath, 'utf8');
  let parsed;
  if (ext === '.json') parsed = JSON.parse(raw);
  else parsed = YAML.parse(raw);

  if (Array.isArray(parsed)) return { claims: parsed, symmetry_rules: [] };
  if (!parsed || typeof parsed !== 'object') return { claims: [], symmetry_rules: [] };
  return {
    claims: Array.isArray(parsed.claims) ? parsed.claims : [],
    symmetry_rules: Array.isArray(parsed.symmetry_rules) ? parsed.symmetry_rules : [],
  };
}

function mergeUniqueById(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const entry of list || []) {
      if (!entry || !entry.id) continue;
      if (!map.has(entry.id)) map.set(entry.id, entry);
    }
  }
  return [...map.values()];
}

function normalizeClaimTextForKey(claimText) {
  let text = String(claimText || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase();
  text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\s*([=<>≈])\s*/g, '$1');
  text = text.replace(/[,\.;:]+$/g, '');
  return text;
}

function parseSourceKey(sourceKey) {
  const raw = String(sourceKey || '');
  const first = raw.indexOf('|');
  if (first < 0) return null;
  const second = raw.indexOf('|', first + 1);
  if (second < 0) return null;
  const kind = raw.slice(0, first);
  const lineNo = Number(raw.slice(first + 1, second));
  const claimText = raw.slice(second + 1);
  return {
    kind,
    line_no: Number.isFinite(lineNo) ? lineNo : null,
    claim_text: claimText,
  };
}

function canonicalSourceKeyFromParts({ kind, line_no, claim_text }) {
  if (!kind || !Number.isFinite(line_no)) return null;
  return `${kind}|${line_no}|${normalizeClaimTextForKey(claim_text)}`;
}

function canonicalSourceFamilyFromParts({ kind, claim_text }) {
  if (!kind) return null;
  return `${kind}|${normalizeClaimTextForKey(claim_text)}`;
}

function evaluateInventoryCoverage(spec, claimResults, inventory) {
  if (!inventory) {
    return {
      id: 'inventory.coverage',
      status: 'warn',
      details: { reason: 'inventory-not-found' },
      remediation: ['Run node scripts/sync-provable-claim-inventory.js before this audit.'],
    };
  }

  const policy = spec?.inventory_policy || {};
  const majorOnly = policy.major_only !== false;
  const includeKinds = Array.isArray(policy.include_kinds) && policy.include_kinds.length > 0 ? new Set(policy.include_kinds) : null;
  const expandMappedFamilies = policy.expand_mapped_families !== false;
  const statusMode = policy.coverage_status_mode === 'strict' ? 'strict' : 'expanded';
  const maxUnmappedExpanded = Number.isFinite(policy.max_unmapped_major) ? policy.max_unmapped_major : 0;
  const maxUnmappedRateExpanded = Number.isFinite(policy.max_unmapped_major_rate) ? policy.max_unmapped_major_rate : 0.05;
  const maxUnmappedStrict = Number.isFinite(policy.max_unmapped_major_strict)
    ? policy.max_unmapped_major_strict
    : maxUnmappedExpanded;
  const maxUnmappedRateStrict = Number.isFinite(policy.max_unmapped_major_rate_strict)
    ? policy.max_unmapped_major_rate_strict
    : maxUnmappedRateExpanded;

  const candidates = inventory.entries.filter((entry) => {
    if (majorOnly && !entry.is_major) return false;
    if (includeKinds && !includeKinds.has(entry.kind)) return false;
    return true;
  });

  const mappedCanonicalKeys = new Set();
  const mappedFamilies = new Set();
  for (const claim of claimResults) {
    const sourceKeys = Array.isArray(claim.source_keys)
      ? claim.source_keys
      : claim.source_key
        ? [claim.source_key]
        : [];
    for (const key of sourceKeys) {
      const parsed = parseSourceKey(key);
      if (!parsed) continue;
      const canonicalKey = canonicalSourceKeyFromParts(parsed);
      const canonicalFamily = canonicalSourceFamilyFromParts(parsed);
      if (canonicalKey) mappedCanonicalKeys.add(canonicalKey);
      if (canonicalFamily) mappedFamilies.add(canonicalFamily);
    }
  }

  let mappedByExact = 0;
  let mappedByFamily = 0;
  const strictUnmapped = [];
  const expandedUnmapped = [];
  for (const entry of candidates) {
    const canonicalKey = canonicalSourceKeyFromParts(entry);
    const canonicalFamily = canonicalSourceFamilyFromParts(entry);
    const exactMapped = canonicalKey && mappedCanonicalKeys.has(canonicalKey);
    const familyMapped = expandMappedFamilies && canonicalFamily && mappedFamilies.has(canonicalFamily);

    if (exactMapped) {
      mappedByExact++;
      continue;
    }
    strictUnmapped.push(entry);

    if (familyMapped) {
      mappedByFamily++;
      continue;
    }
    expandedUnmapped.push(entry);
  }

  const mappedStrict = mappedByExact;
  const mappedExpanded = mappedByExact + mappedByFamily;
  const strictUnmappedRate = candidates.length > 0 ? strictUnmapped.length / candidates.length : 0;
  const expandedUnmappedRate = candidates.length > 0 ? expandedUnmapped.length / candidates.length : 0;

  const activeUnmapped = statusMode === 'strict' ? strictUnmapped : expandedUnmapped;
  const activeUnmappedRate = statusMode === 'strict' ? strictUnmappedRate : expandedUnmappedRate;
  const activeMaxUnmapped = statusMode === 'strict' ? maxUnmappedStrict : maxUnmappedExpanded;
  const activeMaxUnmappedRate = statusMode === 'strict' ? maxUnmappedRateStrict : maxUnmappedRateExpanded;

  const status =
    activeUnmapped.length > activeMaxUnmapped || activeUnmappedRate > activeMaxUnmappedRate
      ? 'fail'
      : activeUnmapped.length > 0
        ? 'warn'
        : 'pass';
  return {
    id: 'inventory.coverage',
    status,
    details: {
      inventory_generated_at: inventory.generated_at,
      source_claim_audit: inventory.source_claim_audit,
      candidate_total: candidates.length,
      coverage_status_mode: statusMode,
      mapped_strict: mappedStrict,
      unmapped_strict: strictUnmapped.length,
      unmapped_rate_strict: strictUnmappedRate,
      mapped_expanded: mappedExpanded,
      mapped_exact: mappedByExact,
      mapped_family: mappedByFamily,
      unmapped_expanded: expandedUnmapped.length,
      unmapped_rate_expanded: expandedUnmappedRate,
      expand_mapped_families: expandMappedFamilies,
      max_unmapped_major: maxUnmappedExpanded,
      max_unmapped_major_rate: maxUnmappedRateExpanded,
      max_unmapped_major_strict: maxUnmappedStrict,
      max_unmapped_major_rate_strict: maxUnmappedRateStrict,
      sample_unmapped: activeUnmapped.slice(0, 25).map((entry) => ({
        source_key: entry.source_key,
        canonical_source_key: canonicalSourceKeyFromParts(entry),
        section: entry.section,
        line_no: entry.line_no,
        claim_text: entry.claim_text,
        kind: entry.kind,
        status: entry.status,
      })),
    },
    remediation: [
      'Map each major claim in config/provable-discourse.yaml using source_key/source_keys.',
      'Add executable evidence + assertion for each mapped claim.',
      'Regenerate inventory after claim-audit updates: node scripts/sync-provable-claim-inventory.js',
    ],
  };
}

export function runProvableDiscourseAudit({
  rootDir,
  specPath = 'config/provable-discourse.yaml',
  smokeMode = false,
  refreshSnapshot = false,
} = {}) {
  const baseDir = rootDir || process.cwd();
  const resolvedSpecPath = resolvePath(baseDir, specPath);
  const spec = YAML.parse(fs.readFileSync(resolvedSpecPath, 'utf8')) || {};
  const importPaths = Array.isArray(spec.import_claims_from) ? spec.import_claims_from : [];
  const imported = importPaths
    .map((importPath) => resolvePath(baseDir, importPath))
    .map((resolvedPath) => loadClaimsFromImportPath(resolvedPath));

  const resolvedPaperPath = resolvePath(baseDir, spec.paper_path);
  const resolvedManifestPath = resolvePath(baseDir, spec.manifest_path);
  const resolvedDbPath = resolvePath(baseDir, spec.db_path);
  const resolvedAuditPath = resolvePath(baseDir, spec.audit_report_path);
  const resolvedSnapshotPath = resolvePath(baseDir, spec.snapshot_path);
  const resolvedInventoryPath = resolvePath(baseDir, spec.inventory_path);

  const paperText = fs.readFileSync(resolvedPaperPath, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(resolvedManifestPath, 'utf8'));
  const auditChecks = parseAuditChecks(resolvedAuditPath);
  const inventory = loadClaimInventory(resolvedInventoryPath);

  const snapshot = readSnapshot(resolvedSnapshotPath);
  const now = new Date().toISOString();

  const report = {
    started_at: now,
    spec_path: path.relative(baseDir, resolvedSpecPath),
    paper_path: path.relative(baseDir, resolvedPaperPath),
    manifest_path: path.relative(baseDir, resolvedManifestPath),
    db_path: path.relative(baseDir, resolvedDbPath),
    audit_report_path: resolvedAuditPath ? path.relative(baseDir, resolvedAuditPath) : null,
    inventory_path: resolvedInventoryPath ? path.relative(baseDir, resolvedInventoryPath) : null,
    smoke_mode: smokeMode,
    refresh_snapshot: refreshSnapshot,
    claims: [],
    symmetry: [],
    coverage: [],
    summary: { pass: 0, warn: 0, fail: 0, total: 0 },
  };

  const claims = mergeUniqueById(
    Array.isArray(spec.claims) ? spec.claims : [],
    ...imported.map((part) => part.claims),
  );
  const db = smokeMode ? null : new Database(resolvedDbPath, { readonly: true });

  try {
    for (const claim of claims) {
      const result = {
        id: claim.id,
        description: claim.description || '',
        source_keys: Array.isArray(claim.source_keys)
          ? [...claim.source_keys]
          : claim.source_key
            ? [claim.source_key]
            : [],
        status: 'pass',
        statement_found: false,
        statement_occurrences: 0,
        statement_lines: [],
        actual_value: null,
        assertion: claim.assertion || {},
        evidence_type: claim?.evidence?.type || null,
        messages: [],
        details: {},
        remediation: Array.isArray(claim.remediation) ? claim.remediation : [],
      };

      const statementCheck = findStatementOccurrences(paperText, claim.statement || {});
      const minOccurrences = claim?.statement?.min_occurrences ?? 1;
      result.statement_occurrences = statementCheck.count;
      result.statement_lines = statementCheck.matches.map((match) => match.line).filter((line) => line != null);
      result.statement_found = statementCheck.count >= minOccurrences;
      if (!result.statement_found) {
        result.status = mergeStatus(result.status, 'fail');
        result.messages.push(`Statement regex not found enough times (need >=${minOccurrences}, got ${statementCheck.count})`);
      }

      if (!smokeMode) {
        try {
          let evidence;
          if ((claim?.evidence?.type || '') === 'log_trace_coverage') {
            evidence = evaluateLogTraceCoverage(db, claim.evidence || {}, baseDir);
          } else {
            evidence = evaluateEvidence(db, manifest, claim.evidence || {});
          }
          result.actual_value = evidence.value;
          result.details = evidence.details || {};

          const assertionOutcome = evaluateAssertion(evidence.value, claim.assertion || {});
          result.details.assertion_reason = assertionOutcome.reason;
          if (!assertionOutcome.pass) {
            result.status = mergeStatus(result.status, 'fail');
            result.messages.push('Evidence does not satisfy assertion');
            if (assertionOutcome.delta != null) {
              result.details.assertion_delta = assertionOutcome.delta;
            }
          }

          const previousSnapshot = snapshot?.claims?.[claim.id];
          const currentFingerprint = stableSerialize(evidence.fingerprint || {});
          if (refreshSnapshot) {
            snapshot.claims[claim.id] = {
              updated_at: now,
              fingerprint: evidence.fingerprint || {},
              actual_value: evidence.value,
            };
          } else if (previousSnapshot) {
            const previousFingerprint = stableSerialize(previousSnapshot.fingerprint || {});
            if (currentFingerprint !== previousFingerprint) {
              result.status = mergeStatus(result.status, 'warn');
              result.messages.push('Underlying evidence fingerprint changed since last snapshot (stale-claim risk)');
            }
          } else {
            result.status = mergeStatus(result.status, 'warn');
            result.messages.push('No snapshot baseline for this claim (run with --refresh-snapshot)');
          }
        } catch (error) {
          result.status = mergeStatus(result.status, 'fail');
          result.messages.push(`Evidence evaluation error: ${error.message}`);
        }
      }

      if (Array.isArray(claim.requires_bug_checks) && claim.requires_bug_checks.length > 0) {
        const unresolved = [];
        for (const checkId of claim.requires_bug_checks) {
          const status = auditChecks.get(checkId);
          if (status !== 'pass') unresolved.push({ check_id: checkId, status: status || 'missing' });
        }
        if (unresolved.length > 0) {
          result.status = mergeStatus(result.status, unresolved.some((entry) => entry.status === 'fail') ? 'fail' : 'warn');
          result.messages.push(`Bug-gate dependencies not fully passing: ${unresolved.map((entry) => `${entry.check_id}:${entry.status}`).join(', ')}`);
          result.details.required_bug_checks = unresolved;
        }
      }

      report.claims.push(result);
    }

    const claimById = new Map(report.claims.map((claim) => [claim.id, claim]));
    const symmetryRules = mergeUniqueById(
      Array.isArray(spec.symmetry_rules) ? spec.symmetry_rules : [],
      ...imported.map((part) => part.symmetry_rules),
    );
    for (const rule of symmetryRules) {
      if (smokeMode && (rule?.type || 'paired_presence') !== 'paired_presence') {
        report.symmetry.push({
          id: rule?.id,
          type: rule?.type || 'paired_presence',
          status: 'pass',
          details: { skipped_in_smoke_mode: true },
          remediation: Array.isArray(rule?.remediation) ? rule.remediation : [],
        });
        continue;
      }
      const symmetryResult = evaluateSymmetryRule(rule, claimById);
      report.symmetry.push(symmetryResult);
    }

    const coverageChecks = Array.isArray(spec.coverage_checks) ? spec.coverage_checks : [];
    for (const coverageCheck of coverageChecks) {
      if (smokeMode) {
        report.coverage.push({
          id: coverageCheck.id || 'coverage.inventory.mapping',
          status: 'pass',
          details: { skipped_in_smoke_mode: true },
          remediation: [],
        });
        continue;
      }
      if (coverageCheck?.type === 'inventory_mapping') {
        const coverageResult = evaluateInventoryCoverage(spec, report.claims, inventory);
        coverageResult.id = coverageCheck.id || coverageResult.id;
        report.coverage.push(coverageResult);
      }
    }

    for (const entry of [...report.claims, ...report.symmetry, ...report.coverage]) {
      report.summary.total++;
      if (entry.status === 'pass') report.summary.pass++;
      else if (entry.status === 'warn') report.summary.warn++;
      else report.summary.fail++;
    }

    if (refreshSnapshot) {
      writeSnapshot(resolvedSnapshotPath, snapshot);
      report.snapshot_written = path.relative(baseDir, resolvedSnapshotPath);
    }
  } finally {
    if (db) db.close();
  }

  return report;
}
