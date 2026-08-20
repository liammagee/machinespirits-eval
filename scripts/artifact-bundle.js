#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

export const ARTIFACT_BUNDLE_MANIFEST_SCHEMA = 'machinespirits.artifact-bundle-manifest.v1';

const TAR_BLOCK_BYTES = 512;
const TAR_RECORD_BYTES = TAR_BLOCK_BYTES * 20;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isMissing(error) {
  return error?.code === 'ENOENT';
}

function lstatOrNull(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

function assertRegularFile(filePath, label) {
  const stat = lstatOrNull(filePath);
  if (!stat) throw new Error(`${label} does not exist: ${filePath}`);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular file: ${filePath}`);
  return stat;
}

function hasControlCharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 31 || codePoint === 127) return true;
  }
  return false;
}

function validateRelativePath(value, label) {
  if (typeof value !== 'string' || !value) throw new Error(`${label} must be a non-empty relative path`);
  if (hasControlCharacter(value)) throw new Error(`${label} contains a control character`);
  if (value.includes('\\')) throw new Error(`${label} must use forward slashes`);
  if (path.posix.isAbsolute(value) || path.win32.parse(value).root) {
    throw new Error(`${label} must not be absolute or drive-qualified: ${value}`);
  }
  const parts = value.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`${label} contains an unsafe path component: ${value}`);
  }
  return parts.join('/');
}

function portablePathKey(value) {
  return value.normalize('NFD').toLowerCase();
}

function assertPortablePathSet(paths, label) {
  const seen = new Map();
  for (const value of paths) {
    const parts = value.split('/');
    for (let index = 1; index <= parts.length; index += 1) {
      const candidate = parts.slice(0, index).join('/');
      const type = index === parts.length ? 'file' : 'directory';
      const key = portablePathKey(candidate);
      const collision = seen.get(key);
      if (collision && collision.type !== type) {
        throw new Error(`${label} contains a file/parent path collision: ${collision.path}, ${value}`);
      }
      if (collision && collision.path !== candidate) {
        throw new Error(`${label} paths collide on a case-insensitive filesystem: ${collision.path}, ${candidate}`);
      }
      seen.set(key, { path: candidate, type });
    }
  }
}

function validateBytes(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
  return value;
}

function validateSha256(value, label) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return value;
}

export function readArtifactBundleManifest(manifestPath) {
  if (!manifestPath) throw new Error('manifestPath is required');
  const resolved = path.resolve(manifestPath);
  assertRegularFile(resolved, 'artifact bundle manifest');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (error) {
    throw new Error(`Could not parse artifact bundle manifest ${resolved}: ${error.message}`, { cause: error });
  }
  if (manifest?.schema !== ARTIFACT_BUNDLE_MANIFEST_SCHEMA) {
    throw new Error(`Unsupported artifact bundle manifest schema: ${manifest?.schema || 'missing'}`);
  }
  if (!manifest.archive || typeof manifest.archive !== 'object') {
    throw new Error('artifact bundle manifest archive block is required');
  }
  if (manifest.archive.format !== 'tar.gz') {
    throw new Error(`Unsupported artifact bundle format: ${manifest.archive.format || 'missing'}`);
  }
  const archive = {
    path: validateRelativePath(manifest.archive.path, 'archive.path'),
    format: manifest.archive.format,
    root: validateRelativePath(manifest.archive.root, 'archive.root'),
    bytes: validateBytes(manifest.archive.bytes, 'archive.bytes'),
    sha256: validateSha256(manifest.archive.sha256, 'archive.sha256'),
  };
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('artifact bundle manifest files must be a non-empty array');
  }
  const seen = new Set();
  const files = manifest.files.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`files[${index}] must be an object`);
    const file = validateRelativePath(entry.file, `files[${index}].file`);
    if (seen.has(file)) throw new Error(`Duplicate manifest file: ${file}`);
    seen.add(file);
    return {
      file,
      bytes: validateBytes(entry.bytes, `files[${index}].bytes`),
      sha256: validateSha256(entry.sha256, `files[${index}].sha256`),
    };
  });
  assertPortablePathSet(
    files.map((entry) => entry.file),
    'artifact bundle manifest',
  );
  return { path: resolved, manifest: { ...manifest, archive, files } };
}

function tarString(header, offset, length, label) {
  const field = header.subarray(offset, offset + length);
  const nul = field.indexOf(0);
  if (nul !== -1 && !isZeroBlock(field.subarray(nul))) {
    throw new Error(`Invalid tar ${label}: non-zero bytes after NUL terminator`);
  }
  try {
    return UTF8_DECODER.decode(field.subarray(0, nul === -1 ? field.length : nul));
  } catch (error) {
    throw new Error(`Invalid UTF-8 in tar ${label}`, { cause: error });
  }
}

function tarNumber(header, offset, length, label) {
  const field = header.subarray(offset, offset + length);
  if (field[0] & 0x80) throw new Error(`Unsupported base-256 tar ${label}`);
  const text = field.toString('ascii').replace(/\0.*$/u, '').trim();
  if (!text) return 0;
  if (!/^[0-7]+$/u.test(text)) throw new Error(`Invalid tar ${label}: ${JSON.stringify(text)}`);
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Unsafe tar ${label}: ${text}`);
  return value;
}

