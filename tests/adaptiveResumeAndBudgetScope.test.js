// Offline tests for adaptive resume and for the scope of one --max-cost value.
//
// Nothing here reaches a provider: the mock backend covers the resume plan, and
// the two budget cases inject a throwing transport so a reservation is booked
// and no dispatch ever leaves the process.

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
import { createBudgetTracker } from '../services/adaptiveTutor/budgetTracker.js';
import { resetRealLLMTestDependencies, setRealLLMTestDependencies } from '../services/adaptiveTutor/realLLM.js';
import { createEvaluationStore } from '../services/evaluationStore/createEvaluationStore.js';

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

function writeScenarioFile(scenarioPath, ids) {
  fs.writeFileSync(
    scenarioPath,
    yaml.stringify({
      scenarios: ids.map((id) => ({
        id,
        opening: `Opening line for ${id}.`,
        max_turns: 1,
        hidden: {
          actual_misconception: 'adds numerators and denominators',
          actual_sophistication: 'intermediate',
          trigger_turn: 1,
          trigger_signal: 'That still seems wrong.',
        },
      })),
    }),
  );
}

const MOCK_PROFILE = (scenarioPath) => ({
  runner: 'adaptive',
  scenario_source: scenarioPath,
  adaptive: { architecture: 'state_policy', counterfactual: { enabled: false } },
});

const METERED_PROFILE = (scenarioPath) => ({
  runner: 'adaptive',
  scenario_source: scenarioPath,
  adaptive: {
    architecture: 'state_policy',
    provider: 'openrouter',
    model: 'sonnet',
    counterfactual: { enabled: false },
  },
});

describe('adaptive resume', () => {
  it('re-runs only the planned units that never produced a row, under the original run id', async () => {
    const { tempDir, databasePath, logsPath } = createTempEnvironment('adaptive-resume-missing-');
    const scenarioPath = path.join(tempDir, 'scenarios.yaml');
    writeScenarioFile(scenarioPath, ['resume_alpha', 'resume_beta', 'resume_gamma']);

    await withProcessEnvironment(
      {
        EVAL_DB_PATH: databasePath,
        EVAL_LOGS_DIR: logsPath,
        MS_DATA_HOME: path.join(tempDir, 'data-home'),
        ADAPTIVE_TUTOR_LLM: 'mock',
      },
      async () => {
        const firstStore = createEvaluationStore({ rootDir: ROOT_DIR });
        let runId;
        try {
          const { runAdaptiveEvaluation } = createAdaptiveEvaluationRunner({ evaluationStore: firstStore });
          const result = await runAdaptiveEvaluation({
            profileName: 'cell_test_resume_plan',
            evalProfile: MOCK_PROFILE(scenarioPath),
            runsPerConfig: 2,
            dryRun: true,
          });
          runId = result.runId;

          // Six planned units: three scenarios by two repetitions. The plan is
          // recorded on the run so resume never has to guess it.
          assert.equal(result.persisted.length, 6);
          const planned = firstStore.getRun(runId).metadata.plannedUnits;
          assert.equal(planned.length, 6);
          assert.deepEqual(planned.map((unit) => unit.unitId).sort(), [
            'resume_alpha',
            'resume_alpha__r1',
            'resume_beta',
            'resume_beta__r1',
            'resume_gamma',
            'resume_gamma__r1',
          ]);
          assert.equal(firstStore.getRun(runId).metadata.runsPerConfig, 2);
        } finally {
          firstStore.close();
        }

        // Stand in for an interruption that lost two units after their plan was
        // recorded: the rows are gone, the run and its plan remain.
        const database = new Database(databasePath);
        const deleted = database
          .prepare(
            "DELETE FROM evaluation_results WHERE run_id = ? AND scenario_id IN ('resume_beta__r1','resume_gamma')",
          )
          .run(runId);
        database.close();
        assert.equal(deleted.changes, 2);

        const resumeStore = createEvaluationStore({ rootDir: ROOT_DIR });
        try {
          const { resumeAdaptiveEvaluation } = createAdaptiveEvaluationRunner({ evaluationStore: resumeStore });
          const resumed = await resumeAdaptiveEvaluation({
            runId,
            evalProfile: MOCK_PROFILE(scenarioPath),
          });

          assert.equal(resumed.runId, runId, 'resume must stay on the original run id');
          assert.equal(resumed.alreadyComplete, false);
          assert.equal(resumed.resumedUnits, 2, 'only the two missing units are planned for execution');
          assert.equal(resumed.persisted.length, 2);
          assert.equal(resumed.totalScenarios, 6);

          const scenarioIds = resumeStore
            .getResults(runId)
            .map((row) => row.scenarioId)
            .sort();
          assert.equal(scenarioIds.length, 6, 'the run is whole again, with no duplicate units');
          assert.deepEqual(scenarioIds, [
            'resume_alpha',
            'resume_alpha__r1',
            'resume_beta',
            'resume_beta__r1',
            'resume_gamma',
            'resume_gamma__r1',
          ]);
          assert.equal(resumeStore.getRun(runId).status, 'completed');
          assert.equal(resumeStore.getRun(runId).totalTests, 6);
        } finally {
          resumeStore.close();
        }
      },
    );
  });

  it('reports a complete run as complete instead of re-running finished units', async () => {
    const { tempDir, databasePath, logsPath } = createTempEnvironment('adaptive-resume-complete-');
    const scenarioPath = path.join(tempDir, 'scenarios.yaml');
    writeScenarioFile(scenarioPath, ['already_done']);

    await withProcessEnvironment(
      {
        EVAL_DB_PATH: databasePath,
        EVAL_LOGS_DIR: logsPath,
        MS_DATA_HOME: path.join(tempDir, 'data-home'),
        ADAPTIVE_TUTOR_LLM: 'mock',
      },
      async () => {
        const evaluationStore = createEvaluationStore({ rootDir: ROOT_DIR });
        try {
          const { runAdaptiveEvaluation, resumeAdaptiveEvaluation } = createAdaptiveEvaluationRunner({
            evaluationStore,
          });
          const { runId } = await runAdaptiveEvaluation({
            profileName: 'cell_test_resume_complete',
            evalProfile: MOCK_PROFILE(scenarioPath),
            dryRun: true,
          });

          const resumed = await resumeAdaptiveEvaluation({ runId, evalProfile: MOCK_PROFILE(scenarioPath) });
          assert.equal(resumed.alreadyComplete, true);
          assert.equal(resumed.persisted.length, 0);
          assert.equal(evaluationStore.getResults(runId).length, 1);
        } finally {
          evaluationStore.close();
        }
      },
    );
  });

  it('refuses a run that the adaptive runner did not create', async () => {
    const { tempDir, databasePath, logsPath } = createTempEnvironment('adaptive-resume-wrong-kind-');

    await withProcessEnvironment(
      {
        EVAL_DB_PATH: databasePath,
        EVAL_LOGS_DIR: logsPath,
        MS_DATA_HOME: path.join(tempDir, 'data-home'),
        ADAPTIVE_TUTOR_LLM: 'mock',
      },
      async () => {
        const evaluationStore = createEvaluationStore({ rootDir: ROOT_DIR });
        try {
          const { resumeAdaptiveEvaluation } = createAdaptiveEvaluationRunner({ evaluationStore });
          const standardRun = evaluationStore.createRun({
            description: 'standard suggestion run',
            totalScenarios: 1,
            totalConfigurations: 1,
            metadata: { profileNames: ['cell_1_base_single_unified'] },
          });

          await assert.rejects(
            resumeAdaptiveEvaluation({ runId: standardRun.id, evalProfile: {} }),
            /is not an adaptive run/u,
          );
          await assert.rejects(resumeAdaptiveEvaluation({ runId: 'no-such-run' }), /Run not found/u);
        } finally {
          evaluationStore.close();
        }
      },
    );
  });
});

