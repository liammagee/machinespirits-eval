/**
 * Judge-facing dialogue transcript projection.
 *
 * This module owns the public and full-trace transcript representations used
 * by rubric prompts, CLI scoring, and transcript tooling. The rubric evaluator
 * re-exports these functions as a compatibility facade.
 */

import { stripThinkBlocks } from './evaluationTextSanitizer.js';

const DELIBERATION_AGENTS = new Set([
  'superego',
  'ego_self_reflection',
  'superego_self_reflection',
  'ego_intersubjective',
  'ego_strategy',
  'tutor_other_ego',
  'behavioral_overrides',
  'superego_disposition',
  'learner_ego_initial',
  'learner_ego_revision',
  'learner_ego',
  'learner_superego',
  'learner_synthesis',
  'learner_other_ego',
  'rejection_budget',
]);

const SIMPLE_TRACE_AGENTS = {
  ego_self_reflection: {
    label: '[Tutor Self-Reflection]',
    fields: ['detail', 'contextSummary'],
    maxLength: 300,
  },
  superego_self_reflection: {
    label: '[Tutor Superego Reflection]',
    fields: ['detail', 'contextSummary'],
    maxLength: 300,
  },
  ego_intersubjective: {
    label: '[Tutor Intersubjective]',
    fields: ['detail', 'contextSummary'],
    maxLength: 300,
  },
  ego_strategy: {
    label: '[Tutor Strategy]',
    fields: ['detail', 'contextSummary'],
    maxLength: 300,
  },
  tutor_other_ego: {
    label: '[Tutor Other-Ego]',
    fields: ['detail', 'contextSummary'],
    maxLength: 300,
  },
  behavioral_overrides: {
    label: '[Behavioral Overrides]',
    fields: ['contextSummary', 'detail'],
    maxLength: 300,
  },
  superego_disposition: {
    label: '[Tutor Superego Disposition]',
    fields: ['detail', 'contextSummary'],
    maxLength: 300,
  },
  learner_superego: {
    label: '[Learner Superego]',
    fields: ['detail', 'contextSummary'],
    maxLength: 300,
  },
  learner_ego: {
    label: '[Learner Ego]',
    fields: ['detail', 'contextSummary'],
    maxLength: 300,
  },
  learner_other_ego: {
    label: '[Learner Other-Ego]',
    fields: ['detail', 'contextSummary'],
    maxLength: 300,
  },
  rejection_budget: {
    label: '[Rejection Budget]',
    fields: ['contextSummary', 'detail'],
    maxLength: 200,
  },
};

function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

function firstPresentField(entry, fields) {
  for (const field of fields) {
    if (entry?.[field]) return entry[field];
  }
  return '';
}

function getSuggestion(turn) {
  return turn?.suggestion || turn?.suggestions?.[0] || null;
}

function getDeliveredTutorMessage(turn) {
  const suggestion = getSuggestion(turn);
  return suggestion ? suggestion.message || suggestion.title || '' : '';
}

function getRenderedTutorMessage(turn) {
  const suggestion = getSuggestion(turn);
  return suggestion ? suggestion.message || suggestion.title || JSON.stringify(suggestion) : '';
}

/**
 * Detect whether a trace represents the dynamic ego-superego learner.
 */
export function isEgoSuperegoLearner(dialogueTrace) {
  return (
    dialogueTrace?.some(
      (entry) =>
        entry.agent === 'learner_ego_initial' ||
        entry.agent === 'learner_ego_revision' ||
        entry.agent === 'learner_superego' ||
        entry.agent === 'learner_synthesis' ||
        (entry.agent === 'learner' && (entry.action === 'final_output' || entry.action === 'response')),
    ) ?? false
  );
}

/**
 * Extract the first learner utterance from the scenario learner context.
 */
export function extractInitialLearnerMessage(learnerContext) {
  if (!learnerContext) return null;
  const doubleQuoted = learnerContext.match(/[-–]\s*User:\s*"([^"]+)"/);
  if (doubleQuoted) return doubleQuoted[1];
  const singleQuoted = learnerContext.match(/[-–]\s*User:\s*'([^']+)'/);
  return singleQuoted ? singleQuoted[1] : null;
}

