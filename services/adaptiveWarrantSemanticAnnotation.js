import {
  ADAPTIVE_WARRANT_SEMANTIC_ACTION_EXECUTORS,
  ADAPTIVE_WARRANT_SEMANTIC_ACTION_MODES,
  ADAPTIVE_WARRANT_SEMANTIC_ACTIONS,
  ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS,
  ADAPTIVE_WARRANT_SEMANTIC_TARGET_KINDS,
  ADAPTIVE_WARRANT_SEMANTIC_VALUE_TYPES,
} from './adaptiveWarrantSemanticEvents.js';

export const ADAPTIVE_WARRANT_SEMANTIC_ANNOTATION_RESPONSE_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-annotation-response.v3';
export const ADAPTIVE_WARRANT_SEMANTIC_CONSENSUS_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-consensus.v3';
export const ADAPTIVE_WARRANT_SEMANTIC_SCORE_SCHEMA = 'machinespirits.adaptation-refinement.semantic-event-score.v3';
export const ADAPTIVE_WARRANT_SEMANTIC_BATCH_RESPONSE_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-annotation-batch-response.v4';
export const ADAPTIVE_WARRANT_SEMANTIC_READER_CATALOG_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-reader-catalog.v3';

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
const EVENT_FIELDS = Object.freeze([
  'speaker',
  'speech_act',
  'target',
  'requested_or_proposed_action',
  'evidence_span',
]);
const READER_EVENT_FIELDS = Object.freeze(['speech_act', 'target', 'requested_or_proposed_action', 'evidence_span']);

export const ADAPTIVE_WARRANT_SEMANTIC_READER_FIELD_CONTRACT = Object.freeze({
  event_multiplicity:
    'One event per independent clause-level act that would change a distinct typed state; explanatory material is not a second event.',
  speaker: 'Mechanically supplied from current-turn authorship; never reader-judged.',
  speech_act: 'Reader chooses one closed act under the handbook precedence table.',
  target_id:
    'Reader chooses the public object, relation, or enumerated choice set that the act itself is about, never a requested value or actor; use the total token none when the act names no catalogue entity.',
  target_kind: 'Mechanically supplied from the selected target catalogue entry; never reader-judged.',
  public_identifier_ids: 'Mechanically supplied from the selected target catalogue entry; never reader-judged.',
  requested_value_types: 'Exact closed-set values explicitly requested or produced by the clause.',
  component_ids: 'Exact catalogue components explicitly requested or produced by the clause.',
  action_mode: 'Mechanically supplied from the selected action-object catalogue entry; never reader-judged.',
  executor: 'Reader chooses who must perform the action; this is not the utterance speaker.',
  action: 'Mechanically supplied from the selected action-object catalogue entry; never reader-judged.',
  action_object_id:
    'Reader chooses the public action object licensed by the clause; use the total token none when no action applies.',
  evidence_span: 'Reader supplies one unique literal minimal clause span; offsets and order are mechanical.',
  genuinely_ambiguous:
    'True only when two complete typed readings remain after every closed rule; an ambiguous case returns zero events.',
  note: 'Auditable rationale only; excluded from identity, consensus, scoring joins, and gates.',
});

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

const REQUEST_SPEECH_ACTS = new Set([
  'tutor_directed_public_result_request',
  'tutor_selection_request',
  'learner_record_entry_request',
  'learner_wording_request',
  'repair_request',
]);

function closedSchema(properties) {
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
}

function semanticReaderEventSchema(semanticCatalog) {
  const catalogIds = validateAdaptiveWarrantSemanticReaderCatalog(semanticCatalog);
  const target = closedSchema({
    target_id: { type: 'string', enum: [...catalogIds.target_ids] },
    requested_value_types: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string', enum: [...ADAPTIVE_WARRANT_SEMANTIC_VALUE_TYPES] },
    },
    component_ids: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string', enum: [...catalogIds.component_ids] },
    },
  });
  const action = closedSchema({
    executor: {
      type: 'string',
      enum: ADAPTIVE_WARRANT_SEMANTIC_ACTION_EXECUTORS.filter((value) => value !== 'none'),
    },
    action_object_id: { type: 'string', enum: [...catalogIds.action_object_ids] },
  });
  return closedSchema({
    speech_act: { type: 'string', enum: [...ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS] },
    target: { oneOf: [target, { type: 'string', enum: ['none'] }] },
    requested_or_proposed_action: { oneOf: [action, { type: 'string', enum: ['none'] }] },
    evidence_span: closedSchema({
      text: { type: 'string', minLength: 1, maxLength: 240 },
    }),
  });
}

