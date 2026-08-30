import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BudgetExceededError,
  BudgetPersistenceError,
  createBudgetTracker,
  lookupRateQuote,
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
  const est = tracker.estimate('x'.repeat(400), 1000, 'anthropic/claude-sonnet-4.6');
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
  const tracker = createBudgetTracker({ maxUsd: 0.1 });
  tracker.record({ inputTokens: 1000, outputTokens: 1000, cost: 0.08 });

  // Estimate that would push us over
  assert.throws(
    () => tracker.assertBelowCeiling(0.05),
    (err) => {
      assert.ok(err instanceof BudgetExceededError);
      assert.equal(err.code, 'BUDGET_EXCEEDED');
      assert.equal(err.maxUsd, 0.1);
      assert.equal(err.accumulatedUsd, 0.08);
      assert.equal(err.estimateUsd, 0.05);
      return true;
    },
  );
});

test('assertBelowCeiling() permits calls that fit under ceiling', () => {
  const tracker = createBudgetTracker({ maxUsd: 0.1 });
  tracker.record({ inputTokens: 1000, outputTokens: 1000, cost: 0.05 });
  // 0.05 + 0.04 = 0.09, under 0.10
  assert.doesNotThrow(() => tracker.assertBelowCeiling(0.04));
});

test('assertBelowCeiling() trips on the very first call when estimate alone exceeds ceiling', () => {
  const tracker = createBudgetTracker({ maxUsd: 0.01 });
  // Sonnet pre-call estimate for a long prompt exceeds 0.01
  const est = tracker.estimate('x'.repeat(4000), 4000, 'anthropic/claude-sonnet-4.6');
  assert.throws(() => tracker.assertBelowCeiling(est), BudgetExceededError);
});

