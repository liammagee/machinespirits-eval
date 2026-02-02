/**
 * Factorial Design Integrity Tests
 *
 * Verifies that the YAML config and profile resolution form a valid, complete
 * 2×2×2 factorial design. Tests act as a safety net: changes to config that
 * violate the factorial design contract will break these tests.
 *
 * Covers:
 *   - Config integrity (all 8 cells, orthogonal factors, naming convention)
 *   - Prompt file assignment (base vs recognition ego/superego prompts)
 *   - Model consistency (ego model, superego presence, hyperparameters)
 *   - Learner architecture wiring (learner_architecture → learner-agents.yaml)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, '..', 'config');

const tutorConfig = yaml.parse(fs.readFileSync(path.join(configDir, 'tutor-agents.yaml'), 'utf8'));
const learnerConfig = yaml.parse(fs.readFileSync(path.join(configDir, 'learner-agents.yaml'), 'utf8'));

// Extract just the 8 factorial cell profiles (cell_1 through cell_8)
const cellNames = Object.keys(tutorConfig.profiles).filter(name => /^cell_\d/.test(name));
const cells = Object.fromEntries(cellNames.map(name => [name, tutorConfig.profiles[name]]));

// ============================================================================
// CONFIG INTEGRITY
// ============================================================================

describe('factorial design — config integrity', () => {
  it('tutor-agents.yaml has exactly 8 factorial cell profiles', () => {
    assert.strictEqual(cellNames.length, 8, `Expected 8 cell profiles, got ${cellNames.length}: ${cellNames.join(', ')}`);
  });

  it('each cell has a factors block with exactly 3 boolean keys', () => {
    const expectedKeys = ['recognition', 'multi_agent_tutor', 'multi_agent_learner'];
    for (const [name, profile] of Object.entries(cells)) {
      assert.ok(profile.factors, `${name} missing factors block`);
      const keys = Object.keys(profile.factors).sort();
      assert.deepStrictEqual(keys, expectedKeys.sort(), `${name} factors keys mismatch`);
      for (const key of expectedKeys) {
        assert.strictEqual(typeof profile.factors[key], 'boolean', `${name}.factors.${key} should be boolean`);
      }
    }
  });

  it('8 cells produce all 8 unique factor combinations (full factorial)', () => {
    const combos = new Set();
    for (const [name, profile] of Object.entries(cells)) {
      const { recognition, multi_agent_tutor, multi_agent_learner } = profile.factors;
      const key = `r${+recognition}_t${+multi_agent_tutor}_l${+multi_agent_learner}`;
      combos.add(key);
    }
    assert.strictEqual(combos.size, 8, `Expected 8 unique factor combos, got ${combos.size}`);
    // Verify every combination is present
    for (const r of [0, 1]) {
      for (const t of [0, 1]) {
        for (const l of [0, 1]) {
          assert.ok(combos.has(`r${r}_t${t}_l${l}`), `Missing factor combo r${r}_t${t}_l${l}`);
        }
      }
    }
  });

  it('cell naming convention matches factors', () => {
    for (const [name, profile] of Object.entries(cells)) {
      const { recognition, multi_agent_tutor, multi_agent_learner } = profile.factors;
      if (recognition) {
        assert.ok(name.includes('recog'), `${name} has recognition=true but name lacks "recog"`);
      } else {
        assert.ok(name.includes('base'), `${name} has recognition=false but name lacks "base"`);
      }
      if (multi_agent_tutor) {
        assert.ok(name.includes('multi'), `${name} has multi_agent_tutor=true but name lacks "multi"`);
      } else {
        assert.ok(name.includes('single'), `${name} has multi_agent_tutor=false but name lacks "single"`);
      }
    }
  });
});

// ============================================================================
// PROMPT FILE ASSIGNMENT
// ============================================================================

describe('factorial design — prompt file assignment', () => {
  const baseCells = cellNames.filter(n => cells[n].factors.recognition === false);
  const recogCells = cellNames.filter(n => cells[n].factors.recognition === true);
  const multiTutorCells = cellNames.filter(n => cells[n].factors.multi_agent_tutor === true);

  it('base cells (recognition=false) use tutor-ego.md for ego prompt', () => {
    for (const name of baseCells) {
      assert.strictEqual(cells[name].ego.prompt_file, 'tutor-ego.md', `${name} ego prompt_file`);
    }
  });

  it('recognition cells use tutor-ego-recognition.md for ego prompt', () => {
    for (const name of recogCells) {
      assert.strictEqual(cells[name].ego.prompt_file, 'tutor-ego-recognition.md', `${name} ego prompt_file`);
    }
  });

  it('multi-agent base cells use tutor-superego.md', () => {
    const baseMulti = multiTutorCells.filter(n => cells[n].factors.recognition === false);
    for (const name of baseMulti) {
      assert.strictEqual(cells[name].superego.prompt_file, 'tutor-superego.md', `${name} superego prompt_file`);
    }
  });

  it('multi-agent recognition cells use tutor-superego-recognition.md', () => {
    const recogMulti = multiTutorCells.filter(n => cells[n].factors.recognition === true);
    for (const name of recogMulti) {
      assert.strictEqual(cells[name].superego.prompt_file, 'tutor-superego-recognition.md', `${name} superego prompt_file`);
    }
  });
});

// ============================================================================
// MODEL CONSISTENCY
// ============================================================================

describe('factorial design — model consistency', () => {
  it('all 8 cells use kimi-k2.5 as ego model on openrouter', () => {
    for (const [name, profile] of Object.entries(cells)) {
      assert.strictEqual(profile.ego.provider, 'openrouter', `${name} ego provider`);
      assert.strictEqual(profile.ego.model, 'kimi-k2.5', `${name} ego model`);
    }
  });

  it('multi-agent cells have a superego config; single-agent cells have superego: null', () => {
    for (const [name, profile] of Object.entries(cells)) {
      if (profile.factors.multi_agent_tutor) {
        assert.ok(profile.superego && typeof profile.superego === 'object', `${name} should have superego config`);
        assert.ok(profile.superego.provider, `${name} superego should have provider`);
        assert.ok(profile.superego.model, `${name} superego should have model`);
      } else {
        assert.strictEqual(profile.superego, null, `${name} should have superego: null`);
      }
    }
  });

  it('all ego models use temperature 0.6', () => {
    for (const [name, profile] of Object.entries(cells)) {
      assert.strictEqual(profile.ego.hyperparameters.temperature, 0.6, `${name} ego temperature`);
    }
  });

  it('superego uses temperature 0.2 (lower than ego)', () => {
    const multiCells = cellNames.filter(n => cells[n].factors.multi_agent_tutor);
    for (const name of multiCells) {
      assert.strictEqual(cells[name].superego.hyperparameters.temperature, 0.2, `${name} superego temperature`);
      assert.ok(
        cells[name].superego.hyperparameters.temperature < cells[name].ego.hyperparameters.temperature,
        `${name} superego temp should be lower than ego temp`
      );
    }
  });
});

// ============================================================================
// LEARNER ARCHITECTURE WIRING
// ============================================================================

describe('factorial design — learner architecture wiring', () => {
  it('each cell learner_architecture maps to a valid profile in learner-agents.yaml', () => {
    for (const [name, profile] of Object.entries(cells)) {
      const arch = profile.learner_architecture;
      assert.ok(arch, `${name} missing learner_architecture`);
      assert.ok(
        learnerConfig.profiles[arch],
        `${name} learner_architecture "${arch}" not found in learner-agents.yaml`
      );
    }
  });

  it('base+unified cells use "unified" learner architecture', () => {
    const matching = cellNames.filter(n => !cells[n].factors.recognition && !cells[n].factors.multi_agent_learner);
    for (const name of matching) {
      assert.strictEqual(cells[name].learner_architecture, 'unified', `${name} learner_architecture`);
    }
  });

  it('base+psycho cells use "ego_superego" learner architecture', () => {
    const matching = cellNames.filter(n => !cells[n].factors.recognition && cells[n].factors.multi_agent_learner);
    for (const name of matching) {
      assert.strictEqual(cells[name].learner_architecture, 'ego_superego', `${name} learner_architecture`);
    }
  });

  it('recognition+unified cells use "unified_recognition" learner architecture', () => {
    const matching = cellNames.filter(n => cells[n].factors.recognition && !cells[n].factors.multi_agent_learner);
    for (const name of matching) {
      assert.strictEqual(cells[name].learner_architecture, 'unified_recognition', `${name} learner_architecture`);
    }
  });

  it('recognition+psycho cells use "ego_superego_recognition" learner architecture', () => {
    const matching = cellNames.filter(n => cells[n].factors.recognition && cells[n].factors.multi_agent_learner);
    for (const name of matching) {
      assert.strictEqual(cells[name].learner_architecture, 'ego_superego_recognition', `${name} learner_architecture`);
    }
  });

  it('ego_superego learner profiles have dialogue.enabled: true with 3 agent slots', () => {
    for (const arch of ['ego_superego', 'ego_superego_recognition']) {
      const profile = learnerConfig.profiles[arch];
      assert.strictEqual(profile.dialogue.enabled, true, `${arch} dialogue.enabled`);
      assert.ok(profile.ego, `${arch} should have ego agent`);
      assert.ok(profile.superego, `${arch} should have superego agent`);
      assert.ok(profile.synthesis, `${arch} should have synthesis agent`);
    }
  });

  it('unified learner profiles have dialogue.enabled: false with 1 agent slot', () => {
    for (const arch of ['unified', 'unified_recognition']) {
      const profile = learnerConfig.profiles[arch];
      assert.strictEqual(profile.dialogue.enabled, false, `${arch} dialogue.enabled`);
      assert.ok(profile.unified_learner, `${arch} should have unified_learner agent`);
      assert.strictEqual(profile.ego, undefined, `${arch} should not have ego agent`);
    }
  });
});
