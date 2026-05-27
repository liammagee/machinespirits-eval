import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, it } from 'node:test';
import { packagePoeticsRun } from '../scripts/package-poetics-run.js';
import {
  openPoeticsStore,
  upsertPoeticsItem,
  upsertPoeticsLabel,
  upsertPoeticsReviewFlag,
  upsertPoeticsRun,
  upsertPoeticsScore,
  upsertPoeticsTutorAdaptation,
} from '../services/poeticsStore.js';

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

function readJsonlGzip(filePath) {
  return gunzipSync(fs.readFileSync(filePath))
    .toString('utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function seedArchiveRun(root) {
  const artifactRoot = path.join(root, 'artifact-input');
  const dbPath = path.join(root, 'poetics.db');
  const files = {
    spec: writeFile(path.join(artifactRoot, 'spec.yaml'), 'units: []\n'),
    runKey: writeFile(path.join(artifactRoot, 'run-key.yaml'), 'items: {}\n'),
    itemKey: writeFile(path.join(artifactRoot, 'item-key.yaml'), 'items:\n  T01: {}\n'),
    sample: writeFile(path.join(artifactRoot, 'sample/T01.txt'), 'Learner: Oh I get it\n'),
    full: writeFile(path.join(artifactRoot, 'transcripts/T01.full.md'), 'TUTOR: Try the small case.\n'),
    score: writeFile(path.join(artifactRoot, 'scores/T01-qwen.json'), '{"scored":[{"id":"T01"}]}\n'),
    label: writeFile(path.join(artifactRoot, 'labels.yaml'), 'labels:\n  T01:\n    label: recognition\n'),
    trace: writeFile(path.join(artifactRoot, 'deliberation/T01.json'), '{"turns":[]}\n'),
  };
  const db = openPoeticsStore(dbPath);
  try {
    upsertPoeticsRun(db, {
      id: 'archive-test-run',
      sourceRoot: artifactRoot,
      batchId: 'archive-test-run',
      generator: 'test',
      specPath: files.spec,
      keyPath: files.runKey,
      gitCommit: 'test123',
      metadata: { purpose: 'archive test' },
    });
    upsertPoeticsItem(db, {
      id: 'archive-test-run:target-r01:default:T01',
      runId: 'archive-test-run',
      unitId: 'target-r01',
      repeat: 'r01',
      arm: 'default',
      tid: 'T01',
      dramaId: 'D1',
      discipline: 'math',
      condition: 'recognition',
      intendedLean: 'recognition',
      samplePath: files.sample,
      fullTranscriptPath: files.full,
      keyPath: files.itemKey,
      qualityStatus: 'ok',
      qualityWarnings: [],
      metadata: { source: 'test' },
    });
    upsertPoeticsScore(db, {
      itemId: 'archive-test-run:target-r01:default:T01',
      criticModel: 'qwen/test',
      scoreFile: files.score,
      formClass: 'recognition',
      recontextualization: 75,
      statedInsight: 75,
      flags: ['ok'],
      metadata: { recognition_origin: { class: 'peripeteia_induced' } },
    });
    upsertPoeticsLabel(db, {
      itemId: 'archive-test-run:target-r01:default:T01',
      labellerId: 'reader-a',
      perspective: 'human',
      labelFile: files.label,
      formClass: 'recognition',
      metadata: { rubricVersion: 'test' },
    });
    upsertPoeticsReviewFlag(db, {
      itemId: 'archive-test-run:target-r01:default:T01',
      flaggerId: 'codex',
      flagType: 'human_review',
      priority: 'normal',
      reason: 'test flag',
      metadata: { source: 'test' },
    });
    upsertPoeticsTutorAdaptation(db, {
      itemId: 'archive-test-run:target-r01:default:T01',
      analyzerVersion: 'test-adaptation',
      sourceTracePath: files.trace,
      learnerSelfReframe: true,
      tutorContingentAdaptation: true,
      tutorAdaptationScore: 80,
      sharedSalientTerms: ['small', 'case'],
      metadata: { branch_validity: { valid: true } },
    });
  } finally {
    db.close();
  }
  return { dbPath, files };
}

describe('package poetics run', () => {
  it('writes compressed JSONL archives and a commit-ready manifest', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'package-poetics-run-'));
    const { dbPath } = seedArchiveRun(root);
    const result = await packagePoeticsRun({
      runId: 'archive-test-run',
      dbPath,
      archiveDir: path.join(root, 'artifacts/poetics-runs'),
      manifestDir: path.join(root, 'config/poetics-calibration/runs'),
    });

    assert.equal(result.manifest.counts.items, 1);
    assert.equal(result.manifest.counts.scores, 1);
    assert.equal(result.manifest.counts.labels, 1);
    assert.equal(result.manifest.counts.reviewFlags, 1);
    assert.equal(result.manifest.counts.tutorAdaptations, 1);
    assert.equal(result.manifest.counts.missingArtifacts, 0);
    assert.equal(result.manifest.archive.files.items.records, 1);
    assert.equal(result.manifest.archive.files.artifacts.records, 8);
    assert.ok(fs.existsSync(result.manifestPath));

    const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
    assert.equal(manifest.schemaVersion, 'poetics-run-archive-manifest-v1');
    assert.equal(manifest.archive.files.scores.records, 1);
    assert.match(manifest.archive.files.artifacts.sha256, /^[a-f0-9]{64}$/);

    const artifacts = readJsonlGzip(path.join(result.archiveDir, 'artifacts.jsonl.gz'));
    assert.ok(artifacts.some((record) => record.kind === 'sample' && record.content.includes('Oh I get it')));
    assert.ok(artifacts.some((record) => record.kind === 'tutor_trace' && record.content.includes('"turns"')));

    const scores = readJsonlGzip(path.join(result.archiveDir, 'scores.jsonl.gz'));
    assert.equal(scores[0].metadata.recognition_origin.class, 'peripeteia_induced');
  });
});
