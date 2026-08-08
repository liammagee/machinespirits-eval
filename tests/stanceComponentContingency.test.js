import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateRegisterStanceFidelity,
  stanceGateComponents,
  STANCE_GATE_VERSION,
} from '../services/registerStanceFidelity.js';
import {
  renderStanceComponentContingency,
  stanceComponentContingency,
} from '../services/stanceComponentContingency.js';

const NEGATIVE_REGISTERS = ['ironic', 'sarcastic', 'face_threat', 'sarcastic_determinate'];

/** A stance verdict as the contingency reads one: gate identity, pass, parts missing. */
function verdict({ register = 'sarcastic_determinate', passed = false, missing = [] } = {}) {
  return { applies: true, gateRegister: register, gateVersion: STANCE_GATE_VERSION, passed, missing };
}

function partOf(gate, key) {
  return gate.parts.find((part) => part.key === key);
}

test('every gate declares parts that total 100 and at least one necessary part', () => {
  for (const register of NEGATIVE_REGISTERS) {
    const parts = stanceGateComponents(register);
    assert.ok(parts.length > 0, `${register} declares no parts`);
    assert.equal(
      parts.reduce((total, part) => total + part.weight, 0),
      100,
      `${register} weights do not total 100`,
    );
    // Without this, necessity goes back to being arithmetic — a band a turn
    // happens not to reach — and a re-weighting can repeal it unnoticed.
    assert.ok(
      parts.some((part) => part.required),
      `${register} declares no required part`,
    );
    assert.equal(new Set(parts.map((part) => part.key)).size, parts.length, `${register} repeats a part key`);
  }
  // A register with no stance gate has no parts to report.
  assert.deepEqual(stanceGateComponents('warm_challenge'), []);
});

test('a determinate turn that names a claim but drops the marker fails on the requirement, not the band', () => {
  // The exact shape that once passed: 25 (named claim) + 15 + 15 + 10 + 10 = 75,
  // over the 70 band, with no sarcastic marker anywhere in the turn.
  const result = evaluateRegisterStanceFidelity({
    registerName: 'sarcastic_determinate',
    learnerMessage: 'I still think this is just a formula you have to memorise.',
    tutorMessage:
      'You said it is just a formula. Take one object that pushes back and show where the correction happens; ' +
      'if that lands wrong, try the table example next and rebuild it from there.',
    postLearnerMessage: 'The table leg wobbles when the measurement is off, so the number is doing something.',
  });

  assert.equal(result.passed, false);
  assert.equal(result.label, 'weak_or_warm_in_costume');
  assert.ok(result.score >= 70, `expected the band to be reached, scored ${result.score}`);
  assert.deepEqual(result.missingRequired, ['cue_compliance']);
});

test('the split prints one line per part of the gate, and each line accounts for every row', () => {
  const rows = [
    verdict({ passed: true }),
    verdict({ passed: true, missing: ['repair_path'] }),
    verdict({ passed: false, missing: ['cue_compliance', 'named_target_claim'] }),
  ];
  const [gate] = stanceComponentContingency(rows).gates;

  assert.equal(gate.gate, `sarcastic_determinate@${STANCE_GATE_VERSION}`);
  assert.equal(gate.n, 3);
  assert.equal(gate.passed, 2);
  assert.deepEqual(
    gate.parts.map((part) => part.key),
    stanceGateComponents('sarcastic_determinate').map((part) => part.key),
  );
  for (const part of gate.parts) {
    assert.equal(
      part.presentPassed + part.presentFailed + part.absentPassed + part.absentFailed,
      gate.n,
      `${part.key} does not account for every row`,
    );
  }
  const marker = partOf(gate, 'cue_compliance');
  assert.deepEqual(
    [marker.presentPassed, marker.presentFailed, marker.absentPassed, marker.absentFailed],
    [2, 0, 0, 1],
  );
  assert.equal(
    gate.warnings.some((warning) => warning.severity === 'contradiction'),
    false,
  );
});

