import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createDialogueLogRepository } from '../services/evaluationStore/dialogueLogRepository.js';
import { createExportRepository } from '../services/evaluationStore/exportRepository.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXED_NOW = new Date('2026-08-07T01:02:03.456Z');
const CSV_HEADER = [
  'scenario_id',
  'scenario_name',
  'provider',
  'model',
  'tutor_first_turn_score',
  'relevance',
  'specificity',
  'pedagogical',
  'personalization',
  'actionability',
  'tone',
  'latency_ms',
  'input_tokens',
  'output_tokens',
  'passes_required',
  'passes_forbidden',
  'success',
  'attempt_index',
  'profile_name',
  'prompt_id',
  'ego_model',
  'superego_model',
  'factor_recognition',
  'factor_multi_agent_tutor',
  'factor_multi_agent_learner',
  'learner_architecture',
  'learner_id',
  'conversation_mode',
  'dialogue_id',
  'dialogue_content_hash',
  'config_hash',
  'tutor_ego_prompt_version',
  'tutor_superego_prompt_version',
  'learner_prompt_version',
  'prompt_content_hash',
  'id_construction_trace',
  'raw_response',
].join(',');

function createExportHarness(results = []) {
  const run = { id: 'eval-export', status: 'completed' };
  const stats = [{ profileName: 'cell_export', avgScore: 81 }];
  const scenarioStats = [{ scenarioId: 'scenario-1', configurations: [] }];
  const calls = [];
  const repository = createExportRepository({
    getRun: (runId) => {
      calls.push(['run', runId]);
      return run;
    },
    getResults: (runId) => {
      calls.push(['results', runId]);
      return results;
    },
    getRunStats: (runId) => {
      calls.push(['stats', runId]);
      return stats;
    },
    getScenarioStats: (runId) => {
      calls.push(['scenarioStats', runId]);
      return scenarioStats;
    },
    now: () => FIXED_NOW,
  });
  return { calls, repository, results, run, scenarioStats, stats };
}

function completeResult(overrides = {}) {
  return {
    scenarioId: 'scenario-1',
    scenarioName: 'Scenario One',
    provider: 'test-provider',
    model: 'test-model',
    tutorFirstTurnScore: 81,
    scores: {
      relevance: 5,
      specificity: 4,
      pedagogical: 3,
      personalization: 2,
      actionability: 1,
      tone: 0,
    },
    latencyMs: 123,
    inputTokens: 45,
    outputTokens: 67,
    passesRequired: true,
    passesForbidden: false,
    success: true,
    attemptIndex: 2,
    profileName: 'cell_export',
    promptId: 'prompt-export',
    egoModel: 'test.ego',
    superegoModel: 'test.superego',
    factors: { recognition: true, multi_agent_tutor: false, multi_agent_learner: null },
    learnerArchitecture: 'ego_superego',
    learnerId: 'learner-export',
    conversationMode: 'messages',
    dialogueId: 'dialogue-export',
    dialogueContentHash: 'dialogue-hash',
    configHash: 'config-hash',
    tutorEgoPromptVersion: 'ego-v1',
    tutorSuperegoPromptVersion: 'superego-v1',
    learnerPromptVersion: 'learner-v1',
    promptContentHash: 'prompt-hash',
    idConstructionTrace: [{ turn: 0, register: 'classroom' }],
    rawResponse: 'plain response',
    ...overrides,
  };
}

describe('evaluation-store export repository', () => {
  it('preserves the JSON projection, dependency order, references, and timestamp', () => {
    const result = completeResult();
    const { calls, repository, results, run, scenarioStats, stats } = createExportHarness([result]);

    assert.deepEqual(repository.exportToJson('eval-export'), {
      run,
      stats,
      scenarioStats,
      results,
      exportedAt: '2026-08-07T01:02:03.456Z',
    });
    assert.deepEqual(calls, [
      ['run', 'eval-export'],
      ['results', 'eval-export'],
      ['stats', 'eval-export'],
      ['scenarioStats', 'eval-export'],
    ]);
  });

  it('preserves the exact CSV header, field order, encodings, and trace serialization', () => {
    const result = completeResult();
    const { repository } = createExportHarness([result]);
    const expectedRow = [
      'scenario-1',
      'Scenario One',
      'test-provider',
      'test-model',
      '81',
      '5',
      '4',
      '3',
      '2',
      '1',
      '0',
      '123',
      '45',
      '67',
      '1',
      '0',
      '1',
      '2',
      'cell_export',
      'prompt-export',
      'test.ego',
      'test.superego',
      '1',
      '0',
      '',
      'ego_superego',
      'learner-export',
      'messages',
      'dialogue-export',
      'dialogue-hash',
      'config-hash',
      'ego-v1',
      'superego-v1',
      'learner-v1',
      'prompt-hash',
      '"[{""turn"":0,""register"":""classroom""}]"',
      'plain response',
    ].join(',');

    assert.equal(repository.exportToCsv('eval-export'), `${CSV_HEADER}\n${expectedRow}`);
  });

  it('quotes commas, quotes, and newlines while retaining a header-only empty export', () => {
    const result = completeResult({
      scenarioName: 'A, "quoted"\nscenario',
      rawResponse: 'raw, "value"\nnext',
      idConstructionTrace: null,
    });
    const { repository } = createExportHarness([result]);
    const csv = repository.exportToCsv('eval-export');
    assert.equal(csv.includes('"A, ""quoted""\nscenario"'), true);
    assert.equal(csv.includes('"raw, ""value""\nnext"'), true);
    assert.equal(createExportHarness().repository.exportToCsv('eval-empty'), CSV_HEADER);
  });
});

