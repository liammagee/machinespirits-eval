import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeTurnProgression,
  calculateAdaptationIndex,
  calculateLearnerGrowthIndex,
  analyzeFramingShift,
  analyzeTransformationMarkers,
} from '../services/turnComparisonAnalyzer.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const EMPTY_TURNS = [];

const SINGLE_TURN = [
  {
    turnIndex: 0,
    suggestion: { type: 'lecture', message: 'Let me explain this concept.', title: 'Intro' },
    learnerMessage: 'I have no idea what this means.',
    scores: { relevance: 3 },
    turnScore: 50,
  },
];

const _TWO_TURNS_SAME_TYPE = [
  {
    turnIndex: 0,
    suggestion: { type: 'lecture', message: 'Let me explain this concept.', title: 'Intro' },
    learnerMessage: 'I have no idea what this means.',
    scores: { relevance: 3, tutor_adaptation: 2 },
    turnScore: 50,
  },
  {
    turnIndex: 1,
    suggestion: { type: 'lecture', message: 'Let me explain this concept further.', title: 'Intro' },
    learnerMessage: "I still don't get it.",
    scores: { relevance: 3, tutor_adaptation: 2 },
    turnScore: 52,
  },
];

const THREE_TURNS_EVOLVING = [
  {
    turnIndex: 0,
    suggestion: { type: 'lecture', message: 'You should read chapter 5 first.', title: 'Start here', actionTarget: 'chapter-5' },
    learnerMessage: 'ok',
    scores: { relevance: 3, learner_growth: 2 },
    turnScore: 45,
  },
  {
    turnIndex: 1,
    suggestion: { type: 'review', message: 'What do you think about the relationship between these ideas?', title: 'Explore connections', actionTarget: 'connections' },
    learnerMessage: 'Wait, actually I think I see how this connects because the earlier point about recognition...',
    scores: { relevance: 4, learner_growth: 3 },
    turnScore: 65,
  },
  {
    turnIndex: 2,
    suggestion: { type: 'explore', message: "Building on your insight, let's explore how this applies to AI.", title: 'Apply to AI', actionTarget: 'ai-applications' },
    learnerMessage: "Oh I see now! So if we discussed this before, then the whole way I think about it has shifted. However, I wonder whether that also means...",
    scores: { relevance: 5, learner_growth: 5 },
    turnScore: 80,
  },
];

// ============================================================================
// analyzeTurnProgression
// ============================================================================

describe('analyzeTurnProgression', () => {
  it('returns empty structure for null input', () => {
    const result = analyzeTurnProgression(null);
    assert.strictEqual(result.turnCount, 0);
    assert.strictEqual(result.adaptationIndex, null);
    assert.strictEqual(result.learnerGrowthIndex, null);
    assert.strictEqual(result.bilateralTransformationIndex, null);
  });

  it('returns empty structure for empty array', () => {
    const result = analyzeTurnProgression(EMPTY_TURNS);
    assert.strictEqual(result.turnCount, 0);
    assert.deepStrictEqual(result.suggestionTypeProgression, []);
  });

  it('handles single turn (no comparison possible)', () => {
    const result = analyzeTurnProgression(SINGLE_TURN);
    assert.strictEqual(result.turnCount, 1);
    assert.strictEqual(result.adaptationIndex, 0);
    assert.strictEqual(result.learnerGrowthIndex, 0);
  });

  it('tracks suggestion type progression', () => {
    const result = analyzeTurnProgression(THREE_TURNS_EVOLVING);
    assert.deepStrictEqual(result.suggestionTypeProgression, ['lecture', 'review', 'explore']);
  });

  it('tracks dimension trajectories', () => {
    const result = analyzeTurnProgression(THREE_TURNS_EVOLVING);
    assert.deepStrictEqual(result.dimensionTrajectories.relevance, [3, 4, 5]);
    assert.deepStrictEqual(result.dimensionTrajectories.learner_growth, [2, 3, 5]);
  });

  it('calculates score improvement', () => {
    const result = analyzeTurnProgression(THREE_TURNS_EVOLVING);
    // (80 - 45) / 45 = 0.777...
    assert.ok(result.avgScoreImprovement > 0.7);
    assert.ok(result.avgScoreImprovement < 0.8);
  });

  it('bilateralTransformationIndex is average of adaptation and learner growth', () => {
    const result = analyzeTurnProgression(THREE_TURNS_EVOLVING);
    const expected = (result.adaptationIndex + result.learnerGrowthIndex) / 2;
    assert.strictEqual(result.bilateralTransformationIndex, expected);
  });

  it('reports correct turnCount', () => {
    const result = analyzeTurnProgression(THREE_TURNS_EVOLVING);
    assert.strictEqual(result.turnCount, 3);
  });
});

// ============================================================================
// calculateAdaptationIndex
// ============================================================================

