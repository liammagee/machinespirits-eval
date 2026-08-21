import crypto from 'node:crypto';

export const TUTOR_STUB_RESISTANCE_SEMANTIC_RESPONSE_SCHEMA =
  'machinespirits.tutor-stub.resistance-semantic-judge-response.v1';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_RECORD_SCHEMA =
  'machinespirits.tutor-stub.resistance-semantic-adjudication-record.v1';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_CORPUS_SCHEMA =
  'machinespirits.tutor-stub.resistance-semantic-adjudication-corpus.v1';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION = 'prospective_frame_resistance_semantic_v1';

const TRISTATE = ['yes', 'no', 'indeterminate'];
const TARGETS = ['none', 'tutor_standing', 'inquiry_frame', 'premise', 'question', 'test_or_criterion', 'other'];
const JURISDICTION_TYPES = ['none', 'authority', 'standing', 'right', 'frame_governance', 'other'];
const FINAL_LABELS = ['frame_refuser', 'frame_defiant_or_productive_dispute', 'neither', 'indeterminate'];
const CONFIDENCE = ['high', 'medium', 'low'];
const EVIDENCE_FIELDS = [
  'jurisdiction_dispute',
  'jurisdiction_target',
  'licensed_participation',
  'participation_withholding',
  'productive_counterframing',
];
const INDETERMINACY_REASONS = [
  'none',
  'semantic_ambiguity',
  'insufficient_public_context',
  'mixed_pragmatic_force',
  'other',
];
const RESPONSE_KEYS = ['schema', 'case_id', 'provenance', 'judgment'];
const PROVENANCE_KEYS = [
  'judge_id',
  'model_ref',
  'provider',
  'model',
  'effort',
  'independent_run_id',
  'source_sha256',
  'packet_sha256',
  'prompt_sha256',
  'prohibited_tool_events',
];
const JUDGMENT_KEYS = [
  'jurisdiction_dispute',
  'jurisdiction_target',
  'jurisdiction_type',
  'licensed_participation',
  'participation_withholding',
  'productive_counterframing',
  'final_label',
  'evidence_spans',
  'confidence',
  'indeterminacy_reason',
];
const SPAN_KEYS = ['field', 'source_id', 'start_utf16', 'end_utf16', 'text'];
const CORE_FIELDS = [
  'jurisdiction_dispute',
  'jurisdiction_target',
  'jurisdiction_type',
  'licensed_participation',
  'participation_withholding',
  'productive_counterframing',
  'final_label',
];

export const TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['schema', 'case_id', 'judgment'],
  properties: {
    schema: { type: 'string', enum: [TUTOR_STUB_RESISTANCE_SEMANTIC_RESPONSE_SCHEMA] },
    case_id: { type: 'string', minLength: 1 },
    judgment: {
      type: 'object',
      additionalProperties: false,
      required: JUDGMENT_KEYS,
      properties: {
        jurisdiction_dispute: { type: 'string', enum: TRISTATE },
        jurisdiction_target: { type: 'string', enum: TARGETS },
        jurisdiction_type: { type: 'string', enum: JURISDICTION_TYPES },
        licensed_participation: { type: 'string', enum: TRISTATE },
        participation_withholding: { type: 'string', enum: TRISTATE },
        productive_counterframing: { type: 'string', enum: TRISTATE },
        final_label: { type: 'string', enum: FINAL_LABELS },
        evidence_spans: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: SPAN_KEYS,
            properties: {
              field: { type: 'string', enum: EVIDENCE_FIELDS },
              source_id: { type: 'string', pattern: '^(utterance|context:[0-9]+)$' },
              start_utf16: { type: 'integer', minimum: 0 },
              end_utf16: { type: 'integer', minimum: 1 },
              text: { type: 'string', minLength: 1 },
            },
          },
        },
        confidence: { type: 'string', enum: CONFIDENCE },
        indeterminacy_reason: { type: 'string', enum: INDETERMINACY_REASONS },
      },
    },
  },
});

export function tutorStubResistanceSemanticSha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function exactKeys(value, expected) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort())
  );
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function canonicalSha256(value) {
  return tutorStubResistanceSemanticSha256(JSON.stringify(canonicalJson(value)));
}

export function tutorStubResistanceSemanticPromptSha256(prompt) {
  return canonicalSha256(prompt);
}

