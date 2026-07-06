import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from './fixtures.js';

// Line A, notes/2026-07-06-longitudinal-drift-adaptation-prereg.md §8.8, bug 2:
// runMemoryCycle's context-retrieval step queried unconscious for relevant
// prior traces (retrieveUnconsciousContext) but only attached the result to
// this function's own return value — nothing durable. Every call, the
// insight was retrieved then discarded before the next turn could ever see
// it. The fix persists each retrieved insight into preconscious.recentPatterns
// (the exact layer dialecticalEngine.js's generateSuperegoCritique already
// reads), taking care not to write into conscious — step 3 of this same
// function clears conscious immediately after.

let testDb;

vi.mock('../dbService.js', () => ({
  getDb: vi.fn(() => {
    if (!testDb) throw new Error('testDb not initialized');
    return testDb;
  }),
  initDb: vi.fn(),
  closeDb: vi.fn(),
  _setDbForTesting: vi.fn(),
}));

// writingPadService.js -> tutorDialogueEngine.js (for isQuietOrTranscript) ->
// aiService.js -> aiConfigService.js, which calls getDb() at module-load
// time. Without this mock, that top-level call reaches the real dbService
// mock's getDb() before beforeEach has a chance to set testDb, and throws.
vi.mock('../aiService.js', () => ({
  generateText: vi.fn(),
}));

const writingPadService = await import('../writingPadService.js');
const { runMemoryCycle } = await import('../memoryDynamicsService.js');

describe('memoryDynamicsService.runMemoryCycle — bug 2 (retrieved context is now persisted)', () => {
  beforeEach(() => {
    testDb = createTestDb();
    vi.clearAllMocks();
  });

  it('does not add any recalled_context pattern when retrieveContext is not requested', () => {
    const learnerId = 'learner-bug2-a';

    const result = runMemoryCycle(learnerId, {});

    expect(result).not.toBeNull();
    expect(result.operations.contextRetrieval).toBeUndefined();

    const pad = writingPadService.getWritingPad(learnerId);
    expect(pad.preconscious.recentPatterns).toEqual([]);
  });

  it('persists retrieved unconscious insights into preconscious.recentPatterns when retrieveContext is true', () => {
    const learnerId = 'learner-bug2-b';
    // First call auto-initializes the pad (runMemoryCycle's own first line).
    runMemoryCycle(learnerId, {});

    // Seed unconscious memory the way settleToUnconscious would leave it,
    // via the real updateUnconscious accessor (no manual DB row poking).
    writingPadService.updateUnconscious(learnerId, {
      permanentTraces: [
        {
          id: 'trace-bug2',
          timestamp: new Date().toISOString(),
          synthesis: 'BUG2-MARKER learner and tutor reached a shared framing of long division',
          recognitionType: 'metacognitive',
          struggleDepth: 0.7,
        },
      ],
    });

    const result = runMemoryCycle(learnerId, { retrieveContext: true });

    expect(result).not.toBeNull();
    expect(result.operations.contextRetrieval.relevantTraces).toBe(1);

    const pad = writingPadService.getWritingPad(learnerId);
    const recalled = pad.preconscious.recentPatterns.filter(p => p.type === 'recalled_context');
    expect(recalled.length).toBe(1);
    expect(recalled[0].observation).toBe(
      'BUG2-MARKER learner and tutor reached a shared framing of long division'
    );
  });

  it('still clears the conscious layer in the same cycle that persists recalled context (ordering safety)', () => {
    const learnerId = 'learner-bug2-c';
    runMemoryCycle(learnerId, {});
    writingPadService.updateConscious(learnerId, {
      workingThoughts: [{ type: 'suggestion', suggestionType: 'hint', content: 'x', timestamp: new Date().toISOString() }],
    });
    writingPadService.updateUnconscious(learnerId, {
      permanentTraces: [
        { id: 't1', timestamp: new Date().toISOString(), synthesis: 'ORDERING-MARKER', recognitionType: 'pedagogical', struggleDepth: 0.5 },
      ],
    });

    runMemoryCycle(learnerId, { retrieveContext: true });

    const pad = writingPadService.getWritingPad(learnerId);
    // The recalled_context pattern from unconscious must survive...
    expect(pad.preconscious.recentPatterns.some(p => p.observation === 'ORDERING-MARKER')).toBe(true);
    // ...while conscious.workingThoughts (this turn's ephemeral notes) is wiped.
    expect(pad.conscious.workingThoughts).toEqual([]);
  });

  it('uses a low-confidence placeholder observation when a trace has no synthesis text', () => {
    const learnerId = 'learner-bug2-d';
    runMemoryCycle(learnerId, {});
    writingPadService.updateUnconscious(learnerId, {
      permanentTraces: [
        { id: 't-no-synth', timestamp: new Date().toISOString(), synthesis: null, recognitionType: 'existential', struggleDepth: 0.9 },
      ],
    });

    runMemoryCycle(learnerId, { retrieveContext: true });

    const pad = writingPadService.getWritingPad(learnerId);
    const recalled = pad.preconscious.recentPatterns.find(p => p.type === 'recalled_context');
    expect(recalled).toBeDefined();
    expect(recalled.observation).toBe('(prior recognition moment with no synthesis text)');
  });

  it('returns null and does not throw when learnerId is missing', () => {
    expect(runMemoryCycle(null, { retrieveContext: true })).toBeNull();
    expect(runMemoryCycle(undefined, {})).toBeNull();
  });
});