describe('calculateAdaptationIndex', () => {
  it('returns 0 for null input', () => {
    assert.strictEqual(calculateAdaptationIndex(null), 0);
  });

  it('returns 0 for single turn', () => {
    assert.strictEqual(calculateAdaptationIndex(SINGLE_TURN), 0);
  });

  it('returns low index for identical suggestions', () => {
    const turns = [
      { suggestion: { type: 'lecture', message: 'same message', title: 'Same', actionTarget: 'same' } },
      { suggestion: { type: 'lecture', message: 'same message', title: 'Same', actionTarget: 'same' } },
    ];
    const index = calculateAdaptationIndex(turns);
    assert.strictEqual(index, 0);
  });

  it('returns positive index for different suggestion types', () => {
    const turns = [
      { suggestion: { type: 'lecture', message: 'Read this chapter.', title: 'Chapter 1', actionTarget: 'ch1' } },
      { suggestion: { type: 'explore', message: 'What do you think about this?', title: 'Explore', actionTarget: 'explore' } },
    ];
    const index = calculateAdaptationIndex(turns);
    assert.ok(index > 0, `Expected positive adaptation, got ${index}`);
  });

  it('skips turns with missing suggestions', () => {
    const turns = [
      { suggestion: { type: 'lecture', message: 'hello' } },
      { suggestion: null },
      { suggestion: { type: 'review', message: 'world' } },
    ];
    const index = calculateAdaptationIndex(turns);
    // Only one valid comparison (turn 0 vs turn 2 is skipped because turn 1 is null)
    assert.ok(index >= 0);
  });
});

// ============================================================================
// calculateLearnerGrowthIndex
// ============================================================================

describe('calculateLearnerGrowthIndex', () => {
  it('returns 0 for null input', () => {
    assert.strictEqual(calculateLearnerGrowthIndex(null), 0);
  });

  it('returns 0 for single turn', () => {
    assert.strictEqual(calculateLearnerGrowthIndex(SINGLE_TURN), 0);
  });

  it('returns 0 when learner messages are empty', () => {
    const turns = [
      { learnerMessage: '', learnerAction: '' },
      { learnerMessage: '', learnerAction: '' },
    ];
    assert.strictEqual(calculateLearnerGrowthIndex(turns), 0);
  });

  it('detects growth when messages increase in complexity', () => {
    const turns = [
      { learnerMessage: 'ok' },
      { learnerMessage: 'Wait, actually I see the connection because of what you said earlier. However, I wonder about the implications.' },
    ];
    const index = calculateLearnerGrowthIndex(turns);
    assert.ok(index > 0, `Expected positive growth, got ${index}`);
  });

  it('detects growth from revision markers', () => {
    const turns = [
      { learnerMessage: 'I think the answer is X.' },
      { learnerMessage: 'Actually wait, I see now that it is more nuanced. Let me think about this differently.' },
    ];
    const index = calculateLearnerGrowthIndex(turns);
    assert.ok(index > 0, `Expected growth from revision markers, got ${index}`);
  });

  it('uses learnerAction as fallback when learnerMessage is missing', () => {
    const turns = [
      { learnerAction: 'short question' },
      { learnerAction: 'Wait, actually I need to reconsider because of what you mentioned earlier about the framework.' },
    ];
    const index = calculateLearnerGrowthIndex(turns);
    assert.ok(index > 0, `Expected growth from learnerAction fallback, got ${index}`);
  });

  it('incorporates learner_growth dimension scores when available', () => {
    const turns = [
      { learnerMessage: 'hello', scores: { learner_growth: 1 } },
      { learnerMessage: 'hello again', scores: { learner_growth: 4 } },
    ];
    const index = calculateLearnerGrowthIndex(turns);
    assert.ok(index > 0, `Expected growth from dimension scores, got ${index}`);
  });

  it('is capped at 1', () => {
    const index = calculateLearnerGrowthIndex(THREE_TURNS_EVOLVING);
    assert.ok(index <= 1, `Growth index should not exceed 1, got ${index}`);
  });
});

// ============================================================================
// analyzeFramingShift
// ============================================================================

