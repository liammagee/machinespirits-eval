/**
 * Learner-Tutor Interaction Engine
 *
 * Orchestrates multi-turn interactions between synthetic learner agents
 * and tutor agents for evaluation purposes. Tracks both internal deliberation
 * and external dialogue, with hooks for judge evaluation.
 */

import * as learnerConfig from './learnerConfigLoader.js';
import { tutorConfigLoader as tutorConfig } from '@machinespirits/tutor-core';

import * as learnerWritingPad from './memory/learnerWritingPad.js';
import * as tutorWritingPad from './memory/tutorWritingPad.js';

// ============================================================================
// Interaction Engine Configuration
// ============================================================================

const DEFAULT_MAX_TURNS = 10;

// Interaction outcomes for tracking
const INTERACTION_OUTCOMES = {
  BREAKTHROUGH: 'breakthrough',         // Learner shows genuine understanding
  PRODUCTIVE_STRUGGLE: 'productive_struggle',  // Healthy confusion/effort
  MUTUAL_RECOGNITION: 'mutual_recognition',    // Both parties recognize each other
  FRUSTRATION: 'frustration',            // Learner becomes frustrated
  DISENGAGEMENT: 'disengagement',        // Learner disengages
  SCAFFOLDING_NEEDED: 'scaffolding_needed',    // Learner needs more support
  FADING_APPROPRIATE: 'fading_appropriate',    // Ready for less support
  TRANSFORMATION: 'transformation',      // Conceptual restructuring occurred
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

  const {
    maxTurns = DEFAULT_MAX_TURNS,
    trace = true,
    observeInternals = true,
  } = options;

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
    interactionTrace
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
      interactionTrace
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
    const learnerResponse = await runLearnerTurn(
      learnerId,
      sessionId,
      learnerPersona,
      learnerArchitecture,
      learnerProfile,
      tutorResponse.externalMessage,
      conversationHistory,
      topic,
      llmCall,
      interactionTrace
    );

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
      const priorDeliberation = internalDeliberation
        .map(d => `${d.role.toUpperCase()}: ${d.content}`)
        .join('\n\n');
      roleContext += `

The EGO's initial reaction was:
${priorDeliberation}

Review the EGO's first impression. Is it too superficial? What's being avoided? What would lead to genuine learning?`;
    } else {
      roleContext += `

Generate this agent's internal voice as the learner approaches this topic for the first time.`;
    }

    const prompt = buildLearnerPrompt(agentConfig, persona, roleContext);

    const response = await llmCall(agentConfig.model, prompt, [{ role: 'user', content: role === 'superego' ? 'Critique the EGO\'s initial reaction.' : 'Generate your internal voice.' }], {
      temperature: agentConfig.hyperparameters?.temperature || 0.7,
      maxTokens: agentConfig.hyperparameters?.max_tokens || 200,
    });

    internalDeliberation.push({
      role,
      content: response.content,
    });

    trace.metrics.learnerInputTokens += response.usage?.inputTokens || 0;
    trace.metrics.learnerOutputTokens += response.usage?.outputTokens || 0;
  }

  // Synthesize external message
  const synthesisConfig = learnerConfig.getSynthesisConfig(profile.name);

  // If scenario provides an opening message, use it directly to ensure context
  // Otherwise, synthesize from internal deliberation
  const hasOpeningMessage = scenario?.learnerOpening && scenario.learnerOpening.trim().length > 0;

  const synthesisPrompt = hasOpeningMessage
    ? `You are simulating a learner with these internal voices:

${internalDeliberation.map(d => `${d.role.toUpperCase()}: ${d.content}`).join('\n\n')}

The learner wants to open with this message: "${scenario.learnerOpening}"

Lightly adapt this opening to feel natural given the internal deliberation, but keep the core content and question intact.
The adapted message should be 1-3 sentences and maintain the original meaning.`
    : `You are simulating a learner with these internal voices:

${internalDeliberation.map(d => `${d.role.toUpperCase()}: ${d.content}`).join('\n\n')}

Synthesize these into a realistic first message to a tutor about: ${topic}

The message should feel authentic - not too polished, showing real confusion or interest.
Keep it 1-3 sentences.`;

  const synthModel = synthesisConfig?.model || resolveProfileModel(profile);
  const externalResponse = await llmCall(synthModel, synthesisPrompt, [{ role: 'user', content: 'Generate the learner\'s opening message.' }], {
    temperature: synthesisConfig?.hyperparameters?.temperature || 0.7,
    maxTokens: synthesisConfig?.hyperparameters?.max_tokens || 200,
  });

  trace.metrics.learnerInputTokens += externalResponse.usage?.inputTokens || 0;
  trace.metrics.learnerOutputTokens += externalResponse.usage?.outputTokens || 0;

  return {
    externalMessage: externalResponse.content,
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

/**
 * Resolve model from profile configuration
 */
function resolveProfileModel(profile) {
  const providerConfig = learnerConfig.getProviderConfig(profile.provider || 'openrouter');
  const modelAlias = profile.model || 'nemotron';
  return providerConfig.models?.[modelAlias] || modelAlias;
}

/**
 * Run a learner turn in response to tutor
 */
async function runLearnerTurn(learnerId, sessionId, persona, architecture, profile, tutorMessage, history, topic, llmCall, trace) {
  // Get agent roles from profile (not architecture)
  const agentRoles = learnerConfig.getProfileAgentRoles(profile.name);
  const internalDeliberation = [];

  // Get current learner memory state
  const learnerMemory = learnerWritingPad.buildNarrativeSummary(learnerId, sessionId);

  // Build conversation context
  const conversationContext = history
    .slice(-6)
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  // Run internal deliberation for each agent
  // For ego/superego pattern: superego sees and critiques ego's response
  for (const role of agentRoles) {
    const agentConfig = learnerConfig.getAgentConfig(role, profile.name);
    if (!agentConfig) continue;

    // Build context based on role
    let roleContext = `
Topic: ${topic}

Your memory and state:
${learnerMemory}

Recent conversation:
${conversationContext}

The tutor just said:
"${tutorMessage}"`;

    // If this is superego and we have prior deliberation (ego), include it for critique
    if (role === 'superego' && internalDeliberation.length > 0) {
      const priorDeliberation = internalDeliberation
        .map(d => `${d.role.toUpperCase()}: ${d.content}`)
        .join('\n\n');
      roleContext += `

The EGO's initial reaction was:
${priorDeliberation}

Review the EGO's response. Is it accurate? What's being missed or glossed over? What should we really ask or admit?`;
    } else {
      roleContext += `

Generate your internal reaction as this dimension of the learner's experience.`;
    }

    const prompt = buildLearnerPrompt(agentConfig, persona, roleContext);

    const response = await llmCall(agentConfig.model, prompt, [{ role: 'user', content: role === 'superego' ? 'Critique the EGO\'s reaction.' : 'React to the tutor\'s message.' }], {
      temperature: agentConfig.hyperparameters?.temperature || 0.7,
      maxTokens: agentConfig.hyperparameters?.max_tokens || 200,
    });

    internalDeliberation.push({
      role,
      content: response.content,
    });

    trace.metrics.learnerInputTokens += response.usage?.inputTokens || 0;
    trace.metrics.learnerOutputTokens += response.usage?.outputTokens || 0;
  }

  // Synthesize external response
  const emotionalState = detectEmotionalState(internalDeliberation);
  const understandingLevel = detectUnderstandingLevel(internalDeliberation);

  const synthesisConfig = learnerConfig.getSynthesisConfig(profile.name);
  const synthesisPrompt = `You are simulating a ${persona.name} learner with these internal reactions:

${internalDeliberation.map(d => `${d.role.toUpperCase()}: ${d.content}`).join('\n\n')}

Current emotional state: ${emotionalState}
Current understanding: ${understandingLevel}

The tutor just said: "${tutorMessage}"

Synthesize these internal reactions into a realistic response. The learner should:
- Show their genuine reaction (confusion, interest, frustration, insight)
- Ask follow-up questions if naturally arising
- Not be too polished or articulate if they're genuinely confused
- Match the persona: ${persona.description}

Keep response to 1-4 sentences. Be authentic.`;

  const synthModel = synthesisConfig?.model || resolveProfileModel(profile);
  const externalResponse = await llmCall(synthModel, synthesisPrompt, [{ role: 'user', content: 'Generate the learner\'s response.' }], {
    temperature: synthesisConfig?.hyperparameters?.temperature || 0.7,
    maxTokens: synthesisConfig?.hyperparameters?.max_tokens || 250,
  });

  trace.metrics.learnerInputTokens += externalResponse.usage?.inputTokens || 0;
  trace.metrics.learnerOutputTokens += externalResponse.usage?.outputTokens || 0;

  return {
    externalMessage: externalResponse.content,
    internalDeliberation,
    emotionalState,
    understandingLevel,
    suggestsEnding: emotionalState === 'satisfied' || emotionalState === 'disengaged',
  };
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
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  // Get tutor configuration from profile
  const profile = tutorConfig.getActiveProfile(tutorProfileName);
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
    temperature: egoConfig?.hyperparameters?.temperature || 0.6,
    maxTokens: egoConfig?.hyperparameters?.max_tokens || 800,
  });

  trace.metrics.tutorInputTokens += egoResponse.usage?.inputTokens || 0;
  trace.metrics.tutorOutputTokens += egoResponse.usage?.outputTokens || 0;

  const egoDraft = egoResponse.content || '';
  internalDeliberation.push({
    role: 'ego',
    content: egoDraft,
  });

  // ===== T.SUPEREGO: Critique and refine =====
  const superegoPrompt = `${superegoConfig?.prompt || 'You are a pedagogical critic reviewing tutor responses.'}

Context about the learner:
${tutorMemory || 'New learner - no prior history.'}

Topic: ${topic}

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

  const superegoModel = superegoConfig?.model || tutorModel;

  const superegoResponse = await llmCall(superegoModel, superegoPrompt, [{ role: 'user', content: egoDraft }], {
    temperature: superegoConfig?.hyperparameters?.temperature || 0.4,
    maxTokens: superegoConfig?.hyperparameters?.max_tokens || 1000,
  });

  trace.metrics.tutorInputTokens += superegoResponse.usage?.inputTokens || 0;
  trace.metrics.tutorOutputTokens += superegoResponse.usage?.outputTokens || 0;

  const superegoContent = superegoResponse.content || '';
  internalDeliberation.push({
    role: 'superego',
    content: superegoContent,
  });

  // Parse superego response for improved version
  let externalMessage = egoDraft;
  const improvedMatch = superegoContent.match(/IMPROVED:\s*([\s\S]*?)(?:$)/i);
  if (improvedMatch && improvedMatch[1]) {
    const improved = improvedMatch[1].trim();
    if (improved.toUpperCase() !== 'APPROVED' && improved.length > 20) {
      externalMessage = improved;
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
    externalMessage = "I see what you're saying. Let me think about that for a moment. Could you tell me more about what's confusing you?";
  }

  return {
    externalMessage,
    rawResponse: egoResponse.content, // Keep raw for debugging
    internalDeliberation,
    strategy,
    suggestsEnding: externalMessage.toLowerCase().includes('good place to pause') ||
                    externalMessage.toLowerCase().includes('think about this'),
  };
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
  if (learnerResponse.understandingLevel === 'transforming' ||
      learnerResponse.externalMessage.toLowerCase().includes('oh, i see') ||
      learnerResponse.externalMessage.toLowerCase().includes('wait, so')) {
    learnerWritingPad.recordBreakthrough(learnerId, {
      momentDescription: 'Understanding shift detected',
      concept: topic,
      impactScore: 0.6,
      context: tutorResponse.externalMessage.slice(0, 100),
    });
  }

  if (learnerResponse.emotionalState === 'frustrated' ||
      learnerResponse.externalMessage.toLowerCase().includes("don't understand")) {
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
  const combinedText = deliberation.map(d => d.content.toLowerCase()).join(' ');

  if (combinedText.includes('frustrat') || combinedText.includes('confus') && combinedText.includes('give up')) {
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
  const combinedText = deliberation.map(d => d.content.toLowerCase()).join(' ');

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
function detectTurnOutcomes(learnerResponse, tutorResponse) {
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
      learner: calculateMemoryDelta(
        trace.writingPadSnapshots.learner.before,
        trace.writingPadSnapshots.learner.after
      ),
      tutor: calculateMemoryDelta(
        trace.writingPadSnapshots.tutor.before,
        trace.writingPadSnapshots.tutor.after
      ),
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
    newBreakthroughs: (after.unconscious?.breakthroughs?.length || 0) - (before.unconscious?.breakthroughs?.length || 0),
    newTraumas: (after.unconscious?.unresolvedTraumas?.length || 0) - (before.unconscious?.unresolvedTraumas?.length || 0),
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  runInteraction,
  INTERACTION_OUTCOMES,
};
