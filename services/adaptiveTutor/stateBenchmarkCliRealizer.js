import { callAIWithCliBridge, normalizeCliEffort } from '../cliProviderBridge.js';
import { resolveModel } from '../evalConfigLoader.js';
import { canonicalJson, hashCanonicalJson, sha256 } from '../experimentRunArtifacts.js';

export const ADAPTIVE_STATE_CLI_REALIZER_CALL_SCHEMA =
  'machinespirits.adaptive-state-cli-realizer-call.v2';

export const ADAPTIVE_STATE_CLI_REALIZER_OUTPUT_JSON_SCHEMA = Object.freeze({
  type: 'object',
  required: Object.freeze(['learner_text', 'realized_public_event_ids']),
  additionalProperties: false,
  properties: Object.freeze({
    // Keep the provider-facing schema inside the strict structured-output
    // subset. Non-empty text and unique event ids are enforced by the local
    // parser below, because provider schemas reject minLength/uniqueItems.
    learner_text: Object.freeze({ type: 'string' }),
    realized_public_event_ids: Object.freeze({
      type: 'array',
      items: Object.freeze({ type: 'string' }),
    }),
  }),
});

const INPUT_KEYS = Object.freeze([
  'currentAction',
  'currentPublicActEnvelope',
  'priorPublicTranscript',
  'publicWorldVocabulary',
]);
const OUTPUT_KEYS = Object.freeze(['learner_text', 'realized_public_event_ids']);
const CLI_PROVIDERS = new Set(['codex', 'claude-code']);
const FORBIDDEN_INPUT_KEY = new Set([
  'answer_key',
  'future',
  'future_state',
  'future_target',
  'hidden',
  'hidden_state',
  'next_state',
  'oracle',
  'private',
  'proof_transition',
  'required_realizer_output',
  'target',
  'targets',
]);

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`stateBenchmarkCliRealizer: ${label} must be an object`);
  }
  return value;
}

function normalizedKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/[^a-z0-9]+/giu, '_')
    .replace(/^_+|_+$/gu, '')
    .toLowerCase();
}

function scanPublicInput(value, { path = 'input', forbiddenValues = new Set() } = {}) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => scanPublicInput(child, { path: `${path}[${index}]`, forbiddenValues }));
    return;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && forbiddenValues.has(value)) {
      throw new Error(`stateBenchmarkCliRealizer: forbidden private value at ${path}`);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizedKey(key);
    if (
      FORBIDDEN_INPUT_KEY.has(normalized) ||
      normalized.startsWith('future_') ||
      normalized.startsWith('hidden_') ||
      normalized.startsWith('private_') ||
      normalized.startsWith('oracle_') ||
      normalized.endsWith('_target')
    ) {
      throw new Error(`stateBenchmarkCliRealizer: forbidden input ${path}.${key}`);
    }
    scanPublicInput(child, { path: `${path}.${key}`, forbiddenValues });
  }
}

function normalizeForbiddenValues(values) {
  if (values === null || values === undefined) return new Set();
  if (!Array.isArray(values)) {
    throw new Error('stateBenchmarkCliRealizer: forbiddenValues must be an array when supplied');
  }
  return new Set(values.filter((value) => typeof value === 'string' && value.length > 0));
}

export function buildAdaptiveStateCliRealizerInput({
  currentPublicActEnvelope,
  priorPublicTranscript = [],
  currentAction = null,
  publicWorldVocabulary = {},
} = {}) {
  const input = {
    currentPublicActEnvelope: clone(currentPublicActEnvelope),
    priorPublicTranscript: clone(priorPublicTranscript),
    currentAction: clone(currentAction),
    publicWorldVocabulary: clone(publicWorldVocabulary),
  };
  validateAdaptiveStateCliRealizerInput(input);
  return input;
}

