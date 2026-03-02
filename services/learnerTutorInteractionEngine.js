/**
 * Learner-Tutor Interaction Engine
 *
 * Orchestrates multi-turn interactions between synthetic learner agents
 * and tutor agents for evaluation purposes. Tracks both internal deliberation
 * and external dialogue, with hooks for judge evaluation.
 */

import * as learnerConfig from './learnerConfigLoader.js';
import { tutorConfigLoader as tutorConfig, _fetchProvider, truncateForContextOverflow } from '@machinespirits/tutor-core';

import * as learnerWritingPad from './memory/learnerWritingPad.js';
import * as tutorWritingPad from './memory/tutorWritingPad.js';

// ============================================================================
// Interaction Engine Configuration
// ============================================================================

const DEFAULT_MAX_TURNS = 10;
const API_PAYLOAD_MAX_CHARS = Number.parseInt(process.env.EVAL_CAPTURE_API_PAYLOAD_MAX_CHARS || '120000', 10);

function clipPayloadText(text, limit = API_PAYLOAD_MAX_CHARS) {
  if (text == null) return null;
  const str = String(text);
  if (!Number.isFinite(limit) || limit <= 0 || str.length <= limit) return str;
  return `${str.slice(0, limit)}... [truncated ${str.length - limit} chars]`;
}

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

function truncatePayload(value, limit = API_PAYLOAD_MAX_CHARS) {
  if (value == null) return null;
  if (typeof value === 'string') return clipPayloadText(value, limit);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => truncatePayload(item, limit));
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = truncatePayload(item, limit);
  }
  return out;
}

function makeDeliberationEntry(role, response, agentConfig = null) {
  return {
    role,
    content: response?.content || '',
    metrics: {
      model: response?.model || agentConfig?.model || null,
      provider: response?.provider || agentConfig?.provider || null,
      latencyMs: response?.latencyMs ?? null,
      inputTokens: response?.usage?.inputTokens ?? 0,
      outputTokens: response?.usage?.outputTokens ?? 0,
      generationId: response?.generationId || null,
    },
    apiPayload: response?.apiPayload || null,
  };
}

// Interaction outcomes for tracking
const INTERACTION_OUTCOMES = {
  BREAKTHROUGH: 'breakthrough', // Learner shows genuine understanding
  PRODUCTIVE_STRUGGLE: 'productive_struggle', // Healthy confusion/effort
  MUTUAL_RECOGNITION: 'mutual_recognition', // Both parties recognize each other
  FRUSTRATION: 'frustration', // Learner becomes frustrated
  DISENGAGEMENT: 'disengagement', // Learner disengages
  SCAFFOLDING_NEEDED: 'scaffolding_needed', // Learner needs more support
  FADING_APPROPRIATE: 'fading_appropriate', // Ready for less support
  TRANSFORMATION: 'transformation', // Conceptual restructuring occurred
};

// ============================================================================
// Main Interaction Function
// ============================================================================

/**
 * Run a multi-turn interaction between learner and tutor agents
 *
 * @param {Object} config - Interaction configuration
 * @param {string} config.learnerId - Unique learner identifier
 * @param {string} config.personaId - Learner persona (from LEARNER_PERSONAS)
 * @param {string} config.tutorProfile - Tutor profile name
 * @param {string} config.topic - Topic to discuss
 * @param {Object} config.scenario - Scenario configuration
 * @param {Function} llmCall - Async function to call LLM
 * @param {Object} options - Additional options
 */
export async function runInteraction(config, llmCall, options = {}) {
  const {
    learnerId,
    personaId = 'productive_struggler',
    tutorProfile = 'default',
    topic,
    scenario,
    sessionId = `session-${Date.now()}`,
  } = config;

  const { maxTurns = DEFAULT_MAX_TURNS, _trace = true, observeInternals = true } = options;

  const startTime = Date.now();

  // Initialize interaction state
  const interactionTrace = {
    id: `interaction-${Date.now()}`,
    learnerId,
    personaId,
    tutorProfile,
    topic,
    sessionId,
    turns: [],
    outcomes: [],
    metrics: {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      learnerInputTokens: 0,
      learnerOutputTokens: 0,
      tutorInputTokens: 0,
      tutorOutputTokens: 0,
    },
    writingPadSnapshots: {
      learner: { before: null, after: null },
      tutor: { before: null, after: null },
    },
  };

  // Get persona and profile configuration
  const learnerPersona = learnerConfig.getPersona(personaId);
  const learnerProfile = learnerConfig.getActiveProfile(options.learnerProfile);
  const learnerArchitecture = learnerProfile.architecture || learnerPersona.default_architecture || 'unified';

  // Take "before" snapshots
  interactionTrace.writingPadSnapshots.learner.before = learnerWritingPad.createSnapshot(learnerId);
  interactionTrace.writingPadSnapshots.tutor.before = tutorWritingPad.createSnapshot(learnerId);

  // Initialize conversation history
  const conversationHistory = [];

  // Generate initial learner message based on scenario
  let currentLearnerMessage = await generateInitialLearnerMessage(
    learnerPersona,
    learnerArchitecture,
    learnerProfile,
    scenario,
    topic,
    llmCall,
    interactionTrace,
  );

  conversationHistory.push({
    role: 'learner',
    content: currentLearnerMessage.externalMessage,
    internalDeliberation: observeInternals ? currentLearnerMessage.internalDeliberation : null,
  });

  // Record the INITIAL learner message in the trace (Turn 0)
  // This ensures the learner is shown as initiating the conversation
  interactionTrace.turns.push({
    turnNumber: 0,
    phase: 'learner',
    externalMessage: currentLearnerMessage.externalMessage,
    internalDeliberation: currentLearnerMessage.internalDeliberation,
    emotionalState: currentLearnerMessage.emotionalState,
    understandingLevel: currentLearnerMessage.understandingLevel,
    timestamp: new Date().toISOString(),
  });

  // Main interaction loop
  let turnCount = 0;
  let interactionContinues = true;

  while (turnCount < maxTurns && interactionContinues) {
    turnCount++;

    // ================ TUTOR TURN ================
    const tutorResponse = await runTutorTurn(
      learnerId,
      sessionId,
      currentLearnerMessage.externalMessage,
      conversationHistory,
      tutorProfile,
      topic,
      llmCall,
      interactionTrace,
    );

    conversationHistory.push({
      role: 'tutor',
      content: tutorResponse.externalMessage,
      internalDeliberation: observeInternals ? tutorResponse.internalDeliberation : null,
    });

    interactionTrace.turns.push({
      turnNumber: turnCount,
      phase: 'tutor',
      externalMessage: tutorResponse.externalMessage,
      internalDeliberation: tutorResponse.internalDeliberation,
      strategy: tutorResponse.strategy,
      timestamp: new Date().toISOString(),
    });

    // Update tutor writing pad
    await updateTutorWritingPad(learnerId, sessionId, tutorResponse, currentLearnerMessage);

    // Check for natural ending
    if (tutorResponse.suggestsEnding) {
      interactionContinues = false;
      break;
    }

    // ================ LEARNER TURN ================
    const learnerResponse = await generateLearnerResponse({
      tutorMessage: tutorResponse.externalMessage,
      topic,
      conversationHistory: conversationHistory.map((m) => ({ role: m.role, content: m.content })),
      learnerProfile: learnerProfile.name,
      personaId,
      llmCall,
      memoryContext: learnerWritingPad.buildNarrativeSummary(learnerId, sessionId),
      trace: interactionTrace,
    });

    conversationHistory.push({
      role: 'learner',
      content: learnerResponse.externalMessage,
      internalDeliberation: observeInternals ? learnerResponse.internalDeliberation : null,
    });

    interactionTrace.turns.push({
      turnNumber: turnCount,
      phase: 'learner',
      externalMessage: learnerResponse.externalMessage,
      internalDeliberation: learnerResponse.internalDeliberation,
      emotionalState: learnerResponse.emotionalState,
      understandingLevel: learnerResponse.understandingLevel,
      timestamp: new Date().toISOString(),
    });

    // Update learner writing pad
    await updateLearnerWritingPad(learnerId, sessionId, learnerResponse, tutorResponse, topic);

    // Detect outcomes
    const turnOutcomes = detectTurnOutcomes(learnerResponse, tutorResponse);
    interactionTrace.outcomes.push(...turnOutcomes);

    // Check for natural ending
    if (learnerResponse.suggestsEnding || learnerResponse.emotionalState === 'disengaged') {
      interactionContinues = false;
      break;
    }

    currentLearnerMessage = learnerResponse;
  }

  // Take "after" snapshots
  interactionTrace.writingPadSnapshots.learner.after = learnerWritingPad.createSnapshot(learnerId);
  interactionTrace.writingPadSnapshots.tutor.after = tutorWritingPad.createSnapshot(learnerId);

  // Compute summary metrics
  interactionTrace.metrics.totalLatencyMs = Date.now() - startTime;
  interactionTrace.metrics.turnCount = turnCount;
  interactionTrace.summary = generateInteractionSummary(interactionTrace);

  return interactionTrace;
}

