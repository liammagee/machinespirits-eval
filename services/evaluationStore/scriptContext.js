import fs from 'node:fs';

import { resolveEvaluationLogsRoot } from '../evaluationDataPaths.js';
import { resolveEvaluationDatabasePath } from './connection.js';
import { createDialogueLogRepository } from './dialogueLogRepository.js';
import { createEvaluationStore } from './createEvaluationStore.js';

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

/**
 * Run one standalone-script operation against an explicitly owned evaluation
 * store. Callers may inject a host-owned store for tests or composition; only
 * stores created here are closed here.
 */
export async function withEvaluationScriptStore(
  operation,
  { rootDir, env = process.env, evaluationStore = null, createStore = createEvaluationStore } = {},
) {
  if (typeof operation !== 'function') {
    throw new TypeError('withEvaluationScriptStore requires an operation function');
  }

  const ownsStore = evaluationStore == null;
  const store = evaluationStore || createStore({ rootDir, env });
  try {
    return await operation(store);
  } finally {
    if (ownsStore) store.close();
  }
}
