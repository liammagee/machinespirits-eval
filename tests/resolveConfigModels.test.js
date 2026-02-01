/**
 * Tests for resolveConfigModels() — verifies that factorial cell configurations
 * correctly extract egoModel and superegoModel from the profile config.
 *
 * This is the eval-runner side of the superego bootstrap fix: multi-agent cells
 * must resolve superegoModel so tutor-core knows which model to use for the
 * superego agent in dialogue mode.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfigModels } from '../services/evaluationRunner.js';

describe('resolveConfigModels — superegoModel resolution', () => {
  it('cell_3 (base+multi) resolves superegoModel from profile', () => {
    const resolved = resolveConfigModels({ profileName: 'cell_3_base_multi_unified' });
    assert.ok(resolved.superegoModel, 'cell_3 should have superegoModel');
  });

  it('cell_4 (base+multi) resolves superegoModel from profile', () => {
    const resolved = resolveConfigModels({ profileName: 'cell_4_base_multi_psycho' });
    assert.ok(resolved.superegoModel, 'cell_4 should have superegoModel');
  });

  it('cell_7 (recog+multi) resolves superegoModel from profile', () => {
    const resolved = resolveConfigModels({ profileName: 'cell_7_recog_multi_unified' });
    assert.ok(resolved.superegoModel, 'cell_7 should have superegoModel');
  });

  it('cell_1 (base+single) has no superegoModel', () => {
    const resolved = resolveConfigModels({ profileName: 'cell_1_base_single_unified' });
    assert.strictEqual(resolved.superegoModel, undefined, 'cell_1 should have no superegoModel');
  });
});

describe('resolveConfigModels — model object format', () => {
  it('superegoModel is an object { provider, model }', () => {
    const resolved = resolveConfigModels({ profileName: 'cell_3_base_multi_unified' });
    assert.strictEqual(typeof resolved.superegoModel, 'object');
    assert.ok(resolved.superegoModel.provider, 'superegoModel should have provider');
    assert.ok(resolved.superegoModel.model, 'superegoModel should have model');
  });

  it('egoModel is an object { provider, model } for profile-based configs', () => {
    const resolved = resolveConfigModels({ profileName: 'cell_1_base_single_unified' });
    assert.strictEqual(typeof resolved.egoModel, 'object');
    assert.ok(resolved.egoModel.provider, 'egoModel should have provider');
    assert.ok(resolved.egoModel.model, 'egoModel should have model');
  });
});
