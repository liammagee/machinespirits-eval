import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReaderPrompt, normaliseSubmission } from '../scripts/score-blind-packet-model.js';

// The reader gets the packet as written and nothing else: no key, no judge
// file, no version-of-the-tutor label. The prompt must carry the packet text
// verbatim and ask for the array only.
test('buildReaderPrompt carries the packet verbatim and asks for the array only', () => {
  const packet = '# Packet\n\n### Item 1\n\n**LEARNER (this turn):** hi\n';
  const prompt = buildReaderPrompt(packet);
  assert.ok(prompt.endsWith(packet));
  assert.match(prompt, /Return ONLY the JSON array/u);
  assert.doesNotMatch(prompt, /with-d0|without-d0|judge\.json|blind-key/u);
});

test('normaliseSubmission returns the bare array compare takes, sorted by n', () => {
  const rows = normaliseSubmission(
    [
      { n: 2, realized: 'yes', move: 'backtrack', uptake: 'no', eased: 'persists' },
      { n: '1', realized: 'partly', move: 'slow_down', secondary: 'simplify', uptake: 'yes', eased: 'eased' },
    ],
    2,
  );
  assert.deepEqual(
    rows.map((r) => r.n),
    [1, 2],
  );
  assert.equal(rows[0].secondary, 'simplify');
  assert.equal(rows[1].secondary, null);
});

test('normaliseSubmission refuses a short or half-filled reply (no resampling, fail closed)', () => {
  assert.equal(
    normaliseSubmission([{ n: 1, realized: 'yes', move: 'backtrack', uptake: 'yes', eased: 'eased' }], 2),
    null,
  );
  assert.equal(normaliseSubmission([{ n: 1, realized: 'yes', move: '', uptake: 'yes', eased: 'eased' }], 1), null);
  assert.equal(normaliseSubmission('not an array', 1), null);
});
