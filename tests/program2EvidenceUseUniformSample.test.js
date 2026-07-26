// The relabel tool's two original selectors are both deliberately biased:
// `--limit` takes records in directory order (one phase and its earliest
// dialogues) and `--stratify` balances the rare labels on purpose. Neither can
// stand for the archive, so a rate computed from either inherits the selector.
// `--sample` is the unbiased draw, and these tests pin the three properties that
// make a rate estimate from it meaningful: it is reproducible from its seed, it
// preserves the population's label mix rather than flattening it, and it spans
// the archive rather than one corner of it.
import assert from 'node:assert/strict';
import test from 'node:test';

import { uniformSample } from '../scripts/relabel-program2-evidence-use.js';

// A skewed population shaped like the real archive: three common labels, a long
// tail, and four phases of very unequal size.
function population() {
  const labels = [
    ['omits_warrant', 262],
    ['overleaps_evidence', 222],
    ['cites_public_evidence', 194],
    ['links_evidence_to_rule', 193],
    ['none', 56],
    ['revises_from_evidence', 30],
    ['distorts_public_evidence', 26],
    ['repeats_setup', 17],
  ];
  const phases = ['phase5-live-pilot', 'phase5b-live', 'phase5c-crossworld', 'phase5d-stall'];
  const records = [];
  let index = 0;
  for (const [label, count] of labels) {
    for (let n = 0; n < count; n += 1) {
      // Phase correlates with position, which is exactly the structure that makes
      // directory-order selection unrepresentative.
      const phase = phases[Math.floor((index / 1000) * phases.length) % phases.length];
      records.push({
        key: `${phase}/traces/cell/${String(index).padStart(4, '0')}.jsonl#1`,
        phase,
        storedTurn: { evidence_use: label },
      });
      index += 1;
    }
  }
  return records;
}

function shareOf(records, label) {
  return records.filter((record) => record.storedTurn.evidence_use === label).length / records.length;
}

test('the same seed draws the same sample, and a different seed draws a different one', () => {
  const pool = population();
  const a = uniformSample(pool, 200, 7);
  const b = uniformSample(pool, 200, 7);
  const c = uniformSample(pool, 200, 8);
  assert.deepEqual(
    a.map((record) => record.key),
    b.map((record) => record.key),
    'a seeded draw must be reproducible or a reported rate cannot be re-derived',
  );
  assert.notDeepEqual(
    a.map((record) => record.key),
    c.map((record) => record.key),
  );
});

test('the sample reproduces the population label mix instead of flattening it', () => {
  const pool = population();
  const drawn = uniformSample(pool, 400, 1);
  assert.equal(drawn.length, 400);
  for (const label of ['omits_warrant', 'links_evidence_to_rule', 'repeats_setup']) {
    const expected = shareOf(pool, label);
    const observed = shareOf(drawn, label);
    // Generous tolerance: the point is that the draw tracks the population at all,
    // where a stratified draw would force every label to 12.5%.
    assert.ok(
      Math.abs(observed - expected) < 0.05,
      `${label}: sampled ${(observed * 100).toFixed(1)}% vs population ${(expected * 100).toFixed(1)}%`,
    );
  }
  // The gate-firing share is the quantity the sweep exists to measure, so pin it
  // directly rather than trusting the per-label checks to imply it.
  const gateShare = (records) =>
    records.filter((record) => ['omits_warrant', 'overleaps_evidence'].includes(record.storedTurn.evidence_use))
      .length / records.length;
  assert.ok(Math.abs(gateShare(drawn) - gateShare(pool)) < 0.05);
});

test('the sample spans every phase, unlike a directory-order slice', () => {
  const pool = population();
  const drawn = uniformSample(pool, 200, 3);
  const sampledPhases = new Set(drawn.map((record) => record.phase));
  const allPhases = new Set(pool.map((record) => record.phase));
  assert.deepEqual([...sampledPhases].sort(), [...allPhases].sort());

  // The contrast that motivates the flag: taking the first 200 in directory order
  // reaches only the earliest phase.
  const inOrder = [...pool].sort((a, b) => a.key.localeCompare(b.key)).slice(0, 200);
  assert.equal(new Set(inOrder.map((record) => record.phase)).size, 1);
});

test('asking for more than the pool holds returns the whole pool, not a padded draw', () => {
  const pool = population();
  const drawn = uniformSample(pool, pool.length + 50, 1);
  assert.equal(drawn.length, pool.length);
  assert.equal(new Set(drawn.map((record) => record.key)).size, pool.length);
});

test('the drawn subset is returned in stable key order so a resumed run is deterministic', () => {
  const drawn = uniformSample(population(), 120, 5);
  const keys = drawn.map((record) => record.key);
  assert.deepEqual(
    keys,
    [...keys].sort((a, b) => a.localeCompare(b)),
  );
});
