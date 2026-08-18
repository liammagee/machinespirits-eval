import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  FORGIVEN_ISSUE_CODE,
  TYPOGRAPHIC_QUOTE_RULING_SCHEMA,
  applyTypographicRulingToDialogue,
  classifyUnreadTurnUnderTypographicRuling,
  deriveQuoteIgnoringLetterCase,
  readTypographicQuoteRuling,
} from '../services/adaptiveWarrantTypographicQuoteRuling.js';

// The learner sentence that produced the one unread turn in the main block,
// curly apostrophe and em dash included. Every fixture below quotes from it, so
// the tests exercise the same shape the run met.
const LEARNER_TEXT =
  'Yes—the Osprey job number and shelf photo tie them to Nadia’s box, so Osprey is the taker unless you have counter-evidence.';

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quote-ruling-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function readerEvent(evidenceSpan, overrides = {}) {
  return {
    speech_act: 'analytic_contribution',
    target: {
      state: 'catalog',
      kind: 'record_entry',
      target_id: 'unspecified',
      public_identifier_ids: [],
      requested_value_types: ['record_text'],
      component_ids: [],
    },
    requested_or_proposed_action: { state: 'none' },
    evidence_span: evidenceSpan,
    confidence: 'medium',
    uncertainty: ['ambiguous_target'],
    ...overrides,
  };
}

function readerAttempt({ turn = 8, spans = [], text = null } = {}) {
  return {
    type: 'model_call',
    turn,
    role: 'tutor_stub_learner_analysis',
    request: { prompt: LEARNER_TEXT },
    response: { text: text ?? JSON.stringify({ semantic_events: { events: spans.map((span) => readerEvent(span)) } }) },
  };
}

function trace({ turn = 8, attempts = [], learnerText = LEARNER_TEXT } = {}) {
  return [{ type: 'auto_learner_turn', turn, text: learnerText }, ...attempts];
}

test('a quote that differs only in letter case comes back as one unique quote', () => {
  // What the reader actually wrote: capital T where the learner wrote "the".
  const relaxed = deriveQuoteIgnoringLetterCase(
    LEARNER_TEXT,
    "The Osprey job number and shelf photo tie them to Nadia's box",
  );
  assert.equal(relaxed.status, 'derived_unique_literal');
  // The derived text is the learner's own bytes, not the reader's.
  assert.equal(relaxed.text, 'the Osprey job number and shelf photo tie them to Nadia’s box');
});

test('a real misquote still fails once letter case is ignored', () => {
  assert.equal(deriveQuoteIgnoringLetterCase(LEARNER_TEXT, 'the Osprey lorry left bay three').status, 'not_literal');
  assert.equal(deriveQuoteIgnoringLetterCase(LEARNER_TEXT, '').status, 'not_literal');
});

test('a quote that matches two places is refused, so the relaxation keeps the uniqueness test', () => {
  const doubled = 'the box is here. The box is here.';
  assert.equal(deriveQuoteIgnoringLetterCase(doubled, 'the box is here').status, 'non_unique_literal');
});

test('an unread turn qualifies when every attempt failed on letter case alone', () => {
  const spans = ["The Osprey job number and shelf photo tie them to Nadia's box", 'Osprey is the taker'];
  const verdict = classifyUnreadTurnUnderTypographicRuling({
    events: trace({ attempts: [readerAttempt({ spans }), readerAttempt({ spans })] }),
    turn: 8,
  });
  assert.equal(verdict.qualifies, true);
  assert.equal(verdict.attempts, 2);
  assert.equal(verdict.forgiven_quotes.length, 2);
  assert.equal(verdict.forgiven_quotes[0].learner_wrote.startsWith('the Osprey'), true);
});

test('an unread turn is refused when any attempt failed for another reason', () => {
  const events = trace({
    attempts: [
      readerAttempt({ spans: ["The Osprey job number and shelf photo tie them to Nadia's box"] }),
      readerAttempt({ spans: ['the Osprey lorry left bay three'] }),
    ],
  });
  const verdict = classifyUnreadTurnUnderTypographicRuling({ events, turn: 8 });
  assert.equal(verdict.qualifies, false);
  assert.match(verdict.reason, /attempt 2 quote still fails with letter case ignored/u);
});

test('a turn with no recorded reading attempt is refused', () => {
  const verdict = classifyUnreadTurnUnderTypographicRuling({ events: trace({ attempts: [] }), turn: 8 });
  assert.equal(verdict.qualifies, false);
  assert.match(verdict.reason, /no recorded reading attempt/u);
});

test('a turn whose learner text is missing from the trace is refused', () => {
  const verdict = classifyUnreadTurnUnderTypographicRuling({ events: trace({ attempts: [] }), turn: 3 });
  assert.equal(verdict.qualifies, false);
  assert.match(verdict.reason, /learner turn text not found/u);
});

