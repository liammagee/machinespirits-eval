/**
 * Pure compatibility projections for adaptive-runner traces.
 *
 * Both the evaluation CLI and evaluation runner consume these shapes. Keep
 * this module free of stores and orchestration so their historical dialogue,
 * scenario, and learner-turn projections cannot drift independently.
 */

export function isAdaptiveTraceLog(log) {
  return Boolean(log?.schemaVersion >= 5 && log?.original && Array.isArray(log.original.dialogue));
}

export function adaptiveTraceScenarioContext(trace, result) {
  const initialLearner = trace?.scenario?.openingTurns?.find((turn) => turn?.role === 'learner')?.content || '';
  const hidden = trace?.scenario?.hidden || {};
  const expected = trace?.scenario?.expectedStrategyShift;
  const expectedLabel = Array.isArray(expected) ? expected.join(', ') : expected || 'adaptive response';
  const hiddenSummary = [
    hidden.actual_misconception,
    hidden.actual_sophistication && `sophistication: ${hidden.actual_sophistication}`,
  ]
    .filter(Boolean)
    .join('; ');
  return {
    id: result.scenarioId,
    type: 'adaptive_trap',
    name: result.scenarioName || trace?.scenario?.id || result.scenarioId,
    description: hiddenSummary || `Adaptive trap scenario ${result.scenarioId}`,
    topic: result.scenarioType || result.scenarioId,
    learner_context: initialLearner,
    expected_behavior: `The tutor should adapt to the learner signal and realize the expected strategy shift: ${expectedLabel}.`,
    required_elements: [],
    forbidden_elements: [],
  };
}

export function adaptiveTraceToDialogueLog(trace) {
  const dialogue = trace?.original?.dialogue || [];
  const initialLearner = trace?.scenario?.openingTurns?.find((turn) => turn?.role === 'learner')?.content || '';
  const turnResults = [];
  const conversationHistory = [];
  const dialogueTrace = [];
  let tutorIndex = 0;
  let lastLearner = initialLearner;
  let learnerAfterTutorIndex = 0;

  for (const message of dialogue) {
    if (message?.role === 'learner') {
      lastLearner = message.content || '';
      if (tutorIndex > 0) {
        learnerAfterTutorIndex += 1;
        conversationHistory.push({ learnerMessage: lastLearner });
        dialogueTrace.push({
          agent: 'learner',
          action: 'turn_action',
          turnIndex: learnerAfterTutorIndex,
          contextSummary: lastLearner,
          detail: 'adaptive external learner turn',
        });
      }
      continue;
    }
    if (message?.role !== 'tutor') continue;
    turnResults.push({
      turnIndex: tutorIndex,
      turnId: `adaptive-turn-${tutorIndex}`,
      suggestions: [{ message: message.content || '' }],
      learnerAction: null,
      learnerMessage: tutorIndex === 0 ? null : lastLearner,
      contentTurnId: `adaptive-turn-${tutorIndex}`,
    });
    tutorIndex += 1;
  }

  const publicTranscript = dialogue
    .map((message) => {
      if (message.role === 'learner') return `[Learner] ${message.content || ''}`;
      if (message.role === 'tutor') return `[Tutor Ego] ${message.content || ''}`;
      return null;
    })
    .filter(Boolean)
    .join('\n');

  return {
    isMultiTurn: turnResults.length > 1,
    turnResults,
    dialogueTrace,
    conversationHistory,
    learnerContext: initialLearner,
    learnerArchitecture: 'adaptive_externalised',
    transcripts: {
      public: publicTranscript,
      full: publicTranscript,
    },
    adaptiveTrace: trace,
  };
}

/**
 * Extract learner turns from a dialogue trace, handling both conversation
 * modes and the current plus historical learner trace labels.
 */
export function extractLearnerTurnsFromTrace(trace, isMultiAgent, conversationHistory) {
  const learnerTurns = [];

  let turnMarkers = trace.filter((t) => (t.agent === 'learner' || t.agent === 'user') && t.action === 'turn_action');

  if (turnMarkers.length === 0) {
    turnMarkers = trace.filter(
      (t) =>
        (t.agent === 'learner_synthesis' && t.action === 'response') ||
        (t.agent === 'learner' && t.action === 'final_output'),
    );
  }

  const convHistByTurn = {};
  if (Array.isArray(conversationHistory)) {
    conversationHistory.forEach((ch, i) => {
      if (ch.learnerMessage) convHistByTurn[i] = ch.learnerMessage;
    });
  }

  for (const ta of turnMarkers) {
    let rawMessage = ta.action === 'final_output' ? ta.detail || ta.contextSummary || '' : ta.contextSummary || '';

    const externalMatch = rawMessage.match(/\[EXTERNAL\]:?\s*([\s\S]*)/i);
    if (externalMatch) rawMessage = externalMatch[1].trim();

    const turnData = {
      turnIndex: ta.turnIndex,
      externalMessage: rawMessage,
      internalDeliberation: [],
    };

    if (!turnData.externalMessage && ta.turnIndex != null) {
      turnData.externalMessage = convHistByTurn[ta.turnIndex - 1] || '';
    }

    if (isMultiAgent) {
      const taIdx = trace.indexOf(ta);
      for (let j = taIdx - 1; j >= 0; j--) {
        const entry = trace[j];
        if (entry.agent === 'learner_ego_initial' && entry.action === 'deliberation') {
          turnData.internalDeliberation.unshift({ role: 'ego_initial', content: entry.contextSummary || '' });
          break;
        } else if (entry.agent === 'learner_superego' && entry.action === 'deliberation') {
          turnData.internalDeliberation.unshift({ role: 'superego', content: entry.contextSummary || '' });
        } else if (entry.agent === 'learner_ego_revision' && entry.action === 'deliberation') {
          turnData.internalDeliberation.unshift({ role: 'ego_revision', content: entry.contextSummary || '' });
        } else if (
          (entry.agent === 'learner_synthesis' && entry.action === 'response') ||
          (entry.agent === 'learner' && entry.action === 'final_output')
        ) {
          // A final learner output may be the current marker; it carries no
          // additional private deliberation.
        } else if (entry.agent === 'ego' || entry.agent === 'system' || entry.agent === 'superego') {
          break;
        }
      }
    }

    learnerTurns.push(turnData);
  }

  return learnerTurns;
}