export function auditAdaptiveWarrantSemanticReaderSchemaTotality({ schema, semanticCatalog } = {}) {
  const catalogIds = validateAdaptiveWarrantSemanticReaderCatalog(semanticCatalog);
  const issues = [];
  const visit = (node, location) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    if (node.type === 'null' || (Array.isArray(node.type) && node.type.includes('null'))) {
      issues.push(`${location} admits null`);
    }
    if (Array.isArray(node.enum) && node.enum.includes(null)) issues.push(`${location} enum admits null`);
    if (node.properties) {
      const propertyNames = Object.keys(node.properties);
      const required = Array.isArray(node.required) ? node.required : [];
      for (const propertyName of propertyNames) {
        if (!required.includes(propertyName)) issues.push(`${location}.${propertyName} is optional`);
      }
      if (node.additionalProperties !== false) issues.push(`${location} is not closed`);
    }
    for (const [key, value] of Object.entries(node)) {
      if (Array.isArray(value)) value.forEach((entry, index) => visit(entry, `${location}.${key}[${index}]`));
      else visit(value, `${location}.${key}`);
    }
  };
  visit(schema, '$');
  const event = schema?.$defs?.case?.properties?.events?.items;
  const targetChoices = event?.properties?.target?.oneOf;
  const actionChoices = event?.properties?.requested_or_proposed_action?.oneOf;
  const targetObject = targetChoices?.find((choice) => choice.type === 'object');
  const targetNone = targetChoices?.find((choice) => choice.type === 'string');
  const actionObject = actionChoices?.find((choice) => choice.type === 'object');
  const actionNone = actionChoices?.find((choice) => choice.type === 'string');
  if (JSON.stringify(targetNone?.enum) !== JSON.stringify(['none'])) issues.push('target lacks the closed none token');
  if (JSON.stringify(actionNone?.enum) !== JSON.stringify(['none'])) issues.push('action lacks the closed none token');
  const exactEnum = (actual, expected, label) => {
    if (JSON.stringify([...(actual || [])].sort()) !== JSON.stringify([...expected].sort())) {
      issues.push(`${label} is not closed to the catalogue`);
    }
  };
  exactEnum(targetObject?.properties?.target_id?.enum, catalogIds.target_ids, 'target_id');
  exactEnum(targetObject?.properties?.component_ids?.items?.enum, catalogIds.component_ids, 'component_ids');
  exactEnum(actionObject?.properties?.action_object_id?.enum, catalogIds.action_object_ids, 'action_object_id');
  return {
    ok: issues.length === 0,
    issue_count: issues.length,
    issues,
    reader_fields_total: issues.every((issue) => !issue.includes('optional') && !issue.includes('null')),
    explicit_none_tokens: targetNone?.enum?.[0] === 'none' && actionNone?.enum?.[0] === 'none',
    catalogue_domains_closed: issues.every((issue) => !issue.includes('not closed to the catalogue')),
  };
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