test('an attempt that shows no rejection when replayed is refused', () => {
  // A clean quote replays clean, so nothing is left for the ruling to forgive.
  const events = trace({ attempts: [readerAttempt({ spans: ['Osprey is the taker'] })] });
  const verdict = classifyUnreadTurnUnderTypographicRuling({ events, turn: 8 });
  assert.equal(verdict.qualifies, false);
  assert.match(verdict.reason, /shows no rejection when replayed/u);
});

test('an attempt whose reply is not one JSON object is refused', () => {
  const events = trace({ attempts: [readerAttempt({ text: 'sorry, I could not read that turn' })] });
  const verdict = classifyUnreadTurnUnderTypographicRuling({ events, turn: 8 });
  assert.equal(verdict.qualifies, false);
  assert.match(verdict.reason, /not one JSON object/u);
});

test('the forgiven issue is the literal-quote rule and nothing else', () => {
  assert.equal(FORGIVEN_ISSUE_CODE, 'evidence_span:not_literal');
});

test('a dialogue is admitted only when every unread turn qualifies', (t) => {
  const directory = temporaryDirectory(t);
  const tracePath = path.join(directory, 'dialogue.jsonl');
  const good = readerAttempt({ spans: ["The Osprey job number and shelf photo tie them to Nadia's box"] });
  const bad = readerAttempt({ turn: 5, spans: ['the Osprey lorry left bay three'] });
  const lines = [...trace({ attempts: [good] }), { type: 'auto_learner_turn', turn: 5, text: LEARNER_TEXT }, bad];
  fs.writeFileSync(tracePath, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`);

  const one = applyTypographicRulingToDialogue({ tracePath, unreadTurns: [8] });
  assert.equal(one.admitted, true);
  assert.deepEqual(one.dropped_turns, [8]);

  const both = applyTypographicRulingToDialogue({ tracePath, unreadTurns: [5, 8] });
  assert.equal(both.admitted, false);
  assert.deepEqual(both.dropped_turns, []);
  assert.match(both.reason, /turn 5:/u);
});

test('a dialogue with no unread turn and a missing trace are both refused', (t) => {
  const directory = temporaryDirectory(t);
  const tracePath = path.join(directory, 'dialogue.jsonl');
  fs.writeFileSync(tracePath, `${JSON.stringify({ type: 'auto_learner_turn', turn: 8, text: LEARNER_TEXT })}\n`);
  assert.equal(applyTypographicRulingToDialogue({ tracePath, unreadTurns: [] }).admitted, false);
  assert.match(applyTypographicRulingToDialogue({ tracePath, unreadTurns: [] }).reason, /no unread turn/u);
  const missing = applyTypographicRulingToDialogue({ tracePath: path.join(directory, 'gone.jsonl'), unreadTurns: [8] });
  assert.equal(missing.admitted, false);
  assert.match(missing.reason, /trace not found/u);
});

test('a ruling artifact must carry the schema, a turn count and a named reviewer', (t) => {
  const directory = temporaryDirectory(t);
  const write = (value) => {
    const rulingPath = path.join(directory, `${Math.abs(JSON.stringify(value).length)}-ruling.json`);
    fs.writeFileSync(rulingPath, `${JSON.stringify(value, null, 2)}\n`);
    return rulingPath;
  };
  const sound = { schema: TYPOGRAPHIC_QUOTE_RULING_SCHEMA, expected_dropped_turns: 1, ruled_by: 'Liam Magee' };
  assert.equal(readTypographicQuoteRuling(write(sound)).expected_dropped_turns, 1);
  assert.throws(() => readTypographicQuoteRuling(write({ ...sound, schema: 'something.else' })), /not a typographic/u);
  assert.throws(
    () => readTypographicQuoteRuling(write({ ...sound, expected_dropped_turns: 1.5 })),
    /how many turns it expects to drop/u,
  );
  assert.throws(() => readTypographicQuoteRuling(write({ ...sound, ruled_by: '  ' })), /must name who ruled/u);
});

test('the committed main-block ruling declares one dropped turn and 575 of 576 cases', () => {
  const rulingPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../docs/adaptation-refinement/guarded-main-block/reviewer-ruling-001-letter-case-quote.json',
  );
  const ruling = readTypographicQuoteRuling(rulingPath);
  assert.equal(ruling.expected_dropped_turns, 1);
  assert.equal(ruling.expected_case_count, 575);
  assert.equal(ruling.registered_case_count, 576);
  assert.equal(ruling.expected_case_count, ruling.registered_case_count - ruling.expected_dropped_turns);
  // The ruling must state a rule, not name a dialogue: it is applied blind.
  assert.equal(/dialogue|turn 8|s659/iu.test(ruling.rule), false);
});
