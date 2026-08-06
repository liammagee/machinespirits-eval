import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { createInteractionRepository } from '../services/evaluationStore/interactionRepository.js';
import { migrateEvaluationDatabase } from '../services/evaluationStore/migrations.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createHarness() {
  const db = new Database(':memory:');
  migrateEvaluationDatabase(db);
  db.prepare(
    `INSERT INTO evaluation_runs (
      id, created_at, description, total_scenarios, total_configurations,
      total_tests, metadata, status
    ) VALUES ('eval-interaction', '2026-08-06T06:20:00.000Z', 'interaction run', 2, 1, 3, '{}', 'running')`,
  ).run();
  return { db, repository: createInteractionRepository({ db }) };
}

function richInteraction(overrides = {}) {
  const base = {
    evalId: 'interaction-a',
    runId: 'eval-interaction',
    scenarioId: 'scenario-a',
    scenarioName: 'Scenario A',
    type: 'long_term',
    learnerProfile: 'ego_superego',
    tutorProfile: 'recognition',
    personaId: 'persona-a',
    learnerAgents: ['learner_ego', 'learner_superego'],
    metrics: {
      turnCount: 2,
      totalTokens: 120,
      learnerTokens: 45,
      tutorTokens: 75,
      totalLatencyMs: 250,
    },
    interaction: {
      turns: [
        { tutor: 'Question one?', learner: 'Attempt one.' },
        { tutor: 'Question two?', learner: 'Revised answer.' },
      ],
      writingPadSnapshots: {
        learner: { before: { hypothesis: 'old' }, after: { hypothesis: 'revised' } },
        tutor: { before: { strategy: 'probe' }, after: { strategy: 'reframe' } },
      },
      summary: {
        learnerFinalState: 'engaged',
        learnerFinalUnderstanding: 'revised model',
        uniqueOutcomes: ['self-correction'],
      },
    },
    sequenceDiagram: 'sequence',
    formattedTranscript: 'formatted transcript',
    judgeEvaluation: {
      overall_assessment: { score: 88 },
      narrative_summary: { overall_quality: 77 },
      overall_score: 66,
    },
  };

  return {
    ...base,
    ...overrides,
    metrics: { ...base.metrics, ...(overrides.metrics || {}) },
    interaction: {
      ...base.interaction,
      ...(overrides.interaction || {}),
      writingPadSnapshots: {
        ...base.interaction.writingPadSnapshots,
        ...(overrides.interaction?.writingPadSnapshots || {}),
      },
      summary: {
        ...base.interaction.summary,
        ...(overrides.interaction?.summary || {}),
      },
    },
  };
}

