import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptiveTraceScenarioContext,
  adaptiveTraceToDialogueLog,
  extractLearnerTurnsFromTrace,
  isAdaptiveTraceLog,
} from '../services/adaptiveTraceProjection.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

const adaptiveTrace = deepFreeze({
  schemaVersion: 5,
  scenario: {
    id: 'frozen_adaptive_trace',
    openingTurns: [{ role: 'learner', content: 'I still think the seal proves the source.' }],
    hidden: {
      actual_misconception: 'A matching seal does not establish provenance.',
      actual_sophistication: 'advanced novice',
    },
    expectedStrategyShift: ['surface counterexample', 'provenance check'],
  },
  original: {
    dialogue: [
      { role: 'learner', content: 'I still think the seal proves the source.' },
      { role: 'tutor', content: 'Compare the seal with the residue record.' },
      { role: 'system', content: 'private control record' },
      {
        role: 'learner',
        content: '[INTERNAL]: revise from the residue. [EXTERNAL]: The residue evidence changes my answer.',
      },
      { role: 'tutor', content: 'Now state what the seal can and cannot prove.' },
    ],
  },
});

test('adaptive trace recognition preserves the versioned raw-log boundary', () => {
  assert.equal(isAdaptiveTraceLog(adaptiveTrace), true);
  assert.equal(isAdaptiveTraceLog({ ...adaptiveTrace, schemaVersion: 4 }), false);
  assert.equal(isAdaptiveTraceLog({ schemaVersion: 5, original: { dialogue: null } }), false);
});

test('frozen adaptive scenario and dialogue projections retain the historical shapes', () => {
  const result = deepFreeze({
    scenarioId: 'adaptive-case-1',
    scenarioName: 'Frozen adaptive projection',
    scenarioType: 'source_reasoning',
  });

  assert.deepEqual(adaptiveTraceScenarioContext(adaptiveTrace, result), {
    id: 'adaptive-case-1',
    type: 'adaptive_trap',
    name: 'Frozen adaptive projection',
    description: 'A matching seal does not establish provenance.; sophistication: advanced novice',
    topic: 'source_reasoning',
    learner_context: 'I still think the seal proves the source.',
    expected_behavior:
      'The tutor should adapt to the learner signal and realize the expected strategy shift: surface counterexample, provenance check.',
    required_elements: [],
    forbidden_elements: [],
  });

  const projected = adaptiveTraceToDialogueLog(adaptiveTrace);
  const secondLearner = '[INTERNAL]: revise from the residue. [EXTERNAL]: The residue evidence changes my answer.';
  const publicTranscript = [
    '[Learner] I still think the seal proves the source.',
    '[Tutor Ego] Compare the seal with the residue record.',
    `[Learner] ${secondLearner}`,
    '[Tutor Ego] Now state what the seal can and cannot prove.',
  ].join('\n');

  assert.deepEqual(projected, {
    isMultiTurn: true,
    turnResults: [
      {
        turnIndex: 0,
        turnId: 'adaptive-turn-0',
        suggestions: [{ message: 'Compare the seal with the residue record.' }],
        learnerAction: null,
        learnerMessage: null,
        contentTurnId: 'adaptive-turn-0',
      },
      {
        turnIndex: 1,
        turnId: 'adaptive-turn-1',
        suggestions: [{ message: 'Now state what the seal can and cannot prove.' }],
        learnerAction: null,
        learnerMessage: secondLearner,
        contentTurnId: 'adaptive-turn-1',
      },
    ],
    dialogueTrace: [
      {
        agent: 'learner',
        action: 'turn_action',
        turnIndex: 1,
        contextSummary: secondLearner,
        detail: 'adaptive external learner turn',
      },
    ],
    conversationHistory: [{ learnerMessage: secondLearner }],
    learnerContext: 'I still think the seal proves the source.',
    learnerArchitecture: 'adaptive_externalised',
    transcripts: { public: publicTranscript, full: publicTranscript },
    adaptiveTrace,
  });

  assert.deepEqual(extractLearnerTurnsFromTrace(projected.dialogueTrace, false, projected.conversationHistory), [
    {
      turnIndex: 1,
      externalMessage: 'The residue evidence changes my answer.',
      internalDeliberation: [],
    },
  ]);
});

test('frozen learner projection retains current, legacy, and conversation-history behavior', () => {
  const trace = deepFreeze([
    { agent: 'learner_ego_initial', action: 'deliberation', contextSummary: 'Current initial reading' },
    { agent: 'learner_superego', action: 'deliberation', contextSummary: 'Current criticism' },
    { agent: 'learner_ego_revision', action: 'deliberation', contextSummary: 'Current revision' },
    {
      agent: 'learner',
      action: 'final_output',
      turnIndex: 1,
      contextSummary: 'truncated current output',
      detail: '[INTERNAL]: hidden. [EXTERNAL]: Current revised answer.',
    },
    { agent: 'ego', action: 'generate', contextSummary: 'Tutor barrier' },
    { agent: 'learner_ego_initial', action: 'deliberation', contextSummary: 'Legacy initial reading' },
    { agent: 'learner_superego', action: 'deliberation', contextSummary: 'Legacy criticism' },
    { agent: 'learner_ego_revision', action: 'deliberation', contextSummary: 'Legacy revision' },
    {
      agent: 'learner_synthesis',
      action: 'response',
      turnIndex: 2,
      contextSummary: '[INTERNAL]: hidden. [EXTERNAL]: Legacy revised answer.',
    },
  ]);

  assert.deepEqual(extractLearnerTurnsFromTrace(trace, true, []), [
    {
      turnIndex: 1,
      externalMessage: 'Current revised answer.',
      internalDeliberation: [
        { role: 'ego_initial', content: 'Current initial reading' },
        { role: 'superego', content: 'Current criticism' },
        { role: 'ego_revision', content: 'Current revision' },
      ],
    },
    {
      turnIndex: 2,
      externalMessage: 'Legacy revised answer.',
      internalDeliberation: [
        { role: 'ego_initial', content: 'Legacy initial reading' },
        { role: 'superego', content: 'Legacy criticism' },
        { role: 'ego_revision', content: 'Legacy revision' },
      ],
    },
  ]);

  assert.deepEqual(
    extractLearnerTurnsFromTrace([{ agent: 'user', action: 'turn_action', turnIndex: 2, contextSummary: '' }], false, [
      { learnerMessage: 'Earlier answer.' },
      { learnerMessage: 'Recovered from conversation history.' },
    ]),
    [{ turnIndex: 2, externalMessage: 'Recovered from conversation history.', internalDeliberation: [] }],
  );
});
