import { createHash } from 'node:crypto';

export const ADAPTIVE_WARRANT_SEMANTIC_EXTRACTION_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-extraction.v3.2';
export const ADAPTIVE_WARRANT_SEMANTIC_VALIDATION_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-validation.v3.2';
export const ADAPTIVE_WARRANT_SEMANTIC_SIGNAL_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-engagement-signal.v1';
export const ADAPTIVE_WARRANT_SEMANTIC_UNSPECIFIED_ID = 'unspecified';
export const ADAPTIVE_WARRANT_SEMANTIC_SENTINEL_RULE =
  'When a slot expects a catalogue ID and the words name no catalogue item, write the literal `unspecified` in that slot. Where no target applies, use the `state: none` branch.';

export const ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS = Object.freeze({
  maxEvents: 4,
  maxEnvelopeBytes: 4096,
  maxResponseBytes: 12000,
  maxEvidenceSpanChars: 240,
  maxPublicIdentifiers: 6,
  maxRequestedValueTypes: 4,
  maxRequiredComponents: 4,
  maxUncertaintyReasons: 3,
});

export const ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS = Object.freeze([
  'tutor_directed_public_result_request',
  'learner_proposed_test',
  'criterion_question',
  'tutor_selection_request',
  'learner_record_entry_request',
  'learner_wording_request',
  'withdrawal',
  'transfer_to_learner',
  'repair_request',
  'stall',
  'register_complaint',
  'repetition_complaint',
  'low_agency_deferral',
  'analytic_contribution',
  'other',
]);

export const ADAPTIVE_WARRANT_SEMANTIC_TARGET_KINDS = Object.freeze([
  'material_or_assay_result',
  'weight_or_ring_result',
  'comparison_result',
  'mark_or_tool_result',
  'record_entry',
  'public_exhibit_result',
  'other',
]);

export const ADAPTIVE_WARRANT_SEMANTIC_VALUE_TYPES = Object.freeze([
  'name',
  'time',
  'date',
  'weight',
  'sound',
  'material',
  'match_status',
  'record_text',
  'other',
]);

export const ADAPTIVE_WARRANT_SEMANTIC_ACTION_MODES = Object.freeze(['requested', 'proposed', 'none']);
export const ADAPTIVE_WARRANT_SEMANTIC_ACTION_EXECUTORS = Object.freeze([
  'learner',
  'tutor',
  'joint',
  'unspecified',
  'none',
]);
export const ADAPTIVE_WARRANT_SEMANTIC_ACTIONS = Object.freeze([
  'supply_public_result',
  'perform_public_test',
  'select_next_step',
  'record_public_claim',
  'explain_wording',
  'withdraw_request',
  'none',
]);

export const ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACT_CONTRACTS = Object.freeze({
  tutor_directed_public_result_request: Object.freeze({
    target: 'catalog',
    action: 'catalog',
    mode: 'requested',
    operation: 'supply_public_result',
    executors: Object.freeze(['tutor', 'joint', 'unspecified']),
  }),
  learner_proposed_test: Object.freeze({
    target: 'catalog',
    action: 'catalog',
    mode: 'proposed',
    operation: 'perform_public_test',
    executors: Object.freeze(['learner', 'joint', 'unspecified']),
  }),
  criterion_question: Object.freeze({ target: 'catalog', action: 'none' }),
  tutor_selection_request: Object.freeze({
    target: 'catalog',
    action: 'catalog',
    mode: 'requested',
    operation: 'select_next_step',
    executors: Object.freeze(['tutor']),
  }),
  learner_record_entry_request: Object.freeze({
    target: 'catalog',
    action: 'catalog',
    mode: 'requested',
    operation: 'record_public_claim',
    executors: Object.freeze(['tutor', 'joint', 'unspecified']),
  }),
  learner_wording_request: Object.freeze({
    target: 'none',
    action: 'catalog',
    mode: 'requested',
    operation: 'explain_wording',
    executors: Object.freeze(['tutor']),
  }),
  repair_request: Object.freeze({
    target: 'none',
    action: 'catalog',
    mode: 'requested',
    operation: 'explain_wording',
    executors: Object.freeze(['tutor']),
  }),
  withdrawal: Object.freeze({
    target: 'catalog_or_none',
    action: 'catalog',
    mode: 'requested',
    operation: 'withdraw_request',
    executors: Object.freeze(['learner']),
  }),
  transfer_to_learner: Object.freeze({
    target: 'catalog_or_none',
    action: 'catalog',
    mode: 'proposed',
    operation: 'perform_public_test',
    executors: Object.freeze(['learner']),
  }),
  stall: Object.freeze({ target: 'none', action: 'none' }),
  register_complaint: Object.freeze({ target: 'none', action: 'none' }),
  repetition_complaint: Object.freeze({ target: 'none', action: 'none' }),
  low_agency_deferral: Object.freeze({ target: 'none', action: 'none' }),
  analytic_contribution: Object.freeze({ target: 'catalog_or_none', action: 'none' }),
  other: Object.freeze({ target: 'catalog_or_none', action: 'none' }),
});

