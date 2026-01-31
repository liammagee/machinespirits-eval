/**
 * @machinespirits/eval - Evaluation Extension
 *
 * Provides tutor evaluation, benchmarking, and analysis capabilities.
 * Can run standalone or as an extension mounted in the main website.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

// Core evaluation services
export * as evaluationRunner from './services/evaluationRunner.js';
export * as evaluationStore from './services/evaluationStore.js';
export * as rubricEvaluator from './services/rubricEvaluator.js';
export * as evalConfigLoader from './services/evalConfigLoader.js';

// Learner simulation services
export * as learnerConfigLoader from './services/learnerConfigLoader.js';
export * as learnerTutorInteractionEngine from './services/learnerTutorInteractionEngine.js';
export * as promptRecommendationService from './services/promptRecommendationService.js';

// Re-export routes for manual mounting
export { default as evalRoutes } from './routes/evalRoutes.js';

// Package metadata
export const packageInfo = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
};
