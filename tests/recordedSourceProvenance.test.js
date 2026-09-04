import assert from 'node:assert/strict';
import test from 'node:test';

import { parseGitPorcelainPaths, recordSourceStatus } from '../services/recordedSourceProvenance.js';

test('porcelain parsing keeps the first path whole', () => {
  // The bug this guards: trimming the whole output first strips the leading
  // space of the ' M path' status column, so the first path lost a character.
  assert.deepEqual(parseGitPorcelainPaths(' M services/drift.js\n?? notes/new.md\n'), [
    'services/drift.js',
    'notes/new.md',
  ]);
  assert.deepEqual(parseGitPorcelainPaths(''), []);
  assert.deepEqual(parseGitPorcelainPaths(null), []);
  assert.deepEqual(parseGitPorcelainPaths('A  config/added.json'), ['config/added.json']);
});

test('a dirty tree is recorded and never thrown', () => {
  assert.deepEqual(recordSourceStatus({ label: 'unit', statusOutput: ' M services/drift.js' }), {
    dirty: true,
    dirtyPaths: ['services/drift.js'],
  });
  assert.deepEqual(recordSourceStatus({ label: 'unit', statusOutput: '' }), { dirty: false, dirtyPaths: [] });
});
