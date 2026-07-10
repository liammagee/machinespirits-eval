import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  clueSafelySignalsAnswer,
  consumeMixedLearnerReadyAnnouncement,
  invalidateMixedLearnerCache,
  mixedLearnerAnalysisCacheKey,
  mixedLearnerSuggestionMove,
  parseMixedLearnerArtifacts,
  profileSignalSafelyDescribesAnswer,
  refreshMixedLearnerPrompt,
} from '../mixedLearnerArtifacts.js';

describe('mixed learner artifacts', () => {
  it('announces readiness only once per active learner profile', () => {
    const mixedLearner = { profileId: 'diligent', profile: 'ignored', readyAnnouncementProfileKey: null };
    assert.equal(consumeMixedLearnerReadyAnnouncement(mixedLearner), true);
    assert.equal(consumeMixedLearnerReadyAnnouncement(mixedLearner), false);

    mixedLearner.profileId = 'skeptical';
    assert.equal(consumeMixedLearnerReadyAnnouncement(mixedLearner), true);
    assert.equal(consumeMixedLearnerReadyAnnouncement(mixedLearner), false);
  });

  it('parses a fenced clue-answer pair', () => {
    const result = parseMixedLearnerArtifacts(`\n\`\`\`json\n{"clue":"Separate what the mark proves from who made it.","answer":"The mark proves the coin is false, not who struck it."}\n\`\`\`\n`);
    assert.equal(result.parsed, true);
    assert.equal(result.clue, 'Separate what the mark proves from who made it.');
    assert.equal(result.answer, 'The mark proves the coin is false, not who struck it.');
    assert.equal(result.move, 'respond');
  });

  it('marks a question-shaped suggestion as a learner question', () => {
    const result = parseMixedLearnerArtifacts(
      '{"move":"ask_question","clue":"Ask which evidence could connect metal to a workshop.","answer":"What evidence would connect this alloy to one workshop?","profile_signal":"The response seeks a warrant before accepting the proposed connection."}',
    );
    assert.equal(result.move, 'ask_question');
    assert.equal(
      result.profileSignal,
      'The response seeks a warrant before accepting the proposed connection.',
    );
    assert.equal(mixedLearnerSuggestionMove('Could I test the residue first?'), 'ask_question');
    assert.equal(mixedLearnerSuggestionMove('I would test the residue.', 'ask_question'), 'ask_question');
  });

  it('keeps profile explanation separate from the learner answer', () => {
    assert.equal(
      profileSignalSafelyDescribesAnswer(
        'The draft asks for permission instead of choosing an evidence test.',
        'Could you choose which mark I should test?',
      ),
      'The draft asks for permission instead of choosing an evidence test.',
    );
    assert.equal(
      profileSignalSafelyDescribesAnswer('Could you choose which mark I should test?', 'Could you choose which mark I should test?'),
      null,
    );
  });

  it('rejects a clue that simply reveals the answer', () => {
    assert.equal(clueSafelySignalsAnswer('The answer is alloy.', 'The answer is alloy.'), false);
    assert.equal(
      parseMixedLearnerArtifacts('{"clue":"The coin came from Edony","answer":"The coin came from Edony"}').clue,
      null,
    );
  });

  it('falls back to a plain learner answer when JSON is unavailable', () => {
    const result = parseMixedLearnerArtifacts('I would test the metal first.');
    assert.equal(result.parsed, false);
    assert.equal(result.answer, 'I would test the metal first.');
    assert.equal(result.clue, null);
    assert.equal(result.profileSignal, null);
  });

  it('keys speculative analysis by exact answer and turn state', () => {
    const base = { answer: 'A', turn: 2, history: ['x'], world: 'w', model: 'luna' };
    assert.equal(mixedLearnerAnalysisCacheKey(base), mixedLearnerAnalysisCacheKey({ ...base }));
    assert.notEqual(mixedLearnerAnalysisCacheKey(base), mixedLearnerAnalysisCacheKey({ ...base, answer: 'B' }));
    assert.notEqual(mixedLearnerAnalysisCacheKey(base), mixedLearnerAnalysisCacheKey({ ...base, turn: 3 }));
  });

  it('resets a stale readline cursor before showing a new empty prompt', () => {
    const promptCalls = [];
    const readlineInterface = {
      line: '',
      cursor: 17,
      prompt(preserveCursor) {
        promptCalls.push(preserveCursor);
      },
    };

    assert.deepEqual(refreshMixedLearnerPrompt(readlineInterface), {
      hasBufferedInput: false,
      cursor: 0,
    });
    assert.deepEqual(promptCalls, [false]);
  });

  it('preserves the cursor when the learner has started typing', () => {
    const promptCalls = [];
    const readlineInterface = {
      line: 'partly typed',
      cursor: 4,
      prompt(preserveCursor) {
        promptCalls.push(preserveCursor);
      },
    };

    assert.deepEqual(refreshMixedLearnerPrompt(readlineInterface), {
      hasBufferedInput: true,
      cursor: 4,
    });
    assert.deepEqual(promptCalls, [true]);
  });

  it('invalidates a cached suggestion, analysis, and prefetched tutor response together', () => {
    let artifactAborts = 0;
    let analysisAborts = 0;
    const cachedAnalysis = {
      key: 'old-profile-key',
      status: 'ready',
      raw: { classification: 'old profile' },
      error: null,
      promise: Promise.resolve(),
      tutorStatus: 'ready',
      tutorContextKey: 'old-tutor-context',
      tutorPromise: Promise.resolve(),
      tutorResponse: { text: 'stale tutor response' },
      tutorError: null,
      abortController: { abort: () => (analysisAborts += 1) },
    };
    const mixedLearner = {
      seq: 7,
      pending: { requestId: 7 },
      suggestion: { text: 'stale learner answer', clue: 'stale clue' },
      error: { message: 'stale error' },
      artifactAbortController: { abort: () => (artifactAborts += 1) },
      analysisCache: cachedAnalysis,
    };

    const result = invalidateMixedLearnerCache(mixedLearner);

    assert.equal(result.hadState, true);
    assert.equal(result.discardedAnalysis, true);
    assert.equal(result.discardedTutorResponse, true);
    assert.equal(artifactAborts, 1);
    assert.equal(analysisAborts, 1);
    assert.equal(mixedLearner.seq, 8);
    assert.equal(mixedLearner.pending, null);
    assert.equal(mixedLearner.suggestion, null);
    assert.equal(mixedLearner.error, null);
    assert.equal(mixedLearner.analysisCache, null);
    assert.equal(cachedAnalysis.status, 'discarded');
    assert.equal(cachedAnalysis.raw, null);
    assert.equal(cachedAnalysis.promise, null);
    assert.equal(cachedAnalysis.tutorStatus, 'discarded');
    assert.equal(cachedAnalysis.tutorContextKey, null);
    assert.equal(cachedAnalysis.tutorPromise, null);
    assert.equal(cachedAnalysis.tutorResponse, null);
  });
});
