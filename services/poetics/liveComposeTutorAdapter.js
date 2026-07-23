import { loadCurriculumContext, runTutorTurn } from '../legacyChatEngine.js';

export const LIVE_COMPOSE_TUTOR_ADAPTER_SCHEMA = 'machinespirits.poetics.live-compose-tutor-adapter.v1';
export const LIVE_COMPOSE_TUTOR_ADAPTER_VERSION = 1;

/**
 * Explicit boundary between the poetics sit-in instrument and the legacy
 * eval-cell tutor engine. The sit-in owns human/AI seat orchestration; this
 * adapter owns only curriculum binding and one tutor turn.
 */
export function createLiveComposeTutorAdapter({
  loadCurriculum = loadCurriculumContext,
  executeTutorTurn = runTutorTurn,
} = {}) {
  return Object.freeze({
    schema: LIVE_COMPOSE_TUTOR_ADAPTER_SCHEMA,
    version: LIVE_COMPOSE_TUTOR_ADAPTER_VERSION,
    loadCurriculum(reference) {
      return loadCurriculum(reference);
    },
    runTurn(specification) {
      return executeTutorTurn(specification);
    },
  });
}

export const liveComposeTutorAdapter = createLiveComposeTutorAdapter();

export const loadLiveComposeCurriculum = (reference) => liveComposeTutorAdapter.loadCurriculum(reference);
export const runLiveComposeTutorTurn = (specification) => liveComposeTutorAdapter.runTurn(specification);

export default liveComposeTutorAdapter;
