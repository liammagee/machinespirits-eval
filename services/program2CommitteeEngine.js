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

// Mirror of the frozen detector's warrant-cue lexicon
// (services/tutorStubPointOfActionCoaching.js WARRANT_CUE_RE) — the v1
// instrument, unchanged by user decision 2026-07-20.
export const PROGRAM2_WARRANT_CUE_RE = /\b(?:evidence|item|test|record|fact|rule)\b/iu;

// Probe-identical: maximal '?'-terminated substrings, trimmed, > 8 chars.
export function committeeQuestionSentences(text) {
  return (String(text || '').match(/[^.!?\n]+\?/gu) || []).map((s) => s.trim()).filter((s) => s.length > 8);
}

// Phase 5b fallback battery (PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md §2):
// a mini reply is deliverable as-is when it carries exactly one question and
// the frozen cue somewhere in the turn.
export function committeeFallbackBatteryPass(text) {
  const questionCount = (String(text || '').match(/\?/gu) || []).length;
  return questionCount === 1 && PROGRAM2_WARRANT_CUE_RE.test(String(text || ''));
}

// Phase 5b §2 step 3: keep the question sentence containing a cue word if
// one exists (else the first question); delete the other question sentences.
export function trimCommitteeFallback(text) {
  const source = String(text || '');
  const questions = source.match(/[^.!?\n]+\?/gu) || [];
  if (questions.length <= 1) return { text: source, changed: false, keptQuestion: questions[0]?.trim() || null };
  const kept = questions.find((q) => PROGRAM2_WARRANT_CUE_RE.test(q)) || questions[0];
  let trimmed = source;
  for (const question of questions) {
    if (question === kept) continue;
    trimmed = trimmed.replace(question, '');
  }
  trimmed = trimmed
    .replace(/[ \t]+/gu, ' ')
    .replace(/ +\n/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
  return { text: trimmed, changed: true, keptQuestion: kept.trim() };
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
  temperature = 0,
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
        temperature,
        num_ctx: numCtx,
        num_predict: maxTokens,
      },
    },
    { timeoutMs },
  );
  return { text: data.message?.content ?? '', latencyMs: Date.now() - startedAt };
}

// Phase 5d spanCue.v1 (PROGRAM-2-PHASE5D-DELIVERY-INTEGRITY-PREREGISTRATION.md
// §2.1): do the extracted question sentences carry the frozen cue?
export function committeeSpanCarriesCue(spans) {
  return PROGRAM2_WARRANT_CUE_RE.test((spans || []).join(' '));
}

// Phase 5d §3 census rule: the text the committee approved for delivery —
// the composed turn on the composed path, else the resolved fallback text.
export function committeeApprovedText(moment) {
  if (!moment) return '';
  if (moment.source === 'composed') return String(moment.composedText || '');
  return String(moment.deliveredFallbackText || moment.miniText || '');
}

// Phase 5d deliveryGuard.v1 (§2.2): when the finalized turn text differs from
// the committee-approved envelope and the turn commits no premise release,
// re-impose span ownership by swapping the final question sentence for the
// protected span, verbatim. The clue body is never edited; premise-release
// turns are never touched (the caller passes releasedNowCount from the
// committed pacing); question count is preserved, not repaired.
export function applyCommitteeDeliveryGuard({ finalText, approvedText, span, releasedNowCount }) {
  const record = { policy: 'v1', eligible: false, applied: false, reason: null, replacedQuestion: null };
  const final = String(finalText || '');
  const skip = (reason) => ({ applied: false, text: final, record: { ...record, reason } });
  if (!span) return skip('no_span');
  if ((releasedNowCount || 0) > 0) return skip('premise_release_turn');
  if (normalizeCommitteeWhitespace(final) === normalizeCommitteeWhitespace(approvedText))
    return skip('shipped_as_approved');
  record.eligible = true;
  if (normalizeCommitteeWhitespace(final).includes(normalizeCommitteeWhitespace(span)))
    return { applied: false, text: final, record: { ...record, reason: 'span_already_present' } };
  const questions = committeeQuestionSentences(final);
  const lastQuestion = questions.at(-1) || null;
  if (!lastQuestion) return { applied: false, text: final, record: { ...record, reason: 'no_question_sentence' } };
  const index = final.lastIndexOf(lastQuestion);
  if (index < 0) return { applied: false, text: final, record: { ...record, reason: 'question_not_locatable' } };
  const swapped = final.slice(0, index) + span + final.slice(index + lastQuestion.length);
  record.applied = true;
  record.replacedQuestion = lastQuestion.trim();
  return { applied: true, text: swapped, record };
}
