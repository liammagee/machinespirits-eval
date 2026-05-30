/**
 * AI Model Pricing Configuration
 * Per 1M tokens pricing for various providers and models
 */

export const MODEL_PRICING = {
  // Free tier
  'openrouter.nemotron': { input: 0, output: 0, tier: 'free' },

  // Budget tier ($0-2 per 1M tokens)
  'openrouter.haiku': { input: 0.80, output: 4.00, tier: 'budget' },
  'openrouter.gpt-mini': { input: 0.15, output: 0.60, tier: 'budget' },
  'openrouter.gemini-flash': { input: 0.075, output: 0.30, tier: 'budget' },

  // Mid tier ($2-10 per 1M tokens)
  'openrouter.sonnet': { input: 3.00, output: 15.00, tier: 'mid' },
  'openrouter.deepseek': { input: 0.27, output: 1.10, tier: 'mid' },
  'openrouter.gpt': { input: 5.00, output: 15.00, tier: 'mid' },

  // Premium tier ($10+ per 1M tokens)
  'openrouter.opus': { input: 15.00, output: 75.00, tier: 'premium' },
  'openrouter.gemini-pro': { input: 1.25, output: 5.00, tier: 'mid' },

  // Direct API pricing
  'anthropic.haiku': { input: 0.80, output: 4.00, tier: 'budget' },
  'anthropic.sonnet': { input: 3.00, output: 15.00, tier: 'mid' },
  'anthropic.opus': { input: 15.00, output: 75.00, tier: 'premium' },
  'openai.mini': { input: 0.15, output: 0.60, tier: 'budget' },
  'openai.standard': { input: 5.00, output: 15.00, tier: 'mid' },
  'gemini.flash': { input: 0.075, output: 0.30, tier: 'budget' },
  'gemini.pro': { input: 1.25, output: 5.00, tier: 'mid' },
};

/**
 * Calculate cost for a given token usage
 */
export function calculateCost(modelRef, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[modelRef];
  if (!pricing) {
    return { cost: 0, tier: 'unknown', estimated: true };
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    tier: pricing.tier,
    estimated: false,
  };
}