export const ADAPTIVE_WARRANT_SEMANTIC_REQUEST_SPEECH_ACTS = Object.freeze([
  'tutor_directed_public_result_request',
  'tutor_selection_request',
  'learner_record_entry_request',
  'learner_wording_request',
  'repair_request',
]);

const REQUEST_SPEECH_ACTS = new Set(ADAPTIVE_WARRANT_SEMANTIC_REQUEST_SPEECH_ACTS);

const VALUE_TYPE_SURFACES = Object.freeze({
  name: Object.freeze(['name', 'names', 'named', 'attendant', 'courier']),
  time: Object.freeze(['time', 'times', 'timed', 'hour', 'hours', 'minute', 'minutes']),
  date: Object.freeze(['date', 'dates', 'dated', 'day', 'days']),
  weight: Object.freeze(['weight', 'weights', 'weigh', 'mass']),
  sound: Object.freeze(['sound', 'sounds', 'tone', 'tones', 'acoustic', 'chime', 'chimes']),
  material: Object.freeze(['material', 'materials', 'fibre', 'fibres', 'fiber', 'fibers', 'linen']),
  match_status: Object.freeze(['match', 'matches', 'matching', 'fit', 'fits', 'alignment']),
  record_text: Object.freeze([
    'record',
    'records',
    'entry',
    'entries',
    'finding',
    'findings',
    'claim',
    'claims',
    'result',
    'results',
  ]),
  other: Object.freeze(['which', 'choice', 'choose', 'select', 'next']),
});

function surfaceHasWord(text, word) {
  return new RegExp(`(?:^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?:$|[^a-z0-9])`, 'iu').test(
    String(text || ''),
  );
}

export function adaptiveWarrantSemanticValueTypeIsLiteral(valueType, spanText) {
  return (VALUE_TYPE_SURFACES[valueType] || []).some((surface) => surfaceHasWord(spanText, surface));
}

export function adaptiveWarrantSemanticComponentIsLiteral(componentId, spanText) {
  const terms = String(componentId || '')
    .split(/[_-]+/u)
    .filter((term) => term.length > 2 && !['status', 'value'].includes(term));
  return (
    terms.length === 0 || terms.some((term) => surfaceHasWord(spanText, term) || surfaceHasWord(spanText, `${term}s`))
  );
}

