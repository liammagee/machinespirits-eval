import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  auditPoeticsEvidenceInventory,
  createPoeticsEvidenceBundle,
  POETICS_EVIDENCE_INVENTORY,
} from '../services/poeticsEvidenceLifecycle.js';
import {
  insertPoeticsTutorAdaptationOnce,
  openPoeticsStore,
  upsertPoeticsItem,
  upsertPoeticsLabel,
  upsertPoeticsRun,
  upsertPoeticsScore,
} from '../services/poeticsStore.js';

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

function seed(root, { missingSample = false } = {}) {
  const dbPath = path.join(root, 'poetics.db');
  const rawRoot = path.join(root, 'raw-run');
  const files = {
    spec: write(path.join(rawRoot, 'spec.yaml'), 'dramas: []\n'),
    key: write(path.join(rawRoot, 'key.yaml'), 'items: {}\n'),
    sample: path.join(rawRoot, 'sample.txt'),
    full: write(path.join(rawRoot, 'full.md'), 'TUTOR: test\nLEARNER: changed\n'),
    score: write(path.join(rawRoot, 'score.json'), '{"score":1}\n'),
    label: write(path.join(rawRoot, 'label.json'), '{"label":"recognition"}\n'),
    trace: write(path.join(rawRoot, 'trace.json'), '{"turns":[]}\n'),
  };
  if (!missingSample) write(files.sample, 'LEARNER: changed\n');
  const itemId = 'synthetic-run:target-r01:peripeteia-only:T01';
  const db = openPoeticsStore(dbPath);
  upsertPoeticsRun(db, {
    id: 'synthetic-run',
    sourceRoot: rawRoot,
    specPath: files.spec,
    keyPath: files.key,
    metadata: { fixture: true },
  });
  upsertPoeticsItem(db, {
    id: itemId,
    runId: 'synthetic-run',
    unitId: 'target-r01',
    arm: 'peripeteia-only',
    tid: 'T01',
    dramaId: 'D50',
    samplePath: files.sample,
    fullTranscriptPath: files.full,
    keyPath: files.key,
  });
  upsertPoeticsScore(db, { itemId, criticModel: 'fixture', scoreFile: files.score, formClass: 'recognition' });
  upsertPoeticsLabel(db, {
    itemId,
    labellerId: 'fixture',
    labelFile: files.label,
    formClass: 'recognition',
  });
  insertPoeticsTutorAdaptationOnce(db, {
    itemId,
    analyzerVersion: 'tutor-adaptation-v5-semantic',
    sourceTracePath: files.trace,
    metadata: {
      semantic_adjudication_provenance: { create_once: true, packet_sha256: 'fixture' },
      peripeteia: {
        tutor_adaptive_mechanism_measurement: { status: 'determinate', value: true },
        tutor_representation_change_measurement: { status: 'determinate', value: true },
        learner_actional_change_measurement: { status: 'determinate', value: true },
        learner_representation_change_measurement: { status: 'determinate', value: true },
      },
    },
  });
  db.close();
  return { dbPath, rawRoot, files };
}

test('poetics evidence inventory covers every current table and runner, including semantic-v5', () => {
  const audit = auditPoeticsEvidenceInventory();
  assert.deepEqual(audit.errors, []);
  assert.equal(POETICS_EVIDENCE_INVENTORY.databaseTables.poetics_tutor_adaptations.claimBearing, true);
  assert.match(POETICS_EVIDENCE_INVENTORY.databaseTables.poetics_tutor_adaptations.includes, /semantic-v5/u);
  assert.ok(POETICS_EVIDENCE_INVENTORY.sidecars.item_gate_stream);
});

test('inventory ratchet catches a new table and a new poetics runner', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-inventory-ratchet-'));
  const scripts = path.join(root, 'scripts');
  fs.mkdirSync(scripts);
  for (const runner of Object.keys(POETICS_EVIDENCE_INVENTORY.runners)) {
    fs.writeFileSync(path.join(root, runner), '// classified fixture\n');
  }
  fs.writeFileSync(path.join(scripts, 'run-poetics-new-claim.js'), '// unclassified fixture\n');
  const db = openPoeticsStore(path.join(root, 'poetics.db'));
  db.exec('CREATE TABLE poetics_new_claims (id TEXT PRIMARY KEY)');
  const audit = auditPoeticsEvidenceInventory({ root, db });
  db.close();
  assert.ok(audit.errors.some((error) => error.includes('poetics_new_claims')));
  assert.ok(audit.errors.some((error) => error.includes('run-poetics-new-claim.js')));
});

