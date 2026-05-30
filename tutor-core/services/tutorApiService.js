/**
 * Tutor API Service
 *
 * Provides a programmatic API for the AI tutor, externalizing the study guide
 * features for testing, evaluation, and alternative clients.
 *
 * This service wraps the tutorDialogueEngine and tutorSuggestionEngine,
 * allowing configurable provider/model/hyperparameter combinations per request.
 */

import * as dialogueEngine from './tutorDialogueEngine.js';
import * as configLoader from './tutorConfigLoader.js';

/**
 * Build context strings for the tutor API
 * Returns a formatted context object ready for dialogue engine
 */
export function buildContext(learnerContextStr, curriculumContextStr, simulationsContextStr, messageHistory = null) {
  return {
    learnerContext: learnerContextStr || '',
    curriculumContext: curriculumContextStr || getSampleCurriculum(),
    simulationsContext: simulationsContextStr || getSampleSimulations(),
    messageHistory: messageHistory || null,
  };
}

/**
 * Sample curriculum for evaluation scenarios
 */
function getSampleCurriculum() {
  return `### EPOL 479: Machine Spirits (479)
*Exploring AI, Philosophy, and Digital Culture*
Tags: ai, philosophy, education

Lectures:
  1. **Welcome to Machine Learning** (479-lecture-1)
      Topics: Introduction to ML concepts; Human-machine learning synthesis
  2. **Technology and Pedagogy** (479-lecture-2)
      Topics: Educational technology; Learning theories
  3. **Dialectical Learning** (479-lecture-3)
      Topics: Hegelian dialectics; Thesis-antithesis-synthesis
  4. **Algorithmic Governance** (479-lecture-4)
      Topics: AI ethics; Algorithmic decision-making
  5. **Emergence and Complexity** (479-lecture-5)
      Topics: Complex systems; Emergent properties

### EPOL 480: Digital Humanities (480)
*Technology and the Humanities*
Tags: digital-humanities, technology

Lectures:
  1. **Introduction to Digital Humanities** (480-lecture-1)
      Topics: DH foundations; Computational methods
  2. **Text Mining and Analysis** (480-lecture-2)
      Topics: NLP basics; Corpus analysis`;
}

/**
 * Sample simulations for evaluation scenarios
 */
function getSampleSimulations() {
  return `- recognition: Recognition Dynamics (concepts: recognition, self-consciousness)
- alienation: Alienation Patterns (concepts: alienation, labor)
- dialectic: Dialectical Movement (concepts: dialectic, contradiction)`;
}

/**
 * Generate suggestions with explicit configuration
 *
 * This is the main API entry point for evaluation and alternative clients.
 *
 * For evaluation, use profileName to select a pre-configured tutor profile
 * from config/tutor-agents.yaml. This allows testing different provider/model
 * combinations by defining them as profiles.
 *
 * @param {Object} context - The learner/curriculum/simulations context
 * @param {Object} config - Provider/model/hyperparameter configuration
 * @returns {Promise<Object>} Suggestions and metadata
 */
