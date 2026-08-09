/**
 * Model-stack default warning (CLAUDE.md "Model stack default") — unit tests.
 *
 * The warning is detection-only: it must flag cells that will CALL the weak
 * nemotron/kimi pairing, stay silent when the models actually called are
 * strong, and never block. An override only silences the warning for the seat
 * it replaces — the August 2026 register runs passed --tutor-model
 * codex.gpt-5.5, went on calling the YAML's nemotron on the id-director path,
 * and saw no warning, because the old check read the ask instead of the call.
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

test('stays silent when an override replaces both tutor seats', () => {
  assert.deepEqual(collectWeakStackConfigs([{ profileName: WEAK_CELL, modelOverride: 'codex.gpt-5.5' }]), []);
  assert.deepEqual(
    collectWeakStackConfigs([{ profileName: WEAK_CELL, tutorModelOverride: 'claude-code.sonnet-5' }]),
    [],
  );
});

test('still flags the seat an override leaves on the weak stack', () => {
  // --ego-model replaces the ego only, so the kimi superego still gets called.
  const egoOnly = collectWeakStackConfigs([{ profileName: WEAK_CELL, egoModelOverride: 'codex.gpt-5.5' }]);
  assert.equal(egoOnly.length, 1);
  assert.equal(egoOnly[0].ego, 'codex.gpt-5.5');
  assert.match(String(egoOnly[0].superego), /kimi/i);

  // --superego-model leaves the nemotron ego in place.
  const superegoOnly = collectWeakStackConfigs([{ profileName: WEAK_CELL, superegoModelOverride: 'codex.gpt-5.5' }]);
  assert.equal(superegoOnly.length, 1);
  assert.match(String(superegoOnly[0].ego), /nemotron/i);
  assert.equal(superegoOnly[0].superego, 'codex.gpt-5.5');
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
  assert.match(message, /codex\.gpt-5\.6-luna/);
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
    assert.match(captured[0], /codex\.gpt-5\.6-luna/);

    const notWarned = warnIfWeakStackDefault([{ profileName: WEAK_CELL, tutorModelOverride: 'codex.gpt-5.5' }]);
    assert.equal(notWarned, false);
    assert.equal(captured.length, 1);
  } finally {
    console.error = original;
  }
});
