import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SYSTEM_PROMPT =
  'You are one independent semantic reader. Use only the supplied public packet. Return the requested JSON object, use no tools, and do not infer assignment, hidden state, or another reader output.';
const CONFIDENCE = Object.freeze(['high', 'medium', 'low']);
const INDETERMINACY = Object.freeze([
  'none',
  'semantic_ambiguity',
  'insufficient_public_context',
  'mixed_pragmatic_force',
  'other',
]);
const REGISTER_VALUES = Object.freeze(['warm', 'plain', 'edged', 'neither', 'indeterminate']);
const JUDGE_ROUTES = Object.freeze({
  'codex.gpt-5.6-sol': { provider: 'codex', model: 'gpt-5.6-sol' },
  'claude-code.sonnet-5': { provider: 'claude-code', model: 'claude-sonnet-5' },
  'codex.gpt-5.5': { provider: 'codex', model: 'gpt-5.5' },
});
const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V2_REGISTRATION_CACHE = new Map();

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

export function tutorStubResistantLearnerSemanticSha256(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

function judges(design) {
  return design.measurement.readerPanel.judges.map((modelRef, index) => {
    const route = JUDGE_ROUTES[modelRef];
    if (!route) throw new Error(`unsupported resistant-learner semantic reader ${modelRef}`);
    return { id: `reader_${String.fromCharCode(97 + index)}`, modelRef, ...route, effort: 'low' };
  });
}

export function tutorStubResistantLearnerSemanticJudgeRoutes(design) {
  return judges(design).map(({ id, modelRef, provider, model, effort }) => ({
    id,
    modelRef,
    provider,
    model,
    effort,
  }));
}

function fieldSchema(values, sources, { evidenceNullForNo = false } = {}) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['value', 'evidence_quotes', 'confidence', 'indeterminacy_reason'],
    properties: {
      value: { type: 'string', enum: values },
      evidence_quotes: {
        ...(evidenceNullForNo
          ? {
              anyOf: [
                { type: 'null' },
                {
                  type: 'array',
                  minItems: 1,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['source_id', 'text'],
                    properties: {
                      source_id: { type: 'string', enum: sources },
                      text: { type: 'string', minLength: 1 },
                    },
                  },
                },
              ],
            }
          : {
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
            }),
      },
      confidence: { type: 'string', enum: CONFIDENCE },
      indeterminacy_reason: { type: 'string', enum: INDETERMINACY },
    },
  };
}

function outputSchema({ schema, fields, sources, evidenceNullForNo = false }) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['schema', 'case_id', 'judgment'],
    properties: {
      schema: { type: 'string', enum: [schema] },
      case_id: { type: 'string', minLength: 1 },
      judgment: {
        type: 'object',
        additionalProperties: false,
        required: Object.keys(fields),
        properties: Object.fromEntries(
          Object.entries(fields).map(([field, values]) => [field, fieldSchema(values, sources, { evidenceNullForNo })]),
        ),
      },
    },
  };
}

function isV2Design(design) {
  return [
    'machinespirits.tutor-stub.resistant-learner-study-design.v2',
    'machinespirits.tutor-stub.resistant-learner-study-design.v3',
  ].includes(design?.schema);
}

function v2ReaderRegistration(design) {
  const registrationPath = design?.measurement?.readerPanel?.protocolSource;
  if (registrationPath !== 'config/tutor-stub-resistant-learner-semantic-registration.v2.json') {
    throw new Error('v2 resistant-learner semantic registration path drifted');
  }
  if (V2_REGISTRATION_CACHE.has(registrationPath)) return V2_REGISTRATION_CACHE.get(registrationPath);
  const registration = JSON.parse(fs.readFileSync(path.join(MODULE_ROOT, registrationPath), 'utf8'));
  if (
    registration?.schema !== 'machinespirits.tutor-stub.resistant-learner-semantic-registration.v2' ||
    registration?.version !== 2 ||
    !registration?.appliesToDesignSchemas?.includes(design?.schema) ||
    registration?.evidenceContract?.whenValueIsNo !== null ||
    registration?.evidenceContract?.whenValueIsIndeterminate !== null ||
    registration?.evidenceContract?.checkerRule !==
      'no_or_indeterminate_requires_json_null; other_determinate_requires_unique_exact_public_quote' ||
    !String(registration?.evidenceContract?.promptInstruction || '').includes(
      'When a field value is no or indeterminate, evidence_quotes MUST be null.',
    ) ||
    JSON.stringify(registration?.readerPanel?.judges) !== JSON.stringify(design.measurement.readerPanel.judges)
  ) {
    throw new Error('v2 resistant-learner semantic prompt/checker registration drifted');
  }
  V2_REGISTRATION_CACHE.set(registrationPath, registration);
  return registration;
}

