// Hermetic unit tests for the Oedipus arm-invariant QA gate (scripts/qa-oedipus-arms.js).
// No API calls: the semantic judge is mocked via injected tallies. Covers the verdict logic
// (the run2 contamination is the fixture), transcript/key loading, and arg parsing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { armVerdict, loadArmTranscript, parseArgs } from '../scripts/qa-oedipus-arms.js';

const tally = (withheld, metered, stated) => ({ withheld, metered, stated });
const j = (level, t, valid = 4) => ({ level, tally: t, valid, evidence: 'x' });

test('none arm: a metered tally is CONTROL_CONTAMINATED (the run2 bug)', () => {
  const v = armVerdict('none', j('metered', tally(0, 4, 0)), 3);
  assert.equal(v.pass, false);
  assert.equal(v.status, 'CONTROL_CONTAMINATED');
});

test('none arm: a withheld tally passes', () => {
  const v = armVerdict('none', j('withheld', tally(4, 0, 0)), 3);
  assert.equal(v.pass, true);
  assert.equal(v.status, 'withheld_ok');
});

test('none arm: a stated tally is also contaminated', () => {
  assert.equal(armVerdict('none', j('stated', tally(0, 0, 4)), 3).pass, false);
});

test('low-consensus (2-2 tie) FAILS rather than passing on bare plurality', () => {
  // withheld wins the reduce-plurality at the tie, but 2 < consensus 3 -> not clean
  const v = armVerdict('none', j('withheld', tally(2, 2, 0)), 3);
  assert.equal(v.pass, false);
});

test('socratic arm: metered passes, stated is SOCRATIC_OFF (accidental reveal)', () => {
  assert.equal(armVerdict('socratic', j('metered', tally(0, 4, 0)), 3).pass, true);
  const off = armVerdict('socratic', j('stated', tally(0, 0, 4)), 3);
  assert.equal(off.pass, false);
  assert.equal(off.status, 'SOCRATIC_OFF');
});

test('reveal arm: stated passes, metered is REVEAL_MISSING (ceiling never revealed)', () => {
  assert.equal(armVerdict('reveal', j('stated', tally(0, 0, 4)), 3).pass, true);
  const missing = armVerdict('reveal', j('metered', tally(0, 4, 0)), 3);
  assert.equal(missing.pass, false);
  assert.equal(missing.status, 'REVEAL_MISSING');
});

test('loadArmTranscript reads <sample-root>/sample/<arm>/<tid>.txt + key-<arm>.yaml', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-arms-'));
  fs.mkdirSync(path.join(root, 'sample', 'none'), { recursive: true });
  fs.writeFileSync(path.join(root, 'sample', 'none', 'T07.txt'), 'TUTOR:\n\n"Tell me about your data."\n');
  fs.writeFileSync(path.join(root, 'key-none.yaml'), 'items:\n  - tid: T07\n    drama_id: D_OED1\n');
  const loaded = loadArmTranscript(root, 'none');
  assert.equal(loaded.tid, 'T07');
  assert.equal(loaded.dramaId, 'D_OED1');
  assert.match(loaded.transcript, /TUTOR/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadArmTranscript reads object-shaped key.items without falling back to the first secret', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-arms-'));
  fs.mkdirSync(path.join(root, 'sample', 'socratic'), { recursive: true });
  fs.writeFileSync(path.join(root, 'sample', 'socratic', 'T04.txt'), 'TUTOR:\n\n"What do the ledgers show?"\n');
  fs.writeFileSync(path.join(root, 'key-socratic.yaml'), 'items:\n  T04:\n    drama_id: D_OED4\n');
  const loaded = loadArmTranscript(root, 'socratic');
  assert.equal(loaded.tid, 'T04');
  assert.equal(loaded.dramaId, 'D_OED4');
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadArmTranscript falls back to the .txt when no key file is present', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-arms-'));
  fs.mkdirSync(path.join(root, 'sample', 'reveal'), { recursive: true });
  fs.writeFileSync(path.join(root, 'sample', 'reveal', 'T03.txt'), 'TUTOR:\n\n"S is X."\n');
  const loaded = loadArmTranscript(root, 'reveal');
  assert.equal(loaded.tid, 'T03');
  fs.rmSync(root, { recursive: true, force: true });
});

test('parseArgs: defaults + required + consensus = ceil(0.6 * panel)', () => {
  const a = parseArgs(['node', 'qa', '--sample-root', '/tmp/x', '--spec', '/tmp/s.yaml']);
  assert.deepEqual(a.arms, ['none', 'socratic', 'reveal']);
  assert.equal(a.consensus, 3);
  assert.throws(() => parseArgs(['node', 'qa', '--spec', '/tmp/s.yaml']), /sample-root/);
});
