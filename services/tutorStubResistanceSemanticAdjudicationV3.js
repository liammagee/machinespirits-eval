import {
  tutorStubResistanceSemanticPromptSha256,
  tutorStubResistanceSemanticSha256,
} from './tutorStubResistanceSemanticAdjudication.js';

export const TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3 =
  'machinespirits.tutor-stub.resistance-semantic-judge-response.v3';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_RECORD_SCHEMA_V3 =
  'machinespirits.tutor-stub.resistance-semantic-adjudication-record.v3';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_CORPUS_SCHEMA_V3 =
  'machinespirits.tutor-stub.resistance-semantic-adjudication-corpus.v3';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V3 = 'prospective_frame_resistance_semantic_v3';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_DEVELOPMENT_EVIDENCE_SCHEMA_V3 =
  'machinespirits.tutor-stub.resistance-semantic-development-evidence.v3';

const TRISTATE = ['yes', 'no', 'indeterminate'];
const FINAL_LABELS = ['frame_refuser', 'frame_defiant_or_productive_dispute', 'neither', 'indeterminate'];
const CONFIDENCE = ['high', 'medium', 'low'];
const INDETERMINACY_REASONS = [
  'none',
  'semantic_ambiguity',
  'insufficient_public_context',
  'mixed_pragmatic_force',
  'other',
];
export const TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3 = Object.freeze([
  'jurisdiction_dispute',
  'interlocutor_standing_or_right',
  'inquiry_or_question_frame_governance',
  'test_or_criterion_governance',
  'other_jurisdictional_governance',
  'licensed_participation',
  'participation_withholding',
  'productive_counterframing',
]);
const AXIS_FIELDS = TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.slice(1, 5);
const NAMED_AXIS_FIELDS = AXIS_FIELDS.slice(0, 3);
const CORE_FIELDS = [...TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3, 'final_label'];
const MODEL_JUDGMENT_KEYS = [...CORE_FIELDS, 'evidence_quotes', 'confidence', 'indeterminacy_reason'];
const RECORD_JUDGMENT_KEYS = [...CORE_FIELDS, 'evidence_spans', 'confidence', 'indeterminacy_reason'];
const EVIDENCE_QUOTE_KEYS = ['source_id', 'quote'];
const EVIDENCE_SPAN_KEYS = ['source_id', 'start_utf16', 'end_utf16', 'text'];
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
  'structured_output',
  'prohibited_tool_events',
  'model_attestation_basis',
  'model_independently_attested',
];

const evidenceOrNullSchema = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: EVIDENCE_QUOTE_KEYS,
      properties: {
        source_id: { type: 'string', pattern: '^(utterance|context:[0-9]+)$' },
        quote: { type: 'string', minLength: 1 },
      },
    },
    { type: 'null' },
  ],
};

export const TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3 = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['schema', 'case_id', 'judgment'],
  properties: {
    schema: { type: 'string', enum: [TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3] },
    case_id: { type: 'string', minLength: 1 },
    judgment: {
      type: 'object',
      additionalProperties: false,
      required: MODEL_JUDGMENT_KEYS,
      properties: {
        ...Object.fromEntries(
          TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => [field, { type: 'string', enum: TRISTATE }]),
        ),
        final_label: { type: 'string', enum: FINAL_LABELS },
        evidence_quotes: {
          type: 'object',
          additionalProperties: false,
          required: TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3,
          properties: Object.fromEntries(
            TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => [field, evidenceOrNullSchema]),
          ),
        },
        confidence: { type: 'string', enum: CONFIDENCE },
        indeterminacy_reason: { type: 'string', enum: INDETERMINACY_REASONS },
      },
    },
  },
});

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

function sourceMap(source, publicContext) {
  return Object.fromEntries([
    ['utterance', source],
    ...publicContext.map((row, index) => [`context:${index}`, row.text]),
  ]);
}

function validatePublicInput(source, publicContext) {
  if (!String(source || '').trim()) throw new Error('semantic adjudication prompt requires source text');
  if (!Array.isArray(publicContext) || !publicContext.length) {
    throw new Error('semantic adjudication prompt requires bounded public context');
  }
  for (const row of publicContext) {
    if (!exactKeys(row, ['role', 'text']) || !['assistant', 'learner'].includes(row.role)) {
      throw new Error('public context rows require exact assistant or learner roles');
    }
    if (!String(row.text || '').trim()) throw new Error('public context rows must contain text');
  }
}

