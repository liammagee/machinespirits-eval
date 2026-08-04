import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { DATA_APPROVAL_SCHEMA, DATA_CORPUS_SCHEMA, sha256File } from '../services/dataGovernance.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function checkCommand(root, manifest, approvals, holdouts) {
  return spawnSync(
    'python3',
    [
      path.join(ROOT, 'scripts', 'program2-train-sft.py'),
      '--variant',
      'instruct',
      '--data-dir',
      root,
      '--corpus-manifest',
      manifest,
      '--approval-registry',
      approvals,
      '--holdout-registry',
      holdouts,
      '--governance-check-only',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
}

test('Program-2 training entrypoint refuses an unapproved corpus and admits the exact approved manifest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-program2-training-gate-'));
  const data = path.join(root, 'sft-instruct.jsonl');
  fs.writeFileSync(data, '{"messages":[]}\n');
  const manifest = path.join(root, 'corpus-manifest.json');
  fs.writeFileSync(
    manifest,
    `${JSON.stringify(
      {
        schema: DATA_CORPUS_SCHEMA,
        corpusId: 'program2-smoke-corpus',
        createdAt: '2026-08-04T00:00:00.000Z',
        trainingStatus: 'training_approved',
        sourceAssetIds: ['sealed-source'],
        sourceGroupIds: ['dialogue-1'],
        files: [{ path: 'sft-instruct.jsonl', bytes: fs.statSync(data).size, sha256: sha256File(data) }],
        splitPolicy: { groupedBy: 'source_group', seed: 20260718 },
      },
      null,
      2,
    )}\n`,
  );
  const approvals = path.join(root, 'approvals.jsonl');
  const holdouts = path.join(root, 'holdouts.jsonl');
  fs.writeFileSync(approvals, '');
  fs.writeFileSync(holdouts, '');
  const refused = checkCommand(root, manifest, approvals, holdouts);
  assert.notEqual(refused.status, 0);
  assert.match(`${refused.stdout}${refused.stderr}`, /no active approval/u);

  fs.writeFileSync(
    approvals,
    `${JSON.stringify({
      schema: DATA_APPROVAL_SCHEMA,
      approvalId: 'program2-smoke-approval',
      corpusId: 'program2-smoke-corpus',
      corpusManifestSha256: sha256File(manifest),
      status: 'approved',
      recordedAt: '2026-08-04T00:01:00.000Z',
      approver: 'owner_operator',
      purposes: ['program2-sft'],
      models: ['Qwen/Qwen3.5-9B'],
    })}\n`,
  );
  const admitted = checkCommand(root, manifest, approvals, holdouts);
  assert.equal(admitted.status, 0, `${admitted.stdout}\n${admitted.stderr}`);
  assert.match(admitted.stdout, /"ok":true/u);
});