describe('analyzeFramingShift', () => {
  it('returns empty for null input', () => {
    const result = analyzeFramingShift(null);
    assert.deepStrictEqual(result.timeline, []);
    assert.strictEqual(result.dominantShift, null);
    assert.strictEqual(result.framingDiversity, 0);
  });

  it('classifies directive framing', () => {
    const turns = [
      { turnIndex: 0, suggestion: { message: 'You should read this chapter. You need to understand the basics first.' } },
    ];
    const result = analyzeFramingShift(turns);
    assert.strictEqual(result.timeline[0].framing.type, 'directive');
  });

  it('classifies exploratory framing', () => {
    const turns = [
      { turnIndex: 0, suggestion: { message: 'What if we considered this from a different angle? Have you considered the implications?' } },
    ];
    const result = analyzeFramingShift(turns);
    assert.strictEqual(result.timeline[0].framing.type, 'exploratory');
  });

  it('classifies collaborative framing', () => {
    const turns = [
      { turnIndex: 0, suggestion: { message: "Building on your insight, together we could explore this further. Your insight is valuable." } },
    ];
    const result = analyzeFramingShift(turns);
    assert.strictEqual(result.timeline[0].framing.type, 'collaborative');
  });

  it('detects dominant shift across turns', () => {
    const turns = [
      { turnIndex: 0, suggestion: { message: 'You should study this. You need to learn the basics.' } },
      { turnIndex: 1, suggestion: { message: 'What if we explored this together? What do you think about this idea?' } },
    ];
    const result = analyzeFramingShift(turns);
    assert.ok(result.dominantShift, 'Should detect a dominant shift');
  });

  it('reports null dominantShift when framing stays the same', () => {
    const turns = [
      { turnIndex: 0, suggestion: { message: 'You should read chapter 1. You need to start here.' } },
      { turnIndex: 1, suggestion: { message: 'You must also read chapter 2. You need to understand this.' } },
    ];
    const result = analyzeFramingShift(turns);
    assert.strictEqual(result.dominantShift, null);
  });

  it('calculates framing diversity', () => {
    const result = analyzeFramingShift(THREE_TURNS_EVOLVING);
    assert.ok(result.framingDiversity >= 0, 'Diversity should be non-negative');
    assert.ok(result.framingDiversity <= 1, 'Diversity should be at most 1');
  });
});

// ============================================================================
// analyzeTransformationMarkers
// ============================================================================

describe('analyzeTransformationMarkers', () => {
  const markers = {
    tutorEvolving: ["you've helped me see", 'reconsidering', 'building on your point'],
    tutorStatic: ['as I said before', 'to repeat'],
    learnerEvolving: ['oh wait', 'I see now', 'that changes how I think'],
    learnerStatic: ['just tell me the answer'],
  };

  it('returns zeros for null inputs', () => {
    const result = analyzeTransformationMarkers(null, null);
    assert.strictEqual(result.tutorEvolvingCount, 0);
    assert.strictEqual(result.tutorTransformationRatio, null);
  });

  it('counts tutor evolving markers', () => {
    const turns = [
      { suggestion: { message: "Building on your point, I'm reconsidering the approach." }, learnerMessage: '' },
    ];
    const result = analyzeTransformationMarkers(turns, markers);
    assert.strictEqual(result.tutorEvolvingCount, 2); // "building on your point" + "reconsidering"
    assert.strictEqual(result.tutorStaticCount, 0);
    assert.strictEqual(result.tutorTransformationRatio, 1);
  });

  it('counts tutor static markers', () => {
    const turns = [
      { suggestion: { message: 'As I said before, to repeat, the answer is...' }, learnerMessage: '' },
    ];
    const result = analyzeTransformationMarkers(turns, markers);
    assert.strictEqual(result.tutorStaticCount, 2);
    assert.strictEqual(result.tutorEvolvingCount, 0);
    assert.strictEqual(result.tutorTransformationRatio, 0);
  });

  it('counts learner evolving markers', () => {
    const turns = [
      { suggestion: { message: '' }, learnerMessage: 'Oh wait, I see now! That changes how I think about everything.' },
    ];
    const result = analyzeTransformationMarkers(turns, markers);
    assert.strictEqual(result.learnerEvolvingCount, 3);
    assert.strictEqual(result.learnerStaticCount, 0);
  });

  it('counts learner static markers', () => {
    const turns = [
      { suggestion: { message: '' }, learnerMessage: 'Just tell me the answer already.' },
    ];
    const result = analyzeTransformationMarkers(turns, markers);
    assert.strictEqual(result.learnerStaticCount, 1);
    assert.strictEqual(result.learnerEvolvingCount, 0);
  });

  it('calculates bilateral balance', () => {
    const turns = [
      { suggestion: { message: "You've helped me see this differently." }, learnerMessage: 'Oh wait, I see now!' },
    ];
    const result = analyzeTransformationMarkers(turns, markers);
    assert.ok(result.bilateralBalance !== null, 'Should have bilateral balance');
    assert.ok(result.bilateralBalance >= 0 && result.bilateralBalance <= 1);
  });

  it('accumulates markers across multiple turns', () => {
    const turns = [
      { suggestion: { message: 'As I said before...' }, learnerMessage: 'ok' },
      { suggestion: { message: "Reconsidering, building on your point..." }, learnerMessage: 'Oh wait, I see now!' },
    ];
    const result = analyzeTransformationMarkers(turns, markers);
    assert.strictEqual(result.tutorEvolvingCount, 2);
    assert.strictEqual(result.tutorStaticCount, 1);
    assert.strictEqual(result.learnerEvolvingCount, 2);
  });
});
