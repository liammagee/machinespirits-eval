import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeSuperegoIncorporation,
  extractTransformationSignals,
  analyzeBilateralTransformation,
  analyzeInterventionEffectiveness,
  generateTransformationReport,
} from '../services/dialogueTraceAnalyzer.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const EMPTY_TRACE = [];

const BASIC_TRACE = [
  { agent: 'ego', action: 'generate', turnIndex: 0, detail: 'Here is my initial suggestion.' },
  { agent: 'superego', action: 'review', turnIndex: 0, verdict: { approved: true, confidence: 0.8 } },
  { agent: 'ego', action: 'generate', turnIndex: 1, detail: 'Updated suggestion after learner input.' },
  { agent: 'superego', action: 'revise', turnIndex: 1, interventionType: 'revise', verdict: { approved: false, confidence: 0.6 } },
  { agent: 'ego', action: 'revision', turnIndex: 1, detail: 'Revised based on superego feedback.' },
];

const TRACE_WITH_TRANSFORMATION = [
  { agent: 'ego', action: 'generate', turnIndex: 0, reasoning: 'Standard pedagogical approach.' },
  { agent: 'superego', action: 'review', turnIndex: 0, verdict: { feedback: 'The response is genuinely responsive to the learner.', confidence: 0.9 } },
  { agent: 'ego', action: 'revision', turnIndex: 1, reasoning: "Building on that insight, I hadn't considered this angle before." },
  { agent: 'learner_ego', action: 'deliberation', turnIndex: 1, detail: 'Oh I see now, this is clicking for me.' },
  { agent: 'superego', action: 'review', turnIndex: 1, verdict: { feedback: 'Mutual recognition is evident. Both parties have adapted.', confidence: 0.95 } },
  { agent: 'learner_synthesis', action: 'response', turnIndex: 2, detail: 'The whole way I think about this has shifted.' },
];

const TRACE_TUTOR_ONLY_TRANSFORM = [
  { agent: 'ego', action: 'revision', turnIndex: 0, reasoning: "Let me revise my understanding. You've helped me see this differently." },
  { agent: 'ego', action: 'revision', turnIndex: 1, reasoning: 'That changes how I would frame the problem.' },
];

const TRACE_LEARNER_ONLY_TRANSFORM = [
  { agent: 'learner_ego', action: 'deliberation', turnIndex: 0, detail: 'Oh wait, I think I was wrong about this.' },
  { agent: 'learner_synthesis', action: 'response', turnIndex: 1, detail: 'I see now that my understanding has changed.' },
];

// ============================================================================
// analyzeSuperegoIncorporation
// ============================================================================

describe('analyzeSuperegoIncorporation', () => {
  it('returns null metrics for null input', () => {
    const result = analyzeSuperegoIncorporation(null);
    assert.strictEqual(result.incorporationRate, null);
    assert.strictEqual(result.totalFeedbackEvents, 0);
    assert.strictEqual(result.avgConfidence, null);
  });

  it('returns null metrics for empty trace', () => {
    const result = analyzeSuperegoIncorporation(EMPTY_TRACE);
    assert.strictEqual(result.incorporationRate, null);
    assert.strictEqual(result.totalFeedbackEvents, 0);
  });

  it('counts superego feedback events', () => {
    const result = analyzeSuperegoIncorporation(BASIC_TRACE);
    assert.strictEqual(result.totalFeedbackEvents, 2);
  });

  it('counts ego revisions', () => {
    const result = analyzeSuperegoIncorporation(BASIC_TRACE);
    assert.strictEqual(result.totalRevisions, 1);
  });

  it('calculates incorporation rate', () => {
    const result = analyzeSuperegoIncorporation(BASIC_TRACE);
    // 1 revision / 2 feedback events = 0.5
    assert.strictEqual(result.incorporationRate, 0.5);
  });

  it('tracks feedback patterns', () => {
    const result = analyzeSuperegoIncorporation(BASIC_TRACE);
    assert.strictEqual(result.feedbackPatterns.approve, 1);
    // Second entry has interventionType='revise' which matches before approved===false
    assert.strictEqual(result.feedbackPatterns.revise, 1);
    assert.strictEqual(result.feedbackPatterns.reject, 0);
  });

  it('tracks confidence progression', () => {
    const result = analyzeSuperegoIncorporation(BASIC_TRACE);
    assert.strictEqual(result.confidenceProgression.length, 2);
    assert.strictEqual(result.confidenceProgression[0].confidence, 0.8);
    assert.strictEqual(result.confidenceProgression[1].confidence, 0.6);
  });

  it('calculates average confidence', () => {
    const result = analyzeSuperegoIncorporation(BASIC_TRACE);
    assert.strictEqual(result.avgConfidence, 0.7);
  });
});