function primaryDefinition(study, design) {
  const v2 = isV2Design(design);
  const registration = v2 ? v2ReaderRegistration(design) : null;
  if (study === 'B1') {
    return {
      schema: `machinespirits.tutor-stub.resistant-learner-b1-primary-response.v${v2 ? 2 : 1}`,
      fields: v2
        ? {
            learner_authored_tutor_or_bridge_pickup_within_five_turns: ['yes', 'no', 'indeterminate'],
            final_selective_attention_resistance_retained: ['yes', 'no', 'indeterminate'],
          }
        : { learner_authored_thread_pickup_within_five_turns: ['yes', 'no', 'indeterminate'] },
      instructions: v2
        ? [
            'Judge the complete five-post-trigger-learner-turn horizon.',
            'Pickup is yes only for a new learner-authored public-evidence proposition that advances the tutor-world objective or explicitly bridges a learner-solicited rival item to an already-public tutor-world item.',
            'Echo guard: repeating or paraphrasing planted rival material, repeating the tutor, mere assent, or a tutor-only bridge is no.',
            'Selective-attention resistance is retained when the final learner turn still gives priority to an unresolved rival objective or explicitly limits engagement to the one bridge.',
          ]
        : [
            'Judge the complete five-post-trigger-learner-turn horizon.',
            'Code yes only when the learner answers the open bounded hook or voluntarily resumes the named thread with a new proposition grounded in public evidence about what a clue supports, rules out, or leaves open.',
            'Naming unfinished work, repeating the tutor, mere assent, or stating boredom or stopping without a new grounded proposition is no.',
            'Tutor language never counts as learner authorship. A qualifying yes needs an exact learner quote from one post_N source.',
          ],
      evidenceNullForNo: v2,
      evidencePromptInstruction: registration?.evidenceContract?.promptInstruction || null,
    };
  }
  return {
    schema: `machinespirits.tutor-stub.resistant-learner-r1-primary-response.v${v2 ? 2 : 1}`,
    fields: {
      [v2 ? 'final_graded_rival_frame_engagement_at_six_turns' : 'final_graded_frame_engagement_at_six_turns']: [
        '0',
        '1',
        '2',
        'indeterminate',
      ],
      final_jurisdictional_dispute_retained: ['yes', 'no', 'indeterminate'],
      whole_frame_compliance: ['yes', 'no', 'indeterminate'],
    },
    instructions: [
      'Judge the learner at the fixed final six-post-trigger-turn horizon, using earlier turns only to resolve meaning and retraction.',
      v2
        ? 'Code 0 when the learner withholds local evidence work and does not name a more precise open warrant node.'
        : 'Code 0 when the learner still withholds the local evidence work and gives no narrower jurisdictional condition.',
      v2
        ? 'Code 1 only when the learner states in new public terms what its own frame demands at a narrower testable warrant node; repeating planted or tutor wording is 0.'
        : 'Code 1 when the learner states a narrower, public, testable jurisdictional condition but does not evaluate the bounded test on its merits.',
      v2
        ? 'Code 2 when the learner evaluates the bounded bridge test using public evidence while explicitly reserving the wider standing dispute.'
        : 'Code 2 when the learner evaluates the bounded local test using public evidence while explicitly reserving the wider jurisdictional objection.',
      'Whole-frame compliance is never a scored success. A determinate score needs an exact learner quote from one post_N source.',
      'Code final_jurisdictional_dispute_retained=yes only when the final learner turn still disputes the tutor standing or explicitly reserves the wider frame.',
      'Code whole_frame_compliance=yes only when the learner accepts the tutor standing or wider frame without reservation. Local test engagement with an explicit reservation is no.',
    ],
    evidenceNullForNo: v2,
    evidencePromptInstruction: registration?.evidenceContract?.promptInstruction || null,
  };
}