// ============================================================================
// Learner Turn Implementation
// ============================================================================

/**
 * Generate initial learner message based on scenario
 */
async function generateInitialLearnerMessage(persona, architecture, profile, scenario, topic, llmCall, trace) {
  // Get agent roles from profile (not architecture)
  const agentRoles = learnerConfig.getProfileAgentRoles(profile.name);
  const internalDeliberation = [];

  // Run internal deliberation for each agent in the profile
  // For ego/superego pattern: superego sees and critiques ego's initial response
  for (const role of agentRoles) {
    const agentConfig = learnerConfig.getAgentConfig(role, profile.name);
    if (!agentConfig) continue;

    // Build context based on role
    let roleContext = `
Topic: ${topic}
Scenario: ${scenario?.name || 'General learning'}
Initial state: ${scenario?.learnerStartState || 'Beginning new topic'}`;

    // If this is superego and we have prior deliberation (ego), include it for critique
    if (role === 'superego' && internalDeliberation.length > 0) {
      const priorDeliberation = internalDeliberation.map((d) => `${d.role.toUpperCase()}: ${d.content}`).join('\n\n');
      roleContext += `

The EGO's initial reaction was:
${priorDeliberation}

Review the EGO's first impression. Is it too superficial? What's being avoided? What would lead to genuine learning?`;
    } else {
      roleContext += `

Generate this agent's internal voice as the learner approaches this topic for the first time.`;
    }

    const prompt = buildLearnerPrompt(agentConfig, persona, roleContext);

    const response = await llmCall(
      agentConfig.model,
      prompt,
      [
        {
          role: 'user',
          content: role === 'superego' ? "Critique the EGO's initial reaction." : 'Generate your internal voice.',
        },
      ],
      {
        temperature: getRequiredTemperature(agentConfig, role),
        maxTokens: getRequiredMaxTokens(agentConfig, role),
      },
    );

    internalDeliberation.push(makeDeliberationEntry(role, response, agentConfig));

    trace.metrics.learnerInputTokens += response.usage?.inputTokens || 0;
    trace.metrics.learnerOutputTokens += response.usage?.outputTokens || 0;
  }

  // Ego revision: the ego considers superego feedback and produces the external message.
  // For multi-agent profiles, ego has final authority (mirrors tutor pipeline).
  // For unified profiles, the single agent's output is the external message.
  const hasMultiAgent = agentRoles.includes('ego') && agentRoles.includes('superego');
  const hasOpeningMessage = scenario?.learnerOpening && scenario.learnerOpening.trim().length > 0;

  if (hasMultiAgent && internalDeliberation.length >= 2) {
    const egoConfig = learnerConfig.getAgentConfig('ego', profile.name);
    const egoInitial = internalDeliberation.find((d) => d.role === 'ego');
    const superegoFeedback = internalDeliberation.find((d) => d.role === 'superego');

    let revisionContext = `Topic: ${topic}
Scenario: ${scenario?.name || 'General learning'}

Your initial reaction was:
"${egoInitial?.content || ''}"

Internal review feedback:
"${superegoFeedback?.content || ''}"

Consider this feedback. You have final authority — accept, reject, or modify as you see fit.`;

    if (hasOpeningMessage) {
      revisionContext += `

The learner wants to open with this message: "${scenario.learnerOpening}"
Lightly adapt this opening to feel natural given the internal deliberation, but keep the core content and question intact.
The adapted message should be 1-3 sentences and maintain the original meaning.
Do NOT include internal thoughts or meta-commentary.`;
    } else {
      revisionContext += `

Respond with ONLY what the learner would say out loud as their opening message to a tutor about: ${topic}
The message should feel authentic - not too polished, showing real confusion or interest.
Keep it 1-3 sentences. Do NOT include internal thoughts or meta-commentary.`;
    }

    const revisionSystemPrompt = buildLearnerPrompt(egoConfig, persona, revisionContext);
    const externalResponse = await llmCall(
      egoConfig.model,
      revisionSystemPrompt,
      [{ role: 'user', content: "Generate the learner's opening message." }],
      {
        temperature: getRequiredTemperature(egoConfig, 'ego'),
        maxTokens: getRequiredMaxTokens(egoConfig, 'ego'),
      },
    );

    internalDeliberation.push(makeDeliberationEntry('ego_revision', externalResponse, egoConfig));
    trace.metrics.learnerInputTokens += externalResponse.usage?.inputTokens || 0;
    trace.metrics.learnerOutputTokens += externalResponse.usage?.outputTokens || 0;

    return {
      externalMessage: externalResponse.content,
      internalDeliberation,
      emotionalState: detectEmotionalState(internalDeliberation),
      understandingLevel: 'initial',
    };
  }

  // Unified / single-agent: use the last deliberation output directly,
  // or adapt the scenario opening if one is provided.
  if (hasOpeningMessage) {
    const lastConfig = learnerConfig.getAgentConfig(agentRoles[agentRoles.length - 1], profile.name);
    const adaptPrompt = `You are simulating a learner with this internal voice:

${internalDeliberation.map((d) => `${d.role.toUpperCase()}: ${d.content}`).join('\n\n')}

The learner wants to open with this message: "${scenario.learnerOpening}"

Lightly adapt this opening to feel natural given the internal deliberation, but keep the core content and question intact.
The adapted message should be 1-3 sentences and maintain the original meaning.
Do NOT include internal thoughts or meta-commentary.`;

    const adaptResponse = await llmCall(
      lastConfig.model,
      adaptPrompt,
      [{ role: 'user', content: "Generate the learner's opening message." }],
      {
        temperature: getRequiredTemperature(lastConfig, 'unified_learner'),
        maxTokens: getRequiredMaxTokens(lastConfig, 'unified_learner'),
      },
    );

    trace.metrics.learnerInputTokens += adaptResponse.usage?.inputTokens || 0;
    trace.metrics.learnerOutputTokens += adaptResponse.usage?.outputTokens || 0;

    return {
      externalMessage: adaptResponse.content,
      internalDeliberation,
      emotionalState: detectEmotionalState(internalDeliberation),
      understandingLevel: 'initial',
    };
  }

  // No opening message, single agent — use the last deliberation step directly
  const lastDelib = internalDeliberation[internalDeliberation.length - 1];
  return {
    externalMessage: lastDelib?.content || '',
    internalDeliberation,
    emotionalState: detectEmotionalState(internalDeliberation),
    understandingLevel: 'initial',
  };
}