function validateTarChecksum(header, memberName) {
  const expected = tarNumber(header, 148, 8, 'header checksum');
  let observed = 0;
  for (let index = 0; index < header.length; index += 1) {
    observed += index >= 148 && index < 156 ? 32 : header[index];
  }
  if (expected !== observed) throw new Error(`Tar header checksum mismatch: ${memberName || '(unnamed member)'}`);
}

function isZeroBlock(block) {
  for (const value of block) if (value !== 0) return false;
  return true;
}

function expectedTarMembers(manifest) {
  return new Map(manifest.files.map((entry) => [`${manifest.archive.root}/${entry.file}`, entry]));
}

function expectedTarBytes(manifest) {
  let bytes = TAR_BLOCK_BYTES * 2;
  for (const entry of manifest.files) {
    const paddedContentBytes = Math.ceil(entry.bytes / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
    bytes += TAR_BLOCK_BYTES + paddedContentBytes;
    if (!Number.isSafeInteger(bytes)) throw new Error('Artifact bundle is too large to verify safely');
  }
  return Math.ceil(bytes / TAR_RECORD_BYTES) * TAR_RECORD_BYTES;
}

function hasSupportedTarSignature(header) {
  const signature = header.subarray(257, 265);
  return (
    signature.equals(Buffer.from('ustar\0' + '00', 'ascii')) || signature.equals(Buffer.from('ustar ' + ' \0', 'ascii'))
  );
}

function inspectTarArchive(archiveBuffer, manifest) {
  const tarBytes = expectedTarBytes(manifest);
  let tar;
  try {
    tar = gunzipSync(archiveBuffer, { maxOutputLength: tarBytes });
  } catch (error) {
    throw new Error(`Could not decompress tar.gz artifact bundle: ${error.message}`, { cause: error });
  }
  if (tar.length !== tarBytes) {
    throw new Error(`Tar byte count does not match manifest-derived bound: ${tar.length} != ${tarBytes}`);
  }
  const expected = expectedTarMembers(manifest);
  const found = new Map();
  let offset = 0;
  let terminated = false;
  while (offset + TAR_BLOCK_BYTES <= tar.length) {
    const header = tar.subarray(offset, offset + TAR_BLOCK_BYTES);
    if (isZeroBlock(header)) {
      const second = tar.subarray(offset + TAR_BLOCK_BYTES, offset + TAR_BLOCK_BYTES * 2);
      if (second.length !== TAR_BLOCK_BYTES || !isZeroBlock(second)) {
        throw new Error('Tar archive is missing its second zero terminator block');
      }
      if (!isZeroBlock(tar.subarray(offset))) throw new Error('Tar archive has non-zero data after its terminator');
      terminated = true;
      break;
    }
    const name = tarString(header, 0, 100, 'member name');
    const prefix = tarString(header, 345, 155, 'member prefix');
    if (!name) throw new Error('Tar member name must not be empty');
    const memberName = prefix ? `${prefix}/${name}` : name;
    validateTarChecksum(header, memberName);
    if (!hasSupportedTarSignature(header)) {
      throw new Error(`Tar member has an unsupported USTAR signature: ${memberName}`);
    }
    validateRelativePath(memberName, 'tar member');
    const type = header[156];
    const linkName = tarString(header, 157, 100, 'link name');
    if (![0, 48].includes(type) || linkName) {
      const printableType = type === 0 ? '\\0' : String.fromCharCode(type);
      throw new Error(`Tar member must be a regular file: ${memberName} (type ${printableType})`);
    }
    if (found.has(memberName)) throw new Error(`Duplicate tar member: ${memberName}`);
    const expectedEntry = expected.get(memberName);
    if (!expectedEntry) throw new Error(`Unexpected tar member: ${memberName}`);
    const size = tarNumber(header, 124, 12, `size for ${memberName}`);
    const contentOffset = offset + TAR_BLOCK_BYTES;
    const contentEnd = contentOffset + size;
    const paddedContentEnd = contentOffset + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
    if (contentEnd > tar.length || paddedContentEnd > tar.length)
      throw new Error(`Truncated tar member: ${memberName}`);
    const content = tar.subarray(contentOffset, contentEnd);
    if (!isZeroBlock(tar.subarray(contentEnd, paddedContentEnd))) {
      throw new Error(`Tar member has non-zero padding: ${memberName}`);
    }
    if (content.length !== expectedEntry.bytes) {
      throw new Error(
        `Artifact byte-count mismatch for ${expectedEntry.file}: ${content.length} != ${expectedEntry.bytes}`,
      );
    }
    const observedSha256 = sha256(content);
    if (observedSha256 !== expectedEntry.sha256) {
      throw new Error(`Artifact checksum mismatch for ${expectedEntry.file}`);
    }
    found.set(memberName, { ...expectedEntry, member: memberName, content });
    offset = paddedContentEnd;
  }
  if (!terminated) throw new Error('Tar archive is missing its zero terminator blocks');
  const missing = [...expected.keys()].filter((member) => !found.has(member));
  if (missing.length) throw new Error(`Missing tar member${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`);
  return [...found.values()];
}

function inspectArtifactBundle({ manifestPath, archivePath, manifestInfo }) {
  if (!archivePath) throw new Error('archivePath is required');
  const { manifest, path: resolvedManifestPath } = manifestInfo || readArtifactBundleManifest(manifestPath);
  const resolvedArchivePath = path.resolve(archivePath);
  const stat = assertRegularFile(resolvedArchivePath, 'artifact bundle archive');
  if (stat.size !== manifest.archive.bytes) {
    throw new Error(`Archive byte count does not match manifest: ${stat.size} != ${manifest.archive.bytes}`);
  }
  const archiveBuffer = fs.readFileSync(resolvedArchivePath);
  if (archiveBuffer.length !== manifest.archive.bytes) {
    throw new Error(`Archive byte count changed while reading: ${archiveBuffer.length} != ${manifest.archive.bytes}`);
  }
  const archiveSha256 = sha256(archiveBuffer);
  if (archiveSha256 !== manifest.archive.sha256) throw new Error('Archive checksum does not match manifest');
  const entries = inspectTarArchive(archiveBuffer, manifest);
  return {
    manifest,
    manifestPath: resolvedManifestPath,
    archivePath: resolvedArchivePath,
    archiveBytes: stat.size,
    archiveSha256,
    files: entries.length,
    restoredBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    entries,
  };
}

function publicVerification(inspection) {
  const { entries: _entries, manifest: _manifest, ...summary } = inspection;
  return summary;
}

export function verifyArtifactBundle({ manifestPath, archivePath } = {}) {
  return publicVerification(inspectArtifactBundle({ manifestPath, archivePath }));
}

function cachePathForManifest(manifest, cacheDir) {
  return path.join(path.resolve(cacheDir), 'sha256', `${manifest.archive.sha256}.tar.gz`);
}

export function artifactBundleCachePath({ manifestPath, cacheDir } = {}) {
  if (!cacheDir) throw new Error('cacheDir is required');
  const { manifest } = readArtifactBundleManifest(manifestPath);
  return cachePathForManifest(manifest, cacheDir);
}

function assertDigestAddress(cachePath, verification) {
  const expectedName = `${verification.archiveSha256}.tar.gz`;
  if (path.basename(cachePath) !== expectedName) {
    throw new Error('Artifact bundle manifest changed while publishing its cache object');
  }
}

export function fetchArtifactBundle({ manifestPath, sourcePath, cacheDir } = {}) {
  if (!sourcePath) throw new Error('sourcePath is required');
  if (!cacheDir) throw new Error('cacheDir is required');
  const manifestInfo = readArtifactBundleManifest(manifestPath);
  const cachePath = cachePathForManifest(manifestInfo.manifest, cacheDir);
  const source = path.resolve(sourcePath);
  inspectArtifactBundle({ archivePath: source, manifestInfo });
  const cached = lstatOrNull(cachePath);
  if (cached) {
    const inspection = inspectArtifactBundle({ archivePath: cachePath, manifestInfo });
    assertDigestAddress(cachePath, inspection);
    return { ...publicVerification(inspection), cachePath, cacheHit: true };
  }
  const cacheParent = path.dirname(cachePath);
  fs.mkdirSync(cacheParent, { recursive: true });
  const temporary = path.join(cacheParent, `.tmp-${process.pid}-${crypto.randomUUID()}`);
  let published = false;
  let result;
  let operationError;
  try {
    fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(temporary, 0o600);
    const temporaryInspection = inspectArtifactBundle({ archivePath: temporary, manifestInfo });
    assertDigestAddress(cachePath, temporaryInspection);
    try {
      fs.linkSync(temporary, cachePath);
      published = true;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
    const inspection = inspectArtifactBundle({ archivePath: cachePath, manifestInfo });
    assertDigestAddress(cachePath, inspection);
    result = { ...publicVerification(inspection), cachePath, cacheHit: !published };
  } catch (error) {
    operationError = error;
  }
  let cleanupError;
  try {
    fs.unlinkSync(temporary);
  } catch (error) {
    if (!isMissing(error)) cleanupError = error;
  }
  if (operationError && cleanupError) {
    throw new AggregateError([operationError, cleanupError], 'Artifact cache publication and cleanup both failed');
  }
  if (operationError) throw operationError;
  if (cleanupError) throw cleanupError;
  return result;
}

function safeOutputPath(root, relative) {
  const resolved = path.resolve(root, ...relative.split('/'));
  const back = path.relative(root, resolved);
  if (!back || back.startsWith(`..${path.sep}`) || back === '..' || path.isAbsolute(back)) {
    throw new Error(`Artifact path escapes restore staging directory: ${relative}`);
  }
  return resolved;
}

function walkRestoredTree(root) {
  const paths = new Map();
  const stack = [{ absolute: root, relative: '' }];
  while (stack.length) {
    const directory = stack.pop();
    for (const entry of fs.readdirSync(directory.absolute, { withFileTypes: true })) {
      const absolute = path.join(directory.absolute, entry.name);
      const relative = directory.relative ? `${directory.relative}/${entry.name}` : entry.name;
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) throw new Error(`Restored tree contains a symbolic link: ${absolute}`);
      if (stat.isDirectory()) {
        paths.set(relative, { absolute, type: 'directory' });
        stack.push({ absolute, relative });
      } else if (stat.isFile()) paths.set(relative, { absolute, type: 'file' });
      else throw new Error(`Restored tree contains a special entry: ${absolute}`);
    }
  }
  return paths;
}

function verifyRestoredTree(root, manifest) {
  const expected = new Map();
  for (const entry of manifest.files) {
    const relative = `${manifest.archive.root}/${entry.file}`;
    const parts = relative.split('/');
    for (let index = 1; index < parts.length; index += 1) {
      expected.set(parts.slice(0, index).join('/'), { type: 'directory' });
    }
    expected.set(relative, { ...entry, type: 'file' });
  }
  const observed = walkRestoredTree(root);
  for (const [relative, observedEntry] of observed) {
    const entry = expected.get(relative);
    if (!entry || entry.type !== observedEntry.type) throw new Error(`Unexpected restored path: ${relative}`);
    if (entry.type === 'directory') {
      expected.delete(relative);
      continue;
    }
    const stat = fs.statSync(observedEntry.absolute);
    if (stat.size !== entry.bytes) {
      throw new Error(`Restored byte-count mismatch for ${entry.file}: ${stat.size} != ${entry.bytes}`);
    }
    if (sha256(fs.readFileSync(observedEntry.absolute)) !== entry.sha256) {
      throw new Error(`Restored checksum mismatch for ${entry.file}`);
    }
    expected.delete(relative);
  }
  if (expected.size)
    throw new Error(`Missing restored path${expected.size === 1 ? '' : 's'}: ${[...expected.keys()].join(', ')}`);
}

function assertAbsentOrEmptyDirectory(outDir) {
  const stat = lstatOrNull(outDir);
  if (!stat) return false;
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Restore destination must be absent or an empty directory: ${outDir}`);
  }
  if (fs.readdirSync(outDir).length) throw new Error(`Refusing to restore into non-empty directory ${outDir}`);
  return true;
}

export function restoreArtifactBundle({ manifestPath, archivePath, outDir } = {}) {
  if (!outDir) throw new Error('outDir is required');
  const inspection = inspectArtifactBundle({ manifestPath, archivePath });
  const output = path.resolve(outDir);
  assertAbsentOrEmptyDirectory(output);
  const parent = path.dirname(output);
  fs.mkdirSync(parent, { recursive: true });
  const staging = path.join(parent, `.${path.basename(output)}.tmp-${process.pid}-${crypto.randomUUID()}`);
  fs.mkdirSync(staging, { mode: 0o700 });
  let published = false;
  try {
    for (const entry of inspection.entries) {
      const relative = `${inspection.manifest.archive.root}/${entry.file}`;
      const filePath = safeOutputPath(staging, relative);
      fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
      fs.writeFileSync(filePath, entry.content, { flag: 'wx', mode: 0o600 });
    }
    verifyRestoredTree(staging, inspection.manifest);
    const replacedEmptyDestination = assertAbsentOrEmptyDirectory(output);
    fs.renameSync(staging, output);
    published = true;
    return {
      ...publicVerification(inspection),
      output,
      replacedEmptyDestination,
    };
  } finally {
    if (!published) fs.rmSync(staging, { recursive: true, force: true });
  }
}

function usage() {
  return `Usage:
  node scripts/artifact-bundle.js verify --manifest M --archive A
  node scripts/artifact-bundle.js fetch --manifest M --source A --cache-dir DIR
  node scripts/artifact-bundle.js restore --manifest M --archive A --out EMPTY_OR_ABSENT_DIR`;
}

function parseCli(argv) {
  const command = argv[0];
  if (!command || command === '--help' || command === '-h') return { help: true };
  if (!['verify', 'fetch', 'restore'].includes(command)) throw new Error(`Unknown command: ${command}`);
  const options = {};
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error(`Expected --option value after ${argv[index] || command}`);
    }
    const key = flag.slice(2);
    if (Object.hasOwn(options, key)) throw new Error(`Duplicate option: ${flag}`);
    options[key] = value;
  }
  const allowed = {
    verify: new Set(['manifest', 'archive']),
    fetch: new Set(['manifest', 'source', 'cache-dir']),
    restore: new Set(['manifest', 'archive', 'out']),
  }[command];
  for (const key of Object.keys(options)) if (!allowed.has(key)) throw new Error(`Unknown option: --${key}`);
  for (const key of allowed) if (!options[key]) throw new Error(`Missing required option: --${key}`);
  return { command, options };
}

export function runArtifactBundleCli(argv = process.argv.slice(2)) {
  const parsed = parseCli(argv);
  if (parsed.help) {
    console.log(usage());
    return;
  }
  const { command, options } = parsed;
  if (command === 'verify') {
    const result = verifyArtifactBundle({ manifestPath: options.manifest, archivePath: options.archive });
    console.log(
      `verified ${result.archivePath} (${result.archiveBytes} archive byte(s); ${result.files} file(s); ${result.restoredBytes} restored byte(s))`,
    );
    return result;
  }
  if (command === 'fetch') {
    const result = fetchArtifactBundle({
      manifestPath: options.manifest,
      sourcePath: options.source,
      cacheDir: options['cache-dir'],
    });
    console.log(`archive  ${result.cachePath}`);
    console.log(`status   ${result.cacheHit ? 'cache-hit' : 'published'}`);
    console.log(`verified ${result.files} file(s), ${result.restoredBytes} restored byte(s)`);
    return result;
  }
  const result = restoreArtifactBundle({
    manifestPath: options.manifest,
    archivePath: options.archive,
    outDir: options.out,
  });
  console.log(`restored and verified ${result.output} (${result.files} file(s); ${result.restoredBytes} byte(s))`);
  return result;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    runArtifactBundleCli();
  } catch (error) {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  }
}
