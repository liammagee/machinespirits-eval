/**
 * Two stances put in one table were not necessarily asked for the same thing.
 * These pin the two live asymmetries and the guard against a mistyped arm.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  compareStancePayloads,
  renderStancePayloadComparability,
  resolveStanceInstrument,
  stancePayload,
} from '../services/stancePayloadComparability.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function warningKinds(comparison) {
  return comparison.warnings.map((warning) => warning.kind);
}

test('a stance payload names both its mandated moves and the rubric that scores it', () => {
  const sarcastic = stancePayload('sarcastic');
  assert.equal(sarcastic.stance, 'sarcastic');
  assert.equal(sarcastic.mandatesMoves, true);
  assert.ok(sarcastic.mandatedMoves.includes('concrete next move'));
  assert.equal(sarcastic.instrument.path, 'config/rubrics/registers/irony-sarcasm.yaml');
  assert.equal(sarcastic.instrument.source, 'stance_rubric');

  const plain = stancePayload('plain');
  assert.equal(plain.mandatesMoves, false);
  assert.deepEqual(plain.mandatedMoves, []);
  assert.equal(plain.instrument.path, null);

  assert.equal(stancePayload('not_a_stance'), null);
});

test('irony and sarcasm are reported as mandating different moves', () => {
  const comparison = compareStancePayloads(['ironic', 'sarcastic']);
  assert.equal(comparison.comparableMandates, false);
  assert.ok(warningKinds(comparison).includes('divergent_mandates'));

  const [message] = comparison.warnings.filter((warning) => warning.kind === 'divergent_mandates');
  // The moves that actually differ have to appear, not just the fact of a difference.
  assert.match(message.message, /learner-owned unmasking move/u);
  assert.match(message.message, /concrete next move/u);

  const ironic = comparison.stances.find((stance) => stance.stance === 'ironic');
  assert.ok(ironic.unmatchedMoves.includes('answerable next test'));
  // Both stances demand a visible cue, but not the same one, so nothing is shared.
  assert.deepEqual(comparison.sharedMoves, []);
});

test('the sarcasm pair that was published wrong reports the treatment as a mandate on one side only', () => {
  const comparison = compareStancePayloads(['sarcastic', 'sarcastic_determinate']);
  const determinate = comparison.stances.find((stance) => stance.stance === 'sarcastic_determinate');
  assert.ok(determinate.unmatchedMoves.includes('named target claim quoted or restated'));
  const parent = comparison.stances.find((stance) => stance.stance === 'sarcastic');
  assert.equal(parent.mandatedMoves.includes('named target claim quoted or restated'), false);
  // Same rubric file, so the instrument is not the problem here — only the payload.
  assert.equal(comparison.comparableInstrument, true);
  assert.equal(comparison.comparableMandates, false);
});

test('charismatic beside a sharp stance reports both the silent payload and the second instrument', () => {
  const comparison = compareStancePayloads(['charismatic', 'sarcastic']);
  const kinds = warningKinds(comparison);
  assert.ok(kinds.includes('payload_asymmetry'));
  assert.ok(kinds.includes('two_instrument_juxtaposition'));
  assert.ok(kinds.includes('fallback_instrument'));
  assert.equal(comparison.comparableInstrument, false);
  assert.deepEqual(comparison.instruments, [
    'config/evaluation-rubric-charisma.yaml',
    'config/rubrics/registers/irony-sarcasm.yaml',
  ]);
});

test('two mild stances are reported as comparable rather than left silent', () => {
  const comparison = compareStancePayloads(['plain', 'warm']);
  assert.equal(comparison.comparableMandates, true);
  assert.equal(comparison.comparableInstrument, true);
  assert.deepEqual(warningKinds(comparison), ['comparable']);
  assert.deepEqual(comparison.errors, []);
});

test('an arm the registry cannot resolve is an error, not a silent omission', () => {
  const comparison = compareStancePayloads(['sarcastic', 'router']);
  assert.deepEqual(comparison.unknown, ['router']);
  assert.equal(comparison.errors.length, 1);
  assert.match(comparison.errors[0], /router/u);
  // The stance it did resolve is still reported.
  assert.deepEqual(
    comparison.stances.map((stance) => stance.stance),
    ['sarcastic'],
  );
});

test('aliases and repeats collapse to one row per stance', () => {
  const comparison = compareStancePayloads(['sarcastic', 'sarcastic', ' sarcastic ']);
  assert.equal(comparison.stances.length, 1);
  // One stance is not a comparison, so nothing is claimed either way.
  assert.equal(comparison.comparableMandates, true);
  assert.deepEqual(comparison.warnings, []);
});

test('the rendered table prints every stance, its moves and its instrument', () => {
  const markdown = renderStancePayloadComparability(compareStancePayloads(['charismatic', 'sarcastic']));
  assert.match(markdown, /\| Stance \| mandated moves \| scored by \|/u);
  assert.match(markdown, /charismatic \| \(none\) \| config\/evaluation-rubric-charisma\.yaml \(fallback\)/u);
  assert.match(markdown, /concrete next move/u);
  assert.equal(renderStancePayloadComparability({ stances: [] }), '');
});

test('the scorer and the reports resolve a stance instrument through the same function', () => {
  // A second copy of the charismatic fallback is how a report ends up naming a
  // rubric the judge never opened, so the scorer must not carry its own.
  const scorer = fs.readFileSync(path.join(ROOT, 'scripts', 'evaluate-register-rubric.js'), 'utf8');
  assert.match(scorer, /resolveStanceInstrument/u);
  assert.doesNotMatch(scorer, /evaluation-rubric-charisma\.yaml/u);
  assert.equal(resolveStanceInstrument('charismatic').source, 'family_fallback');
});

test('the effect-grid report carries the payload comparison and fails on an unknown arm', async () => {
  const { summarizeNegativeRegisterEffects } = await import('../services/negativeRegisterEffectGrid.js');
  const report = summarizeNegativeRegisterEffects([]);
  assert.ok(report.payloadComparability, 'the report must carry the comparison');

  // Rows only reach the arm tables if they belong to the frozen plan, so these
  // carry a real profile and scenario; the rest of the report is expected to
  // complain about coverage, which is not what this test is asking about.
  const planRow = (arm) => ({
    arm,
    profileName: 'cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified',
    scenarioId: 'charisma_desire_resistance_breakthrough_boredom',
    targetSignal: 'boredom',
    stanceFidelity: { applies: false },
  });
  const armed = summarizeNegativeRegisterEffects([planRow('sarcastic'), planRow('not_a_stance')]);
  assert.ok(
    armed.errors.some((error) => error.includes('not_a_stance')),
    'an unresolvable arm must fail the report closed',
  );
});