/**
 * Build learner prompt with agent config and persona
 */
function buildLearnerPrompt(agentConfig, persona, additionalContext) {
  let prompt = agentConfig.prompt || '';

  // Add persona context
  if (persona.prompt_modifier) {
    prompt += `\n\n${persona.prompt_modifier}`;
  }

  // Add additional context
  if (additionalContext) {
    prompt += `\n\n${additionalContext}`;
  }

  return prompt;
}

// ============================================================================
// Tutor Turn Implementation
// ============================================================================

/**
 * Run a tutor turn in response to learner
 */
async function runTutorTurn(learnerId, sessionId, learnerMessage, history, tutorProfileName, topic, llmCall, trace) {
  // Get tutor memory for this learner
  const tutorMemory = tutorWritingPad.buildNarrativeSummary(learnerId, sessionId);

  // Build conversation context
  const conversationContext = history
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  // Get tutor configuration from profile
  const _profile = tutorConfig.getActiveProfile(tutorProfileName);
  const egoConfig = tutorConfig.getAgentConfig('ego', tutorProfileName);
  const superegoConfig = tutorConfig.getAgentConfig('superego', tutorProfileName);

  // Tutor internal deliberation
  const internalDeliberation = [];

  // ===== T.EGO: Draft initial response =====
  const egoPrompt = `${egoConfig?.prompt || 'You are a thoughtful AI tutor.'}

Your accumulated knowledge about this learner:
${tutorMemory || 'This is a new learner - no prior history.'}

Topic: ${topic}

Recent conversation:
${conversationContext}

The learner just said:
"${learnerMessage}"

Draft your INITIAL response as a tutor. Consider:
1. What is this learner's current state? (confused, engaged, frustrated, etc.)
2. What strategy would work best? (scaffolding, questioning, direct explanation, validation)
3. How can you advance their understanding while respecting their current position?

Be warm but intellectually challenging. Don't be condescending. Build on their words.

Provide ONLY your draft response text (it will be reviewed by your pedagogical critic).`;

  const tutorModel = egoConfig?.model || tutorConfig.getProviderConfig('openrouter')?.default_model;

  const egoResponse = await llmCall(tutorModel, egoPrompt, [{ role: 'user', content: learnerMessage }], {
    temperature: getRequiredTemperature(egoConfig, 'tutor_ego'),
    maxTokens: getRequiredMaxTokens(egoConfig, 'tutor_ego'),
    agentRole: 'tutor_ego',
  });

  trace.metrics.tutorInputTokens += egoResponse.usage?.inputTokens || 0;
  trace.metrics.tutorOutputTokens += egoResponse.usage?.outputTokens || 0;

  const egoDraft = egoResponse.content || '';
  internalDeliberation.push(makeDeliberationEntry('ego', egoResponse, { model: tutorModel, provider: egoConfig?.provider }));

  // ===== T.SUPEREGO: Critique and refine (skip when superego is null) =====
  let externalMessage = egoDraft;

  if (superegoConfig) {
    const superegoPrompt = `${superegoConfig?.prompt || 'You are a pedagogical critic reviewing tutor responses.'}

Context about the learner:
${tutorMemory || 'New learner - no prior history.'}

Topic: ${topic}

Recent conversation:
${conversationContext}

The learner said:
"${learnerMessage}"

The tutor's DRAFT response:
"${egoDraft}"

CRITIQUE this draft. Consider:
1. Pedagogical soundness: Does it advance learning or just provide answers?
2. Emotional attunement: Does it respect the learner's current state?
3. Socratic method: Does it ask generative questions or just lecture?
4. ZPD awareness: Is the scaffolding appropriate for their level?

After your critique, provide an IMPROVED version if needed. Format:

CRITIQUE: [your analysis]
IMPROVED: [refined response, or "APPROVED" if draft is good]`;

    const superegoModel = superegoConfig.model || tutorModel;

    const superegoResponse = await llmCall(superegoModel, superegoPrompt, [{ role: 'user', content: egoDraft }], {
      temperature: getRequiredTemperature(superegoConfig, 'tutor_superego'),
      maxTokens: getRequiredMaxTokens(superegoConfig, 'tutor_superego'),
      agentRole: 'tutor_superego',
    });

    trace.metrics.tutorInputTokens += superegoResponse.usage?.inputTokens || 0;
    trace.metrics.tutorOutputTokens += superegoResponse.usage?.outputTokens || 0;

    const superegoContent = superegoResponse.content || '';
    internalDeliberation.push(
      makeDeliberationEntry('superego', superegoResponse, { model: superegoModel, provider: superegoConfig.provider }),
    );

    // Parse superego response for improved version
    const improvedMatch = superegoContent.match(/IMPROVED:\s*([\s\S]*?)(?:$)/i);
    if (improvedMatch && improvedMatch[1]) {
      const improved = improvedMatch[1].trim();
      if (improved.toUpperCase() !== 'APPROVED' && improved.length > 20) {
        externalMessage = improved;
      }
    }
  }

  // Log if response is empty (helps debug API issues)
  if (!externalMessage || externalMessage.trim() === '') {
    console.warn(`[TutorTurn] Empty response from model ${tutorModel}. Raw ego draft:`, egoDraft);
  }

  // Detect tutor's implicit strategy
  const strategy = detectTutorStrategy(externalMessage || '');

  // Extract message from JSON if tutor returned structured response
  externalMessage = extractTutorMessage(externalMessage);

  // Fallback for empty responses - generate a brief acknowledgment
  if (!externalMessage || externalMessage.trim() === '') {
    console.warn('[TutorTurn] Empty message after extraction, using fallback');
    externalMessage =
      "I see what you're saying. Let me think about that for a moment. Could you tell me more about what's confusing you?";
  }

  return {
    externalMessage,
    rawResponse: egoResponse.content, // Keep raw for debugging
    internalDeliberation,
    strategy,
    suggestsEnding:
      externalMessage.toLowerCase().includes('good place to pause') ||
      externalMessage.toLowerCase().includes('think about this'),
  };
}