function sourceMap(utterance, publicContext) {
  return Object.fromEntries([
    ['utterance', utterance],
    ...publicContext.map((row, index) => [`context:${index}`, row.text]),
  ]);
}

export function buildTutorStubResistanceSemanticAdjudicationPrompt({ caseId, source, publicContext, judge }) {
  if (!String(caseId || '').trim()) throw new Error('semantic adjudication prompt requires caseId');
  if (!String(source || '').trim()) throw new Error('semantic adjudication prompt requires source text');
  if (!Array.isArray(publicContext) || !publicContext.length) {
    throw new Error('semantic adjudication prompt requires bounded public context');
  }
  if (!judge?.id || !judge?.modelRef || judge.effort !== 'low') {
    throw new Error('semantic adjudication prompt requires one registered low-effort judge');
  }
  const context = publicContext.map((row) => ({ role: row?.role, text: String(row?.text || '') }));
  if (context.some((row) => !['assistant', 'learner'].includes(row.role))) {
    throw new Error('public context roles must be assistant or learner');
  }
  if (context.some((row) => !row.text.trim())) throw new Error('public context rows must contain text');
  return {
    schema: 'machinespirits.tutor-stub.resistance-semantic-adjudication-prompt.v1',
    case_id: caseId,
    judge: { id: judge.id, model_ref: judge.modelRef, effort: judge.effort },
    independence: {
      other_judge_output_visible: false,
      consensus_visible: false,
      gold_labels_visible: false,
      development_examples_visible: false,
      heldout_examples_visible: false,
      advisory_lexical_signals_visible: false,
      profile_arm_register_assignment_visible: false,
      observer_classifier_repair_outcome_visible: false,
    },
    instructions: [
      'Judge semantic and compositional meaning from the public utterance and only the bounded public context supplied for anaphora.',
      'Consider mood, stance, intent, pragmatic force, framing, jurisdiction, refusal, uptake, irony, anaphora, and compositional meaning.',
      'No keyword, regular expression, surface template, learner classifier, or hidden DAG result is authoritative. Lexical matches are neither necessary nor sufficient.',
      'Code jurisdiction dispute, its target and type, licensed participation, explicit participation withholding, productive counterframing, and one final label.',
      'frame_refuser requires jurisdiction_dispute=yes, participation_withholding=yes, licensed_participation=no, and productive_counterframing=no.',
      'frame_defiant_or_productive_dispute requires jurisdiction_dispute=yes, licensed_participation=yes, and productive_counterframing=yes; it may still withhold the imposed frame while accepting a narrower inquiry.',
      'Anchor every yes field and the jurisdiction target to an exact copied UTF-16 span from utterance or context. Different judges may choose different valid spans.',
      'Use indeterminate when public meaning is unresolved; never guess. Return confidence high only for a determinate judgment.',
      `Return only JSON conforming exactly to ${TUTOR_STUB_RESISTANCE_SEMANTIC_RESPONSE_SCHEMA}.`,
    ],
    public_context: context,
    utterance: { text: source, offset_unit: 'utf16_code_unit' },
    packet_sha256: canonicalSha256({ case_id: caseId, public_context: context, utterance: source }),
  };
}

export function validateTutorStubResistanceSemanticRegistration(registration) {
  const issues = [];
  const judges = registration?.measurement?.judges || [];
  if (judges.length !== 2) issues.push('exactly two semantic judges are required');
  if (new Set(judges.map((judge) => judge.id)).size !== judges.length) issues.push('judge ids must be unique');
  if (new Set(judges.map((judge) => judge.provider)).size !== judges.length) {
    issues.push('semantic judges must use distinct providers');
  }
  if (new Set(judges.map((judge) => judge.modelFamily)).size !== judges.length) {
    issues.push('semantic judges must use distinct model families');
  }
  if (judges.some((judge) => judge.model === 'gpt-5.6-luna' || judge.modelRef === 'codex.gpt-5.6-luna')) {
    issues.push('the Luna learner/classifier route cannot be a semantic judge');
  }
  if (judges.some((judge) => judge.effort !== 'low')) issues.push('semantic judges must use frozen low effort');
  if (registration?.measurement?.deterministicAuthority !== 'schema_span_provenance_safety_only') {
    issues.push('deterministic authority must be schema/span/provenance/safety only');
  }
  if (registration?.measurement?.lexicalObserverRole !== 'advisory_only_never_veto_or_override') {
    issues.push('lexical observer must be advisory only');
  }
  return { valid: issues.length === 0, issues };
}

