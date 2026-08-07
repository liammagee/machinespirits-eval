import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { resolveEvaluationDbPath } from '../evaluationDataPaths.js';

/**
 * Where this store writes. Deliberately not its own rule: it asks the same
 * resolver every analysis script reads through, so a run cannot land its rows
 * somewhere the readers never look. That is what used to happen in a git
 * worktree, where `rootDir` is the worktree and the readers stayed on the
 * shared archive. The logs root has always preferred the archive this way;
 * the database was the one path that did not.
 */
export function resolveEvaluationDatabasePath({ rootDir, env = process.env, fileSystem = fs } = {}) {
  if (!rootDir && !env.EVAL_DB_PATH) throw new Error('rootDir is required when EVAL_DB_PATH is not set');
  return resolveEvaluationDbPath(rootDir, null, { env, fileSystem });
}

export function openEvaluationDatabase({
  rootDir,
  env = process.env,
  fileSystem = fs,
  DatabaseConstructor = Database,
} = {}) {
  const databasePath = resolveEvaluationDatabasePath({ rootDir, env, fileSystem });

  // The website can mount evaluation surfaces from a shallow clone whose
  // gitignored data directory does not exist yet.
  fileSystem.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseConstructor(databasePath);
  db.pragma('journal_mode = WAL');
  return db;
}