function expectedExecutorForSurface(event) {
  const text = String(event?.evidence_span?.text || '');
  const explicitJoint = /\b(?:we|our|ours|let\s+us|let's)\b/iu.test(text);
  const explicitImpersonal =
    /\b(?:it\s+(?:should|must|needs?\s+to)\s+be|should\s+be|must\s+be|needs?\s+to\s+be)\b/iu.test(text);
  if (REQUEST_SPEECH_ACTS.has(event?.speech_act)) {
    if (event.speech_act === 'tutor_selection_request') return 'tutor';
    if (explicitJoint) return 'joint';
    if (explicitImpersonal) return 'unspecified';
    return 'tutor';
  }
  if (event?.speech_act === 'learner_proposed_test') {
    if (explicitJoint) return 'joint';
    if (explicitImpersonal) return 'unspecified';
    return 'learner';
  }
  return null;
}

export function adaptiveWarrantSemanticContractIssues(
  event,
  { eventIndex = 0, enforceLiteralSets = false, enforceSurfaceExecutor = false } = {},
) {
  const issues = [];
  const prefix = `events[${eventIndex}]`;
  const contract = ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACT_CONTRACTS[event?.speech_act];
  if (!contract) return [`${prefix}.speech_act:no_declared_contract`];
  const target = event?.target || null;
  const action = event?.requested_or_proposed_action || null;
  const hasTarget = target !== null;
  const hasAction = action !== null && action.mode !== 'none';
  if (contract.target === 'catalog' && !hasTarget) issues.push(`${prefix}.target:required_for_speech_act`);
  if (contract.target === 'none' && hasTarget) issues.push(`${prefix}.target:forbidden_for_speech_act`);
  if (contract.action === 'catalog' && !hasAction) issues.push(`${prefix}.requested_or_proposed_action:required`);
  if (contract.action === 'none' && hasAction) issues.push(`${prefix}.requested_or_proposed_action:forbidden`);
  if (hasAction) {
    if (
      action.mode !== contract.mode ||
      action.action !== contract.operation ||
      !contract.executors.includes(action.executor)
    ) {
      issues.push(`${prefix}.requested_or_proposed_action:incompatible_with_speech_act`);
    }
    if (REQUEST_SPEECH_ACTS.has(event.speech_act) && action.executor === 'learner') {
      issues.push(`${prefix}.requested_or_proposed_action:executor_matches_request_speaker`);
    }
    const expectedExecutor = enforceSurfaceExecutor ? expectedExecutorForSurface(event) : null;
    if (expectedExecutor && action.executor !== expectedExecutor) {
      issues.push(`${prefix}.requested_or_proposed_action:executor_surface_rule_requires_${expectedExecutor}`);
    }
  }
  const valueTypes = target?.requested_value_types || [];
  const componentIds = target?.component_ids || [];
  const targetIsUnspecified = target?.target_id === ADAPTIVE_WARRANT_SEMANTIC_UNSPECIFIED_ID;
  const actionIsUnspecified = action?.action_object_id === ADAPTIVE_WARRANT_SEMANTIC_UNSPECIFIED_ID;
  const targetPermitsUnspecified = contract.target === 'catalog' || contract.target === 'catalog_or_none';
  const actionPermitsUnspecified = contract.action === 'catalog';
  if (targetIsUnspecified && !targetPermitsUnspecified) {
    issues.push(`${prefix}.target:unspecified_forbidden_for_slot`);
  }
  if (actionIsUnspecified && !actionPermitsUnspecified) {
    issues.push(`${prefix}.requested_or_proposed_action:unspecified_forbidden_for_slot`);
  }
  if (targetIsUnspecified && (target?.public_identifier_ids || []).length) {
    issues.push(`${prefix}.target:unspecified_cannot_name_public_identifiers`);
  }
  // Surface-to-catalogue agreement is semantic evidence, not a structural
  // validity condition. Callers may request this diagnostic explicitly for
  // scoring, but production acceptance must not recreate a lexical extractor
  // by comparing canonical ID words with the utterance.
  if (enforceLiteralSets) {
    for (const valueType of valueTypes) {
      if (!adaptiveWarrantSemanticValueTypeIsLiteral(valueType, event?.evidence_span?.text)) {
        issues.push(`${prefix}.target.requested_value_types:not_literal_in_span`);
      }
    }
    for (const componentId of componentIds) {
      if (!adaptiveWarrantSemanticComponentIsLiteral(componentId, event?.evidence_span?.text)) {
        issues.push(`${prefix}.target.component_ids:not_literal_in_span`);
      }
    }
  }
  return issues;
}
export const ADAPTIVE_WARRANT_SEMANTIC_CONFIDENCE = Object.freeze(['high', 'medium', 'low']);
export const ADAPTIVE_WARRANT_SEMANTIC_UNCERTAINTY_REASONS = Object.freeze([
  'ambiguous_speech_act',
  'ambiguous_executor',
  'ambiguous_target',
  'ambiguous_value_type',
  'ambiguous_multiplicity',
  'referent_not_public',
  'span_not_literal',
  'insufficient_context',
]);

const ENGAGEMENT_PRECEDENCE = Object.freeze([
  'repair_request',
  'stall',
  'register_complaint',
  'repetition_complaint',
  'low_agency_deferral',
  'engaged_analytic',
  'neutral',
]);

function sha256(value) {
  return createHash('sha256')
    .update(String(value ?? ''))
    .digest('hex');
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

export function adaptiveWarrantSemanticEnvelopeBytes(value) {
  return Buffer.byteLength(JSON.stringify(canonicalValue(value)), 'utf8');
}

function stringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.trim());
}

