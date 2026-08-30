// Crash-safe pre-dispatch budget accounting for adaptive real-LLM runs.
//
// The ceiling is enforced against *exposure*, not a falsely precise spend
// scalar. Every metered provider attempt reserves a conservative amount in the
// run's ledger before dispatch. A successful response settles that reservation
// with either provider-reported cost or a labelled catalog estimate. A failed,
// crashed, or otherwise indeterminate attempt remains charged at its reserved
// amount. This is intentionally conservative: losing headroom is safer than
// silently forgetting a call that may have been billed.
//
// Rate dates are provenance, never an expiry switch. Unknown models use a
// clearly labelled guard bound for the pre-call ceiling and are never recorded
// as exact cost. Subscription CLI and local routes are explicitly
// `not_metered_here` rather than pretending that an observed zero-dollar cost
// was returned by a provider.

import { randomUUID } from 'node:crypto';

const RATE_CATALOG_RECORDED_AT = '2026-08-27';
const CONSERVATIVE_GUARD_RATES_PER_1K = Object.freeze({ input: 0.01, output: 0.03 });

const PROVIDER_SOURCES = Object.freeze({
  anthropic: Object.freeze({
    source: 'Anthropic published API pricing (operator-maintained snapshot)',
    sourceUrl: 'https://docs.anthropic.com/en/docs/about-claude/pricing',
  }),
  openai: Object.freeze({
    source: 'OpenAI published API pricing (operator-maintained snapshot)',
    sourceUrl: 'https://openai.com/api/pricing/',
  }),
  openrouter: Object.freeze({
    source: 'OpenRouter model pricing (operator-maintained snapshot)',
    sourceUrl: 'https://openrouter.ai/models',
  }),
  gemini: Object.freeze({
    source: 'Google Gemini API pricing (operator-maintained snapshot)',
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
  }),
});

function rate(input, output) {
  return Object.freeze({ input, output });
}

// USD per 1k tokens. These are estimates recorded with their route, model,
// source, and snapshot date. They are not described as current billing truth.
const RATE_CATALOG = Object.freeze({
  'openrouter:anthropic/claude-sonnet-4.6': rate(0.003, 0.015),
  'openrouter:anthropic/claude-opus-4.6': rate(0.015, 0.075),
  'openrouter:anthropic/claude-haiku-4.5': rate(0.0008, 0.004),
  'openrouter:openai/gpt-5.2': rate(0.005, 0.015),
  'openrouter:openai/gpt-5-mini': rate(0.00025, 0.001),
  'openrouter:openai/gpt-5.4': rate(0.0075, 0.03),
  'openrouter:openai/gpt-5.4-pro': rate(0.015, 0.06),
  'openrouter:google/gemini-3-pro-preview': rate(0.00125, 0.005),
  'openrouter:google/gemini-3-flash-preview': rate(0.000075, 0.0003),
  'openrouter:nvidia/nemotron-3-nano-30b-a3b': rate(0.0001, 0.0003),
  'openrouter:z-ai/glm-4.7': rate(0.00015, 0.0006),
  'openrouter:z-ai/glm-5': rate(0.0006, 0.0024),
  'openrouter:deepseek/deepseek-v3.2': rate(0.0001, 0.0003),
  'openrouter:moonshotai/kimi-k2-thinking': rate(0.0006, 0.0024),
  'openrouter:moonshotai/kimi-k2.5': rate(0.0008, 0.0032),
  'anthropic:claude-sonnet-4-5': rate(0.003, 0.015),
  'anthropic:claude-sonnet-4-6': rate(0.003, 0.015),
  'anthropic:claude-opus-4-6': rate(0.015, 0.075),
  'anthropic:claude-haiku-4-5': rate(0.0008, 0.004),
  'openai:gpt-5.2': rate(0.005, 0.015),
  'openai:gpt-5-mini': rate(0.00025, 0.001),
  'openai:gpt-5.4': rate(0.0075, 0.03),
  'openai:gpt-5.4-pro': rate(0.015, 0.06),
  'gemini:gemini-3-pro-preview': rate(0.00125, 0.005),
  'gemini:gemini-3-flash-preview': rate(0.000075, 0.0003),
});

const NOT_METERED_HERE = new Set(['claude-code', 'codex', 'local', 'lmstudio', 'mock']);

