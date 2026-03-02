/**
 * End-to-end test for mid-dialogue checkpoint & resume.
 *
 * Strategy:
 * 1. Create a run record in the DB (simulating a run that was killed)
 * 2. Plant a mid-dialogue checkpoint file
 * 3. Call resumeEvaluation() → verify it finds the checkpoint and resumes from it
 * 4. Verify the result appears in the DB with all turns completed
 * 5. Verify the checkpoint file is cleaned up
 *
 * Uses dryRun=true in metadata to avoid real API calls.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { writeCheckpoint, listCheckpoints, resumeEvaluation } from '../services/evaluationRunner.js';
import evaluationStore from '../services/evaluationStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVAL_ROOT = path.resolve(__dirname, '..');
const CHECKPOINTS_DIR = path.join(EVAL_ROOT, 'logs', 'checkpoints');

const TEST_SCENARIO = 'mood_frustration_to_breakthrough';
const TEST_PROFILE = 'cell_3_base_multi_unified';

describe('Checkpoint E2E: resume from planted checkpoint', () => {
  let runId;
  let resumeResult;

  before(async () => {
    // 1. Create a run record in the DB, simulating a run that was killed mid-dialogue
    const run = evaluationStore.createRun({
      description: 'E2E checkpoint test',
      totalScenarios: 1,
      totalConfigurations: 1,
      metadata: {
        runsPerConfig: 1,
        skipRubricEval: true,
        dryRun: true,
        scenarioIds: [TEST_SCENARIO],
        profileNames: [TEST_PROFILE],
        pid: process.pid,
      },
    });
    runId = run.id;
    evaluationStore.updateRun(runId, { status: 'running', totalTests: 1 });

    // 2. Plant a mid-dialogue checkpoint (simulating kill after turn 1 of 4)
    writeCheckpoint(runId, TEST_SCENARIO, TEST_PROFILE, {
      lastCompletedTurn: 1,
      totalTurns: 4,
      dialogueId: `dialogue-e2e-test-${Date.now()}`,
      learnerId: `eval-learner-e2e-test-${Date.now()}`,
      turns: [
        {
          id: 'turn_1_still_frustrated',
          learner_action: 'Express frustration',
          action_details: { message: 'I still dont understand recursion!' },
        },
        {
          id: 'turn_2_starting_to_get_it',
          learner_action: 'Show progress',
          action_details: { message: 'Oh wait, maybe I see...' },
        },
        { id: 'turn_3_breakthrough', learner_action: 'Breakthrough', action_details: { message: 'I get it now!' } },
      ],
      turnResults: [
        {
          turnIndex: 0,
          turnId: 'initial',
          turnScore: 72.5,
          suggestion: { title: 'Turn 0', message: 'Welcome!' },
          scores: { relevance: 4, specificity: 3, pedagogical: 4, personalization: 4, actionability: 4, tone: 4 },
          scoringMethod: 'rubric',
          requiredMissing: [],
          forbiddenFound: [],
        },
        {
          turnIndex: 1,
          turnId: 'turn_1_still_frustrated',
          turnScore: 68.0,
          suggestion: { title: 'Turn 1', message: 'I see your frustration...' },
          scores: { relevance: 3, specificity: 3, pedagogical: 4, personalization: 4, actionability: 4, tone: 3 },
          scoringMethod: 'rubric',
          requiredMissing: [],
          forbiddenFound: [],
        },
      ],
      conversationHistory: [
        {
          turnIndex: 0,
          turnId: 'initial',
          suggestion: { title: 'Turn 0', message: 'Welcome!' },
          learnerMessage: 'I still dont understand recursion!',
        },
        {
          turnIndex: 1,
          turnId: 'turn_1_still_frustrated',
          suggestion: { title: 'Turn 1', message: 'I see your frustration...' },
          learnerMessage: 'Oh wait, maybe I see...',
        },
      ],
      consolidatedTrace: [
        { agent: 'ego', action: 'generate', turnIndex: 0, detail: 'Turn 0 generation' },
        { agent: 'superego', action: 'review', turnIndex: 0, approved: true },
        { agent: 'ego', action: 'generate', turnIndex: 1, detail: 'Turn 1 generation' },
        { agent: 'superego', action: 'review', turnIndex: 1, approved: true },
      ],
      priorSuperegoAssessments: [
        { turnIndex: 0, finalApproved: true, rejections: 0, interventionTypes: [], feedback: 'Good initial approach' },
        {
          turnIndex: 1,
          finalApproved: true,
          rejections: 1,
          interventionTypes: ['tone'],
          feedback: 'Soften frustration response',
        },
      ],
      previousSuggestion: { title: 'Turn 1', message: 'I see your frustration...' },
      sessionEvolution: null,
      superegoEvolution: null,
      behavioralOverrides: null,
      tutorProfileOfLearner: null,
      learnerProfileOfTutor: null,
      strategyPlan: null,
      totalRejections: 0,
      totalLatencyMs: 200,
      totalInputTokens: 600,
      totalOutputTokens: 300,
      totalApiCalls: 4,
      totalCost: 0,
      totalDialogueRounds: 4,
    });

    // Verify checkpoint was planted
    const cps = listCheckpoints(runId);
    assert.strictEqual(cps.length, 1, 'Should have planted 1 checkpoint');
    assert.strictEqual(cps[0].lastCompletedTurn, 1, 'Checkpoint should be at turn 1');

    // 3. Resume — should pick up from turn 2 (lastCompletedTurn + 1)
    resumeResult = await resumeEvaluation({
      runId,
      verbose: false,
      force: true,
    });
  });

  after(() => {
    if (runId) {
      // Clean DB records
      try {
        evaluationStore.deleteRun(runId);
      } catch {
        /* ignore */
      }
      // Clean any leftover checkpoint files
      const cpDir = path.join(CHECKPOINTS_DIR, runId);
      if (fs.existsSync(cpDir)) {
        for (const f of fs.readdirSync(cpDir)) fs.unlinkSync(path.join(cpDir, f));
        fs.rmdirSync(cpDir);
      }
    }
  });

  it('resume completes successfully', () => {
    assert.ok(resumeResult, 'Should have a resume result');
    assert.strictEqual(resumeResult.runId, runId);
  });

  it('resume reports 1 successful test', () => {
    assert.strictEqual(resumeResult.successfulTests, 1, 'Should complete 1 test');
    assert.strictEqual(resumeResult.failedTests, 0, 'Should have no failures');
  });

  it('checkpoint is cleaned up after resume completes', () => {
    const remaining = listCheckpoints(runId);
    assert.strictEqual(remaining.length, 0, 'Checkpoint should be deleted after successful resume');
  });

  it('DB has a successful result for the scenario', () => {
    const results = evaluationStore.getResults(runId);
    assert.ok(results.length > 0, 'Should have at least one result');
    const match = results.find((r) => r.scenarioId === TEST_SCENARIO);
    assert.ok(match, 'Should have a result for mood_frustration_to_breakthrough');
    assert.ok(match.success, 'Result should be successful');
  });

  it('result includes all 4 turns of dialogue', () => {
    const results = evaluationStore.getResults(runId);
    const match = results.find((r) => r.scenarioId === TEST_SCENARIO);
    assert.ok(match, 'Should have a result');

    // suggestions may be a JSON string or already-parsed array depending on DB layer
    const suggestions =
      typeof match.suggestions === 'string' ? JSON.parse(match.suggestions || '[]') : match.suggestions || [];
    assert.strictEqual(suggestions.length, 4, 'Should have 4 suggestions (1 initial + 3 follow-up turns)');
  });

  it('result shows correct dialogue_rounds count', () => {
    const results = evaluationStore.getResults(runId);
    const match = results.find((r) => r.scenarioId === TEST_SCENARIO);
    assert.ok(match, 'Should have a result');
    // dialogue_rounds accumulates across checkpoint + resumed turns
    assert.ok(match.dialogueRounds >= 4, `Should have at least 4 dialogue rounds, got ${match.dialogueRounds}`);
  });

  it('resumed dialogue preserves the original dialogueId from checkpoint', () => {
    const results = evaluationStore.getResults(runId);
    const match = results.find((r) => r.scenarioId === TEST_SCENARIO);
    assert.ok(match, 'Should have a result');
    assert.ok(
      match.dialogueId.startsWith('dialogue-e2e-test-'),
      `dialogueId should be from checkpoint, got ${match.dialogueId}`,
    );
  });
});
