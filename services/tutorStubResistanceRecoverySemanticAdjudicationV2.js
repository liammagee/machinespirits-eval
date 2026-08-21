import crypto from 'node:crypto';

export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_MODEL_SCHEMA =
  'machinespirits.tutor-stub.resistance-recovery-semantic-judge-response.v2';
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_RECORD_SCHEMA =
  'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-record.v2';
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_CORPUS_SCHEMA =
  'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-corpus.v2';

const TRISTATE = ['yes', 'no', 'indeterminate'];
const RECOVERY = ['yes', 'no', 'indeterminate'];
const DELIVERED_REGISTER = ['warm', 'plain', 'neither', 'indeterminate'];
const CONFIDENCE = ['high', 'medium', 'low'];
const INDETERMINACY = ['none', 'semantic_ambiguity', 'insufficient_public_context', 'mixed_pragmatic_force', 'other'];
const SEMANTIC_FIELDS = [
  'bounded_test_merits_engagement',
  'grounded_precise_jurisdictional_condition',
  'delivered_clarify_distinction',
  'delivered_register',
];
const RECOVERY_FIELDS = ['bounded_test_merits_engagement', 'grounded_precise_jurisdictional_condition'];
const SOURCE_IDS = ['trigger', 'intervention', 'prior_post_trigger', 'intervening_tutor', 'current_learner'];
const JUDGMENT_KEYS = [...SEMANTIC_FIELDS, 'final_recovery', 'evidence_spans', 'confidence', 'indeterminacy_reason'];
const SPAN_KEYS = ['field', 'source_id', 'start_utf16', 'end_utf16', 'text'];
const PROVENANCE_KEYS = [
  'judge_id',
  'model_ref',
  'provider',
  'model',
  'effort',
  'independent_run_id',
  'packet_sha256',
  'prompt_sha256',
  'structured_output',
  'prohibited_tool_events',
  'model_attestation_basis',
  'model_independently_attested',
];

export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['schema', 'case_id', 'judgment'],
  properties: {
    schema: { type: 'string', enum: [TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_MODEL_SCHEMA] },
    case_id: { type: 'string', minLength: 1 },
    judgment: {
      type: 'object',
      additionalProperties: false,
      required: JUDGMENT_KEYS,
      properties: {
        bounded_test_merits_engagement: { type: 'string', enum: TRISTATE },
        grounded_precise_jurisdictional_condition: { type: 'string', enum: TRISTATE },
        delivered_clarify_distinction: { type: 'string', enum: TRISTATE },
        delivered_register: { type: 'string', enum: DELIVERED_REGISTER },
        final_recovery: { type: 'string', enum: RECOVERY },
        evidence_spans: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: SPAN_KEYS,
            properties: {
              field: { type: 'string', enum: SEMANTIC_FIELDS },
              source_id: { type: 'string', enum: SOURCE_IDS },
              start_utf16: { type: 'integer', minimum: 0 },
              end_utf16: { type: 'integer', minimum: 1 },
              text: { type: 'string', minLength: 1 },
            },
          },
        },
        confidence: { type: 'string', enum: CONFIDENCE },
        indeterminacy_reason: { type: 'string', enum: INDETERMINACY },
      },
    },
  },
});

export function tutorStubResistanceRecoverySemanticSha256(value) {
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
  return tutorStubResistanceRecoverySemanticSha256(JSON.stringify(canonicalJson(value)));
}

export function tutorStubResistanceRecoverySemanticPromptSha256(prompt) {
  return canonicalSha256(prompt);
}

function publicSources(packet) {
  return {
    trigger: packet.trigger,
    intervention: packet.intervention,
    prior_post_trigger: packet.prior_post_trigger,
    intervening_tutor: packet.intervening_tutor,
    current_learner: packet.current_learner,
  };
}

function validatePublicPacket(packet) {
  if (!exactKeys(packet, SOURCE_IDS)) throw new Error('recovery semantic public packet keys are not exact');
  for (const sourceId of SOURCE_IDS) {
    if (!String(packet[sourceId] || '').trim()) {
      throw new Error(`recovery semantic public packet requires ${sourceId}`);
    }
  }
  return packet;
}