function extractLearnerFollowupFromContext(rawContext) {
  const raw = rawContext || '';
  if (!raw) return null;

  const normalize = (text) =>
    String(text || '')
      .replaceAll('\n', ' ')
      .replaceAll('\t', ' ')
      .replace(/ +/g, ' ')
      .trim();

  const saidMarker = '**Learner said**:';
  const saidIndex = raw.indexOf(saidMarker);
  if (saidIndex >= 0) {
    const tail = raw.slice(saidIndex + saidMarker.length).trim();
    if (tail.startsWith('"')) {
      const closing = tail.indexOf('"', 1);
      if (closing > 1) return tail.slice(1, closing).trim();
    }

    let end = tail.length;
    const headingIndex = tail.indexOf('\n###');
    const closeIndex = tail.indexOf('\n</');
    if (headingIndex >= 0 && headingIndex < end) end = headingIndex;
    if (closeIndex >= 0 && closeIndex < end) end = closeIndex;
    return normalize(tail.slice(0, end));
  }

  const actionMarker = '### Learner Action';
  const actionIndex = raw.indexOf(actionMarker);
  if (actionIndex < 0) return null;

  const block = raw.slice(actionIndex);
  let end = block.length;
  const headingIndex = block.indexOf('\n###', actionMarker.length);
  const closeIndex = block.indexOf('\n</');
  if (headingIndex >= 0 && headingIndex < end) end = headingIndex;
  if (closeIndex >= 0 && closeIndex < end) end = closeIndex;
  return normalize(block.slice(0, end));
}

function isLearnerSynthesisEntry(entry) {
  if (!entry) return false;
  if (entry.agent === 'learner_synthesis' && entry.action === 'response') return true;
  return entry.agent === 'learner' && (entry.action === 'final_output' || entry.action === 'response');
}

function renderTranscriptEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return '(no transcript available)';
  return events
    .slice()
    .sort((left, right) => (left?.sequence ?? 0) - (right?.sequence ?? 0))
    .map((event) => (typeof event === 'string' ? event : (event?.line ?? '')))
    .join('\n');
}

function serializeTranscriptEvents(transcript) {
  const text = String(transcript || '');
  if (!text || text === '(no transcript available)') return [];

  let currentTurnIndex = null;
  return text.split('\n').map((line, sequence) => {
    const turnHeader = line.match(/^--- Turn (\d+) ---$/);
    if (turnHeader) currentTurnIndex = Number.parseInt(turnHeader[1], 10) - 1;

    const speakerMatch = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    return {
      sequence,
      turnIndex: currentTurnIndex,
      kind: turnHeader ? 'turn_header' : speakerMatch ? 'utterance' : line.trim() === '' ? 'blank' : 'text',
      speaker: speakerMatch ? speakerMatch[1] : null,
      content: speakerMatch ? speakerMatch[2] : null,
      line,
    };
  });
}

function getStoredTranscript(transcriptArtifacts, mode) {
  if (!transcriptArtifacts || typeof transcriptArtifacts !== 'object') return null;

  const stored = transcriptArtifacts[mode];
  if (typeof stored === 'string' && stored.length > 0) return stored;

  const eventsKey = mode === 'public' ? 'publicEvents' : 'fullEvents';
  const events = transcriptArtifacts[eventsKey];
  return Array.isArray(events) && events.length > 0 ? renderTranscriptEvents(events) : null;
}

function collectPublicLearnerMessages(dialogueTrace) {
  const synthesisByTurn = {};
  const learnerMessageByTurn = {};
  let contextInputOrdinal = 0;

  for (const entry of dialogueTrace || []) {
    if ((entry.agent === 'tutor' || entry.agent === 'user') && entry.action === 'context_input') {
      contextInputOrdinal++;
      let turnKey = entry.turnIndex;
      if (turnKey === undefined && contextInputOrdinal > 1) turnKey = contextInputOrdinal - 1;
      if (turnKey !== undefined && turnKey > 0) {
        const followup = extractLearnerFollowupFromContext(entry.rawContext || '');
        if (followup && !learnerMessageByTurn[turnKey]) learnerMessageByTurn[turnKey] = followup;
      }
    }

    if (isLearnerSynthesisEntry(entry) && entry.turnIndex !== undefined) {
      synthesisByTurn[entry.turnIndex] = entry.detail || entry.contextSummary || '';
    }

    if (
      (entry.agent === 'learner' || entry.agent === 'user') &&
      entry.action === 'turn_action' &&
      entry.turnIndex !== undefined
    ) {
      learnerMessageByTurn[entry.turnIndex] = entry.contextSummary || entry.detail || '';
    }
  }

  return { synthesisByTurn, learnerMessageByTurn };
}

