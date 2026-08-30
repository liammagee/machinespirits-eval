import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, it } from 'node:test';

import Database from 'better-sqlite3';
import yaml from 'yaml';

import { createAdaptiveEvaluationRunner } from '../services/adaptiveTutor/index.js';
import { createAdaptivePersistence } from '../services/adaptiveTutor/persistence.js';
import { resetRealLLMTestDependencies, setRealLLMTestDependencies } from '../services/adaptiveTutor/realLLM.js';
import { createEvaluationStore } from '../services/evaluationStore/createEvaluationStore.js';
import { hasDefaultEvaluationStore } from '../services/evaluationStore/lifecycle.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDirs = [];

after(() => {
  for (const tempDir of tempDirs) fs.rmSync(tempDir, { recursive: true, force: true });
});

function createTempEnvironment(prefix) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(tempDir);
  return {
    tempDir,
    databasePath: path.join(tempDir, 'data', 'evaluations.db'),
    logsPath: path.join(tempDir, 'logs'),
  };
}

function withProcessEnvironment(values, operation) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  return Promise.resolve()
    .then(operation)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

describe('adaptive tutor evaluation-store dependency injection', () => {
  it('binds run creation, trace persistence, result writes, and finalization to one supplied store', async () => {
    const { tempDir, databasePath, logsPath } = createTempEnvironment('adaptive-store-injection-');
    const scenarioPath = path.join(tempDir, 'scenarios.yaml');
    fs.writeFileSync(
      scenarioPath,
      yaml.stringify({
        scenarios: [
          {
            id: 'injected_adaptive_scenario',
            opening: 'I keep adding both numerators and denominators.',
            max_turns: 2,
            hidden: {
              actual_misconception: 'adds numerators and denominators',
              actual_sophistication: 'intermediate',
              trigger_turn: 1,
              trigger_signal: 'That still seems wrong.',
            },
          },
        ],
      }),
    );

    await withProcessEnvironment(
      {
        EVAL_DB_PATH: databasePath,
        EVAL_LOGS_DIR: logsPath,
        MS_DATA_HOME: path.join(tempDir, 'data-home'),
        ADAPTIVE_TUTOR_LLM: 'mock',
      },
      async () => {
        const evaluationStore = createEvaluationStore({ rootDir: ROOT_DIR });
        const { runAdaptiveEvaluation } = createAdaptiveEvaluationRunner({ evaluationStore });
        try {
          assert.equal(hasDefaultEvaluationStore(), false);
          const result = await runAdaptiveEvaluation({
            profileName: 'cell_test_injected_adaptive',
            evalProfile: {
              runner: 'adaptive',
              scenario_source: scenarioPath,
              adaptive: { architecture: 'state_policy', counterfactual: { enabled: false } },
            },
            dryRun: true,
          });

          assert.equal(result.persisted.length, 1);
          assert.equal(evaluationStore.getRun(result.runId).status, 'completed');
          assert.equal(evaluationStore.getResults(result.runId).length, 1);
          assert.equal(hasDefaultEvaluationStore(), false);
        } finally {
          evaluationStore.close();
        }
      },
    );
  });

  it('binds the persistence adapter to the supplied store and fails closed without one', () => {
    const calls = [];
    const evaluationStore = {
      createRun(input) {
        calls.push(input);
        return { id: 'adaptive-injected-run', ...input };
      },
    };
    const persistence = createAdaptivePersistence({ evaluationStore });
    const run = persistence.createAdaptiveRun({
      description: 'injected adaptive run',
      totalScenarios: 2,
      profileName: 'cell_test',
      llmMode: 'mock',
    });

    assert.equal(run.id, 'adaptive-injected-run');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].metadata.profileName, 'cell_test');
    assert.throws(() => createAdaptivePersistence(), /evaluationStore dependency is required/u);
    assert.throws(() => createAdaptiveEvaluationRunner(), /evaluationStore dependency is required/u);
  });

  it('finalizes the created run when durable budget-ledger initialization fails', async () => {
    const { tempDir, databasePath, logsPath } = createTempEnvironment('adaptive-budget-init-failure-');
    const scenarioPath = path.join(tempDir, 'scenarios.yaml');
    fs.writeFileSync(
      scenarioPath,
      yaml.stringify({
        scenarios: [
          {
            id: 'budget_init_never_dispatches',
            opening: 'This scenario must not reach a provider.',
            max_turns: 1,
          },
        ],
      }),
    );

    await withProcessEnvironment(
      {
        EVAL_DB_PATH: databasePath,
        EVAL_LOGS_DIR: logsPath,
        MS_DATA_HOME: path.join(tempDir, 'data-home'),
        ADAPTIVE_TUTOR_LLM: 'real',
      },
      async () => {
        const baseStore = createEvaluationStore({ rootDir: ROOT_DIR });
        const injectedError = Object.assign(new Error('injected durable ledger failure'), {
          code: 'BUDGET_LEDGER_PERSISTENCE',
        });
        const evaluationStore = {
          ...baseStore,
          initializeBudgetLedger() {
            throw injectedError;
          },
        };
        const { runAdaptiveEvaluation } = createAdaptiveEvaluationRunner({ evaluationStore });
        try {
          await assert.rejects(
            runAdaptiveEvaluation({
              profileName: 'cell_test_budget_init_failure',
              evalProfile: {
                runner: 'adaptive',
                scenario_source: scenarioPath,
                adaptive: { architecture: 'state_policy', counterfactual: { enabled: false } },
              },
              maxCostUsd: 1,
            }),
            (error) => error === injectedError,
          );

          const [run] = baseStore.listRuns();
          assert.equal(run.status, 'halted_budget_ledger');
          assert.equal(run.totalTests, 0);
          assert.ok(run.completedAt);
        } finally {
          baseStore.close();
        }
      },
    );
  });

  it('halts the whole adaptive run when reservation persistence fails before dispatch', async () => {
    const { tempDir, databasePath, logsPath } = createTempEnvironment('adaptive-budget-reserve-failure-');
    const scenarioPath = path.join(tempDir, 'scenarios.yaml');
    fs.writeFileSync(
      scenarioPath,
      yaml.stringify({
        scenarios: [
          { id: 'first_never_dispatches', opening: 'First offline scenario.', max_turns: 1 },
          { id: 'second_never_starts', opening: 'Second offline scenario.', max_turns: 1 },
        ],
      }),
    );

    await withProcessEnvironment(
      {
        EVAL_DB_PATH: databasePath,
        EVAL_LOGS_DIR: logsPath,
        MS_DATA_HOME: path.join(tempDir, 'data-home'),
        ADAPTIVE_TUTOR_LLM: 'real',
        OPENROUTER_API_KEY: 'offline-test-key',
      },
      async () => {
        const baseStore = createEvaluationStore({ rootDir: ROOT_DIR });
        const reserveError = Object.assign(new Error('injected reservation write failure'), {
          code: 'BUDGET_LEDGER_PERSISTENCE',
        });
        const evaluationStore = {
          ...baseStore,
          reserveBudgetAttempt() {
            throw reserveError;
          },
        };
        let dispatches = 0;
        setRealLLMTestDependencies({
          unifiedCall: async () => {
            dispatches += 1;
            throw new Error('offline transport must not be reached');
          },
          sleep: async () => {},
          random: () => 0,
        });
        const { runAdaptiveEvaluation } = createAdaptiveEvaluationRunner({ evaluationStore });
        try {
          const result = await runAdaptiveEvaluation({
            profileName: 'cell_test_budget_reserve_failure',
            evalProfile: {
              runner: 'adaptive',
              scenario_source: scenarioPath,
              adaptive: {
                architecture: 'state_policy',
                provider: 'openrouter',
                model: 'sonnet',
                counterfactual: { enabled: false },
              },
            },
            maxCostUsd: 1,
          });

          assert.equal(dispatches, 0);
          assert.equal(result.halted, true);
          assert.equal(result.haltCode, 'BUDGET_LEDGER_PERSISTENCE');
          assert.equal(result.persisted.length, 0);
          assert.equal(baseStore.getRun(result.runId).status, 'halted_budget_ledger');
        } finally {
          resetRealLLMTestDependencies();
          baseStore.close();
        }
      },
    );
  });

  it('routes an adaptive eval-CLI dry run through the CLI-owned store and closes cleanly', () => {
    const { tempDir, databasePath, logsPath } = createTempEnvironment('adaptive-cli-injection-');
    const output = execFileSync(
      process.execPath,
      [
        'scripts/eval-cli.js',
        'run',
        '--profile',
        'cell_110_langgraph_adaptive',
        '--scenario',
        'false_confusion_v1',
        '--runs',
        '1',
        '--dry-run',
      ],
      {
        cwd: ROOT_DIR,
        env: {
          ...process.env,
          EVAL_DB_PATH: databasePath,
          EVAL_LOGS_DIR: logsPath,
          MS_DATA_HOME: path.join(tempDir, 'data-home'),
          ADAPTIVE_TUTOR_LLM: 'mock',
        },
        encoding: 'utf8',
      },
    );

    assert.match(output, /Evaluation complete\./u);
    const database = new Database(databasePath, { readonly: true });
    assert.equal(database.pragma('integrity_check', { simple: true }), 'ok');
    const counts = database
      .prepare('SELECT COUNT(*) AS runs, (SELECT COUNT(*) FROM evaluation_results) AS results FROM evaluation_runs')
      .get();
    database.close();
    assert.equal(counts.runs, 1);
    assert.equal(counts.results, 1);
  });
});
