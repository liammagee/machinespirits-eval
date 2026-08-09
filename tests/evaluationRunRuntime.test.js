import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createEvaluationRunRuntime } from '../services/evaluationRunRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createHarness({ outcomes = {}, yamlOverrides = {} } = {}) {
  const scenarios = [
    { id: 'scenario-a', name: 'Scenario A' },
    { id: 'scenario-b', name: 'Scenario B' },
  ];
  const configurations = [
    { profileName: 'profile-a', label: 'Profile A', provider: 'test', model: 'a' },
    { profileName: 'profile-b', label: 'Profile B', provider: 'test', model: 'b' },
  ];
  const calls = {
    live: [],
    logs: [],
    monitoring: [],
    progress: [],
    reporter: [],
    runSingleTest: [],
    sleeps: [],
    store: [],
    warnings: [],
    quiet: [],
  };

  class FakeProgressLogger {
    constructor(runId) {
      calls.progress.push(['construct', runId]);
    }
    runStart(payload) {
      calls.progress.push(['runStart', payload]);
    }
    testStart(payload) {
      calls.progress.push(['testStart', payload]);
    }
    testComplete(payload) {
      calls.progress.push(['testComplete', payload]);
    }
    testError(payload) {
      calls.progress.push(['testError', payload]);
    }
    scenarioComplete(payload) {
      calls.progress.push(['scenarioComplete', payload]);
    }
    runComplete(payload) {
      calls.progress.push(['runComplete', payload]);
    }
  }

  class FakeStreamingReporter {
    constructor(payload) {
      calls.reporter.push(['construct', payload]);
    }
    onTestComplete(payload) {
      calls.reporter.push(['testComplete', payload]);
    }
    onTestError(payload) {
      calls.reporter.push(['testError', payload]);
    }
    onScenarioComplete(payload) {
      calls.reporter.push(['scenarioComplete', payload]);
    }
    onRunComplete(payload) {
      calls.reporter.push(['runComplete', payload]);
    }
  }

  class FakeLiveApiReporter {
    install() {
      calls.live.push(['install']);
    }
    uninstall() {
      calls.live.push(['uninstall']);
    }
    async withConversation(context, operation) {
      calls.live.push(['conversation', context]);
      return operation();
    }
  }

  const evaluationStore = {
    createRun(payload) {
      calls.store.push(['createRun', payload]);
      return { id: 'run-1', description: payload.description };
    },
    updateRun(runId, payload) {
      calls.store.push(['updateRun', runId, payload]);
    },
    storeResult(runId, result) {
      calls.store.push(['storeResult', runId, result]);
    },
    getRunStats(runId) {
      calls.store.push(['getRunStats', runId]);
      return [{ profileName: 'profile-a', avgScore: 80 }];
    },
    getScenarioStats(runId) {
      calls.store.push(['getScenarioStats', runId]);
      return [{ scenarioId: 'scenario-a', avgScore: 70 }];
    },
  };

  const runtime = createEvaluationRunRuntime({
    CLAUDE_CLI_CONTEXT_ISOLATION: 'isolated-v1',
    DEFAULT_PARALLELISM: 3,
    LiveApiReporter: FakeLiveApiReporter,
    ProgressLogger: FakeProgressLogger,
    REQUEST_DELAY_MS: 200,
    SUPPORTED_JUDGE_CLIS: new Set(['claude', 'codex', 'gemini']),
    StreamingReporter: FakeStreamingReporter,
    applyScenarioFilter: (items, filter) => items.filter((item) => item.id === filter),
    contentResolver: {
      configure(payload) {
        calls.logs.push(['configureContent', payload]);
      },
      isConfigured: () => true,
    },
    currentIsoTimestamp: () => '2026-08-09T00:00:01.000Z',
    environment: {
      EVAL_CONTENT_PATH: '/tmp/content-override',
      EVAL_SCENARIOS_FILE: '/tmp/scenarios.yaml',
    },
    evalConfigLoader: {
      getContentConfig: () => null,
      getTutorModelOverrides: () => yamlOverrides,
      listConfigurations: () => configurations,
      listScenarios: () => scenarios,
      listTutorProfiles: () => configurations.map(({ profileName: name }) => ({ name })),
    },
    evaluationStore,
    formatProgress: (completed, total) => `[${completed}/${total}]`,
    getDefaultCliJudgeModelOverride: (judge) => `${judge}-default`,
    getGitCommitHash: () => 'abcdef12',
    getProgressLogPath: (runId) => `/tmp/${runId}.jsonl`,
    isTransientEvaluationError: (message) => /429|rate limit/u.test(message),
    monitoringService: {
      startSession(...args) {
        calls.monitoring.push(['startSession', ...args]);
      },
      recordEvent(...args) {
        calls.monitoring.push(['recordEvent', ...args]);
      },
      endSession(...args) {
        calls.monitoring.push(['endSession', ...args]);
      },
    },
    now: (() => {
      const values = [1_000, 1_250];
      return () => values.shift();
    })(),
    output: {
      log: (...args) => calls.logs.push(args),
      warn: (...args) => calls.warnings.push(args),
    },
    packageVersion: '9.9.9',
    processId: 12345,
    async runSingleTest(scenario, configuration, options) {
      calls.runSingleTest.push([scenario.id, configuration, options]);
      const outcome = outcomes[configuration.profileName];
      if (outcome instanceof Error) throw outcome;
      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        profileName: configuration.profileName,
        success: true,
        tutorFirstTurnScore: configuration.profileName === 'profile-a' ? 80 : 60,
        inputTokens: 4,
        outputTokens: 6,
        latencyMs: 10,
        ...outcome,
      };
    },
    setLiveQuiet: (value) => calls.live.push(['quiet', value]),
    setQuietMode: (value) => calls.quiet.push(value),
    sleep: async (duration) => calls.sleeps.push(duration),
    warnIfWeakStackDefault: (configs) => calls.warnings.push(['weakStack', configs]),
  });

  return { calls, configurations, evaluationStore, runtime, scenarios };
}

