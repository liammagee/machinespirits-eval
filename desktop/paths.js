// desktop/paths.js
//
// Resolve the desktop app's writable locations and the env the embedded server
// child runs with. Kept free of any `electron` import (the caller passes
// electron's `app`) so it stays trivial to reason about and unit-test.
//
// Every writable store the stack opens is relocated into app.getPath('userData')
// via the env override the code already honours, so a packaged app never writes
// into its own (read-only, asar) bundle:
//   EVAL_DB_PATH         eval + pilot + poetics SQLite (services/evaluationStore)
//   EVAL_LOGS_DIR        dialogue + progress logs
//   EVAL_EXPORTS_DIR     job logs + generated artifacts (services/poetics/jobRunner)
//   AUTH_DB_PATH         tutor-core's own SQLite (tutor-core/services/dbService)
//   EVAL_WRITING_PAD_DIR learner/tutor writing-pad DBs (services/memory/*)
//   TUTOR_CORE_LOG_DIR   tutor-core dialogue/api logs (tutor-core dialogue engine)
//   GREENROOM_DIR        tutor profiles + prompt books + ledgers (services/greenroom/store)
//   TUTOR_STUB_TUNING_DIR versioned tutor tuning evidence + candidates + replay plans
//   TUTOR_STUB_TRACE_DIR  tutor-stub session traces and learning artifacts
// MS_APP_ROOT carries the resource root for packaged-mode resolution.
//
// NOTE for future maintainers: if you add a NEW writable store, give it an env
// override and relocate it here, or the packaged desktop app will try to write
// inside the asar and fail. tests/desktopPaths.test.js guards the env set.

import path from 'node:path';
import fs from 'node:fs';

export function resolvePaths(electronApp, repoRoot) {
  const userData = electronApp.getPath('userData');
  const dataDir = path.join(userData, 'data');

  const dbPath = process.env.EVAL_DB_PATH || path.join(dataDir, 'evaluations.db');
  const logsDir = process.env.EVAL_LOGS_DIR || path.join(userData, 'logs');
  const exportsDir = process.env.EVAL_EXPORTS_DIR || path.join(userData, 'exports');
  const authDbPath = process.env.AUTH_DB_PATH || path.join(dataDir, 'lms.sqlite');
  const writingPadDir = process.env.EVAL_WRITING_PAD_DIR || path.join(dataDir, 'writing-pads');
  const tutorCoreLogDir = process.env.TUTOR_CORE_LOG_DIR || path.join(logsDir, 'tutor-core');
  const greenroomDir = process.env.GREENROOM_DIR || path.join(dataDir, 'greenroom');
  const tutorStubTuningDir = process.env.TUTOR_STUB_TUNING_DIR || path.join(dataDir, 'tutor-stub-tuning');
  const tutorStubTraceDir = process.env.TUTOR_STUB_TRACE_DIR || path.join(logsDir, 'tutor-stub');

  for (const d of [
    path.dirname(dbPath),
    logsDir,
    exportsDir,
    path.dirname(authDbPath),
    writingPadDir,
    tutorCoreLogDir,
    greenroomDir,
    tutorStubTuningDir,
    tutorStubTraceDir,
  ]) {
    fs.mkdirSync(d, { recursive: true });
  }

  return {
    userData,
    appRoot: repoRoot,
    dbPath,
    logsDir,
    exportsDir,
    authDbPath,
    writingPadDir,
    tutorCoreLogDir,
    greenroomDir,
    tutorStubTuningDir,
    tutorStubTraceDir,
  };
}

/** Build the env object for the forked server child from resolved paths. */
export function serverEnv(paths) {
  return {
    ...process.env,
    EVAL_DB_PATH: paths.dbPath,
    EVAL_LOGS_DIR: paths.logsDir,
    EVAL_EXPORTS_DIR: paths.exportsDir,
    AUTH_DB_PATH: paths.authDbPath,
    EVAL_WRITING_PAD_DIR: paths.writingPadDir,
    TUTOR_CORE_LOG_DIR: paths.tutorCoreLogDir,
    GREENROOM_DIR: paths.greenroomDir,
    TUTOR_STUB_TUNING_DIR: paths.tutorStubTuningDir,
    TUTOR_STUB_TRACE_DIR: paths.tutorStubTraceDir,
    MS_APP_ROOT: paths.appRoot,
  };
}
