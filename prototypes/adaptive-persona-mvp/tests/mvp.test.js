import assert from 'node:assert/strict';
import { test } from 'node:test';
import { updateMastery } from '../src/knowledgeTracing.js';
import { runAll } from '../src/harness.js';

test('BKT-lite moves mastery in expected directions', () => {
  const prior = 0.5;
  assert.ok(updateMastery(prior, 'correct') > prior);
  assert.ok(updateMastery(prior, 'incorrect') < prior);
  assert.ok(updateMastery(prior, 'unobserved') <= prior);
});

test('polite false mastery branches into teach-back vs transfer challenge', () => {
  const [result] = runAll({ scenarioId: 'polite_false_mastery_kt' });
  const t1 = result.turns.find((turn) => turn.eventId === 't1');
  assert.equal(t1.policy.selectedPolicy, 'teach_back');
  assert.equal(result.counterfactualComparison.policyDiverged, true);
  assert.equal(result.counterfactualComparison.counterfactualPolicy, 'transfer_challenge');
});

test('repair scenario names misrecognition before proceeding', () => {
  const [result] = runAll({ scenarioId: 'misrecognition_repair' });
  const t0 = result.turns[0];
  assert.equal(t0.policy.selectedPolicy, 'repair_misrecognition');
  assert.match(t0.tutorMessage, /misread|reset/i);
});

test('all scenarios produce scored traces', () => {
  const results = runAll();
  assert.ok(results.length >= 3);
  for (const result of results) {
    assert.ok(result.evaluation.weightedScore >= 0);
    assert.ok(result.evaluation.weightedScore <= 100);
  }
});
