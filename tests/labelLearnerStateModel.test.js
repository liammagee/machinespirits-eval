import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseModelRef } from '../scripts/label-learner-state-model.js';

// The first live run (2026-09-02) handed the bridge the dotted CLI string and
// every call failed before any process started ("provider unknown"). The
// bridge takes { provider, model }; this pins the split.
test('parseModelRef splits the dotted CLI model string for the bridge', () => {
  assert.deepEqual(parseModelRef('claude-code.claude-sonnet-5'), {
    provider: 'claude-code',
    model: 'claude-sonnet-5',
  });
  assert.deepEqual(parseModelRef('codex.gpt-5.6-sol'), { provider: 'codex', model: 'gpt-5.6-sol' });
  assert.throws(() => parseModelRef('claude-sonnet-5'), /provider\.model/);
  assert.throws(() => parseModelRef(''), /provider\.model/);
});
