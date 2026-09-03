/**
 * Sampling parameters the Anthropic Messages API accepts for a given model.
 *
 * Opus 4.7 and later, and every 5-series model (Sonnet 5, Opus 5, Fable),
 * reject a non-default `temperature`, `top_p` or `top_k` with HTTP 400.
 * For those models this returns `{}` so the request omits the fields.
 * Older models keep the caller's values. As before, `top_p` replaces
 * `temperature` when both are given.
 *
 * Pure function, no imports: safe to load from any layer.
 */

const FIXED_SAMPLING_MODELS = /^claude-(?:[a-z]+-5(?:[-.]|$)|opus-4[-.][7-9]|fable-|mythos-)/;

export function anthropicSamplingParams(model, { temperature, top_p } = {}) {
  if (FIXED_SAMPLING_MODELS.test(String(model || ''))) return {};
  if (top_p !== undefined) return { top_p };
  if (temperature !== undefined) return { temperature };
  return {};
}

export default { anthropicSamplingParams };