function appendPublicLearnerLine({
  lines,
  turn,
  turnPosition,
  turnIndex,
  initialMessage,
  egoSuperego,
  synthesisByTurn,
  learnerMessageByTurn,
}) {
  if (turnPosition === 0 && initialMessage) {
    lines.push(`${egoSuperego ? '[Learner Ego]' : '[Learner]'} ${truncate(initialMessage, 400)}`);
    return;
  }

  if (egoSuperego) {
    const text = synthesisByTurn[turnIndex] || learnerMessageByTurn[turnIndex] || turn.learnerMessage || null;
    if (text) lines.push(`[Learner Ego] ${truncate(text, 400)}`);
    return;
  }

  const text = turn.learnerMessage || learnerMessageByTurn[turnIndex] || null;
  if (text) lines.push(`[Learner] ${truncate(text, 400)}`);
}

/**
 * Build the externally visible dialogue transcript.
 */
export function buildDialoguePublicTranscript(turns, dialogueTrace, learnerContext, transcriptArtifacts = null) {
  const storedTranscript = getStoredTranscript(transcriptArtifacts, 'public');
  if (storedTranscript) return storedTranscript;
  if (!turns?.length) return '(no transcript available)';

  const egoSuperego = isEgoSuperegoLearner(dialogueTrace);
  const initialMessage = extractInitialLearnerMessage(learnerContext);
  const { synthesisByTurn, learnerMessageByTurn } = collectPublicLearnerMessages(dialogueTrace);
  const lines = [];

  for (let index = 0; index < turns.length; index++) {
    const turn = turns[index];
    const turnIndex = Number.isInteger(turn?.turnIndex) ? turn.turnIndex : index;
    lines.push(`\n--- Turn ${index + 1} ---`);
    appendPublicLearnerLine({
      lines,
      turn,
      turnPosition: index,
      turnIndex,
      initialMessage,
      egoSuperego,
      synthesisByTurn,
      learnerMessageByTurn,
    });

    const tutorMessage = getRenderedTutorMessage(turn);
    if (tutorMessage) lines.push(`[Tutor Ego] ${truncate(tutorMessage, 400)}`);
  }

  return lines.join('\n');
}

function hasDeliberationEntries(trace) {
  if (!trace?.length) return false;
  return trace.some(
    (entry) =>
      DELIBERATION_AGENTS.has(entry.agent) ||
      (entry.agent === 'learner' && (entry.action === 'final_output' || entry.action === 'response')),
  );
}

function collectDeliveredTutorMessages(turns) {
  const deliveredByTurn = {};
  for (let index = 0; index < (turns?.length || 0); index++) {
    const message = getDeliveredTutorMessage(turns[index]);
    if (message) deliveredByTurn[index] = message;
  }
  return deliveredByTurn;
}

function inferTraceTurnIndexes(dialogueTrace) {
  const inferredTurnIndexes = new Array(dialogueTrace.length).fill(-1);
  let nextKnownTurn = -1;

  for (let index = dialogueTrace.length - 1; index >= 0; index--) {
    const entry = dialogueTrace[index];
    if (entry.turnIndex !== undefined) {
      const isLearnerBoundary =
        ((entry.agent === 'learner' || entry.agent === 'user') && entry.action === 'turn_action') ||
        entry.agent?.startsWith('learner_');
      nextKnownTurn = isLearnerBoundary ? Math.max(0, entry.turnIndex - 1) : entry.turnIndex;
    }
    inferredTurnIndexes[index] = entry.turnIndex === undefined ? nextKnownTurn : entry.turnIndex;
  }

  return inferredTurnIndexes;
}