/**
 * Extract the [EXTERNAL] section from unified learner output.
 * The unified learner prompt requests [INTERNAL]/[EXTERNAL] structured format.
 * Returns just the external speech; if no tags found, returns full text unchanged.
 */
function extractExternalSection(text) {
  if (!text) return '';
  const match = text.match(/\[EXTERNAL\]:?\s*([\s\S]*)/i);
  if (match) return match[1].trim();
  return text;
}

/**
 * Extract the message from tutor's response (handles JSON or plain text)
 */
function extractTutorMessage(content) {
  if (!content) return '';

  // Try to parse as JSON array (tutor suggestion format)
  try {
    const trimmed = content.trim();
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Get the message from the first suggestion
        const firstSuggestion = parsed[0];
        if (firstSuggestion.message) {
          return firstSuggestion.message;
        }
      }
    }
    // Try as single JSON object
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      if (parsed.message) {
        return parsed.message;
      }
    }
  } catch (e) {
    // Not valid JSON, return as-is
  }

  // Return content as-is if not JSON
  return content;
}

// ============================================================================
// Writing Pad Updates
// ============================================================================

/**
 * Update learner writing pad based on turn
 */
async function updateLearnerWritingPad(learnerId, sessionId, learnerResponse, tutorResponse, topic) {
  // Update conscious layer
  learnerWritingPad.updateConsciousLayer(learnerId, sessionId, {
    currentTopic: topic,
    currentUnderstanding: learnerResponse.understandingLevel,
    emotionalState: learnerResponse.emotionalState,
  });

  // Check for breakthrough/trauma signals
  if (
    learnerResponse.understandingLevel === 'transforming' ||
    learnerResponse.externalMessage.toLowerCase().includes('oh, i see') ||
    learnerResponse.externalMessage.toLowerCase().includes('wait, so')
  ) {
    learnerWritingPad.recordBreakthrough(learnerId, {
      momentDescription: 'Understanding shift detected',
      concept: topic,
      impactScore: 0.6,
      context: tutorResponse.externalMessage.slice(0, 100),
    });
  }

  if (
    learnerResponse.emotionalState === 'frustrated' ||
    learnerResponse.externalMessage.toLowerCase().includes("don't understand")
  ) {
    learnerWritingPad.recordTrauma(learnerId, {
      momentDescription: 'Frustration with comprehension',
      concept: topic,
      impactScore: 0.4,
      trigger: tutorResponse.strategy || 'unknown',
    });
  }

  // Record lesson access
  learnerWritingPad.recordLesson(learnerId, topic, {
    currentUnderstanding: learnerResponse.understandingLevel,
  });
}

/**
 * Update tutor writing pad based on turn
 */
async function updateTutorWritingPad(learnerId, sessionId, tutorResponse, learnerMessage) {
  // Update conscious state
  tutorWritingPad.updateConsciousState(learnerId, sessionId, {
    currentStrategy: tutorResponse.strategy,
    learnerPerceivedState: learnerMessage.emotionalState || 'unknown',
    immediateGoal: 'advance understanding',
  });

  // Record strategy effectiveness (will be updated based on learner response)
  if (tutorResponse.strategy) {
    // We'll mark success/failure on the next turn based on learner response
    // For now, just record use
    tutorWritingPad.recordIntervention(learnerId, sessionId, {
      interventionType: tutorResponse.strategy,
      interventionDescription: tutorResponse.externalMessage.slice(0, 200),
      context: learnerMessage.externalMessage?.slice(0, 100),
    });
  }
}

// ============================================================================
// Detection Helpers
// ============================================================================

/**
 * Detect emotional state from internal deliberation
 */
function detectEmotionalState(deliberation) {
  const combinedText = deliberation.map((d) => d.content.toLowerCase()).join(' ');

  if (combinedText.includes('frustrat') || (combinedText.includes('confus') && combinedText.includes('give up'))) {
    return 'frustrated';
  }
  if (combinedText.includes('excit') || combinedText.includes('interest') || combinedText.includes('curious')) {
    return 'engaged';
  }
  if (combinedText.includes('bored') || combinedText.includes("don't care") || combinedText.includes('whatever')) {
    return 'disengaged';
  }
  if (combinedText.includes('understand') && combinedText.includes('now')) {
    return 'satisfied';
  }
  if (combinedText.includes('confus') || combinedText.includes("don't get")) {
    return 'confused';
  }
  return 'neutral';
}

/**
 * Detect understanding level from internal deliberation
 */
function detectUnderstandingLevel(deliberation) {
  const combinedText = deliberation.map((d) => d.content.toLowerCase()).join(' ');

  if (combinedText.includes('completely lost') || combinedText.includes('no idea')) {
    return 'none';
  }
  if (combinedText.includes('starting to') || combinedText.includes('maybe') || combinedText.includes('partially')) {
    return 'partial';
  }
  if (combinedText.includes('i get it') || combinedText.includes('makes sense') || combinedText.includes('i see')) {
    return 'solid';
  }
  if (combinedText.includes('wait, so') || combinedText.includes('that means') || combinedText.includes('restructur')) {
    return 'transforming';
  }
  return 'developing';
}

/**
 * Detect tutor's strategy from response
 */
function detectTutorStrategy(response) {
  const lower = response.toLowerCase();

  if (lower.includes('?') && (lower.includes('what do you think') || lower.includes('how might'))) {
    return 'socratic_questioning';
  }
  if (lower.includes('for example') || lower.includes('imagine') || lower.includes('like when')) {
    return 'concrete_examples';
  }
  if (lower.includes('let me break') || lower.includes('first') || lower.includes('step by step')) {
    return 'scaffolding';
  }
  if (lower.includes("you're right") || lower.includes('good observation') || lower.includes('exactly')) {
    return 'validation';
  }
  if (lower.includes('actually') || lower.includes('important distinction') || lower.includes('however')) {
    return 'gentle_correction';
  }
  if (lower.includes('challenge') || lower.includes('consider') || lower.includes('what if')) {
    return 'intellectual_challenge';
  }
  return 'direct_explanation';
}

