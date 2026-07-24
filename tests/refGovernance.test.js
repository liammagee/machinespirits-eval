import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArchiveEntries,
  buildVersionStatus,
  parseRefLines,
  renderRefStatus,
  validateManagedTags,
} from '../scripts/ref-governance.js';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

function ref(refname, options = {}) {
  return {
    refname,
    objectType: options.objectType || 'commit',
    objectName: options.objectName || SHA_A,
    peeledObjectType: options.peeledObjectType || '',
    peeledObjectName: options.peeledObjectName || '',
    creatorDate: options.creatorDate || '2026-07-24T10:00:00+10:00',
    subject: options.subject || 'fixture ref',
  };
}

function annotatedTag(refname, target = SHA_A) {
  return ref(refname, {
    objectType: 'tag',
    objectName: SHA_B,
    peeledObjectType: 'commit',
    peeledObjectName: target,
  });
}

test('parseRefLines reads peeled annotated-tag targets', () => {
  const rows = parseRefLines(
    `refs/tags/release/v0.6.0\ttag\t${SHA_B}\tcommit\t${SHA_A}\t2026-07-24T10:00:00+10:00\trelease fixture\n`,
  );
  assert.deepEqual(rows, [
    {
      refname: 'refs/tags/release/v0.6.0',
      objectType: 'tag',
      objectName: SHA_B,
      peeledObjectType: 'commit',
      peeledObjectName: SHA_A,
      creatorDate: '2026-07-24T10:00:00+10:00',
      subject: 'release fixture',
    },
  ]);
});

test('canonical archive branch and snapshot tag form a complete non-colliding pair', () => {
  const entries = buildArchiveEntries([
    ref('refs/remotes/origin/archive/feature-probe-2026-07-24'),
    annotatedTag('refs/tags/archive-snapshot/feature-probe-2026-07-24'),
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].state, 'complete');
  assert.deepEqual(entries[0].errors, []);
  assert.deepEqual(entries[0].warnings, []);
});

test('legacy tag-only archives are visible but grandfathered', () => {
  const [entry] = buildArchiveEntries([annotatedTag('refs/tags/archive/old-prototype')]);
  assert.equal(entry.state, 'legacy tag only');
  assert.deepEqual(entry.errors, []);
  assert.match(entry.warnings[0], /grandfathered/);
});

test('archive target mismatches and lightweight tags are blocking errors', () => {
  const [mismatch] = buildArchiveEntries([
    ref('refs/remotes/origin/archive/feature-probe-2026-07-24'),
    annotatedTag('refs/tags/archive-snapshot/feature-probe-2026-07-24', SHA_B),
  ]);
  assert.equal(mismatch.state, 'invalid');
  assert.match(mismatch.errors.join('\n'), /target different commits/);

  const [lightweight] = buildArchiveEntries([
    ref('refs/remotes/origin/archive/other-probe-2026-07-24'),
    ref('refs/tags/archive-snapshot/other-probe-2026-07-24'),
  ]);
  assert.match(lightweight.errors.join('\n'), /lightweight/);
});

test('managed release, paper, experiment, and archive tags must be annotated and well named', () => {
  const valid = [
    annotatedTag('refs/tags/release/v0.6.0'),
    annotatedTag('refs/tags/paper/v3.0.228'),
    annotatedTag('refs/tags/experiment/program-2/phase5d/results-2026-07-22'),
    annotatedTag('refs/tags/archive-snapshot/feature-probe-2026-07-24'),
  ];
  assert.deepEqual(validateManagedTags(valid), []);

  const errors = validateManagedTags([
    ref('refs/tags/release/v0.6.0'),
    annotatedTag('refs/tags/paper/3.0'),
    annotatedTag('refs/tags/experiment/program-2/phase5d/done'),
  ]);
  assert.equal(errors.length, 3);
  assert.match(errors.join('\n'), /annotated/);
  assert.match(errors.join('\n'), /invalid managed tag name/);
});

test('status rendering keeps repository, paper, and legacy versions separate', () => {
  const refs = [
    annotatedTag('refs/tags/release/v0.6.0'),
    annotatedTag('refs/tags/paper/v3.0.228'),
    annotatedTag('refs/tags/v3.0.92'),
  ];
  const versionStatus = buildVersionStatus(refs, {
    repositoryVersion: '0.6.0',
    paperVersion: '3.0.228',
  });
  assert.equal(versionStatus.repositoryState, 'aligned');
  assert.equal(versionStatus.paperState, 'aligned');

  const output = renderRefStatus({ archiveEntries: [], versionStatus });
  assert.match(output, /Repository\/package \| `0\.6\.0`/);
  assert.match(output, /Canonical paper \| `3\.0\.228`/);
  assert.match(output, /Legacy mixed `v\*` namespace/);
});
