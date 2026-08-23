import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3,
  validateTutorStubResistanceSemanticResponseV3,
  wrapTutorStubResistanceSemanticModelOutputV3,
} from './tutorStubResistanceSemanticAdjudicationV3.js';
import {
  buildTutorStubResistanceSemanticAdjudicationPromptV5,
  buildTutorStubResistanceSemanticOutputSchemaV5,
} from './tutorStubResistanceSemanticAdjudicationV5.js';

export const TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V6 =
  'prospective_frame_resistance_binary_semantic_v6';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_ENSEMBLE_SCHEMA_V6 =
  'machinespirits.tutor-stub.resistance-semantic-binary-ensemble.v6';

const FINAL_LABELS = Object.freeze(['frame_refuser', 'frame_defiant_or_productive_dispute', 'neither']);

export const buildTutorStubResistanceSemanticAdjudicationPromptV6 =
  buildTutorStubResistanceSemanticAdjudicationPromptV5;
export const buildTutorStubResistanceSemanticOutputSchemaV6 = buildTutorStubResistanceSemanticOutputSchemaV5;
export const wrapTutorStubResistanceSemanticModelOutputV6 = wrapTutorStubResistanceSemanticModelOutputV3;

export function normalizeTutorStubResistanceSemanticModelOutputV6(modelOutput) {
  const normalized = structuredClone(modelOutput);
  const fields = [];
  for (const field of TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3) {
    if (normalized?.judgment?.[field] === 'no' && normalized.judgment?.evidence_quotes?.[field] !== null) {
      normalized.judgment.evidence_quotes[field] = null;
      fields.push(field);
    }
  }
  return {
    modelOutput: normalized,
    audit: {
      rule: 'null_evidence_when_same_judge_semantic_field_is_no',
      semantic_fields_or_labels_changed: false,
      normalized_evidence_fields: fields,
    },
  };
}

function componentMeasurement(eligible, field) {
  const values = eligible.map((entry) => entry.response.judgment[field]);
  const agreed = values.length === 2 && values[0] === values[1];
  return {
    status: agreed ? 'determinate' : 'measurement_indeterminate',
    value: agreed ? values[0] : 'indeterminate',
    vote_counts: Object.fromEntries(
      [...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length]),
    ),
    supporting_judges: agreed ? eligible.map((entry) => entry.judge_id) : [],
  };
}

function abstentionReason(entry) {
  if (!entry.response) return 'missing_or_response_free';
  if (!entry.valid) return 'invalid_schema_span_or_provenance';
  if (entry.response.judgment?.confidence !== 'high') return 'confidence_not_high';
  if (entry.response.judgment?.final_label === 'indeterminate') return 'judge_indeterminate';
  return null;
}