export function buildTutorStubResistanceSemanticAdjudicationPromptV3({ caseId, source, publicContext, judge }) {
  if (!String(caseId || '').trim()) throw new Error('semantic adjudication prompt requires caseId');
  validatePublicInput(source, publicContext);
  if (!judge?.id || !judge?.modelRef || judge.effort !== 'low') {
    throw new Error('semantic adjudication prompt requires one registered low-effort judge');
  }
  const context = publicContext.map((row) => ({ role: row.role, text: row.text }));
  const packet = { case_id: caseId, public_context: context, utterance: source };
  return {
    schema: 'machinespirits.tutor-stub.resistance-semantic-adjudication-prompt.v3',
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
      'Judge semantic and compositional meaning from the current public learner utterance and only the bounded public context supplied for anaphora.',
      'Consider mood, stance, intent, pragmatic force, framing, jurisdiction, refusal, uptake, irony, anaphora, and compositional meaning.',
      'No keyword, regular expression, surface template, learner classifier, or hidden DAG result is authoritative. Lexical matches are neither necessary nor sufficient.',
      'licensed_participation=yes only when the learner actually undertakes or presently commits to a specific evidence-facing inquiry step. Hypothetical, counterfactual, conditional-only, or generic willingness is licensed_participation=no.',
      'jurisdiction_dispute=yes only when the learner disputes authority, standing, right, or governance over what inquiry, question, premise, test, or criterion governs. A merits disagreement, factual objection, procedural defect, administrative instruction, staffing issue, schedule issue, or recordkeeping dispute is not by itself jurisdictional.',
      'Classify jurisdiction on four independent axes rather than choosing one target. interlocutor_standing_or_right concerns the interlocutor role, standing, entitlement, or right to govern. inquiry_or_question_frame_governance concerns choosing, imposing, bounding, or presupposing the governing inquiry, question, frame, or premise. test_or_criterion_governance concerns choosing or imposing a test, method, evidentiary threshold, criterion, or standard. Multiple named axes may be yes when the public language establishes each one.',
      'other_jurisdictional_governance=yes only for a jurisdictional governance basis outside the three named axes. It must be no whenever any named axis is yes. If jurisdiction_dispute=no, every jurisdiction axis must be no. If jurisdiction_dispute=yes, at least one axis must be yes.',
      'productive_counterframing=yes requires a concrete alternative inquiry, question, test, criterion, or evidence-facing step that the learner actually accepts or undertakes. Generic willingness, an invitation to negotiate, or bare narrower-frame language without a concrete alternative inquiry is insufficient.',
      'frame_refuser requires jurisdiction_dispute=yes, participation_withholding=yes, licensed_participation=no, and productive_counterframing=no.',
      'frame_defiant_or_productive_dispute requires jurisdiction_dispute=yes, licensed_participation=yes, and productive_counterframing=yes; it may still withhold the imposed frame while accepting a concrete alternative inquiry.',
      'Return every fixed evidence_quotes slot. For a yes or indeterminate field, supply one exact nonempty quote and its source. Use null only when that field is no. Do not calculate or return numeric offsets; the deterministic wrapper uniquely locates the quote and stamps UTF-16 offsets.',
      'Use indeterminate when public meaning is unresolved; never guess. Any indeterminate semantic field makes final_label indeterminate. Return confidence high only for a fully determinate judgment.',
      `Return only JSON conforming exactly to ${TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3}.`,
    ],
    public_context: context,
    utterance: { text: source },
    packet_sha256: canonicalSha256(packet),
  };
}

function uniqueQuoteSpan(text, evidence, field) {
  if (!exactKeys(evidence, EVIDENCE_QUOTE_KEYS)) throw new Error(`${field} evidence quote keys are not exact`);
  if (!String(evidence.quote || '')) throw new Error(`${field} evidence quote is empty`);
  const start = text.indexOf(evidence.quote);
  if (start < 0) throw new Error(`${field} evidence quote is absent from declared source`);
  if (text.indexOf(evidence.quote, start + 1) >= 0) {
    throw new Error(`${field} evidence quote is ambiguous in declared source`);
  }
  return {
    source_id: evidence.source_id,
    start_utf16: start,
    end_utf16: start + evidence.quote.length,
    text: evidence.quote,
  };
}

function normalizeEvidenceQuotes(modelOutput, prompt) {
  const judgment = modelOutput?.judgment;
  if (!exactKeys(judgment, MODEL_JUDGMENT_KEYS)) throw new Error('semantic judge judgment keys are not exact');
  if (!exactKeys(judgment.evidence_quotes, TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3)) {
    throw new Error('evidence quote slots are not exact');
  }
  const sources = sourceMap(prompt.utterance.text, prompt.public_context);
  const evidenceSpans = Object.fromEntries(
    TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => {
      const evidence = judgment.evidence_quotes[field];
      if (evidence === null) return [field, null];
      const text = sources[evidence?.source_id];
      if (text === undefined) throw new Error(`${field} evidence quote source is invalid`);
      return [field, uniqueQuoteSpan(text, evidence, field)];
    }),
  );
  return Object.fromEntries(
    RECORD_JUDGMENT_KEYS.map((key) => [key, key === 'evidence_spans' ? evidenceSpans : judgment[key]]),
  );
}

