/**
 * Factorial Design Integrity Tests
 *
 * Verifies that the YAML config and profile resolution form a valid factorial
 * design. Tests act as a safety net: changes to config that violate the
 * factorial design contract will break these tests.
 *
 * The design uses 3 factors:
 *   - prompt_type: base | recognition | enhanced | hardwired | placebo
 *   - multi_agent_tutor: boolean
 *   - multi_agent_learner: boolean
 *
 * Core 8 cells (1-8): base × {single,multi} × {unified,psycho}
 *                      recognition × {single,multi} × {unified,psycho}
 * Extended cells (9+): enhanced, hardwired, placebo conditions
 *
 * Covers:
 *   - Config integrity (factor structure, naming convention)
 *   - Prompt file assignment (prompt_type → ego/superego prompt files)
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

// All cell profiles (cell_1 through cell_N)
const cellNames = Object.keys(tutorConfig.profiles).filter((name) => /^cell_\d/.test(name));
const cells = Object.fromEntries(cellNames.map((name) => [name, tutorConfig.profiles[name]]));

// Core 8 factorial cells (base + recognition)
const coreCellNames = cellNames.filter((n) => /^cell_[1-8]_/.test(n));
const coreCells = Object.fromEntries(coreCellNames.map((name) => [name, cells[name]]));

// Valid prompt types
const VALID_PROMPT_TYPES = [
  'base',
  'recognition',
  'enhanced',
  'hardwired',
  'placebo',
  'memory',
  'recognition_nomem',
  'naive',
  'divergent_suspicious',
  'divergent_adversary',
  'divergent_advocate',
  'dialectical_suspicious',
  'dialectical_adversary',
  'dialectical_advocate',
];

// ============================================================================
// CONFIG INTEGRITY
// ============================================================================

describe('factorial design — config integrity', () => {
  it('tutor-agents.yaml has at least 8 factorial cell profiles', () => {
    assert.ok(cellNames.length >= 8, `Expected ≥8 cell profiles, got ${cellNames.length}`);
  });

  it('core cells 1-8 exist', () => {
    assert.strictEqual(
      coreCellNames.length,
      8,
      `Expected 8 core cells, got ${coreCellNames.length}: ${coreCellNames.join(', ')}`,
    );
  });

  it('each cell has a factors block with prompt_type, multi_agent_tutor, multi_agent_learner', () => {
    const requiredKeys = ['multi_agent_learner', 'multi_agent_tutor', 'prompt_type'];
    for (const [name, profile] of Object.entries(cells)) {
      assert.ok(profile.factors, `${name} missing factors block`);
      const keys = Object.keys(profile.factors).sort();
      for (const k of requiredKeys) {
        assert.ok(keys.includes(k), `${name} missing required factor key: ${k}`);
      }
      assert.ok(
        VALID_PROMPT_TYPES.includes(profile.factors.prompt_type),
        `${name} prompt_type "${profile.factors.prompt_type}" not in ${VALID_PROMPT_TYPES.join(',')}`,
      );
      assert.strictEqual(
        typeof profile.factors.multi_agent_tutor,
        'boolean',
        `${name}.factors.multi_agent_tutor should be boolean`,
      );
      assert.strictEqual(
        typeof profile.factors.multi_agent_learner,
        'boolean',
        `${name}.factors.multi_agent_learner should be boolean`,
      );
    }
  });

  it('core 8 cells cover all base/recognition × tutor × learner combinations', () => {
    const combos = new Set();
    for (const [name, profile] of Object.entries(coreCells)) {
      const { prompt_type, multi_agent_tutor, multi_agent_learner } = profile.factors;
      assert.ok(
        ['base', 'recognition'].includes(prompt_type),
        `Core cell ${name} should have prompt_type base or recognition, got ${prompt_type}`,
      );
      combos.add(`${prompt_type}_t${+multi_agent_tutor}_l${+multi_agent_learner}`);
    }
    assert.strictEqual(combos.size, 8, `Expected 8 unique core factor combos, got ${combos.size}`);
  });

  it('cell naming convention matches factors', () => {
    const namePatterns = {
      base: 'base',
      recognition: 'recog',
      enhanced: 'enhanced',
      hardwired: 'hardwired',
      placebo: 'placebo',
      memory: 'memory',
      recognition_nomem: 'recog',
      naive: 'naive',
      divergent_suspicious: 'suspicious',
      divergent_adversary: 'adversary',
      divergent_advocate: 'advocate',
      dialectical_suspicious: 'dialectical',
      dialectical_adversary: 'dialectical',
      dialectical_advocate: 'dialectical',
    };

    // Divergent/dialectical cells encode multi-agent status via superego type name, not "multi"/"single"
    const isDivergent = (pt) => pt.startsWith('divergent_') || pt.startsWith('dialectical_');

    for (const [name, profile] of Object.entries(cells)) {
      const { prompt_type, multi_agent_tutor } = profile.factors;
      const expectedSubstr = namePatterns[prompt_type];
      assert.ok(
        name.includes(expectedSubstr),
        `${name} has prompt_type=${prompt_type} but name lacks "${expectedSubstr}"`,
      );
      if (isDivergent(prompt_type)) {
        // Divergent cells always have multi_agent_tutor=true; superego type in name implies multi-agent
        assert.ok(multi_agent_tutor, `${name} is divergent but multi_agent_tutor is false`);
      } else if (multi_agent_tutor) {
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
  // Expected ego prompt file for each prompt_type
  // Expected ego prompt file for each prompt_type
  // Divergent cells use base or recognition ego depending on recognition_mode
  const egoPromptFiles = {
    base: 'tutor-ego.md',
    recognition: 'tutor-ego-recognition.md',
    enhanced: 'tutor-ego-enhanced.md',
    hardwired: 'tutor-ego-hardwired.md',
    placebo: 'tutor-ego-placebo.md',
    memory: 'tutor-ego-memory.md',
    recognition_nomem: 'tutor-ego-recognition-nomem.md',
    naive: 'tutor-ego-naive.md',
  };

  // Expected superego prompt file for each prompt_type
  const superegoPromptFiles = {
    base: 'tutor-superego.md',
    recognition: 'tutor-superego-recognition.md',
    enhanced: 'tutor-superego-enhanced.md',
    placebo: 'tutor-superego-placebo.md',
    divergent_suspicious: 'tutor-superego-suspicious.md',
    divergent_adversary: 'tutor-superego-adversary.md',
    divergent_advocate: 'tutor-superego-advocate.md',
    dialectical_suspicious: 'tutor-superego-suspicious.md',
    dialectical_adversary: 'tutor-superego-adversary.md',
    dialectical_advocate: 'tutor-superego-advocate.md',
  };

  it('each cell uses the correct ego prompt file for its prompt_type', () => {
    for (const [name, profile] of Object.entries(cells)) {
      const pt = profile.factors.prompt_type;
      let expected;
      if (pt.startsWith('divergent_')) {
        // Divergent cells use base or recognition ego depending on recognition_mode
        expected = profile.recognition_mode ? 'tutor-ego-recognition.md' : 'tutor-ego.md';
      } else if (pt.startsWith('dialectical_')) {
        // Dialectical cells use dialectical or recognition-dialectical ego
        expected = profile.recognition_mode ? 'tutor-ego-recognition-dialectical.md' : 'tutor-ego-dialectical.md';
      } else {
        expected = egoPromptFiles[pt];
      }
      assert.strictEqual(profile.ego.prompt_file, expected, `${name} ego prompt_file`);
    }
  });

  it('multi-agent cells use the correct superego prompt file for their prompt_type', () => {
    const multiCells = cellNames.filter((n) => cells[n].factors.multi_agent_tutor);
    for (const name of multiCells) {
      const expected = superegoPromptFiles[cells[name].factors.prompt_type];
      assert.strictEqual(cells[name].superego.prompt_file, expected, `${name} superego prompt_file`);
    }
  });
});

// ============================================================================
// MODEL CONSISTENCY
// ============================================================================

describe('factorial design — model consistency', () => {
  it('all cells use openrouter as ego provider', () => {
    for (const [name, profile] of Object.entries(cells)) {
      assert.strictEqual(profile.ego.provider, 'openrouter', `${name} ego provider`);
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
    const multiCells = cellNames.filter((n) => cells[n].factors.multi_agent_tutor);
    for (const name of multiCells) {
      assert.strictEqual(cells[name].superego.hyperparameters.temperature, 0.2, `${name} superego temperature`);
      assert.ok(
        cells[name].superego.hyperparameters.temperature < cells[name].ego.hyperparameters.temperature,
        `${name} superego temp should be lower than ego temp`,
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
        `${name} learner_architecture "${arch}" not found in learner-agents.yaml`,
      );
    }
  });

  it('base+unified cells use "unified" learner architecture', () => {
    const matching = cellNames.filter(
      (n) => cells[n].factors.prompt_type === 'base' && !cells[n].factors.multi_agent_learner,
    );
    for (const name of matching) {
      assert.strictEqual(cells[name].learner_architecture, 'unified', `${name} learner_architecture`);
    }
  });

  it('base+psycho cells use "ego_superego" learner architecture', () => {
    const matching = cellNames.filter(
      (n) => cells[n].factors.prompt_type === 'base' && cells[n].factors.multi_agent_learner,
    );
    for (const name of matching) {
      assert.strictEqual(cells[name].learner_architecture, 'ego_superego', `${name} learner_architecture`);
    }
  });

  it('recognition+unified cells use "unified_recognition" learner architecture', () => {
    const matching = cellNames.filter(
      (n) => cells[n].factors.prompt_type === 'recognition' && !cells[n].factors.multi_agent_learner,
    );
    for (const name of matching) {
      assert.strictEqual(cells[name].learner_architecture, 'unified_recognition', `${name} learner_architecture`);
    }
  });

  it('recognition+psycho cells use "ego_superego_recognition" learner architecture', () => {
    const matching = cellNames.filter(
      (n) => cells[n].factors.prompt_type === 'recognition' && cells[n].factors.multi_agent_learner,
    );
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
