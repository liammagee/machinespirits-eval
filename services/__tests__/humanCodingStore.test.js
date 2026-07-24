import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { getComparison, getItems, saveCoding, stringifyCsv } from '../humanCodingStore.js';
import { coderArtifactToken } from '../labellingCoderIdentity.js';

test('getComparison reports false positives, false negatives, precision, and recall in the correct direction', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'human-coding-store-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const samplePath = path.join(root, 'sample.csv');
  const keyPath = path.join(root, 'key.jsonl');
  const env = {
    HUMAN_CODING_EXPORTS_DIR: root,
    HUMAN_CODING_OUTPUT_DIR: root,
    HUMAN_CODING_SAMPLE: samplePath,
    HUMAN_CODING_KEY: keyPath,
  };
  const itemIds = ['tp', 'fn', 'fp-1', 'fp-2'];
  fs.writeFileSync(
    samplePath,
    stringifyCsv(itemIds.map((item_id) => ({ item_id, feedback: `feedback for ${item_id}` }))),
    'utf8',
  );
  fs.writeFileSync(
    keyPath,
    [
      { item_id: 'tp', llm_primary: 'CONTEXT_BLINDNESS' },
      { item_id: 'fn', llm_primary: 'REDIRECTION' },
      { item_id: 'fp-1', llm_primary: 'CONTEXT_BLINDNESS' },
      { item_id: 'fp-2', llm_primary: 'CONTEXT_BLINDNESS' },
    ]
      .map((row) => JSON.stringify(row))
      .join('\n'),
    'utf8',
  );

  saveCoding({ coderId: 'coder-a', itemId: 'tp', coding: { human_primary: 'CONTEXT_BLINDNESS' }, env });
  saveCoding({ coderId: 'coder-a', itemId: 'fn', coding: { human_primary: 'CONTEXT_BLINDNESS' }, env });
  saveCoding({ coderId: 'coder-a', itemId: 'fp-1', coding: { human_primary: 'REDIRECTION' }, env });
  saveCoding({ coderId: 'coder-a', itemId: 'fp-2', coding: { human_primary: 'REDIRECTION' }, env });

  const comparison = getComparison({ coderId: 'coder-a', env });
  const category = comparison.per_category.find((row) => row.category === 'CONTEXT_BLINDNESS');

  assert.deepEqual({ tp: category.tp, fp: category.fp, fn: category.fn }, { tp: 1, fp: 2, fn: 1 });
  assert.equal(category.precision, 1 / 3);
  assert.equal(category.recall, 1 / 2);
  assert.equal(category.f1, 0.4);
});

test('coder identities that collided under the legacy filename sanitizer write separate artifacts', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'human-coding-identities-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const samplePath = path.join(root, 'sample.csv');
  const env = {
    HUMAN_CODING_OUTPUT_DIR: root,
    HUMAN_CODING_SAMPLE: samplePath,
  };
  fs.writeFileSync(samplePath, stringifyCsv([{ item_id: 'item-a', feedback: 'feedback' }]), 'utf8');

  saveCoding({ coderId: 'rater a', itemId: 'item-a', coding: { human_primary: 'VAGUENESS' }, env });
  saveCoding({ coderId: 'rater/a', itemId: 'item-a', coding: { human_primary: 'APPROVAL' }, env });

  const first = path.join(root, `human-validation-pilot-rater-${coderArtifactToken('rater a')}.csv`);
  const second = path.join(root, `human-validation-pilot-rater-${coderArtifactToken('rater/a')}.csv`);
  assert.notEqual(first, second);
  assert.match(fs.readFileSync(first, 'utf8'), /VAGUENESS/u);
  assert.match(fs.readFileSync(second, 'utf8'), /APPROVAL/u);
});

test('legacy coder artifacts fail closed until the explicit migration runs', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'human-coding-legacy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const samplePath = path.join(root, 'sample.csv');
  const env = {
    HUMAN_CODING_OUTPUT_DIR: root,
    HUMAN_CODING_SAMPLE: samplePath,
  };
  fs.writeFileSync(samplePath, stringifyCsv([{ item_id: 'item-a', feedback: 'feedback' }]), 'utf8');
  fs.writeFileSync(path.join(root, 'human-validation-pilot-rater-ratera.csv'), 'item_id,human_primary\n', 'utf8');

  assert.throws(
    () => getItems({ coderId: 'rater a', env }),
    (error) => error.code === 'coder_artifact_migration_required' && error.httpStatus === 409,
  );

  fs.writeFileSync(
    path.join(root, `human-validation-pilot-rater-${coderArtifactToken('rater a')}.csv`),
    'item_id,human_primary\n',
    'utf8',
  );
  assert.throws(
    () => getItems({ coderId: 'rater a', env }),
    (error) => error.code === 'coder_artifact_collision' && error.httpStatus === 409,
  );
});
