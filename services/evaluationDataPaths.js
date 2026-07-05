import fs from 'fs';
import os from 'os';
import path from 'path';

export function resolvePathFromRoot(rootDir, value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

export function resolveEvaluationDataHome() {
  return process.env.MS_DATA_HOME || path.join(os.homedir(), '.machinespirits-data');
}

export function resolveEvaluationDbPath(rootDir, explicitPath = null) {
  const explicit = explicitPath || process.env.EVAL_DB_PATH;
  if (explicit) return resolvePathFromRoot(rootDir, explicit);

  const repoDb = path.join(rootDir, 'data', 'evaluations.db');
  if (fs.existsSync(repoDb)) return repoDb;

  const dataHomeDb = path.join(resolveEvaluationDataHome(), 'evaluations.db');
  if (fs.existsSync(dataHomeDb)) return dataHomeDb;

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

export function resolveConfiguredEvaluationDbPath(rootDir, configuredPath = null) {
  if (!configuredPath || configuredPath === 'data/evaluations.db') {
    return resolveEvaluationDbPath(rootDir);
  }
  if (process.env.EVAL_DB_PATH) return resolveEvaluationDbPath(rootDir);
  return resolvePathFromRoot(rootDir, configuredPath);
}

export function resolveConfiguredTutorDialoguesDir(rootDir, configuredPath = null) {
  if (!configuredPath || configuredPath === 'logs/tutor-dialogues') {
    return resolveTutorDialoguesDir(rootDir);
  }
  if (process.env.EVAL_LOGS_DIR) return resolveTutorDialoguesDir(rootDir);
  return resolvePathFromRoot(rootDir, configuredPath);
}
