import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractReflectionActionPairs,
  computeTurnDrift,
  aggregateByCell,
  buildReport,
} from '../scripts/analyze-insight-action-gap.js';

function reflection(turn, text) {
  return {
    agent: 'ego_self_reflection',
    action: 'rewrite',
    turnIndex: turn,
    detail: text,
  };
}

function egoTurn(turn, message, action = 'generate') {
  return {
    agent: 'ego',
    action,
    turnIndex: turn,
    suggestions: [{ title: '', message, reasoning: '' }],
  };
}

function userTurn() {
  return { agent: 'user', action: 'context_input' };
}

test('extractReflectionActionPairs pairs reflection at turn N with same-turn final action', () => {
  const trace = [
    reflection(0, 'I will probe the learner about their misconception about fractions.'),
    egoTurn(0, 'Let me ask: what does denominator mean to you?'),
    reflection(1, 'Critic pushed for concrete examples — I should use a pizza analogy.'),
    egoTurn(1, 'Imagine a pizza cut into 8 slices — each slice is 1/8.'),
  ];

  const pairs = extractReflectionActionPairs(trace);
  assert.equal(pairs.length, 2);
  assert.equal(pairs[0].turn, 0);
  assert.match(pairs[0].action, /denominator/);
  assert.equal(pairs[1].turn, 1);
  assert.match(pairs[1].action, /pizza/);
});

test('extractReflectionActionPairs prefers the latest revise over earlier generate for the same turn', () => {
  const trace = [
    reflection(0, 'I will use a concrete analogy.'),
    egoTurn(0, 'A first draft message.', 'generate'),
    egoTurn(0, 'Revised: imagine a pizza.', 'revise'),
  ];
  const pairs = extractReflectionActionPairs(trace);
  assert.equal(pairs.length, 1);
  assert.match(pairs[0].action, /pizza/);
  assert.doesNotMatch(pairs[0].action, /first draft/);
});

test('extractReflectionActionPairs returns [] when reflection has no matching action turn', () => {
  const trace = [
    reflection(0, 'Just a reflection with no action.'),
  ];
  const pairs = extractReflectionActionPairs(trace);
  assert.deepEqual(pairs, []);
});

test('extractReflectionActionPairs tolerates missing trace', () => {
  assert.deepEqual(extractReflectionActionPairs(null), []);
  assert.deepEqual(extractReflectionActionPairs(undefined), []);
  assert.deepEqual(extractReflectionActionPairs([]), []);
});

test('computeTurnDrift returns N-1 drift values for N tutor turns', () => {
  const trace = [
    userTurn(),
    egoTurn(0, 'First turn message about denominators.'),
    userTurn(),
    egoTurn(1, 'Second turn message about denominators with a small change.'),
    userTurn(),
    egoTurn(2, 'Third turn — entirely different subject: pizza analogies.'),
  ];
  const drifts = computeTurnDrift(trace);
  assert.equal(drifts.length, 2);
  // Every drift is in [0, 1]
  for (const d of drifts) {
    assert.ok(d >= 0 && d <= 1, `drift out of range: ${d}`);
  }
  // Turn 1→2 swap of subject should drift more than turn 0→1 small change
  assert.ok(drifts[1] > drifts[0], `expected drift[1] (${drifts[1]}) > drift[0] (${drifts[0]})`);
});

test('extractReflectionActionPairs walks order rather than relying on turnIndex on ego', () => {
  // Real production traces leave ego.turnIndex undefined while reflections carry turnIndex.
  // Pair by trace order, not turnIndex.
  const trace = [
    { agent: 'ego_self_reflection', action: 'rewrite', turnIndex: 0, detail: 'will probe denominator misconception' },
    { agent: 'ego', action: 'generate', suggestions: [{ message: 'Let us examine what denominator means.' }] },
    { agent: 'ego_self_reflection', action: 'rewrite', turnIndex: 1, detail: 'use pizza analogy next turn' },
    { agent: 'ego', action: 'generate', suggestions: [{ message: 'Here is a pizza cut into 8 slices.' }] },
  ];
  const pairs = extractReflectionActionPairs(trace);
  assert.equal(pairs.length, 2);
  assert.match(pairs[0].action, /denominator/);
  assert.match(pairs[1].action, /pizza/);
});

test('aggregateByCell collapses pairs per profile and computes coupling/gap/drift', () => {
  const samples = [
    {
      profile: 'cell_40_base_dialectical_suspicious_unified_superego',
      pairs: [
        { turn: 0, reflection: 'pizza fractions denominator slices', action: 'pizza fractions denominator example' },
        { turn: 1, reflection: 'apples division equal sharing', action: 'apples division sharing equally' },
      ],
      drifts: [0.4, 0.6],
    },
    {
      profile: 'cell_41_recog_dialectical_suspicious_unified_superego',
      pairs: [
        { turn: 0, reflection: 'recognition mutual learner subject', action: 'recognition acknowledging the learner subject' },
      ],
      drifts: [0.3],
    },
  ];

  const summary = aggregateByCell(samples);
  assert.equal(summary.length, 2);

  const base = summary.find((s) => s.profile.startsWith('cell_40'));
  assert.equal(base.condition, 'base');
  assert.equal(base.reflectionPairs, 2);
  assert.ok(base.meanCoupling > 0.4 && base.meanCoupling <= 1, `coupling ${base.meanCoupling} not in expected range`);
  assert.equal(base.meanGap, 1 - base.meanCoupling);
  assert.equal(base.meanTurnDrift, 0.5);

  const recog = summary.find((s) => s.profile.startsWith('cell_41'));
  assert.equal(recog.condition, 'recog');
  assert.equal(recog.reflectionPairs, 1);
});

test('buildReport renders both base and recog rows when both have data', () => {
  const summary = [
    { profile: 'cell_40_base_dialectical_suspicious_unified_superego', condition: 'base', reflectionPairs: 10, driftSamples: 8, meanCoupling: 0.42, sdCoupling: 0.1, meanJaccard: 0.3, meanGap: 0.58, meanTurnDrift: 0.65, sdTurnDrift: 0.1, gapMinusDrift: -0.07 },
    { profile: 'cell_41_recog_dialectical_suspicious_unified_superego', condition: 'recog', reflectionPairs: 12, driftSamples: 9, meanCoupling: 0.55, sdCoupling: 0.1, meanJaccard: 0.4, meanGap: 0.45, meanTurnDrift: 0.7, sdTurnDrift: 0.1, gapMinusDrift: -0.25 },
  ];

  const report = buildReport({ runIds: ['eval-test'], summary, minPairs: 5 });
  assert.match(report, /Insight-Action Gap/);
  assert.match(report, /cell_40_base_dialectical_suspicious_unified_superego/);
  assert.match(report, /cell_41_recog_dialectical_suspicious_unified_superego/);
  assert.match(report, /Recognition contrast/);
  assert.match(report, /Cohen's d/);
});

test('buildReport degrades gracefully when no cells meet minPairs', () => {
  const summary = [
    { profile: 'cell_40_base_dialectical_suspicious_unified_superego', condition: 'base', reflectionPairs: 1, driftSamples: 0, meanCoupling: 0, sdCoupling: 0, meanJaccard: 0, meanGap: 1, meanTurnDrift: 0, sdTurnDrift: 0, gapMinusDrift: 1 },
  ];
  const report = buildReport({ runIds: ['eval-test'], summary, minPairs: 5 });
  assert.match(report, /No cells met the minimum-pairs threshold/);
});
