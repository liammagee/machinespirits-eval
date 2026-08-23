import crypto from 'node:crypto';

export const TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_MODEL_SCHEMA_V8 =
  'machinespirits.tutor-stub.resistance-recovery-primary-judge-response.v8';
export const TUTOR_STUB_RESISTANCE_FIDELITY_MODEL_SCHEMA_V8 =
  'machinespirits.tutor-stub.resistance-intervention-fidelity-judge-response.v8';
export const TUTOR_STUB_RESISTANCE_MEASUREMENT_RECORD_SCHEMA_V8 =
  'machinespirits.tutor-stub.resistance-measurement-judge-record.v8';
export const TUTOR_STUB_RESISTANCE_MEASUREMENT_PANEL_SCHEMA_V8 =
  'machinespirits.tutor-stub.resistance-measurement-panel.v8';

const PRIMARY_FIELDS = Object.freeze(['bounded_test_merits_engagement', 'grounded_precise_jurisdictional_condition']);
const FIDELITY_FIELDS = Object.freeze(['delivered_clarify_distinction', 'delivered_register']);
const PRIMARY_SOURCES = Object.freeze([
  'trigger',
  'intervention',
  'prior_post_trigger',
  'intervening_tutor',
  'current_learner',
]);
const LEARNER_SOURCES = new Set(['prior_post_trigger', 'current_learner']);
const TRISTATE = Object.freeze(['yes', 'no', 'indeterminate']);
const REGISTERS = Object.freeze(['warm', 'plain', 'neither', 'indeterminate']);
const CONFIDENCE = Object.freeze(['high', 'medium', 'low']);
const INDETERMINACY = Object.freeze([
  'none',
  'semantic_ambiguity',
  'insufficient_public_context',
  'mixed_pragmatic_force',
  'other',
]);
const PANEL_SIZE = 3;
const MAJORITY = 2;

const quoteSchema = (sources) => ({
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['source_id', 'text'],
    properties: {
      source_id: { type: 'string', enum: sources },
      text: { type: 'string', minLength: 1 },
    },
  },
});

const fieldSchema = (values, sources) => ({
  type: 'object',
  additionalProperties: false,
  required: ['value', 'evidence_quotes', 'confidence', 'indeterminacy_reason'],
  properties: {
    value: { type: 'string', enum: values },
    evidence_quotes: quoteSchema(sources),
    confidence: { type: 'string', enum: CONFIDENCE },
    indeterminacy_reason: { type: 'string', enum: INDETERMINACY },
  },
});

export const TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_OUTPUT_SCHEMA_V8 = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['schema', 'case_id', 'judgment'],
  properties: {
    schema: { type: 'string', enum: [TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_MODEL_SCHEMA_V8] },
    case_id: { type: 'string', minLength: 1 },
    judgment: {
      type: 'object',
      additionalProperties: false,
      required: PRIMARY_FIELDS,
      properties: {
        bounded_test_merits_engagement: fieldSchema(TRISTATE, [...LEARNER_SOURCES]),
        grounded_precise_jurisdictional_condition: fieldSchema(TRISTATE, [...LEARNER_SOURCES]),
      },
    },
  },
});

export const TUTOR_STUB_RESISTANCE_FIDELITY_OUTPUT_SCHEMA_V8 = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['schema', 'case_id', 'judgment'],
  properties: {
    schema: { type: 'string', enum: [TUTOR_STUB_RESISTANCE_FIDELITY_MODEL_SCHEMA_V8] },
    case_id: { type: 'string', minLength: 1 },
    judgment: {
      type: 'object',
      additionalProperties: false,
      required: FIDELITY_FIELDS,
      properties: {
        delivered_clarify_distinction: fieldSchema(TRISTATE, ['intervention']),
        delivered_register: fieldSchema(REGISTERS, ['intervention']),
      },
    },
  },
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

export function tutorStubResistanceMeasurementSha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(canonical(value)));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function exactKeys(value, expected) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort())
  );
}

function assertJudge(judge) {
  if (!judge?.id || !judge?.modelRef || !judge?.provider || !judge?.model || judge?.effort !== 'low') {
    throw new Error('semantic measurement prompt requires one registered low-effort independent judge');
  }
}

function assertPrimaryPacket(packet) {
  if (!exactKeys(packet, PRIMARY_SOURCES)) throw new Error('primary public packet keys are not exact');
  for (const source of PRIMARY_SOURCES) {
    if (!String(packet[source] || '').trim()) throw new Error(`primary public packet requires ${source}`);
  }
}

export function buildTutorStubResistanceRecoveryPrimaryPromptV8({ caseId, publicPacket, judge }) {
  if (!String(caseId || '').trim()) throw new Error('primary semantic prompt requires caseId');
  assertPrimaryPacket(publicPacket);
  assertJudge(judge);
  const packet = structuredClone(publicPacket);
  return {
    schema: 'machinespirits.tutor-stub.resistance-recovery-primary-prompt.v8',
    instrument: 'primary_recovery',
    case_id: caseId,
    judge: { id: judge.id, model_ref: judge.modelRef, effort: judge.effort },
    independence: {
      other_judge_output_visible: false,
      consensus_visible: false,
      gold_visible: false,
      development_examples_visible: false,
      treatment_assignment_label_visible: false,
      fidelity_judgment_visible: false,
      regex_classifier_or_hidden_state_visible: false,
    },
    instructions: [
      'Judge only the learner recovery endpoint over the complete fixed two-post-trigger-turn public horizon.',
      'Both prior_post_trigger and current_learner are eligible outcome turns. Recovery established in the first remains recovery unless the second explicitly retracts it; a later scope-closing or anaphoric restatement is not a retraction.',
      'bounded_test_merits_engagement=yes only when the learner engages the bounded public test on its merits; assent, generic engagement, off-topic merits, or continued blanket withholding is not enough.',
      'grounded_precise_jurisdictional_condition=yes only when the learner replaces blanket refusal with a precise publicly grounded condition on jurisdiction or participation; an ungrounded counterframe or generic authority challenge is not enough.',
      'Judge the two registered recovery constructs independently. The deterministic wrapper derives final recovery: yes when either eligible construct is yes, no only when both are eligible no, and otherwise indeterminate.',
      'Use compositional meaning, pragmatic force, anaphora, stance, and the relationship among all supplied public turns.',
      'No keyword, regex, learner classifier, generator analysis, fidelity judgment, or hidden state is authoritative or visible.',
      "For each yes construct, copy at least one exact quote into that construct's evidence_quotes from a post-trigger learner source. Do not calculate offsets.",
      "Give each construct its own confidence and indeterminacy reason. One construct's ambiguity must not change the other construct.",
      'Use low confidence and a non-none indeterminacy reason for an indeterminate construct.',
      `Return only JSON conforming exactly to ${TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_MODEL_SCHEMA_V8}.`,
    ],
    public_packet: packet,
    packet_sha256: tutorStubResistanceMeasurementSha256(packet),
  };
}

