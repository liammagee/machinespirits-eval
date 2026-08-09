import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';

import {
  TUTOR_STUB_ARTIFACT_ARCHIVE_SCHEMA,
  createTutorStubArtifactArchiveMirror,
  normalizeTutorStubArtifactArchivePolicy,
  requiredTutorStubArtifactArchiveArgs,
  resolveTutorStubArtifactArchiveDirectory,
} from '../services/tutorStubArtifactArchive.js';
import { createTutorStubTraceRuntime } from '../services/tutorStubTraceRuntime.js';

function withTempRoots(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-artifact-source-'));
  const archive = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-artifact-archive-'));
  try {
    return fn({ root, archive });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(archive, { recursive: true, force: true });
  }
}

test('artifact archive policy and required child arguments are stable', () => {
  assert.equal(normalizeTutorStubArtifactArchivePolicy('best-effort'), 'best_effort');
  assert.deepEqual(requiredTutorStubArtifactArchiveArgs(), ['--artifact-archive', 'required']);
  assert.throws(() => normalizeTutorStubArtifactArchivePolicy('sometimes'), /must be one of/u);
});

test('linked worktrees resolve the private archive beside the main repository', () => {
  withTempRoots(({ root }) => {
    const parent = path.join(root, 'projects');
    const main = path.join(parent, 'machinespirits-eval');
    const archive = path.join(parent, 'machinespirits-eval-private');
    const linked = path.join(root, 'tmp-worktree');
    fs.mkdirSync(path.join(main, '.git'), { recursive: true });
    fs.mkdirSync(archive, { recursive: true });
    fs.mkdirSync(linked, { recursive: true });

    assert.equal(
      resolveTutorStubArtifactArchiveDirectory(null, {
        cwd: linked,
        repoRoot: linked,
        env: {},
        commonGitDirectory: path.join(main, '.git'),
      }),
      archive,
    );
  });
});

test('required live mirror preserves every event in compressed form and seals its chain manifest', () => {
  withTempRoots(({ root, archive }) => {
    const sourceTracePath = path.join(root, 'exports', 'trial', 'traces', 'job-1', 'run.jsonl');
    const mirror = createTutorStubArtifactArchiveMirror({
      policy: 'required',
      sourceTracePath,
      repoRoot: root,
      archiveDir: archive,
      env: {},
      metadata: { provenance: { git: { sha: '0123456789abcdef0123456789abcdef01234567' } } },
    });
    const rows = [
      { type: 'run_start', seq: 1 },
      { type: 'turn_complete', seq: 2, text: 'A public exchange.' },
      { type: 'run_end', seq: 3, reason: 'grounded' },
    ];
    for (const row of rows) mirror.append(`${JSON.stringify(row)}\n`, row);

    assert.equal(
      zlib.gunzipSync(fs.readFileSync(mirror.tracePath)).toString('utf8'),
      rows.map((row) => `${JSON.stringify(row)}\n`).join(''),
    );
    const manifest = JSON.parse(fs.readFileSync(mirror.manifestPath, 'utf8'));
    assert.equal(manifest.schema, TUTOR_STUB_ARTIFACT_ARCHIVE_SCHEMA);
    assert.equal(manifest.status, 'sealed');
    assert.equal(manifest.eventCount, 3);
    assert.equal(manifest.lastSequence, 3);
    assert.equal(manifest.lastEventType, 'run_end');
    assert.match(manifest.chainSha256, /^[0-9a-f]{64}$/u);
    assert.equal(manifest.sourceSha, '0123456789abcdef0123456789abcdef01234567');
    assert.equal(manifest.durableBeforeContinuation, true);
  });
});

test('required mode fails closed when durable storage is unavailable', () => {
  withTempRoots(({ root }) => {
    assert.throws(
      () =>
        createTutorStubArtifactArchiveMirror({
          policy: 'required',
          sourceTracePath: path.join(root, 'trace.jsonl'),
          repoRoot: root,
          archiveDir: path.join(root, 'missing-archive'),
          env: {},
          commonGitDirectory: path.join(root, 'missing.git'),
        }),
      /archive is unavailable/u,
    );
  });
});

test('trace runtime sends the exact redacted JSONL line to durable storage and the local recovery file', () => {
  withTempRoots(({ root }) => {
    const mirrored = [];
    const runtime = createTutorStubTraceRuntime({
      ROOT: root,
      fs,
      path,
      resolveWorkspacePath: (value) => path.resolve(root, value),
      safeTimestampForFile: () => 'run-1',
      captureTutorStubRunProvenance: () => ({ git: { sha: 'a'.repeat(40) } }),
      captureGitProvenanceSummary: () => ({}),
      hashCanonicalJson: () => 'hash',
      redactTraceSecrets: (entry) =>
        JSON.parse(JSON.stringify(entry, (key, value) => (key === 'secret' ? undefined : value))),
      formatTurnDebugId: (runId, turn) => `${runId}:t${turn}`,
      openingDebugId: (runId) => `${runId}:opening`,
      createTutorStubArtifactArchiveMirror: ({ policy }) => ({
        enabled: true,
        policy,
        append(line) {
          mirrored.push(line);
          return { ok: true };
        },
        snapshot() {
          return { enabled: true, policy, status: 'running' };
        },
      }),
    });
    const trace = runtime.createTraceState({
      enabled: true,
      traceDir: 'traces',
      artifactArchivePolicy: 'required',
      metadata: { secret: 'remove-me' },
    });
    runtime.appendTraceEvent(trace, { type: 'run_end', seq: 2, secret: 'remove-me' });

    const local = fs.readFileSync(trace.filePath, 'utf8');
    assert.equal(local, mirrored.join(''));
    assert.doesNotMatch(local, /remove-me/u);
    assert.match(local, /"type":"run_end"/u);
  });
});

test('required archival cannot be bypassed by disabling traces', () => {
  const runtime = createTutorStubTraceRuntime();
  assert.throws(
    () =>
      runtime.createTraceState({
        enabled: false,
        traceDir: 'unused',
        artifactArchivePolicy: 'required',
        metadata: {},
      }),
    /cannot be used with tracing disabled/u,
  );
});
