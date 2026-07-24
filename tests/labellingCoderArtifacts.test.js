import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  inspectLabellingCoderArtifacts,
  migrateLabellingCoderArtifacts,
} from '../services/labellingCoderArtifactMigration.js';
import {
  coderArtifactToken,
  coderIdFromArtifactToken,
  legacyImpasseCoderKey,
  legacyTaxonomyCoderKey,
  normalizeCoderId,
} from '../services/labellingCoderIdentity.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'scripts', 'migrate-labelling-coder-artifacts.js');
const ANALYZER = path.join(ROOT, 'scripts', 'human-validation-analyze.js');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'labelling-coder-artifacts-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const taxonomyDir = path.join(root, 'taxonomy');
  const impasseDir = path.join(root, 'impasse');
  fs.mkdirSync(taxonomyDir, { recursive: true });
  fs.mkdirSync(impasseDir, { recursive: true });
  const env = {
    ...process.env,
    HUMAN_CODING_OUTPUT_DIR: taxonomyDir,
    HUMAN_CODING_SAMPLE: path.join(root, 'sample.csv'),
    LABELLING_GAME_IMPASSE_OUTPUT_DIR: impasseDir,
  };
  return { root, taxonomyDir, impasseDir, env };
}

test('coder artifact tokens are reversible and separate identities collapsed by both legacy sanitizers', () => {
  const identities = ['rater a', 'rater/a', 'rater-a', 'Rater: α'];
  const tokens = identities.map(coderArtifactToken);
  assert.equal(new Set(tokens).size, identities.length);
  assert.deepEqual(tokens.map(coderIdFromArtifactToken), identities);
  assert.equal(coderIdFromArtifactToken('cid_cmF0ZXI'), null);
  assert.equal(legacyTaxonomyCoderKey('rater a'), legacyTaxonomyCoderKey('rater/a'));
  assert.equal(legacyImpasseCoderKey('rater a'), legacyImpasseCoderKey('rater/a'));
  assert.equal(normalizeCoderId('  Cafe\u0301  '), 'Café');
  assert.throws(
    () => normalizeCoderId('rater\u0000a'),
    (error) => error.code === 'coder_id_invalid_characters',
  );
});

test('legacy artifacts require explicit confirmation and migrate to reversible filenames', (t) => {
  const { taxonomyDir, impasseDir, env } = fixture(t);
  const taxonomyLegacy = path.join(taxonomyDir, 'human-validation-pilot-rater-ratera.csv');
  const impasseLegacy = path.join(impasseDir, 'impasse-corpus-phase1-rater-impasse-rater.json');
  fs.writeFileSync(taxonomyLegacy, 'item_id,human_primary\nitem-a,VAGUENESS\n', 'utf8');
  fs.writeFileSync(
    impasseLegacy,
    `${JSON.stringify({ schema: 'legacy.v1', coder_id: 'impasse-rater', items: [] }, null, 2)}\n`,
    'utf8',
  );

  const checked = inspectLabellingCoderArtifacts({ env });
  assert.equal(checked.counts.confirmation_required, 2);

  const migrated = migrateLabellingCoderArtifacts({ env, acceptInferred: true });
  assert.equal(migrated.success, true);
  assert.equal(migrated.migrated.length, 2);
  assert.equal(fs.existsSync(taxonomyLegacy), false);
  assert.equal(fs.existsSync(impasseLegacy), false);

  const taxonomyTarget = path.join(taxonomyDir, `human-validation-pilot-rater-${coderArtifactToken('ratera')}.csv`);
  const impasseTarget = path.join(
    impasseDir,
    `impasse-corpus-phase1-rater-${coderArtifactToken('impasse-rater')}.json`,
  );
  assert.equal(fs.existsSync(taxonomyTarget), true);
  assert.equal(fs.existsSync(impasseTarget), true);
  const sidecar = JSON.parse(fs.readFileSync(impasseTarget, 'utf8'));
  assert.equal(sidecar.coder_id, 'impasse-rater');
  assert.equal(sidecar.coder_identity.artifact_token, coderArtifactToken('impasse-rater'));
  assert.equal(sidecar.coder_identity.migrated_from, path.basename(impasseLegacy));

  const current = inspectLabellingCoderArtifacts({ env });
  assert.equal(current.counts.current, 2);
  assert.equal(current.counts.confirmation_required, 0);
});

