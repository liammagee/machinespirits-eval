import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  DATA_APPROVAL_SCHEMA,
  DATA_CORPUS_SCHEMA,
  DATA_HOLDOUT_SCHEMA,
  assertCorpusTrainingAdmission,
  inventoryDirectory,
  sealAssetDirectory,
  sha256File,
  verifyInventory,
} from '../services/dataGovernance.js';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ms-data-governance-'));
}

test('private asset inventory, seal, and tamper verification are deterministic', () => {
  const root = tempRoot();
  const source = path.join(root, 'source');
  fs.mkdirSync(path.join(source, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(source, 'a.jsonl'), '{"a":1}\n');
  fs.writeFileSync(path.join(source, 'nested', 'b.txt'), 'sealed\n');
  const inventory = inventoryDirectory(source, { rootLabel: 'asset-test' });
  assert.deepEqual(
    inventory.files.map((entry) => entry.path),
    ['a.jsonl', 'nested/b.txt'],
  );
  assert.equal(verifyInventory(source, inventory).inventorySha256, inventory.inventorySha256);

  const destination = path.join(root, 'sealed', 'asset-test');
  const seal = sealAssetDirectory({ sourceDir: source, destinationDir: destination, assetId: 'asset-test' });
  assert.equal(fs.existsSync(path.join(destination, '.machinespirits-asset.json')), true);
  assert.equal(verifyInventory(destination, seal.inventory).inventorySha256, inventory.inventorySha256);
  fs.appendFileSync(path.join(destination, 'a.jsonl'), '{"a":2}\n');
  assert.throws(() => verifyInventory(destination, seal.inventory), /inventory mismatch/u);
});

test('training admission binds the exact manifest, purpose, model, files, and holdout registry', () => {
  const root = tempRoot();
  const corpusDir = path.join(root, 'corpus');
  fs.mkdirSync(corpusDir);
  const dataPath = path.join(corpusDir, 'train.jsonl');
  fs.writeFileSync(dataPath, '{"completion":"safe"}\n');
  const manifestPath = path.join(corpusDir, 'corpus-manifest.json');
  const manifest = {
    schema: DATA_CORPUS_SCHEMA,
    corpusId: 'corpus-1',
    createdAt: '2026-08-04T00:00:00.000Z',
    trainingStatus: 'training_approved',
    sourceAssetIds: ['asset-1'],
    sourceGroupIds: ['run-1'],
    files: [{ path: 'train.jsonl', bytes: fs.statSync(dataPath).size, sha256: sha256File(dataPath) }],
    splitPolicy: { groupedBy: 'source_group', seed: 7 },
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const approvals = path.join(root, 'approvals.jsonl');
  const holdouts = path.join(root, 'holdouts.jsonl');
  fs.writeFileSync(holdouts, '');
  const approval = {
    schema: DATA_APPROVAL_SCHEMA,
    approvalId: 'approval-1',
    corpusId: manifest.corpusId,
    corpusManifestSha256: sha256File(manifestPath),
    status: 'approved',
    recordedAt: '2026-08-04T00:01:00.000Z',
    approver: 'owner_operator',
    purposes: ['program2-sft'],
    models: ['Qwen/Qwen3.5-9B'],
  };
  fs.writeFileSync(approvals, `${JSON.stringify(approval)}\n`);

  const admitted = assertCorpusTrainingAdmission({
    manifestPath,
    approvalRegistryPath: approvals,
    holdoutRegistryPath: holdouts,
    purpose: 'program2-sft',
    model: 'Qwen/Qwen3.5-9B',
  });
  assert.equal(admitted.manifest.corpusId, 'corpus-1');
  assert.throws(
    () =>
      assertCorpusTrainingAdmission({
        manifestPath,
        approvalRegistryPath: approvals,
        holdoutRegistryPath: holdouts,
        purpose: 'program2-kto',
        model: 'Qwen/Qwen3.5-9B',
      }),
    /does not permit purpose/u,
  );

  const revoked = {
    ...approval,
    approvalId: 'approval-2',
    status: 'revoked',
    recordedAt: '2026-08-04T00:01:30.000Z',
    supersedes: 'approval-1',
    reason: 'review withdrawn',
  };
  fs.appendFileSync(approvals, `${JSON.stringify(revoked)}\n`);
  assert.throws(
    () =>
      assertCorpusTrainingAdmission({
        manifestPath,
        approvalRegistryPath: approvals,
        holdoutRegistryPath: holdouts,
        purpose: 'program2-sft',
        model: 'Qwen/Qwen3.5-9B',
      }),
    /no active approval/u,
  );
  fs.appendFileSync(
    approvals,
    `${JSON.stringify({ ...approval, approvalId: 'approval-3', recordedAt: '2026-08-04T00:01:45.000Z' })}\n`,
  );

  const holdout = {
    schema: DATA_HOLDOUT_SCHEMA,
    holdoutId: 'holdout-1',
    action: 'holdout',
    recordedAt: '2026-08-04T00:02:00.000Z',
    reason: 'evaluation reserve',
    sourceGroupId: 'run-1',
  };
  fs.writeFileSync(holdouts, `${JSON.stringify(holdout)}\n`);
  assert.throws(
    () =>
      assertCorpusTrainingAdmission({
        manifestPath,
        approvalRegistryPath: approvals,
        holdoutRegistryPath: holdouts,
        purpose: 'program2-sft',
        model: 'Qwen/Qwen3.5-9B',
      }),
    /source group is held out/u,
  );
});
