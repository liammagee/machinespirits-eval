/**
 * Provenance guards for stance-fidelity verdicts.
 *
 * These exist because a stance count was published that differenced two gates
 * AND two slice folds at once (§6.7, corrected at paper v3.0.269). A bare pass
 * count does not identify what produced it, so every verdict must name its
 * scoring function, every negative register must persist one, and any code that
 * differences two sets must refuse when they disagree.
 */

import fs from 'fs';
import path from 'path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';

import {
  evaluateRegisterStanceFidelity,
  isNegativeRegister,
  STANCE_GATE_VERSION,
} from '../services/registerStanceFidelity.js';
import { assertComparable } from '../scripts/analyze-sarcasm-determinate-gate-decomposition.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('every negative register is recognised as carrying a stance gate', () => {
  for (const register of ['ironic', 'sarcastic', 'face_threat', 'sarcastic_determinate']) {
    assert.equal(isNegativeRegister(register), true, `${register} should carry a stance gate`);
  }
  for (const register of ['charismatic', 'socratic', '', null, undefined]) {
    assert.equal(isNegativeRegister(register), false, `${register} should not carry a stance gate`);
  }
});

test('stance aliases resolve to the canonical negative register', () => {
  assert.equal(isNegativeRegister('sarcastic_challenge'), true);
  assert.equal(isNegativeRegister('ironic_challenge'), true);
});

test('a verdict names the scoring function that produced it', () => {
  const args = {
    learnerMessage: 'This still feels like I am parroting the formula.',
    tutorMessage: 'Apparently the formula recites itself. Your claim that it "just works" needs one worked case.',
    postLearnerMessage: 'Let me try it on the table example.',
  };
  const plain = evaluateRegisterStanceFidelity({ registerName: 'sarcastic_challenge', ...args });
  const determinate = evaluateRegisterStanceFidelity({ registerName: 'sarcastic_determinate', ...args });

  assert.equal(plain.gateRegister, 'sarcastic');
  assert.equal(determinate.gateRegister, 'sarcastic_determinate');
  assert.equal(plain.gateVersion, STANCE_GATE_VERSION);
  assert.equal(determinate.gateVersion, STANCE_GATE_VERSION);

  // `gate` keeps its original meaning — the evidence disposition, not the gate
  // identity. A rename here would silently break the arm accounting.
  assert.match(plain.gate, /arm_evidence|excluded|violation/);
});

test('non-negative registers still report which gate declined to apply', () => {
  const result = evaluateRegisterStanceFidelity({ registerName: 'socratic', tutorMessage: 'What do you notice?' });
  assert.equal(result.applies, false);
  assert.equal(result.gateRegister, 'socratic');
  assert.equal(result.gateVersion, STANCE_GATE_VERSION);
});

test('the two sarcasm gates score the same turn differently, so counts must not be pooled', () => {
  // Manner without cargo: passes the plain gate, withheld by the determinate one.
  const args = {
    learnerMessage: 'This is boring and dead.',
    tutorMessage:
      'Apparently boredom is a property of the material. The next move is to test the hinge on one concrete case, ' +
      'and we can rebuild from there.',
    postLearnerMessage: 'Fine, I can try the concrete case.',
  };
  const plain = evaluateRegisterStanceFidelity({ registerName: 'sarcastic_challenge', ...args });
  const determinate = evaluateRegisterStanceFidelity({ registerName: 'sarcastic_determinate', ...args });
  assert.notEqual(plain.score, determinate.score);
  assert.equal(determinate.namedTargetClaim.named, false);
});

test('differencing refuses when gate or fold disagree', () => {
  const base = { gate: 'sarcastic', gateVersion: STANCE_GATE_VERSION, fold: 'resistance_turn' };
  assert.doesNotThrow(() => assertComparable(base, { ...base }));
  assert.throws(() => assertComparable(base, { ...base, gate: 'sarcastic_determinate' }), /incomparable/);
  assert.throws(() => assertComparable(base, { ...base, fold: 'all_register_slices' }), /incomparable/);
  assert.throws(() => assertComparable(base, { ...base, gateVersion: 'stance-gate/9.9' }), /incomparable/);
});

test('register scoring persists a stance verdict for every negative register, not one', () => {
  // Pinned against drift: the original bug was gating the stance computation on
  // a single register name, which left the parent sarcastic arm with no stored
  // verdict at all.
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'evaluate-register-rubric.js'), 'utf8');
  assert.match(source, /if \(isNegativeRegister\(slice\.registerName\)\) \{\s*\n\s*stanceFidelity =/);
  assert.doesNotMatch(source, /if \(slice\.registerName === 'sarcastic_determinate'\) \{\s*\n\s*stanceFidelity =/);
});
