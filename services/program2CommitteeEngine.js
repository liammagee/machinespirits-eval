// Program-2 Phase 5 live committee engine
// (PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md §2).
//
// The pure pieces of the fail-closed protected-span committee: question-span
// extraction and whitespace normalization (byte-identical rules to the
// offline coupling probe, scripts/program2-coupling-probe.mjs), the frozen
// composition block, the pre-delivery battery, and the mini's ollama client
// on the frozen Phase 2 serving pin (native /api/chat — the OpenAI shim
// silently ignores num_ctx and think — think:false, greedy, 600 s request
// ceiling; same shape as scripts/program2-floor-grader.mjs).
import http from 'node:http';

export const PROGRAM2_COMMITTEE_SCHEMA = 'machinespirits.tutor-stub.program2-committee-moment.v1';

export const PROGRAM2_COMMITTEE_DEFAULTS = Object.freeze({
  miniModel: 'program2-sft-instruct-v2',
  ollamaUrl: 'http://127.0.0.1:11434',
  numCtx: 16384,
  timeoutMs: 600_000,
});

// Probe-identical: maximal '?'-terminated substrings, trimmed, > 8 chars.
export function committeeQuestionSentences(text) {
  return (String(text || '').match(/[^.!?\n]+\?/gu) || []).map((s) => s.trim()).filter((s) => s.length > 8);
}

// Probe-identical whitespace normalization for verbatim containment.
export function normalizeCommitteeWhitespace(text) {
  return String(text || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

// Probe-identical composition requirements around the protected span.
export function buildCommitteeCompositionBlock(span) {
  return [
    '--- Composition task (harness instruction) ---',
    'Compose your tutor turn for this moment. Requirements:',
    `1. Include this question VERBATIM, word for word, as the turn's only question: "${span}"`,
    '2. Ask no other question anywhere in the turn.',
    '3. Introduce no new case facts, clues, or evidence the dialogue has not already made public.',
    '4. Keep the scene voice and address the learner directly.',
    'Write only the tutor turn.',
  ].join('\n');
}

// Pre-delivery battery (prereg §2.4): non-empty AND verbatim span containment
// AND exactly one question mark. Any failure keeps the mini's own reply.
export function runCommitteeBattery({ composedText, span }) {
  const composed = String(composedText || '').trim();
  const questionCount = (composed.match(/\?/gu) || []).length;
  const checks = {
    non_empty: composed.length > 0,
    span_contained:
      composed.length > 0 && normalizeCommitteeWhitespace(composed).includes(normalizeCommitteeWhitespace(span)),
    exactly_one_question: questionCount === 1,
  };
  const failedCheck = Object.entries(checks).find(([, ok]) => !ok)?.[0] || null;
  return { pass: !failedCheck, checks, questionCount, failedCheck };
}

function postJson(urlString, body, { timeoutMs }) {
  const url = new URL(urlString);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`ollama ${res.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.setTimeout(timeoutMs, () =>
      req.destroy(new Error(`ollama request timeout (${Math.round(timeoutMs / 1000)}s)`)),
    );
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });
}

export async function committeeMiniGenerate({
  url = PROGRAM2_COMMITTEE_DEFAULTS.ollamaUrl,
  model = PROGRAM2_COMMITTEE_DEFAULTS.miniModel,
  systemPrompt,
  messages,
  numCtx = PROGRAM2_COMMITTEE_DEFAULTS.numCtx,
  maxTokens = 4096,
  timeoutMs = PROGRAM2_COMMITTEE_DEFAULTS.timeoutMs,
}) {
  const startedAt = Date.now();
  const data = await postJson(
    `${String(url)
      .replace(/\/v1\/?$/u, '')
      .replace(/\/$/u, '')}/api/chat`,
    {
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: false,
      think: false,
      options: {
        temperature: 0,
        num_ctx: numCtx,
        num_predict: maxTokens,
      },
    },
    { timeoutMs },
  );
  return { text: data.message?.content ?? '', latencyMs: Date.now() - startedAt };
}
