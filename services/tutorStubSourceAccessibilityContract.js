import { measureTutorStubSurfaceSentenceAccessibility } from './tutorStubResponseConfiguration.js';

export const TUTOR_STUB_SOURCE_ACCESSIBILITY_CONTRACT_SCHEMA =
  'machinespirits.tutor-stub.source-accessibility-contract.v1';
export const TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA = 'machinespirits.tutor-stub.source-accessibility-audit.v1';

const SUPPORTED_POLICIES = new Set(['direct_only', 'direct_or_compensated_v1']);
const SUPPORTED_OWNERS = new Set(['performance_response', 'post_source_sentence']);
const ALLOWED_ADDED_TOKENS = Object.freeze(['a', 'an', 'the']);
const ALLOWED_ADDED_TOKEN_SET = new Set(ALLOWED_ADDED_TOKENS);
const PRESERVED_QUALIFIERS = new Set(['may', 'no', 'not', 'only']);
const RELATION_WORDS = new Set(
  'am are be been being can came come could cut did do does draw drawn drew examine found gave give given go gone had has have held hold is left made make may might must read said saw see seen shall should take taken took was were went will would wrote write written'.split(
    ' ',
  ),
);
const SUBJECT_WORDS = new Set(['he', 'i', 'it', 'she', 'they', 'we', 'who', 'you']);
const RELATION_SUFFIX = /(?:ated|ed|ified|ised|ized)$/u;
const MATERIAL_STOP_WORDS = new Set(
  'about after again also and are because been before being but by can could did do does for from had has have her here hers him his how into is it its more most of on or our ours she should so some such than that their theirs them then there these they this those through to under was we were what when where which while who will with would you your yours'.split(
    ' ',
  ),
);
const ANCHOR_STOP_WORDS = new Set(
  'clue evidence fact information item public record says said shows shown source thing'.split(' '),
);
const sentenceSegmenter = new Intl.Segmenter('en', { granularity: 'sentence' });

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function tokens(value) {
  const text = String(value || '');
  const rows = [];
  const pattern = /[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    rows.push({
      raw: match[0],
      normalized: match[0].toLowerCase().replace(/[’]/gu, "'"),
      start: match.index,
      end: match.index + match[0].length,
      index: rows.length,
    });
  }
  return rows;
}

function materialToken(row) {
  return (
    row &&
    !ALLOWED_ADDED_TOKEN_SET.has(row.normalized) &&
    !MATERIAL_STOP_WORDS.has(row.normalized) &&
    (row.normalized.length >= 3 || /\d/u.test(row.normalized))
  );
}

function sourceAnchorToken(row) {
  return materialToken(row) && !ANCHOR_STOP_WORDS.has(row.normalized);
}

function sourceText(source) {
  return String(source?.text || source?.surface || '').trim();
}

function semanticSourceText(source) {
  return String(source?.surface || source?.text || '').trim();
}

function relationToken(row) {
  return Boolean(
    row && (RELATION_WORDS.has(row.normalized) || (row.normalized.length >= 4 && RELATION_SUFFIX.test(row.normalized))),
  );
}

function normalizeOwner(configuration = {}) {
  const explicitKey = ['source_accessibility_owner', 'compensation_owner', 'owner'].find((key) =>
    Object.prototype.hasOwnProperty.call(configuration, key),
  );
  if (explicitKey) {
    const explicit = oneLine(configuration[explicitKey]);
    return SUPPORTED_OWNERS.has(explicit) ? explicit : null;
  }
  const version = oneLine(
    configuration.first_draft_contract_version || configuration.contract_version || configuration.version,
  ).toLowerCase();
  return version === 'v1' || version.includes('live') ? 'post_source_sentence' : 'performance_response';
}

function configurationAxis(configuration, key) {
  return configuration?.[key] || configuration?.language?.[key] || null;
}

function sentenceRows(value) {
  return [...sentenceSegmenter.segment(String(value || ''))].map((segment) => segment.segment.trim()).filter(Boolean);
}