test('summary() reports totals and utilization', () => {
  const tracker = createBudgetTracker({ maxUsd: 1.0 });
  tracker.record({ inputTokens: 100, outputTokens: 50, cost: 0.2 });
  tracker.record({ inputTokens: 300, outputTokens: 150, cost: 0.3 });
  const s = tracker.summary();
  assert.equal(s.callCount, 2);
  assert.equal(s.totalInputTokens, 400);
  assert.equal(s.totalOutputTokens, 200);
  assert.ok(Math.abs(s.accumulatedUsd - 0.5) < 1e-9);
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

test('rate quotes distinguish catalog estimates, unknown-model guards, and non-metered routes', () => {
  const catalog = lookupRateQuote({
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4.6',
  });
  assert.equal(catalog.status, 'catalog');
  assert.deepEqual(catalog.ratesPer1k, { input: 0.003, output: 0.015 });
  assert.equal(catalog.provenance.rateBasis, 'catalog_estimate');
  assert.equal(catalog.provenance.provider, 'openrouter');
  assert.equal(catalog.provenance.model, 'anthropic/claude-sonnet-4.6');
  assert.deepEqual(catalog.provenance.ratesPer1k, { input: 0.003, output: 0.015 });
  assert.equal(catalog.provenance.verificationStatus, 'operator_snapshot_not_runtime_verified');
  assert.match(catalog.provenance.sourceUrl, /^https:\/\//u);

  const unknown = lookupRateQuote({ provider: 'openrouter', model: 'unlisted/model' });
  assert.equal(unknown.status, 'unknown');
  assert.equal(unknown.ratesPer1k, null);
  assert.deepEqual(unknown.guardRatesPer1k, { input: 0.01, output: 0.03 });
  assert.equal(unknown.provenance.rateBasis, 'conservative_bound');
  assert.deepEqual(unknown.provenance.guardRatesPer1k, { input: 0.01, output: 0.03 });
  assert.match(unknown.provenance.note, /not actual spend/u);

  const subscription = lookupRateQuote({ provider: 'codex', model: 'configured-default' });
  assert.equal(subscription.status, 'not_metered_here');
  assert.equal(subscription.ratesPer1k, null);
  assert.equal(subscription.guardRatesPer1k, null);
  assert.equal(subscription.provenance.provider, 'codex');
  assert.equal(subscription.provenance.model, 'configured-default');
});

test('a provider-reported numeric zero settles distinctly from missing cost', () => {
  const tracker = createBudgetTracker({
    maxUsd: 1,
    idFactory: () => 'provider-zero',
  });
  const reservation = tracker.reserveAttempt({
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4.6',
    role: 'tutorEgoInitial',
    promptText: 'x'.repeat(400),
    maxOutputTokens: 1000,
  });
  assert.equal(tracker.summary().pendingCount, 1);
  assert.ok(reservation.reservedUsd > 0);

  const settlement = tracker.settleAttempt(reservation, {
    inputTokens: 100,
    outputTokens: 20,
    reportedCostPresent: true,
    reportedCost: 0,
  });
  assert.equal(settlement.usd, 0);
  assert.equal(settlement.basis, 'provider_reported');
  assert.equal(tracker.summary().pendingCount, 0);
  assert.equal(tracker.summary().providerReportedUsd, 0);
  assert.equal(tracker.summary().ceilingExposureUsd, 0);
});

test('missing cost uses a labelled catalog estimate, never provider-reported exactness', () => {
  const tracker = createBudgetTracker({ maxUsd: 1, idFactory: () => 'catalog-settlement' });
  const reservation = tracker.reserveAttempt({
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4.6',
    role: 'learnerTurn',
    promptText: 'prompt',
    maxOutputTokens: 100,
  });
  const settlement = tracker.settleAttempt(reservation, {
    inputTokens: 100,
    outputTokens: 20,
    reportedCostPresent: false,
  });

  assert.equal(settlement.basis, 'catalog_estimate');
  assert.ok(settlement.usd > 0);
  assert.equal(settlement.provenance.verificationStatus, 'operator_snapshot_not_runtime_verified');
  assert.equal(tracker.summary().catalogEstimatedUsd, settlement.usd);
  assert.equal(tracker.summary().providerReportedUsd, 0);
});

test('missing cost for an unknown model remains unresolved and conservatively charged', () => {
  const tracker = createBudgetTracker({ maxUsd: 1, idFactory: () => 'unknown-rate' });
  const reservation = tracker.reserveAttempt({
    provider: 'openrouter',
    model: 'unlisted/model',
    role: 'tutorSuperego',
    promptText: 'prompt',
    maxOutputTokens: 100,
  });
  const settlement = tracker.settleAttempt(reservation, {
    inputTokens: 10,
    outputTokens: 5,
    reportedCostPresent: false,
  });

  assert.equal(settlement.usd, null);
  assert.equal(settlement.basis, 'unresolved');
  assert.equal(settlement.ceilingExposureUsd, reservation.reservedUsd);
  assert.equal(tracker.summary().ambiguousCount, 1);
  assert.equal(tracker.summary().ambiguousExposureUsd, reservation.reservedUsd);
  assert.equal(tracker.summary().ceilingExposureUsd, reservation.reservedUsd);
});

test('missing cost and token usage retains the full reservation even for a catalog model', () => {
  const tracker = createBudgetTracker({ maxUsd: 1, idFactory: () => 'missing-usage' });
  const reservation = tracker.reserveAttempt({
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4.6',
    role: 'tutorValidator',
    promptText: 'prompt',
    maxOutputTokens: 100,
  });
  const settlement = tracker.settleAttempt(reservation, {
    inputTokens: 0,
    outputTokens: 0,
    tokenUsagePresent: false,
    reportedCostPresent: false,
  });

  assert.equal(settlement.basis, 'unresolved');
  assert.equal(tracker.summary().settledCount, 0);
  assert.equal(tracker.summary().ambiguousCount, 1);
  assert.equal(tracker.summary().ceilingExposureUsd, reservation.reservedUsd);
});

test('not-metered-here activity is durably counted without consuming dollar headroom', () => {
  const tracker = createBudgetTracker({ maxUsd: 0.000001, idFactory: () => 'subscription-attempt' });
  const reservation = tracker.reserveAttempt({
    provider: 'codex',
    model: 'gpt-5.6-luna',
    role: 'tutorEgoInitial',
    promptText: 'prompt',
    maxOutputTokens: 100,
  });
  assert.equal(reservation.metered, false);
  assert.equal(reservation.attemptId, 'subscription-attempt');
  assert.equal(tracker.summary().pendingCount, 1);

  const settlement = tracker.settleAttempt(reservation, {
    inputTokens: 0,
    outputTokens: 0,
    tokenUsagePresent: false,
    reportedCostPresent: false,
  });
  assert.equal(settlement.basis, 'not_metered_here');
  assert.equal(tracker.summary().attemptCount, 1);
  assert.equal(tracker.summary().settledCount, 1);
  assert.equal(tracker.summary().notMeteredCount, 1);
  assert.equal(tracker.summary().ceilingExposureUsd, 0);
});

test('an above-ceiling settlement is recorded before raising a terminal budget halt', () => {
  const tracker = createBudgetTracker({ maxUsd: 0.01, idFactory: () => 'provider-overage' });
  const reservation = tracker.reserveAttempt({
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4.6',
    role: 'learnerTurn',
    promptText: 'short',
    maxOutputTokens: 1,
  });

  assert.throws(
    () =>
      tracker.settleAttempt(reservation, {
        inputTokens: 10,
        outputTokens: 1,
        reportedCostPresent: true,
        reportedCost: 0.02,
      }),
    (error) => error instanceof BudgetExceededError && error.code === 'BUDGET_EXCEEDED',
  );
  assert.equal(tracker.summary().settledCount, 1);
  assert.equal(tracker.summary().providerReportedUsd, 0.02);
  assert.equal(tracker.summary().ceilingExposureUsd, 0.02);
});

test('ledger write failure is a terminal safety error at reservation time', () => {
  const ledgerStore = {
    initializeBudgetLedger: () => ({}),
    reserveBudgetAttempt: () => {
      throw new Error('offline write failure');
    },
    settleBudgetAttempt: () => {},
    markBudgetAttemptAmbiguous: () => {},
    getBudgetSummary: () => ({ attemptCount: 0, ceilingExposureUsd: 0 }),
  };
  const tracker = createBudgetTracker({ maxUsd: 1, ledgerStore, idFactory: () => 'never-dispatched' });

  assert.throws(
    () =>
      tracker.reserveAttempt({
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4.6',
        role: 'tutorEgoInitial',
        promptText: 'prompt',
        maxOutputTokens: 100,
      }),
    (error) =>
      error instanceof BudgetPersistenceError &&
      error.code === 'BUDGET_LEDGER_PERSISTENCE' &&
      /reservation failed/u.test(error.message),
  );
});