function enumIssue(value, allowed, path, issues) {
  if (!allowed.includes(value)) issues.push(`${path}:invalid_enum`);
}

function arrayLimitIssues(value, path, limit, issues) {
  if (!stringArray(value)) {
    issues.push(`${path}:invalid_string_array`);
    return;
  }
  if (value.length > limit) issues.push(`${path}:too_many_items`);
}

function normalizedTarget(target, issues, eventIndex) {
  if (target === null) return null;
  const path = `events[${eventIndex}].target`;
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    issues.push(`${path}:invalid_object`);
    return null;
  }
  if (target.state === 'none') {
    if (Object.keys(target).length !== 1) issues.push(`${path}:invalid_none_shape`);
    return null;
  }
  if (target.state !== undefined && target.state !== 'catalog') issues.push(`${path}.state:invalid_enum`);
  enumIssue(target.kind, ADAPTIVE_WARRANT_SEMANTIC_TARGET_KINDS, `${path}.kind`, issues);
  if (typeof target.target_id !== 'string' || !target.target_id.trim()) issues.push(`${path}.target_id:required`);
  arrayLimitIssues(
    target.public_identifier_ids,
    `${path}.public_identifier_ids`,
    ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS.maxPublicIdentifiers,
    issues,
  );
  arrayLimitIssues(
    target.requested_value_types,
    `${path}.requested_value_types`,
    ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS.maxRequestedValueTypes,
    issues,
  );
  arrayLimitIssues(
    target.component_ids,
    `${path}.component_ids`,
    ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS.maxRequiredComponents,
    issues,
  );
  for (const valueType of target.requested_value_types || []) {
    enumIssue(valueType, ADAPTIVE_WARRANT_SEMANTIC_VALUE_TYPES, `${path}.requested_value_types`, issues);
  }
  return {
    kind: target.kind,
    target_id: String(target.target_id || '').trim() || null,
    public_identifier_ids: [
      ...new Set((target.public_identifier_ids || []).map((value) => String(value).trim())),
    ].sort(),
    requested_value_types: [
      ...new Set((target.requested_value_types || []).map((value) => String(value).trim())),
    ].sort(),
    component_ids: [...new Set((target.component_ids || []).map((value) => String(value).trim()))].sort(),
  };
}

function normalizedAction(action, issues, eventIndex) {
  if (action === null) return null;
  const path = `events[${eventIndex}].requested_or_proposed_action`;
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    issues.push(`${path}:invalid_object`);
    return null;
  }
  if (action.state === 'none') {
    if (Object.keys(action).length !== 1) issues.push(`${path}:invalid_none_shape`);
    return null;
  }
  if (action.state !== undefined && action.state !== 'catalog') issues.push(`${path}.state:invalid_enum`);
  enumIssue(action.mode, ADAPTIVE_WARRANT_SEMANTIC_ACTION_MODES, `${path}.mode`, issues);
  enumIssue(action.executor, ADAPTIVE_WARRANT_SEMANTIC_ACTION_EXECUTORS, `${path}.executor`, issues);
  enumIssue(action.action, ADAPTIVE_WARRANT_SEMANTIC_ACTIONS, `${path}.action`, issues);
  if (
    action.action_object_id !== null &&
    (typeof action.action_object_id !== 'string' || !action.action_object_id.trim())
  ) {
    issues.push(`${path}.action_object_id:invalid`);
  }
  if (action.mode === 'none' && (action.executor !== 'none' || action.action !== 'none')) {
    issues.push(`${path}:illegal_none_combination`);
  }
  if (action.mode !== 'none' && (action.executor === 'none' || action.action === 'none')) {
    issues.push(`${path}:incomplete_action_combination`);
  }
  return {
    mode: action.mode,
    executor: action.executor,
    action: action.action,
    action_object_id: action.action_object_id === null ? null : String(action.action_object_id || '').trim(),
  };
}

