import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMannerPresencePrompt,
  EDGED_MANNER_REGISTERS,
  mannerPresenceApplies,
  mannerPresenceCacheKey,
  mannerPresenceReading,
  MANNER_PRESENCE_PROMPT_VERSION,
  normalizeMannerPresenceReading,
  parseMannerPresenceReply,
  unreadMannerPresence,
} from '../services/registerMannerPresence.js';

const IRONIC_TURN =
  'Hegel, being helpful, hides the reversal in the least triumphant place possible. Find the sentence where the servant stops serving.';

test('asks about the merged edged manner and covers exactly the registers the readers agreed on', () => {
  // Both blind readers put the same ten ironic-or-sarcastic turns inside the
  // merged category, 10/10 with no false alarm, and neither could split it
  // (§6.7). Face threat is the one they diverged on, so it is not asked.
  assert.deepEqual([...EDGED_MANNER_REGISTERS].sort(), ['ironic', 'sarcastic', 'sarcastic_determinate']);
  assert.equal(mannerPresenceApplies('ironic'), true);
  assert.equal(mannerPresenceApplies('sarcastic_challenge'), true);
  assert.equal(mannerPresenceApplies('sarcastic_determinate'), true);
  assert.equal(mannerPresenceApplies('face_threat_challenge'), false);
  assert.equal(mannerPresenceApplies('warm'), false);
});

/**
 * The gate this replaces failed because it matched words. A gloss that quoted
 * cue phrases would put the word list back one layer up, so the prompt must
 * describe the move and name none of them.
 */
test('the prompt describes the move and quotes no cue phrase', () => {
  const prompt = buildMannerPresencePrompt({ learnerMessage: 'This feels dead.', tutorMessage: IRONIC_TURN });
  assert.match(prompt, /Does the tutor's reply carry an edge\?/);
  assert.match(prompt, /VERDICT: yes/);
  assert.match(prompt, /EVIDENCE:/);
  assert.match(prompt, /does not mean what it says straight/);
  // It also has to say what does NOT count, or a plainly harsh turn reads as edged.
  assert.match(prompt, /states its criticism plainly/);
  for (const cue of ['apparently', 'conveniently', 'wonderful', 'nice trick', 'not doing the work']) {
    assert.ok(!prompt.toLowerCase().includes(cue), `prompt must not name the cue phrase "${cue}"`);
  }
  // The manner is never named, so the reader cannot infer what was asked for.
  assert.ok(!/\bironic\b|\bsarcas/i.test(prompt), 'prompt must not name the assigned manner');
});

test('the cache key changes with the turn, the reader and the prompt version, and nothing else', () => {
  const base = { reader: 'claude-code/claude-sonnet-5', learnerMessage: 'This feels dead.', tutorMessage: IRONIC_TURN };
  const key = mannerPresenceCacheKey(base);

  // Whitespace and curly quotes are normalized away, so a reflowed transcript
  // does not re-buy every answer.
  assert.equal(mannerPresenceCacheKey({ ...base, tutorMessage: `  ${IRONIC_TURN.replace(/ /g, '  ')}  ` }), key);

  assert.notEqual(mannerPresenceCacheKey({ ...base, tutorMessage: `${IRONIC_TURN} Try one object.` }), key);
  assert.notEqual(mannerPresenceCacheKey({ ...base, learnerMessage: 'This feels boring.' }), key);
  assert.notEqual(mannerPresenceCacheKey({ ...base, reader: 'codex/gpt-5.5' }), key);
});

test('parses the two-line contract and reports an unusable reply rather than guessing', () => {
  assert.deepEqual(parseMannerPresenceReply('VERDICT: yes\nEVIDENCE: being helpful'), {
    present: true,
    evidence: 'being helpful',
    parseError: null,
  });
  assert.deepEqual(parseMannerPresenceReply('VERDICT: no\nEVIDENCE: none'), {
    present: false,
    evidence: 'none',
    parseError: null,
  });
  assert.equal(parseMannerPresenceReply('I think it probably is ironic.').present, null);
  assert.equal(parseMannerPresenceReply('').parseError, 'no_verdict_line');
});

/**
 * A quote that is not in the turn is the cheapest sign of a confabulated
 * reading. Recorded, not enforced — readers tidy punctuation when quoting.
 */
test('records whether the reader quoted words that are actually in the turn', () => {
  const good = mannerPresenceReading({
    reader: 'claude-code/claude-sonnet-5',
    parsed: { present: true, evidence: 'being helpful', parseError: null },
    tutorMessage: IRONIC_TURN,
  });
  assert.equal(good.status, 'present');
  assert.equal(good.evidenceFoundInTurn, true);

  const confabulated = mannerPresenceReading({
    reader: 'claude-code/claude-sonnet-5',
    parsed: { present: true, evidence: 'what a triumph', parseError: null },
    tutorMessage: IRONIC_TURN,
  });
  assert.equal(confabulated.status, 'present');
  assert.equal(confabulated.evidenceFoundInTurn, false);

  const parseFailed = mannerPresenceReading({
    reader: 'claude-code/claude-sonnet-5',
    parsed: { present: null, evidence: '', parseError: 'no_verdict_line' },
    tutorMessage: IRONIC_TURN,
  });
  assert.equal(parseFailed.status, 'unread');
  assert.match(parseFailed.reason, /^parse_failed:/);
});

test('normalizing says why a reading is missing instead of defaulting to an answer', () => {
  assert.equal(normalizeMannerPresenceReading(null, { registerName: 'ironic' }).reason, 'not_supplied');
  assert.equal(
    normalizeMannerPresenceReading({ status: 'present' }, { registerName: 'face_threat_challenge' }).reason,
    'register_not_edged',
  );
  assert.equal(
    normalizeMannerPresenceReading({ status: 'maybe' }, { registerName: 'ironic' }).reason,
    'bad_status:maybe',
  );

  // An answer to an older question is not this question's answer.
  const stale = normalizeMannerPresenceReading(
    { status: 'present', promptVersion: 'manner-presence/0.9' },
    { registerName: 'ironic' },
  );
  assert.equal(stale.status, 'unread');
  assert.equal(stale.reason, 'stale_prompt:manner-presence/0.9');

  const good = normalizeMannerPresenceReading(
    { status: 'absent', reader: 'claude-code/claude-sonnet-5' },
    { registerName: 'ironic' },
  );
  assert.equal(good.status, 'absent');
  assert.equal(good.present, false);
  assert.equal(good.promptVersion, MANNER_PRESENCE_PROMPT_VERSION);
  assert.equal(good.reason, null);
});

test('an unread reading never claims a verdict', () => {
  const unread = unreadMannerPresence('reader_error:timeout');
  assert.equal(unread.status, 'unread');
  assert.equal(unread.present, null);
  assert.equal(unread.reason, 'reader_error:timeout');
});