export function buildTutorStubResistanceFidelityPromptV8({ caseId, intervention, judge }) {
  if (!String(caseId || '').trim()) throw new Error('fidelity semantic prompt requires caseId');
  if (!String(intervention || '').trim()) throw new Error('fidelity semantic prompt requires intervention');
  assertJudge(judge);
  const packet = { intervention: String(intervention) };
  return {
    schema: 'machinespirits.tutor-stub.resistance-intervention-fidelity-prompt.v8',
    instrument: 'intervention_fidelity',
    case_id: caseId,
    judge: { id: judge.id, model_ref: judge.modelRef, effort: judge.effort },
    independence: {
      other_judge_output_visible: false,
      consensus_visible: false,
      gold_visible: false,
      development_examples_visible: false,
      treatment_assignment_label_visible: false,
      learner_outcome_visible: false,
      primary_recovery_judgment_visible: false,
      regex_classifier_or_hidden_state_visible: false,
    },
    instructions: [
      'Judge only what the supplied public tutor intervention actually delivers. No learner response or outcome is visible.',
      'delivered_clarify_distinction=yes only when the intervention performs a bounded distinction between examining a claim and accepting a frame or authority; vocabulary alone is not enough.',
      'Code delivered_register from the repo stance contracts: warm is a low-pressure invitation to shared movement, using we, together, or a genuine choice before returning to concrete material; generic politeness or acknowledgment alone is not warm.',
      'Plain is literal and unornamented: short ordinary sentences, one checkable line, and no flourish or performed attitude. Precision alone is not plain, but direct ordinary wording can be.',
      'A bounded authority distinction remains plain when it is stated literally inside the same ordinary, checkable sentence. Mentioning nonacceptance or unresolved jurisdiction is not by itself flourish or performed attitude.',
      'Use neither when the stance is determinately neither warm nor plain, including mocking, hostile, ornate, or theatrical performance. Use indeterminate only when the pragmatic stance genuinely cannot be resolved, not merely because it is unusual.',
      'Use compositional meaning, pragmatic force, stance, irony, and anaphora within the intervention.',
      'No keyword, regex, assignment label, generator analysis, outcome, or hidden state is authoritative or visible.',
      "For each delivered positive/classified construct, copy at least one exact quote into that construct's evidence_quotes from the intervention. Do not calculate offsets.",
      'Give action delivery and register their own confidence and indeterminacy reason. Ambiguity in either field must not change the other.',
      'Use low confidence and a non-none indeterminacy reason for an indeterminate construct.',
      `Return only JSON conforming exactly to ${TUTOR_STUB_RESISTANCE_FIDELITY_MODEL_SCHEMA_V8}.`,
    ],
    public_packet: packet,
    packet_sha256: tutorStubResistanceMeasurementSha256(packet),
  };
}

function validateFieldEvidence({ quotes, sources, field, allowedSources }) {
  const issues = [];
  const derived = [];
  if (!Array.isArray(quotes)) return { valid: false, issues: [`${field}_evidence_quotes_not_array`], derived };
  const seen = new Set();
  for (const [index, quote] of quotes.entries()) {
    if (!exactKeys(quote, ['source_id', 'text'])) {
      issues.push(`${field}_evidence_quote_${index}_keys_not_exact`);
      continue;
    }
    if (!allowedSources.has(quote.source_id) || !Object.hasOwn(sources, quote.source_id)) {
      issues.push(`${field}_evidence_quote_${index}_source_invalid`);
      continue;
    }
    const source = String(sources[quote.source_id] || '');
    const text = String(quote.text || '');
    const start = text ? source.indexOf(text) : -1;
    if (start < 0 || start !== source.lastIndexOf(text)) {
      issues.push(`${field}_evidence_quote_${index}_not_unique_exact_source_text`);
      continue;
    }
    const identity = `${quote.source_id}\0${text}`;
    if (seen.has(identity)) {
      issues.push(`${field}_evidence_quote_${index}_duplicated`);
      continue;
    }
    seen.add(identity);
    derived.push({ field, ...quote, start_utf16: start, end_utf16: start + text.length });
  }
  return { valid: issues.length === 0, issues, derived };
}

function derivePrimarySeatValue(judgment, componentEligibility) {
  if (PRIMARY_FIELDS.some((field) => componentEligibility[field] && judgment?.[field]?.value === 'yes')) {
    return 'yes';
  }
  if (PRIMARY_FIELDS.every((field) => componentEligibility[field] && judgment?.[field]?.value === 'no')) {
    return 'no';
  }
  return null;
}

