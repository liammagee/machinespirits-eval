/**
 * Model-stack default warning (CLAUDE.md "Model stack default") — unit tests.
 *
 * The warning is detection-only: it must flag cells resolving to the weak
 * nemotron/kimi pairing when run without explicit overrides, stay silent
 * when overrides are present or the stack is strong, and never block.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { collectWeakStackConfigs, formatWeakStackWarning, warnIfWeakStackDefault } =
  await import('../stackDefaultWarning.js');

// cell_40 resolves to nemotron ego + kimi-k2.5 superego in tutor-agents.yaml
// (the exact pairing the standing directive names); cell_1 is also
// nemotron-ego. These are stable, checked-in fixtures.
const WEAK_CELL = 'cell_40_base_dialectical_suspicious_unified_superego';

test('flags a weak-stack cell run with no overrides', () => {
  const flagged = collectWeakStackConfigs([{ profileName: WEAK_CELL }]);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].profileName, WEAK_CELL);
  assert.match(String(flagged[0].ego), /nemotron/i);
  assert.match(String(flagged[0].superego), /kimi/i);
});

test('stays silent when an explicit ego-model override is present', () => {
  assert.deepEqual(collectWeakStackConfigs([{ profileName: WEAK_CELL, egoModelOverride: 'codex.gpt-5.5' }]), []);
  assert.deepEqual(collectWeakStackConfigs([{ profileName: WEAK_CELL, modelOverride: 'codex.gpt-5.5' }]), []);
  assert.deepEqual(
    collectWeakStackConfigs([{ profileName: WEAK_CELL, tutorModelOverride: 'claude-code.sonnet-5' }]),
    [],
  );
  assert.deepEqual(collectWeakStackConfigs([{ profileName: WEAK_CELL, superegoModelOverride: 'codex.gpt-5.5' }]), []);
});

test('ignores unknown profiles and non-profile configs without throwing', () => {
  assert.deepEqual(
    collectWeakStackConfigs([
      { profileName: 'cell_does_not_exist_xyz' },
      { provider: 'openrouter', model: 'gpt' },
      null,
    ]),
    [],
  );
});

test('formatWeakStackWarning names the pairing, the rule, and the strong-stack alternative', () => {
  const flagged = collectWeakStackConfigs([{ profileName: WEAK_CELL }]);
  const message = formatWeakStackWarning(flagged, 3);
  assert.ok(message.includes('1 of 3'));
  assert.ok(message.includes(WEAK_CELL));
  assert.match(message, /nemotron\/kimi/);
  assert.match(message, /codex\.gpt-5\.5/);
  assert.match(message, /stack-bounded/);
  assert.match(message, /non-blocking/);
});

test('formatWeakStackWarning returns null when nothing is flagged', () => {
  assert.equal(formatWeakStackWarning([], 5), null);
});

test('warnIfWeakStackDefault prints to stderr and returns true only when flagged', () => {
  const original = console.error;
  const captured = [];
  console.error = (msg) => captured.push(String(msg));
  try {
    const warned = warnIfWeakStackDefault([{ profileName: WEAK_CELL }]);
    assert.equal(warned, true);
    assert.equal(captured.length, 1);
    assert.match(captured[0], /\[stack-default\] WARNING/);

    const notWarned = warnIfWeakStackDefault([{ profileName: WEAK_CELL, egoModelOverride: 'codex.gpt-5.5' }]);
    assert.equal(notWarned, false);
    assert.equal(captured.length, 1);
  } finally {
    console.error = original;
  }
});