export async function generateSuggestions(context, config = {}) {
  const {
    provider = null,
    model = null,
    egoModel = null, // Override ego model for benchmarking (e.g., "openrouter.haiku")
    superegoModel = null, // Override superego model for benchmarking
    disableSuperego = false, // Explicitly disable superego even if profile has one configured
    hyperparameters = {},
    promptId = 'default',
    profileName = null,
    useDialogue = null,
    maxRounds = null,
    trace = true,
    superegoStrategy = null, // Superego intervention strategy (e.g., 'socratic_challenge')
    outputSize = 'normal', // compact, normal, expanded - affects response verbosity
    systemPromptExtension = null, // Dynamic directives prepended to ego system prompt (prompt rewriting)
    superegoPromptExtension = null, // Dynamic disposition adjustments prepended to superego system prompt
    learnerId = null, // For Writing Pad memory persistence between turns
    dialecticalNegotiation = false, // Phase 2: AI-powered dialectical struggle
    onStream = null, // Streaming callback for token-by-token progress
    conversationMode = 'single-prompt', // 'messages' for multi-turn message chains
    messageHistory = null, // External conversation chain (array of {role, content})
  } = config;

  const startTime = Date.now();

  // Determine effective profile - either explicit or from provider/model
  // If provider/model are specified without profileName, we use them to find a matching profile
  let effectiveProfileName = profileName;

  // If explicit provider/model but no profile, try to find matching profile
  // or use them directly via the dialogue engine (which falls back to active profile)
  if (!effectiveProfileName && provider && model) {
    // For evaluation purposes, explicit provider/model configs work best when
    // they're defined as profiles in tutor-agents.yaml
    console.log(`[TutorAPI] Using explicit config: ${provider}/${model}`);
  }

  // Determine dialogue settings from profile config
  const dialogueConfig = configLoader.getDialogueConfig(effectiveProfileName);
  const effectiveUseDialogue = useDialogue ?? dialogueConfig?.enabled ?? true;
  const effectiveMaxRounds = maxRounds ?? (effectiveUseDialogue ? (dialogueConfig?.max_rounds ?? 2) : 0);

  try {
    // Run the dialogue engine
    const result = await dialogueEngine.runDialogue(
      {
        learnerContext: context.learnerContext,
        curriculumContext: context.curriculumContext,
        simulationsContext: context.simulationsContext,
      },
      {
        isNewUser: context.isNewUser ?? false,
        profileName: effectiveProfileName,
        egoModel, // Override ego model for benchmarking
        superegoModel, // Override superego model for benchmarking
        disableSuperego, // Explicitly disable superego even if profile has one configured
        hyperparameters, // Override hyperparameters (e.g., max_tokens for reasoning models)
        maxRounds: effectiveMaxRounds,
        superegoStrategy, // Pass through superego intervention strategy
        outputSize, // compact, normal, expanded - affects response verbosity
        systemPromptExtension, // Dynamic directives prepended to ego system prompt
        superegoPromptExtension, // Dynamic disposition adjustments prepended to superego prompt
        learnerId, // Writing Pad memory persistence (Phase 1)
        dialecticalNegotiation, // Phase 2: AI-powered dialectical struggle
        onStream, // Streaming callback for token-by-token progress
        conversationMode, // 'messages' for multi-turn message chains
        messageHistory: messageHistory || context.messageHistory || null, // External conversation chain
        // Enable trace for transcript/expand mode to ensure complete logging
        trace: trace || dialogueEngine.isTranscriptMode() || dialogueEngine.isExpandMode(),
      }
    );

    const endTime = Date.now();

    // Get effective provider/model from result or profile
    const effectiveProvider = getEffectiveProvider(effectiveProfileName) || provider;
    const effectiveModel = getEffectiveModel(effectiveProfileName) || model;

    return {
      success: true,
      suggestions: result.suggestions || [],
      metadata: {
        provider: effectiveProvider,
        model: effectiveModel,
        hyperparameters: hyperparameters,
        promptId,
        profileName: result.profileName || effectiveProfileName || configLoader.getActiveProfile()?.name,
        latencyMs: endTime - startTime,
        inputTokens: result.metrics?.totalInputTokens || 0,
        outputTokens: result.metrics?.totalOutputTokens || 0,
        dialogueRounds: result.rounds || 0,
        converged: result.converged || false,
        apiCalls: result.metrics?.apiCalls || 0,
        totalCost: result.metrics?.totalCost || 0, // OpenRouter API cost aggregated from all dialogue rounds
        dialogueId: result.dialogueId, // For linking to logs
      },
      dialogueTrace: trace ? result.dialogueTrace : undefined,
    };
  } catch (error) {
    const endTime = Date.now();

    return {
      success: false,
      error: error.message,
      suggestions: [],
      metadata: {
        provider: getEffectiveProvider(effectiveProfileName) || provider,
        model: getEffectiveModel(effectiveProfileName) || model,
        latencyMs: endTime - startTime,
      },
    };
  }
}

/**
 * Quick generation without dialogue (single-pass)
 */
export async function quickGenerate(context, config = {}) {
  return generateSuggestions(context, {
    ...config,
    useDialogue: false,
    maxRounds: 0,
  });
}

/**
 * List available profiles from tutor config
 */
export function listProfiles() {
  return configLoader.listProfiles();
}

/**
 * Get effective provider from profile
 */
function getEffectiveProvider(profileName) {
  const profile = configLoader.getActiveProfile(profileName);
  return profile?.ego?.provider || 'anthropic';
}

/**
 * Get effective model from profile
 */
function getEffectiveModel(profileName) {
  const profile = configLoader.getActiveProfile(profileName);
  const agentConfig = configLoader.getAgentConfig('ego', profileName);
  return agentConfig?.model || 'claude-haiku-4-5';
}

export default {
  buildContext,
  generateSuggestions,
  quickGenerate,
  listProfiles,
};
