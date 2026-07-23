/**
 * Transitional domain entrypoint for the legacy eval-cell chat engine.
 *
 * Non-route consumers import this module instead of reaching into the Express
 * router. The implementation still lives in routes/chatRoutes.js during the
 * first convergence phase, while prompt lookup has moved to a route-free
 * service. Keeping the remaining dependency in one place lets the next slice
 * move curriculum and turn execution without changing pilot or live-compose
 * callers.
 *
 * `cell_lab` is deliberately distinct from the learner-safe `tutor_stub`
 * engine. It exposes eval-cell prompts and deliberation to research/admin
 * callers and must not be added to the public tutor catalogue by implication.
 */

export const LEGACY_CHAT_ENGINE_SCHEMA = 'machinespirits.legacy-chat-engine.v1';
export const LEGACY_CHAT_ENGINE_ID = 'cell_lab';

// Small contract matrix used to prove that extraction preserves the materially
// different legacy paths rather than testing only the easiest single-agent cell.
export const LEGACY_CHAT_REPRESENTATIVE_CELLS = Object.freeze([
  'cell_1_base_single_unified',
  'cell_7_recog_multi_unified',
  'cell_86_messages_recog_multi_unified',
  'cell_107_id_director_witness_exemplars',
]);

export { loadCurriculumContext, runTutorTurn } from '../routes/chatRoutes.js';
export { loadPromptFile } from './legacyChatPromptLoader.js';
