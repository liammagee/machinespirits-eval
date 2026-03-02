
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { 
  createRun, 
  storeResult, 
  getRunStats, 
  updateResultTutorScores 
} from '../services/evaluationStore.js';
import { generateReport } from '../services/evaluationRunner.js';

describe('Dynamic Dimensions Support', () => {
  const testRunIds = [];

  afterEach(() => {
    // We don't have a formal "deleteRun" but we can track them
  });

  it('aggregates Rubric 2.2+ dimensions from tutor_scores in getRunStats', () => {
    const run = createRun({ description: 'dynamic dimensions test' });
    testRunIds.push(run.id);

    const resultId = storeResult(run.id, {
      scenarioId: 'scen-1',
      scenarioName: 'Scenario 1',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_1',
      success: true,
    });

    // Rubric 2.2+ style tutor_scores (per-turn JSON)
    const tutorScores = {
      "0": {
        "scores": {
          "perception_quality": 4,
          "pedagogical_craft": 3,
          "elicitation_quality": 5
        },
        "overallScore": 80
      },
      "1": {
        "scores": {
          "perception_quality": 5,
          "pedagogical_craft": 4,
          "elicitation_quality": 4
        },
        "overallScore": 90
      }
    };

    updateResultTutorScores(resultId, {
      tutorScores,
      tutorOverallScore: 85,
      tutorFirstTurnScore: 80,
      tutorLastTurnScore: 90,
      tutorDevelopmentScore: 10
    });

    const stats = getRunStats(run.id);
    assert.strictEqual(stats.length, 1);
    const s = stats[0];

    // Verify dimensions were aggregated (averaged)
    // perception_quality: (4 + 5) / 2 = 4.5
    // pedagogical_craft: (3 + 4) / 2 = 3.5
    // elicitation_quality: (5 + 4) / 2 = 4.5
    assert.strictEqual(s.dimensions.perception_quality, 4.5);
    assert.strictEqual(s.dimensions.pedagogical_craft, 3.5);
    assert.strictEqual(s.dimensions.elicitation_quality, 4.5);
  });

  it('generateReport dynamically displays new dimensions', () => {
    const run = createRun({ description: 'report dynamic dims test' });
    testRunIds.push(run.id);

    const resultId = storeResult(run.id, {
      scenarioId: 'scen-1',
      scenarioName: 'Scenario 1',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_1',
      success: true,
    });

    const tutorScores = {
      "0": {
        "scores": {
          "perception_quality": 5,
          "new_custom_dimension": 4
        },
        "overallScore": 90
      }
    };

    updateResultTutorScores(resultId, {
      tutorScores,
      tutorOverallScore: 90
    });

    const report = generateReport(run.id);
    
    // Check if new dimensions appear in the report
    assert.ok(report.includes('perception_quality'), 'Should include perception_quality in report');
    assert.ok(report.includes('new_custom_dimension'), 'Should include new_custom_dimension in report');
    assert.ok(report.includes('5.00'), 'Should show the score for perception_quality');
    assert.ok(report.includes('4.00'), 'Should show the score for new_custom_dimension');
  });

  it('falls back to legacy dimensions if tutor_scores is missing', () => {
    const run = createRun({ description: 'legacy fallback test' });
    testRunIds.push(run.id);

    storeResult(run.id, {
      scenarioId: 'scen-legacy',
      scenarioName: 'Legacy Scenario',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_1',
      success: true,
      tutorFirstTurnScore: 75,
      scores: {
        relevance: 4,
        tone: 5
      }
    });

    const stats = getRunStats(run.id);
    assert.strictEqual(stats[0].dimensions.relevance, 4);
    assert.strictEqual(stats[0].dimensions.tone, 5);

    const report = generateReport(run.id);
    assert.ok(report.includes('relevance'), 'Should include legacy dimension');
    assert.ok(report.includes('tone'), 'Should include legacy dimension');
    assert.ok(report.includes('4.00'), 'Should show legacy score');
  });
});
