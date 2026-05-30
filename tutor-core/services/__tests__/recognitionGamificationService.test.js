import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createTestDb,
  seedWritingPad,
  seedRecognitionMoment,
  seedLearnerEvent,
  buildMockWritingPad,
} from './fixtures.js';

let testDb;

// Mock dbService to return our test database
vi.mock('../dbService.js', () => ({
  getDb: vi.fn(() => {
    if (!testDb) throw new Error('testDb not initialized - beforeEach has not run yet');
    return testDb;
  }),
  initDb: vi.fn(),
  closeDb: vi.fn(),
  _setDbForTesting: vi.fn(),
}));

// Mock writingPadService
vi.mock('../writingPadService.js', () => ({
  getWritingPad: vi.fn(),
}));

// Import after mocks are set up
const { getWritingPad } = await import('../writingPadService.js');
const {
  computeRecognitionDepth,
  checkRecognitionMilestones,
  getMemoryLayerProgression,
  computeRecognitionFlow,
  getDialecticalContinuity,
  getLearnerRecognitionProfile,
  getMilestoneDefinitions,
} = await import('../recognitionGamificationService.js');

describe('recognitionGamificationService', () => {
  const learnerId = 'test-learner-1';

  beforeEach(() => {
    testDb = createTestDb();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // computeRecognitionDepth
  // ==========================================================================
  describe('computeRecognitionDepth', () => {
    it('returns zeros and trend "none" when no writing pad exists', () => {
      getWritingPad.mockReturnValue(null);

      const result = computeRecognitionDepth(learnerId);

      expect(result).toEqual({
        dialecticalDepth: 0,
        mutualTransformation: 0,
        pedagogicalAttunement: 0.5,
        breakthroughDensity: 0,
        compositeDepth: 0,
        trend: 'none',
      });
    });

    it('computes correct composite depth from metrics', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({
        id: pad.id,
        metrics: {
          dialecticalDepth: 0.6,
          mutualTransformationScore: 0.4,
          pedagogicalAttunement: 0.8,
        },
      });
      getWritingPad.mockReturnValue(mockPad);

      // Seed some events for breakthrough density
      seedLearnerEvent(testDb, learnerId, pad.id, { event_type: 'breakthrough' });
      seedLearnerEvent(testDb, learnerId, pad.id, { event_type: 'resistance' });
      seedLearnerEvent(testDb, learnerId, pad.id, { event_type: 'resistance' });
      seedLearnerEvent(testDb, learnerId, pad.id, { event_type: 'breakthrough' });

      const result = computeRecognitionDepth(learnerId);

      // breakthroughDensity = 2/4 = 0.5
      // composite = 0.6*0.3 + 0.4*0.3 + 0.8*0.2 + 0.5*0.2 = 0.18 + 0.12 + 0.16 + 0.10 = 0.56
      expect(result.breakthroughDensity).toBeCloseTo(0.5);
      expect(result.compositeDepth).toBeCloseTo(0.56);
    });

    it('computes breakthrough density correctly', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      seedLearnerEvent(testDb, learnerId, pad.id, { event_type: 'breakthrough' });
      seedLearnerEvent(testDb, learnerId, pad.id, { event_type: 'breakthrough' });
      seedLearnerEvent(testDb, learnerId, pad.id, { event_type: 'breakthrough' });
      seedLearnerEvent(testDb, learnerId, pad.id, { event_type: 'resistance' });

      const result = computeRecognitionDepth(learnerId);
      expect(result.breakthroughDensity).toBeCloseTo(0.75);
    });

    it('returns trend "rising" when recent struggle_depth > older by >0.1', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      // Seed older moments (will be offset 5+)
      for (let i = 0; i < 5; i++) {
        seedRecognitionMoment(testDb, pad.id, {
          struggle_depth: 0.3,
          created_at: `2024-01-0${i + 1}T00:00:00.000Z`,
        });
      }
      // Seed recent moments (first 5 by DESC order)
      for (let i = 0; i < 5; i++) {
        seedRecognitionMoment(testDb, pad.id, {
          struggle_depth: 0.7,
          created_at: `2024-06-0${i + 1}T00:00:00.000Z`,
        });
      }

      const result = computeRecognitionDepth(learnerId);
      expect(result.trend).toBe('rising');
    });

    it('returns trend "falling" when recent struggle_depth < older by >0.1', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      // Older moments with high depth
      for (let i = 0; i < 5; i++) {
        seedRecognitionMoment(testDb, pad.id, {
          struggle_depth: 0.8,
          created_at: `2024-01-0${i + 1}T00:00:00.000Z`,
        });
      }
      // Recent moments with low depth
      for (let i = 0; i < 5; i++) {
        seedRecognitionMoment(testDb, pad.id, {
          struggle_depth: 0.2,
          created_at: `2024-06-0${i + 1}T00:00:00.000Z`,
        });
      }

      const result = computeRecognitionDepth(learnerId);
      expect(result.trend).toBe('falling');
    });

    it('returns trend "stable" when difference <= 0.1', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      // Older and recent have similar depth
      for (let i = 0; i < 5; i++) {
        seedRecognitionMoment(testDb, pad.id, {
          struggle_depth: 0.5,
          created_at: `2024-01-0${i + 1}T00:00:00.000Z`,
        });
      }
      for (let i = 0; i < 5; i++) {
        seedRecognitionMoment(testDb, pad.id, {
          struggle_depth: 0.55,
          created_at: `2024-06-0${i + 1}T00:00:00.000Z`,
        });
      }

      const result = computeRecognitionDepth(learnerId);
      expect(result.trend).toBe('stable');
    });

    it('returns trend "none" when fewer than 2 moments', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      seedRecognitionMoment(testDb, pad.id, { struggle_depth: 0.5 });

      const result = computeRecognitionDepth(learnerId);
      expect(result.trend).toBe('none');
    });

    it('returns trend "rising" when 2+ recent but <2 older moments', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      // Only 3 moments total: 3 recent, 0 in older bucket
      for (let i = 0; i < 3; i++) {
        seedRecognitionMoment(testDb, pad.id, {
          struggle_depth: 0.5,
          created_at: `2024-06-0${i + 1}T00:00:00.000Z`,
        });
      }

      const result = computeRecognitionDepth(learnerId);
      expect(result.trend).toBe('rising');
    });
  });

  // ==========================================================================
  // checkRecognitionMilestones
  // ==========================================================================
  describe('checkRecognitionMilestones', () => {
    it('returns all 8 milestones with achieved:false when no pad exists', () => {
      getWritingPad.mockReturnValue(null);

      const result = checkRecognitionMilestones(learnerId);

      expect(result).toHaveLength(8);
      result.forEach(m => {
        expect(m.achieved).toBe(false);
        expect(m.achievedAt).toBeNull();
        expect(m.evidence).toBeNull();
      });
    });

    it('first_negation achieved when existential recognition moment exists', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      seedRecognitionMoment(testDb, pad.id, { recognition_type: 'existential' });

      const result = checkRecognitionMilestones(learnerId);
      const firstNegation = result.find(m => m.key === 'first_negation');

      expect(firstNegation.achieved).toBe(true);
      expect(firstNegation.achievedAt).toBeTruthy();
      expect(firstNegation.evidence).toBe('First existential recognition moment');
    });

    it('productive_resistance achieved when productive resistance event exists', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      seedLearnerEvent(testDb, learnerId, pad.id, {
        event_type: 'resistance',
        resistance_interpretation: 'productive',
      });

      const result = checkRecognitionMilestones(learnerId);
      const productive = result.find(m => m.key === 'productive_resistance');

      expect(productive.achieved).toBe(true);
      expect(productive.evidence).toBe('First productive resistance event');
    });

    it('mutual_transformation achieved when mutual_acknowledgment=1 moment exists', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      seedRecognitionMoment(testDb, pad.id, { mutual_acknowledgment: 1 });

      const result = checkRecognitionMilestones(learnerId);
      const mutual = result.find(m => m.key === 'mutual_transformation');

      expect(mutual.achieved).toBe(true);
      expect(mutual.evidence).toBe('First mutually transformative moment');
    });

    it('memory_consolidation achieved when persistence_layer="unconscious" moment exists', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      seedRecognitionMoment(testDb, pad.id, {
        persistence_layer: 'unconscious',
        consolidated_at: '2024-06-01T00:00:00.000Z',
      });

      const result = checkRecognitionMilestones(learnerId);
      const consolidation = result.find(m => m.key === 'memory_consolidation');

      expect(consolidation.achieved).toBe(true);
      expect(consolidation.evidence).toBe('First moment consolidated to permanent memory');
    });

    it('archetype_evolution achieved when preferredLearningStyle is set', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({
        id: pad.id,
        unconscious: {
          learnerArchetype: {
            preferredLearningStyle: 'autonomous',
            commonStruggles: [],
            breakthroughPatterns: [],
            lastUpdated: '2024-06-01T00:00:00.000Z',
          },
        },
      });
      getWritingPad.mockReturnValue(mockPad);

      const result = checkRecognitionMilestones(learnerId);
      const archetype = result.find(m => m.key === 'archetype_evolution');

      expect(archetype.achieved).toBe(true);
      expect(archetype.evidence).toContain('autonomous');
    });

    it('dialectical_mastery requires depth > 0.7 AND 5+ distinct session_ids', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({
        id: pad.id,
        metrics: { dialecticalDepth: 0.8 },
      });
      getWritingPad.mockReturnValue(mockPad);

      // Seed 5 moments with distinct sessions
      for (let i = 0; i < 5; i++) {
        seedRecognitionMoment(testDb, pad.id, { session_id: `session-${i}` });
      }

      const result = checkRecognitionMilestones(learnerId);
      const mastery = result.find(m => m.key === 'dialectical_mastery');

      expect(mastery.achieved).toBe(true);
      expect(mastery.evidence).toContain('0.80');
      expect(mastery.evidence).toContain('5 sessions');
    });

    it('dialectical_mastery not achieved when depth <= 0.7', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({
        id: pad.id,
        metrics: { dialecticalDepth: 0.5 },
      });
      getWritingPad.mockReturnValue(mockPad);

      for (let i = 0; i < 5; i++) {
        seedRecognitionMoment(testDb, pad.id, { session_id: `session-${i}` });
      }

      const result = checkRecognitionMilestones(learnerId);
      const mastery = result.find(m => m.key === 'dialectical_mastery');

      expect(mastery.achieved).toBe(false);
    });

    it('metacognitive_awakening requires 3+ metacognitive moments', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      for (let i = 0; i < 3; i++) {
        seedRecognitionMoment(testDb, pad.id, { recognition_type: 'metacognitive' });
      }

      const result = checkRecognitionMilestones(learnerId);
      const metacog = result.find(m => m.key === 'metacognitive_awakening');

      expect(metacog.achieved).toBe(true);
      expect(metacog.evidence).toContain('3 metacognitive');
    });

    it('metacognitive_awakening not achieved with fewer than 3 metacognitive moments', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      seedRecognitionMoment(testDb, pad.id, { recognition_type: 'metacognitive' });
      seedRecognitionMoment(testDb, pad.id, { recognition_type: 'metacognitive' });

      const result = checkRecognitionMilestones(learnerId);
      const metacog = result.find(m => m.key === 'metacognitive_awakening');

      expect(metacog.achieved).toBe(false);
    });

    it('synthesis_achieved when dialectical_synthesis strategy moment exists', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      seedRecognitionMoment(testDb, pad.id, { synthesis_strategy: 'dialectical_synthesis' });

      const result = checkRecognitionMilestones(learnerId);
      const synthesis = result.find(m => m.key === 'synthesis_achieved');

      expect(synthesis.achieved).toBe(true);
      expect(synthesis.evidence).toBe('First dialectical synthesis achieved');
    });

    it('each achieved milestone includes achievedAt and evidence strings', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({
        id: pad.id,
        unconscious: {
          learnerArchetype: {
            preferredLearningStyle: 'guided',
            commonStruggles: [],
            breakthroughPatterns: [],
            lastUpdated: '2024-01-01T00:00:00.000Z',
          },
        },
      });
      getWritingPad.mockReturnValue(mockPad);

      seedRecognitionMoment(testDb, pad.id, { recognition_type: 'existential' });
      seedRecognitionMoment(testDb, pad.id, { mutual_acknowledgment: 1 });

      const result = checkRecognitionMilestones(learnerId);
      const achieved = result.filter(m => m.achieved);

      achieved.forEach(m => {
        expect(m.achievedAt).toBeTruthy();
        expect(typeof m.evidence).toBe('string');
        expect(m.evidence.length).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // getMemoryLayerProgression
  // ==========================================================================
  describe('getMemoryLayerProgression', () => {
    it('returns empty layers when no pad exists', () => {
      getWritingPad.mockReturnValue(null);

      const result = getMemoryLayerProgression(learnerId);

      expect(result.conscious.workingThoughts).toBe(0);
      expect(result.conscious.activity).toBe('none');
      expect(result.preconscious.patterns).toBe(0);
      expect(result.preconscious.avgConfidence).toBe(0);
      expect(result.preconscious.recentPromotions).toBe(0);
      expect(result.unconscious.permanentTraces).toBe(0);
      expect(result.unconscious.archetypeComplete).toBe(false);
      expect(result.recentTransitions).toEqual([]);
    });

    it('counts conscious workingThoughts correctly', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({
        id: pad.id,
        conscious: {
          workingThoughts: ['thought1', 'thought2', 'thought3'],
          lastCleared: null,
        },
      });
      getWritingPad.mockReturnValue(mockPad);

      const result = getMemoryLayerProgression(learnerId);

      expect(result.conscious.workingThoughts).toBe(3);
      expect(result.conscious.activity).toBe('active');
    });

    it('counts preconscious patterns and computes avgConfidence', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({
        id: pad.id,
        preconscious: {
          recentPatterns: [
            { confidence: 0.8, firstObserved: '2024-01-01T00:00:00.000Z' },
            { confidence: 0.6, firstObserved: '2024-01-02T00:00:00.000Z' },
          ],
        },
      });
      getWritingPad.mockReturnValue(mockPad);

      const result = getMemoryLayerProgression(learnerId);

      expect(result.preconscious.patterns).toBe(2);
      expect(result.preconscious.avgConfidence).toBeCloseTo(0.7);
    });

    it('counts unconscious permanentTraces', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({
        id: pad.id,
        unconscious: {
          permanentTraces: [{ id: '1' }, { id: '2' }, { id: '3' }],
          learnerArchetype: {
            preferredLearningStyle: null,
            commonStruggles: [],
            breakthroughPatterns: [],
          },
          conflictPatterns: [],
        },
      });
      getWritingPad.mockReturnValue(mockPad);

      const result = getMemoryLayerProgression(learnerId);

      expect(result.unconscious.permanentTraces).toBe(3);
    });

    it('detects archetypeComplete only when style + struggles + patterns all present', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({
        id: pad.id,
        unconscious: {
          permanentTraces: [],
          learnerArchetype: {
            preferredLearningStyle: 'autonomous',
            commonStruggles: ['algebra'],
            breakthroughPatterns: ['visual-aha'],
          },
          conflictPatterns: [],
        },
      });
      getWritingPad.mockReturnValue(mockPad);

      const result = getMemoryLayerProgression(learnerId);
      expect(result.unconscious.archetypeComplete).toBe(true);
    });

    it('archetypeComplete false when missing any component', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({
        id: pad.id,
        unconscious: {
          permanentTraces: [],
          learnerArchetype: {
            preferredLearningStyle: 'autonomous',
            commonStruggles: [],
            breakthroughPatterns: [],
          },
          conflictPatterns: [],
        },
      });
      getWritingPad.mockReturnValue(mockPad);

      const result = getMemoryLayerProgression(learnerId);
      expect(result.unconscious.archetypeComplete).toBe(false);
    });

    it('counts recentPromotions (patterns with firstObserved in last 7 days)', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const now = new Date();
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
      const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();

      const mockPad = buildMockWritingPad({
        id: pad.id,
        preconscious: {
          recentPatterns: [
            { confidence: 0.5, firstObserved: threeDaysAgo },
            { confidence: 0.6, firstObserved: threeDaysAgo },
            { confidence: 0.7, firstObserved: tenDaysAgo },
          ],
        },
      });
      getWritingPad.mockReturnValue(mockPad);

      const result = getMemoryLayerProgression(learnerId);
      expect(result.preconscious.recentPromotions).toBe(2);
    });

    it('returns recent transitions from consolidated moments', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      seedRecognitionMoment(testDb, pad.id, {
        persistence_layer: 'unconscious',
        consolidated_at: '2024-06-01T00:00:00.000Z',
        synthesis_resolution: 'Learned about recursion deeply',
      });

      const result = getMemoryLayerProgression(learnerId);

      expect(result.recentTransitions).toHaveLength(1);
      expect(result.recentTransitions[0].from).toBe('preconscious');
      expect(result.recentTransitions[0].to).toBe('unconscious');
      expect(result.recentTransitions[0].description).toContain('Learned about recursion deeply');
    });
  });

  // ==========================================================================
  // computeRecognitionFlow
  // ==========================================================================
  describe('computeRecognitionFlow', () => {
    it('returns zeros and "none" when no pad exists', () => {
      getWritingPad.mockReturnValue(null);

      const result = computeRecognitionFlow(learnerId);

      expect(result.flowScore).toBe(0);
      expect(result.struggleDepthInRange).toBe(false);
      expect(result.synthesisBalance).toBe(0);
      expect(result.resistanceProductivity).toBe(0);
      expect(result.flowState).toBe('none');
    });

    it('computes flowScore from struggle depth, synthesis balance, resistance productivity, engagement density', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      const sessionId = 'test-session-1';

      // 5 moments in session, all with struggle_depth in range and synthesis
      for (let i = 0; i < 5; i++) {
        seedRecognitionMoment(testDb, pad.id, {
          session_id: sessionId,
          struggle_depth: 0.5,
          synthesis_strategy: 'dialectical_synthesis',
          created_at: `2024-06-01T0${i}:00:00.000Z`,
        });
      }

      // Resistance events with productive interpretation
      for (let i = 0; i < 3; i++) {
        seedLearnerEvent(testDb, learnerId, pad.id, {
          session_id: sessionId,
          event_type: 'resistance',
          resistance_interpretation: 'productive',
        });
      }

      const result = computeRecognitionFlow(learnerId, sessionId);

      expect(result.flowScore).toBeGreaterThan(0);
      expect(result.struggleDepthInRange).toBe(true);
      expect(result.synthesisBalance).toBe(1.0);
      expect(result.resistanceProductivity).toBe(1.0);
      expect(result.momentCount).toBe(5);
    });

    it('struggleDepthInRange true when average between 0.3 and 0.7', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      seedRecognitionMoment(testDb, pad.id, { session_id: 'sess', struggle_depth: 0.4 });
      seedRecognitionMoment(testDb, pad.id, { session_id: 'sess', struggle_depth: 0.6 });

      const result = computeRecognitionFlow(learnerId, 'sess');
      expect(result.struggleDepthInRange).toBe(true);
    });

    it('struggleDepthInRange false when average outside 0.3-0.7', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      seedRecognitionMoment(testDb, pad.id, { session_id: 'sess', struggle_depth: 0.1 });
      seedRecognitionMoment(testDb, pad.id, { session_id: 'sess', struggle_depth: 0.1 });

      const result = computeRecognitionFlow(learnerId, 'sess');
      expect(result.struggleDepthInRange).toBe(false);
    });

    it('flow state "deepening" when flowScore >= 0.7', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      // Create ideal flow conditions: in-range struggle, all synthesis, productive resistance, high engagement
      for (let i = 0; i < 5; i++) {
        seedRecognitionMoment(testDb, pad.id, {
          session_id: 'deep-sess',
          struggle_depth: 0.5,
          synthesis_strategy: 'dialectical_synthesis',
          created_at: `2024-06-01T0${i}:00:00.000Z`,
        });
      }
      for (let i = 0; i < 3; i++) {
        seedLearnerEvent(testDb, learnerId, pad.id, {
          session_id: 'deep-sess',
          event_type: 'resistance',
          resistance_interpretation: 'productive',
        });
      }

      const result = computeRecognitionFlow(learnerId, 'deep-sess');
      expect(result.flowState).toBe('deepening');
      expect(result.flowScore).toBeGreaterThanOrEqual(0.7);
    });

    it('flow state "disrupted" when flowScore < 0.2', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      // Single moment with no synthesis, low struggle
      seedRecognitionMoment(testDb, pad.id, {
        session_id: 'bad-sess',
        struggle_depth: 0.0,
        synthesis_strategy: null,
      });

      const result = computeRecognitionFlow(learnerId, 'bad-sess');
      expect(result.flowState).toBe('disrupted');
      expect(result.flowScore).toBeLessThan(0.2);
    });

    it('uses most recent session when sessionId not provided', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      // Old session
      seedRecognitionMoment(testDb, pad.id, {
        session_id: 'old-session',
        struggle_depth: 0.1,
        created_at: '2024-01-01T00:00:00.000Z',
      });

      // Recent session
      seedRecognitionMoment(testDb, pad.id, {
        session_id: 'recent-session',
        struggle_depth: 0.5,
        synthesis_strategy: 'dialectical_synthesis',
        created_at: '2024-06-01T00:00:00.000Z',
      });

      const result = computeRecognitionFlow(learnerId);
      // Should use the recent session's moment
      expect(result.momentCount).toBe(1);
      expect(result.avgStruggleDepth).toBeCloseTo(0.5);
    });
  });

  // ==========================================================================
  // getDialecticalContinuity
  // ==========================================================================
  describe('getDialecticalContinuity', () => {
    it('returns zeros when no pad exists', () => {
      getWritingPad.mockReturnValue(null);

      const result = getDialecticalContinuity(learnerId);

      expect(result.sessionsWithRecognition).toBe(0);
      expect(result.sessionsWithout).toBe(0);
      expect(result.currentContinuity).toBe(0);
      expect(result.longestContinuity).toBe(0);
      expect(result.trend).toBe('none');
    });

    it('counts sessionsWithRecognition correctly', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      // 3 sessions with recognition moments
      seedRecognitionMoment(testDb, pad.id, { session_id: 's1', created_at: '2024-01-01T00:00:00.000Z' });
      seedRecognitionMoment(testDb, pad.id, { session_id: 's2', created_at: '2024-01-02T00:00:00.000Z' });
      seedRecognitionMoment(testDb, pad.id, { session_id: 's3', created_at: '2024-01-03T00:00:00.000Z' });

      const result = getDialecticalContinuity(learnerId);
      expect(result.sessionsWithRecognition).toBe(3);
    });

    it('computes currentContinuity as streak of consecutive sessions with recognition', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      // All sessions have recognition moments (all consecutive)
      seedRecognitionMoment(testDb, pad.id, { session_id: 's1', created_at: '2024-01-01T00:00:00.000Z' });
      seedRecognitionMoment(testDb, pad.id, { session_id: 's2', created_at: '2024-01-02T00:00:00.000Z' });
      seedRecognitionMoment(testDb, pad.id, { session_id: 's3', created_at: '2024-01-03T00:00:00.000Z' });

      const result = getDialecticalContinuity(learnerId);
      expect(result.currentContinuity).toBe(3);
      expect(result.longestContinuity).toBe(3);
    });

    it('computes longestContinuity across all sessions', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({ id: pad.id });
      getWritingPad.mockReturnValue(mockPad);

      // 3 sessions with recognition, then a gap (event only), then 1 with recognition
      seedRecognitionMoment(testDb, pad.id, { session_id: 's1', created_at: '2024-01-01T00:00:00.000Z' });
      seedRecognitionMoment(testDb, pad.id, { session_id: 's2', created_at: '2024-01-02T00:00:00.000Z' });
      seedRecognitionMoment(testDb, pad.id, { session_id: 's3', created_at: '2024-01-03T00:00:00.000Z' });

      // Session s4 has only an event (no recognition moment) - breaks streak
      seedLearnerEvent(testDb, learnerId, pad.id, { session_id: 's4', event_type: 'resistance' });

      // Session s5 has recognition again
      seedRecognitionMoment(testDb, pad.id, { session_id: 's5', created_at: '2024-01-05T00:00:00.000Z' });

      const result = getDialecticalContinuity(learnerId);
      expect(result.longestContinuity).toBeGreaterThanOrEqual(3);
    });
  });

  // ==========================================================================
  // getLearnerRecognitionProfile
  // ==========================================================================
  describe('getLearnerRecognitionProfile', () => {
    it('aggregates all sub-functions correctly', () => {
      getWritingPad.mockReturnValue(null);

      const result = getLearnerRecognitionProfile(learnerId);

      expect(result.learnerId).toBe(learnerId);
      expect(result.depth).toBeDefined();
      expect(result.milestones).toHaveLength(8);
      expect(result.progression).toBeDefined();
      expect(result.continuity).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.archetypeDescription).toBeNull();
    });

    it('returns archetypeDescription when learning style is set', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({
        id: pad.id,
        unconscious: {
          permanentTraces: [],
          learnerArchetype: {
            preferredLearningStyle: 'autonomous',
            commonStruggles: [],
            breakthroughPatterns: [],
            lastUpdated: null,
          },
          conflictPatterns: [],
        },
      });
      getWritingPad.mockReturnValue(mockPad);

      const result = getLearnerRecognitionProfile(learnerId);
      expect(result.archetypeDescription).toContain('Independent explorer');
    });

    it('returns generic archetypeDescription for unknown style', () => {
      const pad = seedWritingPad(testDb, learnerId);
      const mockPad = buildMockWritingPad({
        id: pad.id,
        unconscious: {
          permanentTraces: [],
          learnerArchetype: {
            preferredLearningStyle: 'collaborative',
            commonStruggles: [],
            breakthroughPatterns: [],
            lastUpdated: null,
          },
          conflictPatterns: [],
        },
      });
      getWritingPad.mockReturnValue(mockPad);

      const result = getLearnerRecognitionProfile(learnerId);
      expect(result.archetypeDescription).toContain('collaborative');
    });
  });

  // ==========================================================================
  // getMilestoneDefinitions
  // ==========================================================================
  describe('getMilestoneDefinitions', () => {
    it('returns all 8 milestone definitions', () => {
      const result = getMilestoneDefinitions();

      expect(Object.keys(result)).toHaveLength(8);
      expect(result.first_negation).toBeDefined();
      expect(result.productive_resistance).toBeDefined();
      expect(result.mutual_transformation).toBeDefined();
      expect(result.memory_consolidation).toBeDefined();
      expect(result.archetype_evolution).toBeDefined();
      expect(result.dialectical_mastery).toBeDefined();
      expect(result.metacognitive_awakening).toBeDefined();
      expect(result.synthesis_achieved).toBeDefined();
    });

    it('returns a copy (not the internal reference)', () => {
      const result1 = getMilestoneDefinitions();
      const result2 = getMilestoneDefinitions();

      // The outer object is a new reference each time (shallow copy)
      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);

      // Adding a new key to the returned object should not affect subsequent calls
      result1.custom_milestone = { key: 'custom', title: 'Custom' };
      const result3 = getMilestoneDefinitions();
      expect(result3.custom_milestone).toBeUndefined();
    });
  });
});
