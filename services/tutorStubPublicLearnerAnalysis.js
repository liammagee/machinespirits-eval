import { createHash } from 'node:crypto';

import { closure, factKey, matchPattern } from './dramaticDerivation/chainer.js';
import { buildLearnerDag, buildLearnerDagSnapshot } from './dramaticDerivation/learnerDag.js';
import { buildLearnerProxyDagMemory, buildTutorLearnerDagModel } from './dramaticDerivation/proxyDagMemory.js';
import {
  TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
  applyTutorStubDagFactDropout,
  createTutorStubDagFactDropoutState,
} from './tutorStubDagFactDropout.js';
import { closeTruncatedTutorStubJson, normalizeTutorStubAnalysisEnvelope } from './tutorStubJson.js';
import { buildTutorStubStateObservation } from './adaptiveTutor/tutorStubStateAdapter.js';

export const TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_SYSTEM_PROMPT = [
  'You are a compact up-front reviewer for an experimental tutor.',
  'Return a pedagogical discourse classification, a conservative public learner-record update, and, only when requested, a reviewer-chosen tutor engagement stance.',
  'Use only the learner input, the public transcript, public rules, and staged public evidence supplied in the prompt.',
  'Do not infer hidden story facts, concealed answers, private tutor prompts, proof paths, or unstaged evidence.',
  'Do not use tools, commands, files, browsing, external retrieval, or side effects.',
  'Return one JSON object only. No prose outside JSON.',
].join('\n');

export const TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES = Object.freeze({
  STRICT_BENCHMARK: 'strict_benchmark',
  INTERACTIVE: 'interactive',
});

export const TUTOR_STUB_PUBLIC_STAGED_EVIDENCE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['premise', 'turn', 'via', 'surface', 'fact'],
  properties: {
    premise: { type: 'string' },
    turn: { type: ['number', 'null'] },
    via: { type: 'string' },
    surface: { type: 'string' },
    fact: { type: 'array', minItems: 1, items: { type: 'string' } },
  },
});

export const TUTOR_STUB_PUBLIC_RELEASE_LEDGER_ROW_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['premise', 'turn', 'via', 'surface', 'fact'],
  properties: {
    premise: { type: 'string' },
    turn: { type: ['number', 'null'] },
    via: { type: 'string' },
    surface: { type: 'string' },
    fact: { type: 'array', minItems: 1, items: { type: 'string' } },
  },
});

const LOCAL_REGISTER_POLICIES = new Set([
  'field',
  'trajectory',
  'dynamical_system',
  'empirical_dynamical_system',
  'continuous_dynamical_system',
  'continuous_empirical_dynamical_system',
  'state',
  'random',
  'bland',
  'negative',
]);

const CONTROLLED_CLASSIFIER_FIELDS = [
  'summary',
  'request_type',
  'discourse_move',
  'evidence_use',
  'epistemic_stance',
  'affect',
  'agency',
  'scores',
  'pedagogical_need',
];

const CONTROLLED_OVERALL_FIELDS = [
  'summary',
  'trajectory',
  'recurring_pattern',
  'current_state',
  'next_best_tutor_move',
];

const LEARNER_RECORD_FIELDS = ['adopt', 'retract', 'derive', 'hypothesis', 'assert_answer', 'human_discourse', 'notes'];

const REGISTER_SELECTION_FIELDS = [
  'engagement_stance',
  'reviewer_signal',
  'request_type',
  'engagement_stance_reason',
  'evidence_span',
  'risk_flags',
  'expected_dag_move',
  'expected_field_move',
  'expected_progress_marker',
  'confidence',
];

const DETERMINISTIC_POSTPROCESSOR_ONLY_FIELDS = [
  'world',
  'record',
  'learnerRecord',
  'dropout',
  'dropoutReplay',
  'previousObservation',
  'previousTurnRecords',
  'humanDiscourseFrame',
  'publicReleaseLedger',
  'deterministicPostprocessorInput',
];

const HUMAN_DISCOURSE_FIELDS = [
  'proof_status',
  'provisional_claims',
  'implied_warrants',
  'missing_warrants',
  'implied_public_premises',
  'suppressed_or_private_premises',
  'common_sense_bridges',
  'illicit_hidden_premises',
  'proof_debt_candidates',
  'side_arc',
];

const HUMAN_DISCOURSE_ROW_FIELDS = [
  'surface',
  'text',
  'claim',
  'premise',
  'warrant_needed',
  'missing_warrant',
  'reason',
  'note',
  'severity',
  'source',
];

const HUMAN_DISCOURSE_ARRAY_FIELDS = HUMAN_DISCOURSE_FIELDS.filter(
  (field) => !['proof_status', 'side_arc'].includes(field),
);

const SIDE_ARC_FIELDS = ['detected', 'type', 'reason', 'return_target'];
const SIDE_ARC_TYPES = ['clarification', 'vocabulary', 'affective', 'trust', 'off_path'];

const CONTROLLED_ENUMS = Object.freeze({
  request_type: new Set([
    'conceptual_clarity_request',
    'stepwise_support_request',
    'authority_refusal_or_status_challenge',
    'plain_language_request',
    'plain_simplification_followup',
    'transfer_demand_or_named_material',
    'vulnerability_or_moral_exposure',
    'resistance_or_low_agency',
    'answer_seeking_or_overreach',
    'off_task_or_mixed',
  ]),
  discourse_move: new Set([
    'question',
    'claim',
    'hypothesis',
    'inference',
    'evidence_adoption',
    'challenge',
    'repair_request',
    'affective_signal',
    'answer_seeking',
    'metacognitive_reflection',
    'off_task',
  ]),
  evidence_use: new Set([
    'none',
    'repeats_setup',
    'cites_public_evidence',
    'omits_warrant',
    'links_evidence_to_rule',
    'overleaps_evidence',
    'distorts_public_evidence',
    'revises_from_evidence',
  ]),
  epistemic_stance: new Set([
    'receptive',
    'confused',
    'exploratory',
    'overconfident',
    'resistant',
    'answer_seeking',
    'reflective',
    'grounded',
  ]),
  agency: new Set(['passive', 'complying', 'attempting', 'steering', 'self_correcting']),
  proof_status: new Set(['strict_proof', 'provisional_scaffold', 'side_arc', 'hidden_premise_risk', 'unclear']),
});

function scoreOutputSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['score', 'reason'],
    properties: {
      score: { type: 'number', minimum: 1, maximum: 5 },
      reason: { type: 'string' },
    },
  };
}

function discourseOutputSchema() {
  const discourseRow = {
    oneOf: [
      { type: 'string' },
      {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: Object.fromEntries(HUMAN_DISCOURSE_ROW_FIELDS.map((field) => [field, { type: 'string' }])),
      },
    ],
  };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['proof_status'],
    properties: {
      proof_status: {
        type: 'string',
        enum: [...CONTROLLED_ENUMS.proof_status],
      },
      ...Object.fromEntries(
        HUMAN_DISCOURSE_ARRAY_FIELDS.map((field) => [field, { type: 'array', items: discourseRow }]),
      ),
      side_arc: {
        type: 'object',
        additionalProperties: false,
        required: ['detected', 'type', 'reason', 'return_target'],
        properties: {
          detected: { type: 'boolean' },
          type: { type: ['string', 'null'], enum: [...SIDE_ARC_TYPES, null] },
          reason: { type: ['string', 'null'] },
          return_target: { type: ['string', 'null'] },
        },
      },
    },
  };
}

/**
 * Machine-readable output constraint for paid benchmark calls. The interactive
 * tutor does not use this constraint, so its existing tolerant parsing surface
 * is unchanged.
 */