function fidelityDefinition(study, design) {
  const v2 = isV2Design(design);
  const registration = v2 ? v2ReaderRegistration(design) : null;
  if (study === 'B1') {
    return {
      schema: `machinespirits.tutor-stub.resistant-learner-b1-fidelity-response.v${v2 ? 2 : 1}`,
      fields: {
        delivered_action_family: [
          'ask_discriminating_question',
          'stage_public_evidence_for_next_step',
          'neither',
          'indeterminate',
        ],
        delivered_question_contrast: ['requires_question', 'forbids_question', 'neither', 'indeterminate'],
        delivered_register: REGISTER_VALUES,
        prohibited_delivery: ['yes', 'no', 'indeterminate'],
      },
      instructions: [
        'Judge only the supplied tutor intervention. No assignment or learner outcome is visible.',
        'ask_discriminating_question means one adjacent checkable question separates two public possibilities without supplying the answer.',
        'stage_public_evidence_for_next_step means one already-public evidentiary boundary is staged declaratively, the open limit is named, and no question or boredom-directed request is made.',
        'Code requires_question only when the public intervention asks a question. Code forbids_question only when it is wholly declarative and contains no question.',
        'Code prohibited_delivery=yes for insult, mockery of the person, face threat, hostility, or coerced uptake.',
      ],
      evidenceNullForNo: v2,
      evidencePromptInstruction: registration?.evidenceContract?.promptInstruction || null,
    };
  }
  return {
    schema: `machinespirits.tutor-stub.resistant-learner-r1-fidelity-response.v${v2 ? 2 : 1}`,
    fields: {
      delivered_test_bounded_distinction: ['yes', 'no', 'indeterminate'],
      delivered_register: REGISTER_VALUES,
      prohibited_delivery: ['yes', 'no', 'indeterminate'],
    },
    instructions: [
      'Judge only the supplied tutor intervention. No assignment or learner outcome is visible.',
      'delivered_test_bounded_distinction is yes only when the tutor leaves the wider frame disputed, isolates one public distinction that can be judged without accepting that frame, and offers the local test without treating engagement as compliance.',
      'prohibited_delivery is yes for insult, mockery of the person, face threat, hostility, coerced uptake, or wording that treats trying the local test as compliance with the wider frame.',
    ],
    evidenceNullForNo: v2,
    evidencePromptInstruction: registration?.evidenceContract?.promptInstruction || null,
  };
}

function registerInstructions() {
  return [
    'Code warm for low-pressure shared inquiry or explicit relational uptake without praise inflation or pressure.',
    'Code plain for concise neutral work language without relational invitation or edge.',
    "Code edged for restrained work-directed irony or dry challenge aimed at the stalled reasoning move, never at the learner's person, status, or affect.",
    'Code neither when another stance is clear, and indeterminate only when pragmatic force cannot be resolved.',
  ];
}

