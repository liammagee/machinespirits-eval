import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from './fixtures.js';

// Line A, notes/2026-07-06-longitudinal-drift-adaptation-prereg.md §8.8.
//
// This is the canonical-channel proof for the four read-path fixes (bugs
// 1-4), replacing the external writingPadNarrativeBuilder.js workaround as
// the mechanism under test for A4. It exercises the REAL
// negotiateDialectically / generateSuperegoCritique / writingPadService /
// memoryDynamicsService functions across a simulated two-session boundary,
// mocking only the true LLM boundary (aiService.generateText) and the DB.
// No external injection file is used anywhere in this test.
//
// Session 1: a negotiation reaches synthesis (mutual acknowledgment), which
// creates a recognition moment (bug 4: synthesis_resolution now survives the
// read). We then mirror bug 3's write (egoGenerateSuggestions itself isn't
// exported, so its conscious.workingThoughts write is reproduced inline,
// exactly as implemented) and run the same memory-cycle + eager
// consolidation calls the live path runs at end-of-session
// (evaluationRunner.js's runBackgroundMaintenance with
// {minAge: 0, requireTransformative: false}), settling the moment into
// unconscious.permanentTraces (bug 2's fix also exercised for its
// clear-ordering safety, though contextRetrieval isn't requested here).
//
// Session 2: a fresh generateSuperegoCritique call, on a freshly re-fetched
// pad, must see session 1's synthesis text in its prompt (bug 1's fix) —
// proving the internal path alone carries content across a session
// boundary.

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

vi.mock('../aiService.js', () => ({
  generateText: vi.fn(),
}));

const writingPadService = await import('../writingPadService.js');
const memoryDynamicsService = await import('../memoryDynamicsService.js');
const { negotiateDialectically, generateSuperegoCritique } = await import('../dialecticalEngine.js');
const aiService = await import('../aiService.js');

const SESSION1_MARKER =
  "SESSION1-MARKER: let's isolate which step in dividing fractions is confusing before I show you a shortcut.";

describe('Writing Pad internal read-path — end-to-end canonical channel (bugs 1+2+3+4 combined)', () => {
  beforeEach(() => {
    testDb = createTestDb();
    vi.clearAllMocks();
  });

  it('carries session-1 recognition-moment content into session-2 superego prompt with no external file', async () => {
    const learnerId = 'learner-e2e-canonical';

    // ---- Session 1 ----
    const session1Pad = writingPadService.getOrInitializeWritingPad(learnerId);

    aiService.generateText
      // Step 1: superego critique — disapproves (raw severity 0.95 * compliance 0.7 = 0.665 > 0.5 threshold)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          disapproves: true,
          severity: 0.95,
          critique: 'This gives the answer directly instead of letting the learner work it out.',
          reasoning: 'Violates Socratic rigor',
          principle: 'socratic_rigor',
        }),
      })
      // Round 1: ego responds with a revision containing the marker
      .mockResolvedValueOnce({
        text: JSON.stringify({
          acknowledgment: 'Fair — I jumped to the procedure too fast.',
          reasoning: 'Learner seemed stuck, so I wanted to unblock them quickly.',
          revision: SESSION1_MARKER,
          learning: 'I should scaffold discovery rather than hand over the rule.',
        }),
      })
      // Round 1: superego evaluates the revision — accepts
      .mockResolvedValueOnce({
        text: JSON.stringify({
          accepts: true,
          assessment: 'This revision respects the learner\'s own reasoning process.',
          remaining_concerns: null,
          learning: 'The ego can be redirected toward inquiry without losing warmth.',
        }),
      });

    const negotiation = await negotiateDialectically({
      learnerId,
      sessionId: 'session-1',
      egoSuggestion: {
        message: 'Here is the answer: multiply by the reciprocal of the second fraction.',
        reasoning: 'Direct instruction to unblock the learner',
      },
      learnerContext: 'Learner is stuck on dividing fractions.',
      writingPad: session1Pad,
      superegoCompliance: 0.7,
      recognitionSeeking: 0.6,
      allowGenuineConflict: true,
      maxNegotiationRounds: 1,
    });

    expect(negotiation.synthesized).toBe(true);
    expect(negotiation.resolution).toBe(SESSION1_MARKER);
    expect(negotiation.recognitionMoment).not.toBeNull();
    expect(negotiation.recognitionMoment.synthesis_resolution).toBe(SESSION1_MARKER);

    // Mirror bug 3's fix (egoGenerateSuggestions isn't exported, so its
    // conscious.workingThoughts write is reproduced inline exactly as
    // implemented in tutorDialogueEngine.js).
    const preWrite = writingPadService.getWritingPad(learnerId);
    writingPadService.updateConscious(learnerId, {
      workingThoughts: [
        ...(preWrite.conscious.workingThoughts || []),
        {
          type: 'suggestion',
          suggestionType: 'suggestion',
          content: negotiation.resolution,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    // Per-turn memory cycle (always runs on the live path).
    memoryDynamicsService.runMemoryCycle(learnerId, {});

    // End-of-session eager consolidation (mirrors evaluationRunner.js).
    memoryDynamicsService.runBackgroundMaintenance(learnerId, {
      consolidation: { minAge: 0, requireTransformative: false },
    });

    const padAfterSession1 = writingPadService.getWritingPad(learnerId);
    expect(padAfterSession1.unconscious.permanentTraces.length).toBe(1);
    expect(padAfterSession1.unconscious.permanentTraces[0].synthesis).toBe(SESSION1_MARKER);
    expect(padAfterSession1.conscious.workingThoughts).toEqual([]);

    // ---- Session 2 (fresh turn, fresh pad fetch) ----
    aiService.generateText.mockResolvedValueOnce({
      text: JSON.stringify({
        disapproves: false,
        severity: 0.0,
        critique: null,
        reasoning: 'Sound follow-up question',
      }),
    });

    const session2Pad = writingPadService.getWritingPad(learnerId);
    await generateSuperegoCritique({
      egoSuggestion: { message: "Let's pick up where we left off on fraction division.", reasoning: 'Session opener' },
      learnerContext: 'Learner is starting session 2.',
      writingPad: session2Pad,
      compliance: 0.7,
    });

    const session2Call = aiService.generateText.mock.calls[aiService.generateText.mock.calls.length - 1][0];
    expect(session2Call.prompt).toContain('Prior recognition moments (from unconscious memory, most recent last):');
    expect(session2Call.prompt).toContain(SESSION1_MARKER);
  });
});
