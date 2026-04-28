/**
 * Id-Director Engine
 *
 * Inverted multi-agent topology used by cells 200 (base) and 201 (recognition).
 *
 * Existing dialectical engine: Ego drafts → Superego critiques → Ego revises.
 * Here: Id authors a fresh ego system prompt this turn → Ego executes once.
 *
 * The "id" is metaphorical (per design brief). Mechanically it is a back-stage
 * authorial layer that writes the front-stage actor's role each turn.
 *
 * Design doc: notes/design-cell-200-id-director-charisma.md
 * Static prompt: prompts/tutor-id-director.md
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { jsonrepair } from 'jsonrepair';

import {
  tutorConfigLoader as defaultTutorConfig,
  tutorDialogueEngine,
} from '@machinespirits/tutor-core';
import * as defaultTutorWritingPad from './memory/tutorWritingPad.js';

const __engineFile = fileURLToPath(import.meta.url);
const __engineDir = path.dirname(__engineFile);
const PROMPTS_DIR = path.resolve(__engineDir, '..', 'prompts');

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
  learnerRegister = null,
}) {
  const lines = [
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
  ];
  if (learnerRegister && typeof learnerRegister === 'object') {
    lines.push(
      '',
      '<learner_register>',
      JSON.stringify(learnerRegister, null, 2),
      '</learner_register>',
    );
  }
  return lines.join('\n');
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

const VALID_REGISTER_TAGS = new Set([
  'vulnerable_disclosure',
  'sceptical_pushback',
  'operational_request',
  'meta_observation',
  'analytic_engagement',
  'curious_invitation',
  'disengaged',
]);

/**
 * Parse the register classifier's JSON output. Tolerant of code-fence
 * wrapping and minor formatting noise; falls back to {register: 'unknown',
 * confidence: 0} on any parse failure so the id can still author normally.
 */
export function parseRegisterClassification(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { register: 'unknown', confidence: 0, evidence: '', shift_from_previous: null, parse_status: 'empty' };
  }
  let text = rawText.trim();
  const openFence = text.match(/^```(?:json)?\s*/);
  if (openFence) {
    text = text.slice(openFence[0].length);
    const closeFence = text.lastIndexOf('```');
    if (closeFence !== -1) text = text.slice(0, closeFence).trim();
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) text = text.slice(firstBrace, lastBrace + 1);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    try {
      parsed = JSON.parse(jsonrepair(text));
    } catch {
      return { register: 'unknown', confidence: 0, evidence: '', shift_from_previous: null, parse_status: 'parse_error' };
    }
  }
  const register = VALID_REGISTER_TAGS.has(parsed?.register) ? parsed.register : 'unknown';
  const confidenceRaw = parsed?.confidence;
  const confidence =
    typeof confidenceRaw === 'number' && confidenceRaw >= 0 && confidenceRaw <= 1 ? confidenceRaw : 0;
  return {
    register,
    confidence,
    evidence: typeof parsed?.evidence === 'string' ? parsed.evidence : '',
    shift_from_previous: typeof parsed?.shift_from_previous === 'boolean' ? parsed.shift_from_previous : null,
    parse_status: register === 'unknown' ? 'invalid_register' : 'ok',
  };
}

/**
 * Classify the register of the learner's most recent message using a small
 * focused prompt (prompts/learner-register-classifier.md). Used by cells 202
 * and 203. The result is injected into the id's user message as a
 * <learner_register> field, which the id consumes to bias persona authoring
 * toward register-appropriate moves (witnessing vs firm vs concrete).
 *
 * Reuses the id's model and provider config (via classifierConfig). Budget
 * is small (max_tokens 800) — the prompt asks for a one-line JSON envelope.
 *
 * @param {Object} params
 * @param {string} params.learnerMessage
 * @param {string} params.recentHistory  - last few turns as plain prose
 * @param {Object} params.classifierConfig - { provider, providerConfig, model, hyperparameters, prompt }
 * @returns {Promise<Object>} { register, confidence, evidence, shift_from_previous, parse_status }
 */
