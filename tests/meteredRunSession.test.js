// Offline tests for the one spend-ceiling contract the metered launchers share.
//
// Nothing here reaches a provider: the model call is a plain function the test
// supplies, and the ledger is a real SQLite store in a temp directory.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, it } from 'node:test';

import { createBudgetTracker } from '../services/adaptiveTutor/budgetTracker.js';
import {
  bindRunLedger,
  executeMeteredUnits,
  finalizeMeteredRun,
  isBudgetHaltError,
  meterCallAI,
  resolveSpendCeiling,
  selectPendingUnits,
} from '../services/adaptiveTutor/meteredRunSession.js';
import { createEvaluationStore } from '../services/evaluationStore/createEvaluationStore.js';
import { createIdDirectorEngineDeps } from '../scripts/run-id-director-trap-pilot.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDirs = [];

after(() => {
  for (const tempDir of tempDirs) fs.rmSync(tempDir, { recursive: true, force: true });
});

function withStore(prefix, operation) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(tempDir);
  const previous = {
    EVAL_DB_PATH: process.env.EVAL_DB_PATH,
    EVAL_LOGS_DIR: process.env.EVAL_LOGS_DIR,
    MS_DATA_HOME: process.env.MS_DATA_HOME,
  };
  process.env.EVAL_DB_PATH = path.join(tempDir, 'data', 'evaluations.db');
  process.env.EVAL_LOGS_DIR = path.join(tempDir, 'logs');
  process.env.MS_DATA_HOME = path.join(tempDir, 'data-home');
  const store = createEvaluationStore({ rootDir: ROOT_DIR });
  return Promise.resolve()
    .then(() => operation(store))
    .finally(() => {
      store.close();
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

function makeRun(store, metadata = {}) {
  return store.createRun({
    description: 'metered session test run',
    totalScenarios: 3,
    totalConfigurations: 1,
    metadata: { kind: 'adaptive_trap', ...metadata },
  });
}

const METERED_AGENT = {
  provider: 'openrouter',
  model: 'anthropic/claude-sonnet-4.6',
  hyperparameters: { max_tokens: 512 },
};

describe('spend ceiling parsing', () => {
  it('refuses a malformed ceiling instead of running unmetered', () => {
    // The old guard was `Number(raw) > 0`, so each of these disabled metering
    // and let the whole pilot run with no ceiling at all.
    for (const raw of ['abc', '0', '-1', 'NaN', 'Infinity', '1e400']) {
      assert.throws(() => resolveSpendCeiling(raw), /--max-cost must be a positive number/u, `accepted '${raw}'`);
    }
    assert.throws(() => resolveSpendCeiling('abc', { flag: '--ceiling' }), /--ceiling must be a positive number/u);
  });

  it('treats an absent ceiling as unmetered by choice and keeps a valid one', () => {
    assert.equal(resolveSpendCeiling(undefined), null);
    assert.equal(resolveSpendCeiling(null), null);
    assert.equal(resolveSpendCeiling(''), null);
    assert.equal(resolveSpendCeiling('2.5'), 2.5);
    assert.equal(resolveSpendCeiling(4), 4);
  });
});

describe('run ledger binding', () => {
  it('binds the ceiling to the run id so a restart inherits the exposure already booked', async () => {
    await withStore('metered-bind-ledger-', (store) => {
      const run = makeRun(store);
      const tracker = bindRunLedger({ evaluationStore: store, runId: run.id, maxCostUsd: 3, label: 'test' });
      assert.equal(tracker.runId, run.id);

      const reservation = tracker.reserveAttempt({ ...METERED_AGENT, role: 'ego', promptText: 'x'.repeat(2000) });
      tracker.settleAttempt(reservation, { inputTokens: 500, outputTokens: 250 });
      const settled = tracker.summary().ceilingExposureUsd;
      assert.ok(settled > 0);

      const reopened = bindRunLedger({ evaluationStore: store, runId: run.id, maxCostUsd: 3, label: 'test' });
      assert.equal(reopened.summary().ceilingExposureUsd, settled);
      assert.equal(reopened.summary().attemptCount, 1);

      assert.equal(bindRunLedger({ evaluationStore: store, runId: run.id, maxCostUsd: null }), null);
      assert.throws(
        () => bindRunLedger({ evaluationStore: store, runId: run.id, maxCostUsd: 0, label: 'test' }),
        /spend ceiling must be a positive number/u,
      );
    });
  });

  it('closes the run when its ledger cannot be opened, rather than leaving it running', async () => {
    await withStore('metered-bind-failure-', (store) => {
      const run = makeRun(store);
      const failing = {
        ...store,
        initializeBudgetLedger() {
          throw Object.assign(new Error('injected ledger failure'), { code: 'BUDGET_LEDGER_PERSISTENCE' });
        },
      };

      assert.throws(
        () => bindRunLedger({ evaluationStore: failing, runId: run.id, maxCostUsd: 2, label: 'test' }),
        /injected ledger failure/u,
      );
      const stored = store.getRun(run.id);
      assert.equal(stored.status, 'halted_budget_ledger');
      assert.ok(stored.completedAt);
    });
  });
});

describe('metered unit execution', () => {
  it('stops the whole run on budget exhaustion and leaves the later units untouched', async () => {
    const attempted = [];
    const outcome = await executeMeteredUnits({
      label: 'test',
      units: [{ unitId: 'a' }, { unitId: 'b' }, { unitId: 'c' }],
      execute: async (unit) => {
        attempted.push(unit.unitId);
        if (unit.unitId === 'b') {
          throw Object.assign(new Error('BudgetExceeded: over ceiling'), { code: 'BUDGET_EXCEEDED' });
        }
      },
    });

    // The old loop caught this as an ordinary per-scenario failure and carried
    // on to 'c', spending again against an already-exhausted ceiling.
    assert.deepEqual(attempted, ['a', 'b']);
    assert.equal(outcome.halted, true);
    assert.equal(outcome.haltCode, 'BUDGET_EXCEEDED');
    assert.deepEqual(outcome.completedUnitIds, ['a']);
  });

  it('keeps an ordinary unit failure per unit', async () => {
    const outcome = await executeMeteredUnits({
      label: 'test',
      units: [{ unitId: 'a' }, { unitId: 'b' }, { unitId: 'c' }],
      execute: async (unit) => {
        if (unit.unitId === 'b') throw new Error('scenario parse failed');
      },
    });

    assert.equal(outcome.halted, false);
    assert.deepEqual(outcome.completedUnitIds, ['a', 'c']);
    assert.equal(outcome.failures.length, 1);
    assert.equal(outcome.failures[0].unitId, 'b');
    assert.equal(isBudgetHaltError(new Error('plain')), false);
  });
});

describe('run finalization and restart planning', () => {
  it('records how the run ended instead of leaving it at running', async () => {
    await withStore('metered-finalize-', (store) => {
      const completed = makeRun(store);
      finalizeMeteredRun({ evaluationStore: store, runId: completed.id, totalTests: 3 });
      assert.equal(store.getRun(completed.id).status, 'completed');
      assert.equal(store.getRun(completed.id).totalTests, 3);
      assert.ok(store.getRun(completed.id).completedAt);

      const exhausted = makeRun(store);
      finalizeMeteredRun({
        evaluationStore: store,
        runId: exhausted.id,
        halted: true,
        haltCode: 'BUDGET_EXCEEDED',
        totalTests: 1,
      });
      assert.equal(store.getRun(exhausted.id).status, 'halted_budget');

      const brokenLedger = makeRun(store);
      finalizeMeteredRun({
        evaluationStore: store,
        runId: brokenLedger.id,
        halted: true,
        haltCode: 'BUDGET_LEDGER_PERSISTENCE',
        totalTests: 0,
      });
      assert.equal(store.getRun(brokenLedger.id).status, 'halted_budget_ledger');
    });
  });

  it('plans a restart from the planned units that have no row', async () => {
    await withStore('metered-pending-units-', (store) => {
      const run = makeRun(store);
      const plannedUnits = [{ unitId: 'unit_a' }, { unitId: 'unit_b' }, { unitId: 'unit_c' }];
      for (const unitId of ['unit_a', 'unit_c']) {
        store.storeResult(run.id, {
          scenarioId: unitId,
          scenarioName: unitId,
          scenarioType: 'adaptive_trap',
          provider: 'openrouter',
          model: 'anthropic/claude-sonnet-4.6',
          profileName: 'cell_test',
          suggestions: ['done'],
          rawResponse: '{}',
          success: true,
        });
      }

      const { completedUnitIds, pendingUnits } = selectPendingUnits({
        evaluationStore: store,
        runId: run.id,
        plannedUnits,
      });
      assert.deepEqual([...completedUnitIds].sort(), ['unit_a', 'unit_c']);
      assert.deepEqual(
        pendingUnits.map((unit) => unit.unitId),
        ['unit_b'],
      );
    });
  });
});

describe('metering an engine that does not route through realLLM', () => {
  it('reserves before the call and settles on the provider-reported cost', async () => {
    await withStore('metered-callai-settle-', async (store) => {
      const run = makeRun(store);
      const tracker = createBudgetTracker({ maxUsd: 5, runId: run.id, ledgerStore: store });
      const seen = [];
      const callAI = meterCallAI(
        async (agentConfig, systemPrompt, userPrompt, role) => {
          // The reservation is booked before the call runs, so a ceiling can
          // stop a call that has not happened yet.
          seen.push({ role, reservedAttempts: tracker.summary().attemptCount });
          return {
            text: 'ok',
            provider: 'openrouter',
            model: METERED_AGENT.model,
            inputTokens: 400,
            outputTokens: 100,
            cost: 0.0123,
          };
        },
        { tracker },
      );

      for (const role of ['tutor_id', 'ego', 'plan', 'verifier']) {
        await callAI(METERED_AGENT, 'system', 'user', role, {});
      }

      assert.deepEqual(
        seen.map((entry) => entry.role),
        ['tutor_id', 'ego', 'plan', 'verifier'],
      );
      assert.deepEqual(
        seen.map((entry) => entry.reservedAttempts),
        [1, 2, 3, 4],
        'each call reserves before it dispatches',
      );

      const summary = tracker.summary();
      assert.equal(summary.attemptCount, 4);
      assert.equal(summary.settledCount, 4);
      assert.equal(summary.pendingCount, 0);
      // Provider-reported cost is recorded as reported, not re-estimated.
      assert.ok(Math.abs(summary.providerReportedUsd - 0.0492) < 1e-9);
      assert.equal(summary.totalInputTokens, 1600);
      assert.equal(summary.totalOutputTokens, 400);
    });
  });

  it('keeps a thrown call charged, because the request may already have been billed', async () => {
    await withStore('metered-callai-throw-', async (store) => {
      const run = makeRun(store);
      const tracker = createBudgetTracker({ maxUsd: 5, runId: run.id, ledgerStore: store });
      const callAI = meterCallAI(
        async () => {
          throw new Error('socket hang up');
        },
        { tracker },
      );

      await assert.rejects(callAI(METERED_AGENT, 'system', 'user', 'ego', {}), /socket hang up/u);
      const summary = tracker.summary();
      assert.equal(summary.attemptCount, 1);
      assert.equal(summary.ambiguousCount, 1);
      assert.ok(summary.ambiguousExposureUsd > 0, 'the reservation is not released');
    });
  });

  it('reads a provider-reported zero as reported, and a missing cost as missing', async () => {
    await withStore('metered-callai-zero-', async (store) => {
      const run = makeRun(store);
      const tracker = createBudgetTracker({ maxUsd: 5, runId: run.id, ledgerStore: store });

      const reportedZero = meterCallAI(
        async () => ({
          text: 'ok',
          provider: 'openrouter',
          model: METERED_AGENT.model,
          inputTokens: 10,
          outputTokens: 5,
          cost: 0,
        }),
        { tracker },
      );
      await reportedZero(METERED_AGENT, 's', 'u', 'ego', {});
      let summary = tracker.summary();
      assert.equal(summary.settledCount, 1);
      assert.equal(summary.providerReportedUsd, 0);

      // No cost field at all: fall back to the catalog estimate rather than
      // treating the silence as a free call.
      const noCost = meterCallAI(
        async () => ({
          text: 'ok',
          provider: 'openrouter',
          model: METERED_AGENT.model,
          inputTokens: 1000,
          outputTokens: 500,
        }),
        { tracker },
      );
      await noCost(METERED_AGENT, 's', 'u', 'ego', {});
      summary = tracker.summary();
      assert.equal(summary.settledCount, 2);
      assert.ok(summary.catalogEstimatedUsd > 0, 'a missing cost is estimated, not read as zero');
    });
  });

  it('refuses a call that would breach the ceiling before it dispatches', async () => {
    await withStore('metered-callai-ceiling-', async (store) => {
      const run = makeRun(store);
      const tracker = createBudgetTracker({ maxUsd: 0.000001, runId: run.id, ledgerStore: store });
      let dispatched = 0;
      const callAI = meterCallAI(
        async () => {
          dispatched += 1;
          return { text: 'ok', inputTokens: 1, outputTokens: 1, cost: 0 };
        },
        { tracker },
      );

      await assert.rejects(
        callAI(METERED_AGENT, 'system', 'x'.repeat(20000), 'ego', {}),
        (error) => error.code === 'BUDGET_EXCEEDED',
      );
      assert.equal(dispatched, 0, 'the ceiling stops the call before the provider is reached');
    });
  });

  it('leaves the engine call path untouched when no ceiling is set', () => {
    const rawCallAI = async () => ({ text: 'ok' });
    assert.equal(meterCallAI(rawCallAI, { tracker: null }), rawCallAI);
    assert.equal(createIdDirectorEngineDeps({ tutorConfig: {}, callAI: rawCallAI }).callAI, rawCallAI);
  });
});

describe('launchers fail closed on a malformed ceiling', () => {
  it('stops both trap launchers before any run row is created', async () => {
    const { main: idDirectorMain } = await import('../scripts/run-id-director-trap-pilot.js');
    const { main: dialogueEngineMain } = await import('../scripts/run-dialogue-engine-trap-baseline.js');

    for (const [label, launcher] of [
      ['id-director', idDirectorMain],
      ['dialogue-engine', dialogueEngineMain],
    ]) {
      await withStore(`metered-launcher-${label}-`, async (store) => {
        const before = store.listRuns().length;
        await assert.rejects(
          launcher(['--max-cost', 'abc'], { evaluationStore: store }),
          /--max-cost must be a positive number/u,
          `${label} accepted a malformed ceiling`,
        );
        assert.equal(store.listRuns().length, before, `${label} created a run despite the bad ceiling`);
      });
    }
  });
});

describe('trap launcher restart guards', () => {
  it('refuses a restart against the wrong run or a changed ceiling', async () => {
    const { main: idDirectorMain } = await import('../scripts/run-id-director-trap-pilot.js');

    await withStore('metered-resume-guards-', async (store) => {
      await assert.rejects(
        idDirectorMain(['--resume', 'no-such-run'], { evaluationStore: store }),
        /--resume: run not found/u,
      );

      const foreign = makeRun(store, { architecture: 'dialogue_engine', maxCostUsd: 2 });
      await assert.rejects(
        idDirectorMain(['--resume', foreign.id, '--max-cost', '2'], { evaluationStore: store }),
        /is not an id-director run/u,
      );

      // Reopening at a different ceiling would silently re-authorize the run
      // for a budget nobody approved.
      const own = makeRun(store, { architecture: 'id_director', maxCostUsd: 2, plannedUnits: [] });
      await assert.rejects(
        idDirectorMain(['--resume', own.id, '--max-cost', '9'], { evaluationStore: store }),
        /was launched with ceiling 2/u,
      );
    });
  });
});

describe('DAG comparison store retention', () => {
  it('keeps the store that holds a metered run ledger, whatever --keep-temp says', async () => {
    const { resolveStoreRetention } = await import('../scripts/run-dag-resistance-comparison.js');

    // A metered run: the ledger and the run row live in that store, so the
    // default clean-up would destroy the only record of the spend.
    assert.deepEqual(resolveStoreRetention({ keepTemp: false, budget: { maxUsd: 4 } }), {
      meteredRun: true,
      retainStore: true,
      retainedForBudgetLedger: true,
    });
    assert.deepEqual(resolveStoreRetention({ keepTemp: true, budget: { maxUsd: 4 } }), {
      meteredRun: true,
      retainStore: true,
      retainedForBudgetLedger: false,
    });
    // A mock run holds no ledger, so the old clean-up still applies.
    assert.deepEqual(resolveStoreRetention({ keepTemp: false, budget: null }), {
      meteredRun: false,
      retainStore: false,
      retainedForBudgetLedger: false,
    });
    assert.deepEqual(resolveStoreRetention({ keepTemp: true, budget: null }), {
      meteredRun: false,
      retainStore: true,
      retainedForBudgetLedger: false,
    });
  });
});

describe('id-director engine dependencies', () => {
  it('routes the engine id, ego, plan, and verifier calls through the run ledger', async () => {
    await withStore('id-director-engine-deps-', async (store) => {
      const run = makeRun(store);
      const tracker = createBudgetTracker({ maxUsd: 5, runId: run.id, ledgerStore: store });
      const tutorConfig = { marker: 'eval-config-loader' };
      const roles = [];
      const deps = createIdDirectorEngineDeps({
        tracker,
        tutorConfig,
        callAI: async (agentConfig, systemPrompt, userPrompt, role) => {
          roles.push(role);
          return { text: '{}', provider: 'openrouter', model: METERED_AGENT.model, inputTokens: 200, outputTokens: 50 };
        },
      });

      assert.equal(deps.tutorConfig, tutorConfig);
      // The four seats the id-director engine drives per turn. Before this
      // wiring none of them was charged: only the synthetic learner went
      // through realLLM, which is where the tracker used to be installed.
      for (const role of ['tutor_id', 'tutor_ego', 'tutor_plan', 'tutor_verifier']) {
        await deps.callAI(METERED_AGENT, 'system', 'user', role, {});
      }

      assert.deepEqual(roles, ['tutor_id', 'tutor_ego', 'tutor_plan', 'tutor_verifier']);
      const summary = tracker.summary();
      assert.equal(summary.attemptCount, 4, 'every engine seat reserves against the ledger');
      assert.equal(summary.settledCount, 4);
      assert.ok(summary.ceilingExposureUsd > 0);
    });
  });
});
