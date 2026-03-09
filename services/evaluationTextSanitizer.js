const THINK_BLOCK_RE = /<think\b[^>]*>[\s\S]*?<\/think>/gi;
// Unclosed <think> — tag opened but never closed (truncation or malformed output)
const THINK_UNCLOSED_RE = /<think\b[^>]*>[\s\S]*$/gi;

/**
 * Remove provider-internal reasoning blocks before evaluation/scoring.
 * Handles both closed (<think>...</think>) and unclosed (<think>...EOF) blocks.
 * Keeps the surrounding user-facing text intact.
 */
export function stripThinkBlocks(text) {
  if (typeof text !== 'string') return text;

  return text
    .replace(/\r\n/g, '\n')
    .replace(THINK_BLOCK_RE, ' ')
    .replace(THINK_UNCLOSED_RE, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Recursively sanitize strings inside an object/array for evaluation-time use.
 */
export function sanitizeEvaluationValue(value) {
  if (typeof value === 'string') return stripThinkBlocks(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeEvaluationValue(item));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizeEvaluationValue(entry)]));
}
