/**
 * Pure context and transcript projections shared by evaluation turn runtimes.
 *
 * Keep provider, persistence, and mutable run state outside this owner so the
 * compatibility runner can delegate without changing its public contract.
 */

export function structureLearnerContext(rawContext) {
  if (!rawContext || typeof rawContext !== 'string') return rawContext;

  const fields = {};
  if (/\bnew user\b/i.test(rawContext)) {
    fields['Learner Type'] = 'New user (no prior history)';
  } else {
    const sessionMatch = rawContext.match(/(\d+)\s+sessions?/i);
    const eventMatch = rawContext.match(/(\d+)\s+total events?/i);
    fields['Learner Type'] =
      'Returning user' +
      (sessionMatch ? `, ${sessionMatch[1]} sessions` : '') +
      (eventMatch ? `, ${eventMatch[1]} events` : '');
  }

  const viewingMatch = rawContext.match(/\*\*Currently viewing\*\*:\s*(.+)/);
  if (viewingMatch) fields['Current Content'] = viewingMatch[1].trim();

  const struggleMatch = rawContext.match(/\*\*Struggle signals? detected\*\*:\s*(\d+)/i);
  if (struggleMatch) fields['Struggle Signals'] = `${struggleMatch[1]} detected`;

  const retryMatch = rawContext.match(/retried?\s+(\d+)\s+times?/i);
  if (retryMatch) fields['Activity Retries'] = `${retryMatch[1]} retries`;
  const retryLines = (rawContext.match(/Retrying activity/gi) || []).length;
  if (retryLines > 0 && !retryMatch) fields['Activity Retries'] = `${retryLines} retries in timeline`;

  const struggleAreaMatch = rawContext.match(/\*\*Primary struggle area\*\*:\s*(.+)/);
  if (struggleAreaMatch) fields['Primary Struggle'] = struggleAreaMatch[1].trim();

  const conceptMatch = rawContext.match(/\*\*Concept difficulty\*\*:\s*(.+)/);
  if (conceptMatch) fields['Difficult Concepts'] = conceptMatch[1].trim();

  const chatLines = [];
  const chatPattern = /- User:\s*"([^"]+)"/g;
  let match;
  while ((match = chatPattern.exec(rawContext)) !== null) chatLines.push(match[1]);
  if (chatLines.length > 0) fields['Learner Messages'] = chatLines.join(' | ');

  const completedMatch = rawContext.match(/\*\*Completed lectures?\*\*:\s*(.+)/);
  if (completedMatch) fields['Completed Lectures'] = completedMatch[1].trim();

  const timeMatch = rawContext.match(/\*\*Time on page\*\*:\s*(.+)/);
  if (timeMatch) fields['Time on Page'] = timeMatch[1].trim();

  const scrollMatch = rawContext.match(/\*\*Scroll depth\*\*:\s*(.+)/);
  if (scrollMatch) fields['Scroll Depth'] = scrollMatch[1].trim();

  const avgScoreMatch = rawContext.match(/\*\*Average score\*\*:\s*(.+)/);
  if (avgScoreMatch) fields['Average Score'] = avgScoreMatch[1].trim();

  const activityMatch = rawContext.match(/\*\*Activities completed\*\*:\s*(.+)/);
  if (activityMatch) fields['Activities Completed'] = activityMatch[1].trim();

  const fieldKeys = Object.keys(fields);
  if (fieldKeys.length <= 1) return rawContext;

  const lines = [
    '⚠️ YOU MUST REFERENCE AT LEAST ONE OF THESE SIGNALS BY NAME IN YOUR SUGGESTION:',
    '<structured_context_summary>',
  ];
  for (const [key, value] of Object.entries(fields)) lines.push(`${key}: ${value}`);
  lines.push('</structured_context_summary>');
  lines.push('Your suggestion MUST mention specific data from the summary above. Generic responses are WRONG.');
  lines.push('');
  return lines.join('\n') + rawContext;
}

export function flattenConversationHistory(conversationHistory) {
  return (conversationHistory || []).flatMap((entry) => [
    { role: 'tutor', content: entry.suggestion?.message || '' },
    ...(entry.learnerMessage ? [{ role: 'learner', content: entry.learnerMessage }] : []),
  ]);
}

