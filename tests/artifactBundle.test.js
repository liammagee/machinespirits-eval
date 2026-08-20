import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import {
  artifactBundleCachePath,
  fetchArtifactBundle,
  restoreArtifactBundle,
  verifyArtifactBundle,
} from '../scripts/artifact-bundle.js';

const ARTIFACT_BUNDLE_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'scripts',
  'artifact-bundle.js',
);
const MANIFEST_SCHEMA = 'machinespirits.artifact-bundle-manifest.v1';
const BUNDLE_ROOT = 'exports/fixture-bundle';
const TAR_BLOCK_BYTES = 512;
const TAR_RECORD_BYTES = TAR_BLOCK_BYTES * 20;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function writeTarString(header, offset, length, value) {
  const encoded = Buffer.from(value, 'utf8');
  assert.ok(encoded.length < length, `test tar field is too long: ${value}`);
  encoded.copy(header, offset);
}

function writeTarOctal(header, offset, length, value) {
  const encoded = value.toString(8).padStart(length - 1, '0');
  assert.ok(encoded.length < length, `test tar number is too long: ${value}`);
  header.write(encoded, offset, length - 1, 'ascii');
  header[offset + length - 1] = 0;
}

function tarHeader({ name, content, type = '0', linkName = '', corruptChecksum = false, signature = 'posix' }) {
  const header = Buffer.alloc(TAR_BLOCK_BYTES);
  writeTarString(header, 0, 100, name);
  writeTarOctal(header, 100, 8, 0o644);
  writeTarOctal(header, 108, 8, 0);
  writeTarOctal(header, 116, 8, 0);
  writeTarOctal(header, 124, 12, content.length);
  writeTarOctal(header, 136, 12, 0);
  header.fill(32, 148, 156);
  header[156] = type === '\0' ? 0 : type.charCodeAt(0);
  writeTarString(header, 157, 100, linkName);
  if (signature === 'gnu') header.write('ustar  \0', 257, 8, 'binary');
  else header.write('ustar\0' + '00', 257, 8, 'binary');
  let checksum = 0;
  for (const value of header) checksum += value;
  header.write(checksum.toString(8).padStart(6, '0'), 148, 6, 'ascii');
  header[154] = 0;
  header[155] = 32;
  if (corruptChecksum) header[100] ^= 1;
  return header;
}

function makeTar(records, { missingSecondTerminator = false, nonzeroTrailer = false, truncateBytes = 0 } = {}) {
  const chunks = [];
  for (const record of records) {
    const content = Buffer.from(record.content);
    chunks.push(tarHeader({ ...record, content }), content);
    const padding = Math.ceil(content.length / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES - content.length;
    if (padding) chunks.push(Buffer.alloc(padding));
  }
  const memberBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const totalBytes = Math.ceil((memberBytes + TAR_BLOCK_BYTES * 2) / TAR_RECORD_BYTES) * TAR_RECORD_BYTES;
  const tar = Buffer.alloc(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    chunk.copy(tar, offset);
    offset += chunk.length;
  }
  if (missingSecondTerminator) tar[offset + TAR_BLOCK_BYTES] = 1;
  if (nonzeroTrailer) tar[tar.length - 1] = 1;
  return truncateBytes ? tar.subarray(0, tar.length - truncateBytes) : tar;
}

function makeFixture(
  t,
  {
    files = [
      { file: 'alpha.txt', content: Buffer.from('alpha\n') },
      { file: 'nested/beta.bin', content: Buffer.from([0, 1, 2, 3, 255]) },
    ],
    records,
    tarOptions,
  } = {},
) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-bundle-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const normalizedFiles = files.map((entry) => ({ ...entry, content: Buffer.from(entry.content) }));
  const archiveRecords =
    records ||
    normalizedFiles.map((entry) => ({
      name: `${BUNDLE_ROOT}/${entry.file}`,
      content: entry.content,
    }));
  const tar = makeTar(archiveRecords, tarOptions);
  const archive = gzipSync(tar, { level: 9, mtime: 0 });
  const archivePath = path.join(directory, 'raw-bundle.tar.gz');
  const manifestPath = path.join(directory, 'raw-bundle-manifest.json');
  const manifest = {
    schema: MANIFEST_SCHEMA,
    archive: {
      path: `${BUNDLE_ROOT}/raw-bundle.tar.gz`,
      format: 'tar.gz',
      root: BUNDLE_ROOT,
      bytes: archive.length,
      sha256: sha256(archive),
    },
    files: normalizedFiles.map((entry) => ({
      file: entry.file,
      bytes: entry.content.length,
      sha256: sha256(entry.content),
    })),
  };
  fs.writeFileSync(archivePath, archive);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { archive, archivePath, directory, files: normalizedFiles, manifest, manifestPath, tar };
}