function createFullTranscriptState() {
  return {
    lines: [],
    currentTurnIndex: -1,
    emittedInitial: false,
    lastLearnerEgoText: '',
    tutorEgoShown: false,
    tutorSuperegoShown: false,
    tutorFinalEmitted: false,
    tutorInitialEgoText: '',
  };
}

function appendPendingTutorFinal(state, deliveredByTurn) {
  if (!state.tutorSuperegoShown || state.tutorFinalEmitted || state.currentTurnIndex < 0) return;
  const deliveredMessage = deliveredByTurn[state.currentTurnIndex] || '';
  if (!deliveredMessage) return;

  const revised = deliveredMessage !== state.tutorInitialEgoText;
  state.lines.push(`${revised ? '[Tutor Ego] (revised)' : '[Tutor Ego]'} ${truncate(deliveredMessage, 300)}`);
}

function beginTraceTurn(state, turnIndex, { initialMessage, egoSuperego, deliveredByTurn }) {
  appendPendingTutorFinal(state, deliveredByTurn);
  state.currentTurnIndex = turnIndex;
  state.lastLearnerEgoText = '';
  state.tutorEgoShown = false;
  state.tutorSuperegoShown = false;
  state.tutorFinalEmitted = false;
  state.tutorInitialEgoText = '';
  state.lines.push(`\n--- Turn ${turnIndex + 1} ---`);

  if (turnIndex === 0 && initialMessage && !state.emittedInitial) {
    state.lines.push(`${egoSuperego ? '[Learner Ego]' : '[Learner]'} ${truncate(initialMessage, 400)}`);
    state.emittedInitial = true;
  }
}

function appendSimpleTraceEntry(entry, state) {
  const spec = SIMPLE_TRACE_AGENTS[entry.agent];
  if (!spec) return false;
  const text = firstPresentField(entry, spec.fields);
  state.lines.push(`${spec.label} ${truncate(text, spec.maxLength)}`);
  return true;
}

function appendTutorCoreEntry(entry, state, deliveredByTurn) {
  if (entry.agent === 'ego') {
    if (!state.tutorEgoShown) {
      const egoText =
        entry.suggestions?.[0]?.message ||
        entry.detail ||
        entry.contextSummary ||
        deliveredByTurn[state.currentTurnIndex] ||
        '';
      state.lines.push(`[Tutor Ego] ${truncate(egoText, 300)}`);
      state.tutorEgoShown = true;
      state.tutorInitialEgoText = egoText;
    }
    return true;
  }

  if (entry.agent !== 'superego') return false;
  if (!state.tutorSuperegoShown) {
    const reviewText = entry.feedback || entry.detail || entry.contextSummary || '';
    state.lines.push(`[Tutor Superego] ${truncate(reviewText, 300)}`);
    state.tutorSuperegoShown = true;
  }
  return true;
}

function appendLearnerDeliberationEntry(entry, state) {
  if (entry.agent === 'learner_ego_initial' || entry.agent === 'learner_ego_revision') {
    const text = entry.detail || entry.contextSummary || '';
    const label = entry.agent === 'learner_ego_revision' ? '[Learner Ego] (revised)' : '[Learner Ego]';
    state.lines.push(`${label} ${truncate(text, 300)}`);
    state.lastLearnerEgoText = text;
    return true;
  }

  if (!isLearnerSynthesisEntry(entry)) return false;
  const text = entry.detail || entry.contextSummary || '';
  if (text !== state.lastLearnerEgoText) {
    state.lines.push(`[Learner] (final output) ${truncate(text, 400)}`);
  }
  return true;
}

function appendProtocolEntry(entry, state, { egoSuperego, deliveredByTurn }) {
  if ((entry.agent === 'learner' || entry.agent === 'user') && entry.action === 'turn_action') {
    if (!egoSuperego) {
      const learnerMessage = entry.contextSummary || entry.detail || '';
      state.lines.push(`[Learner] ${truncate(learnerMessage, 400)}`);
    }
    return true;
  }

  if ((entry.agent !== 'tutor' && entry.agent !== 'user') || entry.action !== 'final_output') return false;
  const deliveredMessage = deliveredByTurn[state.currentTurnIndex] || '';
  if (deliveredMessage && state.tutorSuperegoShown) {
    const revised = deliveredMessage !== state.tutorInitialEgoText;
    state.lines.push(`${revised ? '[Tutor Ego] (revised)' : '[Tutor Ego]'} ${truncate(deliveredMessage, 300)}`);
    state.tutorFinalEmitted = true;
  }
  return true;
}