// ============================================================================
// extractTransformationSignals
// ============================================================================

describe('extractTransformationSignals', () => {
  it('returns empty for null input', () => {
    assert.deepStrictEqual(extractTransformationSignals(null), []);
  });

  it('returns empty for empty trace', () => {
    assert.deepStrictEqual(extractTransformationSignals(EMPTY_TRACE), []);
  });

  it('detects tutor transformation from ego reasoning', () => {
    const signals = extractTransformationSignals(TRACE_WITH_TRANSFORMATION);
    const tutorSignals = signals.filter(s => s.type === 'tutor_transformation');
    assert.ok(tutorSignals.length > 0, 'Should detect tutor transformation');
    assert.strictEqual(tutorSignals[0].source, 'ego_reasoning');
  });

  it('detects learner transformation', () => {
    const signals = extractTransformationSignals(TRACE_WITH_TRANSFORMATION);
    const learnerSignals = signals.filter(s => s.type === 'learner_transformation');
    assert.ok(learnerSignals.length > 0, 'Should detect learner transformation');
  });

  it('detects superego acknowledgment of adaptation', () => {
    const signals = extractTransformationSignals(TRACE_WITH_TRANSFORMATION);
    const ackSignals = signals.filter(s => s.type === 'superego_noted_adaptation');
    assert.ok(ackSignals.length > 0, 'Should detect superego acknowledgment');
  });

  it('truncates content to 150 chars', () => {
    const longTrace = [
      { agent: 'ego', reasoning: "Building on that insight, ".repeat(20) },
    ];
    const signals = extractTransformationSignals(longTrace);
    if (signals.length > 0) {
      assert.ok(signals[0].content.length <= 150);
    }
  });

  it('produces at most one signal per trace entry', () => {
    // An entry with multiple matching patterns should only produce one signal
    const trace = [
      { agent: 'ego', reasoning: "You've helped me see this. I hadn't considered that. Let me revise my approach." },
    ];
    const signals = extractTransformationSignals(trace);
    const egoSignals = signals.filter(s => s.source === 'ego_reasoning');
    assert.ok(egoSignals.length <= 1, 'Should produce at most one signal per entry');
  });
});

// ============================================================================
// analyzeBilateralTransformation
// ============================================================================

describe('analyzeBilateralTransformation', () => {
  it('detects no transformation in empty trace', () => {
    const result = analyzeBilateralTransformation(EMPTY_TRACE);
    assert.strictEqual(result.tutorTransformationCount, 0);
    assert.strictEqual(result.learnerTransformationCount, 0);
    assert.strictEqual(result.isMutualTransformation, false);
    assert.strictEqual(result.bilateralBalance, null);
  });

  it('detects mutual transformation', () => {
    const result = analyzeBilateralTransformation(TRACE_WITH_TRANSFORMATION);
    assert.ok(result.tutorTransformationCount > 0, 'Should detect tutor transformation');
    assert.ok(result.learnerTransformationCount > 0, 'Should detect learner transformation');
    assert.strictEqual(result.isMutualTransformation, true);
  });

  it('detects one-directional tutor transformation', () => {
    const result = analyzeBilateralTransformation(TRACE_TUTOR_ONLY_TRANSFORM);
    assert.ok(result.tutorTransformationCount > 0);
    assert.strictEqual(result.learnerTransformationCount, 0);
    assert.strictEqual(result.isMutualTransformation, false);
    assert.ok(result.summary.includes('One-directional'));
  });

  it('detects one-directional learner transformation', () => {
    const result = analyzeBilateralTransformation(TRACE_LEARNER_ONLY_TRANSFORM);
    assert.strictEqual(result.tutorTransformationCount, 0);
    assert.ok(result.learnerTransformationCount > 0);
    assert.strictEqual(result.isMutualTransformation, false);
    assert.ok(result.summary.includes('One-directional'));
  });

  it('calculates bilateral balance between 0 and 1', () => {
    const result = analyzeBilateralTransformation(TRACE_WITH_TRANSFORMATION);
    if (result.bilateralBalance !== null) {
      assert.ok(result.bilateralBalance >= 0);
      assert.ok(result.bilateralBalance <= 1);
    }
  });

  it('returns sorted transformation timeline', () => {
    const result = analyzeBilateralTransformation(TRACE_WITH_TRANSFORMATION);
    for (let i = 1; i < result.transformationTimeline.length; i++) {
      const prev = result.transformationTimeline[i - 1].turn || 0;
      const curr = result.transformationTimeline[i].turn || 0;
      assert.ok(curr >= prev, 'Timeline should be sorted by turn');
    }
  });

  it('generates summary string', () => {
    const result = analyzeBilateralTransformation(TRACE_WITH_TRANSFORMATION);
    assert.ok(typeof result.summary === 'string');
    assert.ok(result.summary.length > 0);
  });

  it('reports no signals for plain trace', () => {
    const plainTrace = [
      { agent: 'ego', action: 'generate', detail: 'A standard response about the topic.' },
      { agent: 'superego', action: 'review', verdict: { feedback: 'Looks acceptable.' } },
    ];
    const result = analyzeBilateralTransformation(plainTrace);
    assert.strictEqual(result.tutorTransformationCount, 0);
    assert.strictEqual(result.learnerTransformationCount, 0);
    assert.ok(result.summary.includes('No explicit transformation signals'));
  });
});