function qualifierBindings(sourceTokens) {
  const bindings = [];
  for (const row of sourceTokens) {
    if (!PRESERVED_QUALIFIERS.has(row.normalized)) continue;
    const scope =
      sourceTokens.slice(row.index + 1).find((candidate) => materialToken(candidate)) ||
      sourceTokens[row.index + 1] ||
      null;
    bindings.push({
      qualifier: row.normalized,
      qualifier_source_index: row.index,
      scope_token: scope?.normalized || null,
      scope_source_index: scope?.index ?? null,
    });
  }
  return bindings;
}

function normalizeSources(sources, configuration) {
  const list = Array.isArray(sources) ? sources : sources ? [sources] : [];
  const audienceRegister = configurationAxis(configuration, 'audience_register');
  const lexicalAccessibility = configurationAxis(configuration, 'lexical_accessibility');
  return list.map((source, index) => {
    const text = sourceText(source);
    const semanticText = semanticSourceText(source);
    const sourceTokens = tokens(semanticText);
    const accessibility = measureTutorStubSurfaceSentenceAccessibility({
      text,
      audienceRegister,
      lexicalAccessibility,
    });
    return {
      id: oneLine(source?.id) || `source_${index + 1}`,
      mode: oneLine(source?.mode) || null,
      surface: semanticText,
      text,
      semantic_text: semanticText,
      accessibility,
      token_count: sourceTokens.length,
      material_source_tokens: sourceTokens.filter(materialToken).map((row) => row.normalized),
      fact_derived_anchors: sourceTokens.filter(sourceAnchorToken).map((row) => row.normalized),
      source_relation_tokens: sourceTokens.filter(relationToken).map((row) => row.normalized),
      required_qualifier_bindings: qualifierBindings(sourceTokens),
    };
  });
}

function completeWitnessCandidate(value) {
  const trimmed = oneLine(value)
    .replace(/^[“"]|[”"]$/gu, '')
    .replace(/[;,:\s]+$/u, '')
    .replace(/[!?]+$/u, '.');
  return trimmed && !/[.]$/u.test(trimmed) ? `${trimmed}.` : trimmed;
}

function sourceWitnessCandidates(source) {
  const authored = oneLine(source?.semantic_text || source?.surface || '');
  const candidates = [];
  const colonTail = authored.match(/:\s*([^:]+)$/u)?.[1]?.trim();
  if (colonTail) candidates.push(colonTail);
  const clauseFragments = authored
    .split(/\s*(?:[:;]|\b(?:after|although|because|before|but|whereas|while)\b)\s*/iu)
    .map((fragment) => fragment.trim())
    .filter(Boolean);
  for (let start = 0; start < clauseFragments.length; start += 1) {
    for (let end = start + 1; end <= clauseFragments.length; end += 1) {
      candidates.push(clauseFragments.slice(start, end).join('; '));
    }
  }
  candidates.push(authored);
  for (const candidate of [...candidates]) {
    const withoutLeadingAppositive = candidate.replace(/^([^,]{1,64}),\s*[^,]{1,160},\s*/u, '$1 ');
    if (withoutLeadingAppositive !== candidate) candidates.unshift(withoutLeadingAppositive);
  }
  return [...new Set(candidates.map(completeWitnessCandidate).filter(Boolean))];
}

function compensationFeasibilityWitness(source, maxWords) {
  const expected = {
    semantic_source_text: source.semantic_text,
    min_material_source_tokens: 4,
    fact_derived_anchors: source.fact_derived_anchors,
    source_relation_tokens: source.source_relation_tokens,
    required_qualifier_bindings: source.required_qualifier_bindings,
  };
  return (
    sourceWitnessCandidates(source).find((candidate) => {
      const evaluation = evaluateCompensationSemantics(expected, candidate);
      return (
        evaluation.wordCount <= maxWords &&
        evaluation.orderedExtractive &&
        evaluation.materialTokenCount >= expected.min_material_source_tokens &&
        evaluation.anchorMatches.length > 0 &&
        evaluation.qualifiersPreserved &&
        evaluation.relationClauseComplete &&
        evaluation.notFullSource
      );
    }) || null
  );
}

