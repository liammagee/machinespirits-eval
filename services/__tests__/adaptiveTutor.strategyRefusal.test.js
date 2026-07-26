import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORTED_ARCHITECTURES } from '../adaptiveTutor/graph.js';
import { runAdaptiveStrategyRefusalSmoke } from '../../scripts/run-adaptive-strategy-refusal-smoke.js';

test('strategy-refusal architecture is an explicit adaptive-runner arm', () => {
  assert.ok(SUPPORTED_ARCHITECTURES.includes('state_policy_with_strategy_refusal'));
});

test('paired v1 trap smoke refuses one repeated policy without false activation', async () => {
  const report = await runAdaptiveStrategyRefusalSmoke();

  assert.equal(report.contract.llmMode, 'mock');
  assert.equal(report.contract.storageWrites, false);
  assert.equal(report.summary.scenarioCount, 3);
  assert.equal(report.summary.baselineStrictMatches, 0);
  assert.equal(report.summary.refusalStrictMatches, 1);
  assert.equal(report.summary.refusals, 1);
  assert.equal(report.summary.unresolved, 0);
  assert.equal(report.summary.falseActivations, 0);
  assert.equal(report.summary.pass, true);

  const activated = report.scenarios.find((row) => row.strategyRefusal?.status === 'resolved');
  assert.equal(activated.id, 'polite_false_mastery_v1');
  assert.equal(activated.strategyRefusal.previousAction, 'scope_test');
  assert.equal(activated.strategyRefusal.proposedAction, 'scope_test');
  assert.equal(activated.strategyRefusal.resolution, 'switch');
  assert.equal(activated.strategyRefusal.resolvedAction, 'ask_diagnostic_question');
  assert.equal(activated.refusalStrictMatch, true);

  const nonRepeats = report.scenarios.filter((row) => row.id !== activated.id);
  assert.ok(nonRepeats.every((row) => row.strategyRefusal?.status === 'not_required'));
  assert.ok(nonRepeats.every((row) => row.strategyRefusal.previousAction !== row.strategyRefusal.proposedAction));
});