export function joinContextBlocks(...blocks) {
  return blocks
    .map((block) => String(block || '').trim())
    .filter(Boolean)
    .join('\n\n');
}

export function shouldGateDynamicResistanceTurn(fullScenario, turnDef, turnIdx) {
  return Boolean(
    turnIdx === 0 &&
    fullScenario?.resistance_breakthrough_diagnostic === true &&
    fullScenario?.resistance_signal_target &&
    turnDef?.learner_action === 'resistant_followup',
  );
}

export function buildMessageChain(conversationHistory) {
  const messages = [];
  for (const entry of conversationHistory || []) {
    if (entry.suggestion?.message) messages.push({ role: 'assistant', content: entry.suggestion.message });
    if (entry.learnerMessage) messages.push({ role: 'user', content: entry.learnerMessage });
  }
  return messages;
}

export function stripRecentChatHistory(context) {
  if (!context) return context;
  return context.replace(/### Recent Chat History\n[\s\S]*?(?=\n###|$)/g, '').trim();
}

export function buildMultiTurnContext(options) {
  const {
    originalContext,
    conversationHistory = [],
    currentTurn,
    _previousSuggestion,
    priorSuperegoAssessments = [],
    learnerTrajectory = null,
    conversationMode = 'single-prompt',
  } = options;
  const contextParts = [];
  let effectiveContext = originalContext;
  if (conversationMode === 'messages' && conversationHistory.length > 0) {
    effectiveContext = stripRecentChatHistory(originalContext);
    effectiveContext +=
      '\n\n### Conversation Context\n' +
      "The learner's ongoing messages are provided as conversation history. " +
      'Focus your response on their most recent message.';
  }
  contextParts.push(effectiveContext);

  if (conversationMode !== 'messages' && conversationHistory.length > 0) {
    contextParts.push('\n### Conversation History');
    for (const turn of conversationHistory) contextParts.push(formatTurnForContext(turn));
  }
  if (priorSuperegoAssessments.length > 0) {
    contextParts.push('\n### Prior Superego Assessment');
    for (const assessment of priorSuperegoAssessments) contextParts.push(formatSuperegoAssessment(assessment));
  }
  if (learnerTrajectory) {
    contextParts.push('\n### Learner Trajectory Assessment');
    contextParts.push(formatLearnerTrajectory(learnerTrajectory));
  }
  if (currentTurn?.learner_action) {
    contextParts.push('\n### Learner Action');
    contextParts.push(formatLearnerAction(currentTurn));
  }
  if (currentTurn?.context_update) contextParts.push('\n' + currentTurn.context_update.trim());
  return contextParts.join('\n');
}

export function extractTurnSuperegoAssessment(turnIndex, traceEntries) {
  const superegoEntries = traceEntries.filter((entry) => entry.agent === 'superego');
  if (superegoEntries.length === 0) return null;
  const lastEntry = superegoEntries[superegoEntries.length - 1];
  const interventionTypes = superegoEntries.map((entry) => entry.interventionType).filter(Boolean);
  let feedbackText = lastEntry.feedback || '';
  if (!feedbackText && lastEntry.detail) {
    const match = lastEntry.detail.match(/"feedback"\s*:\s*"([^"]+)"/);
    if (match) feedbackText = match[1];
  }
  return {
    turnIndex,
    rejections: superegoEntries.filter((entry) => entry.approved === false).length,
    approvals: superegoEntries.filter((entry) => entry.approved === true).length,
    interventionTypes,
    finalApproved: lastEntry.approved,
    confidence: lastEntry.confidence,
    feedback: feedbackText.substring(0, 300),
  };
}

function formatSuperegoAssessment(assessment) {
  const lines = [
    `\n**Turn ${assessment.turnIndex + 1} internal critique:**`,
    `- Outcome: ${assessment.finalApproved ? 'approved' : 'rejected'} after ${assessment.rejections} rejection(s)`,
  ];
  if (assessment.interventionTypes.length > 0) {
    lines.push(`- Interventions: ${[...new Set(assessment.interventionTypes)].join(', ')}`);
  }
  if (assessment.feedback) lines.push(`- Key concern: "${assessment.feedback}"`);
  return lines.join('\n');
}

