import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const tempDirs = [];
const progressLogs = [];

function runTransientStatsFixture() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-store-transient-'));
  tempDirs.push(tempDir);
  const dbPath = path.join(tempDir, 'evaluations.db');

  const script = `
    import fs from 'fs';
    import path from 'path';
    import { createRun, storeResult, updateRun, getRunStats, getScenarioStats } from './services/evaluationStore.js';
    import { getProgressLogPath } from './services/progressLogger.js';

    const run = createRun({
      description: 'transient placeholder regression fixture',
      totalScenarios: 1,
      totalConfigurations: 2,
      metadata: {
        runsPerConfig: 1,
        scenarioIds: ['mood_frustration_to_breakthrough'],
        profileNames: ['cell_80_messages_base_single_unified', 'cell_81_messages_base_single_psycho'],
        modelOverride: 'lmstudio.qwen3.5-9b',
      },
    });

    updateRun(run.id, { status: 'running', totalTests: 2 });

    storeResult(run.id, {
      scenarioId: 'mood_frustration_to_breakthrough',
      scenarioName: 'Mood: Frustration to Breakthrough (Multi-turn)',
      provider: 'lmstudio',
      model: 'qwen3.5-9b',
      profileName: 'cell_81_messages_base_single_psycho',
      egoModel: 'lmstudio.qwen3.5-9b',
      superegoModel: null,
      suggestions: [{ message: 'Visible answer only' }],
      rawResponse: '{"ok":true}',
      latencyMs: 222520,
      inputTokens: 61393,
      outputTokens: 2321,
      passesRequired: false,
      passesForbidden: false,
      success: true,
      errorMessage: null,
    });

    const progressPath = getProgressLogPath(run.id);
    fs.mkdirSync(path.dirname(progressPath), { recursive: true });
    fs.writeFileSync(
      progressPath,
      [
        {
          timestamp: new Date().toISOString(),
          runId: run.id,
          eventType: 'run_start',
          totalTests: 2,
          totalScenarios: 1,
          totalConfigurations: 2,
          scenarios: ['Mood: Frustration to Breakthrough (Multi-turn)'],
          profiles: ['cell_80_messages_base_single_unified', 'cell_81_messages_base_single_psycho'],
        },
        {
          timestamp: new Date().toISOString(),
          runId: run.id,
          eventType: 'test_start',
          scenarioId: 'mood_frustration_to_breakthrough',
          scenarioName: 'Mood: Frustration to Breakthrough (Multi-turn)',
          profileName: 'cell_80_messages_base_single_unified',
        },
        {
          timestamp: new Date().toISOString(),
          runId: run.id,
          eventType: 'test_error',
          scenarioId: 'mood_frustration_to_breakthrough',
          scenarioName: 'Mood: Frustration to Breakthrough (Multi-turn)',
          profileName: 'cell_80_messages_base_single_unified',
          errorMessage: 'Local LLM fetch failed for qwen3.5-9b at http://127.0.0.1:1234/v1/chat/completions: fetch failed',
        },
        {
          timestamp: new Date().toISOString(),
          runId: run.id,
          eventType: 'test_start',
          scenarioId: 'mood_frustration_to_breakthrough',
          scenarioName: 'Mood: Frustration to Breakthrough (Multi-turn)',
          profileName: 'cell_81_messages_base_single_psycho',
        },
        {
          timestamp: new Date().toISOString(),
          runId: run.id,
          eventType: 'test_complete',
          scenarioId: 'mood_frustration_to_breakthrough',
          scenarioName: 'Mood: Frustration to Breakthrough (Multi-turn)',
          profileName: 'cell_81_messages_base_single_psycho',
          success: true,
          latencyMs: 222520,
        },
        {
          timestamp: new Date().toISOString(),
          runId: run.id,
          eventType: 'run_complete',
          totalTests: 2,
          successfulTests: 1,
          failedTests: 1,
        },
      ].map((event) => JSON.stringify(event)).join('\\n') + '\\n',
      'utf-8',
    );

    updateRun(run.id, { status: 'completed', completedAt: new Date().toISOString() });

    console.log(
      JSON.stringify({
        runId: run.id,
        stats: getRunStats(run.id),
        scenarioStats: getScenarioStats(run.id),
      }),
    );
  `;

  const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: ROOT,
    env: { ...process.env, EVAL_DB_PATH: dbPath },
    encoding: 'utf-8',
  });

  const output = JSON.parse(stdout.trim());
  progressLogs.push(path.join(ROOT, 'logs', 'eval-progress', `${output.runId}.jsonl`));
  return output;
}

after(() => {
  for (const filePath of progressLogs) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore cleanup failures
    }
  }

  for (const dirPath of tempDirs) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  }
});

describe('evaluationStore transient placeholder stats', () => {
  it('surfaces missing planned cells as transient failures in run and scenario stats', () => {
    const { stats, scenarioStats } = runTransientStatsFixture();

    assert.equal(stats.length, 2);

    const successfulCell = stats.find((row) => row.profileName === 'cell_81_messages_base_single_psycho');
    assert.ok(successfulCell);
    assert.equal(successfulCell.storedTests, 1);
    assert.equal(successfulCell.transientFailedTests, 0);
    assert.equal(successfulCell.successfulTests, 1);

    const transientCell = stats.find((row) => row.profileName === 'cell_80_messages_base_single_unified');
    assert.ok(transientCell);
    assert.equal(transientCell.provider, 'lmstudio');
    assert.equal(transientCell.model, 'qwen3.5-9b');
    assert.equal(transientCell.egoModel, 'lmstudio.qwen3.5-9b');
    assert.equal(transientCell.storedTests, 0);
    assert.equal(transientCell.transientFailedTests, 1);
    assert.equal(transientCell.successfulTests, 0);
    assert.match(transientCell.lastErrorMessage, /fetch failed/);

    assert.equal(scenarioStats.length, 1);
    assert.equal(scenarioStats[0].configurations.length, 2);

    const transientScenarioCell = scenarioStats[0].configurations.find(
      (row) => row.profileName === 'cell_80_messages_base_single_unified',
    );
    assert.ok(transientScenarioCell);
    assert.equal(transientScenarioCell.storedRuns, 0);
    assert.equal(transientScenarioCell.transientFailedRuns, 1);
    assert.equal(transientScenarioCell.runs, 1);
    assert.equal(transientScenarioCell.passesValidation, false);
    assert.match(transientScenarioCell.lastErrorMessage, /fetch failed/);
  });
});