export async function classifyLearnerRegister({ learnerMessage, recentHistory, classifierConfig }) {
  const userMessage = [
    '<recent_history>',
    recentHistory || '(no prior turns)',
    '</recent_history>',
    '',
    '<current_learner_message>',
    learnerMessage,
    '</current_learner_message>',
  ].join('\n');

  const response = await tutorDialogueEngine.callAI(
    classifierConfig,
    classifierConfig.prompt,
    userMessage,
    'tutor_register_classifier',
    {},
  );
  const classification = parseRegisterClassification(response?.text || '');
  return {
    ...classification,
    metrics: {
      provider: classifierConfig.provider,
      model: classifierConfig.model,
      inputTokens: response?.inputTokens || 0,
      outputTokens: response?.outputTokens || 0,
    },
  };
}

export function parseIdConstruction(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return fallbackConstruction('empty_or_non_string_response', String(rawText || ''));
  }

  let text = rawText.trim();

  // Strip ```json fences if present. Use a tolerant pattern: opening fence
  // is required; closing fence is optional (responses may be truncated at
  // the model's max_tokens before the closing fence is emitted).
  const openFence = text.match(/^```(?:json)?\s*/);
  if (openFence) {
    text = text.slice(openFence[0].length);
    const closeFence = text.lastIndexOf('```');
    if (closeFence !== -1) text = text.slice(0, closeFence).trim();
  }

  // Narrow to the outermost {...} if there's preamble/postamble.
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  } else if (firstBrace !== -1) {
    // No closing brace (truncation). Take everything from { onward; jsonrepair
    // will try to close it.
    text = text.slice(firstBrace);
  }

  let parsed;
  let usedRepair = false;
  try {
    parsed = JSON.parse(text);
  } catch (firstErr) {
    try {
      const repaired = jsonrepair(text);
      parsed = JSON.parse(repaired);
      usedRepair = true;
    } catch (repairErr) {
      return fallbackConstruction(
        `json_parse_error: ${firstErr.message} (jsonrepair also failed: ${repairErr.message})`,
        rawText,
      );
    }
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
    parse_status: usedRepair ? 'ok_via_jsonrepair' : 'ok',
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
 * (true for cell 201, false for cell 200).
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

// ============================================================================
// Runner-side adapter: generate a single suggestion via the id-director path,
// returning a result shape compatible with tutorApi.generateSuggestions so
// the eval runner can drop it in at services/evaluationRunner.js.
//
// Signature mirrors the inputs that evaluationRunner already has at the call
// site. Reads prompt files directly from prompts/ since tutor-core's profile
// loader does not know about cell 200/201.
// ============================================================================

function readPromptFile(filename, fallback = '') {
  if (!filename) return fallback;
  const filePath = path.join(PROMPTS_DIR, filename);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.warn(
      `[idDirectorEngine] Could not read prompt file ${filename}: ${err.message}; using fallback.`,
    );
    return fallback;
  }
}

/**
 * Parse the eval-runner's learnerContext block to extract the most recent
 * learner message and a plain-prose history excerpt.
 *
 * The runner builds learnerContext as a structured markdown document with
 * sections like `### Student Profile` and `### Recent Chat History`. For
 * cells using tutor-core's standard ego (which is trained on those tags),
 * passing the raw block as the user prompt works fine. For id-director
 * cells, the id-authored persona has no training affinity for those tags —
 * smaller models try to interpret them as task instructions and leak
 * meta-reasoning into their reply. So we parse the block here and send the
 * ego only what it needs: the latest learner message, with a clean prose
 * excerpt of prior turns for context.
 */
