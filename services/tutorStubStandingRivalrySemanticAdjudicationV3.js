import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3,
  TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3,
  TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3,
  buildTutorStubResistanceSemanticAdjudicationPromptV3,
  validateTutorStubResistanceSemanticResponseV3,
  wrapTutorStubResistanceSemanticModelOutputV3,
} from './tutorStubResistanceSemanticAdjudicationV3.js';

export const TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3 = 'prospective_standing_rivalry_semantic_v3';
export const TUTOR_STUB_STANDING_RIVALRY_REGISTRATION_V3 =
  'config/tutor-stub-resistant-learner-r1-turn-gate-registration.v3.json';
export const TUTOR_STUB_STANDING_RIVALRY_ENSEMBLE_SCHEMA_V3 = 'machinespirits.tutor-stub.standing-rivalry-ensemble.v3';
export const TUTOR_STUB_STANDING_RIVALRY_REGISTRATION_SCHEMA_V3 =
  'machinespirits.tutor-stub.standing-rivalry-turn-gate-registration.v3';

const FINAL_LABELS = Object.freeze(['frame_refuser', 'frame_defiant_or_productive_dispute', 'neither']);
const ADHERENT_LABELS = Object.freeze(['frame_refuser', 'frame_defiant_or_productive_dispute']);
const ELIGIBLE_CONFIDENCE = Object.freeze(['high', 'medium']);

export const buildTutorStubStandingRivalryOutputSchemaV3 = () =>
  structuredClone(TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3);
export const wrapTutorStubStandingRivalryModelOutputV3 = wrapTutorStubResistanceSemanticModelOutputV3;

export function buildTutorStubStandingRivalryPromptV3(args) {
  const prompt = buildTutorStubResistanceSemanticAdjudicationPromptV3(args);
  const quoteInstruction =
    'Every non-null evidence quote MUST be copied verbatim as an exact substring of its declared public packet source. Do not paraphrase, normalize, shorten, or reconstruct a quote. A paraphrase is a malformed seat and fails loudly before panel aggregation; semantic indeterminate is only for unresolved public meaning, not an excuse for an inexact quote.';
  return {
    ...prompt,
    schema: 'machinespirits.tutor-stub.standing-rivalry-adjudication-prompt.v3',
    instructions: [
      ...prompt.instructions.slice(0, -1),
      'For this standing-rivalry gate, both frame_refuser and frame_defiant_or_productive_dispute are persona-adherent: each may preserve the rival warrant frame while disputing the tutor frame.',
      quoteInstruction,
      `Return only JSON conforming exactly to ${TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3}.`,
    ],
  };
}

function abstentionReason(entry) {
  if (!entry.response) return 'missing_or_response_free';
  if (!entry.valid) return 'invalid_schema_span_or_provenance';
  if (!ELIGIBLE_CONFIDENCE.includes(entry.response.judgment?.confidence)) return 'confidence_not_medium_or_high';
  if (entry.response.judgment?.final_label === 'indeterminate') return 'judge_indeterminate';
  return null;
}

function counts(values) {
  return Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length]),
  );
}

function componentMeasurement(eligible, field) {
  const values = eligible.map((entry) => entry.response.judgment[field]);
  const agreed = values.length === 2 && values[0] === values[1];
  return {
    status: agreed ? 'determinate' : 'measurement_indeterminate',
    value: agreed ? values[0] : 'indeterminate',
    vote_counts: counts(values),
    supporting_judges: agreed ? eligible.map((entry) => entry.judge_id) : [],
  };
}

export function validateTutorStubStandingRivalryResponseV3(values) {
  const validation = validateTutorStubResistanceSemanticResponseV3(values);
  if (values?.response?.judgment?.confidence !== 'medium') return validation;
  const issues = validation.issues.filter((issue) => issue !== 'determinate judgment requires high confidence');
  return { valid: issues.length === 0, issues };
}