export function buildTutorStubResistanceRecoverySemanticPrompt({ caseId, publicPacket, judge }) {
  if (!String(caseId || '').trim()) throw new Error('recovery semantic prompt requires caseId');
  validatePublicPacket(publicPacket);
  if (!judge?.id || !judge?.modelRef || judge.effort !== 'low') {
    throw new Error('recovery semantic prompt requires one registered low-effort judge');
  }
  const packet = structuredClone(publicPacket);
  return {
    schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-prompt.v2',
    case_id: caseId,
    judge: { id: judge.id, model_ref: judge.modelRef, effort: judge.effort },
    independence: {
      other_judge_output_visible: false,
      consensus_visible: false,
      gold_visible: false,
      development_examples_visible: false,
      arm_register_assignment_visible: false,
      profile_observer_classifier_regex_hidden_dag_visible: false,
      outcome_status_visible: false,
    },
    instructions: [
      'Judge the dialogue-level recovery endpoint over the complete fixed two-post-trigger-turn public horizon supplied in one packet.',
      'bounded_test_merits_engagement=yes only when the learner engages the bounded public test on its merits; mere assent, generic engagement, off-topic merits, or continued blanket withholding is not enough.',
      'grounded_precise_jurisdictional_condition=yes only when the learner replaces blanket refusal with a precise, publicly grounded condition on jurisdiction or participation; an ungrounded counterframe or generic authority challenge is not enough.',
      'delivered_clarify_distinction=yes only when the public intervention actually performs a bounded distinction, not merely because it contains test or distinction vocabulary.',
      'Code delivered_register from the public intervention as warm, plain, neither, or indeterminate. Generic politeness or isolated warmth words do not establish a warm engagement stance; precision does not by itself establish plainness.',
      'final_recovery=yes iff either registered construct is yes. If either core construct is indeterminate, final_recovery must be indeterminate; otherwise it is no only when both are no.',
      'Consider compositional meaning, pragmatic force, anaphora, and the relationship among trigger, intervention, first post-trigger learner turn, the intervening public tutor turn, and the final learner-only turn.',
      'No keyword, regex, learner classifier, Luna analysis, or hidden DAG output is authoritative or visible.',
      'Anchor every yes construct to an exact copied UTF-16 span. Use high confidence only for a determinate judgment.',
      `Return only JSON conforming exactly to ${TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_MODEL_SCHEMA}.`,
    ],
    public_packet: packet,
    packet_sha256: canonicalSha256(packet),
  };
}

function expectedRecovery(judgment) {
  if (RECOVERY_FIELDS.some((field) => judgment[field] === 'indeterminate')) return 'indeterminate';
  return RECOVERY_FIELDS.some((field) => judgment[field] === 'yes') ? 'yes' : 'no';
}

function registeredJudge(registration, judgeId) {
  return registration?.measurement?.judges?.find((judge) => judge.id === judgeId) || null;
}

