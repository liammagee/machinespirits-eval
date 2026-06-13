import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  classifyBoundaryFailure,
  failureModeOf,
  guardStateOf,
} from '../services/dramaticDerivation/boundaryClassifier.js';

const world = loadWorld('config/drama-derivation/world-002-lantern.yaml');

function artifact(label) {
  const base = `exports/dramatic-derivation/loop/${label}`;
  return {
    result: JSON.parse(readFileSync(`${base}/result.json`, 'utf8')),
    diagnosis: JSON.parse(readFileSync(`${base}/diagnosis.json`, 'utf8')),
  };
}

test('E4a classifier leaves grounded arms as controls', () => {
  for (const label of ['lantern-p3-repair-on', 'lantern-p4-hygiene-on']) {
    const { result, diagnosis } = artifact(label);
    assert.equal(classifyBoundaryFailure(world, result, diagnosis).className, 'grounded_control');
  }
});

test('E4a classifier identifies p5 as tempo-starved by an unsafe release', () => {
  const { result, diagnosis } = artifact('lantern-p5-mutation-on');
  const c = classifyBoundaryFailure(world, result, diagnosis);
  assert.equal(c.className, 'tempo_starved_house');
  assert.deepEqual(
    c.evidence.fatalReleases.map((row) => `${row.premise}@t${row.turn}`),
    ['p_chart@t7'],
  );
});

test('E4a classifier identifies E3 as decay-starved lucky leap', () => {
  const { result, diagnosis } = artifact('lantern-e3-real-r1');
  const c = classifyBoundaryFailure(world, result, diagnosis);
  assert.equal(c.className, 'decay_starved_lucky_leap');
  assert.deepEqual(
    c.evidence.unrepairedSlips.map((row) => row.premiseId),
    ['p_bearing', 'm_post'],
  );
  assert.ok(c.evidence.luckyLeaps > 0);
  assert.ok(c.evidence.namedDropped.includes('p_bearing'));
});

// The public failure-mode axis is a fixed projection of the six detailed split
// classes onto five mechanism-keyed modes. Lock the whole map so a renamed or
// added detailed class can never silently fall through to 'unresolved'.
test('failureModeOf projects every detailed split class onto its public mode', () => {
  assert.equal(failureModeOf('grounded_control'), 'grounded');
  assert.equal(failureModeOf('tempo_starved_house'), 'early_pull_death');
  assert.equal(failureModeOf('decay_starved_stall'), 'decay_seating_death');
  assert.equal(failureModeOf('decay_starved_lucky_leap'), 'decay_seating_death');
  assert.equal(failureModeOf('supply_starved_stall'), 'aporia');
  assert.equal(failureModeOf('unresolved_non_grounding'), 'unresolved');
  // unknown class is conservatively absorbed, never thrown
  assert.equal(failureModeOf('some_future_class'), 'unresolved');
});

// The public mode rides on the same arms the detailed classes do, so the
// contingency table the generalization plan carries is keyed on the same trace.
test('classifyBoundaryFailure attaches the public failure mode to the arm', () => {
  const grounded = artifact('lantern-p4-hygiene-on');
  assert.equal(classifyBoundaryFailure(world, grounded.result, grounded.diagnosis).failureMode, 'grounded');
  const earlyPull = artifact('lantern-p5-mutation-on');
  assert.equal(classifyBoundaryFailure(world, earlyPull.result, earlyPull.diagnosis).failureMode, 'early_pull_death');
  const decay = artifact('lantern-e3-real-r1');
  assert.equal(classifyBoundaryFailure(world, decay.result, decay.diagnosis).failureMode, 'decay_seating_death');
});

// guardStateOf is the contingency axis, read from the run's own recorded flags.
// Frozen arms predate the guard (field absent or false → unguarded); guard-fan
// arms record pacingGuard:true; proof-debt is the more-specific E5 state.
test('guardStateOf reads the guard layer the arm ran under', () => {
  assert.equal(guardStateOf({}), 'unguarded');
  assert.equal(guardStateOf({ pacingGuard: false }), 'unguarded');
  assert.equal(guardStateOf({ pacingGuard: true }), 'pacing');
  assert.equal(guardStateOf({ pacingGuard: true, proofDebtGuard: true }), 'proof_debt');
  // and end-to-end against a real guard-fan artifact
  const guarded = artifact('lantern-e2-guard-r5');
  assert.equal(guardStateOf(guarded.diagnosis), 'pacing');
});