/**
 * Detect outcomes from a turn
 */
function detectTurnOutcomes(learnerResponse, _tutorResponse) {
  const outcomes = [];

  if (learnerResponse.understandingLevel === 'transforming') {
    outcomes.push(INTERACTION_OUTCOMES.BREAKTHROUGH);
  }
  if (learnerResponse.emotionalState === 'confused' && learnerResponse.understandingLevel === 'developing') {
    outcomes.push(INTERACTION_OUTCOMES.PRODUCTIVE_STRUGGLE);
  }
  if (learnerResponse.emotionalState === 'frustrated') {
    outcomes.push(INTERACTION_OUTCOMES.FRUSTRATION);
  }
  if (learnerResponse.emotionalState === 'disengaged') {
    outcomes.push(INTERACTION_OUTCOMES.DISENGAGEMENT);
  }

  return outcomes;
}

/**
 * Generate summary of interaction
 */
function generateInteractionSummary(trace) {
  const uniqueOutcomes = [...new Set(trace.outcomes)];

  return {
    turnCount: trace.turns.length,
    uniqueOutcomes,
    hadBreakthrough: uniqueOutcomes.includes(INTERACTION_OUTCOMES.BREAKTHROUGH),
    hadFrustration: uniqueOutcomes.includes(INTERACTION_OUTCOMES.FRUSTRATION),
    hadProductiveStruggle: uniqueOutcomes.includes(INTERACTION_OUTCOMES.PRODUCTIVE_STRUGGLE),
    learnerFinalState: trace.turns[trace.turns.length - 1]?.emotionalState || 'unknown',
    learnerFinalUnderstanding: trace.turns[trace.turns.length - 1]?.understandingLevel || 'unknown',
    memoryChanges: {
      learner: calculateMemoryDelta(trace.writingPadSnapshots.learner.before, trace.writingPadSnapshots.learner.after),
      tutor: calculateMemoryDelta(trace.writingPadSnapshots.tutor.before, trace.writingPadSnapshots.tutor.after),
    },
  };
}

/**
 * Calculate what changed in writing pad
 */
function calculateMemoryDelta(before, after) {
  if (!before || !after) return { noData: true };

  // Simple delta calculation
  return {
    newLessons: (after.preconscious?.lessons?.length || 0) - (before.preconscious?.lessons?.length || 0),
    newBreakthroughs:
      (after.unconscious?.breakthroughs?.length || 0) - (before.unconscious?.breakthroughs?.length || 0),
    newTraumas:
      (after.unconscious?.unresolvedTraumas?.length || 0) - (before.unconscious?.unresolvedTraumas?.length || 0),
  };
}

// ============================================================================
// Standalone Learner Response (for evaluation pipeline)
// ============================================================================

// Retry delays for 429 rate limits (matches evaluationRunner pattern)
const LEARNER_RETRY_DELAYS = [2000, 4000, 8000];

// Empty-content retry constants (HTTP 200 but no text — e.g. Gemini Flash).
// NOTE: This duplicates the retry logic in tutor-core's callAI(). If we ever
// refactor callLearnerAI to call through tutor-core's callAI instead of its
// own _callLearnerAIOnce, this can be removed — tutor-core already handles it.
const EMPTY_CONTENT_MAX_RETRIES = 2;
const EMPTY_CONTENT_RETRY_DELAYS = [1000, 2000];

/**
 * Call the LLM for a learner agent using the same raw fetch layer as
 * tutorDialogueEngine.callAI — same headers, error handling, and response
 * parsing per provider. This ensures learner and tutor calls go through
 * identical network code paths.
 *
 * Includes built-in retry with exponential backoff for 429 rate limits.
 *
 * @param {Object} agentConfig - From learnerConfig.getAgentConfig()
 * @param {string} systemPrompt - Static system/persona prompt (cacheable)
 * @param {string} userPrompt - Dynamic per-call user content
 * @param {string} agentRole - For logging (e.g. 'ego', 'superego', 'synthesis')
 * @returns {Promise<Object>} { content, usage: { inputTokens, outputTokens }, latencyMs }
 */
async function callLearnerAI(agentConfig, systemPrompt, userPrompt, agentRole = 'learner', messageHistory = null) {
  let effectiveSystemPrompt = systemPrompt;
  let effectiveUserPrompt = userPrompt;

  // Phase 1: 429 rate-limit retry (throws on non-429 errors)
  let result;
  let lastError;
  for (let attempt = 0; attempt <= LEARNER_RETRY_DELAYS.length; attempt++) {
    try {
      result = await _callLearnerAIOnce(agentConfig, effectiveSystemPrompt, effectiveUserPrompt, agentRole, messageHistory);
      break;
    } catch (error) {
      lastError = error;
      const is429 = error?.message?.includes('429') || error?.message?.toLowerCase()?.includes('rate limit');
      if (!is429 || attempt >= LEARNER_RETRY_DELAYS.length) throw error;
      const delay = LEARNER_RETRY_DELAYS[attempt];
      console.warn(
        `[${agentRole}] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${LEARNER_RETRY_DELAYS.length})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  if (!result) throw lastError;

  // Phase 1.5: Context overflow retry (local/lmstudio only — progressive truncation)
  const MAX_OVERFLOW_RETRIES = 2;
  for (let overflowLevel = 1; result.contextOverflow && overflowLevel <= MAX_OVERFLOW_RETRIES; overflowLevel++) {
    const beforeLen = effectiveSystemPrompt.length + effectiveUserPrompt.length;
    const truncated = truncateForContextOverflow(systemPrompt, userPrompt, overflowLevel);
    effectiveSystemPrompt = truncated.systemPrompt;
    effectiveUserPrompt = truncated.userPrompt;
    const afterLen = effectiveSystemPrompt.length + effectiveUserPrompt.length;
    console.warn(
      `[${agentRole}] Context overflow from ${agentConfig.model}, truncating level ${overflowLevel} (${beforeLen} → ${afterLen} chars)`,
    );
    result = await _callLearnerAIOnce(agentConfig, effectiveSystemPrompt, effectiveUserPrompt, agentRole, messageHistory);
  }
  if (result.contextOverflow) {
    throw new Error(
      `Context overflow for ${agentConfig.model} even after level-${MAX_OVERFLOW_RETRIES} truncation. ` +
      `Error: ${result.errorMessage}`,
    );
  }

  // Phase 2: Empty-content retry (HTTP 200 but no text)
  // Skip if finish_reason is 'length' — token budget exhausted, same max_tokens will fail again
  if (!result.content && result.usage?.outputTokens === 0 && result.finishReason !== 'length') {
    for (let retry = 0; retry < EMPTY_CONTENT_MAX_RETRIES; retry++) {
      const delay = EMPTY_CONTENT_RETRY_DELAYS[retry];
      console.warn(
        `[${agentRole}] Empty content from ${agentConfig.model} (0 output tokens), retrying in ${delay}ms (attempt ${retry + 1}/${EMPTY_CONTENT_MAX_RETRIES})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));

      try {
        const retryResult = await _callLearnerAIOnce(agentConfig, effectiveSystemPrompt, effectiveUserPrompt, agentRole, messageHistory);
        if (retryResult.content) {
          retryResult.emptyContentRetries = retry + 1;
          return retryResult;
        }
        // If outputTokens > 0, thinking model budget exhaustion — don't keep retrying
        if (retryResult.usage?.outputTokens > 0) {
          retryResult.emptyContentRetries = retry + 1;
          return retryResult;
        }
        result = retryResult; // update to latest attempt for return
      } catch {
        // Retry attempt failed with exception — keep the last successful-but-empty result
        break;
      }
    }
    console.warn(
      `[${agentRole}] Empty content persists after ${EMPTY_CONTENT_MAX_RETRIES} retries (model=${agentConfig.model}). Returning empty result.`,
    );
    result.emptyContentRetries = EMPTY_CONTENT_MAX_RETRIES;
  }

  return result;
}

