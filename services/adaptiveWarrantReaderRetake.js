import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { recordObservedDigest } from './recordedFileDigest.js';

export const ADAPTIVE_WARRANT_READER_QUARANTINE_MANIFEST_SCHEMA =
  'machinespirits.adaptation-refinement.reader-response-quarantine-manifest.v1';

const MANIFEST_FIELDS = Object.freeze([
  'schema',
  'status',
  'study_id',
  'created_at',
  'authority',
  'run_root',
  'quarantine_directory',
  'enumeration',
  'entries',
]);
const ENTRY_FIELDS = Object.freeze([
  'channel',
  'reader_id',
  'batch_id',
  'sample_id',
  'response_path',
  'quarantine_path',
  'response_sha256',
  'error',
]);
const AUTHORITY_FIELDS = Object.freeze(['path', 'sha256']);
const ENUMERATION_FIELDS = Object.freeze([
  'accepted_responses_audited',
  'presence_invalid',
  'decision_invalid',
  'allowance_room_per_channel',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function exactFields(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error(`${label} has unexpected fields`);
  }
}

function isInside(parentPath, childPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function completedRows(run, entry) {
  return run.batches.filter(
    (row) => row.reader_id === entry.reader_id && row.batch_id === entry.batch_id && row.status === 'complete',
  );
}

export function loadReviewerAuthorizedReaderRetakes({
  quarantineManifestPath,
  channel,
  collectionManifest,
  run,
  outputDir,
} = {}) {
  if (!quarantineManifestPath) {
    return { manifest: null, manifestPath: null, manifestSha256: null, entries: [], byBatch: new Map() };
  }
  const resolvedManifestPath = path.resolve(quarantineManifestPath);
  const manifest = readJson(resolvedManifestPath);
  exactFields(manifest, MANIFEST_FIELDS, 'reader quarantine manifest');
  exactFields(manifest.authority, AUTHORITY_FIELDS, 'reader quarantine manifest authority');
  exactFields(manifest.enumeration, ENUMERATION_FIELDS, 'reader quarantine manifest enumeration');
  if (
    manifest.schema !== ADAPTIVE_WARRANT_READER_QUARANTINE_MANIFEST_SCHEMA ||
    manifest.status !== 'reviewer_authorized' ||
    manifest.study_id !== collectionManifest.study_id ||
    manifest.enumeration.accepted_responses_audited !== 576 ||
    manifest.enumeration.allowance_room_per_channel !== 10
  ) {
    throw new Error('reader quarantine manifest does not carry the reviewer-authorized 094a contract');
  }
  if (
    !manifest.authority.path.endsWith(
      'docs/adaptation-refinement/relay/094a-reviewer-ruling-contract-invalid-response-retake.md',
    ) ||
    !fs.existsSync(manifest.authority.path)
  ) {
    throw new Error('reader quarantine manifest authority drift');
  }
  // CLAUDE.md (2026-08-21): ruling 094a is a reviewer ruling in docs/ that is
  // edited in place. Fixing a typo in it used to stop the retake, so the digest
  // is written down. Naming a different ruling, or losing the file, still
  // refuses, and so does the reviewer-authorized 094a contract check above.
  recordObservedDigest({
    label: 'reader retake authority ruling 094a',
    filePath: manifest.authority.path,
    recordedSha256: manifest.authority.sha256,
    observedSha256: fileSha256(manifest.authority.path),
  });
  const runRoot = path.resolve(path.dirname(outputDir));
  const quarantineDirectory = path.resolve(manifest.quarantine_directory);
  if (
    path.resolve(manifest.run_root) !== runRoot ||
    !isInside(runRoot, quarantineDirectory) ||
    path.dirname(resolvedManifestPath) !== runRoot
  ) {
    throw new Error('reader quarantine manifest path boundary mismatch');
  }
  if (!Array.isArray(manifest.entries)) throw new Error('reader quarantine manifest entries must be an array');
  const expectedCounts = {
    presence: manifest.enumeration.presence_invalid,
    decision: manifest.enumeration.decision_invalid,
  };
  for (const candidateChannel of ['presence', 'decision']) {
    const count = manifest.entries.filter((entry) => entry?.channel === candidateChannel).length;
    if (count !== expectedCounts[candidateChannel] || count > manifest.enumeration.allowance_room_per_channel) {
      throw new Error(`reader quarantine manifest ${candidateChannel} count mismatch`);
    }
  }
  const seen = new Set();
  for (const entry of manifest.entries) {
    exactFields(entry, ENTRY_FIELDS, 'reader quarantine manifest entry');
    const key = `${entry.channel}:${entry.reader_id}:${entry.batch_id}`;
    if (seen.has(key)) throw new Error('reader quarantine manifest contains duplicate batch entries');
    seen.add(key);
    if (entry.channel !== channel) continue;
    const reader = collectionManifest.readers.find((row) => row.reader_id === entry.reader_id);
    const batch = reader?.batches.find((row) => row.batch_id === entry.batch_id);
    if (
      !['presence', 'decision'].includes(entry.channel) ||
      !batch ||
      batch.required_sample_ids?.length !== 1 ||
      batch.required_sample_ids[0] !== entry.sample_id
    ) {
      throw new Error(`reader quarantine manifest entry ${entry.batch_id} is outside the frozen collection`);
    }
    const expectedResponsePath = path.join(path.resolve(outputDir), entry.reader_id, batch.expected_response_filename);
    if (
      path.resolve(entry.response_path) !== expectedResponsePath ||
      !isInside(quarantineDirectory, entry.quarantine_path) ||
      !fs.existsSync(entry.quarantine_path) ||
      fileSha256(entry.quarantine_path) !== entry.response_sha256
    ) {
      throw new Error(`reader quarantine manifest entry ${entry.batch_id} artifact mismatch`);
    }
    const originalCompletion = completedRows(run, entry).find(
      (row) => row.response_path === expectedResponsePath && row.response_sha256 === entry.response_sha256,
    );
    if (!originalCompletion) {
      throw new Error(`reader quarantine manifest entry ${entry.batch_id} lacks its accepted checkpoint row`);
    }
    const replacement = completedRows(run, entry).find(
      (row) =>
        row.retake_of_response_sha256 === entry.response_sha256 &&
        row.quarantine_manifest_sha256 === fileSha256(resolvedManifestPath),
    );
    if (replacement) {
      if (!fs.existsSync(expectedResponsePath) || fileSha256(expectedResponsePath) !== replacement.response_sha256) {
        throw new Error(`${entry.batch_id} replacement response drift`);
      }
    } else if (fs.existsSync(expectedResponsePath)) {
      throw new Error(`${entry.batch_id} quarantined response path was repopulated before its authorized re-take`);
    }
  }
  const entries = manifest.entries.filter((entry) => entry.channel === channel);
  return {
    manifest,
    manifestPath: resolvedManifestPath,
    manifestSha256: fileSha256(resolvedManifestPath),
    entries,
    byBatch: new Map(entries.map((entry) => [`${entry.reader_id}:${entry.batch_id}`, entry])),
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function validateAdaptiveWarrantReaderResponseContract({
  response,
  collectionManifest,
  reader,
  batch,
  assemble,
} = {}) {
  const sampleId = batch.required_sample_ids?.[0];
  if (!sampleId || batch.required_sample_ids.length !== 1) {
    throw new Error(`${batch.batch_id} full deterministic response validation requires a one-case batch`);
  }
  const corpus = readJson(collectionManifest.corpus.path);
  const corpusCase = corpus.cases.find((row) => row.sample_id === sampleId);
  if (!corpusCase) throw new Error(`${batch.batch_id} reviewer-authorized re-take case is outside the corpus`);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-warrant-reader-retake-contract-'));
  try {
    const corpusPath = path.join(temporaryRoot, 'corpus.json');
    writeJson(corpusPath, { ...corpus, cases: [corpusCase] });
    const corpusSha256 = fileSha256(corpusPath);
    const responseDir = path.join(temporaryRoot, 'responses');
    const responsePath = path.join(responseDir, batch.expected_response_filename);
    writeJson(responsePath, { ...response, corpus_sha256: corpusSha256 });
    const manifestPath = path.join(temporaryRoot, 'manifest.json');
    writeJson(manifestPath, {
      ...collectionManifest,
      corpus: { ...collectionManifest.corpus, path: corpusPath, sha256: corpusSha256, cases: 1 },
      readers: [{ ...reader, batches: [batch] }],
    });
    assemble({
      manifestPath,
      readerId: reader.reader_id,
      annotationRunId: `reviewer-authorized-retake-${reader.reader_id}-${batch.batch_id}`,
      responseDir,
      outputPath: path.join(temporaryRoot, 'assembled.json'),
    });
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
  return { status: 'passed', sample_id: sampleId };
}

export function validateReviewerAuthorizedRetakeResponse(options = {}) {
  return validateAdaptiveWarrantReaderResponseContract(options);
}

export function quarantineReviewerAuthorizedRetakeResponse({
  rawResponse,
  quarantineEntry,
  quarantineManifest,
  attempt,
} = {}) {
  const directory = path.join(
    path.resolve(quarantineManifest.quarantine_directory),
    quarantineEntry.reader_id,
    'retake-attempts',
  );
  const quarantinePath = path.join(
    directory,
    `${quarantineEntry.batch_id}.attempt-${String(attempt).padStart(3, '0')}.response.json`,
  );
  if (fs.existsSync(quarantinePath)) throw new Error(`${quarantineEntry.batch_id} re-take quarantine path exists`);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(quarantinePath, String(rawResponse));
  return { path: quarantinePath, sha256: fileSha256(quarantinePath) };
}
