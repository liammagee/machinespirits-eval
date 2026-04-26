/**
 * Id-Director Engine
 *
 * Inverted multi-agent topology used by cells 100 (base) and 101 (recognition).
 *
 * Existing dialectical engine: Ego drafts → Superego critiques → Ego revises.
 * Here: Id authors a fresh ego system prompt this turn → Ego executes once.
 *
 * The "id" is metaphorical (per design brief). Mechanically it is a back-stage
 * authorial layer that writes the front-stage actor's role each turn.
 *
 * Design doc: notes/design-cell-100-id-director-charisma.md
 * Static prompt: prompts/tutor-id-director.md
 */

import { tutorConfigLoader as defaultTutorConfig } from '@machinespirits/tutor-core';
import * as defaultTutorWritingPad from './memory/tutorWritingPad.js';

const _deps = {
  tutorConfig: defaultTutorConfig,
  tutorWritingPad: defaultTutorWritingPad,
};

export function __setDeps(overrides = {}) {
  if (overrides.tutorConfig) _deps.tutorConfig = overrides.tutorConfig;
  if (overrides.tutorWritingPad) _deps.tutorWritingPad = overrides.tutorWritingPad;
}

export function __resetDeps() {
  _deps.tutorConfig = defaultTutorConfig;
  _deps.tutorWritingPad = defaultTutorWritingPad;
}

const FALLBACK_GENERATED_PROMPT =
  'You are an attentive tutor with a definite voice. Read what the learner just said. ' +
  'Respond in a way that has shape — an opening, a peak, a closing — and that carries ' +
  'felt warmth without performing it. Keep your reply short. End with one specific ' +
  'question that asks the learner to take a position rather than seek more information.';

const MIN_GENERATED_PROMPT_CHARS = 100;

function getRequiredTemperature(config, configName) {
  const t = config?.hyperparameters?.temperature;
  if (t === undefined) {
    throw new Error(`Explicit temperature setting is required for ${configName} in YAML config.`);
  }
  return t;
}

function getRequiredMaxTokens(config, configName) {
  const m = config?.hyperparameters?.max_tokens;
  if (m === undefined) {
    throw new Error(`Explicit max_tokens setting is required for ${configName} in YAML config.`);
  }
  return m;
}

function buildConversationContext(history) {
  if (!Array.isArray(history) || history.length === 0) return '(no prior turns)';
  return history
    .slice(-6)
    .map((m) => `${(m.role || '').toUpperCase()}: ${m.content || ''}`)
    .join('\n\n');
}

function buildIdUserMessage({
  conversationContext,
  learnerMessage,
  curriculumContext,
  tutorMemory,
  previousPersona,
  recognitionMode,
}) {
  return [
    '<dialogue_history>',
    conversationContext,
    '</dialogue_history>',
    '',
    '<current_learner_message>',
    learnerMessage,
    '</current_learner_message>',
    '',
    '<curriculum_context>',
    curriculumContext || '(no curriculum context provided)',
    '',
    'Memory of this learner:',
    tutorMemory || '(no prior history with this learner)',
    '</curriculum_context>',
    '',
    '<previous_persona>',
    previousPersona,
    '</previous_persona>',
    '',
    '<recognition_mode>',
    recognitionMode ? 'true' : 'false',
    '</recognition_mode>',
  ].join('\n');
}

function fallbackConstruction(reason, rawText = '') {
  return {
    generated_prompt: FALLBACK_GENERATED_PROMPT,
    persona_delta: 'FALLBACK',
    stage_directions: `id-director output failed parsing (${reason}); using minimal fallback persona`,
    reasoning: `Parse failure: ${reason}.${rawText ? ` Raw head: ${rawText.slice(0, 200)}` : ''}`,
    parse_status: 'fallback',
    parse_failure_reason: reason,
  };
}

export function parseIdConstruction(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return fallbackConstruction('empty_or_non_string_response', String(rawText || ''));
  }

  let text = rawText.trim();

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) text = objMatch[0];

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return fallbackConstruction(`json_parse_error: ${e.message}`, rawText);
  }

  if (
    !parsed ||
    typeof parsed.generated_prompt !== 'string' ||
    parsed.generated_prompt.length < MIN_GENERATED_PROMPT_CHARS
  ) {
    return fallbackConstruction('parse_succeeded_but_invalid_shape', rawText);
  }

  return {
    generated_prompt: parsed.generated_prompt,
    persona_delta: typeof parsed.persona_delta === 'string' ? parsed.persona_delta : 'UNKNOWN',
    stage_directions: typeof parsed.stage_directions === 'string' ? parsed.stage_directions : '',
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    parse_status: 'ok',
  };
}