test('successful fixture closeout writes a create-once, hash-verified durable private bundle', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-evidence-bundle-'));
  const archiveRoot = path.join(root, 'private-archive');
  fs.mkdirSync(archiveRoot);
  const { dbPath, rawRoot } = seed(root);
  const loopJson = write(path.join(root, 'loop-status.json'), '{"status":"passed"}\n');
  const loopMd = write(path.join(root, 'loop-status.md'), '# passed\n');
  const reports = {
    adaptationJson: write(path.join(root, 'adaptation.json'), '{"rows":[]}\n'),
    adaptationCsv: write(path.join(root, 'adaptation.csv'), 'item,status\n'),
    sidecarJson: write(path.join(root, 'sidecar.json'), '{"rows":[]}\n'),
    sidecarCsv: write(path.join(root, 'sidecar.csv'), 'item,status\n'),
    sidecarMd: write(path.join(root, 'sidecar.md'), '# sidecar report\n'),
  };
  const result = createPoeticsEvidenceBundle({
    bundleId: 'fixture-closeout',
    status: 'passed',
    runIds: ['synthetic-run'],
    dbPath,
    archiveRoot,
    rawRunRoots: [rawRoot],
    itemGateRows: [{ runId: 'synthetic-run', itemId: 'item-1', pass: true }],
    claimArtifacts: [
      { surface: 'loop_status_json', path: loopJson },
      { surface: 'loop_status_markdown', path: loopMd },
      { surface: 'tutor_adaptation_report_json', path: reports.adaptationJson },
      { surface: 'tutor_adaptation_report_csv', path: reports.adaptationCsv },
      { surface: 'sidecar_report_json', path: reports.sidecarJson },
      { surface: 'sidecar_report_csv', path: reports.sidecarCsv },
      { surface: 'sidecar_report_markdown', path: reports.sidecarMd },
    ],
  });
  assert.equal(result.manifest.status, 'passed');
  assert.equal(result.manifest.itemGateRows, 1);
  assert.equal(result.manifest.counts.poetics_tutor_adaptations, 1);
  assert.equal(result.manifest.missingArtifacts.length, 0);
  assert.ok(result.manifest.copiedArtifacts.some((entry) => entry.surface === 'sidecar_report_json'));
  assert.match(result.manifest.filesSha256, /^[a-f0-9]{64}$/u);
  assert.ok(fs.existsSync(path.join(result.path, 'item-gates.jsonl')));
  const adaptation = fs.readFileSync(path.join(result.path, 'database/poetics_tutor_adaptations.jsonl'), 'utf8');
  assert.match(adaptation, /tutor_representation_change_measurement/u);
  assert.throws(
    () =>
      createPoeticsEvidenceBundle({
        bundleId: 'fixture-closeout',
        status: 'passed',
        runIds: ['synthetic-run'],
        dbPath,
        archiveRoot,
        itemGateRows: [{ runId: 'synthetic-run', pass: true }],
      }),
    /create-once/u,
  );
});

test('missing claim evidence prevents successful closeout but failed attempts retain partial rows', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-evidence-partial-'));
  const archiveRoot = path.join(root, 'private-archive');
  fs.mkdirSync(archiveRoot);
  const { dbPath, rawRoot } = seed(root, { missingSample: true });
  assert.throws(
    () =>
      createPoeticsEvidenceBundle({
        bundleId: 'missing-success',
        status: 'passed',
        runIds: ['synthetic-run'],
        dbPath,
        archiveRoot,
        itemGateRows: [{ runId: 'synthetic-run', pass: true }],
      }),
    /missing poetics claim evidence/u,
  );
  assert.equal(fs.existsSync(path.join(archiveRoot, 'artifacts/poetics-runs/missing-success')), false);

  const partial = createPoeticsEvidenceBundle({
    bundleId: 'failed-attempt',
    status: 'failed',
    runIds: ['synthetic-run'],
    dbPath,
    archiveRoot,
    rawRunRoots: [rawRoot],
    itemGateRows: [],
  });
  assert.equal(partial.manifest.status, 'failed');
  assert.ok(partial.manifest.missingArtifacts.some((entry) => entry.surface === 'sample'));
  assert.equal(partial.manifest.counts.poetics_items, 1);
  assert.equal(partial.manifest.counts.poetics_scores, 1);
});

test('unknown sidecar kinds fail closed before a bundle is written', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-evidence-unclassified-'));
  const archiveRoot = path.join(root, 'private-archive');
  fs.mkdirSync(archiveRoot);
  const { dbPath } = seed(root);
  assert.throws(
    () =>
      createPoeticsEvidenceBundle({
        bundleId: 'unclassified',
        status: 'failed',
        runIds: ['synthetic-run'],
        dbPath,
        archiveRoot,
        claimArtifacts: [{ surface: 'future_measurement', path: path.join(root, 'future.json') }],
      }),
    /unclassified poetics claim evidence surface/u,
  );
});
