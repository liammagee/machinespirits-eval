// One spend-ceiling contract for every launcher that makes metered calls.
//
// Before this module each launcher carried its own copy: the two trap pilots
// built an in-memory tracker with no run id, so nothing survived a restart;
// an unparseable ceiling silently disabled metering instead of stopping the
// run; budget exhaustion was caught as an ordinary per-scenario failure and
// the loop carried on; and the run row was never finalized, so an interrupted
// pilot stayed at status='running' for ever.
//
// The rules here are the ones the budget ledger already assumes:
//
//   - a ceiling is either a positive number or an error, never a silent null;
//   - the ledger is keyed by the run id, so the run identity has to be durable
//     before the first metered call, and reopening it inherits every
//     reservation the interrupted attempt booked;
//   - budget exhaustion stops the run and finalizes it, rather than being
//     retried against the next unit;
//   - a call that threw stays charged at its reservation, because a request
//     that reached a provider may have been billed.

import { createBudgetTracker } from './budgetTracker.js';
import {
  BALANCE_POLICY,
  ProviderBalanceStopError,
  compareCeilingWithBalance,
  probeProviderBalance,
} from './providerBalanceProbe.js';

const BUDGET_ERROR_CODES = new Set(['BUDGET_EXCEEDED', 'BUDGET_LEDGER_PERSISTENCE']);

export function isBudgetHaltError(error) {
  return BUDGET_ERROR_CODES.has(error?.code);
}

// A missing ceiling is "unmetered by choice"; a malformed one is an error.
// The old `Number(raw) > 0` guard collapsed the two, so `--max-cost abc` ran
// the whole pilot with no ceiling at all.
export function resolveSpendCeiling(raw, { flag = '--max-cost' } = {}) {
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || !(value > 0)) {
    throw new Error(`${flag} must be a positive number (got '${raw}')`);
  }
  return value;
}

// Bind the ceiling to this run's own durable ledger. initializeBudgetLedger is
// idempotent on (runId, maxUsd) and refuses a changed ceiling, so a restart
// reopens the same ledger and continues under the original budget.
export function bindRunLedger({ evaluationStore, runId, maxCostUsd, verbose = false, label = 'run' } = {}) {
  if (maxCostUsd == null) return null;
  if (!(maxCostUsd > 0)) throw new Error(`${label}: spend ceiling must be a positive number (got ${maxCostUsd})`);
  try {
    const tracker = createBudgetTracker({ maxUsd: maxCostUsd, runId, ledgerStore: evaluationStore });
    if (verbose) console.log(`[${label}] budget ceiling: $${maxCostUsd.toFixed(2)} (ledger run=${runId})`);
    return tracker;
  } catch (error) {
    // The run row exists but has no usable ledger. Close it rather than leave
    // it at status='running' looking like work in flight.
    try {
      evaluationStore.updateRun(runId, {
        status: 'halted_budget_ledger',
        totalTests: 0,
        completedAt: new Date().toISOString(),
      });
    } catch {
      // Finalization is best effort here; the ledger failure is the real error.
    }
    throw error;
  }
}

// Optional pre-dispatch balance check. Runs only where the provider's own
// config declares the capability; otherwise it is a no-op that says so.
//
// The ledger stays the binding control either way: an unknown balance never
// stops a run, and a known shortfall stops one only under an explicitly
// declared `stop` policy, because a ceiling above the remaining credit says
// what the run COULD reach, not what it will spend.
export async function checkBalanceBeforeDispatch({
  provider,
  providerConfig = {},
  maxCostUsd = null,
  alreadyExposedUsd = 0,
  policy = BALANCE_POLICY.WARN,
  fetchImpl = globalThis.fetch,
  label = 'run',
  verbose = false,
} = {}) {
  if (maxCostUsd == null) return null;

  const balance = await probeProviderBalance({ provider, providerConfig, fetchImpl });
  const verdict = compareCeilingWithBalance({ balance, maxCostUsd, alreadyExposedUsd, policy });

  if (verdict.decision === 'stop') {
    throw new ProviderBalanceStopError(`[${label}] ${verdict.reason} Declared policy is stop.`, {
      provider,
      remainingUsd: verdict.remainingUsd,
      headroomUsd: verdict.headroomUsd,
    });
  }
  if (verdict.decision === 'warn') {
    console.warn(`[${label}] balance warning: ${verdict.reason}`);
  } else if (verbose) {
    console.log(`[${label}] balance check: ${verdict.reason}`);
  }
  return { balance, verdict };
}

