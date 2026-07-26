import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_RESUME_HANDOFF_SCHEMA,
  buildTutorStubResumeHandoff,
  tutorStubResumeReprise,
} from '../services/tutorStubResumeHandoff.js';

test('resume handoff summarizes the public stopping point and repeats the latest tutor question', () => {
  const handoff = buildTutorStubResumeHandoff({
    world: { question: 'Who struck the false shillings?' },
    turns: [
      {
        turn: 3,
        turnId: 'run:t003',
        learner: 'The residue might connect one crucible to the coins.',
        tutor:
          'That narrows the comparison to the public assay marks. Which residue mark connects the coins to one crucible?',
      },
    ],
  });

  assert.equal(handoff.schema, TUTOR_STUB_RESUME_HANDOFF_SCHEMA);
  assert.equal(handoff.sourceTurn, 3);
  assert.equal(handoff.sourceTurnId, 'run:t003');
  assert.equal(handoff.repriseKind, 'question');
  assert.equal(handoff.repriseText, 'Which residue mark connects the coins to one crucible?');
  assert.match(handoff.text, /^Welcome back\./u);
  assert.match(handoff.text, /We were working on this question: Who struck the false shillings\?/u);
  assert.match(handoff.text, /You had just put this on the table: “The residue might connect/u);
  assert.match(handoff.text, /We paused at this question: Which residue mark/u);
  assert.equal(handoff.publicTranscriptChanged, true);
  assert.equal(handoff.proofStateChanged, false);
});

test('resume handoff repeats a final point when the tutor did not leave a question', () => {
  const handoff = buildTutorStubResumeHandoff({
    world: { question: 'Which explanation is warranted?' },
    turns: [
      {
        turn: 1,
        learner: 'The record only establishes the interface.',
        tutor: 'The implementation method is still open on the public evidence.',
      },
    ],
  });

  assert.equal(handoff.repriseKind, 'point');
  assert.match(handoff.text, /We paused at this point: The implementation method is still open/u);
});

test('resume handoff does not duplicate the public question when it was also the last tutor question', () => {
  const handoff = buildTutorStubResumeHandoff({
    world: { question: 'What does the assay establish?' },
    turns: [{ turn: 1, learner: 'I am unsure.', tutor: 'What does the assay establish?' }],
  });

  assert.equal(handoff.text.match(/What does the assay establish\?/gu)?.length, 1);
  assert.match(handoff.text, /working on—and paused at—this question/u);
});

test('resume reprise prefers the latest question over a later stage direction', () => {
  assert.deepEqual(tutorStubResumeReprise('Compare the two marks. Which one differs? Keep the record in view.'), {
    kind: 'question',
    text: 'Which one differs?',
  });
});

test('resume handoff requires a completed public tutor turn', () => {
  assert.equal(buildTutorStubResumeHandoff({ world: { question: 'What happened?' }, turns: [] }), null);
});