describe('evaluation-store interaction repository', () => {
  it('round-trips the full interaction, memory, metric, outcome, and judge record', () => {
    const { db, repository } = createHarness();
    try {
      assert.equal(repository.storeInteractionEval(richInteraction()), 'interaction-a');
      const stored = repository.getInteractionEval('interaction-a');

      assert.equal(stored.evalId, 'interaction-a');
      assert.equal(stored.runId, 'eval-interaction');
      assert.equal(stored.evalType, 'long_term');
      assert.deepEqual(stored.learnerAgents, ['learner_ego', 'learner_superego']);
      assert.deepEqual(stored.turns, [
        { tutor: 'Question one?', learner: 'Attempt one.' },
        { tutor: 'Question two?', learner: 'Revised answer.' },
      ]);
      assert.deepEqual(stored.learnerMemoryBefore, { hypothesis: 'old' });
      assert.deepEqual(stored.learnerMemoryAfter, { hypothesis: 'revised' });
      assert.deepEqual(stored.tutorMemoryBefore, { strategy: 'probe' });
      assert.deepEqual(stored.tutorMemoryAfter, { strategy: 'reframe' });
      assert.equal(stored.totalTokens, 120);
      assert.equal(stored.learnerTokens, 45);
      assert.equal(stored.tutorTokens, 75);
      assert.equal(stored.latencyMs, 250);
      assert.deepEqual(stored.uniqueOutcomes, ['self-correction']);
      assert.equal(stored.judgeOverallScore, 88);
      assert.deepEqual(stored.judgeEvaluation, richInteraction().judgeEvaluation);
      assert.deepEqual(repository.getInteractionEvalByRunId('eval-interaction'), stored);
      assert.equal(repository.getInteractionEval('missing'), null);
      assert.equal(repository.getInteractionEvalByRunId('missing'), null);
    } finally {
      db.close();
    }
  });

  it('preserves compact, filtered, latest, and chronological run projections', () => {
    const { db, repository } = createHarness();
    try {
      const records = [
        richInteraction({ evalId: 'interaction-a', scenarioId: 'scenario-a' }),
        richInteraction({ evalId: 'interaction-b', scenarioId: 'scenario-b' }),
        richInteraction({ evalId: 'interaction-c', scenarioId: 'scenario-a' }),
      ];
      for (const record of records) repository.storeInteractionEval(record);
      const setCreatedAt = db.prepare('UPDATE interaction_evaluations SET created_at = ? WHERE id = ?');
      setCreatedAt.run('2026-08-06T06:21:00.000Z', 'interaction-a');
      setCreatedAt.run('2026-08-06T06:22:00.000Z', 'interaction-b');
      setCreatedAt.run('2026-08-06T06:23:00.000Z', 'interaction-c');

      const compact = repository.listInteractionEvals({ limit: 2 });
      assert.deepEqual(
        compact.map((row) => row.evalId),
        ['interaction-c', 'interaction-b'],
      );
      assert.deepEqual(Object.keys(compact[0]), [
        'evalId',
        'runId',
        'scenarioId',
        'scenarioName',
        'evalType',
        'learnerProfile',
        'tutorProfile',
        'personaId',
        'turnCount',
        'totalTokens',
        'latencyMs',
        'finalLearnerState',
        'finalUnderstanding',
        'judgeOverallScore',
        'createdAt',
      ]);
      assert.deepEqual(
        repository.listInteractionEvals({ scenarioId: 'scenario-a' }).map((row) => row.evalId),
        ['interaction-c', 'interaction-a'],
      );
      assert.equal(repository.getInteractionEvalByRunId('eval-interaction').evalId, 'interaction-c');

      const byRun = repository.listInteractionEvalsByRunId('eval-interaction');
      assert.deepEqual(
        byRun.map((row) => row.evalId),
        ['interaction-a', 'interaction-b', 'interaction-c'],
      );
      assert.equal('learnerAgents' in byRun[0], true);
      assert.equal('turns' in byRun[0], true);
      assert.equal('learnerMemoryBefore' in byRun[0], false);
      assert.equal('sequenceDiagram' in byRun[0], false);
      assert.deepEqual(repository.listInteractionEvalsByRunId('missing'), []);
    } finally {
      db.close();
    }
  });

  it('updates learner per-turn and holistic scores without clobbering interaction or judge data', () => {
    const { db, repository } = createHarness();
    try {
      repository.storeInteractionEval(richInteraction());
      repository.updateInteractionLearnerScores('interaction-a', {
        scores: { 0: { understanding: { score: 3 } }, 1: { understanding: { score: 5 } } },
        overallScore: 80,
        judgeModel: 'judge-learner',
        holisticScores: { trajectory: { score: 4 } },
        holisticOverallScore: 82,
        holisticSummary: 'learner revised the initial model',
        holisticJudgeModel: 'judge-learner-holistic',
      });

      const stored = repository.getInteractionEval('interaction-a');
      assert.deepEqual(stored.learnerScores, {
        0: { understanding: { score: 3 } },
        1: { understanding: { score: 5 } },
      });
      assert.equal(stored.learnerOverallScore, 80);
      assert.equal(stored.learnerJudgeModel, 'judge-learner');
      assert.deepEqual(stored.learnerHolisticScores, { trajectory: { score: 4 } });
      assert.equal(stored.learnerHolisticOverallScore, 82);
      assert.equal(stored.learnerHolisticSummary, 'learner revised the initial model');
      assert.equal(stored.learnerHolisticJudgeModel, 'judge-learner-holistic');
      assert.equal(stored.judgeOverallScore, 88);
      assert.equal(stored.turnCount, 2);
      assert.deepEqual(stored.uniqueOutcomes, ['self-correction']);
      assert.doesNotThrow(() => repository.updateInteractionLearnerScores('missing', {}));
    } finally {
      db.close();
    }
  });

  it('preserves default, turn-count, and judge-score fallback semantics', () => {
    const { db, repository } = createHarness();
    try {
      repository.storeInteractionEval(
        richInteraction({
          evalId: 'interaction-zero',
          type: '',
          tutorProfile: '',
          learnerAgents: null,
          metrics: { turnCount: 0 },
          judgeEvaluation: {
            overall_assessment: { score: 0 },
            narrative_summary: { overall_quality: 70 },
            overall_score: 80,
          },
        }),
      );
      repository.storeInteractionEval(
        richInteraction({
          evalId: 'interaction-narrative',
          judgeEvaluation: { narrative_summary: { overall_quality: 71 }, overall_score: 80 },
        }),
      );
      repository.storeInteractionEval(
        richInteraction({ evalId: 'interaction-overall', judgeEvaluation: { overall_score: 64 } }),
      );

      const zero = repository.getInteractionEval('interaction-zero');
      assert.equal(zero.evalType, 'short_term');
      assert.equal(zero.tutorProfile, 'default');
      assert.deepEqual(zero.learnerAgents, []);
      assert.equal(zero.turnCount, 2, 'zero falls back to the authored turn array length');
      assert.equal(zero.judgeOverallScore, 0, 'a zero top-priority score is not skipped');
      assert.equal(repository.getInteractionEval('interaction-narrative').judgeOverallScore, 71);
      assert.equal(repository.getInteractionEval('interaction-overall').judgeOverallScore, 64);
    } finally {
      db.close();
    }
  });

  it('keeps the facade as compatibility owner and bounds the extracted repository', () => {
    const facade = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore.js'), 'utf-8');
    const repository = fs.readFileSync(
      path.join(ROOT_DIR, 'services', 'evaluationStore', 'interactionRepository.js'),
      'utf-8',
    );
    const methods = [
      'storeInteractionEval',
      'listInteractionEvals',
      'getInteractionEval',
      'getInteractionEvalByRunId',
      'listInteractionEvalsByRunId',
      'updateInteractionLearnerScores',
    ];

    for (const method of methods) {
      assert.match(repository, new RegExp(`function ${method}\\(`));
      assert.doesNotMatch(facade, new RegExp(`function ${method}\\(`));
      assert.match(facade, new RegExp(`export const ${method} = interactionRepository\\.${method};`));
    }
    assert.equal(facade.split('\n').length - 1 <= 350, true);
    assert.equal(repository.split('\n').length - 1 <= 225, true);
  });
});
