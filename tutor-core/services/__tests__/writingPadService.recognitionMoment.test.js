import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedWritingPad, seedRecognitionMoment } from './fixtures.js';

// Line A, notes/2026-07-06-longitudinal-drift-adaptation-prereg.md §8.8, bug 4:
// getRecognitionMoment/getRecognitionMoments both silently dropped the
// synthesis_resolution column from their returned objects, even though
// createRecognitionMoment's INSERT writes it correctly. This meant
// writingPadService.settleToUnconscious's own read of
// `recognitionMoment.synthesis_resolution` always saw `undefined` on the
// real write path (confirmed against the real A2 production pad — every one
// of its 10 permanentTraces entries had no `synthesis` key at all).

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

const { createRecognitionMoment, getRecognitionMoment, getRecognitionMoments } =
  await import('../writingPadService.js');

describe('writingPadService recognition-moment accessors — bug 4 (synthesis_resolution allowlist)', () => {
  beforeEach(() => {
    testDb = createTestDb();
    vi.clearAllMocks();
  });

  it('getRecognitionMoment surfaces synthesis_resolution written by createRecognitionMoment', () => {
    const pad = seedWritingPad(testDb, 'learner-bug4-a');
    const created = createRecognitionMoment({
      writingPadId: pad.id,
      sessionId: null,
      ghostDemand: { voice: 'rigor', principle: 'socratic_rigor' },
      learnerNeed: { need: 'scaffolding', intensity: 0.5 },
      synthesis: { synthesis: 'BUG4-MARKER learner reached a breakthrough on fractions', transformative: true },
      parameters: { superegoCompliance: 0.7, recognitionSeeking: 0.6 },
    });

    const fetched = getRecognitionMoment(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched.synthesis_resolution).toBe('BUG4-MARKER learner reached a breakthrough on fractions');
  });

  it('getRecognitionMoments surfaces synthesis_resolution for every row in the list', () => {
    const pad = seedWritingPad(testDb, 'learner-bug4-b');
    createRecognitionMoment({
      writingPadId: pad.id,
      sessionId: null,
      ghostDemand: { voice: 'v', principle: 'p' },
      learnerNeed: { need: 'n', intensity: 0.4 },
      synthesis: { synthesis: 'BUG4-MARKER-LIST', transformative: true },
      parameters: {},
    });

    const moments = getRecognitionMoments(pad.id, { limit: 10 });
    expect(moments.length).toBe(1);
    expect(moments[0].synthesis_resolution).toBe('BUG4-MARKER-LIST');
  });

  it('returns a falsy synthesis_resolution (not a thrown error) for a moment with none set', () => {
    const pad = seedWritingPad(testDb, 'learner-bug4-c');
    const row = seedRecognitionMoment(testDb, pad.id, { synthesis_resolution: null });

    const fetched = getRecognitionMoment(row.id);
    expect(fetched.synthesis_resolution).toBeFalsy();

    const moments = getRecognitionMoments(pad.id);
    expect(moments[0].synthesis_resolution).toBeFalsy();
  });

  it('getRecognitionMoment returns null for an unknown id without throwing', () => {
    expect(getRecognitionMoment('does-not-exist')).toBeNull();
  });
});
