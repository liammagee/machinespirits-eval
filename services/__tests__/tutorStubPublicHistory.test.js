import assert from 'node:assert/strict';
import test from 'node:test';

import { auditTutorStubPrompt } from '../tutorStubPromptAudit.js';
import {
  compactTutorStubPublicMessagesForBudget,
  tutorStubPublicMessageContext,
  tutorStubPublicMessagesForSpeaker,
} from '../tutorStubPublicHistory.js';

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

test('automated learner budget compaction leaves a fitting public replay unchanged', () => {
  const learnerHistory = tutorStubPublicMessagesForSpeaker(storedHistory, { speaker: 'learner' });
  const result = compactTutorStubPublicMessagesForBudget(learnerHistory, {
    maxHistoryChars: 10_000,
    recentTurns: 4,
  });

  assert.equal(result.applied, false);
  assert.equal(result.historyMode, 'full_public_replay');
  assert.deepEqual(result.messages, learnerHistory);
  assert.equal(result.omittedMessageCount, 0);
});

test('automated learner budget compaction recovers a deterministic long-dialogue overflow', () => {
  const learnerHistory = Array.from({ length: 49 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `Public message ${index + 1}: ${'evidence '.repeat(115)}`,
  }));
  const systemPrompt = `Private behavior brief\n${'behavior '.repeat(250)}`;
  const userPrompt = `Current public task\n${'instruction '.repeat(340)}`;
  const fullAudit = auditTutorStubPrompt({
    surface: 'automated_learner',
    systemPrompt,
    userPrompt,
    messageHistory: learnerHistory,
  });
  assert.equal(fullAudit.ok, false);
  assert.ok(fullAudit.violations.some((violation) => violation.code === 'character_budget_exceeded'));

  const nonHistoryText = [systemPrompt, userPrompt].join('\n\n');
  const result = compactTutorStubPublicMessagesForBudget(learnerHistory, {
    maxHistoryChars: fullAudit.budget.maxChars - nonHistoryText.length - 2,
    recentTurns: 4,
  });
  const recoveredAudit = auditTutorStubPrompt({
    surface: 'automated_learner',
    systemPrompt,
    userPrompt,
    messageHistory: result.messages,
  });

  assert.equal(result.applied, true);
  assert.equal(result.historyMode, 'budget_window_public_replay');
  assert.equal(result.availableMessageCount, 49);
  assert.equal(result.replayedMessageCount, 9);
  assert.equal(result.omittedMessageCount, 40);
  assert.match(result.messages[0].content, /Earlier public dialogue omitted.*40 message\(s\)/u);
  assert.deepEqual(result.messages.at(-1), learnerHistory.at(-1));
  assert.deepEqual(
    result.messages.map((message) => message.role),
    ['user', 'assistant', 'user', 'assistant', 'user', 'assistant', 'user', 'assistant', 'user'],
  );
  assert.equal(recoveredAudit.ok, true);
});