/**
 * Single-attempt LLM call. Delegates to shared _fetchProvider() from tutor-core
 * for the raw HTTP fetch, then wraps the result into the learner's shape
 * (content + usage + apiPayload).
 */
async function _callLearnerAIOnce(agentConfig, systemPrompt, userPrompt, agentRole, messageHistory = null) {
  const { provider, providerConfig, model, hyperparameters = {} } = agentConfig;
  const { temperature = 0.7, top_p, reasoning_effort = 'low' } = hyperparameters;
  let max_tokens = hyperparameters.max_tokens;
  if (max_tokens === undefined) {
    throw new Error('Explicit max_tokens setting is required in learner hyperparameters.');
  }

  // Thinking/reasoning models (kimi-k2-thinking, deepseek-r1) use internal
  // chain-of-thought that consumes max_tokens. Boost significantly.
  // Note: kimi-k2.5 (non-thinking) does NOT need this — it's a separate model.
  const isThinkingModel = model?.includes('kimi-k2-thinking') || model?.includes('deepseek-r1');
  if (isThinkingModel && max_tokens < 8000) {
    max_tokens = 8000;
  }

  // Build provider-specific messages and system prompt
  // Learner's Anthropic path merges userPrompt into the last user message
  // (different from tutor which folds into system for message-chain mode)
  let messages;
  let effectiveSystem;
  if (provider === 'anthropic') {
    effectiveSystem = systemPrompt;
    if (messageHistory?.length) {
      messages = [...messageHistory];
      const last = messages[messages.length - 1];
      if (last.role === 'user') {
        messages[messages.length - 1] = { role: 'user', content: `${last.content}\n\n${userPrompt}` };
      } else {
        messages.push({ role: 'user', content: userPrompt });
      }
    } else {
      messages = [{ role: 'user', content: userPrompt }];
    }
  } else if (provider === 'gemini') {
    effectiveSystem = systemPrompt;
    if (messageHistory?.length) {
      messages = [];
      for (const msg of messageHistory) {
        const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
        const last = messages[messages.length - 1];
        if (last && last.role === geminiRole) {
          last.parts[0].text += '\n\n' + msg.content;
        } else {
          messages.push({ role: geminiRole, parts: [{ text: msg.content }] });
        }
      }
      const last = messages[messages.length - 1];
      if (last && last.role === 'user') {
        last.parts[0].text += '\n\n' + userPrompt;
      } else {
        messages.push({ role: 'user', parts: [{ text: userPrompt }] });
      }
    } else {
      messages = [{ role: 'user', parts: [{ text: userPrompt }] }];
    }
  } else {
    // OpenAI, OpenRouter, local, lmstudio: standard {role, content} messages
    effectiveSystem = systemPrompt;
    messages = messageHistory?.length
      ? [{ role: 'system', content: systemPrompt }, ...messageHistory, { role: 'user', content: userPrompt }]
      : [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }];
  }

  // Delegate to shared fetch (no streaming for learner)
  const raw = await _fetchProvider({
    provider,
    providerConfig,
    model,
    messages,
    systemPrompt: effectiveSystem,
    hyperparameters: { temperature, max_tokens, top_p, reasoning_effort },
    onToken: null,
  });

  // Wrap into learner result shape
  return {
    content: raw.text,
    usage: {
      inputTokens: raw.inputTokens || 0,
      outputTokens: raw.outputTokens || 0,
    },
    finishReason: raw.finishReason || undefined,
    latencyMs: raw.latencyMs,
    model,
    provider,
    generationId: raw.generationId || null,
    ...(raw.contextOverflow && { contextOverflow: true, errorMessage: raw.errorMessage }),
    apiPayload: {
      captureVersion: 1,
      source: 'learner_call',
      endpoint: providerConfig.base_url || (provider === 'gemini' ? 'gemini.models.generateContent' : undefined),
      request: {
        method: 'POST',
        body: truncatePayload({ model, temperature, max_tokens, top_p, messages }),
      },
      response: {
        status: raw.rawResponse?.status || 200,
        body: truncatePayload({ text: raw.text }),
      },
    },
  };
}

/**
 * Generate a single learner response for use by the evaluation pipeline.
 * Runs ego→superego→synthesis if profile is multi-agent, or single call if unified.
 *
 * Uses callLearnerAI internally — the same raw fetch layer as the tutor's
 * tutorDialogueEngine.callAI — so learner and tutor LLM calls go through
 * identical provider code paths with identical retry logic.
 *
 * @param {Object} options
 * @param {string} options.tutorMessage - The tutor's message to respond to
 * @param {string} options.topic - Current topic
 * @param {Array}  options.conversationHistory - [{role, content}, ...]
 * @param {string} options.learnerProfile - Profile name ('ego_superego' or 'unified')
 * @param {string} options.personaId - Persona identifier (default: 'eager_novice')
 * @param {string|Object} [options.modelOverride] - Optional model override (e.g. 'openrouter.nemotron') applied to all learner agents
 * @param {string} [options.egoModelOverride] - Optional override for learner ego model only (e.g. 'openrouter.haiku')
 * @param {string} [options.superegoModelOverride] - Optional override for learner superego model only (e.g. 'openrouter.kimi-k2.5')
 * @param {Function} [options.llmCall] - Injected LLM function (interactive path); uses callLearnerAI when null
 * @param {string} [options.memoryContext] - Pre-built narrative from learnerWritingPad
 * @param {Object} [options.trace] - Mutable trace object for interactive path token tracking
 * @returns {Promise<Object>} { message, externalMessage, internalDeliberation, emotionalState, understandingLevel, suggestsEnding, tokenUsage }
 */