export function wrapTutorStubResistanceSemanticModelOutputV3({
  modelOutput,
  prompt,
  judge,
  observedProvider,
  observedModel,
  observedEffort,
  independentRunId,
  structuredOutput,
  prohibitedToolEvents,
  modelAttestationBasis,
  modelIndependentlyAttested,
}) {
  if (!exactKeys(modelOutput, ['schema', 'case_id', 'judgment'])) {
    throw new Error('semantic judge model output keys are not exact');
  }
  if (modelOutput.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3) {
    throw new Error('semantic judge model output schema mismatch');
  }
  if (modelOutput.case_id !== prompt.case_id) throw new Error('semantic judge case id mismatch');
  return {
    schema: TUTOR_STUB_RESISTANCE_SEMANTIC_RECORD_SCHEMA_V3,
    case_id: modelOutput.case_id,
    provenance: {
      judge_id: judge.id,
      model_ref: judge.modelRef,
      provider: observedProvider,
      model: observedModel,
      effort: observedEffort,
      independent_run_id: independentRunId,
      source_sha256: tutorStubResistanceSemanticSha256(prompt.utterance.text),
      packet_sha256: prompt.packet_sha256,
      prompt_sha256: tutorStubResistanceSemanticPromptSha256(prompt),
      structured_output: structuredOutput,
      prohibited_tool_events: prohibitedToolEvents,
      model_attestation_basis: modelAttestationBasis,
      model_independently_attested: modelIndependentlyAttested,
    },
    judgment: normalizeEvidenceQuotes(modelOutput, prompt),
  };
}

function expectedLabel(judgment) {
  if (TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.some((field) => judgment?.[field] === 'indeterminate')) {
    return 'indeterminate';
  }
  if (
    judgment?.jurisdiction_dispute === 'yes' &&
    judgment?.licensed_participation === 'no' &&
    judgment?.participation_withholding === 'yes' &&
    judgment?.productive_counterframing === 'no'
  ) {
    return 'frame_refuser';
  }
  if (
    judgment?.jurisdiction_dispute === 'yes' &&
    judgment?.licensed_participation === 'yes' &&
    judgment?.productive_counterframing === 'yes'
  ) {
    return 'frame_defiant_or_productive_dispute';
  }
  return 'neither';
}

function validateSemanticVector(judgment, issues, prefix = '') {
  for (const field of TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3) {
    if (!TRISTATE.includes(judgment?.[field])) issues.push(`${prefix}${field} is invalid`);
  }
  if (!FINAL_LABELS.includes(judgment?.final_label)) issues.push(`${prefix}final_label is invalid`);
  if (judgment?.final_label !== expectedLabel(judgment))
    issues.push(`${prefix}final label contradicts semantic vector`);
  const axes = AXIS_FIELDS.map((field) => judgment?.[field]);
  if (judgment?.jurisdiction_dispute === 'no' && axes.some((value) => value !== 'no')) {
    issues.push(`${prefix}non-dispute requires every jurisdiction axis no`);
  }
  if (judgment?.jurisdiction_dispute === 'yes' && !axes.includes('yes')) {
    issues.push(`${prefix}jurisdiction dispute requires at least one positive jurisdiction axis`);
  }
  if (judgment?.jurisdiction_dispute === 'indeterminate' && (!axes.includes('indeterminate') || axes.includes('yes'))) {
    issues.push(`${prefix}indeterminate dispute requires an indeterminate axis and no positive axis`);
  }
  if (
    judgment?.other_jurisdictional_governance === 'yes' &&
    NAMED_AXIS_FIELDS.some((field) => judgment?.[field] === 'yes')
  ) {
    issues.push(`${prefix}other jurisdiction axis cannot overlap a named positive axis`);
  }
}

function validateEvidenceSpans({ judgment, source, publicContext, issues, prefix = '' }) {
  if (!exactKeys(judgment?.evidence_spans, TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3)) {
    issues.push(`${prefix}evidence span slots are not exact`);
    return;
  }
  const texts = sourceMap(source, publicContext);
  for (const field of TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3) {
    const span = judgment.evidence_spans[field];
    const value = judgment[field];
    if (value === 'no' && span !== null) issues.push(`${prefix}${field} evidence must be null when field is no`);
    if (value !== 'no' && span === null) issues.push(`${prefix}${field} requires exact-span evidence`);
    if (span === null) continue;
    if (!exactKeys(span, EVIDENCE_SPAN_KEYS)) {
      issues.push(`${prefix}${field} evidence span keys are not exact`);
      continue;
    }
    const spanSource = texts[span.source_id];
    if (spanSource === undefined) issues.push(`${prefix}${field} evidence source is invalid`);
    if (
      !Number.isInteger(span.start_utf16) ||
      !Number.isInteger(span.end_utf16) ||
      span.start_utf16 < 0 ||
      span.end_utf16 <= span.start_utf16 ||
      spanSource === undefined ||
      span.end_utf16 > spanSource.length ||
      spanSource.slice(span.start_utf16, span.end_utf16) !== span.text ||
      !span.text
    ) {
      issues.push(`${prefix}${field} evidence is not an exact UTF-16 source span`);
    }
  }
}

function expectedModelByJudge(registration) {
  return Object.fromEntries((registration?.measurement?.judges || []).map((judge) => [judge.id, judge]));
}