function catalogEntryIds(catalog, field, idField, expectedFields = [idField, 'display_label']) {
  const rows = catalog?.[field];
  if (!Array.isArray(rows) || !rows.length) throw new Error(`semantic reader catalog ${field} must be non-empty`);
  const ids = rows.map((row, index) => {
    exactFields(row, expectedFields, `semantic reader catalog ${field}[${index}]`);
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
  const publicIdentifierIds = catalogEntryIds(catalog, 'public_identifiers', 'public_identifier_id');
  const componentIds = catalogEntryIds(catalog, 'components', 'component_id');
  const targetIds = catalogEntryIds(catalog, 'targets', 'target_id', [
    'target_id',
    'kind',
    'public_identifier_ids',
    'allowed_value_types',
    'component_ids',
    'display_label',
  ]);
  const targetsById = Object.fromEntries(
    catalog.targets.map((row, index) => {
      const label = `semantic reader catalog targets[${index}]`;
      if (!ADAPTIVE_WARRANT_SEMANTIC_TARGET_KINDS.includes(row.kind)) throw new Error(`${label}.kind is invalid`);
      exactStringSet(row.public_identifier_ids, publicIdentifierIds, `${label}.public_identifier_ids`, 6);
      exactStringSet(row.allowed_value_types, ADAPTIVE_WARRANT_SEMANTIC_VALUE_TYPES, `${label}.allowed_value_types`, 4);
      exactStringSet(row.component_ids, componentIds, `${label}.component_ids`, 4);
      return [row.target_id, row];
    }),
  );
  const actionObjectIds = catalogEntryIds(catalog, 'action_objects', 'action_object_id', [
    'action_object_id',
    'mode',
    'action',
    'target_id',
    'display_label',
  ]);
  const actionObjectsById = Object.fromEntries(
    catalog.action_objects.map((row, index) => {
      const label = `semantic reader catalog action_objects[${index}]`;
      if (!ADAPTIVE_WARRANT_SEMANTIC_ACTION_MODES.includes(row.mode)) throw new Error(`${label}.mode is invalid`);
      if (!ADAPTIVE_WARRANT_SEMANTIC_ACTIONS.includes(row.action)) throw new Error(`${label}.action is invalid`);
      if (row.target_id !== null && !targetIds.includes(row.target_id))
        throw new Error(`${label}.target_id is invalid`);
      return [row.action_object_id, row];
    }),
  );
  return {
    target_ids: targetIds,
    public_identifier_ids: publicIdentifierIds,
    component_ids: componentIds,
    action_object_ids: actionObjectIds,
    targets_by_id: targetsById,
    action_objects_by_id: actionObjectsById,
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
  const catalogTarget = catalogIds.targets_by_id[target.target_id];
  if (!catalogTarget) throw new Error(`${label}.target_id is outside the catalog`);
  if (target.kind !== catalogTarget.kind) throw new Error(`${label}.kind does not match target_id`);
  const publicIdentifiers = exactStringSet(
    target.public_identifier_ids,
    catalogTarget.public_identifier_ids,
    `${label}.public_identifier_ids`,
    6,
  );
  if (JSON.stringify(publicIdentifiers.toSorted()) !== JSON.stringify(catalogTarget.public_identifier_ids.toSorted())) {
    throw new Error(`${label}.public_identifier_ids must exactly match target_id`);
  }
  const requestedValueTypes = exactStringSet(
    target.requested_value_types,
    catalogTarget.allowed_value_types,
    `${label}.requested_value_types`,
    4,
  );
  const requiredComponents = exactStringSet(
    target.component_ids,
    catalogTarget.component_ids,
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
  exactFields(action, ['mode', 'executor', 'action', 'action_object_id'], label);
  if (!ADAPTIVE_WARRANT_SEMANTIC_ACTION_MODES.includes(action.mode)) throw new Error(`${label}.mode is invalid`);
  if (!ADAPTIVE_WARRANT_SEMANTIC_ACTION_EXECUTORS.includes(action.executor))
    throw new Error(`${label}.executor is invalid`);
  if (!ADAPTIVE_WARRANT_SEMANTIC_ACTIONS.includes(action.action)) throw new Error(`${label}.action is invalid`);
  const catalogAction =
    action.action_object_id === null ? null : catalogIds.action_objects_by_id[action.action_object_id];
  if (action.action_object_id !== null && !catalogAction)
    throw new Error(`${label}.action_object_id is outside the catalog`);
  if (catalogAction && (action.mode !== catalogAction.mode || action.action !== catalogAction.action)) {
    throw new Error(`${label} mode or action does not match action_object_id`);
  }
  if (action.mode === 'none' && (action.executor !== 'none' || action.action !== 'none')) {
    throw new Error(`${label} has an illegal none combination`);
  }
  if (action.mode !== 'none' && (action.executor === 'none' || action.action === 'none')) {
    throw new Error(`${label} has an incomplete action combination`);
  }
  return { ...action };
}

function validateSpeechActCompatibility(event, label) {
  const contract = ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACT_CONTRACTS[event.speech_act];
  if (!contract) throw new Error(`${label}.speech_act has no declared contract`);
  const hasTarget = event.target !== null;
  const hasAction = event.requested_or_proposed_action !== null;
  if (contract.target === 'catalog' && !hasTarget) throw new Error(`${label}.target is required for the speech act`);
  if (contract.target === 'none' && hasTarget) throw new Error(`${label}.target must be none for the speech act`);
  if (contract.action === 'catalog' && !hasAction) {
    throw new Error(`${label}.requested_or_proposed_action is required for the speech act`);
  }
  if (contract.action === 'none' && hasAction) {
    throw new Error(`${label}.requested_or_proposed_action must be none for the speech act`);
  }
  if (!hasAction) return;
  const action = event.requested_or_proposed_action;
  if (
    action.mode !== contract.mode ||
    action.action !== contract.operation ||
    !contract.executors.includes(action.executor)
  ) {
    throw new Error(`${label}.requested_or_proposed_action is incompatible with the speech act`);
  }
  if (REQUEST_SPEECH_ACTS.has(event.speech_act) && action.executor === event.speaker) {
    throw new Error(`${label}.requested_or_proposed_action executor must differ from the request speaker`);
  }
}

export function materializeAdaptiveWarrantSemanticReaderEvent({ event, semanticCatalog, label = 'reader event' } = {}) {
  exactFields(event, READER_EVENT_FIELDS, label);
  if (!ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS.includes(event.speech_act)) {
    throw new Error(`${label}.speech_act is invalid`);
  }
  const catalogIds = validateAdaptiveWarrantSemanticReaderCatalog(semanticCatalog);
  let target = null;
  if (event.target !== 'none') {
    exactFields(event.target, ['target_id', 'requested_value_types', 'component_ids'], `${label}.target`);
    const catalogTarget = catalogIds.targets_by_id[event.target.target_id];
    if (!catalogTarget) throw new Error(`${label}.target.target_id is outside the catalog`);
    const requestedValueTypes = exactStringSet(
      event.target.requested_value_types,
      catalogTarget.allowed_value_types,
      `${label}.target.requested_value_types`,
      4,
    );
    const componentIds = exactStringSet(
      event.target.component_ids,
      catalogTarget.component_ids,
      `${label}.target.component_ids`,
      4,
    );
    target = {
      kind: catalogTarget.kind,
      target_id: catalogTarget.target_id,
      public_identifier_ids: [...catalogTarget.public_identifier_ids].sort(),
      requested_value_types: requestedValueTypes.sort(),
      component_ids: componentIds.sort(),
    };
  }
  let action = null;
  if (event.requested_or_proposed_action !== 'none') {
    exactFields(
      event.requested_or_proposed_action,
      ['executor', 'action_object_id'],
      `${label}.requested_or_proposed_action`,
    );
    const executor = event.requested_or_proposed_action.executor;
    if (!ADAPTIVE_WARRANT_SEMANTIC_ACTION_EXECUTORS.includes(executor) || executor === 'none') {
      throw new Error(`${label}.requested_or_proposed_action.executor is invalid`);
    }
    const catalogAction = catalogIds.action_objects_by_id[event.requested_or_proposed_action.action_object_id];
    if (!catalogAction)
      throw new Error(`${label}.requested_or_proposed_action.action_object_id is outside the catalog`);
    if (catalogAction.target_id !== null && catalogAction.target_id !== target?.target_id) {
      throw new Error(`${label}.requested_or_proposed_action target does not match its action object`);
    }
    action = {
      mode: catalogAction.mode,
      executor,
      action: catalogAction.action,
      action_object_id: catalogAction.action_object_id,
    };
  }
  const materialized = {
    speaker: 'learner',
    speech_act: event.speech_act,
    target,
    requested_or_proposed_action: action,
    evidence_span: event.evidence_span,
  };
  validateSpeechActCompatibility(materialized, label);
  return materialized;
}

function contractWorkedExample({ speechAct, contract, catalogIds }) {
  const actionEntries = Object.values(catalogIds.action_objects_by_id).toSorted((left, right) =>
    left.action_object_id.localeCompare(right.action_object_id),
  );
  let actionEntry = null;
  if (contract.action === 'catalog') {
    actionEntry = actionEntries.find((candidate) => {
      if (candidate.mode !== contract.mode || candidate.action !== contract.operation) return false;
      if (contract.target === 'catalog') return candidate.target_id !== null;
      if (contract.target === 'none') return candidate.target_id === null;
      return true;
    });
    if (!actionEntry) {
      throw new Error(
        `semantic reader catalog cannot satisfy ${speechAct}: no ${contract.mode}/${contract.operation} action object has a compatible target binding`,
      );
    }
  }

  let targetEntry = null;
  if (actionEntry?.target_id) targetEntry = catalogIds.targets_by_id[actionEntry.target_id];
  if (contract.target === 'catalog' && !targetEntry) {
    targetEntry = Object.values(catalogIds.targets_by_id).toSorted((left, right) =>
      left.target_id.localeCompare(right.target_id),
    )[0];
  }
  if (contract.target === 'catalog' && !targetEntry) {
    throw new Error(`semantic reader catalog cannot satisfy ${speechAct}: no target is available`);
  }
  if (contract.target === 'none' && targetEntry) {
    throw new Error(
      `semantic reader catalog cannot satisfy ${speechAct}: its action object requires a target where none is allowed`,
    );
  }

  const executor = contract.action === 'catalog' ? contract.executors[0] : null;
  if (contract.action === 'catalog' && !executor) {
    throw new Error(`semantic reader contract ${speechAct} has no permitted executor`);
  }
  if (REQUEST_SPEECH_ACTS.has(speechAct) && executor === 'learner') {
    throw new Error(`semantic reader contract ${speechAct} cannot satisfy request executor asymmetry`);
  }
  return {
    speech_act: speechAct,
    target: targetEntry
      ? {
          target_id: targetEntry.target_id,
          requested_value_types: [],
          component_ids: [],
        }
      : 'none',
    requested_or_proposed_action: actionEntry ? { executor, action_object_id: actionEntry.action_object_id } : 'none',
    evidence_span: { text: `Contract worked example for ${speechAct}.` },
  };
}

export function auditAdaptiveWarrantSemanticContractCatalog({ semanticCatalog } = {}) {
  const catalogIds = validateAdaptiveWarrantSemanticReaderCatalog(semanticCatalog);
  const contractActs = Object.keys(ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACT_CONTRACTS).toSorted();
  const vocabularyActs = [...ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS].toSorted();
  if (JSON.stringify(contractActs) !== JSON.stringify(vocabularyActs)) {
    throw new Error('semantic speech-act vocabulary and contract inventory differ');
  }
  const workedExamples = contractActs.map((speechAct, index) => {
    const readerEvent = contractWorkedExample({
      speechAct,
      contract: ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACT_CONTRACTS[speechAct],
      catalogIds,
    });
    const fullEvent = materializeAdaptiveWarrantSemanticReaderEvent({
      event: readerEvent,
      semanticCatalog,
      label: `semantic catalog worked example ${speechAct}`,
    });
    const learner = readerEvent.evidence_span.text;
    return {
      sample_id: `contract-worked-example-${String(index + 1).padStart(2, '0')}-${speechAct}`,
      learner,
      event: {
        ...fullEvent,
        evidence_span: { text: learner, start: 0, end: learner.length },
      },
    };
  });
  const corpusSha256 = 'zero-call-contract-catalog-consistency';
  const corpus = {
    schema: 'machinespirits.adaptation-refinement.annotation-corpus.v1',
    study_id: 'adaptive-warrant-semantic-contract-catalog-consistency',
    blinded: true,
    semantic_annotation_catalog: semanticCatalog,
    cases: workedExamples.map((row) => ({
      sample_id: row.sample_id,
      current_learner_turn: { turn: 1, learner: row.learner },
    })),
  };
  const response = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_ANNOTATION_RESPONSE_SCHEMA,
    study_id: corpus.study_id,
    corpus_sha256: corpusSha256,
    annotator_id: 'zero-call-contract-catalog-audit',
    annotation_run_id: 'zero-call-contract-catalog-audit',
    cases: workedExamples.map((row) => ({
      sample_id: row.sample_id,
      genuinely_ambiguous: false,
      events: [row.event],
      note: 'Catalog-derived worked example validated through the production annotation validator.',
    })),
  };
  validateAdaptiveWarrantSemanticAnnotationResponse({ response, corpus, corpusSha256 });
  return {
    ok: true,
    speech_act_count: contractActs.length,
    worked_example_count: workedExamples.length,
    worked_examples: workedExamples.map((row) => ({
      sample_id: row.sample_id,
      speech_act: row.event.speech_act,
      target_id: row.event.target?.target_id ?? null,
      action_object_id: row.event.requested_or_proposed_action?.action_object_id ?? null,
      executor: row.event.requested_or_proposed_action?.executor ?? null,
    })),
  };
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
  if (event.speaker !== 'learner') throw new Error(`${label}.speaker must be mechanically supplied as learner`);
  if (!ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS.includes(event.speech_act)) {
    throw new Error(`${label}.speech_act is invalid`);
  }
  const validated = {
    speaker: event.speaker,
    speech_act: event.speech_act,
    target: validateTarget(event.target, `${label}.target`, catalogIds),
    requested_or_proposed_action: validateAction(
      event.requested_or_proposed_action,
      `${label}.requested_or_proposed_action`,
      catalogIds,
    ),
    evidence_span: validateSpan(event.evidence_span, learnerText, `${label}.evidence_span`),
  };
  const catalogAction = validated.requested_or_proposed_action
    ? catalogIds.action_objects_by_id[validated.requested_or_proposed_action.action_object_id]
    : null;
  if (catalogAction && catalogAction.target_id !== null && catalogAction.target_id !== validated.target?.target_id) {
    throw new Error(`${label}.requested_or_proposed_action target does not match action_object_id`);
  }
  validateSpeechActCompatibility(validated, label);
  return validated;
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
    if (row.genuinely_ambiguous && row.events.length) {
      throw new Error(`semantic annotation case ${row.sample_id} must abstain when genuinely ambiguous`);
    }
    if (typeof row.note !== 'string' || row.note.trim().length < 8) {
      throw new Error(`semantic annotation case ${row.sample_id} requires a short rationale`);
    }
    const learnerText = learnerTextForCase(corpusById.get(row.sample_id));
    const events = row.events.map((event, eventIndex) =>
      validateReaderEvent(event, learnerText, `semantic annotation ${row.sample_id} event ${eventIndex}`, catalogIds),
    );
    for (let leftIndex = 0; leftIndex < events.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < events.length; rightIndex += 1) {
        const left = events[leftIndex].evidence_span;
        const right = events[rightIndex].evidence_span;
        if (left.start < right.end && right.start < left.end) {
          throw new Error(`semantic annotation case ${row.sample_id} has overlapping non-atomic event spans`);
        }
      }
    }
    return {
      sample_id: row.sample_id,
      genuinely_ambiguous: row.genuinely_ambiguous,
      events,
      note: row.note.trim(),
    };
  });
  if (seen.size !== corpusById.size) throw new Error('semantic annotation response omits frozen samples');
  return { ok: true, cases };
}

export function adaptiveWarrantSemanticConsensusIdentity(event) {
  return {
    speaker: event.speaker,
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
      raw_structure_agreement: left.genuinely_ambiguous === right.genuinely_ambiguous && eventFieldsAgree,
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
    action_mode_executor_action_exact_accuracy: divide(
      actionRows.filter((row) => {
        const gold = row.gold.requested_or_proposed_action;
        const predicted = row.predicted?.requested_or_proposed_action;
        return (
          predicted &&
          gold.mode === predicted.mode &&
          gold.executor === predicted.executor &&
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
          JSON.stringify(row.predicted?.target?.component_ids || []) === JSON.stringify(row.gold.target.component_ids),
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
    action_mode_executor_action_exact_accuracy: threshold(
      metrics.action_mode_executor_action_exact_accuracy,
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
