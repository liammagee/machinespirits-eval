import crypto from 'node:crypto';

import { RESISTANT_LEARNER_OBSERVATION_SEMANTICS, observeResistantLearnerTurn } from './resistantLearnerObservation.js';

export const TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATION_SCHEMA =
  'machinespirits.tutor-stub.boredom-semantic-adjudication.v1';
export const TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL_REF = 'codex.gpt-5.6-sol';
export const TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_PROVIDER = 'codex';
export const TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL = 'gpt-5.6-sol';
export const TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_ROLE = 'tutor_stub_boredom_performance_adjudication';
export const TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE_CODE = 'TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE';

export const TUTOR_STUB_BOREDOM_SEMANTIC_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
    'verdict',
    'boredom_cue',
    'effort_withdrawal',
    'productive_uptake',
    'process_impatience',
    'confidence',
    'evidence',
    'reason',
  ],
  properties: {
    verdict: {
      type: 'string',
      enum: ['actionable_boredom', 'productive_uptake', 'nonactionable_boredom', 'no_boredom', 'indeterminate'],
    },
    boredom_cue: { type: 'boolean' },
    effort_withdrawal: { type: 'boolean' },
    productive_uptake: { type: 'boolean' },
    process_impatience: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'start', 'end', 'text'],
        properties: {
          kind: {
            type: 'string',
            enum: ['boredom_cue', 'effort_withdrawal', 'productive_uptake', 'process_impatience'],
          },
          start: { type: 'integer', minimum: 0 },
          end: { type: 'integer', minimum: 1 },
          text: { type: 'string', minLength: 1 },
        },
      },
    },
    reason: { type: 'string', minLength: 1 },
  },
});

const VERDICTS = new Set(TUTOR_STUB_BOREDOM_SEMANTIC_OUTPUT_SCHEMA.properties.verdict.enum);
const EVIDENCE_KINDS = new Set(
  TUTOR_STUB_BOREDOM_SEMANTIC_OUTPUT_SCHEMA.properties.evidence.items.properties.kind.enum,
);
const REQUIRED_EVIDENCE_BY_FIELD = Object.freeze({
  boredom_cue: 'boredom_cue',
  effort_withdrawal: 'effort_withdrawal',
  productive_uptake: 'productive_uptake',
  process_impatience: 'process_impatience',
});
const REQUIRED_OUTPUT_KEYS = new Set(TUTOR_STUB_BOREDOM_SEMANTIC_OUTPUT_SCHEMA.required);
const REQUIRED_EVIDENCE_KEYS = new Set(TUTOR_STUB_BOREDOM_SEMANTIC_OUTPUT_SCHEMA.properties.evidence.items.required);

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

function jsonObjectFromText(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu)?.[1] || text;
  try {
    return JSON.parse(fenced);
  } catch {
    const start = fenced.indexOf('{');
    const end = fenced.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(fenced.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export function tutorStubBoredomSemanticAdjudicationSystemPrompt() {
  return [
    'You are an independent semantic measurement seat for one already-public learner utterance.',
    'Judge compositional pragmatic meaning, not keyword presence. You are not the learner generator and must not infer treatment assignment, tutor quality, hidden state, or future outcomes.',
    'Actionable boredom requires a boredom or flat-disengagement cue plus public withdrawal of effort from the present task. Process impatience can express that withdrawal when the utterance asks to end, skip, or escape the task without contributing substantive task content.',
    'Productive uptake means genuine content-bearing engagement: evidence use, a bounded test, a substantive answer, an inference, or a concrete next inquiry move. A polite cue such as Sure or Fine does not make productive uptake bored.',
    'Boredom or impatience without actionable effort withdrawal is nonactionable_boredom. Ordinary brevity, uncertainty, agreement, politeness, negated boredom, lexical near-matches, and impatience that still contains substantive uptake are not actionable boredom.',
    'Explicit precedence: productive uptake defeats a mere cue; actionable effort withdrawal without productive uptake licenses action; a genuinely mixed utterance containing both productive uptake and effort withdrawal is indeterminate.',
    'Return strict JSON only. Every true semantic field must have at least one tight exact quoted span using UTF-16 offsets into the candidate. Do not invent or normalize span text.',
  ].join('\n');
}

export function tutorStubBoredomSemanticAdjudicationUserPrompt({ candidate = '' } = {}) {
  return ['[Public learner utterance]', String(candidate || ''), '[End public learner utterance]'].join('\n');
}

function validateEvidence(candidate, evidence) {
  const issues = [];
  if (!Array.isArray(evidence)) issues.push('evidence_array_required');
  const rows = Array.isArray(evidence) ? evidence : [];
  const normalized = [];
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      issues.push(`evidence_${index}_object_required`);
      continue;
    }
    const keys = Object.keys(row);
    for (const key of REQUIRED_EVIDENCE_KEYS) {
      if (!Object.hasOwn(row, key)) issues.push(`evidence_${index}_missing:${key}`);
    }
    for (const key of keys) {
      if (!REQUIRED_EVIDENCE_KEYS.has(key)) issues.push(`evidence_${index}_unexpected:${key}`);
    }
    const kind = typeof row.kind === 'string' ? row.kind : '';
    const start = row.start;
    const end = row.end;
    const text = typeof row.text === 'string' ? row.text : '';
    if (!EVIDENCE_KINDS.has(kind)) issues.push(`evidence_${index}_kind_invalid`);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > candidate.length) {
      issues.push(`evidence_${index}_offset_invalid`);
      continue;
    }
    if (candidate.slice(start, end) !== text) issues.push(`evidence_${index}_text_mismatch`);
    normalized.push({ kind, start, end, text });
  }
  return { pass: issues.length === 0, issues, evidence: normalized };
}

