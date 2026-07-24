/**
 * Tests for rubricEvaluator — score functions and JSON parsing.
 *
 * Covers:
 *   - calculateBaseScore() — weighted base score from 7 base dimensions (v2.2)
 *   - calculateRecognitionScore() — weighted recognition score from 1 treatment dimension (v2.2)
 *   - calculateOverallScore() — combined weighted score across all 8 dimensions (v2.2)
 *   - parseJudgeResponse() — production JSON parsing and repair fallback chain
 *
 * These are pure functions (except for evalConfigLoader dependency) so they're
 * straightforward to test. The score functions use the actual rubric config
 * from config/evaluation-rubric.yaml via evalConfigLoader.getRubricDimensions().
 *
 * v2.2 dimensions (8 total):
 *   Base (7): perception_quality, pedagogical_craft, elicitation_quality,
 *             adaptive_responsiveness, productive_difficulty, epistemic_integrity,
 *             content_accuracy
 *   Treatment (1): recognition_quality
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateBaseScore,
  calculateRecognitionScore,
  calculateOverallScore,
  calculateRecognitionMetrics,
  calculateDialogueQualityScore,
  buildDialogueQualityPrompt,
  buildEvaluationPrompt,
  buildTutorHolisticEvaluationPrompt,
  buildTutorDeliberationPrompt,
  buildLearnerDeliberationPrompt,
  parseJudgeResponse,
  loadRubricYaml,
  getRubricDimensions,
  loadDialogueRubric,
  getDialogueDimensions,
} from '../services/rubricEvaluator.js';
import { clearRubricPathOverride, setRubricPathOverride } from '../services/evalConfigLoader.js';

// ============================================================================
// Score Calculation Tests
// ============================================================================

// Helper: build scores object with {score, reasoning} shape
function makeScores(values) {
  const result = {};
  for (const [key, val] of Object.entries(values)) {
    result[key] = typeof val === 'object' ? val : { score: val, reasoning: 'test' };
  }
  return result;
}

// Helper: assert approximate equality to handle floating point precision
function assertApprox(actual, expected, message, tolerance = 0.01) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${message || ''} expected ~${expected}, got ${actual}`);
}

describe('calculateBaseScore', () => {
  it('returns null for empty scores', () => {
    assert.strictEqual(calculateBaseScore({}), null);
  });

  it('returns null for scores with no base dimensions', () => {
    const scores = makeScores({
      recognition_quality: 5,
    });
    assert.strictEqual(calculateBaseScore(scores), null);
  });

  it('returns 100 when all base dimensions are 5', () => {
    const scores = makeScores({
      perception_quality: 5,
      pedagogical_craft: 5,
      elicitation_quality: 5,
      adaptive_responsiveness: 5,
      productive_difficulty: 5,
      epistemic_integrity: 5,
      content_accuracy: 5,
    });
    assertApprox(calculateBaseScore(scores), 100, 'all-5s base');
  });

  it('returns 0 when all base dimensions are 1', () => {
    const scores = makeScores({
      perception_quality: 1,
      pedagogical_craft: 1,
      elicitation_quality: 1,
      adaptive_responsiveness: 1,
      productive_difficulty: 1,
      epistemic_integrity: 1,
      content_accuracy: 1,
    });
    assertApprox(calculateBaseScore(scores), 0, 'all-1s base');
  });

  it('returns 50 when all base dimensions are 3', () => {
    const scores = makeScores({
      perception_quality: 3,
      pedagogical_craft: 3,
      elicitation_quality: 3,
      adaptive_responsiveness: 3,
      productive_difficulty: 3,
      epistemic_integrity: 3,
      content_accuracy: 3,
    });
    assertApprox(calculateBaseScore(scores), 50, 'all-3s base');
  });

  it('handles partial base dimensions', () => {
    // With only some dimensions present, should still calculate from what's available
    const scores = makeScores({
      perception_quality: 5,
      pedagogical_craft: 5,
    });
    const result = calculateBaseScore(scores);
    assert.strictEqual(result, 100, 'available dimensions all at 5 should give 100');
  });

  it('handles plain number scores (not wrapped in objects)', () => {
    const scores = {
      perception_quality: 4,
      pedagogical_craft: 4,
      elicitation_quality: 4,
      adaptive_responsiveness: 4,
      productive_difficulty: 4,
      epistemic_integrity: 4,
      content_accuracy: 4,
    };
    assertApprox(calculateBaseScore(scores), 75, 'all-4s plain numbers');
  });

  it('ignores treatment dimensions', () => {
    const scores = makeScores({
      perception_quality: 5,
      pedagogical_craft: 5,
      elicitation_quality: 5,
      adaptive_responsiveness: 5,
      productive_difficulty: 5,
      epistemic_integrity: 5,
      content_accuracy: 5,
      recognition_quality: 1,
    });
    assertApprox(calculateBaseScore(scores), 100, 'base should ignore treatment dims');
  });
});

describe('calculateRecognitionScore', () => {
  it('returns null for empty scores', () => {
    assert.strictEqual(calculateRecognitionScore({}), null);
  });

  it('returns null for scores with only base dimensions', () => {
    const scores = makeScores({
      perception_quality: 5,
      pedagogical_craft: 5,
      elicitation_quality: 5,
    });
    assert.strictEqual(calculateRecognitionScore(scores), null);
  });

  it('returns 100 when treatment dimension is 5', () => {
    const scores = makeScores({
      recognition_quality: 5,
    });
    assert.strictEqual(calculateRecognitionScore(scores), 100);
  });

  it('returns 0 when treatment dimension is 1', () => {
    const scores = makeScores({
      recognition_quality: 1,
    });
    assert.strictEqual(calculateRecognitionScore(scores), 0);
  });

  it('returns ~50 when treatment dimension is 3', () => {
    const scores = makeScores({
      recognition_quality: 3,
    });
    const result = calculateRecognitionScore(scores);
    assert.ok(Math.abs(result - 50) < 0.01, `Expected ~50, got ${result}`);
  });

  it('ignores base dimensions', () => {
    const scores = makeScores({
      perception_quality: 1,
      pedagogical_craft: 1,
      recognition_quality: 5,
    });
    assert.strictEqual(calculateRecognitionScore(scores), 100);
  });
});

describe('calculateOverallScore', () => {
  it('returns null for empty scores', () => {
    assert.strictEqual(calculateOverallScore({}), null);
  });

  it('returns 100 when all dimensions are 5', () => {
    const scores = makeScores({
      perception_quality: 5,
      pedagogical_craft: 5,
      elicitation_quality: 5,
      adaptive_responsiveness: 5,
      productive_difficulty: 5,
      epistemic_integrity: 5,
      content_accuracy: 5,
      recognition_quality: 5,
    });
    assertApprox(calculateOverallScore(scores), 100, 'all-5s overall');
  });

  it('returns 0 when all dimensions are 1', () => {
    const scores = makeScores({
      perception_quality: 1,
      pedagogical_craft: 1,
      elicitation_quality: 1,
      adaptive_responsiveness: 1,
      productive_difficulty: 1,
      epistemic_integrity: 1,
      content_accuracy: 1,
      recognition_quality: 1,
    });
    assertApprox(calculateOverallScore(scores), 0, 'all-1s overall');
  });

  it('returns 50 when all dimensions are 3', () => {
    const scores = makeScores({
      perception_quality: 3,
      pedagogical_craft: 3,
      elicitation_quality: 3,
      adaptive_responsiveness: 3,
      productive_difficulty: 3,
      epistemic_integrity: 3,
      content_accuracy: 3,
      recognition_quality: 3,
    });
    assertApprox(calculateOverallScore(scores), 50, 'all-3s overall');
  });

  it('is between baseScore and recognitionScore when they differ', () => {
    const scores = makeScores({
      perception_quality: 5,
      pedagogical_craft: 5,
      elicitation_quality: 5,
      adaptive_responsiveness: 5,
      productive_difficulty: 5,
      epistemic_integrity: 5,
      content_accuracy: 5,
      recognition_quality: 1,
    });
    const overall = calculateOverallScore(scores);
    const base = calculateBaseScore(scores);
    const recog = calculateRecognitionScore(scores);
    assert.ok(overall > recog, `overall (${overall}) should be > recognition (${recog})`);
    assert.ok(overall < base, `overall (${overall}) should be < base (${base})`);
  });

  it('weights base group at 0.85 and treatment at 0.15', () => {
    // v2.2 weights: 7 base dims sum to 0.85, 1 treatment dim = 0.15
    // All base=5 (100), treatment=1 (0) => overall = 0.85*100 + 0.15*0 = 85
    const scores = makeScores({
      perception_quality: 5,
      pedagogical_craft: 5,
      elicitation_quality: 5,
      adaptive_responsiveness: 5,
      productive_difficulty: 5,
      epistemic_integrity: 5,
      content_accuracy: 5,
      recognition_quality: 1,
    });
    const result = calculateOverallScore(scores);
    assertApprox(result, 85, 'base=100, treatment=0 should give 85');
  });
});

// ============================================================================
// calculateRecognitionMetrics
// ============================================================================

describe('calculateRecognitionMetrics', () => {
  it('returns hasRecognitionData=false for empty scores', () => {
    const metrics = calculateRecognitionMetrics({});
    assert.strictEqual(metrics.hasRecognitionData, false);
    assert.strictEqual(metrics.recognitionScore, 0);
  });

  it('returns correct thresholds for high scores', () => {
    const scores = makeScores({
      mutual_recognition: 5,
      dialectical_responsiveness: 4,
      memory_integration: 3,
      transformative_potential: 4,
      tutor_adaptation: 4,
      learner_growth: 4,
    });
    const metrics = calculateRecognitionMetrics(scores);
    assert.strictEqual(metrics.hasRecognitionData, true);
    assert.strictEqual(metrics.mutualAcknowledgment, true, 'mutual_recognition >= 4');
    assert.strictEqual(metrics.memoryUtilization, true, 'memory_integration >= 3');
    assert.strictEqual(metrics.transformationRate, true, 'transformative_potential >= 4');
    assert.strictEqual(metrics.tutorAdaptation, true, 'tutor_adaptation >= 4');
    assert.strictEqual(metrics.learnerGrowth, true, 'learner_growth >= 4');
    assert.strictEqual(metrics.bilateralTransformation, true, 'both tutor and learner adapt');
  });

  it('returns correct thresholds for low scores', () => {
    const scores = makeScores({
      mutual_recognition: 2,
      dialectical_responsiveness: 2,
      memory_integration: 2,
      transformative_potential: 2,
      tutor_adaptation: 2,
      learner_growth: 2,
    });
    const metrics = calculateRecognitionMetrics(scores);
    assert.strictEqual(metrics.mutualAcknowledgment, false);
    assert.strictEqual(metrics.memoryUtilization, false);
    assert.strictEqual(metrics.transformationRate, false);
    assert.strictEqual(metrics.tutorAdaptation, false);
    assert.strictEqual(metrics.learnerGrowth, false);
    assert.strictEqual(metrics.bilateralTransformation, false);
  });

  it('bilateralTransformation requires both tutor and learner adaptation', () => {
    const scores = makeScores({
      tutor_adaptation: 5,
      learner_growth: 2,
    });
    const metrics = calculateRecognitionMetrics(scores);
    assert.strictEqual(metrics.bilateralTransformation, false, 'needs both >= 4');
  });

  it('recognitionScore is the average of all scored dimensions', () => {
    const scores = makeScores({
      mutual_recognition: 4,
      dialectical_responsiveness: 4,
      memory_integration: 4,
      transformative_potential: 4,
    });
    const metrics = calculateRecognitionMetrics(scores);
    assert.strictEqual(metrics.recognitionScore, 4);
  });

  it('only counts recognition dimensions, not base dimensions', () => {
    const scores = makeScores({
      relevance: 5,
      specificity: 5,
      mutual_recognition: 2,
    });
    const metrics = calculateRecognitionMetrics(scores);
    assert.strictEqual(metrics.recognitionScore, 2, 'should only average mutual_recognition');
    assert.strictEqual(metrics.hasRecognitionData, true);
  });
});

// ============================================================================
// parseJudgeResponse (production export)
// ============================================================================

const VERSIONED_TUTOR_RUBRICS = [
  { version: '2.1', path: 'config/rubrics/v2.1/evaluation-rubric.yaml', expectedDimensions: 14 },
  { version: '2.2', path: 'config/rubrics/v2.2/evaluation-rubric.yaml', expectedDimensions: 8 },
];

function versionedDimensionNames({ path: rubricPath, expectedDimensions }) {
  const rubric = loadRubricYaml(rubricPath, { forceReload: true });
  const dimensions = Object.keys(getRubricDimensions(rubric));
  assert.strictEqual(dimensions.length, expectedDimensions);
  return dimensions;
}

describe('parseJudgeResponse — valid JSON', () => {
  it('parses clean JSON object', () => {
    const input = JSON.stringify({
      scores: { relevance: { score: 4, reasoning: 'good' } },
      overall_score: 80,
      summary: 'test',
    });
    const result = parseJudgeResponse(input);
    assert.strictEqual(result.overall_score, 80);
    assert.strictEqual(result.scores.relevance.score, 4);
  });

  it('parses JSON wrapped in markdown code block', () => {
    const json = JSON.stringify({
      scores: { relevance: { score: 5, reasoning: 'excellent' } },
      overall_score: 95,
      summary: 'great',
    });
    const input = '```json\n' + json + '\n```';
    const result = parseJudgeResponse(input);
    assert.strictEqual(result.overall_score, 95);
  });

  it('parses JSON wrapped in markdown code block without json tag', () => {
    const json = JSON.stringify({
      scores: { relevance: { score: 3, reasoning: 'ok' } },
      overall_score: 60,
      summary: 'adequate',
    });
    const input = '```\n' + json + '\n```';
    const result = parseJudgeResponse(input);
    assert.strictEqual(result.overall_score, 60);
  });

  it('parses JSON with preamble and postamble text', () => {
    const json = JSON.stringify({
      scores: { relevance: { score: 4, reasoning: 'good' } },
      overall_score: 78,
      summary: 'solid',
    });
    const input = 'Here is my evaluation:\n\n' + json + '\n\nI hope this helps.';
    const result = parseJudgeResponse(input);
    assert.strictEqual(result.overall_score, 78);
  });
});

describe('parseJudgeResponse — trailing commas', () => {
  it('handles trailing comma before closing brace', () => {
    const input =
      '{"scores": {"relevance": {"score": 4, "reasoning": "good"},}, "overall_score": 75, "summary": "ok",}';
    const result = parseJudgeResponse(input);
    assert.strictEqual(result.overall_score, 75);
  });

  it('handles trailing comma before closing bracket', () => {
    const input = '{"items": [1, 2, 3,], "total": 6}';
    const result = parseJudgeResponse(input);
    assert.deepStrictEqual(result.items, [1, 2, 3]);
  });
});

describe('parseJudgeResponse — unescaped quotes', () => {
  it('repairs unescaped double quotes inside string values', () => {
    // This is the exact pattern that breaks: "Says "great job" which is encouraging"
    const input =
      '{"scores": {"relevance": {"score": 4, "reasoning": "Says \'great job\' which is encouraging"}}, "overall_score": 80, "summary": "ok"}';
    const result = parseJudgeResponse(input);
    assert.strictEqual(result.scores.relevance.score, 4);
  });
});

describe('parseJudgeResponse — versioned malformed rubric corpus', () => {
  for (const rubricCase of VERSIONED_TUTOR_RUBRICS) {
    it(`repairs trailing commas while preserving every v${rubricCase.version} dimension`, () => {
      const dimensionNames = versionedDimensionNames(rubricCase);
      const scores = dimensionNames.map((dimension) => `"${dimension}":{"score":4,"reasoning":"ok"}`).join(',');
      const input = `{"scores":{${scores},},"overall_score":75,"summary":"v${rubricCase.version}",}`;

      const result = parseJudgeResponse(input);

      assert.deepStrictEqual(Object.keys(result.scores), dimensionNames);
      assert.strictEqual(result.overall_score, 75);
    });

    it(`regex-rescues configured v${rubricCase.version} dimensions from irreparable JSON`, () => {
      const dimensionNames = versionedDimensionNames(rubricCase);
      const rescuedDimensions = dimensionNames.slice(0, 4);
      const scoreFragments = rescuedDimensions
        .map((dimension, index) => `"${dimension}":{"score":${index + 2},`)
        .join('');
      const input = `{"scores":{${scoreFragments} BROKEN JSON HERE "overall_score":72,"summary":"partial rescue"}`;

      setRubricPathOverride(rubricCase.path);
      try {
        const result = parseJudgeResponse(input);
        assert.deepStrictEqual(Object.keys(result.scores), rescuedDimensions);
        rescuedDimensions.forEach((dimension, index) => {
          assert.strictEqual(result.scores[dimension].score, index + 2);
          assert.strictEqual(result.scores[dimension].reasoning, null);
        });
        assert.strictEqual(result.overall_score, 72);
        assert.strictEqual(result.summary, 'partial rescue');
      } finally {
        clearRubricPathOverride();
      }
    });
  }
});

describe('parseJudgeResponse — regex rescue threshold', () => {
  it('returns null-like behavior for complete garbage (less than 3 scores)', () => {
    const input = 'This is not JSON at all, just random text with no scores.';
    assert.throws(() => parseJudgeResponse(input), /Could not parse/);
  });
});

describe('parseJudgeResponse — error cases', () => {
  it('throws on completely empty input', () => {
    assert.throws(() => parseJudgeResponse(''), /Could not parse/);
  });

  it('throws on input with no braces', () => {
    assert.throws(() => parseJudgeResponse('No JSON here at all'), /Could not parse/);
  });

  it('throws on input with only opening brace', () => {
    assert.throws(() => parseJudgeResponse('{ broken'), /Could not parse/);
  });
});

describe('parseJudgeResponse — full evaluation response', () => {
  it('parses a realistic judge response with all v2.2 dimensions', () => {
    const response = `\`\`\`json
{
  "scores": {
    "perception_quality": {"score": 4, "reasoning": "Matches idle state well"},
    "pedagogical_craft": {"score": 5, "reasoning": "Names exact lecture"},
    "elicitation_quality": {"score": 4, "reasoning": "Uses scaffolding"},
    "adaptive_responsiveness": {"score": 3, "reasoning": "Some adjustment"},
    "productive_difficulty": {"score": 5, "reasoning": "Sustains tension"},
    "epistemic_integrity": {"score": 4, "reasoning": "Honest about complexity"},
    "content_accuracy": {"score": 4, "reasoning": "Accurate content"},
    "recognition_quality": {"score": 3, "reasoning": "Acknowledges interpretation"}
  },
  "validation": {
    "passes_required": true,
    "required_missing": [],
    "passes_forbidden": true,
    "forbidden_found": []
  },
  "overall_score": 82,
  "summary": "Good suggestion with strong pedagogical craft"
}
\`\`\``;
    const result = parseJudgeResponse(response);
    assert.strictEqual(result.overall_score, 82);
    assert.strictEqual(Object.keys(result.scores).length, 8);
    assert.strictEqual(result.scores.perception_quality.score, 4);
    assert.strictEqual(result.scores.pedagogical_craft.score, 5);
    assert.strictEqual(result.validation.passes_required, true);
    assert.deepStrictEqual(result.validation.required_missing, []);
  });
});

// ============================================================================
// Dialogue Quality Rubric Tests
// ============================================================================

describe('loadDialogueRubric', () => {
  it('loads the dialogue rubric YAML', () => {
    const rubric = loadDialogueRubric({ forceReload: true });
    assert.ok(rubric, 'should load rubric');
    assert.strictEqual(rubric.name, 'Dialogue Quality Rubric');
    assert.ok(rubric.dimensions, 'should have dimensions');
  });

  it('has exactly 6 dimensions', () => {
    const rubric = loadDialogueRubric();
    const dimKeys = Object.keys(rubric.dimensions);
    assert.strictEqual(dimKeys.length, 6, `expected 6 dimensions, got ${dimKeys.length}: ${dimKeys.join(', ')}`);
  });

  it('dimension weights sum to ~1.0', () => {
    const rubric = loadDialogueRubric();
    const totalWeight = Object.values(rubric.dimensions).reduce((sum, d) => sum + d.weight, 0);
    assert.ok(Math.abs(totalWeight - 1.0) < 0.01, `weights sum to ${totalWeight}, expected ~1.0`);
  });
});

describe('getDialogueDimensions', () => {
  it('returns all 6 dimensions', () => {
    const dims = getDialogueDimensions();
    const keys = Object.keys(dims);
    assert.strictEqual(keys.length, 6);
    assert.ok(keys.includes('pedagogical_progression'), 'should have pedagogical_progression');
    assert.ok(keys.includes('dialogical_responsiveness'), 'should have dialogical_responsiveness');
    assert.ok(keys.includes('knowledge_co_construction'), 'should have knowledge_co_construction');
    assert.ok(keys.includes('productive_tension_management'), 'should have productive_tension_management');
    assert.ok(keys.includes('transformation_evidence'), 'should have transformation_evidence');
    assert.ok(keys.includes('interactional_coherence'), 'should have interactional_coherence');
  });
});

describe('calculateDialogueQualityScore', () => {
  it('calculates a score from all-3s (midpoint) as 50', () => {
    const scores = makeScores({
      pedagogical_progression: 3,
      dialogical_responsiveness: 3,
      knowledge_co_construction: 3,
      productive_tension_management: 3,
      transformation_evidence: 3,
      interactional_coherence: 3,
    });
    const result = calculateDialogueQualityScore(scores);
    assertApprox(result, 50, 'all-3s should yield ~50', 0.5);
  });

  it('calculates a score from all-5s (maximum) as 100', () => {
    const scores = makeScores({
      pedagogical_progression: 5,
      dialogical_responsiveness: 5,
      knowledge_co_construction: 5,
      productive_tension_management: 5,
      transformation_evidence: 5,
      interactional_coherence: 5,
    });
    const result = calculateDialogueQualityScore(scores);
    assertApprox(result, 100, 'all-5s should yield ~100', 0.5);
  });

  it('calculates a score from all-1s (minimum) as 0', () => {
    const scores = makeScores({
      pedagogical_progression: 1,
      dialogical_responsiveness: 1,
      knowledge_co_construction: 1,
      productive_tension_management: 1,
      transformation_evidence: 1,
      interactional_coherence: 1,
    });
    const result = calculateDialogueQualityScore(scores);
    assertApprox(result, 0, 'all-1s should yield ~0', 0.5);
  });

  it('returns null for empty scores', () => {
    const result = calculateDialogueQualityScore({});
    assert.strictEqual(result, null);
  });
});

describe('buildDialogueQualityPrompt', () => {
  it('builds a prompt with all required sections', () => {
    const prompt = buildDialogueQualityPrompt({
      turns: [
        { learnerMessage: 'What is dialectics?', suggestion: { message: 'Great question!' } },
        { learnerMessage: 'Can you explain more?', suggestion: { message: 'Dialectics involves...' } },
      ],
      scenarioName: 'Test Scenario',
      scenarioDescription: 'A test dialogue',
      topic: 'Hegel',
      turnCount: 2,
    });

    assert.ok(prompt.includes('EVALUATION RUBRIC'), 'should include rubric section');
    assert.ok(prompt.includes('DIALOGUE CONTEXT'), 'should include context section');
    assert.ok(prompt.includes('PUBLIC DIALOGUE TRANSCRIPT'), 'should include transcript section');
    assert.ok(prompt.includes('Test Scenario'), 'should include scenario name');
    assert.ok(prompt.includes('**Turn count**: 2'), 'should include turn count');
    assert.ok(prompt.includes('pedagogical_progression'), 'should include dimension keys in example');
    assert.ok(prompt.includes('dance'), 'should include dance metaphor');
  });

  it('includes all 6 dimension names in the prompt', () => {
    const prompt = buildDialogueQualityPrompt({
      turns: [],
      scenarioName: 'empty',
      turnCount: 0,
    });

    assert.ok(prompt.includes('Pedagogical Progression'), 'should mention Pedagogical Progression');
    assert.ok(prompt.includes('Dialogical Responsiveness'), 'should mention Dialogical Responsiveness');
    assert.ok(prompt.includes('Knowledge Co-Construction'), 'should mention Knowledge Co-Construction');
    assert.ok(prompt.includes('Productive Tension Management'), 'should mention Productive Tension Management');
    assert.ok(prompt.includes('Transformation Evidence'), 'should mention Transformation Evidence');
    assert.ok(prompt.includes('Interactional Coherence'), 'should mention Interactional Coherence');
  });

  it('public prompt excludes internal trace details (v3 public-only scoring)', () => {
    const prompt = buildDialogueQualityPrompt({
      turns: [{ learnerMessage: 'What is dialectics?', suggestion: { message: 'Great question!' } }],
      dialogueTrace: [
        { turnIndex: 0, agent: 'learner', action: 'turn_action', detail: 'Learner asks a question' },
        { turnIndex: 0, agent: 'ego', action: 'initial_draft', contextSummary: 'Drafting response' },
      ],
      scenarioName: 'Trace Test',
      turnCount: 1,
    });

    assert.ok(prompt.includes('PUBLIC DIALOGUE TRANSCRIPT'), 'should use public transcript heading');
    assert.ok(!prompt.includes('initial_draft'), 'should exclude internal trace actions');
  });
});

// ============================================================================
// Example score placeholders (regression: numeric examples cause Codex echo)
// ============================================================================

describe('example score placeholders in tutor/dialogue prompts', () => {
  const sampleTurns = [
    { role: 'tutor', content: 'Let me explain this concept.' },
    { role: 'learner', content: 'I think I understand.' },
  ];

  it('buildEvaluationPrompt uses non-numeric placeholder scores', () => {
    const prompt = buildEvaluationPrompt(
      { message: 'Test suggestion' },
      { name: 'Test', description: 'Test scenario', expectedBehavior: 'Good behavior' },
      {},
    );
    assert.ok(prompt.includes('"score": 2'), 'should include varied example scores');
    assert.ok(!prompt.includes('"Brief reason"'), 'should not use old "Brief reason" placeholder');
  });

  it('buildDialogueQualityPrompt uses non-numeric placeholder scores', () => {
    const prompt = buildDialogueQualityPrompt({
      turns: sampleTurns,
      scenarioName: 'Test',
      isPublicOnly: true,
    });
    assert.ok(prompt.includes('"score": 2'), 'should include varied example scores');
    assert.ok(!prompt.includes('"Brief reason"'), 'should not use old "Brief reason" placeholder');
  });

  it('buildTutorHolisticEvaluationPrompt uses non-numeric placeholder scores', () => {
    const prompt = buildTutorHolisticEvaluationPrompt({
      turns: sampleTurns,
      scenarioName: 'Test',
      isRecognition: true,
    });
    assert.ok(prompt.includes('"score": 2'), 'should include varied example scores');
    assert.ok(!prompt.includes('"Brief reason"'), 'should not use old "Brief reason" placeholder');
  });

  it('buildTutorDeliberationPrompt uses non-numeric placeholder scores', () => {
    const prompt = buildTutorDeliberationPrompt({
      turns: sampleTurns,
      dialogueTrace: [],
      learnerContext: 'Test learner',
    });
    assert.ok(prompt.includes('"score": 2'), 'should include varied example scores');
    assert.ok(!prompt.includes('"Brief reason"'), 'should not use old "Brief reason" placeholder');
  });

  it('buildLearnerDeliberationPrompt uses non-numeric placeholder scores', () => {
    const prompt = buildLearnerDeliberationPrompt({
      turns: sampleTurns,
      dialogueTrace: [],
      learnerContext: 'Test learner',
    });
    assert.ok(prompt.includes('"score": 2'), 'should include varied example scores');
    assert.ok(!prompt.includes('"Brief reason"'), 'should not use old "Brief reason" placeholder');
  });
});
