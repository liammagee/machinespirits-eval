import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_CORPUS_SCHEMA as V1_CORPUS_SCHEMA,
  TUTOR_STUB_RESISTANCE_SEMANTIC_RECORD_SCHEMA as V1_RECORD_SCHEMA,
  adjudicateTutorStubResistanceSemanticJudges as adjudicateV1Judges,
  scoreTutorStubResistanceSemanticCorpus as scoreV1Corpus,
  tutorStubResistanceSemanticPromptSha256,
  tutorStubResistanceSemanticSha256,
  validateTutorStubResistanceSemanticCorpus as validateV1Corpus,
  validateTutorStubResistanceSemanticRegistration as validateV1Registration,
  validateTutorStubResistanceSemanticResponse as validateV1Response,
} from './tutorStubResistanceSemanticAdjudication.js';

export const TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V2 =
  'machinespirits.tutor-stub.resistance-semantic-judge-response.v2';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_RECORD_SCHEMA_V2 =
  'machinespirits.tutor-stub.resistance-semantic-adjudication-record.v2';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_CORPUS_SCHEMA_V2 =
  'machinespirits.tutor-stub.resistance-semantic-adjudication-corpus.v2';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V2 = 'prospective_frame_resistance_semantic_v2';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_DEVELOPMENT_EVIDENCE_SCHEMA_V2 =
  'machinespirits.tutor-stub.resistance-semantic-development-evidence.v2';

const TRISTATE = ['yes', 'no', 'indeterminate'];
const TARGETS = ['none', 'tutor_standing', 'inquiry_frame', 'premise', 'question', 'test_or_criterion', 'other'];
const JURISDICTION_TYPES = ['none', 'authority', 'standing', 'right', 'frame_governance', 'other'];
const FINAL_LABELS = ['frame_refuser', 'frame_defiant_or_productive_dispute', 'neither', 'indeterminate'];
const CONFIDENCE = ['high', 'medium', 'low'];
const INDETERMINACY_REASONS = [
  'none',
  'semantic_ambiguity',
  'insufficient_public_context',
  'mixed_pragmatic_force',
  'other',
];
const EVIDENCE_FIELDS = [
  'jurisdiction_dispute',
  'jurisdiction_target',
  'licensed_participation',
  'participation_withholding',
  'productive_counterframing',
];
const MODEL_JUDGMENT_KEYS = [
  'jurisdiction_dispute',
  'jurisdiction_target',
  'jurisdiction_type',
  'licensed_participation',
  'participation_withholding',
  'productive_counterframing',
  'final_label',
  'evidence_quotes',
  'confidence',
  'indeterminacy_reason',
];
const RECORD_JUDGMENT_KEYS = MODEL_JUDGMENT_KEYS.map((key) => (key === 'evidence_quotes' ? 'evidence_spans' : key));
const QUOTE_KEYS = ['field', 'source_id', 'quote'];
const SPAN_KEYS = ['field', 'source_id', 'start_utf16', 'end_utf16', 'text'];
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