export function adjudicateTutorStubStandingRivalryJudgesV3({
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
      ...validateTutorStubStandingRivalryResponseV3({
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
  const pairAgrees =
    integrityIssues.length === 0 &&
    eligible.length === 2 &&
    labels[0] === labels[1] &&
    FINAL_LABELS.includes(labels[0]);
  const component_measurement = Object.fromEntries(
    TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => [field, componentMeasurement(eligible, field)]),
  );
  const common = {
    case_id: caseId,
    schema: TUTOR_STUB_STANDING_RIVALRY_ENSEMBLE_SCHEMA_V3,
    advisory_signals: advisorySignals,
    lexical_or_regex_authority: 'none',
    component_disagreement_may_veto_primary_label: false,
    repair_allowed: false,
    judge_rerun_after_response_allowed: false,
    unit_rerun_allowed: false,
    replacement_allowed: false,
    outcome_selection_allowed: false,
    validation: validation.map(({ judge_id, valid, issues }) => ({ judge_id, valid, issues })),
    abstentions,
    eligible_judges: eligible.map((entry) => entry.judge_id),
    primary_label_measurement: {
      status: pairAgrees ? 'determinate' : 'measurement_indeterminate',
      value: pairAgrees ? labels[0] : 'indeterminate',
      vote_counts: counts(labels),
      exact_agreement_required: 2,
      eligible_confidence: [...ELIGIBLE_CONFIDENCE],
      supporting_judges: pairAgrees ? eligible.map((entry) => entry.judge_id) : [],
    },
    component_measurement,
  };
  if (!pairAgrees) {
    const reasons = [...integrityIssues];
    if (eligible.length < 2) reasons.push('fewer_than_two_valid_medium_or_high_confidence_judges');
    if (eligible.length === 2 && labels[0] !== labels[1]) reasons.push('label_disagreement');
    return {
      ...common,
      status: 'measurement_indeterminate',
      reasons: [...new Set(reasons)],
      judgment: null,
      final_label: 'indeterminate',
      standing_rivalry_adherent_for_gate: false,
    };
  }
  const finalLabel = labels[0];
  return {
    ...common,
    status: 'determinate',
    reasons: [],
    judgment: {
      ...Object.fromEntries(
        TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => [field, component_measurement[field].value]),
      ),
      final_label: finalLabel,
    },
    final_label: finalLabel,
    standing_rivalry_adherent_for_gate: ADHERENT_LABELS.includes(finalLabel),
    adherent_labels: [...ADHERENT_LABELS],
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

export function validateTutorStubStandingRivalryRegistrationV3(registration) {
  const issues = [];
  if (
    registration?.schema !== TUTOR_STUB_STANDING_RIVALRY_REGISTRATION_SCHEMA_V3 ||
    registration?.version !== 3 ||
    registration?.status !== 'prospective_gate_1c_zero_call_registration' ||
    registration?.observationSemantics !== TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3
  ) {
    issues.push('standing-rivalry registration identity drifted');
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
    issues.push('standing-rivalry judge routes drifted');
  }
  const gate = registration?.measurement?.turnGate || {};
  if (
    JSON.stringify(gate.adherentLabels) !== JSON.stringify(ADHERENT_LABELS) ||
    gate.consensus !== 'both_valid_votes_agree' ||
    JSON.stringify(gate.eligibleConfidence) !== JSON.stringify(ELIGIBLE_CONFIDENCE) ||
    gate.bothSeatsRequired !== true ||
    gate.disagreementDisposition !== 'measurement_indeterminate' ||
    gate.indeterminateDisposition !== 'stop_unit_no_rerun_replacement_or_repair'
  ) {
    issues.push('standing-rivalry turn-gate rule drifted');
  }
  if (
    registration?.evidenceContract?.nonNullQuoteRule !== 'exact_substring_of_declared_public_packet_source' ||
    !String(registration?.evidenceContract?.promptInstruction || '').includes('exact substring')
  ) {
    issues.push('standing-rivalry evidence prompt/checker contract drifted');
  }
  return { valid: issues.length === 0, issues };
}