describe('adaptive budget scope', () => {
  it('reopens one run ledger at its recorded ceiling and keeps the exposure already booked', async () => {
    const { tempDir, databasePath, logsPath } = createTempEnvironment('adaptive-ledger-reopen-');

    await withProcessEnvironment(
      {
        EVAL_DB_PATH: databasePath,
        EVAL_LOGS_DIR: logsPath,
        MS_DATA_HOME: path.join(tempDir, 'data-home'),
      },
      async () => {
        const evaluationStore = createEvaluationStore({ rootDir: ROOT_DIR });
        try {
          const run = evaluationStore.createRun({
            description: 'ledger reopen',
            totalScenarios: 1,
            totalConfigurations: 1,
            metadata: { kind: 'adaptive_trap' },
          });

          const first = createBudgetTracker({ maxUsd: 2, runId: run.id, ledgerStore: evaluationStore });
          const reservation = first.reserveAttempt({
            provider: 'openrouter',
            model: 'anthropic/claude-sonnet-4.6',
            role: 'ego',
            promptText: 'x'.repeat(4000),
            maxOutputTokens: 1000,
          });
          first.settleAttempt(reservation, { inputTokens: 1000, outputTokens: 500 });
          const pending = first.reserveAttempt({
            provider: 'openrouter',
            model: 'anthropic/claude-sonnet-4.6',
            role: 'superego',
            promptText: 'y'.repeat(4000),
            maxOutputTokens: 1000,
          });
          const beforeInterruption = first.summary();
          assert.ok(beforeInterruption.pendingExposureUsd > 0, 'the interrupted attempt leaves pending exposure');
          assert.ok(beforeInterruption.ceilingExposureUsd > 0);

          // A resume rebinds the same run id at the same ceiling. Nothing is
          // forgiven: settled cost and the pending reservation both carry over.
          const reopened = createBudgetTracker({ maxUsd: 2, runId: run.id, ledgerStore: evaluationStore });
          const afterResume = reopened.summary();
          assert.equal(afterResume.maxUsd, 2);
          assert.equal(afterResume.attemptCount, beforeInterruption.attemptCount);
          assert.equal(afterResume.settledCount, 1);
          assert.equal(afterResume.pendingCount, 1);
          assert.equal(afterResume.ceilingExposureUsd, beforeInterruption.ceilingExposureUsd);
          assert.ok(afterResume.pendingExposureUsd > 0);
          assert.equal(pending.runId, run.id);

          // A resume may not quietly raise or lower the ceiling the run was
          // launched under.
          assert.throws(
            () => createBudgetTracker({ maxUsd: 5, runId: run.id, ledgerStore: evaluationStore }),
            /ceiling mismatch/iu,
          );
        } finally {
          evaluationStore.close();
        }
      },
    );
  });

  it('resumes a metered run under the ceiling recorded at launch, inheriting its exposure', async () => {
    const { tempDir, databasePath, logsPath } = createTempEnvironment('adaptive-resume-metered-');
    const scenarioPath = path.join(tempDir, 'scenarios.yaml');
    writeScenarioFile(scenarioPath, ['metered_alpha', 'metered_beta']);

    await withProcessEnvironment(
      {
        EVAL_DB_PATH: databasePath,
        EVAL_LOGS_DIR: logsPath,
        MS_DATA_HOME: path.join(tempDir, 'data-home'),
        ADAPTIVE_TUTOR_LLM: 'real',
        OPENROUTER_API_KEY: 'offline-resume-test-key',
      },
      async () => {
        const evaluationStore = createEvaluationStore({ rootDir: ROOT_DIR });
        // Every dispatch fails, so a reservation is booked and no request ever
        // leaves the process. The run therefore ends with zero rows and real
        // exposure — the shape a resume has to inherit.
        setRealLLMTestDependencies({
          unifiedCall: async () => {
            throw new Error('offline transport is unreachable in this test');
          },
          sleep: async () => {},
          random: () => 0,
        });
        try {
          const { runAdaptiveEvaluation, resumeAdaptiveEvaluation } = createAdaptiveEvaluationRunner({
            evaluationStore,
          });
          const first = await runAdaptiveEvaluation({
            profileName: 'cell_test_resume_metered',
            evalProfile: METERED_PROFILE(scenarioPath),
            maxCostUsd: 5,
          });

          assert.equal(first.persisted.length, 0, 'no unit completed, so no row was written');
          assert.equal(first.budget.maxUsd, 5);
          const exposureAfterFirst = first.budget.ceilingExposureUsd;
          assert.ok(exposureAfterFirst > 0, 'the failed attempts stay charged at their reservation');
          assert.equal(evaluationStore.getRun(first.runId).metadata.maxCostUsd, 5);

          const resumed = await resumeAdaptiveEvaluation({
            runId: first.runId,
            evalProfile: METERED_PROFILE(scenarioPath),
          });

          assert.equal(resumed.runId, first.runId);
          assert.equal(resumed.resumedUnits, 2, 'both units are still missing and are replanned');
          assert.equal(resumed.budget.maxUsd, 5, 'the resume runs under the ceiling recorded at launch');
          assert.ok(
            resumed.budget.ceilingExposureUsd > exposureAfterFirst,
            'the reopened ledger keeps the first attempt exposure and adds to it',
          );
          assert.ok(resumed.budget.attemptCount > first.budget.attemptCount);
        } finally {
          resetRealLLMTestDependencies();
          evaluationStore.close();
        }
      },
    );
  });

  it('refuses one --max-cost spread across several adaptive profiles, before any run is created', () => {
    const { tempDir, databasePath, logsPath } = createTempEnvironment('adaptive-multi-profile-budget-');

    let failure = null;
    try {
      execFileSync(
        process.execPath,
        [
          'scripts/eval-cli.js',
          'run',
          '--profiles',
          'cell_110_langgraph_adaptive,cell_124_langgraph_adaptive_crosssuite',
          '--runs',
          '1',
          '--max-cost',
          '4',
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
    } catch (error) {
      failure = error;
    }

    assert.ok(failure, 'the invocation must fail rather than license one ceiling per profile');
    assert.equal(failure.status, 1);
    const stderr = String(failure.stderr || '');
    assert.match(stderr, /--max-cost is ambiguous across 2 adaptive profiles/u);
    // 2 profiles times $4 is the exposure the old behaviour would have allowed.
    assert.match(stderr, /\$8\.00/u);

    // Failing closed means no run row, so nothing can start against the
    // multiplied ceiling and later be mistaken for an authorized run.
    if (fs.existsSync(databasePath)) {
      const database = new Database(databasePath, { readonly: true });
      const { runs } = database.prepare('SELECT COUNT(*) AS runs FROM evaluation_runs').get();
      database.close();
      assert.equal(runs, 0);
    }
  });

  it('accepts one --max-cost for a single adaptive profile', () => {
    const { tempDir, databasePath, logsPath } = createTempEnvironment('adaptive-single-profile-budget-');

    const output = execFileSync(
      process.execPath,
      [
        'scripts/eval-cli.js',
        'run',
        '--profiles',
        'cell_110_langgraph_adaptive',
        '--scenario',
        'false_confusion_v1',
        '--runs',
        '1',
        '--max-cost',
        '4',
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
  });
});