// ============================================================================
// analyzeInterventionEffectiveness
// ============================================================================

describe('analyzeInterventionEffectiveness', () => {
  it('returns empty for null inputs', () => {
    const result = analyzeInterventionEffectiveness(null, null);
    assert.strictEqual(result.interventionCount, 0);
    assert.strictEqual(result.scoreImprovementAfterIntervention, null);
  });

  it('counts revise interventions', () => {
    const result = analyzeInterventionEffectiveness(BASIC_TRACE, [
      { turnIndex: 0, turnScore: 50 },
      { turnIndex: 1, turnScore: 60 },
    ]);
    assert.strictEqual(result.interventionCount, 1);
  });

  it('measures score improvement after intervention', () => {
    const trace = [
      { agent: 'superego', action: 'revise', turnIndex: 1, interventionType: 'revise' },
    ];
    const turnResults = [
      { turnIndex: 0, turnScore: 40 },
      { turnIndex: 1, turnScore: 60 },
    ];
    const result = analyzeInterventionEffectiveness(trace, turnResults);
    assert.strictEqual(result.scoreImprovementAfterIntervention, 20);
  });

  it('tracks intervention types', () => {
    const trace = [
      { agent: 'superego', action: 'revise', turnIndex: 1, interventionType: 'enhance' },
      { agent: 'superego', action: 'revise', turnIndex: 2, interventionType: 'enhance' },
      { agent: 'superego', action: 'revise', turnIndex: 3, interventionType: 'revise' },
    ];
    const turnResults = [
      { turnIndex: 0, turnScore: 40 },
      { turnIndex: 1, turnScore: 50 },
      { turnIndex: 2, turnScore: 55 },
      { turnIndex: 3, turnScore: 60 },
    ];
    const result = analyzeInterventionEffectiveness(trace, turnResults);
    assert.strictEqual(result.interventionsByType.enhance.count, 2);
    assert.strictEqual(result.interventionsByType.revise.count, 1);
  });
});

// ============================================================================
// generateTransformationReport
// ============================================================================

describe('generateTransformationReport', () => {
  it('returns structured report for empty inputs', () => {
    const report = generateTransformationReport(null, null);
    assert.ok(report.superegoMetrics);
    assert.ok(report.bilateralMetrics);
    assert.ok(report.interventionMetrics);
    assert.ok(report.overallAssessment);
  });

  it('integrates all sub-analyses', () => {
    const report = generateTransformationReport(TRACE_WITH_TRANSFORMATION, [
      { turnIndex: 0, turnScore: 50 },
      { turnIndex: 1, turnScore: 70 },
    ]);

    // Superego metrics should be populated
    assert.ok(report.superegoMetrics.totalFeedbackEvents > 0);

    // Bilateral metrics should detect mutual transformation
    assert.ok(report.bilateralMetrics.tutorTransformationCount >= 0);
    assert.ok(typeof report.bilateralMetrics.summary === 'string');

    // Overall assessment should have quality score
    assert.ok(typeof report.overallAssessment.transformationQuality === 'number');
    assert.ok(report.overallAssessment.transformationQuality >= 0);
    assert.ok(report.overallAssessment.transformationQuality <= 100);
  });

  it('reports hasMutualTransformation for bilateral traces', () => {
    const report = generateTransformationReport(TRACE_WITH_TRANSFORMATION, []);
    assert.strictEqual(report.overallAssessment.hasMutualTransformation, true);
  });

  it('reports no mutual transformation for one-directional traces', () => {
    const report = generateTransformationReport(TRACE_TUTOR_ONLY_TRANSFORM, []);
    assert.strictEqual(report.overallAssessment.hasMutualTransformation, false);
  });

  it('includes transformation timeline', () => {
    const report = generateTransformationReport(TRACE_WITH_TRANSFORMATION, []);
    assert.ok(Array.isArray(report.transformationTimeline));
  });
});