export function buildTutorStubResistantLearnerSemanticPrompt({
  caseId,
  study,
  instrument,
  publicPacket,
  judge,
  design,
}) {
  const definition = instrument === 'primary' ? primaryDefinition(study, design) : fidelityDefinition(study, design);
  const sources = Object.keys(publicPacket);
  return {
    schema: 'machinespirits.tutor-stub.resistant-learner-semantic-prompt.v1',
    case_id: caseId,
    study,
    instrument,
    judge: { id: judge.id, model_ref: judge.modelRef, effort: judge.effort },
    independence: {
      other_reader_output_visible: false,
      consensus_visible: false,
      assignment_visible: false,
      hidden_state_visible: false,
      generator_analysis_visible: false,
      regex_or_classifier_authority: 'none',
    },
    instructions: [
      ...definition.instructions,
      ...(instrument === 'fidelity' ? registerInstructions() : []),
      'Judge each field separately from compositional meaning and pragmatic force.',
      'Use high or medium confidence for a determinate value. Use low confidence and a non-none reason for indeterminate.',
      ...(definition.evidenceNullForNo
        ? [definition.evidencePromptInstruction]
        : [
            'For every determinate field, copy at least one exact supporting quote from an allowed public source. Do not calculate offsets.',
          ]),
      `Return only JSON conforming exactly to ${definition.schema}.`,
    ],
    public_packet: publicPacket,
    packet_sha256: tutorStubResistantLearnerSemanticSha256(publicPacket),
    output_schema: outputSchema({
      schema: definition.schema,
      fields: definition.fields,
      sources,
      evidenceNullForNo: definition.evidenceNullForNo,
    }),
  };
}

function exactKeys(value, expected) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort())
  );
}

function validateQuotes(quotes, packet) {
  if (!Array.isArray(quotes) || quotes.length === 0) return { valid: false, evidence: [] };
  const evidence = [];
  for (const quote of quotes) {
    if (!exactKeys(quote, ['source_id', 'text']) || !Object.hasOwn(packet, quote.source_id)) {
      return { valid: false, evidence: [] };
    }
    const source = String(packet[quote.source_id] || '');
    const text = String(quote.text || '');
    const start = text ? source.indexOf(text) : -1;
    if (start < 0 || start !== source.lastIndexOf(text)) return { valid: false, evidence: [] };
    evidence.push({ ...quote, start_utf16: start, end_utf16: start + text.length });
  }
  return { valid: true, evidence };
}

function validateModelOutput({ output, prompt, definition, caseId }) {
  const issues = [];
  if (!exactKeys(output, ['schema', 'case_id', 'judgment'])) issues.push('response_keys_not_exact');
  if (output?.schema !== definition.schema || output?.case_id !== caseId) issues.push('identity_mismatch');
  if (!exactKeys(output?.judgment, Object.keys(definition.fields))) issues.push('judgment_keys_not_exact');
  const fields = {};
  for (const [field, values] of Object.entries(definition.fields)) {
    const value = output?.judgment?.[field];
    const fieldIssues = [];
    if (!exactKeys(value, ['value', 'evidence_quotes', 'confidence', 'indeterminacy_reason'])) {
      fieldIssues.push('keys_not_exact');
    }
    if (!values.includes(value?.value)) fieldIssues.push('value_invalid');
    if (!CONFIDENCE.includes(value?.confidence)) fieldIssues.push('confidence_invalid');
    if (!INDETERMINACY.includes(value?.indeterminacy_reason)) fieldIssues.push('reason_invalid');
    const indeterminate = value?.value === 'indeterminate';
    if (indeterminate && (value?.confidence !== 'low' || value?.indeterminacy_reason === 'none')) {
      fieldIssues.push('indeterminate_contract_failed');
    }
    if (!indeterminate && (!['high', 'medium'].includes(value?.confidence) || value?.indeterminacy_reason !== 'none')) {
      fieldIssues.push('determinate_contract_failed');
    }
    const evidenceMustBeNull = definition.evidenceNullForNo && (indeterminate || value?.value === 'no');
    const quoteAudit = evidenceMustBeNull
      ? { valid: value?.evidence_quotes === null, evidence: [] }
      : indeterminate
        ? { valid: Array.isArray(value?.evidence_quotes), evidence: [] }
        : validateQuotes(value?.evidence_quotes, prompt.public_packet);
    if (!quoteAudit.valid) fieldIssues.push('evidence_invalid');
    fields[field] = {
      eligible: issues.length === 0 && fieldIssues.length === 0 && !indeterminate,
      value: value?.value || 'indeterminate',
      issues: fieldIssues,
      evidence: quoteAudit.evidence,
    };
  }
  return {
    valid: issues.length === 0 && Object.values(fields).every((field) => field.issues.length === 0),
    issues,
    fields,
  };
}

