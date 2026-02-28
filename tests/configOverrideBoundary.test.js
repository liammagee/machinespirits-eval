/**
 * Config Override Boundary Tests
 *
 * Verifies that eval-repo cell configurations are actually respected by
 * tutor-core at runtime. The eval runner resolves cell configs and passes
 * overrides (superegoModel, egoModel, disableSuperego, maxRounds, etc.)
 * to tutor-core, but tutor-core has its own profile configs with independent
 * gates. These tests catch cases where tutor-core's gates silently ignore
 * eval-repo overrides.
 *
 * Bug history:
 *  - Bug 6: phantom superego in single-agent cells (eval said no superego,
 *    tutor-core's profile had one → superego ran anyway)
 *  - Cell 82 bug: eval said superego active, but tutor-core's `budget`
 *    profile has dialogue.enabled=false → superego gate failed, override ignored
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

import { resolveConfigModels, resolveEvalProfile, EVAL_ONLY_PROFILES } from '../services/evaluationRunner.js';
import { getTutorProfile, loadTutorAgents } from '../services/evalConfigLoader.js';

// tutor-core imports (via symlink)
import * as tutorCoreConfig from '@machinespirits/tutor-core/services/tutorConfigLoader';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evalConfig = yaml.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'tutor-agents.yaml'), 'utf8'));
const cellNames = Object.keys(evalConfig.profiles).filter((name) => /^cell_\d/.test(name));

// ============================================================================
// HELPER: Simulate hasSuperego gate as tutor-core computes it
// ============================================================================

/**
 * Replicate tutor-core's hasSuperego computation (tutorDialogueEngine.js:2075)
 * using the tutor-core profile that a cell maps to, plus eval-repo overrides.
 */
function simulateHasSuperego(cellName) {
  const resolved = resolveConfigModels({ profileName: cellName });
  const { resolvedProfileName } = resolveEvalProfile(cellName);

  // This is what tutor-core sees
  const tutorCoreProfile = tutorCoreConfig.getActiveProfile(resolvedProfileName);
  const profileDialogueEnabled = tutorCoreProfile?.dialogue?.enabled === true;
  const profileHasSuperego = tutorCoreProfile?.superego !== null && tutorCoreProfile?.superego !== undefined;
  const superegoModelOverride = !!resolved.superegoModel;

  // Post-fix hasSuperego gate (includes override awareness)
  const hasSuperego = !resolved.disableSuperego
    && (profileDialogueEnabled || superegoModelOverride)
    && (profileHasSuperego || superegoModelOverride);

  return {
    cellName,
    resolvedProfileName,
    disableSuperego: resolved.disableSuperego,
    superegoModel: resolved.superegoModel,
    profileDialogueEnabled,
    profileHasSuperego,
    superegoModelOverride,
    hasSuperego,
  };
}

// Derive expected superego state from eval YAML
function evalYamlExpectsSuperego(cellName) {
  const p = evalConfig.profiles[cellName];
  return p?.factors?.multi_agent_tutor === true && p?.superego !== null && p?.superego !== undefined;
}

// ============================================================================
// CROSS-BOUNDARY: hasSuperego matches eval YAML for every cell
// ============================================================================

describe('config override boundary — hasSuperego matches eval YAML for all cells', () => {
  for (const cellName of cellNames) {
    if (!EVAL_ONLY_PROFILES.includes(cellName)) continue;

    const expectSuperego = evalYamlExpectsSuperego(cellName);

    it(`${cellName}: hasSuperego = ${expectSuperego}`, () => {
      const result = simulateHasSuperego(cellName);
      assert.strictEqual(
        result.hasSuperego,
        expectSuperego,
        `${cellName} → tutor-core profile "${result.resolvedProfileName}": ` +
        `eval YAML expects superego=${expectSuperego}, but tutor-core gate yields ${result.hasSuperego}. ` +
        `Profile dialogue.enabled=${result.profileDialogueEnabled}, ` +
        `profile superego=${result.profileHasSuperego}, ` +
        `superegoModel override=${result.superegoModelOverride}, ` +
        `disableSuperego=${result.disableSuperego}`,
      );
    });
  }
});

// ============================================================================
// CROSS-BOUNDARY: ego model override reaches tutor-core
// ============================================================================

