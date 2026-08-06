import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

export function resolveEvaluationDatabasePath({ rootDir, env = process.env } = {}) {
  if (env.EVAL_DB_PATH) return env.EVAL_DB_PATH;
  if (!rootDir) throw new Error('rootDir is required when EVAL_DB_PATH is not set');
  return path.join(rootDir, 'data', 'evaluations.db');
}

export function openEvaluationDatabase({ rootDir, env = process.env, DatabaseConstructor = Database } = {}) {
  const databasePath = resolveEvaluationDatabasePath({ rootDir, env });

  // The website can mount evaluation surfaces from a shallow clone whose
  // gitignored data directory does not exist yet.
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseConstructor(databasePath);
  db.pragma('journal_mode = WAL');
  return db;
}
