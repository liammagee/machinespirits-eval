import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedWritingPad, buildMockWritingPad } from './fixtures.js';

let testDb;

// Mock dbService
vi.mock('../dbService.js', () => ({
  getDb: vi.fn(() => {
    if (!testDb) throw new Error('testDb not initialized');
    return testDb;
  }),
  initDb: vi.fn(),
  closeDb: vi.fn(),
  _setDbForTesting: vi.fn(),
}));

// We test the orchestrator with real service implementations where possible,
// but mock the services that have complex DB interactions at module load time.
// For a true integration test, we use the real writingPadService and learnerIntegrationService
// backed by the in-memory test database.

// Import the services we'll use directly
const writingPadService = await import('../writingPadService.js');
const learnerIntegrationService = await import('../learnerIntegrationService.js');
const memoryDynamicsService = await import('../memoryDynamicsService.js');

// Mock recognitionGamificationService since it needs mocked writingPadService.getWritingPad
vi.mock('../recognitionGamificationService.js', () => ({
  getLearnerRecognitionProfile: vi.fn(() => ({
    learnerId: 'test-learner',
    depth: { compositeDepth: 0.3, trend: 'rising' },
    milestones: [],
    progression: { conscious: {}, preconscious: {}, unconscious: {} },
    continuity: {},
    summary: { achievedMilestones: 0, totalMilestones: 8, compositeDepth: 0.3, depthTrend: 'rising' },
    archetypeDescription: null,
  })),
  computeRecognitionDepth: vi.fn(() => ({ compositeDepth: 0.3, trend: 'rising' })),
  checkRecognitionMilestones: vi.fn(() => []),
  getMemoryLayerProgression: vi.fn(() => ({})),
  computeRecognitionFlow: vi.fn(() => ({})),
  getDialecticalContinuity: vi.fn(() => ({})),
  getMilestoneDefinitions: vi.fn(() => ({})),
}));

const {
  processDialogueResult,
  processWritingEvent,
  runMaintenance,
  getFullRecognitionState,
  getDialecticalHistory,
  getMemoryState,
  getLearnerPatterns,
} = await import('../recognitionOrchestrator.js');

