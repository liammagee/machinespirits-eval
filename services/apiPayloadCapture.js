import { AsyncLocalStorage } from 'async_hooks';

const DEFAULT_ENABLED = process.env.EVAL_CAPTURE_API_PAYLOADS !== 'false';
const DEFAULT_MAX_CHARS = Number.parseInt(process.env.EVAL_CAPTURE_API_PAYLOAD_MAX_CHARS || '120000', 10);
const MAX_CHARS = Number.isFinite(DEFAULT_MAX_CHARS) && DEFAULT_MAX_CHARS > 0 ? DEFAULT_MAX_CHARS : 120000;

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'x-openai-api-key',
  'cookie',
  'set-cookie',
]);

const captureContext = new AsyncLocalStorage();
let installed = false;
let originalFetch = null;
let globalOnRecord = null;

/**
 * Register a global callback fired for every captured LLM API record.
 * Called even when there is no active captureApiCalls() scope.
 * Pass null to unregister.
 */
export function setGlobalOnRecord(fn) {
  globalOnRecord = typeof fn === 'function' ? fn : null;
  // Ensure the fetch wrapper is installed so unscoped calls are intercepted
  if (globalOnRecord) ensureInstalled();
}

function clip(text, limit = MAX_CHARS) {
  if (text == null) return null;
  const str = String(text);
  if (str.length <= limit) return str;
  return `${str.slice(0, limit)}... [truncated ${str.length - limit} chars]`;
}

function safeJsonParse(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function truncateValue(value, limit = MAX_CHARS) {
  if (value == null) return null;
  if (typeof value === 'string') return clip(value, limit);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => truncateValue(v, limit));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = truncateValue(v, limit);
  }
  return out;
}

function sanitizeHeaders(headersLike) {
  const out = {};
  try {
    const headers = new Headers(headersLike || {});
    for (const [key, value] of headers.entries()) {
      const lower = key.toLowerCase();
      out[key] = SENSITIVE_HEADERS.has(lower) ? '[REDACTED]' : value;
    }
  } catch {
    return out;
  }
  return out;
}

function inferProvider(url) {
  if (!url) return null;
  if (url.includes('openrouter.ai')) return 'openrouter';
  if (url.includes('api.anthropic.com')) return 'anthropic';
  if (url.includes('api.openai.com')) return 'openai';
  if (url.includes('generativelanguage.googleapis.com')) return 'gemini';
  if (url.includes('localhost') || url.includes('127.0.0.1')) return 'local';
  return null;
}

function shouldCapture(url) {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('openrouter.ai') ||
    url.includes('api.anthropic.com') ||
    url.includes('api.openai.com') ||
    url.includes('generativelanguage.googleapis.com') ||
    url.includes('localhost') ||
    url.includes('127.0.0.1')
  );
}

function extractUrl(input) {
  if (typeof input === 'string') return input;
  if (input && typeof input.url === 'string') return input.url;
  return null;
}

function extractMethod(input, init) {
  const fromInit = init?.method;
  if (fromInit) return String(fromInit).toUpperCase();
  const fromRequest = input?.method;
  if (fromRequest) return String(fromRequest).toUpperCase();
  return 'GET';
}

async function extractRequestBody(input, init, maxChars = MAX_CHARS) {
  try {
    const body = init?.body;
    if (typeof body === 'string') return clip(body, maxChars);
    if (body instanceof URLSearchParams) return clip(body.toString(), maxChars);
    if (body instanceof Uint8Array) return clip(Buffer.from(body).toString('utf8'), maxChars);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) return clip(body.toString('utf8'), maxChars);
    if (body == null && input instanceof Request) {
      const cloned = input.clone();
      const text = await cloned.text();
      return clip(text, maxChars);
    }
  } catch {
    return null;
  }
  return null;
}

function extractGenerationId(responseJson) {
  if (!responseJson || typeof responseJson !== 'object') return null;
  return responseJson.id || responseJson.generation_id || responseJson.generationId || null;
}

async function snapshotResponse(response, maxChars = MAX_CHARS) {
  const base = {
    status: response?.status ?? null,
    ok: Boolean(response?.ok),
    headers: sanitizeHeaders(response?.headers),
    json: null,
    text: null,
  };
  try {
    const cloned = response.clone();
    const text = await cloned.text();
    const parsed = safeJsonParse(text);
    if (parsed) base.json = truncateValue(parsed, maxChars);
    else base.text = clip(text, maxChars);
  } catch {
    // noop
  }
  return base;
}