test('migration mappings preserve a supplied display identity and refuse target collisions', (t) => {
  const { taxonomyDir, impasseDir, env } = fixture(t);
  const legacy = path.join(taxonomyDir, 'human-validation-pilot-rater-ratera.csv');
  const target = path.join(taxonomyDir, `human-validation-pilot-rater-${coderArtifactToken('Rater A')}.csv`);
  const independentLegacy = path.join(impasseDir, 'impasse-corpus-phase1-rater-coder-b.json');
  fs.writeFileSync(legacy, 'item_id,human_primary\n', 'utf8');
  fs.writeFileSync(target, 'item_id,human_primary\n', 'utf8');
  fs.writeFileSync(independentLegacy, `${JSON.stringify({ coder_id: 'coder-b', items: [] })}\n`, 'utf8');

  const mapping = {
    'superego-taxonomy': { ratera: 'Rater A' },
    'tutor-stub-impasses': { 'coder-b': 'Coder B' },
  };
  const checked = inspectLabellingCoderArtifacts({ env, mapping });
  const legacyEntry = checked.entries.find((entry) => entry.source_path === legacy);
  assert.equal(legacyEntry.status, 'collision');
  assert.equal(migrateLabellingCoderArtifacts({ env, mapping }).success, false);
  assert.equal(fs.existsSync(legacy), true);
  assert.equal(fs.existsSync(target), true);
  assert.equal(fs.existsSync(independentLegacy), true);
});

test('migration CLI checks, requires explicit apply confirmation, and exits cleanly after migration', (t) => {
  const { taxonomyDir, env } = fixture(t);
  fs.writeFileSync(
    path.join(taxonomyDir, 'human-validation-pilot-rater-rater-A.csv'),
    'item_id,human_primary\n',
    'utf8',
  );

  const checkBefore = spawnSync(process.execPath, [CLI, '--check', '--json'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(checkBefore.status, 1);
  assert.equal(JSON.parse(checkBefore.stdout).counts.confirmation_required, 1);

  const unsafeApply = spawnSync(process.execPath, [CLI, '--apply'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(unsafeApply.status, 2);
  assert.match(unsafeApply.stderr, /requires --mapping <file> or --accept-inferred/u);

  const applied = spawnSync(process.execPath, [CLI, '--apply', '--accept-inferred', '--json'], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
  });
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).migrated.length, 1);

  const checkAfter = spawnSync(process.execPath, [CLI, '--check', '--json'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(checkAfter.status, 0, checkAfter.stderr);
  assert.equal(JSON.parse(checkAfter.stdout).counts.current, 1);
});

test('human-validation analyzer decodes current artifact tokens back to the exact coder ID', (t) => {
  const { root, taxonomyDir, env } = fixture(t);
  const coderId = 'Rater: α';
  const keyPath = path.join(root, 'key.jsonl');
  const reportPath = path.join(root, 'analysis.md');
  fs.writeFileSync(keyPath, `${JSON.stringify({ item_id: 'item-a', llm_primary: 'VAGUENESS' })}\n`, 'utf8');
  fs.writeFileSync(
    path.join(taxonomyDir, `human-validation-pilot-rater-${coderArtifactToken(coderId)}.csv`),
    'item_id,human_primary\nitem-a,VAGUENESS\n',
    'utf8',
  );

  const result = spawnSync(process.execPath, [ANALYZER, '--out', reportPath], {
    cwd: ROOT,
    env: { ...env, HUMAN_CODING_KEY: keyPath },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(reportPath, 'utf8'), /\*\*Rater: α\*\*/u);
});