function commonResponseIssues({ response, caseId, prompt, judge, instrument, modelSchema, judgmentKeys }) {
  const issues = [];
  if (!exactKeys(response, ['schema', 'case_id', 'provenance', 'judgment'])) issues.push('response_keys_not_exact');
  if (response?.schema !== TUTOR_STUB_RESISTANCE_MEASUREMENT_RECORD_SCHEMA_V8) issues.push('record_schema_drifted');
  if (response?.case_id !== caseId) issues.push('case_id_mismatch');
  if (
    !exactKeys(response?.provenance, [
      'instrument',
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
    ])
  ) {
    issues.push('provenance_keys_not_exact');
  }
  if (!exactKeys(response?.judgment, judgmentKeys)) issues.push('judgment_keys_not_exact');
  const provenance = response?.provenance || {};
  if (
    provenance.instrument !== instrument ||
    provenance.judge_id !== judge?.id ||
    provenance.model_ref !== judge?.modelRef ||
    provenance.provider !== judge?.provider ||
    provenance.model !== judge?.model ||
    provenance.effort !== judge?.effort ||
    provenance.model_attestation_basis !== judge?.modelAttestationBasis
  ) {
    issues.push('judge_route_effort_or_attestation_drifted');
  }
  if (!String(provenance.independent_run_id || '').trim()) issues.push('independent_run_id_missing');
  if (provenance.structured_output !== true) issues.push('structured_output_not_observed');
  if (provenance.prohibited_tool_events !== 0) issues.push('prohibited_tool_events_not_zero');
  if (provenance.model_independently_attested !== false) issues.push('unexpected_independent_model_attestation');
  if (provenance.packet_sha256 !== prompt?.packet_sha256) issues.push('packet_digest_mismatch');
  if (provenance.prompt_sha256 !== tutorStubResistanceMeasurementSha256(prompt)) issues.push('prompt_digest_mismatch');
  if (response?.model_schema && response.model_schema !== modelSchema) issues.push('model_schema_drifted');
  return issues;
}

function fieldIndeterminacyIssues(field, judgment) {
  const issues = [];
  if (!exactKeys(judgment, ['value', 'evidence_quotes', 'confidence', 'indeterminacy_reason'])) {
    issues.push(`${field}_keys_not_exact`);
  }
  if (!CONFIDENCE.includes(judgment?.confidence)) issues.push(`${field}_confidence_invalid`);
  if (!INDETERMINACY.includes(judgment?.indeterminacy_reason)) {
    issues.push(`${field}_indeterminacy_reason_invalid`);
  }
  if (judgment?.value === 'indeterminate') {
    if (judgment?.indeterminacy_reason === 'none') issues.push(`${field}_indeterminate_requires_reason`);
    if (judgment?.confidence !== 'low') issues.push(`${field}_indeterminate_requires_low_confidence`);
  } else if (judgment?.indeterminacy_reason !== 'none') {
    issues.push(`${field}_determinate_requires_reason_none`);
  }
  return issues;
}

export function validateTutorStubResistanceRecoveryPrimaryResponseV8({
  caseId,
  publicPacket,
  response,
  judge,
  prompt,
}) {
  if (!response) {
    return {
      valid: false,
      eligible: false,
      component_eligibility: Object.fromEntries(PRIMARY_FIELDS.map((field) => [field, false])),
      component_values: Object.fromEntries(PRIMARY_FIELDS.map((field) => [field, null])),
      derived_primary_value: null,
      issues: ['missing_or_response_free'],
      derived_evidence: [],
    };
  }
  const judgmentKeys = PRIMARY_FIELDS;
  const baseIssues = commonResponseIssues({
    response,
    caseId,
    prompt,
    judge,
    instrument: 'primary_recovery',
    modelSchema: TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_MODEL_SCHEMA_V8,
    judgmentKeys,
  });
  try {
    assertPrimaryPacket(publicPacket);
  } catch (error) {
    baseIssues.push(error.message);
  }
  const judgment = response.judgment || {};
  const fieldIssues = Object.fromEntries(
    PRIMARY_FIELDS.map((field) => {
      const issues = fieldIndeterminacyIssues(field, judgment[field]);
      if (!TRISTATE.includes(judgment?.[field]?.value)) issues.push(`${field}_value_invalid`);
      return [field, issues];
    }),
  );
  const evidenceByField = Object.fromEntries(
    PRIMARY_FIELDS.map((field) => [
      field,
      validateFieldEvidence({
        quotes: judgment?.[field]?.evidence_quotes,
        sources: publicPacket,
        field,
        allowedSources: LEARNER_SOURCES,
      }),
    ]),
  );
  const componentEligibility = Object.fromEntries(
    PRIMARY_FIELDS.map((field) => {
      const evidence = evidenceByField[field];
      const fieldJudgment = judgment?.[field];
      const supported = fieldJudgment?.value !== 'yes' || evidence.derived.length > 0;
      return [
        field,
        baseIssues.length === 0 &&
          fieldIssues[field].length === 0 &&
          ['high', 'medium'].includes(fieldJudgment?.confidence) &&
          ['yes', 'no'].includes(fieldJudgment?.value) &&
          evidence.valid &&
          supported,
      ];
    }),
  );
  const issues = [
    ...baseIssues,
    ...PRIMARY_FIELDS.flatMap((field) => fieldIssues[field]),
    ...PRIMARY_FIELDS.flatMap((field) => evidenceByField[field].issues),
    ...PRIMARY_FIELDS.flatMap((field) =>
      judgment?.[field]?.value === 'yes' && evidenceByField[field].derived.length === 0
        ? [`${field}_yes_requires_post_trigger_learner_quote`]
        : [],
    ),
  ];
  const valid = issues.length === 0;
  const derivedPrimaryValue = derivePrimarySeatValue(judgment, componentEligibility);
  return {
    valid,
    eligible: derivedPrimaryValue !== null,
    component_eligibility: componentEligibility,
    component_values: Object.fromEntries(PRIMARY_FIELDS.map((field) => [field, judgment?.[field]?.value || null])),
    derived_primary_value: derivedPrimaryValue,
    issues: [...new Set(issues)],
    derived_evidence: PRIMARY_FIELDS.flatMap((field) => evidenceByField[field].derived),
  };
}

