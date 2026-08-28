import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { createBudgetTracker } from '../services/adaptiveTutor/budgetTracker.js';
import { createEvaluationStore } from '../services/evaluationStore/createEvaluationStore.js';

const stores = [];
const tempDirs = [];

afterEach(() => {
  while (stores.length) stores.pop().close();
  while (tempDirs.length) fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
});

function createFixture(label) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), `evaluation-budget-${label}-`));
  tempDirs.push(rootDir);
  const databasePath = path.join(rootDir, 'data', 'evaluations.db');
  const logsRoot = path.join(rootDir, 'logs');
  let suffix = 0;

  function openStore() {
    const store = createEvaluationStore({
      rootDir,
      env: { EVAL_DB_PATH: databasePath, EVAL_LOGS_DIR: logsRoot },
      now: () => new Date('2026-08-27T12:00:00.000Z'),
      randomBytesFn: () => Buffer.alloc(4, ++suffix),
    });
    stores.push(store);
    return store;
  }

  return { databasePath, openStore, rootDir };
}

function reserve(store, runId, overrides = {}) {
  return store.reserveBudgetAttempt({
    runId,
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4.6',
    role: 'tutor',
    attemptId: 'attempt-1',
    reservedUsd: 0.25,
    reservedBasis: 'catalog_estimate',
    rateProvenance: {
      source: 'test-catalog',
      catalogVersion: 'offline-fixture-v1',
      inputUsdPerMillion: 3,
      outputUsdPerMillion: 15,
    },
    ...overrides,
  });
}

