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

// All 8 cell profile names
const allCells = [
  'cell_1_base_single_unified',
  'cell_2_base_single_psycho',
  'cell_3_base_multi_unified',
  'cell_4_base_multi_psycho',
  'cell_5_recog_single_unified',
  'cell_6_recog_single_psycho',
  'cell_7_recog_multi_unified',
  'cell_8_recog_multi_psycho',
];

const multiAgentCells = [
  'cell_3_base_multi_unified',
  'cell_4_base_multi_psycho',
  'cell_7_recog_multi_unified',
  'cell_8_recog_multi_psycho',
];

const singleAgentCells = [
  'cell_1_base_single_unified',
  'cell_2_base_single_psycho',
  'cell_5_recog_single_unified',
  'cell_6_recog_single_psycho',
];

describe('resolveConfigModels — all 8 cells egoModel', () => {
  for (const cell of allCells) {
    it(`${cell} resolves egoModel as { provider: 'openrouter', model: 'kimi-k2.5' }`, () => {
      const resolved = resolveConfigModels({ profileName: cell });
      assert.deepStrictEqual(resolved.egoModel, { provider: 'openrouter', model: 'kimi-k2.5' });
    });
  }
});

describe('resolveConfigModels — superegoModel presence matches multi-agent factor', () => {
  for (const cell of multiAgentCells) {
    it(`${cell} (multi-agent) has superegoModel`, () => {
      const resolved = resolveConfigModels({ profileName: cell });
      assert.ok(resolved.superegoModel, `${cell} should have superegoModel`);
      assert.strictEqual(typeof resolved.superegoModel.provider, 'string');
      assert.strictEqual(typeof resolved.superegoModel.model, 'string');
    });
  }

  for (const cell of singleAgentCells) {
    it(`${cell} (single-agent) has no superegoModel`, () => {
      const resolved = resolveConfigModels({ profileName: cell });
      assert.strictEqual(resolved.superegoModel, undefined);
    });
  }
});

describe('resolveConfigModels — factors extraction', () => {
  const expectedFactors = {
    cell_1_base_single_unified:  { recognition: false, multi_agent_tutor: false, multi_agent_learner: false },
    cell_2_base_single_psycho:   { recognition: false, multi_agent_tutor: false, multi_agent_learner: true },
    cell_3_base_multi_unified:   { recognition: false, multi_agent_tutor: true,  multi_agent_learner: false },
    cell_4_base_multi_psycho:    { recognition: false, multi_agent_tutor: true,  multi_agent_learner: true },
    cell_5_recog_single_unified: { recognition: true,  multi_agent_tutor: false, multi_agent_learner: false },
    cell_6_recog_single_psycho:  { recognition: true,  multi_agent_tutor: false, multi_agent_learner: true },
    cell_7_recog_multi_unified:  { recognition: true,  multi_agent_tutor: true,  multi_agent_learner: false },
    cell_8_recog_multi_psycho:   { recognition: true,  multi_agent_tutor: true,  multi_agent_learner: true },
  };

  for (const cell of allCells) {
    it(`${cell} extracts correct factors`, () => {
      const resolved = resolveConfigModels({ profileName: cell });
      assert.deepStrictEqual(resolved.factors, expectedFactors[cell]);
    });
  }
});

describe('resolveConfigModels — learnerArchitecture extraction', () => {
  const expectedArch = {
    cell_1_base_single_unified:  'unified',
    cell_2_base_single_psycho:   'ego_superego',
    cell_3_base_multi_unified:   'unified',
    cell_4_base_multi_psycho:    'ego_superego',
    cell_5_recog_single_unified: 'unified_recognition',
    cell_6_recog_single_psycho:  'ego_superego_recognition',
    cell_7_recog_multi_unified:  'unified_recognition',
    cell_8_recog_multi_psycho:   'ego_superego_recognition',
  };

  for (const cell of allCells) {
    it(`${cell} extracts learnerArchitecture = "${expectedArch[cell]}"`, () => {
      const resolved = resolveConfigModels({ profileName: cell });
      assert.strictEqual(resolved.learnerArchitecture, expectedArch[cell]);
    });
  }
});