function expectedModelByJudge(registration) {
  return Object.fromEntries((registration?.measurement?.judges || []).map((judge) => [judge.id, judge]));
}

function expectedLabel(judgment) {
  if (
    judgment.jurisdiction_dispute === 'yes' &&
    judgment.licensed_participation === 'no' &&
    judgment.participation_withholding === 'yes' &&
    judgment.productive_counterframing === 'no'
  ) {
    return 'frame_refuser';
  }
  if (
    judgment.jurisdiction_dispute === 'yes' &&
    judgment.licensed_participation === 'yes' &&
    judgment.productive_counterframing === 'yes'
  ) {
    return 'frame_defiant_or_productive_dispute';
  }
  if (
    [
      judgment.jurisdiction_dispute,
      judgment.licensed_participation,
      judgment.participation_withholding,
      judgment.productive_counterframing,
    ].includes('indeterminate')
  ) {
    return 'indeterminate';
  }
  return 'neither';
}

export function validateTutorStubResistanceSemanticResponse({
  source,
  publicContext,
  caseId,
  response,
  registration,
  prompt,
}) {
  const issues = [];
  if (!exactKeys(response, RESPONSE_KEYS)) issues.push('response keys are not exact');
  if (response?.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_RECORD_SCHEMA)
    issues.push('unsupported stored record schema');
  if (response?.case_id !== caseId) issues.push('case id mismatch');
  if (!exactKeys(response?.provenance, PROVENANCE_KEYS)) issues.push('provenance keys are not exact');
  if (!exactKeys(response?.judgment, JUDGMENT_KEYS)) issues.push('judgment keys are not exact');

  const judge = expectedModelByJudge(registration)[response?.provenance?.judge_id];
  if (!judge) issues.push('judge id is not registered');
  if (judge && response.provenance.model_ref !== judge.modelRef) issues.push('judge model ref mismatch');
  if (judge && response.provenance.provider !== judge.provider) issues.push('judge provider mismatch');
  if (judge && response.provenance.model !== judge.model) issues.push('judge model mismatch');
  if (judge && response.provenance.effort !== judge.effort) issues.push('judge effort mismatch');
  if (!String(response?.provenance?.independent_run_id || '').trim()) issues.push('independent run id is missing');
  if (response?.provenance?.prohibited_tool_events !== 0) issues.push('prohibited tool event count must be zero');
  if (response?.provenance?.source_sha256 !== tutorStubResistanceSemanticSha256(source)) {
    issues.push('source digest mismatch');
  }
  if (prompt && response?.provenance?.packet_sha256 !== prompt.packet_sha256) {
    issues.push('public packet digest mismatch');
  }
  if (prompt && response?.provenance?.prompt_sha256 !== tutorStubResistanceSemanticPromptSha256(prompt)) {
    issues.push('prompt digest mismatch');
  }

  const judgment = response?.judgment || {};
  for (const field of [
    'jurisdiction_dispute',
    'licensed_participation',
    'participation_withholding',
    'productive_counterframing',
  ]) {
    if (!TRISTATE.includes(judgment[field])) issues.push(`${field} is invalid`);
  }
  if (!TARGETS.includes(judgment.jurisdiction_target)) issues.push('jurisdiction_target is invalid');
  if (!JURISDICTION_TYPES.includes(judgment.jurisdiction_type)) issues.push('jurisdiction_type is invalid');
  if (!FINAL_LABELS.includes(judgment.final_label)) issues.push('final_label is invalid');
  if (!CONFIDENCE.includes(judgment.confidence)) issues.push('confidence is invalid');
  if (!INDETERMINACY_REASONS.includes(judgment.indeterminacy_reason)) issues.push('indeterminacy_reason is invalid');
  if (judgment.final_label !== expectedLabel(judgment)) issues.push('final label contradicts semantic vector');
  if (judgment.final_label === 'indeterminate') {
    if (judgment.indeterminacy_reason === 'none') issues.push('indeterminate judgment requires a reason');
  } else if (judgment.indeterminacy_reason !== 'none') {
    issues.push('determinate judgment must use indeterminacy reason none');
  }
  if (judgment.jurisdiction_dispute === 'no') {
    if (judgment.jurisdiction_target !== 'none') issues.push('non-dispute must use target none');
    if (judgment.jurisdiction_type !== 'none') issues.push('non-dispute must use jurisdiction type none');
  }
  if (
    judgment.jurisdiction_dispute === 'yes' &&
    (judgment.jurisdiction_target === 'none' || judgment.jurisdiction_type === 'none')
  ) {
    issues.push('jurisdiction dispute requires target and type');
  }

  const texts = sourceMap(source, publicContext);
  const spans = judgment.evidence_spans;
  if (!Array.isArray(spans)) issues.push('evidence_spans must be an array');
  const seen = new Set();
  for (const [index, span] of (Array.isArray(spans) ? spans : []).entries()) {
    if (!exactKeys(span, SPAN_KEYS)) issues.push(`evidence span ${index} keys are not exact`);
    if (!EVIDENCE_FIELDS.includes(span?.field)) issues.push(`evidence span ${index} field is invalid`);
    const spanSource = texts[span?.source_id];
    if (spanSource === undefined) issues.push(`evidence span ${index} source is invalid`);
    if (
      !Number.isInteger(span?.start_utf16) ||
      !Number.isInteger(span?.end_utf16) ||
      span.start_utf16 < 0 ||
      span.end_utf16 <= span.start_utf16
    ) {
      issues.push(`evidence span ${index} offsets are invalid`);
      continue;
    }
    if (
      spanSource === undefined ||
      span.end_utf16 > spanSource.length ||
      spanSource.slice(span.start_utf16, span.end_utf16) !== span.text ||
      !span.text
    ) {
      issues.push(`evidence span ${index} is not an exact UTF-16 source span`);
    }
    const key = `${span.field}:${span.source_id}:${span.start_utf16}:${span.end_utf16}`;
    if (seen.has(key)) issues.push(`evidence span ${index} is duplicated`);
    seen.add(key);
  }
  const spanFields = new Set((Array.isArray(spans) ? spans : []).map((span) => span.field));
  for (const field of [
    'jurisdiction_dispute',
    'licensed_participation',
    'participation_withholding',
    'productive_counterframing',
  ]) {
    if (judgment[field] === 'yes' && !spanFields.has(field)) issues.push(`${field} requires exact-span evidence`);
  }
  if (judgment.jurisdiction_dispute === 'yes' && !spanFields.has('jurisdiction_target')) {
    issues.push('jurisdiction dispute requires exact-span target evidence');
  }
  return { valid: issues.length === 0, issues };
}