export function validateTutorStubResistanceRecoverySemanticResponse({
  caseId,
  publicPacket,
  response,
  registration,
  prompt,
}) {
  const issues = [];
  try {
    validatePublicPacket(publicPacket);
  } catch (error) {
    issues.push(error.message);
  }
  if (!exactKeys(response, ['schema', 'case_id', 'provenance', 'judgment'])) {
    issues.push('response keys are not exact');
  }
  if (response?.schema !== TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_RECORD_SCHEMA) {
    issues.push('stored response schema drifted');
  }
  if (response?.case_id !== caseId) issues.push('case id mismatch');
  if (!exactKeys(response?.provenance, PROVENANCE_KEYS)) issues.push('provenance keys are not exact');
  if (!exactKeys(response?.judgment, JUDGMENT_KEYS)) issues.push('judgment keys are not exact');
  const judge = registeredJudge(registration, response?.provenance?.judge_id);
  if (!judge) issues.push('judge is not registered');
  if (
    judge &&
    (response.provenance.model_ref !== judge.modelRef ||
      response.provenance.provider !== judge.provider ||
      response.provenance.model !== judge.model ||
      response.provenance.effort !== judge.effort ||
      response.provenance.model_attestation_basis !== judge.modelAttestationBasis)
  ) {
    issues.push('observed judge route, effort, or attestation drifted');
  }
  if (!String(response?.provenance?.independent_run_id || '').trim()) issues.push('independent run id is missing');
  if (response?.provenance?.structured_output !== true) issues.push('structured output was not observed');
  if (response?.provenance?.prohibited_tool_events !== 0) issues.push('prohibited tool count must be observed zero');
  if (response?.provenance?.model_independently_attested !== false) {
    issues.push('unexpected independent model attestation');
  }
  if (prompt && response?.provenance?.packet_sha256 !== prompt.packet_sha256) {
    issues.push('public packet digest mismatch');
  }
  if (prompt && response?.provenance?.prompt_sha256 !== tutorStubResistanceRecoverySemanticPromptSha256(prompt)) {
    issues.push('prompt digest mismatch');
  }
  const judgment = response?.judgment || {};
  for (const field of RECOVERY_FIELDS.concat('delivered_clarify_distinction')) {
    if (!TRISTATE.includes(judgment[field])) issues.push(`${field} is invalid`);
  }
  if (!DELIVERED_REGISTER.includes(judgment.delivered_register)) issues.push('delivered_register is invalid');
  if (!RECOVERY.includes(judgment.final_recovery)) issues.push('final_recovery is invalid');
  if (judgment.final_recovery !== expectedRecovery(judgment)) {
    issues.push('final_recovery contradicts the registered endpoint vector');
  }
  if (!CONFIDENCE.includes(judgment.confidence)) issues.push('confidence is invalid');
  if (!INDETERMINACY.includes(judgment.indeterminacy_reason)) issues.push('indeterminacy reason is invalid');
  const judgmentIndeterminate =
    SEMANTIC_FIELDS.some((field) => judgment[field] === 'indeterminate') ||
    judgment.delivered_register === 'indeterminate';
  if (judgmentIndeterminate) {
    if (judgment.indeterminacy_reason === 'none') issues.push('indeterminate response requires a reason');
    if (judgment.confidence === 'high') issues.push('indeterminate response cannot claim high confidence');
  } else if (judgment.indeterminacy_reason !== 'none') {
    issues.push('determinate response must use reason none');
  }
  const sources = publicSources(publicPacket);
  const spans = judgment.evidence_spans;
  if (!Array.isArray(spans)) issues.push('evidence_spans must be an array');
  const seen = new Set();
  for (const [index, span] of (Array.isArray(spans) ? spans : []).entries()) {
    if (!exactKeys(span, SPAN_KEYS)) issues.push(`evidence span ${index} keys are not exact`);
    if (!SEMANTIC_FIELDS.includes(span?.field)) issues.push(`evidence span ${index} field is invalid`);
    if (!SOURCE_IDS.includes(span?.source_id)) issues.push(`evidence span ${index} source is invalid`);
    const text = sources[span?.source_id];
    if (
      ['delivered_clarify_distinction', 'delivered_register'].includes(span?.field) &&
      span?.source_id !== 'intervention'
    ) {
      issues.push(`evidence span ${index} intervention classification must cite the intervention`);
    }
    if (RECOVERY_FIELDS.includes(span?.field) && !['prior_post_trigger', 'current_learner'].includes(span?.source_id)) {
      issues.push(`evidence span ${index} recovery classification must cite a post-trigger learner turn`);
    }
    if (
      !Number.isInteger(span?.start_utf16) ||
      !Number.isInteger(span?.end_utf16) ||
      span.start_utf16 < 0 ||
      span.end_utf16 <= span.start_utf16 ||
      span.end_utf16 > String(text || '').length ||
      String(text || '').slice(span.start_utf16, span.end_utf16) !== span.text
    ) {
      issues.push(`evidence span ${index} is not an exact UTF-16 source span`);
    }
    const identity = `${span?.field}:${span?.source_id}:${span?.start_utf16}:${span?.end_utf16}`;
    if (seen.has(identity)) issues.push(`evidence span ${index} is duplicated`);
    seen.add(identity);
  }
  const spanFields = new Set((Array.isArray(spans) ? spans : []).map((span) => span.field));
  for (const field of SEMANTIC_FIELDS) {
    if ((judgment[field] === 'yes' || ['warm', 'plain'].includes(judgment[field])) && !spanFields.has(field)) {
      issues.push(`${field} requires exact-span evidence`);
    }
  }
  return { valid: issues.length === 0, issues };
}

export function wrapTutorStubResistanceRecoverySemanticModelOutput({
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
    throw new Error('recovery semantic model output keys are not exact');
  }
  if (modelOutput.schema !== TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_MODEL_SCHEMA) {
    throw new Error('recovery semantic model output schema drifted');
  }
  return {
    schema: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_RECORD_SCHEMA,
    case_id: modelOutput.case_id,
    provenance: {
      judge_id: judge.id,
      model_ref: judge.modelRef,
      provider: observedProvider,
      model: observedModel,
      effort: observedEffort,
      independent_run_id: independentRunId,
      packet_sha256: prompt.packet_sha256,
      prompt_sha256: tutorStubResistanceRecoverySemanticPromptSha256(prompt),
      structured_output: structuredOutput,
      prohibited_tool_events: prohibitedToolEvents,
      model_attestation_basis: modelAttestationBasis,
      model_independently_attested: modelIndependentlyAttested,
    },
    judgment: modelOutput.judgment,
  };
}