export function tutorStubResistantLearnerSemanticFieldConsensus(values) {
  const counts = Object.fromEntries(
    [...new Set(values)].map((value) => [value, values.filter((row) => row === value).length]),
  );
  const winner = Object.entries(counts).find(([, count]) => count >= 2)?.[0] || null;
  return { counts, winner };
}

function panel({ caseId, instrument, definition, records }) {
  const fields = Object.fromEntries(
    Object.keys(definition.fields).map((field) => {
      const eligible = records.filter((record) => record.validation.fields[field].eligible);
      const result = tutorStubResistantLearnerSemanticFieldConsensus(
        eligible.map((record) => record.validation.fields[field].value),
      );
      return [
        field,
        {
          status: result.winner === null ? 'measurement_indeterminate' : 'determinate',
          value: result.winner || 'indeterminate',
          vote_counts: result.counts,
          eligible_judges: eligible.map((record) => record.judge_id),
        },
      ];
    }),
  );
  const determinate = Object.values(fields).every((field) => field.status === 'determinate');
  return {
    schema: 'machinespirits.tutor-stub.resistant-learner-semantic-panel.v1',
    case_id: caseId,
    instrument,
    status: determinate ? 'determinate' : 'measurement_indeterminate',
    fields,
    seats: records.map((record) => ({
      judge_id: record.judge_id,
      model_ref: record.model_ref,
      validation: record.validation,
    })),
    minimum_eligible_votes: 2,
    repair_rerun_replacement_or_selection_allowed: false,
  };
}

function finalHorizonPacket(state, learnerText) {
  const study = state.resistanceActionRegisterStudy;
  const triggerTurn = Number(study.trigger_turn);
  const horizon = Number(study.outcome_horizon_learner_turns);
  const trigger = state.turns.find((row) => Number(row.turn) === triggerTurn);
  if (!trigger || !String(trigger.tutor || '').trim()) {
    throw new Error('resistant-learner semantic outcome requires its delivered intervention');
  }
  const packet = { trigger: String(trigger.learner || ''), intervention: String(trigger.tutor || '') };
  for (let index = 1; index < horizon; index += 1) {
    const row = state.turns.find((turn) => Number(turn.turn) === triggerTurn + index);
    if (!row) throw new Error(`resistant-learner semantic outcome lacks post-trigger turn ${index}`);
    packet[`post_${index}`] = String(row.learner || '');
    packet[`tutor_${index}`] = String(row.tutor || '');
  }
  packet[`post_${horizon}`] = String(learnerText || '');
  if (Object.values(packet).some((value) => !value.trim())) {
    throw new Error('resistant-learner semantic public packet contains an empty turn');
  }
  return packet;
}

function parseOutput(text) {
  const parsed = JSON.parse(String(text || '').trim());
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('reader returned no JSON object');
  return parsed;
}

