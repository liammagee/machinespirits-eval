import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';

import {
  LEGACY_EVAL_PROFILE_ALIASES,
  assertEvalProfileTargetExists,
  canonicalCellNamesFromProfiles,
  createEvalProfileRegistry,
  validateEvalProfileRegistry,
} from '../services/evalProfileRegistry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profiles = YAML.parse(fs.readFileSync(path.join(ROOT, 'config', 'tutor-agents.yaml'), 'utf8')).profiles;

test('the YAML source yields the exact current 204-cell canonical registry', () => {
  const registry = createEvalProfileRegistry(profiles);
  assert.equal(registry.canonicalCellNames.length, 204);
  assert.deepEqual(registry.canonicalCellNames, canonicalCellNamesFromProfiles(profiles));
  assert.equal(new Set(registry.canonicalCellNames).size, 204);
  assert.ok(registry.canonicalCellNames.every((name) => name.startsWith('cell_')));
  assert.ok(Object.isFrozen(registry.canonicalCellNames));
});

test('ten historical aliases are explicit, immutable, and outside the canonical cell set', () => {
  const registry = createEvalProfileRegistry(profiles);
  assert.deepEqual(LEGACY_EVAL_PROFILE_ALIASES, {
    single_baseline: 'budget',
    single_baseline_paid: 'budget',
    single_recognition: 'recognition',
    single_recognition_paid: 'recognition',
    single_enhanced: 'enhanced',
    baseline: 'budget',
    baseline_paid: 'budget',
    recognition: 'recognition',
    recognition_paid: 'recognition',
    enhanced: 'enhanced',
  });
  assert.equal(Object.keys(registry.legacyAliases).length, 10);
  assert.ok(Object.keys(registry.legacyAliases).every((name) => !registry.canonicalCellNames.includes(name)));
  assert.ok(Object.isFrozen(registry.legacyAliases));
});

test('two-way validation reports either-side drift, duplicates, malformed names, and alias collisions', () => {
  const fixtureProfiles = {
    budget: {},
    cell_1_alpha: {},
    cell_bad: {},
  };
  const validation = validateEvalProfileRegistry({
    profiles: fixtureProfiles,
    canonicalCellNames: ['cell_1_alpha', 'cell_1_alpha', 'cell_2_beta'],
    legacyAliases: {
      cell_1_alpha: 'budget',
      empty: '',
    },
  });

  assert.equal(validation.valid, false);
  assert.deepEqual(validation.yamlOnly, ['cell_bad']);
  assert.deepEqual(validation.registryOnly, ['cell_2_beta']);
  assert.deepEqual(validation.duplicateCells, ['cell_1_alpha']);
  assert.deepEqual(validation.malformedCells, ['cell_bad']);
  assert.deepEqual(validation.aliasCollisions, ['cell_1_alpha']);
  assert.deepEqual(validation.malformedAliases, ['cell_1_alpha', 'empty']);
});

test('registry construction fails closed when supplied profiles are absent or invalid', () => {
  assert.throws(() => canonicalCellNamesFromProfiles(null), /requires a profiles object/u);
  assert.throws(
    () => createEvalProfileRegistry({ cell_bad: {} }),
    /Invalid evaluation profile registry: malformed cell names: cell_bad/u,
  );
});

test('mapped tutor-core targets fail closed instead of falling back', () => {
  assert.equal(assertEvalProfileTargetExists('cell_1_alpha', 'budget', { budget: {} }), 'budget');
  assert.throws(
    () => assertEvalProfileTargetExists('cell_1_alpha', 'missing', { budget: {} }),
    /Evaluation profile "cell_1_alpha" resolves to missing tutor-core profile "missing"/u,
  );
});