function expectPersistenceError(operation, reason, pattern) {
  assert.throws(operation, (error) => {
    assert.equal(error.code, 'BUDGET_LEDGER_PERSISTENCE');
    assert.equal(error.reason, reason);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
}

describe('evaluation budget repository', () => {
  it('initializes one immutable run ceiling, rejects unknown runs, and cascades run deletion', () => {
    const { openStore } = createFixture('initialize');
    const store = openStore();

    expectPersistenceError(
      () => store.initializeBudgetLedger({ runId: 'eval-missing', maxUsd: 1 }),
      'unknown_run',
      /Evaluation run not found/u,
    );

    const run = store.createRun({ description: 'budget initialization' });
    const initialized = store.initializeBudgetLedger({ runId: run.id, maxUsd: 1.5 });
    assert.deepEqual(
      {
        runId: initialized.runId,
        maxUsd: initialized.maxUsd,
        attemptCount: initialized.attemptCount,
        ceilingExposureUsd: initialized.ceilingExposureUsd,
      },
      { runId: run.id, maxUsd: 1.5, attemptCount: 0, ceilingExposureUsd: 0 },
    );

    assert.equal(store.initializeBudgetLedger({ runId: run.id, maxUsd: 1.5 }).maxUsd, 1.5);
    expectPersistenceError(
      () => store.initializeBudgetLedger({ runId: run.id, maxUsd: 1.51 }),
      'ceiling_mismatch',
      /persisted 1\.5, requested 1\.51/u,
    );

    reserve(store, run.id);
    assert.equal(store.database.prepare('SELECT COUNT(*) AS count FROM evaluation_budget_attempts').get().count, 1);
    assert.equal(store.deleteRun(run.id).deletedRuns, 1);
    assert.equal(store.database.prepare('SELECT COUNT(*) AS count FROM evaluation_budget_ledgers').get().count, 0);
    assert.equal(store.database.prepare('SELECT COUNT(*) AS count FROM evaluation_budget_attempts').get().count, 0);
    expectPersistenceError(() => store.getBudgetSummary(run.id), 'unknown_run', /not initialized/u);
  });

  it('reserves unique per-provider attempts and rolls back duplicate or over-ceiling writes', () => {
    const { openStore } = createFixture('reserve');
    const store = openStore();
    const run = store.createRun({ description: 'reservation gate' });
    store.initializeBudgetLedger({ runId: run.id, maxUsd: 1 });

    const first = reserve(store, run.id, { reservedUsd: 0.5 });
    assert.equal(first.status, 'pending');
    assert.equal(first.model, 'anthropic/claude-sonnet-4.6');
    assert.equal(first.role, 'tutor');
    assert.equal(first.rateProvenance.catalogVersion, 'offline-fixture-v1');

    expectPersistenceError(() => reserve(store, run.id, { reservedUsd: 0.1 }), 'duplicate_attempt', /already exists/u);

    const secondProvider = reserve(store, run.id, {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reservedUsd: 0.5,
    });
    assert.equal(secondProvider.attemptId, 'attempt-1');
    assert.equal(secondProvider.provider, 'anthropic');

    assert.throws(
      () => reserve(store, run.id, { attemptId: 'attempt-2', reservedUsd: 0.01 }),
      (error) => {
        assert.equal(error.code, 'BUDGET_EXCEEDED');
        assert.equal(error.accumulatedUsd, 1);
        assert.equal(error.estimateUsd, 0.01);
        assert.equal(error.maxUsd, 1);
        assert.equal(error.projectedExposureUsd, 1.01);
        return true;
      },
    );

    assert.equal(store.database.inTransaction, false);
    assert.deepEqual(
      {
        attempts: store.getBudgetSummary(run.id).attemptCount,
        pending: store.getBudgetSummary(run.id).pendingExposureUsd,
        ceiling: store.getBudgetSummary(run.id).ceilingExposureUsd,
      },
      { attempts: 2, pending: 1, ceiling: 1 },
    );
  });

  it('separates actual, estimated, conservative, pending, and ambiguous exposure with token totals', () => {
    const { openStore } = createFixture('summary');
    const store = openStore();
    const run = store.createRun({ description: 'budget summary categories' });
    store.initializeBudgetLedger({ runId: run.id, maxUsd: 3 });

    reserve(store, run.id, { attemptId: 'provider-actual', reservedUsd: 0.4 });
    const actual = store.settleBudgetAttempt({
      runId: run.id,
      provider: 'openrouter',
      attemptId: 'provider-actual',
      costUsd: 0.12,
      costBasis: 'provider_reported',
      costProvenance: { source: 'response.usage.cost', responseId: 'offline-response-1' },
      inputTokens: 100,
      outputTokens: 20,
    });
    assert.equal(actual.status, 'settled');
    assert.deepEqual(actual.costProvenance, {
      source: 'response.usage.cost',
      responseId: 'offline-response-1',
    });

    reserve(store, run.id, { attemptId: 'catalog', reservedUsd: 0.4 });
    store.settleBudgetAttempt({
      runId: run.id,
      provider: 'openrouter',
      attemptId: 'catalog',
      costUsd: 0.18,
      costBasis: 'catalog_estimate',
      costProvenance: { source: 'test-catalog', catalogVersion: 'offline-fixture-v1' },
      inputTokens: 200,
      outputTokens: 40,
    });

    reserve(store, run.id, {
      attemptId: 'bound',
      reservedUsd: 0.4,
      reservedBasis: 'conservative_bound',
    });
    store.settleBudgetAttempt({
      runId: run.id,
      provider: 'openrouter',
      attemptId: 'bound',
      costUsd: 0.2,
      costBasis: 'conservative_bound',
      costProvenance: { reason: 'provider omitted usage and token counts were bounded' },
      inputTokens: 50,
      outputTokens: 10,
    });

    reserve(store, run.id, { attemptId: 'pending', reservedUsd: 0.3 });
    reserve(store, run.id, {
      attemptId: 'ambiguous',
      reservedUsd: 0.25,
      reservedBasis: 'conservative_bound',
    });
    const ambiguous = store.markBudgetAttemptAmbiguous({
      runId: run.id,
      provider: 'openrouter',
      attemptId: 'ambiguous',
      reason: 'connection closed after dispatch before a response was observed',
    });
    assert.equal(ambiguous.status, 'ambiguous');
    assert.equal(ambiguous.reservedUsd, 0.25);
    expectPersistenceError(
      () =>
        store.settleBudgetAttempt({
          runId: run.id,
          provider: 'openrouter',
          attemptId: 'ambiguous',
          costUsd: 0.01,
          costBasis: 'provider_reported',
          costProvenance: { source: 'late response must not rewrite ambiguous exposure' },
          inputTokens: 1,
          outputTokens: 1,
        }),
      'invalid_transition',
      /Only a pending budget attempt can settle/u,
    );

    reserve(store, run.id, {
      provider: 'codex',
      model: 'gpt-5.6-luna',
      role: 'tutor',
      attemptId: 'subscription',
      reservedUsd: 0,
      reservedBasis: 'not_metered_here',
      rateProvenance: {
        source: 'route-capability fixture',
        provider: 'codex',
        model: 'gpt-5.6-luna',
      },
    });
    store.settleBudgetAttempt({
      runId: run.id,
      provider: 'codex',
      attemptId: 'subscription',
      costUsd: 0,
      costBasis: 'not_metered_here',
      costProvenance: { source: 'subscription_route' },
      inputTokens: 0,
      outputTokens: 0,
    });

    const summary = store.getBudgetSummary(run.id);
    assert.deepEqual(
      {
        attemptCount: summary.attemptCount,
        settledCount: summary.settledCount,
        pendingCount: summary.pendingCount,
        ambiguousCount: summary.ambiguousCount,
        notMeteredCount: summary.notMeteredCount,
        totalInputTokens: summary.totalInputTokens,
        totalOutputTokens: summary.totalOutputTokens,
        providerReportedUsd: summary.providerReportedUsd,
        catalogEstimatedUsd: summary.catalogEstimatedUsd,
        conservativeBoundUsd: summary.conservativeBoundUsd,
        pendingExposureUsd: summary.pendingExposureUsd,
        ambiguousExposureUsd: summary.ambiguousExposureUsd,
        ceilingExposureUsd: summary.ceilingExposureUsd,
      },
      {
        attemptCount: 6,
        settledCount: 4,
        pendingCount: 1,
        ambiguousCount: 1,
        notMeteredCount: 1,
        totalInputTokens: 350,
        totalOutputTokens: 70,
        providerReportedUsd: 0.12,
        catalogEstimatedUsd: 0.18,
        conservativeBoundUsd: 0.2,
        pendingExposureUsd: 0.3,
        ambiguousExposureUsd: 0.25,
        ceilingExposureUsd: 1.05,
      },
    );
  });

  it('records an honest provider overage on settlement instead of rejecting or clipping it', () => {
    const { openStore } = createFixture('overage');
    const store = openStore();
    const run = store.createRun({ description: 'settlement overage' });
    store.initializeBudgetLedger({ runId: run.id, maxUsd: 0.5 });
    reserve(store, run.id, { reservedUsd: 0.5 });

    store.settleBudgetAttempt({
      runId: run.id,
      provider: 'openrouter',
      attemptId: 'attempt-1',
      costUsd: 0.75,
      costBasis: 'provider_reported',
      costProvenance: { source: 'response.usage.cost' },
      inputTokens: 500,
      outputTokens: 100,
    });

    const summary = store.getBudgetSummary(run.id);
    assert.equal(summary.providerReportedUsd, 0.75);
    assert.equal(summary.ceilingExposureUsd, 0.75);
    assert.equal(summary.remainingUsd, -0.25);
  });

  it('persists configured reservation rates separately from observed settlement rates', () => {
    const { openStore } = createFixture('rate-provenance');
    const store = openStore();
    const run = store.createRun({ description: 'configured and observed rate provenance' });
    const tracker = createBudgetTracker({
      maxUsd: 1,
      runId: run.id,
      ledgerStore: store,
      idFactory: () => 'observed-model',
    });

    const reservation = tracker.reserveAttempt({
      provider: 'openrouter',
      model: 'openai/gpt-5.4',
      role: 'tutorEgoInitial',
      promptText: 'offline prompt',
      maxOutputTokens: 100,
    });
    tracker.settleAttempt(reservation, {
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4.6',
      inputTokens: 100,
      outputTokens: 20,
      tokenUsagePresent: true,
      reportedCostPresent: false,
    });

    const attempt = store.getBudgetAttempt({
      runId: run.id,
      provider: 'openrouter',
      attemptId: 'observed-model',
    });
    assert.equal(attempt.model, 'openai/gpt-5.4');
    assert.equal(attempt.rateProvenance.model, 'openai/gpt-5.4');
    assert.deepEqual(attempt.rateProvenance.ratesPer1k, { input: 0.0075, output: 0.03 });
    assert.equal(attempt.costBasis, 'catalog_estimate');
    assert.equal(attempt.costProvenance.provider, 'openrouter');
    assert.equal(attempt.costProvenance.model, 'anthropic/claude-sonnet-4.6');
    assert.deepEqual(attempt.costProvenance.ratesPer1k, { input: 0.003, output: 0.015 });
  });

  it('serializes reservations across two store instances and persists exposure for a reopened store', () => {
    const fixture = createFixture('two-connections');
    const firstStore = fixture.openStore();
    const run = firstStore.createRun({ description: 'shared budget ledger' });
    firstStore.initializeBudgetLedger({ runId: run.id, maxUsd: 1 });

    const secondStore = fixture.openStore();
    reserve(firstStore, run.id, { attemptId: 'first', reservedUsd: 0.7 });

    assert.throws(
      () => reserve(secondStore, run.id, { attemptId: 'would-oversubscribe', reservedUsd: 0.31 }),
      (error) => error.code === 'BUDGET_EXCEEDED' && error.accumulatedUsd === 0.7,
    );
    reserve(secondStore, run.id, { attemptId: 'second', reservedUsd: 0.3 });
    assert.equal(firstStore.getBudgetSummary(run.id).ceilingExposureUsd, 1);
    assert.equal(secondStore.getBudgetSummary(run.id).attemptCount, 2);

    firstStore.close();
    secondStore.close();
    const reopenedStore = fixture.openStore();
    assert.deepEqual(
      {
        attempts: reopenedStore.getBudgetSummary(run.id).attemptCount,
        exposure: reopenedStore.getBudgetSummary(run.id).ceilingExposureUsd,
        maxUsd: reopenedStore.getBudgetSummary(run.id).maxUsd,
      },
      { attempts: 2, exposure: 1, maxUsd: 1 },
    );
  });
});