function ensureInstalled() {
  if (installed) return;
  if (typeof globalThis.fetch !== 'function') return;
  originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async function wrappedFetch(input, init) {
    const scope = captureContext.getStore();
    const url = extractUrl(input);
    const scopeEnabled = Boolean(scope?.enabled) && shouldCapture(url);
    const globalEnabled = Boolean(globalOnRecord) && shouldCapture(url);
    if (!scopeEnabled && !globalEnabled) {
      return originalFetch(input, init);
    }

    const maxChars = scope?.maxChars || MAX_CHARS;
    const startedAt = Date.now();
    const method = extractMethod(input, init);
    const requestBodyText = await extractRequestBody(input, init, maxChars);
    const requestBodyJson = requestBodyText ? truncateValue(safeJsonParse(requestBodyText), maxChars) : null;
    const requestHeaders = sanitizeHeaders(init?.headers || input?.headers);

    let response;
    let responseSnapshot = null;
    let error = null;
    try {
      response = await originalFetch(input, init);
      responseSnapshot = await snapshotResponse(response, maxChars);
      return response;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const durationMs = Date.now() - startedAt;
      const generationId = extractGenerationId(responseSnapshot?.json);
      const record = {
        timestamp: new Date().toISOString(),
        durationMs,
        provider: inferProvider(url),
        url,
        method,
        generationId,
        request: {
          headers: requestHeaders,
          body: requestBodyJson ?? requestBodyText,
        },
        response: responseSnapshot || null,
        error: error ? clip(error.message || String(error), maxChars) : null,
      };
      if (scopeEnabled) {
        scope.records.push(record);
      }
      if (globalOnRecord) {
        try { globalOnRecord(record); } catch { /* swallow display errors */ }
      }
    }
  };
  installed = true;
}

function isTutorTraceEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (!entry.agent || !entry.action) return false;
  if (entry.agent === 'ego' && (entry.action === 'generate' || entry.action === 'revise' || entry.action === 'incorporate-feedback')) {
    return true;
  }
  if (entry.agent === 'superego' && entry.action === 'review') return true;
  return false;
}

function claimMatchingRecord(records, used, entry) {
  const metrics = entry?.metrics || {};
  const generationId = metrics.generationId || null;

  if (generationId) {
    const idx = records.findIndex((r, i) => !used.has(i) && r.generationId && r.generationId === generationId);
    if (idx !== -1) return { idx, reason: 'generation_id' };
  }

  const entryModel = metrics.model || entry.model || null;
  const entryProvider = metrics.provider || entry.provider || null;
  if (entryModel) {
    const idx = records.findIndex((r, i) => {
      if (used.has(i)) return false;
      const requestModel = r.request?.body?.model || null;
      if (requestModel && requestModel !== entryModel) return false;
      if (entryProvider && r.provider && r.provider !== entryProvider) return false;
      return true;
    });
    if (idx !== -1) return { idx, reason: 'heuristic_model_order' };
  }

  const fallbackIdx = records.findIndex((_, i) => !used.has(i));
  if (fallbackIdx !== -1) return { idx: fallbackIdx, reason: 'heuristic_order' };
  return { idx: -1, reason: null };
}

function normalizeCapturedRecord(record, reason) {
  return {
    captureVersion: 1,
    source: 'fetch_capture',
    matchReason: reason,
    capturedAt: record.timestamp,
    durationMs: record.durationMs,
    provider: record.provider,
    endpoint: record.url,
    generationId: record.generationId || null,
    request: {
      method: record.method,
      headers: record.request?.headers || {},
      body: record.request?.body ?? null,
    },
    response: {
      status: record.response?.status ?? null,
      ok: record.response?.ok ?? null,
      headers: record.response?.headers || {},
      body: record.response?.json ?? record.response?.text ?? null,
      error: record.error || null,
    },
  };
}

export async function captureApiCalls(fn, options = {}) {
  const enabled = options.enabled ?? DEFAULT_ENABLED;
  const maxChars = Number.isFinite(options.maxChars) && options.maxChars > 0 ? options.maxChars : MAX_CHARS;
  if (!enabled || typeof fn !== 'function') {
    return { result: await fn(), records: [] };
  }
  ensureInstalled();
  const context = { enabled: true, maxChars, records: [] };
  const result = await captureContext.run(context, async () => fn());
  return { result, records: context.records };
}

export function attachApiPayloadsToTrace(dialogueTrace, records = []) {
  if (!Array.isArray(dialogueTrace) || dialogueTrace.length === 0) return dialogueTrace;
  if (!Array.isArray(records) || records.length === 0) return dialogueTrace;

  const used = new Set();
  return dialogueTrace.map((entry) => {
    if (!isTutorTraceEntry(entry)) return entry;
    const { idx, reason } = claimMatchingRecord(records, used, entry);
    if (idx === -1) return entry;
    used.add(idx);
    const captured = normalizeCapturedRecord(records[idx], reason);
    return { ...entry, apiPayload: captured };
  });
}