export function wrapTutorStubResistanceSemanticModelOutput({
  modelOutput,
  prompt,
  judge,
  observedProvider,
  observedModel,
  independentRunId,
  prohibitedToolEvents = 0,
}) {
  if (!exactKeys(modelOutput, ['schema', 'case_id', 'judgment'])) {
    throw new Error('semantic judge model output keys are not exact');
  }
  if (modelOutput.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_RESPONSE_SCHEMA) {
    throw new Error('semantic judge model output schema mismatch');
  }
  return {
    schema: TUTOR_STUB_RESISTANCE_SEMANTIC_RECORD_SCHEMA,
    case_id: modelOutput.case_id,
    provenance: {
      judge_id: judge.id,
      model_ref: judge.modelRef,
      provider: observedProvider,
      model: observedModel,
      effort: judge.effort,
      independent_run_id: independentRunId,
      source_sha256: tutorStubResistanceSemanticSha256(prompt.utterance.text),
      packet_sha256: prompt.packet_sha256,
      prompt_sha256: tutorStubResistanceSemanticPromptSha256(prompt),
      prohibited_tool_events: prohibitedToolEvents,
    },
    judgment: modelOutput.judgment,
  };
}

function coreSignature(judgment) {
  return JSON.stringify(CORE_FIELDS.map((field) => judgment[field]));
}

