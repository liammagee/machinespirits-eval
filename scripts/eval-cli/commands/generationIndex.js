import { runChatCommand } from './chatCommand.js';
import { runQuickCommand } from './quickCommand.js';
import { runRejudgeCommand } from './rejudgeCommand.js';
import { runEvaluationCommand } from './runCommand.js';

const GENERATION_COMMANDS = {
  quick: runQuickCommand,
  test: runQuickCommand,
  run: runEvaluationCommand,
  chat: runChatCommand,
  rejudge: runRejudgeCommand,
};

export function getGenerationCommandHandler(command) {
  return GENERATION_COMMANDS[command] || null;
}

export const GENERATION_COMMAND_NAMES = Object.freeze(Object.keys(GENERATION_COMMANDS));
