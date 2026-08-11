import { createHash } from 'node:crypto';

export const ADAPTIVE_WARRANT_SEMANTIC_EXTRACTION_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-extraction.v2';
export const ADAPTIVE_WARRANT_SEMANTIC_VALIDATION_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-validation.v1';
export const ADAPTIVE_WARRANT_SEMANTIC_SIGNAL_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-engagement-signal.v1';

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
export const ADAPTIVE_WARRANT_SEMANTIC_ACTION_ACTORS = Object.freeze([
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
export const ADAPTIVE_WARRANT_SEMANTIC_CONFIDENCE = Object.freeze(['high', 'medium', 'low']);
export const ADAPTIVE_WARRANT_SEMANTIC_UNCERTAINTY_REASONS = Object.freeze([
  'ambiguous_speech_act',
  'ambiguous_actor',
  'ambiguous_target',
  'ambiguous_value_type',
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
    public_identifier_ids: [...new Set((target.public_identifier_ids || []).map((value) => String(value).trim()))].sort(),
    requested_value_types: [...new Set((target.requested_value_types || []).map((value) => String(value).trim()))].sort(),
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
  enumIssue(action.mode, ADAPTIVE_WARRANT_SEMANTIC_ACTION_MODES, `${path}.mode`, issues);
  enumIssue(action.actor, ADAPTIVE_WARRANT_SEMANTIC_ACTION_ACTORS, `${path}.actor`, issues);
  enumIssue(action.action, ADAPTIVE_WARRANT_SEMANTIC_ACTIONS, `${path}.action`, issues);
  if (action.action_object_id !== null && (typeof action.action_object_id !== 'string' || !action.action_object_id.trim())) {
    issues.push(`${path}.action_object_id:invalid`);
  }
  if (action.mode === 'none' && (action.actor !== 'none' || action.action !== 'none')) {
    issues.push(`${path}:illegal_none_combination`);
  }
  if (action.mode !== 'none' && (action.actor === 'none' || action.action === 'none')) {
    issues.push(`${path}:incomplete_action_combination`);
  }
  return {
    mode: action.mode,
    actor: action.actor,
    action: action.action,
    action_object_id: action.action_object_id === null ? null : String(action.action_object_id || '').trim(),
  };
}

function spansOverlap(left, right) {
  return Number(left?.start) < Number(right?.end) && Number(right?.start) < Number(left?.end);
}

function publicIdentifierPresent(identifier, publicText) {
  return String(publicText || '').includes(String(identifier || '').trim());
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
  if (source.schema !== ADAPTIVE_WARRANT_SEMANTIC_EXTRACTION_SCHEMA) envelopeIssues.push('schema:invalid');
  if (Number(source.source_turn) !== Number(turn)) envelopeIssues.push('source_turn:mismatch');
  if (source.source_text_sha256 !== sha256(sourceText)) envelopeIssues.push('source_text_sha256:mismatch');
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
  const seenEventIds = new Set();
  const events = (Array.isArray(source.events) ? source.events : []).map((rawEvent, eventIndex) => {
    const issues = [];
    const event = rawEvent && typeof rawEvent === 'object' && !Array.isArray(rawEvent) ? rawEvent : {};
    const eventId = String(event.event_id || '').trim();
    if (!eventId) issues.push(`events[${eventIndex}].event_id:required`);
    if (seenEventIds.has(eventId)) issues.push(`events[${eventIndex}].event_id:duplicate`);
    seenEventIds.add(eventId);
    enumIssue(event.speaker, ['learner', 'tutor'], `events[${eventIndex}].speaker`, issues);
    if (event.speaker !== 'learner') issues.push(`events[${eventIndex}].speaker:not_current_learner`);
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
    const target = normalizedTarget(event.target, issues, eventIndex);
    const action = normalizedAction(event.requested_or_proposed_action, issues, eventIndex);
    const span = event.evidence_span && typeof event.evidence_span === 'object' ? event.evidence_span : {};
    const start = Number(span.start);
    const end = Number(span.end);
    const text = String(span.text || '');
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > sourceText.length) {
      issues.push(`events[${eventIndex}].evidence_span:invalid_offsets`);
    } else if (sourceText.slice(start, end) !== text) {
      issues.push(`events[${eventIndex}].evidence_span:not_literal`);
    }
    if (text.length > ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS.maxEvidenceSpanChars) {
      issues.push(`events[${eventIndex}].evidence_span:too_many_chars`);
    }
    for (const identifier of [target?.target_id, ...(target?.public_identifier_ids || [])].filter(Boolean)) {
      if (!publicIdentifierPresent(identifier, combinedPublicText)) {
        issues.push(`events[${eventIndex}].target.identifiers:not_public`);
      }
    }
    const uncertainty = [...new Set((event.uncertainty || []).map(String))];
    const asserted = event.confidence === 'high' && uncertainty.length === 0;
    return {
      event_id: eventId || `invalid-event-${eventIndex + 1}`,
      speaker: event.speaker || null,
      speech_act: event.speech_act || null,
      target,
      requested_or_proposed_action: action,
      evidence_span: { text, start, end },
      confidence: event.confidence || null,
      uncertainty,
      validation: {
        status: issues.length ? 'rejected' : asserted ? 'accepted' : 'uncertain',
        issues,
      },
    };
  });

  for (let leftIndex = 0; leftIndex < events.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < events.length; rightIndex += 1) {
      const left = events[leftIndex];
      const right = events[rightIndex];
      if (!spansOverlap(left.evidence_span, right.evidence_span)) continue;
      const leftAction = left.requested_or_proposed_action;
      const rightAction = right.requested_or_proposed_action;
      if (!leftAction || !rightAction) continue;
      if (leftAction.actor === rightAction.actor && leftAction.mode === rightAction.mode) continue;
      for (const event of [left, right]) {
        event.validation.status = 'uncertain';
        event.validation.issues = [...new Set([...event.validation.issues, 'overlapping_events:ambiguous_actor'])];
        event.uncertainty = [...new Set([...event.uncertainty, 'ambiguous_actor'])];
      }
    }
  }

  const acceptedCount = events.filter((event) => event.validation.status === 'accepted').length;
  const uncertainCount = events.filter((event) => event.validation.status === 'uncertain').length;
  const rejectedCount = events.filter((event) => event.validation.status === 'rejected').length;
  return {
    schema: ADAPTIVE_WARRANT_SEMANTIC_VALIDATION_SCHEMA,
    source_schema: source.schema || null,
    source_turn: Number(source.source_turn) || null,
    source_text_sha256: source.source_text_sha256 || null,
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
    case 'tutor_selection_request': {
      const action = event.requested_or_proposed_action;
      return action?.mode === 'requested' && action?.actor === 'tutor' && action?.action === 'select_next_step'
        ? 'low_agency_deferral'
        : null;
    }
    case 'analytic_contribution':
    case 'learner_proposed_test':
    case 'criterion_question':
      return 'engaged_analytic';
    default:
      return null;
  }
}

/** Compile accepted events without consulting the source text. */
export function compileAdaptiveWarrantSemanticSignal(validation) {
  const contributions = [];
  for (const [eventIndex, event] of (validation?.events || []).entries()) {
    if (event?.validation?.status !== 'accepted') continue;
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