test('run coordinator preserves planning, scenario-first execution, metadata, progress, and finalization', async () => {
  const { calls, runtime } = createHarness({
    yamlOverrides: { egoModelOverride: 'yaml.ego', superegoModelOverride: 'yaml.superego' },
  });
  const admissionPlan = { endpoint: '/api/eval/run', plannedTestCount: 4 };
  const result = await runtime.runEvaluation({
    configurations: ['profile-a', 'profile-b'],
    scenarios: 'all',
    parallelism: 1,
    runsPerConfig: 1,
    judgeCli: 'CODEX',
    modelOverride: 'cli.all',
    learnerModelOverride: 'cli.learner',
    maxTokensOverride: 777,
    learnerId: 'learner-1',
    threadNegotiationResolution: true,
    admissionPlan,
    dryRun: true,
  });

  assert.deepEqual(
    calls.runSingleTest.map(([scenarioId, config]) => [scenarioId, config.profileName]),
    [
      ['scenario-a', 'profile-a'],
      ['scenario-a', 'profile-b'],
      ['scenario-b', 'profile-a'],
      ['scenario-b', 'profile-b'],
    ],
  );
  for (const [, config, options] of calls.runSingleTest) {
    assert.equal(config.modelOverride, 'cli.all');
    assert.equal(config.egoModelOverride, 'yaml.ego');
    assert.equal(config.superegoModelOverride, 'yaml.superego');
    assert.equal(config.learnerModelOverride, 'cli.learner');
    assert.equal(config.maxTokensOverride, 777);
    assert.equal(options.judgeCli, 'codex');
    assert.equal(options.judgeCliModel, 'codex-default');
    assert.equal(options.learnerId, 'learner-1');
    assert.equal(options.threadNegotiationResolution, true);
  }

  const createRun = calls.store.find(([name]) => name === 'createRun')[1];
  assert.equal(createRun.totalScenarios, 2);
  assert.equal(createRun.totalConfigurations, 2);
  assert.deepEqual(createRun.metadata.scenarioIds, ['scenario-a', 'scenario-b']);
  assert.deepEqual(createRun.metadata.profileNames, ['profile-a', 'profile-b']);
  assert.equal(createRun.metadata.judgeCli, 'codex');
  assert.equal(createRun.metadata.judgeCliModel, 'codex-default');
  assert.equal(createRun.metadata.modelOverride, 'cli.all');
  assert.equal(createRun.metadata.egoModelOverride, 'yaml.ego');
  assert.equal(createRun.metadata.threadNegotiationResolution, true);
  assert.equal(createRun.metadata.packageVersion, '9.9.9');
  assert.equal(createRun.metadata.gitCommit, 'abcdef12');
  assert.equal(createRun.metadata.pid, 12345);
  assert.deepEqual(createRun.metadata.admissionPlan, admissionPlan);
  assert.notEqual(createRun.metadata.admissionPlan, admissionPlan);

  assert.deepEqual(result, {
    runId: 'run-1',
    totalTests: 4,
    successfulTests: 4,
    failedTests: 0,
    stats: [{ profileName: 'profile-a', avgScore: 80 }],
    scenarioStats: [{ scenarioId: 'scenario-a', avgScore: 70 }],
    progressLogPath: '/tmp/run-1.jsonl',
  });
  assert.deepEqual(calls.quiet, [true, false]);
  assert.deepEqual(calls.sleeps, [200, 200, 200, 200]);
  assert.deepEqual(
    calls.progress.filter(([name]) => name === 'scenarioComplete').map(([, event]) => event.avgScore),
    [70, 70],
  );
  assert.deepEqual(
    calls.store.filter(([name]) => name === 'updateRun').map(([, , payload]) => payload),
    [
      { status: 'running', totalTests: 4 },
      { status: 'completed', completedAt: '2026-08-09T00:00:01.000Z' },
    ],
  );
  assert.equal(calls.monitoring.at(-1)[0], 'endSession');
});

