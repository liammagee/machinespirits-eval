/**
 * @machinespirits/tutor-core
 *
 * Core tutor services for Machine Spirits LMS
 * Provides the Ego/Superego dialogue engine, AI provider abstraction,
 * and configuration management.
 */

// Core Services
export * as tutorDialogueEngine from './services/tutorDialogueEngine.js';
export * as tutorApiService from './services/tutorApiService.js';
export * as tutorConfigLoader from './services/tutorConfigLoader.js';

// AI Services
export * as aiService from './services/aiService.js';
export * as aiConfigService from './services/aiConfigService.js';
export * as unifiedAIProvider from './services/unifiedAIProviderService.js';
export * as sseStreamParser from './services/sseStreamParser.js';

// Support Services
export * as monitoringService from './services/monitoringService.js';
export * as dialogueLogService from './services/dialogueLogService.js';
export * as modelResolver from './services/modelResolver.js';
export * as pricingConfig from './services/pricingConfig.js';
export * as configLoaderBase from './services/configLoaderBase.js';

// Recognition Engine
export * as writingPadService from './services/writingPadService.js';
export * as dialecticalEngine from './services/dialecticalEngine.js';
export * as memoryDynamicsService from './services/memoryDynamicsService.js';
export * as learnerIntegrationService from './services/learnerIntegrationService.js';
export * as recognitionGamificationService from './services/recognitionGamificationService.js';

// Recognition Pipeline Orchestrator
export * as recognitionOrchestrator from './services/recognitionOrchestrator.js';

// Database (for config persistence)
export * as dbService from './services/dbService.js';

// Database initialization (call before importing other services)
export { initDb, closeDb, getDb } from './services/dbService.js';

// Re-export commonly used items for convenience
export {
  runDialogue,
  quickGenerate,
  getAvailableProfiles,
  analyzeInterventionNeeds,
  setLogDir,
  setQuietMode,
  _fetchProvider,
  isContextOverflowError,
  truncateForContextOverflow,
  extractStructuredSummary
} from './services/tutorDialogueEngine.js';

export {
  generateChatReply,
  generateDirectReply,
  generateText
} from './services/aiService.js';

export {
  loadConfig,
  getActiveProfile,
  resolveModel,
  listProfiles
} from './services/tutorConfigLoader.js';

export {
  processDialogueResult,
  processWritingEvent,
  runMaintenance,
  getFullRecognitionState,
} from './services/recognitionOrchestrator.js';

export {
  getLearnerRecognitionProfile,
  computeRecognitionDepth,
  checkRecognitionMilestones,
  getMemoryLayerProgression,
  computeRecognitionFlow,
  getDialecticalContinuity,
  getMilestoneDefinitions
} from './services/recognitionGamificationService.js';

export { parseSSEStream } from './services/sseStreamParser.js';

export { callStream } from './services/unifiedAIProviderService.js';
