/**
 * Tests for evalConfigLoader provider loading and model resolution.
 *
 * Uses node:test (built-in, no dependencies required).
 * Run: node --test services/__tests__/evalConfigLoader.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

import {
  loadProviders,
  getProviderConfig,
  resolveModel,
} from '../evalConfigLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.resolve(__dirname, '../../config');
const PROVIDERS_PATH = path.join(CONFIG_DIR, 'providers.yaml');

// ============================================================================
// loadProviders
// ============================================================================

describe('loadProviders', () => {
  it('loads and parses providers.yaml', () => {
    const data = loadProviders({ forceReload: true });
    assert.ok(data, 'should return parsed data');
    assert.ok(data.providers, 'should have providers key');
  });

  it('contains expected provider keys', () => {
    const data = loadProviders({ forceReload: true });
    const keys = Object.keys(data.providers);
    assert.ok(keys.includes('anthropic'), 'should have anthropic');
    assert.ok(keys.includes('openai'), 'should have openai');
    assert.ok(keys.includes('openrouter'), 'should have openrouter');
    assert.ok(keys.includes('gemini'), 'should have gemini');
    assert.ok(keys.includes('local'), 'should have local');
  });

  it('returns cached result on second call', () => {
    const first = loadProviders({ forceReload: true });
    const second = loadProviders();
    assert.strictEqual(first, second, 'should return same cached reference');
  });

  it('returns fresh result with forceReload', () => {
    const first = loadProviders({ forceReload: true });
    const second = loadProviders({ forceReload: true });
    // Both should have the same content but forceReload re-reads the file.
    // They may or may not be the same reference (re-parsed), but should be equal.
    assert.deepStrictEqual(first, second);
  });

  it('each provider has models map', () => {
    const data = loadProviders({ forceReload: true });
    for (const [name, provider] of Object.entries(data.providers)) {
      assert.ok(provider.models, `${name} should have models`);
      assert.ok(
        typeof provider.models === 'object',
        `${name}.models should be an object`
      );
    }
  });
});

// ============================================================================
// getProviderConfig
// ============================================================================

describe('getProviderConfig', () => {
  // Save and restore env vars to avoid side effects
  const savedEnv = {};
  const envKeys = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'OPENROUTER_API_KEY',
    'GEMINI_API_KEY',
  ];

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it('returns config for a known provider', () => {
    const config = getProviderConfig('anthropic');
    assert.ok(config, 'should return config');
    assert.ok(config.models, 'should have models');
    assert.ok(config.base_url, 'should have base_url');
    assert.strictEqual(config.api_key_env, 'ANTHROPIC_API_KEY');
  });

  it('throws for unknown provider', () => {
    assert.throws(
      () => getProviderConfig('nonexistent'),
      /Unknown provider: nonexistent/
    );
  });

  it('resolves API key from environment', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-123';
    const config = getProviderConfig('anthropic', { forceReload: true });
    assert.strictEqual(config.apiKey, 'test-key-123');
    assert.strictEqual(config.isConfigured, true);
  });

  it('reports isConfigured=false when API key is missing', () => {
    delete process.env.OPENAI_API_KEY;
    const config = getProviderConfig('openai', { forceReload: true });
    assert.strictEqual(config.apiKey, '');
    assert.strictEqual(config.isConfigured, false);
  });

  it('local provider is configured when base_url exists (no API key needed)', () => {
    const config = getProviderConfig('local');
    assert.strictEqual(config.apiKey, '');
    // local has base_url in the yaml, so should be configured
    assert.strictEqual(config.isConfigured, true);
  });

  it('spreads all provider fields into result', () => {
    const config = getProviderConfig('openrouter');
    assert.ok(config.base_url, 'should include base_url from yaml');
    assert.ok(config.default_model, 'should include default_model from yaml');
    assert.ok(config.models, 'should include models from yaml');
  });
});

// ============================================================================
// resolveModel — string format
// ============================================================================

describe('resolveModel (string format)', () => {
  it('resolves "anthropic.sonnet" to full model ID', () => {
    const r = resolveModel('anthropic.sonnet');
    assert.strictEqual(r.provider, 'anthropic');
    assert.strictEqual(r.model, 'claude-sonnet-4-5');
    assert.ok('apiKey' in r, 'should have apiKey field');
    assert.ok('isConfigured' in r, 'should have isConfigured field');
    assert.ok('baseUrl' in r, 'should have baseUrl field');
  });

  it('resolves "anthropic.haiku"', () => {
    const r = resolveModel('anthropic.haiku');
    assert.strictEqual(r.provider, 'anthropic');
    assert.strictEqual(r.model, 'claude-haiku-4-5');
  });

  it('resolves "anthropic.opus"', () => {
    const r = resolveModel('anthropic.opus');
    assert.strictEqual(r.provider, 'anthropic');
    assert.strictEqual(r.model, 'claude-opus-4-5');
  });

  it('resolves "openai.mini"', () => {
    const r = resolveModel('openai.mini');
    assert.strictEqual(r.provider, 'openai');
    assert.strictEqual(r.model, 'gpt-5-mini');
  });

  it('resolves "openai.standard"', () => {
    const r = resolveModel('openai.standard');
    assert.strictEqual(r.provider, 'openai');
    assert.strictEqual(r.model, 'gpt-5.2');
  });

  it('resolves "openrouter.sonnet" to openrouter model ID', () => {
    const r = resolveModel('openrouter.sonnet');
    assert.strictEqual(r.provider, 'openrouter');
    assert.strictEqual(r.model, 'anthropic/claude-sonnet-4.5');
  });

  it('resolves "openrouter.nemotron"', () => {
    const r = resolveModel('openrouter.nemotron');
    assert.strictEqual(r.provider, 'openrouter');
    assert.strictEqual(r.model, 'nvidia/nemotron-3-nano-30b-a3b:free');
  });

  it('resolves "openrouter.deepseek"', () => {
    const r = resolveModel('openrouter.deepseek');
    assert.strictEqual(r.provider, 'openrouter');
    assert.strictEqual(r.model, 'deepseek/deepseek-v3.2');
  });

  it('resolves "gemini.flash"', () => {
    const r = resolveModel('gemini.flash');
    assert.strictEqual(r.provider, 'gemini');
    assert.strictEqual(r.model, 'gemini-3-flash-preview');
  });

  it('resolves "gemini.pro"', () => {
    const r = resolveModel('gemini.pro');
    assert.strictEqual(r.provider, 'gemini');
    assert.strictEqual(r.model, 'gemini-3-pro-preview');
  });

  it('resolves "local.default"', () => {
    const r = resolveModel('local.default');
    assert.strictEqual(r.provider, 'local');
    assert.strictEqual(r.model, 'local-model');
  });

  it('passes through unknown alias as-is', () => {
    const r = resolveModel('openrouter.some-future-model');
    assert.strictEqual(r.provider, 'openrouter');
    assert.strictEqual(r.model, 'some-future-model');
  });

  it('returns baseUrl from provider config', () => {
    const r = resolveModel('openrouter.sonnet');
    assert.strictEqual(r.baseUrl, 'https://openrouter.ai/api/v1/chat/completions');
  });
});

// ============================================================================
// resolveModel — object format
// ============================================================================

describe('resolveModel (object format)', () => {
  it('resolves { provider, model } object', () => {
    const r = resolveModel({ provider: 'anthropic', model: 'haiku' });
    assert.strictEqual(r.provider, 'anthropic');
    assert.strictEqual(r.model, 'claude-haiku-4-5');
  });

  it('passes through unknown model alias in object format', () => {
    const r = resolveModel({ provider: 'openai', model: 'gpt-99-turbo' });
    assert.strictEqual(r.provider, 'openai');
    assert.strictEqual(r.model, 'gpt-99-turbo');
  });
});

// ============================================================================
// resolveModel — error cases
// ============================================================================

describe('resolveModel (error cases)', () => {
  it('throws on single-part string (no dot)', () => {
    assert.throws(
      () => resolveModel('sonnet'),
      /Invalid model reference.*Use format "provider\.model"/
    );
  });

  it('splits on first dot only (handles aliases with dots like kimi-k2.5)', () => {
    // "openrouter.kimi-k2_5" should parse as provider=openrouter, alias=kimi-k2_5
    const r = resolveModel('openrouter.kimi-k2_5');
    assert.strictEqual(r.provider, 'openrouter');
    assert.strictEqual(r.model, 'moonshotai/kimi-k2.5');
  });

  it('throws on unknown provider', () => {
    assert.throws(
      () => resolveModel('fakeprovider.model'),
      /Unknown provider: fakeprovider/
    );
  });

  it('throws on object missing provider', () => {
    assert.throws(
      () => resolveModel({ model: 'haiku' }),
      /must have both "provider" and "model"/
    );
  });

  it('throws on object missing model', () => {
    assert.throws(
      () => resolveModel({ provider: 'anthropic' }),
      /must have both "provider" and "model"/
    );
  });

  it('throws on null', () => {
    assert.throws(
      () => resolveModel(null),
      /Model reference must be a string or object/
    );
  });

  it('throws on number', () => {
    assert.throws(
      () => resolveModel(42),
      /Model reference must be a string or object/
    );
  });

  it('throws on empty object', () => {
    assert.throws(
      () => resolveModel({}),
      /must have both "provider" and "model"/
    );
  });
});

// ============================================================================
// resolveModel — consistency with providers.yaml
// ============================================================================

describe('resolveModel consistency', () => {
  it('every alias in every provider resolves without error', () => {
    const data = loadProviders({ forceReload: true });
    for (const [providerName, provider] of Object.entries(data.providers)) {
      for (const alias of Object.keys(provider.models || {})) {
        const r = resolveModel(`${providerName}.${alias}`);
        assert.strictEqual(r.provider, providerName);
        // Resolved model should match the value in yaml
        assert.strictEqual(
          r.model,
          provider.models[alias],
          `${providerName}.${alias} should resolve to ${provider.models[alias]}`
        );
      }
    }
  });

  it('string and object format produce identical results', () => {
    const fromString = resolveModel('anthropic.sonnet');
    const fromObject = resolveModel({ provider: 'anthropic', model: 'sonnet' });
    assert.deepStrictEqual(fromString, fromObject);
  });
});
