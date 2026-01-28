/**
 * @machinespirits/eval - Evaluation Extension
 *
 * Provides tutor evaluation, benchmarking, and analysis capabilities.
 * Can run standalone or as an extension mounted in the main website.
 */

// Core evaluation services
export * as evaluationRunner from './services/evaluationRunner.js';
export * as evaluationStore from './services/evaluationStore.js';
export * as rubricEvaluator from './services/rubricEvaluator.js';
export * as benchmarkService from './services/benchmarkService.js';

// Learner simulation services
export * as learnerConfigLoader from './services/learnerConfigLoader.js';
export * as learnerTutorInteractionEngine from './services/learnerTutorInteractionEngine.js';
export * as promptRecommendationService from './services/promptRecommendationService.js';

// Re-export routes for manual mounting
export { default as evalRoutes } from './routes/evalRoutes.js';

// Package metadata
export const packageInfo = {
  name: '@machinespirits/eval',
  version: '0.1.0',
  description: 'Evaluation system for Machine Spirits tutor',
};