export function finalizeMeteredRun({ evaluationStore, runId, halted = false, haltCode = null, totalTests = 0 } = {}) {
  evaluationStore.updateRun(runId, {
    status: halted
      ? haltCode === 'BUDGET_LEDGER_PERSISTENCE'
        ? 'halted_budget_ledger'
        : 'halted_budget'
      : 'completed',
    totalTests,
    completedAt: new Date().toISOString(),
  });
}

// Planned units the run has no row for. `unitId` is the stored scenario id, so
// a restart subtracts one set from the other rather than re-deriving what ran.
export function selectPendingUnits({ evaluationStore, runId, plannedUnits = [] } = {}) {
  const completed = new Set(
    evaluationStore
      .getResults(runId)
      .map((row) => row.scenarioId || row.scenario_id)
      .filter(Boolean),
  );
  return {
    completedUnitIds: completed,
    pendingUnits: plannedUnits.filter((unit) => !completed.has(unit.unitId)),
  };
}

// Run the units in order and stop the whole run the moment the ledger refuses
// a reservation. Any other per-unit failure stays a per-unit failure.
export async function executeMeteredUnits({ units, execute, label = 'run', verbose = false } = {}) {
  const completedUnitIds = [];
  const failures = [];
  let halted = false;
  let haltReason = null;
  let haltCode = null;

  for (const unit of units) {
    try {
      await execute(unit);
      completedUnitIds.push(unit.unitId);
    } catch (error) {
      if (isBudgetHaltError(error)) {
        halted = true;
        haltReason = error.message;
        haltCode = error.code;
        const haltLabel = error.code === 'BUDGET_EXCEEDED' ? 'BUDGET' : 'BUDGET LEDGER';
        console.error(`[${label}] ${haltLabel} HALT on ${unit.unitId}: ${error.message}`);
        break;
      }
      failures.push({ unitId: unit.unitId, message: error?.message || String(error) });
      console.error(`[${label}]   ✗ ${unit.unitId}: ${error?.message || String(error)}`);
      if (verbose && error?.stack) console.error(error.stack);
    }
  }

  return { completedUnitIds, failures, halted, haltReason, haltCode };
}

// Meter an engine that does not route through services/adaptiveTutor/realLLM.
//
// The id-director engine calls tutor-core's callAI (or the subscription-CLI
// bridge) directly, so setActiveBudgetTracker never saw its id, ego, plan, or
// verifier calls — only the synthetic learner, which does go through realLLM,
// was ever charged. Wrapping the engine's injected callAI puts every physical
// call behind the same reserve-then-settle contract.
export function meterCallAI(callAI, { tracker } = {}) {
  if (!tracker) return callAI;
  return async function meteredCallAI(agentConfig, systemPrompt, userPrompt, role, opts = {}) {
    const reservation = tracker.reserveAttempt({
      provider: agentConfig?.provider,
      model: agentConfig?.model,
      role: role || 'unscoped',
      promptText: `${systemPrompt ?? ''}\n${userPrompt ?? ''}`,
      maxOutputTokens: agentConfig?.hyperparameters?.max_tokens,
    });

    let response;
    try {
      response = await callAI(agentConfig, systemPrompt, userPrompt, role, opts);
    } catch (error) {
      // The request may have reached the provider and been billed, so the
      // reservation stays charged instead of being released.
      tracker.markAttemptAmbiguous(reservation, {
        reason: `Model call threw before a usable response: ${error?.message || String(error)}`,
      });
      throw error;
    }

    // A provider-reported zero is a real number and must not read as missing.
    const reportedCost = Number(response?.cost);
    const reportedCostPresent = Number.isFinite(reportedCost);
    const inputTokens = Number(response?.inputTokens);
    const outputTokens = Number(response?.outputTokens);
    tracker.settleAttempt(reservation, {
      inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
      outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
      reportedCostPresent,
      reportedCost: reportedCostPresent ? reportedCost : null,
      provider: response?.provider ?? agentConfig?.provider,
      model: response?.model ?? agentConfig?.model,
      tokenUsagePresent: Number.isFinite(inputTokens) || Number.isFinite(outputTokens),
    });
    return response;
  };
}