export function adjudicateTutorStubResistanceSemanticJudgesV6({
  source,
  publicContext,
  caseId,
  responses,
  registration,
  prompts,
  advisorySignals = [],
}) {
  const judges = registration?.measurement?.judges || [];
  const supplied = Array.isArray(responses) ? responses : [];
  const suppliedIds = supplied.map((response) => response?.provenance?.judge_id);
  const registeredIds = new Set(judges.map((judge) => judge.id));
  const integrityIssues = [];
  if (judges.length !== 2) integrityIssues.push('registered_panel_must_have_two_judges');
  if (supplied.length !== 2) integrityIssues.push('exactly_two_responses_required');
  if (new Set(suppliedIds).size !== suppliedIds.length || suppliedIds.some((id) => !registeredIds.has(id))) {
    integrityIssues.push('duplicate_or_unregistered_judge');
  }
  const runs = supplied.map((response) => response?.provenance?.independent_run_id);
  if (new Set(runs).size !== runs.length) integrityIssues.push('judge_runs_not_independent');
  const promptHashes = supplied.map((response) => response?.provenance?.prompt_sha256);
  if (new Set(promptHashes).size !== promptHashes.length) integrityIssues.push('judge_prompts_not_independent');
  const sourceHashes = supplied.map((response) => response?.provenance?.source_sha256);
  if (sourceHashes.length > 1 && new Set(sourceHashes).size !== 1) integrityIssues.push('source_hashes_disagree');

  const byJudge = new Map(supplied.map((response) => [response?.provenance?.judge_id, response]));
  const validation = judges.map((judge) => {
    const response = byJudge.get(judge.id);
    return {
      judge_id: judge.id,
      response,
      ...validateTutorStubResistanceSemanticResponseV3({
        source,
        publicContext,
        caseId,
        response,
        registration,
        prompt: prompts?.[judge.id],
      }),
    };
  });
  const eligible = validation.filter((entry) => abstentionReason(entry) === null);
  const abstentions = validation
    .map((entry) => ({ judge_id: entry.judge_id, reason: abstentionReason(entry) }))
    .filter((entry) => entry.reason !== null);
  const labels = eligible.map((entry) => entry.response.judgment.final_label);
  const binaryAgreement =
    integrityIssues.length === 0 &&
    eligible.length === 2 &&
    labels[0] === labels[1] &&
    FINAL_LABELS.includes(labels[0]);
  const component_measurement = Object.fromEntries(
    TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => [field, componentMeasurement(eligible, field)]),
  );
  const boundary = {
    schema: TUTOR_STUB_RESISTANCE_SEMANTIC_ENSEMBLE_SCHEMA_V6,
    advisory_signals: advisorySignals,
    lexical_or_regex_authority: 'none',
    component_disagreement_may_veto_primary_label: false,
    repair_allowed: false,
    judge_rerun_after_response_allowed: false,
    unit_rerun_allowed: false,
    replacement_allowed: false,
    outcome_selection_allowed: false,
  };
  const common = {
    case_id: caseId,
    ...boundary,
    validation: validation.map(({ judge_id, valid, issues }) => ({ judge_id, valid, issues })),
    abstentions,
    eligible_judges: eligible.map((entry) => entry.judge_id),
    primary_label_measurement: {
      status: binaryAgreement ? 'determinate' : 'measurement_indeterminate',
      value: binaryAgreement ? labels[0] : 'indeterminate',
      vote_counts: Object.fromEntries(
        [...new Set(labels)].sort().map((label) => [label, labels.filter((candidate) => candidate === label).length]),
      ),
      exact_agreement_required: 2,
      supporting_judges: binaryAgreement ? eligible.map((entry) => entry.judge_id) : [],
    },
    component_measurement,
  };
  if (!binaryAgreement) {
    const reasons = [...integrityIssues];
    if (eligible.length < 2) reasons.push('fewer_than_two_valid_high_confidence_judges');
    if (eligible.length === 2 && labels[0] !== labels[1]) reasons.push('binary_label_disagreement');
    return {
      ...common,
      status: 'measurement_indeterminate',
      reasons: [...new Set(reasons)],
      judgment: null,
      final_label: 'indeterminate',
    };
  }
  const judgment = {
    ...Object.fromEntries(
      TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => [field, component_measurement[field].value]),
    ),
    final_label: labels[0],
  };
  return {
    ...common,
    status: 'determinate',
    reasons: [],
    judgment,
    final_label: labels[0],
    component_vector_diagnostic: {
      required_for_primary_determination: false,
      indeterminate_fields: TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.filter(
        (field) => component_measurement[field].status === 'measurement_indeterminate',
      ),
    },
    judge_evidence: eligible.map((entry) => ({
      judge_id: entry.judge_id,
      evidence_spans: entry.response.judgment.evidence_spans,
      confidence: entry.response.judgment.confidence,
    })),
  };
}

export function validateTutorStubResistanceSemanticRegistrationV6(registration) {
  const issues = [];
  if (
    registration?.schema !== 'machinespirits.tutor-stub.resistance-semantic-adjudication-registration.v6' ||
    registration?.version !== 6 ||
    registration?.status !== 'prospective_binary_dual_judge_smoke'
  ) {
    issues.push('v6 registration identity drifted');
  }
  if (registration?.observationSemantics !== TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V6) {
    issues.push('v6 observation semantics drifted');
  }
  const routes = [
    ['semantic_judge_a', 'codex.gpt-5.6-sol', 'codex', 'gpt-5.6-sol'],
    ['semantic_judge_b', 'claude-code.sonnet-5', 'claude-code', 'claude-sonnet-5'],
  ];
  const judges = registration?.measurement?.judges || [];
  if (
    judges.length !== 2 ||
    routes.some(
      ([id, modelRef, provider, model], index) =>
        judges[index]?.id !== id ||
        judges[index]?.modelRef !== modelRef ||
        judges[index]?.provider !== provider ||
        judges[index]?.model !== model ||
        judges[index]?.effort !== 'low' ||
        judges[index]?.independent !== true,
    )
  ) {
    issues.push('v6 judge panel drifted');
  }
  const rule = registration?.measurement?.binaryConsensus || {};
  if (
    rule.primaryLabelRule !== 'exact_two_of_two_valid_high_confidence_binary_labels' ||
    rule.componentDisagreementMayVetoPrimaryLabel !== false ||
    rule.binaryDisagreementDisposition !== 'measurement_indeterminate' ||
    rule.judgeRerunAfterSemanticResponse !== false ||
    rule.unitReplacementOrOutcomeSelection !== false
  ) {
    issues.push('v6 binary consensus drifted');
  }
  const projection = registration?.measurement?.deterministicEvidenceProjection || {};
  if (
    projection.rule !== 'null_evidence_when_same_judge_semantic_field_is_no' ||
    projection.semanticFieldsOrLabelsMayChange !== false ||
    projection.outcomeBlind !== true
  ) {
    issues.push('v6 deterministic evidence projection drifted');
  }
  return { valid: issues.length === 0, issues };
}