export function analyzeLearnerTrajectory(turnResults, conversationHistory) {
  if (turnResults.length < 2) return null;
  const trajectory = {
    turnCount: turnResults.length,
    engagementDirection: 'stable',
    resistanceType: null,
    resistanceStrength: 0,
    priorApproachEffective: null,
    scoreTrajectory: turnResults.filter((turn) => turn.turnScore != null).map((turn) => turn.turnScore),
    messageLengthTrajectory: conversationHistory
      .filter((entry) => entry.learnerMessage)
      .map((entry) => entry.learnerMessage.length),
    repeatedConfusion: false,
    questionDiversity: 0,
  };
  const messageLengths = trajectory.messageLengthTrajectory;
  if (messageLengths.length >= 3) {
    const earlyAverage = messageLengths.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    const lateAverage = messageLengths.slice(-2).reduce((a, b) => a + b, 0) / 2;
    if (lateAverage < earlyAverage * 0.6) trajectory.engagementDirection = 'declining';
    else if (lateAverage > earlyAverage * 1.4) trajectory.engagementDirection = 'increasing';
  }
  if (trajectory.scoreTrajectory.length >= 2) {
    const last = trajectory.scoreTrajectory.at(-1);
    const previous = trajectory.scoreTrajectory.at(-2);
    trajectory.priorApproachEffective = last >= previous;
  }

  const learnerMessages = conversationHistory
    .filter((entry) => entry.learnerMessage)
    .map((entry) => entry.learnerMessage.toLowerCase());
  if (learnerMessages.length >= 2) {
    const confusionPatterns = [
      /i('m| am) (still )?(confused|lost|not sure|unsure)/i,
      /i don'?t (understand|get|see)/i,
      /what do you mean/i,
      /can you explain/i,
      /i('m| am) not following/i,
    ];
    const confusionCounts = learnerMessages.map(
      (message) => confusionPatterns.filter((pattern) => pattern.test(message)).length,
    );
    const lastTwoConfusion = confusionCounts.slice(-2);
    if (lastTwoConfusion.length >= 2 && lastTwoConfusion.every((count) => count > 0)) {
      trajectory.repeatedConfusion = true;
      trajectory.resistanceType = 'repeated_confusion';
      trajectory.resistanceStrength = 2;
    }
  }

  const lastMessage = learnerMessages.at(-1) || '';
  const pushbackPatterns = [
    /\bbut\s+(what about|doesn'?t|isn'?t|that doesn'?t)\b/i,
    /\bi disagree\b/i,
    /\bi don'?t think\b/i,
    /\bthat'?s not (right|correct|what i)\b/i,
    /\byou('re| are) (wrong|missing|not)\b/i,
  ];
  if (pushbackPatterns.some((pattern) => pattern.test(lastMessage))) {
    trajectory.resistanceType ||= 'pushback';
    trajectory.resistanceStrength = Math.max(trajectory.resistanceStrength, 2);
  }
  if (messageLengths.length >= 2 && messageLengths.at(-1) < 30 && !lastMessage.includes('?')) {
    trajectory.resistanceType ||= 'disengagement';
    trajectory.resistanceStrength = Math.max(trajectory.resistanceStrength, 1);
    trajectory.engagementDirection = 'declining';
  }

  const questions = learnerMessages.filter((message) => message.includes('?'));
  if (questions.length >= 2) {
    const uniqueQuestionWords = questions.map(
      (question) => new Set(question.split(/\s+/).filter((word) => word.length > 3)),
    );
    let totalOverlap = 0;
    for (let index = 1; index < uniqueQuestionWords.length; index++) {
      const previous = uniqueQuestionWords[index - 1];
      const current = uniqueQuestionWords[index];
      totalOverlap += [...current].filter((word) => previous.has(word)).length / Math.max(current.size, 1);
    }
    trajectory.questionDiversity = 1 - totalOverlap / Math.max(uniqueQuestionWords.length - 1, 1);
  }
  if (trajectory.engagementDirection === 'declining' && trajectory.priorApproachEffective === false) {
    trajectory.resistanceStrength = 3;
    trajectory.resistanceType ||= 'cumulative_decline';
  }
  return trajectory;
}

function formatLearnerTrajectory(trajectory) {
  const engagement =
    trajectory.engagementDirection === 'declining'
      ? 'DECLINING'
      : trajectory.engagementDirection === 'increasing'
        ? 'INCREASING'
        : 'STABLE';
  const lines = [`- Engagement: ${engagement} (over ${trajectory.turnCount} turns)`];
  if (trajectory.scoreTrajectory.length >= 2) {
    lines.push(`- Score trajectory: ${trajectory.scoreTrajectory.map((score) => score.toFixed(0)).join(' → ')}`);
    lines.push(`- Prior approach effective: ${trajectory.priorApproachEffective ? 'YES' : 'NO'}`);
  }
  if (trajectory.resistanceType) {
    const strength = ['none', 'mild', 'moderate', 'strong'][trajectory.resistanceStrength] || 'unknown';
    lines.push(`- Resistance detected: ${trajectory.resistanceType} (${strength})`);
  }
  if (trajectory.repeatedConfusion) {
    lines.push('- WARNING: Learner expressed confusion in consecutive turns — prior explanation did not land');
  }
  if (trajectory.questionDiversity < 0.3 && trajectory.turnCount >= 3) {
    lines.push('- WARNING: Learner questions show low diversity — they may be stuck on the same concept');
  }
  return lines.join('\n');
}

export function formatTurnForContext(turn) {
  const lines = [`\n**Turn ${turn.turnIndex + 1}** (${turn.turnId})`];
  if (turn.suggestion) {
    lines.push(`- Tutor responded: "${turn.suggestion.message || turn.suggestion.title || ''}"`);
    if (turn.suggestion.actionTarget)
      lines.push(`  - Action: ${turn.suggestion.action} → ${turn.suggestion.actionTarget}`);
  }
  if (turn.learnerAction) {
    lines.push(`- Learner response: ${turn.learnerAction}`);
    if (turn.learnerMessage) lines.push(`  - Message: "${turn.learnerMessage}"`);
  }
  return lines.join('\n');
}

function formatLearnerAction(turn) {
  const action = turn.learner_action;
  const details = turn.action_details || {};
  const lines = [];
  switch (action) {
    case 'followed_suggestion':
      lines.push('Learner **followed** the suggestion');
      if (details.action_taken) lines.push(`- Action: ${details.action_taken}`);
      break;
    case 'ignored_suggestion':
      lines.push('Learner **did not follow** the suggestion');
      if (details.explicit_rejection) lines.push('- Explicitly rejected');
      break;
    case 'asked_followup':
      lines.push('Learner **asked a follow-up question**');
      break;
    case 'reported_confusion':
      lines.push('Learner **reported confusion**');
      break;
    case 'completed_activity':
      lines.push('Learner **completed an activity**');
      if (details.activity_id) lines.push(`- Activity: ${details.activity_id}`);
      if (details.success !== undefined) lines.push(`- Success: ${details.success}`);
      if (details.score !== undefined) lines.push(`- Score: ${details.score}%`);
      break;
    default:
      lines.push(`Learner action: ${action}`);
  }
  if (details.message) lines.push(`\n**Learner said**: "${details.message}"`);
  return lines.join('\n');
}

export function formatLearnerActionForTranscript(turn) {
  const action = turn.learner_action;
  const details = turn.action_details || {};
  const labels = {
    followed_suggestion: '✓ Followed suggestion',
    ignored_suggestion: '✗ Ignored suggestion',
    asked_followup: '❓ Asked follow-up question',
    reported_confusion: '😕 Reported confusion',
    completed_activity: '✅ Completed activity',
    navigated_away: '🔄 Navigated away',
    requested_hint: '💡 Requested hint',
  };
  const lines = [labels[action] || `Action: ${action}`];
  if (details.action_taken) lines.push(`  → ${details.action_taken}`);
  if (details.activity_id) lines.push(`  Activity: ${details.activity_id}`);
  if (details.success !== undefined) lines.push(`  Success: ${details.success ? 'Yes' : 'No'}`);
  if (details.score !== undefined) lines.push(`  Score: ${details.score}%`);
  if (details.message) lines.push(`\n  "${details.message}"`);
  return lines.join('\n');
}