function validateOutputShape(parsed) {
  const issues = [];
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return ['output_object_required'];
  for (const key of REQUIRED_OUTPUT_KEYS) {
    if (!Object.hasOwn(parsed, key)) issues.push(`output_missing:${key}`);
  }
  for (const key of Object.keys(parsed)) {
    if (!REQUIRED_OUTPUT_KEYS.has(key)) issues.push(`output_unexpected:${key}`);
  }
  for (const field of Object.keys(REQUIRED_EVIDENCE_BY_FIELD)) {
    if (typeof parsed[field] !== 'boolean') issues.push(`output_boolean_required:${field}`);
  }
  if (typeof parsed.verdict !== 'string' || !VERDICTS.has(parsed.verdict)) issues.push('output_verdict_invalid');
  if (typeof parsed.confidence !== 'number' || !Number.isFinite(parsed.confidence)) {
    issues.push('output_confidence_number_required');
  }
  if (typeof parsed.reason !== 'string' || !parsed.reason.trim()) issues.push('output_reason_required');
  return issues;
}

function declaredFields(parsed) {
  return {
    boredom_cue: parsed?.boredom_cue === true,
    effort_withdrawal: parsed?.effort_withdrawal === true,
    productive_uptake: parsed?.productive_uptake === true,
    process_impatience: parsed?.process_impatience === true,
  };
}

function expectedVerdict(fields) {
  if (fields.productive_uptake && fields.effort_withdrawal) return 'indeterminate';
  if (fields.productive_uptake) return 'productive_uptake';
  if (fields.boredom_cue && fields.effort_withdrawal) return 'actionable_boredom';
  if (fields.boredom_cue || fields.process_impatience) return 'nonactionable_boredom';
  return 'no_boredom';
}

function auxiliaryPolarity(auxiliaryObservation) {
  const disposition = String(auxiliaryObservation?.disposition || '');
  if (disposition === 'positive_actionable_withdrawal_without_uptake') return 'actionable_boredom';
  if (disposition === 'negative_productive_uptake_precedes_cue') return 'productive_uptake';
  if (disposition === 'ambiguous_withdrawal_and_productive_uptake') return 'indeterminate';
  return 'neutral';
}

