import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBudgetTracker,
  BudgetExceededError,
} from '../adaptiveTutor/budgetTracker.js';

test('createBudgetTracker rejects invalid maxUsd', () => {
  assert.throws(() => createBudgetTracker({}), /maxUsd/);
  assert.throws(() => createBudgetTracker({ maxUsd: 0 }), /maxUsd/);
  assert.throws(() => createBudgetTracker({ maxUsd: -5 }), /maxUsd/);
  assert.throws(() => createBudgetTracker({ maxUsd: 'five' }), /maxUsd/);
});

test('record() accumulates cost from each call', () => {
  const tracker = createBudgetTracker({ maxUsd: 1.0 });
  assert.equal(tracker.accumulatedUsd, 0);
  assert.equal(tracker.callCount, 0);

  tracker.record({ inputTokens: 100, outputTokens: 50, cost: 0.005 });
  assert.equal(tracker.callCount, 1);
  assert.ok(Math.abs(tracker.accumulatedUsd - 0.005) < 1e-9);

  tracker.record({ inputTokens: 200, outputTokens: 100, cost: 0.012 });
  assert.equal(tracker.callCount, 2);
  assert.ok(Math.abs(tracker.accumulatedUsd - 0.017) < 1e-9);
});

test('estimate() returns positive USD for known model', () => {
  const tracker = createBudgetTracker({ maxUsd: 5.0 });
  // ~400 chars ≈ 100 tokens input; 1000 tokens output reservation
  const est = tracker.estimate(
    'x'.repeat(400),
    1000,
    'anthropic/claude-sonnet-4.6',
  );
  // sonnet input rate 0.003/1k, output 0.015/1k → 0.0003 + 0.015 = 0.0153
  assert.ok(est > 0.014 && est < 0.017, `estimate ${est} out of expected band`);
});

test('estimate() falls back to conservative default for unknown model', () => {
  const tracker = createBudgetTracker({ maxUsd: 5.0 });
  const est = tracker.estimate('x'.repeat(400), 1000, 'unknown/some-model');
  // default 0.01/0.03 → 100 in (0.001) + 1000 out (0.03) = 0.031
  assert.ok(est > 0.029 && est < 0.033, `default-rate estimate ${est} out of band`);
});

test('assertBelowCeiling() throws BudgetExceededError when projected exceeds ceiling', () => {
  const tracker = createBudgetTracker({ maxUsd: 0.10 });
  tracker.record({ inputTokens: 1000, outputTokens: 1000, cost: 0.08 });

  // Estimate that would push us over
  assert.throws(
    () => tracker.assertBelowCeiling(0.05),
    (err) => {
      assert.ok(err instanceof BudgetExceededError);
      assert.equal(err.code, 'BUDGET_EXCEEDED');
      assert.equal(err.maxUsd, 0.10);
      assert.equal(err.accumulatedUsd, 0.08);
      assert.equal(err.estimateUsd, 0.05);
      return true;
    },
  );
});

test('assertBelowCeiling() permits calls that fit under ceiling', () => {
  const tracker = createBudgetTracker({ maxUsd: 0.10 });
  tracker.record({ inputTokens: 1000, outputTokens: 1000, cost: 0.05 });
  // 0.05 + 0.04 = 0.09, under 0.10
  assert.doesNotThrow(() => tracker.assertBelowCeiling(0.04));
});

test('assertBelowCeiling() trips on the very first call when estimate alone exceeds ceiling', () => {
  const tracker = createBudgetTracker({ maxUsd: 0.01 });
  // Sonnet pre-call estimate for a long prompt exceeds 0.01
  const est = tracker.estimate('x'.repeat(4000), 4000, 'anthropic/claude-sonnet-4.6');
  assert.throws(
    () => tracker.assertBelowCeiling(est),
    BudgetExceededError,
  );
});

test('summary() reports totals and utilization', () => {
  const tracker = createBudgetTracker({ maxUsd: 1.0 });
  tracker.record({ inputTokens: 100, outputTokens: 50, cost: 0.20 });
  tracker.record({ inputTokens: 300, outputTokens: 150, cost: 0.30 });
  const s = tracker.summary();
  assert.equal(s.callCount, 2);
  assert.equal(s.totalInputTokens, 400);
  assert.equal(s.totalOutputTokens, 200);
  assert.ok(Math.abs(s.accumulatedUsd - 0.50) < 1e-9);
  assert.ok(Math.abs(s.utilizationPct - 50.0) < 1e-9);
});

test('record() tolerates missing/null fields without exploding', () => {
  const tracker = createBudgetTracker({ maxUsd: 1.0 });
  assert.doesNotThrow(() => tracker.record({}));
  assert.doesNotThrow(() => tracker.record({ cost: null }));
  assert.doesNotThrow(() => tracker.record({ inputTokens: undefined, cost: 0.001 }));
  assert.equal(tracker.callCount, 3);
  assert.ok(Math.abs(tracker.accumulatedUsd - 0.001) < 1e-9);
});