describe('config override boundary — ego model overrides', () => {
  for (const cellName of cellNames) {
    if (!EVAL_ONLY_PROFILES.includes(cellName)) continue;

    const evalProfile = evalConfig.profiles[cellName];
    if (!evalProfile?.ego) continue;

    it(`${cellName}: ego model from eval YAML is passed as override`, () => {
      const resolved = resolveConfigModels({ profileName: cellName });
      assert.ok(resolved.egoModel, `${cellName} should have egoModel override`);

      // egoModel can be string or {provider, model} — extract model name
      const egoModelName = typeof resolved.egoModel === 'object'
        ? resolved.egoModel.model
        : resolved.egoModel;
      assert.ok(egoModelName, `${cellName} egoModel should have a model name`);
    });
  }
});

// ============================================================================
// CROSS-BOUNDARY: superego model override for multi-agent cells
// ============================================================================

describe('config override boundary — superego model overrides for multi-agent cells', () => {
  for (const cellName of cellNames) {
    if (!EVAL_ONLY_PROFILES.includes(cellName)) continue;

    const expectSuperego = evalYamlExpectsSuperego(cellName);
    if (!expectSuperego) continue;

    const evalProfile = evalConfig.profiles[cellName];

    it(`${cellName}: superegoModel matches eval YAML superego config`, () => {
      const resolved = resolveConfigModels({ profileName: cellName });
      assert.ok(resolved.superegoModel, `${cellName} should have superegoModel override`);
      assert.ok(resolved.superegoModel.provider, `${cellName} superegoModel should have provider`);
      assert.ok(resolved.superegoModel.model, `${cellName} superegoModel should have model`);

      // The model name should match the eval YAML's superego.model
      assert.strictEqual(
        resolved.superegoModel.model,
        evalProfile.superego.model,
        `${cellName} superegoModel.model should match eval YAML`,
      );
    });
  }
});

// ============================================================================
// CROSS-BOUNDARY: dialogue rounds override
// ============================================================================

describe('config override boundary — dialogue rounds from eval YAML', () => {
  for (const cellName of cellNames) {
    if (!EVAL_ONLY_PROFILES.includes(cellName)) continue;

    const evalProfile = evalConfig.profiles[cellName];
    if (!evalProfile?.dialogue) continue;

    const expectedMaxRounds = evalProfile.dialogue.max_rounds ?? 0;

    it(`${cellName}: maxRounds = ${expectedMaxRounds}`, () => {
      const { maxRounds } = resolveEvalProfile(cellName);
      assert.strictEqual(
        maxRounds,
        expectedMaxRounds,
        `${cellName} maxRounds should match eval YAML dialogue.max_rounds`,
      );
    });
  }
});

// ============================================================================
// CROSS-BOUNDARY: conversation mode passthrough
// ============================================================================

describe('config override boundary — conversation mode', () => {
  const messagesCells = cellNames.filter(n => evalConfig.profiles[n]?.conversation_mode === 'messages');
  const nonMessagesCells = cellNames.filter(n =>
    !evalConfig.profiles[n]?.conversation_mode || evalConfig.profiles[n]?.conversation_mode !== 'messages',
  );

  it('messages-mode cells are identified correctly', () => {
    assert.ok(messagesCells.length >= 8, `Expected ≥8 messages-mode cells, got ${messagesCells.length}`);
    for (const name of ['cell_80_messages_base_single_unified', 'cell_84_messages_recog_single_unified']) {
      assert.ok(messagesCells.includes(name), `${name} should be messages-mode`);
    }
  });

  for (const cellName of messagesCells) {
    if (!EVAL_ONLY_PROFILES.includes(cellName)) continue;

    it(`${cellName}: conversationMode = "messages"`, () => {
      const resolved = resolveConfigModels({ profileName: cellName });
      assert.strictEqual(resolved.conversationMode, 'messages');
    });
  }
});

// ============================================================================
// CROSS-BOUNDARY: recognition mode passthrough
// ============================================================================

describe('config override boundary — recognition mode', () => {
  for (const cellName of cellNames) {
    if (!EVAL_ONLY_PROFILES.includes(cellName)) continue;

    const evalProfile = evalConfig.profiles[cellName];
    const expectRecognition = evalProfile?.recognition_mode === true
      || evalProfile?.factors?.prompt_type === 'recognition'
      || evalProfile?.factors?.prompt_type === 'recognition_nomem';

    it(`${cellName}: recognition = ${expectRecognition}`, () => {
      const resolved = resolveConfigModels({ profileName: cellName });
      const actualRecognition = resolved.factors?.recognition === true;
      assert.strictEqual(
        actualRecognition,
        expectRecognition,
        `${cellName} recognition mode mismatch`,
      );
    });
  }
});

