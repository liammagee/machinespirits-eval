/**
 * Read-only access to the evaluation DB for analysis/report scripts.
 *
 * Resolves the DB location through the same EVAL_DB_PATH-aware logic the rest
 * of the stack uses (resolveEvaluationDbPath), then opens it readonly without
 * ever creating the file. A missing file, an empty/zero-byte file (e.g. what a
 * sqlite MCP server leaves behind in a fresh worktree), or any DB lacking the
 * required table all resolve to { db: null } so callers can take their
 * "no data" path instead of crashing mid-query.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { resolveEvaluationDbPath } from './evaluationDataPaths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const EVAL_REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Open the evaluation DB readonly, or explain why it cannot be analyzed.
 *
 * @param {string} rootDir repo root used to resolve relative paths
 * @param {{ requiredTable?: string|null }} [options] table that must exist
 *   for the DB to count as analyzable (null skips the schema check)
 * @returns {{ db: import('better-sqlite3').Database|null, dbPath: string, reason: string|null }}
 */
export function openEvaluationDbReadonly(rootDir = EVAL_REPO_ROOT, { requiredTable = 'evaluation_results' } = {}) {
  const dbPath = resolveEvaluationDbPath(rootDir);
  if (!fs.existsSync(dbPath)) return { db: null, dbPath, reason: 'database not found' };

  let db = null;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    if (requiredTable) {
      const table = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(requiredTable);
      if (!table) {
        db.close();
        return { db: null, dbPath, reason: `no ${requiredTable} table` };
      }
    }
  } catch (err) {
    if (db) db.close();
    return { db: null, dbPath, reason: err.message };
  }

  return { db, dbPath, reason: null };
}

/** Uniform no-data message for analysis scripts (they print it and exit 0). */
export function describeMissingEvaluationDb(dbPath, reason) {
  return `No evaluation data available at ${dbPath} (${reason}); nothing to analyze.`;
}
