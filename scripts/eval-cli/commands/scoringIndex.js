import { runEvaluateCommand } from './evaluateCommand.js';
import { runBackfillFirstTurnCommand } from './backfillFirstTurnCommand.js';
import { runEvaluateLearnerCommand } from './evaluateLearnerCommand.js';
import { runEvaluateDialogueCommand } from './evaluateDialogueCommand.js';

const HANDLERS = new Map([
  ['evaluate', runEvaluateCommand],
  ['backfill-first-turn', runBackfillFirstTurnCommand],
  ['evaluate-learner', runEvaluateLearnerCommand],
  ['evaluate-dialogue', runEvaluateDialogueCommand],
]);

export const SCORING_COMMAND_NAMES = Object.freeze([...HANDLERS.keys()]);

export function getScoringCommandHandler(command) {
  return HANDLERS.get(command) || null;
}
