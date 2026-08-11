import {
  ADAPTIVE_WARRANT_SEMANTIC_ACTION_ACTORS,
  ADAPTIVE_WARRANT_SEMANTIC_ACTION_MODES,
  ADAPTIVE_WARRANT_SEMANTIC_ACTIONS,
  ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS,
  ADAPTIVE_WARRANT_SEMANTIC_TARGET_KINDS,
  ADAPTIVE_WARRANT_SEMANTIC_VALUE_TYPES,
} from './adaptiveWarrantSemanticEvents.js';

export const ADAPTIVE_WARRANT_SEMANTIC_ANNOTATION_RESPONSE_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-annotation-response.v2';
export const ADAPTIVE_WARRANT_SEMANTIC_CONSENSUS_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-consensus.v2';
export const ADAPTIVE_WARRANT_SEMANTIC_SCORE_SCHEMA = 'machinespirits.adaptation-refinement.semantic-event-score.v2';
export const ADAPTIVE_WARRANT_SEMANTIC_BATCH_RESPONSE_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-annotation-batch-response.v2';
export const ADAPTIVE_WARRANT_SEMANTIC_READER_CATALOG_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-reader-catalog.v2';

export const ADAPTIVE_WARRANT_SEMANTIC_GATE = Object.freeze({
  minimum_reader_agreement: 0.8,
  minimum_hard_consensus_cases: 72,
  minimum_event_count_accuracy: 0.85,
  minimum_speech_act_micro_f1: 0.8,
  minimum_speech_act_macro_f1: 0.75,
  minimum_result_request_precision: 0.9,
  minimum_result_request_recall: 0.75,
  minimum_request_proposal_macro_f1: 0.8,
  minimum_action_exact_accuracy: 0.8,
  minimum_target_present_accuracy: 0.8,
  minimum_target_kind_accuracy: 0.8,
  minimum_subject_value_partition_accuracy: 0.9,
  minimum_component_exact_set_accuracy: 0.85,
  minimum_span_token_overlap_f1: 0.9,
  required_span_substring_validity: 1,
  maximum_abstention_rate: 0.15,
  maximum_proposed_test_false_obligation_rate: 0.1,
  minimum_result_request_support: 4,
  minimum_proposed_test_support: 4,
});

const RESPONSE_FIELDS = Object.freeze([
  'schema',
  'study_id',
  'corpus_sha256',
  'annotator_id',
  'annotation_run_id',
  'cases',
]);
const CASE_FIELDS = Object.freeze(['sample_id', 'genuinely_ambiguous', 'events', 'note']);
const EVENT_FIELDS = Object.freeze(['speech_act', 'target', 'requested_or_proposed_action', 'evidence_span']);

function closedSchema(properties) {
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
}

function semanticReaderEventSchema(semanticCatalog) {
  validateAdaptiveWarrantSemanticReaderCatalog(semanticCatalog);
  const id = { type: 'string', pattern: '^[a-z0-9][a-z0-9_-]{0,95}$' };
  const target = closedSchema({
    kind: { type: 'string', enum: [...ADAPTIVE_WARRANT_SEMANTIC_TARGET_KINDS] },
    target_id: id,
    public_identifier_ids: {
      type: 'array',
      maxItems: 6,
      items: id,
    },
    requested_value_types: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string', enum: [...ADAPTIVE_WARRANT_SEMANTIC_VALUE_TYPES] },
    },
    component_ids: {
      type: 'array',
      maxItems: 4,
      items: id,
    },
  });
  const action = closedSchema({
    mode: { type: 'string', enum: [...ADAPTIVE_WARRANT_SEMANTIC_ACTION_MODES] },
    actor: { type: 'string', enum: [...ADAPTIVE_WARRANT_SEMANTIC_ACTION_ACTORS] },
    action: { type: 'string', enum: [...ADAPTIVE_WARRANT_SEMANTIC_ACTIONS] },
    action_object_id: { ...id, type: ['string', 'null'] },
  });
  return closedSchema({
    speech_act: { type: 'string', enum: [...ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS] },
    target: { ...target, type: ['object', 'null'] },
    requested_or_proposed_action: { ...action, type: ['object', 'null'] },
    evidence_span: closedSchema({
      text: { type: 'string', minLength: 1, maxLength: 240 },
    }),
  });
}