describe('resolveConfigModels — modelOverride', () => {
  it('overrides ego model for a single-agent cell', () => {
    const resolved = resolveConfigModels({
      profileName: 'cell_1_base_single_unified',
      modelOverride: 'openrouter.nemotron',
    });
    // resolveModel returns the full model ID from providers.yaml, not the alias
    assert.strictEqual(resolved.egoModel.provider, 'openrouter');
    assert.ok(resolved.egoModel.model.includes('nemotron'), `egoModel.model should contain "nemotron", got: ${resolved.egoModel.model}`);
    assert.strictEqual(resolved.provider, 'openrouter');
    assert.strictEqual(resolved.model, resolved.egoModel.model);
  });

  it('overrides both ego and superego models for a multi-agent cell', () => {
    const resolved = resolveConfigModels({
      profileName: 'cell_3_base_multi_unified',
      modelOverride: 'openrouter.nemotron',
    });
    assert.strictEqual(resolved.egoModel.provider, 'openrouter');
    assert.ok(resolved.egoModel.model.includes('nemotron'));
    assert.ok(resolved.superegoModel, 'multi-agent cell should still have superegoModel');
    assert.strictEqual(resolved.superegoModel.provider, 'openrouter');
    assert.strictEqual(resolved.superegoModel.model, resolved.egoModel.model);
  });

  it('preserves factors and learnerArchitecture when modelOverride is set', () => {
    const resolved = resolveConfigModels({
      profileName: 'cell_4_base_multi_psycho',
      modelOverride: 'openrouter.nemotron',
    });
    assert.deepStrictEqual(resolved.factors, {
      recognition: false, multi_agent_tutor: true, multi_agent_learner: true,
    });
    assert.strictEqual(resolved.learnerArchitecture, 'ego_superego');
  });

  it('does not add superegoModel to single-agent cells', () => {
    const resolved = resolveConfigModels({
      profileName: 'cell_5_recog_single_unified',
      modelOverride: 'openrouter.nemotron',
    });
    assert.strictEqual(resolved.superegoModel, undefined);
  });

  it('throws on invalid modelOverride', () => {
    assert.throws(() => {
      resolveConfigModels({
        profileName: 'cell_1_base_single_unified',
        modelOverride: 'nonexistent.model',
      });
    }, /Invalid --model override/);
  });
});

describe('resolveConfigModels — hyperparameters extraction', () => {
  it('multi-agent cells extract ego hyperparameters with temperature 0.6', () => {
    for (const cell of multiAgentCells) {
      const resolved = resolveConfigModels({ profileName: cell });
      assert.ok(resolved.hyperparameters, `${cell} should have hyperparameters`);
      assert.strictEqual(resolved.hyperparameters.temperature, 0.6, `${cell} ego temperature`);
    }
  });

  it('multi-agent cells extract superego hyperparameters with temperature 0.2', () => {
    for (const cell of multiAgentCells) {
      const resolved = resolveConfigModels({ profileName: cell });
      assert.ok(resolved.superegoHyperparameters, `${cell} should have superegoHyperparameters`);
      assert.strictEqual(resolved.superegoHyperparameters.temperature, 0.2, `${cell} superego temperature`);
    }
  });

  it('all cells have max_tokens >= 8000 (sufficient for reasoning models)', () => {
    for (const cell of allCells) {
      const resolved = resolveConfigModels({ profileName: cell });
      assert.ok(resolved.hyperparameters, `${cell} should have hyperparameters`);
      assert.ok(
        resolved.hyperparameters.max_tokens >= 8000,
        `${cell} max_tokens should be >= 8000 for reasoning models, got ${resolved.hyperparameters.max_tokens}`
      );
    }
  });

  it('modelOverride preserves hyperparameters from profile', () => {
    const resolved = resolveConfigModels({
      profileName: 'cell_3_base_multi_unified',
      modelOverride: 'openrouter.nemotron',
    });
    assert.ok(resolved.hyperparameters, 'should preserve hyperparameters');
    assert.strictEqual(resolved.hyperparameters.temperature, 0.6, 'temperature preserved');
    assert.ok(
      resolved.hyperparameters.max_tokens >= 8000,
      `max_tokens should be >= 8000, got ${resolved.hyperparameters.max_tokens}`
    );
  });
});
