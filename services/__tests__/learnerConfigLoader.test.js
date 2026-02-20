/**
 * Tests for learnerConfigLoader — verifies config loading, profile resolution,
 * persona/architecture lookups, and default fallback behavior.
 *
 * Includes regression tests that prevent hardcoded model IDs from being
 * introduced into the provider pipeline (see "No hardcoded model IDs" section).
 *
 * Uses node:test (built-in, no dependencies required).
 * Run: node --test services/__tests__/learnerConfigLoader.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadConfig,
  getActiveProfile,
  getArchitecture,
  getPersona,
  getAgentConfig,
  getSynthesisConfig,
  getProfileAgentRoles,
  profileHasSynthesis,
  listProfiles,
  listPersonas,
  listArchitectures,
  getLoggingConfig,
  getEvaluationConfig,
  getLearnerModelOverrides,
  getProviderConfig,
} from '../learnerConfigLoader.js';
import { loadProviders as loadEvalProviders } from '../evalConfigLoader.js';
import { configLoaderBase } from '@machinespirits/tutor-core';

// ============================================================================
// loadConfig
// ============================================================================

describe('loadConfig', () => {
  it('returns an object with expected top-level keys', () => {
    const config = loadConfig(true);
    assert.ok(config, 'should return config');
    assert.ok(config.profiles, 'should have profiles');
    assert.ok(config.personas, 'should have personas');
  });

  it('always includes default personas even when local YAML omits them', () => {
    const config = loadConfig(true);
    assert.ok(config.personas?.eager_novice, 'should have eager_novice persona from defaults');
  });

  it('includes profiles from local learner-agents.yaml', () => {
    const config = loadConfig(true);
    assert.ok(config.profiles?.unified, 'should have unified profile');
    assert.ok(config.profiles?.ego_superego, 'should have ego_superego profile');
  });

  it('returns cached result on second call', () => {
    const first = loadConfig(true);
    const second = loadConfig();
    assert.strictEqual(first, second, 'should return same cached reference');
  });
});

// ============================================================================
// getActiveProfile
// ============================================================================

describe('getActiveProfile', () => {
  const savedEnv = {};

  beforeEach(() => {
    savedEnv.LEARNER_PROFILE = process.env.LEARNER_PROFILE;
    savedEnv.LEARNER_AGENT_PROFILE = process.env.LEARNER_AGENT_PROFILE;
    delete process.env.LEARNER_PROFILE;
    delete process.env.LEARNER_AGENT_PROFILE;
  });

  afterEach(() => {
    if (savedEnv.LEARNER_PROFILE !== undefined) {
      process.env.LEARNER_PROFILE = savedEnv.LEARNER_PROFILE;
    } else {
      delete process.env.LEARNER_PROFILE;
    }
    if (savedEnv.LEARNER_AGENT_PROFILE !== undefined) {
      process.env.LEARNER_AGENT_PROFILE = savedEnv.LEARNER_AGENT_PROFILE;
    } else {
      delete process.env.LEARNER_AGENT_PROFILE;
    }
  });

  it('returns unified profile by default', () => {
    const profile = getActiveProfile();
    assert.ok(profile, 'should return a profile');
    assert.ok(profile.name === 'unified' || profile.architecture === 'unified', 'should be unified');
  });

  it('returns named profile when specified', () => {
    const profile = getActiveProfile('ego_superego');
    assert.ok(profile, 'should return a profile');
    assert.strictEqual(profile.name, 'ego_superego');
  });

  it('falls back to unified for unknown profiles', () => {
    const profile = getActiveProfile('nonexistent_profile_xyz');
    assert.ok(profile, 'should return fallback profile');
    // Falls back to unified — should have architecture or description
    assert.ok(profile.description || profile.architecture, 'should have profile content');
  });

  it('respects LEARNER_PROFILE environment variable', () => {
    process.env.LEARNER_PROFILE = 'ego_superego';
    const profile = getActiveProfile();
    assert.strictEqual(profile.name, 'ego_superego');
  });

  it('explicit profileName overrides environment variable', () => {
    process.env.LEARNER_PROFILE = 'ego_superego';
    const profile = getActiveProfile('unified');
    assert.strictEqual(profile.name, 'unified');
  });

  it('profile includes expected fields', () => {
    const profile = getActiveProfile('ego_superego');
    assert.ok(profile.description, 'should have description');
    assert.ok(profile.dialogue !== undefined, 'should have dialogue config');
  });
});

// ============================================================================
// getArchitecture
// ============================================================================

describe('getArchitecture', () => {
  it('returns unified architecture', () => {
    const arch = getArchitecture('unified');
    assert.ok(arch, 'should return architecture');
    assert.ok(arch.agents, 'should have agents');
    assert.ok(arch.agents.unified_learner, 'should have unified_learner agent');
  });

  it('falls back to unified for unknown architecture', () => {
    const arch = getArchitecture('nonexistent_architecture_xyz');
    assert.ok(arch, 'should return fallback');
    assert.ok(arch.agents, 'should have agents');
  });
});

// ============================================================================
// getPersona
// ============================================================================

describe('getPersona', () => {
  it('returns eager_novice persona', () => {
    const persona = getPersona('eager_novice');
    assert.ok(persona, 'should return persona');
    assert.strictEqual(persona.id, 'eager_novice');
    assert.ok(persona.name, 'should have name');
  });

  it('falls back to eager_novice for unknown persona', () => {
    const persona = getPersona('nonexistent_persona_xyz');
    assert.ok(persona, 'should return fallback');
    assert.ok(persona.name, 'should have name from defaults');
  });

  it('persona includes traits', () => {
    const persona = getPersona('eager_novice');
    assert.ok(persona.traits, 'should have traits');
  });
});

// ============================================================================
// getAgentConfig
// ============================================================================

describe('getAgentConfig', () => {
  it('returns unified_learner agent from unified profile', () => {
    const agent = getAgentConfig('unified_learner', 'unified');
    assert.ok(agent, 'should return agent config');
    assert.strictEqual(agent.role, 'unified_learner');
    assert.ok(agent.provider, 'should have provider');
    assert.ok(agent.model, 'should have model');
    assert.ok(agent.prompt, 'should have prompt');
    assert.ok(agent.hyperparameters, 'should have hyperparameters');
  });

  it('returns ego agent from ego_superego profile', () => {
    const agent = getAgentConfig('ego', 'ego_superego');
    assert.ok(agent, 'should return agent config');
    assert.strictEqual(agent.role, 'ego');
  });

  it('returns null for nonexistent role', () => {
    const agent = getAgentConfig('nonexistent_role', 'unified');
    assert.strictEqual(agent, null);
  });

  it('agent config includes isConfigured flag', () => {
    const agent = getAgentConfig('unified_learner', 'unified');
    assert.ok(agent, 'should return agent config');
    assert.ok('isConfigured' in agent, 'should have isConfigured flag');
  });
});

// ============================================================================
// getSynthesisConfig
// ============================================================================

describe('getSynthesisConfig', () => {
  it('returns synthesis config for ego_superego profile', () => {
    const synthesis = getSynthesisConfig('ego_superego');
    assert.ok(synthesis, 'should return synthesis config');
    assert.strictEqual(synthesis.role, 'synthesis');
    assert.ok(synthesis.prompt, 'should have prompt');
  });

  it('returns null for unified profile (no synthesis)', () => {
    const synthesis = getSynthesisConfig('unified');
    assert.strictEqual(synthesis, null, 'unified should not have synthesis');
  });
});

// ============================================================================
// getProfileAgentRoles
// ============================================================================

describe('getProfileAgentRoles', () => {
  it('unified profile has unified_learner role', () => {
    const roles = getProfileAgentRoles('unified');
    assert.ok(roles.includes('unified_learner'), 'should include unified_learner');
  });

  it('ego_superego profile has ego and superego roles', () => {
    const roles = getProfileAgentRoles('ego_superego');
    assert.ok(roles.includes('ego'), 'should include ego');
    assert.ok(roles.includes('superego'), 'should include superego');
  });

  it('excludes reserved keys (name, description, dialogue, synthesis)', () => {
    const roles = getProfileAgentRoles('ego_superego');
    assert.ok(!roles.includes('name'), 'should not include name');
    assert.ok(!roles.includes('description'), 'should not include description');
    assert.ok(!roles.includes('dialogue'), 'should not include dialogue');
    assert.ok(!roles.includes('synthesis'), 'should not include synthesis');
  });
});

// ============================================================================
// profileHasSynthesis
// ============================================================================

describe('profileHasSynthesis', () => {
  it('ego_superego profile has synthesis', () => {
    assert.ok(profileHasSynthesis('ego_superego'), 'should have synthesis');
  });

  it('unified profile does not have synthesis', () => {
    assert.ok(!profileHasSynthesis('unified'), 'should not have synthesis');
  });
});

// ============================================================================
// listProfiles / listPersonas / listArchitectures
// ============================================================================

describe('listProfiles', () => {
  it('returns array of profile summaries', () => {
    const profiles = listProfiles();
    assert.ok(Array.isArray(profiles), 'should be an array');
    assert.ok(profiles.length >= 2, 'should have at least unified and ego_superego');

    const names = profiles.map((p) => p.name);
    assert.ok(names.includes('unified'), 'should include unified');
    assert.ok(names.includes('ego_superego'), 'should include ego_superego');
  });

  it('each profile has expected fields', () => {
    const profiles = listProfiles();
    for (const p of profiles) {
      assert.ok('name' in p, 'should have name');
      assert.ok('description' in p, 'should have description');
      assert.ok('dialogueEnabled' in p, 'should have dialogueEnabled');
      assert.ok('agents' in p, 'should have agents');
    }
  });
});

describe('listPersonas', () => {
  it('returns array with at least eager_novice', () => {
    const personas = listPersonas();
    assert.ok(Array.isArray(personas), 'should be an array');
    const ids = personas.map((p) => p.id);
    assert.ok(ids.includes('eager_novice'), 'should include eager_novice');
  });
});

describe('listArchitectures', () => {
  it('returns array with at least unified', () => {
    const archs = listArchitectures();
    assert.ok(Array.isArray(archs), 'should be an array');
    const ids = archs.map((a) => a.id);
    assert.ok(ids.includes('unified'), 'should include unified');
  });

  it('each architecture has expected fields', () => {
    const archs = listArchitectures();
    for (const a of archs) {
      assert.ok('id' in a, 'should have id');
      assert.ok('agentCount' in a, 'should have agentCount');
      assert.ok('hasSynthesis' in a, 'should have hasSynthesis');
    }
  });
});

// ============================================================================
// getLoggingConfig / getEvaluationConfig
// ============================================================================

describe('getLoggingConfig', () => {
  it('returns logging configuration', () => {
    const config = getLoggingConfig();
    assert.ok(config, 'should return config');
    assert.ok('log_deliberation' in config || 'log_path' in config, 'should have logging fields');
  });
});

describe('getEvaluationConfig', () => {
  it('returns evaluation configuration', () => {
    const config = getEvaluationConfig();
    assert.ok(config, 'should return config');
  });
});

// ============================================================================
// getLearnerModelOverrides
// ============================================================================

describe('getLearnerModelOverrides', () => {
  it('returns override fields (null when not set)', () => {
    const overrides = getLearnerModelOverrides();
    assert.ok('modelOverride' in overrides, 'should have modelOverride');
    assert.ok('egoModelOverride' in overrides, 'should have egoModelOverride');
    assert.ok('superegoModelOverride' in overrides, 'should have superegoModelOverride');
  });
});

// ============================================================================
// getProviderConfig
// ============================================================================

describe('getProviderConfig', () => {
  it('returns openrouter provider config', () => {
    const config = getProviderConfig('openrouter');
    assert.ok(config, 'should return config');
    assert.ok(config.base_url, 'should have base_url');
    assert.ok(config.models, 'should have models');
  });

  it('includes isConfigured flag', () => {
    const config = getProviderConfig('openrouter');
    assert.ok('isConfigured' in config, 'should have isConfigured');
  });
});

// ============================================================================
// No hardcoded model IDs — regression tests
// ============================================================================

const __test_dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__test_dirname, '..', '..');

describe('No hardcoded model IDs (regression)', () => {

  it('resolved provider config contains no :free model IDs', () => {
    const config = loadConfig(true);
    const providers = config.providers || {};

    for (const [provName, provConfig] of Object.entries(providers)) {
      const models = provConfig.models || {};
      for (const [alias, fullId] of Object.entries(models)) {
        assert.ok(
          !fullId.endsWith(':free'),
          `Provider "${provName}" model "${alias}" resolves to "${fullId}" which has :free suffix`
        );
      }
      if (provConfig.default_model) {
        assert.ok(
          !provConfig.default_model.endsWith(':free'),
          `Provider "${provName}" default_model "${provConfig.default_model}" has :free suffix`
        );
      }
    }
  });

  it('getAgentConfig resolves models without :free suffix', () => {
    // Check every agent in both profiles
    for (const profileName of ['unified', 'ego_superego']) {
      const roles = getProfileAgentRoles(profileName);
      for (const role of roles) {
        const agent = getAgentConfig(role, profileName);
        if (agent?.model) {
          assert.ok(
            !agent.model.endsWith(':free'),
            `Agent "${role}" in profile "${profileName}" resolved model "${agent.model}" has :free suffix`
          );
        }
      }
      // Also check synthesis
      const synthesis = getSynthesisConfig(profileName);
      if (synthesis?.model) {
        assert.ok(
          !synthesis.model.endsWith(':free'),
          `Synthesis in profile "${profileName}" resolved model "${synthesis.model}" has :free suffix`
        );
      }
    }
  });

  it('config-loading services have no hardcoded full model IDs', () => {
    // These service files form the config pipeline and must resolve all models
    // from providers.yaml — no hardcoded vendor/model strings allowed.
    const configServices = [
      'services/learnerConfigLoader.js',
      'services/evaluationRunner.js',
      'services/learnerTutorInteractionEngine.js',
    ];

    // Match patterns like 'nvidia/...' or "nvidia/..." — full provider/model IDs
    const hardcodedPattern = /['"`](nvidia|anthropic|openai|google|deepseek|moonshotai|minimax|qwen|z-ai)\//;

    const allViolations = [];
    for (const filePath of configServices) {
      const src = readFileSync(join(PROJECT_ROOT, filePath), 'utf-8');
      const lines = src.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip comments
        if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;
        if (hardcodedPattern.test(line)) {
          allViolations.push(`${filePath}:${i + 1}: ${line}`);
        }
      }
    }

    assert.strictEqual(
      allViolations.length,
      0,
      `Config-loading services contain hardcoded model IDs:\n${allViolations.join('\n')}`
    );
  });

  it('providers.yaml has no active :free model entries', () => {
    const yamlContent = readFileSync(join(PROJECT_ROOT, 'config', 'providers.yaml'), 'utf-8');
    const lines = yamlContent.split('\n');

    const violations = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip commented-out lines
      if (line.trim().startsWith('#')) continue;
      if (/:free/.test(line)) {
        violations.push(`Line ${i + 1}: ${line.trim()}`);
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      `providers.yaml has active :free entries:\n${violations.join('\n')}`
    );
  });

  it('learner provider config reads from eval-repo providers.yaml (single source of truth)', () => {
    // Verify that the learner config's openrouter providers match
    // what evalConfigLoader reads from config/providers.yaml
    const evalProviders = loadEvalProviders();
    const learnerConfig = loadConfig(true);

    // The nemotron model should be identical in both
    const evalNemotron = evalProviders?.providers?.openrouter?.models?.nemotron;
    const learnerNemotron = learnerConfig?.providers?.openrouter?.models?.nemotron;

    assert.ok(evalNemotron, 'evalConfigLoader should have nemotron');
    assert.strictEqual(
      learnerNemotron,
      evalNemotron,
      `Learner nemotron "${learnerNemotron}" should match eval-repo "${evalNemotron}"`
    );
  });

  it('configLoaderBase.loadProviders() returns same merged providers as evalConfigLoader', () => {
    // All consumers resolve through configLoaderBase.loadProviders() now.
    // Verify it returns the same data as the evalConfigLoader wrapper.
    const baseMerged = configLoaderBase.loadProviders(true);
    const evalWrapped = loadEvalProviders({ forceReload: true });

    assert.ok(baseMerged, 'configLoaderBase should return merged providers');
    assert.ok(evalWrapped?.providers, 'evalConfigLoader should return wrapped providers');

    // The unwrapped base result should equal the eval wrapper's inner providers
    const baseNemotron = baseMerged?.openrouter?.models?.nemotron;
    const evalNemotron = evalWrapped?.providers?.openrouter?.models?.nemotron;

    assert.ok(baseNemotron, 'configLoaderBase should have nemotron');
    assert.strictEqual(
      baseNemotron,
      evalNemotron,
      `configLoaderBase nemotron "${baseNemotron}" should match evalConfigLoader "${evalNemotron}"`
    );
  });
});
