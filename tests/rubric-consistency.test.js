/**
 * Tests for rubric consistency — guards against version drift.
 *
 * The "active" rubric files in config/ must stay consistent with their
 * versioned copies in config/rubrics/v{X.Y}/. This test catches:
 *
 *   1. Active rubric says version X.Y but dimensions differ from config/rubrics/vX.Y/
 *   2. Active rubric is missing operational config (judge, settings) — the
 *      versioned files are dimension-only; the active file must be self-contained
 *   3. Version string in active rubric doesn't match any versioned copy
 *   4. All rubric files have a version field
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import yaml from 'yaml';

const CONFIG_DIR = path.resolve(import.meta.dirname, '..', 'config');
const RUBRICS_DIR = path.join(CONFIG_DIR, 'rubrics');

// Rubric files and their expected operational config keys
const RUBRIC_FILES = [
  {
    active: 'evaluation-rubric.yaml',
    versionedName: 'evaluation-rubric.yaml',
    label: 'tutor per-turn',
    requiredOperationalKeys: ['judge', 'settings'],
  },
  {
    active: 'evaluation-rubric-learner.yaml',
    versionedName: 'evaluation-rubric-learner.yaml',
    label: 'learner',
    requiredOperationalKeys: [], // learner rubric doesn't have judge config
  },
  {
    active: 'evaluation-rubric-dialogue.yaml',
    versionedName: 'evaluation-rubric-dialogue.yaml',
    label: 'dialogue',
    requiredOperationalKeys: [],
  },
  {
    active: 'evaluation-rubric-deliberation.yaml',
    versionedName: 'evaluation-rubric-deliberation.yaml',
    label: 'deliberation',
    requiredOperationalKeys: [],
  },
  {
    active: 'evaluation-rubric-tutor-holistic.yaml',
    versionedName: 'evaluation-rubric-tutor-holistic.yaml',
    label: 'tutor holistic',
    requiredOperationalKeys: [],
  },
];

// ============================================================================
// 1. Every active rubric has a version field
// ============================================================================
describe('Rubric version fields', () => {
  for (const rubric of RUBRIC_FILES) {
    it(`${rubric.label}: active rubric has a version field`, () => {
      const filePath = path.join(CONFIG_DIR, rubric.active);
      if (!fs.existsSync(filePath)) return; // skip if file doesn't exist
      const data = yaml.parse(fs.readFileSync(filePath, 'utf-8'));
      assert.ok(data.version, `${rubric.active} must have a version field`);
      assert.match(data.version, /^\d+\.\d+$/, `version should be semver-like (e.g., "2.2"), got "${data.version}"`);
    });
  }
});

// ============================================================================
// 2. Active rubric dimensions match versioned copy
// ============================================================================
describe('Active rubric matches versioned copy', () => {
  for (const rubric of RUBRIC_FILES) {
    const activePath = path.join(CONFIG_DIR, rubric.active);
    if (!fs.existsSync(activePath)) continue;

    const activeData = yaml.parse(fs.readFileSync(activePath, 'utf-8'));
    const version = activeData.version;
    if (!version) continue;

    const versionedPath = path.join(RUBRICS_DIR, `v${version}`, rubric.versionedName);

    it(`${rubric.label}: v${version} versioned copy exists`, () => {
      assert.ok(
        fs.existsSync(versionedPath),
        `Expected versioned copy at ${versionedPath} for active version ${version}`,
      );
    });

    if (!fs.existsSync(versionedPath)) continue;

    it(`${rubric.label}: active dimensions match v${version} versioned copy`, () => {
      const versionedData = yaml.parse(fs.readFileSync(versionedPath, 'utf-8'));

      const activeKeys = Object.keys(activeData.dimensions || {}).sort();
      const versionedKeys = Object.keys(versionedData.dimensions || {}).sort();

      assert.deepStrictEqual(
        activeKeys,
        versionedKeys,
        `Active ${rubric.active} dimension keys must match v${version} copy.\n` +
          `Active: [${activeKeys.join(', ')}]\n` +
          `Versioned: [${versionedKeys.join(', ')}]`,
      );
    });

    it(`${rubric.label}: active version field matches v${version} versioned copy`, () => {
      const versionedData = yaml.parse(fs.readFileSync(versionedPath, 'utf-8'));
      assert.strictEqual(
        activeData.version,
        versionedData.version,
        `Active version "${activeData.version}" must match versioned copy "${versionedData.version}"`,
      );
    });
  }
});

// ============================================================================
// 3. Active tutor rubric has operational config (self-contained guard)
// ============================================================================
describe('Active rubric operational config', () => {
  for (const rubric of RUBRIC_FILES) {
    if (rubric.requiredOperationalKeys.length === 0) continue;

    it(`${rubric.label}: has required operational config keys`, () => {
      const filePath = path.join(CONFIG_DIR, rubric.active);
      if (!fs.existsSync(filePath)) return;
      const data = yaml.parse(fs.readFileSync(filePath, 'utf-8'));

      for (const key of rubric.requiredOperationalKeys) {
        assert.ok(
          data[key] !== undefined,
          `Active ${rubric.active} must have '${key}' operational config. ` +
            `If you promoted a dimension-only versioned file, merge the operational config from the previous active file.`,
        );
      }
    });
  }

  it('tutor rubric judge config has model and hyperparameters', () => {
    const data = yaml.parse(fs.readFileSync(path.join(CONFIG_DIR, 'evaluation-rubric.yaml'), 'utf-8'));
    assert.ok(data.judge?.model, 'judge.model is required');
    assert.ok(data.judge?.hyperparameters, 'judge.hyperparameters is required');
    assert.ok(data.settings?.parallelism !== undefined, 'settings.parallelism is required');
  });
});

// ============================================================================
// 4. Dimension weights sum to ~1.0
// ============================================================================
describe('Dimension weight consistency', () => {
  for (const rubric of RUBRIC_FILES) {
    const filePath = path.join(CONFIG_DIR, rubric.active);
    if (!fs.existsSync(filePath)) continue;

    it(`${rubric.label}: dimension weights sum to ~1.0`, () => {
      const data = yaml.parse(fs.readFileSync(filePath, 'utf-8'));
      if (!data.dimensions) return;

      const totalWeight = Object.values(data.dimensions).reduce((sum, dim) => sum + (dim.weight || 0), 0);

      assert.ok(
        Math.abs(totalWeight - 1.0) < 0.01,
        `${rubric.active} dimension weights sum to ${totalWeight.toFixed(4)}, expected ~1.0`,
      );
    });
  }
});
