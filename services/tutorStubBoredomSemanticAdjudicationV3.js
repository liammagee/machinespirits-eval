import crypto from 'node:crypto';

import { RESISTANT_LEARNER_OBSERVATION_SEMANTICS, observeResistantLearnerTurn } from './resistantLearnerObservation.js';
import { TUTOR_STUB_BOREDOM_SEMANTIC_OUTPUT_SCHEMA } from './tutorStubBoredomSemanticAdjudication.js';

// Instrument revision 3 (2026-08-21), after the v3 validation run failed its
// specificity (29/39) and agreement (44/54) gates (sealed run archived at
// private-repo commit 83450f09; eval-repo authorization da548a54). All ten
// misses ran one way: the v2 prompt licensed the judge to read MORE cues than
// the registered senses. Two deliberate changes from
// services/tutorStubBoredomSemanticAdjudicationV2.js, which stays frozen for
// the historical chain:
//   1. Effort withdrawal is narrowed to a stated stop of work. The v2 prompt
//      said process impatience "can express that withdrawal" when the learner
//      asks to skip, so a pace wish beside an explicit promise to finish was
//      scored as withdrawal (pumphouse_nonactionable_07). Now a pace request
//      is process impatience only, and a stated commitment to continue the
//      task defeats withdrawal.
//   2. Productive uptake is narrowed to a forward-looking inquiry move. The
//      v2 prompt counted "evidence use ... a substantive answer" as uptake,
//      so reported task compliance was scored as uptake
//      (waterworks_nonactionable_05). Now only wanting to investigate, test,
//      check, compare, or find out something specific counts.
// The derivation rules, output schema, quote-anchored evidence audit,
// confidence gate, auxiliary role, and indeterminate machinery are unchanged
// from v2 by design.

export const TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATION_SCHEMA =
  'machinespirits.tutor-stub.boredom-semantic-adjudication.v3';
export const TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL_REF = 'codex.gpt-5.6-sol';
export const TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_PROVIDER = 'codex';
export const TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL = 'gpt-5.6-sol';
export const TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_ROLE = 'tutor_stub_boredom_performance_adjudication';
export const TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE_CODE = 'TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE';

export { TUTOR_STUB_BOREDOM_SEMANTIC_OUTPUT_SCHEMA };

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
    'A boredom cue is an expressed loss of interest, flat disengagement, or tedium about the present task. A plain polite acknowledgment such as Sure, Fine, or Okay is NOT a boredom cue by itself, and negated boredom is not a cue.',
    'Effort withdrawal means the learner publicly stops work: they say they stopped, quit, gave up, or skipped the work, or they tell the tutor to do it without them. A request or wish for a faster pace, to skip ahead, or to move on is process impatience, NOT effort withdrawal. An explicit statement that the learner will continue or finish the present task defeats effort withdrawal.',
    'Process impatience means the learner pushes for a faster pace: asks to speed up, skip ahead, or move on, or says the work is taking too long. Actionable boredom requires a boredom cue plus effort withdrawal in the narrow sense above; process impatience alone never supplies the withdrawal.',
    'Productive uptake means a forward-looking inquiry move: the learner wants to investigate, test, check, compare, or find out something specific. Reporting completed or compliant work, restating the instructions, giving an answer they were asked for, or a bare statement of uncertainty is NOT uptake by itself.',
    'The verdict follows fixed derivation rules over the four boolean fields: uptake with effort withdrawal is indeterminate; uptake with a boredom cue is productive_uptake; uptake with no boredom cue is no_boredom, because engagement without boredom is not a boredom event; a boredom cue with effort withdrawal is actionable_boredom; a boredom cue or process impatience alone is nonactionable_boredom; otherwise no_boredom. Declare the verdict these rules give.',
    'Return strict JSON only. Every true semantic field must have at least one supporting span whose text is copied verbatim, character for character, from the candidate. The quoted text is authoritative: give your best-effort start and end offsets, but the harness recomputes offsets from the quote, and only a quote that is not an exact substring of the candidate fails.',
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
    const text = typeof row.text === 'string' ? row.text : '';
    if (!EVIDENCE_KINDS.has(kind)) issues.push(`evidence_${index}_kind_invalid`);
    // The quote is authoritative. Offsets are recomputed from the first
    // occurrence of the exact quote; model-supplied offsets are advisory only.
    const anchor = text ? candidate.indexOf(text) : -1;
    if (!text || anchor < 0) {
      issues.push(`evidence_${index}_text_not_substring`);
      continue;
    }
    normalized.push({ kind, start: anchor, end: anchor + text.length, text });
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

// Identical rules to expectedVerdictV2; re-exported under the v3 name so the
// v4 validation chain never imports from the frozen v2 module.
export function expectedVerdictV3(fields) {
  if (fields.productive_uptake && fields.effort_withdrawal) return 'indeterminate';
  if (fields.productive_uptake && fields.boredom_cue) return 'productive_uptake';
  if (fields.productive_uptake) return 'no_boredom';
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
  const semanticVerdict = expectedVerdictV3(fields);
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
    version: 3,
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
