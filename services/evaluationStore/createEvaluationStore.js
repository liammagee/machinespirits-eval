import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

import { getScenario, getTutorProfile, loadRubric, resolveModel } from '../evalConfigLoader.js';
import { loadLearnerRubric } from '../learnerRubricEvaluator.js';
import { isPidAlive } from '../processUtils.js';
import { readProgressLog } from '../progressLogger.js';
import {
  loadDeliberationRubric,
  loadDialogueRubric,
  loadTutorCharismaRubric,
  loadTutorHolisticRubric,
} from '../rubricEvaluator.js';
import { openEvaluationDatabase } from './connection.js';
import { createDialogueLogRepository } from './dialogueLogRepository.js';
import { createExportRepository } from './exportRepository.js';
import { createInteractionRepository } from './interactionRepository.js';
import { migrateEvaluationDatabase } from './migrations.js';
import { createResultRepository } from './resultRepository.js';
import { createRunManifestWriter } from './runManifestWriter.js';
import { createRunRepository } from './runRepository.js';
import { createScoreRepository } from './scoreRepository.js';
import { createStatisticsRepository } from './statisticsRepository.js';

export function resolveEvaluationLogsRoot({
  rootDir,
  env = process.env,
  fileSystem = fs,
  homeDir = os.homedir(),
} = {}) {
  if (!rootDir) throw new Error('rootDir is required');
  if (env.EVAL_LOGS_DIR) return env.EVAL_LOGS_DIR;
  const dataHome = env.MS_DATA_HOME || path.join(homeDir, '.machinespirits-data');
  return fileSystem.existsSync(dataHome) ? path.join(dataHome, 'logs') : path.join(rootDir, 'logs');
}

/**
 * Assemble one evaluation store around an owned or host-supplied SQLite
 * connection. Importing this module has no filesystem or database effects.
 */
export function createEvaluationStore({
  rootDir,
  env = process.env,
  db: suppliedDatabase = null,
  logsRoot = null,
  DatabaseConstructor,
  fileSystem = fs,
  randomBytesFn = randomBytes,
  now = () => new Date(),
  isPidAliveFn = isPidAlive,
} = {}) {
  if (!rootDir) throw new Error('createEvaluationStore requires rootDir');

  const ownsDatabase = suppliedDatabase == null;
  const db =
    suppliedDatabase ||
    openEvaluationDatabase({
      rootDir,
      env,
      fileSystem,
      ...(DatabaseConstructor ? { DatabaseConstructor } : {}),
    });

  try {
    migrateEvaluationDatabase(db);
  } catch (error) {
    if (ownsDatabase && db.open !== false) db.close();
    throw error;
  }

  const resolvedLogsRoot = logsRoot || resolveEvaluationLogsRoot({ rootDir, env, fileSystem, homeDir: os.homedir() });
  let closed = false;

  function ensureOpen() {
    if (closed || db.open === false) throw new Error('evaluation store is closed');
  }

  function wrap(operation) {
    return (...args) => {
      ensureOpen();
      return operation(...args);
    };
  }

  function generateRunId() {
    const timestamp = now().toISOString().slice(0, 10);
    const suffix = randomBytesFn(4).toString('hex');
    return `eval-${timestamp}-${suffix}`;
  }

  function getTutorRubricVersion() {
    return loadRubric()?.version || loadTutorHolisticRubric()?.version || null;
  }
  function getLearnerRubricVersion() {
    return loadLearnerRubric()?.version || null;
  }
  function getDialogueRubricVersion() {
    return loadDialogueRubric()?.version || null;
  }
  function getDeliberationRubricVersion() {
    return loadDeliberationRubric()?.version || null;
  }
  function getCharismaRubricVersion() {
    return loadTutorCharismaRubric()?.version || null;
  }
  function expectedTestsForRun(run) {
    if (Number.isInteger(run?.totalTests) && run.totalTests > 0) return run.totalTests;
    const runsPerConfig = Number(run?.metadata?.runsPerConfig) || 1;
    return (run?.totalScenarios || 0) * (run?.totalConfigurations || 0) * runsPerConfig;
  }

  const resultRepository = createResultRepository({
    db,
    getTutorRubricVersion,
    getRun: (...args) => runRepository.getRun(...args),
    expectedTestsForRun,
  });
  const runManifestWriter = createRunManifestWriter({
    db,
    logsRoot: resolvedLogsRoot,
    uniqueGenerationResults: (...args) => resultRepository.uniqueGenerationResults(...args),
    expectedTestsForRun,
    fileSystem,
  });
  const runRepository = createRunRepository({
    db,
    generateRunId,
    getResults: (...args) => resultRepository.getResults(...args),
    generationIdentity: (...args) => resultRepository.generationIdentity(...args),
    uniqueGenerationResults: (...args) => resultRepository.uniqueGenerationResults(...args),
    expectedTestsForRun,
    writeRunManifest: runManifestWriter.writeRunManifest,
    isPidAlive: isPidAliveFn,
  });
  const scoreRepository = createScoreRepository({
    db,
    getTutorRubricVersion,
    getLearnerRubricVersion,
    getDialogueRubricVersion,
    getDeliberationRubricVersion,
    getCharismaRubricVersion,
  });
  const interactionRepository = createInteractionRepository({ db });
  const statisticsRepository = createStatisticsRepository({
    db,
    getResults: (...args) => resultRepository.getResults(...args),
    getRun: (...args) => runRepository.getRun(...args),
    readProgressLog,
    uniqueGenerationResults: (...args) => resultRepository.uniqueGenerationResults(...args),
    getScenario,
    getTutorProfile,
    resolveModel,
  });
  const exportRepository = createExportRepository({
    getRun: (...args) => runRepository.getRun(...args),
    getResults: (...args) => resultRepository.getResults(...args),
    getRunStats: (...args) => statisticsRepository.getRunStats(...args),
    getScenarioStats: (...args) => statisticsRepository.getScenarioStats(...args),
  });
  const dialogueLogRepository = createDialogueLogRepository({ logsRoot: resolvedLogsRoot });

  const operations = {
    ...resultRepository,
    ...runRepository,
    ...scoreRepository,
    ...interactionRepository,
    ...statisticsRepository,
    ...exportRepository,
    ...dialogueLogRepository,
  };
  const store = Object.fromEntries(
    Object.entries(operations)
      .filter(([, operation]) => typeof operation === 'function')
      .map(([name, operation]) => [name, wrap(operation)]),
  );

  Object.defineProperties(store, {
    close: {
      enumerable: false,
      value() {
        if (closed) return false;
        closed = true;
        if (ownsDatabase && db.open !== false) db.close();
        return true;
      },
    },
    database: { enumerable: false, value: db },
    isOpen: { enumerable: false, get: () => !closed && db.open !== false },
    ownsDatabase: { enumerable: false, value: ownsDatabase },
  });

  return Object.freeze(store);
}