function writeManifest(fixture, mutate) {
  const manifest = structuredClone(fixture.manifest);
  mutate(manifest);
  const manifestPath = path.join(fixture.directory, `manifest-${crypto.randomUUID()}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

function expectedCachePath(fixture, cacheDir) {
  return path.join(cacheDir, 'sha256', `${fixture.manifest.archive.sha256}.tar.gz`);
}

test('verify, fetch, and restore preserve a digest-addressed, exact artifact bundle', (t) => {
  const fixture = makeFixture(t);
  const verification = verifyArtifactBundle({
    manifestPath: fixture.manifestPath,
    archivePath: fixture.archivePath,
  });
  assert.equal(verification.files, 2);
  assert.equal(verification.archiveBytes, fixture.archive.length);
  assert.equal(verification.restoredBytes, 11);

  const cacheDir = path.join(fixture.directory, 'cache');
  const fetched = fetchArtifactBundle({
    manifestPath: fixture.manifestPath,
    sourcePath: fixture.archivePath,
    cacheDir,
  });
  assert.equal(fetched.cacheHit, false);
  assert.equal(fetched.cachePath, expectedCachePath(fixture, cacheDir));
  assert.deepEqual(fs.readFileSync(fetched.cachePath), fixture.archive);
  assert.deepEqual(fs.readdirSync(path.dirname(fetched.cachePath)), [path.basename(fetched.cachePath)]);

  const hit = fetchArtifactBundle({
    manifestPath: fixture.manifestPath,
    sourcePath: fixture.archivePath,
    cacheDir,
  });
  assert.equal(hit.cacheHit, true);
  assert.equal(hit.cachePath, fetched.cachePath);

  const outDir = path.join(fixture.directory, 'restored');
  const restored = restoreArtifactBundle({
    manifestPath: fixture.manifestPath,
    archivePath: fetched.cachePath,
    outDir,
  });
  assert.equal(restored.replacedEmptyDestination, false);
  for (const entry of fixture.files) {
    assert.deepEqual(fs.readFileSync(path.join(outDir, BUNDLE_ROOT, entry.file)), entry.content);
  }

  const emptyOut = path.join(fixture.directory, 'empty-destination');
  fs.mkdirSync(emptyOut);
  const replaced = restoreArtifactBundle({
    manifestPath: fixture.manifestPath,
    archivePath: fetched.cachePath,
    outDir: emptyOut,
  });
  assert.equal(replaced.replacedEmptyDestination, true);
  assert.deepEqual(fs.readFileSync(path.join(emptyOut, BUNDLE_ROOT, 'alpha.txt')), Buffer.from('alpha\n'));
});

test('CLI exposes the frozen verify, fetch, and restore contract', (t) => {
  const fixture = makeFixture(t);
  const verify = spawnSync(
    process.execPath,
    [ARTIFACT_BUNDLE_SCRIPT, 'verify', '--manifest', fixture.manifestPath, '--archive', fixture.archivePath],
    { encoding: 'utf8' },
  );
  assert.equal(verify.status, 0, verify.stderr);
  assert.equal(
    verify.stdout.trim(),
    `verified ${fixture.archivePath} (${fixture.archive.length} archive byte(s); 2 file(s); 11 restored byte(s))`,
  );

  const cacheDir = path.join(fixture.directory, 'cli-cache');
  const fetch = spawnSync(
    process.execPath,
    [
      ARTIFACT_BUNDLE_SCRIPT,
      'fetch',
      '--manifest',
      fixture.manifestPath,
      '--source',
      fixture.archivePath,
      '--cache-dir',
      cacheDir,
    ],
    { encoding: 'utf8' },
  );
  const cachePath = expectedCachePath(fixture, cacheDir);
  assert.equal(fetch.status, 0, fetch.stderr);
  assert.equal(fetch.stdout, `archive  ${cachePath}\nstatus   published\nverified 2 file(s), 11 restored byte(s)\n`);

  const outDir = path.join(fixture.directory, 'cli-restored');
  const restore = spawnSync(
    process.execPath,
    [ARTIFACT_BUNDLE_SCRIPT, 'restore', '--manifest', fixture.manifestPath, '--archive', cachePath, '--out', outDir],
    { encoding: 'utf8' },
  );
  assert.equal(restore.status, 0, restore.stderr);
  assert.equal(restore.stdout, `restored and verified ${outDir} (2 file(s); 11 byte(s))\n`);
});

test('archive byte count and digest are checked before decompression', (t) => {
  const fixture = makeFixture(t);
  const sameSizeCorruption = Buffer.from(fixture.archive);
  sameSizeCorruption[Math.floor(sameSizeCorruption.length / 2)] ^= 1;
  const corruptPath = path.join(fixture.directory, 'same-size-corrupt.tar.gz');
  fs.writeFileSync(corruptPath, sameSizeCorruption);
  assert.throws(
    () => verifyArtifactBundle({ manifestPath: fixture.manifestPath, archivePath: corruptPath }),
    /Archive checksum does not match manifest/u,
  );

  const wrongBytesManifest = writeManifest(fixture, (manifest) => {
    manifest.archive.bytes += 1;
  });
  assert.throws(
    () => verifyArtifactBundle({ manifestPath: wrongBytesManifest, archivePath: fixture.archivePath }),
    /Archive byte count does not match manifest/u,
  );
});

test('each restored member is bound to its own byte count and checksum', (t) => {
  const fixture = makeFixture(t);
  const wrongChecksumManifest = writeManifest(fixture, (manifest) => {
    manifest.files[0].sha256 = sha256(Buffer.from('omega\n'));
  });
  assert.throws(
    () => verifyArtifactBundle({ manifestPath: wrongChecksumManifest, archivePath: fixture.archivePath }),
    /Artifact checksum mismatch for alpha\.txt/u,
  );

  const wrongBytesManifest = writeManifest(fixture, (manifest) => {
    manifest.files[0].bytes += 1;
  });
  assert.throws(
    () => verifyArtifactBundle({ manifestPath: wrongBytesManifest, archivePath: fixture.archivePath }),
    /Artifact byte-count mismatch for alpha\.txt/u,
  );
});

test('member set rejects duplicate, extra, and missing records', async (t) => {
  const files = [
    { file: 'alpha.txt', content: Buffer.from('alpha\n') },
    { file: 'beta.txt', content: Buffer.from('beta\n') },
  ];
  const alpha = { name: `${BUNDLE_ROOT}/alpha.txt`, content: files[0].content };
  const beta = { name: `${BUNDLE_ROOT}/beta.txt`, content: files[1].content };
  const cases = [
    { records: [alpha, alpha, beta], pattern: /Duplicate tar member/u },
    {
      records: [alpha, beta, { name: `${BUNDLE_ROOT}/extra.txt`, content: Buffer.from('extra\n') }],
      pattern: /Unexpected tar member/u,
    },
    { records: [alpha], pattern: /Missing tar member/u },
  ];
  for (const entry of cases) {
    await t.test(entry.pattern.source, (subtest) => {
      const fixture = makeFixture(subtest, { files, records: entry.records });
      assert.throws(
        () => verifyArtifactBundle({ manifestPath: fixture.manifestPath, archivePath: fixture.archivePath }),
        entry.pattern,
      );
    });
  }
});

test('unsafe paths, links, special members, and extensions are rejected', async (t) => {
  const content = Buffer.from('alpha\n');
  const files = [{ file: 'alpha.txt', content }];
  const cases = [
    { record: { name: '../escape.txt', content }, pattern: /unsafe path component/u },
    { record: { name: '/absolute.txt', content }, pattern: /must not be absolute/u },
    { record: { name: 'C:drive-relative.txt', content }, pattern: /drive-qualified/u },
    {
      record: { name: `${BUNDLE_ROOT}/alpha.txt`, content, type: '2', linkName: '../target' },
      pattern: /regular file/u,
    },
    { record: { name: `${BUNDLE_ROOT}/alpha.txt`, content, type: '1', linkName: 'target' }, pattern: /regular file/u },
    { record: { name: `${BUNDLE_ROOT}/alpha.txt`, content, type: 'x' }, pattern: /regular file/u },
  ];
  for (const entry of cases) {
    await t.test(entry.pattern.source, (subtest) => {
      const fixture = makeFixture(subtest, { files, records: [entry.record] });
      assert.throws(
        () => verifyArtifactBundle({ manifestPath: fixture.manifestPath, archivePath: fixture.archivePath }),
        entry.pattern,
      );
    });
  }
});

test('header checksum, truncation, terminators, and trailer are checked', async (t) => {
  const content = Buffer.from('alpha\n');
  const files = [{ file: 'alpha.txt', content }];
  const record = { name: `${BUNDLE_ROOT}/alpha.txt`, content };
  const cases = [
    { records: [{ ...record, corruptChecksum: true }], pattern: /Tar header checksum mismatch/u },
    { records: [record], tarOptions: { truncateBytes: TAR_BLOCK_BYTES }, pattern: /Tar byte count does not match/u },
    {
      records: [record],
      tarOptions: { missingSecondTerminator: true },
      pattern: /missing its second zero terminator block/u,
    },
    { records: [record], tarOptions: { nonzeroTrailer: true }, pattern: /non-zero data after its terminator/u },
  ];
  for (const entry of cases) {
    await t.test(entry.pattern.source, (subtest) => {
      const fixture = makeFixture(subtest, { files, records: entry.records, tarOptions: entry.tarOptions });
      assert.throws(
        () => verifyArtifactBundle({ manifestPath: fixture.manifestPath, archivePath: fixture.archivePath }),
        entry.pattern,
      );
    });
  }
});

test('GNU-compatible USTAR regular headers are accepted without accepting GNU extensions', (t) => {
  const content = Buffer.from('alpha\n');
  const fixture = makeFixture(t, {
    files: [{ file: 'alpha.txt', content }],
    records: [{ name: `${BUNDLE_ROOT}/alpha.txt`, content, signature: 'gnu' }],
  });
  assert.equal(verifyArtifactBundle({ manifestPath: fixture.manifestPath, archivePath: fixture.archivePath }).files, 1);
});

test('restore rejects non-empty and symbolic-link destinations without partial output', (t) => {
  const fixture = makeFixture(t);
  const nonempty = path.join(fixture.directory, 'nonempty');
  fs.mkdirSync(nonempty);
  fs.writeFileSync(path.join(nonempty, 'keep.txt'), 'keep\n');
  assert.throws(
    () =>
      restoreArtifactBundle({ manifestPath: fixture.manifestPath, archivePath: fixture.archivePath, outDir: nonempty }),
    /Refusing to restore into non-empty directory/u,
  );
  assert.equal(fs.readFileSync(path.join(nonempty, 'keep.txt'), 'utf8'), 'keep\n');

  const target = path.join(fixture.directory, 'symlink-target');
  const symlink = path.join(fixture.directory, 'symlink-out');
  fs.mkdirSync(target);
  fs.symlinkSync(target, symlink, 'dir');
  assert.throws(
    () =>
      restoreArtifactBundle({ manifestPath: fixture.manifestPath, archivePath: fixture.archivePath, outDir: symlink }),
    /must be absent or an empty directory/u,
  );
  assert.ok(fs.lstatSync(symlink).isSymbolicLink());
  assert.deepEqual(
    fs.readdirSync(fixture.directory).filter((name) => name.includes('.tmp-')),
    [],
  );
});

test('restore cleans staging and preserves destination state when writing or publication fails', (t) => {
  const fixture = makeFixture(t);
  const originalWriteFileSync = fs.writeFileSync;
  const originalRenameSync = fs.renameSync;
  t.after(() => {
    fs.writeFileSync = originalWriteFileSync;
    fs.renameSync = originalRenameSync;
  });

  const absentOut = path.join(fixture.directory, 'write-failure-out');
  fs.writeFileSync = (filePath, ...args) => {
    if (String(filePath).includes('.write-failure-out.tmp-')) throw new Error('simulated staging write failure');
    return originalWriteFileSync(filePath, ...args);
  };
  assert.throws(
    () =>
      restoreArtifactBundle({
        manifestPath: fixture.manifestPath,
        archivePath: fixture.archivePath,
        outDir: absentOut,
      }),
    /simulated staging write failure/u,
  );
  assert.equal(fs.existsSync(absentOut), false);
  assert.deepEqual(
    fs.readdirSync(fixture.directory).filter((name) => name.includes('.write-failure-out.tmp-')),
    [],
  );

  fs.writeFileSync = originalWriteFileSync;
  const emptyOut = path.join(fixture.directory, 'rename-failure-out');
  fs.mkdirSync(emptyOut, { mode: 0o755 });
  const before = fs.statSync(emptyOut);
  fs.renameSync = (source, destination) => {
    if (destination === emptyOut) throw new Error('simulated atomic publication failure');
    return originalRenameSync(source, destination);
  };
  assert.throws(
    () =>
      restoreArtifactBundle({
        manifestPath: fixture.manifestPath,
        archivePath: fixture.archivePath,
        outDir: emptyOut,
      }),
    /simulated atomic publication failure/u,
  );
  const after = fs.statSync(emptyOut);
  assert.equal(after.ino, before.ino);
  assert.equal(after.mode, before.mode);
  assert.deepEqual(fs.readdirSync(emptyOut), []);
  assert.deepEqual(
    fs.readdirSync(fixture.directory).filter((name) => name.includes('.rename-failure-out.tmp-')),
    [],
  );
});

test('fetch verifies corrupt cache hits and leaves cache and temporary state untouched', (t) => {
  const fixture = makeFixture(t);
  const cacheDir = path.join(fixture.directory, 'cache');
  const cachePath = artifactBundleCachePath({ manifestPath: fixture.manifestPath, cacheDir });
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  const corrupt = Buffer.from(fixture.archive);
  corrupt[0] ^= 1;
  fs.writeFileSync(cachePath, corrupt);
  assert.throws(
    () =>
      fetchArtifactBundle({
        manifestPath: fixture.manifestPath,
        sourcePath: fixture.archivePath,
        cacheDir,
      }),
    /Archive checksum does not match manifest/u,
  );
  assert.deepEqual(fs.readFileSync(cachePath), corrupt);
  assert.deepEqual(fs.readdirSync(path.dirname(cachePath)), [path.basename(cachePath)]);
});

test('fetch verifies its explicit source even when the digest cache already exists', (t) => {
  const fixture = makeFixture(t);
  const cacheDir = path.join(fixture.directory, 'cache');
  const first = fetchArtifactBundle({
    manifestPath: fixture.manifestPath,
    sourcePath: fixture.archivePath,
    cacheDir,
  });
  const originalCache = fs.readFileSync(first.cachePath);

  assert.throws(
    () =>
      fetchArtifactBundle({
        manifestPath: fixture.manifestPath,
        sourcePath: path.join(fixture.directory, 'missing.tar.gz'),
        cacheDir,
      }),
    /artifact bundle archive does not exist/u,
  );

  const corruptPath = path.join(fixture.directory, 'corrupt-source.tar.gz');
  const corrupt = Buffer.from(fixture.archive);
  corrupt[0] ^= 1;
  fs.writeFileSync(corruptPath, corrupt);
  assert.throws(
    () =>
      fetchArtifactBundle({
        manifestPath: fixture.manifestPath,
        sourcePath: corruptPath,
        cacheDir,
      }),
    /Archive checksum does not match manifest/u,
  );

  const symlinkPath = path.join(fixture.directory, 'source-symlink.tar.gz');
  fs.symlinkSync(fixture.archivePath, symlinkPath);
  assert.throws(
    () =>
      fetchArtifactBundle({
        manifestPath: fixture.manifestPath,
        sourcePath: symlinkPath,
        cacheDir,
      }),
    /artifact bundle archive must be a regular file/u,
  );
  assert.deepEqual(fs.readFileSync(first.cachePath), originalCache);
});

test('fetch verifies a concurrent publisher and cleans its temporary file after publication failure', (t) => {
  const fixture = makeFixture(t);
  const originalLinkSync = fs.linkSync;
  t.after(() => {
    fs.linkSync = originalLinkSync;
  });

  const raceCacheDir = path.join(fixture.directory, 'race-cache');
  fs.linkSync = (_temporary, cachePath) => {
    fs.copyFileSync(fixture.archivePath, cachePath, fs.constants.COPYFILE_EXCL);
    const error = new Error('simulated concurrent cache publisher');
    error.code = 'EEXIST';
    throw error;
  };
  const raceResult = fetchArtifactBundle({
    manifestPath: fixture.manifestPath,
    sourcePath: fixture.archivePath,
    cacheDir: raceCacheDir,
  });
  assert.equal(raceResult.cacheHit, true);
  assert.deepEqual(fs.readFileSync(raceResult.cachePath), fixture.archive);
  assert.deepEqual(fs.readdirSync(path.dirname(raceResult.cachePath)), [path.basename(raceResult.cachePath)]);

  const failedCacheDir = path.join(fixture.directory, 'failed-cache');
  fs.linkSync = () => {
    const error = new Error('simulated cache publication denial');
    error.code = 'EACCES';
    throw error;
  };
  assert.throws(
    () =>
      fetchArtifactBundle({
        manifestPath: fixture.manifestPath,
        sourcePath: fixture.archivePath,
        cacheDir: failedCacheDir,
      }),
    /simulated cache publication denial/u,
  );
  assert.deepEqual(fs.readdirSync(path.join(failedCacheDir, 'sha256')), []);
});

test('fetch pins one manifest snapshot and never publishes changed bytes under the original digest', (t) => {
  const fixture = makeFixture(t);
  const changedArchive = Buffer.from(fixture.archive);
  changedArchive[4] ^= 1;
  const changedArchivePath = path.join(fixture.directory, 'changed-header.tar.gz');
  fs.writeFileSync(changedArchivePath, changedArchive);
  assert.notEqual(sha256(changedArchive), fixture.manifest.archive.sha256);

  const changedManifest = structuredClone(fixture.manifest);
  changedManifest.archive.sha256 = sha256(changedArchive);
  const originalCopyFileSync = fs.copyFileSync;
  t.after(() => {
    fs.copyFileSync = originalCopyFileSync;
  });
  fs.copyFileSync = (_source, destination, flags) => {
    fs.writeFileSync(fixture.manifestPath, `${JSON.stringify(changedManifest, null, 2)}\n`);
    return originalCopyFileSync(changedArchivePath, destination, flags);
  };

  const cacheDir = path.join(fixture.directory, 'manifest-race-cache');
  const originalCachePath = expectedCachePath(fixture, cacheDir);
  assert.throws(
    () =>
      fetchArtifactBundle({
        manifestPath: fixture.manifestPath,
        sourcePath: fixture.archivePath,
        cacheDir,
      }),
    /Archive checksum does not match manifest|manifest changed/u,
  );
  assert.equal(fs.existsSync(originalCachePath), false);
  assert.deepEqual(fs.readdirSync(path.dirname(originalCachePath)), []);
});

test('manifest rejects portable-name and file-parent collisions before archive access', (t) => {
  const fixture = makeFixture(t, { files: [{ file: 'alpha.txt', content: Buffer.from('alpha\n') }] });
  const collisionCases = [
    ['Case.txt', 'case.txt'],
    ['Directory/first.txt', 'directory/second.txt'],
    ['parent', 'parent/child.txt'],
    ['café.txt', 'cafe\u0301.txt'],
  ];
  for (const files of collisionCases) {
    const manifestPath = writeManifest(fixture, (manifest) => {
      manifest.files = files.map((file) => ({ file, bytes: 1, sha256: sha256(Buffer.from('x')) }));
    });
    assert.throws(
      () => verifyArtifactBundle({ manifestPath, archivePath: fixture.archivePath }),
      /paths collide|file\/parent path collision/u,
    );
  }
});