// ============================================================================
// CROSS-BOUNDARY: profile remapping completeness
// ============================================================================

describe('config override boundary — every registered cell resolves to a valid tutor-core profile', () => {
  for (const cellName of cellNames) {
    if (!EVAL_ONLY_PROFILES.includes(cellName)) continue;

    it(`${cellName} resolves to a valid tutor-core profile`, () => {
      const { resolvedProfileName } = resolveEvalProfile(cellName);
      assert.ok(resolvedProfileName, `${cellName} should resolve to a profile name`);

      const tutorCoreProfile = tutorCoreConfig.getActiveProfile(resolvedProfileName);
      assert.ok(tutorCoreProfile, `${cellName} → "${resolvedProfileName}" should exist in tutor-core`);
      assert.ok(tutorCoreProfile.ego || tutorCoreProfile.agents?.ego, `tutor-core profile "${resolvedProfileName}" should have an ego agent`);
    });
  }
});

// ============================================================================
// SPOT CHECK: the cell_82 bug specifically
// ============================================================================

describe('config override boundary — cell_82 superego override (regression)', () => {
  it('cell_82 maps to budget profile which has dialogue.enabled=false', () => {
    const { resolvedProfileName } = resolveEvalProfile('cell_82_messages_base_multi_unified');
    assert.strictEqual(resolvedProfileName, 'budget');

    const tutorCoreProfile = tutorCoreConfig.getActiveProfile('budget');
    assert.strictEqual(tutorCoreProfile.dialogue?.enabled, false,
      'budget profile has dialogue.enabled=false (the root cause)');
    assert.strictEqual(tutorCoreProfile.superego, null,
      'budget profile has superego=null');
  });

  it('cell_82 eval YAML has superego configured', () => {
    const evalProfile = evalConfig.profiles['cell_82_messages_base_multi_unified'];
    assert.ok(evalProfile.superego, 'eval YAML should have superego block');
    assert.strictEqual(evalProfile.factors.multi_agent_tutor, true);
  });

  it('cell_82 superegoModel override makes hasSuperego=true despite budget profile', () => {
    const result = simulateHasSuperego('cell_82_messages_base_multi_unified');
    assert.strictEqual(result.hasSuperego, true,
      'superegoModel override should bypass budget profile gates');
    assert.strictEqual(result.disableSuperego, false);
    assert.ok(result.superegoModel, 'should have superegoModel override');
  });

  it('cell_86 (recognition counterpart) also has hasSuperego=true', () => {
    const result = simulateHasSuperego('cell_86_messages_recog_multi_unified');
    assert.strictEqual(result.hasSuperego, true);
  });

  it('symmetric: base multi-agent cells 3 and 82 both have hasSuperego=true', () => {
    const result3 = simulateHasSuperego('cell_3_base_multi_unified');
    const result82 = simulateHasSuperego('cell_82_messages_base_multi_unified');
    assert.strictEqual(result3.hasSuperego, true, 'cell_3 should have superego');
    assert.strictEqual(result82.hasSuperego, true, 'cell_82 should have superego');
  });
});

// ============================================================================
// HYPERPARAMETERS: eval YAML hyperparameters override tutor-core defaults
// ============================================================================

describe('config override boundary — hyperparameter passthrough', () => {
  for (const cellName of cellNames) {
    if (!EVAL_ONLY_PROFILES.includes(cellName)) continue;

    const evalProfile = evalConfig.profiles[cellName];
    if (!evalProfile?.ego?.hyperparameters) continue;

    it(`${cellName}: ego hyperparameters are passed through`, () => {
      const resolved = resolveConfigModels({ profileName: cellName });
      assert.ok(resolved.hyperparameters, `${cellName} should have hyperparameters`);

      // Check temperature and max_tokens match eval YAML
      if (evalProfile.ego.hyperparameters.temperature !== undefined) {
        assert.strictEqual(
          resolved.hyperparameters.temperature,
          evalProfile.ego.hyperparameters.temperature,
          `${cellName} temperature mismatch`,
        );
      }
      if (evalProfile.ego.hyperparameters.max_tokens !== undefined) {
        assert.strictEqual(
          resolved.hyperparameters.max_tokens,
          evalProfile.ego.hyperparameters.max_tokens,
          `${cellName} max_tokens mismatch`,
        );
      }
    });
  }
});
