const PUBLIC_MESSAGE_ROLES = new Set(['user', 'assistant']);

function oneLine(value, { max = 220 } = {}) {
  const text = String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

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

function publicHistoryChars(messages) {
  return normalizedPublicMessages(messages)
    .map((message) => message.content)
    .join('\n\n').length;
}

function budgetOmissionMarker(omittedMessageCount) {
  return `[Earlier public dialogue omitted to stay within the automated learner prompt budget: ${omittedMessageCount} message(s).]`;
}

/**
 * Bound a speaker-relative public replay without changing normal short runs.
 *
 * Automated-learner calls normally receive the full dialogue. When that exact
 * replay would exceed the audited prompt budget, retain a tutor-led recent
 * window (2 messages per completed turn plus the latest tutor message) and
 * mark how much public context was omitted. The marker contains no private
 * state and the latest tutor message is retained whenever any history fits.
 */
export function compactTutorStubPublicMessagesForBudget(messages, { maxHistoryChars = 0, recentTurns = 4 } = {}) {
  const publicMessages = normalizedPublicMessages(messages);
  const originalChars = publicHistoryChars(publicMessages);
  const safeMaxChars = Math.max(0, Math.floor(Number(maxHistoryChars) || 0));
  const safeRecentTurns = Math.max(0, Math.floor(Number(recentTurns) || 0));
  const fullReplay = {
    historyMode: 'full_public_replay',
    messages: publicMessages,
    availableMessageCount: publicMessages.length,
    replayedMessageCount: publicMessages.length,
    omittedMessageCount: 0,
    originalChars,
    replayedChars: originalChars,
    recentTurns: safeRecentTurns,
    maxHistoryChars: safeMaxChars,
    applied: false,
  };
  if (originalChars <= safeMaxChars) return fullReplay;
  if (safeMaxChars === 0 || publicMessages.length === 0) {
    return {
      ...fullReplay,
      historyMode: 'budget_window_public_replay',
      messages: [],
      replayedMessageCount: 0,
      omittedMessageCount: publicMessages.length,
      replayedChars: 0,
      applied: publicMessages.length > 0,
    };
  }

  const desiredMessageCount = Math.max(1, safeRecentTurns * 2 + 1);
  let retained = publicMessages.slice(-desiredMessageCount);
  let omittedMessageCount = publicMessages.length - retained.length;
  const withMarker = () => {
    if (!retained.length || omittedMessageCount === 0) return retained;
    const marker = budgetOmissionMarker(omittedMessageCount);
    return [{ ...retained[0], content: `${marker}\n\n${retained[0].content}` }, ...retained.slice(1)];
  };

  while (retained.length > 1 && publicHistoryChars(withMarker()) > safeMaxChars) {
    const removeCount = retained.length >= 3 ? 2 : 1;
    retained = retained.slice(removeCount);
    omittedMessageCount += removeCount;
  }

  let replayed = withMarker();
  if (publicHistoryChars(replayed) > safeMaxChars && retained.length === 1) {
    const marker = budgetOmissionMarker(omittedMessageCount);
    const separator = '\n\n';
    const availableContentChars = Math.max(0, safeMaxChars - marker.length - separator.length);
    replayed = availableContentChars
      ? [{ ...retained[0], content: `${marker}${separator}${retained[0].content.slice(-availableContentChars)}` }]
      : [];
    if (!replayed.length) omittedMessageCount = publicMessages.length;
  }

  return {
    ...fullReplay,
    historyMode: 'budget_window_public_replay',
    messages: replayed,
    replayedMessageCount: replayed.length,
    omittedMessageCount,
    replayedChars: publicHistoryChars(replayed),
    applied: true,
  };
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

export function buildTutorStubTutorMessageContext(messages, { modelRef = null, activatedBy = 'session_start' } = {}) {
  return {
    ...tutorStubPublicMessageContext(messages, {
      speaker: 'tutor',
      activatedBy,
    }),
    modelRef,
  };
}

export function renderTutorStubRawPublicTurnTranscript(turns, limit) {
  const publicTurns = Array.isArray(turns) ? turns : [];
  const safeLimit = Math.max(0, Number(limit) || 0);
  const recent = safeLimit > 0 ? publicTurns.slice(-safeLimit) : [];
  if (recent.length === 0) return 'No previous turns in the raw recent window.';
  return recent
    .map((turn, index) => {
      const absoluteTurn = publicTurns.length - recent.length + index + 1;
      return [`Turn ${absoluteTurn}`, `Learner: ${turn.learner}`, `Tutor: ${turn.tutor}`].join('\n');
    })
    .join('\n\n');
}

export function projectTutorStubPublicDialogueMemorySummary(turns, { historyTurns = 0, includeAnalysis = true } = {}) {
  const publicTurns = Array.isArray(turns) ? turns : [];
  if (publicTurns.length === 0) return 'No previous public dialogue to summarize.';

  const rawWindow = Math.max(0, Number(historyTurns) || 0);
  const older = rawWindow > 0 ? publicTurns.slice(0, Math.max(0, publicTurns.length - rawWindow)) : publicTurns;
  const latest = publicTurns.at(-1);
  const latestClassification = latest?.classification || {};
  const lines = [
    '[Compact public dialogue memory]',
    `Completed public turns: ${publicTurns.length}; raw recent window: ${Math.min(rawWindow, publicTurns.length)} turn(s).`,
    older.length ? `Older turns compressed: 1-${older.length}.` : 'Older turns compressed: none yet.',
  ];

  if (older.length) {
    lines.push('Older public milestones:');
    for (const turn of older.slice(-6)) {
      lines.push(
        `- T${turn.turn}: learner ${oneLine(turn.learner, { max: 120 })}; tutor ${oneLine(turn.tutor, {
          max: 150,
        })}`,
      );
    }
  }

  if (includeAnalysis && latest) {
    lines.push('Latest public learner analysis:');
    lines.push(`- This turn: ${latestClassification.turn?.summary || oneLine(latest.learner, { max: 160 })}`);
    lines.push(`- Overall: ${latestClassification.overall?.summary || 'No public overall summary yet.'}`);
    lines.push(
      `- Trajectory: ${
        latestClassification.overall?.trajectory ||
        latestClassification.overall?.current_state ||
        'No public trajectory summary yet.'
      }`,
    );
    lines.push(
      `- Next likely need: ${
        latestClassification.turn?.pedagogical_need ||
        latestClassification.overall?.next_best_tutor_move ||
        'Ask one concrete evidence-generating question.'
      }`,
    );
  }

  lines.push('[End compact public dialogue memory]');
  return lines.join('\n');
}

export function projectTutorStubCompactPublicTranscript(
  turns,
  limit,
  { memoryEnabled = false, historyTurns = 0, includeAnalysis = true } = {},
) {
  const publicTurns = Array.isArray(turns) ? turns : [];
  const rawTranscript = renderTutorStubRawPublicTurnTranscript(publicTurns, limit);
  if (!memoryEnabled || publicTurns.length === 0) return rawTranscript;
  return [
    projectTutorStubPublicDialogueMemorySummary(publicTurns, { historyTurns, includeAnalysis }),
    '[Raw recent public transcript]',
    rawTranscript,
    '[End raw recent public transcript]',
  ].join('\n\n');
}