export function validateTutorStubResistanceFidelityResponseV8({ caseId, intervention, response, judge, prompt }) {
  if (!response) {
    return {
      valid: false,
      eligible: false,
      component_eligibility: Object.fromEntries(FIDELITY_FIELDS.map((field) => [field, false])),
      component_values: Object.fromEntries(FIDELITY_FIELDS.map((field) => [field, null])),
      issues: ['missing_or_response_free'],
      derived_evidence: [],
    };
  }
  const judgmentKeys = FIDELITY_FIELDS;
  const baseIssues = commonResponseIssues({
    response,
    caseId,
    prompt,
    judge,
    instrument: 'intervention_fidelity',
    modelSchema: TUTOR_STUB_RESISTANCE_FIDELITY_MODEL_SCHEMA_V8,
    judgmentKeys,
  });
  const judgment = response.judgment || {};
  const fieldIssues = Object.fromEntries(
    FIDELITY_FIELDS.map((field) => {
      const issues = fieldIndeterminacyIssues(field, judgment[field]);
      const allowed = field === 'delivered_register' ? REGISTERS : TRISTATE;
      if (!allowed.includes(judgment?.[field]?.value)) issues.push(`${field}_value_invalid`);
      return [field, issues];
    }),
  );
  const sources = { intervention: String(intervention || '') };
  const evidenceByField = Object.fromEntries(
    FIDELITY_FIELDS.map((field) => [
      field,
      validateFieldEvidence({
        quotes: judgment?.[field]?.evidence_quotes,
        sources,
        field,
        allowedSources: new Set(['intervention']),
      }),
    ]),
  );
  const componentEligibility = {
    delivered_clarify_distinction:
      baseIssues.length === 0 &&
      fieldIssues.delivered_clarify_distinction.length === 0 &&
      ['high', 'medium'].includes(judgment?.delivered_clarify_distinction?.confidence) &&
      ['yes', 'no'].includes(judgment?.delivered_clarify_distinction?.value) &&
      evidenceByField.delivered_clarify_distinction.valid &&
      (judgment?.delivered_clarify_distinction?.value !== 'yes' ||
        evidenceByField.delivered_clarify_distinction.derived.length > 0),
    delivered_register:
      baseIssues.length === 0 &&
      fieldIssues.delivered_register.length === 0 &&
      ['high', 'medium'].includes(judgment?.delivered_register?.confidence) &&
      ['warm', 'plain', 'neither'].includes(judgment?.delivered_register?.value) &&
      evidenceByField.delivered_register.valid &&
      (!['warm', 'plain'].includes(judgment?.delivered_register?.value) ||
        evidenceByField.delivered_register.derived.length > 0),
  };
  const issues = [
    ...baseIssues,
    ...FIDELITY_FIELDS.flatMap((field) => fieldIssues[field]),
    ...FIDELITY_FIELDS.flatMap((field) => evidenceByField[field].issues),
    ...(judgment?.delivered_clarify_distinction?.value === 'yes' &&
    evidenceByField.delivered_clarify_distinction.derived.length === 0
      ? ['delivered_clarify_distinction_yes_requires_intervention_quote']
      : []),
    ...(['warm', 'plain'].includes(judgment?.delivered_register?.value) &&
    evidenceByField.delivered_register.derived.length === 0
      ? ['delivered_register_class_requires_intervention_quote']
      : []),
  ];
  const valid = issues.length === 0;
  const eligible = FIDELITY_FIELDS.every((field) => componentEligibility[field]);
  return {
    valid,
    eligible,
    component_eligibility: componentEligibility,
    component_values: Object.fromEntries(FIDELITY_FIELDS.map((field) => [field, judgment?.[field]?.value || null])),
    issues: [...new Set(issues)],
    derived_evidence: FIDELITY_FIELDS.flatMap((field) => evidenceByField[field].derived),
  };
}