export function extractPreviousPersona(trace) {
  if (!trace || !Array.isArray(trace.turns) || trace.turns.length === 0) {
    return 'FIRST_TURN';
  }

  for (let i = trace.turns.length - 1; i >= 0; i -= 1) {
    const turn = trace.turns[i];
    if (turn?.phase !== 'tutor') continue;
    const deliberation = Array.isArray(turn.internalDeliberation) ? turn.internalDeliberation : [];
    const idEntry = deliberation.find((d) => d?.role === 'id');
    if (idEntry?.construction?.generated_prompt) {
      const reasoning = idEntry.construction.reasoning || '';
      const personaDelta = idEntry.construction.persona_delta || '';
      const head = idEntry.construction.generated_prompt.slice(0, 240);
      return [
        `last_persona_delta: ${personaDelta}`,
        reasoning ? `last_reasoning: ${reasoning}` : null,
        `last_generated_prompt_head: ${head}${idEntry.construction.generated_prompt.length > 240 ? '...' : ''}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
  }

  return 'FIRST_TURN';
}

function buildIdDeliberationEntry(idResponse, idConfig, construction) {
  return {
    role: 'id',
    content: idResponse?.content || '',
    metrics: {
      model: idResponse?.model || idConfig?.model || null,
      provider: idResponse?.provider || idConfig?.provider || null,
      latencyMs: idResponse?.latencyMs ?? null,
      inputTokens: idResponse?.usage?.inputTokens ?? 0,
      outputTokens: idResponse?.usage?.outputTokens ?? 0,
      generationId: idResponse?.generationId || null,
    },
    construction,
    apiPayload: idResponse?.apiPayload || null,
  };
}

function buildEgoDeliberationEntry(egoResponse, egoConfig, renderedSystemPrompt) {
  return {
    role: 'ego',
    content: egoResponse?.content || '',
    metrics: {
      model: egoResponse?.model || egoConfig?.model || null,
      provider: egoResponse?.provider || egoConfig?.provider || null,
      latencyMs: egoResponse?.latencyMs ?? null,
      inputTokens: egoResponse?.usage?.inputTokens ?? 0,
      outputTokens: egoResponse?.usage?.outputTokens ?? 0,
      generationId: egoResponse?.generationId || null,
    },
    rendered_system_prompt: renderedSystemPrompt,
    apiPayload: egoResponse?.apiPayload || null,
  };
}

/**
 * Run a single id-directed tutor turn.
 *
 * Same signature as the existing runTutorTurn so the dispatch in
 * learnerTutorInteractionEngine.js is a single conditional. Returns the
 * same shape ({externalMessage, rawResponse, internalDeliberation, strategy,
 * suggestsEnding}) so downstream code is unchanged.
 *
 * Recognition mode is read from the tutor profile's recognition_mode field
 * (true for cell 101, false for cell 100).
 */
export async function runIdDirectedTurn({
  learnerId,
  sessionId,
  learnerMessage,
  history,
  tutorProfileName,
  topic,
  llmCall,
  trace,
}) {
  const profile = _deps.tutorConfig.getActiveProfile(tutorProfileName) || {};
  const egoConfig = _deps.tutorConfig.getAgentConfig('ego', tutorProfileName);
  const idConfig = _deps.tutorConfig.getAgentConfig('superego', tutorProfileName);

  if (!idConfig) {
    throw new Error(
      'Cell with factors.id_director:true must configure an agent slot for the id ' +
        '(currently re-uses the superego: block in tutor-agents.yaml).',
    );
  }

  const recognitionMode = profile?.recognition_mode === true;
  const tutorMemory = _deps.tutorWritingPad.buildNarrativeSummary(learnerId, sessionId);
  const conversationContext = buildConversationContext(history);
  const previousPersona = extractPreviousPersona(trace);

  const idUserMessage = buildIdUserMessage({
    conversationContext,
    learnerMessage,
    curriculumContext: topic,
    tutorMemory,
    previousPersona,
    recognitionMode,
  });

  const idStaticPrompt = idConfig?.prompt || '';
  const idModel = idConfig?.model || egoConfig?.model;
  const idResponse = await llmCall(
    idModel,
    idStaticPrompt,
    [{ role: 'user', content: idUserMessage }],
    {
      temperature: getRequiredTemperature(idConfig, 'tutor_id'),
      maxTokens: getRequiredMaxTokens(idConfig, 'tutor_id'),
      agentRole: 'tutor_id',
    },
  );

  if (trace?.metrics) {
    trace.metrics.tutorInputTokens =
      (trace.metrics.tutorInputTokens || 0) + (idResponse?.usage?.inputTokens || 0);
    trace.metrics.tutorOutputTokens =
      (trace.metrics.tutorOutputTokens || 0) + (idResponse?.usage?.outputTokens || 0);
  }

  const construction = parseIdConstruction(idResponse?.content || '');

  if (construction.parse_status === 'fallback') {
    console.warn(
      `[IdDirector] ${construction.parse_failure_reason} — falling back to minimal persona.`,
    );
  }

  const internalDeliberation = [];
  internalDeliberation.push(buildIdDeliberationEntry(idResponse, idConfig, construction));

  const egoSystemPrompt = construction.generated_prompt;
  const egoModel =
    egoConfig?.model || _deps.tutorConfig.getProviderConfig?.('openrouter')?.default_model;
  const egoResponse = await llmCall(
    egoModel,
    egoSystemPrompt,
    [{ role: 'user', content: learnerMessage }],
    {
      temperature: getRequiredTemperature(egoConfig, 'tutor_ego'),
      maxTokens: getRequiredMaxTokens(egoConfig, 'tutor_ego'),
      agentRole: 'tutor_ego',
    },
  );

  if (trace?.metrics) {
    trace.metrics.tutorInputTokens =
      (trace.metrics.tutorInputTokens || 0) + (egoResponse?.usage?.inputTokens || 0);
    trace.metrics.tutorOutputTokens =
      (trace.metrics.tutorOutputTokens || 0) + (egoResponse?.usage?.outputTokens || 0);
  }

  internalDeliberation.push(buildEgoDeliberationEntry(egoResponse, egoConfig, egoSystemPrompt));

  let externalMessage = (egoResponse?.content || '').trim();
  if (!externalMessage) {
    console.warn('[IdDirector] Empty ego output, using fallback message.');
    externalMessage =
      "Let me try that again — could you say a little more about what you're working through?";
  }

  return {
    externalMessage,
    rawResponse: egoResponse?.content || '',
    internalDeliberation,
    strategy: 'id_directed',
    suggestsEnding: false,
  };
}
