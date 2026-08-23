import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SEED_FLOOR,
  checkRange,
  claimedSeeds,
  freeBlocks,
  nextFreeBlock,
  readLedger,
  scanSeeds,
  takenSeeds,
  undeclaredSeeds,
} from '../scripts/seed-ledger.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ledgerOf = (claims) => ({ version: 1, claims });
const claim = (seeds, by = 'someone') => ({ claimed_by: by, source: 'a note', seeds });

test('a range in the ledger claims every seed inside it, not just its ends', () => {
  // This is the whole reason the file exists. The passive main block ran on
  // 524-535, but only three of those numbers appear literally on disk, so a
  // search finds 3 and the ledger must supply 12.
  const ledger = readLedger(ROOT);
  const claimed = claimedSeeds(ledger);
  for (let seed = 524; seed <= 535; seed += 1) {
    assert.equal(claimed.get(seed), 'passive main block, 72 dialogues', `seed ${seed}`);
  }
});

test('the ledger refuses an entry that claims nothing, or names no owner', () => {
  assert.throws(() => readLedger(ROOT, 'tests/fixtures/does-not-exist.yaml'));
  // The parser guards are exercised through the shape of the real file: every
  // entry there carries an owner and a source.
  for (const entry of readLedger(ROOT).claims) {
    assert.ok(entry.claimed_by, 'every claim names who took the seeds');
    assert.ok(entry.source, 'every claim names where it was registered');
    assert.ok(entry.seeds.length > 0);
  }
});

test('a seed is taken when either the ledger or the files say so', () => {
  const ledger = ledgerOf([claim([601, 602], 'a registered run')]);
  const scanned = new Map([[701, 3]]);
  const taken = takenSeeds(ledger, scanned);
  assert.equal(taken.get(601).source, 'ledger');
  assert.equal(taken.get(701).source, 'found in files');
  assert.equal(taken.has(603), false);
});

test('seeds found in the files but missing from the ledger are reported as drift', () => {
  const ledger = ledgerOf([claim([601])]);
  assert.deepEqual(
    undeclaredSeeds(
      ledger,
      new Map([
        [601, 1],
        [702, 1],
        [700, 1],
      ]),
    ),
    [700, 702],
  );
  assert.deepEqual(undeclaredSeeds(ledger, new Map([[601, 9]])), []);
});

test('the next free block skips every taken seed and returns a run of the asked size', () => {
  const taken = takenSeeds(ledgerOf([claim([500, 501, 502, 503, 505])]), new Map());
  // 504 is free but alone, so a block of three starts at 506.
  assert.deepEqual(nextFreeBlock(taken, 1, { from: SEED_FLOOR }), { from: 504, to: 504, seeds: [504] });
  assert.equal(nextFreeBlock(taken, 3, { from: SEED_FLOOR }).from, 506);
  assert.equal(nextFreeBlock(taken, 3, { from: SEED_FLOOR }).to, 508);
  assert.equal(nextFreeBlock(taken, 12, { from: 990 }), null, 'no room left says null, never a wrong answer');
});

test('free blocks are the gaps between claims, in position order and never wider than the gap', () => {
  const taken = takenSeeds(ledgerOf([claim([502, 507])]), new Map());
  const blocks = freeBlocks(taken, { from: 500, to: 510, minimum: 2 });
  assert.deepEqual(blocks, [
    { from: 500, to: 501, width: 2 },
    { from: 503, to: 506, width: 4 },
    { from: 508, to: 510, width: 3 },
  ]);
  // A gap narrower than the minimum is not offered at all.
  assert.deepEqual(freeBlocks(taken, { from: 500, to: 510, minimum: 4 }), [{ from: 503, to: 506, width: 4 }]);
});

test('the range relay 117 first proposed is caught, with the owner of each clash', () => {
  // 530-541: six seeds belong to the passive main block, five to the steering
  // decomposition, one to drama-derivation. This is the check that was missing.
  const taken = takenSeeds(readLedger(ROOT), new Map());
  const { conflicts } = checkRange(taken, 530, 541);
  assert.equal(conflicts.length, 12, 'every one of the twelve was already spoken for');
  assert.equal(conflicts.find((row) => row.seed === 530).by, 'passive main block, 72 dialogues');
  assert.equal(conflicts.find((row) => row.seed === 541).by, 'drama-derivation matrix specs (prime seeds)');
});

test('a run can prove the range it has just written into the ledger', () => {
  // Without --for, writing the claim down would make the range fail its own
  // check, and the tool would be useless at exactly the moment it is needed.
  const taken = takenSeeds(readLedger(ROOT), new Map());
  const bare = checkRange(taken, 654, 665);
  assert.equal(bare.conflicts.length, 12);
  const owned = checkRange(taken, 654, 665, { owner: 'guarded-learner main block' });
  assert.deepEqual(owned.conflicts, [], 'its own claim is not a clash');
  assert.equal(owned.own.length, 12);
  // Somebody else's claim inside the same range still stops it.
  assert.equal(checkRange(taken, 650, 665, { owner: 'guarded-learner main block' }).conflicts.length, 1);
});

test('the scan reads real seed syntax out of the repo', () => {
  // Guards the pattern itself: drama-derivation writes `"seed":557` inside a
  // JSON string, which is the form a looser pattern would miss.
  const found = scanSeeds(ROOT, { dirs: ['config/drama-derivation'] });
  assert.ok(found.has(557), 'the "seed":NNN form is read');
  assert.ok(found.has(653));
  assert.equal(found.has(654), false, 'and it does not invent neighbours');
});

test('a per-call seed inside a trace is not read as an allocation', (t) => {
  // A ledger seed is one a study was allocated, and a study writes those in its
  // plan. A trace records a different kind of seed: what one model call sampled
  // on, derived per call and three digits wide, which a search cannot tell from
  // an allocation. The v7 boredom run carried thousands of them and made a
  // clean run read as 170 undeclared seeds.
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-scan-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const job = path.join(temp, 'jobs', 'a-dialogue');
  fs.mkdirSync(path.join(job, 'traces'), { recursive: true });
  fs.writeFileSync(path.join(temp, 'batch-plan.json'), '{"jobs":[{"seed": 810}]}');
  fs.writeFileSync(path.join(job, 'traces', 'run.jsonl'), '{"model":"x","seed":811}\n');
  fs.writeFileSync(path.join(job, 'transcript.json'), '{"seed":890}');

  const found = scanSeeds(temp, { dirs: ['.'] });
  assert.equal(found.has(810), true, 'the plan says which seed the study was allocated');
  assert.equal(found.has(811), false, 'a per-call seed in a trace is not an allocation');
  assert.equal(found.has(890), false, 'and neither is one in a transcript');
});

test('every seed the files know about is written down', () => {
  // Fails when a run lands a new seed without claiming it. Repo only — the
  // archive is too slow for the suite, and its seeds are claimed in the file.
  const ledger = readLedger(ROOT);
  const drift = undeclaredSeeds(ledger, scanSeeds(ROOT));
  assert.deepEqual(drift, [], `undeclared seeds: ${drift.join(', ')} — add them to config/seed-ledger.yaml`);
});
