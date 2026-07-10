import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  clueSafelySignalsAnswer,
  mixedLearnerAnalysisCacheKey,
  parseMixedLearnerArtifacts,
} from '../mixedLearnerArtifacts.js';

describe('mixed learner artifacts', () => {
  it('parses a fenced clue-answer pair', () => {
    const result = parseMixedLearnerArtifacts(`\n\`\`\`json\n{"clue":"Separate what the mark proves from who made it.","answer":"The mark proves the coin is false, not who struck it."}\n\`\`\`\n`);
    assert.equal(result.parsed, true);
    assert.equal(result.clue, 'Separate what the mark proves from who made it.');
    assert.equal(result.answer, 'The mark proves the coin is false, not who struck it.');
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
  });

  it('keys speculative analysis by exact answer and turn state', () => {
    const base = { answer: 'A', turn: 2, history: ['x'], world: 'w', model: 'luna' };
    assert.equal(mixedLearnerAnalysisCacheKey(base), mixedLearnerAnalysisCacheKey({ ...base }));
    assert.notEqual(mixedLearnerAnalysisCacheKey(base), mixedLearnerAnalysisCacheKey({ ...base, answer: 'B' }));
    assert.notEqual(mixedLearnerAnalysisCacheKey(base), mixedLearnerAnalysisCacheKey({ ...base, turn: 3 }));
  });
});