export function validateAdaptiveStateCliRealizerInput(input, { forbiddenValues = [] } = {}) {
  requirePlainObject(input, 'input');
  const keys = Object.keys(input).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...INPUT_KEYS].sort())) {
    throw new Error(`stateBenchmarkCliRealizer: input must contain exactly ${INPUT_KEYS.join(', ')}`);
  }
  requirePlainObject(input.currentPublicActEnvelope, 'input.currentPublicActEnvelope');
  if (!Array.isArray(input.priorPublicTranscript)) {
    throw new Error('stateBenchmarkCliRealizer: input.priorPublicTranscript must be an array');
  }
  if (input.currentAction !== null) requirePlainObject(input.currentAction, 'input.currentAction');
  requirePlainObject(input.publicWorldVocabulary, 'input.publicWorldVocabulary');
  scanPublicInput(input, { forbiddenValues: normalizeForbiddenValues(forbiddenValues) });
  // This also rejects undefined, BigInt, cycles, and other non-JSON evidence.
  canonicalJson(input);
  return true;
}

function validateExpectedEventIds(expectedEventIds) {
  if (!Array.isArray(expectedEventIds) || expectedEventIds.some((value) => typeof value !== 'string')) {
    throw new Error('stateBenchmarkCliRealizer: expectedEventIds must be an array of strings');
  }
  if (new Set(expectedEventIds).size !== expectedEventIds.length) {
    throw new Error('stateBenchmarkCliRealizer: expectedEventIds must not contain duplicates');
  }
  return [...expectedEventIds];
}

export function parseAdaptiveStateCliRealizerOutput(raw, { expectedEventIds } = {}) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('stateBenchmarkCliRealizer: model returned an empty learner-turn payload');
  }
  let parsed;
  try {
    // Deliberately strict: no fence extraction, substring recovery, jsonrepair,
    // or semantic reroll is permitted on this benchmark path.
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`stateBenchmarkCliRealizer: learner-turn payload is not strict JSON: ${error.message}`);
  }
  requirePlainObject(parsed, 'learner-turn payload');
  const keys = Object.keys(parsed).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...OUTPUT_KEYS].sort())) {
    throw new Error(`stateBenchmarkCliRealizer: learner-turn payload must contain exactly ${OUTPUT_KEYS.join(', ')}`);
  }
  if (typeof parsed.learner_text !== 'string' || !parsed.learner_text.trim()) {
    throw new Error('stateBenchmarkCliRealizer: learner_text must be a non-empty string');
  }
  if (
    !Array.isArray(parsed.realized_public_event_ids) ||
    parsed.realized_public_event_ids.some((value) => typeof value !== 'string')
  ) {
    throw new Error('stateBenchmarkCliRealizer: realized_public_event_ids must be an array of strings');
  }
  if (new Set(parsed.realized_public_event_ids).size !== parsed.realized_public_event_ids.length) {
    throw new Error('stateBenchmarkCliRealizer: realized_public_event_ids must not contain duplicates');
  }
  const expected = validateExpectedEventIds(expectedEventIds);
  if (JSON.stringify(parsed.realized_public_event_ids) !== JSON.stringify(expected)) {
    throw new Error('stateBenchmarkCliRealizer: realized_public_event_ids differ from the harness-owned event ids');
  }
  return {
    learner_text: parsed.learner_text.trim(),
    realized_public_event_ids: [...parsed.realized_public_event_ids],
  };
}

export function buildAdaptiveStateCliRealizerSystemPrompt() {
  return [
    'Realize exactly one learner turn from the supplied public transition envelope.',
    'Use only the supplied public information. Do not invent, preview, or infer a later transition.',
    'The learner_text must make exactly the current envelope event semantically explicit in ordinary language, not merely copy its id into the sidecar.',
    'For adopt, newly accept or use the named current evidence; for retract, explicitly withdraw the named prior premise or hypothesis; for derive, state one new supported conclusion or answer.',
    'For none, introduce no new adoption, retraction, conclusion, or answer; you may ask a question, report uncertainty, or refer to already-held evidence without presenting it as newly accepted.',
    'Do not add a second event family to learner_text.',
    'Do not write literal public event ids or event-family labels such as adopt, retract, derive, or none in learner_text.',
    'Copy the current public event ids exactly into realized_public_event_ids.',
    'Do not use tools, commands, files, browsing, external retrieval, or side effects.',
    'Return only one JSON object with learner_text and realized_public_event_ids.',
    'Do not return markdown, commentary, hidden reasoning, or additional keys.',
  ].join(' ');
}