function compensationReadiness(source, owner) {
  const issues = [];
  const maxWords = Math.min(
    Number(source?.accessibility?.audienceMaximum),
    Number(source?.accessibility?.lexicalMaximum),
  );
  if (source?.accessibility?.sentenceCount !== 1) issues.push('source_must_be_one_sentence');
  if (!Number.isFinite(maxWords) || maxWords < 4) issues.push('selected_sentence_budgets_unavailable');
  if (!SUPPORTED_OWNERS.has(owner)) issues.push('unsupported_compensation_owner');
  if ((source?.material_source_tokens || []).length < 4) {
    issues.push('insufficient_material_source_tokens');
  }
  if (!(source?.fact_derived_anchors || []).length) issues.push('missing_fact_derived_anchor');
  if (!(source?.source_relation_tokens || []).length) issues.push('missing_source_relation');
  const feasibilityWitness = issues.length === 0 ? compensationFeasibilityWitness(source, maxWords) : null;
  if (!feasibilityWitness && !issues.length) issues.push('no_feasible_compensation_clause');
  return {
    ready: issues.length === 0,
    issues,
    maxWords: Number.isFinite(maxWords) ? maxWords : null,
    feasibilityWitness,
  };
}

/**
 * Compile the accessibility policy without changing immutable SOURCE text.
 * V28's direct-only behavior remains the default. The opt-in V29 policy may
 * compensate exactly one inaccessible, one-sentence source with a bounded
 * extractive sentence placed immediately after that source.
 */
export function compileTutorStubSourceAccessibilityContract({
  sources = [],
  configuration = {},
  policy = 'direct_only',
} = {}) {
  if (!SUPPORTED_POLICIES.has(policy)) {
    throw new Error(`unsupported tutor source accessibility policy: ${policy}`);
  }
  const normalizedSources = normalizeSources(sources, configuration);
  const owner = normalizeOwner(configuration);
  const active = normalizedSources.length > 0;
  const directAccessible = normalizedSources.every((source) => source.text && source.accessibility?.ok === true);
  const inaccessible = normalizedSources.filter((source) => source.accessibility?.ok !== true);
  const issues = [];
  let effectiveMode = 'direct';
  let compensation = null;

  if (active && !directAccessible) {
    if (policy === 'direct_only') {
      effectiveMode = 'blocked';
      issues.push('direct_source_inaccessible');
    } else if (normalizedSources.length !== 1 || inaccessible.length !== 1) {
      effectiveMode = 'blocked';
      issues.push('compensation_requires_exactly_one_source');
    } else {
      const source = inaccessible[0];
      const readiness = compensationReadiness(source, owner);
      if (!readiness.ready) {
        effectiveMode = 'blocked';
        issues.push(...readiness.issues);
      } else {
        effectiveMode = 'compensated';
        compensation = {
          source_id: source.id,
          source_text: source.text,
          semantic_source_text: source.semantic_text,
          owner,
          placement: 'immediately_after_exact_source',
          sentence_count: 1,
          declarative: true,
          max_words: readiness.maxWords,
          audience_maximum: source.accessibility.audienceMaximum,
          lexical_maximum: source.accessibility.lexicalMaximum,
          min_material_source_tokens: 4,
          allowed_added_tokens: [...ALLOWED_ADDED_TOKENS],
          source_material_tokens: [...source.material_source_tokens],
          fact_derived_anchors: [...source.fact_derived_anchors],
          source_relation_tokens: [...source.source_relation_tokens],
          required_qualifier_bindings: source.required_qualifier_bindings.map((binding) => ({
            ...binding,
          })),
          feasibility_witness: readiness.feasibilityWitness,
        };
      }
    }
  }

  const compensationRequired = effectiveMode === 'compensated';
  const compensationContractReady = compensationRequired && Boolean(compensation);
  return {
    schema: TUTOR_STUB_SOURCE_ACCESSIBILITY_CONTRACT_SCHEMA,
    version: 1,
    policy,
    active,
    ok: !active || directAccessible || compensationContractReady,
    effective_mode: effectiveMode,
    direct_accessible: directAccessible,
    compensation_required: compensationRequired,
    compensation_contract_ready: compensationContractReady,
    owner: compensationRequired ? owner : null,
    issues,
    source_count: normalizedSources.length,
    inaccessible_source_count: inaccessible.length,
    sources: normalizedSources,
    source_accessibility: normalizedSources.map((source) => ({
      id: source.id,
      ...source.accessibility,
    })),
    compensation,
  };
}