function normalizeAdaptiveWarrantSemanticSentinelSlots(event, contract, eventIndex) {
  let target = event?.target ?? null;
  let action = event?.requested_or_proposed_action ?? null;
  const normalizationNotes = [];
  if (target?.target_id === ADAPTIVE_WARRANT_SEMANTIC_UNSPECIFIED_ID && contract?.target === 'none') {
    target = null;
    normalizationNotes.push(`events[${eventIndex}].target:unspecified_normalized_to_none`);
  }
  if (action?.action_object_id === ADAPTIVE_WARRANT_SEMANTIC_UNSPECIFIED_ID && contract?.action === 'none') {
    action = null;
    normalizationNotes.push(`events[${eventIndex}].requested_or_proposed_action:unspecified_normalized_to_none`);
  }
  return { target, action, normalizationNotes };
}

function spansOverlap(left, right) {
  return (
    Number.isInteger(left?.start) &&
    Number.isInteger(left?.end) &&
    Number.isInteger(right?.start) &&
    Number.isInteger(right?.end) &&
    left.start < right.end &&
    right.start < left.end
  );
}

function publicIdentifierPresent(identifier, publicText) {
  return String(publicText || '').includes(String(identifier || '').trim());
}

const ADAPTIVE_WARRANT_QUOTE_PUNCTUATION_PATTERN = /[\u2018\u2019\u201c\u201d]/gu;

export function normalizeAdaptiveWarrantSemanticQuotePunctuation(value) {
  return String(value || '').replace(ADAPTIVE_WARRANT_QUOTE_PUNCTUATION_PATTERN, (character) =>
    character === '\u2018' || character === '\u2019' ? "'" : '"',
  );
}

/**
 * Convert the model's only span judgment — one literal quote — into the
 * internal UTF-16 interval. Numeric offsets are deliberately never trusted
 * from a model response.
 */
export function deriveAdaptiveWarrantSemanticEvidenceSpan(learnerText, suppliedSpan) {
  const sourceText = String(learnerText || '');
  const suppliedText =
    typeof suppliedSpan === 'string'
      ? suppliedSpan
      : suppliedSpan && typeof suppliedSpan === 'object' && !Array.isArray(suppliedSpan)
        ? String(suppliedSpan.text || '')
        : '';
  const normalizedSourceText = normalizeAdaptiveWarrantSemanticQuotePunctuation(sourceText);
  const normalizedSuppliedText = normalizeAdaptiveWarrantSemanticQuotePunctuation(suppliedText);
  const start = normalizedSuppliedText ? normalizedSourceText.indexOf(normalizedSuppliedText) : -1;
  if (start < 0) {
    return {
      evidence_span: { text: suppliedText, start: null, end: null },
      status: 'not_literal',
      issues: ['not_literal'],
    };
  }
  if (normalizedSourceText.indexOf(normalizedSuppliedText, start + 1) >= 0) {
    return {
      evidence_span: { text: suppliedText, start: null, end: null },
      status: 'non_unique_literal',
      issues: ['non_unique_literal'],
    };
  }
  const end = start + normalizedSuppliedText.length;
  return {
    evidence_span: { text: sourceText.slice(start, end), start, end },
    status: 'derived_unique_literal',
    issues: [],
  };
}

/**
 * Validate model-proposed events against the exact public turn. Invalid or
 * uncertain events remain auditable but cannot mutate the typed reducers.
 */
