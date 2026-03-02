/**
 * Tests for learner turn target computation in the evaluate pipeline.
 *
 * Bug: the findIndex guard `idx > 0` dropped the first learner turn (at
 * reconstructedTurns[0]) from scoring. Fixed to `idx >= 0`.
 *
 * This test replicates the exact reconstruction + target-finding logic from
 * eval-cli.js evaluateMultiTurnResult (lines ~2862-2890) and the standalone
 * evaluate-learner path (lines ~4620-4630).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Replicate extractLearnerTurnsFromTrace (eval-cli.js:922) ──
function extractLearnerTurnsFromTrace(trace, isMultiAgent, conversationHistory) {
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

    learnerTurns.push(turnData);
  }

  return learnerTurns;
}

// ── Replicate reconstructedTurns + learnerTurnTargets logic ──
function buildLearnerTurnTargets(learnerTurns, turnResults) {
  const reconstructedTurns = [];
  for (let lt = 0; lt < learnerTurns.length; lt++) {
    reconstructedTurns.push({
      turnNumber: lt + 1,
      phase: 'learner',
      externalMessage: learnerTurns[lt].externalMessage,
      internalDeliberation: learnerTurns[lt].internalDeliberation,
    });

    const tutorTurn = turnResults[lt + 1];
    if (tutorTurn) {
      const sug = tutorTurn.suggestions?.[0];
      reconstructedTurns.push({
        turnNumber: lt + 1,
        phase: 'tutor',
        externalMessage: sug?.message || sug?.text || JSON.stringify(sug),
      });
    }
  }

  // FIXED: was `idx > 0` which dropped the first learner turn at index 0
  const learnerTurnTargets = [];
  for (let lt = 0; lt < learnerTurns.length; lt++) {
    const targetIdx = reconstructedTurns.findIndex(
      (t) => t.phase === 'learner' && t.externalMessage === learnerTurns[lt].externalMessage,
    );
    if (targetIdx !== -1) {
      learnerTurnTargets.push({ lt, targetIdx });
    }
  }

  return { reconstructedTurns, learnerTurnTargets };
}

// ── Bug-reproducing version for comparison ──
function buildLearnerTurnTargets_BUGGY(learnerTurns, turnResults) {
  const reconstructedTurns = [];
  for (let lt = 0; lt < learnerTurns.length; lt++) {
    reconstructedTurns.push({
      turnNumber: lt + 1,
      phase: 'learner',
      externalMessage: learnerTurns[lt].externalMessage,
      internalDeliberation: learnerTurns[lt].internalDeliberation,
    });
    const tutorTurn = turnResults[lt + 1];
    if (tutorTurn) {
      const sug = tutorTurn.suggestions?.[0];
      reconstructedTurns.push({
        turnNumber: lt + 1,
        phase: 'tutor',
        externalMessage: sug?.message || sug?.text || JSON.stringify(sug),
      });
    }
  }
  const learnerTurnTargets = [];
  for (let lt = 0; lt < learnerTurns.length; lt++) {
    const targetIdx = reconstructedTurns.findIndex(
      (t, idx) => t.phase === 'learner' && t.externalMessage === learnerTurns[lt].externalMessage && idx > 0,
    );
    if (targetIdx !== -1) {
      learnerTurnTargets.push({ lt, targetIdx });
    }
  }
  return { reconstructedTurns, learnerTurnTargets };
}

// ── Test fixtures ──

// 5-turn ego_superego dialogue (like cell_87 epistemic resistance)
function make5TurnEgoSuperegoTrace() {
  const trace = [
    { agent: 'tutor', action: 'context_input', turnIndex: undefined },
    { agent: 'ego', action: 'generate', turnIndex: undefined },
    { agent: 'superego', action: 'review', turnIndex: undefined },
    { agent: 'ego', action: 'revise', turnIndex: undefined },
    { agent: 'tutor', action: 'final_output', turnIndex: 0, detail: 'Tutor turn 0' },
    { agent: 'learner_ego_initial', action: 'deliberation', turnIndex: 1, contextSummary: 'Ego initial 1' },
    { agent: 'learner_superego', action: 'deliberation', turnIndex: 1, contextSummary: 'Superego 1' },
    { agent: 'learner_ego_revision', action: 'deliberation', turnIndex: 1, contextSummary: 'Ego revision 1' },
    { agent: 'learner', action: 'final_output', turnIndex: 1, detail: 'Learner turn 1 message' },
    { agent: 'tutor', action: 'final_output', turnIndex: 1, detail: 'Tutor turn 1' },
    { agent: 'learner_ego_initial', action: 'deliberation', turnIndex: 2, contextSummary: 'Ego initial 2' },
    { agent: 'learner_superego', action: 'deliberation', turnIndex: 2, contextSummary: 'Superego 2' },
    { agent: 'learner_ego_revision', action: 'deliberation', turnIndex: 2, contextSummary: 'Ego revision 2' },
    { agent: 'learner', action: 'final_output', turnIndex: 2, detail: 'Learner turn 2 message' },
    { agent: 'tutor', action: 'final_output', turnIndex: 2, detail: 'Tutor turn 2' },
    { agent: 'learner_ego_initial', action: 'deliberation', turnIndex: 3, contextSummary: 'Ego initial 3' },
    { agent: 'learner_superego', action: 'deliberation', turnIndex: 3, contextSummary: 'Superego 3' },
    { agent: 'learner_ego_revision', action: 'deliberation', turnIndex: 3, contextSummary: 'Ego revision 3' },
    { agent: 'learner', action: 'final_output', turnIndex: 3, detail: 'Learner turn 3 message' },
    { agent: 'tutor', action: 'final_output', turnIndex: 3, detail: 'Tutor turn 3' },
    { agent: 'learner_ego_initial', action: 'deliberation', turnIndex: 4, contextSummary: 'Ego initial 4' },
    { agent: 'learner_superego', action: 'deliberation', turnIndex: 4, contextSummary: 'Superego 4' },
    { agent: 'learner_ego_revision', action: 'deliberation', turnIndex: 4, contextSummary: 'Ego revision 4' },
    { agent: 'learner', action: 'final_output', turnIndex: 4, detail: 'Learner turn 4 message' },
    { agent: 'tutor', action: 'final_output', turnIndex: 4, detail: 'Tutor turn 4' },
    { agent: 'learner', action: 'final_output', turnIndex: 5, detail: 'Learner turn 5 message' },
    { agent: 'tutor', action: 'final_output', turnIndex: 5, detail: 'Tutor turn 5' },
  ];

  const turnResults = [
    { turnIndex: 0, suggestions: [{ message: 'Tutor turn 0' }] },
    { turnIndex: 1, suggestions: [{ message: 'Tutor turn 1' }] },
    { turnIndex: 2, suggestions: [{ message: 'Tutor turn 2' }] },
    { turnIndex: 3, suggestions: [{ message: 'Tutor turn 3' }] },
    { turnIndex: 4, suggestions: [{ message: 'Tutor turn 4' }] },
    { turnIndex: 5, suggestions: [{ message: 'Tutor turn 5' }] },
  ];

  return { trace, turnResults };
}

// 3-turn unified dialogue (like cell_80 misconception correction)
function make3TurnUnifiedTrace() {
  const trace = [
    { agent: 'tutor', action: 'final_output', turnIndex: 0, detail: 'Tutor turn 0' },
    { agent: 'learner', action: 'final_output', turnIndex: 1, detail: 'Learner turn 1 msg' },
    { agent: 'tutor', action: 'final_output', turnIndex: 1, detail: 'Tutor turn 1' },
    { agent: 'learner', action: 'final_output', turnIndex: 2, detail: 'Learner turn 2 msg' },
    { agent: 'tutor', action: 'final_output', turnIndex: 2, detail: 'Tutor turn 2' },
    { agent: 'learner', action: 'final_output', turnIndex: 3, detail: 'Learner turn 3 msg' },
    { agent: 'tutor', action: 'final_output', turnIndex: 3, detail: 'Tutor turn 3' },
  ];

  const turnResults = [
    { turnIndex: 0, suggestions: [{ message: 'Tutor turn 0' }] },
    { turnIndex: 1, suggestions: [{ message: 'Tutor turn 1' }] },
    { turnIndex: 2, suggestions: [{ message: 'Tutor turn 2' }] },
    { turnIndex: 3, suggestions: [{ message: 'Tutor turn 3' }] },
  ];

  return { trace, turnResults };
}

// Minimal 1-turn dialogue (single learner response)
function make1TurnTrace() {
  const trace = [
    { agent: 'tutor', action: 'final_output', turnIndex: 0, detail: 'Tutor turn 0' },
    { agent: 'learner', action: 'final_output', turnIndex: 1, detail: 'Only learner message' },
    { agent: 'tutor', action: 'final_output', turnIndex: 1, detail: 'Tutor turn 1' },
  ];

  const turnResults = [
    { turnIndex: 0, suggestions: [{ message: 'Tutor turn 0' }] },
    { turnIndex: 1, suggestions: [{ message: 'Tutor turn 1' }] },
  ];

  return { trace, turnResults };
}

// ── Tests ──

describe('extractLearnerTurnsFromTrace', () => {
  it('extracts all learner final_output entries from ego_superego trace', () => {
    const { trace } = make5TurnEgoSuperegoTrace();
    const turns = extractLearnerTurnsFromTrace(trace, true, []);
    assert.equal(turns.length, 5, 'Should extract 5 learner turns (turns 1-5)');
    assert.deepEqual(
      turns.map((t) => t.turnIndex),
      [1, 2, 3, 4, 5],
    );
  });

  it('extracts all learner final_output entries from unified trace', () => {
    const { trace } = make3TurnUnifiedTrace();
    const turns = extractLearnerTurnsFromTrace(trace, false, []);
    assert.equal(turns.length, 3, 'Should extract 3 learner turns (turns 1-3)');
  });

  it('extracts single learner turn from minimal dialogue', () => {
    const { trace } = make1TurnTrace();
    const turns = extractLearnerTurnsFromTrace(trace, false, []);
    assert.equal(turns.length, 1);
    assert.equal(turns[0].externalMessage, 'Only learner message');
  });

  it('strips [INTERNAL]/[EXTERNAL] from unified learner output', () => {
    const trace = [
      {
        agent: 'learner',
        action: 'final_output',
        turnIndex: 1,
        detail: '[INTERNAL]: private thoughts\n\n[EXTERNAL]: This is what the tutor sees',
      },
    ];
    const turns = extractLearnerTurnsFromTrace(trace, false, []);
    assert.equal(turns[0].externalMessage, 'This is what the tutor sees');
  });
});

describe('buildLearnerTurnTargets', () => {
  it('includes first learner turn at index 0 (bug fix: was idx > 0)', () => {
    const { trace, turnResults } = make5TurnEgoSuperegoTrace();
    const learnerTurns = extractLearnerTurnsFromTrace(trace, true, []);
    const { learnerTurnTargets } = buildLearnerTurnTargets(learnerTurns, turnResults);

    assert.equal(learnerTurnTargets.length, 5, 'All 5 learner turns should be targeted');
    assert.equal(learnerTurnTargets[0].lt, 0, 'First target should be lt=0');
    assert.equal(learnerTurnTargets[0].targetIdx, 0, 'First learner turn is at reconstructedTurns[0]');
  });

  it('buggy version drops first learner turn', () => {
    const { trace, turnResults } = make5TurnEgoSuperegoTrace();
    const learnerTurns = extractLearnerTurnsFromTrace(trace, true, []);
    const { learnerTurnTargets } = buildLearnerTurnTargets_BUGGY(learnerTurns, turnResults);

    assert.equal(learnerTurnTargets.length, 4, 'Buggy version drops first learner turn');
    assert.equal(learnerTurnTargets[0].lt, 1, 'Buggy version starts at lt=1, missing lt=0');
  });

  it('scores all learner turns in 3-turn unified dialogue', () => {
    const { trace, turnResults } = make3TurnUnifiedTrace();
    const learnerTurns = extractLearnerTurnsFromTrace(trace, false, []);
    const { learnerTurnTargets } = buildLearnerTurnTargets(learnerTurns, turnResults);

    assert.equal(learnerTurnTargets.length, 3, 'All 3 learner turns should be targeted');
    assert.equal(learnerTurnTargets[0].targetIdx, 0, 'First learner at index 0');
  });

  it('handles single learner turn', () => {
    const { trace, turnResults } = make1TurnTrace();
    const learnerTurns = extractLearnerTurnsFromTrace(trace, false, []);
    const { learnerTurnTargets } = buildLearnerTurnTargets(learnerTurns, turnResults);

    assert.equal(learnerTurnTargets.length, 1, 'Single learner turn should be targeted');
    assert.equal(learnerTurnTargets[0].targetIdx, 0, 'Only learner turn at index 0');
  });

  it('reconstructedTurns interleaves learner and tutor correctly', () => {
    const { trace, turnResults } = make3TurnUnifiedTrace();
    const learnerTurns = extractLearnerTurnsFromTrace(trace, false, []);
    const { reconstructedTurns } = buildLearnerTurnTargets(learnerTurns, turnResults);

    // 3 learner + 3 tutor = 6 entries (turnResults[1..3] for tutor)
    assert.equal(reconstructedTurns.length, 6);
    assert.equal(reconstructedTurns[0].phase, 'learner');
    assert.equal(reconstructedTurns[1].phase, 'tutor');
    assert.equal(reconstructedTurns[2].phase, 'learner');
    assert.equal(reconstructedTurns[3].phase, 'tutor');
  });

  it('target indices are correct for all learner turns', () => {
    const { trace, turnResults } = make3TurnUnifiedTrace();
    const learnerTurns = extractLearnerTurnsFromTrace(trace, false, []);
    const { learnerTurnTargets, reconstructedTurns } = buildLearnerTurnTargets(learnerTurns, turnResults);

    for (const { lt, targetIdx } of learnerTurnTargets) {
      const entry = reconstructedTurns[targetIdx];
      assert.equal(entry.phase, 'learner', `Target at index ${targetIdx} should be a learner entry`);
      assert.equal(
        entry.externalMessage,
        learnerTurns[lt].externalMessage,
        `Target message should match learnerTurns[${lt}]`,
      );
    }
  });

  it('handles empty trace gracefully', () => {
    const learnerTurns = extractLearnerTurnsFromTrace([], false, []);
    const { learnerTurnTargets } = buildLearnerTurnTargets(learnerTurns, []);

    assert.equal(learnerTurnTargets.length, 0);
  });
});
