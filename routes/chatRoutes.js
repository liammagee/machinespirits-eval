/**
 * Deprecated eval-cell chat API facade.
 *
 * New conversations use the versioned `/api/tutor-stub` session protocol with
 * `engine: cell_lab`. These endpoints remain only for older clients and for
 * the research controls in the shared `/tutor` shell.
 */

export { default } from '../services/legacyChatCompatibilityRouter.js';
export { loadCurriculumContext, loadPromptFile, runTutorTurn } from '../services/legacyChatEngine.js';