export function validateAdaptiveWarrantSemanticExtraction(
  candidate,
  { learnerText = '', publicText = '', turn = null, rawResponseText = null } = {},
) {
  const source = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : {};
  const sourceText = String(learnerText || '');
  const envelopeIssues = [];
  if (!Array.isArray(source.events)) envelopeIssues.push('events:invalid_array');
  if ((source.events || []).length > ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS.maxEvents) {
    envelopeIssues.push('events:too_many_items');
  }
  const envelopeBytes = adaptiveWarrantSemanticEnvelopeBytes(source);
  if (envelopeBytes > ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS.maxEnvelopeBytes) {
    envelopeIssues.push('envelope:too_many_bytes');
  }
  const responseBytes = rawResponseText === null ? null : Buffer.byteLength(String(rawResponseText), 'utf8');
  if (responseBytes !== null && responseBytes > ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS.maxResponseBytes) {
    envelopeIssues.push('response:too_many_bytes');
  }

  const combinedPublicText = `${String(publicText || '')}\n${sourceText}`;
  const events = (Array.isArray(source.events) ? source.events : []).map((rawEvent, eventIndex) => {
    const issues = [];
    const event = rawEvent && typeof rawEvent === 'object' && !Array.isArray(rawEvent) ? rawEvent : {};
    const eventId = `turn-${String(Number(turn) || 0).padStart(3, '0')}-event-${String(eventIndex + 1).padStart(2, '0')}`;
    enumIssue(event.speech_act, ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS, `events[${eventIndex}].speech_act`, issues);
    enumIssue(event.confidence, ADAPTIVE_WARRANT_SEMANTIC_CONFIDENCE, `events[${eventIndex}].confidence`, issues);
    arrayLimitIssues(
      event.uncertainty,
      `events[${eventIndex}].uncertainty`,
      ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS.maxUncertaintyReasons,
      issues,
    );
    for (const reason of event.uncertainty || []) {
      enumIssue(reason, ADAPTIVE_WARRANT_SEMANTIC_UNCERTAINTY_REASONS, `events[${eventIndex}].uncertainty`, issues);
    }
    const contract = ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACT_CONTRACTS[event.speech_act];
    const sentinelSlots = normalizeAdaptiveWarrantSemanticSentinelSlots(event, contract, eventIndex);
    const target = normalizedTarget(sentinelSlots.target, issues, eventIndex);
    const action = normalizedAction(sentinelSlots.action, issues, eventIndex);
    if (REQUEST_SPEECH_ACTS.has(event.speech_act) && action?.executor === 'learner') {
      issues.push(`events[${eventIndex}].requested_or_proposed_action:executor_matches_request_speaker`);
    }
    const spanDerivation = deriveAdaptiveWarrantSemanticEvidenceSpan(sourceText, event.evidence_span);
    const { text, start, end } = spanDerivation.evidence_span;
    if (spanDerivation.status === 'not_literal') {
      issues.push(`events[${eventIndex}].evidence_span:not_literal`);
    } else if (spanDerivation.status === 'non_unique_literal') {
      issues.push(`events[${eventIndex}].evidence_span:non_unique_literal`);
    }
    if (text.length > ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS.maxEvidenceSpanChars) {
      issues.push(`events[${eventIndex}].evidence_span:too_many_chars`);
    }
    for (const identifier of target?.public_identifier_ids || []) {
      if (!publicIdentifierPresent(identifier, combinedPublicText)) {
        issues.push(`events[${eventIndex}].target.identifiers:not_public`);
      }
    }
    issues.push(
      ...adaptiveWarrantSemanticContractIssues(
        {
          speaker: 'learner',
          speech_act: event.speech_act,
          target,
          requested_or_proposed_action: action,
          evidence_span: { text, start, end },
        },
        { eventIndex },
      ),
    );
    const uncertainty = [...new Set((event.uncertainty || []).map(String))];
    const asserted = event.confidence === 'high' && uncertainty.length === 0;
    return {
      event_id: eventId,
      speaker: 'learner',
      speech_act: event.speech_act || null,
      target,
      requested_or_proposed_action: action,
      evidence_span: { text, start, end },
      evidence_span_derivation: {
        source: 'unique_literal_quote',
        status: spanDerivation.status,
      },
      confidence: event.confidence || null,
      uncertainty,
      validation: {
        status: issues.length ? 'rejected' : asserted ? 'accepted' : 'uncertain',
        issues,
        normalization_notes: sentinelSlots.normalizationNotes,
      },
    };
  });

  for (let leftIndex = 0; leftIndex < events.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < events.length; rightIndex += 1) {
      const left = events[leftIndex];
      const right = events[rightIndex];
      if (!spansOverlap(left.evidence_span, right.evidence_span)) continue;
      for (const event of [left, right]) {
        event.validation.status = 'uncertain';
        event.validation.issues = [...new Set([...event.validation.issues, 'overlapping_events:non_atomic_span'])];
        event.uncertainty = [
          ...new Set([
            ...event.uncertainty.filter((reason) => reason !== 'ambiguous_multiplicity').slice(0, 2),
            'ambiguous_multiplicity',
          ]),
        ];
      }
    }
  }

  const acceptedCount = events.filter((event) => event.validation.status === 'accepted').length;
  const uncertainCount = events.filter((event) => event.validation.status === 'uncertain').length;
  const rejectedCount = events.filter((event) => event.validation.status === 'rejected').length;
  return {
    schema: ADAPTIVE_WARRANT_SEMANTIC_VALIDATION_SCHEMA,
    source_schema: ADAPTIVE_WARRANT_SEMANTIC_EXTRACTION_SCHEMA,
    source_turn: Number(turn) || null,
    source_text_sha256: sha256(sourceText),
    source_text_present: sourceText.length > 0,
    events,
    extraction_status: envelopeIssues.length || rejectedCount ? 'invalid' : uncertainCount ? 'uncertain' : 'accepted',
    envelope_issues: envelopeIssues,
    size_audit: {
      envelope_bytes: envelopeBytes,
      maximum_envelope_bytes: ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS.maxEnvelopeBytes,
      response_bytes: responseBytes,
      maximum_response_bytes: ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS.maxResponseBytes,
      event_count: events.length,
      maximum_event_count: ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS.maxEvents,
    },
    counts: { accepted: acceptedCount, uncertain: uncertainCount, rejected: rejectedCount },
    source: clone(source),
  };
}