export function validateTutorStubResistanceSemanticResponseV3({
  source,
  publicContext,
  caseId,
  response,
  registration,
  prompt,
}) {
  const issues = [];
  if (!exactKeys(response, ['schema', 'case_id', 'provenance', 'judgment'])) issues.push('response keys are not exact');
  if (response?.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_RECORD_SCHEMA_V3) {
    issues.push('unsupported stored v3 record schema');
  }
  if (response?.case_id !== caseId) issues.push('case id mismatch');
  if (!exactKeys(response?.provenance, PROVENANCE_KEYS)) issues.push('provenance keys are not exact');
  if (!exactKeys(response?.judgment, RECORD_JUDGMENT_KEYS)) issues.push('judgment keys are not exact');
  const judge = expectedModelByJudge(registration)[response?.provenance?.judge_id];
  if (!judge) issues.push('judge id is not registered');
  if (judge && response.provenance.model_ref !== judge.modelRef) issues.push('judge model ref mismatch');
  if (judge && response.provenance.provider !== judge.provider) issues.push('judge provider mismatch');
  if (judge && response.provenance.model !== judge.model) issues.push('judge model mismatch');
  if (judge && response.provenance.effort !== judge.effort) issues.push('judge effort mismatch');
  if (!String(response?.provenance?.independent_run_id || '').trim()) issues.push('independent run id is missing');
  if (response?.provenance?.prohibited_tool_events !== 0) issues.push('prohibited tool event count must be zero');
  if (response?.provenance?.structured_output !== true) issues.push('structured output must be explicitly observed');
  if (judge && response?.provenance?.model_attestation_basis !== judge.modelAttestationBasis) {
    issues.push('model attestation basis mismatch');
  }
  if (response?.provenance?.model_independently_attested !== false) {
    issues.push('unexpected independent model attestation');
  }
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
  validateSemanticVector(judgment, issues);
  if (!CONFIDENCE.includes(judgment.confidence)) issues.push('confidence is invalid');
  if (!INDETERMINACY_REASONS.includes(judgment.indeterminacy_reason)) issues.push('indeterminacy_reason is invalid');
  if (judgment.final_label === 'indeterminate') {
    if (judgment.indeterminacy_reason === 'none') issues.push('indeterminate judgment requires a reason');
  } else if (judgment.indeterminacy_reason !== 'none') {
    issues.push('determinate judgment must use indeterminacy reason none');
  }
  if (judgment.final_label !== 'indeterminate' && judgment.confidence !== 'high') {
    issues.push('determinate judgment requires high confidence');
  }
  validateEvidenceSpans({ judgment, source, publicContext, issues });
  return { valid: issues.length === 0, issues };
}

function coreSignature(judgment) {
  return JSON.stringify(CORE_FIELDS.map((field) => judgment?.[field]));
}