export function buildTutorStubPublicLearnerAnalysisOutputSchema({ includeRegisterSelection = false } = {}) {
  const properties = {
    classification: {
      type: 'object',
      additionalProperties: false,
      required: ['turn', 'overall'],
      properties: {
        turn: {
          type: 'object',
          additionalProperties: false,
          required: CONTROLLED_CLASSIFIER_FIELDS,
          properties: {
            summary: { type: 'string' },
            request_type: { type: 'string', enum: [...CONTROLLED_ENUMS.request_type] },
            discourse_move: { type: 'string', enum: [...CONTROLLED_ENUMS.discourse_move] },
            evidence_use: { type: 'string', enum: [...CONTROLLED_ENUMS.evidence_use] },
            epistemic_stance: { type: 'string', enum: [...CONTROLLED_ENUMS.epistemic_stance] },
            affect: { type: 'string' },
            agency: { type: 'string', enum: [...CONTROLLED_ENUMS.agency] },
            scores: {
              type: 'object',
              additionalProperties: false,
              required: ['conceptual_engagement', 'epistemic_readiness'],
              properties: {
                conceptual_engagement: scoreOutputSchema(),
                epistemic_readiness: scoreOutputSchema(),
              },
            },
            pedagogical_need: { type: 'string' },
          },
        },
        overall: {
          type: 'object',
          additionalProperties: false,
          required: CONTROLLED_OVERALL_FIELDS,
          properties: Object.fromEntries(CONTROLLED_OVERALL_FIELDS.map((field) => [field, { type: 'string' }])),
        },
      },
    },
    learner_record: {
      type: 'object',
      additionalProperties: false,
      properties: {
        adopt: { type: 'array', items: { type: 'string' } },
        retract: { type: 'array', items: { type: 'string' } },
        derive: {
          type: 'array',
          items: { type: 'array', minItems: 1, items: { type: 'string' } },
        },
        hypothesis: { type: ['string', 'null'] },
        assert_answer: { type: ['string', 'null'] },
        human_discourse: discourseOutputSchema(),
        notes: { type: 'string' },
      },
    },
  };
  const required = ['classification', 'learner_record'];
  if (includeRegisterSelection) {
    properties.register_selection = {
      type: 'object',
      additionalProperties: false,
      required: REGISTER_SELECTION_FIELDS,
      properties: {
        engagement_stance: { type: 'string' },
        reviewer_signal: { type: 'string' },
        request_type: { type: 'string' },
        engagement_stance_reason: { type: 'string' },
        evidence_span: { type: 'string' },
        risk_flags: { type: 'array', items: { type: 'string' } },
        expected_dag_move: { type: 'string' },
        expected_field_move: { type: 'string' },
        expected_progress_marker: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
    };
    required.push('register_selection');
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'TutorStubPublicLearnerAnalysis',
    type: 'object',
    additionalProperties: false,
    required,
    properties,
  };
}

export const TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_OUTPUT_SCHEMA = Object.freeze(
  buildTutorStubPublicLearnerAnalysisOutputSchema(),
);

export class TutorStubPublicLearnerAnalysisError extends Error {
  constructor(message, { code = 'public_learner_analysis_error', cause = null, details = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'TutorStubPublicLearnerAnalysisError';
    this.code = code;
    this.details = details;
  }
}

function sha256(value) {
  return createHash('sha256')
    .update(String(value ?? ''))
    .digest('hex');
}

function jsonClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function finiteTurnOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function slashModelRef(provider, model) {
  const safeProvider = String(provider || '').trim();
  const safeModel = String(model || '').trim();
  if (!safeProvider || !safeModel) return null;
  return safeModel.startsWith(`${safeProvider}/`) ? safeModel : `${safeProvider}/${safeModel}`;
}

function flatCallMetadata(callMetadata, response, { status = 'success', dispatchCount = 1 } = {}) {
  return {
    schema: 'machinespirits.tutor-stub.public-learner-analysis-flat-call.v1',
    status,
    requested_model_ref: callMetadata.requested.model || null,
    resolved_provider: callMetadata.resolved.provider || null,
    resolved_model: callMetadata.resolved.model || null,
    resolved_model_ref: slashModelRef(callMetadata.resolved.provider, callMetadata.resolved.model),
    observed_provider: callMetadata.returned.provider || null,
    observed_model: callMetadata.returned.model || null,
    observed_model_ref: slashModelRef(callMetadata.returned.provider, callMetadata.returned.model),
    model_attestation_basis: callMetadata.modelAttestationBasis || null,
    model_independently_attested: callMetadata.modelIndependentlyAttested === true,
    effort: callMetadata.effort,
    timeout_ms: callMetadata.timeoutMs,
    latency_ms: callMetadata.latencyMs,
    dispatch_count: dispatchCount,
    attempts: dispatchCount,
    semantic_rerolls: 0,
    structured_output_reported:
      response?.structuredOutput === true ||
      callMetadata.injectedCallMetadata?.structured_output_reported === true ||
      callMetadata.injectedCallMetadata?.structuredOutputReported === true,
    stream_event_type_counts: jsonClone(callMetadata.streamEventTypeCounts || {}),
    stream_item_type_counts: jsonClone(callMetadata.streamItemTypeCounts || {}),
    structured_event_audit: jsonClone(callMetadata.structuredEventAudit || null),
    prohibited_tool_event_count: Number(callMetadata.prohibitedToolEventCount || 0),
    input_sha256: callMetadata.hashes.inputSha256,
    system_prompt_sha256: callMetadata.hashes.systemPromptSha256,
    prompt_sha256: callMetadata.hashes.promptSha256,
    output_schema_sha256: callMetadata.hashes.outputSchemaSha256,
    raw_output_sha256: callMetadata.hashes.rawOutputSha256,
    parsed_output_sha256: callMetadata.hashes.parsedOutputSha256,
  };
}

function detailedCallMetadata({
  modelCallOptions = {},
  response = null,
  injectedCallMetadata = null,
  strict,
  analysisPrompt = null,
  outputSchema = null,
  rawText = null,
  parsed = null,
  effectiveRole,
  attemptCount = 0,
  fallbackUsed = false,
} = {}) {
  return {
    schema: 'machinespirits.tutor-stub.public-learner-analysis-call.v1',
    structuredOutput: strict,
    requested: {
      provider:
        modelCallOptions.requestedProvider ||
        injectedCallMetadata?.requested?.provider ||
        injectedCallMetadata?.requested_provider ||
        null,
      model:
        modelCallOptions.requestedModel ||
        modelCallOptions.modelRef ||
        injectedCallMetadata?.requested?.model ||
        injectedCallMetadata?.requested_model_ref ||
        null,
    },
    resolved: {
      provider:
        modelCallOptions.resolvedProvider ||
        modelCallOptions.resolved?.provider ||
        injectedCallMetadata?.resolved?.provider ||
        injectedCallMetadata?.resolved_provider ||
        null,
      model:
        modelCallOptions.resolvedModel ||
        modelCallOptions.resolved?.model ||
        injectedCallMetadata?.resolved?.model ||
        injectedCallMetadata?.resolved_model ||
        null,
    },
    returned: {
      provider:
        response?.provider ||
        injectedCallMetadata?.observed?.provider ||
        injectedCallMetadata?.observed_provider ||
        null,
      model: response?.model || injectedCallMetadata?.observed?.model || injectedCallMetadata?.observed_model || null,
    },
    modelAttestationBasis:
      response?.modelAttestationBasis ||
      injectedCallMetadata?.model_attestation_basis ||
      injectedCallMetadata?.modelAttestationBasis ||
      null,
    modelIndependentlyAttested:
      response?.modelIndependentlyAttested === true ||
      injectedCallMetadata?.model_independently_attested === true ||
      injectedCallMetadata?.modelIndependentlyAttested === true,
    streamEventTypeCounts: jsonClone(
      response?.streamEventTypeCounts || injectedCallMetadata?.stream_event_type_counts || {},
    ),
    streamItemTypeCounts: jsonClone(
      response?.streamItemTypeCounts || injectedCallMetadata?.stream_item_type_counts || {},
    ),
    structuredEventAudit: jsonClone(
      response?.structuredEventAudit || injectedCallMetadata?.structured_event_audit || null,
    ),
    prohibitedToolEventCount: Number(
      response?.prohibitedToolEventCount ?? injectedCallMetadata?.prohibited_tool_event_count ?? 0,
    ),
    hashes: {
      systemPromptSha256: sha256(TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_SYSTEM_PROMPT),
      promptSha256: analysisPrompt === null ? null : sha256(analysisPrompt),
      outputSchemaSha256: outputSchema ? sha256(canonicalJson(outputSchema)) : null,
      inputSha256:
        analysisPrompt === null
          ? null
          : sha256(
              canonicalJson({
                systemPrompt: TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_SYSTEM_PROMPT,
                prompt: analysisPrompt,
                outputSchema,
              }),
            ),
      rawOutputSha256: rawText === null ? null : sha256(rawText),
      parsedOutputSha256: parsed === null ? null : sha256(canonicalJson(parsed)),
    },
    effort: strict ? 'low' : modelCallOptions.effort || null,
    timeoutMs: strict ? 300000 : modelCallOptions.timeoutMs || null,
    latencyMs: Number(response?.latencyMs || injectedCallMetadata?.latency_ms || 0),
    attemptCount,
    fallbackUsed,
    role: effectiveRole,
    injectedCallMetadata: jsonClone(injectedCallMetadata),
  };
}

function attachCallFailure(
  error,
  {
    modelCallOptions,
    response = null,
    injectedCallMetadata = null,
    strict,
    analysisPrompt = null,
    outputSchema = null,
    rawText = null,
    parsed = null,
    effectiveRole,
    dispatchCount = 0,
  },
) {
  const detailed = detailedCallMetadata({
    modelCallOptions,
    response,
    injectedCallMetadata,
    strict,
    analysisPrompt,
    outputSchema,
    rawText,
    parsed,
    effectiveRole,
    attemptCount: dispatchCount,
  });
  const base = flatCallMetadata(detailed, response, { status: 'technical_failure', dispatchCount });
  const supplied = jsonClone(error?.callMetadata || error?.call_metadata || injectedCallMetadata || null);
  error.callMetadata = { ...base, ...(supplied || {}), status: 'technical_failure' };
  error.analysisCallMetadata = detailed;
  error.raw_output = rawText;
  error.analysisArtifacts = {
    systemPrompt: TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_SYSTEM_PROMPT,
    prompt: analysisPrompt,
    outputSchema,
    rawText,
    parsed,
  };
  return error;
}

function factText(fact) {
  if (!Array.isArray(fact) || fact.length === 0) return String(fact || '');
  const [relation, ...args] = fact;
  return `${relation}(${args.join(', ')})`;
}

function ruleText(rule, index) {
  const left = (rule.if || []).map(factText).join(' + ');
  const right = (rule.then || []).map(factText).join(' + ');
  return `${index + 1}. ${rule.id}: ${left} -> ${right}\n   ${String(rule.gloss || '').trim()}`;
}

export function tutorStubPublicReleaseLedger(world, turn) {
  if (!world) return [];
  return world.releaseSchedule
    .filter((entry) => entry.turn <= turn)
    .map((entry) => ({ turn: entry.turn, premiseId: entry.premise, via: entry.via }));
}

export function tutorStubPublicStagedEvidence(world, turn) {
  return tutorStubPublicReleaseLedger(world, turn).map((entry) => {
    const premise = world.premiseById.get(entry.premiseId);
    return {
      premise: entry.premiseId,
      turn: entry.turn,
      via: entry.via,
      surface: String(premise?.surface || '').trim(),
      fact: premise?.fact || null,
    };
  });
}

/**
 * Project an authored world onto the fields that are safe and necessary for
 * the public text analyzer. In particular, this object cannot expose the
 * secret, proof paths, background task key, premise registry, release
 * schedule, or any other deterministic postprocessor input.
 */
export function buildTutorStubPublicLearnerAnalysisWorld(world) {
  if (!world) {
    throw new TutorStubPublicLearnerAnalysisError('public learner analysis requires a world');
  }
  return {
    id: String(world.id || ''),
    title: String(world.title || world.id || ''),
    question: String(world.question || ''),
    discipline: world.discipline === undefined ? null : jsonClone(world.discipline),
    setting: world.setting === undefined ? null : jsonClone(world.setting),
    rules: jsonClone(Array.isArray(world.rules) ? world.rules : []),
  };
}

function normalizedPublicStagedEvidence(rows, { tutorTurn = null } = {}) {
  if (!Array.isArray(rows)) return null;
  const normalized = rows.map((row, index) => {
    const premise = String(row?.premise || row?.premiseId || row?.id || '').trim();
    if (!premise || !Array.isArray(row?.fact)) {
      throw new TutorStubPublicLearnerAnalysisError(
        `publicStagedEvidence[${index}] requires a premise id and fact array`,
        { code: 'invalid_public_staged_evidence', details: { index } },
      );
    }
    const turn = finiteTurnOrNull(row.turn);
    if (turn !== null && Number.isFinite(Number(tutorTurn)) && turn > Number(tutorTurn)) {
      throw new TutorStubPublicLearnerAnalysisError(
        `publicStagedEvidence[${index}] has future turn ${turn} > current turn ${tutorTurn}`,
        { code: 'future_public_staged_evidence', details: { index, turn, tutorTurn } },
      );
    }
    return {
      premise,
      turn,
      via: String(row.via || 'public_projection'),
      surface: String(row.surface || '').trim(),
      fact: [...row.fact],
    };
  });
  const seen = new Set();
  for (const [index, row] of normalized.entries()) {
    if (seen.has(row.premise)) {
      throw new TutorStubPublicLearnerAnalysisError(`duplicate publicStagedEvidence premise ${row.premise}`, {
        code: 'invalid_public_staged_evidence',
        details: { index, premise: row.premise },
      });
    }
    seen.add(row.premise);
  }
  return normalized;
}

function resolvedPublicStagedEvidence(world, tutorTurn, publicStagedEvidence) {
  return (
    normalizedPublicStagedEvidence(publicStagedEvidence, { tutorTurn }) ||
    tutorStubPublicStagedEvidence(world, tutorTurn)
  );
}

function resolvedPublicReleaseLedger(world, tutorTurn, publicStagedEvidence, publicReleaseLedger) {
  if (Array.isArray(publicReleaseLedger)) {
    const ledgerRows = resolvedPublicStagedEvidence(world, tutorTurn, publicReleaseLedger);
    if (Array.isArray(publicStagedEvidence)) {
      const stagedRows = resolvedPublicStagedEvidence(world, tutorTurn, publicStagedEvidence);
      if (canonicalJson(ledgerRows) !== canonicalJson(stagedRows)) {
        throw new TutorStubPublicLearnerAnalysisError(
          'publicReleaseLedger must equal publicStagedEvidence when both explicit projections are supplied',
          { code: 'inconsistent_public_release_ledger' },
        );
      }
    }
    return ledgerRows.map((row) => ({ turn: row.turn, premiseId: row.premise, via: row.via }));
  }
  if (Array.isArray(publicStagedEvidence)) {
    return resolvedPublicStagedEvidence(world, tutorTurn, publicStagedEvidence).map((row) => ({
      turn: row.turn,
      premiseId: row.premise,
      via: row.via,
    }));
  }
  return tutorStubPublicReleaseLedger(world, tutorTurn);
}

export function tutorStubPublicFactSurface(world, fact) {
  if (!world || !Array.isArray(fact)) return factText(fact);
  const key = factKey(fact);
  for (const premise of world.premises || []) {
    if (factKey(premise.fact) === key) return String(premise.surface || factText(fact)).trim();
  }
  return factText(fact);
}

function factFromQuestionAnswer(world, answer) {
  const cleaned = String(answer || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_:-]/g, '')
    .toLowerCase();
  if (!world || !cleaned) return null;
  return world.questionPattern.map((part) => (typeof part === 'string' && part.startsWith('?') ? cleaned : part));
}

function classifierWorldContext({ world, learnerDagEnabled = true }) {
  if (!world) return 'No detective-story world is active.';
  return [
    `World: ${world.id} - ${world.title}`,
    world.discipline ? `Discipline: ${world.discipline}` : null,
    `Public question: ${world.question}`,
    `Opening situation: ${String(world.setting || '').trim()}`,
    `DAG mode: ${learnerDagEnabled ? 'on, but hidden DAG state is intentionally withheld from this classifier' : 'off'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function publicTranscriptText(publicTranscript, historyTurns = 4) {
  if (typeof publicTranscript === 'string') return publicTranscript.trim() || 'No previous public turns.';
  const turns = Array.isArray(publicTranscript) ? publicTranscript : [];
  const safeLimit = Math.max(0, Number(historyTurns) || 0);
  const recent = safeLimit > 0 ? turns.slice(-safeLimit) : [];
  if (!recent.length) return 'No previous public turns.';
  return recent
    .map((row, index) => {
      const absoluteTurn = Number(row?.turn) || turns.length - recent.length + index + 1;
      return [
        `Turn ${absoluteTurn}`,
        `Learner: ${String(row?.learner ?? row?.learner_text ?? '').trim()}`,
        `Tutor: ${String(row?.tutor ?? row?.tutor_text ?? '').trim()}`,
      ].join('\n');
    })
    .join('\n\n');
}

export function tutorStubLearnerClassificationPromptSchema() {
  return {
    turn: {
      summary: 'one short sentence',
      request_type: 'controlled label',
      discourse_move: 'controlled label',
      evidence_use: 'controlled label',
      epistemic_stance: 'controlled label',
      affect: 'short label',
      agency: 'controlled label',
      scores: {
        conceptual_engagement: { score: 1, reason: 'short phrase' },
        epistemic_readiness: { score: 1, reason: 'short phrase' },
      },
      pedagogical_need: 'one short phrase',
    },
    overall: {
      summary: 'one short sentence',
      trajectory: 'short phrase',
      recurring_pattern: 'short phrase or none',
      current_state: 'short phrase',
      next_best_tutor_move: 'one short sentence',
    },
  };
}

export function tutorStubHumanDiscoursePromptSchema() {
  return {
    proof_status: 'strict_proof|provisional_scaffold|side_arc|hidden_premise_risk|unclear',
  };
}

export function tutorStubLearnerRecordPromptSchema() {
  return {
    human_discourse: tutorStubHumanDiscoursePromptSchema(),
    notes: 'one short sentence only when useful',
  };
}

export function tutorStubEngagementStancePromptSchema() {
  return {
    engagement_stance: 'one available tutor engagement stance name',
    reviewer_signal: 'brief up-front reviewer judgment that motivates this stance choice',
    request_type: 'logical request type from the classifier; this is not the engagement stance',
    engagement_stance_reason: 'why the up-front reviewer chose this stance for the next tutor response',
    evidence_span: 'short quote or public-state cue supporting the choice',
    risk_flags: ['guardrail flags, or empty array'],
    expected_dag_move: 'what learner-DAG progress this register is meant to produce next',
    expected_field_move: 'what learner-field movement this register is meant to produce next',
    expected_progress_marker: 'what the next learner turn should show if this register worked',
    confidence: 0.75,
  };
}

function localPolicyInstruction(policy) {
  const instructions = {
    field:
      'Policy is field: do not choose an engagement stance. The runtime will map the classification plus learner-DAG update into a local engagement-stance distribution.',
    trajectory:
      'Policy is trajectory: do not choose an engagement stance. The runtime will map classification, learner-DAG state, and recent trajectory into a local engagement-stance distribution.',
    dynamical_system:
      'Policy is dynamical_system: do not choose an engagement stance. The runtime will map classification, learner-DAG state, derivatives, stance priors, and prior stance efficacy into a local distribution.',
    empirical_dynamical_system:
      'Policy is empirical_dynamical_system: do not choose an engagement stance. The runtime will map classification, learner-DAG state, derivatives, stance priors, local stance efficacy, and cross-run priors into a local distribution.',
    continuous_dynamical_system:
      'Policy is continuous_dynamical_system: do not choose an engagement stance. The runtime will map classification, learner-DAG state, derivatives, stance priors, and prior efficacy into a weighted engagement-stance blend.',
    continuous_empirical_dynamical_system:
      'Policy is continuous_empirical_dynamical_system: do not choose an engagement stance. The runtime will map classification, learner-DAG state, derivatives, stance priors, local efficacy, and cross-run priors into a weighted engagement-stance blend.',
    state:
      'Policy is state: do not choose an engagement stance. The runtime will map current classification and learner-DAG assessment into a local engagement-stance distribution.',
    bland:
      'Policy is bland: do not choose an engagement stance. The runtime will use a fixed plain non-adaptive baseline stance.',
    negative:
      'Policy is negative: do not choose an engagement stance. The runtime will sample only ironic, sarcastic, and face_threat as an explicit negative-floor stance control.',
  };
  return instructions[policy] || null;
}

export function buildTutorStubPublicLearnerAnalysisPrompt({
  learnerText,
  topic = '',
  world,
  tutorTurn,
  publicTranscript = [],
  currentTutorText = '',
  historyTurns = 4,
  comprehensionContext = '',
  learnerDagEnabled = true,
  registerPolicy = null,
  registerEnabled = false,
  registerPalette = [],
  registerContext = {},
  publicStagedEvidence = null,
} = {}) {
  if (!world) throw new TutorStubPublicLearnerAnalysisError('public learner analysis requires a world');
  if (!Number.isInteger(Number(tutorTurn)) || Number(tutorTurn) < 1) {
    throw new TutorStubPublicLearnerAnalysisError('public learner analysis requires tutorTurn >= 1');
  }
  const staged = resolvedPublicStagedEvidence(world, Number(tutorTurn), publicStagedEvidence);
  const policy = String(registerPolicy || '').trim();
  const includeRegisterSelection = Boolean(
    registerEnabled && !LOCAL_REGISTER_POLICIES.has(policy) && Array.isArray(registerPalette) && registerPalette.length,
  );
  const schema = {
    classification: tutorStubLearnerClassificationPromptSchema(),
    learner_record: tutorStubLearnerRecordPromptSchema(),
  };
  if (includeRegisterSelection) schema.register_selection = tutorStubEngagementStancePromptSchema();
  const policyInstruction =
    registerEnabled && LOCAL_REGISTER_POLICIES.has(policy) ? localPolicyInstruction(policy) : null;

  return [
    '# Task',
    '',
    'Analyze the learner input once before the tutor responds.',
    'Be terse. Keep every summary or reason to one short sentence or phrase.',
    comprehensionContext || null,
    'Return sparse JSON: omit empty arrays, null optional learner_record fields, and absent human_discourse fields. Do not restate the same issue across arrays.',
    'Return both:',
    '1. A pedagogical discourse classification.',
    '2. A conservative public learner-record update for the tutor-side learner-DAG model.',
    includeRegisterSelection
      ? '3. A tutor engagement-stance selection made by the up-front reviewer using the classification plus the tutor-side learner-DAG state.'
      : null,
    policyInstruction,
    '',
    '# Public tutoring context',
    '',
    `Topic: ${topic}`,
    classifierWorldContext({ world, learnerDagEnabled }),
    '',
    '# Public question',
    '',
    world.question,
    '',
    '# Public rules',
    '',
    ...world.rules.map(ruleText),
    '',
    '# Staged public evidence available at or before this turn',
    '',
    staged.length
      ? staged
          .map((row) =>
            [
              `- ${row.premise} (staged turn ${row.turn} via ${row.via})`,
              `  surface: ${row.surface}`,
              `  fact: ${JSON.stringify(row.fact)}`,
            ].join('\n'),
          )
          .join('\n')
      : '- none',
    '',
    '# Previous public transcript',
    '',
    publicTranscriptText(publicTranscript, historyTurns),
    '',
    String(currentTutorText || '').trim() ? '# Immediately preceding public tutor turn' : null,
    String(currentTutorText || '').trim() ? '' : null,
    String(currentTutorText || '').trim() || null,
    String(currentTutorText || '').trim() ? '' : null,
    '# Current learner turn',
    '',
    String(learnerText || '').trim(),
    '',
    '# Compact pedagogical discourse rubric',
    '',
    'Scores (1-5): conceptual_engagement = parroting, surface, partial concept, substantive reasoning, constructing/testing/revising; epistemic_readiness = reception, minimal awareness, generic awareness, evidence-aware monitoring, active bias/uncertainty monitoring.',
    'Use controlled labels:',
    '- request_type: conceptual_clarity_request, stepwise_support_request, authority_refusal_or_status_challenge, plain_language_request, plain_simplification_followup, transfer_demand_or_named_material, vulnerability_or_moral_exposure, resistance_or_low_agency, answer_seeking_or_overreach, off_task_or_mixed',
    '- discourse_move: question, claim, hypothesis, inference, evidence_adoption, challenge, repair_request, affective_signal, answer_seeking, metacognitive_reflection, off_task',
    '- evidence_use: none, repeats_setup, cites_public_evidence, omits_warrant, links_evidence_to_rule, overleaps_evidence, distorts_public_evidence, revises_from_evidence',
    '- evidence precedence: distorted/misattributed public clue => distorts_public_evidence; correct clue plus conclusion but no bridge => omits_warrant; conclusion beyond available evidence => overleaps_evidence; explicit bridge => links_evidence_to_rule.',
    '- Resolve short answers, pronouns, and ellipsis against the immediately preceding tutor question before assigning these labels. A reply such as "it will be the same" can fully answer a local single-referent question without repeating the noun.',
    '- Do not call a contextually complete short answer confused, passive, or evidence-free merely because the preceding question supplies its referent. Record any genuinely omitted warrant separately for strict audit.',
    '- epistemic_stance: receptive, confused, exploratory, overconfident, resistant, answer_seeking, reflective, grounded',
    '- agency: passive, complying, attempting, steering, self_correcting',
    '',
    includeRegisterSelection ? '# Request type registry' : null,
    includeRegisterSelection ? '' : null,
    includeRegisterSelection
      ? 'Request type belongs to the logical armature: it describes what kind of move/device the learner turn calls for in the DAG or proof path. It is not the engagement stance.'
      : null,
    includeRegisterSelection ? registerContext.requestTypeRegistryPrompt : null,
    includeRegisterSelection ? '' : null,
    '# Learner-record extraction rules',
    '',
    '- adopt/retract: only staged premise ids the learner explicitly accepts/uses or rejects/withdraws.',
    '- derive: only learner-voiced conclusions supported by adopted or staged evidence plus public rules. For a warranted one-step conclusion, include its supporting premise ids in adopt and its fact in derive.',
    '- Resolve pronouns and elliptical answers against the immediately preceding tutor question. If a short reply unambiguously answers that local question, the resolved content counts as learner-voiced; do not demand repeated nouns or names.',
    '- hypothesis: one learner conjecture or uncertainty, else null. assert_answer: direct answer candidate, else null.',
    '- human_discourse: record only concrete current-turn material. proof_status uses the schema enum. provisional_claims are allowable but not strict; implied_warrants are unstated bridges; missing_warrants are still owed; implied_public_premises are public but ungrounded; suppressed_or_private_premises and illicit_hidden_premises are not public enough; common_sense_bridges are safe provisional steps; proof_debt_candidates need later repair; side_arc covers clarification, vocabulary, affect, trust, or off-path requests.',
    '- A wording-only or vocabulary-only clarification request is a non-DAG side-state: classify and record the side arc, but do not adopt premises, derive facts, or assert an answer from that request itself.',
    '- Be conservative: staged evidence is not adopted merely because it exists.',
    includeRegisterSelection ? '' : null,
    includeRegisterSelection ? '# Tutor engagement-stance selection' : null,
    includeRegisterSelection
      ? 'As the up-front reviewer, select one engagement stance for the upcoming tutor response. The learner does not choose or license the stance.'
      : null,
    includeRegisterSelection
      ? 'Keep request_type separate from engagement_stance: request_type is the logical/DAG armature; engagement_stance is the reviewer-chosen tone and posture.'
      : null,
    includeRegisterSelection
      ? 'Do not select action_family here. The runtime selects it independently from the learner state after this analysis.'
      : null,
    includeRegisterSelection
      ? 'The selected engagement stance should be appropriate to the classification, learner-DAG state, field movement, and recent stance efficacy, but it does not determine the action family, audience register, lexical accessibility, or scene immersion.'
      : null,
    includeRegisterSelection
      ? 'Use expected_field_move for the discourse/agency/posture movement you want, and expected_dag_move for the proof-state movement you want.'
      : null,
    includeRegisterSelection
      ? 'Never choose a stance outside the available palette. Negative/liminal stances appear only when explicitly included in that palette.'
      : null,
    includeRegisterSelection ? '' : null,
    includeRegisterSelection ? '# Engagement-stance selection policy' : null,
    includeRegisterSelection ? registerContext.selectionPolicyPrompt : null,
    includeRegisterSelection ? '' : null,
    includeRegisterSelection ? '# Available tutor engagement-stance palette' : null,
    includeRegisterSelection ? registerContext.palettePrompt : null,
    includeRegisterSelection ? '' : null,
    includeRegisterSelection ? '# Prior redacted tutor-side learner-DAG model' : null,
    includeRegisterSelection ? registerContext.priorPublicLearnerDagPrompt : null,
    includeRegisterSelection ? '' : null,
    includeRegisterSelection ? '# Prior tutor engagement stances and observed efficacy' : null,
    includeRegisterSelection ? registerContext.historyPrompt : null,
    '',
    '# JSON schema',
    '',
    JSON.stringify(schema, null, 2),
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');
}

function firstJsonObjectCandidate(text) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (ch === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) return text.slice(start, index + 1);
    }
  }
  return null;
}

/** Preserve the tutor-stub's historical bounded parser and fallback exactly. */
export function parseTutorStubPublicLearnerAnalysisInteractive(rawText) {
  const text = String(rawText || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const originalCandidates = [text, fenced, firstJsonObjectCandidate(text)].filter(Boolean);
  const candidates = originalCandidates
    .flatMap((candidate) => [candidate, closeTruncatedTutorStubJson(candidate)])
    .filter(Boolean);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { parsed: normalizeTutorStubAnalysisEnvelope(parsed), parseError: null };
      }
    } catch (_) {
      // Preserve the legacy bounded extraction sequence.
    }
  }
  return {
    parsed: {
      turn: {
        summary: 'Classifier returned non-JSON output.',
        request_type: 'off_task_or_mixed',
        discourse_move: 'unknown',
        evidence_use: 'unknown',
        epistemic_stance: 'unknown',
        affect: 'unknown',
        agency: 'unknown',
        scores: {},
        pedagogical_need: 'Inspect the raw classifier output before relying on this turn label.',
      },
      overall: {
        summary: 'No structured overall learner classification is available.',
        trajectory: 'unknown',
        recurring_pattern: 'unknown',
        current_state: 'unknown',
        next_best_tutor_move: 'Continue with a diagnostic question grounded in the learner input.',
      },
      raw: text,
    },
    parseError: 'Classifier output was not parseable JSON.',
  };
}

function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TutorStubPublicLearnerAnalysisError(`strict public learner analysis requires object ${path}`, {
      code: 'invalid_analysis_schema',
      details: { path },
    });
  }
  return value;
}

function requireOwnFields(value, fields, path) {
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) {
      throw new TutorStubPublicLearnerAnalysisError(`strict public learner analysis is missing ${path}.${field}`, {
        code: 'invalid_analysis_schema',
        details: { path: `${path}.${field}` },
      });
    }
  }
}

function requireExactKeys(value, { allowed, required = [], path }) {
  requireOwnFields(value, required, path);
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) {
    throw new TutorStubPublicLearnerAnalysisError(
      `strict public learner analysis contains unsupported key ${path}.${extras[0]}`,
      { code: 'invalid_analysis_schema', details: { path: `${path}.${extras[0]}` } },
    );
  }
}

function requireStringFields(value, fields, path) {
  for (const field of fields) {
    if (typeof value[field] !== 'string') {
      throw new TutorStubPublicLearnerAnalysisError(`strict public learner analysis requires string ${path}.${field}`, {
        code: 'invalid_analysis_schema',
        details: { path: `${path}.${field}` },
      });
    }
  }
}

function requireStringArray(value, path) {
  if (!Array.isArray(value) || value.some((row) => typeof row !== 'string')) {
    throw new TutorStubPublicLearnerAnalysisError(`strict public learner analysis requires string array ${path}`, {
      code: 'invalid_analysis_schema',
      details: { path },
    });
  }
}

function requireControlledEnum(value, field, path) {
  const allowed = CONTROLLED_ENUMS[field];
  if (!allowed?.has(value)) {
    throw new TutorStubPublicLearnerAnalysisError(
      `strict public learner analysis has unknown ${path}: ${String(value)}`,
      { code: 'invalid_analysis_enum', details: { path, value, allowed: [...(allowed || [])] } },
    );
  }
}

function validateHumanDiscourseRow(row, path) {
  if (typeof row === 'string') return;
  const object = requireObject(row, path);
  requireExactKeys(object, { allowed: HUMAN_DISCOURSE_ROW_FIELDS, path });
  if (!Object.keys(object).length) {
    throw new TutorStubPublicLearnerAnalysisError(`strict public learner analysis requires non-empty ${path}`, {
      code: 'invalid_analysis_schema',
      details: { path },
    });
  }
  requireStringFields(object, Object.keys(object), path);
}

function requireNullableString(value, path) {
  if (value !== null && typeof value !== 'string') {
    throw new TutorStubPublicLearnerAnalysisError(`strict public learner analysis requires string or null ${path}`, {
      code: 'invalid_analysis_schema',
      details: { path },
    });
  }
}

function validateStrictAnalysis(parsed, { includeRegisterSelection = false } = {}) {
  const root = requireObject(parsed, '$');
  const rootFields = ['classification', 'learner_record', ...(includeRegisterSelection ? ['register_selection'] : [])];
  requireExactKeys(root, { allowed: rootFields, required: rootFields, path: '$' });
  const classification = requireObject(root.classification, '$.classification');
  requireExactKeys(classification, {
    allowed: ['turn', 'overall'],
    required: ['turn', 'overall'],
    path: '$.classification',
  });
  const turn = requireObject(classification.turn, '$.classification.turn');
  const overall = requireObject(classification.overall, '$.classification.overall');
  requireExactKeys(turn, {
    allowed: CONTROLLED_CLASSIFIER_FIELDS,
    required: CONTROLLED_CLASSIFIER_FIELDS,
    path: '$.classification.turn',
  });
  requireExactKeys(overall, {
    allowed: CONTROLLED_OVERALL_FIELDS,
    required: CONTROLLED_OVERALL_FIELDS,
    path: '$.classification.overall',
  });
  requireStringFields(
    turn,
    CONTROLLED_CLASSIFIER_FIELDS.filter((field) => field !== 'scores'),
    '$.classification.turn',
  );
  for (const field of ['request_type', 'discourse_move', 'evidence_use', 'epistemic_stance', 'agency']) {
    requireControlledEnum(turn[field], field, `$.classification.turn.${field}`);
  }
  requireStringFields(overall, CONTROLLED_OVERALL_FIELDS, '$.classification.overall');
  const scores = requireObject(turn.scores, '$.classification.turn.scores');
  requireExactKeys(scores, {
    allowed: ['conceptual_engagement', 'epistemic_readiness'],
    required: ['conceptual_engagement', 'epistemic_readiness'],
    path: '$.classification.turn.scores',
  });
  for (const scoreName of ['conceptual_engagement', 'epistemic_readiness']) {
    const score = requireObject(scores[scoreName], `$.classification.turn.scores.${scoreName}`);
    requireExactKeys(score, {
      allowed: ['score', 'reason'],
      required: ['score', 'reason'],
      path: `$.classification.turn.scores.${scoreName}`,
    });
    if (typeof score.score !== 'number' || !Number.isFinite(score.score) || score.score < 1 || score.score > 5) {
      throw new TutorStubPublicLearnerAnalysisError(
        `strict public learner analysis requires a 1-5 score at $.classification.turn.scores.${scoreName}.score`,
        { code: 'invalid_analysis_schema', details: { path: `$.classification.turn.scores.${scoreName}.score` } },
      );
    }
    if (typeof score.reason !== 'string') {
      throw new TutorStubPublicLearnerAnalysisError(
        `strict public learner analysis requires string $.classification.turn.scores.${scoreName}.reason`,
        { code: 'invalid_analysis_schema', details: { path: `$.classification.turn.scores.${scoreName}.reason` } },
      );
    }
  }
  const learnerRecord = requireObject(root.learner_record, '$.learner_record');
  requireExactKeys(learnerRecord, { allowed: LEARNER_RECORD_FIELDS, path: '$.learner_record' });
  for (const field of ['adopt', 'retract']) {
    if (Object.hasOwn(learnerRecord, field)) requireStringArray(learnerRecord[field], `$.learner_record.${field}`);
  }
  if (Object.hasOwn(learnerRecord, 'derive')) {
    if (!Array.isArray(learnerRecord.derive) || learnerRecord.derive.some((fact) => !validFactArray(fact))) {
      throw new TutorStubPublicLearnerAnalysisError(
        'strict public learner analysis requires fact arrays at $.learner_record.derive',
        { code: 'invalid_analysis_schema', details: { path: '$.learner_record.derive' } },
      );
    }
  }
  for (const field of ['hypothesis', 'assert_answer']) {
    if (
      Object.hasOwn(learnerRecord, field) &&
      learnerRecord[field] !== null &&
      typeof learnerRecord[field] !== 'string'
    ) {
      throw new TutorStubPublicLearnerAnalysisError(
        `strict public learner analysis requires string or null $.learner_record.${field}`,
        { code: 'invalid_analysis_schema', details: { path: `$.learner_record.${field}` } },
      );
    }
  }
  if (Object.hasOwn(learnerRecord, 'human_discourse')) {
    const discourse = requireObject(learnerRecord.human_discourse, '$.learner_record.human_discourse');
    requireExactKeys(discourse, {
      allowed: HUMAN_DISCOURSE_FIELDS,
      required: ['proof_status'],
      path: '$.learner_record.human_discourse',
    });
    requireControlledEnum(discourse.proof_status, 'proof_status', '$.learner_record.human_discourse.proof_status');
    for (const field of HUMAN_DISCOURSE_ARRAY_FIELDS) {
      if (!Object.hasOwn(discourse, field)) continue;
      if (!Array.isArray(discourse[field])) {
        throw new TutorStubPublicLearnerAnalysisError(
          `strict public learner analysis requires array $.learner_record.human_discourse.${field}`,
          {
            code: 'invalid_analysis_schema',
            details: { path: `$.learner_record.human_discourse.${field}` },
          },
        );
      }
      discourse[field].forEach((row, index) =>
        validateHumanDiscourseRow(row, `$.learner_record.human_discourse.${field}[${index}]`),
      );
    }
    if (Object.hasOwn(discourse, 'side_arc')) {
      const sideArc = requireObject(discourse.side_arc, '$.learner_record.human_discourse.side_arc');
      requireExactKeys(sideArc, {
        allowed: SIDE_ARC_FIELDS,
        required: SIDE_ARC_FIELDS,
        path: '$.learner_record.human_discourse.side_arc',
      });
      if (typeof sideArc.detected !== 'boolean') {
        throw new TutorStubPublicLearnerAnalysisError(
          'strict public learner analysis requires boolean $.learner_record.human_discourse.side_arc.detected',
          {
            code: 'invalid_analysis_schema',
            details: { path: '$.learner_record.human_discourse.side_arc.detected' },
          },
        );
      }
      if (sideArc.type !== null && !SIDE_ARC_TYPES.includes(sideArc.type)) {
        throw new TutorStubPublicLearnerAnalysisError(
          `strict public learner analysis has unknown $.learner_record.human_discourse.side_arc.type: ${String(sideArc.type)}`,
          {
            code: 'invalid_analysis_enum',
            details: { path: '$.learner_record.human_discourse.side_arc.type', value: sideArc.type },
          },
        );
      }
      requireNullableString(sideArc.reason, '$.learner_record.human_discourse.side_arc.reason');
      requireNullableString(sideArc.return_target, '$.learner_record.human_discourse.side_arc.return_target');
    }
  }
  if (Object.hasOwn(learnerRecord, 'notes') && typeof learnerRecord.notes !== 'string') {
    throw new TutorStubPublicLearnerAnalysisError(
      'strict public learner analysis requires string $.learner_record.notes',
      {
        code: 'invalid_analysis_schema',
        details: { path: '$.learner_record.notes' },
      },
    );
  }
  if (includeRegisterSelection) {
    const register = requireObject(root.register_selection, '$.register_selection');
    requireExactKeys(register, {
      allowed: REGISTER_SELECTION_FIELDS,
      required: REGISTER_SELECTION_FIELDS,
      path: '$.register_selection',
    });
    requireStringFields(
      register,
      REGISTER_SELECTION_FIELDS.filter((field) => !['risk_flags', 'confidence'].includes(field)),
      '$.register_selection',
    );
    requireStringArray(register.risk_flags, '$.register_selection.risk_flags');
    if (
      typeof register.confidence !== 'number' ||
      !Number.isFinite(register.confidence) ||
      register.confidence < 0 ||
      register.confidence > 1
    ) {
      throw new TutorStubPublicLearnerAnalysisError(
        'strict public learner analysis requires 0-1 number $.register_selection.confidence',
        { code: 'invalid_analysis_schema', details: { path: '$.register_selection.confidence' } },
      );
    }
  }
  return root;
}

/**
 * Benchmark parsing is intentionally fail-closed: the full response must be
 * one canonical JSON object. There is no fence extraction, delimiter repair,
 * alias fallback, or semantic reroll.
 */
export function parseTutorStubPublicLearnerAnalysisStrict(rawText, options = {}) {
  const text = String(rawText || '').trim();
  if (!text) {
    throw new TutorStubPublicLearnerAnalysisError('strict public learner analysis returned empty output', {
      code: 'empty_analysis_output',
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new TutorStubPublicLearnerAnalysisError(
      `strict public learner analysis returned invalid JSON: ${cause.message}`,
      {
        code: 'invalid_analysis_json',
        cause,
      },
    );
  }
  validateStrictAnalysis(parsed, options);
  return { parsed, parseError: null };
}

function analysisParts(raw, { strict = false, includeRegisterSelection = false } = {}) {
  const parsed = raw?.parsed || raw || {};
  const classification =
    parsed.classification ||
    (!strict &&
      (parsed.learner_classification || parsed.classifier || (parsed.turn && parsed.overall ? parsed : null)));
  const learnerRecord =
    parsed.learner_record ||
    (!strict && (parsed.learnerRecord || parsed.public_record || parsed.record)) ||
    (strict ? null : {});
  const registerSelection =
    parsed.register_selection ||
    (!strict && (parsed.registerSelection || parsed.tutor_register || parsed.register)) ||
    null;
  if (strict) {
    validateStrictAnalysis(parsed, { includeRegisterSelection });
  }
  return { classification, learnerRecord, registerSelection };
}

function responseMetadata(raw = {}) {
  return {
    parseError: raw.parseError || null,
    provider: raw.provider || null,
    model: raw.model || null,
    latencyMs: Number(raw.latencyMs || 0),
    usage: raw.usage || null,
    combined: true,
  };
}

export function splitTutorStubPublicLearnerAnalysis(raw, options = {}) {
  const parts = analysisParts(raw, options);
  const metadata = responseMetadata(raw);
  return {
    classification: parts.classification ? { ...parts.classification, ...metadata } : null,
    learnerRecordUpdate: parts.learnerRecord ? { ...parts.learnerRecord, ...metadata } : null,
    registerSelection: parts.registerSelection,
  };
}

export async function extractTutorStubPublicLearnerAnalysis({
  learnerText,
  topic = '',
  world,
  tutorTurn,
  publicTranscript = [],
  currentTutorText = '',
  historyTurns = 4,
  comprehensionContext = '',
  learnerDagEnabled = true,
  registerPolicy = null,
  registerEnabled = false,
  registerPalette = [],
  registerContext = {},
  publicStagedEvidence = null,
  callModel,
  parseMode = TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES.STRICT_BENCHMARK,
  role = 'tutor_stub_public_learner_analysis',
  maxTokens = 2500,
  prompt = null,
  modelCallOptions = {},
} = {}) {
  const strict = parseMode === TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES.STRICT_BENCHMARK;
  const effectiveRole = strict ? 'tutor_stub_public_learner_analysis' : role;
  const outputSchema = strict ? buildTutorStubPublicLearnerAnalysisOutputSchema() : null;
  let analysisPrompt = typeof prompt === 'string' ? prompt : null;
  const preCallFailure = (error) =>
    attachCallFailure(error, {
      modelCallOptions,
      strict,
      analysisPrompt,
      outputSchema,
      effectiveRole,
      dispatchCount: 0,
    });

  if (typeof callModel !== 'function') {
    throw preCallFailure(
      new TutorStubPublicLearnerAnalysisError('public learner analysis requires an injected callModel function', {
        code: 'missing_model_caller',
      }),
    );
  }
  if (!Object.values(TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES).includes(parseMode)) {
    throw preCallFailure(
      new TutorStubPublicLearnerAnalysisError(`unknown public learner analysis parse mode: ${parseMode}`, {
        code: 'invalid_parse_mode',
      }),
    );
  }

  const includeRegisterSelection = Boolean(
    registerEnabled &&
    !LOCAL_REGISTER_POLICIES.has(String(registerPolicy || '').trim()) &&
    Array.isArray(registerPalette) &&
    registerPalette.length,
  );
  const effectiveOutputSchema = strict
    ? buildTutorStubPublicLearnerAnalysisOutputSchema({ includeRegisterSelection })
    : null;
  try {
    const effectivePublicStagedEvidence = analysisPrompt
      ? publicStagedEvidence
      : resolvedPublicStagedEvidence(world, Number(tutorTurn), publicStagedEvidence);
    const publicWorld = analysisPrompt ? null : buildTutorStubPublicLearnerAnalysisWorld(world);
    analysisPrompt =
      analysisPrompt ||
      buildTutorStubPublicLearnerAnalysisPrompt({
        learnerText,
        topic,
        world: publicWorld,
        tutorTurn,
        publicTranscript,
        currentTutorText,
        historyTurns,
        comprehensionContext,
        learnerDagEnabled,
        registerPolicy,
        registerEnabled,
        registerPalette,
        registerContext,
        publicStagedEvidence: effectivePublicStagedEvidence,
      });
  } catch (error) {
    throw attachCallFailure(error, {
      modelCallOptions,
      strict,
      analysisPrompt,
      outputSchema: effectiveOutputSchema,
      effectiveRole,
      dispatchCount: 0,
    });
  }

  if (strict) {
    const forbiddenCallControls = ['retry', 'retries', 'fallback', 'fallbackCallAI'];
    const override = forbiddenCallControls.find((key) => {
      const value = modelCallOptions[key];
      return value !== undefined && value !== null && value !== false && value !== 0;
    });
    if (override) {
      throw attachCallFailure(
        new TutorStubPublicLearnerAnalysisError(`strict public learner analysis forbids modelCallOptions.${override}`, {
          code: 'invalid_strict_call_contract',
          details: { field: override },
        }),
        {
          modelCallOptions,
          strict,
          analysisPrompt,
          outputSchema: effectiveOutputSchema,
          effectiveRole,
          dispatchCount: 0,
        },
      );
    }
  }

  const crossedPostprocessorField = DETERMINISTIC_POSTPROCESSOR_ONLY_FIELDS.find((field) =>
    Object.hasOwn(modelCallOptions, field),
  );
  if (crossedPostprocessorField) {
    throw attachCallFailure(
      new TutorStubPublicLearnerAnalysisError(
        `public learner analysis forbids deterministic postprocessor input modelCallOptions.${crossedPostprocessorField}`,
        {
          code: 'postprocessor_input_crossed_public_boundary',
          details: { field: crossedPostprocessorField },
        },
      ),
      {
        modelCallOptions,
        strict,
        analysisPrompt,
        outputSchema: effectiveOutputSchema,
        effectiveRole,
        dispatchCount: 0,
      },
    );
  }

  const callRequest = {
    ...modelCallOptions,
    systemPrompt: TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_SYSTEM_PROMPT,
    prompt: analysisPrompt,
    role: effectiveRole,
    maxTokens,
    turn: tutorTurn,
    ...(strict
      ? {
          outputSchema: effectiveOutputSchema,
          effort: 'low',
          timeoutMs: 300000,
        }
      : {}),
  };
  let response;
  try {
    response = await callModel(callRequest);
  } catch (cause) {
    const rawText = typeof cause?.raw_output === 'string' ? cause.raw_output : null;
    const injectedCallMetadata = cause?.callMetadata || cause?.call_metadata || null;
    const suppliedDispatch = Number(injectedCallMetadata?.dispatch_count ?? injectedCallMetadata?.dispatchCount ?? 0);
    const dispatchCount = suppliedDispatch === 1 ? 1 : 0;
    const error =
      cause?.name === 'AbortError' || cause instanceof TutorStubPublicLearnerAnalysisError
        ? cause
        : new TutorStubPublicLearnerAnalysisError(`public learner analysis model call failed: ${cause.message}`, {
            code: 'analysis_model_call_failed',
            cause,
          });
    if (!error.callMetadata && injectedCallMetadata) error.callMetadata = injectedCallMetadata;
    throw attachCallFailure(error, {
      modelCallOptions,
      injectedCallMetadata,
      strict,
      analysisPrompt,
      outputSchema: effectiveOutputSchema,
      rawText,
      effectiveRole,
      dispatchCount,
    });
  }

  const rawText = String(response?.text ?? response?.content ?? '');
  const injectedCallMetadata = jsonClone(response?.call_metadata ?? response?.callMetadata ?? null);
  const reportedAttempts = Number(
    injectedCallMetadata?.attempt_count ??
      injectedCallMetadata?.attemptCount ??
      injectedCallMetadata?.attempts ??
      response?.attemptCount ??
      1,
  );
  const reportedFallback = Boolean(
    injectedCallMetadata?.fallback_used ?? injectedCallMetadata?.fallbackUsed ?? response?.fallbackUsed,
  );
  const structuredOutputReported =
    response?.structuredOutput === true ||
    injectedCallMetadata?.structured_output_reported === true ||
    injectedCallMetadata?.structuredOutputReported === true;
  const streamActivity = {
    ...(response?.streamEventTypeCounts || injectedCallMetadata?.stream_event_type_counts || {}),
    ...(response?.streamItemTypeCounts || injectedCallMetadata?.stream_item_type_counts || {}),
  };
  const prohibitedStreamActivity = Object.entries(streamActivity).filter(
    ([type, count]) =>
      Number(count) > 0 && /(?:tool|command|shell|exec|file|web|browser|computer|mcp)/iu.test(String(type)),
  );
  const prohibitedToolEventCount = Number(
    response?.prohibitedToolEventCount ?? injectedCallMetadata?.prohibited_tool_event_count ?? 0,
  );
  if (
    strict &&
    (reportedAttempts !== 1 ||
      reportedFallback ||
      !structuredOutputReported ||
      prohibitedStreamActivity.length > 0 ||
      prohibitedToolEventCount !== 0)
  ) {
    throw attachCallFailure(
      new TutorStubPublicLearnerAnalysisError(
        `strict public learner analysis call provenance reported ${reportedAttempts} attempt(s), fallback=${reportedFallback}, structuredOutput=${structuredOutputReported}, prohibitedToolEvents=${prohibitedToolEventCount + prohibitedStreamActivity.length}`,
        {
          code: 'invalid_strict_call_provenance',
          details: {
            attemptCount: reportedAttempts,
            fallbackUsed: reportedFallback,
            structuredOutputReported,
            prohibitedToolEventCount,
            prohibitedStreamActivity,
          },
        },
      ),
      {
        modelCallOptions,
        response,
        injectedCallMetadata,
        strict,
        analysisPrompt,
        outputSchema: effectiveOutputSchema,
        rawText,
        effectiveRole,
        dispatchCount: 1,
      },
    );
  }

  let parsedResult;
  try {
    parsedResult = strict
      ? parseTutorStubPublicLearnerAnalysisStrict(rawText, { includeRegisterSelection })
      : parseTutorStubPublicLearnerAnalysisInteractive(rawText);
  } catch (error) {
    throw attachCallFailure(error, {
      modelCallOptions,
      response,
      injectedCallMetadata,
      strict,
      analysisPrompt,
      outputSchema: effectiveOutputSchema,
      rawText,
      effectiveRole,
      dispatchCount: 1,
    });
  }

  const callMetadata = detailedCallMetadata({
    modelCallOptions,
    response,
    injectedCallMetadata,
    strict,
    analysisPrompt,
    outputSchema: effectiveOutputSchema,
    rawText,
    parsed: parsedResult.parsed,
    effectiveRole,
    attemptCount: reportedAttempts,
    fallbackUsed: reportedFallback,
  });
  const call_metadata = flatCallMetadata(callMetadata, response);
  return {
    parsed: parsedResult.parsed,
    parseError: parsedResult.parseError,
    rawText,
    prompt: analysisPrompt,
    systemPrompt: TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_SYSTEM_PROMPT,
    outputSchema: effectiveOutputSchema,
    provider: response?.provider || null,
    model: response?.model || null,
    latencyMs: Number(response?.latencyMs || 0),
    usage: response?.usage || null,
    parseMode,
    callMetadata,
    call_metadata,
    provenance: {
      model_input_public_only: true,
      public_world_projection: true,
      deterministic_task_key_postprocessor: false,
    },
  };
}
export function normalizeTutorStubHumanDiscourseRows(rows = [], source = 'learner_record') {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      if (typeof row === 'string') return { surface: row.trim(), source };
      return {
        surface: String(row?.surface || row?.text || row?.claim || row?.premise || '').trim(),
        warrantNeeded: String(row?.warrant_needed || row?.warrantNeeded || row?.missing_warrant || '').trim() || null,
        reason: String(row?.reason || row?.note || '').trim() || null,
        severity: String(row?.severity || '').trim() || null,
        source: String(row?.source || source).trim() || source,
      };
    })
    .filter((row) => row.surface || row.reason || row.warrantNeeded);
}

export function normalizeTutorStubHumanDiscourseExtraction(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const sideArc = source.side_arc || source.sideArc || {};
  return {
    proofStatus: String(source.proof_status || source.proofStatus || 'unclear').trim() || 'unclear',
    provisionalClaims: normalizeTutorStubHumanDiscourseRows(
      source.provisional_claims || source.provisionalClaims,
      'extractor_provisional_claim',
    ),
    impliedWarrants: normalizeTutorStubHumanDiscourseRows(
      source.implied_warrants || source.impliedWarrants,
      'extractor_implied_warrant',
    ),
    missingWarrants: normalizeTutorStubHumanDiscourseRows(
      source.missing_warrants || source.missingWarrants,
      'extractor_missing_warrant',
    ),
    impliedPremises: normalizeTutorStubHumanDiscourseRows(
      source.implied_public_premises || source.impliedPremises,
      'extractor_implied_premise',
    ),
    suppressedPremises: normalizeTutorStubHumanDiscourseRows(
      source.suppressed_or_private_premises || source.suppressedPremises,
      'extractor_suppressed_premise',
    ),
    commonSenseBridges: normalizeTutorStubHumanDiscourseRows(
      source.common_sense_bridges || source.commonSenseBridges,
      'extractor_common_sense',
    ),
    illicitHiddenPremises: normalizeTutorStubHumanDiscourseRows(
      source.illicit_hidden_premises || source.illicitHiddenPremises,
      'extractor_hidden_premise',
    ),
    proofDebtCandidates: normalizeTutorStubHumanDiscourseRows(
      source.proof_debt_candidates || source.proofDebtCandidates,
      'extractor_proof_debt',
    ),
    sideArc: {
      detected: sideArc.detected === true,
      type: String(sideArc.type || '').trim() || null,
      reason: String(sideArc.reason || '').trim() || null,
      returnTarget: String(sideArc.return_target || sideArc.returnTarget || '').trim() || null,
    },
  };
}

export function createTutorStubPublicLearnerRecord(world) {
  const board = new Map();
  for (const fact of world?.background || []) board.set(factKey(fact), fact);
  return {
    board,
    voiced: [],
    voicedKeys: new Set(),
    hypotheses: [],
    snapshots: [],
  };
}

function validFactArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((part) => typeof part === 'string');
}

function proofBaseKeys(closed, key, seen = new Set()) {
  if (seen.has(key)) return [];
  seen.add(key);
  const proof = closed.proofs.get(key);
  if (!proof) return [key];
  return proof.premises.flatMap((premiseKey) => proofBaseKeys(closed, premiseKey, seen));
}

/**
 * Deterministically apply only learner-voiced, already-staged public facts.
 * This is the trusted side of the boundary: exact DAG assessment may use the
 * authored task key (including proof paths and the answer pattern), but those
 * inputs never enter the model extractor. Only currently staged rows can be
 * adopted into the learner's public record.
 */
export function applyTutorStubPublicLearnerRecordUpdate({
  update,
  world: explicitWorld = null,
  record: explicitRecord = null,
  dropout: explicitDropout = null,
  state = null,
  tutorTurn,
  learnerText,
  dropoutReplay = null,
  publicStagedEvidence = null,
  publicReleaseLedger = null,
} = {}) {
  const world = explicitWorld || state?.world || null;
  const record = explicitRecord || state?.learnerDag?.record || null;
  const dropout = explicitDropout || state?.learnerDag?.dropout || null;
  if (!world || !record || !(record.board instanceof Map)) {
    throw new TutorStubPublicLearnerAnalysisError('public learner-record application requires world and record');
  }
  const staged = resolvedPublicStagedEvidence(world, tutorTurn, publicStagedEvidence);
  const released = new Map(staged.map((row) => [row.premise, row]));
  const releasedByFactKey = new Map(
    [...released.values()].filter((row) => row.fact).map((row) => [factKey(row.fact), row]),
  );
  const accepted = {
    adopt: [],
    retract: [],
    derive: [],
    hypothesis: null,
    assertAnswer: null,
    humanDiscourse: normalizeTutorStubHumanDiscourseExtraction(update?.human_discourse || update?.humanDiscourse),
  };
  const rejected = [];
  const retracted = new Set();
  const adoptReleasedRow = (row) => {
    if (!row?.fact || retracted.has(row.premise)) return false;
    record.board.set(factKey(row.fact), row.fact);
    if (!accepted.adopt.includes(row.premise)) accepted.adopt.push(row.premise);
    return true;
  };

  for (const premiseId of Array.isArray(update?.retract) ? update.retract : []) {
    const row = released.get(premiseId);
    if (!row?.fact) {
      rejected.push({ type: 'retract', value: premiseId, reason: 'not staged' });
      continue;
    }
    record.board.delete(factKey(row.fact));
    accepted.retract.push(premiseId);
    retracted.add(premiseId);
  }
  for (const premiseId of Array.isArray(update?.adopt) ? update.adopt : []) {
    const row = released.get(premiseId);
    if (!row?.fact) {
      rejected.push({ type: 'adopt', value: premiseId, reason: 'not staged' });
      continue;
    }
    adoptReleasedRow(row);
  }
  for (const fact of Array.isArray(update?.derive) ? update.derive : []) {
    if (!validFactArray(fact)) {
      rejected.push({ type: 'derive', value: fact, reason: 'not a fact array' });
      continue;
    }
    const key = factKey(fact);
    const answersPublicQuestion = Boolean(matchPattern(world.questionPattern, fact));
    let closed = closure([...record.board.values()], world.rules);
    let canonical = closed.facts.get(key);
    if ((!canonical || !closed.proofs.get(key)) && !answersPublicQuestion) {
      const stagedFacts = [...released.values()]
        .filter((row) => row.fact && !retracted.has(row.premise))
        .map((row) => row.fact);
      const stagedClosed = closure([...record.board.values(), ...stagedFacts], world.rules);
      const stagedCanonical = stagedClosed.facts.get(key);
      const stagedProof = stagedClosed.proofs.get(key);
      if (stagedCanonical && stagedProof) {
        for (const baseKey of proofBaseKeys(stagedClosed, key)) adoptReleasedRow(releasedByFactKey.get(baseKey));
        closed = closure([...record.board.values()], world.rules);
        canonical = closed.facts.get(key);
      }
    }
    if (!canonical || !closed.proofs.get(key)) {
      rejected.push({ type: 'derive', value: fact, reason: 'not derivable from accepted public record' });
      continue;
    }
    if (!record.voicedKeys.has(key)) {
      record.voicedKeys.add(key);
      record.voiced.push({ turn: tutorTurn, fact: canonical });
    }
    accepted.derive.push(canonical);
  }
  if (typeof update?.hypothesis === 'string' && update.hypothesis.trim()) {
    const hypothesis = update.hypothesis.trim();
    record.hypotheses.push({ turn: tutorTurn, text: hypothesis });
    accepted.hypothesis = hypothesis;
  }
  let assertion = null;
  if (typeof update?.assert_answer === 'string' && update.assert_answer.trim()) {
    assertion = factFromQuestionAnswer(world, update.assert_answer);
    accepted.assertAnswer = update.assert_answer.trim();
  } else if (validFactArray(update?.asserts)) {
    assertion = update.asserts;
  }
  if (assertion && !matchPattern(world.questionPattern, assertion)) {
    rejected.push({ type: 'assert', value: assertion, reason: 'does not match public question pattern' });
    assertion = null;
    accepted.assertAnswer = null;
  }

  const dagFactDropout = applyTutorStubDagFactDropout({
    dropout,
    board: record.board,
    world,
    turn: tutorTurn,
    adoptedPremiseIds: accepted.adopt,
    retractedPremiseIds: accepted.retract,
    replay: dropoutReplay,
  });
  const snapshot = buildLearnerDagSnapshot(world, {
    turn: tutorTurn,
    boardFacts: [...record.board.values()],
    validFacts: [...record.board.values()],
    voiced: record.voiced,
    hypotheses: record.hypotheses,
    assertion,
    learnerText,
    ledger: resolvedPublicReleaseLedger(world, tutorTurn, publicStagedEvidence, publicReleaseLedger),
    source: 'tutor_stub_tutor_learner_dag_model',
  });
  record.snapshots.push(snapshot);
  const learnerDag = buildLearnerDag(record.snapshots, world);
  const proxyDagMemory = buildLearnerProxyDagMemory({
    turn: tutorTurn,
    questionPattern: world.questionPattern,
    rules: world.rules,
    groundedFacts: [...record.board.values()],
    voiced: record.voiced,
    hypotheses: record.hypotheses,
    factSurface: (fact) => tutorStubPublicFactSurface(world, fact),
  });
  const model = buildTutorLearnerDagModel({
    turn: tutorTurn,
    role: 'tutor',
    proxyDagMemory,
    assessment: learnerDag.assessment,
  });
  model.memoryReliability = dagFactDropout
    ? {
        schema: TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
        configuredRate: dagFactDropout.configuredRate,
        activeDroppedCount: dagFactDropout.activeDropped.length,
        droppedThisTurn: dagFactDropout.droppedNow.length,
        repairedThisTurn: dagFactDropout.repairedNow.length,
        visibility: 'conduct',
      }
    : null;
  return {
    model,
    snapshot,
    dagFactDropout,
    accepted,
    rejected,
    extractor: {
      provider: update?.provider || null,
      model: update?.model || null,
      latencyMs: update?.latencyMs || 0,
      usage: update?.usage || null,
      parseError: update?.parseError || null,
      humanDiscourse: accepted.humanDiscourse,
      notes: typeof update?.notes === 'string' ? update.notes : null,
    },
  };
}

export function buildTutorStubPublicLearnerAnalysisTurnRecord({
  learnerText,
  tutorTurn,
  classification,
  tutorLearnerDag,
  humanDiscourseFrame = null,
} = {}) {
  return {
    turn: Number(tutorTurn),
    learner: String(learnerText || ''),
    classification: classification || null,
    tutorLearnerDagModel: tutorLearnerDag?.model || null,
    tutorLearnerDagUpdate: tutorLearnerDag
      ? {
          accepted: tutorLearnerDag.accepted || null,
          rejected: tutorLearnerDag.rejected || [],
          extractor: tutorLearnerDag.extractor || null,
          dagFactDropout: tutorLearnerDag.dagFactDropout || null,
        }
      : null,
    dagFactDropout: tutorLearnerDag?.dagFactDropout || null,
    ...(humanDiscourseFrame
      ? {
          humanDiscourseFrame,
          scaffoldState: humanDiscourseFrame.scaffoldState || null,
          proofDebt: humanDiscourseFrame.proofDebt || null,
          warrantPremiseAudit: humanDiscourseFrame.warrantPremiseAudit || null,
        }
      : {}),
  };
}

/**
 * Deterministic half of the public learner-analysis pipeline.
 *
 * `rawAnalysis` may be the full envelope returned by
 * `extractTutorStubPublicLearnerAnalysis` or the already-parsed root object.
 * This function performs no model call. The full authored world, mutable
 * learner record/dropout state, and prior observations enter only here.
 */
export function postprocessTutorStubPublicLearnerAnalysis({
  rawAnalysis,
  learnerText,
  world,
  tutorTurn,
  learnerRecord = null,
  dropout = null,
  dropoutReplay = null,
  parseMode = TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES.STRICT_BENCHMARK,
  promptContext = {},
  previousObservation = null,
  previousTurnRecords = [],
  humanDiscourseFrame = null,
  publicStagedEvidence = null,
  publicReleaseLedger = null,
} = {}) {
  const record = learnerRecord || createTutorStubPublicLearnerRecord(world);
  const dropoutState = dropout || createTutorStubDagFactDropoutState();
  try {
    if (!rawAnalysis || typeof rawAnalysis !== 'object' || Array.isArray(rawAnalysis)) {
      throw new TutorStubPublicLearnerAnalysisError(
        'public learner analysis postprocessor requires a raw or parsed analysis object',
        { code: 'missing_analysis_output' },
      );
    }
    const strict = parseMode === TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES.STRICT_BENCHMARK;
    const registerPolicy = String(promptContext.registerPolicy || '').trim();
    const includeRegisterSelection = Boolean(
      promptContext.registerEnabled &&
      !LOCAL_REGISTER_POLICIES.has(registerPolicy) &&
      Array.isArray(promptContext.registerPalette) &&
      promptContext.registerPalette.length,
    );
    const { classification, learnerRecordUpdate, registerSelection } = splitTutorStubPublicLearnerAnalysis(
      rawAnalysis,
      { strict, includeRegisterSelection },
    );
    if (!classification || !learnerRecordUpdate) {
      throw new TutorStubPublicLearnerAnalysisError(
        'public learner analysis did not provide both classification and learner_record',
        { code: 'incomplete_analysis_output' },
      );
    }
    const tutorLearnerDag = applyTutorStubPublicLearnerRecordUpdate({
      update: learnerRecordUpdate,
      world,
      record,
      dropout: dropoutState,
      tutorTurn,
      learnerText,
      dropoutReplay,
      publicStagedEvidence,
      publicReleaseLedger,
    });
    const turnRecord = buildTutorStubPublicLearnerAnalysisTurnRecord({
      learnerText,
      tutorTurn,
      classification,
      tutorLearnerDag,
      humanDiscourseFrame,
    });
    const stateObservation = buildTutorStubStateObservation({
      turnRecord,
      previousObservation,
      previousTurnRecords,
      provenance: {
        prediction_origin: 'after_learner_observation_before_tutor_realization',
        observed_before_tutor_call: true,
        public_analysis_parse_mode: parseMode,
        model_input_public_only: true,
        deterministic_task_key_postprocessor: true,
      },
    });
    return {
      rawAnalysis,
      call_metadata: rawAnalysis.call_metadata || null,
      classification,
      learnerRecordUpdate,
      registerSelection,
      tutorLearnerDag,
      turnRecord,
      stateObservation,
      learnerRecord: record,
      dropout: dropoutState,
      provenance: {
        model_input_public_only: true,
        deterministic_task_key_postprocessor: true,
        analyzerCall: rawAnalysis.callMetadata || null,
      },
    };
  } catch (error) {
    if (rawAnalysis?.call_metadata) {
      error.callMetadata = {
        ...rawAnalysis.call_metadata,
        status: 'technical_failure',
        semantic_rerolls: 0,
      };
    }
    if (rawAnalysis?.callMetadata) error.analysisCallMetadata = rawAnalysis.callMetadata;
    if (typeof rawAnalysis?.rawText === 'string') error.raw_output = rawAnalysis.rawText;
    throw error;
  }
}

/** Full public text -> classifier + learner-DAG -> canonical pre-tutor observation. */
export async function analyzeTutorStubPublicLearnerTurn({
  learnerText,
  topic = '',
  world,
  tutorTurn,
  publicTranscript = [],
  currentTutorText = '',
  historyTurns = 4,
  priorPublicLearnerDag = null,
  learnerRecord = null,
  dropout = null,
  dropoutReplay = null,
  callModel,
  parseMode = TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES.STRICT_BENCHMARK,
  promptContext = {},
  modelCallOptions = {},
  previousObservation = null,
  previousTurnRecords = [],
  humanDiscourseFrame = null,
  publicStagedEvidence = null,
  publicReleaseLedger = null,
} = {}) {
  const stagedPublicProjection = Array.isArray(publicStagedEvidence)
    ? publicStagedEvidence
    : tutorStubPublicStagedEvidence(world, Number(tutorTurn));
  const publicWorld = buildTutorStubPublicLearnerAnalysisWorld(world);
  const registerContext = {
    priorPublicLearnerDagPrompt: priorPublicLearnerDag
      ? JSON.stringify(priorPublicLearnerDag, null, 2)
      : 'No prior tutor-side learner-DAG model is available yet.',
    ...(promptContext.registerContext || {}),
  };
  const rawAnalysis = await extractTutorStubPublicLearnerAnalysis({
    learnerText,
    topic,
    world: publicWorld,
    tutorTurn,
    publicTranscript,
    currentTutorText,
    historyTurns,
    callModel,
    parseMode,
    registerContext,
    modelCallOptions,
    publicStagedEvidence: stagedPublicProjection,
    comprehensionContext: promptContext.comprehensionContext || '',
    learnerDagEnabled: promptContext.learnerDagEnabled ?? true,
    registerPolicy: promptContext.registerPolicy || null,
    registerEnabled: promptContext.registerEnabled === true,
    registerPalette: Array.isArray(promptContext.registerPalette) ? promptContext.registerPalette : [],
    role: promptContext.role || 'tutor_stub_public_learner_analysis',
    maxTokens: Number.isFinite(Number(promptContext.maxTokens)) ? Number(promptContext.maxTokens) : 2500,
  });
  return postprocessTutorStubPublicLearnerAnalysis({
    rawAnalysis,
    learnerText,
    world,
    tutorTurn,
    learnerRecord,
    dropout,
    dropoutReplay,
    parseMode,
    promptContext,
    previousObservation,
    previousTurnRecords,
    humanDiscourseFrame,
    publicStagedEvidence: stagedPublicProjection,
    publicReleaseLedger,
  });
}