export async function generateLearnerResponse(options) {
  const {
    tutorMessage,
    topic,
    conversationHistory = [],
    learnerProfile = 'unified',
    personaId = 'eager_novice',
    modelOverride,
    egoModelOverride,
    superegoModelOverride,
    profileContext,
    llmCall = null,
    memoryContext = null,
    trace = null,
    conversationMode = 'single-prompt', // 'messages' for multi-turn message chains
  } = options;

  // Resolve model overrides. Priority: specific (ego/superego) > general (modelOverride) > YAML default
  function resolveOverride(ref) {
    if (!ref) return null;
    const r = learnerConfig.resolveModel(ref);
    const providerConfig = learnerConfig.getProviderConfig(r.provider);
    const modelFullId = providerConfig.models?.[r.model] || r.model;
    return { provider: r.provider, providerConfig, model: modelFullId, modelAlias: r.model };
  }

  const resolvedGeneralOverride = resolveOverride(modelOverride);
  const resolvedEgoOverride = resolveOverride(egoModelOverride);
  const resolvedSuperegoOverride = resolveOverride(superegoModelOverride);

  const applyOverride = (cfg, role) => {
    // Specific override for this role takes priority over general override
    const override =
      (role === 'ego' ? resolvedEgoOverride : role === 'superego' ? resolvedSuperegoOverride : null) ||
      resolvedGeneralOverride;
    if (!override || !cfg) return cfg;
    return {
      ...cfg,
      provider: override.provider,
      providerConfig: override.providerConfig,
      model: override.model,
      modelAlias: override.modelAlias,
    };
  };

  // Build learner's external message chain (roles inverted: tutor = user, learner = assistant)
  // Only used when conversationMode is 'messages'
  const useMessageChains = conversationMode === 'messages';
  let learnerExternalHistory = null;
  if (useMessageChains && conversationHistory.length > 0) {
    learnerExternalHistory = conversationHistory.map(m => ({
      role: m.role === 'tutor' ? 'user' : 'assistant',
      content: m.content,
    }));
  }

  // Internal chains for ego-superego deliberation (within this turn)
  const learnerEgoInternalHistory = [];

  // Build LLM call adapter so both interactive (injected llmCall) and
  // eval (callLearnerAI) paths use the same pipeline.
  // The 5th argument is messageHistory for message chain mode.
  const callLLM = llmCall
    ? async (agentConfig, systemPrompt, userPrompt, _role, _msgHistory = null) => {
      const response = await llmCall(agentConfig.model, systemPrompt, [{ role: 'user', content: userPrompt }], {
        temperature: getRequiredTemperature(agentConfig, _role || 'learner_agent'),
        maxTokens: getRequiredMaxTokens(agentConfig, _role || 'learner_agent'),
        agentRole: _role,
      });
      return {
        content: response.content,
        usage: response.usage,
        model: response.model || agentConfig.model,
        provider: response.provider || agentConfig.provider || null,
        latencyMs: response.latencyMs || null,
        generationId: response.generationId || null,
        apiPayload: response.apiPayload || null,
      };
    }
    : callLearnerAI;

  const persona = learnerConfig.getPersona(personaId);
  const profile = learnerConfig.getActiveProfile(learnerProfile);
  const agentRoles = learnerConfig.getProfileAgentRoles(profile.name);
  const internalDeliberation = [];
  const tokenUsage = { inputTokens: 0, outputTokens: 0, apiCalls: 0 };

  // Build conversation context string from history
  const conversationContext = conversationHistory
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  // Psychodynamic flow: Ego (initial) → Superego (critique) → Ego (revision/final)
  // This mirrors the tutor architecture where the ego has final authority over output,
  // accepting, rejecting, or modifying the superego's suggestions.

  const hasMultiAgent = agentRoles.includes('ego') && agentRoles.includes('superego');

  if (hasMultiAgent) {
    // === STEP 1: Ego initial reaction ===
    const egoConfig = applyOverride(learnerConfig.getAgentConfig('ego', profile.name), 'ego');
    let egoContext = `Topic: ${topic}`;
    if (memoryContext) {
      egoContext += `\n\nYour memory and state:\n${memoryContext}`;
    }
    egoContext += `\n\nRecent conversation:\n${conversationContext}\n\nThe tutor just said:\n"${tutorMessage}"`;
    if (profileContext) {
      egoContext += `\n\n${profileContext}`;
    }
    egoContext += `\n\nGenerate your initial internal reaction as the learner's ego.`;
    const egoSystemPrompt = buildLearnerPrompt(egoConfig, persona, egoContext);

    const egoInitialResponse = await callLLM(
      egoConfig,
      egoSystemPrompt,
      "React to the tutor's message.",
      'learner_ego_initial',
      useMessageChains ? learnerExternalHistory : null,
    );
    const egoInitialEntry = makeDeliberationEntry('ego_initial', egoInitialResponse, egoConfig);
    egoInitialEntry.inputMessages = useMessageChains && learnerExternalHistory
      ? [...learnerExternalHistory, { role: 'user', content: "React to the tutor's message." }]
      : null;
    internalDeliberation.push(egoInitialEntry);

    // Record ego initial output in internal chain (for ego revision)
    if (useMessageChains) {
      learnerEgoInternalHistory.push(
        { role: 'assistant', content: egoInitialResponse.content },
      );
    }
    tokenUsage.inputTokens += egoInitialResponse.usage?.inputTokens || 0;
    tokenUsage.outputTokens += egoInitialResponse.usage?.outputTokens || 0;
    tokenUsage.apiCalls++;
    if (trace?.metrics) {
      trace.metrics.learnerInputTokens += egoInitialResponse.usage?.inputTokens || 0;
      trace.metrics.learnerOutputTokens += egoInitialResponse.usage?.outputTokens || 0;
    }

    // === STEP 2: Superego critique ===
    const superegoConfig = applyOverride(learnerConfig.getAgentConfig('superego', profile.name), 'superego');
    let superegoContext = `Topic: ${topic}`;
    if (memoryContext) {
      superegoContext += `\n\nYour memory and state:\n${memoryContext}`;
    }
    superegoContext += `\n\nRecent conversation:\n${conversationContext}\n\nThe tutor just said:\n"${tutorMessage}"\n\nThe EGO's initial reaction was:\n"${egoInitialResponse.content}"`;
    if (profileContext) {
      superegoContext += `\n\n${profileContext}`;
    }
    superegoContext += `\n\nReview the EGO's response. Is it accurate? What's being missed? What should be reconsidered?`;
    const superegoSystemPrompt = buildLearnerPrompt(superegoConfig, persona, superegoContext);

    const superegoResponse = await callLLM(
      superegoConfig,
      superegoSystemPrompt,
      "Critique the EGO's reaction.",
      'learner_superego',
    );
    const superegoEntry = makeDeliberationEntry('superego', superegoResponse, superegoConfig);
    superegoEntry.inputMessages = null; // superego uses single-prompt, not message chains
    internalDeliberation.push(superegoEntry);
    tokenUsage.inputTokens += superegoResponse.usage?.inputTokens || 0;
    tokenUsage.outputTokens += superegoResponse.usage?.outputTokens || 0;
    tokenUsage.apiCalls++;
    if (trace?.metrics) {
      trace.metrics.learnerInputTokens += superegoResponse.usage?.inputTokens || 0;
      trace.metrics.learnerOutputTokens += superegoResponse.usage?.outputTokens || 0;
    }

    // === STEP 3: Ego revision (final authority) ===
    // The ego considers the superego's feedback and decides what to actually say.
    // It may accept, reject, or modify the superego's suggestions.
    let egoRevisionContext = `Topic: ${topic}`;
    if (memoryContext) {
      egoRevisionContext += `\n\nYour memory and state:\n${memoryContext}`;
    }
    egoRevisionContext += `\n\nRecent conversation:\n${conversationContext}\n\nThe tutor just said:\n"${tutorMessage}"\n\nYour initial reaction was:\n"${egoInitialResponse.content}"\n\nInternal review feedback:\n"${superegoResponse.content}"\n\nConsider this feedback. You have final authority — accept, reject, or modify as you see fit.\n\nRespond with ONLY what the learner would say out loud to the tutor (1-4 sentences). Do NOT include internal thoughts, meta-commentary, or references to any review process.`;
    const egoRevisionSystemPrompt = buildLearnerPrompt(egoConfig, persona, egoRevisionContext);

    // Build combined history for ego revision: external + ego internal + superego feedback
    let egoRevisionMsgHistory = null;
    if (useMessageChains) {
      egoRevisionMsgHistory = [
        ...(learnerExternalHistory || []),
        ...learnerEgoInternalHistory,
        { role: 'user', content: `Internal review feedback:\n${superegoResponse.content}` },
      ];
    }

    const egoFinalResponse = await callLLM(
      egoConfig,
      egoRevisionSystemPrompt,
      'Produce your final response to the tutor.',
      'learner_ego_revision',
      egoRevisionMsgHistory,
    );
    const egoRevisionEntry = makeDeliberationEntry('ego_revision', egoFinalResponse, egoConfig);
    egoRevisionEntry.inputMessages = egoRevisionMsgHistory
      ? [...egoRevisionMsgHistory, { role: 'user', content: 'Produce your final response to the tutor.' }]
      : null;
    internalDeliberation.push(egoRevisionEntry);
    tokenUsage.inputTokens += egoFinalResponse.usage?.inputTokens || 0;
    tokenUsage.outputTokens += egoFinalResponse.usage?.outputTokens || 0;
    tokenUsage.apiCalls++;
    if (trace?.metrics) {
      trace.metrics.learnerInputTokens += egoFinalResponse.usage?.inputTokens || 0;
      trace.metrics.learnerOutputTokens += egoFinalResponse.usage?.outputTokens || 0;
    }

    // Log deliberation for debugging/analysis
    if (process.env.LEARNER_DEBUG) {
      console.log('\n┌─────────────────────────────────────────────────────────────');
      console.log('│ LEARNER DELIBERATION (ego→superego→ego_revision)');
      console.log('├─────────────────────────────────────────────────────────────');
      console.log(`│ EGO INITIAL: ${egoInitialResponse.content.substring(0, 200)}...`);
      console.log('├─────────────────────────────────────────────────────────────');
      console.log(`│ SUPEREGO: ${superegoResponse.content.substring(0, 200)}...`);
      console.log('├─────────────────────────────────────────────────────────────');
      console.log(`│ EGO REVISION (FINAL): ${egoFinalResponse.content.substring(0, 200)}...`);
      console.log('└─────────────────────────────────────────────────────────────\n');
    }
  } else {
    // Single-agent (unified) flow — run each role sequentially as before
    for (const role of agentRoles) {
      const agentConfig = applyOverride(learnerConfig.getAgentConfig(role, profile.name), role);
      if (!agentConfig) continue;

      let roleContext = `Topic: ${topic}`;
      if (memoryContext) {
        roleContext += `\n\nYour memory and state:\n${memoryContext}`;
      }
      roleContext += `\n\nRecent conversation:\n${conversationContext}\n\nThe tutor just said:\n"${tutorMessage}"`;
      if (profileContext) {
        roleContext += `\n\n${profileContext}`;
      }
      roleContext += `\n\nGenerate your internal reaction as this dimension of the learner's experience.`;

      const systemPrompt = buildLearnerPrompt(agentConfig, persona, roleContext);
      const response = await callLLM(agentConfig, systemPrompt, "React to the tutor's message.", `learner_${role}`);

      internalDeliberation.push(makeDeliberationEntry(role, response, agentConfig));
      tokenUsage.inputTokens += response.usage?.inputTokens || 0;
      tokenUsage.outputTokens += response.usage?.outputTokens || 0;
      tokenUsage.apiCalls++;
      if (trace?.metrics) {
        trace.metrics.learnerInputTokens += response.usage?.inputTokens || 0;
        trace.metrics.learnerOutputTokens += response.usage?.outputTokens || 0;
      }
    }
  }

  // Get final message from the last deliberation step
  // For multi-agent: ego_revision. For unified: the single agent's output.
  const finalDeliberation = internalDeliberation[internalDeliberation.length - 1];
  const emotionalState = detectEmotionalState(internalDeliberation);

  // Unified learner prompt requests [INTERNAL]/[EXTERNAL] format.
  // Parse out the [EXTERNAL] section for what the tutor sees; keep full text in deliberation.
  const rawContent = finalDeliberation.content;
  const externalOnly = extractExternalSection(rawContent);

  return {
    message: externalOnly,
    externalMessage: externalOnly,
    internalDeliberation,
    emotionalState,
    understandingLevel: detectUnderstandingLevel(internalDeliberation),
    suggestsEnding: emotionalState === 'satisfied' || emotionalState === 'disengaged',
    tokenUsage,
  };
}

// ============================================================================
// Exports
// ============================================================================

// Named exports for pure helper functions (used in unit tests)
export {
  detectEmotionalState,
  detectUnderstandingLevel,
  detectTutorStrategy,
  extractTutorMessage,
  extractExternalSection,
  calculateMemoryDelta,
  callLearnerAI,
  INTERACTION_OUTCOMES,
  getRequiredTemperature,
  getRequiredMaxTokens,
};

export default {
  runInteraction,
  generateLearnerResponse,
  INTERACTION_OUTCOMES,
};