test('run coordinator keeps transient failures resumable and stores permanent failures', async () => {
  const { calls, runtime } = createHarness({
    outcomes: {
      'profile-b': new Error('429 rate limit'),
      'profile-c': new Error('invalid configuration'),
    },
  });
  const result = await runtime.runEvaluation({
    configurations: [
      { profileName: 'profile-a', provider: 'test', model: 'a' },
      { profileName: 'profile-b', provider: 'test', model: 'b' },
      {
        profileName: 'profile-c',
        egoModel: { provider: 'codex', model: 'ego' },
        superego: { provider: 'claude-code', model: 'superego' },
      },
    ],
    scenarios: ['scenario-a'],
    parallelism: 1,
    liveApi: true,
  });

  const stored = calls.store.filter(([name]) => name === 'storeResult').map(([, , row]) => row);
  assert.equal(stored.length, 2);
  assert.equal(stored[0].profileName, 'profile-a');
  assert.deepEqual(stored[1], {
    scenarioId: 'scenario-a',
    scenarioName: 'Scenario A',
    profileName: 'profile-c',
    provider: 'unknown',
    model: 'unknown',
    egoModel: 'codex.ego',
    superegoModel: 'claude-code.superego',
    factors: null,
    learnerArchitecture: null,
    attemptIndex: 0,
    success: false,
    errorMessage: 'invalid configuration',
  });
  assert.equal(result.totalTests, 3);
  assert.equal(result.successfulTests, 1);
  assert.equal(result.failedTests, 2);
  assert.equal(calls.progress.filter(([name]) => name === 'testError').length, 2);
  assert.equal(calls.progress.find(([name]) => name === 'scenarioComplete')[1].avgScore, 80);
  assert.deepEqual(calls.live, [
    ['install'],
    ['quiet', true],
    ['conversation', { profileName: 'profile-a', scenarioId: 'scenario-a' }],
    ['conversation', { profileName: 'profile-b', scenarioId: 'scenario-a' }],
    ['conversation', { profileName: 'profile-c', scenarioId: 'scenario-a' }],
    ['uninstall'],
    ['quiet', false],
  ]);
});

test('run coordinator validates judge and empty-plan contracts before model work', async () => {
  const { calls, runtime } = createHarness();
  await assert.rejects(
    runtime.runEvaluation({ judgeOverride: 'judge.x', judgeCli: 'codex' }),
    /Use either judgeOverride or judgeCli, not both/u,
  );
  await assert.rejects(runtime.runEvaluation({ judgeCli: 'unknown' }), /Unsupported judge CLI: unknown/u);
  await assert.rejects(runtime.runEvaluation({ scenarios: [] }), /No scenarios to run/u);
  await assert.rejects(runtime.runEvaluation({ configurations: [] }), /No configurations to test/u);
  assert.equal(calls.runSingleTest.length, 0);
});

test('evaluationRunner delegates complete-run orchestration to one bounded owner', () => {
  const facade = readFileSync(path.join(ROOT, 'services', 'evaluationRunner.js'), 'utf8');
  const owner = readFileSync(path.join(ROOT, 'services', 'evaluationRunRuntime.js'), 'utf8');
  assert.match(facade, /import \{ createEvaluationRunRuntime \} from '.\/evaluationRunRuntime\.js';/u);
  assert.match(facade, /getEvaluationRunnerRuntime\(evaluationStore\)\.runEvaluation\(runtimeOptions\)/u);
  assert.match(owner, /export function createEvaluationRunRuntime\(dependencies\)/u);
  assert.doesNotMatch(facade, /const allTests = \[\]/u);
  assert.ok(facade.split('\n').length < 1_800, 'evaluationRunner facade must remain below 1,800 lines');
  assert.ok(owner.split('\n').length < 900, 'evaluationRunRuntime owner must remain below 900 lines');
});
