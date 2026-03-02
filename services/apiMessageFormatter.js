/**
 * API Message Formatter
 *
 * Formats captured API call records into a readable console display.
 * Used by --show-messages flag during eval runs.
 */

const SYSTEM_TRUNCATE = 200;
const MESSAGE_TRUNCATE = 500;

function truncate(text, maxLen) {
  if (!text || typeof text !== 'string') return text;
  if (maxLen <= 0 || text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((b) => (typeof b === 'string' ? b : b?.text || `[${b?.type || '?'}]`)).join('');
  }
  return content == null ? '' : String(content);
}

/** Infer agent role (ego/superego/learner) from system prompt keywords. */
function inferRole(body) {
  const systemText =
    typeof body?.system === 'string'
      ? body.system
      : Array.isArray(body?.messages)
        ? body.messages.find((m) => m.role === 'system')?.content || ''
        : '';
  const sys = extractText(systemText).toLowerCase();

  if (sys.includes('superego') || sys.includes('critic') || sys.includes('review the following')) return 'superego';
  if (sys.includes('learner') && sys.includes('ego')) return 'learner';
  if (sys.includes('tutor') || sys.includes('pedagog')) return 'ego';
  return null;
}

/** Extract messages handling OpenAI-style and Anthropic-style formats. */
function extractMessages(body) {
  if (!body || typeof body !== 'object') return [];
  const messages = [];
  if (body.system) messages.push({ role: 'system', content: extractText(body.system) });
  if (Array.isArray(body.messages)) {
    for (const msg of body.messages) {
      messages.push({ role: msg.role, content: extractText(msg.content) });
    }
  }
  return messages;
}

function extractTokens(responseBody) {
  const usage = responseBody?.usage;
  if (!usage) return null;
  return {
    input: usage.prompt_tokens ?? usage.input_tokens ?? null,
    output: usage.completion_tokens ?? usage.output_tokens ?? null,
  };
}

function formatRecord(record, index, { systemMaxLen, messageMaxLen }) {
  const body = record.request?.body;
  if (!body || typeof body !== 'object') return '';

  const provider = record.provider || '?';
  const model = body.model || '?';
  const role = inferRole(body);
  const roleLabel = role ? ` (${role})` : '';
  const sec = record.durationMs != null ? (record.durationMs / 1000).toFixed(1) : '?';

  const tokens = extractTokens(record.response?.json || record.response?.body);
  const tokenStr = tokens
    ? `${tokens.input?.toLocaleString() ?? '?'} in / ${tokens.output?.toLocaleString() ?? '?'} out`
    : '';

  const messages = extractMessages(body);
  if (messages.length === 0) return '';

  const lines = [];
  const header = `API Call #${index + 1}: ${provider}${roleLabel} — ${model}`;
  lines.push(`┌─ ${header} ${'─'.repeat(Math.max(0, 52 - header.length))}`);

  for (const msg of messages) {
    const maxLen = msg.role === 'system' ? systemMaxLen : messageMaxLen;
    const content = maxLen > 0 ? truncate(msg.content, maxLen) : msg.content;
    const indented = (content || '').replace(/\n/g, `\n│ ${''.padEnd(13)}`);
    lines.push(`│ ${msg.role.padEnd(10)}: ${indented}`);
  }

  const footerParts = [tokenStr, `${sec}s`].filter(Boolean);
  lines.push(`└─ ${footerParts.join(' — ')} ${'─'.repeat(Math.max(0, 52 - footerParts.join(' — ').length))}`);

  return lines.join('\n');
}

/**
 * Format and print all captured API records for a generation turn.
 * @param {Array} records - Captured API records from apiPayloadCapture
 * @param {Object} opts
 * @param {boolean|string} opts.showMessages - true for truncated, 'full' for untruncated
 */
export function formatApiMessages(records, opts = {}) {
  if (!Array.isArray(records) || records.length === 0) return;

  const full = opts.showMessages === 'full';
  const systemMaxLen = full ? 0 : SYSTEM_TRUNCATE;
  const messageMaxLen = full ? 0 : MESSAGE_TRUNCATE;

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  API Messages (${records.length} call${records.length !== 1 ? 's' : ''})`);
  console.log(`${'═'.repeat(56)}`);

  for (let i = 0; i < records.length; i++) {
    const out = formatRecord(records[i], i, { systemMaxLen, messageMaxLen });
    if (out) console.log(out);
  }

  console.log('');
}
