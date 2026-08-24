import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TUTOR_STUB_RIVAL_ATTENTION_OBSERVATION_V3 =
  'prospective_rival_attention_semantic_v3';
export const TUTOR_STUB_RIVAL_ATTENTION_REGISTRATION_V3 =
  'config/tutor-stub-resistant-learner-b1-trigger-registration.v3.json';
export const TUTOR_STUB_RIVAL_ATTENTION_MODEL_SCHEMA_V3 =
  'machinespirits.tutor-stub.rival-attention-judge-response.v3';
export const TUTOR_STUB_RIVAL_ATTENTION_ADJUDICATION_SCHEMA_V3 =
  'machinespirits.tutor-stub.rival-attention-adjudication.v3';
export const TUTOR_STUB_RIVAL_ATTENTION_ROLE_V3 = 'tutor_stub_resistant_learner_rival_attention_judge';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OBJECTIVES = Object.freeze([
  'rival_objective',
  'tutor_world_thread',
  'authored_bridge',
  'neither',
  'indeterminate',
]);
const WORK = Object.freeze([
  'new_evidence_bearing_work',
  'echo_or_restatement',
  'stock_affect_only',
  'no_objective_work',
  'indeterminate',
]);
const CONFIDENCE = Object.freeze(['high', 'medium', 'low']);

export const TUTOR_STUB_RIVAL_ATTENTION_OUTPUT_SCHEMA_V3 = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['schema', 'case_id', 'objective_advanced', 'work_status', 'evidence_quote', 'confidence', 'reason'],
  properties: {
    schema: { type: 'string', enum: [TUTOR_STUB_RIVAL_ATTENTION_MODEL_SCHEMA_V3] },
    case_id: { type: 'string', minLength: 1 },
    objective_advanced: { type: 'string', enum: OBJECTIVES },
    work_status: { type: 'string', enum: WORK },
    evidence_quote: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] },
    confidence: { type: 'string', enum: CONFIDENCE },
    reason: { type: 'string', minLength: 1 },
  },
});

