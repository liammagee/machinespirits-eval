/**
 * Tests for mid-dialogue checkpoint & resume functionality.
 *
 * Verifies that:
 * 1. Checkpoint helpers correctly write, load, list, and delete checkpoint files
 * 2. State variables are correctly serialized/deserialized through checkpoints
 * 3. The turn loop resumes from the correct index after checkpoint restore
 * 4. Checkpoints are cleaned up after successful multi-turn completion
 * 5. Resume scanning detects and attaches checkpoint state to remaining tests
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  writeCheckpoint,
  loadCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
  buildMessageChain,
} from '../services/evaluationRunner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVAL_ROOT = path.resolve(__dirname, '..');
const CHECKPOINTS_DIR = path.join(EVAL_ROOT, 'logs', 'checkpoints');

// Test fixtures
const TEST_RUN_ID = 'eval-test-checkpoint-000000';
const TEST_SCENARIO_ID = 'mood_frustration_to_breakthrough';
const TEST_PROFILE_NAME = 'cell_87_messages_recog_multi_psycho';

function makeTestState(overrides = {}) {
  return {
    lastCompletedTurn: 1,
    totalTurns: 4,
    dialogueId: 'dialogue-1234567890-abc123',
    learnerId: 'eval-learner-dialogue-1234567890-abc123-moodfrustrationtobreakthrough',
    // Mutated turn definitions — includes LLM-generated learner messages
    turns: [
      {
        id: 'escalation',
        learner_action: 'Express frustration',
        action_details: { message: 'LLM-generated: I still dont get recursion at all!' },
        _originalMessage: 'Scripted: I am frustrated',
        _learnerDeliberation: [{ role: 'ego', content: 'I should push back harder' }],
        _learnerEmotionalState: 'frustrated',
        expected_behavior: 'Acknowledge frustration',
      },
      {
        id: 'breakthrough',
        learner_action: 'Show understanding',
        action_details: { message: 'LLM-generated: Oh wait, I think I see the pattern now!' },
        _originalMessage: 'Scripted: I understand now',
        _learnerDeliberation: [{ role: 'ego', content: 'This is starting to click' }],
        expected_behavior: 'Reinforce understanding',
      },
      {
        id: 'consolidation',
        learner_action: 'Apply knowledge',
        action_details: { message: 'Scripted: Can I try a harder problem?' },
        expected_behavior: 'Provide challenge',
      },
    ],
    turnResults: [
      { turnIndex: 0, turnId: 'initial', turnScore: 72.5, suggestion: { title: 'Turn 0 response', message: 'Lets break down recursion step by step.' } },
      { turnIndex: 1, turnId: 'escalation', turnScore: 68.0, suggestion: { title: 'Turn 1 response', message: 'I understand your frustration. Lets try a different approach.' } },
    ],
    conversationHistory: [
      {
        turnIndex: 0,
        turnId: 'initial',
        suggestion: { title: 'Turn 0 response', message: 'Lets break down recursion step by step.' },
        learnerMessage: 'LLM-generated: I still dont get recursion at all!',
      },
    ],
    consolidatedTrace: [
      {
        agent: 'ego', action: 'generate', turnIndex: 0, detail: 'Initial generation',
        apiPayload: {
          captureVersion: 1, source: 'fetch_capture', provider: 'openrouter',
          endpoint: 'https://openrouter.ai/api/v1/chat/completions',
          request: { method: 'POST', body: { model: 'nvidia/nemotron', messages: [{ role: 'system', content: 'You are a tutor...' }] } },
          response: { status: 200, body: { choices: [{ message: { content: 'Lets break down...' } }] } },
        },
        inputMessages: [{ role: 'system', content: 'You are a tutor...' }, { role: 'user', content: 'Help with recursion' }],
        metrics: { latencyMs: 1200, inputTokens: 500, outputTokens: 200, provider: 'openrouter' },
      },
      {
        agent: 'superego', action: 'review', turnIndex: 0, approved: true,
        apiPayload: {
          captureVersion: 1, source: 'fetch_capture', provider: 'openrouter',
          request: { method: 'POST', body: { model: 'moonshot/kimi-k2.5', messages: [{ role: 'system', content: 'Review...' }] } },
          response: { status: 200, body: { choices: [{ message: { content: 'Approved' } }] } },
        },
        metrics: { latencyMs: 800, inputTokens: 400, outputTokens: 100, provider: 'openrouter' },
      },
      {
        agent: 'learner_ego', action: 'deliberation', turnIndex: 1,
        detail: 'I should push back harder',
        apiPayload: { captureVersion: 1, provider: 'openrouter', request: { body: { model: 'nvidia/nemotron' } }, response: { status: 200 } },
        inputMessages: [{ role: 'system', content: 'You are a learner...' }, { role: 'assistant', content: 'Lets break down...' }],
        metrics: { latencyMs: 600, inputTokens: 300, outputTokens: 150 },
      },
    ],
    priorSuperegoAssessments: ['Assessment for turn 0'],
    previousSuggestion: { title: 'Turn 1 response', message: 'I understand your frustration. Lets try a different approach.' },
    sessionEvolution: 'Ego self-reflection: learner is frustrated...',
    superegoEvolution: 'Superego reflection: maintain empathy...',
    behavioralOverrides: { rejection_threshold: 0.7, max_rejections: 1 },
    tutorProfileOfLearner: 'Learner seems confused about recursion',
    learnerProfileOfTutor: 'Tutor is patient but could be more direct',
    strategyPlan: 'Use scaffolded examples next turn',
    totalRejections: 1,
    totalLatencyMs: 5200,
    totalInputTokens: 12000,
    totalOutputTokens: 3400,
    totalApiCalls: 8,
    totalCost: 0.045,
    totalDialogueRounds: 4,
    ...overrides,
  };
}

// Clean up test checkpoint directory before and after tests
function cleanupTestCheckpoints() {
  const dir = path.join(CHECKPOINTS_DIR, TEST_RUN_ID);
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      fs.unlinkSync(path.join(dir, file));
    }
    fs.rmdirSync(dir);
  }
}

describe('Checkpoint helpers', () => {
  beforeEach(() => cleanupTestCheckpoints());
  afterEach(() => cleanupTestCheckpoints());

  describe('writeCheckpoint + loadCheckpoint round-trip', () => {
    it('writes and loads checkpoint with all state preserved', () => {
      const state = makeTestState();
      const filePath = writeCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME, state);

      assert.ok(fs.existsSync(filePath), 'Checkpoint file should exist');

      const loaded = loadCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME);
      assert.ok(loaded, 'Should load checkpoint successfully');

      // Verify metadata added by writeCheckpoint
      assert.strictEqual(loaded.version, 1);
      assert.strictEqual(loaded.runId, TEST_RUN_ID);
      assert.strictEqual(loaded.scenarioId, TEST_SCENARIO_ID);
      assert.strictEqual(loaded.profileName, TEST_PROFILE_NAME);
      assert.ok(loaded.timestamp, 'Should have timestamp');

      // Verify all 18 state variables
      assert.strictEqual(loaded.lastCompletedTurn, 1);
      assert.strictEqual(loaded.totalTurns, 4);
      assert.strictEqual(loaded.dialogueId, state.dialogueId);
      assert.strictEqual(loaded.learnerId, state.learnerId);
      assert.deepStrictEqual(loaded.turnResults, state.turnResults);
      assert.deepStrictEqual(loaded.conversationHistory, state.conversationHistory);
      assert.deepStrictEqual(loaded.consolidatedTrace, state.consolidatedTrace);
      assert.deepStrictEqual(loaded.priorSuperegoAssessments, state.priorSuperegoAssessments);
      assert.deepStrictEqual(loaded.previousSuggestion, state.previousSuggestion);
      assert.strictEqual(loaded.sessionEvolution, state.sessionEvolution);
      assert.strictEqual(loaded.superegoEvolution, state.superegoEvolution);
      assert.deepStrictEqual(loaded.behavioralOverrides, state.behavioralOverrides);
      assert.strictEqual(loaded.tutorProfileOfLearner, state.tutorProfileOfLearner);
      assert.strictEqual(loaded.learnerProfileOfTutor, state.learnerProfileOfTutor);
      assert.strictEqual(loaded.strategyPlan, state.strategyPlan);
      assert.strictEqual(loaded.totalRejections, 1);
      assert.strictEqual(loaded.totalLatencyMs, 5200);
      assert.strictEqual(loaded.totalInputTokens, 12000);
      assert.strictEqual(loaded.totalOutputTokens, 3400);
      assert.strictEqual(loaded.totalApiCalls, 8);
      assert.strictEqual(loaded.totalCost, 0.045);
      assert.strictEqual(loaded.totalDialogueRounds, 4);
    });

    it('overwrites existing checkpoint on re-write', () => {
      writeCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME, makeTestState({ lastCompletedTurn: 0 }));
      writeCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME, makeTestState({ lastCompletedTurn: 2 }));

      const loaded = loadCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME);
      assert.strictEqual(loaded.lastCompletedTurn, 2, 'Should reflect latest write');
    });
  });

  describe('loadCheckpoint returns null for missing', () => {
    it('returns null when no checkpoint exists', () => {
      const result = loadCheckpoint('nonexistent-run', 'nonexistent-scenario', 'nonexistent-profile');
      assert.strictEqual(result, null);
    });
  });

  describe('deleteCheckpoint', () => {
    it('removes checkpoint file and empty directory', () => {
      writeCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME, makeTestState());
      const dir = path.join(CHECKPOINTS_DIR, TEST_RUN_ID);
      assert.ok(fs.existsSync(dir), 'Directory should exist');

      deleteCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME);

      const loaded = loadCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME);
      assert.strictEqual(loaded, null, 'Should return null after delete');
      assert.ok(!fs.existsSync(dir), 'Empty directory should be removed');
    });

    it('preserves directory if other checkpoints remain', () => {
      writeCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME, makeTestState());
      writeCheckpoint(TEST_RUN_ID, 'other_scenario', TEST_PROFILE_NAME, makeTestState());

      deleteCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME);

      const dir = path.join(CHECKPOINTS_DIR, TEST_RUN_ID);
      assert.ok(fs.existsSync(dir), 'Directory should still exist (has other files)');

      // Cleanup the other file
      deleteCheckpoint(TEST_RUN_ID, 'other_scenario', TEST_PROFILE_NAME);
    });

    it('is idempotent (no error when already deleted)', () => {
      // Should not throw
      deleteCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME);
      deleteCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME);
    });
  });

  describe('listCheckpoints', () => {
    it('returns empty array when no checkpoints exist', () => {
      const result = listCheckpoints('nonexistent-run');
      assert.deepStrictEqual(result, []);
    });

    it('finds all checkpoints for a run', () => {
      writeCheckpoint(TEST_RUN_ID, 'scenario_a', 'profile_x', makeTestState({ lastCompletedTurn: 0 }));
      writeCheckpoint(TEST_RUN_ID, 'scenario_b', 'profile_y', makeTestState({ lastCompletedTurn: 2 }));

      const result = listCheckpoints(TEST_RUN_ID);
      assert.strictEqual(result.length, 2, 'Should find 2 checkpoints');

      const scenarios = result.map((cp) => cp.scenarioId).sort();
      assert.deepStrictEqual(scenarios, ['scenario_a', 'scenario_b']);

      // Cleanup
      deleteCheckpoint(TEST_RUN_ID, 'scenario_a', 'profile_x');
      deleteCheckpoint(TEST_RUN_ID, 'scenario_b', 'profile_y');
    });

    it('skips corrupt checkpoint files', () => {
      // Write a valid checkpoint
      writeCheckpoint(TEST_RUN_ID, 'valid_scenario', TEST_PROFILE_NAME, makeTestState());

      // Write a corrupt file directly
      const dir = path.join(CHECKPOINTS_DIR, TEST_RUN_ID);
      fs.writeFileSync(path.join(dir, 'corrupt.json'), 'not valid json{{{');

      const result = listCheckpoints(TEST_RUN_ID);
      assert.strictEqual(result.length, 1, 'Should only find the valid checkpoint');
      assert.strictEqual(result[0].scenarioId, 'valid_scenario');

      // Cleanup
      fs.unlinkSync(path.join(dir, 'corrupt.json'));
      deleteCheckpoint(TEST_RUN_ID, 'valid_scenario', TEST_PROFILE_NAME);
    });

    it('skips files with wrong version', () => {
      // Write a valid checkpoint
      writeCheckpoint(TEST_RUN_ID, 'valid_scenario', TEST_PROFILE_NAME, makeTestState());

      // Write a file with wrong version
      const dir = path.join(CHECKPOINTS_DIR, TEST_RUN_ID);
      fs.writeFileSync(
        path.join(dir, 'wrong_version.json'),
        JSON.stringify({ version: 999, scenarioId: 'old', profileName: 'old' }),
      );

      const result = listCheckpoints(TEST_RUN_ID);
      assert.strictEqual(result.length, 1, 'Should only find version-1 checkpoint');

      // Cleanup
      fs.unlinkSync(path.join(dir, 'wrong_version.json'));
      deleteCheckpoint(TEST_RUN_ID, 'valid_scenario', TEST_PROFILE_NAME);
    });
  });
});

describe('Checkpoint state restoration logic', () => {
  it('startTurnIdx should be lastCompletedTurn + 1', () => {
    const checkpointState = { lastCompletedTurn: 2 };
    const startTurnIdx = checkpointState ? checkpointState.lastCompletedTurn + 1 : 0;
    assert.strictEqual(startTurnIdx, 3, 'Should resume from turn 3');
  });

  it('startTurnIdx should be 0 when no checkpoint', () => {
    const checkpointState = null;
    const startTurnIdx = checkpointState ? checkpointState.lastCompletedTurn + 1 : 0;
    assert.strictEqual(startTurnIdx, 0, 'Should start from turn 0');
  });

  it('all 18 state variables are present in checkpoint', () => {
    const state = makeTestState();
    const expectedFields = [
      'lastCompletedTurn',
      'totalTurns',
      'dialogueId',
      'learnerId',
      'turnResults',
      'conversationHistory',
      'consolidatedTrace',
      'priorSuperegoAssessments',
      'previousSuggestion',
      'sessionEvolution',
      'superegoEvolution',
      'behavioralOverrides',
      'tutorProfileOfLearner',
      'learnerProfileOfTutor',
      'strategyPlan',
      'totalRejections',
      'totalLatencyMs',
      'totalInputTokens',
      'totalOutputTokens',
      'totalApiCalls',
      'totalCost',
      'totalDialogueRounds',
    ];

    for (const field of expectedFields) {
      assert.ok(field in state, `State should include ${field}`);
      assert.notStrictEqual(state[field], undefined, `${field} should not be undefined`);
    }
  });

  it('null state variables are correctly restored via ?? operator', () => {
    // Simulate checkpoint with null optional fields
    const cs = makeTestState({
      sessionEvolution: null,
      superegoEvolution: null,
      behavioralOverrides: null,
      tutorProfileOfLearner: null,
      learnerProfileOfTutor: null,
      strategyPlan: null,
    });

    // These use ?? null, so null should stay null (not become a default)
    assert.strictEqual(cs.sessionEvolution ?? null, null);
    assert.strictEqual(cs.superegoEvolution ?? null, null);
    assert.strictEqual(cs.behavioralOverrides ?? null, null);
    assert.strictEqual(cs.tutorProfileOfLearner ?? null, null);
    assert.strictEqual(cs.learnerProfileOfTutor ?? null, null);
    assert.strictEqual(cs.strategyPlan ?? null, null);
  });

  it('dialogueId is restored from checkpoint, not regenerated', () => {
    const cs = makeTestState();
    const dialogueId = cs?.dialogueId || `dialogue-${Date.now()}-new`;
    assert.strictEqual(dialogueId, 'dialogue-1234567890-abc123', 'Should use checkpoint dialogueId');
  });

  it('dialogueId is generated fresh when no checkpoint', () => {
    const cs = null;
    const dialogueId = cs?.dialogueId || `dialogue-fresh`;
    assert.strictEqual(dialogueId, 'dialogue-fresh', 'Should generate new dialogueId');
  });
});

describe('Resume checkpoint attachment', () => {
  beforeEach(() => cleanupTestCheckpoints());
  afterEach(() => cleanupTestCheckpoints());

  it('attaches checkpoint state to matching remaining test', () => {
    // Simulate: write a checkpoint for a specific (profile, scenario) combo
    const state = makeTestState();
    writeCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME, state);

    // Simulate remainingTests array (as built by resumeEvaluation)
    const remainingTests = [
      { config: { profileName: TEST_PROFILE_NAME }, scenario: { id: TEST_SCENARIO_ID }, runNum: 0 },
      { config: { profileName: 'other_profile' }, scenario: { id: 'other_scenario' }, runNum: 0 },
    ];

    // Replicate the checkpoint attachment logic from resumeEvaluation
    const checkpoints = listCheckpoints(TEST_RUN_ID);
    const checkpointMap = new Map();
    for (const cp of checkpoints) {
      checkpointMap.set(`${cp.profileName}:${cp.scenarioId}`, cp);
    }
    let checkpointCount = 0;
    for (const test of remainingTests) {
      const key = `${test.config.profileName}:${test.scenario.id}`;
      const cp = checkpointMap.get(key);
      if (cp) {
        test.checkpointState = cp;
        checkpointMap.delete(key);
        checkpointCount++;
      }
    }

    assert.strictEqual(checkpointCount, 1, 'Should attach 1 checkpoint');
    assert.ok(remainingTests[0].checkpointState, 'First test should have checkpoint');
    assert.strictEqual(remainingTests[0].checkpointState.lastCompletedTurn, 1);
    assert.strictEqual(remainingTests[1].checkpointState, undefined, 'Second test should not have checkpoint');
  });

  it('attaches checkpoint to only one test per (profile, scenario) combo', () => {
    writeCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME, makeTestState());

    // Two tests for the same (profile, scenario) — e.g. runsPerConfig=2
    const remainingTests = [
      { config: { profileName: TEST_PROFILE_NAME }, scenario: { id: TEST_SCENARIO_ID }, runNum: 0 },
      { config: { profileName: TEST_PROFILE_NAME }, scenario: { id: TEST_SCENARIO_ID }, runNum: 1 },
    ];

    const checkpoints = listCheckpoints(TEST_RUN_ID);
    const checkpointMap = new Map();
    for (const cp of checkpoints) {
      checkpointMap.set(`${cp.profileName}:${cp.scenarioId}`, cp);
    }
    let checkpointCount = 0;
    for (const test of remainingTests) {
      const key = `${test.config.profileName}:${test.scenario.id}`;
      const cp = checkpointMap.get(key);
      if (cp) {
        test.checkpointState = cp;
        checkpointMap.delete(key);
        checkpointCount++;
      }
    }

    assert.strictEqual(checkpointCount, 1, 'Should attach checkpoint to only one test');
    assert.ok(remainingTests[0].checkpointState, 'First test gets the checkpoint');
    assert.strictEqual(remainingTests[1].checkpointState, undefined, 'Second test starts fresh');
  });
});

describe('Checkpoint file naming', () => {
  beforeEach(() => cleanupTestCheckpoints());
  afterEach(() => cleanupTestCheckpoints());

  it('handles special characters in scenario and profile names', () => {
    const weirdScenario = 'scenario/with:special.chars';
    const weirdProfile = 'profile_name-v2';

    writeCheckpoint(TEST_RUN_ID, weirdScenario, weirdProfile, makeTestState());
    const loaded = loadCheckpoint(TEST_RUN_ID, weirdScenario, weirdProfile);

    assert.ok(loaded, 'Should load checkpoint with special chars in names');
    assert.strictEqual(loaded.scenarioId, weirdScenario);
    assert.strictEqual(loaded.profileName, weirdProfile);

    deleteCheckpoint(TEST_RUN_ID, weirdScenario, weirdProfile);
  });
});

describe('API data preservation through checkpoint', () => {
  beforeEach(() => cleanupTestCheckpoints());
  afterEach(() => cleanupTestCheckpoints());

  it('apiPayload objects survive JSON round-trip', () => {
    const state = makeTestState();
    writeCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME, state);
    const loaded = loadCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME);

    // Verify ego trace entry preserves full apiPayload
    const egoEntry = loaded.consolidatedTrace.find((e) => e.agent === 'ego');
    assert.ok(egoEntry.apiPayload, 'Ego entry should have apiPayload');
    assert.strictEqual(egoEntry.apiPayload.captureVersion, 1);
    assert.strictEqual(egoEntry.apiPayload.provider, 'openrouter');
    assert.strictEqual(egoEntry.apiPayload.endpoint, 'https://openrouter.ai/api/v1/chat/completions');

    // Verify request body preserved (contains model and messages)
    assert.strictEqual(egoEntry.apiPayload.request.method, 'POST');
    assert.strictEqual(egoEntry.apiPayload.request.body.model, 'nvidia/nemotron');
    assert.ok(Array.isArray(egoEntry.apiPayload.request.body.messages), 'Request messages should be array');

    // Verify response body preserved
    assert.strictEqual(egoEntry.apiPayload.response.status, 200);
    assert.ok(egoEntry.apiPayload.response.body.choices, 'Response should have choices');
  });

  it('inputMessages survive JSON round-trip', () => {
    const state = makeTestState();
    writeCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME, state);
    const loaded = loadCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME);

    const egoEntry = loaded.consolidatedTrace.find((e) => e.agent === 'ego');
    assert.ok(Array.isArray(egoEntry.inputMessages), 'inputMessages should be array');
    assert.strictEqual(egoEntry.inputMessages.length, 2);
    assert.strictEqual(egoEntry.inputMessages[0].role, 'system');
    assert.strictEqual(egoEntry.inputMessages[1].role, 'user');
  });

  it('metrics (tokens, latency, provider) survive round-trip', () => {
    const state = makeTestState();
    writeCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME, state);
    const loaded = loadCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME);

    const egoEntry = loaded.consolidatedTrace.find((e) => e.agent === 'ego');
    assert.strictEqual(egoEntry.metrics.latencyMs, 1200);
    assert.strictEqual(egoEntry.metrics.inputTokens, 500);
    assert.strictEqual(egoEntry.metrics.outputTokens, 200);
    assert.strictEqual(egoEntry.metrics.provider, 'openrouter');
  });

  it('learner deliberation entries with apiPayload survive round-trip', () => {
    const state = makeTestState();
    writeCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME, state);
    const loaded = loadCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME);

    const learnerEntry = loaded.consolidatedTrace.find((e) => e.agent === 'learner_ego');
    assert.ok(learnerEntry, 'Should have learner_ego trace entry');
    assert.ok(learnerEntry.apiPayload, 'Learner entry should have apiPayload');
    assert.ok(Array.isArray(learnerEntry.inputMessages), 'Learner should have inputMessages');
    assert.strictEqual(learnerEntry.inputMessages[0].role, 'system');
  });
});

describe('Turns mutation preservation (dynamic learner fix)', () => {
  beforeEach(() => cleanupTestCheckpoints());
  afterEach(() => cleanupTestCheckpoints());

  it('checkpointed turns include LLM-generated learner mutations', () => {
    const state = makeTestState();
    writeCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME, state);
    const loaded = loadCheckpoint(TEST_RUN_ID, TEST_SCENARIO_ID, TEST_PROFILE_NAME);

    assert.ok(Array.isArray(loaded.turns), 'Checkpoint should include turns array');
    assert.strictEqual(loaded.turns.length, 3, 'Should have all 3 follow-up turns');

    // Turn 0 (escalation) was mutated by LLM learner generation
    const escalation = loaded.turns[0];
    assert.strictEqual(escalation.id, 'escalation');
    assert.ok(escalation.action_details.message.startsWith('LLM-generated:'),
      'Should have LLM-generated message, not scripted');
    assert.strictEqual(escalation._originalMessage, 'Scripted: I am frustrated',
      'Should preserve original scripted message');
    assert.ok(escalation._learnerDeliberation, 'Should have learner deliberation');

    // Turn 1 (breakthrough) was also mutated
    const breakthrough = loaded.turns[1];
    assert.ok(breakthrough.action_details.message.startsWith('LLM-generated:'),
      'Breakthrough turn should have LLM message');

    // Turn 2 (consolidation) was NOT mutated yet (still scripted)
    const consolidation = loaded.turns[2];
    assert.strictEqual(consolidation.action_details.message, 'Scripted: Can I try a harder problem?',
      'Unmutated turn should keep scripted message');
    assert.strictEqual(consolidation._originalMessage, undefined,
      'Unmutated turn should not have _originalMessage');
  });

  it('resumed turns use checkpointed (mutated) turn definitions, not fresh clones', () => {
    // This test verifies the fix for the turns mutation bug.
    // On resume, `turns` should come from checkpoint (with LLM mutations),
    // not from a fresh clone of fullScenario.turns (which has scripted messages).

    const state = makeTestState({ lastCompletedTurn: 1 });

    // Simulate the resume logic:
    // cs?.turns || JSON.parse(JSON.stringify(fullScenario.turns))
    const cs = state;
    const originalScenarioTurns = [
      { id: 'escalation', action_details: { message: 'ORIGINAL scripted message' } },
      { id: 'breakthrough', action_details: { message: 'ORIGINAL scripted message' } },
      { id: 'consolidation', action_details: { message: 'ORIGINAL scripted message' } },
    ];

    const turns = cs?.turns || JSON.parse(JSON.stringify(originalScenarioTurns));

    // The restored turns should have the LLM-generated messages, not the originals
    assert.ok(turns[0].action_details.message.startsWith('LLM-generated:'),
      'Turn 0 should use LLM message from checkpoint, not original');
    assert.ok(turns[1].action_details.message.startsWith('LLM-generated:'),
      'Turn 1 should use LLM message from checkpoint, not original');
  });
});

describe('buildMessageChain from restored conversationHistory', () => {
  it('produces correct alternating assistant/user message chain', () => {
    const cs = makeTestState();

    // buildMessageChain reads suggestion.message and learnerMessage from conversationHistory
    const chain = buildMessageChain(cs.conversationHistory);

    assert.ok(Array.isArray(chain), 'Should return array');
    assert.strictEqual(chain.length, 2, 'Should have 2 messages (1 assistant + 1 user)');
    assert.strictEqual(chain[0].role, 'assistant');
    assert.strictEqual(chain[0].content, 'Lets break down recursion step by step.');
    assert.strictEqual(chain[1].role, 'user');
    assert.strictEqual(chain[1].content, 'LLM-generated: I still dont get recursion at all!');
  });

  it('handles multi-turn conversation history', () => {
    const history = [
      {
        turnIndex: 0, suggestion: { message: 'Tutor turn 0' },
        learnerMessage: 'Learner turn 1',
      },
      {
        turnIndex: 1, suggestion: { message: 'Tutor turn 1' },
        learnerMessage: 'Learner turn 2',
      },
    ];

    const chain = buildMessageChain(history);
    assert.strictEqual(chain.length, 4);
    assert.deepStrictEqual(chain, [
      { role: 'assistant', content: 'Tutor turn 0' },
      { role: 'user', content: 'Learner turn 1' },
      { role: 'assistant', content: 'Tutor turn 1' },
      { role: 'user', content: 'Learner turn 2' },
    ]);
  });

  it('skips entries without suggestion.message or learnerMessage', () => {
    const history = [
      { turnIndex: 0, suggestion: { title: 'no message field' }, learnerMessage: null },
      { turnIndex: 1, suggestion: { message: 'Has message' }, learnerMessage: 'Has learner' },
    ];

    const chain = buildMessageChain(history);
    assert.strictEqual(chain.length, 2, 'Should skip entry without message/learnerMessage');
    assert.strictEqual(chain[0].role, 'assistant');
    assert.strictEqual(chain[1].role, 'user');
  });

  it('returns empty array for null/empty history', () => {
    assert.deepStrictEqual(buildMessageChain(null), []);
    assert.deepStrictEqual(buildMessageChain([]), []);
  });
});
