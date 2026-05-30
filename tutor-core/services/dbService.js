import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let configuredPath = null;
let db = null;
let migrationsRun = false;

/**
 * Configure the database path before first use.
 *
 * Must be called before getDb() is first invoked. If not called,
 * getDb() falls back to AUTH_DB_PATH env var or ./data/lms.sqlite.
 *
 * @param {object} options
 * @param {string} options.dbPath - Absolute path to the SQLite database file
 * @throws {Error} If database is already initialized
 */
export function initDb(options = {}) {
  if (db) {
    throw new Error('Database already initialized. Call initDb() before first getDb().');
  }
  configuredPath = options.dbPath || null;
}

/**
 * Get the shared database instance.
 *
 * On first call, creates the database connection and runs all migrations.
 * Subsequent calls return the same instance.
 *
 * @returns {Database} better-sqlite3 database instance
 */
export const getDb = () => {
  if (!db) {
    const resolvedPath = configuredPath
      || process.env.AUTH_DB_PATH
      || path.join(ROOT_DIR, 'data', 'lms.sqlite');
    mkdirSync(path.dirname(resolvedPath), { recursive: true });
    db = new Database(resolvedPath);
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  }
  return db;
};

/**
 * Run writing pad schema migrations (idempotent).
 * Uses CREATE TABLE IF NOT EXISTS so safe to call multiple times.
 *
 * @param {Database} database - The database to run migrations on
 */
function runMigrations(database) {
  if (migrationsRun) return;

  const migrationPath = path.join(ROOT_DIR, 'migrations', '008_writing_pad_schema.sql');
  try {
    const migration = readFileSync(migrationPath, 'utf-8');
    database.exec(migration);
    migrationsRun = true;
  } catch (error) {
    // Migration file might not exist in test environments — that's fine
    // if the schema was created another way (e.g., in-memory test DBs)
    if (error.code !== 'ENOENT') {
      console.error('[dbService] Failed to run migrations:', error.message);
    }
    migrationsRun = true;
  }
}

/**
 * Close the database connection and reset state.
 * Primarily for testing — allows re-initialization.
 */
export function closeDb() {
  if (db) {
    try { db.close(); } catch { /* already closed */ }
    db = null;
  }
  configuredPath = null;
  migrationsRun = false;
}

/**
 * Replace the internal database instance (for testing).
 * This bypasses initDb() and allows injecting an in-memory DB.
 *
 * @param {Database} database - The database instance to use
 */
export function _setDbForTesting(database) {
  db = database;
  migrationsRun = true; // Assume test DB has schema already
}

export default { getDb, initDb, closeDb, _setDbForTesting };
