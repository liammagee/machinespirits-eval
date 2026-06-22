// desktop/paths.js
//
// Resolve the desktop app's writable + resource locations, and the env the
// embedded server child runs with. Kept free of any `electron` import (the
// caller passes electron's `app`) so it stays trivial to reason about and unit-
// test, and so importing it never drags in the Electron runtime.
//
// Writable data is relocated into app.getPath('userData') via the SAME env
// seams the codebase already honours — EVAL_DB_PATH / EVAL_LOGS_DIR (and the
// Phase-1 addition EVAL_EXPORTS_DIR) — so a packaged app never writes into its
// own (read-only) bundle or into the repo.

import path from 'node:path';
import fs from 'node:fs';

/**
 * @param {{ getPath: (name: string) => string }} electronApp  electron's app
 * @param {string} repoRoot  the resource root (repo root in dev)
 */
export function resolvePaths(electronApp, repoRoot) {
  const userData = electronApp.getPath('userData');
  const dataDir = path.join(userData, 'data');
  const logsDir = path.join(userData, 'logs');
  const exportsDir = path.join(userData, 'exports');
  for (const d of [dataDir, logsDir, exportsDir]) fs.mkdirSync(d, { recursive: true });
  return {
    userData,
    appRoot: repoRoot,
    // An explicit env override always wins (dev convenience + test isolation),
    // otherwise default into userData.
    dbPath: process.env.EVAL_DB_PATH || path.join(dataDir, 'evaluations.db'),
    logsDir: process.env.EVAL_LOGS_DIR || logsDir,
    exportsDir: process.env.EVAL_EXPORTS_DIR || exportsDir,
  };
}

/** Build the env object for the forked server child from resolved paths. */
export function serverEnv(paths) {
  return {
    ...process.env,
    EVAL_DB_PATH: paths.dbPath,
    EVAL_LOGS_DIR: paths.logsDir,
    EVAL_EXPORTS_DIR: paths.exportsDir,
    MS_APP_ROOT: paths.appRoot,
  };
}
