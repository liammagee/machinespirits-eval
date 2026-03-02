/**
 * Superego Guard Tests
 *
 * Verifies that the `disableSuperego` flag is correctly computed by
 * resolveConfigModels() for ALL eval cells. This prevents phantom superego
 * API calls when eval cells map to tutor-core profiles that have a superego
 * configured but the eval cell design requires single-agent (ego-only) operation.
 *
 * Root cause: tutor-core computes hasSuperego from its OWN profile config.
 * When cell 90 maps to the `recognition` profile (which has a superego),
 * passing superegoModel: null is treated as "no override" rather than "disable".
 * The disableSuperego flag is the explicit signal.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { resolveConfigModels, EVAL_ONLY_PROFILES } from '../services/evaluationRunner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, '..', 'config');
const tutorConfig = yaml.parse(fs.readFileSync(path.join(configDir, 'tutor-agents.yaml'), 'utf8'));

// All cell profiles from YAML
const cellNames = Object.keys(tutorConfig.profiles).filter((name) => /^cell_\d/.test(name));

// Derive CELLS_WITH_SUPEREGO dynamically from the YAML:
// A cell has an active superego IFF multi_agent_tutor: true AND superego block is non-null.
const CELLS_WITH_SUPEREGO = new Set(
  cellNames.filter((name) => {
    const p = tutorConfig.profiles[name];
    return p.factors?.multi_agent_tutor === true && p.superego !== null && p.superego !== undefined;
  }),
);

// Cells WITHOUT superego: either superego: null OR multi_agent_tutor: false
const CELLS_WITHOUT_SUPEREGO = new Set(cellNames.filter((name) => !CELLS_WITH_SUPEREGO.has(name)));

// ============================================================================
// EXHAUSTIVE: disableSuperego matches YAML for every cell
// ============================================================================

describe('superego guard — disableSuperego for all cells', () => {
  for (const cellName of cellNames) {
    // Skip cells not registered in EVAL_ONLY_PROFILES (can't be resolved)
    if (!EVAL_ONLY_PROFILES.includes(cellName)) continue;

    const expectSuperego = CELLS_WITH_SUPEREGO.has(cellName);

    it(`${cellName}: disableSuperego = ${!expectSuperego}`, () => {
      const resolved = resolveConfigModels({ profileName: cellName });
      if (expectSuperego) {
        assert.strictEqual(
          resolved.disableSuperego,
          false,
          `${cellName} has a superego configured — disableSuperego should be false`,
        );
        assert.ok(resolved.superegoModel, `${cellName} has a superego configured — superegoModel should be non-null`);
      } else {
        assert.strictEqual(
          resolved.disableSuperego,
          true,
          `${cellName} has no superego — disableSuperego should be true`,
        );
        assert.strictEqual(resolved.superegoModel, null, `${cellName} has no superego — superegoModel should be null`);
      }
    });
  }
});

// ============================================================================
// SPOT CHECKS: cells WITH superego get disableSuperego = false
// ============================================================================

describe('superego guard — cells WITH superego', () => {
  const spotChecks = [
    'cell_3_base_multi_unified',
    'cell_7_recog_multi_unified',
    'cell_22_base_suspicious_unified',
    'cell_87_messages_recog_multi_psycho',
  ];

  for (const cellName of spotChecks) {
    it(`${cellName} has disableSuperego = false and a superegoModel`, () => {
      const resolved = resolveConfigModels({ profileName: cellName });
      assert.strictEqual(resolved.disableSuperego, false);
      assert.ok(resolved.superegoModel, 'should have superegoModel');
      assert.ok(resolved.superegoModel.provider, 'superegoModel should have provider');
      assert.ok(resolved.superegoModel.model, 'superegoModel should have model');
    });
  }
});

// ============================================================================
// SPOT CHECKS: cells WITHOUT superego get disableSuperego = true
// ============================================================================

describe('superego guard — cells WITHOUT superego', () => {
  const spotChecks = [
    'cell_1_base_single_unified',
    'cell_5_recog_single_unified',
    'cell_71_naive_single_unified',
    'cell_80_messages_base_single_unified',
    'cell_90_messages_recog_single_unified',
  ];

  for (const cellName of spotChecks) {
    it(`${cellName} has disableSuperego = true and no superegoModel`, () => {
      const resolved = resolveConfigModels({ profileName: cellName });
      assert.strictEqual(resolved.disableSuperego, true);
      assert.strictEqual(resolved.superegoModel, null);
    });
  }
});

// ============================================================================
// CELL 90 SPECIFIC: the original bug report cell
// ============================================================================

describe('superego guard — cell 90 (original bug)', () => {
  it('cell 90 has disableSuperego = true', () => {
    const resolved = resolveConfigModels({ profileName: 'cell_90_messages_recog_single_unified' });
    assert.strictEqual(resolved.disableSuperego, true);
  });

  it('cell 90 has superegoModel = null', () => {
    const resolved = resolveConfigModels({ profileName: 'cell_90_messages_recog_single_unified' });
    assert.strictEqual(resolved.superegoModel, null);
  });

  it('cell 90 YAML has dialogue.enabled = true (the edge case)', () => {
    const rawProfile = tutorConfig.profiles['cell_90_messages_recog_single_unified'];
    assert.ok(rawProfile, 'cell 90 should exist in tutor-agents.yaml');
    assert.strictEqual(rawProfile.dialogue?.enabled, true, 'dialogue should be enabled');
  });

  it('cell 90 YAML has superego: null', () => {
    const rawProfile = tutorConfig.profiles['cell_90_messages_recog_single_unified'];
    assert.strictEqual(rawProfile.superego, null, 'superego should be null');
  });

  it('cell 90 YAML has multi_agent_tutor: false', () => {
    const rawProfile = tutorConfig.profiles['cell_90_messages_recog_single_unified'];
    assert.strictEqual(rawProfile.factors.multi_agent_tutor, false);
  });
});

// ============================================================================
// GUARD LOGIC: hasSuperego computation with disableSuperego flag
// ============================================================================

describe('superego guard — hasSuperego computation logic', () => {
  // The hasSuperego computation in tutorDialogueEngine.js is:
  //   const hasSuperego = !disableSuperego && profile.dialogue?.enabled === true && profile.superego !== null;
  //
  // We verify the truth table here at the config level.

  it('disableSuperego=true always means no superego regardless of profile', () => {
    // Cell 90: dialogue enabled, but superego disabled by eval cell
    const resolved = resolveConfigModels({ profileName: 'cell_90_messages_recog_single_unified' });
    assert.strictEqual(resolved.disableSuperego, true);
    // The tutor-core profile it maps to (recognition) HAS a superego, but disableSuperego overrides
  });

  it('disableSuperego=false with configured superego means superego active', () => {
    // Cell 87: dialogue enabled, superego configured
    const resolved = resolveConfigModels({ profileName: 'cell_87_messages_recog_multi_psycho' });
    assert.strictEqual(resolved.disableSuperego, false);
    assert.ok(resolved.superegoModel);
  });

  it('cells with multi_agent_tutor=false always get disableSuperego=true', () => {
    // Single-agent cells never have a superego
    for (const cellName of [
      'cell_1_base_single_unified',
      'cell_5_recog_single_unified',
      'cell_71_naive_single_unified',
    ]) {
      const resolved = resolveConfigModels({ profileName: cellName });
      assert.strictEqual(resolved.disableSuperego, true, `${cellName} should have disableSuperego=true`);
    }
  });

  it('messages-mode single-agent cells get disableSuperego=true', () => {
    // Messages-mode cells that are single-agent should also be guarded
    for (const cellName of [
      'cell_80_messages_base_single_unified',
      'cell_84_messages_recog_single_unified',
      'cell_90_messages_recog_single_unified',
    ]) {
      const resolved = resolveConfigModels({ profileName: cellName });
      assert.strictEqual(resolved.disableSuperego, true, `${cellName} should have disableSuperego=true`);
    }
  });
});

// ============================================================================
// SANITY: CELLS_WITH_SUPEREGO derived set is non-trivial
// ============================================================================

describe('superego guard — derived set sanity checks', () => {
  it('there are cells WITH superego (at least the core 4: cells 3, 4, 7, 8)', () => {
    assert.ok(CELLS_WITH_SUPEREGO.size >= 4, `Expected ≥4 cells with superego, got ${CELLS_WITH_SUPEREGO.size}`);
    for (const name of [
      'cell_3_base_multi_unified',
      'cell_4_base_multi_psycho',
      'cell_7_recog_multi_unified',
      'cell_8_recog_multi_psycho',
    ]) {
      assert.ok(CELLS_WITH_SUPEREGO.has(name), `${name} should be in CELLS_WITH_SUPEREGO`);
    }
  });

  it('there are cells WITHOUT superego (at least cells 1, 5, 71, 90)', () => {
    assert.ok(
      CELLS_WITHOUT_SUPEREGO.size >= 4,
      `Expected ≥4 cells without superego, got ${CELLS_WITHOUT_SUPEREGO.size}`,
    );
    for (const name of [
      'cell_1_base_single_unified',
      'cell_5_recog_single_unified',
      'cell_71_naive_single_unified',
      'cell_90_messages_recog_single_unified',
    ]) {
      assert.ok(CELLS_WITHOUT_SUPEREGO.has(name), `${name} should be in CELLS_WITHOUT_SUPEREGO`);
    }
  });

  it('every cell is in exactly one set', () => {
    for (const name of cellNames) {
      const inWith = CELLS_WITH_SUPEREGO.has(name);
      const inWithout = CELLS_WITHOUT_SUPEREGO.has(name);
      assert.ok(inWith !== inWithout, `${name} should be in exactly one set (with=${inWith}, without=${inWithout})`);
    }
  });
});