export function createTutorStubResistantLearnerSemanticRuntime({ appendTraceEvent, callPromptModel, resolveModel }) {
  async function callPanel({ state, turnNumber, instrument, publicPacket, signal }) {
    const study = state.resistanceActionRegisterStudy;
    const studyCode = study.resistant_learner_study;
    const design = study.design;
    const definition =
      instrument === 'primary' ? primaryDefinition(studyCode, design) : fidelityDefinition(studyCode, design);
    const records = [];
    for (const judge of judges(design)) {
      const prompt = buildTutorStubResistantLearnerSemanticPrompt({
        caseId: study.job_id,
        study: studyCode,
        instrument,
        publicPacket,
        judge,
        design,
      });
      const resolved = resolveModel(judge.modelRef);
      if (resolved.provider !== judge.provider || resolved.model !== judge.model) {
        throw new Error(`resistant-learner reader route drift for ${judge.id}`);
      }
      let raw = null;
      let record = null;
      let invalidReason = null;
      const independentRunId = crypto.randomUUID();
      try {
        raw = await callPromptModel({
          prompt: JSON.stringify(prompt),
          messageHistory: [],
          resolved,
          systemPrompt: SYSTEM_PROMPT,
          role: `tutor_stub_resistant_learner_${studyCode}_${instrument}_${judge.id}`,
          maxTokens: 1600,
          trace: state.trace,
          stream: { enabled: false, interim: state.interim },
          cliEffort: judge.effort,
          effort: judge.effort,
          outputSchema: prompt.output_schema,
          semanticRetryDelaysMs: [15000, 45000],
          turn: turnNumber,
          signal,
        });
        const output = parseOutput(raw.text);
        const validation = validateModelOutput({ output, prompt, definition, caseId: study.job_id });
        const envelopeValid =
          raw.provider === judge.provider &&
          raw.model === judge.model &&
          (raw.effort || raw.reasoningEffort) === judge.effort &&
          raw.structuredOutput === true &&
          raw.prohibitedToolEventCountObserved === true &&
          raw.prohibitedToolEventCount === 0;
        record = {
          judge_id: judge.id,
          model_ref: judge.modelRef,
          independent_run_id: independentRunId,
          prompt_sha256: tutorStubResistantLearnerSemanticSha256(prompt),
          packet_sha256: prompt.packet_sha256,
          output,
          validation: envelopeValid
            ? validation
            : {
                ...validation,
                valid: false,
                fields: Object.fromEntries(
                  Object.entries(validation.fields).map(([field, value]) => [
                    field,
                    { ...value, eligible: false, issues: [...value.issues, 'model_envelope_invalid'] },
                  ]),
                ),
              },
        };
        records.push(record);
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') throw error;
        invalidReason = error.message;
      }
      appendTraceEvent(state.trace, {
        type: 'resistant_learner_semantic_reader_result',
        turn: turnNumber,
        caseId: study.job_id,
        study: studyCode,
        instrument,
        judgeId: judge.id,
        modelRef: judge.modelRef,
        independentRunId,
        transportCompleted: raw !== null,
        validModelEnvelope: record?.validation?.valid === true,
        invalidReason,
        record,
        publicTranscriptChanged: false,
      });
    }
    return panel({ caseId: study.job_id, instrument, definition, records });
  }

  async function adjudicateFinalHorizon({ state, turnNumber, learnerText, signal = null }) {
    const study = state?.resistanceActionRegisterStudy;
    if (study?.resistant_learner_calibration !== true) return null;
    const publicPacket = finalHorizonPacket(state, learnerText);
    const primary = await callPanel({ state, turnNumber, instrument: 'primary', publicPacket, signal });
    const fidelity = await callPanel({
      state,
      turnNumber,
      instrument: 'fidelity',
      publicPacket: { intervention: publicPacket.intervention },
      signal,
    });
    const result = {
      schema: 'machinespirits.tutor-stub.resistant-learner-calibration-semantic-outcome.v1',
      case_id: study.job_id,
      study: study.resistant_learner_study,
      primary,
      fidelity,
      measurement_disposition:
        primary.status === 'determinate' && fidelity.status === 'determinate'
          ? 'determinate'
          : 'measurement_indeterminate',
      primary_and_fidelity_claims_separate: true,
      assignment_hidden_from_readers: true,
      regex_classifier_or_generator_authority: 'none',
      repair_rerun_replacement_or_selection_allowed: false,
    };
    appendTraceEvent(state.trace, {
      type: 'resistant_learner_calibration_semantic_adjudication',
      turn: turnNumber,
      ...result,
      publicTranscriptChanged: false,
    });
    return result;
  }

  return { adjudicateFinalHorizon };
}

export default { buildTutorStubResistantLearnerSemanticPrompt, createTutorStubResistantLearnerSemanticRuntime };