export function adjudicateTutorStubResistanceSemanticJudges({
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
  const ids = supplied.map((response) => response?.provenance?.judge_id);
  const runs = supplied.map((response) => response?.provenance?.independent_run_id);
  const promptHashes = supplied.map((response) => response?.provenance?.prompt_sha256);
  const sourceHashes = supplied.map((response) => response?.provenance?.source_sha256);
  const registeredIds = new Set(judges.map((judge) => judge.id));
  const envelopeIssues = [];
  if (supplied.length !== 2) envelopeIssues.push('exactly_two_responses_required');
  if (new Set(ids).size !== ids.length || ids.some((id) => !registeredIds.has(id))) {
    envelopeIssues.push('duplicate_or_unregistered_judge');
  }
  if (new Set(runs).size !== runs.length) envelopeIssues.push('judge_runs_not_independent');
  if (new Set(promptHashes).size !== promptHashes.length) envelopeIssues.push('judge_prompts_not_independent');
  if (new Set(sourceHashes).size !== 1) envelopeIssues.push('source_hashes_disagree');
  const byJudge = new Map(supplied.map((response) => [response?.provenance?.judge_id, response]));
  const validation = judges.map((judge) => {
    const response = byJudge.get(judge.id);
    return {
      judge_id: judge.id,
      response,
      ...validateTutorStubResistanceSemanticResponse({
        source,
        publicContext,
        caseId,
        response,
        registration,
        prompt: prompts?.[judge.id],
      }),
    };
  });
  const reasons = [...envelopeIssues];
  if (validation.some((entry) => !entry.response || !entry.valid)) reasons.push('invalid_schema_span_or_provenance');
  if (validation.some((entry) => entry.response?.judgment?.confidence !== 'high')) reasons.push('confidence_not_high');
  if (validation.some((entry) => entry.response?.judgment?.final_label === 'indeterminate')) {
    reasons.push('judge_indeterminate');
  }
  const signatures = new Set(
    validation.filter((entry) => entry.response).map((entry) => coreSignature(entry.response.judgment)),
  );
  if (signatures.size !== 1) reasons.push('judge_disagreement');
  const boundary = {
    advisory_signals: advisorySignals,
    repair_allowed: false,
    judge_rerun_allowed: false,
    unit_rerun_allowed: false,
    replacement_allowed: false,
    outcome_selection_allowed: false,
  };
  if (reasons.length) {
    return {
      case_id: caseId,
      status: 'measurement_indeterminate',
      reasons: [...new Set(reasons)],
      judgment: null,
      final_label: 'indeterminate',
      ...boundary,
      validation: validation.map(({ judge_id, valid, issues }) => ({ judge_id, valid, issues })),
    };
  }
  const judgment = Object.fromEntries(CORE_FIELDS.map((field) => [field, validation[0].response.judgment[field]]));
  return {
    case_id: caseId,
    status: 'determinate',
    reasons: [],
    judgment,
    final_label: judgment.final_label,
    judge_evidence: validation.map((entry) => ({
      judge_id: entry.judge_id,
      evidence_spans: entry.response.judgment.evidence_spans,
      confidence: entry.response.judgment.confidence,
    })),
    ...boundary,
    validation: validation.map(({ judge_id, valid, issues }) => ({ judge_id, valid, issues })),
  };
}

function exactSpan(corpusCase, evidence) {
  const texts = sourceMap(corpusCase.source, corpusCase.public_context);
  const value = texts[evidence.source_id];
  const start = String(value || '').indexOf(evidence.text);
  if (start < 0 || value.indexOf(evidence.text, start + 1) >= 0) {
    throw new Error(`gold evidence for ${evidence.field} must occur exactly once: ${evidence.text}`);
  }
  return {
    field: evidence.field,
    source_id: evidence.source_id,
    start_utf16: start,
    end_utf16: start + evidence.text.length,
    text: evidence.text,
  };
}

// Test/preflight fixture helper only. Live execution must parse independent model outputs.
export function buildTutorStubResistanceSemanticZeroCallFixtureResponse({ corpusCase, judge }) {
  const prompt = buildTutorStubResistanceSemanticAdjudicationPrompt({
    caseId: corpusCase.case_id,
    source: corpusCase.source,
    publicContext: corpusCase.public_context,
    judge,
  });
  const modelOutput = {
    schema: TUTOR_STUB_RESISTANCE_SEMANTIC_RESPONSE_SCHEMA,
    case_id: corpusCase.case_id,
    judgment: {
      ...corpusCase.expected.judgment,
      evidence_spans: corpusCase.expected.evidence.map((entry) => exactSpan(corpusCase, entry)),
      confidence: 'high',
      indeterminacy_reason: 'none',
    },
  };
  return {
    prompt,
    modelOutput,
    response: wrapTutorStubResistanceSemanticModelOutput({
      modelOutput,
      prompt,
      judge,
      observedProvider: judge.provider,
      observedModel: judge.model,
      independentRunId: `zero-call-${judge.id}-${corpusCase.case_id}`,
      prohibitedToolEvents: 0,
    }),
  };
}

function cohenKappa(left, right) {
  if (!left.length || left.length !== right.length) return 0;
  const agree = left.filter((value, index) => value === right[index]).length / left.length;
  const labels = [...new Set([...left, ...right])];
  const expected = labels.reduce(
    (sum, label) =>
      sum +
      (left.filter((value) => value === label).length / left.length) *
        (right.filter((value) => value === label).length / right.length),
    0,
  );
  return expected === 1 ? (agree === 1 ? 1 : 0) : (agree - expected) / (1 - expected);
}

export function scoreTutorStubResistanceSemanticCorpus({ corpus, responsePairs, registration }) {
  const judges = registration.measurement.judges;
  const rows = corpus.cases.map((corpusCase) => {
    const pair = responsePairs[corpusCase.case_id] || {};
    const result = adjudicateTutorStubResistanceSemanticJudges({
      source: corpusCase.source,
      publicContext: corpusCase.public_context,
      caseId: corpusCase.case_id,
      responses: judges.map((judge) => pair[judge.id]?.response).filter(Boolean),
      registration,
      prompts: Object.fromEntries(
        judges.filter((judge) => pair[judge.id]).map((judge) => [judge.id, pair[judge.id].prompt]),
      ),
    });
    return { corpusCase, pair, result };
  });
  const positive = rows.filter((row) => row.corpusCase.expected.label === 'frame_refuser');
  const negative = rows.filter((row) => row.corpusCase.expected.label !== 'frame_refuser');
  const ratio = (numerator, denominator) => (denominator ? numerator / denominator : 0);
  const judgeMetrics = Object.fromEntries(
    judges.map((judge) => {
      const labels = rows.map((row) => row.pair[judge.id]?.response?.judgment?.final_label || 'indeterminate');
      return [
        judge.id,
        {
          sensitivity: ratio(
            positive.filter((row) => row.pair[judge.id]?.response?.judgment?.final_label === 'frame_refuser').length,
            positive.length,
          ),
          specificity: ratio(
            negative.filter(
              (row) => row.pair[judge.id]?.response?.judgment?.final_label === row.corpusCase.expected.label,
            ).length,
            negative.length,
          ),
          labels,
        },
      ];
    }),
  );
  const determined = rows.filter((row) => row.result.status === 'determinate');
  const validation = rows.flatMap((row) => row.result.validation);
  const metrics = {
    schema_span_provenance_validity: ratio(validation.filter((entry) => entry.valid).length, rows.length * 2),
    per_judge: Object.fromEntries(
      judges.map((judge) => [
        judge.id,
        { sensitivity: judgeMetrics[judge.id].sensitivity, specificity: judgeMetrics[judge.id].specificity },
      ]),
    ),
    consensus_sensitivity: ratio(
      positive.filter((row) => row.result.final_label === 'frame_refuser').length,
      positive.length,
    ),
    consensus_specificity: ratio(
      negative.filter((row) => row.result.final_label === row.corpusCase.expected.label).length,
      negative.length,
    ),
    raw_interjudge_agreement: ratio(
      judgeMetrics[judges[0].id].labels.filter((value, index) => value === judgeMetrics[judges[1].id].labels[index])
        .length,
      rows.length,
    ),
    cohen_kappa: cohenKappa(judgeMetrics[judges[0].id].labels, judgeMetrics[judges[1].id].labels),
    determined_coverage_overall: ratio(determined.length, rows.length),
    determined_coverage_positive: ratio(
      positive.filter((row) => row.result.status === 'determinate').length,
      positive.length,
    ),
    determined_coverage_negative: ratio(
      negative.filter((row) => row.result.status === 'determinate').length,
      negative.length,
    ),
    indeterminate_cases: rows.length - determined.length,
    invalid_judgments: validation.filter((entry) => !entry.valid).length,
    prohibited_tool_events: rows.reduce(
      (sum, row) =>
        sum +
        judges.reduce(
          (judgeSum, judge) => judgeSum + Number(row.pair[judge.id]?.response?.provenance?.prohibited_tool_events || 0),
          0,
        ),
      0,
    ),
  };
  const gates = registration.measurement.validationGates;
  const passed =
    metrics.schema_span_provenance_validity === gates.schemaSpanProvenanceValidity &&
    Object.values(metrics.per_judge).every(
      (row) =>
        row.sensitivity >= gates.minimumPerJudgeSensitivity && row.specificity >= gates.minimumPerJudgeSpecificity,
    ) &&
    metrics.consensus_sensitivity >= gates.minimumConsensusSensitivity &&
    metrics.consensus_specificity >= gates.minimumConsensusSpecificity &&
    metrics.raw_interjudge_agreement >= gates.minimumRawInterjudgeAgreement &&
    metrics.cohen_kappa >= gates.minimumCohenKappa &&
    metrics.determined_coverage_overall >= gates.minimumOverallDeterminedCoverage &&
    metrics.determined_coverage_positive >= gates.minimumPerClassDeterminedCoverage &&
    metrics.determined_coverage_negative >= gates.minimumPerClassDeterminedCoverage &&
    metrics.invalid_judgments === 0 &&
    metrics.prohibited_tool_events === 0;
  return {
    status: passed ? 'passed' : 'failed',
    corpus_id: corpus.corpus_id,
    cases: rows.length,
    metrics,
    rows: rows.map((row) => ({
      case_id: row.corpusCase.case_id,
      expected: row.corpusCase.expected.label,
      observed: row.result.final_label,
      status: row.result.status,
    })),
  };
}

export function validateTutorStubResistanceSemanticCorpus(corpus) {
  const issues = [];
  if (corpus?.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_CORPUS_SCHEMA) issues.push('unsupported corpus schema');
  if (!['development_regression', 'heldout_blinded'].includes(corpus?.role)) issues.push('invalid corpus role');
  if (corpus?.prompt_examples_allowed !== false) issues.push('corpus examples must be prohibited from prompts');
  const cases = Array.isArray(corpus?.cases) ? corpus.cases : [];
  if (!cases.length) issues.push('corpus must contain cases');
  const ids = cases.map((row) => row?.case_id);
  if (ids.some((id) => !String(id || '').trim()) || new Set(ids).size !== ids.length) {
    issues.push('corpus case ids must be non-empty and unique');
  }
  for (const corpusCase of cases) {
    if (!String(corpusCase?.source || '').trim()) issues.push(`${corpusCase?.case_id}: source is empty`);
    if (!Array.isArray(corpusCase?.public_context) || !corpusCase.public_context.length) {
      issues.push(`${corpusCase?.case_id}: bounded public context is required`);
    }
    if (!FINAL_LABELS.filter((label) => label !== 'indeterminate').includes(corpusCase?.expected?.label)) {
      issues.push(`${corpusCase?.case_id}: expected label is invalid`);
    }
    const judgment = corpusCase?.expected?.judgment;
    if (!exactKeys(judgment, CORE_FIELDS)) issues.push(`${corpusCase?.case_id}: expected judgment keys are not exact`);
    if (judgment && judgment.final_label !== expectedLabel(judgment)) {
      issues.push(`${corpusCase?.case_id}: expected judgment contradicts label vector`);
    }
    for (const evidence of corpusCase?.expected?.evidence || []) {
      if (!EVIDENCE_FIELDS.includes(evidence?.field)) issues.push(`${corpusCase.case_id}: evidence field is invalid`);
      try {
        exactSpan(corpusCase, evidence);
      } catch (error) {
        issues.push(`${corpusCase.case_id}: ${error.message}`);
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

export default {
  adjudicateTutorStubResistanceSemanticJudges,
  buildTutorStubResistanceSemanticAdjudicationPrompt,
  buildTutorStubResistanceSemanticZeroCallFixtureResponse,
  scoreTutorStubResistanceSemanticCorpus,
  validateTutorStubResistanceSemanticCorpus,
  validateTutorStubResistanceSemanticRegistration,
  validateTutorStubResistanceSemanticResponse,
  wrapTutorStubResistanceSemanticModelOutput,
};
