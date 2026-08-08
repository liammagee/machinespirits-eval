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

test('the register marker is required on both gates, not merely heavy', () => {
  // Real turn from run eval-2026-08-07-e3dffab2 (boredom, claim-bearing pilot).
  // It names the learner's claim, disciplines its target, sets a next move and a
  // repair path, and does all of it in an earnest voice — no sarcastic marker.
  // Under the determinate weighting that scored 100 - 25 = 75 and passed the
  // faithful band, so the run's "held the manner" count was really counting
  // "named a claim". Under the plain weighting the same turn scores 65 and fails.
  const args = {
    learnerMessage:
      'This still feels dead and procedural, but I see the test now. Failure condition: if paragraph 196 ' +
      'only shows domination and submission, with no fear turning into Bildung through work, then the ' +
      'inversion claim fails.',
    tutorMessage:
      'So you have boiled it down to a clean, self-referential test. If the passage only re-states ' +
      'domination and submission, the whole inversion collapses. That is the condition you have set up. ' +
      'Now tell me: which single feature of that chalk or that clay actually converts the fear into ' +
      'Bildung? Or, if you cannot point to it, state the precise way the scene would still collapse into ' +
      'pure obedience. Your move is to name the concrete element that does the work.',
    postLearnerMessage:
      'This still feels a bit dead, but the feature is that the material pushes back and keeps the result.',
  };

  const determinate = evaluateRegisterStanceFidelity({ registerName: 'sarcastic_determinate', ...args });
  assert.ok(determinate.missing.includes('cue_compliance'), 'fixture must lack the register marker');
  assert.equal(determinate.namedTargetClaim.named, true, 'fixture must name a target claim');
  assert.equal(determinate.score, 75, 'the arithmetic that used to admit this turn is unchanged');
  assert.equal(determinate.label, 'weak_or_warm_in_costume', 'a marker-less turn cannot be faithful');
  assert.equal(determinate.passed, false);

  const plain = evaluateRegisterStanceFidelity({ registerName: 'sarcastic_challenge', ...args });
  assert.equal(plain.label, 'weak_or_warm_in_costume');
  assert.equal(plain.passed, false);
});

test('no weighting can let a marker-less turn reach the faithful band on either gate', () => {
  // The invariant, stated independently of any run's data: whatever the point
  // weights are, a turn without the register marker is never faithful. The
  // determinate gate is the case that matters — its 25-point marker leaves 75
  // on the table, comfortably above the band — but assert it on both so a future
  // re-weighting of either cannot re-open the hole.
  const decomposed = evaluateRegisterStanceFidelity({
    registerName: 'sarcastic_determinate',
    learnerMessage: 'This still feels dead and procedural, but I see the test now.',
    tutorMessage:
      'So you have boiled it down to a clean, self-referential test. That is the condition you have set ' +
      'up. Now tell me: which single feature of that clay actually converts the fear into Bildung? Your ' +
      'move is to name the concrete element that does the work.',
    postLearnerMessage: 'The feature is that the material pushes back and keeps the result.',
  });
  assert.ok(decomposed.missing.includes('cue_compliance'));
  assert.ok(decomposed.score >= 70, 'the score still clears the band — the label rule is what stops it');
  assert.equal(decomposed.passed, false);

  // And the counts published from this repair, when the export is present. It is
  // regenerated from the database and gitignored, so this half is a bonus check
  // rather than a fixture the suite depends on.
  const decompositionPath = path.join(ROOT, 'exports', 'sarcasm-determinate-gate-decomposition.json');
  if (!fs.existsSync(decompositionPath)) return;
  const decomposition = JSON.parse(fs.readFileSync(decompositionPath, 'utf8'));
  for (const rows of Object.values(decomposition.rows)) {
    for (const row of rows) {
      if (row.passed) assert.equal(row.markerPresent, true, 'a passing row must carry the register marker');
    }
  }
});

test('register scoring persists a stance verdict for every negative register, not one', () => {
  // Pinned against drift: the original bug was gating the stance computation on
  // a single register name, which left the parent sarcastic arm with no stored
  // verdict at all.
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'evaluate-register-rubric.js'), 'utf8');
  assert.match(source, /if \(isNegativeRegister\(slice\.registerName\)\) \{\s*\n\s*stanceFidelity =/);
  assert.doesNotMatch(source, /if \(slice\.registerName === 'sarcastic_determinate'\) \{\s*\n\s*stanceFidelity =/);
});
