/**
 * Compatibility facade for evaluation persistence.
 *
 * Importing this module is side-effect free. Legacy callers retain the same
 * named/default API and acquire the default store lazily on first operation;
 * application hosts should start and stop it explicitly through
 * evaluationStore/lifecycle.js or construct an isolated store directly.
 */

import { getDefaultEvaluationStore } from './evaluationStore/lifecycle.js';

function delegate(operation) {
  return (...args) => getDefaultEvaluationStore()[operation](...args);
}

export const autoCompleteStaleRuns = delegate('autoCompleteStaleRuns');
export const cloneRowsForRubricVersion = delegate('cloneRowsForRubricVersion');
export const compareConfigs = delegate('compareConfigs');
export const completeRun = delegate('completeRun');
export const createRun = delegate('createRun');
export const deleteRun = delegate('deleteRun');
export const exportToCsv = delegate('exportToCsv');
export const exportToJson = delegate('exportToJson');
export const findIncompleteRuns = delegate('findIncompleteRuns');
export const generationIdentity = delegate('generationIdentity');
export const getFactorialCellData = delegate('getFactorialCellData');
export const getIncompleteTests = delegate('getIncompleteTests');
export const getInteractionEval = delegate('getInteractionEval');
export const getInteractionEvalByRunId = delegate('getInteractionEvalByRunId');
export const getResultById = delegate('getResultById');
export const getResults = delegate('getResults');
export const getRun = delegate('getRun');
export const getRunStats = delegate('getRunStats');
export const getScenarioStats = delegate('getScenarioStats');
export const getScoreAudit = delegate('getScoreAudit');
export const getScoreAuditByRun = delegate('getScoreAuditByRun');
export const listInteractionEvals = delegate('listInteractionEvals');
export const listInteractionEvalsByRunId = delegate('listInteractionEvalsByRunId');
export const listRuns = delegate('listRuns');
export const loadDialogueLog = delegate('loadDialogueLog');
export const loadImmutableDialogueLog = delegate('loadImmutableDialogueLog');
export const setIdConstructionTrace = delegate('setIdConstructionTrace');
export const storeInteractionEval = delegate('storeInteractionEval');
export const storeRejudgment = delegate('storeRejudgment');
export const storeResult = delegate('storeResult');
export const updateDialogueQualityInternalScore = delegate('updateDialogueQualityInternalScore');
export const updateDialogueQualityScore = delegate('updateDialogueQualityScore');
export const updateInteractionLearnerScores = delegate('updateInteractionLearnerScores');
export const updateLearnerDeliberationScores = delegate('updateLearnerDeliberationScores');
export const updateProcessMeasures = delegate('updateProcessMeasures');
export const updateResultLearnerScores = delegate('updateResultLearnerScores');
export const updateResultScores = delegate('updateResultScores');
export const updateResultTutorCharismaScores = delegate('updateResultTutorCharismaScores');
export const updateResultTutorHolisticScores = delegate('updateResultTutorHolisticScores');
export const updateResultTutorRegisterScore = delegate('updateResultTutorRegisterScore');
export const updateResultTutorScores = delegate('updateResultTutorScores');
export const updateRun = delegate('updateRun');
export const updateTutorDeliberationScores = delegate('updateTutorDeliberationScores');
export const updateTutorLastTurnScore = delegate('updateTutorLastTurnScore');

export default {
  createRun,
  updateRun,
  storeResult,
  setIdConstructionTrace,
  storeRejudgment,
  updateResultScores,
  updateTutorLastTurnScore,
  updateDialogueQualityScore,
  updateDialogueQualityInternalScore,
  updateTutorDeliberationScores,
  updateLearnerDeliberationScores,
  updateResultLearnerScores,
  updateResultTutorHolisticScores,
  getRun,
  listRuns,
  getResults,
  getRunStats,
  getScenarioStats,
  compareConfigs,
  exportToJson,
  exportToCsv,
  deleteRun,
  completeRun,
  findIncompleteRuns,
  autoCompleteStaleRuns,
  getIncompleteTests,
  getFactorialCellData,
  storeInteractionEval,
  listInteractionEvals,
  listInteractionEvalsByRunId,
  getInteractionEval,
  getInteractionEvalByRunId,
  updateInteractionLearnerScores,
  updateProcessMeasures,
  loadDialogueLog,
  loadImmutableDialogueLog,
  getResultById,
  generationIdentity,
  cloneRowsForRubricVersion,
  getScoreAudit,
  getScoreAuditByRun,
};