function validSpan(span, text) {
  return (
    Number.isInteger(span?.start) &&
    Number.isInteger(span?.end) &&
    span.start >= 0 &&
    span.end > span.start &&
    span.end <= text.length
  );
}

function exactOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while (offset <= text.length - needle.length) {
    const index = text.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    offset = index + needle.length;
  }
  return count;
}

function orderedSourceMatch(sourceTokenRows, compensationTokenRows) {
  let cursor = 0;
  const matched = [];
  const added = [];
  const invalid = [];
  for (const token of compensationTokenRows) {
    if (ALLOWED_ADDED_TOKEN_SET.has(token.normalized)) {
      // Articles are always treated as licensed grammar rather than greedily
      // consuming a later SOURCE article and accidentally making the next
      // material token look out of order.
      added.push({ compensation_index: token.index, token: token.normalized });
      continue;
    }
    const next = sourceTokenRows.findIndex(
      (sourceToken, index) => index >= cursor && sourceToken.normalized === token.normalized,
    );
    if (next >= cursor) {
      matched.push({
        compensation_index: token.index,
        source_index: next,
        token: token.normalized,
      });
      cursor = next + 1;
    } else {
      invalid.push({ compensation_index: token.index, token: token.normalized });
    }
  }
  return { matched, added, invalid };
}

function qualifierAudit(bindings, matchedSourceIndexes) {
  return (bindings || []).map((binding) => ({
    ...binding,
    qualifier_visible: matchedSourceIndexes.has(binding.qualifier_source_index),
    scope_visible: binding.scope_source_index === null || matchedSourceIndexes.has(binding.scope_source_index),
    ok:
      matchedSourceIndexes.has(binding.qualifier_source_index) &&
      (binding.scope_source_index === null || matchedSourceIndexes.has(binding.scope_source_index)),
  }));
}

function evaluateCompensationSemantics(expected, compensationText) {
  const sourceTokenRows = tokens(expected.semantic_source_text || expected.source_text || '');
  const compensationTokenRows = tokens(compensationText);
  const match = orderedSourceMatch(sourceTokenRows, compensationTokenRows);
  const orderedExtractive = match.invalid.length === 0;
  const matchedSourceIndexes = new Set(match.matched.map((row) => row.source_index));
  const materialMatches = match.matched.filter((row) => materialToken(sourceTokenRows[row.source_index]));
  const anchorMatches = match.matched.filter((row) => (expected.fact_derived_anchors || []).includes(row.token));
  const relationMatches = match.matched.filter((row) => (expected.source_relation_tokens || []).includes(row.token));
  const relationClauseComplete = relationMatches.some((relation) => {
    const before = match.matched.some(
      (matched) =>
        matched.compensation_index < relation.compensation_index &&
        (materialToken(sourceTokenRows[matched.source_index]) || SUBJECT_WORDS.has(matched.token)),
    );
    const after = materialMatches.some((material) => material.compensation_index > relation.compensation_index);
    return before && after;
  });
  const qualifierBindings = qualifierAudit(expected.required_qualifier_bindings, matchedSourceIndexes);
  const normalizedSource = sourceTokenRows.map((row) => row.normalized).join(' ');
  const normalizedCompensation = compensationTokenRows.map((row) => row.normalized).join(' ');
  return {
    sourceTokenRows,
    compensationTokenRows,
    match,
    orderedExtractive,
    matchedSourceIndexes,
    materialMatches,
    materialTokenCount: materialMatches.length,
    anchorMatches,
    relationMatches,
    relationClauseComplete,
    qualifierBindings,
    qualifiersPreserved: qualifierBindings.every((binding) => binding.ok),
    wordCount: compensationTokenRows.length,
    notFullSource: normalizedCompensation.length > 0 && normalizedCompensation !== normalizedSource,
  };
}