describe('evaluation-store dialogue-log repository', () => {
  it('loads exact and legacy partial files and preserves malformed or missing returns', () => {
    const logsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluation-log-reader-'));
    const logsDir = path.join(logsRoot, 'tutor-dialogues');
    fs.mkdirSync(logsDir, { recursive: true });
    const repository = createDialogueLogRepository({ logsRoot });
    try {
      fs.writeFileSync(path.join(logsDir, 'dialogue-exact.json'), JSON.stringify({ dialogueId: 'dialogue-exact' }));
      fs.writeFileSync(path.join(logsDir, 'legacy-partial-suffix.json'), JSON.stringify({ dialogueId: 'legacy' }));
      fs.writeFileSync(path.join(logsDir, 'dialogue-bad.json'), '{not json');

      assert.deepEqual(repository.loadDialogueLog('dialogue-exact'), { dialogueId: 'dialogue-exact' });
      assert.deepEqual(repository.loadDialogueLog('partial-suffix'), { dialogueId: 'legacy' });
      assert.equal(repository.loadDialogueLog('dialogue-bad'), null);
      assert.equal(repository.loadDialogueLog('missing'), null);
      assert.equal(repository.loadDialogueLog(''), null);
    } finally {
      fs.rmSync(logsRoot, { recursive: true, force: true });
    }
    assert.equal(repository.loadDialogueLog('dialogue-exact'), null);
  });

  it('uses the first filesystem result for ambiguous legacy partial matches', () => {
    const fileSystem = {
      existsSync: () => false,
      readdirSync: () => ['legacy-second.json', 'legacy-first.json', 'ignored.txt'],
      readFileSync: (file) => JSON.stringify({ selected: path.basename(file) }),
    };
    const repository = createDialogueLogRepository({ logsRoot: '/logs', fileSystem });
    assert.deepEqual(repository.loadDialogueLog('legacy-'), { selected: 'legacy-second.json' });
  });

  it('verifies canonical immutable logs and returns valid tampering without verification', () => {
    const logsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluation-immutable-log-reader-'));
    const logsDir = path.join(logsRoot, 'tutor-dialogues');
    fs.mkdirSync(logsDir, { recursive: true });
    const repository = createDialogueLogRepository({ logsRoot });
    const original = { dialogueId: 'immutable', turns: [{ tutor: 'Question?' }, { learner: 'Answer.' }] };
    const contentHash = createHash('sha256')
      .update(JSON.stringify(original, null, 2))
      .digest('hex');
    const immutablePath = path.join(logsDir, `${contentHash}.json`);
    try {
      fs.writeFileSync(immutablePath, JSON.stringify(original));
      assert.deepEqual(repository.loadImmutableDialogueLog(contentHash), { log: original, verified: true });

      const tampered = { ...original, dialogueId: 'tampered' };
      fs.writeFileSync(immutablePath, JSON.stringify(tampered));
      assert.deepEqual(repository.loadImmutableDialogueLog(contentHash), { log: tampered, verified: false });

      fs.writeFileSync(immutablePath, '{not json');
      assert.deepEqual(repository.loadImmutableDialogueLog(contentHash), { log: null, verified: false });
      assert.deepEqual(repository.loadImmutableDialogueLog('missing'), { log: null, verified: false });
      assert.deepEqual(repository.loadImmutableDialogueLog(''), { log: null, verified: false });
    } finally {
      fs.rmSync(logsRoot, { recursive: true, force: true });
    }
  });

  it('keeps the facade as compatibility owner and bounds both extracted modules', () => {
    const facade = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore.js'), 'utf-8');
    const exportSource = fs.readFileSync(
      path.join(ROOT_DIR, 'services', 'evaluationStore', 'exportRepository.js'),
      'utf-8',
    );
    const logSource = fs.readFileSync(
      path.join(ROOT_DIR, 'services', 'evaluationStore', 'dialogueLogRepository.js'),
      'utf-8',
    );

    for (const method of ['exportToJson', 'exportToCsv']) {
      assert.match(exportSource, new RegExp(`function ${method}\\(`));
      assert.doesNotMatch(facade, new RegExp(`function ${method}\\(`));
      assert.match(facade, new RegExp(`export const ${method} = exportRepository\\.${method};`));
    }
    for (const method of ['loadDialogueLog', 'loadImmutableDialogueLog']) {
      assert.match(logSource, new RegExp(`function ${method}\\(`));
      assert.doesNotMatch(facade, new RegExp(`function ${method}\\(`));
      assert.match(facade, new RegExp(`export const ${method} = dialogueLogRepository\\.${method};`));
    }
    assert.equal(facade.split('\n').length - 1 <= 350, true);
    assert.equal(exportSource.split('\n').length - 1 <= 150, true);
    assert.equal(logSource.split('\n').length - 1 <= 150, true);
  });
});
