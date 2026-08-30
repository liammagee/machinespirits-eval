/**
 * Where the evaluation data lives. One rule, used by readers and by the store's
 * writer alike (services/evaluationStore/connection.js delegates here).
 *
 * It has to be one rule. When the writer had its own — always
 * `<rootDir>/data/evaluations.db` — a run launched from a git worktree wrote
 * there while every analysis script kept reading the shared archive. Nothing
 * errored: the run finished, the report said it found no rows, and the paid
 * rows sat in a file nobody opened.
 *
 * `env` and `fileSystem` are injectable so both sides can be tested against a
 * fake data home without touching the real one.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

export function resolvePathFromRoot(rootDir, value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

export function resolveEvaluationDataHome(env = process.env) {
  return env.MS_DATA_HOME || path.join(os.homedir(), '.machinespirits-data');
}

export function resolveCanonicalEvaluationDbPath(env = process.env) {
  return path.join(resolveEvaluationDataHome(env), 'evaluations.db');
}

export function resolveCanonicalEvaluationLogsRoot(env = process.env) {
  return path.join(resolveEvaluationDataHome(env), 'logs');
}

/**
 * Where generated reports and other disposable/exportable artifacts go.
 *
 * Unlike DB and log data, exports stay checkout-local by default. An explicit
 * path or EVAL_EXPORTS_DIR relocates the whole tree, with relative overrides
 * resolved against the repository root rather than the caller's cwd.
 */
export function resolveEvaluationExportsRoot(rootDir, explicitPath = null, { env = process.env } = {}) {
  if (!rootDir) throw new Error('rootDir is required');
  return resolvePathFromRoot(rootDir, explicitPath || env.EVAL_EXPORTS_DIR) || path.join(rootDir, 'exports');
}

export function resolveEvaluationDbPath(rootDir, explicitPath = null, { env = process.env, fileSystem = fs } = {}) {
  const explicit = explicitPath || env.EVAL_DB_PATH;
  if (explicit) return resolvePathFromRoot(rootDir, explicit);

  // The canonical data-home DB wins over an ordinary worktree-local file.
  // Isolated experiment DBs remain supported, but must be selected explicitly
  // through EVAL_DB_PATH. This prevents a stale ignored file from silently
  // shadowing the shared research database in a sibling worktree.
  const dataHomeDb = resolveCanonicalEvaluationDbPath(env);
  if (fileSystem.existsSync(dataHomeDb)) return dataHomeDb;

  const repoDb = path.join(rootDir, 'data', 'evaluations.db');
  return repoDb;
}

function isEvaluationRepoRoot(rootDir, fileSystem = fs) {
  return (
    fileSystem.existsSync(path.join(rootDir, 'package.json')) && fileSystem.existsSync(path.join(rootDir, 'services'))
  );
}

/**
 * Every logs root this checkout could mean, best first.
 *
 * Writers take the first one. Some readers want the whole list, because a log
 * written under an older rule may still be sitting in a root that is no longer
 * preferred — the register scorer searches all of them. Both used to spell the
 * order out separately, which is how a rule ends up with two versions of
 * itself, so the order lives here once and `resolveEvaluationLogsRoot` is its
 * first element.
 */
export function resolveEvaluationLogsRootCandidates(
  rootDir,
  explicitPath = null,
  { env = process.env, fileSystem = fs } = {},
) {
  if (!rootDir) throw new Error('rootDir is required');
  const candidates = [];

  const explicit = explicitPath || env.EVAL_LOGS_DIR;
  if (explicit) candidates.push(resolvePathFromRoot(rootDir, explicit));

  // A run handed over as a folder — logs, no checkout — reads from its own logs
  // directory rather than the archive it was never part of.
  const rootLogs = path.join(rootDir, 'logs');
  if (!isEvaluationRepoRoot(rootDir, fileSystem) && fileSystem.existsSync(rootLogs)) candidates.push(rootLogs);

  const dataHome = resolveEvaluationDataHome(env);
  if (fileSystem.existsSync(dataHome)) candidates.push(path.join(dataHome, 'logs'));

  candidates.push(rootLogs);
  return [...new Set(candidates)];
}

/**
 * Where the dialogue logs and their sibling artifacts go. Same shape as
 * `resolveEvaluationDbPath` above, and for the same reason: one rule per kind of
 * path, held in one place. The store used to keep its own copy of this, which
 * left a relative `EVAL_LOGS_DIR` meaning `<rootDir>/x` to a reader and `x`
 * relative to the working directory to a writer.
 */
export function resolveEvaluationLogsRoot(rootDir, explicitPath = null, options = {}) {
  return resolveEvaluationLogsRootCandidates(rootDir, explicitPath, options)[0];
}

function asDialoguesDir(logsRoot) {
  return path.basename(logsRoot) === 'tutor-dialogues' ? logsRoot : path.join(logsRoot, 'tutor-dialogues');
}

export function resolveTutorDialoguesDir(rootDir, explicitPath = null, options = {}) {
  return asDialoguesDir(resolveEvaluationLogsRoot(rootDir, explicitPath, options));
}

/**
 * Every dialogue-trace directory this checkout could mean, best first.
 *
 * Readers that search rather than resolve want this: traces from an older run
 * may sit under a root that is no longer preferred. Four scripts each wrote out
 * their own version of this list, and no two agreed — which is the whole reason
 * the order lives in one place now. A script with a genuinely extra root (a
 * sibling private checkout, a second pinned runtime) appends it to this list
 * instead of restating the shared part.
 */
export function resolveTutorDialoguesDirCandidates(rootDir, explicitPath = null, options = {}) {
  return resolveEvaluationLogsRootCandidates(rootDir, explicitPath, options).map(asDialoguesDir);
}

export function resolveEvaluationSecondaryArtifactDir(rootDir, name, explicitPath = null) {
  const logsRoot = resolveEvaluationLogsRoot(rootDir, explicitPath);
  const artifactRoot = path.basename(logsRoot) === 'tutor-dialogues' ? path.dirname(logsRoot) : logsRoot;
  return path.join(artifactRoot, name);
}

export function resolveConfiguredEvaluationDbPath(rootDir, configuredPath = null, options = {}) {
  const { env = process.env } = options;
  if (!configuredPath || configuredPath === 'data/evaluations.db') {
    return resolveEvaluationDbPath(rootDir, null, options);
  }
  if (env.EVAL_DB_PATH) return resolveEvaluationDbPath(rootDir, null, options);
  return resolvePathFromRoot(rootDir, configuredPath);
}

export function resolveConfiguredTutorDialoguesDir(rootDir, configuredPath = null) {
  if (!configuredPath || configuredPath === 'logs/tutor-dialogues') {
    return resolveTutorDialoguesDir(rootDir);
  }
  if (process.env.EVAL_LOGS_DIR) return resolveTutorDialoguesDir(rootDir);
  return resolvePathFromRoot(rootDir, configuredPath);
}
