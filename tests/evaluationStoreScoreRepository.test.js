import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { migrateEvaluationDatabase } from '../services/evaluationStore/migrations.js';
import { createScoreRepository } from '../services/evaluationStore/scoreRepository.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXED_NOW = Date.parse('2026-08-06T06:00:00.000Z');

function createHarness() {
  const db = new Database(':memory:');
  migrateEvaluationDatabase(db);
  db.prepare(
    `INSERT INTO evaluation_runs (
      id, created_at, description, total_scenarios, total_configurations,
      total_tests, metadata, status
    ) VALUES ('eval-score', '2026-08-06T05:50:00.000Z', 'score run', 1, 1, 2, '{}', 'running')`,
  ).run();

  let nextResultId = 0;
  const seedResult = () => {
    nextResultId += 1;
    const info = db
      .prepare(
        `INSERT INTO evaluation_results (
        run_id, scenario_id, provider, model, profile_name, success, overall_score,
        tutor_first_turn_score, created_at
      ) VALUES ('eval-score', ?, 'test-provider', 'test-model', 'cell_score', 1, 70, 70, ?)`,
      )
      .run(`scenario-${nextResultId}`, `2026-08-06T05:5${nextResultId}:00.000Z`);
    return Number(info.lastInsertRowid);
  };

  const repository = createScoreRepository({
    db,
    getTutorRubricVersion: () => '2.2',
    getLearnerRubricVersion: () => '2.2',
    getDialogueRubricVersion: () => '1.0',
    getDeliberationRubricVersion: () => '1.0',
    getCharismaRubricVersion: () => '1.0',
    now: () => FIXED_NOW,
  });

  return { db, repository, seedResult };
}

function auditColumns(repository, resultId, operation) {
  return repository
    .getScoreAudit(resultId)
    .filter((entry) => entry.operation === operation)
    .map((entry) => entry.column_name)
    .sort();
}