function sha256(value) {
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

function jsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  const source = String(value || '').trim();
  try {
    return JSON.parse(source);
  } catch {
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(source.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export function validateTutorStubRivalAttentionRegistrationV3(registration) {
  const issues = [];
  if (
    registration?.schema !== 'machinespirits.tutor-stub.rival-attention-trigger-registration.v3' ||
    registration?.version !== 3 ||
    registration?.status !== 'prospective_gate_1c_zero_call_registration' ||
    registration?.observationSemantics !== TUTOR_STUB_RIVAL_ATTENTION_OBSERVATION_V3
  ) {
    issues.push('rival-attention registration identity drifted');
  }
  const judge = registration?.measurement?.judge;
  if (
    judge?.id !== 'rival_attention_observer' ||
    judge?.modelRef !== 'codex.gpt-5.6-sol' ||
    judge?.provider !== 'codex' ||
    judge?.model !== 'gpt-5.6-sol' ||
    judge?.effort !== 'low'
  ) {
    issues.push('rival-attention judge route drifted');
  }
  const trigger = registration?.measurement?.triggerRule;
  if (
    trigger?.objective !== 'rival_objective' ||
    trigger?.workStatus !== 'new_evidence_bearing_work' ||
    trigger?.maximumLearnerTurn !== 4 ||
    trigger?.echoOrRestatementCounts !== false ||
    trigger?.stockBoredomAffectCounts !== false ||
    trigger?.indeterminateDisposition !== 'turn_ineligible_read_next_turn'
  ) {
    issues.push('rival-attention trigger rule drifted');
  }
  return { valid: issues.length === 0, issues };
}

export function loadTutorStubRivalAttentionRegistrationV3({
  registrationPath = TUTOR_STUB_RIVAL_ATTENTION_REGISTRATION_V3,
  root = ROOT,
} = {}) {
  const absolute = path.resolve(root, registrationPath);
  const source = fs.readFileSync(absolute);
  const registration = JSON.parse(source);
  const validation = validateTutorStubRivalAttentionRegistrationV3(registration);
  if (!validation.valid) throw new Error(`rival-attention registration invalid: ${validation.issues.join('; ')}`);
  return { path: registrationPath, sha256: sha256(source), registration };
}

function publicTranscript(state) {
  return (state?.history || [])
    .filter((row) => ['assistant', 'user', 'learner'].includes(row?.role) && String(row?.content || '').trim())
    .slice(-12)
    .map((row) => ({ role: row.role === 'assistant' ? 'tutor' : 'learner', text: String(row.content) }));
}

export function buildTutorStubRivalAttentionPromptV3({ caseId, learnerText, state, registration }) {
  return {
    schema: 'machinespirits.tutor-stub.rival-attention-judge-prompt.v3',
    case_id: caseId,
    construct:
      'Which public objective the current learner turn advances: the tutor-world thread, the learner-maintained rival objective, an authored bridge between them, or neither.',
    instructions: [
      'Judge objective advancement, not whether the learner sounds bored, interested, defiant, or polite.',
      'rival_objective means the learner publicly performs new evidence-bearing work on an alternative objective rather than advancing the tutor-world thread.',
      'tutor_world_thread means the turn advances the tutor-world inquiry without doing rival-objective work.',
      'authored_bridge means the learner newly connects a publicly solicited rival item to public tutor-world evidence; it is not a rival-attention trigger.',
      'A restatement or paraphrase of rival material already public in the transcript is echo_or_restatement and cannot trigger.',
      'A stock boredom sentence, affect report, bare refusal, assent, or repetition is not objective work and cannot trigger.',
      'Use indeterminate rather than guessing. High or medium confidence is eligible; low confidence is measurement_indeterminate.',
      'For any determinate objective other than neither, evidence_quote must be copied verbatim as an exact substring of current_learner_turn. Do not paraphrase it.',
      `Return only JSON conforming exactly to ${TUTOR_STUB_RIVAL_ATTENTION_MODEL_SCHEMA_V3}.`,
    ],
    public_transcript: publicTranscript(state),
    current_learner_turn: String(learnerText || ''),
    output_schema: TUTOR_STUB_RIVAL_ATTENTION_OUTPUT_SCHEMA_V3,
    registration: {
      path: TUTOR_STUB_RIVAL_ATTENTION_REGISTRATION_V3,
      version: registration.version,
    },
  };
}

export function parseTutorStubRivalAttentionAdjudicationV3({
  raw,
  caseId,
  learnerText,
  observedRoute = null,
  registrationBinding = null,
} = {}) {
  const parsed = jsonObject(raw);
  const issues = [];
  const expectedKeys = ['schema', 'case_id', 'objective_advanced', 'work_status', 'evidence_quote', 'confidence', 'reason'];
  if (!exactKeys(parsed, expectedKeys)) issues.push('judge response keys are not exact');
  if (parsed?.schema !== TUTOR_STUB_RIVAL_ATTENTION_MODEL_SCHEMA_V3) issues.push('judge response schema mismatch');
  if (parsed?.case_id !== caseId) issues.push('judge case id mismatch');
  if (!OBJECTIVES.includes(parsed?.objective_advanced)) issues.push('objective_advanced is invalid');
  if (!WORK.includes(parsed?.work_status)) issues.push('work_status is invalid');
  if (!CONFIDENCE.includes(parsed?.confidence)) issues.push('confidence is invalid');
  const evidence = parsed?.evidence_quote;
  const needsEvidence = parsed?.objective_advanced && !['neither', 'indeterminate'].includes(parsed.objective_advanced);
  if (needsEvidence && !String(evidence || '')) issues.push('determinate objective requires evidence_quote');
  if (!needsEvidence && evidence !== null) issues.push('neither or indeterminate objective requires null evidence_quote');
  if (String(evidence || '') && !String(learnerText || '').includes(evidence)) {
    issues.push('evidence_quote is not an exact substring of current learner turn');
  }
  if (
    observedRoute &&
    (observedRoute.provider !== 'codex' || observedRoute.model !== 'gpt-5.6-sol')
  ) {
    issues.push('independent route mismatch');
  }
  const determinate =
    issues.length === 0 &&
    ['high', 'medium'].includes(parsed?.confidence) &&
    parsed?.objective_advanced !== 'indeterminate' &&
    parsed?.work_status !== 'indeterminate';
  const fires =
    determinate &&
    parsed.objective_advanced === 'rival_objective' &&
    parsed.work_status === 'new_evidence_bearing_work';
  return {
    schema: TUTOR_STUB_RIVAL_ATTENTION_ADJUDICATION_SCHEMA_V3,
    version: 3,
    case_id: caseId,
    candidate_sha256: sha256(String(learnerText || '')),
    objective_advanced: parsed?.objective_advanced || 'indeterminate',
    work_status: parsed?.work_status || 'indeterminate',
    confidence: CONFIDENCE.includes(parsed?.confidence) ? parsed.confidence : null,
    evidence_quote: typeof evidence === 'string' ? evidence : null,
    reason: typeof parsed?.reason === 'string' ? parsed.reason : null,
    measurement_disposition: determinate
      ? fires
        ? 'rival_attention_trigger'
        : 'no_rival_attention_trigger'
      : 'measurement_indeterminate',
    trigger_fires: fires,
    parse_ok: issues.length === 0,
    issues,
    independent_route: {
      required_model_ref: 'codex.gpt-5.6-sol',
      observed_provider: observedRoute?.provider || null,
      observed_model: observedRoute?.model || null,
      matches: observedRoute ? issues.includes('independent route mismatch') === false : null,
    },
    registration_path: registrationBinding?.path || null,
    registration_sha256: registrationBinding?.sha256 || null,
  };
}

export async function adjudicateTutorStubRivalAttentionV3({
  learnerText,
  state,
  turn,
  callModel,
  resolved,
  registrationBinding,
  signal = null,
} = {}) {
  const caseId = `${state?.resistanceActionRegisterStudy?.job_id || 'B1'}:turn:${turn}`;
  const prompt = buildTutorStubRivalAttentionPromptV3({
    caseId,
    learnerText,
    state,
    registration: registrationBinding.registration,
  });
  const response = await callModel({
    prompt: JSON.stringify(prompt),
    systemPrompt:
      'You are one independent rival-attention observer. Use only the supplied public transcript and current learner turn. Return the registered JSON object and use no tools.',
    resolved,
    role: TUTOR_STUB_RIVAL_ATTENTION_ROLE_V3,
    maxTokens: 700,
    trace: state?.trace || null,
    cliEffort: 'low',
    effort: 'low',
    outputSchema: TUTOR_STUB_RIVAL_ATTENTION_OUTPUT_SCHEMA_V3,
    turn,
    signal,
  });
  return {
    ...parseTutorStubRivalAttentionAdjudicationV3({
      raw: response?.text || '',
      caseId,
      learnerText,
      observedRoute: { provider: response?.provider, model: response?.model },
      registrationBinding,
    }),
    call: {
      provider: response?.provider || null,
      model: response?.model || null,
      latency_ms: response?.latencyMs ?? null,
      usage: response?.usage || null,
    },
  };
}

export function createTutorStubRivalAttentionAdjudicatorV3(
  callModel,
  resolveModel,
  { registrationPath = TUTOR_STUB_RIVAL_ATTENTION_REGISTRATION_V3, root = ROOT } = {},
) {
  const registrationBinding = loadTutorStubRivalAttentionRegistrationV3({ registrationPath, root });
  const judge = registrationBinding.registration.measurement.judge;
  const resolved = resolveModel(judge.modelRef);
  if (resolved?.provider !== judge.provider || resolved?.model !== judge.model) {
    throw new Error('rival-attention observer route does not resolve to the registered Sol seat');
  }
  return ({ learnerText, state, turn, signal }) =>
    adjudicateTutorStubRivalAttentionV3({
      learnerText,
      state,
      turn,
      callModel,
      resolved,
      registrationBinding,
      signal,
    });
}
