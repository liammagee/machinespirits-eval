const PUBLIC_MESSAGE_ROLES = new Set(['user', 'assistant']);

function normalizedPublicMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => PUBLIC_MESSAGE_ROLES.has(message?.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content || ''),
    }));
}

/**
 * Return the complete public dialogue as native chat messages for one speaker.
 *
 * Tutor-stub stores public history from the speaking tutor's perspective:
 * learner turns are `user` and tutor turns are `assistant`. A learner model
 * needs the inverse mapping so that its own earlier speech remains
 * `assistant` output and tutor speech becomes `user` input.
 */
export function tutorStubPublicMessagesForSpeaker(messages, { speaker = 'tutor' } = {}) {
  if (speaker !== 'tutor' && speaker !== 'learner') {
    throw new Error(`Unsupported tutor-stub history speaker: ${speaker}`);
  }

  const publicMessages = normalizedPublicMessages(messages);
  if (speaker === 'tutor') return publicMessages;
  return publicMessages.map((message) => ({
    role: message.role === 'user' ? 'assistant' : 'user',
    content: message.content,
  }));
}

export function tutorStubPublicMessageContext(messages, { speaker = 'tutor', activatedBy = 'session_start' } = {}) {
  const publicMessages = tutorStubPublicMessagesForSpeaker(messages, { speaker });
  return {
    schema: 'machinespirits.tutor-stub.public-message-context.v2',
    historyMode: 'full_public_replay',
    speaker,
    messages: publicMessages,
    availableMessageCount: publicMessages.length,
    replayedMessageCount: publicMessages.length,
    userMessageCount: publicMessages.filter((message) => message.role === 'user').length,
    assistantMessageCount: publicMessages.filter((message) => message.role === 'assistant').length,
    activatedBy,
  };
}
