import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from './fixtures.js';

let testDb = createTestDb();

vi.mock('../dbService.js', () => ({
  getDb: vi.fn(() => {
    if (!testDb) throw new Error('testDb not initialized');
    return testDb;
  }),
  initDb: vi.fn(),
  closeDb: vi.fn(),
  _setDbForTesting: vi.fn(),
}));

const { clearExternalAIProviderHook, setExternalAIProviderHook } = await import('../externalAIProvider.js');
const writingPadService = await import('../writingPadService.js');
const dialogueEngine = await import('../tutorDialogueEngine.js');

function fakeResponse(text) {
  return {
    text,
    model: 'fake-model',
    provider: 'fake-provider',
    latencyMs: 1,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
  };
}

function installFakeProvider() {
  setExternalAIProviderHook({
    handles: () => true,
    call: async ({ channel, messages = [], systemPrompt = '' }) => {
      const prompt = `${systemPrompt}\n${messages.map((message) => message.content || '').join('\n')}`;

      if (channel === 'unified') {
        if (prompt.includes("SUPEREGO agent evaluating ego's revised suggestion")) {
          return fakeResponse(
            JSON.stringify({
              accepts: true,
              assessment: 'The revision now preserves productive struggle.',
              remaining_concerns: null,
              learning: 'Support and autonomy can coexist.',
            }),
          );
        }
        if (prompt.includes('EGO agent in a dialectical negotiation')) {
          return fakeResponse(
            JSON.stringify({
              acknowledgment: 'The direct answer displaced the learner reasoning.',
              reasoning: 'I was trying to unblock a learner who was struggling.',
              revision: 'Which denominator relationship do you notice first?',
              learning: 'I should scaffold without supplying the result.',
            }),
          );
        }
        return fakeResponse(
          JSON.stringify({
            disapproves: true,
            severity: 0.95,
            critique: 'The suggestion gives away the answer.',
            reasoning: 'It violates Socratic rigor.',
            principle: 'socratic_rigor',
          }),
        );
      }

      if (prompt.includes('Reinterpret These Signals')) {
        return fakeResponse(JSON.stringify({ reinterpretations: [], overallCaution: null }));
      }

      return fakeResponse(
        JSON.stringify([
          {
            type: 'practice',
            priority: 'high',
            title: 'Review: fraction division',
            message: 'The answer is to multiply by the reciprocal.',
            actionTarget: '479-lecture-3',
            reasoning: 'The learner has five recorded struggle signals.',
          },
        ]),
      );
    },
  });
}

const context = {
  learnerContext: 'The learner has struggle signals 5 while dividing fractions.',
  curriculumContext: '479-lecture-3: Fraction division',
  simulationsContext: 'No simulation available',
};

describe('tutorDialogueEngine recognition session identity', () => {
  beforeEach(() => {
    testDb.close();
    testDb = createTestDb();
    vi.clearAllMocks();
    dialogueEngine.setQuietMode(true);
    installFakeProvider();
  });

  afterEach(() => {
    clearExternalAIProviderHook();
    dialogueEngine.setQuietMode(false);
    testDb.close();
  });

  it('persists the continued runDialogue ID on every dialectical recognition moment', async () => {
    const learnerId = 'learner-dialectical-session';
    const dialogueId = 'dialogue-shared-across-turns';
    const options = {
      _dialogueId: dialogueId,
      _skipLogging: true,
      maxRounds: 0,
      disableSuperego: true,
      learnerId,
      dialecticalNegotiation: true,
      superegoCompliance: 0.8,
      recognitionSeeking: 0.8,
    };

    const first = await dialogueEngine.runDialogue(context, options);
    const second = await dialogueEngine.runDialogue(context, options);

    expect(first.dialogueId).toBe(dialogueId);
    expect(second.dialogueId).toBe(dialogueId);

    const pad = writingPadService.getWritingPad(learnerId);
    const moments = writingPadService.getRecognitionMoments(pad.id, { sessionId: dialogueId });
    expect(moments).toHaveLength(2);
    expect(moments.every((moment) => moment.session_id === dialogueId)).toBe(true);
  });

  it('gives separate quick dialogues exact, non-null Writing Pad scopes for the same learner', async () => {
    const learnerId = 'learner-quick-session';
    const options = {
      learnerId,
      dialecticalNegotiation: false,
      superegoCompliance: 0.8,
      recognitionSeeking: 0.8,
    };

    const first = await dialogueEngine.quickGenerate(context, options);
    const second = await dialogueEngine.quickGenerate(context, options);

    expect(first.dialogueId).not.toBe(second.dialogueId);
    const pad = writingPadService.getWritingPad(learnerId);
    expect(writingPadService.getRecognitionMoments(pad.id, { sessionId: first.dialogueId })).toHaveLength(1);
    expect(writingPadService.getRecognitionMoments(pad.id, { sessionId: second.dialogueId })).toHaveLength(1);
    expect(writingPadService.getRecognitionMoments(pad.id, { sessionId: null })).toEqual([]);
  });
});
