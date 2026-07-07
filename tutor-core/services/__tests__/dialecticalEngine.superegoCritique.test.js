import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from './fixtures.js';

// Line A, notes/2026-07-06-longitudinal-drift-adaptation-prereg.md §8.8, bug 1:
// unconscious.permanentTraces is the one Writing Pad layer the live path
// already populates with real content (writingPadService.settleToUnconscious,
// called from this module's own negotiateDialectically on a real
// superego-disapproval synthesis), but until now nothing downstream ever
// read it back into a prompt. recognitionOrchestrator.js was meant to be
// that reader but has zero callers on the request path. The fix adds a
// direct, minimal read inside generateSuperegoCritique, the one function
// that already builds this exact "Learner archetype" / "Recent patterns"
// prompt section.

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

let lastGenerateTextCall = null;
vi.mock('../aiService.js', () => ({
  generateText: vi.fn(async (args) => {
    lastGenerateTextCall = args;
    return {
      text: JSON.stringify({
        disapproves: false,
        severity: 0.0,
        critique: null,
        reasoning: 'Suggestion is pedagogically sound',
      }),
    };
  }),
}));

const writingPadService = await import('../writingPadService.js');
const { generateSuperegoCritique } = await import('../dialecticalEngine.js');

describe('dialecticalEngine.generateSuperegoCritique — bug 1 (prior-session-memory read)', () => {
  beforeEach(() => {
    testDb = createTestDb();
    vi.clearAllMocks();
    lastGenerateTextCall = null;
  });

  it('embeds unconscious.permanentTraces synthesis text into the superego prompt', async () => {
    const learnerId = 'learner-bug1-a';
    writingPadService.initializeWritingPad(learnerId);
    writingPadService.updateUnconscious(learnerId, {
      permanentTraces: [
        {
          id: 'trace-1',
          timestamp: new Date(Date.now() - 100000).toISOString(),
          synthesis: 'BUG1-MARKER-OLD',
          recognitionType: 'pedagogical',
          struggleDepth: 0.4,
        },
        {
          id: 'trace-2',
          timestamp: new Date().toISOString(),
          synthesis: 'BUG1-MARKER-RECENT breakthrough on long division',
          recognitionType: 'metacognitive',
          struggleDepth: 0.7,
        },
      ],
    });
    const writingPad = writingPadService.getWritingPad(learnerId);

    await generateSuperegoCritique({
      egoSuggestion: { message: 'Try breaking the problem into smaller steps.', reasoning: 'Scaffolding' },
      learnerContext: 'Learner is midway through a fractions unit.',
      writingPad,
      compliance: 0.7,
    });

    expect(lastGenerateTextCall).not.toBeNull();
    expect(lastGenerateTextCall.prompt).toContain('Prior recognition moments (from unconscious memory, most recent last):');
    expect(lastGenerateTextCall.prompt).toContain('BUG1-MARKER-RECENT breakthrough on long division');
  });

  it('falls back to an empty-array placeholder when there are no permanent traces', async () => {
    const learnerId = 'learner-bug1-b';
    writingPadService.initializeWritingPad(learnerId);
    const writingPad = writingPadService.getWritingPad(learnerId);

    await generateSuperegoCritique({
      egoSuggestion: { message: 'Try again.', reasoning: 'Encouragement' },
      learnerContext: 'Learner just started.',
      writingPad,
      compliance: 0.7,
    });

    expect(lastGenerateTextCall.prompt).toContain(
      'Prior recognition moments (from unconscious memory, most recent last):\n[]'
    );
  });

  it('falls back to an empty-array placeholder when writingPad itself is null', async () => {
    await generateSuperegoCritique({
      egoSuggestion: { message: 'Try again.', reasoning: 'Encouragement' },
      learnerContext: 'No pad at all.',
      writingPad: null,
      compliance: 0.7,
    });

    expect(lastGenerateTextCall.prompt).toContain(
      'Prior recognition moments (from unconscious memory, most recent last):\n[]'
    );
  });

  it('includes only the 3 most recent traces, ordered oldest-to-newest', async () => {
    const learnerId = 'learner-bug1-c';
    writingPadService.initializeWritingPad(learnerId);
    writingPadService.updateUnconscious(learnerId, {
      permanentTraces: [
        { synthesis: 'TRACE-OLDEST-DROPPED' },
        { synthesis: 'TRACE-TWO' },
        { synthesis: 'TRACE-THREE' },
        { synthesis: 'TRACE-FOUR-NEWEST' },
      ],
    });
    const writingPad = writingPadService.getWritingPad(learnerId);

    await generateSuperegoCritique({
      egoSuggestion: { message: 'Try again.', reasoning: 'x' },
      learnerContext: 'ctx',
      writingPad,
      compliance: 0.7,
    });

    expect(lastGenerateTextCall.prompt).not.toContain('TRACE-OLDEST-DROPPED');
    expect(lastGenerateTextCall.prompt).toContain('TRACE-TWO');
    expect(lastGenerateTextCall.prompt).toContain('TRACE-FOUR-NEWEST');

    const idxTwo = lastGenerateTextCall.prompt.indexOf('TRACE-TWO');
    const idxFour = lastGenerateTextCall.prompt.indexOf('TRACE-FOUR-NEWEST');
    expect(idxFour).toBeGreaterThan(idxTwo);
  });

  it('does not build a prompt at all when compliance is below the audibility floor', async () => {
    const result = await generateSuperegoCritique({
      egoSuggestion: { message: 'Try again.', reasoning: 'x' },
      learnerContext: 'ctx',
      writingPad: null,
      compliance: 0.1,
    });

    expect(result.disapproves).toBe(false);
    expect(lastGenerateTextCall).toBeNull();
  });
});