export function buildAdaptiveWarrantSemanticBatchOutputSchema({
  readerId,
  batchId,
  studyId,
  corpusSha256,
  requiredSampleIds,
  semanticCatalog,
} = {}) {
  validateAdaptiveWarrantSemanticReaderCatalog(semanticCatalog);
  const caseSchema = closedSchema({
    genuinely_ambiguous: { type: 'boolean' },
    events: { type: 'array', maxItems: 4, items: semanticReaderEventSchema(semanticCatalog) },
    note: { type: 'string', minLength: 8 },
  });
  const root = closedSchema({
    schema: { type: 'string', enum: [ADAPTIVE_WARRANT_SEMANTIC_BATCH_RESPONSE_SCHEMA] },
    reader_id: { type: 'string', enum: [readerId] },
    batch_id: { type: 'string', enum: [batchId] },
    study_id: { type: 'string', enum: [studyId] },
    corpus_sha256: { type: 'string', enum: [corpusSha256] },
    cases_by_sample_id: {
      type: 'object',
      additionalProperties: false,
      required: [...requiredSampleIds],
      properties: Object.fromEntries(requiredSampleIds.map((sampleId) => [sampleId, { $ref: '#/$defs/case' }])),
    },
  });
  return { ...root, $defs: { case: caseSchema } };
}

function exactFields(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) {
    throw new Error(`${label} fields must be exactly ${required.join(', ')}`);
  }
}

function normalizedText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase();
}

function catalogEntryIds(catalog, field, idField) {
  const rows = catalog?.[field];
  if (!Array.isArray(rows) || !rows.length) throw new Error(`semantic reader catalog ${field} must be non-empty`);
  const ids = rows.map((row, index) => {
    exactFields(row, [idField, 'display_label'], `semantic reader catalog ${field}[${index}]`);
    if (typeof row[idField] !== 'string' || !row[idField].trim()) {
      throw new Error(`semantic reader catalog ${field}[${index}].${idField} is required`);
    }
    if (typeof row.display_label !== 'string' || !row.display_label.trim()) {
      throw new Error(`semantic reader catalog ${field}[${index}].display_label is required`);
    }
    return row[idField];
  });
  if (new Set(ids).size !== ids.length) throw new Error(`semantic reader catalog ${field} IDs must be unique`);
  return ids;
}

export function validateAdaptiveWarrantSemanticReaderCatalog(catalog) {
  exactFields(
    catalog,
    ['schema', 'targets', 'public_identifiers', 'components', 'action_objects'],
    'semantic reader catalog',
  );
  if (catalog.schema !== ADAPTIVE_WARRANT_SEMANTIC_READER_CATALOG_SCHEMA) {
    throw new Error('semantic reader catalog schema mismatch');
  }
  return {
    target_ids: catalogEntryIds(catalog, 'targets', 'target_id'),
    public_identifier_ids: catalogEntryIds(catalog, 'public_identifiers', 'public_identifier_id'),
    component_ids: catalogEntryIds(catalog, 'components', 'component_id'),
    action_object_ids: catalogEntryIds(catalog, 'action_objects', 'action_object_id'),
  };
}