/** Audit a generated compensation sentence against its frozen source contract. */
export function auditTutorStubSourceAccessibilityCompensation({
  contract = null,
  text = '',
  owner = null,
  sourceSpan = null,
  compensationSpan = null,
} = {}) {
  const responseText = String(text || '');
  if (contract?.schema !== TUTOR_STUB_SOURCE_ACCESSIBILITY_CONTRACT_SCHEMA) {
    return {
      schema: TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA,
      active: true,
      ok: false,
      visible: false,
      effective_mode: 'blocked',
      owner: owner || null,
      issues: ['invalid_source_accessibility_contract'],
      checks: {},
      spans: { source: sourceSpan, compensation: compensationSpan },
    };
  }
  if (contract.effective_mode === 'direct') {
    return {
      schema: TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA,
      active: false,
      ok: contract.ok === true,
      visible: contract.ok === true,
      effective_mode: 'direct',
      owner: null,
      issues: contract.ok === true ? [] : ['direct_source_inaccessible'],
      checks: { compensation_required: false },
      spans: { source: sourceSpan, compensation: compensationSpan },
    };
  }
  if (
    contract.effective_mode !== 'compensated' ||
    contract.compensation_contract_ready !== true ||
    !contract.compensation
  ) {
    return {
      schema: TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA,
      active: true,
      ok: false,
      visible: false,
      effective_mode: 'blocked',
      owner: owner || null,
      issues: [...new Set([...(contract.issues || []), 'compensation_contract_not_ready'])],
      checks: { compensation_required: contract.compensation_required === true },
      spans: { source: sourceSpan, compensation: compensationSpan },
    };
  }

  const expected = contract.compensation;
  const issues = [];
  const sourceSpanValid = validSpan(sourceSpan, responseText);
  const compensationSpanValid = validSpan(compensationSpan, responseText);
  const sourceSlice = sourceSpanValid ? responseText.slice(sourceSpan.start, sourceSpan.end) : '';
  const compensationSlice = compensationSpanValid
    ? responseText.slice(compensationSpan.start, compensationSpan.end)
    : '';
  const ownerMatches = owner === expected.owner;
  const sourceExact = sourceSpanValid && sourceSlice === expected.source_text;
  const sourceExactOnce = exactOccurrences(responseText, expected.source_text) === 1;
  const adjacent =
    sourceSpanValid &&
    compensationSpanValid &&
    compensationSpan.start >= sourceSpan.end &&
    /^\s*$/u.test(responseText.slice(sourceSpan.end, compensationSpan.start));
  const trimmedCompensation = compensationSlice.trim();
  const exactCompensationBoundary = compensationSlice === trimmedCompensation;
  const sentences = sentenceRows(trimmedCompensation);
  const oneSentence = sentences.length === 1 && sentences[0] === trimmedCompensation;
  const declarative =
    oneSentence &&
    /\.$/u.test(trimmedCompensation) &&
    !/[?]/u.test(trimmedCompensation) &&
    !/^(?:how|what|when|where|which|who|why)\b/iu.test(trimmedCompensation);
  const unquoted =
    !/[“”"‘]/u.test(trimmedCompensation) && !/(?:^|[^\p{L}])’|’(?:$|[^\p{L}])/u.test(trimmedCompensation);
  const semantics = evaluateCompensationSemantics(expected, trimmedCompensation);
  const {
    match,
    orderedExtractive,
    materialMatches,
    materialTokenCount,
    anchorMatches,
    relationMatches,
    relationClauseComplete,
    qualifierBindings,
    qualifiersPreserved,
    wordCount,
    notFullSource,
  } = semantics;
  const withinAudienceBudget = wordCount <= Number(expected.audience_maximum);
  const withinLexicalBudget = wordCount <= Number(expected.lexical_maximum);

  const checks = {
    owner_matches: ownerMatches,
    source_span_valid: sourceSpanValid,
    compensation_span_valid: compensationSpanValid,
    source_exact: sourceExact,
    source_exact_once: sourceExactOnce,
    immediately_after_source: adjacent,
    exact_compensation_boundary: exactCompensationBoundary,
    one_complete_sentence: oneSentence,
    declarative,
    unquoted,
    ordered_extractive_subsequence: orderedExtractive,
    no_unlicensed_added_tokens: match.invalid.length === 0,
    material_source_token_count: materialTokenCount,
    minimum_material_source_tokens: materialTokenCount >= expected.min_material_source_tokens,
    fact_derived_anchor: anchorMatches.length > 0,
    source_derived_relation: relationMatches.length > 0,
    complete_relational_clause: relationClauseComplete,
    qualifiers_preserved: qualifiersPreserved,
    within_audience_budget: withinAudienceBudget,
    within_lexical_budget: withinLexicalBudget,
    not_full_source: notFullSource,
  };
  const issueFor = [
    ['owner_matches', 'compensation_owner_mismatch'],
    ['source_span_valid', 'invalid_source_span'],
    ['compensation_span_valid', 'invalid_compensation_span'],
    ['source_exact', 'source_span_not_exact'],
    ['source_exact_once', 'source_exact_occurrence_count'],
    ['immediately_after_source', 'compensation_not_immediately_after_source'],
    ['exact_compensation_boundary', 'compensation_span_has_outer_whitespace'],
    ['one_complete_sentence', 'compensation_must_be_one_complete_sentence'],
    ['declarative', 'compensation_must_be_declarative'],
    ['unquoted', 'compensation_must_be_unquoted'],
    ['ordered_extractive_subsequence', 'compensation_not_ordered_source_subsequence'],
    ['minimum_material_source_tokens', 'insufficient_material_source_tokens'],
    ['fact_derived_anchor', 'missing_fact_derived_anchor'],
    ['source_derived_relation', 'missing_source_relation'],
    ['complete_relational_clause', 'compensation_must_be_complete_relational_clause'],
    ['qualifiers_preserved', 'source_qualifier_not_preserved'],
    ['within_audience_budget', 'compensation_exceeds_audience_budget'],
    ['within_lexical_budget', 'compensation_exceeds_lexical_budget'],
    ['not_full_source', 'compensation_copies_full_source'],
  ];
  for (const [check, issue] of issueFor) if (checks[check] !== true) issues.push(issue);

  return {
    schema: TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA,
    active: true,
    ok: issues.length === 0,
    visible: issues.length === 0,
    effective_mode: 'compensated',
    owner: owner || null,
    expected_owner: expected.owner,
    issues,
    checks,
    spans: {
      source: sourceSpanValid ? { ...sourceSpan, text: sourceSlice } : sourceSpan,
      compensation: compensationSpanValid ? { ...compensationSpan, text: compensationSlice } : compensationSpan,
    },
    word_count: wordCount,
    max_words: expected.max_words,
    matched_source_tokens: match.matched,
    added_article_tokens: match.added,
    invalid_added_tokens: match.invalid,
    material_source_tokens: materialMatches.map((row) => row.token),
    fact_derived_anchors: anchorMatches.map((row) => row.token),
    source_derived_relations: relationMatches.map((row) => row.token),
    qualifier_bindings: qualifierBindings,
  };
}

export function tutorStubSourceAccessibilityInstruction(contract = null) {
  if (
    contract?.schema !== TUTOR_STUB_SOURCE_ACCESSIBILITY_CONTRACT_SCHEMA ||
    contract.compensation_contract_ready !== true ||
    contract.effective_mode !== 'compensated'
  ) {
    return '';
  }
  const compensation = contract.compensation;
  const ownerInstruction =
    compensation.owner === 'performance_response'
      ? 'Use PERFORMANCE RESPONSE as the one accessibility sentence immediately after SOURCE.'
      : 'Make the first complete sentence immediately after SOURCE the one accessibility sentence.';
  return [
    '[Tutor-only SOURCE accessibility contract]',
    ownerInstruction,
    `Write exactly one unquoted declarative sentence of at most ${compensation.max_words} words.`,
    `Use at least ${compensation.min_material_source_tokens} material SOURCE words in their original order, including one source-specific anchor and one SOURCE relation with material before and after it. Add no word except a, an, or the.`,
    'Preserve every no, not, only, or may qualifier with its source-bound term. Do not repeat the whole SOURCE or ask a question.',
    '[End tutor-only SOURCE accessibility contract]',
  ].join('\n');
}
