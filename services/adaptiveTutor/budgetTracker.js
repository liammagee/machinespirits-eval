// Pre-call cost gate + post-call cost accumulator for the adaptive cell's
// real-LLM runs. Exists because ADAPTIVE_TUTOR_LLM=real with frontier
// models on a multi-cell A13 sweep can quietly burn through hundreds of
// dollars; this turns that quiet burn into a clean abort.
//
// Design choices, all heuristic and intentional:
//
//   - Tokenisation: 4-chars-per-token, no gpt-tokenizer dep. The estimate
//     gates a single-call abort — ±20% is fine.
//   - Per-model rates live in COSTS_PER_1K_TOKENS below. Misses fall back
//     to a deliberately conservative default so the gate errs on the side
//     of throwing too early.
//   - Accumulated cost uses the EXACT `cost` field returned by tutor-core's
//     callAI (flat, not nested under `usage`). So total spend is always
//     truthful even when the pre-call estimate is off.
//
// Public surface mirrors what comprehensive-strategy.md Phase 1 §1 names:
//   create({ maxUsd })
//   estimate(promptText, maxOutputTokens, model) -> usd
//   record({ inputTokens, outputTokens, cost })
//   assertBelowCeiling(estimateUsd)

const COSTS_PER_1K_TOKENS = {
  // Approximate Q1-2026 USD/1k tokens, [input, output]. Used by the pre-call
  // estimate AND (via realLLM.js) by the post-call cost synthesizer for
  // providers like Anthropic-direct that don't return cost in usage.
  'anthropic/claude-sonnet-4.6': [0.003, 0.015],
  'anthropic/claude-opus-4.6': [0.015, 0.075],
  'anthropic/claude-haiku-4.5': [0.0008, 0.004],
  // Bare Anthropic IDs returned by the direct API (no provider prefix).
  // Same per-token rates as the OpenRouter-prefixed variants — pricing
  // tracks the model, not the route.
  'claude-sonnet-4-5': [0.003, 0.015],
  'claude-sonnet-4-6': [0.003, 0.015],
  'claude-opus-4-6': [0.015, 0.075],
  'claude-haiku-4-5': [0.0008, 0.004],
  'openai/gpt-5.2': [0.005, 0.015],
  'openai/gpt-5-mini': [0.00025, 0.001],
  'openai/gpt-5.4': [0.0075, 0.03],
  'openai/gpt-5.4-pro': [0.015, 0.06],
  'google/gemini-3-pro-preview': [0.00125, 0.005],
  'google/gemini-3-flash-preview': [0.000075, 0.0003],
  'nvidia/nemotron-3-nano-30b-a3b': [0.0001, 0.0003],
  'z-ai/glm-4.7': [0.00015, 0.0006],
  'z-ai/glm-5': [0.0006, 0.0024],
  'deepseek/deepseek-v3.2': [0.0001, 0.0003],
  'moonshotai/kimi-k2-thinking': [0.0006, 0.0024],
  'moonshotai/kimi-k2.5': [0.0008, 0.0032],
};

// Conservative default: roughly frontier-tier so unknown models can't
// silently burn through the ceiling on the basis of an underestimate.
const DEFAULT_COSTS_PER_1K = [0.01, 0.03];

export function lookupRates(model) {
  if (!model) return DEFAULT_COSTS_PER_1K;
  return COSTS_PER_1K_TOKENS[model] ?? DEFAULT_COSTS_PER_1K;
}

function estimateInputTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
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

export function createBudgetTracker({ maxUsd } = {}) {
  if (typeof maxUsd !== 'number' || !(maxUsd > 0)) {
    throw new Error('createBudgetTracker requires { maxUsd: number > 0 }');
  }

  let accumulated = 0;
  const calls = [];

  return {
    get accumulatedUsd() {
      return accumulated;
    },
    get maxUsd() {
      return maxUsd;
    },
    get callCount() {
      return calls.length;
    },

    estimate(promptText, maxOutputTokens, model) {
      const [inRate, outRate] = lookupRates(model);
      const inputTokens = estimateInputTokens(promptText);
      const outputTokens = Number.isFinite(maxOutputTokens) && maxOutputTokens > 0
        ? Number(maxOutputTokens)
        : 1500;
      return (inputTokens / 1000) * inRate + (outputTokens / 1000) * outRate;
    },

    assertBelowCeiling(estimateUsd) {
      const est = Number(estimateUsd) || 0;
      const projected = accumulated + est;
      if (projected > maxUsd) {
        throw new BudgetExceededError(
          `BudgetExceeded: accumulated $${accumulated.toFixed(4)} + estimate $${est.toFixed(4)} = $${projected.toFixed(4)} > ceiling $${maxUsd.toFixed(2)}`,
          { accumulatedUsd: accumulated, estimateUsd: est, maxUsd },
        );
      }
    },

    record({ inputTokens = 0, outputTokens = 0, cost = 0 } = {}) {
      const c = Number(cost) || 0;
      accumulated += c;
      calls.push({
        inputTokens: Number(inputTokens) || 0,
        outputTokens: Number(outputTokens) || 0,
        cost: c,
      });
    },

    summary() {
      const totalIn = calls.reduce((s, c) => s + c.inputTokens, 0);
      const totalOut = calls.reduce((s, c) => s + c.outputTokens, 0);
      return {
        accumulatedUsd: accumulated,
        maxUsd,
        callCount: calls.length,
        totalInputTokens: totalIn,
        totalOutputTokens: totalOut,
        utilizationPct: maxUsd > 0 ? (accumulated / maxUsd) * 100 : 0,
      };
    },
  };
}
