export const TOKEN_USAGE_FIELDS = Object.freeze([
  'inputTokens',
  'cachedInputTokens',
  'uncachedInputTokens',
  'outputTokens',
  'reasoningOutputTokens',
  'totalTokens',
]);

function finiteNonnegative(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function firstUsageValue(usage, keys) {
  for (const key of keys) {
    const value = finiteNonnegative(usage?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function unavailableTokenUsage() {
  return {
    inputTokens: null,
    cachedInputTokens: null,
    uncachedInputTokens: null,
    outputTokens: null,
    reasoningOutputTokens: null,
    totalTokens: null,
    tokenUsageAvailable: false,
  };
}

export function normalizeTokenUsage(usage, { available } = {}) {
  if (!usage || typeof usage !== 'object' || available === false) return unavailableTokenUsage();

  const inputTokens = firstUsageValue(usage, ['inputTokens', 'input_tokens', 'promptTokens', 'prompt_tokens']);
  const cachedInputTokens = firstUsageValue(usage, ['cachedInputTokens', 'cached_input_tokens']);
  const outputTokens = firstUsageValue(usage, [
    'outputTokens',
    'output_tokens',
    'completionTokens',
    'completion_tokens',
  ]);
  const reasoningOutputTokens = firstUsageValue(usage, ['reasoningOutputTokens', 'reasoning_output_tokens']);
  const reportedTotalTokens = firstUsageValue(usage, ['totalTokens', 'total_tokens']);
  const totalTokens =
    reportedTotalTokens ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null);
  const normalized = {
    inputTokens,
    cachedInputTokens,
    uncachedInputTokens: inputTokens !== null && cachedInputTokens !== null ? inputTokens - cachedInputTokens : null,
    outputTokens,
    reasoningOutputTokens,
    totalTokens,
  };
  const tokenUsageAvailable = TOKEN_USAGE_FIELDS.some((field) => normalized[field] !== null);
  return tokenUsageAvailable ? { ...normalized, tokenUsageAvailable: true } : unavailableTokenUsage();
}

export function tokenUsageFields(usage) {
  return Object.fromEntries(TOKEN_USAGE_FIELDS.map((field) => [field, usage?.[field] ?? null]));
}

export function aggregateTokenUsage(records = []) {
  const rows = Array.isArray(records) ? records : [];
  if (!rows.length) return unavailableTokenUsage();
  const normalized = rows.map((record) =>
    normalizeTokenUsage(record?.usage ?? record, {
      available: record?.tokenUsageAvailable,
    }),
  );
  const aggregated = Object.fromEntries(
    TOKEN_USAGE_FIELDS.map((field) => [
      field,
      normalized.every((usage) => usage[field] !== null)
        ? normalized.reduce((sum, usage) => sum + usage[field], 0)
        : null,
    ]),
  );
  return {
    ...aggregated,
    tokenUsageAvailable: normalized.every((usage) => usage.tokenUsageAvailable === true),
  };
}