function engagementContribution(event) {
  switch (event.speech_act) {
    case 'repair_request':
    case 'stall':
    case 'register_complaint':
    case 'repetition_complaint':
      return event.speech_act;
    case 'low_agency_deferral':
      return 'low_agency_deferral';
    case 'tutor_selection_request':
    case 'learner_record_entry_request':
    case 'tutor_directed_public_result_request':
      return 'low_agency_deferral';
    case 'analytic_contribution':
    case 'learner_proposed_test':
    case 'criterion_question':
      return 'engaged_analytic';
    default:
      return null;
  }
}

/** Compile accepted and uncertain events without consulting the source text (rejected events never contribute). */
export function compileAdaptiveWarrantSemanticSignal(validation) {
  const contributions = [];
  for (const [eventIndex, event] of (validation?.events || []).entries()) {
    const status = event?.validation?.status;
    if (status !== 'accepted' && status !== 'uncertain') continue;
    const label = engagementContribution(event);
    if (!label) continue;
    contributions.push({
      label,
      start: Number(event.evidence_span?.start) || 0,
      event_index: eventIndex,
      event_id: event.event_id,
    });
  }
  contributions.sort(
    (left, right) =>
      ENGAGEMENT_PRECEDENCE.indexOf(left.label) - ENGAGEMENT_PRECEDENCE.indexOf(right.label) ||
      left.start - right.start ||
      left.event_index - right.event_index ||
      left.event_id.localeCompare(right.event_id),
  );
  const labels = ENGAGEMENT_PRECEDENCE.filter((label) => contributions.some((row) => row.label === label));
  if (!labels.length) labels.push('neutral');
  return {
    schema: ADAPTIVE_WARRANT_SEMANTIC_SIGNAL_SCHEMA,
    source: 'validated_semantic_events',
    primary: labels[0],
    labels,
    deference_present: labels.includes('low_agency_deferral'),
    engaged_analytic_present: labels.includes('engaged_analytic'),
    surface_present: validation?.source_text_present === true,
    evidence_event_ids: contributions.map((row) => row.event_id),
    extraction_status: validation?.extraction_status || 'invalid',
  };
}

export function adaptiveWarrantSemanticSourceHash(learnerText) {
  return sha256(String(learnerText || ''));
}
