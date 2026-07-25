import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hashDialogueLog,
  validateDialogueLogIntegrity,
  validateMessageSequence,
} from '../services/messageChainAudit.js';

function makeDialogueLog() {
  return {
    dialogueId: 'dialogue-fixture',
    conversationMode: 'messages',
    conversationHistory: [
      {
        suggestion: { message: 'Tutor turn zero' },
        learnerMessage: 'Learner turn zero',
      },
    ],
    dialogueTrace: [
      {
        agent: 'ego',
        action: 'generate',
        turnIndex: 0,
        inputMessages: [
          { role: 'assistant', content: 'Prior tutor turn' },
          { role: 'user', content: 'Prior learner turn' },
        ],
      },
      {
        agent: 'learner_ego_initial',
        action: 'deliberation',
        turnIndex: 0,
        inputMessages: [
          { role: 'user', content: 'Current tutor turn' },
          { role: 'assistant', content: 'Prior learner turn' },
        ],
      },
    ],
  };
}

function makeResultRow(dialogueLog) {
  return {
    dialogue_id: dialogueLog.dialogueId,
    dialogue_content_hash: hashDialogueLog(dialogueLog),
  };
}

test('validates symmetric tutor and learner message chains against the stored log hash', () => {
  const dialogueLog = makeDialogueLog();
  const result = validateDialogueLogIntegrity(makeResultRow(dialogueLog), dialogueLog);

  assert.equal(result.status, 'pass');
  assert.equal(result.failure_count, 0);
  assert.equal(result.checked_trace_entries, 2);
  assert.equal(result.checked_message_chains, 2);
  assert.equal(result.actual_hash, result.expected_hash);
});

test('fails a malformed dialogue trace with an exact structured reason', () => {
  const dialogueLog = { ...makeDialogueLog(), dialogueTrace: { agent: 'ego' } };
  const result = validateDialogueLogIntegrity(makeResultRow(dialogueLog), dialogueLog);

  assert.equal(result.status, 'fail');
  assert.deepEqual(result.failures, [{ reason: 'malformed_dialogue_trace' }]);
});

test('reports turn regression and repeated roles without conflating them with hash drift', () => {
  const dialogueLog = makeDialogueLog();
  dialogueLog.dialogueTrace[1].turnIndex = -1;
  dialogueLog.dialogueTrace[1].inputMessages = [
    { role: 'assistant', content: 'First' },
    { role: 'assistant', content: 'Second' },
  ];

  const result = validateDialogueLogIntegrity(makeResultRow(dialogueLog), dialogueLog);

  assert.deepEqual(
    result.failures.map((entry) => entry.reason),
    ['turn_index_regression', 'consecutive_message_role'],
  );
  assert.equal(result.actual_hash, result.expected_hash);
});

test('fails content drift with exact expected and actual hashes', () => {
  const dialogueLog = makeDialogueLog();
  const result = validateDialogueLogIntegrity(
    { dialogue_id: dialogueLog.dialogueId, dialogue_content_hash: '0'.repeat(64) },
    dialogueLog,
  );

  assert.equal(result.failures[0].reason, 'dialogue_hash_mismatch');
  assert.equal(result.failures[0].expected, '0'.repeat(64));
  assert.equal(result.failures[0].actual, hashDialogueLog(dialogueLog));
});

test('fails an incomplete non-final conversation turn as an ordering error', () => {
  const dialogueLog = makeDialogueLog();
  dialogueLog.conversationHistory = [
    { suggestion: { message: 'Tutor turn zero' } },
    { suggestion: { message: 'Tutor turn one' }, learnerMessage: 'Learner turn one' },
  ];

  const result = validateDialogueLogIntegrity(makeResultRow(dialogueLog), dialogueLog);

  assert.deepEqual(result.failures, [
    {
      reason: 'conversation_history_order',
      location: 'conversationHistory[0]',
      missing: 'learner',
    },
  ]);
});

test('validates message shape independently for fixture-level diagnostics', () => {
  assert.deepEqual(validateMessageSequence([{ role: 'tool', content: 7 }]), [
    { reason: 'invalid_message_role', location: 'inputMessages[0]', actual: 'tool' },
    { reason: 'invalid_message_content', location: 'inputMessages[0]', actual_type: 'number' },
  ]);
});
