import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cleanTutorStubClarificationSpeech,
  cleanTutorStubStageSpeech,
  latestQuestionFromText,
} from '../tutorStubStageSpeech.js';

describe('tutor-stub stage speech', () => {
  it('keeps learner speech inside the scene', () => {
    assert.equal(
      cleanTutorStubStageSpeech("The tutor’s question is clear, but the learner’s answer is not."),
      'Your question is clear, but my answer is not.',
    );
    assert.equal(
      cleanTutorStubStageSpeech('I am responding to the prompt in this tutoring dialogue.'),
      'I am responding to what you asked in this inquiry.',
    );
  });

  it('extracts the latest live question from a line', () => {
    assert.equal(
      latestQuestionFromText(
        'The residue matches the mint crucible. What would that show about the blanks prepared there?',
      ),
      'What would that show about the blanks prepared there?',
    );
  });

  it('replaces third-person pending-question commentary with the live question', () => {
    const latestTutor =
      '“Blanks” are pieces of alloy prepared before striking. What would matching crucible residue show about those blanks?';
    const clarification =
      '“Blanks” are the pieces of debased silver alloy prepared for coins before they are struck with the coin’s design. The tutor’s question about what matching crucible residue would show about those blanks is still pending.';

    assert.equal(
      cleanTutorStubClarificationSpeech(clarification, latestTutor),
      '“Blanks” are the pieces of debased silver alloy prepared for coins before they are struck with the coin’s design. What would matching crucible residue show about those blanks?',
    );
  });
});