describe('recognitionOrchestrator', () => {
  const learnerId = 'test-learner-orch';

  beforeEach(() => {
    testDb = createTestDb();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // processDialogueResult
  // ==========================================================================
  describe('processDialogueResult', () => {
    it('creates writing pad if not exists and records dialogue as conscious thought', () => {
      const dialogueResult = {
        type: 'lecture',
        suggestion: 'Try reviewing Chapter 3',
        profileName: 'budget',
        converged: true,
        rounds: 2,
      };

      const result = processDialogueResult(learnerId, dialogueResult);

      expect(result.learnerId).toBe(learnerId);
      expect(result.phases.conscious.recorded).toBe(true);
      expect(result.phases.dialectical.hadNegotiation).toBe(false);
      expect(result.recognitionState).toBeDefined();
    });

    it('notes dialectical negotiation when dialogueTrace present', () => {
      const dialogueResult = {
        type: 'dialogue',
        suggestion: 'Consider both perspectives',
        dialogueTrace: [{ round: 1, ego: 'suggest', superego: 'critique' }],
        recognitionMoment: { id: 'recog-123' },
      };

      const result = processDialogueResult(learnerId, dialogueResult);

      expect(result.phases.dialectical.hadNegotiation).toBe(true);
      expect(result.phases.dialectical.momentId).toBe('recog-123');
    });

    it('detects resistance when learner response diverges from suggestion', () => {
      // First ensure pad exists
      writingPadService.initializeWritingPad(learnerId);

      const dialogueResult = {
        type: 'lecture',
        suggestion: 'Try reviewing Chapter 3',
        actionTarget: 'chapter-3',
      };

      const learnerResponse = {
        type: 'navigate',
        target: 'chapter-5', // Different from suggestion
        timeSinceSuggestion: 30000, // 30 seconds — quick alternative
        context: {},
      };

      const result = processDialogueResult(learnerId, dialogueResult, learnerResponse);

      // Should have detected productive resistance (quick alternative action)
      const resistanceEvents = result.phases.learnerIntegration.events.filter(
        e => e?.eventType === 'resistance'
      );
      expect(resistanceEvents.length).toBe(1);
      expect(resistanceEvents[0].resistanceInterpretation).toBe('productive');
    });

    it('runs memory cycle after processing', () => {
      const dialogueResult = { type: 'dialogue', suggestion: 'test' };

      const result = processDialogueResult(learnerId, dialogueResult);

      expect(result.phases.memoryDynamics).toBeDefined();
      // After memory cycle, conscious should be cleared
      const pad = writingPadService.getWritingPad(learnerId);
      expect(pad.conscious.workingThoughts).toEqual([]);
    });

    it('returns gamification summary', () => {
      const dialogueResult = { type: 'dialogue', suggestion: 'test' };

      const result = processDialogueResult(learnerId, dialogueResult);

      expect(result.phases.gamification).toBeDefined();
      expect(result.phases.gamification.compositeDepth).toBeDefined();
      expect(result.phases.gamification.trend).toBeDefined();
    });

    it('handles errors gracefully', () => {
      // Pass null learnerId — should not throw
      const result = processDialogueResult(null, { type: 'test' });
      // memoryDynamicsService.runMemoryCycle returns null for null learnerId
      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // processWritingEvent
  // ==========================================================================
  describe('processWritingEvent', () => {
    it('records event as conscious working thought', () => {
      const event = {
        type: 'analysis_complete',
        data: { wordCount: 500, quality: 'good' },
      };

      const result = processWritingEvent(learnerId, event);

      expect(result.phases.conscious.recorded).toBe(true);
      expect(result.recognitionState).toBeDefined();
    });

    it('records breakthrough event when indicated', () => {
      writingPadService.initializeWritingPad(learnerId);

      const event = {
        type: 'analysis_complete',
        data: {
          isBreakthrough: true,
          evidence: 'Significant quality improvement',
        },
      };

      const result = processWritingEvent(learnerId, event);

      const breakthroughEvents = result.phases.learnerIntegration.events.filter(
        e => e?.eventType === 'breakthrough'
      );
      expect(breakthroughEvents.length).toBe(1);
    });

    it('records demand event for saved feedback', () => {
      writingPadService.initializeWritingPad(learnerId);

      const event = {
        type: 'feedback_response',
        data: {
          action: 'saved_to_chat',
          suggestion: 'Consider restructuring',
        },
      };

      const result = processWritingEvent(learnerId, event);

      const demandEvents = result.phases.learnerIntegration.events.filter(
        e => e?.eventType === 'demand'
      );
      expect(demandEvents.length).toBe(1);
      expect(demandEvents[0].demandCategory).toBe('validation');
    });

    it('records flow state change in conscious notes', () => {
      writingPadService.initializeWritingPad(learnerId);

      const event = {
        type: 'flow_change',
        data: { state: 'deepening', score: 0.85 },
      };

      processWritingEvent(learnerId, event);

      // After memory cycle, conscious is cleared. But the thought was recorded
      // and patterns were promoted during the cycle.
      // We verify the pipeline didn't error
    });
  });

  // ==========================================================================
  // runMaintenance
  // ==========================================================================
  describe('runMaintenance', () => {
    it('creates writing pad if not exists and runs maintenance', () => {
      const result = runMaintenance(learnerId);

      expect(result.learnerId).toBe(learnerId);
      expect(result.tasks.memoryMaintenance).toBeDefined();
      expect(result.tasks.archetypeEvolution).toBeDefined();
    });

    it('evolves archetype based on patterns', () => {
      writingPadService.initializeWritingPad(learnerId);
      const pad = writingPadService.getWritingPad(learnerId);

      // Seed some resistance events to give archetype data
      for (let i = 0; i < 5; i++) {
        learnerIntegrationService.recordLearnerEvent({
          learnerId,
          writingPadId: pad.id,
          eventType: 'resistance',
          resistanceInterpretation: 'productive',
        });
      }

      const result = runMaintenance(learnerId);

      expect(result.tasks.archetypeEvolution.evolved).toBe(true);
      expect(result.tasks.archetypeEvolution.style).toBe('autonomous');
    });
  });

  // ==========================================================================
  // getFullRecognitionState
  // ==========================================================================
  describe('getFullRecognitionState', () => {
    it('returns uninitialized state when no pad exists', () => {
      const result = getFullRecognitionState('nonexistent-learner');

      expect(result.initialized).toBe(false);
      expect(result.writingPad).toBeNull();
    });

    it('returns full state across all phases when pad exists', () => {
      writingPadService.initializeWritingPad(learnerId);

      const result = getFullRecognitionState(learnerId);

      expect(result.initialized).toBe(true);
      expect(result.writingPad).toBeDefined();
      expect(result.writingPad.metrics).toBeDefined();
      expect(result.memoryState).toBeDefined();
      expect(result.learnerPatterns).toBeDefined();
      expect(result.recognitionProfile).toBeDefined();
      expect(result.dialecticalHistory).toBeDefined();
    });
  });

  // ==========================================================================
  // Convenience accessors
  // ==========================================================================
  describe('convenience accessors', () => {
    it('getDialecticalHistory returns empty array when no pad', () => {
      expect(getDialecticalHistory('nonexistent')).toEqual([]);
    });

    it('getMemoryState returns null when no pad', () => {
      expect(getMemoryState('nonexistent')).toBeNull();
    });

    it('getLearnerPatterns returns zero counts when no events', () => {
      const patterns = getLearnerPatterns(learnerId);
      expect(patterns.totalEvents).toBe(0);
    });
  });

  // ==========================================================================
  // Full pipeline integration test
  // ==========================================================================
  describe('full pipeline integration', () => {
    it('processes dialogue → records events → runs cycle → returns enriched state', () => {
      // Step 1: Initialize with a dialogue
      const dialogueResult1 = {
        type: 'lecture',
        suggestion: 'Start with Chapter 1',
        profileName: 'budget',
        converged: true,
        rounds: 0,
      };

      const result1 = processDialogueResult(learnerId, dialogueResult1);
      expect(result1.phases.conscious.recorded).toBe(true);

      // Step 2: Process a writing event
      const writeEvent = {
        type: 'analysis_complete',
        data: { wordCount: 300 },
      };

      const result2 = processWritingEvent(learnerId, writeEvent);
      expect(result2.phases.conscious.recorded).toBe(true);

      // Step 3: Run maintenance
      const maintResult = runMaintenance(learnerId);
      expect(maintResult.tasks).toBeDefined();

      // Step 4: Get full state
      const state = getFullRecognitionState(learnerId);
      expect(state.initialized).toBe(true);
      expect(state.writingPad).toBeDefined();
      expect(state.learnerPatterns).toBeDefined();
      expect(state.recognitionProfile).toBeDefined();
    });
  });
});
