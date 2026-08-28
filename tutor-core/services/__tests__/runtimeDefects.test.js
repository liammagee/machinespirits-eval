// Two runtime faults a no-ignore ESLint audit found inside the in-housed
// module. Both are live branches that throw before doing any work, and neither
// had a test. These reproduce them first, so the repair is checked rather than
// assumed.
//
//   1. negotiateDialectically() destructures `learnerContext` as a const and
//      then reassigns it when a writing-pad demand event is present. Under an
//      ES module's strict mode that is a TypeError, thrown before the superego
//      critique is ever generated.
//   2. quickGenerate() passes a bare `hyperparameters` identifier into
//      egoGenerateSuggestions(). Nothing declares it at module scope, so
//      reading it is a ReferenceError and the exported function cannot run.
//
// No provider is reached: every model call is mocked.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from './fixtures.js';

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

let superegoPrompts = [];
vi.mock('../aiService.js', () => ({
  generateText: vi.fn(async (args) => {
    superegoPrompts.push(args);
    return {
      text: JSON.stringify({
        disapproves: false,
        severity: 0,
        critique: null,
        reasoning: 'Suggestion is pedagogically sound',
      }),
    };
  }),
}));

let learnerEvents = [];
vi.mock('../learnerIntegrationService.js', () => ({
  getLearnerEvents: vi.fn(() => learnerEvents),
}));

const writingPadService = await import('../writingPadService.js');
const { negotiateDialectically } = await import('../dialecticalEngine.js');

describe('dialecticalEngine.negotiateDialectically — writing-pad demand branch', () => {
  beforeEach(() => {
    testDb = createTestDb();
    vi.clearAllMocks();
    superegoPrompts = [];
    learnerEvents = [];
  });

  it('runs the demand branch instead of throwing on a constant assignment', async () => {
    const learnerId = 'learner-demand-branch';
    writingPadService.initializeWritingPad(learnerId);
    const writingPad = writingPadService.getWritingPad(learnerId);
    learnerEvents = [
      {
        eventType: 'demand',
        demandCategory: 'more_challenge',
        demandStrength: 0.82,
      },
    ];

    const result = await negotiateDialectically({
      learnerId,
      egoSuggestion: { suggestions: [{ title: 'Try a harder variant' }] },
      learnerContext: 'The learner solved the last three items quickly.',
      writingPad,
    });

    expect(result.synthesized).toBe(true);
    // The demand is what the branch exists to add, so the superego must
    // actually see it in its prompt.
    expect(superegoPrompts.length).toBeGreaterThan(0);
    const prompt = JSON.stringify(superegoPrompts[0]);
    expect(prompt).toContain('more_challenge');
    expect(prompt).toContain('0.82');
    // The original context is extended, not replaced.
    expect(prompt).toContain('solved the last three items quickly');
  });

  it('leaves the context alone when there is no demand event', async () => {
    const learnerId = 'learner-no-demand';
    writingPadService.initializeWritingPad(learnerId);
    const writingPad = writingPadService.getWritingPad(learnerId);
    learnerEvents = [];

    const result = await negotiateDialectically({
      learnerId,
      egoSuggestion: { suggestions: [{ title: 'Keep going' }] },
      learnerContext: 'Steady progress.',
      writingPad,
    });

    expect(result.synthesized).toBe(true);
    const prompt = JSON.stringify(superegoPrompts[0]);
    expect(prompt).toContain('Steady progress.');
    expect(prompt).not.toContain('Recent learner demand');
  });
});

describe('tutorDialogueEngine.quickGenerate — hyperparameters option', () => {
  it('reads the caller hyperparameters instead of an undeclared identifier', async () => {
    const engine = await import('../tutorDialogueEngine.js');

    // The fault is in building the ego call arguments, which happens before
    // any provider call, so an unconfigured provider is enough to reach it.
    // A ReferenceError here means the identifier is still undeclared.
    let thrown = null;
    try {
      await engine.quickGenerate(
        { learnerContext: 'ctx', curriculumContext: 'curriculum', simulationsContext: 'sims' },
        { hyperparameters: { temperature: 0.1, max_tokens: 64 } },
      );
    } catch (error) {
      thrown = error;
    }

    if (thrown) {
      expect(thrown).not.toBeInstanceOf(ReferenceError);
      expect(String(thrown.message)).not.toMatch(/hyperparameters is not defined/u);
    }
  });
});
