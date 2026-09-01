import fs from 'node:fs';

import {
  ADAPTIVE_WARRANT_SEMANTIC_QUOTE_MODES,
  normalizeAdaptiveWarrantSemanticQuotePunctuation,
  validateAdaptiveWarrantSemanticExtraction,
} from './adaptiveWarrantSemanticEvents.js';

export const TYPOGRAPHIC_QUOTE_RULING_SCHEMA =
  'machinespirits.adaptation-refinement.typographic-quote-reviewer-ruling.v1';

// The one rejection reason this ruling may forgive. Any other reason keeps the
// turn unread and the dialogue quarantined.
export const FORGIVEN_ISSUE_CODE = 'evidence_span:not_literal';

/**
 * The frozen quote rule, run once more with letter case ignored.
 *
 * The frozen rule already folds curly quote marks to straight ones, so letter
 * case is the whole of the relaxation. Case cannot change which words a quote
 * contains or their order, and the uniqueness test below is the frozen rule's
 * own: a quote that passes here still picks out exactly one place in the
 * learner's own words.
 *
 * Retained for replay of the 2026-08-16 ruling. New reads use the offset-safe
 * CASE_INSENSITIVE mode of deriveAdaptiveWarrantSemanticEvidenceSpan instead.
 */
export function deriveQuoteIgnoringLetterCase(learnerText, suppliedSpan) {
  const fold = (value) => normalizeAdaptiveWarrantSemanticQuotePunctuation(value).toLowerCase();
  const source = fold(learnerText);
  const supplied = fold(typeof suppliedSpan === 'string' ? suppliedSpan : (suppliedSpan?.text ?? ''));
  if (!supplied) return { status: 'not_literal' };
  const start = source.indexOf(supplied);
  if (start < 0) return { status: 'not_literal' };
  if (source.indexOf(supplied, start + 1) >= 0) return { status: 'non_unique_literal' };
  return { status: 'derived_unique_literal', text: String(learnerText).slice(start, start + supplied.length) };
}

function readTrace(tracePath) {
  return fs
    .readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Decide whether one unread turn falls under the reviewer's ruling.
 *
 * Fail-closed by construction. The turn qualifies only when every recorded
 * reading attempt was rejected on the literal-quote rule alone, and every quote
 * each attempt offered comes back as one unique quote once letter case is
 * ignored. One attempt rejected for any other reason, one quote that is a real
 * misquote or matches two places, or no recorded attempt at all, and the answer
 * is no.
 */
export function classifyUnreadTurnUnderTypographicRuling({ events = [], turn } = {}) {
  const learnerEvent = events.find(
    (event) => event.type === 'auto_learner_turn' && Number(event.turn) === Number(turn),
  );
  const learnerText = learnerEvent?.text ?? learnerEvent?.message ?? '';
  if (!learnerText) {
    return { turn, qualifies: false, reason: 'learner turn text not found in the trace' };
  }
  const attempts = events.filter(
    (event) =>
      event.type === 'model_call' &&
      Number(event.turn) === Number(turn) &&
      event.role === 'tutor_stub_learner_analysis',
  );
  if (!attempts.length) {
    return { turn, qualifies: false, reason: 'no recorded reading attempt for this turn' };
  }

  const forgivenQuotes = [];
  for (const [index, attempt] of attempts.entries()) {
    const label = `attempt ${index + 1}`;
    let parsed;
    try {
      parsed = JSON.parse(attempt.response?.text ?? '');
    } catch {
      return { turn, qualifies: false, reason: `${label} reply is not one JSON object` };
    }
    const result = validateAdaptiveWarrantSemanticExtraction(parsed.semantic_events, {
      // This ruling must reproduce the original refusal, even after new reads
      // adopt case-insensitive matching. The unread turn remains excluded.
      quoteMatchMode: ADAPTIVE_WARRANT_SEMANTIC_QUOTE_MODES.HISTORICAL,
      learnerText,
      publicText: attempt.request?.prompt ?? learnerText,
      turn: Number(turn),
      rawResponseText: attempt.response?.text ?? '',
    });
    const issues = [...result.envelope_issues, ...result.events.flatMap((event) => event.validation.issues)].map(
      (issue) => String(issue).replace(/^events\[\d+\]\./u, ''),
    );
    const other = [...new Set(issues.filter((issue) => issue !== FORGIVEN_ISSUE_CODE))];
    if (other.length) {
      return { turn, qualifies: false, reason: `${label} was also rejected for: ${other.join(', ')}` };
    }
    if (!issues.length) {
      return { turn, qualifies: false, reason: `${label} shows no rejection when replayed` };
    }
    for (const event of result.events) {
      if (event.evidence_span_derivation?.status !== 'not_literal') continue;
      const relaxed = deriveQuoteIgnoringLetterCase(learnerText, event.evidence_span);
      if (relaxed.status !== 'derived_unique_literal') {
        return {
          turn,
          qualifies: false,
          reason: `${label} quote still fails with letter case ignored (${relaxed.status})`,
        };
      }
      forgivenQuotes.push({ attempt: index + 1, quoted: event.evidence_span?.text ?? '', learner_wrote: relaxed.text });
    }
  }

  return { turn, qualifies: true, attempts: attempts.length, forgiven_quotes: forgivenQuotes };
}

/**
 * Apply the ruling to one quarantined dialogue. The dialogue is admitted only
 * when every unread turn qualifies. The unread turns stay unread and drop out
 * of the corpus, which is what makes this a case-count change and not a rescue
 * of the turn: the tutor still took that turn without a reading.
 */
export function applyTypographicRulingToDialogue({ tracePath, unreadTurns = [] } = {}) {
  const empty = { admitted: false, dropped_turns: [], turns: [] };
  if (!tracePath || !fs.existsSync(tracePath)) {
    return { ...empty, reason: 'child trace not found' };
  }
  if (!unreadTurns.length) {
    return { ...empty, reason: 'dialogue has no unread turn to rule on' };
  }
  const events = readTrace(tracePath);
  const turns = unreadTurns.map((turn) => classifyUnreadTurnUnderTypographicRuling({ events, turn }));
  const refused = turns.filter((row) => !row.qualifies);
  if (refused.length) {
    return { ...empty, turns, reason: refused.map((row) => `turn ${row.turn}: ${row.reason}`).join('; ') };
  }
  return { admitted: true, dropped_turns: turns.map((row) => row.turn), turns };
}

export function readTypographicQuoteRuling(rulingPath) {
  const ruling = JSON.parse(fs.readFileSync(rulingPath, 'utf8'));
  if (ruling?.schema !== TYPOGRAPHIC_QUOTE_RULING_SCHEMA) {
    throw new Error('reviewer ruling is not a typographic quote ruling');
  }
  if (!Number.isInteger(ruling.expected_dropped_turns) || ruling.expected_dropped_turns < 0) {
    throw new Error('reviewer ruling must declare how many turns it expects to drop');
  }
  if (typeof ruling.ruled_by !== 'string' || !ruling.ruled_by.trim()) {
    throw new Error('reviewer ruling must name who ruled');
  }
  return ruling;
}
