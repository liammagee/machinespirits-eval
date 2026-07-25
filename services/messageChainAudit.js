import { createHash } from 'crypto';

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function failure(reason, details = {}) {
  return { reason, ...details };
}

export function hashDialogueLog(dialogueLog) {
  return createHash('sha256')
    .update(JSON.stringify(dialogueLog, null, 2))
    .digest('hex');
}

export function validateMessageSequence(messages, location = 'inputMessages') {
  if (!Array.isArray(messages)) {
    return [failure('malformed_input_messages', { location })];
  }

  const failures = [];
  let previousRole = null;

  messages.forEach((message, index) => {
    const messageLocation = `${location}[${index}]`;
    if (!isRecord(message)) {
      failures.push(failure('malformed_message', { location: messageLocation }));
      previousRole = null;
      return;
    }

    const roleValid = message.role === 'user' || message.role === 'assistant';
    if (!roleValid) {
      failures.push(
        failure('invalid_message_role', {
          location: messageLocation,
          actual: message.role ?? null,
        }),
      );
    } else if (previousRole === message.role) {
      failures.push(
        failure('consecutive_message_role', {
          location: messageLocation,
          role: message.role,
        }),
      );
    }

    if (typeof message.content !== 'string') {
      failures.push(
        failure('invalid_message_content', {
          location: messageLocation,
          actual_type: message.content === null ? 'null' : typeof message.content,
        }),
      );
    }

    previousRole = roleValid ? message.role : null;
  });

  return failures;
}

function validateConversationHistory(conversationHistory) {
  if (conversationHistory == null) return [];
  if (!Array.isArray(conversationHistory)) {
    return [failure('malformed_conversation_history')];
  }

  const failures = [];
  conversationHistory.forEach((turn, index) => {
    const location = `conversationHistory[${index}]`;
    if (!isRecord(turn)) {
      failures.push(failure('malformed_conversation_turn', { location }));
      return;
    }

    const hasTutor = typeof turn.suggestion?.message === 'string' && turn.suggestion.message.length > 0;
    const hasLearner = typeof turn.learnerMessage === 'string' && turn.learnerMessage.length > 0;

    if (!hasTutor && !hasLearner) {
      failures.push(failure('malformed_conversation_turn', { location }));
      return;
    }

    if (!hasTutor) {
      failures.push(failure('conversation_history_order', { location, missing: 'tutor' }));
    }

    if (!hasLearner && index < conversationHistory.length - 1) {
      failures.push(failure('conversation_history_order', { location, missing: 'learner' }));
    }
  });

  return failures;
}

export function validateDialogueLogIntegrity(resultRow, dialogueLog) {
  if (!isRecord(dialogueLog)) {
    return {
      status: 'fail',
      failure_count: 1,
      failures: [failure('malformed_dialogue_log')],
      expected_hash: resultRow?.dialogue_content_hash || null,
      actual_hash: null,
      checked_trace_entries: 0,
      checked_message_chains: 0,
    };
  }

  const failures = [];
  const expectedHash = resultRow?.dialogue_content_hash || null;
  const actualHash = hashDialogueLog(dialogueLog);

  if (resultRow?.dialogue_id && dialogueLog.dialogueId && resultRow.dialogue_id !== dialogueLog.dialogueId) {
    failures.push(
      failure('dialogue_id_mismatch', {
        expected: resultRow.dialogue_id,
        actual: dialogueLog.dialogueId,
      }),
    );
  }

  if (!expectedHash) {
    failures.push(failure('missing_dialogue_content_hash'));
  } else if (expectedHash !== actualHash) {
    failures.push(
      failure('dialogue_hash_mismatch', {
        expected: expectedHash,
        actual: actualHash,
      }),
    );
  }

  const trace = dialogueLog.dialogueTrace;
  let checkedTraceEntries = 0;
  let checkedMessageChains = 0;
  let previousTurnIndex = null;

  if (!Array.isArray(trace)) {
    failures.push(failure('malformed_dialogue_trace'));
  } else {
    trace.forEach((entry, index) => {
      const location = `dialogueTrace[${index}]`;
      if (!isRecord(entry)) {
        failures.push(failure('malformed_trace_entry', { location }));
        return;
      }

      checkedTraceEntries += 1;
      if (Number.isInteger(entry.turnIndex)) {
        if (previousTurnIndex != null && entry.turnIndex < previousTurnIndex) {
          failures.push(
            failure('turn_index_regression', {
              location,
              previous: previousTurnIndex,
              actual: entry.turnIndex,
            }),
          );
        }
        previousTurnIndex = entry.turnIndex;
      }

      if ('inputMessages' in entry && entry.inputMessages != null) {
        checkedMessageChains += 1;
        failures.push(...validateMessageSequence(entry.inputMessages, `${location}.inputMessages`));
      }
    });
  }

  failures.push(...validateConversationHistory(dialogueLog.conversationHistory));

  return {
    status: failures.length === 0 ? 'pass' : 'fail',
    failure_count: failures.length,
    failures,
    expected_hash: expectedHash,
    actual_hash: actualHash,
    checked_trace_entries: checkedTraceEntries,
    checked_message_chains: checkedMessageChains,
  };
}

export function failedDialogueLogIntegrity(reason, details = {}) {
  return {
    status: 'fail',
    failure_count: 1,
    failures: [failure(reason, details)],
    expected_hash: details.expected_hash || null,
    actual_hash: null,
    checked_trace_entries: 0,
    checked_message_chains: 0,
  };
}