test('a passing row that lacked a necessary part is a contradiction naming that part', () => {
  // The published shape: passing tracked the named claim, and rows with no
  // marker were counted as having held the sarcastic manner anyway.
  const rows = [
    verdict({ passed: true, missing: ['cue_compliance'] }),
    verdict({ passed: true, missing: ['cue_compliance'] }),
    verdict({ passed: false, missing: ['named_target_claim'] }),
  ];
  const contingency = stanceComponentContingency(rows);
  const [gate] = contingency.gates;

  const contradiction = gate.warnings.find((warning) => warning.severity === 'contradiction');
  assert.equal(contradiction.part, 'cue_compliance');
  assert.match(contradiction.message, /2 of 3 rows were counted faithful without cue_compliance/);
  assert.equal(contingency.contradictions.length, 1);
  assert.match(contingency.contradictions[0], new RegExp(`^sarcastic_determinate@${STANCE_GATE_VERSION}: `));
});

test('a part the gate does not require but that predicts every row is called out', () => {
  const rows = [
    verdict({ passed: true }),
    verdict({ passed: true }),
    verdict({ passed: false, missing: ['next_move'] }),
    verdict({ passed: false, missing: ['next_move'] }),
  ];
  const [gate] = stanceComponentContingency(rows).gates;

  const warning = gate.warnings.find((entry) => entry.severity === 'warning');
  assert.equal(warning.part, 'next_move');
  assert.match(warning.message, /this count is reporting next_move rather than the gate as a whole/);
  assert.equal(partOf(gate, 'next_move').decidesEveryRow, true);
  // A count that lines up with a part is not itself a contradiction: the gate
  // never claimed the part was necessary, so the report says so and goes on.
  assert.deepEqual(stanceComponentContingency(rows).contradictions, []);
});

test('a necessary part that every row carried is noted as untested rather than confirmed', () => {
  const rows = [verdict({ passed: true }), verdict({ passed: false, missing: ['repair_path'] })];
  const [gate] = stanceComponentContingency(rows).gates;

  const note = gate.warnings.find((warning) => warning.severity === 'note' && warning.part === 'cue_compliance');
  assert.match(note.message, /every row carried cue_compliance/);
  assert.equal(partOf(gate, 'cue_compliance').varied, false);
});

test('counts from different gates are tabulated apart, each against its own parts', () => {
  const rows = [
    verdict({ register: 'sarcastic', passed: true }),
    verdict({ register: 'sarcastic', passed: false, missing: ['cue_compliance'] }),
    verdict({ register: 'sarcastic_determinate', passed: true }),
  ];
  const contingency = stanceComponentContingency(rows);

  assert.equal(contingency.n, 3);
  assert.deepEqual(
    contingency.gates.map((gate) => gate.gateRegister),
    ['sarcastic', 'sarcastic_determinate'],
  );
  const plain = contingency.gates[0];
  assert.equal(plain.n, 2);
  // The plain gate has no named-claim part, so pooling the two would tabulate
  // a part half the rows were never scored on.
  assert.equal(partOf(plain, 'named_target_claim'), undefined);
  assert.equal(partOf(plain, 'cue_compliance').weight, 35);
  assert.equal(partOf(contingency.gates[1], 'cue_compliance').weight, 25);
});

test('rows with no stance verdict are left out rather than counted as failures', () => {
  const contingency = stanceComponentContingency([verdict({ passed: true }), { applies: false }, null, undefined]);
  assert.equal(contingency.n, 1);
  assert.equal(contingency.gates[0].n, 1);
  assert.deepEqual(stanceComponentContingency([]).gates, []);
});

test('the rendered table names every part of the gate and says plainly when nothing is wrong', () => {
  // Both required parts vary and neither predicts the outcome on its own, which
  // is what a healthy gate looks like: rows that carried a part still failed.
  const clean = renderStanceComponentContingency(
    stanceComponentContingency([
      verdict({ passed: true }),
      verdict({ passed: false, missing: ['cue_compliance'] }),
      verdict({ passed: false, missing: ['repair_path', 'next_move'] }),
      verdict({ passed: false, missing: ['named_target_claim'] }),
    ]),
  );
  for (const part of stanceGateComponents('sarcastic_determinate')) {
    assert.match(clean, new RegExp(`\\| ${part.key} \\|`), `${part.key} missing from the table`);
  }
  assert.match(clean, /No part of this gate carries the count on its own/);

  const broken = renderStanceComponentContingency(
    stanceComponentContingency([verdict({ passed: true, missing: ['cue_compliance'] }), verdict({ passed: false })]),
  );
  assert.match(broken, /\*\*contradiction\*\* — 1 of 2 rows were counted faithful without cue_compliance/);
});