function exactStringSet(value, allowed, label, maximum = Infinity) {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`${label} must be a bounded array`);
  if (value.some((entry) => typeof entry !== 'string' || !entry.trim() || !allowed.includes(entry))) {
    throw new Error(`${label} contains an unsupported value`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} contains duplicates`);
  return [...value];
}

function learnerTextForCase(row) {
  return String(row?.current_learner_turn?.learner ?? row?.learner_text ?? row?.learner ?? '');
}

function validateTarget(target, label, catalogIds) {
  if (target === null) return null;
  exactFields(target, ['kind', 'target_id', 'public_identifier_ids', 'requested_value_types', 'component_ids'], label);
  if (!ADAPTIVE_WARRANT_SEMANTIC_TARGET_KINDS.includes(target.kind)) throw new Error(`${label}.kind is invalid`);
  if (!catalogIds.target_ids.includes(target.target_id)) throw new Error(`${label}.target_id is outside the catalog`);
  const publicIdentifiers = exactStringSet(
    target.public_identifier_ids,
    catalogIds.public_identifier_ids,
    `${label}.public_identifier_ids`,
    6,
  );
  const requestedValueTypes = exactStringSet(
    target.requested_value_types,
    ADAPTIVE_WARRANT_SEMANTIC_VALUE_TYPES,
    `${label}.requested_value_types`,
    4,
  );
  const requiredComponents = exactStringSet(
    target.component_ids,
    catalogIds.component_ids,
    `${label}.component_ids`,
    4,
  );
  return {
    kind: target.kind,
    target_id: target.target_id,
    public_identifier_ids: publicIdentifiers.sort(),
    requested_value_types: requestedValueTypes.sort(),
    component_ids: requiredComponents.sort(),
  };
}

function validateAction(action, label, catalogIds) {
  if (action === null) return null;
  exactFields(action, ['mode', 'actor', 'action', 'action_object_id'], label);
  if (!ADAPTIVE_WARRANT_SEMANTIC_ACTION_MODES.includes(action.mode)) throw new Error(`${label}.mode is invalid`);
  if (!ADAPTIVE_WARRANT_SEMANTIC_ACTION_ACTORS.includes(action.actor)) throw new Error(`${label}.actor is invalid`);
  if (!ADAPTIVE_WARRANT_SEMANTIC_ACTIONS.includes(action.action)) throw new Error(`${label}.action is invalid`);
  if (action.action_object_id !== null && !catalogIds.action_object_ids.includes(action.action_object_id)) {
    throw new Error(`${label}.action_object_id is outside the catalog`);
  }
  if (action.mode === 'none' && (action.actor !== 'none' || action.action !== 'none')) {
    throw new Error(`${label} has an illegal none combination`);
  }
  if (action.mode !== 'none' && (action.actor === 'none' || action.action === 'none')) {
    throw new Error(`${label} has an incomplete action combination`);
  }
  return { ...action };
}

function validateSpan(span, learnerText, label) {
  exactFields(span, ['text', 'start', 'end'], label);
  if (
    typeof span.text !== 'string' ||
    !Number.isInteger(span.start) ||
    !Number.isInteger(span.end) ||
    span.start < 0 ||
    span.end <= span.start ||
    span.end > learnerText.length ||
    learnerText.slice(span.start, span.end) !== span.text
  ) {
    throw new Error(`${label} is not an exact current-turn substring`);
  }
  return { text: span.text, start: span.start, end: span.end };
}

function validateReaderEvent(event, learnerText, label, catalogIds) {
  exactFields(event, EVENT_FIELDS, label);
  if (!ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS.includes(event.speech_act)) {
    throw new Error(`${label}.speech_act is invalid`);
  }
  return {
    speech_act: event.speech_act,
    target: validateTarget(event.target, `${label}.target`, catalogIds),
    requested_or_proposed_action: validateAction(
      event.requested_or_proposed_action,
      `${label}.requested_or_proposed_action`,
      catalogIds,
    ),
    evidence_span: validateSpan(event.evidence_span, learnerText, `${label}.evidence_span`),
  };
}

export function validateAdaptiveWarrantSemanticAnnotationResponse({ response, corpus, corpusSha256 } = {}) {
  exactFields(response, RESPONSE_FIELDS, 'semantic annotation response');
  if (response.schema !== ADAPTIVE_WARRANT_SEMANTIC_ANNOTATION_RESPONSE_SCHEMA) {
    throw new Error('semantic annotation response has an unsupported schema');
  }
  if (response.study_id !== corpus?.study_id || response.corpus_sha256 !== corpusSha256) {
    throw new Error('semantic annotation response does not bind the frozen corpus');
  }
  if (!response.annotator_id?.trim() || !response.annotation_run_id?.trim()) {
    throw new Error('semantic annotation response requires independent reader identity');
  }
  const corpusById = new Map((corpus?.cases || []).map((row) => [row.sample_id, row]));
  const catalogIds = validateAdaptiveWarrantSemanticReaderCatalog(corpus?.semantic_annotation_catalog);
  if (corpusById.size !== corpus?.cases?.length || response.cases?.length !== corpusById.size) {
    throw new Error('semantic annotation response case count mismatch');
  }
  const seen = new Set();
  const cases = response.cases.map((row, caseIndex) => {
    exactFields(row, CASE_FIELDS, `semantic annotation case ${caseIndex}`);
    if (seen.has(row.sample_id) || !corpusById.has(row.sample_id)) {
      throw new Error(`semantic annotation response has duplicate or unknown sample ${row.sample_id}`);
    }
    seen.add(row.sample_id);
    if (typeof row.genuinely_ambiguous !== 'boolean') {
      throw new Error(`semantic annotation case ${row.sample_id} genuinely_ambiguous must be boolean`);
    }
    if (!Array.isArray(row.events) || row.events.length > 4) {
      throw new Error(`semantic annotation case ${row.sample_id} requires zero to four events`);
    }
    if (typeof row.note !== 'string' || row.note.trim().length < 8) {
      throw new Error(`semantic annotation case ${row.sample_id} requires a short rationale`);
    }
    const learnerText = learnerTextForCase(corpusById.get(row.sample_id));
    return {
      sample_id: row.sample_id,
      genuinely_ambiguous: row.genuinely_ambiguous,
      events: row.events.map((event, eventIndex) =>
        validateReaderEvent(event, learnerText, `semantic annotation ${row.sample_id} event ${eventIndex}`, catalogIds),
      ),
      note: row.note.trim(),
    };
  });
  if (seen.size !== corpusById.size) throw new Error('semantic annotation response omits frozen samples');
  return { ok: true, cases };
}

export function adaptiveWarrantSemanticConsensusIdentity(event) {
  return {
    speech_act: event.speech_act,
    target: event.target,
    requested_or_proposed_action: event.requested_or_proposed_action,
  };
}

function fieldsAgree(left, right) {
  return (
    JSON.stringify(adaptiveWarrantSemanticConsensusIdentity(left)) ===
    JSON.stringify(adaptiveWarrantSemanticConsensusIdentity(right))
  );
}

export function buildAdaptiveWarrantSemanticConsensus({ readerA, readerB, corpus, corpusSha256 } = {}) {
  const validatedA = validateAdaptiveWarrantSemanticAnnotationResponse({ response: readerA, corpus, corpusSha256 });
  const validatedB = validateAdaptiveWarrantSemanticAnnotationResponse({ response: readerB, corpus, corpusSha256 });
  if (readerA.annotator_id === readerB.annotator_id || readerA.annotation_run_id === readerB.annotation_run_id) {
    throw new Error('semantic annotation consensus requires independent reader and run identities');
  }
  const byB = new Map(validatedB.cases.map((row) => [row.sample_id, row]));
  const cases = validatedA.cases.map((left) => {
    const right = byB.get(left.sample_id);
    const eventFieldsAgree =
      left.events.length === right.events.length &&
      left.events.every((event, index) => fieldsAgree(event, right.events[index]));
    const hard = !left.genuinely_ambiguous && !right.genuinely_ambiguous && eventFieldsAgree;
    return {
      sample_id: left.sample_id,
      raw_structure_agreement:
        left.genuinely_ambiguous === right.genuinely_ambiguous && eventFieldsAgree,
      event_fields_agreement: eventFieldsAgree,
      span_exact_agreement:
        left.events.length === right.events.length &&
        left.events.every(
          (event, index) => JSON.stringify(event.evidence_span) === JSON.stringify(right.events[index].evidence_span),
        ),
      hard_consensus: hard,
      consensus_status: hard ? 'hard' : 'uncertain',
      genuinely_ambiguous: left.genuinely_ambiguous || right.genuinely_ambiguous,
      events: hard ? left.events : null,
      reader_a: left,
      reader_b: right,
    };
  });
  return {
    schema: ADAPTIVE_WARRANT_SEMANTIC_CONSENSUS_SCHEMA,
    study_id: corpus.study_id,
    corpus_sha256: corpusSha256,
    reader_ids: [readerA.annotator_id, readerB.annotator_id],
    raw_structure_agreement: cases.filter((row) => row.raw_structure_agreement).length / cases.length,
    hard_consensus_cases: cases.filter((row) => row.hard_consensus).length,
    cases,
  };
}

export function summarizeAdaptiveWarrantSemanticDiagnosticSupport(consensus) {
  const hard = (consensus?.cases || []).filter((row) => row.hard_consensus);
  const hasAct = (row, act) => (row.events || []).some((event) => event.speech_act === act);
  const counts = {
    hard_consensus_cases: hard.length,
    result_requests: hard.filter((row) => hasAct(row, 'tutor_directed_public_result_request')).length,
    proposed_tests: hard.filter((row) => hasAct(row, 'learner_proposed_test')).length,
    target_value_partitions: hard.filter((row) =>
      (row.events || []).some(
        (event) => event.target?.target_id && (event.target.requested_value_types || []).length > 0,
      ),
    ).length,
    record_entry_requests: hard.filter((row) => hasAct(row, 'learner_record_entry_request')).length,
    tutor_selection_requests: hard.filter((row) => hasAct(row, 'tutor_selection_request')).length,
  };
  const minima = {
    result_requests: 4,
    proposed_tests: 4,
    target_value_partitions: 4,
    record_entry_requests: 2,
    tutor_selection_requests: 2,
  };
  const cells = Object.fromEntries(
    Object.entries(minima).map(([name, minimum]) => [
      name,
      { observed: counts[name], minimum, status: counts[name] >= minimum ? 'supported' : 'insufficient_support' },
    ]),
  );
  return {
    schema: 'machinespirits.adaptation-refinement.semantic-event-diagnostic-support.v1',
    gate_eligible: false,
    counts,
    minima,
    cells,
    status: Object.values(cells).every((cell) => cell.status === 'supported') ? 'supported' : 'insufficient_support',
  };
}

function predictionEvents(prediction) {
  return (prediction?.events || [])
    .filter((event) => event?.validation?.status === 'accepted')
    .map((event) => ({
      speech_act: event.speech_act,
      target: event.target
        ? {
            kind: event.target.kind,
            target_id: event.target.target_id,
            public_identifier_ids: [...(event.target.public_identifier_ids || [])].sort(),
            requested_value_types: [...(event.target.requested_value_types || [])].sort(),
            component_ids: [...(event.target.component_ids || [])].sort(),
          }
        : null,
      requested_or_proposed_action: event.requested_or_proposed_action
        ? { ...event.requested_or_proposed_action }
        : null,
      evidence_span: event.evidence_span,
    }));
}

function divide(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function f1(precision, recall) {
  return precision === null || recall === null || precision + recall === 0
    ? null
    : (2 * precision * recall) / (precision + recall);
}

function binaryMetrics(rows, label) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const row of rows) {
    const gold = row.gold.some((event) => event.speech_act === label);
    const predicted = row.predicted.some((event) => event.speech_act === label);
    if (gold && predicted) tp += 1;
    if (!gold && predicted) fp += 1;
    if (gold && !predicted) fn += 1;
  }
  const precision = divide(tp, tp + fp);
  const recall = divide(tp, tp + fn);
  return {
    label,
    support: tp + fn,
    predicted_positive: tp + fp,
    tp,
    fp,
    fn,
    precision,
    recall,
    f1: f1(precision, recall),
  };
}

function tokenSet(text) {
  return new Set(normalizedText(text).match(/[\p{L}\p{N}]+/gu) || []);
}

function tokenOverlapF1(left, right) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return f1(divide(overlap, leftTokens.size), divide(overlap, rightTokens.size)) || 0;
}

function average(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function threshold(value, comparison, limit) {
  if (value === null) return 'not_evaluable';
  return comparison === 'minimum' ? (value >= limit ? 'pass' : 'fail') : value <= limit ? 'pass' : 'fail';
}

export function scoreAdaptiveWarrantSemanticExtraction({ consensus, predictionsBySampleId, corpusRole } = {}) {
  const hardRows = consensus.cases
    .filter((row) => row.hard_consensus)
    .map((row) => ({
      sample_id: row.sample_id,
      gold: row.events,
      predicted: predictionEvents(predictionsBySampleId?.[row.sample_id]),
      prediction: predictionsBySampleId?.[row.sample_id] || null,
    }));
  const labels = [...new Set(hardRows.flatMap((row) => row.gold.map((event) => event.speech_act)))];
  const perAct = Object.fromEntries(labels.map((label) => [label, binaryMetrics(hardRows, label)]));
  const request = binaryMetrics(hardRows, 'tutor_directed_public_result_request');
  const proposal = binaryMetrics(hardRows, 'learner_proposed_test');
  const pairedEvents = hardRows.flatMap((row) =>
    row.gold.map((gold, index) => ({ gold, predicted: row.predicted[index] || null, row })),
  );
  const predictedEventCount = hardRows.reduce((sum, row) => sum + row.predicted.length, 0);
  const goldEventCount = pairedEvents.length;
  const speechActTrue = pairedEvents.filter((row) => row.predicted?.speech_act === row.gold.speech_act).length;
  const speechActPrecision = divide(speechActTrue, predictedEventCount);
  const speechActRecall = divide(speechActTrue, goldEventCount);
  const actionRows = pairedEvents.filter((row) => row.gold.requested_or_proposed_action !== null);
  const targetRows = pairedEvents;
  const targetKindRows = pairedEvents.filter((row) => row.gold.target !== null);
  const componentRows = targetKindRows;
  const spanRows = pairedEvents;
  const proposedTestRows = hardRows.filter((row) =>
    row.gold.some((event) => event.speech_act === 'learner_proposed_test'),
  );
  const metrics = {
    raw_event_structure_reader_agreement: consensus.raw_structure_agreement,
    hard_consensus_cases: hardRows.length,
    exact_event_count_accuracy: divide(
      hardRows.filter((row) => row.gold.length === row.predicted.length).length,
      hardRows.length,
    ),
    speech_act_micro_f1: f1(speechActPrecision, speechActRecall),
    speech_act_macro_f1: average(Object.values(perAct).map((row) => row.f1)),
    result_request_precision: request.precision,
    result_request_recall: request.recall,
    request_proposal_macro_f1: average([request.f1, proposal.f1]),
    action_mode_actor_action_exact_accuracy: divide(
      actionRows.filter((row) => {
        const gold = row.gold.requested_or_proposed_action;
        const predicted = row.predicted?.requested_or_proposed_action;
        return (
          predicted &&
          gold.mode === predicted.mode &&
          gold.actor === predicted.actor &&
          gold.action === predicted.action
        );
      }).length,
      actionRows.length,
    ),
    target_present_accuracy: divide(
      targetRows.filter((row) => Boolean(row.gold.target) === Boolean(row.predicted?.target)).length,
      targetRows.length,
    ),
    target_kind_accuracy: divide(
      targetKindRows.filter((row) => row.predicted?.target?.kind === row.gold.target.kind).length,
      targetKindRows.length,
    ),
    subject_value_partition_accuracy: divide(
      targetKindRows.filter(
        (row) =>
          row.predicted?.target?.target_id === row.gold.target.target_id &&
          JSON.stringify(row.predicted?.target?.requested_value_types || []) ===
            JSON.stringify(row.gold.target.requested_value_types),
      ).length,
      targetKindRows.length,
    ),
    requested_component_exact_set_accuracy: divide(
      componentRows.filter(
        (row) =>
          JSON.stringify(row.predicted?.target?.component_ids || []) ===
          JSON.stringify(row.gold.target.component_ids),
      ).length,
      componentRows.length,
    ),
    evidence_span_exact_match: divide(
      spanRows.filter(
        (row) =>
          row.predicted && JSON.stringify(row.predicted.evidence_span) === JSON.stringify(row.gold.evidence_span),
      ).length,
      spanRows.length,
    ),
    evidence_span_token_overlap_f1: average(
      spanRows.map((row) => tokenOverlapF1(row.predicted?.evidence_span?.text || '', row.gold.evidence_span.text)),
    ),
    // Accepted runtime predictions have already passed the literal UTF-16 span
    // validator. Keep this as its own reported prerequisite instead of folding
    // it into reader span agreement.
    evidence_span_public_substring_validity: predictedEventCount ? 1 : null,
    asserted_event_coverage: divide(hardRows.filter((row) => row.predicted.length > 0).length, hardRows.length),
    abstention_rate: divide(
      hardRows.filter(
        (row) =>
          row.predicted.length === 0 ||
          row.prediction?.extraction_status === 'uncertain' ||
          Number(row.prediction?.counts?.uncertain || 0) > 0,
      ).length,
      hardRows.length,
    ),
    proposed_test_false_obligation_rate: divide(
      proposedTestRows.filter((row) =>
        row.predicted.some((event) => event.speech_act === 'tutor_directed_public_result_request'),
      ).length,
      proposedTestRows.length,
    ),
  };
  const coreSupport = {
    result_requests: request.support,
    proposed_tests: proposal.support,
    status:
      request.support >= ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_result_request_support &&
      proposal.support >= ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_proposed_test_support
        ? 'supported'
        : 'inconclusive_support',
  };
  const checks = {
    raw_event_structure_reader_agreement: threshold(
      metrics.raw_event_structure_reader_agreement,
      'minimum',
      ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_reader_agreement,
    ),
    hard_consensus_cases:
      corpusRole === 'natural_prevalence'
        ? threshold(
            metrics.hard_consensus_cases,
            'minimum',
            ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_hard_consensus_cases,
          )
        : 'diagnostic_only',
    exact_event_count_accuracy: threshold(
      metrics.exact_event_count_accuracy,
      'minimum',
      ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_event_count_accuracy,
    ),
    speech_act_micro_f1: threshold(
      metrics.speech_act_micro_f1,
      'minimum',
      ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_speech_act_micro_f1,
    ),
    speech_act_macro_f1: threshold(
      metrics.speech_act_macro_f1,
      'minimum',
      ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_speech_act_macro_f1,
    ),
    result_request_precision:
      coreSupport.status === 'supported'
        ? threshold(
            metrics.result_request_precision,
            'minimum',
            ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_result_request_precision,
          )
        : 'inconclusive_support',
    result_request_recall:
      coreSupport.status === 'supported'
        ? threshold(
            metrics.result_request_recall,
            'minimum',
            ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_result_request_recall,
          )
        : 'inconclusive_support',
    request_proposal_macro_f1:
      coreSupport.status === 'supported'
        ? threshold(
            metrics.request_proposal_macro_f1,
            'minimum',
            ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_request_proposal_macro_f1,
          )
        : 'inconclusive_support',
    action_mode_actor_action_exact_accuracy: threshold(
      metrics.action_mode_actor_action_exact_accuracy,
      'minimum',
      ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_action_exact_accuracy,
    ),
    target_present_accuracy: threshold(
      metrics.target_present_accuracy,
      'minimum',
      ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_target_present_accuracy,
    ),
    target_kind_accuracy: threshold(
      metrics.target_kind_accuracy,
      'minimum',
      ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_target_kind_accuracy,
    ),
    subject_value_partition_accuracy: threshold(
      metrics.subject_value_partition_accuracy,
      'minimum',
      ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_subject_value_partition_accuracy,
    ),
    requested_component_exact_set_accuracy: threshold(
      metrics.requested_component_exact_set_accuracy,
      'minimum',
      ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_component_exact_set_accuracy,
    ),
    evidence_span_token_overlap_f1: threshold(
      metrics.evidence_span_token_overlap_f1,
      'minimum',
      ADAPTIVE_WARRANT_SEMANTIC_GATE.minimum_span_token_overlap_f1,
    ),
    evidence_span_public_substring_validity: threshold(
      metrics.evidence_span_public_substring_validity,
      'minimum',
      ADAPTIVE_WARRANT_SEMANTIC_GATE.required_span_substring_validity,
    ),
    abstention_rate: threshold(
      metrics.abstention_rate,
      'maximum',
      ADAPTIVE_WARRANT_SEMANTIC_GATE.maximum_abstention_rate,
    ),
    proposed_test_false_obligation_rate:
      coreSupport.status === 'supported'
        ? threshold(
            metrics.proposed_test_false_obligation_rate,
            'maximum',
            ADAPTIVE_WARRANT_SEMANTIC_GATE.maximum_proposed_test_false_obligation_rate,
          )
        : 'inconclusive_support',
  };
  const gateEligible = corpusRole === 'natural_prevalence';
  const checkValues = Object.values(checks);
  return {
    schema: ADAPTIVE_WARRANT_SEMANTIC_SCORE_SCHEMA,
    corpus_role: corpusRole,
    gate_eligible: gateEligible,
    verdict: gateEligible
      ? checkValues.includes('fail')
        ? 'failed'
        : checkValues.includes('inconclusive_support') || checkValues.includes('not_evaluable')
          ? 'inconclusive'
          : 'passed'
      : 'diagnostic_only',
    core_request_proposal_support: coreSupport,
    metrics,
    per_speech_act: perAct,
    checks,
    cases: hardRows,
  };
}