describe('evaluation-store score repository', () => {
  it('owns legacy score overwrite and records only changed audited columns', () => {
    const { db, repository, seedResult } = createHarness();
    try {
      const resultId = seedResult();
      const evaluation = {
        scores: {
          relevance: { score: 5 },
          specificity: { score: 4 },
          pedagogical: { score: 3 },
          personalization: { score: 2 },
          actionability: { score: 4 },
          tone: { score: 5 },
        },
        tutorFirstTurnScore: 84,
        baseScore: 80,
        recognitionScore: 88,
        passesRequired: true,
        passesForbidden: true,
        judgeModel: 'judge-legacy',
        summary: 'updated judgment',
        judgeLatencyMs: 12,
      };

      repository.updateResultScores(resultId, evaluation);
      const row = db.prepare('SELECT * FROM evaluation_results WHERE id = ?').get(resultId);
      assert.equal(row.overall_score, 84);
      assert.equal(row.tutor_first_turn_score, 84);
      assert.equal(row.judge_model, 'judge-legacy');
      assert.equal(row.tutor_rubric_version, '2.2');
      assert.equal(row.scoring_method, 'rubric');

      const firstAudit = repository.getScoreAudit(resultId);
      assert.deepEqual(auditColumns(repository, resultId, 'updateResultScores'), [
        'judge_model',
        'overall_score',
        'score_actionability',
        'score_pedagogical',
        'score_personalization',
        'score_relevance',
        'score_specificity',
        'score_tone',
        'tutor_first_turn_score',
        'tutor_rubric_version',
      ]);
      repository.updateResultScores(resultId, evaluation);
      assert.equal(repository.getScoreAudit(resultId).length, firstAudit.length, 'identical writes add no audit rows');
      assert.equal(repository.getScoreAuditByRun('eval-score').length, firstAudit.length);
    } finally {
      db.close();
    }
  });

  it('preserves bilateral tutor and learner score axes without cross-clobbering', () => {
    const { db, repository, seedResult } = createHarness();
    try {
      const resultId = seedResult();
      repository.updateResultTutorScores(resultId, {
        tutorScores: { 0: { scores: { content_accuracy: 4 }, overallScore: 82 } },
        tutorOverallScore: 82,
        tutorFirstTurnScore: 80,
        tutorLastTurnScore: 84,
        tutorDevelopmentScore: 4,
        judgeModel: 'judge-tutor',
        judgeLatencyMs: 20,
      });
      repository.updateResultTutorHolisticScores(resultId, {
        holisticScores: { trajectory: { score: 4 } },
        holisticOverallScore: 86,
        holisticSummary: 'tutor trajectory',
        holisticJudgeModel: 'judge-tutor-holistic',
      });
      repository.updateResultLearnerScores(resultId, {
        scores: { 0: { understanding: { score: 3 } } },
        overallScore: 76,
        judgeModel: 'judge-learner',
        holisticScores: { trajectory: { score: 3 } },
        holisticOverallScore: 78,
        holisticSummary: 'learner trajectory',
        holisticJudgeModel: 'judge-learner-holistic',
      });

      const row = db.prepare('SELECT * FROM evaluation_results WHERE id = ?').get(resultId);
      assert.deepEqual(JSON.parse(row.tutor_scores), {
        0: { scores: { content_accuracy: 4 }, overallScore: 82 },
      });
      assert.equal(row.tutor_overall_score, 82);
      assert.equal(row.tutor_holistic_overall_score, 86);
      assert.deepEqual(JSON.parse(row.learner_scores), { 0: { understanding: { score: 3 } } });
      assert.equal(row.learner_overall_score, 76);
      assert.equal(row.learner_holistic_overall_score, 78);
      assert.equal(row.tutor_rubric_version, '2.2');
      assert.equal(row.learner_rubric_version, '2.2');

      const operations = new Set(repository.getScoreAudit(resultId).map((entry) => entry.operation));
      assert.deepEqual(
        operations,
        new Set(['updateResultTutorScores', 'updateResultTutorHolisticScores', 'updateResultLearnerScores']),
      );
    } finally {
      db.close();
    }
  });

  it('keeps tutor and learner deliberation persistence structurally mirrored', () => {
    const { db, repository, seedResult } = createHarness();
    try {
      const tutorResultId = seedResult();
      const learnerResultId = seedResult();
      repository.updateTutorDeliberationScores(tutorResultId, {
        deliberationScores: { critique_quality: { score: 4 } },
        deliberationScore: 81,
        deliberationSummary: 'tutor deliberation',
        deliberationJudgeModel: 'judge-deliberation',
      });
      repository.updateLearnerDeliberationScores(learnerResultId, {
        deliberationScores: { critique_quality: { score: 4 } },
        deliberationScore: 81,
        deliberationSummary: 'learner deliberation',
        deliberationJudgeModel: 'judge-deliberation',
      });

      const tutorRow = db.prepare('SELECT * FROM evaluation_results WHERE id = ?').get(tutorResultId);
      const learnerRow = db.prepare('SELECT * FROM evaluation_results WHERE id = ?').get(learnerResultId);
      assert.deepEqual(
        JSON.parse(tutorRow.tutor_deliberation_scores),
        JSON.parse(learnerRow.learner_deliberation_scores),
      );
      assert.equal(tutorRow.tutor_deliberation_score, learnerRow.learner_deliberation_score);
      assert.equal(tutorRow.deliberation_rubric_version, learnerRow.deliberation_rubric_version);

      const tutorColumns = auditColumns(repository, tutorResultId, 'updateTutorDeliberationScores').map((column) =>
        column.replace(/^tutor_/, 'side_'),
      );
      const learnerColumns = auditColumns(repository, learnerResultId, 'updateLearnerDeliberationScores').map(
        (column) => column.replace(/^learner_/, 'side_'),
      );
      assert.deepEqual(tutorColumns, learnerColumns);
    } finally {
      db.close();
    }
  });

  it('owns encounter, process, charisma, register, and id-construction mutations', () => {
    const { db, repository, seedResult } = createHarness();
    try {
      const resultId = seedResult();
      repository.updateTutorLastTurnScore(resultId, { tutorLastTurnScore: 75 });
      repository.updateDialogueQualityScore(resultId, {
        dialogueQualityScore: 79,
        dialogueQualityScores: { reciprocity: { score: 4 } },
        dialogueQualitySummary: 'public encounter',
        dialogueQualityJudgeModel: 'judge-dialogue',
      });
      repository.updateDialogueQualityInternalScore(resultId, {
        dialogueQualityInternalScore: 83,
        dialogueQualityInternalScores: { coherence: { score: 4 } },
        dialogueQualityInternalSummary: 'full trace',
      });
      repository.updateProcessMeasures(resultId, {
        adaptationIndex: 0.4,
        learnerGrowthIndex: 0.6,
        bilateralTransformationIndex: 0.5,
        incorporationRate: 0.7,
        dimensionConvergence: 0.8,
        transformationQuality: 77,
      });
      repository.updateResultTutorCharismaScores(resultId, {
        charismaScores: { calling: { score: 4 } },
        charismaOverallScore: 74,
        charismaJudgeModel: 'judge-charisma',
      });
      repository.updateResultTutorRegisterScore(resultId, {
        register: 'classroom_witness',
        sliceKey: 'turn-0',
        scores: { domain_specificity: 5 },
        overall: 88,
        judgeModel: 'judge-register',
      });
      repository.setIdConstructionTrace(resultId, [{ turn: 0, construction: { persona: 'witness' } }]);

      const row = db.prepare('SELECT * FROM evaluation_results WHERE id = ?').get(resultId);
      assert.equal(row.tutor_last_turn_score, 75);
      assert.equal(row.tutor_development_score, 5);
      assert.equal(row.dialogue_quality_score, 79);
      assert.equal(row.dialogue_quality_internal_score, 83);
      assert.equal(row.bilateral_transformation_index, 0.5);
      assert.equal(row.tutor_charisma_overall_score, 74);
      assert.equal(
        JSON.parse(row.tutor_register_scores).classroom_witness['turn-0'].scored_at,
        '2026-08-06T06:00:00.000Z',
      );
      assert.deepEqual(JSON.parse(row.id_construction_trace), [{ turn: 0, construction: { persona: 'witness' } }]);

      const operations = new Set(repository.getScoreAudit(resultId).map((entry) => entry.operation));
      for (const operation of [
        'updateTutorLastTurnScore',
        'updateDialogueQualityScore',
        'updateDialogueQualityInternalScore',
        'updateProcessMeasures',
        'updateResultTutorCharismaScores',
        'updateResultTutorRegisterScore',
      ]) {
        assert.equal(operations.has(operation), true, `${operation} must retain audit coverage`);
      }
    } finally {
      db.close();
    }
  });

  it('keeps the facade as bootstrap/compatibility owner with a bounded score repository', () => {
    const facade = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore.js'), 'utf8');
    const repository = fs.readFileSync(
      path.join(ROOT_DIR, 'services', 'evaluationStore', 'scoreRepository.js'),
      'utf8',
    );

    assert.match(facade, /createScoreRepository\(\{/);
    assert.doesNotMatch(facade, /UPDATE evaluation_results SET|INSERT INTO score_audit/);
    assert.match(repository, /function updateResultTutorScores/);
    assert.match(repository, /function updateResultLearnerScores/);
    assert.match(repository, /function getScoreAuditByRun/);
    assert.equal(facade.split('\n').length - 1 <= 975, true);
    assert.equal(repository.split('\n').length - 1 <= 750, true);
  });
});
