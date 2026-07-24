/**
 * Dependency-free state shared by tutor-core logging surfaces.
 *
 * Keeping quiet-mode state outside the dialogue orchestrator lets support
 * services suppress incidental logs without importing the orchestration graph.
 */

let quietMode = false;

/**
 * Enable or disable verbose tutor-core console output.
 * Intended for evaluation and CLI surfaces that render their own progress.
 * @param {boolean} enabled
 */
export function setQuietMode(enabled) {
  quietMode = Boolean(enabled);
}

/**
 * Whether verbose output should be suppressed for quiet or transcript mode.
 * @returns {boolean}
 */
export function isQuietOrTranscript() {
  return quietMode || process.env.TUTOR_TRANSCRIPT === 'true';
}
