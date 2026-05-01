// Integration test for the budget gate inside realLLM.callRole.
//
// Verifies the gate fires BEFORE any callAI() invocation when the
// estimated cost of even one call exceeds the configured ceiling. This
// is the wiring smoke for Phase 1 §1: a regression that disconnects
// setActiveBudgetTracker from realLLM, or removes the assertBelowCeiling
// hook, would let this test pass through to a real API call (which
// would in turn try to use the fake key below and surface a different
// error, failing the assertion).
//
// No API call is issued — the gate trips first.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// providerConfig.isConfigured needs an env var. Real key isn't required
// because the budget gate fires before callAI is invoked.
if (!process.env.OPENROUTER_API_KEY) {
  process.env.OPENROUTER_API_KEY = 'fake-key-for-budget-gate-test';
}

const realLLM = await import('../adaptiveTutor/realLLM.js');
const { createBudgetTracker } = await import('../adaptiveTutor/budgetTracker.js');

test('callRole budget gate trips before callAI when ceiling is below per-call estimate', async () => {
  // 0.000001 USD is below any per-call estimate, so the very first call
  // is rejected.
  const tracker = createBudgetTracker({ maxUsd: 0.000001 });
  realLLM.setActiveBudgetTracker(tracker);
  try {
    await assert.rejects(
      () => realLLM.callRole('tutorEgoInitial', {
        learnerLastMessage: 'hello',
        learnerProfile: {
          misconceptions: [],
          confidence: 0.5,
          agencySignal: 'unknown',
          zpdEstimate: '',
          lastEvidence: '',
        },
      }),
      (err) => {
        assert.equal(err.code, 'BUDGET_EXCEEDED');
        assert.match(err.message, /BudgetExceeded/);
        return true;
      },
    );
    // Gate fired before callAI, so no recorded calls
    assert.equal(tracker.callCount, 0);
    assert.equal(tracker.accumulatedUsd, 0);
  } finally {
    realLLM.clearActiveBudgetTracker();
  }
});

test('setActiveBudgetTracker / getActiveBudgetTracker / clearActiveBudgetTracker round-trip', () => {
  assert.equal(realLLM.getActiveBudgetTracker(), null);
  const tracker = createBudgetTracker({ maxUsd: 1.0 });
  realLLM.setActiveBudgetTracker(tracker);
  assert.equal(realLLM.getActiveBudgetTracker(), tracker);
  realLLM.clearActiveBudgetTracker();
  assert.equal(realLLM.getActiveBudgetTracker(), null);
});
