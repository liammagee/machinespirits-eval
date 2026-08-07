import fs from 'node:fs';

import { resolveEvaluationLogsRoot } from '../evaluationDataPaths.js';
import { resolveEvaluationDatabasePath } from './connection.js';
import { createDialogueLogRepository } from './dialogueLogRepository.js';

/**
 * Resolve the read-side dependencies shared by standalone evaluation scripts
 * without opening a database or falling back to the legacy store facade.
 * Scripts retain ownership of their own SQLite connection and receive an
 * isolated dialogue-log repository for the selected data root.
 */
export function createEvaluationScriptContext({ rootDir, env = process.env, fileSystem = fs } = {}) {
  if (!rootDir) throw new Error('createEvaluationScriptContext requires rootDir');

  const databasePath = resolveEvaluationDatabasePath({ rootDir, env, fileSystem });
  const logsRoot = resolveEvaluationLogsRoot(rootDir, null, { env, fileSystem });
  const dialogueLogs = createDialogueLogRepository({ logsRoot, fileSystem });

  return Object.freeze({ databasePath, logsRoot, dialogueLogs });
}