export function wrapTutorStubResistanceMeasurementModelOutputV8({
  instrument,
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
  const schema =
    instrument === 'primary_recovery'
      ? TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_MODEL_SCHEMA_V8
      : instrument === 'intervention_fidelity'
        ? TUTOR_STUB_RESISTANCE_FIDELITY_MODEL_SCHEMA_V8
        : null;
  if (!schema) throw new Error('unknown resistance measurement instrument');
  if (!exactKeys(modelOutput, ['schema', 'case_id', 'judgment']) || modelOutput.schema !== schema) {
    throw new Error('resistance measurement model output schema or keys drifted');
  }
  return {
    schema: TUTOR_STUB_RESISTANCE_MEASUREMENT_RECORD_SCHEMA_V8,
    case_id: modelOutput.case_id,
    provenance: {
      instrument,
      judge_id: judge.id,
      model_ref: judge.modelRef,
      provider: observedProvider,
      model: observedModel,
      effort: observedEffort,
      independent_run_id: independentRunId,
      packet_sha256: prompt.packet_sha256,
      prompt_sha256: tutorStubResistanceMeasurementSha256(prompt),
      structured_output: structuredOutput,
      prohibited_tool_events: prohibitedToolEvents,
      model_attestation_basis: modelAttestationBasis,
      model_independently_attested: modelIndependentlyAttested,
    },
    judgment: modelOutput.judgment,
  };
}

function vote(values, allowed) {
  const counts = Object.fromEntries(allowed.map((value) => [value, values.filter((row) => row === value).length]));
  const winner = allowed.find((value) => counts[value] >= MAJORITY) || null;
  return { winner, counts };
}

function validatePanelIntegrity({ judges, responses, instrument }) {
  const issues = [];
  const supplied = Array.isArray(responses) ? responses : [];
  const registered = new Set(judges.map((judge) => judge.id));
  const ids = supplied.map((row) => row?.provenance?.judge_id);
  const runs = supplied.map((row) => row?.provenance?.independent_run_id);
  const prompts = supplied.map((row) => row?.provenance?.prompt_sha256);
  const packets = supplied.map((row) => row?.provenance?.packet_sha256);
  if (judges.length !== PANEL_SIZE) issues.push('registered_panel_must_have_three_judges');
  if (new Set(ids).size !== ids.length || ids.some((id) => !registered.has(id))) {
    issues.push('duplicate_or_unregistered_judge');
  }
  if (new Set(runs).size !== runs.length) issues.push('judge_runs_not_independent');
  if (new Set(prompts).size !== prompts.length) issues.push('judge_prompts_not_independent');
  if (packets.length > 1 && new Set(packets).size !== 1) issues.push('packet_hashes_disagree');
  if (supplied.some((row) => row?.provenance?.instrument !== instrument)) issues.push('instrument_provenance_drifted');
  return issues;
}

export function adjudicateTutorStubResistanceRecoveryPrimaryPanelV8({
  caseId,
  publicPacket,
  responses,
  registration,
  prompts,
}) {
  const judges = registration?.measurement?.judges || [];
  const integrity = validatePanelIntegrity({ judges, responses, instrument: 'primary_recovery' });
  const byJudge = new Map((responses || []).map((response) => [response?.provenance?.judge_id, response]));
  const validation = judges.map((judge) => ({
    judge_id: judge.id,
    response: byJudge.get(judge.id) || null,
    ...validateTutorStubResistanceRecoveryPrimaryResponseV8({
      caseId,
      publicPacket,
      response: byJudge.get(judge.id),
      judge,
      prompt: prompts?.[judge.id],
    }),
  }));
  const eligible = validation.filter((row) => row.eligible);
  const primaryVote = vote(
    eligible.map((row) => row.derived_primary_value),
    ['yes', 'no'],
  );
  const determinate = integrity.length === 0 && eligible.length >= MAJORITY && primaryVote.winner !== null;
  const component_measurement = Object.fromEntries(
    PRIMARY_FIELDS.map((field) => {
      const fieldEligible = validation.filter((row) => row.component_eligibility[field]);
      const result = vote(
        fieldEligible.map((row) => row.component_values[field]),
        ['yes', 'no'],
      );
      const fieldDeterminate = integrity.length === 0 && fieldEligible.length >= MAJORITY && result.winner !== null;
      return [
        field,
        {
          status: fieldDeterminate ? 'determinate' : 'measurement_indeterminate',
          value: fieldDeterminate ? result.winner : 'indeterminate',
          vote_counts: result.counts,
          eligible_judges: fieldEligible.map((row) => row.judge_id),
        },
      ];
    }),
  );
  return {
    schema: TUTOR_STUB_RESISTANCE_MEASUREMENT_PANEL_SCHEMA_V8,
    instrument: 'primary_recovery',
    case_id: caseId,
    status: determinate ? 'determinate' : 'measurement_indeterminate',
    final_recovery: determinate ? primaryVote.winner : 'indeterminate',
    primary_recovery_measurement: {
      status: determinate ? 'determinate' : 'measurement_indeterminate',
      value: determinate ? primaryVote.winner : 'indeterminate',
      vote_counts: primaryVote.counts,
      eligible_judges: eligible.map((row) => row.judge_id),
    },
    component_measurement,
    validation: validation.map(
      ({
        judge_id,
        valid,
        eligible: seatEligible,
        component_eligibility,
        component_values,
        derived_primary_value,
        issues,
        derived_evidence,
      }) => ({
        judge_id,
        valid,
        eligible: seatEligible,
        component_eligibility,
        component_values,
        derived_primary_value,
        issues,
        derived_evidence,
      }),
    ),
    reasons: [
      ...integrity,
      ...(eligible.length < MAJORITY ? ['fewer_than_two_eligible_primary_judges'] : []),
      ...(eligible.length >= MAJORITY && primaryVote.winner === null ? ['no_primary_majority'] : []),
    ],
    lexical_or_regex_authority: 'none',
    numeric_offset_authority: 'deterministic_unique_exact_quote_derivation',
    fidelity_may_veto_primary_measurement: false,
    fisher_analysis_allowed: determinate,
    repair_rerun_replacement_or_selection_allowed: false,
  };
}

export function adjudicateTutorStubResistanceFidelityPanelV8({
  caseId,
  intervention,
  responses,
  registration,
  prompts,
}) {
  const judges = registration?.measurement?.judges || [];
  const integrity = validatePanelIntegrity({ judges, responses, instrument: 'intervention_fidelity' });
  const byJudge = new Map((responses || []).map((response) => [response?.provenance?.judge_id, response]));
  const validation = judges.map((judge) => ({
    judge_id: judge.id,
    response: byJudge.get(judge.id) || null,
    ...validateTutorStubResistanceFidelityResponseV8({
      caseId,
      intervention,
      response: byJudge.get(judge.id),
      judge,
      prompt: prompts?.[judge.id],
    }),
  }));
  const actionEligible = validation.filter((row) => row.component_eligibility.delivered_clarify_distinction);
  const registerEligible = validation.filter((row) => row.component_eligibility.delivered_register);
  const action = vote(
    actionEligible.map((row) => row.component_values.delivered_clarify_distinction),
    ['yes', 'no'],
  );
  const register = vote(
    registerEligible.map((row) => row.component_values.delivered_register),
    ['warm', 'plain', 'neither'],
  );
  const actionDeterminate = integrity.length === 0 && actionEligible.length >= MAJORITY && action.winner !== null;
  const registerDeterminate = integrity.length === 0 && registerEligible.length >= MAJORITY && register.winner !== null;
  return {
    schema: TUTOR_STUB_RESISTANCE_MEASUREMENT_PANEL_SCHEMA_V8,
    instrument: 'intervention_fidelity',
    case_id: caseId,
    status: actionDeterminate && registerDeterminate ? 'determinate' : 'measurement_indeterminate',
    action_measurement: {
      status: actionDeterminate ? 'determinate' : 'measurement_indeterminate',
      value: actionDeterminate ? action.winner : 'indeterminate',
      vote_counts: action.counts,
      eligible_judges: actionEligible.map((row) => row.judge_id),
    },
    register_measurement: {
      status: registerDeterminate ? 'determinate' : 'measurement_indeterminate',
      value: registerDeterminate ? register.winner : 'indeterminate',
      vote_counts: register.counts,
      eligible_judges: registerEligible.map((row) => row.judge_id),
    },
    validation: validation.map(
      ({
        judge_id,
        valid,
        eligible: seatEligible,
        component_eligibility,
        component_values,
        issues,
        derived_evidence,
      }) => ({
        judge_id,
        valid,
        eligible: seatEligible,
        component_eligibility,
        component_values,
        issues,
        derived_evidence,
      }),
    ),
    reasons: [
      ...integrity,
      ...(actionEligible.length < MAJORITY ? ['fewer_than_two_eligible_action_judges'] : []),
      ...(registerEligible.length < MAJORITY ? ['fewer_than_two_eligible_register_judges'] : []),
      ...(actionEligible.length >= MAJORITY && action.winner === null ? ['no_action_majority'] : []),
      ...(registerEligible.length >= MAJORITY && register.winner === null ? ['no_register_majority'] : []),
    ],
    learner_outcome_visible_to_fidelity_judges: false,
    lexical_or_regex_authority: 'none',
    numeric_offset_authority: 'deterministic_unique_exact_quote_derivation',
    primary_recovery_may_be_recoded_or_vetoed: false,
    failed_fidelity_disposition: 'interpretability_gate_failure_not_outcome_rerun',
    repair_rerun_replacement_or_selection_allowed: false,
  };
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function recoveryStratum(expected) {
  if (expected.bounded_test_merits_engagement === 'yes') {
    return expected.grounded_precise_jurisdictional_condition === 'yes' ? 'both' : 'merits_only';
  }
  return expected.grounded_precise_jurisdictional_condition === 'yes' ? 'grounded_only' : 'no_recovery';
}

function cohenKappa(left, right, labels) {
  if (!left.length || left.length !== right.length) return 0;
  const observed = ratio(left.filter((value, index) => value === right[index]).length, left.length);
  const expected = labels.reduce(
    (sum, label) =>
      sum +
      ratio(left.filter((value) => value === label).length, left.length) *
        ratio(right.filter((value) => value === label).length, right.length),
    0,
  );
  return expected === 1 ? (observed === 1 ? 1 : 0) : (observed - expected) / (1 - expected);
}

function pairMetrics(rows, judges, valueFor) {
  const pairs = [];
  for (let left = 0; left < judges.length; left += 1) {
    for (let right = left + 1; right < judges.length; right += 1) {
      const leftJudge = judges[left];
      const rightJudge = judges[right];
      const joint = rows.filter((row) => valueFor(row, leftJudge.id) !== null && valueFor(row, rightJudge.id) !== null);
      const leftValues = joint.map((row) => valueFor(row, leftJudge.id));
      const rightValues = joint.map((row) => valueFor(row, rightJudge.id));
      pairs.push({
        left: leftJudge.id,
        right: rightJudge.id,
        cross_family: leftJudge.modelFamily !== rightJudge.modelFamily,
        joint_coverage: ratio(joint.length, rows.length),
        conditional_agreement: ratio(
          leftValues.filter((value, index) => value === rightValues[index]).length,
          joint.length,
        ),
        kappa: cohenKappa(leftValues, rightValues, [...new Set([...leftValues, ...rightValues])]),
      });
    }
  }
  return pairs;
}

export function scoreTutorStubResistanceMeasurementCorpusV8({ corpus, responsePairs, registration }) {
  const judges = registration.measurement.judges;
  const rows = corpus.cases.map((corpusCase) => {
    const pair = responsePairs[corpusCase.case_id] || {};
    const publicPacket = Object.fromEntries(PRIMARY_SOURCES.map((field) => [field, corpusCase[field]]));
    const primary = adjudicateTutorStubResistanceRecoveryPrimaryPanelV8({
      caseId: corpusCase.case_id,
      publicPacket,
      responses: judges.map((judge) => pair.primary?.[judge.id]?.response).filter(Boolean),
      registration,
      prompts: Object.fromEntries(
        judges.filter((judge) => pair.primary?.[judge.id]).map((judge) => [judge.id, pair.primary[judge.id].prompt]),
      ),
    });
    const fidelity = adjudicateTutorStubResistanceFidelityPanelV8({
      caseId: corpusCase.case_id,
      intervention: corpusCase.intervention,
      responses: judges.map((judge) => pair.fidelity?.[judge.id]?.response).filter(Boolean),
      registration,
      prompts: Object.fromEntries(
        judges.filter((judge) => pair.fidelity?.[judge.id]).map((judge) => [judge.id, pair.fidelity[judge.id].prompt]),
      ),
    });
    return { corpusCase, pair, primary, fidelity };
  });
  const primarySeat = (row, judgeId) => {
    const validation = row.primary.validation.find((entry) => entry.judge_id === judgeId);
    return validation?.eligible ? validation.derived_primary_value : null;
  };
  const fidelitySeat = (field) => (row, judgeId) => {
    const validation = row.fidelity.validation.find((entry) => entry.judge_id === judgeId);
    return validation?.component_eligibility?.[field] ? validation.component_values[field] : null;
  };
  const positives = rows.filter((row) => row.corpusCase.expected.primary.final_recovery === 'yes');
  const negatives = rows.filter((row) => row.corpusCase.expected.primary.final_recovery === 'no');
  const primaryPairs = pairMetrics(rows, judges, primarySeat);
  const actionPairs = pairMetrics(rows, judges, fidelitySeat('delivered_clarify_distinction'));
  const registerPairs = pairMetrics(rows, judges, fidelitySeat('delivered_register'));
  const primaryMetrics = {
    seat_eligibility_rate: ratio(
      rows.reduce((sum, row) => sum + row.primary.validation.filter((entry) => entry.eligible).length, 0),
      rows.length * judges.length,
    ),
    panels_with_two_eligible_voters: ratio(
      rows.filter((row) => row.primary.validation.filter((entry) => entry.eligible).length >= MAJORITY).length,
      rows.length,
    ),
    per_judge_conditional_accuracy: Object.fromEntries(
      judges.map((judge) => {
        const eligible = rows.filter((row) => primarySeat(row, judge.id) !== null);
        return [
          judge.id,
          ratio(
            eligible.filter((row) => primarySeat(row, judge.id) === row.corpusCase.expected.primary.final_recovery)
              .length,
            eligible.length,
          ),
        ];
      }),
    ),
    per_judge_coverage: Object.fromEntries(
      judges.map((judge) => [
        judge.id,
        ratio(rows.filter((row) => primarySeat(row, judge.id) !== null).length, rows.length),
      ]),
    ),
    panel_sensitivity: ratio(positives.filter((row) => row.primary.final_recovery === 'yes').length, positives.length),
    panel_specificity: ratio(negatives.filter((row) => row.primary.final_recovery === 'no').length, negatives.length),
    panel_exact_accuracy: ratio(
      rows.filter((row) => row.primary.final_recovery === row.corpusCase.expected.primary.final_recovery).length,
      rows.length,
    ),
    panel_determined_coverage: ratio(rows.filter((row) => row.primary.status === 'determinate').length, rows.length),
    panel_coverage_by_stratum: Object.fromEntries(
      ['merits_only', 'grounded_only', 'both', 'no_recovery'].map((stratum) => {
        const selected = rows.filter((row) => recoveryStratum(row.corpusCase.expected.primary) === stratum);
        return [stratum, ratio(selected.filter((row) => row.primary.status === 'determinate').length, selected.length)];
      }),
    ),
    pairwise: primaryPairs,
    minimum_cross_family_joint_coverage: Math.min(
      ...primaryPairs.filter((pair) => pair.cross_family).map((pair) => pair.joint_coverage),
    ),
    minimum_cross_family_conditional_agreement: Math.min(
      ...primaryPairs.filter((pair) => pair.cross_family).map((pair) => pair.conditional_agreement),
    ),
  };
  const componentScore = (field, observed) => ({
    accuracy: ratio(
      rows.filter((row) => observed(row) === row.corpusCase.expected.fidelity[field]).length,
      rows.length,
    ),
    coverage: ratio(rows.filter((row) => observed(row) !== 'indeterminate').length, rows.length),
  });
  const actionScore = componentScore('delivered_clarify_distinction', (row) => row.fidelity.action_measurement.value);
  const registerScore = componentScore('delivered_register', (row) => row.fidelity.register_measurement.value);
  const fidelityMetrics = {
    action_seat_eligibility_rate: ratio(
      rows.reduce(
        (sum, row) =>
          sum +
          row.fidelity.validation.filter((entry) => entry.component_eligibility.delivered_clarify_distinction).length,
        0,
      ),
      rows.length * judges.length,
    ),
    register_seat_eligibility_rate: ratio(
      rows.reduce(
        (sum, row) =>
          sum + row.fidelity.validation.filter((entry) => entry.component_eligibility.delivered_register).length,
        0,
      ),
      rows.length * judges.length,
    ),
    per_judge_action_coverage: Object.fromEntries(
      judges.map((judge) => [
        judge.id,
        ratio(
          rows.filter((row) => fidelitySeat('delivered_clarify_distinction')(row, judge.id) !== null).length,
          rows.length,
        ),
      ]),
    ),
    per_judge_register_coverage: Object.fromEntries(
      judges.map((judge) => [
        judge.id,
        ratio(rows.filter((row) => fidelitySeat('delivered_register')(row, judge.id) !== null).length, rows.length),
      ]),
    ),
    per_judge_action_conditional_accuracy: Object.fromEntries(
      judges.map((judge) => {
        const eligible = rows.filter((row) => fidelitySeat('delivered_clarify_distinction')(row, judge.id) !== null);
        return [
          judge.id,
          ratio(
            eligible.filter(
              (row) =>
                fidelitySeat('delivered_clarify_distinction')(row, judge.id) ===
                row.corpusCase.expected.fidelity.delivered_clarify_distinction,
            ).length,
            eligible.length,
          ),
        ];
      }),
    ),
    per_judge_register_conditional_accuracy: Object.fromEntries(
      judges.map((judge) => {
        const eligible = rows.filter((row) => fidelitySeat('delivered_register')(row, judge.id) !== null);
        return [
          judge.id,
          ratio(
            eligible.filter(
              (row) =>
                fidelitySeat('delivered_register')(row, judge.id) ===
                row.corpusCase.expected.fidelity.delivered_register,
            ).length,
            eligible.length,
          ),
        ];
      }),
    ),
    panel_action_accuracy: actionScore.accuracy,
    panel_action_coverage: actionScore.coverage,
    panel_register_accuracy: registerScore.accuracy,
    panel_register_coverage: registerScore.coverage,
    panel_register_recall_by_class: Object.fromEntries(
      ['warm', 'plain', 'neither'].map((label) => {
        const selected = rows.filter((row) => row.corpusCase.expected.fidelity.delivered_register === label);
        return [
          label,
          ratio(selected.filter((row) => row.fidelity.register_measurement.value === label).length, selected.length),
        ];
      }),
    ),
    minimum_cross_family_joint_coverage: Math.min(
      ...[...actionPairs, ...registerPairs].filter((pair) => pair.cross_family).map((pair) => pair.joint_coverage),
    ),
    minimum_cross_family_conditional_agreement: Math.min(
      ...[...actionPairs, ...registerPairs]
        .filter((pair) => pair.cross_family)
        .map((pair) => pair.conditional_agreement),
    ),
    action_pairwise: actionPairs,
    register_pairwise: registerPairs,
  };
  const prohibitedToolEvents = rows.reduce(
    (sum, row) =>
      sum +
      ['primary', 'fidelity'].reduce(
        (instrumentSum, instrument) =>
          instrumentSum +
          judges.reduce(
            (judgeSum, judge) =>
              judgeSum + Number(row.pair[instrument]?.[judge.id]?.response?.provenance?.prohibited_tool_events || 0),
            0,
          ),
        0,
      ),
    0,
  );
  const gates = registration.measurement.validationGates;
  const primaryPassed =
    primaryMetrics.seat_eligibility_rate >= gates.primary.minimumSeatEligibilityRate &&
    primaryMetrics.panels_with_two_eligible_voters >= gates.primary.minimumPanelsWithTwoEligibleVoters &&
    Object.values(primaryMetrics.per_judge_conditional_accuracy).every(
      (value) => value >= gates.primary.minimumPerJudgeConditionalAccuracy,
    ) &&
    Object.values(primaryMetrics.per_judge_coverage).every((value) => value >= gates.primary.minimumPerJudgeCoverage) &&
    primaryMetrics.panel_sensitivity >= gates.primary.minimumPanelSensitivity &&
    primaryMetrics.panel_specificity >= gates.primary.minimumPanelSpecificity &&
    primaryMetrics.panel_exact_accuracy >= gates.primary.minimumPanelExactAccuracy &&
    primaryMetrics.panel_determined_coverage >= gates.primary.minimumPanelDeterminedCoverage &&
    Object.values(primaryMetrics.panel_coverage_by_stratum).every(
      (value) => value >= gates.primary.minimumPanelCoveragePerStratum,
    ) &&
    primaryMetrics.minimum_cross_family_joint_coverage >= gates.primary.minimumCrossFamilyJointCoverage &&
    primaryMetrics.minimum_cross_family_conditional_agreement >= gates.primary.minimumCrossFamilyConditionalAgreement;
  const fidelityPassed =
    fidelityMetrics.action_seat_eligibility_rate >= gates.fidelity.minimumSeatEligibilityRate &&
    fidelityMetrics.register_seat_eligibility_rate >= gates.fidelity.minimumSeatEligibilityRate &&
    Object.values(fidelityMetrics.per_judge_action_coverage).every(
      (value) => value >= gates.fidelity.minimumPerJudgeCoverage,
    ) &&
    Object.values(fidelityMetrics.per_judge_register_coverage).every(
      (value) => value >= gates.fidelity.minimumPerJudgeCoverage,
    ) &&
    Object.values(fidelityMetrics.per_judge_action_conditional_accuracy).every(
      (value) => value >= gates.fidelity.minimumPerJudgeActionConditionalAccuracy,
    ) &&
    Object.values(fidelityMetrics.per_judge_register_conditional_accuracy).every(
      (value) => value >= gates.fidelity.minimumPerJudgeRegisterConditionalAccuracy,
    ) &&
    fidelityMetrics.panel_action_accuracy >= gates.fidelity.minimumPanelActionAccuracy &&
    fidelityMetrics.panel_action_coverage >= gates.fidelity.minimumPanelActionCoverage &&
    fidelityMetrics.panel_register_accuracy >= gates.fidelity.minimumPanelRegisterAccuracy &&
    fidelityMetrics.panel_register_coverage >= gates.fidelity.minimumPanelRegisterCoverage &&
    Object.values(fidelityMetrics.panel_register_recall_by_class).every(
      (value) => value >= gates.fidelity.minimumPanelRegisterRecallPerClass,
    ) &&
    fidelityMetrics.minimum_cross_family_joint_coverage >= gates.fidelity.minimumCrossFamilyJointCoverage &&
    fidelityMetrics.minimum_cross_family_conditional_agreement >= gates.fidelity.minimumCrossFamilyConditionalAgreement;
  return {
    schema: 'machinespirits.tutor-stub.resistance-measurement-validation-score.v8',
    status: primaryPassed && fidelityPassed && prohibitedToolEvents === 0 ? 'passed' : 'failed',
    primary: { status: primaryPassed ? 'passed' : 'failed', metrics: primaryMetrics },
    fidelity: { status: fidelityPassed ? 'passed' : 'failed', metrics: fidelityMetrics },
    prohibited_tool_events: prohibitedToolEvents,
    primary_and_fidelity_claims_separate: true,
    fidelity_failure_may_erase_primary_validation: false,
    confirmation_ready: primaryPassed && fidelityPassed && prohibitedToolEvents === 0,
    cases: rows.length,
  };
}

export function buildTutorStubResistanceMeasurementZeroCallFixtureV8({ corpusCase, judge, instrument }) {
  if (instrument === 'primary_recovery') {
    const publicPacket = Object.fromEntries(PRIMARY_SOURCES.map((field) => [field, corpusCase[field]]));
    const prompt = buildTutorStubResistanceRecoveryPrimaryPromptV8({ caseId: corpusCase.case_id, publicPacket, judge });
    const judgment = Object.fromEntries(
      PRIMARY_FIELDS.map((field) => [
        field,
        {
          value: corpusCase.expected.primary[field],
          evidence_quotes: (corpusCase.expected.primary_evidence || [])
            .filter((quote) => quote.field === field)
            .map(({ source_id, text }) => ({ source_id, text })),
          confidence: 'high',
          indeterminacy_reason: 'none',
        },
      ]),
    );
    return {
      prompt,
      response: wrapTutorStubResistanceMeasurementModelOutputV8({
        instrument,
        modelOutput: {
          schema: TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_MODEL_SCHEMA_V8,
          case_id: corpusCase.case_id,
          judgment,
        },
        prompt,
        judge,
        observedProvider: judge.provider,
        observedModel: judge.model,
        observedEffort: judge.effort,
        independentRunId: `${corpusCase.case_id}-${judge.id}-${instrument}`,
        structuredOutput: true,
        prohibitedToolEvents: 0,
        modelAttestationBasis: judge.modelAttestationBasis,
        modelIndependentlyAttested: false,
      }),
    };
  }
  if (instrument === 'intervention_fidelity') {
    const prompt = buildTutorStubResistanceFidelityPromptV8({
      caseId: corpusCase.case_id,
      intervention: corpusCase.intervention,
      judge,
    });
    const judgment = Object.fromEntries(
      FIDELITY_FIELDS.map((field) => [
        field,
        {
          value: corpusCase.expected.fidelity[field],
          evidence_quotes: (corpusCase.expected.fidelity_evidence || [])
            .filter((quote) => quote.field === field)
            .map(({ source_id, text }) => ({ source_id, text })),
          confidence: 'high',
          indeterminacy_reason: 'none',
        },
      ]),
    );
    return {
      prompt,
      response: wrapTutorStubResistanceMeasurementModelOutputV8({
        instrument,
        modelOutput: { schema: TUTOR_STUB_RESISTANCE_FIDELITY_MODEL_SCHEMA_V8, case_id: corpusCase.case_id, judgment },
        prompt,
        judge,
        observedProvider: judge.provider,
        observedModel: judge.model,
        observedEffort: judge.effort,
        independentRunId: `${corpusCase.case_id}-${judge.id}-${instrument}`,
        structuredOutput: true,
        prohibitedToolEvents: 0,
        modelAttestationBasis: judge.modelAttestationBasis,
        modelIndependentlyAttested: false,
      }),
    };
  }
  throw new Error('unknown zero-call fixture instrument');
}
