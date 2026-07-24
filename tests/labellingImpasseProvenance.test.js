import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  inspectImpasseProvenanceArtifacts,
  migrateImpasseProvenanceArtifacts,
} from '../services/labellingImpasseProvenance.js';
import { IMPASSE_RATER_PREFIX } from '../services/labellingGameStore.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'scripts', 'migrate-labelling-impasse-provenance.js');

function fixture(t, { unknownItem = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'labelling-impasse-provenance-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourcePath = path.join(root, 'impasses.json');
  const outputDir = path.join(root, 'out');
  fs.mkdirSync(outputDir, { recursive: true });
  const corpus = {
    schema: 'test.impasse.v1',
    episodes: [
      { episode_id: 'E01', excerpt_turns: [{ learner_text: 'First' }] },
      { episode_id: 'E02', excerpt_turns: [{ learner_text: 'Second' }] },
    ],
  };
  fs.writeFileSync(sourcePath, `${JSON.stringify(corpus, null, 2)}\n`, 'utf8');
  const sidecarPath = path.join(outputDir, `${IMPASSE_RATER_PREFIX}legacy.json`);
  fs.writeFileSync(
    sidecarPath,
    `${JSON.stringify(
      {
        schema: 'machinespirits.labelling-game.impasse-rater.v1',
        coder_id: 'legacy',
        items: [{ item_id: unknownItem ? 'E99' : 'E01', impasse: 'yes', notes: 'coded' }],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  const env = {
    ...process.env,
    LABELLING_GAME_IMPASSE_DATASET: sourcePath,
    LABELLING_GAME_IMPASSE_OUTPUT_DIR: outputDir,
  };
  return { root, sourcePath, outputDir, sidecarPath, corpus, env };
}

function options(value) {
  return {
    sourcePath: value.sourcePath,
    source: path.relative(ROOT, value.sourcePath),
    outputDir: value.outputDir,
    prefix: IMPASSE_RATER_PREFIX,
  };
}

test('impasse provenance migration explicitly binds legacy labels and detects later corpus drift', (t) => {
  const value = fixture(t);
  const before = fs.readFileSync(value.sidecarPath, 'utf8');
  const checked = inspectImpasseProvenanceArtifacts(options(value));
  assert.equal(checked.counts.migration_required, 1);
  assert.equal('_private' in checked, false);

  const refused = migrateImpasseProvenanceArtifacts(options(value));
  assert.equal(refused.success, false);
  assert.equal(refused.unresolved[0].status, 'migration_required');
  assert.equal(fs.readFileSync(value.sidecarPath, 'utf8'), before);

  const migrated = migrateImpasseProvenanceArtifacts({ ...options(value), acceptCurrentCorpus: true });
  assert.equal(migrated.success, true);
  assert.deepEqual(migrated.migrated, [value.sidecarPath]);
  const sidecar = JSON.parse(fs.readFileSync(value.sidecarPath, 'utf8'));
  assert.equal(sidecar.schema, 'machinespirits.labelling-game.impasse-rater.v2');
  assert.equal(sidecar.items.length, 2);
  assert.equal(sidecar.items[0].notes, 'coded');
  assert.match(sidecar.items[0].source_content_hash, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(sidecar.provenance_migration.accepted_current_corpus, true);
  assert.equal(inspectImpasseProvenanceArtifacts(options(value)).counts.current, 1);

  value.corpus.episodes[0].excerpt_turns[0].learner_text = 'Changed';
  fs.writeFileSync(value.sourcePath, `${JSON.stringify(value.corpus, null, 2)}\n`, 'utf8');
  const drifted = inspectImpasseProvenanceArtifacts(options(value));
  assert.equal(drifted.counts.mismatch, 1);
  assert.equal(drifted.entries[0].code, 'impasse_corpus_provenance_mismatch');
});

test('impasse provenance migration preflights every sidecar and refuses unknown item ids', (t) => {
  const value = fixture(t, { unknownItem: true });
  const before = fs.readFileSync(value.sidecarPath, 'utf8');
  const checked = inspectImpasseProvenanceArtifacts(options(value));
  assert.equal(checked.counts.invalid, 1);
  assert.equal(checked.entries[0].code, 'impasse_sidecar_unknown_items');
  const migrated = migrateImpasseProvenanceArtifacts({ ...options(value), acceptCurrentCorpus: true });
  assert.equal(migrated.success, false);
  assert.equal(migrated.unresolved[0].status, 'invalid');
  assert.equal(fs.readFileSync(value.sidecarPath, 'utf8'), before);
});

test('impasse provenance CLI distinguishes check, unsafe apply, and completed migration', (t) => {
  const value = fixture(t);
  const checkBefore = spawnSync(process.execPath, [CLI, '--check', '--json'], {
    cwd: ROOT,
    env: value.env,
    encoding: 'utf8',
  });
  assert.equal(checkBefore.status, 1, checkBefore.stderr);
  assert.equal(JSON.parse(checkBefore.stdout).counts.migration_required, 1);

  const unsafe = spawnSync(process.execPath, [CLI, '--apply'], {
    cwd: ROOT,
    env: value.env,
    encoding: 'utf8',
  });
  assert.equal(unsafe.status, 2);
  assert.match(unsafe.stderr, /requires --accept-current-corpus/u);

  const applied = spawnSync(process.execPath, [CLI, '--apply', '--accept-current-corpus', '--json'], {
    cwd: ROOT,
    env: value.env,
    encoding: 'utf8',
  });
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).migrated.length, 1);

  const checkAfter = spawnSync(process.execPath, [CLI, '--check', '--json'], {
    cwd: ROOT,
    env: value.env,
    encoding: 'utf8',
  });
  assert.equal(checkAfter.status, 0, checkAfter.stderr);
  assert.equal(JSON.parse(checkAfter.stdout).counts.current, 1);
});