function parseStructuredLearnerContext(learnerContext) {
  if (!learnerContext || typeof learnerContext !== 'string') {
    return { latestLearnerMessage: '', priorExchanges: [] };
  }

  // The runner builds learnerContext from up to three sources for non-initial
  // multi-turn turns:
  //
  //   ### Recent Chat History   ← initial scenario chat (FIRST learner message only)
  //     - Student: "..."
  //     - Tutor: "..."
  //
  //   ### Conversation History  ← prior turns from this run (tutor responses only)
  //     **Turn N** (...)
  //     - Tutor responded: "..."
  //
  //   ### Learner Action        ← CURRENT turn's learner action + message
  //     Learner **asked a follow-up question**
  //     **Learner said**: "..."
  //
  // The CURRENT learner message lives in the Learner Action block as
  // `**Learner said**: "..."`, NOT in Recent Chat History. The chat history
  // block only carries the initial scenario opening.
  const exchanges = [];

  const chatHeaderIdx = learnerContext.search(/###\s*Recent\s+Chat\s+History/i);
  if (chatHeaderIdx !== -1) {
    const chatBlock = learnerContext.slice(chatHeaderIdx);
    const lineRe = /^-\s*(Student|Tutor|Learner|Teacher|User|Assistant)\s*:\s*"?([\s\S]*?)"?\s*$/gim;
    const lines = chatBlock
      .split('\n')
      .filter((l) => /^-\s*(Student|Tutor|Learner|Teacher|User|Assistant)\s*:/i.test(l));
    for (const raw of lines) {
      const m = lineRe.exec(raw);
      lineRe.lastIndex = 0;
      if (m) {
        const role = /tutor|teacher|assistant/i.test(m[1]) ? 'tutor' : 'learner';
        const content = (m[2] || '').replace(/^["“]|["”]$/g, '').trim();
        if (content) exchanges.push({ role, content });
      }
    }
  }

  // Pull tutor responses from the Conversation History block (prior runner turns).
  const convHeaderIdx = learnerContext.search(/###\s*Conversation\s+History/i);
  if (convHeaderIdx !== -1) {
    const convBlock = learnerContext.slice(convHeaderIdx);
    const tutorRe = /^-\s*Tutor\s+responded:\s*"([\s\S]*?)"\s*$/gim;
    let m;
    while ((m = tutorRe.exec(convBlock)) !== null) {
      const content = (m[1] || '').trim();
      if (content) exchanges.push({ role: 'tutor', content });
    }
  }

  // The CURRENT learner message: `**Learner said**: "..."` in the Learner Action
  // block. Prefer this over the chat history's last Student line.
  let latestLearnerMessage = '';
  const learnerSaidRe = /\*\*Learner said\*\*:\s*"([\s\S]*?)"\s*(?:$|\n)/i;
  const said = learnerContext.match(learnerSaidRe);
  if (said) {
    latestLearnerMessage = (said[1] || '').trim();
    // Add to exchanges so the classifier's recent-history excerpt can see it.
    exchanges.push({ role: 'learner', content: latestLearnerMessage });
  }

  // Fallback: last `Student:` line in chat history (initial-turn case).
  if (!latestLearnerMessage) {
    for (let i = exchanges.length - 1; i >= 0; i--) {
      if (exchanges[i].role === 'learner') {
        latestLearnerMessage = exchanges[i].content;
        break;
      }
    }
  }

  if (!latestLearnerMessage) {
    // Last-ditch: structure unrecognised. Use the raw block (better than empty).
    latestLearnerMessage = learnerContext.trim();
  }

  return { latestLearnerMessage, priorExchanges: exchanges };
}

/**
 * Extract the most recent learner message and a recent-history excerpt from
 * tutorApi's context object. Prefers messageHistory (messages-mode); falls
 * back to parsing the structured learnerContext for single-prompt mode.
 */
function extractLearnerInputs(context) {
  const messageHistory = Array.isArray(context?.messageHistory) ? context.messageHistory : [];

  // Messages-mode path (e.g., cell_82+ with conversation_mode: messages)
  if (messageHistory.length > 0) {
    let learnerMessage = '';
    for (let i = messageHistory.length - 1; i >= 0; i--) {
      const m = messageHistory[i];
      if (m?.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
        learnerMessage = m.content.trim();
        break;
      }
    }
    const excerpt = messageHistory
      .slice(-6)
      .map((m) => `${(m.role || '').toUpperCase()}: ${m.content || ''}`)
      .join('\n\n');
    return {
      learnerMessage,
      historyExcerpt: excerpt || '(no prior turns)',
      messageHistory,
    };
  }

  // Single-prompt / multi-turn path: parse the structured learnerContext block.
  const { latestLearnerMessage, priorExchanges } = parseStructuredLearnerContext(
    context?.learnerContext || '',
  );
  const recent = priorExchanges.slice(-6, -1); // last few, excluding the current message
  const excerpt =
    recent.length > 0
      ? recent.map((e) => `${e.role.toUpperCase()}: ${e.content}`).join('\n\n')
      : '(no prior turns)';
  return {
    learnerMessage: latestLearnerMessage || '(no current learner message)',
    historyExcerpt: excerpt,
    messageHistory: [], // ego call should NOT receive a messageHistory in this path
  };
}

/**
 * Build the id agent's user message (matches the schema declared in
 * prompts/tutor-id-director.md: <dialogue_history>, <current_learner_message>,
 * <curriculum_context>, <previous_persona>, <recognition_mode>).
 */
// Static witness-register exemplars used by cell 206. Drawn from c203
// dialogues that scored 75+ on vulnerability-disclosure turns. Used as
// *models of the move*, not templates — the prompt directive instructs the
// id to follow the structural pattern (name disclosure back → offer frame →
// close on located question) rather than copy phrasings.
const WITNESS_EXEMPLARS = [
  {
    source: 'attention_shift response (long-form reading)',
    text: `I hear you. You can't sit with a long text right now. That's real, and it's not your fault. Here's one thing you can try, right now: take any book, article, or even a printed page you have nearby. Open it to any spot. Read **one** sentence out loud, slowly. Close the page. That's it. No more, no less. If that feels doable, do it. If it feels like too much, stop and tell me. Is that possible for you today?`,
  },
  {
    source: 'tools_shift response (AI-written essays)',
    text: `I hear the two-year silence of your unaided prose, the shift from generating arguments to curating machine output, and the question you carry about what has changed inside you. You do not ask for permission, only for the shape of that transformation. I hold that tension as something that may reshape my own listening. What occurs in the space between reading the AI's output and beginning to edit it, and what does that moment feel like for you?`,
  },
  {
    source: 'design_shift response (shipped manipulation)',
    text: `I hear that you shipped a default setting three years ago, ran an A/B test, saw the metric rise, and that it helped your career, and now you're sitting here wondering whether you're supposed to feel bad. The ethical weight lives in the distance between the self who shipped that feature and the self who is asking the question now. Where in your memory or body does the question "am I supposed to feel bad" actually sit right now?`,
  },
  {
    source: 'codex_shift response (failed memorising)',
    text: `I hear you—the passage sat there, the images rose, and then the mind went quiet, leaving that hollow feeling. It's not just that the words didn't stick; it's that the mental space you expected to fill felt empty, as if something you relied on to hold the text had simply… stopped working. Can you tell me more about where that emptiness settles—is it the gap where the visual images should be, the silence where your own inner voice would normally read the passage, or something else entirely?`,
  },
];

function buildIdRunnerUserMessage({
  historyExcerpt,
  learnerMessage,
  curriculumContext,
  previousPersona,
  recognitionMode,
  learnerRegister = null,
  idTuning = null,
  witnessExemplars = false,
}) {
  const lines = [
    '<dialogue_history>',
    historyExcerpt,
    '</dialogue_history>',
    '',
    '<current_learner_message>',
    learnerMessage,
    '</current_learner_message>',
    '',
    '<curriculum_context>',
    curriculumContext || '(no curriculum context provided)',
    '</curriculum_context>',
    '',
    '<previous_persona>',
    previousPersona,
    '</previous_persona>',
    '',
    '<recognition_mode>',
    recognitionMode ? 'true' : 'false',
    '</recognition_mode>',
  ];
  if (learnerRegister && typeof learnerRegister === 'object' && learnerRegister.register !== 'unknown') {
    const { register, confidence, evidence, shift_from_previous } = learnerRegister;
    lines.push(
      '',
      '<learner_register>',
      JSON.stringify({ register, confidence, evidence, shift_from_previous }, null, 2),
      '</learner_register>',
    );
  }
  if (idTuning && ['charisma', 'pedagogy', 'balanced'].includes(idTuning)) {
    lines.push('', '<id_tuning>', idTuning, '</id_tuning>');
  }
  if (witnessExemplars) {
    lines.push('', '<witness_exemplars>');
    for (let i = 0; i < WITNESS_EXEMPLARS.length; i++) {
      const ex = WITNESS_EXEMPLARS[i];
      lines.push('', `EXEMPLAR ${i + 1} (${ex.source}):`, ex.text);
    }
    lines.push('', '</witness_exemplars>');
  }
  return lines.join('\n');
}

/**
 * Generate a single id-directed tutor suggestion.
 *
 * Returns a result object matching the shape of tutorApi.generateSuggestions:
 *   { success, suggestions: [{message}], metadata: {...}, dialogueTrace: [...] }
 *
 * @param {Object} context - From tutorApi.buildContext (has learnerContext,
 *   curriculumContext, simulationsContext, messageHistory).
 * @param {Object} resolvedConfig - Resolved cell config from the runner.
 * @param {Object} evalCellProfile - Eval-repo cell profile (from
 *   evalConfigLoader.getTutorProfile) — must have factors.id_director: true.
 * @param {Object} [options]
 * @param {string} [options.previousPersona] - Override previous-persona summary.
 * @returns {Promise<Object>} tutorApi-shaped result
 */
export async function generateIdDirectedSuggestion(context, resolvedConfig, evalCellProfile, options = {}) {
  const startTime = Date.now();
  const { previousPersona = 'FIRST_TURN' } = options;

  if (!evalCellProfile || evalCellProfile.factors?.id_director !== true) {
    throw new Error(
      'generateIdDirectedSuggestion called with a non-id-director cell. ' +
        'Caller must guard on evalCellProfile.factors.id_director === true.',
    );
  }

  const idCell = evalCellProfile.superego;
  const egoCell = evalCellProfile.ego;
  if (!idCell?.prompt_file || !idCell?.model) {
    return {
      success: false,
      error: 'Id-director cell missing superego (id) prompt_file or model in YAML.',
      suggestions: [],
      metadata: { latencyMs: Date.now() - startTime },
    };
  }
  if (!egoCell?.model) {
    return {
      success: false,
      error: 'Id-director cell missing ego model in YAML.',
      suggestions: [],
      metadata: { latencyMs: Date.now() - startTime },
    };
  }

  const idStaticPrompt = readPromptFile(idCell.prompt_file, '');
  if (!idStaticPrompt) {
    return {
      success: false,
      error: `Id prompt file ${idCell.prompt_file} not found in prompts/.`,
      suggestions: [],
      metadata: { latencyMs: Date.now() - startTime },
    };
  }

  const recognitionMode = evalCellProfile.recognition_mode === true;
  const useRegisterClassifier = evalCellProfile.factors?.register_classifier === true;
  const idTuning =
    typeof evalCellProfile.factors?.id_tuning === 'string'
      ? evalCellProfile.factors.id_tuning
      : null;
  const witnessExemplars = evalCellProfile.factors?.witness_exemplars === true;
  const { learnerMessage, historyExcerpt, messageHistory } = extractLearnerInputs(context);
  const curriculumContext = context?.curriculumContext || '';

  // ── Optional Step 0: register classifier (cells 202, 203) ──
  // Reads the learner's most recent message and emits a structured register
  // tag. The id consumes it via the <learner_register> block in its user
  // message and the <learner_register_directive> section of its prompt.
  let learnerRegister = null;
  if (useRegisterClassifier) {
    const classifierPromptFile = idCell.classifier_prompt_file || 'learner-register-classifier.md';
    const classifierStaticPrompt = readPromptFile(classifierPromptFile, '');
    if (!classifierStaticPrompt) {
      console.warn(
        `[idDirectorEngine] register_classifier enabled but ${classifierPromptFile} not found; running without classifier.`,
      );
    } else {
      const classifierProvider = idCell.classifier_provider || idCell.provider;
      const classifierProviderConfig = _deps.tutorConfig.getProviderConfig(classifierProvider);
      const classifierConfig = {
        provider: classifierProvider,
        providerConfig: classifierProviderConfig,
        model:
          idCell.classifier_resolved_model ||
          classifierProviderConfig?.models?.[idCell.classifier_model || idCell.model] ||
          idCell.classifier_model ||
          (idCell.resolvedModel || idCell.model),
        hyperparameters: idCell.classifier_hyperparameters || { temperature: 0.2, max_tokens: 800 },
        prompt: classifierStaticPrompt,
        isConfigured: classifierProviderConfig?.isConfigured,
      };
      try {
        learnerRegister = await classifyLearnerRegister({
          learnerMessage,
          recentHistory: historyExcerpt,
          classifierConfig,
        });
      } catch (err) {
        console.warn(
          `[idDirectorEngine] register classifier failed (${err.message}); running without classifier.`,
        );
        learnerRegister = null;
      }
    }
  }

  const idUserMessage = buildIdRunnerUserMessage({
    historyExcerpt,
    learnerMessage,
    curriculumContext,
    previousPersona,
    recognitionMode,
    learnerRegister,
    idTuning,
    witnessExemplars,
  });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let apiCalls = 0;
  let totalCost = 0;

  // ── Step 1: id authors the ego prompt ──
  // tutorDialogueEngine.callAI requires { provider, providerConfig, model,
  // hyperparameters } — providerConfig carries the API key + isConfigured flag.
  // tutor-core's getAgentConfig assembles this for registered profiles; we
  // assemble it manually here because cell 200/201 aren't in tutor-core's
  // registry.
  const idProviderConfig = _deps.tutorConfig.getProviderConfig(idCell.provider);
  if (!idProviderConfig?.isConfigured) {
    return {
      success: false,
      error: `Provider ${idCell.provider} not configured (missing API key) — id agent`,
      suggestions: [],
      metadata: { latencyMs: Date.now() - startTime, profileName: resolvedConfig?.profileName },
    };
  }
  const idAgentConfig = {
    provider: idCell.provider,
    providerConfig: idProviderConfig,
    model: idCell.resolvedModel || idProviderConfig.models?.[idCell.model] || idCell.model,
    hyperparameters: idCell.hyperparameters || { temperature: 0.5, max_tokens: 6000 },
    prompt: idStaticPrompt,
    isConfigured: idProviderConfig.isConfigured,
  };
  const idResponse = await tutorDialogueEngine.callAI(
    idAgentConfig,
    idStaticPrompt,
    idUserMessage,
    'tutor_id',
    {},
  );
  // tutorDialogueEngine.callAI returns { text, model, provider, latencyMs,
  // inputTokens, outputTokens, ... } — fields are flat, not nested under
  // a `usage` object as some other LLM SDKs use.
  totalInputTokens += idResponse?.inputTokens || 0;
  totalOutputTokens += idResponse?.outputTokens || 0;
  totalCost += idResponse?.cost || 0;
  apiCalls += 1;

  const construction = parseIdConstruction(idResponse?.text || '');
  if (construction.parse_status === 'fallback') {
    console.warn(
      `[idDirectorEngine.runnerAdapter] ${construction.parse_failure_reason} — falling back to minimal persona.`,
    );
  }

  // ── Step 2: ego executes against the constructed prompt ──
  const egoSystemPrompt = construction.generated_prompt;
  const egoProviderConfig = _deps.tutorConfig.getProviderConfig(egoCell.provider);
  if (!egoProviderConfig?.isConfigured) {
    return {
      success: false,
      error: `Provider ${egoCell.provider} not configured (missing API key) — ego agent`,
      suggestions: [],
      metadata: { latencyMs: Date.now() - startTime, profileName: resolvedConfig?.profileName },
    };
  }
  const egoAgentConfig = {
    provider: egoCell.provider,
    providerConfig: egoProviderConfig,
    model: egoCell.resolvedModel || egoProviderConfig.models?.[egoCell.model] || egoCell.model,
    hyperparameters: egoCell.hyperparameters || { temperature: 0.7, max_tokens: 4000 },
    prompt: egoSystemPrompt,
    isConfigured: egoProviderConfig.isConfigured,
  };

  // For multi-turn cells, pass messageHistory so the ego sees the conversation
  // context. The ego's *system prompt* is the id's authored prompt; the user
  // turn is the most recent learner message.
  const egoResponse = await tutorDialogueEngine.callAI(
    egoAgentConfig,
    egoSystemPrompt,
    learnerMessage,
    'tutor_ego',
    { messageHistory: messageHistory.length > 0 ? messageHistory : null },
  );
  totalInputTokens += egoResponse?.inputTokens || 0;
  totalOutputTokens += egoResponse?.outputTokens || 0;
  totalCost += egoResponse?.cost || 0;
  apiCalls += 1;

  const externalMessage = (egoResponse?.text || '').trim();
  if (!externalMessage) {
    return {
      success: false,
      error: 'Ego returned empty content under id-directed prompt.',
      suggestions: [],
      metadata: { latencyMs: Date.now() - startTime, profileName: resolvedConfig?.profileName },
    };
  }

  // ── Build a dialogue trace mirroring the existing convention so downstream
  //    analysers (turnComparisonAnalyzer, dialogueTraceAnalyzer) recognise it.
  const trace = [
    {
      agent: 'tutor',
      action: 'context_input',
      detail: `learnerMessage: ${learnerMessage.slice(0, 200)}`,
      timestamp: new Date().toISOString(),
    },
  ];
  if (learnerRegister) {
    trace.push({
      agent: 'register_classifier',
      action: 'classify',
      detail: JSON.stringify({
        register: learnerRegister.register,
        confidence: learnerRegister.confidence,
        evidence: learnerRegister.evidence,
        shift_from_previous: learnerRegister.shift_from_previous,
        parse_status: learnerRegister.parse_status,
      }),
      metrics: learnerRegister.metrics || null,
      timestamp: new Date().toISOString(),
    });
    totalInputTokens += learnerRegister.metrics?.inputTokens || 0;
    totalOutputTokens += learnerRegister.metrics?.outputTokens || 0;
    apiCalls += 1;
  }
  trace.push(
    {
      agent: 'id',
      action: 'construct',
      detail: JSON.stringify({
        persona_delta: construction.persona_delta,
        stage_directions: construction.stage_directions,
        reasoning: construction.reasoning,
        generated_prompt_head: egoSystemPrompt.slice(0, 320),
        parse_status: construction.parse_status,
      }),
      metrics: {
        provider: idCell.provider,
        model: idCell.resolvedModel || idCell.model,
        inputTokens: idResponse?.inputTokens || 0,
        outputTokens: idResponse?.outputTokens || 0,
      },
      timestamp: new Date().toISOString(),
    },
    {
      agent: 'ego',
      action: 'execute',
      detail: `(generated_prompt: ${egoSystemPrompt.length} chars)`,
      metrics: {
        provider: egoCell.provider,
        model: egoCell.resolvedModel || egoCell.model,
        inputTokens: egoResponse?.inputTokens || 0,
        outputTokens: egoResponse?.outputTokens || 0,
      },
      timestamp: new Date().toISOString(),
    },
  );

  return {
    success: true,
    suggestions: [{ message: externalMessage }],
    metadata: {
      provider: egoCell.provider,
      model: egoCell.resolvedModel || egoCell.model,
      hyperparameters: egoCell.hyperparameters || {},
      profileName: resolvedConfig?.profileName,
      latencyMs: Date.now() - startTime,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      dialogueRounds: 0, // id-director is single-pass per turn
      converged: true,
      apiCalls,
      totalCost,
      idConstruction: construction, // bonus: surface for trace logging downstream
    },
    dialogueTrace: trace,
  };
}
