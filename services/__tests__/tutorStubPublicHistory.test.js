import assert from 'node:assert/strict';
import test from 'node:test';

import { tutorStubPublicMessageContext, tutorStubPublicMessagesForSpeaker } from '../tutorStubPublicHistory.js';

const storedHistory = [
  { role: 'system', content: 'private system text' },
  { role: 'assistant', content: 'Tutor opening' },
  { role: 'user', content: 'Learner reply one' },
  { role: 'assistant', content: 'Tutor reply one' },
  { role: 'user', content: 'Learner reply two' },
];

test('tutor receives the complete public history in tutor-relative roles', () => {
  assert.deepEqual(tutorStubPublicMessagesForSpeaker(storedHistory, { speaker: 'tutor' }), [
    { role: 'assistant', content: 'Tutor opening' },
    { role: 'user', content: 'Learner reply one' },
    { role: 'assistant', content: 'Tutor reply one' },
    { role: 'user', content: 'Learner reply two' },
  ]);
});

test('learner receives the same complete public history with speaker-relative roles inverted', () => {
  assert.deepEqual(tutorStubPublicMessagesForSpeaker(storedHistory, { speaker: 'learner' }), [
    { role: 'user', content: 'Tutor opening' },
    { role: 'assistant', content: 'Learner reply one' },
    { role: 'user', content: 'Tutor reply one' },
    { role: 'assistant', content: 'Learner reply two' },
  ]);
});

test('public message context always reports full replay and role counts', () => {
  assert.deepEqual(tutorStubPublicMessageContext(storedHistory, { speaker: 'learner' }), {
    schema: 'machinespirits.tutor-stub.public-message-context.v2',
    historyMode: 'full_public_replay',
    speaker: 'learner',
    messages: [
      { role: 'user', content: 'Tutor opening' },
      { role: 'assistant', content: 'Learner reply one' },
      { role: 'user', content: 'Tutor reply one' },
      { role: 'assistant', content: 'Learner reply two' },
    ],
    availableMessageCount: 4,
    replayedMessageCount: 4,
    userMessageCount: 2,
    assistantMessageCount: 2,
    activatedBy: 'session_start',
  });
});

test('public history rejects an unknown speaker perspective', () => {
  assert.throws(
    () => tutorStubPublicMessagesForSpeaker(storedHistory, { speaker: 'director' }),
    /Unsupported tutor-stub history speaker: director/u,
  );
});
