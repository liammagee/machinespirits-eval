import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { recordFileDigest, recordObservedDigest, recordSourceSetDigests } from '../services/recordedFileDigest.js';

// CLAUDE.md (2026-08-21, 2026-09-03): these tests write their own temporary
// files. A test that hashes a real source file and asserts the digest matches
// a literal would rebuild the banned pin at test time.
function writeTempFile(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recorded-digest-'));
  const file = path.join(dir, 'sample.txt');
  fs.writeFileSync(file, body);
  return { dir, file, sha256: crypto.createHash('sha256').update(body).digest('hex') };
}

test('recordFileDigest reports the digest on disk and never throws on drift', () => {
  const { dir, file, sha256 } = writeTempFile('first body\n');
  try {
    const same = recordFileDigest({ filePath: file, recordedSha256: sha256, label: 'sample' });
    assert.equal(same.observedSha256, sha256);
    assert.equal(same.drifted, false);

    fs.writeFileSync(file, 'second body\n');
    const drifted = recordFileDigest({ filePath: file, recordedSha256: sha256, label: 'sample' });
    assert.equal(drifted.recordedSha256, sha256);
    assert.notEqual(drifted.observedSha256, sha256);
    assert.equal(drifted.drifted, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('recordFileDigest resolves a relative path against root', () => {
  const { dir, file, sha256 } = writeTempFile('rooted body\n');
  try {
    const record = recordFileDigest({
      root: dir,
      filePath: path.basename(file),
      recordedSha256: null,
      label: 'rooted',
    });
    assert.equal(record.observedSha256, sha256);
    assert.equal(record.recordedSha256, null);
    assert.equal(record.drifted, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('recordObservedDigest treats a missing observed digest as absent, not as a crash', () => {
  const record = recordObservedDigest({
    label: 'absent',
    filePath: 'nowhere.js',
    recordedSha256: '0'.repeat(64),
    observedSha256: undefined,
  });
  assert.equal(record.observedSha256, null);
  assert.equal(record.drifted, true);
});

test('recordSourceSetDigests records file members and reports every other member', () => {
  const recorded = { runner: 'a'.repeat(64), world: 'b'.repeat(64), policy: 'design-v1', prompt: 'wording-v1' };
  const observed = { runner: 'c'.repeat(64), world: 'b'.repeat(64), policy: 'design-v2', prompt: 'wording-v1' };
  const { records, mismatches } = recordSourceSetDigests({
    label: 'sample contract',
    recorded,
    observed,
    fileKinds: ['runner', 'world'],
  });
  assert.deepEqual(
    records.map((record) => [record.label, record.drifted]),
    [
      ['sample contract runner', true],
      ['sample contract world', false],
    ],
  );
  assert.deepEqual(mismatches, ['policy']);
});
