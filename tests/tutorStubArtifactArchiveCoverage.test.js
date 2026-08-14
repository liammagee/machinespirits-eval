import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DIRECT_CALLER_EXEMPTIONS,
  REQUIRED_ARCHIVE_BUILDERS,
  auditTutorStubArtifactLifecycle,
} from '../scripts/check-tutor-stub-artifact-lifecycle.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('every direct tutor-stub caller is classified and every empirical builder requires archival', () => {
  const result = auditTutorStubArtifactLifecycle(ROOT);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test('the inventory distinguishes empirical builders from narrow product and delegated exemptions', () => {
  assert.ok(REQUIRED_ARCHIVE_BUILDERS.includes('scripts/run-tutor-stub-auto-eval.js'));
  assert.match(DIRECT_CALLER_EXEMPTIONS['scripts/run-adaptive-warrant-baseline-study.js'], /provenance/u);
  assert.match(DIRECT_CALLER_EXEMPTIONS['services/tutorStubProcessSessionFactory.js'], /interactive/u);
  for (const relative of REQUIRED_ARCHIVE_BUILDERS) {
    assert.match(fs.readFileSync(path.join(ROOT, relative), 'utf8'), /\.\.\.requiredTutorStubArtifactArchiveArgs\(\)/u);
  }
});
