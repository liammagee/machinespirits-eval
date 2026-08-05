import { runListCommand } from './listCommand.js';
import { runRunsCommand } from './runsCommand.js';
import { runReportCommand } from './reportCommand.js';
import { runStatusCommand } from './statusCommand.js';
import { runWatchCommand } from './watchCommand.js';
import { runTranscriptCommand } from './transcriptCommand.js';
import { runCleanupCommand } from './cleanupCommand.js';
import { runDeleteRunsCommand } from './deleteRunsCommand.js';
import { runResumeCommand } from './resumeCommand.js';
import { runRevertCommand } from './revertCommand.js';
import { runExportCommand } from './exportCommand.js';
import { runValidateConfigCommand } from './validateConfigCommand.js';
import { runPlayCommandHandler } from './playCommand.js';

const OPERATIONAL_COMMANDS = {
  list: runListCommand,
  runs: runRunsCommand,
  report: runReportCommand,
  status: runStatusCommand,
  watch: runWatchCommand,
  transcript: runTranscriptCommand,
  cleanup: runCleanupCommand,
  'delete-runs': runDeleteRunsCommand,
  resume: runResumeCommand,
  revert: runRevertCommand,
  export: runExportCommand,
  'validate-config': runValidateConfigCommand,
  play: runPlayCommandHandler,
};

export function getOperationalCommandHandler(command) {
  return OPERATIONAL_COMMANDS[command] || null;
}

export const OPERATIONAL_COMMAND_NAMES = Object.freeze(Object.keys(OPERATIONAL_COMMANDS));