export function adjudicateTutorStubResistanceSemanticJudgesV3({
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
  const reasons = [];
  if (supplied.length !== 2) reasons.push('exactly_two_responses_required');
  if (new Set(ids).size !== ids.length || ids.some((id) => !registeredIds.has(id))) {
    reasons.push('duplicate_or_unregistered_judge');
  }
  if (new Set(runs).size !== runs.length) reasons.push('judge_runs_not_independent');
  if (new Set(promptHashes).size !== promptHashes.length) reasons.push('judge_prompts_not_independent');
  if (new Set(sourceHashes).size !== 1) reasons.push('source_hashes_disagree');
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
  if (validation.some((entry) => !entry.response || !entry.valid)) reasons.push('invalid_schema_span_or_provenance');
  if (validation.some((entry) => entry.response?.judgment?.confidence !== 'high')) reasons.push('confidence_not_high');
  if (validation.some((entry) => entry.response?.judgment?.final_label === 'indeterminate')) {
    reasons.push('judge_indeterminate');
  }
  if (
    new Set(validation.filter((entry) => entry.response).map((entry) => coreSignature(entry.response.judgment)))
      .size !== 1
  ) {
    reasons.push('judge_disagreement');
  }
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

function exactQuote(corpusCase, evidence, field) {
  if (evidence === null) return null;
  const texts = sourceMap(corpusCase.source, corpusCase.public_context);
  const text = texts[evidence.source_id];
  uniqueQuoteSpan(text, { source_id: evidence.source_id, quote: evidence.text }, field);
  return { source_id: evidence.source_id, quote: evidence.text };
}

// Test/preflight fixture helper only. Live execution must parse independent model outputs.
export function buildTutorStubResistanceSemanticZeroCallFixtureResponseV3({ corpusCase, judge }) {
  const prompt = buildTutorStubResistanceSemanticAdjudicationPromptV3({
    caseId: corpusCase.case_id,
    source: corpusCase.source,
    publicContext: corpusCase.public_context,
    judge,
  });
  const modelOutput = {
    schema: TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3,
    case_id: corpusCase.case_id,
    judgment: {
      ...corpusCase.expected.judgment,
      evidence_quotes: Object.fromEntries(
        TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => [
          field,
          exactQuote(corpusCase, corpusCase.expected.evidence[field], field),
        ]),
      ),
      confidence: 'high',
      indeterminacy_reason: 'none',
    },
  };
  return {
    prompt,
    modelOutput,
    response: wrapTutorStubResistanceSemanticModelOutputV3({
      modelOutput,
      prompt,
      judge,
      observedProvider: judge.provider,
      observedModel: judge.model,
      observedEffort: judge.effort,
      independentRunId: `zero-call-v3-${judge.id}-${corpusCase.case_id}`,
      structuredOutput: true,
      prohibitedToolEvents: 0,
      modelAttestationBasis: judge.modelAttestationBasis,
      modelIndependentlyAttested: false,
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

export function scoreTutorStubResistanceSemanticCorpusV3({ corpus, responsePairs, registration }) {
  const judges = registration.measurement.judges;
  const rows = corpus.cases.map((corpusCase) => {
    const pair = responsePairs[corpusCase.case_id] || {};
    const result = adjudicateTutorStubResistanceSemanticJudgesV3({
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
      const labels = rows.map((row) => {
        const validation = row.result.validation.find((entry) => entry.judge_id === judge.id);
        const response = row.pair[judge.id]?.response;
        return validation?.valid && response?.judgment?.confidence === 'high'
          ? response.judgment.final_label
          : 'indeterminate';
      });
      const vectors = rows.map((row) => {
        const validation = row.result.validation.find((entry) => entry.judge_id === judge.id);
        const response = row.pair[judge.id]?.response;
        return validation?.valid && response?.judgment?.confidence === 'high'
          ? coreSignature(response.judgment)
          : 'indeterminate';
      });
      return [
        judge.id,
        {
          sensitivity: ratio(
            positive.filter((row) => labels[rows.indexOf(row)] === 'frame_refuser').length,
            positive.length,
          ),
          specificity: ratio(
            negative.filter(
              (row) => labels[rows.indexOf(row)] !== 'indeterminate' && labels[rows.indexOf(row)] !== 'frame_refuser',
            ).length,
            negative.length,
          ),
          exact_label_accuracy: ratio(
            rows.filter((row, index) => labels[index] === row.corpusCase.expected.label).length,
            rows.length,
          ),
          exact_core_vector_accuracy: ratio(
            rows.filter((row, index) => vectors[index] === coreSignature(row.corpusCase.expected.judgment)).length,
            rows.length,
          ),
          labels,
          vectors,
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
        {
          sensitivity: judgeMetrics[judge.id].sensitivity,
          specificity: judgeMetrics[judge.id].specificity,
          exact_label_accuracy: judgeMetrics[judge.id].exact_label_accuracy,
          exact_core_vector_accuracy: judgeMetrics[judge.id].exact_core_vector_accuracy,
        },
      ]),
    ),
    consensus_sensitivity: ratio(
      positive.filter((row) => row.result.final_label === 'frame_refuser').length,
      positive.length,
    ),
    consensus_specificity: ratio(
      negative.filter((row) => row.result.status === 'determinate' && row.result.final_label !== 'frame_refuser')
        .length,
      negative.length,
    ),
    consensus_exact_label_accuracy: ratio(
      rows.filter((row) => row.result.final_label === row.corpusCase.expected.label).length,
      rows.length,
    ),
    consensus_exact_core_vector_accuracy: ratio(
      rows.filter(
        (row) =>
          row.result.status === 'determinate' &&
          coreSignature(row.result.judgment) === coreSignature(row.corpusCase.expected.judgment),
      ).length,
      rows.length,
    ),
    consensus_productive_dispute_recall: ratio(
      rows.filter(
        (row) =>
          row.corpusCase.expected.label === 'frame_defiant_or_productive_dispute' &&
          row.result.final_label === row.corpusCase.expected.label,
      ).length,
      rows.filter((row) => row.corpusCase.expected.label === 'frame_defiant_or_productive_dispute').length,
    ),
    raw_interjudge_label_agreement: ratio(
      judgeMetrics[judges[0].id].labels.filter((value, index) => value === judgeMetrics[judges[1].id].labels[index])
        .length,
      rows.length,
    ),
    raw_interjudge_full_vector_agreement: ratio(
      judgeMetrics[judges[0].id].vectors.filter((value, index) => value === judgeMetrics[judges[1].id].vectors[index])
        .length,
      rows.length,
    ),
    label_cohen_kappa: cohenKappa(judgeMetrics[judges[0].id].labels, judgeMetrics[judges[1].id].labels),
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
        row.sensitivity >= gates.minimumPerJudgeSensitivity &&
        row.specificity >= gates.minimumPerJudgeSpecificity &&
        row.exact_label_accuracy >= gates.minimumPerJudgeExactLabelAccuracy &&
        row.exact_core_vector_accuracy >= gates.minimumPerJudgeExactCoreVectorAccuracy,
    ) &&
    metrics.consensus_sensitivity >= gates.minimumConsensusSensitivity &&
    metrics.consensus_specificity >= gates.minimumConsensusSpecificity &&
    metrics.consensus_exact_label_accuracy >= gates.minimumConsensusExactLabelAccuracy &&
    metrics.consensus_exact_core_vector_accuracy >= gates.minimumConsensusExactCoreVectorAccuracy &&
    metrics.consensus_productive_dispute_recall >= gates.minimumConsensusProductiveDisputeRecall &&
    metrics.raw_interjudge_label_agreement >= gates.minimumRawInterjudgeAgreement &&
    metrics.raw_interjudge_full_vector_agreement >= gates.minimumRawFullVectorInterjudgeAgreement &&
    metrics.label_cohen_kappa >= gates.minimumCohenKappa &&
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

export function validateTutorStubResistanceSemanticCorpusV3(corpus) {
  const issues = [];
  if (
    !exactKeys(corpus, [
      'schema',
      'corpus_id',
      'role',
      'frozen',
      'prompt_examples_allowed',
      'context_provenance',
      'cases',
    ])
  ) {
    issues.push('corpus keys are not exact');
  }
  if (corpus?.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_CORPUS_SCHEMA_V3) issues.push('unsupported v3 corpus schema');
  if (!['development_regression', 'heldout_blinded'].includes(corpus?.role)) issues.push('invalid corpus role');
  if (corpus?.frozen !== true) issues.push('corpus must be frozen');
  if (corpus?.prompt_examples_allowed !== false) issues.push('corpus examples must be prohibited from prompts');
  if (!['public_synthetic_authored', 'public_preserved_live'].includes(corpus?.context_provenance)) {
    issues.push('context provenance is invalid');
  }
  const cases = Array.isArray(corpus?.cases) ? corpus.cases : [];
  if (!cases.length) issues.push('corpus must contain cases');
  const ids = cases.map((row) => row?.case_id);
  if (ids.some((id) => !String(id || '').trim()) || new Set(ids).size !== ids.length) {
    issues.push('corpus case ids must be non-empty and unique');
  }
  for (const corpusCase of cases) {
    const prefix = `${corpusCase?.case_id}: `;
    if (!exactKeys(corpusCase, ['case_id', 'public_context', 'source', 'expected']))
      issues.push(`${prefix}case keys are not exact`);
    if (!String(corpusCase?.source || '').trim()) issues.push(`${prefix}source is empty`);
    const publicContext = Array.isArray(corpusCase?.public_context) ? corpusCase.public_context : [];
    if (!publicContext.length) issues.push(`${prefix}bounded public context is required`);
    for (const [index, context] of publicContext.entries()) {
      if (!exactKeys(context, ['role', 'text'])) issues.push(`${prefix}context ${index} keys are not exact`);
      if (!['assistant', 'learner'].includes(context?.role)) issues.push(`${prefix}context ${index} role is invalid`);
      if (!String(context?.text || '').trim()) issues.push(`${prefix}context ${index} text is empty`);
    }
    if (!exactKeys(corpusCase?.expected, ['label', 'judgment', 'evidence']))
      issues.push(`${prefix}expected keys are not exact`);
    if (!FINAL_LABELS.filter((label) => label !== 'indeterminate').includes(corpusCase?.expected?.label)) {
      issues.push(`${prefix}expected label is invalid`);
    }
    const judgment = corpusCase?.expected?.judgment;
    if (!exactKeys(judgment, CORE_FIELDS)) issues.push(`${prefix}expected judgment keys are not exact`);
    validateSemanticVector(judgment, issues, prefix);
    if (corpusCase?.expected?.label !== judgment?.final_label)
      issues.push(`${prefix}expected label does not match judgment`);
    const evidence = corpusCase?.expected?.evidence;
    if (!exactKeys(evidence, TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3)) {
      issues.push(`${prefix}expected evidence slots are not exact`);
      continue;
    }
    const sources = sourceMap(corpusCase.source, publicContext);
    for (const field of TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3) {
      const row = evidence[field];
      if (judgment?.[field] === 'no' && row !== null) issues.push(`${prefix}${field} evidence must be null`);
      if (judgment?.[field] !== 'no' && row === null) issues.push(`${prefix}${field} evidence is required`);
      if (row === null) continue;
      if (!exactKeys(row, ['source_id', 'text'])) {
        issues.push(`${prefix}${field} gold evidence keys are not exact`);
        continue;
      }
      const sourceText = sources[row.source_id];
      try {
        uniqueQuoteSpan(sourceText, { source_id: row.source_id, quote: row.text }, field);
      } catch (error) {
        issues.push(`${prefix}${error.message}`);
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

export function validateTutorStubResistanceSemanticDevelopmentEvidenceV3(manifest) {
  const issues = [];
  if (
    !exactKeys(manifest, [
      'schema',
      'version',
      'role',
      'frozen',
      'prompt_examples_allowed',
      'inputs',
      'total_cases',
      'v3_heldout_reuse_allowed',
      'repair_scope',
    ])
  ) {
    issues.push('development evidence manifest keys are not exact');
  }
  if (
    manifest?.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_DEVELOPMENT_EVIDENCE_SCHEMA_V3 ||
    manifest?.version !== 3 ||
    manifest?.role !== 'development_regression_disclosed_post_v1_v2_validation' ||
    manifest?.frozen !== true ||
    manifest?.prompt_examples_allowed !== false ||
    manifest?.v3_heldout_reuse_allowed !== false ||
    manifest?.repair_scope !== 'fixed_evidence_slots_and_nonoverlapping_multiaxial_jurisdiction_ontology_only'
  ) {
    issues.push('development evidence manifest boundary drifted');
  }
  if (!Array.isArray(manifest?.inputs) || manifest.inputs.length !== 3) {
    issues.push('development evidence requires exactly three frozen inputs');
  }
  const expectedInputs = [
    {
      path: 'config/tutor-stub-resistance-semantic-adjudication-development-corpus.v1.json',
      sha256: '159fdafe39d67c200868f67a27ea5392366c614e4b2b73f186c3051cb734a5e9',
      cases: 16,
      disposition: 'preexisting_frozen_development_regressions',
    },
    {
      path: 'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v1.json',
      sha256: '9378416d1fdf8dc41f35ad84a4edf69fba6ad8889ce5020617f3d19747c9a2c7',
      cases: 80,
      disposition: 'observed_failed_v1_heldout_now_disclosed_development_only',
      consumed_request_sha256: 'b6d9a41cc9fbdb2a3fc15f536e2a0b6e97a406986c9f88027e0765ab4bddb826',
      sealed_report_sha256: '008230526809a6aa2917b240c6a30af644f30184b89042825773b1b8040c5c74',
      observed_judge_calls: 160,
      observed_charged_reservations: 160,
      recovery_or_rejudge_calls: 0,
    },
    {
      path: 'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v2.json',
      sha256: 'a52d10f60ceeeb9e1e92415c6add6d0dee4dbf69608053652ff9c23f08216535',
      cases: 80,
      disposition: 'observed_failed_v2_heldout_now_disclosed_development_only',
      consumed_request_sha256: 'b91b6c92ec6b82b15b40821938929c3e2c31c86424822846a26443977cb479d6',
      sealed_report_sha256: '11e868d18135e6df29230eab6f7912427917c0e0b55ea350f6cec4a2168fca11',
      private_archive_branch: 'codex/resistance-semantic-validation-v2-failed-archive',
      private_archive_commit: 'a98b58732ae2f0b68180e3bbb8d0357cf2e4adfa',
      observed_judge_calls: 160,
      observed_charged_reservations: 160,
      recovery_or_rejudge_calls: 0,
      invalid_judgments: 52,
      measurement_indeterminate_cases: 57,
      failure_diagnosis: 'fixed_evidence_slot_contract_and_overlapping_single_choice_jurisdiction_ontology',
    },
  ];
  if (JSON.stringify(manifest?.inputs) !== JSON.stringify(expectedInputs)) {
    issues.push('development evidence inputs drifted');
  }
  if (manifest?.total_cases !== 176) issues.push('development evidence case total drifted');
  return { valid: issues.length === 0, issues };
}

export function validateTutorStubResistanceSemanticRegistrationV3(registration) {
  const issues = [];
  if (
    registration?.schema !== 'machinespirits.tutor-stub.resistance-semantic-adjudication-registration.v3' ||
    registration?.version !== 3 ||
    registration?.status !== 'development_instrument_frozen_pending_independent_v3_heldout'
  ) {
    issues.push('v3 registration identity drifted');
  }
  if (
    registration?.observationSemantics !== TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V3 ||
    registration?.supersession?.v1EligibleForFutureValidationOrLaunch !== false ||
    registration?.supersession?.v2EligibleForFutureValidationOrLaunch !== false ||
    registration?.supersession?.v2FailedValidationReportSha256 !==
      '11e868d18135e6df29230eab6f7912427917c0e0b55ea350f6cec4a2168fca11'
  ) {
    issues.push('v3 supersession boundary drifted');
  }
  if (
    registration?.instrument?.implementationPath !== 'services/tutorStubResistanceSemanticAdjudicationV3.js' ||
    registration?.instrument?.responseSchemaPath !==
      'config/tutor-stub-resistance-semantic-adjudication-response.schema.v3.json' ||
    registration?.instrument?.responseSchemaSha256 !==
      '4840ef6ebc5135d98aeb3d70d5a22416601a62fe1dc6bb3c225c05e606673033' ||
    registration?.instrument?.developmentEvidencePath !==
      'config/tutor-stub-resistance-semantic-adjudication-development-evidence.v3.json' ||
    registration?.instrument?.developmentEvidenceSha256 !==
      '4aa10fcb76779ae119a883670b8283d89123369a9079572a8a8d4a903c0610fe'
  ) {
    issues.push('v3 frozen instrument binding drifted');
  }
  const ontology = registration?.instrument?.jurisdictionOntology;
  if (
    ontology?.representation !== 'independent_multiaxial_tristates' ||
    ontology?.singleChoiceTargetOrTypeAllowed !== false ||
    ontology?.otherAxisAllowedWithNamedPositiveAxis !== false ||
    ontology?.disputeYesRequiresAtLeastOnePositiveAxis !== true ||
    ontology?.disputeNoRequiresEveryAxisNo !== true
  ) {
    issues.push('v3 jurisdiction ontology drifted');
  }
  const evidence = registration?.instrument?.evidenceContract;
  if (
    evidence?.shape !== 'fixed_required_slot_per_semantic_field' ||
    evidence?.modelReturnsNumericOffsets !== false ||
    evidence?.nullAllowedOnlyWhenFieldIsNo !== true ||
    evidence?.yesOrIndeterminateRequiresUniqueExactQuote !== true ||
    evidence?.wrapperOffsetDerivation !== 'unique_exact_quote_utf16_code_unit'
  ) {
    issues.push('v3 evidence contract drifted');
  }
  const gates = registration?.measurement?.validationGates || {};
  const exactGates = {
    schemaSpanProvenanceValidity: 1,
    minimumPerJudgeSensitivity: 0.9,
    minimumPerJudgeSpecificity: 0.9,
    minimumPerJudgeExactLabelAccuracy: 0.9,
    minimumPerJudgeExactCoreVectorAccuracy: 0.9,
    minimumConsensusSensitivity: 0.95,
    minimumConsensusSpecificity: 0.95,
    minimumConsensusExactLabelAccuracy: 0.95,
    minimumConsensusExactCoreVectorAccuracy: 0.95,
    minimumConsensusProductiveDisputeRecall: 0.9,
    minimumRawInterjudgeAgreement: 0.9,
    minimumRawFullVectorInterjudgeAgreement: 0.9,
    minimumCohenKappa: 0.8,
    minimumOverallDeterminedCoverage: 0.95,
    minimumPerClassDeterminedCoverage: 0.9,
    maximumProhibitedToolEvents: 0,
    indeterminateCountsAsSensitivityOrSpecificityFailure: true,
    invalidCountsAsSensitivityOrSpecificityFailure: true,
  };
  if (JSON.stringify(gates) !== JSON.stringify(exactGates)) issues.push('v3 validation gates drifted');
  const exactJudges = [
    {
      id: 'semantic_judge_a',
      modelRef: 'codex.gpt-5.6-sol',
      provider: 'codex',
      model: 'gpt-5.6-sol',
      modelFamily: 'openai_gpt_5_6',
      effort: 'low',
      modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
      independent: true,
    },
    {
      id: 'semantic_judge_b',
      modelRef: 'claude-code.sonnet-5',
      provider: 'claude-code',
      model: 'claude-sonnet-5',
      modelFamily: 'anthropic_claude_5',
      effort: 'low',
      modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
      independent: true,
    },
  ];
  if (JSON.stringify(registration?.measurement?.judges) !== JSON.stringify(exactJudges)) {
    issues.push('v3 judge routes drifted');
  }
  const holdout = registration?.heldoutFreezeProtocol || {};
  if (
    holdout.requiredRole !== 'heldout_blinded' ||
    holdout.requiredSchema !== TUTOR_STUB_RESISTANCE_SEMANTIC_CORPUS_SCHEMA_V3 ||
    holdout.exactCases !== 80 ||
    holdout.exactPositiveCases !== 40 ||
    holdout.exactNeitherCases !== 24 ||
    holdout.exactProductiveDisputeCases !== 16 ||
    holdout.minimumInterlocutorStandingOrRightPositiveCases !== 16 ||
    holdout.minimumInquiryOrQuestionFrameGovernancePositiveCases !== 16 ||
    holdout.minimumTestOrCriterionGovernancePositiveCases !== 16 ||
    holdout.minimumMultiAxisJurisdictionCases !== 12 ||
    holdout.minimumOtherJurisdictionalGovernanceCases !== 4 ||
    holdout.authoredByIndependentAgentAfterInstrumentFreezeCommit !== true ||
    holdout.heldoutAuthorMayInspectV1OrV2HeldoutTextOrGold !== false ||
    holdout.postHeldoutPromptModelThresholdOntologyOrConsensusTuning !== false ||
    holdout.validationCallsAuthorized !== false
  ) {
    issues.push('v3 heldout contract drifted');
  }
  const budget = registration?.prospectiveValidationBudget;
  if (
    budget?.programmeLedgerBeforeV3Validation !== 651 ||
    budget?.heldoutCases !== 80 ||
    budget?.independentJudgesPerCase !== 2 ||
    budget?.plannedCalls !== 160 ||
    budget?.maximumChargedReservationsPerPlannedCall !== 3 ||
    budget?.hardValidationReservations !== 480 ||
    budget?.programmeMaximumAfterV3Validation !== 1131 ||
    budget?.programmeCeiling !== 5000 ||
    budget?.v3ValidationCallsAuthorized !== false
  ) {
    issues.push('v3 validation budget drifted');
  }
  return { valid: issues.length === 0, issues };
}

export default {
  adjudicateTutorStubResistanceSemanticJudgesV3,
  buildTutorStubResistanceSemanticAdjudicationPromptV3,
  buildTutorStubResistanceSemanticZeroCallFixtureResponseV3,
  scoreTutorStubResistanceSemanticCorpusV3,
  validateTutorStubResistanceSemanticCorpusV3,
  validateTutorStubResistanceSemanticDevelopmentEvidenceV3,
  validateTutorStubResistanceSemanticRegistrationV3,
  validateTutorStubResistanceSemanticResponseV3,
  wrapTutorStubResistanceSemanticModelOutputV3,
};
