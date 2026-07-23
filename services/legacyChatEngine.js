/**
 * Transitional domain entrypoint for the legacy eval-cell chat engine.
 *
 * Non-route consumers import this module instead of reaching into the Express
 * router. Curriculum discovery, prompt lookup, and tutor-turn orchestration now
 * live in route-free services; the Express route imports the same functions and
 * keeps compatibility re-exports for older callers.
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

export { loadCurriculumContext } from './legacyChatCurriculum.js';
export { loadPromptFile } from './legacyChatPromptLoader.js';
export { runTutorTurn } from './legacyChatTutorEngine.js';
