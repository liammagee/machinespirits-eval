// Offline integration tests for per-physical-attempt budget wiring in
// adaptiveTutor.realLLM. Every transport is injected; these tests never call a
// provider, spawn a model CLI, use the network, or wait through real backoff.

import { after, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

const TEST_ENV_KEYS = [
  'OPENROUTER_API_KEY',
  'ADAPTIVE_TUTOR_PROVIDER',
  'ADAPTIVE_TUTOR_MODEL',
  'ADAPTIVE_TUTOR_MAX_TOKENS',
];
const originalEnv = new Map(TEST_ENV_KEYS.map((key) => [key, process.env[key]]));

// getProviderConfig checks configuration before the injected transport seam is
// reached. This sentinel is deliberately not a real credential.
process.env.OPENROUTER_API_KEY = 'offline-budget-wiring-test-key';

const realLLM = await import('../adaptiveTutor/realLLM.js');
const { createBudgetTracker } = await import('../adaptiveTutor/budgetTracker.js');

const KNOWN_MODEL = 'anthropic/claude-sonnet-4.6';
const VALID_EGO_CONTENT = JSON.stringify({
  policyAction: 'provide_hint',
  text: 'Try the next step yourself.',
  rationale: 'A small scaffold preserves learner agency.',
});
const VALID_SUPEREGO_REVISE_CONTENT = JSON.stringify({
  newSystemPrompt: 'Ask one diagnostic question and wait for the learner.',
  detectedFrustrationSignal: 'The learner says they are stuck.',
  correctiveDirective: 'Reduce the step size.',
});
const EGO_PAYLOAD = {
  learnerLastMessage: 'I am stuck.',
  learnerProfile: {
    misconceptions: [],
    confidence: 0.5,
    agencySignal: 'unknown',
    zpdEstimate: '',
    lastEvidence: '',
  },
};

const COST_MISSING = Symbol('cost-missing');

function setRoute({ provider = 'openrouter', model = 'sonnet', maxTokens = 32 } = {}) {
  process.env.ADAPTIVE_TUTOR_PROVIDER = provider;
  process.env.ADAPTIVE_TUTOR_MODEL = model;
  process.env.ADAPTIVE_TUTOR_MAX_TOKENS = String(maxTokens);
}

function makeUnifiedResponse({
  content = VALID_EGO_CONTENT,
  inputTokens = 100,
  outputTokens = 20,
  cost = COST_MISSING,
  provider = 'openrouter',
  model = KNOWN_MODEL,
} = {}) {
  const usage = { inputTokens, outputTokens };
  if (cost !== COST_MISSING) usage.cost = cost;
  return { content, provider, model, latencyMs: 1, usage };
}

function makeTracker({ maxUsd = 1, runId = 'real-llm-budget-test' } = {}) {
  let sequence = 0;
  return createBudgetTracker({
    maxUsd,
    runId,
    idFactory: () => `${runId}-attempt-${++sequence}`,
  });
}

function withEvents(tracker, events) {
  return {
    reserveAttempt(args) {
      const reservation = tracker.reserveAttempt(args);
      events.push(`reserve:${reservation.attemptId || 'not-metered'}`);
      return reservation;
    },
    settleAttempt(reservation, result) {
      events.push(`settle:${reservation.attemptId || 'not-metered'}`);
      return tracker.settleAttempt(reservation, result);
    },
    markAttemptAmbiguous(reservation, details) {
      events.push(`ambiguous:${reservation.attemptId || 'not-metered'}`);
      return tracker.markAttemptAmbiguous(reservation, details);
    },
  };
}

afterEach(() => {
  realLLM.clearActiveBudgetTracker();
  realLLM.clearActiveCellConfig();
  realLLM.resetRealLLMTestDependencies();
  for (const key of TEST_ENV_KEYS.slice(1)) {
    const previous = originalEnv.get(key);
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

after(() => {
  for (const key of TEST_ENV_KEYS) {
    const previous = originalEnv.get(key);
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

test('reservation denial happens before the first mocked provider dispatch', async () => {
  setRoute();
  const tracker = makeTracker({ maxUsd: 0.000001, runId: 'denied-before-dispatch' });
  let dispatches = 0;
  realLLM.setActiveBudgetTracker(tracker);
  realLLM.setRealLLMTestDependencies({
    unifiedCall: async () => {
      dispatches += 1;
      throw new Error('injected transport must not be reached');
    },
  });

  await assert.rejects(
    () => realLLM.callRole('tutorEgoInitial', EGO_PAYLOAD),
    (error) => error?.code === 'BUDGET_EXCEEDED',
  );
  assert.equal(dispatches, 0);
  assert.equal(tracker.summary().attemptCount, 0);
});

test('a retry gets a fresh reservation after the failed attempt is durably ambiguous', async () => {
  setRoute();
  const events = [];
  const tracker = makeTracker({ runId: 'physical-retry-reservations' });
  let dispatches = 0;
  realLLM.setActiveBudgetTracker(withEvents(tracker, events));
  realLLM.setRealLLMTestDependencies({
    unifiedCall: async () => {
      dispatches += 1;
      events.push(`dispatch:${dispatches}`);
      if (dispatches === 1) throw new Error('503 injected upstream failure');
      return makeUnifiedResponse({ cost: 0.002 });
    },
    sleep: async (delayMs) => events.push(`sleep:${delayMs}`),
    random: () => 0,
  });

  const result = await realLLM.callRole('tutorEgoInitial', EGO_PAYLOAD);
  assert.equal(result.policyAction, 'provide_hint');
  assert.deepEqual(events, [
    'reserve:physical-retry-reservations-attempt-1',
    'dispatch:1',
    'ambiguous:physical-retry-reservations-attempt-1',
    'sleep:500',
    'reserve:physical-retry-reservations-attempt-2',
    'dispatch:2',
    'settle:physical-retry-reservations-attempt-2',
  ]);
  const summary = tracker.summary();
  assert.deepEqual(
    {
      attempts: summary.attemptCount,
      ambiguous: summary.ambiguousCount,
      settled: summary.settledCount,
    },
    { attempts: 2, ambiguous: 1, settled: 1 },
  );
});

test('a settlement persistence failure is terminal and never redispatches', async () => {
  setRoute();
  let dispatches = 0;
  let reservations = 0;
  const persistenceError = Object.assign(new Error('ledger persistence failed near SQLite 503'), {
    code: 'BUDGET_LEDGER_PERSISTENCE',
  });
  realLLM.setActiveBudgetTracker({
    reserveAttempt() {
      reservations += 1;
      return { metered: true, attemptId: `settle-failure-${reservations}` };
    },
    settleAttempt() {
      throw persistenceError;
    },
    markAttemptAmbiguous() {
      assert.fail('a successful provider response must not be reclassified as a transport failure');
    },
  });
  realLLM.setRealLLMTestDependencies({
    unifiedCall: async () => {
      dispatches += 1;
      return makeUnifiedResponse({ cost: 0.001 });
    },
    sleep: async () => assert.fail('ledger failures must not enter transport backoff'),
  });

  await assert.rejects(() => realLLM.callRole('tutorEgoInitial', EGO_PAYLOAD), persistenceError);
  assert.equal(dispatches, 1);
  assert.equal(reservations, 1);
});

test('an ambiguous-attempt persistence failure is terminal before transport retry', async () => {
  setRoute();
  let dispatches = 0;
  const persistenceError = Object.assign(new Error('ambiguous write failed with 500'), {
    code: 'BUDGET_LEDGER_PERSISTENCE',
  });
  realLLM.setActiveBudgetTracker({
    reserveAttempt: () => ({ metered: true, attemptId: 'ambiguous-write-failure' }),
    settleAttempt: () => assert.fail('failed provider response cannot settle'),
    markAttemptAmbiguous: () => {
      throw persistenceError;
    },
  });
  realLLM.setRealLLMTestDependencies({
    unifiedCall: async () => {
      dispatches += 1;
      throw new Error('503 injected provider failure');
    },
    sleep: async () => assert.fail('failed ambiguity persistence must stop before backoff'),
  });

  await assert.rejects(() => realLLM.callRole('tutorEgoInitial', EGO_PAYLOAD), persistenceError);
  assert.equal(dispatches, 1);
});

test('provider-reported numeric zero is settled as reported, not treated as missing', async () => {
  setRoute();
  const tracker = makeTracker({ runId: 'reported-zero' });
  let settlementArgs;
  realLLM.setActiveBudgetTracker({
    reserveAttempt: (args) => tracker.reserveAttempt(args),
    markAttemptAmbiguous: (reservation, details) => tracker.markAttemptAmbiguous(reservation, details),
    settleAttempt(reservation, args) {
      settlementArgs = args;
      return tracker.settleAttempt(reservation, args);
    },
  });
  realLLM.setRealLLMTestDependencies({
    unifiedCall: async () => makeUnifiedResponse({ cost: 0 }),
  });

  await realLLM.callRole('tutorEgoInitial', EGO_PAYLOAD);
  assert.equal(settlementArgs.reportedCostPresent, true);
  assert.equal(settlementArgs.reportedCost, 0);
  assert.equal(settlementArgs.provider, 'openrouter');
  assert.equal(settlementArgs.model, KNOWN_MODEL);
  assert.equal(settlementArgs.tokenUsagePresent, true);
  const summary = tracker.summary();
  assert.equal(summary.settledCount, 1);
  assert.equal(summary.providerReportedUsd, 0);
  assert.equal(summary.catalogEstimatedUsd, 0);
});

test('missing cost for a known observed route/model becomes a provenance-labelled catalog estimate', async () => {
  setRoute();
  const tracker = makeTracker({ runId: 'known-rate-estimate' });
  let settlementArgs;
  realLLM.setActiveBudgetTracker({
    reserveAttempt: (args) => tracker.reserveAttempt(args),
    markAttemptAmbiguous: (reservation, details) => tracker.markAttemptAmbiguous(reservation, details),
    settleAttempt(reservation, args) {
      settlementArgs = args;
      return tracker.settleAttempt(reservation, args);
    },
  });
  realLLM.setRealLLMTestDependencies({
    unifiedCall: async () => makeUnifiedResponse(),
  });

  await realLLM.callRole('tutorEgoInitial', EGO_PAYLOAD);
  assert.equal(settlementArgs.reportedCostPresent, false);
  assert.equal(settlementArgs.reportedCost, null);
  assert.equal(settlementArgs.provider, 'openrouter');
  assert.equal(settlementArgs.model, KNOWN_MODEL);
  const summary = tracker.summary();
  assert.equal(summary.settledCount, 1);
  assert.equal(summary.providerReportedUsd, 0);
  assert.ok(Math.abs(summary.catalogEstimatedUsd - 0.0006) < 1e-12);
  assert.equal(summary.ambiguousCount, 0);
});

test('missing cost for an unknown observed model stays unresolved rather than becoming exact spend', async () => {
  setRoute();
  const tracker = makeTracker({ runId: 'unknown-rate-unresolved' });
  realLLM.setActiveBudgetTracker(tracker);
  realLLM.setRealLLMTestDependencies({
    unifiedCall: async () => makeUnifiedResponse({ model: 'vendor/model-with-no-catalog-rate' }),
  });

  const result = await realLLM.callRole('tutorEgoInitial', EGO_PAYLOAD);
  assert.equal(result.policyAction, 'provide_hint');
  const summary = tracker.summary();
  assert.equal(summary.settledCount, 0);
  assert.equal(summary.ambiguousCount, 1);
  assert.equal(summary.providerReportedUsd, 0);
  assert.equal(summary.catalogEstimatedUsd, 0);
  assert.equal(summary.conservativeBoundUsd, 0);
  assert.ok(summary.ambiguousExposureUsd > 0);
});

test('missing cost and partial token usage retains the catalog-model reservation', async () => {
  setRoute();
  const tracker = makeTracker({ runId: 'missing-cost-and-usage' });
  realLLM.setActiveBudgetTracker(tracker);
  realLLM.setRealLLMTestDependencies({
    unifiedCall: async () => makeUnifiedResponse({ inputTokens: 100, outputTokens: 0 }),
  });

  const result = await realLLM.callRole('tutorEgoInitial', EGO_PAYLOAD);
  assert.equal(result.policyAction, 'provide_hint');
  const summary = tracker.summary();
  assert.equal(summary.settledCount, 0);
  assert.equal(summary.ambiguousCount, 1);
  assert.equal(summary.catalogEstimatedUsd, 0);
  assert.ok(summary.ambiguousExposureUsd > 0);
});

test('subscription CLI route is durably counted without dollar exposure', async () => {
  setRoute({ provider: 'codex', model: 'gpt-5.6-luna' });
  const tracker = makeTracker({ maxUsd: 0.000000001, runId: 'not-metered-here' });
  let cliDispatches = 0;
  let unifiedDispatches = 0;
  realLLM.setActiveBudgetTracker(tracker);
  realLLM.setRealLLMTestDependencies({
    adaptiveCliCall: async () => {
      cliDispatches += 1;
      return {
        text: VALID_EGO_CONTENT,
        provider: 'codex',
        model: 'gpt-5.6-luna',
        inputTokens: 0,
        outputTokens: 0,
        cost: null,
      };
    },
    unifiedCall: async () => {
      unifiedDispatches += 1;
      throw new Error('unified provider must not be used for a CLI route');
    },
  });

  const result = await realLLM.callRole('tutorEgoInitial', EGO_PAYLOAD);
  assert.equal(result.policyAction, 'provide_hint');
  assert.equal(cliDispatches, 1);
  assert.equal(unifiedDispatches, 0);
  assert.equal(tracker.summary().attemptCount, 1);
  assert.equal(tracker.summary().settledCount, 1);
  assert.equal(tracker.summary().notMeteredCount, 1);
  assert.equal(tracker.summary().ceilingExposureUsd, 0);
});

test('superego format-correction re-call gets its own reservation and settlement', async () => {
  setRoute();
  const events = [];
  const tracker = makeTracker({ runId: 'corrective-recall' });
  let dispatches = 0;
  realLLM.setActiveBudgetTracker(withEvents(tracker, events));
  realLLM.setRealLLMTestDependencies({
    unifiedCall: async (request) => {
      dispatches += 1;
      events.push(`dispatch:${dispatches}`);
      if (dispatches === 1) {
        return makeUnifiedResponse({ content: 'This is prose, not JSON.', cost: 0.001 });
      }
      assert.match(request.messages[0].content, /FORMAT CORRECTION/);
      return makeUnifiedResponse({ content: VALID_SUPEREGO_REVISE_CONTENT, cost: 0.002 });
    },
  });

  const result = await realLLM.callRole('superegoRevise', {
    dialogue: [{ role: 'learner', content: 'I am stuck.' }],
    turn: 1,
    priorLedger: [],
    cumulative: false,
  });
  assert.equal(result.correctiveDirective, 'Reduce the step size.');
  assert.deepEqual(events, [
    'reserve:corrective-recall-attempt-1',
    'dispatch:1',
    'settle:corrective-recall-attempt-1',
    'reserve:corrective-recall-attempt-2',
    'dispatch:2',
    'settle:corrective-recall-attempt-2',
  ]);
  assert.equal(tracker.summary().attemptCount, 2);
  assert.equal(tracker.summary().settledCount, 2);
  assert.ok(Math.abs(tracker.summary().providerReportedUsd - 0.003) < 1e-12);
});

test('budget tracker binding helpers still round-trip', () => {
  assert.equal(realLLM.getActiveBudgetTracker(), null);
  const tracker = makeTracker({ runId: 'binding-round-trip' });
  realLLM.setActiveBudgetTracker(tracker);
  assert.equal(realLLM.getActiveBudgetTracker(), tracker);
  realLLM.clearActiveBudgetTracker();
  assert.equal(realLLM.getActiveBudgetTracker(), null);
});
