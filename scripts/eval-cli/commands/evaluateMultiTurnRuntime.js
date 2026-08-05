import { prepareMultiTurnEvaluation } from './evaluateMultiTurnPreparation.js';
import { runMultiTurnJudgeWave } from './evaluateMultiTurnJudgeWave.js';
import { persistMultiTurnEvaluation } from './evaluateMultiTurnPersistence.js';

export function createEvaluateMultiTurnResult(context) {
  return async function evaluateMultiTurnResult(result, tag) {
    const state = prepareMultiTurnEvaluation(result, tag, context);
    if (!state) return null;
    const wave = await runMultiTurnJudgeWave(state, context);
    return await persistMultiTurnEvaluation(state, wave, context);
  };
}
