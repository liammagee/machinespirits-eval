import { factKey } from './dramaticDerivation/chainer.js';
import { createTutorStubDagFactDropoutState } from './tutorStubDagFactDropout.js';

export function createTutorStubLearnerDagState({ enabled, modelRef = null, resolved, world, dropout = null }) {
  const board = new Map();
  if (world) {
    for (const fact of world.background || []) board.set(factKey(fact), fact);
  }
  return {
    enabled,
    modelRef,
    resolved,
    dropout: createTutorStubDagFactDropoutState(dropout || {}),
    record: {
      board,
      voiced: [],
      voicedKeys: new Set(),
      hypotheses: [],
      snapshots: [],
    },
  };
}