export function parseTutorStubBoredomSemanticAdjudication({
  raw = '',
  candidate = '',
  auxiliaryObservation = null,
  minimumConfidence = 0.8,
  observedRoute = null,
} = {}) {
  const source = String(candidate || '');
  const parsed = typeof raw === 'object' && raw !== null ? raw : jsonObjectFromText(raw);
  const declaredVerdict = VERDICTS.has(parsed?.verdict) ? parsed.verdict : 'invalid';
  const fields = declaredFields(parsed);
  const evidenceAudit = validateEvidence(source, parsed?.evidence);
  const issues = [...validateOutputShape(parsed), ...evidenceAudit.issues];
  for (const [field, kind] of Object.entries(REQUIRED_EVIDENCE_BY_FIELD)) {
    if (fields[field] && !evidenceAudit.evidence.some((row) => row.kind === kind)) {
      issues.push(`true_field_missing_evidence:${field}`);
    }
  }
  const confidence = Number(parsed?.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) issues.push('confidence_invalid');
  const semanticVerdict = expectedVerdict(fields);
  if (declaredVerdict !== 'invalid' && declaredVerdict !== semanticVerdict) issues.push('verdict_field_inconsistency');
  const routeMatches =
    observedRoute?.provider === TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_PROVIDER &&
    observedRoute?.model === TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL;
  if (observedRoute && !routeMatches) issues.push('independent_route_mismatch');
  const auxiliary = auxiliaryPolarity(auxiliaryObservation);
  const auxiliaryContradiction =
    auxiliary === 'indeterminate' || (auxiliary !== 'neutral' && auxiliary !== semanticVerdict);
  const lowConfidence = !Number.isFinite(confidence) || confidence < minimumConfidence;
  const parseOk = Boolean(parsed) && declaredVerdict !== 'invalid' && evidenceAudit.pass && issues.length === 0;
  const measurementDisposition =
    !parseOk || lowConfidence || auxiliaryContradiction || semanticVerdict === 'indeterminate'
      ? 'measurement_indeterminate'
      : semanticVerdict;
  return {
    schema: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATION_SCHEMA,
    version: 1,
    candidate_sha256: sha256(source),
    declared_verdict: declaredVerdict,
    semantic_verdict: semanticVerdict,
    measurement_disposition: measurementDisposition,
    fields,
    confidence: Number.isFinite(confidence) ? confidence : null,
    minimum_confidence: minimumConfidence,
    reason:
      String(parsed?.reason || '')
        .replace(/\s+/gu, ' ')
        .trim() || null,
    evidence_audit: evidenceAudit,
    auxiliary: {
      role: 'high_precision_signal_only_never_final_authority',
      polarity: auxiliary,
      contradiction: auxiliaryContradiction,
      lexical_silence_can_veto_semantic_positive: false,
    },
    independent_route: {
      required_model_ref: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL_REF,
      observed_provider: observedRoute?.provider || null,
      observed_model: observedRoute?.model || null,
      matches: observedRoute ? routeMatches : null,
    },
    parse_ok: parseOk,
    low_confidence: lowConfidence,
    issues,
  };
}

export async function adjudicateTutorStubBoredomObservation({
  candidate = '',
  auxiliaryObservation = null,
  callModel,
  resolved,
  trace = null,
  turn = null,
  signal = null,
} = {}) {
  if (typeof callModel !== 'function') throw new Error('boredom semantic adjudication requires a model caller');
  if (
    resolved?.provider !== TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_PROVIDER ||
    resolved?.model !== TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL
  ) {
    throw new Error('boredom semantic adjudication requires the independently pinned Codex Sol route');
  }
  const response = await callModel({
    prompt: tutorStubBoredomSemanticAdjudicationUserPrompt({ candidate }),
    systemPrompt: tutorStubBoredomSemanticAdjudicationSystemPrompt(),
    resolved,
    role: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_ROLE,
    maxTokens: 700,
    trace,
    cliEffort: 'low',
    effort: 'low',
    outputSchema: TUTOR_STUB_BOREDOM_SEMANTIC_OUTPUT_SCHEMA,
    turn,
    signal,
  });
  return {
    ...parseTutorStubBoredomSemanticAdjudication({
      raw: response?.text || '',
      candidate,
      auxiliaryObservation,
      observedRoute: { provider: response?.provider, model: response?.model },
    }),
    call: {
      provider: response?.provider || null,
      model: response?.model || null,
      latency_ms: response?.latencyMs ?? null,
      usage: response?.usage || null,
    },
  };
}

export function createTutorStubBoredomSemanticAdjudicator(callModel, resolveModel) {
  if (typeof resolveModel !== 'function') throw new Error('boredom semantic adjudication requires model resolution');
  const resolved = resolveModel(TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL_REF);
  return ({ learnerText, classification, tutorLearnerDag, state, turn, signal }) => {
    const auxiliary = observeResistantLearnerTurn({
      learnerText,
      classification,
      tutorLearnerDag,
      semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV9,
    });
    return adjudicateTutorStubBoredomObservation({
      candidate: learnerText,
      auxiliaryObservation: auxiliary.boredom_composition || null,
      callModel,
      resolved,
      trace: state?.trace || null,
      turn,
      signal,
    });
  };
}

export function throwTutorStubBoredomMeasurementIndeterminate({ adjudication, turn } = {}) {
  const error = new Error('boredom semantic measurement is indeterminate; stopping without repair or replacement');
  error.code = TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE_CODE;
  error.turn = turn;
  error.disposition = 'measurement_indeterminate_stop_no_repair_no_replacement';
  error.semanticAdjudication = adjudication;
  error.substantiveStudyFailure = true;
  throw error;
}