function appendTraceEntry(entry, state, context) {
  if (appendTutorCoreEntry(entry, state, context.deliveredByTurn)) return;
  if (appendLearnerDeliberationEntry(entry, state)) return;
  if (appendProtocolEntry(entry, state, context)) return;
  appendSimpleTraceEntry(entry, state);
}

function buildFullTranscriptFromTrace(turns, dialogueTrace, learnerContext) {
  const egoSuperego = isEgoSuperegoLearner(dialogueTrace);
  const initialMessage = extractInitialLearnerMessage(learnerContext);
  const deliveredByTurn = collectDeliveredTutorMessages(turns);
  const inferredTurnIndexes = inferTraceTurnIndexes(dialogueTrace);
  const state = createFullTranscriptState();
  const context = { egoSuperego, initialMessage, deliveredByTurn };

  for (let index = 0; index < dialogueTrace.length; index++) {
    const entry = dialogueTrace[index];
    const effectiveTurn = entry.turnIndex ?? inferredTurnIndexes[index] ?? state.currentTurnIndex;
    if (effectiveTurn !== state.currentTurnIndex && effectiveTurn >= 0) {
      beginTraceTurn(state, effectiveTurn, context);
    }
    appendTraceEntry(entry, state, context);
  }

  appendPendingTutorFinal(state, deliveredByTurn);
  return state.lines.join('\n');
}

function buildFullTranscriptFromTurns(turns, learnerContext) {
  if (!turns?.length) return '(no transcript available)';

  const initialMessage = extractInitialLearnerMessage(learnerContext);
  const lines = [];
  for (let index = 0; index < turns.length; index++) {
    const turn = turns[index];
    lines.push(`\n--- Turn ${index + 1} ---`);
    if (index === 0 && initialMessage) {
      lines.push(`[Learner] ${truncate(initialMessage, 400)}`);
    } else if (turn.learnerMessage) {
      lines.push(`[Learner] ${truncate(turn.learnerMessage, 400)}`);
    } else if (turn.learnerAction) {
      lines.push(`[Learner] ${truncate(turn.learnerAction, 400)}`);
    }

    const tutorMessage = getRenderedTutorMessage(turn);
    if (tutorMessage) lines.push(`[Tutor Ego] ${truncate(tutorMessage, 400)}`);
  }
  return lines.join('\n');
}

/**
 * Build the full-trace transcript with tutor and learner deliberation.
 */
export function buildDialogueFullTranscript(turns, dialogueTrace, learnerContext, transcriptArtifacts = null) {
  const storedTranscript = getStoredTranscript(transcriptArtifacts, 'full');
  if (storedTranscript) return storedTranscript;

  if (dialogueTrace?.length > 0 && !hasDeliberationEntries(dialogueTrace)) {
    return buildDialoguePublicTranscript(turns, dialogueTrace, learnerContext, transcriptArtifacts);
  }

  return dialogueTrace?.length > 0
    ? buildFullTranscriptFromTrace(turns, dialogueTrace, learnerContext)
    : buildFullTranscriptFromTurns(turns, learnerContext);
}

/**
 * Persistable public and full transcript artifacts plus stable event streams.
 */
export function buildTranscriptArtifacts({ turns, dialogueTrace = [], learnerContext = null } = {}) {
  const publicTranscript = buildDialoguePublicTranscript(turns, dialogueTrace, learnerContext);
  const fullTranscript = stripThinkBlocks(buildDialogueFullTranscript(turns, dialogueTrace, learnerContext));

  return {
    version: 1,
    public: publicTranscript,
    full: fullTranscript,
    publicEvents: serializeTranscriptEvents(publicTranscript),
    fullEvents: serializeTranscriptEvents(fullTranscript),
  };
}

export default {
  buildTranscriptArtifacts,
  buildDialoguePublicTranscript,
  buildDialogueFullTranscript,
  isEgoSuperegoLearner,
  extractInitialLearnerMessage,
};
