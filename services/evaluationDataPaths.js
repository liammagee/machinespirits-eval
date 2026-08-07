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

function isEvaluationRepoRoot(rootDir) {
  return fs.existsSync(path.join(rootDir, 'package.json')) && fs.existsSync(path.join(rootDir, 'services'));
}

export function resolveEvaluationLogsRoot(rootDir, explicitPath = null) {
  const explicit = explicitPath || process.env.EVAL_LOGS_DIR;
  if (explicit) return resolvePathFromRoot(rootDir, explicit);

  const rootLogs = path.join(rootDir, 'logs');
  if (!isEvaluationRepoRoot(rootDir) && fs.existsSync(rootLogs)) return rootLogs;

  const dataHome = resolveEvaluationDataHome();
  if (fs.existsSync(dataHome)) return path.join(dataHome, 'logs');

  return rootLogs;
}

export function resolveTutorDialoguesDir(rootDir, explicitPath = null) {
  const logsRoot = resolveEvaluationLogsRoot(rootDir, explicitPath);
  return path.basename(logsRoot) === 'tutor-dialogues' ? logsRoot : path.join(logsRoot, 'tutor-dialogues');
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