function vector(judgment) {
  return JSON.stringify([...SEMANTIC_FIELDS.map((field) => judgment?.[field]), judgment?.final_recovery]);
}

export function adjudicateTutorStubResistanceRecoverySemanticJudges({
  caseId,
  publicPacket,
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
  const issues = [];
  if (supplied.length !== 2) issues.push('exactly_two_responses_required');
  if (new Set(ids).size !== supplied.length || ids.some((id) => !judges.some((judge) => judge.id === id))) {
    issues.push('duplicate_or_unregistered_judge');
  }
  if (new Set(runs).size !== supplied.length) issues.push('judge_runs_not_independent');
  if (new Set(promptHashes).size !== supplied.length) issues.push('judge_prompts_not_independent');
  const byJudge = new Map(supplied.map((response) => [response?.provenance?.judge_id, response]));
  const validations = judges.map((judge) => {
    const response = byJudge.get(judge.id);
    return {
      judge_id: judge.id,
      response,
      ...validateTutorStubResistanceRecoverySemanticResponse({
        caseId,
        publicPacket,
        response,
        registration,
        prompt: prompts?.[judge.id],
      }),
    };
  });
  if (validations.some((row) => !row.response || !row.valid)) issues.push('invalid_schema_span_or_provenance');
  if (validations.some((row) => row.response?.judgment?.confidence !== 'high')) issues.push('confidence_not_high');
  if (validations.some((row) => row.response?.judgment?.final_recovery === 'indeterminate')) {
    issues.push('judge_indeterminate');
  }
  if (
    validations.some(
      (row) =>
        row.response?.judgment?.delivered_clarify_distinction === 'indeterminate' ||
        row.response?.judgment?.delivered_register === 'indeterminate',
    )
  ) {
    issues.push('judge_indeterminate');
  }
  if (new Set(validations.filter((row) => row.response).map((row) => vector(row.response.judgment))).size !== 1) {
    issues.push('judge_disagreement');
  }
  const boundary = {
    advisory_signals: advisorySignals,
    judge_rerun_allowed: false,
    unit_rerun_allowed: false,
    replacement_allowed: false,
    outcome_selection_allowed: false,
    fisher_analysis_allowed: false,
  };
  if (issues.length) {
    return {
      case_id: caseId,
      status: 'measurement_indeterminate',
      reasons: [...new Set(issues)],
      judgment: null,
      final_recovery: 'indeterminate',
      ...boundary,
      validation: validations.map(({ judge_id, valid, issues: responseIssues }) => ({
        judge_id,
        valid,
        issues: responseIssues,
      })),
    };
  }
  const judgment = Object.fromEntries(
    [...SEMANTIC_FIELDS, 'final_recovery'].map((field) => [field, validations[0].response.judgment[field]]),
  );
  return {
    case_id: caseId,
    status: 'determinate',
    reasons: [],
    judgment,
    final_recovery: judgment.final_recovery,
    judge_evidence: validations.map((row) => ({
      judge_id: row.judge_id,
      evidence_spans: row.response.judgment.evidence_spans,
      confidence: row.response.judgment.confidence,
    })),
    ...boundary,
    fisher_analysis_allowed: true,
    validation: validations.map(({ judge_id, valid, issues: responseIssues }) => ({
      judge_id,
      valid,
      issues: responseIssues,
    })),
  };
}

export function validateTutorStubResistanceRecoverySemanticRegistration(registration) {
  const issues = [];
  if (
    registration?.schema !== 'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-registration.v2' ||
    registration?.version !== 2 ||
    ![
      'development_instrument_freeze_candidate_pending_independent_v2_heldout',
      'development_instrument_frozen_pending_independent_v2_heldout_validation',
    ].includes(registration?.status)
  ) {
    issues.push('corrected v2 registration identity drifted');
  }
  if (
    registration?.supersession?.supersededV1EligibleForValidationOrLaunch !== false ||
    registration?.supersession?.supersededHeldoutEligibleForV2Validation !== false ||
    registration?.supersession?.supersededHeldoutSha256 !==
      '3c394eae7c7902fce4d6634231cc070d7b32419bd4be44d752627cbd6e35784b' ||
    JSON.stringify(registration?.instrument?.publicPacketSources) !== JSON.stringify(SOURCE_IDS)
  ) {
    issues.push('corrected five-source supersession boundary drifted');
  }
  const judges = registration?.measurement?.judges || [];
  if (judges.length !== 2 || new Set(judges.map((judge) => judge.id)).size !== 2) {
    issues.push('exactly two unique recovery semantic judges are required');
  }
  if (new Set(judges.map((judge) => judge.provider)).size !== 2) issues.push('judge providers must differ');
  if (new Set(judges.map((judge) => judge.modelFamily)).size !== 2) issues.push('judge model families must differ');
  if (judges.some((judge) => judge.effort !== 'low' || judge.modelRef === 'codex.gpt-5.6-luna')) {
    issues.push('judges must be low effort and independent of Luna');
  }
  const expectedJudges = [
    {
      id: 'recovery_semantic_judge_a',
      modelRef: 'codex.gpt-5.6-sol',
      provider: 'codex',
      model: 'gpt-5.6-sol',
      modelFamily: 'openai_gpt_5_6',
    },
    {
      id: 'recovery_semantic_judge_b',
      modelRef: 'claude-code.sonnet-5',
      provider: 'claude-code',
      model: 'claude-sonnet-5',
      modelFamily: 'anthropic_claude_5',
    },
  ];
  if (
    expectedJudges.some((expected, index) =>
      Object.entries(expected).some(([key, value]) => judges[index]?.[key] !== value),
    ) ||
    judges.some(
      (judge) =>
        judge.independent !== true ||
        judge.modelAttestationBasis !== 'explicit_cli_model_argument_accepted_bridge_echo',
    )
  ) {
    issues.push('registered independent recovery judge routes drifted');
  }
  if (registration?.measurement?.deterministicAuthority !== 'schema_span_provenance_safety_only') {
    issues.push('deterministic authority drifted');
  }
  if (registration?.measurement?.lexicalAndLunaRole !== 'advisory_only_never_vote_tiebreak_veto_or_override') {
    issues.push('lexical or Luna role drifted');
  }
  const gates = registration?.measurement?.validationGates || {};
  const expectedGates = {
    schemaSpanProvenanceValidity: 1,
    minimumPerJudgeExactVectorAccuracy: 0.9,
    minimumConsensusExactVectorAccuracy: 0.95,
    minimumConsensusMeritsEngagementSensitivity: 0.95,
    minimumConsensusMeritsEngagementSpecificity: 0.95,
    minimumConsensusGroundedPrecisionSensitivity: 0.95,
    minimumConsensusGroundedPrecisionSpecificity: 0.95,
    minimumConsensusNoRecoverySpecificity: 0.95,
    minimumConsensusActionClassificationAccuracy: 0.95,
    minimumConsensusRegisterClassificationAccuracy: 0.95,
    minimumRawFullVectorInterjudgeAgreement: 0.9,
    minimumRecoveryCategoryCohenKappa: 0.8,
    minimumOverallDeterminedCoverage: 0.95,
    minimumPerStratumDeterminedCoverage: 0.9,
    maximumProhibitedToolEvents: 0,
    indeterminateAndInvalidCountAsErrors: true,
  };
  for (const [key, value] of Object.entries(expectedGates)) {
    if (gates[key] !== value) issues.push(`validation gate ${key} drifted`);
  }
  const heldout = registration?.heldoutFreezeProtocol || {};
  for (const [key, value] of Object.entries({
    minimumCases: 120,
    exactMeritsOnlyCases: 32,
    exactGroundedOnlyCases: 32,
    exactBothRecoveryConstructCases: 16,
    exactNoRecoveryCases: 40,
    minimumWarmInterventions: 40,
    minimumPlainInterventions: 40,
    minimumNeitherInterventions: 20,
    minimumActionPresentCases: 80,
    minimumActionAbsentCases: 20,
    minimumInterveningTutorAnaphoraCases: 24,
    minimumAnaphoraPositiveCases: 8,
    minimumAnaphoraNegativeCases: 8,
    postHeldoutPromptModelThresholdOrConsensusTuning: false,
  })) {
    if (heldout[key] !== value) issues.push(`heldout freeze field ${key} drifted`);
  }
  return { valid: issues.length === 0, issues };
}

export function validateTutorStubResistanceRecoverySemanticCorpus(corpus) {
  const issues = [];
  if (
    !exactKeys(corpus, [
      'schema',
      'version',
      'role',
      'frozen',
      'prompt_examples_allowed',
      'context_provenance',
      'cases',
    ])
  ) {
    issues.push('corpus keys are not exact');
  }
  if (corpus?.schema !== TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_CORPUS_SCHEMA || corpus?.version !== 2) {
    issues.push('corpus identity drifted');
  }
  if (!Array.isArray(corpus?.cases)) return { valid: false, issues: [...issues, 'cases must be an array'] };
  const ids = new Set();
  for (const [index, corpusCase] of corpus.cases.entries()) {
    if (!exactKeys(corpusCase, ['case_id', ...SOURCE_IDS, 'expected'])) issues.push(`case ${index} keys are not exact`);
    if (!String(corpusCase.case_id || '').trim() || ids.has(corpusCase.case_id))
      issues.push(`case ${index} id is invalid`);
    ids.add(corpusCase.case_id);
    try {
      validatePublicPacket(Object.fromEntries(SOURCE_IDS.map((field) => [field, corpusCase[field]])));
    } catch (error) {
      issues.push(`case ${index}: ${error.message}`);
    }
    if (!exactKeys(corpusCase.expected, ['judgment', 'evidence']))
      issues.push(`case ${index} expected keys are not exact`);
    const judgment = corpusCase.expected?.judgment || {};
    if (!exactKeys(judgment, SEMANTIC_FIELDS.concat('final_recovery'))) {
      issues.push(`case ${index} expected judgment keys are not exact`);
    }
    for (const field of RECOVERY_FIELDS.concat('delivered_clarify_distinction')) {
      if (!['yes', 'no'].includes(judgment[field])) issues.push(`case ${index} ${field} must be determinate`);
    }
    if (!['warm', 'plain', 'neither'].includes(judgment.delivered_register)) {
      issues.push(`case ${index} delivered_register must be determinate`);
    }
    if (judgment.final_recovery !== expectedRecovery(judgment))
      issues.push(`case ${index} recovery contradicts vector`);
    if (!Array.isArray(corpusCase.expected?.evidence)) {
      issues.push(`case ${index} evidence must be an array`);
      continue;
    }
    const seen = new Set();
    for (const evidence of corpusCase.expected.evidence) {
      if (!exactKeys(evidence, ['field', 'source_id', 'text']))
        issues.push(`case ${index} evidence keys are not exact`);
      if (!SEMANTIC_FIELDS.includes(evidence.field) || !SOURCE_IDS.includes(evidence.source_id)) {
        issues.push(`case ${index} evidence field or source is invalid`);
      }
      if (
        ['delivered_clarify_distinction', 'delivered_register'].includes(evidence.field) &&
        evidence.source_id !== 'intervention'
      ) {
        issues.push(`case ${index} intervention classification evidence must cite the intervention`);
      }
      if (
        RECOVERY_FIELDS.includes(evidence.field) &&
        !['prior_post_trigger', 'current_learner'].includes(evidence.source_id)
      ) {
        issues.push(`case ${index} recovery evidence must cite a post-trigger learner turn`);
      }
      const identity = `${evidence.field}:${evidence.source_id}:${evidence.text}`;
      if (seen.has(identity)) issues.push(`case ${index} evidence is duplicated`);
      seen.add(identity);
      const source = corpusCase[evidence.source_id];
      if (
        !evidence.text ||
        source.indexOf(evidence.text) < 0 ||
        source.indexOf(evidence.text, source.indexOf(evidence.text) + 1) >= 0
      ) {
        issues.push(`case ${index} evidence text must occur exactly once`);
      }
    }
    const evidenceFields = new Set(corpusCase.expected.evidence.map((row) => row.field));
    for (const field of SEMANTIC_FIELDS) {
      if ((judgment[field] === 'yes' || ['warm', 'plain'].includes(judgment[field])) && !evidenceFields.has(field)) {
        issues.push(`case ${index} ${field} lacks evidence`);
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

function exactSpan(corpusCase, evidence) {
  const source = corpusCase[evidence.source_id];
  const start = source.indexOf(evidence.text);
  if (start < 0 || source.indexOf(evidence.text, start + 1) >= 0) {
    throw new Error(`gold evidence must occur exactly once: ${evidence.text}`);
  }
  return {
    field: evidence.field,
    source_id: evidence.source_id,
    start_utf16: start,
    end_utf16: start + evidence.text.length,
    text: evidence.text,
  };
}

// Test/preflight fixture helper only. Never import this helper into a live runner.
export function buildTutorStubResistanceRecoverySemanticZeroCallFixture({ corpusCase, judge }) {
  const publicPacket = Object.fromEntries(SOURCE_IDS.map((field) => [field, corpusCase[field]]));
  const prompt = buildTutorStubResistanceRecoverySemanticPrompt({ caseId: corpusCase.case_id, publicPacket, judge });
  const modelOutput = {
    schema: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_MODEL_SCHEMA,
    case_id: corpusCase.case_id,
    judgment: {
      ...corpusCase.expected.judgment,
      evidence_spans: corpusCase.expected.evidence.map((row) => exactSpan(corpusCase, row)),
      confidence: 'high',
      indeterminacy_reason: 'none',
    },
  };
  const response = wrapTutorStubResistanceRecoverySemanticModelOutput({
    modelOutput,
    prompt,
    judge,
    observedProvider: judge.provider,
    observedModel: judge.model,
    observedEffort: judge.effort,
    independentRunId: `zero-call-${judge.id}-${corpusCase.case_id}`,
    structuredOutput: true,
    prohibitedToolEvents: 0,
    modelAttestationBasis: judge.modelAttestationBasis,
    modelIndependentlyAttested: false,
  });
  return { prompt, modelOutput, response };
}

function category(judgment) {
  if (!judgment || judgment.final_recovery === 'indeterminate') return 'indeterminate';
  if (
    judgment.bounded_test_merits_engagement === 'yes' &&
    judgment.grounded_precise_jurisdictional_condition === 'yes'
  ) {
    return 'both';
  }
  if (judgment.bounded_test_merits_engagement === 'yes') return 'merits';
  if (judgment.grounded_precise_jurisdictional_condition === 'yes') return 'grounded';
  return 'no_recovery';
}

function exactVector(judgment) {
  return judgment ? vector(judgment) : 'indeterminate';
}

function cohenKappa(left, right) {
  if (!left.length || left.length !== right.length) return 0;
  const agreement = left.filter((value, index) => value === right[index]).length / left.length;
  const labels = [...new Set([...left, ...right])];
  const expected = labels.reduce(
    (sum, label) =>
      sum +
      (left.filter((value) => value === label).length / left.length) *
        (right.filter((value) => value === label).length / right.length),
    0,
  );
  return expected === 1 ? (agreement === 1 ? 1 : 0) : (agreement - expected) / (1 - expected);
}

export function scoreTutorStubResistanceRecoverySemanticCorpus({ corpus, responsePairs, registration }) {
  const judges = registration.measurement.judges;
  const rows = corpus.cases.map((corpusCase) => {
    const publicPacket = Object.fromEntries(SOURCE_IDS.map((field) => [field, corpusCase[field]]));
    const pair = responsePairs[corpusCase.case_id] || {};
    const aggregate = adjudicateTutorStubResistanceRecoverySemanticJudges({
      caseId: corpusCase.case_id,
      publicPacket,
      responses: judges.map((judge) => pair[judge.id]?.response).filter(Boolean),
      registration,
      prompts: Object.fromEntries(
        judges.filter((judge) => pair[judge.id]).map((judge) => [judge.id, pair[judge.id].prompt]),
      ),
    });
    const labels = Object.fromEntries(
      judges.map((judge) => {
        const fixture = pair[judge.id];
        const validation = validateTutorStubResistanceRecoverySemanticResponse({
          caseId: corpusCase.case_id,
          publicPacket,
          response: fixture?.response,
          registration,
          prompt: fixture?.prompt,
        });
        return [
          judge.id,
          validation.valid && fixture.response.judgment.confidence === 'high' ? fixture.response.judgment : null,
        ];
      }),
    );
    return { corpusCase, pair, labels, aggregate };
  });
  const judgeCategories = Object.fromEntries(
    judges.map((judge) => [judge.id, rows.map((row) => category(row.labels[judge.id]))]),
  );
  const expectedVectors = rows.map((row) => exactVector(row.corpusCase.expected.judgment));
  const judgeVectors = Object.fromEntries(
    judges.map((judge) => [judge.id, rows.map((row) => exactVector(row.labels[judge.id]))]),
  );
  const consensusVectors = rows.map((row) => exactVector(row.aggregate.judgment));
  const ratio = (numerator, denominator) => (denominator ? numerator / denominator : 0);
  const exactAccuracy = (observed) =>
    ratio(observed.filter((value, index) => value === expectedVectors[index]).length, rows.length);
  const binaryRate = (field, expectedValue, observedValue) => {
    const selected = rows.filter((row) => row.corpusCase.expected.judgment[field] === expectedValue);
    return ratio(selected.filter((row) => row.aggregate.judgment?.[field] === observedValue).length, selected.length);
  };
  const positiveSensitivity = (field) => {
    const positive = rows.filter((row) => row.corpusCase.expected.judgment[field] === 'yes');
    return ratio(positive.filter((row) => row.aggregate.judgment?.[field] === 'yes').length, positive.length);
  };
  const negativeRows = rows.filter((row) => row.corpusCase.expected.judgment.final_recovery === 'no');
  const coverageByStratum = Object.fromEntries(
    ['merits', 'grounded', 'both', 'no_recovery'].map((stratum) => {
      const selected = rows.filter((row) => category(row.corpusCase.expected.judgment) === stratum);
      return [stratum, ratio(selected.filter((row) => row.aggregate.status === 'determinate').length, selected.length)];
    }),
  );
  const allRecords = rows.flatMap((row) => judges.map((judge) => row.pair[judge.id]?.response).filter(Boolean));
  const validRecords = allRecords.filter((response) => response?.provenance?.prohibited_tool_events === 0);
  const metrics = {
    schema_span_provenance_validity: ratio(
      rows.flatMap((row) => judges.map((judge) => row.labels[judge.id])).filter(Boolean).length,
      rows.length * judges.length,
    ),
    per_judge_exact_vector_accuracy: Object.fromEntries(
      judges.map((judge) => [judge.id, exactAccuracy(judgeVectors[judge.id])]),
    ),
    consensus_exact_vector_accuracy: exactAccuracy(consensusVectors),
    consensus_merits_engagement_sensitivity: positiveSensitivity('bounded_test_merits_engagement'),
    consensus_merits_engagement_specificity: binaryRate('bounded_test_merits_engagement', 'no', 'no'),
    consensus_grounded_precision_sensitivity: positiveSensitivity('grounded_precise_jurisdictional_condition'),
    consensus_grounded_precision_specificity: binaryRate('grounded_precise_jurisdictional_condition', 'no', 'no'),
    consensus_no_recovery_specificity: ratio(
      negativeRows.filter((row) => row.aggregate.judgment?.final_recovery === 'no').length,
      negativeRows.length,
    ),
    consensus_action_classification_accuracy: ratio(
      rows.filter(
        (row) =>
          row.aggregate.judgment?.delivered_clarify_distinction ===
          row.corpusCase.expected.judgment.delivered_clarify_distinction,
      ).length,
      rows.length,
    ),
    consensus_register_classification_accuracy: ratio(
      rows.filter(
        (row) => row.aggregate.judgment?.delivered_register === row.corpusCase.expected.judgment.delivered_register,
      ).length,
      rows.length,
    ),
    raw_full_vector_interjudge_agreement: ratio(
      judgeVectors[judges[0].id].filter((value, index) => value === judgeVectors[judges[1].id][index]).length,
      rows.length,
    ),
    recovery_category_cohen_kappa: cohenKappa(judgeCategories[judges[0].id], judgeCategories[judges[1].id]),
    determined_coverage_overall: ratio(
      rows.filter((row) => row.aggregate.status === 'determinate').length,
      rows.length,
    ),
    determined_coverage_by_stratum: coverageByStratum,
    prohibited_tool_events: allRecords.reduce(
      (sum, response) => sum + Number(response.provenance.prohibited_tool_events || 0),
      0,
    ),
    response_records_observed: allRecords.length,
    response_records_with_observed_zero_tools: validRecords.length,
  };
  const gates = registration.measurement.validationGates;
  const passed =
    metrics.schema_span_provenance_validity === gates.schemaSpanProvenanceValidity &&
    Object.values(metrics.per_judge_exact_vector_accuracy).every(
      (value) => value >= gates.minimumPerJudgeExactVectorAccuracy,
    ) &&
    metrics.consensus_exact_vector_accuracy >= gates.minimumConsensusExactVectorAccuracy &&
    metrics.consensus_merits_engagement_sensitivity >= gates.minimumConsensusMeritsEngagementSensitivity &&
    metrics.consensus_merits_engagement_specificity >= gates.minimumConsensusMeritsEngagementSpecificity &&
    metrics.consensus_grounded_precision_sensitivity >= gates.minimumConsensusGroundedPrecisionSensitivity &&
    metrics.consensus_grounded_precision_specificity >= gates.minimumConsensusGroundedPrecisionSpecificity &&
    metrics.consensus_no_recovery_specificity >= gates.minimumConsensusNoRecoverySpecificity &&
    metrics.consensus_action_classification_accuracy >= gates.minimumConsensusActionClassificationAccuracy &&
    metrics.consensus_register_classification_accuracy >= gates.minimumConsensusRegisterClassificationAccuracy &&
    metrics.raw_full_vector_interjudge_agreement >= gates.minimumRawFullVectorInterjudgeAgreement &&
    metrics.recovery_category_cohen_kappa >= gates.minimumRecoveryCategoryCohenKappa &&
    metrics.determined_coverage_overall >= gates.minimumOverallDeterminedCoverage &&
    Object.values(metrics.determined_coverage_by_stratum).every(
      (value) => value >= gates.minimumPerStratumDeterminedCoverage,
    ) &&
    metrics.prohibited_tool_events <= gates.maximumProhibitedToolEvents;
  return { status: passed ? 'passed' : 'failed', metrics };
}
