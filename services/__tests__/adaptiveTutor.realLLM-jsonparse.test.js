// Tests for parseJsonLoose / escapeEmbeddedQuotes — the JSON-extraction
// path inside realLLM.callRole. The parsing is heuristic-heavy because
// LLMs occasionally emit malformed JSON (code fences, trailing prose,
// unescaped quotes inside string values). Each test pins a real failure
// shape we have observed in production runs.

import { test } from 'node:test';
import assert from 'node:assert/strict';

if (!process.env.OPENROUTER_API_KEY) {
  process.env.OPENROUTER_API_KEY = 'fake-key-for-parse-test';
}

const { parseJsonLoose, escapeEmbeddedQuotes } = await import('../adaptiveTutor/realLLM.js');

test('parseJsonLoose handles the production tutorSuperego embedded-quote failure', () => {
  // The exact raw response that tripped jsonrepair on cell_117 run
  // eval-2026-05-07-51020ae1, scenario metaphor_boundary_case_v1.
  const raw =
    '```json\n' +
    '{\n' +
    '  "needsRevision": true,\n' +
    '  "feedback": "The draft asks: \'when you hear the word "recognition," what does it make you think of?\' and that probe is too high a floor."\n' +
    '}\n' +
    '```';
  const parsed = parseJsonLoose(raw);
  assert.equal(parsed.needsRevision, true);
  assert.match(parsed.feedback, /recognition/);
});

test('parseJsonLoose still parses well-formed JSON without modification', () => {
  const raw = '{"needsRevision": false, "feedback": "looks fine"}';
  assert.deepEqual(parseJsonLoose(raw), { needsRevision: false, feedback: 'looks fine' });
});

test('parseJsonLoose strips code fences', () => {
  const raw = '```json\n{"a": 1}\n```';
  assert.deepEqual(parseJsonLoose(raw), { a: 1 });
});

test('parseJsonLoose strips trailing prose after the JSON', () => {
  const raw = '{"a": 1, "b": 2}\n\n★ Insight ─── trailing prose that should not be parsed.';
  assert.deepEqual(parseJsonLoose(raw), { a: 1, b: 2 });
});

test('escapeEmbeddedQuotes leaves valid JSON unchanged', () => {
  const raw = '{"a": "no embedded quotes here", "b": 2}';
  assert.equal(escapeEmbeddedQuotes(raw), raw);
});

test('escapeEmbeddedQuotes preserves already-escaped quotes', () => {
  const raw = '{"a": "with \\"escaped\\" quotes", "b": 2}';
  assert.equal(escapeEmbeddedQuotes(raw), raw);
});

test('escapeEmbeddedQuotes escapes a single embedded quote in a value', () => {
  const raw = '{"a": "before "stray" after"}';
  const fixed = escapeEmbeddedQuotes(raw);
  const parsed = JSON.parse(fixed);
  assert.equal(parsed.a, 'before \\"stray\\" after'.replace(/\\"/g, '"'));
});