function finiteNonNegative(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function nonNegativeTokenCount(value) {
  return Math.floor(finiteNonNegative(value));
}

function estimateInputTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

function inferLegacyProvider(model) {
  if (String(model || '').startsWith('claude-')) return 'anthropic';
  if (String(model || '').startsWith('gpt-')) return 'openai';
  if (String(model || '').startsWith('gemini-')) return 'gemini';
  return 'openrouter';
}

function provenanceFor(provider, extra = {}) {
  const source = PROVIDER_SOURCES[provider] || {
    source: 'Local conservative guard policy',
    sourceUrl: null,
  };
  return {
    ...source,
    recordedAt: RATE_CATALOG_RECORDED_AT,
    verificationStatus: 'operator_snapshot_not_runtime_verified',
    ...extra,
  };
}

export function lookupRateQuote({ provider, model } = {}) {
  const route = String(provider || '').trim() || 'unknown';
  const modelId = String(model || '').trim() || 'unknown';

  if (NOT_METERED_HERE.has(route)) {
    return {
      status: 'not_metered_here',
      provider: route,
      model: modelId,
      ratesPer1k: null,
      guardRatesPer1k: null,
      provenance: {
        source: 'Route capability classification',
        sourceUrl: null,
        recordedAt: RATE_CATALOG_RECORDED_AT,
        verificationStatus: 'configured_route_semantics',
        provider: route,
        model: modelId,
        rateBasis: 'not_metered_here',
      },
    };
  }

  const ratesPer1k = RATE_CATALOG[`${route}:${modelId}`];
  if (ratesPer1k) {
    return {
      status: 'catalog',
      provider: route,
      model: modelId,
      ratesPer1k,
      guardRatesPer1k: ratesPer1k,
      provenance: provenanceFor(route, {
        provider: route,
        model: modelId,
        currency: 'USD',
        unit: 'per_1k_tokens',
        ratesPer1k,
        rateBasis: 'catalog_estimate',
      }),
    };
  }

  return {
    status: 'unknown',
    provider: route,
    model: modelId,
    ratesPer1k: null,
    guardRatesPer1k: CONSERVATIVE_GUARD_RATES_PER_1K,
    provenance: provenanceFor(route, {
      provider: route,
      model: modelId,
      currency: 'USD',
      unit: 'per_1k_tokens',
      guardRatesPer1k: CONSERVATIVE_GUARD_RATES_PER_1K,
      rateBasis: 'conservative_bound',
      note: 'No provider/model catalog entry; guard rates reserve headroom only and are not actual spend.',
    }),
  };
}

// Compatibility surface for the dramatic-derivation client. New budget code
// must use lookupRateQuote so an unknown-model guard cannot lose its label.
export function lookupRates(model, provider = inferLegacyProvider(model)) {
  const quote = lookupRateQuote({ provider, model });
  const rates = quote.ratesPer1k || quote.guardRatesPer1k || { input: 0, output: 0 };
  return [rates.input, rates.output];
}

export function estimateUsageCost({ provider, model, inputTokens = 0, outputTokens = 0 } = {}) {
  const quote = lookupRateQuote({ provider, model });
  if (quote.status === 'not_metered_here') {
    return { usd: 0, basis: 'not_metered_here', quote };
  }
  const rates = quote.ratesPer1k || quote.guardRatesPer1k;
  const usd =
    (finiteNonNegative(inputTokens) / 1000) * rates.input + (finiteNonNegative(outputTokens) / 1000) * rates.output;
  return {
    usd,
    basis: quote.status === 'catalog' ? 'catalog_estimate' : 'conservative_bound',
    quote,
  };
}

export class BudgetExceededError extends Error {
  constructor(message, { accumulatedUsd, estimateUsd, maxUsd } = {}) {
    super(message);
    this.name = 'BudgetExceededError';
    this.code = 'BUDGET_EXCEEDED';
    this.accumulatedUsd = accumulatedUsd;
    this.estimateUsd = estimateUsd;
    this.maxUsd = maxUsd;
  }
}

export class BudgetPersistenceError extends Error {
  constructor(message, { cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'BudgetPersistenceError';
    this.code = 'BUDGET_LEDGER_PERSISTENCE';
  }
}

function summarizeMemoryLedger(ledger) {
  const attempts = [...ledger.attempts.values()];
  let providerReportedUsd = 0;
  let catalogEstimatedUsd = 0;
  let conservativeBoundUsd = 0;
  let pendingExposureUsd = 0;
  let ambiguousExposureUsd = 0;
  let notMeteredCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const attempt of attempts) {
    if (attempt.status === 'reserved') pendingExposureUsd += attempt.reservedUsd;
    else if (attempt.status === 'ambiguous') ambiguousExposureUsd += attempt.reservedUsd;
    else if (attempt.costBasis === 'not_metered_here') notMeteredCount += 1;
    else if (attempt.costBasis === 'provider_reported') providerReportedUsd += attempt.costUsd;
    else if (attempt.costBasis === 'catalog_estimate') catalogEstimatedUsd += attempt.costUsd;
    else if (attempt.costBasis === 'conservative_bound') conservativeBoundUsd += attempt.costUsd;
    if (attempt.status === 'settled') {
      totalInputTokens += attempt.inputTokens || 0;
      totalOutputTokens += attempt.outputTokens || 0;
    }
  }

  const ceilingExposureUsd =
    providerReportedUsd + catalogEstimatedUsd + conservativeBoundUsd + pendingExposureUsd + ambiguousExposureUsd;
  return {
    runId: ledger.runId,
    maxUsd: ledger.maxUsd,
    attemptCount: attempts.length,
    settledCount: attempts.filter((attempt) => attempt.status === 'settled').length,
    pendingCount: attempts.filter((attempt) => attempt.status === 'reserved').length,
    ambiguousCount: attempts.filter((attempt) => attempt.status === 'ambiguous').length,
    notMeteredCount,
    providerReportedUsd,
    catalogEstimatedUsd,
    conservativeBoundUsd,
    pendingExposureUsd,
    ambiguousExposureUsd,
    ceilingExposureUsd,
    totalInputTokens,
    totalOutputTokens,
  };
}

function createMemoryLedgerStore() {
  const ledgers = new Map();
  const attemptKey = (provider, attemptId) => `${provider}\0${attemptId}`;
  return {
    initializeBudgetLedger({ runId, maxUsd }) {
      const existing = ledgers.get(runId);
      if (existing && Math.abs(existing.maxUsd - maxUsd) > 1e-12) {
        throw new Error(`Budget ceiling mismatch for ${runId}: stored ${existing.maxUsd}, requested ${maxUsd}`);
      }
      if (!existing) ledgers.set(runId, { runId, maxUsd, attempts: new Map() });
      return summarizeMemoryLedger(ledgers.get(runId));
    },
    reserveBudgetAttempt(attempt) {
      const ledger = ledgers.get(attempt.runId);
      if (!ledger) throw new Error(`Budget ledger not initialized: ${attempt.runId}`);
      const key = attemptKey(attempt.provider, attempt.attemptId);
      if (ledger.attempts.has(key)) throw new Error(`Duplicate budget attempt: ${attempt.attemptId}`);
      const summary = summarizeMemoryLedger(ledger);
      const reservedUsd = finiteNonNegative(attempt.reservedUsd);
      if (summary.ceilingExposureUsd + reservedUsd > ledger.maxUsd) {
        throw new BudgetExceededError(
          `BudgetExceeded: exposure $${summary.ceilingExposureUsd.toFixed(4)} + reservation $${reservedUsd.toFixed(4)} > ceiling $${ledger.maxUsd.toFixed(2)}`,
          { accumulatedUsd: summary.ceilingExposureUsd, estimateUsd: reservedUsd, maxUsd: ledger.maxUsd },
        );
      }
      ledger.attempts.set(key, {
        ...attempt,
        reservedUsd,
        status: 'reserved',
        costUsd: null,
        costBasis: null,
      });
      return { ...ledger.attempts.get(key) };
    },
    settleBudgetAttempt({ runId, provider, attemptId, costUsd, costBasis, costProvenance, inputTokens, outputTokens }) {
      const attempt = ledgers.get(runId)?.attempts.get(attemptKey(provider, attemptId));
      if (!attempt) throw new Error(`Budget attempt not found: ${runId}/${attemptId}`);
      if (attempt.status !== 'reserved') throw new Error(`Budget attempt is already ${attempt.status}: ${attemptId}`);
      Object.assign(attempt, {
        status: 'settled',
        costUsd: finiteNonNegative(costUsd),
        costBasis,
        costProvenance,
        inputTokens: nonNegativeTokenCount(inputTokens),
        outputTokens: nonNegativeTokenCount(outputTokens),
      });
      return { ...attempt };
    },
    markBudgetAttemptAmbiguous({ runId, provider, attemptId, reason }) {
      const attempt = ledgers.get(runId)?.attempts.get(attemptKey(provider, attemptId));
      if (!attempt) throw new Error(`Budget attempt not found: ${runId}/${attemptId}`);
      if (attempt.status !== 'reserved') throw new Error(`Budget attempt is already ${attempt.status}: ${attemptId}`);
      Object.assign(attempt, { status: 'ambiguous', reason: String(reason || '') });
      return { ...attempt };
    },
    getBudgetSummary(runId) {
      const ledger = ledgers.get(runId);
      if (!ledger) throw new Error(`Budget ledger not initialized: ${runId}`);
      return summarizeMemoryLedger(ledger);
    },
  };
}

function assertLedgerStore(store) {
  for (const method of [
    'initializeBudgetLedger',
    'reserveBudgetAttempt',
    'settleBudgetAttempt',
    'markBudgetAttemptAmbiguous',
    'getBudgetSummary',
  ]) {
    if (typeof store?.[method] !== 'function') throw new TypeError(`budget ledger store requires ${method}()`);
  }
  return store;
}

function wrapPersistence(operation, context) {
  try {
    return operation();
  } catch (error) {
    if (error?.code === 'BUDGET_EXCEEDED') {
      if (error instanceof BudgetExceededError) throw error;
      throw new BudgetExceededError(error.message, {
        accumulatedUsd: error.accumulatedUsd ?? error.ceilingExposureUsd,
        estimateUsd: error.estimateUsd ?? error.reservedUsd,
        maxUsd: error.maxUsd,
      });
    }
    if (error?.code === 'BUDGET_LEDGER_PERSISTENCE') throw error;
    throw new BudgetPersistenceError(`Budget ledger ${context} failed: ${error?.message || String(error)}`, {
      cause: error,
    });
  }
}

export function createBudgetTracker({
  maxUsd,
  runId = 'in-memory-budget',
  ledgerStore = null,
  idFactory = randomUUID,
} = {}) {
  if (typeof maxUsd !== 'number' || !Number.isFinite(maxUsd) || !(maxUsd > 0)) {
    throw new Error('createBudgetTracker requires { maxUsd: finite number > 0 }');
  }
  if (typeof runId !== 'string' || !runId.trim())
    throw new Error('createBudgetTracker runId must be a non-empty string');
  if (typeof idFactory !== 'function') throw new TypeError('createBudgetTracker idFactory must be a function');

  const store = assertLedgerStore(ledgerStore || createMemoryLedgerStore());
  wrapPersistence(() => store.initializeBudgetLedger({ runId, maxUsd }), 'initialization');

  const readSummary = () => wrapPersistence(() => store.getBudgetSummary(runId), 'read');

  const tracker = {
    get accumulatedUsd() {
      return readSummary().ceilingExposureUsd;
    },
    get maxUsd() {
      return maxUsd;
    },
    get callCount() {
      return readSummary().attemptCount;
    },
    get runId() {
      return runId;
    },

    quote(provider, model) {
      return lookupRateQuote({ provider, model });
    },

    estimate(promptText, maxOutputTokens, model, provider = inferLegacyProvider(model)) {
      return estimateUsageCost({
        provider,
        model,
        inputTokens: estimateInputTokens(promptText),
        outputTokens: Number.isFinite(maxOutputTokens) && maxOutputTokens > 0 ? Number(maxOutputTokens) : 1500,
      }).usd;
    },

    assertBelowCeiling(estimateUsd) {
      const estimate = finiteNonNegative(estimateUsd);
      const summary = readSummary();
      const projected = summary.ceilingExposureUsd + estimate;
      if (projected > maxUsd) {
        throw new BudgetExceededError(
          `BudgetExceeded: exposure $${summary.ceilingExposureUsd.toFixed(4)} + estimate $${estimate.toFixed(4)} = $${projected.toFixed(4)} > ceiling $${maxUsd.toFixed(2)}`,
          { accumulatedUsd: summary.ceilingExposureUsd, estimateUsd: estimate, maxUsd },
        );
      }
    },

    reserveAttempt({ provider, model, role = 'unscoped', promptText = '', maxOutputTokens = 1500 } = {}) {
      const normalizedProvider = String(provider || 'unknown');
      const normalizedModel = String(model || 'unknown');
      const normalizedRole = String(role || 'unscoped');
      const inputTokens = estimateInputTokens(promptText);
      const outputTokens = Number.isFinite(maxOutputTokens) && maxOutputTokens > 0 ? Number(maxOutputTokens) : 1500;
      const estimate = estimateUsageCost({
        provider: normalizedProvider,
        model: normalizedModel,
        inputTokens,
        outputTokens,
      });
      const attemptId = String(idFactory());
      const reservation = {
        runId,
        attemptId,
        provider: normalizedProvider,
        model: normalizedModel,
        role: normalizedRole,
        reservedUsd: estimate.usd,
        reservedBasis: estimate.basis,
        rateProvenance: estimate.quote.provenance,
      };
      wrapPersistence(() => store.reserveBudgetAttempt(reservation), 'reservation');
      return {
        metered: estimate.basis !== 'not_metered_here',
        tracked: true,
        ...reservation,
        reserveBasis: estimate.basis,
        quote: estimate.quote,
      };
    },

    settleAttempt(
      reservation,
      {
        inputTokens = 0,
        outputTokens = 0,
        reportedCostPresent = false,
        reportedCost = null,
        provider = reservation?.provider,
        model = reservation?.model,
        tokenUsagePresent = true,
      } = {},
    ) {
      if (!reservation?.attemptId) {
        throw new BudgetPersistenceError('Cannot settle a budget attempt without a durable reservation id');
      }

      if (!reservation.metered) {
        const settlement = {
          usd: 0,
          basis: 'not_metered_here',
          provenance: reservation?.rateProvenance || lookupRateQuote({ provider, model }).provenance,
        };
        wrapPersistence(
          () =>
            store.settleBudgetAttempt({
              runId,
              provider: reservation.provider,
              attemptId: reservation.attemptId,
              costUsd: settlement.usd,
              costBasis: settlement.basis,
              costProvenance: settlement.provenance,
              inputTokens: nonNegativeTokenCount(inputTokens),
              outputTokens: nonNegativeTokenCount(outputTokens),
            }),
          'settlement',
        );
        return settlement;
      }

      let settlement;
      if (reportedCostPresent) {
        const usd = Number(reportedCost);
        if (!Number.isFinite(usd) || usd < 0) {
          throw new BudgetPersistenceError(
            `Provider-reported cost must be a finite non-negative number, got ${reportedCost}`,
          );
        }
        settlement = {
          usd,
          basis: 'provider_reported',
          provenance: {
            source: 'provider_response_usage',
            sourceUrl: null,
            recordedAt: new Date().toISOString(),
            provider: String(provider || reservation.provider || 'unknown'),
            model: String(model || reservation.model || 'unknown'),
          },
        };
      } else {
        if (!tokenUsagePresent) {
          tracker.markAttemptAmbiguous(reservation, {
            reason: 'Provider returned neither cost nor usable token counts for catalog estimation.',
          });
          return {
            usd: null,
            basis: 'unresolved',
            ceilingExposureUsd: reservation.reservedUsd,
            provenance: {
              ...lookupRateQuote({ provider, model }).provenance,
              note: 'Missing cost and token usage; the pre-dispatch reservation remains charged.',
            },
          };
        }
        const estimated = estimateUsageCost({ provider, model, inputTokens, outputTokens });
        if (estimated.basis === 'conservative_bound' || estimated.basis === 'not_metered_here') {
          tracker.markAttemptAmbiguous(reservation, {
            reason:
              estimated.basis === 'not_metered_here'
                ? 'A metered reservation returned no cost but identified a route classified as not metered here.'
                : 'Provider returned no cost and the observed provider/model has no catalog rate.',
          });
          return {
            usd: null,
            basis: 'unresolved',
            ceilingExposureUsd: reservation.reservedUsd,
            provenance: estimated.quote.provenance,
          };
        }
        settlement = {
          usd: estimated.usd,
          basis: estimated.basis,
          provenance: estimated.quote.provenance,
        };
      }

      wrapPersistence(
        () =>
          store.settleBudgetAttempt({
            runId,
            provider: reservation.provider,
            attemptId: reservation.attemptId,
            costUsd: settlement.usd,
            costBasis: settlement.basis,
            costProvenance: settlement.provenance,
            inputTokens: nonNegativeTokenCount(inputTokens),
            outputTokens: nonNegativeTokenCount(outputTokens),
          }),
        'settlement',
      );
      const summary = readSummary();
      if (summary.ceilingExposureUsd > maxUsd) {
        throw new BudgetExceededError(
          `BudgetExceeded: recorded exposure $${summary.ceilingExposureUsd.toFixed(4)} exceeds ceiling $${maxUsd.toFixed(2)} after durable settlement`,
          { accumulatedUsd: summary.ceilingExposureUsd, estimateUsd: 0, maxUsd },
        );
      }
      return settlement;
    },

    markAttemptAmbiguous(reservation, { reason = '' } = {}) {
      if (!reservation?.attemptId) return null;
      return wrapPersistence(
        () =>
          store.markBudgetAttemptAmbiguous({
            runId,
            provider: reservation.provider,
            attemptId: reservation.attemptId,
            reason: String(reason || ''),
          }),
        'ambiguous-attempt update',
      );
    },

    record({ inputTokens = 0, outputTokens = 0, cost = 0 } = {}) {
      const attemptId = String(idFactory());
      const reservation = {
        runId,
        attemptId,
        provider: 'legacy-record',
        model: 'legacy-record',
        role: 'legacy-record',
        reservedUsd: 0,
        reservedBasis: 'conservative_bound',
        rateProvenance: { source: 'legacy record() caller', recordedAt: new Date().toISOString() },
      };
      wrapPersistence(() => store.reserveBudgetAttempt(reservation), 'legacy reservation');
      wrapPersistence(
        () =>
          store.settleBudgetAttempt({
            runId,
            provider: reservation.provider,
            attemptId,
            costUsd: finiteNonNegative(cost),
            costBasis: 'provider_reported',
            costProvenance: reservation.rateProvenance,
            inputTokens: nonNegativeTokenCount(inputTokens),
            outputTokens: nonNegativeTokenCount(outputTokens),
          }),
        'legacy settlement',
      );
      const summary = readSummary();
      if (summary.ceilingExposureUsd > maxUsd) {
        throw new BudgetExceededError(
          `BudgetExceeded: recorded exposure $${summary.ceilingExposureUsd.toFixed(4)} exceeds ceiling $${maxUsd.toFixed(2)} after durable settlement`,
          { accumulatedUsd: summary.ceilingExposureUsd, estimateUsd: 0, maxUsd },
        );
      }
    },

    summary() {
      const summary = readSummary();
      return {
        ...summary,
        accumulatedUsd: summary.ceilingExposureUsd,
        callCount: summary.attemptCount,
        utilizationPct: maxUsd > 0 ? (summary.ceilingExposureUsd / maxUsd) * 100 : 0,
      };
    },

    snapshot() {
      return readSummary();
    },

    delta(snapshot) {
      const now = readSummary();
      const previous = snapshot || {};
      const settledCost = (summary) =>
        finiteNonNegative(summary.providerReportedUsd) +
        finiteNonNegative(summary.catalogEstimatedUsd) +
        finiteNonNegative(summary.conservativeBoundUsd);
      return {
        cost: settledCost(now) - settledCost(previous),
        ceilingExposureUsd: now.ceilingExposureUsd - finiteNonNegative(previous.ceilingExposureUsd),
        pendingExposureUsd: now.pendingExposureUsd - finiteNonNegative(previous.pendingExposureUsd),
        ambiguousExposureUsd: now.ambiguousExposureUsd - finiteNonNegative(previous.ambiguousExposureUsd),
        inputTokens: now.totalInputTokens - finiteNonNegative(previous.totalInputTokens),
        outputTokens: now.totalOutputTokens - finiteNonNegative(previous.totalOutputTokens),
        apiCalls: now.attemptCount - finiteNonNegative(previous.attemptCount),
      };
    },
  };

  return tracker;
}