function normalizedContext(context) {
  if (context === null || context === undefined) return {};
  requirePlainObject(context, 'context');
  return clone(context);
}

function technicalFailure(error, callMetadata) {
  const failure = error instanceof Error ? error : new Error(String(error));
  const dispatchCount = Number(callMetadata?.dispatch_count || 0);
  failure.callMetadata = {
    ...clone(callMetadata),
    status: 'technical_failure',
    attempts: dispatchCount,
    dispatch_count: dispatchCount,
    semantic_rerolls: 0,
    error: failure.message,
  };
  return failure;
}

function resolvedModelLabel(provider, model) {
  return `${provider}/${model}`;
}

/**
 * Make exactly one schema-constrained CLI call for one learner turn.
 * There is intentionally no retry, fallback, repair, or output coercion.
 */
export async function callAdaptiveStateCliRealizer({
  modelRef,
  input,
  expectedEventIds,
  effort,
  timeoutMs,
  context = {},
  role = 'adaptive_state_learner_realizer',
  forbiddenValues = [],
  signal = null,
  callCli = callAIWithCliBridge,
  resolveModelRef = resolveModel,
  clock = () => Date.now(),
} = {}) {
  const requestedModelRef = String(modelRef || '').trim();
  const startedAtMs = Number(clock());
  let callMetadata = {
    schema: ADAPTIVE_STATE_CLI_REALIZER_CALL_SCHEMA,
    status: 'started',
    role,
    context: normalizedContext(context),
    requested_model_ref: requestedModelRef || null,
    attempts: 0,
    dispatch_count: 0,
    semantic_rerolls: 0,
    started_at_ms: Number.isFinite(startedAtMs) ? startedAtMs : null,
  };
  let rawText = null;
  let systemPrompt = null;
  let userPrompt = null;
  try {
    if (!requestedModelRef) throw new Error('stateBenchmarkCliRealizer: modelRef is required');
    validateAdaptiveStateCliRealizerInput(input, { forbiddenValues });
    const expected = validateExpectedEventIds(expectedEventIds);
    const normalizedEffort = normalizeCliEffort(effort);
    if (!normalizedEffort || normalizedEffort === 'config') {
      throw new Error('stateBenchmarkCliRealizer: effort must be explicitly pinned and may not be config');
    }
    if (!Number.isSafeInteger(Number(timeoutMs)) || Number(timeoutMs) <= 0) {
      throw new Error('stateBenchmarkCliRealizer: timeoutMs must be a positive safe integer');
    }
    const resolved = resolveModelRef(requestedModelRef, { forceReload: true });
    if (!CLI_PROVIDERS.has(resolved?.provider)) {
      throw new Error(`stateBenchmarkCliRealizer: unsupported CLI provider ${JSON.stringify(resolved?.provider)}`);
    }
    if (!resolved?.model || resolved.isConfigured !== true) {
      throw new Error(`stateBenchmarkCliRealizer: model ${requestedModelRef} is not configured`);
    }
    const inputSha256 = hashCanonicalJson(input);
    callMetadata = {
      ...callMetadata,
      resolved_provider: resolved.provider,
      resolved_model: resolved.model,
      resolved_model_ref: resolvedModelLabel(resolved.provider, resolved.model),
      effort: normalizedEffort,
      timeout_ms: Number(timeoutMs),
      input_sha256: inputSha256,
      structured_output_requested: true,
    };
    systemPrompt = buildAdaptiveStateCliRealizerSystemPrompt();
    userPrompt = canonicalJson(input);
    callMetadata = {
      ...callMetadata,
      system_prompt_sha256: sha256(systemPrompt),
      user_prompt_sha256: sha256(userPrompt),
    };
    if (signal?.aborted) {
      throw new Error('stateBenchmarkCliRealizer: call aborted before CLI process dispatch');
    }
    const dispatchedAtMs = Number(clock());
    callMetadata = {
      ...callMetadata,
      attempts: 1,
      dispatch_count: 1,
      dispatched_at_ms: Number.isFinite(dispatchedAtMs) ? dispatchedAtMs : null,
    };
    const response = await callCli(
      { provider: resolved.provider, model: resolved.model },
      systemPrompt,
      userPrompt,
      role,
      {
        messageHistory: [],
        effort: normalizedEffort,
        timeoutMs: Number(timeoutMs),
        outputSchema: ADAPTIVE_STATE_CLI_REALIZER_OUTPUT_JSON_SCHEMA,
        signal,
      },
    );
    rawText = typeof response?.text === 'string' ? response.text : '';
    callMetadata = {
      ...callMetadata,
      observed_provider: response?.provider || null,
      observed_model: response?.model || null,
      observed_model_ref:
        response?.provider && response?.model ? resolvedModelLabel(response.provider, response.model) : null,
      model_attestation: {
        basis: response?.modelAttestationBasis || 'bridge_response_model_field_not_independently_attested',
        independently_attested: response?.modelIndependentlyAttested === true,
      },
      latency_ms: Number.isFinite(Number(response?.latencyMs)) ? Number(response.latencyMs) : null,
      structured_output_reported: response?.structuredOutput === true,
      stream_event_type_counts: clone(response?.streamEventTypeCounts || {}),
      stream_item_type_counts: clone(response?.streamItemTypeCounts || {}),
      structured_event_audit: clone(response?.structuredEventAudit || null),
      prohibited_tool_event_count: Number(response?.prohibitedToolEventCount ?? 0),
      invalid_stream_lines: Number(
        response?.invalidStreamLines ?? response?.structuredEventAudit?.invalid_jsonl_line_count ?? 0,
      ),
      raw_output_sha256: sha256(rawText),
    };
    if (response?.provider !== resolved.provider || response?.model !== resolved.model) {
      throw new Error('stateBenchmarkCliRealizer: observed provider/model differs from the frozen resolution');
    }
    if (response?.structuredOutput !== true) {
      throw new Error('stateBenchmarkCliRealizer: CLI bridge did not confirm structured-output routing');
    }
    const prohibitedStreamActivity = Object.entries({
      ...(response?.streamEventTypeCounts || {}),
      ...(response?.streamItemTypeCounts || {}),
    }).filter(
      ([type, count]) =>
        Number(count) > 0 && /(?:tool|command|shell|exec|file|web|browser|mcp)/iu.test(String(type)),
    );
    if (prohibitedStreamActivity.length || Number(response?.prohibitedToolEventCount ?? 0) !== 0) {
      throw new Error(
        `stateBenchmarkCliRealizer: prohibited CLI stream activity ${prohibitedStreamActivity
          .map(([type, count]) => `${type}:${count}`)
          .join(', ')}`,
      );
    }
    const output = parseAdaptiveStateCliRealizerOutput(rawText, { expectedEventIds: expected });
    const completedAtMs = Number(clock());
    callMetadata = {
      ...callMetadata,
      status: 'success',
      output_sha256: hashCanonicalJson(output),
      completed_at_ms: Number.isFinite(completedAtMs) ? completedAtMs : null,
      attempts: 1,
      dispatch_count: 1,
      semantic_rerolls: 0,
    };
    return {
      schema: ADAPTIVE_STATE_CLI_REALIZER_CALL_SCHEMA,
      output,
      raw_output: rawText,
      call_artifacts: {
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
      },
      call_metadata: callMetadata,
    };
  } catch (error) {
    if (rawText !== null && !callMetadata.raw_output_sha256) {
      callMetadata.raw_output_sha256 = sha256(rawText);
    }
    const failedAtMs = Number(clock());
    callMetadata.failed_at_ms = Number.isFinite(failedAtMs) ? failedAtMs : null;
    const failure = technicalFailure(error, callMetadata);
    failure.raw_output = rawText;
    failure.callArtifacts = {
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
    };
    throw failure;
  }
}
