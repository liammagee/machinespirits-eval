import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import { classifyBoundaryFailure } from '../services/dramaticDerivation/boundaryClassifier.js';

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