export const TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V2 = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['schema', 'case_id', 'judgment'],
  properties: {
    schema: { type: 'string', enum: [TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V2] },
    case_id: { type: 'string', minLength: 1 },
    judgment: {
      type: 'object',
      additionalProperties: false,
      required: MODEL_JUDGMENT_KEYS,
      properties: {
        jurisdiction_dispute: { type: 'string', enum: TRISTATE },
        jurisdiction_target: { type: 'string', enum: TARGETS },
        jurisdiction_type: { type: 'string', enum: JURISDICTION_TYPES },
        licensed_participation: { type: 'string', enum: TRISTATE },
        participation_withholding: { type: 'string', enum: TRISTATE },
        productive_counterframing: { type: 'string', enum: TRISTATE },
        final_label: { type: 'string', enum: FINAL_LABELS },
        evidence_quotes: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: QUOTE_KEYS,
            properties: {
              field: { type: 'string', enum: EVIDENCE_FIELDS },
              source_id: { type: 'string', pattern: '^(utterance|context:[0-9]+)$' },
              quote: { type: 'string', minLength: 1 },
            },
          },
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

export function buildTutorStubResistanceSemanticAdjudicationPromptV2({ caseId, source, publicContext, judge }) {
  if (!String(caseId || '').trim()) throw new Error('semantic adjudication prompt requires caseId');
  validatePublicInput(source, publicContext);
  if (!judge?.id || !judge?.modelRef || judge.effort !== 'low') {
    throw new Error('semantic adjudication prompt requires one registered low-effort judge');
  }
  const context = publicContext.map((row) => ({ role: row.role, text: row.text }));
  const packet = { case_id: caseId, public_context: context, utterance: source };
  return {
    schema: 'machinespirits.tutor-stub.resistance-semantic-adjudication-prompt.v2',
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
      'licensed_participation=yes only when the learner actually undertakes or presently commits to a specific evidence-facing inquiry step. Hypothetical, counterfactual, conditional-only, or generic willingness does not establish actual participation.',
      'jurisdiction_dispute=yes only when the learner disputes authority, standing, right, or frame governance over what inquiry, question, premise, test, or criterion governs. A merits disagreement, factual objection, procedural defect, administrative instruction, staffing issue, schedule issue, or recordkeeping dispute is not by itself jurisdictional.',
      'productive_counterframing=yes requires a concrete alternative inquiry, question, test, criterion, or evidence-facing step that the learner actually accepts or undertakes. Generic willingness, an invitation to negotiate, or bare narrower-frame language without a concrete alternative inquiry is insufficient.',
      'frame_refuser requires jurisdiction_dispute=yes, participation_withholding=yes, licensed_participation=no, and productive_counterframing=no.',
      'frame_defiant_or_productive_dispute requires jurisdiction_dispute=yes, licensed_participation=yes, and productive_counterframing=yes; it may still withhold the imposed frame while accepting a concrete alternative inquiry.',
      'For every yes field and for the target of a jurisdiction dispute, copy an exact nonempty quote and identify its source. Do not calculate or return numeric offsets. The deterministic wrapper will accept only a quote that occurs exactly once in the declared source and will stamp UTF-16 offsets.',
      'Use indeterminate when public meaning is unresolved; never guess. Return confidence high only for a determinate judgment.',
      `Return only JSON conforming exactly to ${TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V2}.`,
    ],
    public_context: context,
    utterance: { text: source },
    packet_sha256: canonicalSha256(packet),
  };
}

function uniqueQuoteSpan(text, evidence, index) {
  if (!exactKeys(evidence, QUOTE_KEYS)) throw new Error(`evidence quote ${index} keys are not exact`);
  if (!EVIDENCE_FIELDS.includes(evidence.field)) throw new Error(`evidence quote ${index} field is invalid`);
  if (!String(evidence.quote || '')) throw new Error(`evidence quote ${index} is empty`);
  const start = text.indexOf(evidence.quote);
  if (start < 0) throw new Error(`evidence quote ${index} is absent from declared source`);
  if (text.indexOf(evidence.quote, start + 1) >= 0) {
    throw new Error(`evidence quote ${index} is ambiguous in declared source`);
  }
  return {
    field: evidence.field,
    source_id: evidence.source_id,
    start_utf16: start,
    end_utf16: start + evidence.quote.length,
    text: evidence.quote,
  };
}

function normalizeEvidenceQuotes(modelOutput, prompt) {
  const judgment = modelOutput?.judgment;
  if (!exactKeys(judgment, MODEL_JUDGMENT_KEYS)) throw new Error('semantic judge judgment keys are not exact');
  if (!Array.isArray(judgment.evidence_quotes)) throw new Error('evidence_quotes must be an array');
  const sources = sourceMap(prompt.utterance.text, prompt.public_context);
  const evidenceSpans = judgment.evidence_quotes.map((evidence, index) => {
    const text = sources[evidence?.source_id];
    if (text === undefined) throw new Error(`evidence quote ${index} source is invalid`);
    return uniqueQuoteSpan(text, evidence, index);
  });
  return Object.fromEntries(
    RECORD_JUDGMENT_KEYS.map((key) => [key, key === 'evidence_spans' ? evidenceSpans : judgment[key]]),
  );
}

export function wrapTutorStubResistanceSemanticModelOutputV2({
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
  if (modelOutput.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V2) {
    throw new Error('semantic judge model output schema mismatch');
  }
  if (modelOutput.case_id !== prompt.case_id) throw new Error('semantic judge case id mismatch');
  return {
    schema: TUTOR_STUB_RESISTANCE_SEMANTIC_RECORD_SCHEMA_V2,
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

function toV1Response(response) {
  return response ? { ...response, schema: V1_RECORD_SCHEMA } : response;
}

export function validateTutorStubResistanceSemanticResponseV2(args) {
  const issues = [];
  if (!exactKeys(args.response, ['schema', 'case_id', 'provenance', 'judgment'])) {
    issues.push('response keys are not exact');
  }
  if (args.response?.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_RECORD_SCHEMA_V2) {
    issues.push('unsupported stored v2 record schema');
  }
  if (!exactKeys(args.response?.provenance, PROVENANCE_KEYS)) issues.push('provenance keys are not exact');
  if (!exactKeys(args.response?.judgment, RECORD_JUDGMENT_KEYS)) issues.push('judgment keys are not exact');
  for (const [index, span] of (Array.isArray(args.response?.judgment?.evidence_spans)
    ? args.response.judgment.evidence_spans
    : []
  ).entries()) {
    if (!exactKeys(span, SPAN_KEYS)) issues.push(`evidence span ${index} keys are not exact`);
  }
  const legacy = validateV1Response({ ...args, response: toV1Response(args.response) });
  return { valid: issues.length === 0 && legacy.valid, issues: [...issues, ...legacy.issues] };
}

export function adjudicateTutorStubResistanceSemanticJudgesV2(args) {
  const responses = Array.isArray(args.responses) ? args.responses : [];
  const v2Validation = (args.registration?.measurement?.judges || []).map((judge) => {
    const response = responses.find((candidate) => candidate?.provenance?.judge_id === judge.id);
    return {
      judge_id: judge.id,
      ...validateTutorStubResistanceSemanticResponseV2({
        source: args.source,
        publicContext: args.publicContext,
        caseId: args.caseId,
        response,
        registration: args.registration,
        prompt: args.prompts?.[judge.id],
      }),
    };
  });
  const result = adjudicateV1Judges({
    ...args,
    responses: responses.map(toV1Response),
  });
  if (v2Validation.every((row) => row.valid)) return { ...result, validation: v2Validation };
  return {
    ...result,
    status: 'measurement_indeterminate',
    reasons: [...new Set([...result.reasons, 'invalid_schema_span_or_provenance'])],
    judgment: null,
    final_label: 'indeterminate',
    validation: v2Validation,
  };
}

function exactQuote(corpusCase, evidence) {
  const texts = sourceMap(corpusCase.source, corpusCase.public_context);
  const text = texts[evidence.source_id];
  uniqueQuoteSpan(text, { field: evidence.field, source_id: evidence.source_id, quote: evidence.text }, 0);
  return { field: evidence.field, source_id: evidence.source_id, quote: evidence.text };
}

// Test/preflight fixture helper only. Live execution must parse independent model outputs.
export function buildTutorStubResistanceSemanticZeroCallFixtureResponseV2({ corpusCase, judge }) {
  const prompt = buildTutorStubResistanceSemanticAdjudicationPromptV2({
    caseId: corpusCase.case_id,
    source: corpusCase.source,
    publicContext: corpusCase.public_context,
    judge,
  });
  const modelOutput = {
    schema: TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V2,
    case_id: corpusCase.case_id,
    judgment: {
      ...corpusCase.expected.judgment,
      evidence_quotes: corpusCase.expected.evidence.map((evidence) => exactQuote(corpusCase, evidence)),
      confidence: 'high',
      indeterminacy_reason: 'none',
    },
  };
  return {
    prompt,
    modelOutput,
    response: wrapTutorStubResistanceSemanticModelOutputV2({
      modelOutput,
      prompt,
      judge,
      observedProvider: judge.provider,
      observedModel: judge.model,
      observedEffort: judge.effort,
      independentRunId: `zero-call-v2-${judge.id}-${corpusCase.case_id}`,
      structuredOutput: true,
      prohibitedToolEvents: 0,
      modelAttestationBasis: judge.modelAttestationBasis,
      modelIndependentlyAttested: false,
    }),
  };
}

export function scoreTutorStubResistanceSemanticCorpusV2({ corpus, responsePairs, registration }) {
  const pairs = Object.fromEntries(
    corpus.cases.map((corpusCase) => {
      const pair = responsePairs[corpusCase.case_id] || {};
      return [
        corpusCase.case_id,
        Object.fromEntries(
          Object.entries(pair).map(([judgeId, fixture]) => {
            const valid = validateTutorStubResistanceSemanticResponseV2({
              source: corpusCase.source,
              publicContext: corpusCase.public_context,
              caseId: corpusCase.case_id,
              response: fixture.response,
              registration,
              prompt: fixture.prompt,
            }).valid;
            return [judgeId, { ...fixture, response: valid ? toV1Response(fixture.response) : undefined }];
          }),
        ),
      ];
    }),
  );
  return scoreV1Corpus({
    corpus: { ...corpus, schema: V1_CORPUS_SCHEMA },
    responsePairs: pairs,
    registration,
  });
}

export function validateTutorStubResistanceSemanticCorpusV2(corpus) {
  const issues = [];
  if (corpus?.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_CORPUS_SCHEMA_V2) {
    issues.push('unsupported v2 corpus schema');
  }
  const legacy = validateV1Corpus({ ...corpus, schema: V1_CORPUS_SCHEMA });
  return { valid: issues.length === 0 && legacy.valid, issues: [...issues, ...legacy.issues] };
}

export function validateTutorStubResistanceSemanticDevelopmentEvidenceV2(manifest) {
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
      'v2_heldout_reuse_allowed',
      'post_v1_result_tuning_scope',
    ])
  ) {
    issues.push('development evidence manifest keys are not exact');
  }
  if (
    manifest?.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_DEVELOPMENT_EVIDENCE_SCHEMA_V2 ||
    manifest?.version !== 2 ||
    manifest?.role !== 'development_regression_disclosed_post_validation' ||
    manifest?.frozen !== true ||
    manifest?.prompt_examples_allowed !== false ||
    manifest?.v2_heldout_reuse_allowed !== false ||
    manifest?.post_v1_result_tuning_scope !== 'schema_and_predeclared_codebook_defect_repair_only'
  ) {
    issues.push('development evidence manifest boundary drifted');
  }
  if (!Array.isArray(manifest?.inputs) || manifest.inputs.length !== 2) {
    issues.push('development evidence requires exactly two frozen v1 inputs');
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
  ];
  if (JSON.stringify(manifest?.inputs) !== JSON.stringify(expectedInputs)) {
    issues.push('development evidence inputs drifted');
  }
  if (manifest?.total_cases !== 96) issues.push('development evidence case total drifted');
  return { valid: issues.length === 0, issues };
}

export function validateTutorStubResistanceSemanticRegistrationV2(registration) {
  const issues = [];
  if (
    registration?.schema !== 'machinespirits.tutor-stub.resistance-semantic-adjudication-registration.v2' ||
    registration?.version !== 2 ||
    ![
      'development_instrument_freeze_candidate_pending_independent_v2_heldout',
      'development_instrument_frozen_pending_independent_v2_heldout_validation',
    ].includes(registration?.status)
  ) {
    issues.push('v2 registration identity drifted');
  }
  if (
    registration?.observationSemantics !== TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V2 ||
    registration?.supersession?.v1InstrumentEligibleForFutureValidationOrLaunch !== false ||
    registration?.supersession?.v1HeldoutEligibleForV2Heldout !== false ||
    registration?.supersession?.v1FailedValidationReportSha256 !==
      '008230526809a6aa2917b240c6a30af644f30184b89042825773b1b8040c5c74' ||
    registration?.instrument?.modelEvidenceShape !== 'field_source_id_exact_quote_no_numeric_offsets' ||
    registration?.instrument?.wrapperOffsetDerivation !== 'unique_exact_quote_utf16_code_unit' ||
    registration?.instrument?.ambiguousOrAbsentQuoteDisposition !== 'invalid_measurement_indeterminate'
  ) {
    issues.push('v2 supersession or quote-normalization boundary drifted');
  }
  const codebook = registration?.instrument?.codebookBoundaries;
  if (
    codebook?.actualParticipation !== 'presently_performed_or_committed_specific_evidence_facing_inquiry_step' ||
    codebook?.hypotheticalParticipation !== 'does_not_count_as_licensed_participation' ||
    codebook?.jurisdictionalDispute !== 'authority_standing_right_or_frame_governance_over_the_inquiry' ||
    codebook?.meritsProceduralOrAdministrativeDisagreement !== 'does_not_count_without_a_jurisdictional_challenge' ||
    codebook?.productiveCounterframing !==
      'requires_a_concrete_alternative_inquiry_question_test_criterion_or_evidence_step' ||
    codebook?.genericWillingness !== 'does_not_count_as_productive_counterframing'
  ) {
    issues.push('v2 codebook boundary drifted');
  }
  const heldout = registration?.heldoutFreezeProtocol || {};
  const heldoutContract = {
    requiredRole: 'heldout_blinded',
    requiredSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_CORPUS_SCHEMA_V2,
    exactCases: 80,
    minimumCases: 80,
    exactPositiveCases: 40,
    minimumPositiveCases: 40,
    exactNeitherCases: 24,
    minimumNegativeCases: 40,
    exactProductiveDisputeCases: 16,
    minimumProductiveDisputeCases: 16,
    minimumActualParticipationCases: 20,
    minimumHypotheticalOrConditionalParticipationCases: 12,
    minimumMeritsProceduralOrAdministrativeNonjurisdictionCases: 16,
    minimumConcreteProductiveCounterframes: 16,
    uniqueSourceUtterances: 80,
    duplicateHeldoutContextMessagesAllowed: false,
    developmentCaseIdSourceOrContextCollisionAllowed: false,
    v1ObservedCaseIdSourceOrContextCollisionAllowed: false,
    authoredByIndependentAgentAfterInstrumentFreezeCommit: true,
    heldoutTextOrGoldVisibleToPromptBuilderBeforeFreeze: false,
    postHeldoutPromptModelThresholdOrConsensusTuning: false,
    futureValidationRequestRequired: true,
    validationCallsAuthorized: false,
  };
  if (JSON.stringify(heldout) !== JSON.stringify(heldoutContract)) issues.push('v2 heldout contract drifted');
  const budget = registration?.prospectiveValidationBudget;
  if (
    budget?.programmeLedgerBeforeV2Validation !== 491 ||
    budget?.heldoutCases !== 80 ||
    budget?.independentJudgesPerCase !== 2 ||
    budget?.plannedCalls !== 160 ||
    budget?.maximumChargedReservationsPerPlannedCall !== 3 ||
    budget?.hardValidationReservations !== 480 ||
    budget?.programmeMaximumAfterV2Validation !== 971 ||
    budget?.programmeCeiling !== 5000 ||
    budget?.v2ValidationCallsAuthorized !== false
  ) {
    issues.push('v2 validation budget drifted');
  }
  if (
    registration?.laterProgrammeBoundary?.prospectiveMaximumIfBothLaterStagesProceed !== 5147 ||
    registration?.laterProgrammeBoundary?.currentProgrammeCeiling !== 5000 ||
    registration?.laterProgrammeBoundary?.ceilingAmendmentRequiredBeforeLaterStages !== true ||
    registration?.laterProgrammeBoundary?.laterValidationOrConfirmationCallsAuthorized !== false
  ) {
    issues.push('later programme ceiling boundary drifted');
  }
  const legacy = validateV1Registration(registration);
  return { valid: issues.length === 0 && legacy.valid, issues: [...issues, ...legacy.issues] };
}

export default {
  adjudicateTutorStubResistanceSemanticJudgesV2,
  buildTutorStubResistanceSemanticAdjudicationPromptV2,
  buildTutorStubResistanceSemanticZeroCallFixtureResponseV2,
  scoreTutorStubResistanceSemanticCorpusV2,
  validateTutorStubResistanceSemanticCorpusV2,
  validateTutorStubResistanceSemanticDevelopmentEvidenceV2,
  validateTutorStubResistanceSemanticRegistrationV2,
  validateTutorStubResistanceSemanticResponseV2,
  wrapTutorStubResistanceSemanticModelOutputV2,
};
