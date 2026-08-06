import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { migrateEvaluationDatabase } from '../services/evaluationStore/migrations.js';
import { createStatisticsRepository } from '../services/evaluationStore/statisticsRepository.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createHarness() {
  const db = new Database(':memory:');
  migrateEvaluationDatabase(db);
  const runs = new Map();
  const results = new Map();
  const progress = new Map();
  const profiles = new Map([
    ['profile-a', { ego: { provider: 'provider-a', model: 'model-a' }, superego: null }],
    [
      'profile-b',
      {
        ego: { provider: 'provider-b', model: 'model-b' },
        superego: { provider: 'provider-b', model: 'critic-b' },
      },
    ],
  ]);

  const repository = createStatisticsRepository({
    db,
    getResults: (runId) => results.get(runId) || [],
    getRun: (runId) => runs.get(runId) || null,
    readProgressLog: (runId) => progress.get(runId) || [],
    uniqueGenerationResults: (rows) => rows,
    getScenario: (scenarioId) => ({ name: `Configured ${scenarioId}` }),
    getTutorProfile: (profileName) => profiles.get(profileName) || null,
    resolveModel: (ref) => {
      if (ref === 'invalid.model') throw new Error('invalid model');
      if (ref === 'override.model') return { provider: 'override-provider', model: 'override-model' };
      const [provider, ...modelParts] = String(ref).split('.');
      return { provider, model: modelParts.join('.') };
    },
  });

  function seedRun(id, overrides = {}) {
    const run = {
      id,
      status: 'running',
      metadata: {},
      ...overrides,
    };
    runs.set(id, run);
    results.set(id, []);
    db.prepare(
      `INSERT INTO evaluation_runs (
        id, created_at, description, total_scenarios, total_configurations,
        total_tests, metadata, status
      ) VALUES (?, '2026-08-06T10:15:00.000Z', 'statistics run', 2, 2, 4, ?, ?)`,
    ).run(id, JSON.stringify(run.metadata), run.status);
    return run;
  }

  function seedResult(runId, overrides = {}) {
    const index = (results.get(runId)?.length || 0) + 1;
    const result = {
      scenarioId: `scenario-${index}`,
      scenarioName: `Scenario ${index}`,
      provider: 'provider-a',
      model: 'model-a',
      profileName: 'profile-a',
      egoModel: 'provider-a.model-a',
      superegoModel: null,
      tutorFirstTurnScore: 80,
      baseScore: 70,
      recognitionScore: 90,
      latencyMs: 100,
      inputTokens: 10,
      outputTokens: 20,
      passesRequired: true,
      passesForbidden: true,
      scores: { content_accuracy: { score: 4 }, pedagogical_quality: 3 },
      factors: { recognition: true, multi_agent_tutor: false, multi_agent_learner: true },
      success: true,
      ...overrides,
    };
    results.get(runId).push(result);
    db.prepare(
      `INSERT INTO evaluation_results (
        run_id, scenario_id, scenario_name, provider, model, profile_name,
        ego_model, superego_model, tutor_first_turn_score, overall_score,
        base_score, recognition_score, latency_ms, passes_required,
        passes_forbidden, factor_recognition, factor_multi_agent_tutor,
        factor_multi_agent_learner, success
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      runId,
      result.scenarioId,
      result.scenarioName,
      result.provider,
      result.model,
      result.profileName,
      result.egoModel,
      result.superegoModel,
      result.tutorFirstTurnScore,
      result.tutorFirstTurnScore,
      result.baseScore,
      result.recognitionScore,
      result.latencyMs,
      result.passesRequired ? 1 : 0,
      result.passesForbidden ? 1 : 0,
      result.factors?.recognition == null ? null : result.factors.recognition ? 1 : 0,
      result.factors?.multi_agent_tutor == null ? null : result.factors.multi_agent_tutor ? 1 : 0,
      result.factors?.multi_agent_learner == null ? null : result.factors.multi_agent_learner ? 1 : 0,
      result.success ? 1 : 0,
    );
    return result;
  }

  return { db, repository, progress, results, seedRun, seedResult };
}

describe('evaluation-store statistics repository', () => {
  it('aggregates run outcomes, dynamic dimensions, validation, tokens, and failures', () => {
    const { db, repository, seedRun, seedResult } = createHarness();
    try {
      seedRun('eval-aggregate');
      seedResult('eval-aggregate', { scenarioId: 'scenario-a' });
      seedResult('eval-aggregate', {
        scenarioId: 'scenario-b',
        success: false,
        tutorFirstTurnScore: 99,
        scores: { content_accuracy: { score: 5 } },
      });
      seedResult('eval-aggregate', {
        scenarioId: 'scenario-a',
        provider: 'provider-b',
        model: 'model-b',
        profileName: 'profile-b',
        egoModel: 'provider-b.model-b',
        superegoModel: 'provider-b.critic-b',
        tutorFirstTurnScore: 90,
        baseScore: 85,
        recognitionScore: 95,
        latencyMs: 200,
        inputTokens: 30,
        outputTokens: 40,
        scores: { content_accuracy: 5, pedagogical_quality: { score: 4 } },
      });

      const stats = repository.getRunStats('eval-aggregate');
      assert.deepEqual(
        stats.map((entry) => entry.profileName),
        ['profile-b', 'profile-a'],
      );
      assert.deepEqual(stats[0].dimensions, { content_accuracy: 5, pedagogical_quality: 4 });
      assert.equal(stats[0].avgScore, 90);
      assert.equal(stats[0].totalInputTokens, 30);
      assert.equal(stats[0].totalOutputTokens, 40);

      const profileA = stats[1];
      assert.equal(profileA.totalTests, 2);
      assert.equal(profileA.storedTests, 2);
      assert.equal(profileA.successfulTests, 1);
      assert.equal(profileA.transientFailedTests, 0);
      assert.equal(profileA.successRate, 0.5);
      assert.equal(profileA.avgScore, 80);
      assert.equal(profileA.avgBaseScore, 70);
      assert.equal(profileA.avgRecognitionScore, 90);
      assert.equal(profileA.avgLatencyMs, 100);
      assert.deepEqual(profileA.dimensions, { content_accuracy: 4, pedagogical_quality: 3 });
      assert.equal(profileA.validationPassRate, 0.5);
      assert.deepEqual(repository.getRunStats('missing'), []);
    } finally {
      db.close();
    }
  });

  it('projects missing planned generations as transient run and scenario failures', () => {
    const { db, repository, progress, seedRun, seedResult } = createHarness();
    try {
      seedRun('eval-transient', {
        status: 'completed',
        metadata: {
          runsPerConfig: 2,
          scenarioIds: ['scenario-transient'],
          profileNames: ['profile-a', 'profile-b'],
          modelOverride: 'override.model',
        },
      });
      seedResult('eval-transient', {
        scenarioId: 'scenario-transient',
        scenarioName: 'Transient Scenario',
        provider: 'override-provider',
        model: 'override-model',
        profileName: 'profile-a',
        egoModel: 'override.model',
      });
      progress.set('eval-transient', [
        {
          eventType: 'run_start',
          profiles: ['profile-a', 'profile-b'],
        },
        {
          eventType: 'test_error',
          scenarioId: 'scenario-transient',
          scenarioName: 'Progress-log Scenario',
          profileName: 'profile-b',
          errorMessage: 'provider fetch failed',
        },
      ]);

      const stats = repository.getRunStats('eval-transient');
      const profileA = stats.find((entry) => entry.profileName === 'profile-a');
      const profileB = stats.find((entry) => entry.profileName === 'profile-b');
      assert.equal(profileA.storedTests, 1);
      assert.equal(profileA.transientFailedTests, 1);
      assert.equal(profileA.totalTests, 2);
      assert.equal(profileB.provider, 'override-provider');
      assert.equal(profileB.model, 'override-model');
      assert.equal(profileB.egoModel, 'override.model');
      assert.equal(profileB.superegoModel, 'override.model');
      assert.equal(profileB.transientFailedTests, 2);
      assert.match(profileB.lastErrorMessage, /fetch failed/);

      const scenario = repository.getScenarioStats('eval-transient')[0];
      assert.equal(scenario.scenarioName, 'Transient Scenario');
      const scenarioA = scenario.configurations.find((entry) => entry.profileName === 'profile-a');
      const scenarioB = scenario.configurations.find((entry) => entry.profileName === 'profile-b');
      assert.equal(scenarioA.storedRuns, 1);
      assert.equal(scenarioA.transientFailedRuns, 1);
      assert.equal(scenarioA.runs, 2);
      assert.equal(scenarioA.passesValidation, false);
      assert.equal(scenarioB.storedRuns, 0);
      assert.equal(scenarioB.transientFailedRuns, 2);
      assert.equal(scenarioB.runs, 2);
      assert.match(scenarioB.lastErrorMessage, /fetch failed/);
    } finally {
      db.close();
    }
  });

  it('preserves scenario-level averages, validation semantics, and configuration identity', () => {
    const { db, repository, seedRun, seedResult } = createHarness();
    try {
      seedRun('eval-scenarios');
      seedResult('eval-scenarios', { scenarioId: 'scenario-a', tutorFirstTurnScore: 80 });
      seedResult('eval-scenarios', {
        scenarioId: 'scenario-a',
        tutorFirstTurnScore: 100,
        baseScore: 90,
        recognitionScore: 96,
        latencyMs: 300,
        passesForbidden: false,
      });
      seedResult('eval-scenarios', {
        scenarioId: 'scenario-a',
        provider: 'provider-b',
        model: 'model-b',
        profileName: 'profile-b',
        egoModel: 'provider-b.model-b',
        superegoModel: 'provider-b.critic-b',
        tutorFirstTurnScore: 70,
      });

      const scenario = repository.getScenarioStats('eval-scenarios')[0];
      assert.equal(scenario.scenarioId, 'scenario-a');
      assert.equal(scenario.configurations.length, 2);
      const profileA = scenario.configurations.find((entry) => entry.profileName === 'profile-a');
      assert.equal(profileA.avgScore, 90);
      assert.equal(profileA.avgBaseScore, 80);
      assert.equal(profileA.avgRecognitionScore, 93);
      assert.equal(profileA.avgLatencyMs, 200);
      assert.equal(profileA.passesValidation, false);
      assert.equal(profileA.storedRuns, 2);
      assert.equal(profileA.transientFailedRuns, 0);
      assert.equal(profileA.runs, 2);
      assert.deepEqual(repository.getScenarioStats('missing'), []);
    } finally {
      db.close();
    }
  });

  it('compares configurations and projects only successful factorial cells through whitelisted columns', () => {
    const { db, repository, seedRun, seedResult } = createHarness();
    try {
      seedRun('eval-projections');
      seedResult('eval-projections', {
        scenarioId: 'scenario-a',
        provider: 'provider-a',
        model: 'model-a',
        tutorFirstTurnScore: 80,
        baseScore: 70,
        factors: { recognition: false, multi_agent_tutor: false, multi_agent_learner: false },
      });
      seedResult('eval-projections', {
        scenarioId: 'scenario-b',
        provider: 'provider-a',
        model: 'model-a',
        tutorFirstTurnScore: 0,
        baseScore: 60,
        factors: { recognition: false, multi_agent_tutor: false, multi_agent_learner: false },
      });
      seedResult('eval-projections', {
        scenarioId: 'scenario-a',
        provider: 'provider-b',
        model: 'model-b',
        profileName: 'profile-b',
        tutorFirstTurnScore: 70,
        baseScore: 65,
        factors: { recognition: true, multi_agent_tutor: true, multi_agent_learner: true },
      });
      seedResult('eval-projections', {
        scenarioId: 'scenario-b',
        provider: 'provider-b',
        model: 'model-b',
        profileName: 'profile-b',
        tutorFirstTurnScore: 90,
        baseScore: 85,
        factors: { recognition: true, multi_agent_tutor: true, multi_agent_learner: true },
      });
      seedResult('eval-projections', {
        scenarioId: 'scenario-c',
        provider: 'provider-b',
        model: 'model-b',
        profileName: 'profile-b',
        tutorFirstTurnScore: 100,
        baseScore: 100,
        success: false,
        factors: { recognition: true, multi_agent_tutor: true, multi_agent_learner: true },
      });

      const compared = repository.compareConfigs(
        'eval-projections',
        { provider: 'provider-a', model: 'model-a' },
        { provider: 'provider-b', model: 'model-b' },
      );
      assert.deepEqual(compared.comparison, [
        { scenarioId: 'scenario-a', config1Score: 80, config2Score: 70, difference: 10, winner: 'config1' },
        { scenarioId: 'scenario-b', config1Score: null, config2Score: 90, difference: -90, winner: 'config2' },
        // Historical behavior: a scenario absent from config 1 compares
        // undefined directly and is labelled tie even though difference uses 0.
        { scenarioId: 'scenario-c', config1Score: null, config2Score: 100, difference: -100, winner: 'tie' },
      ]);
      assert.deepEqual(compared.overall, {
        config1Wins: 1,
        config2Wins: 1,
        ties: 1,
        config1AvgScore: 40,
        config2AvgScore: 260 / 3,
      });

      assert.deepEqual(repository.getFactorialCellData('eval-projections', { scoreColumn: 'base_score' }), {
        r0_t0_l0: [70, 60],
        r1_t1_l1: [65, 85],
      });
      assert.deepEqual(repository.getFactorialCellData('eval-projections', { scoreColumn: 'unsafe_sql' }), {
        r0_t0_l0: [80, 0],
        r1_t1_l1: [70, 90],
      });
    } finally {
      db.close();
    }
  });

  it('keeps the facade as compatibility owner and bounds the extracted projections', () => {
    const facade = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore.js'), 'utf-8');
    const repository = fs.readFileSync(
      path.join(ROOT_DIR, 'services', 'evaluationStore', 'statisticsRepository.js'),
      'utf-8',
    );
    const methods = ['getRunStats', 'getScenarioStats', 'compareConfigs', 'getFactorialCellData'];

    for (const method of methods) {
      assert.match(repository, new RegExp(`function ${method}\\(`));
      assert.doesNotMatch(facade, new RegExp(`function ${method}\\(`));
      assert.match(facade, new RegExp(`export const ${method} = statisticsRepository\\.${method};`));
    }
    assert.match(repository, /function buildTransientPlaceholderMap\(/);
    assert.equal(facade.split('\n').length - 1 <= 525, true);
    assert.equal(repository.split('\n').length - 1 <= 475, true);
  });
});
